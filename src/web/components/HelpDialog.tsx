import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Dialog } from './ui/dialog';
import { Button } from './ui/button';

const steps = [
  { title: 'Welcome to Market Radar', text: 'This tool shows where the Swiss IT job market is heading: how many jobs are open, which skills employers ask for, and which rules may affect our programme. You do not need any technical knowledge.' },
  { title: 'Four levels, one clear picture', text: 'The header is organised in four levels, so you always know which part of the challenge a page covers. Level 1 is the job market and skills: how many jobs are open and what employers ask for. Level 2 is the weekly briefing that turns this into a short e-mail. Level 3 covers people, employers and policy: who is hiring, our target group and the rules that matter. Level 4 shows the data sources behind every number and lets you add a source. The Level 3 overview brings employers, our target group and policy together in one place.', link: { to: '/context', label: 'Open the Level 3 overview' } },
  { title: 'Start on "Job market"', text: 'The first page shows one card for each role our graduates go into. Each card has the number of open positions, how it changed, and a small trend line. Click a role name to open it, or use "Show all roles" to search and browse every role.', link: { to: '/', label: 'Go to Job market' } },
  { title: 'Look inside a role', text: 'A role page has tabs: Demand shows the trend over the months (you can choose 6, 12 or all months), Skills shows what employers ask for, and Employers shows who is hiring. Use the role buttons at the top to switch roles quickly.' },
  { title: 'Check where numbers come from', text: 'Under every number you will see a small badge with the source and the date of the last update. Click it to open the original. If a number is an estimate, the banner at the top and the source name say so.', link: { to: '/sources', label: 'See all sources' } },
  { title: 'Policy news and weekly reports', text: 'The Policy page lists changes that may affect our participants. On Reports you can choose roles and get a short summary by email every week.', link: { to: '/reports', label: 'Open Reports' } },
  { title: 'Ask a question', text: 'On the Ask page you can type a plain question about the roles we track, the skills in the postings, employers, the target group or policy news. Answers are short, use only the stored data and name their sources.', link: { to: '/ask', label: 'Go to Ask the radar' } },
];

export function HelpDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [i, setI] = useState(0);
  const step = steps[i];
  const close = () => { setI(0); onClose(); };
  return (
    <Dialog open={open} onClose={close} kicker="Guided tour" title="How to use Market Radar">
      <div className="space-y-4">
        <p className="text-sm text-ink-soft" aria-live="polite">Step {i + 1} of {steps.length}</p>
        <div className="min-h-40 space-y-3 rounded-card border border-line bg-paper p-4 sm:p-5">
          <h3 className="text-lg font-semibold tracking-tight text-ink">{step.title}</h3>
          <p className="text-[15px] leading-relaxed text-ink-soft">{step.text}</p>
          {step.link && <p><Link to={step.link.to} onClick={close} className="font-medium text-brand-accent underline decoration-brand-accent/30 underline-offset-4 hover:text-accent-deep">{step.link.label}</Link></p>}
        </div>
        <div className="flex items-center justify-between gap-3 pt-1">
          <Button variant="ghost" onClick={close}>Skip</Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setI(i - 1)} disabled={i === 0}>Back</Button>
            {i < steps.length - 1 ? <Button onClick={() => setI(i + 1)}>Next</Button> : <Button onClick={close}>Done</Button>}
          </div>
        </div>
      </div>
    </Dialog>
  );
}
