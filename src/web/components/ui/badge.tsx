import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva('inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium', {
  variants: {
    variant: {
      default: 'border-transparent bg-slate-900 text-white',
      secondary: 'border-transparent bg-slate-100 text-slate-700',
      outline: 'border-slate-200 text-slate-600',
      success: 'border-transparent bg-emerald-50 text-emerald-700',
      warning: 'border-transparent bg-amber-50 text-amber-800',
    },
  },
  defaultVariants: { variant: 'default' },
});

export function Badge({ className, variant, ...p }: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...p} />;
}
