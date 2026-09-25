'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Pencil, Trash2 } from 'lucide-react';
import {
	deleteAdminProperty,
	getAdminProperties,
	getPropertyContacts,
	getCurrentUser,
	updateAdminProperty,
	type PropertyContact,
} from '@/lib/api';
import { Spinner } from '@/components/ui/spinner';

type PropertyStatus = 'available' | 'under_offer' | 'sold';
type Property = {
	id: string;
	title: string;
	type: string;
	location: string;
	price: string;
	status: PropertyStatus;
	featured: boolean;
	contactId: string | null;
	contactName: string | null;
};

const statusStyles: Record<PropertyStatus, string> = {
	available: 'bg-[#e0f1e7] dark:bg-green-950 text-[#28704b] dark:text-green-300',
	under_offer: 'bg-[#fff0d5] dark:bg-yellow-950 text-[#9a6415] dark:text-yellow-300',
	sold: 'bg-[#e9e9ea] dark:bg-zinc-800 text-[#62666b] dark:text-zinc-300',
};

export default function AdminPropertiesPage() {
	const [properties, setProperties] = useState<Property[]>([]);
	const [contacts, setContacts] = useState<PropertyContact[]>([]);
	const [loading, setLoading] = useState(true);
	const [busyProperty, setBusyProperty] = useState<string | null>(null);
	const [canDelete, setCanDelete] = useState(false);
	const [assigningId, setAssigningId] = useState<string | null>(null);
	const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
	useEffect(() => {
		getCurrentUser().then((user) => setCanDelete(user?.role === 'root')).catch(() => {});
		getPropertyContacts().then(setContacts).catch(() => {});
		getAdminProperties()
			.then((records) =>
				setProperties(
					records.map((record) => ({
						id: record.id,
						title: record.title,
						type: record.property_type,
						location: record.location,
						price: `LKR ${record.price.toLocaleString()}`,
						status: record.status as PropertyStatus,
						featured: record.is_featured,
						contactId: record.property_contact_id,
						contactName: record.property_contact?.full_name ?? null,
					})),
				),
			)
			.catch((reason) =>
				toast.error(
					reason instanceof Error
						? reason.message
						: 'Could not load properties.',
				),
			)
			.finally(() => setLoading(false));
	}, []);
	async function toggleFeatured(id: string, featured: boolean) {
		setBusyProperty(id);
		try {
			const updated = await updateAdminProperty(id, { is_featured: !featured });
			setProperties((current) =>
				current.map((property) =>
					property.id === id
						? { ...property, featured: updated.is_featured }
						: property,
				),
			);
			toast.success('Property updated successfully.');
		} catch (reason) {
			toast.error(
				reason instanceof Error
					? reason.message
					: 'Could not update the property.',
			);
		} finally {
			setBusyProperty(null);
		}
	}
	async function assignContact(propertyId: string, contactId: string | null) {
		setAssigningId(propertyId);
		try {
			const updated = await updateAdminProperty(propertyId, { property_contact_id: contactId });
			const matched = contacts.find((c) => c.id === updated.property_contact_id) ?? null;
			setProperties((current) =>
				current.map((p) =>
					p.id === propertyId
						? { ...p, contactId: updated.property_contact_id, contactName: matched?.full_name ?? null }
						: p,
				),
			);
			toast.success('Contact assigned.');
		} catch (reason) {
			toast.error(reason instanceof Error ? reason.message : 'Could not assign contact.');
		} finally {
			setAssigningId(null);
		}
	}
	async function deleteProperty(id: string) {
		setBusyProperty(id);
		try {
			await deleteAdminProperty(id);
			setProperties((current) =>
				current.filter((property) => property.id !== id),
			);
			toast.success('Property deleted successfully.');
		} catch (reason) {
			toast.error(
				reason instanceof Error
					? reason.message
					: 'Could not delete the property.',
			);
		} finally {
			setBusyProperty(null);
		}
	}
	return (
		<section className='mx-auto max-w-[1380px]'>
			<div className='mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end'>
				<div>
					<p className='text-sm font-medium text-[#75847c] dark:text-zinc-400'>
						Catalog management
					</p>
					<h2 className='mt-1 text-3xl font-semibold tracking-tight'>
						Properties
					</h2>
					<p className='mt-2 text-sm text-[#75847c] dark:text-zinc-400'>
						Manage listings, visibility, and featured placements.
					</p>
				</div>
				<div className='flex flex-wrap items-center gap-3'>
					<Link
						href='/'
						className='inline-flex items-center justify-center rounded-lg border border-[#cbd9d0] bg-white dark:bg-zinc-950 px-5 py-3 text-sm font-semibold text-[#28513f] transition hover:bg-[#f4f8f5]'
					>
						View customer site
					</Link>
					<Link
						href='/admin/properties/new'
						className='inline-flex items-center justify-center rounded-lg bg-[#28513f] dark:bg-emerald-700 px-5 py-3 text-sm font-semibold text-white dark:text-zinc-200 shadow-sm transition hover:bg-[#1e4031] dark:hover:bg-emerald-600'
					>
						<span className='mr-2 text-lg leading-none'>+</span> Add Property
					</Link>
				</div>
			</div>
			<div className='overflow-hidden rounded-xl border border-[#dce4df] dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-[0_8px_24px_rgba(25,53,43,0.04)] dark:shadow-none'>
				<div className='flex items-center justify-between border-b border-[#e6ebe8] dark:border-zinc-800 px-5 py-4'>
					<p className='text-sm font-semibold'>
						All properties{' '}
						<span className='ml-1 font-normal text-[#8a968f] dark:text-zinc-400'>
							({properties.length})
						</span>
					</p>
					<span className='text-xs text-[#8a968f] dark:text-zinc-400'>Live data</span>
				</div>
				<div className='hidden sm:block overflow-x-auto'>
					<table className='w-full min-w-[900px] text-left text-sm'>
						<thead className='bg-[#f8faf8] dark:bg-zinc-900 text-xs uppercase tracking-[0.12em] text-[#7a8780] dark:text-zinc-400'>
							<tr>
								<th className='px-5 py-4 font-semibold'>Property</th>
								<th className='px-4 py-4 font-semibold'>Type</th>
								<th className='px-4 py-4 font-semibold'>Location</th>
								<th className='px-4 py-4 font-semibold'>Price (LKR)</th>
								<th className='px-4 py-4 font-semibold'>Status</th>
								<th className='px-4 py-4 font-semibold'>Contact</th>
								<th className='px-4 py-4 font-semibold'>Featured</th>
								<th className='px-5 py-4 text-right font-semibold'>Actions</th>
							</tr>
						</thead>
						<tbody className='divide-y divide-[#edf0ee] dark:divide-zinc-800'>
							{loading ? (
								<tr>
									<td className='px-5 py-12 text-center' colSpan={7}>
										<Spinner className='mx-auto h-5 w-5 text-[#28513f]' />
										<span className='sr-only'>Loading properties</span>
									</td>
								</tr>
							) : properties.map((property) => (
								<tr key={property.id} className='transition hover:bg-[#fbfcfb] dark:hover:bg-zinc-900'>
									<td className='px-5 py-4'>
										<span className='font-semibold text-[#253a30] dark:text-zinc-200'>
											{property.title}
										</span>
									</td>
									<td className='px-4 py-4 text-[#65736b] dark:text-zinc-300'>{property.type}</td>
									<td className='px-4 py-4 text-[#65736b] dark:text-zinc-300'>
										{property.location}
									</td>
									<td className='px-4 py-4 font-medium text-[#344b3f] dark:text-zinc-200'>
										{property.price.replace('LKR ', '')}
									</td>
									<td className='px-4 py-4'>
										<span
											className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyles[property.status]}`}
										>
											{property.status.replace('_', ' ')}
										</span>
									</td>
									<td className='px-4 py-4 text-sm'>
										{assigningId === property.id ? (
											<Spinner className='h-4 w-4 text-[#28513f]' />
										) : (
											<select
												value={property.contactId ?? ''}
												onChange={(e) => assignContact(property.id, e.target.value || null)}
												className='max-w-[160px] truncate rounded border border-[#d0dbd4] dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1 text-xs text-[#1a2923] dark:text-zinc-200 focus:border-[#35664f] focus:outline-none'
											>
												<option value=''>— none —</option>
												{contacts.map((c) => (
													<option key={c.id} value={c.id}>{c.full_name}</option>
												))}
											</select>
										)}
									</td>
									<td className='px-4 py-4'>
										<button
											type='button'
											disabled={busyProperty === property.id}
											aria-label={`${property.featured ? 'Remove from' : 'Add to'} featured properties`}
											aria-pressed={property.featured}
											onClick={() =>
												toggleFeatured(property.id, property.featured)
											}
											className={`text-2xl leading-none transition ${property.featured ? 'text-[#d99b2b]' : 'text-[#c8d0ca] dark:text-zinc-700 hover:text-[#d99b2b]'}`}
										>
											{busyProperty === property.id ? <Spinner className='inline h-5 w-5' /> : '★'}
										</button>
									</td>
									<td className='px-5 py-4 text-right'>
										<div className="flex items-center justify-end gap-2">
											{canDelete && <button
												type='button'
												disabled={busyProperty === property.id}
												onClick={() => console.log('Edit property', property)}
												className='inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-semibold text-[#35664f] dark:text-emerald-400 transition-colors hover:bg-[#e0f1e7] dark:hover:bg-emerald-950 cursor-pointer'
											>
												<Pencil className="h-3.5 w-3.5" />
												Edit
											</button>}
											<button
												type='button'
												onClick={() => setDeleteConfirmId(property.id)}
												className='inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-semibold text-[#a34d4d] dark:text-red-400 transition-colors hover:bg-red-50 dark:hover:bg-red-950 cursor-pointer'
											>
												{busyProperty === property.id ? <Spinner className='inline h-3.5 w-3.5' /> : <Trash2 className="h-3.5 w-3.5" />}
												Delete
											</button>
										</div>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
				<div className='flex flex-col divide-y divide-[#edf0ee] dark:divide-zinc-800 sm:hidden'>
					{loading ? (
						<div className='flex justify-center py-12'>
							<Spinner className='h-5 w-5 text-[#28513f]' />
						</div>
					) : properties.map((property) => (
						<div key={property.id} className='flex flex-col gap-3 p-5'>
							<div className='flex items-start justify-between gap-4'>
								<span className='font-semibold text-[#253a30] dark:text-zinc-200 leading-tight'>
									{property.title}
								</span>
								<span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] uppercase tracking-wide font-semibold ${statusStyles[property.status]}`}>
									{property.status.replace('_', ' ')}
								</span>
							</div>
							<div className='flex items-center justify-between text-sm text-[#65736b] dark:text-zinc-300'>
								<span>{property.type}</span>
								<span className='font-semibold text-[#344b3f] dark:text-zinc-200'>{property.price}</span>
							</div>
							<div className='text-sm text-[#65736b] dark:text-zinc-300'>
								📍 {property.location}
							</div>
							{/* Contact assign on mobile */}
							<div className='flex items-center gap-2 text-xs text-[#65736b] dark:text-zinc-300'>
								<span className='shrink-0'>Contact:</span>
								{assigningId === property.id ? (
									<Spinner className='h-3.5 w-3.5 text-[#28513f]' />
								) : (
									<select
										value={property.contactId ?? ''}
										onChange={(e) => assignContact(property.id, e.target.value || null)}
										className='flex-1 rounded border border-[#d0dbd4] dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1 text-xs text-[#1a2923] dark:text-zinc-200 focus:border-[#35664f] focus:outline-none'
									>
										<option value=''>— none —</option>
										{contacts.map((c) => (
											<option key={c.id} value={c.id}>{c.full_name}</option>
										))}
									</select>
								)}
							</div>
							<div className='mt-2 flex items-center justify-between border-t border-[#edf0ee] pt-4'>
								<button
									type='button'
									disabled={busyProperty === property.id}
									onClick={() => toggleFeatured(property.id, property.featured)}
									className={`text-2xl leading-none transition ${property.featured ? 'text-[#d99b2b]' : 'text-[#c8d0ca] dark:text-zinc-700 hover:text-[#d99b2b]'}`}
								>
									{busyProperty === property.id ? <Spinner className='inline h-5 w-5' /> : '★'}
								</button>
								<div className='flex gap-2'>
									{canDelete && (
										<button
											type='button'
											disabled={busyProperty === property.id}
											onClick={() => console.log('Edit property', property)}
											className='inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-semibold text-[#35664f] dark:text-emerald-400 transition-colors hover:bg-[#e0f1e7] dark:hover:bg-emerald-950 cursor-pointer'
										>
											<Pencil className="h-3.5 w-3.5" />
											Edit
										</button>
									)}
									<button
										type='button'
										onClick={() => setDeleteConfirmId(property.id)}
										className='inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-semibold text-[#a34d4d] dark:text-red-400 transition-colors hover:bg-red-50 dark:hover:bg-red-950 cursor-pointer'
									>
										{busyProperty === property.id ? <Spinner className='inline h-3.5 w-3.5' /> : <Trash2 className="h-3.5 w-3.5" />}
										Delete
									</button>
								</div>
							</div>
						</div>
					))}
				</div>
			</div>
			{deleteConfirmId && (
				<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
					<div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl w-full max-w-sm p-6 transform transition-all">
						<h3 className="text-lg font-semibold text-gray-900 dark:text-zinc-100">
							Delete Property
						</h3>
						<p className="mt-2 text-sm text-gray-500 dark:text-zinc-400">
							Are you sure you want to delete this property? This action cannot be undone.
						</p>
						<div className="mt-6 flex flex-col-reverse sm:flex-row justify-end gap-3">
							<button
								type="button"
								onClick={() => setDeleteConfirmId(null)}
								className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-gray-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-md hover:bg-gray-50 dark:hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#35664f] transition-colors cursor-pointer"
							>
								Cancel
							</button>
							<button
								type="button"
								onClick={() => {
									deleteProperty(deleteConfirmId);
									setDeleteConfirmId(null);
								}}
								className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors cursor-pointer"
							>
								Delete
							</button>
						</div>
					</div>
				</div>
			)}
		</section>
	);
}
