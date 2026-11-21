import { CircleAlert, Inbox, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';
import { Skeleton } from './ui/skeleton';

/** Loading state: a warm skeleton page, announced politely. */
export const Loading = () => (
  <div role="status" aria-live="polite" className="space-y-4">
    <span className="sr-only">Loading the data…</span>
    <Skeleton className="h-8 w-1/3" />
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Skeleton className="h-44" /><Skeleton className="h-44" /><Skeleton className="h-44" />
    </div>
  </div>
);

/** Error state: one calm sentence and a retry button, on the same paper card as everything else. */
export const ErrorMsg = ({ onRetry }: { onRetry?: () => void }) => (
  <div className="space-y-3 rounded-card border border-line bg-surface p-5 shadow-card" role="alert">
    <div className="flex items-start gap-3">
      <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-brand-accent" aria-hidden />
      <p className="text-sm text-ink">Something went wrong while loading the data. Please try again in a moment.</p>
    </div>
    <Button variant="outline" size="sm" onClick={onRetry ?? (() => window.location.reload())}>
      <RefreshCw className="h-4 w-4" aria-hidden />Try again
    </Button>
  </div>
);

/** Empty state: an icon, one sentence and an optional action slot. */
export const Empty = ({ text, children }: { text: string; children?: React.ReactNode }) => (
  <div className="rounded-card border border-dashed border-line bg-surface p-6 shadow-card">
    <div className="flex items-start gap-3">
      <Inbox className="mt-0.5 h-5 w-5 shrink-0 text-brand-accent" aria-hidden />
      <div className="space-y-2">
        <p className="text-sm text-ink">{text}</p>
        {children}
      </div>
    </div>
  </div>
);
