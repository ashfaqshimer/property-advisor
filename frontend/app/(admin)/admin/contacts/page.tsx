'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import {
	createPropertyContact,
	deletePropertyContact,
	getPropertyContacts,
	updatePropertyContact,
	type PropertyContact,
} from '@/lib/api';
import { Spinner } from '@/components/ui/spinner';

type PhoneEntry = { phone: string; label: string; is_whatsapp: boolean };

const typeLabels = { owner: 'Owner', broker: 'Broker' } as const;
const typeBadge = {
	owner: 'bg-[#e0f1e7] text-[#28704b]',
	broker: 'bg-[#e4ecf5] text-[#41627f]',
} as const;

function EmptyPhoneEntry(): PhoneEntry {
	return { phone: '', label: '', is_whatsapp: false };
}

function ContactForm({
	initial,
	onSave,
	onCancel,
	saving,
}: {
	initial?: PropertyContact;
	onSave: (data: {
		contact_type: 'owner' | 'broker';
		full_name: string;
		company_name: string | null;
		email: string | null;
		notes: string | null;
		phones: PhoneEntry[];
	}) => void;
	onCancel: () => void;
	saving: boolean;
}) {
	const [contactType, setContactType] = useState<'owner' | 'broker'>(initial?.contact_type ?? 'owner');
	const [fullName, setFullName] = useState(initial?.full_name ?? '');
	const [companyName, setCompanyName] = useState(initial?.company_name ?? '');
	const [email, setEmail] = useState(initial?.email ?? '');
	const [notes, setNotes] = useState(initial?.notes ?? '');
	const [phones, setPhones] = useState<PhoneEntry[]>(
		initial?.phones.length
			? initial.phones.map((p) => ({ phone: p.phone, label: p.label ?? '', is_whatsapp: p.is_whatsapp }))
			: [EmptyPhoneEntry()],
	);

	function addPhone() {
		setPhones((prev) => [...prev, EmptyPhoneEntry()]);
	}
	function removePhone(i: number) {
		setPhones((prev) => prev.filter((_, idx) => idx !== i));
	}
	function updatePhone(i: number, field: keyof PhoneEntry, value: string | boolean) {
		setPhones((prev) => prev.map((p, idx) => (idx === i ? { ...p, [field]: value } : p)));
	}

	function handleSubmit(e: FormEvent) {
		e.preventDefault();
		onSave({
			contact_type: contactType,
			full_name: fullName.trim(),
			company_name: companyName.trim() || null,
			email: email.trim() || null,
			notes: notes.trim() || null,
			phones: phones.filter((p) => p.phone.trim()),
		});
	}

	const inputCls = 'w-full rounded-lg border border-[#d0dbd4] bg-white px-3 py-2 text-sm text-[#1a2923] placeholder:text-[#9aab9e] focus:border-[#35664f] focus:outline-none';
	const labelCls = 'block text-xs font-semibold text-[#65736b] mb-1';

	return (
		<form onSubmit={handleSubmit} className='space-y-4'>
			<div className='grid grid-cols-2 gap-3'>
				<div>
					<label className={labelCls}>Type</label>
					<select value={contactType} onChange={(e) => setContactType(e.target.value as 'owner' | 'broker')} className={inputCls}>
						<option value='owner'>Owner</option>
						<option value='broker'>Broker</option>
					</select>
				</div>
				<div>
					<label className={labelCls}>Full name *</label>
					<input required value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputCls} placeholder='e.g. Nimal Perera' />
				</div>
			</div>
			<div className='grid grid-cols-2 gap-3'>
				<div>
					<label className={labelCls}>Company / brokerage</label>
					<input value={companyName} onChange={(e) => setCompanyName(e.target.value)} className={inputCls} placeholder='Optional' />
				</div>
				<div>
					<label className={labelCls}>Email</label>
					<input type='email' value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder='Optional' />
				</div>
			</div>

			{/* Phone numbers */}
			<div>
				<div className='flex items-center justify-between mb-2'>
					<span className={labelCls + ' mb-0'}>Phone numbers</span>
					<button type='button' onClick={addPhone} className='text-xs font-semibold text-[#35664f] hover:underline'>
						+ Add number
					</button>
				</div>
				<div className='space-y-2'>
					{phones.map((p, i) => (
						<div key={i} className='flex gap-2 items-center'>
							<input
								value={p.phone}
								onChange={(e) => updatePhone(i, 'phone', e.target.value)}
								className={inputCls + ' flex-1'}
								placeholder='+94 77 123 4567'
							/>
							<input
								value={p.label}
								onChange={(e) => updatePhone(i, 'label', e.target.value)}
								className={inputCls + ' w-24'}
								placeholder='Label'
							/>
							<label className='flex items-center gap-1 text-xs text-[#65736b] shrink-0 cursor-pointer select-none'>
								<input
									type='checkbox'
									checked={p.is_whatsapp}
									onChange={(e) => updatePhone(i, 'is_whatsapp', e.target.checked)}
									className='accent-[#25a244]'
								/>
								WA
							</label>
							{phones.length > 1 && (
								<button type='button' onClick={() => removePhone(i)} className='text-[#a34d4d] text-lg leading-none hover:opacity-70'>
									×
								</button>
							)}
						</div>
					))}
				</div>
			</div>

			<div>
				<label className={labelCls}>Notes</label>
				<textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputCls + ' resize-none'} placeholder='Internal notes about this contact' />
			</div>

			<div className='flex justify-end gap-3 pt-1'>
				<button type='button' onClick={onCancel} className='rounded-lg border border-[#cbd9d0] px-4 py-2 text-sm font-semibold text-[#28513f] hover:bg-[#f4f8f5]'>
					Cancel
				</button>
				<button type='submit' disabled={saving} className='inline-flex items-center gap-2 rounded-lg bg-[#28513f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1e4031] disabled:opacity-60'>
					{saving && <Spinner className='h-4 w-4' />}
					{initial ? 'Save changes' : 'Add contact'}
				</button>
			</div>
		</form>
	);
}

export default function AdminContactsPage() {
	const [contacts, setContacts] = useState<PropertyContact[]>([]);
	const [loading, setLoading] = useState(true);
	const [showCreate, setShowCreate] = useState(false);
	const [creating, setCreating] = useState(false);
	const [editingContact, setEditingContact] = useState<PropertyContact | null>(null);
	const [updating, setUpdating] = useState(false);
	const [deletingId, setDeletingId] = useState<string | null>(null);
	const [expandedId, setExpandedId] = useState<string | null>(null);
	const formRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		getPropertyContacts()
			.then(setContacts)
			.catch((err: unknown) => toast.error(err instanceof Error ? err.message : 'Could not load contacts.'))
			.finally(() => setLoading(false));
	}, []);

	useEffect(() => {
		if (showCreate) formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}, [showCreate]);

	async function handleCreate(data: Parameters<typeof createPropertyContact>[0]) {
		setCreating(true);
		try {
			const created = await createPropertyContact(data);
			setContacts((prev) => [created, ...prev]);
			setShowCreate(false);
			toast.success('Contact added.');
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Could not create contact.');
		} finally {
			setCreating(false);
		}
	}

	async function handleUpdate(id: string, data: Parameters<typeof updatePropertyContact>[1]) {
		setUpdating(true);
		try {
			const updated = await updatePropertyContact(id, data);
			setContacts((prev) => prev.map((c) => (c.id === id ? updated : c)));
			setEditingContact(null);
			toast.success('Contact updated.');
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Could not update contact.');
		} finally {
			setUpdating(false);
		}
	}

	async function handleDelete(id: string) {
		setDeletingId(id);
		try {
			await deletePropertyContact(id);
			setContacts((prev) => prev.filter((c) => c.id !== id));
			toast.success('Contact deleted.');
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Could not delete contact.');
		} finally {
			setDeletingId(null);
		}
	}

	return (
		<section className='mx-auto max-w-[900px]'>
			<div className='mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end'>
				<div>
					<p className='text-sm font-medium text-[#75847c]'>Property management</p>
					<h2 className='mt-1 text-3xl font-semibold tracking-tight'>Contacts</h2>
					<p className='mt-2 text-sm text-[#75847c]'>Owners and brokers linked to your listings.</p>
				</div>
				{!showCreate && (
					<button
						type='button'
						onClick={() => { setShowCreate(true); setEditingContact(null); }}
						className='inline-flex items-center justify-center rounded-lg bg-[#28513f] px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#1e4031]'
					>
						<span className='mr-2 text-lg leading-none'>+</span> Add Contact
					</button>
				)}
			</div>

			{/* Create form */}
			{showCreate && (
				<div ref={formRef} className='mb-6 rounded-xl border border-[#dce4df] bg-white p-6 shadow-sm'>
					<h3 className='mb-4 text-base font-semibold'>New contact</h3>
					<ContactForm
						onSave={handleCreate}
						onCancel={() => setShowCreate(false)}
						saving={creating}
					/>
				</div>
			)}

			<div className='overflow-hidden rounded-xl border border-[#dce4df] bg-white shadow-[0_8px_24px_rgba(25,53,43,0.04)]'>
				<div className='flex items-center justify-between border-b border-[#e6ebe8] px-5 py-4'>
					<p className='text-sm font-semibold'>
						All contacts{' '}
						<span className='ml-1 font-normal text-[#8a968f]'>({contacts.length})</span>
					</p>
				</div>

				{loading ? (
					<div className='flex justify-center py-16'>
						<Spinner className='h-5 w-5 text-[#28513f]' />
					</div>
				) : contacts.length === 0 ? (
					<p className='px-5 py-16 text-center text-sm text-[#8a968f]'>No contacts yet. Add one above.</p>
				) : (
					<ul className='divide-y divide-[#edf0ee]'>
						{contacts.map((contact) => (
							<li key={contact.id}>
								{/* Collapsed row */}
								{editingContact?.id !== contact.id && (
									<div className='px-5 py-4'>
										<div className='flex flex-wrap items-start justify-between gap-3'>
											<div className='min-w-0'>
												<div className='flex flex-wrap items-center gap-2'>
													<span className='font-semibold text-[#253a30]'>{contact.full_name}</span>
													<span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${typeBadge[contact.contact_type]}`}>
														{typeLabels[contact.contact_type]}
													</span>
												</div>
												{contact.company_name && (
													<p className='mt-0.5 text-sm text-[#65736b]'>{contact.company_name}</p>
												)}
												{contact.phones.length > 0 && (
													<div className='mt-1.5 flex flex-wrap gap-x-4 gap-y-1'>
														{contact.phones.map((p) => (
															<span key={p.id} className='flex items-center gap-1 text-sm text-[#344b3f]'>
																{p.is_whatsapp && (
																	<svg className='h-3.5 w-3.5 text-[#25a244]' viewBox='0 0 24 24' fill='currentColor'>
																		<path d='M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z' />
																	</svg>
																)}
																<span>{p.phone}</span>
																{p.label && <span className='text-[#8a968f]'>({p.label})</span>}
															</span>
														))}
													</div>
												)}
												{contact.email && (
													<p className='mt-1 text-xs text-[#65736b]'>{contact.email}</p>
												)}
											</div>
											<div className='flex shrink-0 items-center gap-3'>
												<button
													type='button'
													onClick={() => setExpandedId(expandedId === contact.id ? null : contact.id)}
													className='text-xs font-semibold text-[#65736b] hover:text-[#1a2923]'
												>
													{expandedId === contact.id ? 'Less' : 'Notes'}
												</button>
												<button
													type='button'
													onClick={() => { setEditingContact(contact); setShowCreate(false); }}
													className='text-xs font-semibold text-[#35664f] hover:underline'
												>
													Edit
												</button>
												<button
													type='button'
													disabled={deletingId === contact.id}
													onClick={() => handleDelete(contact.id)}
													className='text-xs font-semibold text-[#a34d4d] hover:underline disabled:opacity-50'
												>
													{deletingId === contact.id ? <Spinner className='inline h-3 w-3' /> : 'Delete'}
												</button>
											</div>
										</div>
										{expandedId === contact.id && contact.notes && (
											<p className='mt-2 rounded-lg bg-[#f4f8f5] px-3 py-2 text-sm text-[#475f52]'>
												{contact.notes}
											</p>
										)}
									</div>
								)}

								{/* Edit form inline */}
								{editingContact?.id === contact.id && (
									<div className='bg-[#fafcfa] px-5 py-5'>
										<p className='mb-4 text-sm font-semibold text-[#253a30]'>Editing {contact.full_name}</p>
										<ContactForm
											initial={contact}
											onSave={(data) => handleUpdate(contact.id, data)}
											onCancel={() => setEditingContact(null)}
											saving={updating}
										/>
									</div>
								)}
							</li>
						))}
					</ul>
				)}
			</div>
		</section>
	);
}
