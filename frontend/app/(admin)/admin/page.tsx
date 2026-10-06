'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Pencil, Trash2, Plus, Image as ImageIcon } from 'lucide-react';
import {
	deleteAdminProperty,
	getAdminProperties,
	getPropertyContacts,
	getCurrentUser,
	updateAdminProperty,
	type PropertyContact,
} from '@/lib/api';
import { Spinner } from '@/components/ui/spinner';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';

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
	imageUrls: string[];
	featuredImageUrl: string | null;
};

const statusVariant: Record<PropertyStatus, 'success' | 'warning' | 'secondary'> = {
	available: 'success',
	under_offer: 'warning',
	sold: 'secondary',
};

export default function AdminPropertiesPage() {
	const [properties, setProperties] = useState<Property[]>([]);
	const [contacts, setContacts] = useState<PropertyContact[]>([]);
	const [loading, setLoading] = useState(true);
	const [busyProperty, setBusyProperty] = useState<string | null>(null);
	const [canDelete, setCanDelete] = useState(false);
	const [assigningId, setAssigningId] = useState<string | null>(null);
	const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
	const [selectingPhotoProperty, setSelectingPhotoProperty] = useState<Property | null>(null);
	const [savingPhotoId, setSavingPhotoId] = useState<string | null>(null);

	useEffect(() => {
		getCurrentUser().then((user) => setCanDelete(user?.role === 'root' || user?.role === 'admin')).catch(() => {});
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
						imageUrls: record.image_urls ?? [],
						featuredImageUrl: record.featured_image_url ?? null,
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

	async function handleSelectFeaturedPhoto(propertyId: string, url: string) {
		setSavingPhotoId(propertyId);
		try {
			await updateAdminProperty(propertyId, { featured_image_url: url });
			setProperties((current) =>
				current.map((p) =>
					p.id === propertyId ? { ...p, featuredImageUrl: url } : p
				)
			);
			setSelectingPhotoProperty(null);
			toast.success('Featured photo updated.');
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Could not update featured photo.');
		} finally {
			setSavingPhotoId(null);
		}
	}

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
					<p className='text-sm font-medium text-muted-foreground'>
						Catalog management
					</p>
					<h2 className='mt-1 text-3xl font-semibold tracking-tight text-foreground'>
						Properties
					</h2>
					<p className='mt-2 text-sm text-muted-foreground'>
						Manage listings, visibility, and featured placements.
					</p>
				</div>
				<div className='flex flex-wrap items-center gap-3'>
					<Button asChild>
						<Link href='/admin/properties/new' className="gap-2">
							<Plus className='h-4 w-4' /> Add Property
						</Link>
					</Button>
				</div>
			</div>
			<div className='overflow-hidden rounded-xl border border-border bg-card shadow-xs'>
				<div className='flex items-center justify-between border-b border-border px-5 py-4'>
					<p className='text-sm font-semibold text-foreground'>
						All properties{' '}
						<span className='ml-1 font-normal text-muted-foreground'>
							({properties.length})
						</span>
					</p>
					<span className='text-xs text-muted-foreground'>Live data</span>
				</div>
				<div className='hidden sm:block'>
					<Table className='min-w-[900px]'>
						<TableHeader className='bg-muted/50'>
							<TableRow>
								<TableHead className='px-5 py-4 font-semibold'>Property</TableHead>
								<TableHead className='px-4 py-4 font-semibold'>Type</TableHead>
								<TableHead className='px-4 py-4 font-semibold'>Location</TableHead>
								<TableHead className='px-4 py-4 font-semibold'>Price (LKR)</TableHead>
								<TableHead className='px-4 py-4 font-semibold'>Status</TableHead>
								<TableHead className='px-4 py-4 font-semibold'>Contact</TableHead>
								<TableHead className='px-4 py-4 font-semibold'>Featured</TableHead>
								<TableHead className='px-5 py-4 text-right font-semibold'>Actions</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody className='divide-y divide-border'>
							{loading ? (
								<TableRow>
									<TableCell className='px-5 py-12 text-center' colSpan={8}>
										<Spinner className='mx-auto h-5 w-5 text-primary' />
										<span className='sr-only'>Loading properties</span>
									</TableCell>
								</TableRow>
							) : properties.map((property) => (
								<TableRow key={property.id} className='transition hover:bg-muted/50'>
									<TableCell className='px-5 py-4 font-semibold text-foreground'>
										{property.title}
									</TableCell>
									<TableCell className='px-4 py-4 text-muted-foreground'>{property.type}</TableCell>
									<TableCell className='px-4 py-4 text-muted-foreground'>
										{property.location}
									</TableCell>
									<TableCell className='px-4 py-4 font-medium text-foreground'>
										{property.price.replace('LKR ', '')}
									</TableCell>
									<TableCell className='px-4 py-4'>
										<Badge variant={statusVariant[property.status]} className='capitalize'>
											{property.status.replace('_', ' ')}
										</Badge>
									</TableCell>
									<TableCell className='px-4 py-4 text-sm'>
										{assigningId === property.id ? (
											<Spinner className='h-4 w-4 text-primary' />
										) : (
											<Select
												value={property.contactId ?? ''}
												onChange={(e) => assignContact(property.id, e.target.value || null)}
												className='h-8 max-w-[160px] truncate text-xs'
											>
												<option value=''>— none —</option>
												{contacts.map((c) => (
													<option key={c.id} value={c.id}>{c.full_name}</option>
												))}
											</Select>
										)}
									</TableCell>
									<TableCell className='px-4 py-4'>
										<div className="flex items-center gap-1.5">
											<button
												type='button'
												disabled={busyProperty === property.id}
												aria-label={`${property.featured ? 'Remove from' : 'Add to'} featured properties`}
												aria-pressed={property.featured}
												onClick={() =>
													toggleFeatured(property.id, property.featured)
												}
												className={`text-2xl leading-none transition cursor-pointer ${property.featured ? 'text-amber-500' : 'text-muted-foreground/30 hover:text-amber-500'}`}
											>
												{busyProperty === property.id ? <Spinner className='inline h-5 w-5' /> : '★'}
											</button>
											{property.imageUrls.length > 0 && (
												<button
													type='button'
													onClick={() => setSelectingPhotoProperty(property)}
													title='Select featured photo'
													aria-label={`Select featured photo for ${property.title}`}
													className='rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition cursor-pointer'
												>
													<ImageIcon className='h-4 w-4' />
												</button>
											)}
										</div>
									</TableCell>
									<TableCell className='px-5 py-4 text-right'>
										<div className="flex items-center justify-end gap-2">
											<Button
												asChild
												variant="ghost"
												size="sm"
												className="h-8 gap-1.5 px-2.5 text-xs font-semibold text-primary hover:bg-primary/10 hover:text-primary"
											>
												<Link href={`/admin/properties/${property.id}/edit`}>
													<Pencil className="h-3.5 w-3.5" />
													Edit
												</Link>
											</Button>
											{canDelete && (
												<Button
													type='button'
													variant="ghost"
													size="sm"
													onClick={() => setDeleteConfirmId(property.id)}
													className='h-8 gap-1.5 px-2.5 text-xs font-semibold text-destructive hover:bg-destructive/10 hover:text-destructive'
												>
													{busyProperty === property.id ? <Spinner className='inline h-3.5 w-3.5' /> : <Trash2 className="h-3.5 w-3.5" />}
													Delete
												</Button>
											)}
										</div>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</div>
				<div className='flex flex-col divide-y divide-border sm:hidden'>
					{loading ? (
						<div className='flex justify-center py-12'>
							<Spinner className='h-5 w-5 text-primary' />
						</div>
					) : properties.map((property) => (
						<div key={property.id} className='flex flex-col gap-3 p-5'>
							<div className='flex items-start justify-between gap-4'>
								<span className='font-semibold text-foreground leading-tight'>
									{property.title}
								</span>
								<Badge variant={statusVariant[property.status]} className='shrink-0 capitalize'>
									{property.status.replace('_', ' ')}
								</Badge>
							</div>
							<div className='flex items-center justify-between text-sm text-muted-foreground'>
								<span>{property.type}</span>
								<span className='font-semibold text-foreground'>{property.price}</span>
							</div>
							<div className='text-sm text-muted-foreground'>
								📍 {property.location}
							</div>
							{/* Contact assign on mobile */}
							<div className='flex items-center gap-2 text-xs text-muted-foreground'>
								<span className='shrink-0'>Contact:</span>
								{assigningId === property.id ? (
									<Spinner className='h-3.5 w-3.5 text-primary' />
								) : (
									<Select
										value={property.contactId ?? ''}
										onChange={(e) => assignContact(property.id, e.target.value || null)}
										className='h-8 flex-1 text-xs'
									>
										<option value=''>— none —</option>
										{contacts.map((c) => (
											<option key={c.id} value={c.id}>{c.full_name}</option>
										))}
									</Select>
								)}
							</div>
							<div className='mt-2 flex items-center justify-between border-t border-border pt-4'>
								<div className="flex items-center gap-2">
									<button
										type='button'
										disabled={busyProperty === property.id}
										onClick={() => toggleFeatured(property.id, property.featured)}
										className={`text-2xl leading-none transition cursor-pointer ${property.featured ? 'text-amber-500' : 'text-muted-foreground/30 hover:text-amber-500'}`}
									>
										{busyProperty === property.id ? <Spinner className='inline h-5 w-5' /> : '★'}
									</button>
									{property.imageUrls.length > 0 && (
										<button
											type='button'
											onClick={() => setSelectingPhotoProperty(property)}
											title='Select featured photo'
											className='flex items-center gap-1 rounded border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition cursor-pointer'
										>
											<ImageIcon className='h-3.5 w-3.5' />
											<span>Photo</span>
										</button>
									)}
								</div>
								<div className='flex gap-2'>
									<Button
										asChild
										variant="ghost"
										size="sm"
										className="h-8 gap-1.5 px-2.5 text-xs font-semibold text-primary hover:bg-primary/10 hover:text-primary"
									>
										<Link href={`/admin/properties/${property.id}/edit`}>
											<Pencil className="h-3.5 w-3.5" />
											Edit
										</Link>
									</Button>
									{canDelete && (
										<Button
											type='button'
											variant="ghost"
											size="sm"
											onClick={() => setDeleteConfirmId(property.id)}
											className='h-8 gap-1.5 px-2.5 text-xs font-semibold text-destructive hover:bg-destructive/10 hover:text-destructive'
										>
											{busyProperty === property.id ? <Spinner className='inline h-3.5 w-3.5' /> : <Trash2 className="h-3.5 w-3.5" />}
											Delete
										</Button>
									)}
								</div>
							</div>
						</div>
					))}
				</div>
			</div>
			{deleteConfirmId && (
				<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
					<div className="bg-card text-card-foreground border border-border rounded-lg shadow-xl w-full max-w-sm p-6 transform transition-all">
						<h3 className="text-lg font-semibold text-foreground">
							Delete Property
						</h3>
						<p className="mt-2 text-sm text-muted-foreground">
							Are you sure you want to delete this property? This action cannot be undone.
						</p>
						<div className="mt-6 flex flex-col-reverse sm:flex-row justify-end gap-3">
							<Button
								type="button"
								variant="outline"
								onClick={() => setDeleteConfirmId(null)}
								className="w-full sm:w-auto"
							>
								Cancel
							</Button>
							<Button
								type="button"
								variant="destructive"
								onClick={() => {
									deleteProperty(deleteConfirmId);
									setDeleteConfirmId(null);
								}}
								className="w-full sm:w-auto"
							>
								Delete
							</Button>
						</div>
					</div>
				</div>
			)}
			{selectingPhotoProperty && (
				<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
					<div className="bg-card text-card-foreground border border-border rounded-xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] flex flex-col">
						<div className="flex items-start justify-between pb-3 border-b border-border">
							<div>
								<h3 className="text-base font-semibold text-foreground">Select Featured Photo</h3>
								<p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{selectingPhotoProperty.title}</p>
							</div>
							<button
								type="button"
								onClick={() => setSelectingPhotoProperty(null)}
								className="text-muted-foreground hover:text-foreground transition cursor-pointer p-1 text-base leading-none"
							>
								✕
							</button>
						</div>

						<p className="text-xs text-muted-foreground mt-3">
							Click any photo to set it as the primary cover photo displayed for this property in the featured section.
						</p>

						<div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3 overflow-y-auto p-1 flex-1 min-h-0">
							{selectingPhotoProperty.imageUrls.map((url, idx) => {
								const isCurrent = selectingPhotoProperty.featuredImageUrl
									? selectingPhotoProperty.featuredImageUrl === url
									: idx === 0;
								return (
									<button
										key={url + idx}
										type="button"
										disabled={savingPhotoId === selectingPhotoProperty.id}
										onClick={() => handleSelectFeaturedPhoto(selectingPhotoProperty.id, url)}
										className={`group relative aspect-square overflow-hidden rounded-lg border text-left transition cursor-pointer ${
											isCurrent
												? 'border-amber-500 ring-2 ring-amber-500/40'
												: 'border-border hover:border-primary/50'
										}`}
									>
										<img src={url} alt={`Photo ${idx + 1}`} className="h-full w-full object-cover" />
										{isCurrent ? (
											<span className="absolute bottom-1.5 left-1.5 rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-xs">
												★ Active
											</span>
										) : (
											<span className="absolute bottom-1.5 left-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white opacity-0 group-hover:opacity-100 transition">
												Select
											</span>
										)}
									</button>
								);
							})}
						</div>

						<div className="mt-4 flex justify-end gap-2 border-t border-border pt-3">
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() => setSelectingPhotoProperty(null)}
							>
								Close
							</Button>
						</div>
					</div>
				</div>
			)}
		</section>
	);
}
