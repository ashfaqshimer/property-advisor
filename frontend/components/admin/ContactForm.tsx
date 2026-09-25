import { useState, type FormEvent } from 'react';
import { PropertyContact } from '@/lib/api';
import { Spinner } from '@/components/ui/spinner';

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

	const inputCls = 'w-full rounded-lg border border-[#d0dbd4] dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-[#1a2923] dark:text-zinc-200 placeholder:text-[#9aab9e] focus:border-[#35664f] focus:outline-none';
	const labelCls = 'block text-xs font-semibold text-[#65736b] dark:text-zinc-300 mb-1';

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
					<button type='button' onClick={addPhone} className='text-xs font-semibold text-[#35664f] dark:text-emerald-400 hover:underline'>
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
							<label className='flex items-center gap-1 text-xs text-[#65736b] dark:text-zinc-300 shrink-0 cursor-pointer select-none'>
								<input
									type='checkbox'
									checked={p.is_whatsapp}
									onChange={(e) => updatePhone(i, 'is_whatsapp', e.target.checked)}
									className='accent-[#25a244]'
								/>
								WA
							</label>
							{phones.length > 1 && (
								<button type='button' onClick={() => removePhone(i)} className='text-[#a34d4d] dark:text-red-400 text-lg leading-none hover:opacity-70'>
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
				<button type='submit' disabled={saving} className='inline-flex items-center gap-2 rounded-lg bg-[#28513f] dark:bg-emerald-700 px-4 py-2 text-sm font-semibold text-white dark:text-zinc-200 hover:bg-[#1e4031] dark:hover:bg-emerald-600 disabled:opacity-60'>
					{saving && <Spinner className='h-4 w-4' />}
					{initial ? 'Save changes' : 'Add contact'}
				</button>
			</div>
		</form>
	);
}
