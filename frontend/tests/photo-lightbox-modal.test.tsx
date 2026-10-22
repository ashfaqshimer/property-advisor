import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PhotoLightboxModal } from '@/components/admin/PhotoLightboxModal';

describe('PhotoLightboxModal', () => {
	const mockPhotos = [
		'https://example.com/photo-1.jpg',
		'https://example.com/photo-2.jpg',
		'https://example.com/photo-3.jpg',
	];

	it('does not render when isOpen is false', () => {
		const { container } = render(
			<PhotoLightboxModal
				isOpen={false}
				onClose={vi.fn()}
				photos={mockPhotos}
			/>
		);
		expect(container).toBeEmptyDOMElement();
	});

	it('renders dialog with counter and initial photo when open', () => {
		render(
			<PhotoLightboxModal
				isOpen={true}
				onClose={vi.fn()}
				photos={mockPhotos}
				initialIndex={0}
				propertyTitle="Sea View Villa"
			/>
		);

		expect(screen.getByRole('dialog', { name: /photo preview lightbox/i })).toBeInTheDocument();
		expect(screen.getByText('1 / 3')).toBeInTheDocument();
		expect(screen.getByText('Sea View Villa')).toBeInTheDocument();

		const img = screen.getByRole('img', { name: 'Property photo 1' });
		expect(img).toHaveAttribute('src', 'https://example.com/photo-1.jpg');
	});

	it('navigates next and previous photos via buttons', () => {
		render(
			<PhotoLightboxModal
				isOpen={true}
				onClose={vi.fn()}
				photos={mockPhotos}
				initialIndex={0}
			/>
		);

		const nextBtn = screen.getByRole('button', { name: /next photo/i });
		fireEvent.click(nextBtn);

		expect(screen.getByText('2 / 3')).toBeInTheDocument();
		expect(screen.getByRole('img', { name: 'Property photo 2' })).toHaveAttribute(
			'src',
			'https://example.com/photo-2.jpg'
		);

		const prevBtn = screen.getByRole('button', { name: /previous photo/i });
		fireEvent.click(prevBtn);

		expect(screen.getByText('1 / 3')).toBeInTheDocument();
	});

	it('navigates photos via keyboard arrows and closes with Escape', () => {
		const onClose = vi.fn();
		render(
			<PhotoLightboxModal
				isOpen={true}
				onClose={onClose}
				photos={mockPhotos}
				initialIndex={1}
			/>
		);

		expect(screen.getByText('2 / 3')).toBeInTheDocument();

		fireEvent.keyDown(window, { key: 'ArrowRight' });
		expect(screen.getByText('3 / 3')).toBeInTheDocument();

		fireEvent.keyDown(window, { key: 'Escape' });
		expect(onClose).toHaveBeenCalled();
	});

	it('jumps directly to a photo when clicking a filmstrip thumbnail', () => {
		render(
			<PhotoLightboxModal
				isOpen={true}
				onClose={vi.fn()}
				photos={mockPhotos}
				initialIndex={0}
			/>
		);

		const jumpThumb = screen.getByRole('button', { name: 'Jump to photo 3' });
		fireEvent.click(jumpThumb);

		expect(screen.getByText('3 / 3')).toBeInTheDocument();
		expect(screen.getByRole('img', { name: 'Property photo 3' })).toHaveAttribute(
			'src',
			'https://example.com/photo-3.jpg'
		);
	});

	it('triggers onSetFeatured when clicking Set as Featured button', () => {
		const onSetFeatured = vi.fn();
		render(
			<PhotoLightboxModal
				isOpen={true}
				onClose={vi.fn()}
				photos={mockPhotos}
				initialIndex={1}
				featuredUrl="https://example.com/photo-1.jpg"
				onSetFeatured={onSetFeatured}
			/>
		);

		const setFeaturedBtn = screen.getByRole('button', { name: /set as featured/i });
		fireEvent.click(setFeaturedBtn);

		expect(onSetFeatured).toHaveBeenCalledWith('https://example.com/photo-2.jpg');
	});

	it('triggers onDelete when clicking Delete Photo button', () => {
		const onDelete = vi.fn();
		render(
			<PhotoLightboxModal
				isOpen={true}
				onClose={vi.fn()}
				photos={mockPhotos}
				initialIndex={0}
				onDelete={onDelete}
			/>
		);

		const deleteBtn = screen.getByRole('button', { name: /delete photo/i });
		fireEvent.click(deleteBtn);

		expect(onDelete).toHaveBeenCalledWith('https://example.com/photo-1.jpg', 0);
	});
});
