import type { TourStep } from './types';

const QUICK_STEPS: TourStep[] = [
  {
    id: 'welcome',
    route: '/',
    title: 'A radar, not another report',
    body: 'Market Radar answers five practical questions: which roles are in demand, which skills employers ask for, who is hiring, who our participants are, and which rules are changing. This short tour shows where each answer lives. No technical knowledge needed.',
  },
  {
    id: 'levels',
    target: 'levels',
    title: 'Four levels, one clear picture',
    body: 'The header follows the four parts of the challenge: market & skills, weekly briefing, people/employers/policy, and data sources. Ask on the right is for free questions in plain language.',
  },
  {
    id: 'pulse',
    target: 'pulse',
    title: "This week's pulse",
    body: 'Four numbers with their source: the sample of IT postings, the biggest riser and faller — including how many postings sit behind the move — and whether our feeds are current.',
  },
  {
    id: 'role-filter',
    target: 'role-filter',
    title: 'Pick a role — both charts follow',
    body: 'Choose the role your graduates go into. The hiring-volume chart and the skills chart below both switch to it, so the two always tell the same story.',
    hint: 'Try it: click a role pill below to continue.',
    waitForClick: true,
  },
  {
    id: 'source',
    target: 'chart-source',
    title: 'Check where a number comes from',
    body: 'The source pill opens the publisher in a new tab. The small ⓘ next to it shows the publisher date, the day we fetched it and, where available, the dataset. That is the tour — open Ask whenever a question comes up.',
  },
];

const FULL_EXTRA: TourStep[] = [
  {
    id: 'context',
    route: '/context',
    target: 'context-cards',
    title: 'Level 3 brings employers, target group and policy together',
    body: 'Three cards answer the people side of the challenge. Each one shows the newest figures and links to the full page.',
    hint: 'Try it: open one of the cards — the tour follows you.',
    waitForClick: true,
  },
  {
    id: 'detail-page',
    target: 'detail-page',
    title: 'Every detail page keeps the same shape',
    body: 'Kicker, headline, figures, then our reading and the source. Once you know one page, you can read them all.',
  },
  {
    id: 'report',
    route: '/reports',
    target: 'report-preview',
    title: 'The weekly briefing is a real e-mail',
    body: 'The preview on the right uses exactly the text that is sent: plain language, one source line per point, and an unsubscribe link in the mail. Choose topics, preview, then subscribe.',
  },
  {
    id: 'feeds',
    route: '/sources',
    target: 'source-feeds',
    title: 'Level 4 shows where everything comes from',
    body: 'Each feed names its category, refresh rhythm, last sync, stored records and licence. “Sync now” fetches one feed and reports what happened.',
  },
  {
    id: 'wizard',
    route: '/sources',
    target: 'source-wizard',
    title: 'Add a source without a developer',
    body: 'Paste a public URL or feed, pick category and cadence, and the wizard builds the configuration block. It is validated before it is applied, so a typo cannot break the running setup.',
  },
];

export const QUICK_TOUR: TourStep[] = QUICK_STEPS;
export const FULL_TOUR: TourStep[] = [...QUICK_STEPS, ...FULL_EXTRA];
