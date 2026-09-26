import { useState } from 'react';
import { PropertyContact } from '@/lib/api';
import { Spinner } from '@/components/ui/spinner';
import { Trash2 } from 'lucide-react';

export type PhoneEntry = { phone: string; label: string; is_whatsapp: boolean };

export function EmptyPhoneEntry(): PhoneEntry {
	return { phone: '', label: '', is_whatsapp: false };
}

export function ContactForm({
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

	function handleSubmit() {
		onSave({
			contact_type: contactType,
			full_name: fullName.trim(),
			company_name: companyName.trim() || null,
			email: email.trim() || null,
			notes: notes.trim() || null,
			phones: phones.filter((p) => p.phone.trim()),
		});
	}

	const inputCls = 'w-full rounded-lg border border-[#d0dbd4] dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-[#1a2923] dark:text-zinc-200 placeholder:text-[#9aab9e] focus:border-[#35664f] focus:outline-none';
	const labelCls = 'block text-xs font-semibold text-[#65736b] dark:text-zinc-300 mb-1';

	return (
		<div className='space-y-4'>
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
				</div>
				<div className='space-y-3'>
					{phones.map((p, i) => (
						<div key={i} className='relative rounded-lg border border-[#e6ebe8] dark:border-zinc-800 bg-[#f9fbf9] dark:bg-zinc-900/50 p-4 pt-5'>
							{phones.length > 1 && (
								<button type='button' onClick={() => removePhone(i)} className='absolute right-2 top-2 rounded p-1.5 text-[#a34d4d] hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950 transition-colors' title="Remove number">
									<Trash2 className="h-4 w-4" />
								</button>
							)}
							<div className='grid gap-4 sm:grid-cols-2'>
								<div className='sm:col-span-2'>
									<label className={labelCls}>Phone number</label>
									<input
										value={p.phone}
										onChange={(e) => updatePhone(i, 'phone', e.target.value)}
										className={inputCls}
										placeholder='+94 77 123 4567'
									/>
								</div>
								<div>
									<label className={labelCls}>Label (e.g. Mobile)</label>
									<select
										value={p.label}
										onChange={(e) => updatePhone(i, 'label', e.target.value)}
										className={inputCls}
									>
										<option value=''>Select label...</option>
										<option value='Mobile'>Mobile</option>
										<option value='Home'>Home</option>
										<option value='Office'>Office</option>
										<option value='Other'>Other</option>
									</select>
								</div>
								<div className='flex items-end pb-1'>
									<label className='flex cursor-pointer select-none items-center gap-2 text-sm font-medium text-[#253a30] dark:text-zinc-200'>
										<input
											type='checkbox'
											checked={p.is_whatsapp}
											onChange={(e) => updatePhone(i, 'is_whatsapp', e.target.checked)}
											className='h-4 w-4 accent-[#25a244]'
										/>
										<svg className='h-4 w-4 text-[#25a244]' viewBox='0 0 24 24' fill='currentColor'>
											<path d='M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z' />
										</svg>
										Available on WhatsApp
									</label>
								</div>
							</div>
						</div>
					))}
					<button type='button' onClick={addPhone} className='mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-[#35664f] dark:text-emerald-400 hover:underline'>
						+ Add another number
					</button>
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
				<button type='button' onClick={handleSubmit} disabled={saving} className='inline-flex items-center gap-2 rounded-lg bg-[#28513f] dark:bg-emerald-700 px-4 py-2 text-sm font-semibold text-white dark:text-zinc-200 hover:bg-[#1e4031] dark:hover:bg-emerald-600 disabled:opacity-60'>
					{saving && <Spinner className='h-4 w-4' />}
					{initial ? 'Save changes' : 'Add contact'}
				</button>
			</div>
		</div>
	);
}
