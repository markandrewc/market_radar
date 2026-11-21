import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const button = cva(
  'inline-flex items-center justify-center gap-2 rounded-control text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-brand-accent px-4 py-2 text-white shadow-card hover:bg-accent-deep',
        outline: 'border border-line bg-surface px-4 py-2 text-ink hover:bg-paper',
        ghost: 'px-3 py-2 text-ink-soft hover:bg-brand-soft hover:text-ink',
      },
      size: { md: 'min-h-10', sm: 'min-h-9 px-3 py-1.5' },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export function Button({ className, variant, size, type = 'button', ...p }: React.ComponentProps<'button'> & VariantProps<typeof button>) {
  return <button type={type} className={cn(button({ variant, size }), className)} {...p} />;
}
