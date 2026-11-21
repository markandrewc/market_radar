import { ChevronDown } from 'lucide-react';

const items = [
  ['What does "open positions" mean?', 'The number of job postings we found for the role in that month. It is a count of postings, not of people.'],
  ['How is the change calculated?', 'We compare the first and the last month of the period you are looking at. "Up 8%" means the last month has 8% more postings than the first.'],
  ['What is the "share of postings" for a skill?', 'Out of all postings for the role, the percentage that mention the skill. A share of 60% means 6 in 10 postings ask for it.'],
  ['What does "Estimate" mean?', 'Where no exact count was available, the number is an estimate based on public reports. The source under every number says which it is.'],
  ['Where do the numbers come from?', 'Every number has a badge with the source name and the date of the last update. Click the badge to open the original.'],
];

/** Open section (h2 + quiet rules) rather than one more card: the page ends on a calm note. */
export function Glossary() {
  return (
    <section aria-labelledby="glossary-title" className="space-y-4">
      <h2 id="glossary-title" className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">Quick answers</h2>
      <div className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface shadow-card">
        {items.map(([q, a]) => (
          <details key={q} className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3.5 font-medium text-ink transition-colors hover:text-brand-accent sm:px-5">
              {q}<ChevronDown className="h-5 w-5 shrink-0 text-ink-soft transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <p className="px-4 pb-4 text-[15px] leading-relaxed text-ink-soft sm:px-5">{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
