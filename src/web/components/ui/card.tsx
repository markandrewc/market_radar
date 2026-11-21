import * as React from 'react';
import { cn } from '@/lib/utils';

/** The one card surface: white paper, warm hairline, one soft shadow. `interactive` adds the hover lift. */
export function Card({ className, interactive = false, ...p }: React.ComponentProps<'div'> & { interactive?: boolean }) {
  return <div className={cn('rounded-card border border-line bg-surface text-ink shadow-card', interactive && 'card-lift', className)} {...p} />;
}
export function CardHeader({ className, ...p }: React.ComponentProps<'div'>) {
  return <div className={cn('flex flex-col gap-1.5 p-5 pb-3', className)} {...p} />;
}
/** Renders an h2 by default so the heading order stays correct; pass `as="h3"` inside a section that has its own h2. */
export function CardTitle({ className, as: Tag = 'h2', ...p }: React.ComponentProps<'h2'> & { as?: 'h2' | 'h3' }) {
  return <Tag className={cn('text-base font-semibold tracking-tight text-ink sm:text-lg', className)} {...p} />;
}
export function CardDescription({ className, ...p }: React.ComponentProps<'p'>) {
  return <p className={cn('text-sm text-ink-soft', className)} {...p} />;
}
export function CardContent({ className, ...p }: React.ComponentProps<'div'>) {
  return <div className={cn('p-5 pt-2', className)} {...p} />;
}
export function CardFooter({ className, ...p }: React.ComponentProps<'div'>) {
  return <div className={cn('flex items-center gap-3 p-5 pt-0', className)} {...p} />;
}
