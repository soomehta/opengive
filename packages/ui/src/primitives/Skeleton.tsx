import * as React from 'react';
import { type VariantProps, cva } from 'class-variance-authority';
import { cn } from '../lib/utils';

const skeletonVariants = cva(
  // Base: pulse animation respects prefers-reduced-motion via Tailwind's motion-safe modifier
  'motion-safe:animate-pulse bg-[var(--surface-raised)] relative overflow-hidden',
  {
    variants: {
      rounded: {
        none: 'rounded-none',
        sm: 'rounded-sm',
        md: 'rounded-md',
        lg: 'rounded-lg',
        full: 'rounded-full',
      },
    },
    defaultVariants: { rounded: 'md' },
  }
);

interface SkeletonProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof skeletonVariants> {}

/**
 * Skeleton — loading placeholder following the Clarity loading state spec.
 * Uses animate-pulse with surface-raised background.
 * The shimmer gradient overlays to produce the surface-raised -> surface-elevated sweep.
 * Animation is gated behind `motion-safe` so it respects prefers-reduced-motion.
 */
export function Skeleton({ rounded, className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(skeletonVariants({ rounded }), className)}
      aria-hidden="true"
      role="presentation"
      {...props}
    >
      {/* Shimmer sweep */}
      <span
        className={cn(
          'absolute inset-0 -translate-x-full',
          'motion-safe:animate-[shimmer_1.8s_infinite]',
          'bg-gradient-to-r from-transparent via-[var(--surface-elevated)]/40 to-transparent'
        )}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Convenience composites
// ---------------------------------------------------------------------------

interface SkeletonTextProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Number of lines to render */
  lines?: number;
}

/** Multi-line text skeleton with staggered widths for natural appearance */
export function SkeletonText({ lines = 3, className, ...props }: SkeletonTextProps) {
  const widths = ['w-full', 'w-4/5', 'w-3/5', 'w-11/12', 'w-2/3'];
  return (
    <div className={cn('flex flex-col gap-2', className)} {...props}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          rounded="sm"
          className={cn('h-4', widths[i % widths.length])}
        />
      ))}
    </div>
  );
}

/** Card-shaped skeleton matching the Card component anatomy */
export function SkeletonCard({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'bg-[var(--surface-raised)] border border-[var(--border-subtle)] rounded-2xl overflow-hidden',
        className
      )}
      {...props}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--border-subtle)] flex items-center gap-3">
        <Skeleton rounded="md" className="h-4 w-32" />
        <Skeleton rounded="full" className="h-5 w-16 ms-auto" />
      </div>
      {/* Body */}
      <div className="p-4 flex flex-col gap-3">
        <SkeletonText lines={3} />
      </div>
    </div>
  );
}
