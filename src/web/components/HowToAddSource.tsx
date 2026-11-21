import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

export function HowToAddSource() {
  return (
    <Card className="bg-brand-soft">
      <CardHeader><CardTitle>How to add a new data source</CardTitle></CardHeader>
      <CardContent>
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          <li>Find a public CSV or JSON link.</li>
          <li>Ask the dev team to add it to the sources list.</li>
          <li>The data appears here after the next update.</li>
        </ol>
      </CardContent>
    </Card>
  );
}
