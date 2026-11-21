import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

export function HowToAddSource() {
  return (
    <Card className="bg-brand-soft shadow-none">
      <CardHeader><CardTitle className="text-base font-semibold tracking-tight text-ink">How to add a new data source</CardTitle></CardHeader>
      <CardContent>
        <ol className="list-decimal space-y-1.5 pl-5 text-[15px] leading-relaxed text-ink">
          <li>Find a public CSV, JSON or RSS link (or load an official export into the volume).</li>
          <li>
            Add a six-line block to{' '}
            <a className="font-medium text-brand-accent underline decoration-brand-accent/30 underline-offset-2 hover:text-accent-deep" href="https://github.com/markandrewc/market_radar/blob/main/docs/ADDING_SOURCES.md" target="_blank" rel="noreferrer">
              sources.yaml
            </a>{' '}
            — name, url, category (A–E), adapter type, endpoint, refresh rate.
          </li>
          <li>
            Apply it without a code change: <code className="rounded border border-line bg-surface px-1 py-0.5 text-[0.9em]">python -m app.connectors reload</code>{' '}
            or <code className="rounded border border-line bg-surface px-1 py-0.5 text-[0.9em]">PUT /api/connectors/config</code>, then sync.
          </li>
          <li>The records appear under Items; numbers from the pipeline appear here after the next update.</li>
        </ol>
      </CardContent>
    </Card>
  );
}
