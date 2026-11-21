import { ExternalLink } from 'lucide-react';
import type { SourceRef } from '../../shared/types';

export function SourceBadge({ source }: { source: SourceRef }) {
  const date = new Date(source.fetchedAt).toLocaleDateString('en-GB');
  return (
    <a href={source.url} target="_blank" rel="noreferrer"
      className="inline-flex max-w-full items-center gap-1 rounded-md border border-slate-300 px-2 py-0.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
      aria-label={`Source: ${source.name}, updated ${date}. Opens in a new tab.`}>
      <span className="truncate">Source: {source.name} · {date}</span>
      <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
    </a>
  );
}
