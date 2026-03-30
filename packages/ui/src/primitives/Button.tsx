import * as React from 'react';
import { type VariantProps, cva } from 'class-variance-authority';
import { Slot } from '@radix-ui/react-slot';
import { cn } from '../lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-full text-sm font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-trust)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-base)] disabled:pointer-events-none disabled:opacity-50 motion-safe:hover:scale-[1.03] motion-safe:hover:-translate-y-0.5 motion-safe:active:scale-95',
  {
    variants: {
      variant: {
        primary:
          'bg-[var(--accent-trust)] text-white hover:bg-[var(--accent-trust)]/85 hover:shadow-[var(--shadow-md)]',
        secondary:
          'bg-[var(--surface-elevated)] text-[var(--text-primary)] border border-[var(--border-default)] hover:bg-[var(--surface-elevated)]/80 hover:shadow-[var(--shadow-sm)]',
        ghost:
          'hover:bg-[var(--surface-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
        danger:
          'bg-[var(--signal-danger)] text-white hover:bg-[var(--signal-danger)]/90',
        link: 'text-[var(--accent-trust)] underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-9 px-5 text-xs',
        md: 'h-10 px-6 text-sm',
        lg: 'h-12 px-10 text-base',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  }
);

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  isLoading?: boolean;
}

export function Button({
  variant,
  size,
  isLoading,
  asChild,
  className,
  children,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={isLoading || props.disabled}
      aria-busy={isLoading ?? undefined}
      {...props}
    >
      {isLoading ? (
        <>
          <svg
            className="me-2 h-4 w-4 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          {children}
        </>
      ) : (
        children
      )}
    </Comp>
  );
}

export { buttonVariants };
