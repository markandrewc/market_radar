import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';

export function PreviewPanel({ roleNames }: { roleNames: string[] }) {
  return (
    <Card className="bg-brand-soft">
      <CardHeader>
        <CardTitle>Preview of your weekly email</CardTitle>
        <CardDescription>This is what you will receive every Monday</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p className="font-semibold text-brand">Market Radar: your weekly update</p>
        {roleNames.length === 0 ? <p className="text-slate-500">Select at least one role.</p> : (
          <ul className="list-disc pl-5">
            {roleNames.map((n) => <li key={n}>{n}: demand and top skills this week</li>)}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
