import * as React from 'react';
import { type VariantProps, cva } from 'class-variance-authority';
import { cn } from '../lib/utils';

const inputVariants = cva(
  'flex w-full rounded-md border bg-[var(--surface-raised)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-trust)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-base)] disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      inputSize: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-10 px-4 text-sm',
        lg: 'h-12 px-4 text-base',
      },
      state: {
        default: 'border-[var(--border-default)] hover:border-[var(--border-emphasis)]',
        error:
          'border-[var(--signal-danger)] focus-visible:ring-[var(--signal-danger)] hover:border-[var(--signal-danger)]',
      },
    },
    defaultVariants: { inputSize: 'md', state: 'default' },
  }
);

interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'>,
    VariantProps<typeof inputVariants> {
  /** Render an error message below the input */
  errorMessage?: string;
  /** Label rendered above the input for accessibility */
  label?: string;
}

export function Input({
  inputSize,
  state,
  errorMessage,
  label,
  id,
  className,
  ...props
}: InputProps) {
  const inputId = id ?? (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
  const errorId = errorMessage && inputId ? `${inputId}-error` : undefined;
  const resolvedState = errorMessage ? 'error' : state;

  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="text-sm font-medium text-[var(--text-primary)] leading-none"
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={cn(inputVariants({ inputSize, state: resolvedState }), className)}
        aria-invalid={errorMessage ? true : undefined}
        aria-describedby={errorId}
        {...props}
      />
      {errorMessage && (
        <p
          id={errorId}
          className="text-xs text-[var(--signal-danger)] flex items-center gap-1"
          role="alert"
        >
          <svg
            className="h-3.5 w-3.5 shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
            <path
              d="M12 8v4M12 16h.01"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          {errorMessage}
        </p>
      )}
    </div>
  );
}
