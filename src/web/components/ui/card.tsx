import * as React from 'react';
import { cn } from '@/lib/utils';

export function Card({ className, ...p }: React.ComponentProps<'div'>) {
  return <div className={cn('rounded-xl border border-slate-200 bg-white text-slate-900 shadow-sm', className)} {...p} />;
}
export function CardHeader({ className, ...p }: React.ComponentProps<'div'>) {
  return <div className={cn('flex flex-col gap-1.5 p-5 pb-2', className)} {...p} />;
}
export function CardTitle({ className, ...p }: React.ComponentProps<'h3'>) {
  return <h3 className={cn('text-sm font-medium text-slate-500', className)} {...p} />;
}
export function CardDescription({ className, ...p }: React.ComponentProps<'p'>) {
  return <p className={cn('text-xs text-slate-500', className)} {...p} />;
}
export function CardContent({ className, ...p }: React.ComponentProps<'div'>) {
  return <div className={cn('p-5 pt-2', className)} {...p} />;
}
export function CardFooter({ className, ...p }: React.ComponentProps<'div'>) {
  return <div className={cn('flex items-center p-5 pt-0', className)} {...p} />;
}
