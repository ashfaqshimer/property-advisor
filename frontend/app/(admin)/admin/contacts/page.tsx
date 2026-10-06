'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Pencil, Trash2, Plus } from 'lucide-react';
import {
	createPropertyContact,
	deletePropertyContact,
	getPropertyContacts,
	updatePropertyContact,
	getCurrentUser,
	type AuthUser,
	type PropertyContact,
} from '@/lib/api';
import { Spinner } from '@/components/ui/spinner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ContactForm } from '@/components/admin/ContactForm';

const typeLabels = { owner: 'Owner', broker: 'Broker' } as const;
const typeBadgeVariants: Record<'owner' | 'broker', 'success' | 'info'> = {
	owner: 'success',
	broker: 'info',
};

export default function AdminContactsPage() {
	const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
	const [contacts, setContacts] = useState<PropertyContact[]>([]);
	const [loading, setLoading] = useState(true);
	const [showCreate, setShowCreate] = useState(false);
	const [creating, setCreating] = useState(false);
	const [editingContact, setEditingContact] = useState<PropertyContact | null>(null);
	const [updating, setUpdating] = useState(false);
	const [deletingId, setDeletingId] = useState<string | null>(null);
	const [expandedId, setExpandedId] = useState<string | null>(null);
	const formRef = useRef<HTMLDivElement>(null);

	const canDelete = currentUser?.role === 'root' || currentUser?.role === 'admin';

	useEffect(() => {
		getCurrentUser().then(setCurrentUser).catch(() => {});
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
		if (!canDelete) return;
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
					<p className='text-sm font-medium text-muted-foreground'>Property management</p>
					<h2 className='mt-1 text-3xl font-semibold tracking-tight text-foreground'>Contacts</h2>
					<p className='mt-2 text-sm text-muted-foreground'>Owners and brokers linked to your listings.</p>
				</div>
				{!showCreate && (
					<Button
						type='button'
						onClick={() => { setShowCreate(true); setEditingContact(null); }}
						className='gap-2'
					>
						<Plus className='h-4 w-4' /> Add Contact
					</Button>
				)}
			</div>

			{/* Create form */}
			{showCreate && (
				<div ref={formRef} className='mb-6 rounded-xl border border-border bg-card p-6 shadow-xs'>
					<h3 className='mb-4 text-base font-semibold text-foreground'>New contact</h3>
					<ContactForm
						onSave={handleCreate}
						onCancel={() => setShowCreate(false)}
						saving={creating}
					/>
				</div>
			)}

			<div className='overflow-hidden rounded-xl border border-border bg-card shadow-xs'>
				<div className='flex items-center justify-between border-b border-border px-5 py-4'>
					<p className='text-sm font-semibold text-foreground'>
						All contacts{' '}
						<span className='ml-1 font-normal text-muted-foreground'>({contacts.length})</span>
					</p>
				</div>

				{loading ? (
					<div className='flex justify-center py-16'>
						<Spinner className='h-5 w-5 text-primary' />
					</div>
				) : contacts.length === 0 ? (
					<p className='px-5 py-16 text-center text-sm text-muted-foreground'>No contacts yet. Add one above.</p>
				) : (
					<ul className='divide-y divide-border'>
						{contacts.map((contact) => (
							<li key={contact.id}>
								{/* Collapsed row */}
								{editingContact?.id !== contact.id && (
									<div className='px-5 py-4'>
										<div className='flex flex-wrap items-start justify-between gap-3'>
											<div className='min-w-0'>
												<div className='flex flex-wrap items-center gap-2'>
													<span className='font-semibold text-foreground'>{contact.full_name}</span>
													<Badge variant={typeBadgeVariants[contact.contact_type]} className='text-[10px] font-semibold uppercase tracking-wide'>
														{typeLabels[contact.contact_type]}
													</Badge>
												</div>
												{contact.company_name && (
													<p className='mt-0.5 text-sm text-muted-foreground'>{contact.company_name}</p>
												)}
												{contact.phones.length > 0 && (
													<div className='mt-1.5 flex flex-wrap gap-x-4 gap-y-1'>
														{contact.phones.map((p) => (
															<span key={p.id} className='flex items-center gap-1 text-sm text-foreground'>
																{p.is_whatsapp && (
																	<svg className='h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400' viewBox='0 0 24 24' fill='currentColor'>
																		<path d='M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z' />
																	</svg>
																)}
																<span>{p.phone}</span>
																{p.label && <span className='text-muted-foreground'>({p.label})</span>}
															</span>
														))}
													</div>
												)}
												{contact.email && (
													<p className='mt-1 text-xs text-muted-foreground'>{contact.email}</p>
												)}
											</div>
											<div className='flex shrink-0 items-center gap-2'>
												<Button
													type='button'
													variant="ghost"
													size="sm"
													onClick={() => setExpandedId(expandedId === contact.id ? null : contact.id)}
													className='h-8 px-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground'
												>
													{expandedId === contact.id ? 'Less' : 'Notes'}
												</Button>
												<Button
													type='button'
													variant="ghost"
													size="sm"
													onClick={() => { setEditingContact(contact); setShowCreate(false); }}
													className='h-8 gap-1.5 px-2.5 text-xs font-semibold text-primary hover:bg-primary/10 hover:text-primary'
												>
													<Pencil className="h-3.5 w-3.5" />
													Edit
												</Button>
												{canDelete && (
													<Button
														type='button'
														variant="ghost"
														size="sm"
														disabled={deletingId === contact.id}
														onClick={() => handleDelete(contact.id)}
														className='h-8 gap-1.5 px-2.5 text-xs font-semibold text-destructive hover:bg-destructive/10 hover:text-destructive'
													>
														{deletingId === contact.id ? <Spinner className='inline h-3.5 w-3.5' /> : <Trash2 className="h-3.5 w-3.5" />}
														Delete
													</Button>
												)}
											</div>
										</div>
										{expandedId === contact.id && contact.notes && (
											<p className='mt-2 rounded-lg bg-muted/50 border border-border px-3 py-2 text-sm text-muted-foreground'>
												{contact.notes}
											</p>
										)}
									</div>
								)}

								{/* Edit form inline */}
								{editingContact?.id === contact.id && (
									<div className='bg-muted/30 border-y border-border px-5 py-5 transition-colors'>
										<p className='mb-4 text-sm font-semibold text-foreground'>Editing {contact.full_name}</p>
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
