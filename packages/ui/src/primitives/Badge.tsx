import * as React from 'react';
import { type VariantProps, cva } from 'class-variance-authority';
import { cn } from '../lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full font-medium leading-none select-none',
  {
    variants: {
      variant: {
        default:
          'bg-[var(--surface-elevated)] text-[var(--text-secondary)] border border-[var(--border-default)]',
        primary:
          'bg-[var(--accent-trust-subtle)] text-[var(--accent-trust)] border border-[var(--accent-trust)]/20',
        success:
          'bg-[var(--signal-healthy-subtle)] text-[var(--signal-healthy)] border border-[var(--signal-healthy)]/20',
        warning:
          'bg-[var(--signal-caution-subtle)] text-[var(--signal-caution)] border border-[var(--signal-caution)]/20',
        danger:
          'bg-[var(--signal-danger-subtle)] text-[var(--signal-danger)] border border-[var(--signal-danger)]/20',
        info:
          'bg-[var(--signal-neutral-subtle)] text-[var(--signal-neutral)] border border-[var(--signal-neutral)]/20',
      },
      size: {
        sm: 'px-2 py-0.5 text-xs',
        md: 'px-3 py-1 text-xs',
      },
    },
    defaultVariants: { variant: 'default', size: 'md' },
  }
);

/** Icon map — each variant supplies a paired icon so color is never the sole differentiator (WCAG). */
const variantIcons: Record<string, React.ReactElement> = {
  success: (
    <svg className="h-3 w-3 shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M20 6L9 17l-5-5"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  warning: (
    <svg className="h-3 w-3 shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 9v4M12 17h.01"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  ),
  danger: (
    <svg className="h-3 w-3 shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
      <path
        d="M15 9l-6 6M9 9l6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  ),
  info: (
    <svg className="h-3 w-3 shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
      <path
        d="M12 16v-4M12 8h.01"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  ),
};

interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  /** Suppress the auto-paired icon for this variant */
  hideIcon?: boolean;
}

export function Badge({
  variant = 'default',
  size,
  hideIcon = false,
  className,
  children,
  ...props
}: BadgeProps) {
  const icon = variant && !hideIcon ? variantIcons[variant] : null;

  return (
    <span className={cn(badgeVariants({ variant, size }), className)} {...props}>
      {icon}
      {children}
    </span>
  );
}

export { badgeVariants };
