export function FreshnessFooter({ fetchedAt }: { fetchedAt: string }) {
  return <p className="text-sm text-slate-600">Data last updated on {new Date(fetchedAt).toLocaleDateString('en-GB')}</p>;
}
