import { ChevronDown } from 'lucide-react';

const items = [
  ['What does "open positions" mean?', 'The number of job postings we found for the role in that month. It is a count of postings, not of people.'],
  ['How is the change calculated?', 'We compare the first and the last month of the period you are looking at. "Up 8%" means the last month has 8% more postings than the first.'],
  ['What is the "share of postings" for a skill?', 'Out of all postings for the role, the percentage that mention the skill. A share of 60% means 6 in 10 postings ask for it.'],
  ['What does "Estimate" mean?', 'Where no exact count was available, the number is an estimate based on public reports. The source under every number says which it is.'],
  ['Where do the numbers come from?', 'Every number has a badge with the source name and the date of the last update. Click the badge to open the original.'],
];

export function Glossary() {
  return (
    <section aria-labelledby="glossary-title" className="space-y-3">
      <h2 id="glossary-title" className="text-xl font-semibold text-brand">Quick answers</h2>
      <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
        {items.map(([q, a]) => (
          <details key={q} className="group p-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-brand">
              {q}<ChevronDown className="h-5 w-5 shrink-0 transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <p className="pt-2 text-slate-700">{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
