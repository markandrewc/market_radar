import { cn } from '@/lib/utils';

export const Skeleton = ({ className }: { className?: string }) => (
  <div aria-hidden className={cn('rounded-md bg-slate-200 motion-safe:animate-pulse', className)} />
);
