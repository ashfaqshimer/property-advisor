'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
	deleteAdminProperty,
	getAdminProperties,
	updateAdminProperty,
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
};

const statusStyles: Record<PropertyStatus, string> = {
	available: 'bg-[#e0f1e7] text-[#28704b]',
	under_offer: 'bg-[#fff0d5] text-[#9a6415]',
	sold: 'bg-[#e9e9ea] text-[#62666b]',
};

export default function AdminPropertiesPage() {
	const [properties, setProperties] = useState<Property[]>([]);
	const [error, setError] = useState('');
	const [loading, setLoading] = useState(true);
	const [busyProperty, setBusyProperty] = useState<string | null>(null);
	useEffect(() => {
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
					})),
				),
			)
			.catch((reason) =>
				setError(
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
		} catch (reason) {
			setError(
				reason instanceof Error
					? reason.message
					: 'Could not update the property.',
			);
		} finally {
			setBusyProperty(null);
		}
	}
	async function deleteProperty(id: string) {
		setBusyProperty(id);
		try {
			await deleteAdminProperty(id);
			setProperties((current) =>
				current.filter((property) => property.id !== id),
			);
		} catch (reason) {
			setError(
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
					<p className='text-sm font-medium text-[#75847c]'>
						Catalog management
					</p>
					<h2 className='mt-1 text-3xl font-semibold tracking-tight'>
						Properties
					</h2>
					<p className='mt-2 text-sm text-[#75847c]'>
						Manage listings, visibility, and featured placements.
					</p>
				</div>
				<div className='flex flex-wrap items-center gap-3'>
					<Link
						href='/'
						className='inline-flex items-center justify-center rounded-lg border border-[#cbd9d0] bg-white px-5 py-3 text-sm font-semibold text-[#28513f] transition hover:bg-[#f4f8f5]'
					>
						View customer site
					</Link>
					<Link
						href='/admin/properties/new'
						className='inline-flex items-center justify-center rounded-lg bg-[#28513f] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1e4031]'
					>
						<span className='mr-2 text-lg leading-none'>+</span> Add Property
					</Link>
				</div>
			</div>
			<div className='mb-3 text-right text-sm text-[#a34d4d]'>{error}</div>
			<div className='overflow-hidden rounded-xl border border-[#dce4df] bg-white shadow-[0_8px_24px_rgba(25,53,43,0.04)]'>
				<div className='flex items-center justify-between border-b border-[#e6ebe8] px-5 py-4'>
					<p className='text-sm font-semibold'>
						All properties{' '}
						<span className='ml-1 font-normal text-[#8a968f]'>
							({properties.length})
						</span>
					</p>
					<span className='text-xs text-[#8a968f]'>Live data</span>
				</div>
				<div className='overflow-x-auto'>
					<table className='w-full min-w-[900px] text-left text-sm'>
						<thead className='bg-[#f8faf8] text-xs uppercase tracking-[0.12em] text-[#7a8780]'>
							<tr>
								<th className='px-5 py-4 font-semibold'>Property</th>
								<th className='px-4 py-4 font-semibold'>Type</th>
								<th className='px-4 py-4 font-semibold'>Location</th>
								<th className='px-4 py-4 font-semibold'>Price (LKR)</th>
								<th className='px-4 py-4 font-semibold'>Status</th>
								<th className='px-4 py-4 font-semibold'>Featured</th>
								<th className='px-5 py-4 text-right font-semibold'>Actions</th>
							</tr>
						</thead>
						<tbody className='divide-y divide-[#edf0ee]'>
							{loading ? (
								<tr>
									<td className='px-5 py-12 text-center' colSpan={7}>
										<Spinner className='mx-auto h-5 w-5 text-[#28513f]' />
										<span className='sr-only'>Loading properties</span>
									</td>
								</tr>
							) : properties.map((property) => (
								<tr key={property.id} className='transition hover:bg-[#fbfcfb]'>
									<td className='px-5 py-4'>
										<span className='font-semibold text-[#253a30]'>
											{property.title}
										</span>
									</td>
									<td className='px-4 py-4 text-[#65736b]'>{property.type}</td>
									<td className='px-4 py-4 text-[#65736b]'>
										{property.location}
									</td>
									<td className='px-4 py-4 font-medium text-[#344b3f]'>
										{property.price.replace('LKR ', '')}
									</td>
									<td className='px-4 py-4'>
										<span
											className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyles[property.status]}`}
										>
											{property.status.replace('_', ' ')}
										</span>
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
											className={`text-2xl leading-none transition ${property.featured ? 'text-[#d99b2b]' : 'text-[#c8d0ca] hover:text-[#d99b2b]'}`}
										>
											{busyProperty === property.id ? <Spinner className='inline h-5 w-5' /> : '★'}
										</button>
									</td>
									<td className='px-5 py-4 text-right'>
										<button
											type='button'
											disabled={busyProperty === property.id}
											onClick={() => console.log('Edit property', property)}
											className='mr-4 text-xs font-semibold text-[#35664f] hover:underline'
										>
											Edit
										</button>
										<button
											type='button'
											onClick={() => deleteProperty(property.id)}
											className='text-xs font-semibold text-[#a34d4d] hover:underline'
										>
											{busyProperty === property.id ? <Spinner className='inline h-3.5 w-3.5' /> : 'Delete'}
										</button>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</div>
		</section>
	);
}
