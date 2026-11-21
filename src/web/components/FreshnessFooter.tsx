export function FreshnessFooter({ fetchedAt }: { fetchedAt: string }) {
  return (
    <p className="inline-flex flex-wrap items-center gap-2 text-xs text-ink-soft">
      <span aria-hidden className="h-1 w-1 shrink-0 rounded-full bg-brand-accent" />
      Data last updated on {new Date(fetchedAt).toLocaleDateString('en-GB')}
    </p>
  );
}
