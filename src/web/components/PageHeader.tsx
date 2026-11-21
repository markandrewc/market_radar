import { usePageTitle } from '../hooks';

export function PageHeader({ title, description }: { title: string; description?: string }) {
  usePageTitle(title);
  return (
    <header className="space-y-1">
      <h1 className="text-3xl font-semibold text-brand">{title}</h1>
      {description && <p className="max-w-3xl text-slate-600">{description}</p>}
    </header>
  );
}
