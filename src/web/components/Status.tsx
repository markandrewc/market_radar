import { RefreshCw } from 'lucide-react';
import { Button } from './ui/button';
import { Skeleton } from './ui/skeleton';

export const Loading = () => (
  <div role="status" aria-live="polite" className="space-y-4">
    <span className="sr-only">Loading the data…</span>
    <Skeleton className="h-8 w-1/3" />
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Skeleton className="h-44" /><Skeleton className="h-44" /><Skeleton className="h-44" />
    </div>
  </div>
);

export const ErrorMsg = ({ onRetry }: { onRetry?: () => void }) => (
  <div className="space-y-3 rounded-md bg-red-50 p-4 text-red-900" role="alert">
    <p>Something went wrong while loading the data. Please try again in a moment.</p>
    <Button variant="outline" size="sm" onClick={onRetry ?? (() => window.location.reload())}>
      <RefreshCw className="h-4 w-4" aria-hidden />Try again
    </Button>
  </div>
);

export const Empty = ({ text, children }: { text: string; children?: React.ReactNode }) => (
  <div className="space-y-2 rounded-md bg-slate-50 p-4 text-slate-700"><p>{text}</p>{children}</div>
);
