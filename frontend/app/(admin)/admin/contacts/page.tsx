'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Pencil, Trash2 } from 'lucide-react';
import {
	createPropertyContact,
	deletePropertyContact,
	getPropertyContacts,
	updatePropertyContact,
	type PropertyContact,
} from '@/lib/api';
import { Spinner } from '@/components/ui/spinner';

import { ContactForm, type PhoneEntry } from '@/components/admin/ContactForm';

const typeLabels = { owner: 'Owner', broker: 'Broker' } as const;
const typeBadge = {
	owner: 'bg-[#e0f1e7] dark:bg-green-950 text-[#28704b] dark:text-green-300',
	broker: 'bg-[#e4ecf5] text-[#41627f]',
} as const;

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
					<p className='text-sm font-medium text-[#75847c] dark:text-zinc-400'>Property management</p>
					<h2 className='mt-1 text-3xl font-semibold tracking-tight'>Contacts</h2>
					<p className='mt-2 text-sm text-[#75847c] dark:text-zinc-400'>Owners and brokers linked to your listings.</p>
				</div>
				{!showCreate && (
					<button
						type='button'
						onClick={() => { setShowCreate(true); setEditingContact(null); }}
						className='inline-flex items-center justify-center rounded-lg bg-[#28513f] dark:bg-emerald-700 px-5 py-3 text-sm font-semibold text-white dark:text-zinc-200 shadow-sm hover:bg-[#1e4031] dark:hover:bg-emerald-600'
					>
						<span className='mr-2 text-lg leading-none'>+</span> Add Contact
					</button>
				)}
			</div>

			{/* Create form */}
			{showCreate && (
				<div ref={formRef} className='mb-6 rounded-xl border border-[#dce4df] dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 shadow-sm'>
					<h3 className='mb-4 text-base font-semibold'>New contact</h3>
					<ContactForm
						onSave={handleCreate}
						onCancel={() => setShowCreate(false)}
						saving={creating}
					/>
				</div>
			)}

			<div className='overflow-hidden rounded-xl border border-[#dce4df] dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-[0_8px_24px_rgba(25,53,43,0.04)] dark:shadow-none'>
				<div className='flex items-center justify-between border-b border-[#e6ebe8] dark:border-zinc-800 px-5 py-4'>
					<p className='text-sm font-semibold'>
						All contacts{' '}
						<span className='ml-1 font-normal text-[#8a968f] dark:text-zinc-400'>({contacts.length})</span>
					</p>
				</div>

				{loading ? (
					<div className='flex justify-center py-16'>
						<Spinner className='h-5 w-5 text-[#28513f]' />
					</div>
				) : contacts.length === 0 ? (
					<p className='px-5 py-16 text-center text-sm text-[#8a968f] dark:text-zinc-400'>No contacts yet. Add one above.</p>
				) : (
					<ul className='divide-y divide-[#edf0ee] dark:divide-zinc-800'>
						{contacts.map((contact) => (
							<li key={contact.id}>
								{/* Collapsed row */}
								{editingContact?.id !== contact.id && (
									<div className='px-5 py-4'>
										<div className='flex flex-wrap items-start justify-between gap-3'>
											<div className='min-w-0'>
												<div className='flex flex-wrap items-center gap-2'>
													<span className='font-semibold text-[#253a30] dark:text-zinc-200'>{contact.full_name}</span>
													<span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${typeBadge[contact.contact_type]}`}>
														{typeLabels[contact.contact_type]}
													</span>
												</div>
												{contact.company_name && (
													<p className='mt-0.5 text-sm text-[#65736b] dark:text-zinc-300'>{contact.company_name}</p>
												)}
												{contact.phones.length > 0 && (
													<div className='mt-1.5 flex flex-wrap gap-x-4 gap-y-1'>
														{contact.phones.map((p) => (
															<span key={p.id} className='flex items-center gap-1 text-sm text-[#344b3f] dark:text-zinc-200'>
																{p.is_whatsapp && (
																	<svg className='h-3.5 w-3.5 text-[#25a244]' viewBox='0 0 24 24' fill='currentColor'>
																		<path d='M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z' />
																	</svg>
																)}
																<span>{p.phone}</span>
																{p.label && <span className='text-[#8a968f] dark:text-zinc-400'>({p.label})</span>}
															</span>
														))}
													</div>
												)}
												{contact.email && (
													<p className='mt-1 text-xs text-[#65736b] dark:text-zinc-300'>{contact.email}</p>
												)}
											</div>
											<div className='flex shrink-0 items-center gap-3'>
												<button
													type='button'
													onClick={() => setExpandedId(expandedId === contact.id ? null : contact.id)}
													className='inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-semibold text-[#65736b] dark:text-zinc-300 transition-colors hover:bg-gray-100 dark:hover:bg-zinc-800 cursor-pointer'
												>
													{expandedId === contact.id ? 'Less' : 'Notes'}
												</button>
												<button
													type='button'
													onClick={() => { setEditingContact(contact); setShowCreate(false); }}
													className='inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-semibold text-[#35664f] dark:text-emerald-400 transition-colors hover:bg-[#e0f1e7] dark:hover:bg-emerald-950 cursor-pointer'
												>
													<Pencil className="h-3.5 w-3.5" />
													Edit
												</button>
												<button
													type='button'
													disabled={deletingId === contact.id}
													onClick={() => handleDelete(contact.id)}
													className='inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-semibold text-[#a34d4d] dark:text-red-400 transition-colors hover:bg-red-50 dark:hover:bg-red-950 cursor-pointer disabled:opacity-50'
												>
													{deletingId === contact.id ? <Spinner className='inline h-3.5 w-3.5' /> : <Trash2 className="h-3.5 w-3.5" />}
													Delete
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
										<p className='mb-4 text-sm font-semibold text-[#253a30] dark:text-zinc-200'>Editing {contact.full_name}</p>
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
