'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'success';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-indigo-600 text-white hover:bg-indigo-700',
  secondary: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
  danger: 'bg-red-600 text-white hover:bg-red-700',
  success: 'bg-green-600 text-white hover:bg-green-700',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Shows a spinner and disables the button while truthy. */
  loading?: boolean;
  variant?: Variant;
  children: ReactNode;
}

/**
 * Shared button with a built-in loading state: pass `loading` while an async
 * action is in flight and it shows a spinner, blocks repeat clicks, and keeps
 * its label so the layout doesn't jump.
 */
export function Button({
  loading = false,
  variant = 'primary',
  disabled,
  children,
  className = '',
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading}
      className={
        'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold ' +
        'transition-colors disabled:cursor-not-allowed disabled:opacity-50 ' +
        VARIANTS[variant] +
        (className ? ' ' + className : '')
      }
      {...rest}
    >
      {loading && (
        <span
          className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden="true"
        />
      )}
      {children}
    </button>
  );
}
