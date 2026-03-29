import * as React from 'react';
import { cn } from '../lib/utils';

// ---------------------------------------------------------------------------
// Card root
// ---------------------------------------------------------------------------

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Remove the default overflow-hidden when children need to overflow (e.g. dropdowns) */
  noOverflowClip?: boolean;
}

export function Card({ noOverflowClip = false, className, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'bg-[var(--surface-raised)] border border-[var(--border-subtle)] rounded-md shadow-[var(--shadow-sm)]',
        !noOverflowClip && 'overflow-hidden',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CardHeader
// ---------------------------------------------------------------------------

interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Slot rendered on the inline-end side of the header (actions, badges, etc.) */
  actions?: React.ReactNode;
}

export function CardHeader({ actions, className, children, ...props }: CardHeaderProps) {
  return (
    <div
      className={cn(
        'px-4 py-3 border-b border-[var(--border-subtle)] flex items-center justify-between gap-2',
        className
      )}
      {...props}
    >
      {/* Title area */}
      <div className="flex-1 min-w-0">
        {React.isValidElement(children) ? (
          children
        ) : (
          <h3 className="text-sm font-medium text-[var(--text-primary)] truncate">
            {children}
          </h3>
        )}
      </div>

      {/* Actions slot */}
      {actions && (
        <div className="flex items-center gap-2 shrink-0">{actions}</div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CardContent
// ---------------------------------------------------------------------------

interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Remove default padding for flush/full-bleed layouts (e.g. tables, maps) */
  noPadding?: boolean;
}

export function CardContent({ noPadding = false, className, children, ...props }: CardContentProps) {
  return (
    <div className={cn(!noPadding && 'p-4', className)} {...props}>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CardFooter
// ---------------------------------------------------------------------------

interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {}

export function CardFooter({ className, children, ...props }: CardFooterProps) {
  return (
    <div
      className={cn(
        'px-4 py-3 border-t border-[var(--border-subtle)] flex items-center justify-between gap-2 text-xs text-[var(--text-tertiary)]',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
