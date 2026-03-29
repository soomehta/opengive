'use client';

import * as React from 'react';
import * as RadixDialog from '@radix-ui/react-dialog';
import { cn } from '../lib/utils';

// ---------------------------------------------------------------------------
// Re-export Radix primitives that consumers need directly
// ---------------------------------------------------------------------------

export const Dialog = RadixDialog.Root;
export const DialogTrigger = RadixDialog.Trigger;

// ---------------------------------------------------------------------------
// Overlay
// ---------------------------------------------------------------------------

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof RadixDialog.Overlay>,
  React.ComponentPropsWithoutRef<typeof RadixDialog.Overlay>
>(({ className, ...props }, ref) => (
  <RadixDialog.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-[var(--surface-ground)]/80 backdrop-blur-sm',
      'data-[state=open]:animate-in data-[state=closed]:animate-out',
      'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className
    )}
    {...props}
  />
));
DialogOverlay.displayName = 'DialogOverlay';

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

interface DialogContentProps
  extends React.ComponentPropsWithoutRef<typeof RadixDialog.Content> {
  /** Hides the default close button */
  hideClose?: boolean;
}

export const DialogContent = React.forwardRef<
  React.ElementRef<typeof RadixDialog.Content>,
  DialogContentProps
>(({ hideClose = false, className, children, ...props }, ref) => (
  <RadixDialog.Portal>
    <DialogOverlay />
    <RadixDialog.Content
      ref={ref}
      className={cn(
        'fixed start-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2',
        'w-full max-w-lg rounded-lg bg-[var(--surface-overlay)] border border-[var(--border-default)]',
        'shadow-[var(--shadow-lg)] p-6',
        'focus:outline-none',
        'data-[state=open]:animate-in data-[state=closed]:animate-out',
        'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
        'data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-1/2',
        'data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-1/2',
        className
      )}
      {...props}
    >
      {children}

      {!hideClose && (
        <RadixDialog.Close
          className={cn(
            'absolute end-4 top-4 rounded-sm',
            'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]',
            'transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-trust)]',
            'focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-overlay)]',
            'disabled:pointer-events-none'
          )}
          aria-label="Close dialog"
        >
          <svg
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M18 6L6 18M6 6l12 12"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </RadixDialog.Close>
      )}
    </RadixDialog.Content>
  </RadixDialog.Portal>
));
DialogContent.displayName = 'DialogContent';

// ---------------------------------------------------------------------------
// Header (title + description grouping)
// ---------------------------------------------------------------------------

interface DialogHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}

export function DialogHeader({ className, children, ...props }: DialogHeaderProps) {
  return (
    <div
      className={cn('flex flex-col gap-1.5 text-start mb-4', className)}
      {...props}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Title
// ---------------------------------------------------------------------------

export const DialogTitle = React.forwardRef<
  React.ElementRef<typeof RadixDialog.Title>,
  React.ComponentPropsWithoutRef<typeof RadixDialog.Title>
>(({ className, ...props }, ref) => (
  <RadixDialog.Title
    ref={ref}
    className={cn(
      'text-base font-semibold leading-tight text-[var(--text-primary)]',
      className
    )}
    {...props}
  />
));
DialogTitle.displayName = 'DialogTitle';

// ---------------------------------------------------------------------------
// Description
// ---------------------------------------------------------------------------

export const DialogDescription = React.forwardRef<
  React.ElementRef<typeof RadixDialog.Description>,
  React.ComponentPropsWithoutRef<typeof RadixDialog.Description>
>(({ className, ...props }, ref) => (
  <RadixDialog.Description
    ref={ref}
    className={cn('text-sm text-[var(--text-secondary)]', className)}
    {...props}
  />
));
DialogDescription.displayName = 'DialogDescription';
