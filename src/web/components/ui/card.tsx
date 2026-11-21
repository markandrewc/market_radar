import * as React from 'react';
import { cn } from '@/lib/utils';

export function Card({ className, ...p }: React.ComponentProps<'div'>) {
  return <div className={cn('rounded-xl border border-slate-200 bg-white text-slate-900 shadow-sm', className)} {...p} />;
}
export function CardHeader({ className, ...p }: React.ComponentProps<'div'>) {
  return <div className={cn('flex flex-col gap-1.5 p-5 pb-2', className)} {...p} />;
}
/** Renders an h2 by default so the heading order stays correct; pass `as="h3"` inside a section that has its own h2. */
export function CardTitle({ className, as: Tag = 'h2', ...p }: React.ComponentProps<'h2'> & { as?: 'h2' | 'h3' }) {
  return <Tag className={cn('text-sm font-medium text-slate-600', className)} {...p} />;
}
export function CardDescription({ className, ...p }: React.ComponentProps<'p'>) {
  return <p className={cn('text-sm text-slate-600', className)} {...p} />;
}
export function CardContent({ className, ...p }: React.ComponentProps<'div'>) {
  return <div className={cn('p-5 pt-2', className)} {...p} />;
}
export function CardFooter({ className, ...p }: React.ComponentProps<'div'>) {
  return <div className={cn('flex items-center p-5 pt-0', className)} {...p} />;
}
