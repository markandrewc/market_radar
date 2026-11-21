import { cn } from '@/lib/utils';

/** Warm placeholder block used by loading states and inline panels. */
export const Skeleton = ({ className }: { className?: string }) => (
  <div aria-hidden className={cn('rounded-md bg-line/60 motion-safe:animate-pulse', className)} />
);
