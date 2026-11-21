import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const button = cva(
  'inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-brand-accent px-4 py-2 text-white hover:bg-[#8f2943]',
        outline: 'border border-slate-300 bg-white px-4 py-2 text-brand hover:bg-slate-50',
        ghost: 'px-3 py-2 text-brand hover:bg-slate-100',
      },
      size: { md: 'min-h-10', sm: 'min-h-9 px-3 py-1.5' },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export function Button({ className, variant, size, type = 'button', ...p }: React.ComponentProps<'button'> & VariantProps<typeof button>) {
  return <button type={type} className={cn(button({ variant, size }), className)} {...p} />;
}
