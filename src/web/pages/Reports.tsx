import { useState } from 'react';
import { useDemand, useSubscribe } from '../api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PreviewPanel } from '@/components/PreviewPanel';
import { DemoNotice } from '@/components/DemoNotice';
import { Loading } from '@/components/Status';

export default function Reports() {
  const roles = useDemand();
  const subscribe = useSubscribe();
  const [email, setEmail] = useState('');
  const [selected, setSelected] = useState<string[]>([]);

  if (roles.isLoading || !roles.data) return <Loading />;
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const names = roles.data.filter((d) => selected.includes(d.role.id)).map((d) => d.role.name);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold text-brand">Weekly report</h2>
      <DemoNotice what="The subscription" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Get the report by email</CardTitle>
            <CardDescription>Choose the roles you care about</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={(e) => { e.preventDefault(); subscribe.mutate({ email, roleIds: selected }); }}
            >
              <input
                type="email" required placeholder="you@example.com" value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              {roles.data.map((d) => (
                <label key={d.role.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={selected.includes(d.role.id)} onChange={() => toggle(d.role.id)} />
                  {d.role.name}
                </label>
              ))}
              <button
                type="submit" disabled={!selected.length || subscribe.isPending}
                className="rounded-md bg-brand-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                Subscribe
              </button>
              {subscribe.isSuccess && <p className="text-sm text-emerald-700">Thank you! You are subscribed.</p>}
            </form>
          </CardContent>
        </Card>
        <PreviewPanel roleNames={names} />
      </div>
    </div>
  );
}
