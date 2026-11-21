import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium leading-5', {
  variants: {
    variant: {
      default: 'border-transparent bg-ink text-paper',
      secondary: 'border-transparent bg-brand-soft text-ink',
      outline: 'border-line bg-surface text-ink-soft',
      success: 'border-transparent bg-emerald-50 text-emerald-800',
      warning: 'border-transparent bg-amber-50 text-amber-900',
    },
  },
  defaultVariants: { variant: 'default' },
});

/** Pill label. Soft variants keep dark text on a light tint, never tint-on-tint. */
export function Badge({ className, variant, dot = false, children, ...p }: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants> & { dot?: boolean }) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...p}>
      {dot && <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />}
      {children}
    </span>
  );
}
