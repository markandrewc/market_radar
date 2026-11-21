import { useState } from 'react';
import { Mail } from 'lucide-react';
import { useDemand, useSubscribe } from '../api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/PageHeader';
import { PreviewPanel } from '@/components/PreviewPanel';
import { ErrorMsg, Loading } from '@/components/Status';

export default function Reports() {
  const roles = useDemand();
  const subscribe = useSubscribe();
  const [email, setEmail] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [touched, setTouched] = useState(false);

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const names = roles.data?.filter((d) => selected.includes(d.role.id)).map((d) => d.role.name) ?? [];
  const noRole = touched && selected.length === 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Weekly report" description="Pick the roles you care about and get a short summary by email every week, in plain language, with links to the sources." />
      {roles.isLoading && <Loading />}
      {roles.error && <ErrorMsg onRetry={() => roles.refetch()} />}
      {roles.data && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Get the report by email</CardTitle>
              <CardDescription>All fields are required. You can unsubscribe at any time with the link in every email. We only store your email address and your choices.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-5" noValidate={false}
                onSubmit={(e) => { e.preventDefault(); setTouched(true); if (selected.length) subscribe.mutate({ email, roleIds: selected }); }}>
                <div className="space-y-1.5">
                  <label htmlFor="email" className="block text-sm font-medium text-brand">Your email address</label>
                  <input id="email" type="email" required autoComplete="email" placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-md border border-slate-400 px-3 py-2 text-base" />
                </div>
                <fieldset className="space-y-2" aria-describedby={noRole ? 'role-error' : undefined}>
                  <legend className="text-sm font-medium text-brand">Roles you want to follow</legend>
                  {roles.data.map((d) => (
                    <label key={d.role.id} className="flex min-h-10 items-center gap-3 text-base">
                      <input type="checkbox" className="h-5 w-5 accent-[#a8324e]" checked={selected.includes(d.role.id)} onChange={() => toggle(d.role.id)} />
                      {d.role.name}
                    </label>
                  ))}
                  {noRole && <p id="role-error" role="alert" className="text-sm text-red-800">Please choose at least one role.</p>}
                </fieldset>
                <Button type="submit" disabled={subscribe.isPending}><Mail className="h-4 w-4" aria-hidden />{subscribe.isPending ? 'Subscribing…' : 'Subscribe'}</Button>
                <div aria-live="polite" role="status">
                  {subscribe.isError && <p className="text-sm text-red-800">{subscribe.error.message}</p>}
                  {subscribe.isSuccess && <p className="text-sm text-emerald-800">{subscribe.data?.emailSent ? 'Thank you! Check your inbox for a welcome email.' : 'Thank you! You are subscribed. (Email sending is not set up yet, so no welcome email was sent.)'}</p>}
                </div>
              </form>
            </CardContent>
          </Card>
          <PreviewPanel roleNames={names} />
        </div>
      )}
    </div>
  );
}
