'use client';

import React, { useState, useEffect, useRef } from 'react';

export const SQFT_PER_PERCH = 272.25;

interface AreaConverterInputProps {
	label: string;
	primaryUnit: 'perches' | 'sqft';
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
	className?: string;
}

export function AreaConverterInput({
	label,
	primaryUnit,
	value,
	onChange,
	placeholder,
	className,
}: AreaConverterInputProps) {
	const [activeUnit, setActiveUnit] = useState<'perches' | 'sqft'>(primaryUnit);
	const [displayValue, setDisplayValue] = useState<string>(value);
	const isFocusedRef = useRef(false);

	useEffect(() => {
		if (isFocusedRef.current) return;
		if (!value || value.trim() === '') {
			setDisplayValue('');
			return;
		}
		const num = Number(value);
		if (isNaN(num)) {
			setDisplayValue(value);
			return;
		}
		if (activeUnit === primaryUnit) {
			setDisplayValue(value);
		} else if (activeUnit === 'sqft' && primaryUnit === 'perches') {
			setDisplayValue(Math.round(num * SQFT_PER_PERCH).toString());
		} else if (activeUnit === 'perches' && primaryUnit === 'sqft') {
			setDisplayValue((num / SQFT_PER_PERCH).toFixed(2));
		}
	}, [value, activeUnit, primaryUnit]);

	const handleUnitSwitch = (newUnit: 'perches' | 'sqft') => {
		if (newUnit === activeUnit) return;
		setActiveUnit(newUnit);
		if (!value || value.trim() === '') {
			setDisplayValue('');
			return;
		}
		const num = Number(value);
		if (isNaN(num)) return;
		if (newUnit === primaryUnit) {
			setDisplayValue(value);
		} else if (newUnit === 'sqft' && primaryUnit === 'perches') {
			setDisplayValue(Math.round(num * SQFT_PER_PERCH).toString());
		} else if (newUnit === 'perches' && primaryUnit === 'sqft') {
			setDisplayValue((num / SQFT_PER_PERCH).toFixed(2));
		}
	};

	const handleInputChange = (raw: string) => {
		setDisplayValue(raw);
		if (!raw.trim()) {
			onChange('');
			return;
		}
		const num = Number(raw);
		if (isNaN(num)) return;

		if (activeUnit === primaryUnit) {
			onChange(raw);
		} else if (activeUnit === 'sqft' && primaryUnit === 'perches') {
			const perches = (num / SQFT_PER_PERCH).toFixed(2);
			onChange(perches);
		} else if (activeUnit === 'perches' && primaryUnit === 'sqft') {
			const sqft = Math.round(num * SQFT_PER_PERCH).toString();
			onChange(sqft);
		}
	};

	let secondaryHint = '';
	const numValue = Number(value);
	if (value && !isNaN(numValue) && numValue > 0) {
		if (activeUnit === 'perches') {
			const sqftNum = primaryUnit === 'perches' ? numValue * SQFT_PER_PERCH : numValue;
			secondaryHint = `≈ ${sqftNum.toLocaleString(undefined, { maximumFractionDigits: 1 })} sq ft`;
		} else {
			const perchNum = primaryUnit === 'sqft' ? numValue / SQFT_PER_PERCH : numValue;
			secondaryHint = `≈ ${perchNum.toFixed(2)} perches`;
		}
	}

	return (
		<div>
			<div className='flex items-center justify-between mb-1.5'>
				<label className='text-sm font-medium text-[#253a30] dark:text-zinc-200'>
					{label}
				</label>
				<div className='inline-flex rounded-md border border-[#dce4df] dark:border-zinc-800 bg-[#f4f8f5] dark:bg-zinc-900 p-0.5 text-[11px] select-none'>
					<button
						type='button'
						onClick={() => handleUnitSwitch('perches')}
						className={`px-2 py-0.5 rounded font-medium transition-colors cursor-pointer ${
							activeUnit === 'perches'
								? 'bg-white dark:bg-zinc-800 text-[#19352b] dark:text-zinc-100 shadow-xs'
								: 'text-[#65736b] dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
						}`}
					>
						Perches
					</button>
					<button
						type='button'
						onClick={() => handleUnitSwitch('sqft')}
						className={`px-2 py-0.5 rounded font-medium transition-colors cursor-pointer ${
							activeUnit === 'sqft'
								? 'bg-white dark:bg-zinc-800 text-[#19352b] dark:text-zinc-100 shadow-xs'
								: 'text-[#65736b] dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
						}`}
					>
						Sq ft
					</button>
				</div>
			</div>
			<input
				type='number'
				min='0'
				step={activeUnit === 'perches' ? '0.01' : '1'}
				className={className}
				value={displayValue}
				onFocus={() => {
					isFocusedRef.current = true;
				}}
				onBlur={() => {
					isFocusedRef.current = false;
				}}
				onChange={(e) => handleInputChange(e.target.value)}
				placeholder={placeholder}
			/>
			{secondaryHint && (
				<p className='mt-1 text-xs text-[#65736b] dark:text-zinc-400 font-medium'>
					{secondaryHint}
				</p>
			)}
		</div>
	);
}
