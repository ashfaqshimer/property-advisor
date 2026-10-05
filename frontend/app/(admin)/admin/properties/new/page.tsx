'use client';

import Link from 'next/link';
import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Sparkles, ChevronDown, ChevronUp, UserPlus, CheckCircle2 } from 'lucide-react';
import {
	createProperty,
	createPropertyContact,
	getPropertyContacts,
	uploadPropertyImages,
	extractPropertyFromText,
	type PropertyContact,
} from '@/lib/api';
import { ContactForm } from '@/components/admin/ContactForm';
import { Spinner } from '@/components/ui/spinner';

type FormValues = {
	title: string;
	propertyType: string;
	listingType: 'sale' | 'rent';
	price: string;
	pricePerPerch: boolean;
	location: string;
	bedrooms: string;
	bathrooms: string;
	landSizePerches: string;
	sqft: string;
	parkingSpaces: string;
	buildYear: string;
	roadAccessFt: string;
	furnishingStatus: string;
	amenities: string[];
	description: string;
	status: string;
	isFeatured: boolean;
	propertyContactId: string;
};
type ImagePreview = { file: File; url: string };
const PREDEFINED_AMENITIES = ['Pool', 'Garden', 'A/C', 'Gym', 'Generator', 'Maid Room', 'Security'];

const emptyForm: FormValues = {
	title: '',
	propertyType: 'house',
	listingType: 'sale',
	price: '',
	pricePerPerch: false,
	location: '',
	bedrooms: '',
	bathrooms: '',
	landSizePerches: '',
	sqft: '',
	parkingSpaces: '',
	buildYear: '',
	roadAccessFt: '',
	furnishingStatus: '',
	amenities: [],
	description: '',
	status: 'available',
	isFeatured: false,
	propertyContactId: '',
};

export default function NewPropertyPage() {
	const [form, setForm] = useState(emptyForm);
	const [images, setImages] = useState<ImagePreview[]>([]);
	const imagesRef = useRef<ImagePreview[]>([]);
	const [errors, setErrors] = useState<Record<string, string>>({});
	const [saving, setSaving] = useState(false);
	const [success, setSuccess] = useState(false);
	const [contacts, setContacts] = useState<PropertyContact[]>([]);
	const [showContactForm, setShowContactForm] = useState(false);
	const [creatingContact, setCreatingContact] = useState(false);
	const [isDragging, setIsDragging] = useState(false);

	// AI Smart Autofill state
	const [rawText, setRawText] = useState('');
	const [extracting, setExtracting] = useState(false);
	const [isAutofillOpen, setIsAutofillOpen] = useState(true);
	const [extractedContact, setExtractedContact] = useState<{
		name?: string | null;
		phone?: string | null;
		type?: 'owner' | 'broker' | null;
	} | null>(null);

	useEffect(() => {
		getPropertyContacts().then(setContacts).catch(() => {});
		return () =>
			imagesRef.current.forEach((image) => URL.revokeObjectURL(image.url));
	}, []);
	function updateField(field: keyof FormValues, value: string | boolean | string[]) {
		setForm((current) => ({ ...current, [field]: value }));
		setErrors((current) => ({ ...current, [field]: '' }));
	}

	async function handleExtract() {
		const trimmed = rawText.trim();
		if (!trimmed || trimmed.length < 5) {
			toast.error('Please enter at least 5 characters of listing details.');
			return;
		}
		setExtracting(true);
		try {
			const draft = await extractPropertyFromText(trimmed);

			// Map extracted amenities
			const newAmenities: string[] = [];
			if (draft.has_maids_room) newAmenities.push('Maid Room');
			if (draft.amenities) {
				if (draft.amenities.pool) newAmenities.push('Pool');
				if (draft.amenities.garden) newAmenities.push('Garden');
				if (draft.amenities.ac || draft.amenities['a/c']) newAmenities.push('A/C');
				if (draft.amenities.gym) newAmenities.push('Gym');
				if (draft.amenities.generator) newAmenities.push('Generator');
				if (draft.amenities.security) newAmenities.push('Security');
			}

			// Match or propose contact
			let matchedContactId = form.propertyContactId;
			if (draft.contact_phone || draft.contact_name) {
				const match = contacts.find((c) => {
					const cleanDraftPhone = draft.contact_phone?.replace(/\D/g, '') || '';
					const phoneMatch = cleanDraftPhone && c.phones?.some(
						(p) => p.phone.replace(/\D/g, '') === cleanDraftPhone,
					);
					const nameMatch = draft.contact_name && c.full_name.toLowerCase().includes(draft.contact_name.toLowerCase());
					return phoneMatch || nameMatch;
				});

				if (match) {
					matchedContactId = match.id;
				}
				setExtractedContact({
					name: draft.contact_name,
					phone: draft.contact_phone,
					type: draft.contact_type,
				});
			}

			setForm((current) => ({
				...current,
				title: draft.title || current.title,
				propertyType: draft.property_type || current.propertyType,
				listingType: draft.listing_type || current.listingType,
				price: draft.price ? String(draft.price) : current.price,
				pricePerPerch: Boolean(draft.is_price_per_perch),
				location: draft.location || current.location,
				bedrooms: draft.bedrooms != null ? String(draft.bedrooms) : current.bedrooms,
				bathrooms: draft.bathrooms != null ? String(draft.bathrooms) : current.bathrooms,
				landSizePerches: draft.land_size_perches != null ? String(draft.land_size_perches) : current.landSizePerches,
				sqft: draft.floor_area_sqft != null ? String(draft.floor_area_sqft) : current.sqft,
				parkingSpaces: draft.parking_spaces != null ? String(draft.parking_spaces) : current.parkingSpaces,
				buildYear: draft.build_year != null ? String(draft.build_year) : current.buildYear,
				roadAccessFt: draft.road_access_ft != null ? String(draft.road_access_ft) : current.roadAccessFt,
				furnishingStatus: draft.furnishing_status || current.furnishingStatus,
				amenities: Array.from(new Set([...current.amenities, ...newAmenities])),
				description: draft.description || current.description,
				propertyContactId: matchedContactId,
			}));

			setErrors({});
			toast.success('Property details extracted and autofilled! Please review below.');
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Could not extract property details.');
		} finally {
			setExtracting(false);
		}
	}

	async function handleCreateExtractedContact() {
		if (!extractedContact?.phone && !extractedContact?.name) return;
		setCreatingContact(true);
		try {
			const created = await createPropertyContact({
				full_name: extractedContact.name || 'Owner',
				contact_type: extractedContact.type === 'broker' ? 'broker' : 'owner',
				phones: extractedContact.phone ? [{ phone: extractedContact.phone }] : [],
				notes: 'Auto-created via AI Smart Autofill.',
			});
			setContacts((prev) => [created, ...prev]);
			updateField('propertyContactId', created.id);
			toast.success(`Contact "${created.full_name}" created and assigned.`);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Could not create contact.');
		} finally {
			setCreatingContact(false);
		}
	}

	async function handleCreateContact(data: Parameters<typeof createPropertyContact>[0]) {
		setCreatingContact(true);
		try {
			const created = await createPropertyContact(data);
			setContacts((prev) => [created, ...prev]);
			updateField('propertyContactId', created.id);
			setShowContactForm(false);
			toast.success('Contact added.');
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Could not create contact.');
		} finally {
			setCreatingContact(false);
		}
	}
	function handleImages(event: ChangeEvent<HTMLInputElement>) {
		const files = Array.from(event.target.files ?? []).filter((file) =>
			file.type.startsWith('image/'),
		);
		addFiles(files);
		event.target.value = '';
	}
	function handleDragOver(event: React.DragEvent) {
		event.preventDefault();
		setIsDragging(true);
	}
	function handleDragLeave(event: React.DragEvent) {
		event.preventDefault();
		setIsDragging(false);
	}
	function handleDrop(event: React.DragEvent) {
		event.preventDefault();
		setIsDragging(false);
		const files = Array.from(event.dataTransfer.files).filter((file) =>
			file.type.startsWith('image/'),
		);
		addFiles(files);
	}
	function addFiles(files: File[]) {
		setImages((current) => {
			const next = [
				...current,
				...files.map((file) => ({ file, url: URL.createObjectURL(file) })),
			];
			imagesRef.current = next;
			return next;
		});
	}
	function removeImage(url: string) {
		const image = images.find((item) => item.url === url);
		if (image) URL.revokeObjectURL(image.url);
		setImages((current) => {
			const next = current.filter((item) => item.url !== url);
			imagesRef.current = next;
			return next;
		});
	}
	function validate() {
		const nextErrors: Record<string, string> = {};
		if (!form.title.trim()) nextErrors.title = 'Title is required';
		if (!form.location.trim()) nextErrors.location = 'Location is required';
		if (!form.price || Number(form.price) <= 0)
			nextErrors.price = 'Enter a valid price';
		if (!form.description.trim())
			nextErrors.description = 'Description is required';
		return nextErrors;
	}
	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const nextErrors = validate();
		setErrors(nextErrors);
		if (Object.keys(nextErrors).length) return;
		setSaving(true);
		try {
			const imageUrls = images.length
				? await uploadPropertyImages(images.map((image) => image.file))
				: [];
			const amenityNames = form.amenities.filter(Boolean);
			await createProperty({
				title: form.title.trim(),
				description: form.description.trim(),
				listing_type: form.listingType,
				price: Number(form.price),
				is_price_per_perch: form.pricePerPerch,
				location: form.location.trim(),
				property_type: form.propertyType as
					| 'house'
					| 'apartment'
					| 'land'
					| 'commercial',
				bedrooms: form.bedrooms ? Number(form.bedrooms) : null,
				bathrooms: form.bathrooms ? Number(form.bathrooms) : null,
				land_size_perches: form.landSizePerches
					? Number(form.landSizePerches)
					: null,
				floor_area_sqft: form.sqft ? Number(form.sqft) : null,
				parking_spaces: form.parkingSpaces ? Number(form.parkingSpaces) : null,
				build_year: form.buildYear ? Number(form.buildYear) : null,
				road_access_ft: form.roadAccessFt ? Number(form.roadAccessFt) : null,
				furnishing_status: form.furnishingStatus || null,
				amenities: amenityNames.length
					? Object.fromEntries(amenityNames.map((amenity) => [amenity, true]))
					: null,
				image_urls: imageUrls,
				image_alt: form.title.trim(),
				is_featured: form.isFeatured,
				status: form.status as 'available' | 'under_offer' | 'sold',
				property_contact_id: form.propertyContactId || null,
			});
			setSuccess(true);
		} catch (error) {
			setErrors({
				form:
					error instanceof Error
						? error.message
						: 'Could not save the property.',
			});
		} finally {
			setSaving(false);
		}
	}
	if (success)
		return (
			<div className='mx-auto max-w-2xl rounded-xl border border-[#cfe3d6] bg-white dark:bg-zinc-950 p-10 text-center shadow-sm'>
				<div className='mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#e0f1e7] dark:bg-green-950 text-xl text-[#28704b] dark:text-green-300'>
					✓
				</div>
				<h2 className='mt-5 text-2xl font-semibold'>Property saved</h2>
				<p className='mt-2 text-sm text-[#718078] dark:text-zinc-400'>
					Your listing and images have been added to the catalog.
				</p>
				<Link
					href='/admin'
					className='mt-7 inline-flex rounded-lg bg-[#28513f] dark:bg-emerald-700 px-5 py-3 text-sm font-semibold text-white dark:text-zinc-200'
				>
					Return to properties
				</Link>
			</div>
		);
	const fieldClass =
		'mt-2 w-full rounded-lg border border-[#d7e0da] bg-white dark:bg-zinc-950 px-3.5 py-3 text-sm text-[#243a2e] outline-none transition placeholder:text-[#a2ada7] focus:border-[#5e8c73] focus:ring-2 focus:ring-[#dcebe1]';
	const errorText = (field: string) =>
		errors[field] ? (
			<p className='mt-1 text-xs text-[#a34d4d] dark:text-red-400'>{errors[field]}</p>
		) : null;
	return (
		<section className='mx-auto max-w-4xl'>
			<div className='mb-8'>
				<Link
					href='/admin'
					className='text-sm font-medium text-[#527664] hover:underline'
				>
					← Back to properties
				</Link>
				<h2 className='mt-5 text-3xl font-semibold tracking-tight'>
					Add property
				</h2>
				<p className='mt-2 text-sm text-[#75847c] dark:text-zinc-400'>
					Create a listing for the Property Advisor catalog.
				</p>
			</div>

			{/* AI Smart Autofill Card */}
			<div className='mb-8 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-gradient-to-br from-emerald-50/70 via-white to-emerald-50/30 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 p-5 sm:p-6 shadow-sm'>
				<div className='flex items-center justify-between'>
					<div className='flex items-center gap-2.5'>
						<div className='flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300'>
							<Sparkles className='h-5 w-5' />
						</div>
						<div>
							<h3 className='text-base font-semibold text-[#19352b] dark:text-zinc-100 flex items-center gap-2'>
								AI Smart Autofill
								<span className='rounded-full bg-emerald-100 dark:bg-emerald-900/50 px-2 py-0.5 text-[11px] font-medium text-emerald-800 dark:text-emerald-300'>
									Sinhala & English
								</span>
							</h3>
							<p className='text-xs text-[#527664] dark:text-zinc-400'>
								Paste unstructured text from WhatsApp, email, or SMS to auto-fill the form
							</p>
						</div>
					</div>
					<button
						type='button'
						onClick={() => setIsAutofillOpen(!isAutofillOpen)}
						className='text-xs font-medium text-[#527664] dark:text-zinc-400 hover:text-[#19352b] dark:hover:text-zinc-200 flex items-center gap-1 cursor-pointer'
					>
						{isAutofillOpen ? (
							<>Hide <ChevronUp className='h-3.5 w-3.5' /></>
						) : (
							<>Expand <ChevronDown className='h-3.5 w-3.5' /></>
						)}
					</button>
				</div>

				{isAutofillOpen && (
					<div className='mt-4 space-y-3.5'>
						<textarea
							rows={4}
							value={rawText}
							onChange={(e) => setRawText(e.target.value)}
							placeholder={`Paste WhatsApp listing, SMS, or email here...\nSupports English, Sinhala (e.g. "හෝමාගම පර්චස් 10ක කාමර 3ක නිවස විකිණීමට. ලක්ෂ 220යි..."), and Singlish.`}
							className='w-full rounded-lg border border-[#d7e0da] dark:border-zinc-800 bg-white dark:bg-zinc-950 p-3 text-sm text-[#243a2e] dark:text-zinc-200 outline-none placeholder:text-[#a2ada7] dark:placeholder:text-zinc-500 focus:border-[#5e8c73] dark:focus:border-emerald-600 focus:ring-2 focus:ring-[#dcebe1] dark:focus:ring-emerald-950/50'
							disabled={extracting}
						/>

						<div className='flex flex-wrap items-center justify-between gap-3'>
							<div className='flex items-center gap-2'>
								<button
									type='button'
									onClick={handleExtract}
									disabled={extracting || !rawText.trim()}
									className='inline-flex items-center gap-2 rounded-lg bg-[#28513f] dark:bg-emerald-700 hover:bg-[#1e3e30] dark:hover:bg-emerald-600 disabled:opacity-50 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition cursor-pointer disabled:cursor-not-allowed'
								>
									{extracting ? (
										<>
											<Spinner className='h-4 w-4' />
											Extracting with Gemini...
										</>
									) : (
										<>
											<Sparkles className='h-4 w-4' />
											Autofill Form
										</>
									)}
								</button>
								{rawText && (
									<button
										type='button'
										onClick={() => {
											setRawText('');
											setExtractedContact(null);
										}}
										disabled={extracting}
										className='text-xs text-[#718078] dark:text-zinc-400 hover:underline px-2 py-1 cursor-pointer'
									>
										Clear
									</button>
								)}
							</div>
							<p className='text-[11px] text-[#718078] dark:text-zinc-400'>
								Auto-converts ලක්ෂ / කෝටි / M, translates Sinhala to English, and maps specs.
							</p>
						</div>

						{extractedContact && (extractedContact.name || extractedContact.phone) && (
							<div className='mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/30 p-2.5 text-xs text-[#19352b] dark:text-zinc-300'>
								<div className='flex items-center gap-1.5'>
									<CheckCircle2 className='h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0' />
									<span>
										<strong>Contact detected:</strong> {extractedContact.name || 'Unnamed'} {extractedContact.phone ? `(${extractedContact.phone})` : ''} {extractedContact.type ? `• ${extractedContact.type}` : ''}
										{form.propertyContactId && <span className='ml-1 text-emerald-600 dark:text-emerald-400 font-medium'>(Linked to existing contact)</span>}
									</span>
								</div>
								{!form.propertyContactId && extractedContact.phone && (
									<button
										type='button'
										onClick={handleCreateExtractedContact}
										disabled={creatingContact}
										className='inline-flex items-center gap-1 rounded bg-[#28513f] dark:bg-emerald-700 hover:bg-[#1e3e30] px-2.5 py-1 text-xs font-medium text-white shadow-xs cursor-pointer'
									>
										<UserPlus className='h-3 w-3' />
										{creatingContact ? 'Saving Contact...' : 'Save as Contact'}
									</button>
								)}
							</div>
						)}
					</div>
				)}
			</div>

			<form onSubmit={submit} className='space-y-6'>
				<div className='rounded-xl border border-[#dce4df] dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 shadow-sm sm:p-8'>
					<h3 className='text-base font-semibold'>Basic information</h3>
					<div className='mt-6 grid gap-5 sm:grid-cols-2'>
						<label className='text-sm font-medium sm:col-span-2'>
							Title
							<input
								className={fieldClass}
								value={form.title}
								onChange={(e) => updateField('title', e.target.value)}
								placeholder='e.g. Modern villa in Colombo 7'
							/>
							{errorText('title')}
						</label>
						<label className='text-sm font-medium'>
							Listing type
							<select
								className={fieldClass}
								value={form.listingType}
								onChange={(e) => updateField('listingType', e.target.value)}
							>
								<option value='sale'>For sale</option>
								<option value='rent'>For rent</option>
							</select>
						</label>
						<label className='text-sm font-medium'>
							Property type
							<select
								className={fieldClass}
								value={form.propertyType}
								onChange={(e) => updateField('propertyType', e.target.value)}
							>
								<option value='house'>House</option>
								<option value='apartment'>Apartment</option>
								<option value='land'>Land</option>
								<option value='commercial'>Commercial</option>
							</select>
						</label>
						<label className='text-sm font-medium'>
							{form.pricePerPerch ? 'Price per perch (LKR)' : 'Total Price (LKR)'}
							<input
								className={fieldClass}
								type='number'
								min='0'
								value={form.price}
								onChange={(e) => updateField('price', e.target.value)}
								placeholder='50000000'
							/>
							<label className='mt-2 flex items-center gap-2 text-xs font-normal text-[#65736b] dark:text-zinc-300'>
								<input
									type='checkbox'
									checked={form.pricePerPerch}
									onChange={(e) =>
										updateField('pricePerPerch', e.target.checked)
									}
								/>
								Price per perch
							</label>
							{errorText('price')}
						</label>
						<label className='text-sm font-medium sm:col-span-2'>
							Location
							<input
								className={fieldClass}
								value={form.location}
								onChange={(e) => updateField('location', e.target.value)}
								placeholder='Colombo 5'
							/>
							{errorText('location')}
						</label>
						<div className='sm:col-span-2'>
							<div className='flex items-center justify-between mb-1'>
								<label className='text-sm font-medium'>Contact (Owner / Broker)</label>
								<button
									type='button'
									onClick={() => setShowContactForm(true)}
									className='text-xs font-semibold text-[#35664f] dark:text-emerald-400 hover:underline'
								>
									+ Add new contact
								</button>
							</div>
							<select
								className={fieldClass}
								value={form.propertyContactId}
								onChange={(e) => updateField('propertyContactId', e.target.value)}
							>
								<option value=''>— None —</option>
								{contacts.map((c) => (
									<option key={c.id} value={c.id}>
										{c.full_name} {c.company_name ? `(${c.company_name})` : ''}
									</option>
								))}
							</select>
							{showContactForm && (
								<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
									<div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl border border-[#dce4df] dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 shadow-2xl">
										<h3 className="mb-4 text-lg font-semibold">Add new contact</h3>
										<ContactForm
											onSave={handleCreateContact}
											onCancel={() => setShowContactForm(false)}
											saving={creatingContact}
										/>
									</div>
								</div>
							)}
						</div>
					</div>
				</div>
				<div className='rounded-xl border border-[#dce4df] dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 shadow-sm sm:p-8'>
					<h3 className='text-base font-semibold'>Specifications</h3>
					<div className='mt-6 grid gap-5 sm:grid-cols-3'>
						{form.propertyType !== 'land' && (
							<>
								<label className='text-sm font-medium'>
									Bedrooms
									<input
										className={fieldClass}
										type='number'
										min='0'
										value={form.bedrooms}
										onChange={(e) => updateField('bedrooms', e.target.value)}
										placeholder='3'
									/>
								</label>
								<label className='text-sm font-medium'>
									Bathrooms
									<input
										className={fieldClass}
										type='number'
										min='0'
										value={form.bathrooms}
										onChange={(e) => updateField('bathrooms', e.target.value)}
										placeholder='2'
									/>
								</label>
							</>
						)}
						<label className='text-sm font-medium'>
							Land size (perches)
							<input
								className={fieldClass}
								type='number'
								min='0'
								step='0.01'
								value={form.landSizePerches}
								onChange={(e) => updateField('landSizePerches', e.target.value)}
								placeholder='10.5'
							/>
						</label>
						{form.propertyType !== 'land' && (
							<label className='text-sm font-medium'>
								Sqft
								<input
									className={fieldClass}
									type='number'
									min='0'
									value={form.sqft}
									onChange={(e) => updateField('sqft', e.target.value)}
									placeholder='1800'
								/>
							</label>
						)}
						<label className='text-sm font-medium'>
							Parking spaces
							<input
								className={fieldClass}
								type='number'
								min='0'
								value={form.parkingSpaces}
								onChange={(e) => updateField('parkingSpaces', e.target.value)}
								placeholder='2'
							/>
						</label>
						{form.propertyType !== 'land' && (
							<label className='text-sm font-medium'>
								Build year
								<input
									className={fieldClass}
									type='number'
									min='1800'
									max={new Date().getFullYear() + 1}
									value={form.buildYear}
									onChange={(e) => updateField('buildYear', e.target.value)}
									placeholder='2020'
								/>
							</label>
						)}
						<label className='text-sm font-medium'>
							Road access (ft)
							<input
								className={fieldClass}
								type='number'
								min='0'
								value={form.roadAccessFt}
								onChange={(e) => updateField('roadAccessFt', e.target.value)}
								placeholder='20'
							/>
						</label>
					</div>
				</div>
				<div className='rounded-xl border border-[#dce4df] dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 shadow-sm sm:p-8'>
					<h3 className='text-base font-semibold'>Description</h3>
					<textarea
						className={`${fieldClass} min-h-32 resize-y`}
						value={form.description}
						onChange={(e) => updateField('description', e.target.value)}
						placeholder='Describe the property, its surroundings, and notable features.'
					/>
					{errorText('description')}
					<div className='mt-5'>
						<label className='block text-sm font-medium mb-3'>Amenities</label>
						<div className='flex flex-wrap gap-3'>
							{PREDEFINED_AMENITIES.map((amenity) => (
								<label
									key={amenity}
									className={`flex cursor-pointer select-none items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors ${
										form.amenities.includes(amenity)
											? 'border-[#35664f] bg-[#e0f1e7] text-[#28513f] dark:border-emerald-600 dark:bg-emerald-950 dark:text-emerald-200'
											: 'border-[#dce4df] bg-white text-[#65736b] hover:bg-[#f4f8f5] dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-900'
									}`}
								>
									<input
										type='checkbox'
										className='hidden'
										checked={form.amenities.includes(amenity)}
										onChange={(e) => {
											if (e.target.checked) {
												updateField('amenities', [...form.amenities, amenity]);
											} else {
												updateField('amenities', form.amenities.filter((a) => a !== amenity));
											}
										}}
									/>
									{amenity}
								</label>
							))}
						</div>
					</div>
				</div>
				<div className='rounded-xl border border-[#dce4df] dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 shadow-sm sm:p-8'>
					<h3 className='text-base font-semibold'>Status & visibility</h3>
					<div className='mt-6 flex flex-col gap-5 sm:flex-row sm:items-end'>
						<label className='text-sm font-medium sm:w-64'>
							Status
							<select
								className={fieldClass}
								value={form.status}
								onChange={(e) => updateField('status', e.target.value)}
							>
								<option value='available'>Available</option>
								<option value='under_offer'>Under offer</option>
								<option value='sold'>Sold</option>
							</select>
						</label>
						{form.propertyType !== 'land' && (
							<label className='text-sm font-medium sm:w-64'>
								Furnishing
								<select
									className={fieldClass}
									value={form.furnishingStatus}
									onChange={(e) =>
										updateField('furnishingStatus', e.target.value)
									}
								>
									<option value=''>Not specified</option>
									<option value='unfurnished'>Unfurnished</option>
									<option value='semi_furnished'>Semi-furnished</option>
									<option value='fully_furnished'>Fully furnished</option>
								</select>
							</label>
						)}
						<label className='flex items-center gap-2 pb-3 text-sm font-medium'>
							<input
								type='checkbox'
								checked={form.isFeatured}
								onChange={(e) => updateField('isFeatured', e.target.checked)}
							/>
							Featured property
						</label>
					</div>
				</div>
				<div className='rounded-xl border border-[#dce4df] dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 shadow-sm sm:p-8'>
					<h3 className='text-base font-semibold'>Images</h3>
					<label
						onDragOver={handleDragOver}
						onDragLeave={handleDragLeave}
						onDrop={handleDrop}
						className={`mt-5 flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-5 text-center transition ${
							isDragging
								? 'border-[#35664f] bg-[#e0f1e7] dark:bg-emerald-950/30'
								: 'border-[#cbd9d0] bg-[#f9fbf9] dark:border-zinc-700 dark:bg-zinc-900/50 hover:border-[#6c9a7d]'
						}`}
					>
						<span className='text-sm font-semibold text-[#416b55] dark:text-emerald-400'>
							Choose image files or drag them here
						</span>
						<span className='mt-1 text-xs text-[#829088] dark:text-zinc-400'>
							PNG, JPG, or WEBP
						</span>
						<input
							type='file'
							accept='image/*'
							multiple
							className='sr-only'
							onChange={handleImages}
						/>
					</label>
					{images.length > 0 && (
						<div className='mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4'>
							{images.map((image) => (
								<div
									key={image.url}
									className='group relative aspect-square overflow-hidden rounded-lg bg-[#edf2ee]'
								>
									<img
										src={image.url}
										alt={image.file.name}
										className='h-full w-full object-cover'
									/>
									<button
										type='button'
										onClick={() => removeImage(image.url)}
										className='absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/65 text-white dark:text-zinc-200'
										aria-label={`Remove ${image.file.name}`}
									>
										×
									</button>
								</div>
							))}
						</div>
					)}
				</div>
				{errors.form && (
					<p className='text-right text-sm text-[#a34d4d] dark:text-red-400'>{errors.form}</p>
				)}
				<div className='flex justify-end gap-3 pb-8'>
					<Link
						href='/admin'
						className='rounded-lg border border-[#d2ddd5] bg-white dark:bg-zinc-950 px-5 py-3 text-sm font-semibold text-[#53655b]'
					>
						Cancel
					</Link>
					<button
						type='submit'
						disabled={saving}
						className='rounded-lg bg-[#28513f] dark:bg-emerald-700 px-6 py-3 text-sm font-semibold text-white dark:text-zinc-200 transition hover:bg-[#1e4031] dark:hover:bg-emerald-600 disabled:cursor-wait disabled:opacity-60'
					>
						{saving ? (
							<>
								<Spinner className='mr-2 h-4 w-4' />
								Uploading and saving...
							</>
						) : (
							'Save property'
						)}
					</button>
				</div>
			</form>
		</section>
	);
}
