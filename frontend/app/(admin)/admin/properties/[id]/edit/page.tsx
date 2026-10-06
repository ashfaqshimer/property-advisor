'use client';

import Link from 'next/link';
import { ChangeEvent, FormEvent, use, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Sparkles, ChevronDown, ChevronUp, UserPlus, CheckCircle2, ArrowLeft } from 'lucide-react';
import {
	getAdminProperty,
	updateAdminProperty,
	createPropertyContact,
	getPropertyContacts,
	uploadPropertyImages,
	extractPropertyFromText,
	type PropertyContact,
} from '@/lib/api';
import { ContactForm } from '@/components/admin/ContactForm';
import { Spinner } from '@/components/ui/spinner';
import { AreaConverterInput } from '@/components/admin/AreaConverterInput';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';

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
	featuredImageUrl: string;
};

type ImagePreview = { file: File; url: string };

const PREDEFINED_AMENITIES = [
	'Pool',
	'Garden',
	'A/C',
	'Gym',
	'Generator',
	'Maid Room',
	'Security',
	'Three-Phase Electricity',
	'Well Water',
	'Boundary Wall',
	'Clear Deeds',
	'CCTV',
	'Wi-Fi',
];

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
	featuredImageUrl: '',
};

export default function EditPropertyPage({ params }: { params: Promise<{ id: string }> }) {
	const resolvedParams = use(params);
	const propertyId = resolvedParams.id;

	const [loading, setLoading] = useState(true);
	const [notFound, setNotFound] = useState(false);
	const [form, setForm] = useState(emptyForm);
	const [existingImages, setExistingImages] = useState<string[]>([]);
	const [newImages, setNewImages] = useState<ImagePreview[]>([]);
	const newImagesRef = useRef<ImagePreview[]>([]);
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
	const [isAutofillOpen, setIsAutofillOpen] = useState(false);
	const [extractedContact, setExtractedContact] = useState<{
		name?: string | null;
		phone?: string | null;
		type?: 'owner' | 'broker' | null;
	} | null>(null);

	useEffect(() => {
		getPropertyContacts().then(setContacts).catch(() => {});

		getAdminProperty(propertyId)
			.then((record) => {
				const initialAmenities: string[] = [];
				if (record.amenities && typeof record.amenities === 'object') {
					Object.keys(record.amenities).forEach((key) => {
						const matched = PREDEFINED_AMENITIES.find(
							(a) => a.toLowerCase() === key.toLowerCase() || (a === 'A/C' && key.toLowerCase() === 'ac')
						);
						if (matched) {
							if (!initialAmenities.includes(matched)) initialAmenities.push(matched);
						} else {
							initialAmenities.push(key);
						}
					});
				}
				if (record.has_maids_room && !initialAmenities.includes('Maid Room')) {
					initialAmenities.push('Maid Room');
				}

				setForm({
					title: record.title,
					propertyType: record.property_type,
					listingType: record.listing_type,
					price: record.price != null ? String(record.price) : '',
					pricePerPerch: Boolean(record.is_price_per_perch),
					location: record.location,
					bedrooms: record.bedrooms != null ? String(record.bedrooms) : '',
					bathrooms: record.bathrooms != null ? String(record.bathrooms) : '',
					landSizePerches: record.land_size_perches != null ? String(record.land_size_perches) : '',
					sqft: record.floor_area_sqft != null ? String(record.floor_area_sqft) : '',
					parkingSpaces: record.parking_spaces != null ? String(record.parking_spaces) : '',
					buildYear: record.build_year != null ? String(record.build_year) : '',
					roadAccessFt: record.road_access_ft != null ? String(record.road_access_ft) : '',
					furnishingStatus: record.furnishing_status ?? '',
					amenities: initialAmenities,
					description: record.description ?? '',
					status: record.status,
					isFeatured: record.is_featured,
					propertyContactId: record.property_contact_id ?? '',
					featuredImageUrl: record.featured_image_url ?? (record.image_urls?.[0] ?? ''),
				});
				setExistingImages(record.image_urls ?? []);
			})
			.catch((err) => {
				setNotFound(true);
				toast.error(err instanceof Error ? err.message : 'Property not found.');
			})
			.finally(() => setLoading(false));

		return () => {
			newImagesRef.current.forEach((image) => URL.revokeObjectURL(image.url));
		};
	}, [propertyId]);

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

			const newAmenities: string[] = [];
			if (draft.has_maids_room) newAmenities.push('Maid Room');
			if (draft.amenities) {
				if (draft.amenities.pool) newAmenities.push('Pool');
				if (draft.amenities.garden) newAmenities.push('Garden');
				if (draft.amenities.ac || draft.amenities['a/c']) newAmenities.push('A/C');
				if (draft.amenities.gym) newAmenities.push('Gym');
				if (draft.amenities.generator) newAmenities.push('Generator');
				if (draft.amenities.security) newAmenities.push('Security');
				if (draft.amenities.three_phase_electricity) newAmenities.push('Three-Phase Electricity');
				if (draft.amenities.well_water) newAmenities.push('Well Water');
				if (draft.amenities.boundary_wall) newAmenities.push('Boundary Wall');
				if (draft.amenities.clear_deeds) newAmenities.push('Clear Deeds');
				if (draft.amenities.cctv) newAmenities.push('CCTV');
				if (draft.amenities.wifi) newAmenities.push('Wi-Fi');
			}

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

	function handleNewImages(event: ChangeEvent<HTMLInputElement>) {
		const files = Array.from(event.target.files ?? []).filter((file) =>
			file.type.startsWith('image/'),
		);
		addNewFiles(files);
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
		addNewFiles(files);
	}

	function addNewFiles(files: File[]) {
		setNewImages((current) => {
			const next = [
				...current,
				...files.map((file) => ({ file, url: URL.createObjectURL(file) })),
			];
			newImagesRef.current = next;
			return next;
		});
	}

	function removeExistingImage(urlToRemove: string) {
		setExistingImages((current) => {
			const next = current.filter((url) => url !== urlToRemove);
			if (form.featuredImageUrl === urlToRemove) {
				updateField('featuredImageUrl', next[0] || '');
			}
			return next;
		});
	}

	function removeNewImage(url: string) {
		const image = newImages.find((item) => item.url === url);
		if (image) URL.revokeObjectURL(image.url);
		setNewImages((current) => {
			const next = current.filter((item) => item.url !== url);
			newImagesRef.current = next;
			return next;
		});
	}

	function validate() {
		const nextErrors: Record<string, string> = {};
		if (!form.title.trim()) nextErrors.title = 'Title is required';
		if (!form.location.trim()) nextErrors.location = 'Location is required';
		if (form.price && Number(form.price) <= 0)
			nextErrors.price = 'Price must be greater than 0';
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
			const uploadedUrls = newImages.length
				? await uploadPropertyImages(newImages.map((image) => image.file))
				: [];
			const allImageUrls = [...existingImages, ...uploadedUrls];
			const amenityNames = form.amenities.filter(Boolean);

			await updateAdminProperty(propertyId, {
				title: form.title.trim(),
				description: form.description.trim(),
				listing_type: form.listingType,
				price: form.price ? Number(form.price) : null,
				is_price_per_perch: form.pricePerPerch,
				location: form.location.trim(),
				property_type: form.propertyType as
					| 'house'
					| 'apartment'
					| 'land'
					| 'commercial'
					| 'mixed_use',
				bedrooms: form.bedrooms ? Number(form.bedrooms) : null,
				bathrooms: form.bathrooms ? Number(form.bathrooms) : null,
				land_size_perches: form.landSizePerches
					? Number(form.landSizePerches)
					: null,
				floor_area_sqft: form.sqft ? Number(form.sqft) : null,
				parking_spaces: form.parkingSpaces ? Number(form.parkingSpaces) : null,
				build_year: form.buildYear ? Number(form.buildYear) : null,
				road_access_ft: form.roadAccessFt ? Number(form.roadAccessFt) : null,
				furnishing_status: (form.furnishingStatus || null) as
					| 'unfurnished'
					| 'semi_furnished'
					| 'fully_furnished'
					| null,
				amenities: amenityNames.length
					? Object.fromEntries(amenityNames.map((amenity) => [amenity, true]))
					: null,
				has_maids_room: form.amenities.includes('Maid Room'),
				image_urls: allImageUrls,
				image_alt: form.title.trim(),
				featured_image_url: form.featuredImageUrl || (allImageUrls[0] ?? null),
				is_featured: form.isFeatured,
				status: form.status as 'available' | 'under_offer' | 'sold',
				property_contact_id: form.propertyContactId || null,
			});

			setExistingImages(allImageUrls);
			setNewImages([]);
			newImagesRef.current = [];
			setSuccess(true);
			toast.success('Property updated successfully.');
		} catch (error) {
			setErrors({
				form:
					error instanceof Error
						? error.message
						: 'Could not update the property.',
			});
		} finally {
			setSaving(false);
		}
	}

	if (loading) {
		return (
			<section className='mx-auto max-w-4xl py-12 text-center'>
				<Spinner className='mx-auto h-8 w-8 text-primary' />
				<p className='mt-4 text-sm text-muted-foreground'>Loading property details...</p>
			</section>
		);
	}

	if (notFound) {
		return (
			<Card className='mx-auto max-w-2xl p-10 text-center'>
				<CardContent className='flex flex-col items-center p-0'>
					<CardTitle className='text-2xl font-semibold'>Property Not Found</CardTitle>
					<CardDescription className='mt-2 text-sm text-muted-foreground'>
						The property listing you requested could not be found.
					</CardDescription>
					<Button asChild className='mt-7'>
						<Link href='/admin' className='inline-flex items-center gap-2'>
							<ArrowLeft className='h-4 w-4' /> Return to properties
						</Link>
					</Button>
				</CardContent>
			</Card>
		);
	}

	if (success) {
		return (
			<Card className='mx-auto max-w-2xl p-10 text-center'>
				<CardContent className='flex flex-col items-center p-0'>
					<div className='flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950 text-xl text-emerald-800 dark:text-emerald-300'>
						✓
					</div>
					<CardTitle className='mt-5 text-2xl font-semibold'>Property updated</CardTitle>
					<CardDescription className='mt-2 text-sm text-muted-foreground'>
						Your changes have been saved to the catalog.
					</CardDescription>
					<div className='mt-7 flex flex-wrap items-center justify-center gap-4'>
						<Button
							type='button'
							variant='outline'
							onClick={() => setSuccess(false)}
						>
							Continue editing
						</Button>
						<Button asChild>
							<Link href='/admin'>Return to properties</Link>
						</Button>
					</div>
				</CardContent>
			</Card>
		);
	}

	const errorText = (field: string) =>
		errors[field] ? (
			<p className='mt-1 text-xs text-destructive'>{errors[field]}</p>
		) : null;

	return (
		<section className='mx-auto max-w-4xl'>
			<div className='mb-8'>
				<Link
					href='/admin'
					className='text-sm font-medium text-muted-foreground hover:text-foreground hover:underline inline-flex items-center gap-1.5'
				>
					<ArrowLeft className='h-4 w-4' /> Back to properties
				</Link>
				<h2 className='mt-5 text-3xl font-semibold tracking-tight text-foreground'>
					Edit property
				</h2>
				<p className='mt-2 text-sm text-muted-foreground'>
					Update listing specifications, details, pricing, and media.
				</p>
			</div>

			{/* AI Smart Autofill Card */}
			<Card className='mb-8 border-emerald-200 dark:border-emerald-900/60 bg-gradient-to-br from-emerald-50/70 via-background to-emerald-50/30 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950'>
				<CardHeader className='pb-4'>
					<div className='flex items-center justify-between'>
						<div className='flex items-center gap-2.5'>
							<div className='flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300'>
								<Sparkles className='h-5 w-5' />
							</div>
							<div>
								<CardTitle className='text-base flex items-center gap-2'>
									AI Smart Autofill
									<span className='rounded-full bg-emerald-100 dark:bg-emerald-900/50 px-2 py-0.5 text-[11px] font-medium text-emerald-800 dark:text-emerald-300'>
										Sinhala & English
									</span>
								</CardTitle>
								<CardDescription className='text-xs text-muted-foreground'>
									Paste unstructured text from WhatsApp, email, or SMS to update the form fields
								</CardDescription>
							</div>
						</div>
						<Button
							type='button'
							variant='ghost'
							size='sm'
							onClick={() => setIsAutofillOpen(!isAutofillOpen)}
							className='text-xs font-medium text-muted-foreground hover:text-foreground h-auto py-1 px-2'
						>
							{isAutofillOpen ? (
								<>Hide <ChevronUp className='h-3.5 w-3.5 ml-1' /></>
							) : (
								<>Expand <ChevronDown className='h-3.5 w-3.5 ml-1' /></>
							)}
						</Button>
					</div>
				</CardHeader>

				{isAutofillOpen && (
					<CardContent className='space-y-3.5 pt-0'>
						<Textarea
							rows={4}
							value={rawText}
							onChange={(e) => setRawText(e.target.value)}
							placeholder={`Paste WhatsApp listing, SMS, or email here...\nSupports English, Sinhala (e.g. "හෝමාගම පර්චස් 10ක කාමර 3ක නිවස විකිණීමට. ලක්ෂ 220යි..."), and Singlish.`}
							className='w-full'
							disabled={extracting}
						/>

						<div className='flex flex-wrap items-center justify-between gap-3'>
							<div className='flex items-center gap-2'>
								<Button
									type='button'
									onClick={handleExtract}
									disabled={extracting || !rawText.trim()}
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
								</Button>
								{rawText && (
									<Button
										type='button'
										variant='ghost'
										size='sm'
										onClick={() => {
											setRawText('');
											setExtractedContact(null);
										}}
										disabled={extracting}
										className='text-xs text-muted-foreground hover:text-foreground'
									>
										Clear
									</Button>
								)}
							</div>
							<p className='text-[11px] text-muted-foreground'>
								Auto-converts ලක්ෂ / කෝටි / M, translates Sinhala to English, and maps specs.
							</p>
						</div>

						{extractedContact && (extractedContact.name || extractedContact.phone) && (
							<div className='mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/30 p-2.5 text-xs text-foreground'>
								<div className='flex items-center gap-1.5'>
									<CheckCircle2 className='h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0' />
									<span>
										<strong>Contact detected:</strong> {extractedContact.name || 'Unnamed'} {extractedContact.phone ? `(${extractedContact.phone})` : ''} {extractedContact.type ? `• ${extractedContact.type}` : ''}
										{form.propertyContactId && <span className='ml-1 text-emerald-600 dark:text-emerald-400 font-medium'>(Linked to existing contact)</span>}
									</span>
								</div>
								{!form.propertyContactId && extractedContact.phone && (
									<Button
										type='button'
										size='sm'
										onClick={handleCreateExtractedContact}
										disabled={creatingContact}
										className='h-7 text-xs px-2.5'
									>
										<UserPlus className='h-3 w-3 mr-1' />
										{creatingContact ? 'Saving Contact...' : 'Save as Contact'}
									</Button>
								)}
							</div>
						)}
					</CardContent>
				)}
			</Card>

			<form onSubmit={submit} className='space-y-6'>
				<Card>
					<CardHeader>
						<CardTitle className='text-base font-semibold'>Basic information</CardTitle>
					</CardHeader>
					<CardContent>
						<div className='grid gap-5 sm:grid-cols-2'>
							<div className='space-y-2 sm:col-span-2'>
								<Label htmlFor='title'>Title</Label>
								<Input
									id='title'
									value={form.title}
									onChange={(e) => updateField('title', e.target.value)}
									placeholder='e.g. Modern villa in Colombo 7'
								/>
								{errorText('title')}
							</div>

							<div className='space-y-2'>
								<Label htmlFor='listingType'>Listing type</Label>
								<Select
									id='listingType'
									value={form.listingType}
									onChange={(e) => updateField('listingType', e.target.value)}
								>
									<option value='sale'>For sale</option>
									<option value='rent'>For rent</option>
								</Select>
							</div>

							<div className='space-y-2'>
								<Label htmlFor='propertyType'>Property type</Label>
								<Select
									id='propertyType'
									value={form.propertyType}
									onChange={(e) => updateField('propertyType', e.target.value)}
								>
									<option value='house'>House</option>
									<option value='apartment'>Apartment</option>
									<option value='land'>Land</option>
									<option value='commercial'>Commercial</option>
									<option value='mixed_use'>Mixed Use</option>
								</Select>
							</div>

							<div className='space-y-2'>
								<Label htmlFor='price'>
									{form.pricePerPerch ? 'Price per perch (LKR)' : 'Total Price (LKR)'}
								</Label>
								<Input
									id='price'
									type='number'
									min='0'
									value={form.price}
									onChange={(e) => updateField('price', e.target.value)}
								/>
								<div className='flex items-center gap-2 pt-1'>
									<Switch
										id='pricePerPerch'
										checked={form.pricePerPerch}
										onCheckedChange={(checked) => updateField('pricePerPerch', checked)}
									/>
									<Label htmlFor='pricePerPerch' className='text-xs font-normal text-muted-foreground cursor-pointer'>
										Price per perch
									</Label>
								</div>
								{errorText('price')}
							</div>

							<div className='space-y-2 sm:col-span-2'>
								<Label htmlFor='location'>Location</Label>
								<Input
									id='location'
									value={form.location}
									onChange={(e) => updateField('location', e.target.value)}
									placeholder='Colombo 5'
								/>
								{errorText('location')}
							</div>

							<div className='space-y-2 sm:col-span-2'>
								<div className='flex items-center justify-between'>
									<Label htmlFor='propertyContactId'>Contact (Owner / Broker)</Label>
									<Button
										type='button'
										variant='link'
										size='sm'
										onClick={() => setShowContactForm(true)}
										className='h-auto p-0 text-xs font-semibold'
									>
										+ Add new contact
									</Button>
								</div>
								<Select
									id='propertyContactId'
									value={form.propertyContactId}
									onChange={(e) => updateField('propertyContactId', e.target.value)}
								>
									<option value=''>— None —</option>
									{contacts.map((c) => (
										<option key={c.id} value={c.id}>
											{c.full_name} {c.company_name ? `(${c.company_name})` : ''}
										</option>
									))}
								</Select>
								{showContactForm && (
									<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
										<div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-2xl">
											<h3 className="mb-4 text-lg font-semibold text-foreground">Add new contact</h3>
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
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle className='text-base font-semibold'>Specifications</CardTitle>
					</CardHeader>
					<CardContent>
						<div className='grid gap-5 sm:grid-cols-3'>
							{form.propertyType !== 'land' && (
								<>
									<div className='space-y-2'>
										<Label htmlFor='bedrooms'>Bedrooms</Label>
										<Input
											id='bedrooms'
											type='number'
											min='0'
											value={form.bedrooms}
											onChange={(e) => updateField('bedrooms', e.target.value)}
										/>
									</div>
									<div className='space-y-2'>
										<Label htmlFor='bathrooms'>Bathrooms</Label>
										<Input
											id='bathrooms'
											type='number'
											min='0'
											value={form.bathrooms}
											onChange={(e) => updateField('bathrooms', e.target.value)}
										/>
									</div>
								</>
							)}
							<AreaConverterInput
								label='Land size'
								primaryUnit='perches'
								value={form.landSizePerches}
								onChange={(val) => updateField('landSizePerches', val)}
								className='flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
							/>
							{form.propertyType !== 'land' && (
								<AreaConverterInput
									label='Floor area / House size'
									primaryUnit='sqft'
									value={form.sqft}
									onChange={(val) => updateField('sqft', val)}
									className='flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
								/>
							)}
							<div className='space-y-2'>
								<Label htmlFor='parkingSpaces'>Parking spaces</Label>
								<Input
									id='parkingSpaces'
									type='number'
									min='0'
									value={form.parkingSpaces}
									onChange={(e) => updateField('parkingSpaces', e.target.value)}
								/>
							</div>
							{form.propertyType !== 'land' && (
								<div className='space-y-2'>
									<Label htmlFor='buildYear'>Build year</Label>
									<Input
										id='buildYear'
										type='number'
										min='1800'
										max={new Date().getFullYear() + 1}
										value={form.buildYear}
										onChange={(e) => updateField('buildYear', e.target.value)}
									/>
								</div>
							)}
							<div className='space-y-2'>
								<Label htmlFor='roadAccessFt'>Road access (ft)</Label>
								<Input
									id='roadAccessFt'
									type='number'
									min='0'
									value={form.roadAccessFt}
									onChange={(e) => updateField('roadAccessFt', e.target.value)}
								/>
							</div>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle className='text-base font-semibold'>Description</CardTitle>
					</CardHeader>
					<CardContent className='space-y-5'>
						<div className='space-y-2'>
							<Label htmlFor='description'>Description</Label>
							<Textarea
								id='description'
								className='min-h-32 resize-y'
								value={form.description}
								onChange={(e) => updateField('description', e.target.value)}
								placeholder='Describe the property, its surroundings, and notable features.'
							/>
							{errorText('description')}
						</div>

						<div>
							<Label className='block mb-3'>Amenities</Label>
							<div className='flex flex-wrap gap-2.5'>
								{PREDEFINED_AMENITIES.map((amenity) => {
									const isSelected = form.amenities.includes(amenity);
									return (
										<label
											key={amenity}
											className={`flex cursor-pointer select-none items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
												isSelected
													? 'border-primary bg-primary/10 text-primary dark:bg-primary/20'
													: 'border-border bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground'
											}`}
										>
											<input
												type='checkbox'
												className='hidden'
												checked={isSelected}
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
									);
								})}
							</div>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle className='text-base font-semibold'>Status & visibility</CardTitle>
					</CardHeader>
					<CardContent>
						<div className='flex flex-col gap-5 sm:flex-row sm:items-end'>
							<div className='space-y-2 sm:w-64'>
								<Label htmlFor='status'>Status</Label>
								<Select
									id='status'
									value={form.status}
									onChange={(e) => updateField('status', e.target.value)}
								>
									<option value='available'>Available</option>
									<option value='under_offer'>Under offer</option>
									<option value='sold'>Sold</option>
								</Select>
							</div>

							{form.propertyType !== 'land' && (
								<div className='space-y-2 sm:w-64'>
									<Label htmlFor='furnishingStatus'>Furnishing</Label>
									<Select
										id='furnishingStatus'
										value={form.furnishingStatus}
										onChange={(e) =>
											updateField('furnishingStatus', e.target.value)
										}
									>
										<option value=''>Not specified</option>
										<option value='unfurnished'>Unfurnished</option>
										<option value='semi_furnished'>Semi-furnished</option>
										<option value='fully_furnished'>Fully furnished</option>
									</Select>
								</div>
							)}

							<div className='flex items-center gap-2 pb-2'>
								<Switch
									id='isFeatured'
									checked={form.isFeatured}
									onCheckedChange={(checked) => updateField('isFeatured', checked)}
								/>
								<Label htmlFor='isFeatured' className='cursor-pointer text-sm font-medium'>
									Featured property
								</Label>
							</div>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle className='text-base font-semibold'>Images</CardTitle>
					</CardHeader>
					<CardContent>
						{/* Existing images list */}
						{existingImages.length > 0 && (
							<div className='mb-6'>
								<p className='text-xs font-medium text-muted-foreground mb-2'>
									Current photos ({existingImages.length})
								</p>
								<div className='grid grid-cols-2 gap-3 sm:grid-cols-4'>
									{existingImages.map((imageUrl, idx) => {
										const isFeatured = form.featuredImageUrl
											? form.featuredImageUrl === imageUrl
											: idx === 0;
										return (
											<div
												key={imageUrl + idx}
												className={`group relative aspect-square overflow-hidden rounded-lg bg-muted border ${
													isFeatured
														? 'border-amber-500 ring-2 ring-amber-500/30'
														: 'border-border'
												}`}
											>
												<img
													src={imageUrl}
													alt={`Property photo ${idx + 1}`}
													className='h-full w-full object-cover'
												/>
												{isFeatured ? (
													<span className='absolute bottom-2 left-2 inline-flex items-center gap-1 rounded bg-amber-500 px-2 py-0.5 text-[10px] font-semibold text-white shadow-xs'>
														★ Featured
													</span>
												) : (
													<button
														type='button'
														onClick={() => updateField('featuredImageUrl', imageUrl)}
														className='absolute bottom-2 left-2 rounded bg-black/70 px-2 py-0.5 text-[10px] font-medium text-white opacity-80 transition hover:bg-black hover:opacity-100 cursor-pointer'
													>
														Set featured
													</button>
												)}
												<button
													type='button'
													onClick={() => removeExistingImage(imageUrl)}
													className='absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/65 text-white hover:bg-black/85 transition cursor-pointer'
													aria-label={`Remove photo ${idx + 1}`}
												>
													×
												</button>
											</div>
										);
									})}
								</div>
							</div>
						)}

						{/* Drag-and-drop file upload */}
						<label
							onDragOver={handleDragOver}
							onDragLeave={handleDragLeave}
							onDrop={handleDrop}
							className={`flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-5 text-center transition ${
								isDragging
									? 'border-primary bg-primary/10'
									: 'border-border bg-muted/40 hover:border-primary/50'
							}`}
						>
							<span className='text-sm font-semibold text-primary'>
								Choose new image files or drag them here
							</span>
							<span className='mt-1 text-xs text-muted-foreground'>
								PNG, JPG, or WEBP
							</span>
							<input
								type='file'
								accept='image/*'
								multiple
								className='sr-only'
								onChange={handleNewImages}
							/>
						</label>

						{/* New images previews */}
						{newImages.length > 0 && (
							<div className='mt-5'>
								<p className='text-xs font-medium text-muted-foreground mb-2'>
									New photos to upload ({newImages.length})
								</p>
								<div className='grid grid-cols-2 gap-3 sm:grid-cols-4'>
									{newImages.map((image) => (
										<div
											key={image.url}
											className='group relative aspect-square overflow-hidden rounded-lg bg-muted border border-border'
										>
											<img
												src={image.url}
												alt={image.file.name}
												className='h-full w-full object-cover'
											/>
											<button
												type='button'
												onClick={() => removeNewImage(image.url)}
												className='absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/65 text-white hover:bg-black/85 transition cursor-pointer'
												aria-label={`Remove ${image.file.name}`}
											>
												×
											</button>
										</div>
									))}
								</div>
							</div>
						)}
					</CardContent>
				</Card>

				{errors.form && (
					<p className='text-right text-sm text-destructive'>{errors.form}</p>
				)}

				<div className='flex justify-end gap-3 pb-8'>
					<Button asChild variant='outline'>
						<Link href='/admin'>Cancel</Link>
					</Button>
					<Button
						type='submit'
						disabled={saving}
					>
						{saving ? (
							<>
								<Spinner className='mr-2 h-4 w-4' />
								Saving changes...
							</>
						) : (
							'Save changes'
						)}
					</Button>
				</div>
			</form>
		</section>
	);
}
