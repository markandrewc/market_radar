import type { MarketItem } from '../../shared/types';

/**
 * Curated plain-language reading of recurring policy topics.
 *
 * A note is OUR interpretation, never a claim taken from the source: the cards
 * render it separately and label it "Our reading, not the source". Keep the
 * wording careful and non-alarmist — it is a pointer for the team, not advice.
 */
export interface PolicyNote {
  /** The literal phrase to look for in an item's title + summary. */
  keyword: string;
  /** Short human label for the note, shown next to the text. */
  label: string;
  /** Our plain-language reading. Never a fact attributed to the publisher. */
  note: string;
}

export const POLICY_WATCH: PolicyNote[] = [
  {
    keyword: 'Status S',
    label: 'Protection status S: residence and work rights',
    note:
      'Status S is temporary protection while an asylum case is open, not a settled residence permit. Working is possible under conditions set by the asylum decision and the canton, and the status can change when the case is decided — confirm the current permit before relying on it in a placement.',
  },
  {
    keyword: 'Status F',
    label: 'Status F: provisional admission and work permits',
    note:
      'Status F is a provisional admission while removal is not possible. Taking up work normally needs an explicit permit that the employer requests through the cantonal migration office, so the waiting time belongs in the placement plan — check the current decision with the canton before promising a start date.',
  },
  {
    keyword: 'Stellenmeldepflicht',
    label: 'Job-reporting duty for posted vacancies',
    note:
      'The Stellenmeldepflicht makes employers report vacancies in the occupations the rules list to the RAV before advertising them publicly. If it is extended, affected roles may appear later and through other channels; the duty sits with the employer, but it changes how soon we can see a vacancy.',
  },
  {
    keyword: 'Asyl',
    label: 'Asylum procedure changes',
    note:
      'Changes to asylum procedure law can shorten or lengthen how long someone stays in the process, and with it their access to work and integration measures. Check the amendment’s entry into force before changing a participant’s plan; this summary does not say whether it already applies.',
  },
  {
    keyword: 'Integration',
    label: 'Integration funding',
    note:
      'Integration funding usually covers language courses and placement support and is renewed per budget period. A change can shift which courses or programmes are free for participants in a canton, so confirm with the canton before promising a specific place.',
  },
  {
    keyword: 'Fachkräftemangel',
    label: 'Skills-shortage policy',
    note:
      'Debates about the Fachkräftemangel often concern admission rules and quotas for professionals from outside the EU/EFTA. If a rule changes, it can affect which permits employers are willing to pursue, but it does not change the skills employers ask for today.',
  },
];

/** Case-insensitive match of a keyword against the item's title and summary. */
export function matchesKeyword(item: MarketItem, keyword: string): boolean {
  const needle = keyword.toLowerCase();
  return `${item.title} ${item.summary}`.toLowerCase().includes(needle);
}

/** The curated note for an item, or undefined when no topic keyword matches. */
export function noteFor(item: MarketItem): PolicyNote | undefined {
  return POLICY_WATCH.find((note) => matchesKeyword(item, note.keyword));
}
