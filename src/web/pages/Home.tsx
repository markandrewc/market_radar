import { useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import MarketSources from '@/components/MarketSources';
import MarketWalkthrough from '@/components/MarketWalkthrough';
import { radar, skillsByRole } from '@/data/market-radar';

const periods = [...radar.totals].sort((a, b) => a.month.localeCompare(b.month));
const [previous, latest] = periods.slice(-2);
const junior = radar.junior.find((row) => row.month === latest.month);
const totalsByMonth = new Map(periods.map((row) => [row.month, row]));
const latestMonth = new Date(latest.month + '-01T00:00:00Z');
const historyMonths = Array.from({ length: 11 }, (_, index) =>
  new Date(Date.UTC(latestMonth.getUTCFullYear(), latestMonth.getUTCMonth() - 10 + index, 1)).toISOString().slice(0, 7));
const number = new Intl.NumberFormat('en-CH');
const percent = new Intl.NumberFormat('en-CH', { style: 'percent', maximumFractionDigits: 1 });
const signed = new Intl.NumberFormat('en-CH', { maximumFractionDigits: 1, signDisplay: 'exceptZero' });
const monthFormat = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const shortFormat = new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'UTC' });
const dateFormat = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
const monthDate = (month: string) => new Date(month + '-01T00:00:00Z');
const formatMonth = (month: string) => monthFormat.format(monthDate(month));
const formatDate = (date: string) => dateFormat.format(new Date(date.slice(0, 10) + 'T00:00:00Z'));
const count = (value: number | null | undefined) => value == null ? '—' : number.format(value);
const sourceClass = 'font-medium text-teal-800 underline underline-offset-4 hover:text-teal-950';

const roleDescriptions: Record<string, { job: string; example: string }> = {
  'it-support': {
    job: 'Helps people use their computers and get back to work when something breaks.',
    example: 'For example, they investigate why a colleague cannot sign in, document the fix and ask a specialist for help if needed.',
  },
  'fullstack-developer': {
    job: 'Builds both the part of a website people use and the parts that store and deliver information.',
    example: 'For example, they build an application form, save the answers and show the user that the form was received.',
  },
  'data-engineer': {
    job: 'Collects and organises data so that other people can use it to answer questions.',
    example: 'For example, they combine files from two sources, check for missing values and prepare a reliable table for a report.',
  },
};

const trendSkills = [
  { id: 'python', label: 'Python' },
  { id: 'security', label: 'Security' },
  { id: 'docker', label: 'Docker' },
];

const skillDescriptions: Record<string, string> = {
  ICT: 'The computer systems and networks people use to work.',
  'Microsoft 365': 'Tools for email, documents and teamwork.',
  'Active Directory': 'Manages who can sign in and what they can access.',
  'Windows 11': 'The operating system on many workplace computers.',
  Java: 'A programming language often used to build the services behind an application.',
  React: 'A tool for building the parts of a website that people see and use.',
  Docker: 'Packages an application so it can run in the same way on different computers.',
  Angular: 'A framework for building the parts of a website that people interact with.',
  Python: 'A programming language used to automate work and process data.',
  'ML / AI': 'Tools that learn patterns from data to help make predictions or suggestions.',
  Snowflake: 'A cloud platform used to store and analyse large collections of data.',
  Kafka: 'Passes a stream of updates between software systems.',
  SQL: 'A language for finding and organising information in a database.',
};

function ReportLink({ url, className = sourceClass }: { url?: string | null; className?: string }) {
  return (
    <a className={className} href={url ?? radar.source.url} target="_blank" rel="noopener noreferrer">
      {url ? 'ITBoard monthly report' : 'ITBoard CSV'}
    </a>
  );
}

export default function Home() {
  const [roleId, setRoleId] = useState(radar.roles[0].id);
  const role = radar.roles.find((item) => item.id === roleId) ?? radar.roles[0];
  const skills = skillsByRole[role.id];
  const roleRows = radar.rows.filter((row) => row.role_id === role.id);
  const roleByMonth = new Map(roleRows.map((row) => [row.month, row]));
  const current = roleByMonth.get(latest.month);
  const chart = historyMonths.map((month) => ({
    month,
    period: shortFormat.format(monthDate(month)),
    value: roleByMonth.get(month)?.value ?? null,
  }));

  return (
    <div className="space-y-6">
      <section className="rounded-xl bg-slate-900 px-5 py-7 text-white sm:px-8" aria-labelledby="overview-title">
        <h1 id="overview-title" className="text-3xl font-semibold tracking-tight sm:text-4xl">Market Radar for Powercoders</h1>
        <p className="mt-2 max-w-2xl text-slate-300">
          Compare Swiss IT job demand, see which skills appear in listings, and choose a practical topic for the next course.
        </p>
      </section>

      <MarketWalkthrough />

      <MarketSources
        latestReportUrl={latest.cutoff_source_url}
        latestMonthLabel={formatMonth(latest.month)}
        cutoffLabel={latest.data_cutoff ? formatDate(latest.data_cutoff) : null}
        csvCheckedLabel={radar.fetched_at ? formatDate(radar.fetched_at) : null}
        skillProfileUrl={skills.source}
        skillRoleLabel={role.label}
        skillReadLabel={formatDate(skills.read_on)}
      />

      <section className="grid gap-4 sm:grid-cols-3" aria-label="ITBoard monthly samples">
        {[previous, latest].map((row) => (
          <Card key={row.month}>
            <CardHeader>
              <CardTitle>{formatMonth(row.month)}</CardTitle>
              <CardDescription>Swiss ITBoard sample</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              <p className="text-3xl font-semibold tabular-nums">{count(row.value)}</p>
              <p className="text-sm text-slate-600">Listings counted · {row.data_cutoff ? formatDate(row.data_cutoff) : 'cutoff not published'}</p>
              <ReportLink url={row.cutoff_source_url} />
            </CardContent>
          </Card>
        ))}
        <Card>
          <CardHeader>
            <CardTitle>Open to junior applicants</CardTitle>
            <CardDescription>{formatMonth(latest.month)} · Swiss ITBoard sample</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            <p className="text-3xl font-semibold tabular-nums">{junior?.base && junior.base > 0 ? percent.format(junior.value / junior.base) : '—'}</p>
            <p className="text-sm text-slate-600">
              {junior ? count(junior.value) + ' of ' + count(junior.base) + ' listings' : 'No count available'}
              {junior?.data_cutoff && ' · ' + formatDate(junior.data_cutoff)}
            </p>
            <ReportLink url={junior?.cutoff_source_url} />
          </CardContent>
        </Card>
      </section>

      <section id="roles" aria-labelledby="roles-heading" className="scroll-mt-5 space-y-3">
        <h2 id="roles-heading" className="text-xl font-semibold tracking-tight">Explore the roles</h2>
        <div role="group" aria-labelledby="roles-heading" className="flex flex-wrap gap-2">
          {radar.roles.map((item) => (
            <button key={item.id} type="button" aria-pressed={role.id === item.id} onClick={() => setRoleId(item.id)}
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:border-teal-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 aria-pressed:border-teal-800 aria-pressed:bg-teal-800 aria-pressed:text-white">
              {item.label}
            </button>
          ))}
        </div>
        <div className="rounded-lg border border-teal-200 bg-teal-50 p-4" aria-live="polite">
          <p className="text-sm font-semibold text-teal-950">What does someone in {role.label} do?</p>
          <p className="mt-1 text-sm">{roleDescriptions[role.id]?.job}</p>
          <p className="mt-1 text-sm text-slate-700">{roleDescriptions[role.id]?.example}</p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="min-w-0">
            <CardHeader>
              <CardTitle><span aria-live="polite">{role.label} · Monthly demand</span></CardTitle>
              <CardDescription>
                {current ? count(current.value) + ' of ' + count(current.base) + ' ITBoard listings in ' + formatMonth(current.month) : 'No published figure for this role in ' + formatMonth(latest.month)}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="h-56 min-w-0" aria-hidden="true">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chart} margin={{ top: 8, right: 10, left: 0, bottom: 1 }}>
                    <CartesianGrid vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="period" tickLine={false} axisLine={false} fontSize={11} minTickGap={8} />
                    <YAxis tickLine={false} axisLine={false} allowDecimals={false} domain={[0, 'auto']} fontSize={11} width={32} />
                    <Tooltip labelFormatter={(_, payload) => payload[0]?.payload?.month ? formatMonth(payload[0].payload.month) : ''} />
                    <Line type="linear" dataKey="value" name="Listings" stroke="#0f766e" strokeWidth={2} dot={{ r: 2 }} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="text-sm text-slate-600">Gaps mean the source did not publish a figure for that role and month.</p>
              <details className="rounded-lg border border-slate-200 p-3">
                <summary className="cursor-pointer text-sm font-semibold text-teal-800">View monthly figures and sources</summary>
                <Table className="mt-2">
                  <TableHeader><TableRow><TableHead>Month</TableHead><TableHead>Role / sample</TableHead><TableHead>Cutoff and source</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {historyMonths.map((month) => {
                      const row = roleByMonth.get(month);
                      const evidence = row ?? totalsByMonth.get(month);
                      return (
                        <TableRow key={month}>
                          <TableCell className="whitespace-normal">{formatMonth(month)}</TableCell>
                          <TableCell className="whitespace-normal">{count(row?.value)} / {count(row?.base ?? evidence?.value)}</TableCell>
                          <TableCell className="whitespace-normal">
                            <a href={evidence?.cutoff_source_url ?? radar.source.url} target="_blank" rel="noopener noreferrer" className={sourceClass}>
                              {evidence?.data_cutoff ? formatDate(evidence.data_cutoff) : 'ITBoard CSV'}
                            </a>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </details>
            </CardContent>
          </Card>

          <Card className="min-w-0">
            <CardHeader>
              <CardTitle>Skills mentioned in listings</CardTitle>
              <CardDescription>{count(skills.base)} listings in the {role.label} profile · read {formatDate(skills.read_on)}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-3">
                {skills.skills.map(([label, value]) => (
                  <li key={label}>
                    <div className="mb-1 flex justify-between gap-3 text-sm">
                      <span className="font-medium">{label}</span>
                      <span className="shrink-0 text-slate-600 tabular-nums">{count(value)} of {count(skills.base)}</span>
                    </div>
                    <div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-teal-50">
                      <div className="h-full rounded-full bg-teal-600" style={{ width: (100 * value / skills.base) + '%' }} />
                    </div>
                    {skillDescriptions[label] && <p className="mt-1 text-xs text-slate-600">{skillDescriptions[label]}</p>}
                  </li>
                ))}
              </ul>
              <p className="text-sm text-slate-600">This profile is a snapshot of mentions. One listing can mention several skills.</p>
              <a className={sourceClass} href={skills.source} target="_blank" rel="noopener noreferrer">Open the ITBoard role profile</a>
              <div className="space-y-2 rounded-lg border border-teal-200 bg-teal-50 p-3">
                <h3 className="text-sm font-semibold text-teal-900">Suggested exercise · {skills.course.title}</h3>
                <p className="text-sm">{skills.course.practice}</p>
                <p className="text-sm text-slate-700">{skills.course.check}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section id="skill-trends" className="scroll-mt-5" aria-labelledby="skill-trends-heading">
        <Card>
          <CardHeader>
            <CardTitle><span id="skill-trends-heading">How skill mentions changed</span></CardTitle>
            <CardDescription>Compare the share of all ITBoard listings mentioning each skill across the two most recent monthly samples.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Skill</TableHead>
                <TableHead className="whitespace-normal">{formatMonth(previous.month)}</TableHead>
                <TableHead className="whitespace-normal">{formatMonth(latest.month)}</TableHead>
                <TableHead className="whitespace-normal">Change</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {trendSkills.map(({ id, label }) => {
                  const before = radar.skill_trends.find((row) => row.skill_id === id && row.month === previous.month);
                  const after = radar.skill_trends.find((row) => row.skill_id === id && row.month === latest.month);
                  const beforeShare = before?.base ? before.value / before.base : null;
                  const afterShare = after?.base ? after.value / after.base : null;
                  const change = beforeShare !== null && afterShare !== null ? 100 * (afterShare - beforeShare) : null;
                  return (
                    <TableRow key={id}>
                      <TableCell className="font-medium">{label}</TableCell>
                      <TableCell className="whitespace-normal">{beforeShare === null ? '—' : <>{percent.format(beforeShare)}<br /><span className="text-xs text-slate-600">{count(before?.value)} of {count(before?.base)}</span></>}</TableCell>
                      <TableCell className="whitespace-normal">{afterShare === null ? '—' : <>{percent.format(afterShare)}<br /><span className="text-xs text-slate-600">{count(after?.value)} of {count(after?.base)}</span></>}</TableCell>
                      <TableCell className="whitespace-normal">{change === null ? '—' : signed.format(change) + ' pp'}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <p className="text-sm text-slate-600">pp means percentage points. This comparison uses the full portal samples. The role profiles above show skills on one date.</p>
            <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {[previous, latest].map((row) => (
                <a key={row.month} className={sourceClass} href={row.cutoff_source_url ?? radar.source.url} target="_blank" rel="noopener noreferrer">
                  ITBoard · {formatMonth(row.month)}{row.data_cutoff && ' · ' + formatDate(row.data_cutoff)}
                </a>
              ))}
            </p>
          </CardContent>
        </Card>
      </section>

      <section id="policy" className="scroll-mt-5" aria-labelledby="policy-heading">
        <Card>
          <CardHeader>
            <CardTitle><span id="policy-heading">Changes to working in Switzerland</span></CardTitle>
            <CardDescription>Official updates that can affect a placement. Each entry gives the date and its status so staff can see what applies now.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            <article className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-semibold text-amber-900">Proposal · <time dateTime="2026-11-06">06 Nov 2026</time></p>
              <h3 className="mt-1 font-semibold">Moving to another canton for work</h3>
              <p className="mt-1 text-sm">A parliamentary committee backed a proposal that would let some people with protection status S move cantons for work. It is awaiting a decision in the Council of States. Use the current rules when planning a placement.</p>
              <p className="mt-2 text-sm"><a className={sourceClass} href="https://www.parlament.ch/press-releases/Pages/mm-spk-s-2026-11-06.aspx?lang=1031" target="_blank" rel="noopener noreferrer">Swiss Parliament · committee update</a></p>
            </article>
            <article className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs font-semibold text-teal-800">Official guidance · <time dateTime="2026-10-21">21 Oct 2026</time></p>
              <h3 className="mt-1 font-semibold">Check what an employer needs to do</h3>
              <p className="mt-1 text-sm">Switzerland’s State Secretariat for Migration explains which permits require a notification and which require cantonal authorisation. Check the person’s permit and contact the relevant canton when the situation is unclear.</p>
              <p className="mt-2 text-sm"><a className={sourceClass} href="https://www.sem.admin.ch/de/arbeit-asylbereich" target="_blank" rel="noopener noreferrer">SEM guidance and cantonal contacts</a></p>
            </article>
            <article className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs font-semibold text-teal-800">Rule in force · <time dateTime="2025-12-01">01 Dec 2025</time></p>
              <h3 className="mt-1 font-semibold">Work notification for protection status S</h3>
              <p className="mt-1 text-sm">For people with protection status S, the employer generally notifies the authorities before the person starts work. The Federal Council changed the previous authorisation procedure. The SEM guidance explains the process and exceptions.</p>
              <p className="mt-2 text-sm">
                <a className={sourceClass} href="https://www.efd.admin.ch/de/newnsb/O1q31tESAJVk" target="_blank" rel="noopener noreferrer">Federal Council decision</a>
                {' · '}<a className={sourceClass} href="https://www.fedlex.admin.ch/eli/oc/2025/669/de" target="_blank" rel="noopener noreferrer">Fedlex ordinance</a>
              </p>
            </article>
          </CardContent>
        </Card>
      </section>

      <section id="context" className="grid scroll-mt-5 gap-4 lg:grid-cols-2" aria-label="Swiss context and practical next step">
        <Card>
          <CardHeader><CardTitle>From training to an internship</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>Powercoders reports more than 370 internships since 2017. Of those participants, 250 went on to a job or an apprenticeship.</p>
            <p><a className={sourceClass} href="https://powercoders.org/companies/" target="_blank" rel="noopener noreferrer">Powercoders’ figures and employer programme</a></p>
            <p><a className={sourceClass} href="https://powercoders.org/programs/bootcamp/" target="_blank" rel="noopener noreferrer">Bootcamp and internship pathway</a></p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Swiss labour market context</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>The UZH and Adecco shortage index fell in 2025 for ICT and computing occupations.</p>
            <p><a className={sourceClass} href="https://www.stellenmarktmonitor.uzh.ch/de/indices/fachkraeftemangel.html" target="_blank" rel="noopener noreferrer">UZH and Adecco index</a></p>
            <p>BSS projects a remaining training need of 54,400 ICT workers by 2033 after expected graduates and immigration.</p>
            <p><a className={sourceClass} href="https://www.ict-berufsbildung.ch/resources/BSS-Schlussbericht-ICT-Bildungsbedarf-2033-2025-09_09.pdf" target="_blank" rel="noopener noreferrer">BSS report</a></p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
