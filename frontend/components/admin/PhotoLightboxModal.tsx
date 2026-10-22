'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, Download, Star, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface PhotoItem {
	url: string;
	title?: string;
	isFeatured?: boolean;
	isNew?: boolean;
}

interface PhotoLightboxModalProps {
	isOpen: boolean;
	onClose: () => void;
	photos: (string | PhotoItem)[];
	initialIndex?: number;
	propertyTitle?: string | null;
	propertyCode?: string | null;
	featuredUrl?: string | null;
	canDownload?: boolean;
	onSetFeatured?: (url: string) => void;
	onDelete?: (url: string, index: number) => void;
	onDownload?: (url: string, filename: string) => void;
}

export function PhotoLightboxModal({
	isOpen,
	onClose,
	photos,
	initialIndex = 0,
	propertyTitle,
	propertyCode,
	featuredUrl,
	canDownload = true,
	onSetFeatured,
	onDelete,
	onDownload,
}: PhotoLightboxModalProps) {
	const [currentIndex, setCurrentIndex] = useState(initialIndex);
	const touchStartXRef = useRef<number | null>(null);
	const touchStartYRef = useRef<number | null>(null);
	const filmstripRef = useRef<HTMLDivElement>(null);

	// Sync initialIndex when modal opens or initialIndex changes
	useEffect(() => {
		if (isOpen) {
			const safeIndex = Math.max(0, Math.min(initialIndex, photos.length - 1));
			setCurrentIndex(safeIndex);
		}
	}, [isOpen, initialIndex, photos.length]);

	// Auto-scroll the active thumbnail into view in the bottom filmstrip
	useEffect(() => {
		if (!isOpen || !filmstripRef.current) return;
		const activeThumb = filmstripRef.current.children[currentIndex] as HTMLElement | undefined;
		if (activeThumb && typeof activeThumb.scrollIntoView === 'function') {
			activeThumb.scrollIntoView({
				behavior: 'smooth',
				inline: 'center',
				block: 'nearest',
			});
		}
	}, [isOpen, currentIndex]);

	const normalizedPhotos: PhotoItem[] = photos.map((p) => {
		if (typeof p === 'string') {
			return {
				url: p,
				isFeatured: featuredUrl ? featuredUrl === p : false,
			};
		}
		return {
			...p,
			isFeatured: featuredUrl ? featuredUrl === p.url : p.isFeatured,
		};
	});

	const currentPhoto = normalizedPhotos[currentIndex];
	const totalPhotos = normalizedPhotos.length;

	const handlePrev = useCallback(() => {
		setCurrentIndex((prev) => (prev > 0 ? prev - 1 : totalPhotos - 1));
	}, [totalPhotos]);

	const handleNext = useCallback(() => {
		setCurrentIndex((prev) => (prev < totalPhotos - 1 ? prev + 1 : 0));
	}, [totalPhotos]);

	// Keyboard navigation
	useEffect(() => {
		if (!isOpen) return;

		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				e.preventDefault();
				onClose();
			} else if (e.key === 'ArrowLeft') {
				e.preventDefault();
				handlePrev();
			} else if (e.key === 'ArrowRight') {
				e.preventDefault();
				handleNext();
			}
		};

		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [isOpen, onClose, handlePrev, handleNext]);

	// Lock body scroll when modal is open
	useEffect(() => {
		if (!isOpen) return;
		const originalOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		return () => {
			document.body.style.overflow = originalOverflow;
		};
	}, [isOpen]);

	// Touch swipe gestures
	const handleTouchStart = (e: React.TouchEvent) => {
		touchStartXRef.current = e.touches[0].clientX;
		touchStartYRef.current = e.touches[0].clientY;
	};

	const handleTouchEnd = (e: React.TouchEvent) => {
		if (touchStartXRef.current === null || touchStartYRef.current === null) return;
		const deltaX = e.changedTouches[0].clientX - touchStartXRef.current;
		const deltaY = e.changedTouches[0].clientY - touchStartYRef.current;

		// Horizontal swipe with minimum threshold 40px and dominant over vertical
		if (Math.abs(deltaX) > 40 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
			if (deltaX > 0) {
				handlePrev();
			} else {
				handleNext();
			}
		}

		touchStartXRef.current = null;
		touchStartYRef.current = null;
	};

	if (!isOpen || !currentPhoto) return null;

	const isFeatured = currentPhoto.isFeatured || (featuredUrl ? featuredUrl === currentPhoto.url : currentIndex === 0);

	const handleDownloadCurrent = () => {
		if (onDownload) {
			const filename = `${propertyCode || 'property'}-photo-${currentIndex + 1}.jpg`;
			onDownload(currentPhoto.url, filename);
		}
	};

	const handleDeleteCurrent = () => {
		if (onDelete) {
			onDelete(currentPhoto.url, currentIndex);
			// Adjust current index if we delete the last item
			if (currentIndex >= totalPhotos - 1 && currentIndex > 0) {
				setCurrentIndex(currentIndex - 1);
			}
		}
	};

	return (
		<div
			role="dialog"
			aria-modal="true"
			aria-label="Photo preview lightbox"
			className="fixed inset-0 z-50 flex flex-col bg-black/95 text-white select-none backdrop-blur-md"
		>
			{/* Top Bar */}
			<div className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 px-4 sm:px-6">
				<div className="flex items-center gap-3 min-w-0">
					<span className="text-xs font-semibold uppercase tracking-wider text-white/70">
						{currentIndex + 1} / {totalPhotos}
					</span>
					{isFeatured && (
						<span className="inline-flex items-center gap-1 rounded bg-amber-500/90 px-2 py-0.5 text-[11px] font-semibold text-white shadow-xs">
							<Star className="h-3 w-3 fill-white" />
							Featured Cover
						</span>
					)}
					{propertyTitle && (
						<span className="hidden truncate text-xs text-white/60 sm:inline max-w-xs">
							{propertyTitle}
						</span>
					)}
				</div>

				<div className="flex items-center gap-1 sm:gap-2">
					{canDownload && onDownload && (
						<button
							type="button"
							onClick={handleDownloadCurrent}
							className="flex h-10 w-10 items-center justify-center rounded-full text-white/80 hover:bg-white/15 hover:text-white transition cursor-pointer"
							title="Download this photo"
							aria-label="Download this photo"
						>
							<Download className="h-4 w-4" />
						</button>
					)}
					<button
						type="button"
						onClick={onClose}
						className="flex h-10 w-10 items-center justify-center rounded-full text-white/80 hover:bg-white/15 hover:text-white transition cursor-pointer"
						title="Close (Esc)"
						aria-label="Close lightbox"
					>
						<X className="h-5 w-5" />
					</button>
				</div>
			</div>

			{/* Main Photo Area */}
			<div
				className="relative flex flex-1 items-center justify-center overflow-hidden p-2 sm:p-6"
				onTouchStart={handleTouchStart}
				onTouchEnd={handleTouchEnd}
			>
				{/* Left Nav Button */}
				{totalPhotos > 1 && (
					<button
						type="button"
						onClick={handlePrev}
						aria-label="Previous photo"
						className="absolute left-2 sm:left-4 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 hover:scale-105 active:scale-95 transition cursor-pointer shadow-lg border border-white/10"
					>
						<ChevronLeft className="h-6 w-6" />
					</button>
				)}

				{/* Image Container */}
				<div className="relative flex h-full w-full items-center justify-center">
					<img
						key={currentPhoto.url}
						src={currentPhoto.url}
						alt={currentPhoto.title || `Property photo ${currentIndex + 1}`}
						className="max-h-full max-w-full object-contain rounded-md shadow-2xl transition-all duration-200"
					/>
				</div>

				{/* Right Nav Button */}
				{totalPhotos > 1 && (
					<button
						type="button"
						onClick={handleNext}
						aria-label="Next photo"
						className="absolute right-2 sm:right-4 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 hover:scale-105 active:scale-95 transition cursor-pointer shadow-lg border border-white/10"
					>
						<ChevronRight className="h-6 w-6" />
					</button>
				)}
			</div>

			{/* Bottom Controls & Filmstrip */}
			<div className="shrink-0 border-t border-white/10 bg-black/60 px-3 py-2.5 sm:px-6 sm:py-3 backdrop-blur-md">
				{/* Action Buttons Row */}
				<div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
					<div className="flex items-center gap-2">
						{onSetFeatured && (
							<Button
								type="button"
								size="sm"
								variant={isFeatured ? "default" : "secondary"}
								disabled={isFeatured}
								onClick={() => onSetFeatured(currentPhoto.url)}
								className={`h-8 gap-1.5 text-xs font-semibold cursor-pointer ${
									isFeatured
										? 'bg-amber-500 hover:bg-amber-600 text-white'
										: 'bg-white/15 text-white hover:bg-white/25 border-none'
								}`}
							>
								<Star className={`h-3.5 w-3.5 ${isFeatured ? 'fill-white' : ''}`} />
								{isFeatured ? 'Featured Cover Photo' : 'Set as Featured'}
							</Button>
						)}
					</div>

					<div className="flex items-center gap-2">
						{onDelete && (
							<Button
								type="button"
								size="sm"
								variant="destructive"
								onClick={handleDeleteCurrent}
								className="h-8 gap-1.5 text-xs cursor-pointer bg-red-600/80 hover:bg-red-600 text-white"
							>
								<Trash2 className="h-3.5 w-3.5" />
								Delete Photo
							</Button>
						)}
					</div>
				</div>

				{/* Thumbnail Filmstrip (Tap to jump) */}
				{totalPhotos > 1 && (
					<div
						ref={filmstripRef}
						className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-thin scrollbar-thumb-white/20"
					>
						{normalizedPhotos.map((photo, idx) => {
							const isSelected = idx === currentIndex;
							const isPhotoFeatured =
								photo.isFeatured || (featuredUrl ? featuredUrl === photo.url : idx === 0);

							return (
								<button
									key={photo.url + idx}
									type="button"
									onClick={() => setCurrentIndex(idx)}
									aria-label={`Jump to photo ${idx + 1}`}
									className={`relative h-12 w-12 sm:h-14 sm:w-14 shrink-0 overflow-hidden rounded-md border transition-all cursor-pointer ${
										isSelected
											? 'border-amber-400 ring-2 ring-amber-400/80 scale-105'
											: 'border-white/20 opacity-50 hover:opacity-100'
									}`}
								>
									<img
										src={photo.url}
										alt={`Thumbnail ${idx + 1}`}
										className="h-full w-full object-cover"
									/>
									{isPhotoFeatured && (
										<span className="absolute bottom-0.5 right-0.5 block h-2 w-2 rounded-full bg-amber-400" />
									)}
								</button>
							);
						})}
					</div>
				)}
			</div>
		</div>
	);
}
