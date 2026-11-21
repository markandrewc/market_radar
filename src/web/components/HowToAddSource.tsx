import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

export function HowToAddSource() {
  return (
    <Card className="bg-brand-soft">
      <CardHeader><CardTitle>How to add a new data source</CardTitle></CardHeader>
      <CardContent>
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          <li>Find a public CSV, JSON or RSS link (or load an official export into the volume).</li>
          <li>
            Add a six-line block to{' '}
            <a className="text-brand-accent underline" href="https://github.com/markandrewc/market_radar/blob/main/docs/ADDING_SOURCES.md" target="_blank" rel="noreferrer">
              sources.yaml
            </a>{' '}
            — name, url, category (A–E), adapter type, endpoint, refresh rate.
          </li>
          <li>
            Apply it without a code change: <code className="rounded bg-white px-1">python -m app.connectors reload</code>{' '}
            or <code className="rounded bg-white px-1">PUT /api/connectors/config</code>, then sync.
          </li>
          <li>The records appear under Items; numbers from the pipeline appear here after the next update.</li>
        </ol>
      </CardContent>
    </Card>
  );
}
