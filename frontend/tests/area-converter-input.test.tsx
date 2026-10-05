import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AreaConverterInput, SQFT_PER_PERCH } from '@/components/admin/AreaConverterInput';

describe('AreaConverterInput', () => {
	it('renders with initial perch value and displays sqft equivalent hint', () => {
		render(
			<AreaConverterInput
				label="Land size"
				primaryUnit="perches"
				value="27"
				onChange={vi.fn()}
			/>
		);

		expect(screen.getByText('Land size')).toBeInTheDocument();
		const input = screen.getByRole('spinbutton') as HTMLInputElement;
		expect(input.value).toBe('27');

		const expectedSqft = (27 * SQFT_PER_PERCH).toLocaleString(undefined, { maximumFractionDigits: 1 });
		expect(screen.getByText(`≈ ${expectedSqft} sq ft`)).toBeInTheDocument();
	});

	it('switches between Perches and Sqft units and converts values accurately', () => {
		const handleChange = vi.fn();
		render(
			<AreaConverterInput
				label="Land size"
				primaryUnit="perches"
				value="27"
				onChange={handleChange}
			/>
		);

		const sqftButton = screen.getByRole('button', { name: 'Sq ft' });
		fireEvent.click(sqftButton);

		const input = screen.getByRole('spinbutton') as HTMLInputElement;
		// 27 * 272.25 = 7350.75 -> rounded to 7351
		expect(input.value).toBe('7351');
		expect(screen.getByText('≈ 27.00 perches')).toBeInTheDocument();

		// Typing in sqft mode triggers onChange in perches (canonical)
		fireEvent.change(input, { target: { value: '5445' } });
		// 5445 / 272.25 = 20.00
		expect(handleChange).toHaveBeenCalledWith('20.00');
	});

	it('handles building floor area in sqft converting to perches footprint', () => {
		render(
			<AreaConverterInput
				label="Floor area"
				primaryUnit="sqft"
				value="3500"
				onChange={vi.fn()}
			/>
		);

		const input = screen.getByRole('spinbutton') as HTMLInputElement;
		expect(input.value).toBe('3500');

		const perchesEquiv = (3500 / SQFT_PER_PERCH).toFixed(2);
		expect(screen.getByText(`≈ ${perchesEquiv} perches`)).toBeInTheDocument();
	});
});
