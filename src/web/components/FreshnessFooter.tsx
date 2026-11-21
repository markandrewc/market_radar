export function FreshnessFooter({ fetchedAt }: { fetchedAt: string }) {
  return <p className="text-xs text-slate-500">Data last updated {new Date(fetchedAt).toLocaleString('en-GB')}</p>;
}
