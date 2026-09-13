import type { SVGProps } from 'react';

type SpinnerProps = SVGProps<SVGSVGElement> & {
	label?: string;
};

export function Spinner({ label = 'Loading', className, ...props }: SpinnerProps) {
	return (
		<svg
			aria-label={label}
			aria-hidden={label ? undefined : true}
			className={`animate-spin ${className ?? ''}`}
			fill='none'
			role='status'
			viewBox='0 0 24 24'
			{...props}
		>
			<circle
				className='opacity-25'
				cx='12'
				cy='12'
				r='10'
				stroke='currentColor'
				strokeWidth='4'
			/>
			<path
				className='opacity-75'
				 d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z'
				fill='currentColor'
			/>
		</svg>
	);
}