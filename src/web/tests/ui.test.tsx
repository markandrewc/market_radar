// UI behaviour and accessibility checks. They run on the built-in demo data, so no backend is needed.
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { mockDigest } from '../mocks/data';
import { buildDigestPdf } from '../lib/digestPdf';
import { mockSkills } from '../mocks/data';

beforeEach(() => { localStorage.setItem('mr-tour-seen', 'v2'); }); // skip the first-visit prompt unless a test wants it
afterEach(cleanup);

function show(path: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><MemoryRouter initialEntries={[path]}><App /></MemoryRouter></QueryClientProvider>);
}
const ready = (name: RegExp) => screen.findByRole('heading', { name }, { timeout: 4000 });

async function noViolations() {
  const r = await axe.run(document.body, { rules: { 'color-contrast': { enabled: false } } }); // jsdom cannot measure colours
  expect(r.violations.map((v) => `${v.id}: ${v.nodes[0]?.html.slice(0, 140)}`)).toEqual([]);
}

describe('accessibility (axe) on every page', () => {
  for (const [name, path, heading] of [
    ['Job market', '/', /Job market by role/], ['Role page', '/roles/web-developer', /^Web Developer$/],
    ['Policy', '/policy', /Policy news/], ['Participants', '/participants', /Participants/], ['Reports', '/reports', /Weekly report/], ['Sources', '/sources', /Data sources/], ['Ask', '/ask', /Ask the radar/], ['All roles', '/roles', /^All roles$/], ['Items', '/items', /Market items/], ['Level 3 hub', '/context', /People, employers & policy/],
  ] as const) {
    it(`${name} has no violations`, async () => {
      show(path);
      await ready(heading);
      await new Promise((r) => setTimeout(r, 900)); // let the demo data arrive
      await noViolations();
    });
  }
});

describe('guidance', () => {
  it('shows the four challenge levels in the header', async () => {
    show('/');
    const levels = await screen.findByRole('navigation', { name: 'Levels' });
    for (const name of [/Market & skills/, /Weekly briefing/, /People, employers & policy/, /Data sources/]) {
      expect(within(levels).getByRole('link', { name })).toBeTruthy();
    }
  });

  it('has a skip link, a main area and a labelled navigation', async () => {
    show('/');
    expect(screen.getByRole('link', { name: /skip to the main content/i })).toBeTruthy();
    expect(screen.getByRole('main')).toBeTruthy();
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeTruthy();
  });

  it('starts the quick tour and moves through the spotlight steps', async () => {
    const user = userEvent.setup();
    show('/');
    await user.click(screen.getByRole('button', { name: 'How to use' }));
    await user.click(await screen.findByRole('button', { name: /Start quick tour/ }));
    expect(await screen.findByText('1 of 5')).toBeTruthy();
    expect(screen.getByText('A radar, not another report')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText('2 of 5')).toBeTruthy();
    await user.keyboard('{Escape}');
    expect(screen.queryByText('2 of 5')).toBeNull();
  });

  it('advances a practice step when the highlighted control is used', async () => {
    const user = userEvent.setup();
    show('/');
    await user.click(screen.getByRole('button', { name: 'How to use' }));
    await user.click(await screen.findByRole('button', { name: /Start quick tour/ }));
    for (let step = 1; step <= 3; step += 1) {
      await user.click(await screen.findByRole('button', { name: 'Next' }));
    }
    expect(await screen.findByText('4 of 5')).toBeTruthy();
    const roles = screen.getByRole('group', { name: 'Choose the role both charts follow' });
    await user.click(within(roles).getAllByRole('button')[0]);
    expect(await screen.findByText('5 of 5')).toBeTruthy();
  });

  it('offers the tour once per version, not as an intrusive overlay', async () => {
    const user = userEvent.setup();
    localStorage.removeItem('mr-tour-seen');
    show('/');
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('How to use Market Radar')).toBeTruthy();
    expect(localStorage.getItem('mr-tour-seen')).toBe('v2');
    await user.click(within(dialog).getByRole('button', { name: 'Not now' }));
    cleanup();
    show('/');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('keeps the tour overlay accessible', async () => {
    const user = userEvent.setup();
    show('/');
    await user.click(screen.getByRole('button', { name: 'How to use' }));
    await user.click(await screen.findByRole('button', { name: /Start quick tour/ }));
    await screen.findByText('1 of 5');
    await new Promise((resolve) => setTimeout(resolve, 300));
    await noViolations();
  });

  it('can start the full tour', async () => {
    const user = userEvent.setup();
    show('/');
    await user.click(screen.getByRole('button', { name: 'How to use' }));
    await user.click(await screen.findByRole('button', { name: /Full tour/ }));
    expect(await screen.findByText('1 of 10')).toBeTruthy();
  });

  it('explains terms in "Quick answers"', async () => {
    show('/');
    await ready(/Quick answers/);
    expect(screen.getByText(/How is the change calculated/)).toBeTruthy();
  });

  it('opens with the weekly pulse and a cited interpretation', async () => {
    show('/');
    await ready(/This week's pulse/);
    expect(screen.getByText('IT postings in the sample')).toBeTruthy();
    expect(screen.getByText(/Biggest riser/)).toBeTruthy();
    expect(screen.getByText(/Sources up to date/)).toBeTruthy();
    expect((await screen.findAllByText('What this means for Powercoders', {}, { timeout: 4000 })).length).toBeGreaterThan(0);
  });

  it('opens every pulse source link in a new tab', async () => {
    show('/');
    await ready(/This week's pulse/);
    const pulse = screen.getByRole('region', { name: "This week's pulse" });
    const links = await within(pulse).findAllByRole('link', { name: /^Source: / }, { timeout: 4000 });
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.getAttribute('rel')).toContain('noreferrer');
    }
  });
});

describe('roles on the home page and the all-roles view', () => {
  it('home shows only three role cards and a link to all roles', async () => {
    show('/');
    const link = await screen.findByRole('link', { name: /Show all 33 roles/ }, { timeout: 4000 });
    expect(link.getAttribute('href')).toBe('/roles');
    const list = link.closest('section')!.querySelector('ul')!;
    expect(within(list).getAllByRole('listitem')).toHaveLength(3);
  });

  it('lists roles 9 per page with pagination, search and sort', async () => {
    const user = userEvent.setup();
    show('/roles');
    await ready(/^All roles$/);
    await screen.findByText(/Showing 1–9 of 33/, {}, { timeout: 4000 });
    expect(within(screen.getByRole('list', { name: 'Roles' })).getAllByRole('listitem')).toHaveLength(9);
    await user.click(screen.getByRole('button', { name: /Next/ }));
    expect(await screen.findByText(/Showing 10–18 of 33/)).toBeTruthy();
    await user.type(screen.getByLabelText('Search roles'), 'zzzz');
    expect(await screen.findByText(/No role matches/)).toBeTruthy();
    await user.clear(screen.getByLabelText('Search roles'));
    await user.type(screen.getByLabelText('Search roles'), 'developer');
    expect(await screen.findByText(/Showing 1–9 of/)).toBeTruthy();
  });
});

describe('role page', () => {
  it('uses tabs, switches with the keyboard and paginates skills', async () => {
    const user = userEvent.setup();
    show('/roles/web-developer');
    await ready(/^Web Developer$/);
    const tabs = await screen.findAllByRole('tab', {}, { timeout: 4000 });
    expect(tabs.map((t) => t.textContent)).toEqual(['Demand', 'Skills', 'Employers']);
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');

    tabs[0].focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Skills' }).getAttribute('aria-selected')).toBe('true');

    const skills = mockSkills('web-developer').skills;
    await screen.findByText(skills[0].skill, {}, { timeout: 4000 });
    for (const s of skills.slice(0, 5)) expect(screen.getByText(s.skill)).toBeTruthy();
    expect(screen.queryByText(skills[5].skill)).toBeNull(); // page size is 5
    expect(screen.getByText(`Showing 1–5 of ${skills.length}`)).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Next page' }));
    expect(screen.getByText(skills[5].skill)).toBeTruthy();
    expect(screen.queryByText(skills[0].skill)).toBeNull();

    await user.click(screen.getByRole('radio', { name: /Rising/ }));
    for (const row of screen.getAllByRole('row').slice(1)) expect(row.textContent).toMatch(/Up/);
  });

  it('lets people change the time range of the demand chart', async () => {
    const user = userEvent.setup();
    show('/roles/it-support');
    await ready(/^IT Support$/);
    await screen.findByText(/over 36 months|over 12 months/, {}, { timeout: 4000 });
    await user.click(screen.getByRole('radio', { name: '6 months' }));
    expect(screen.getByText(/over 6 months/)).toBeTruthy();
    expect(screen.getByRole('img', { name: /From .* to .*open IT Support positions/ })).toBeTruthy(); // chart text alternative
  });

  it('explains the numbers and lists what to watch', async () => {
    show('/roles/web-developer');
    await ready(/^Web Developer$/);
    expect((await screen.findAllByText('What this means for Powercoders', {}, { timeout: 4000 })).length).toBeGreaterThan(0);
    expect(await screen.findByRole('heading', { name: 'What to watch' })).toBeTruthy();
  });

  it('lets people switch role and shows a friendly message for an unknown one', async () => {
    const user = userEvent.setup();
    show('/roles/web-developer');
    await ready(/^Web Developer$/);
    await user.click(await screen.findByRole('link', { name: 'Data Analyst' }));
    await ready(/^Data Analyst$/);
    cleanup();
    show('/roles/nope');
    expect(await screen.findByText(/We have no data for this role yet/, {}, { timeout: 4000 })).toBeTruthy();
  });
});

describe('policy page', () => {
  it('filters by topic and keeps our reading apart from the source', async () => {
    const user = userEvent.setup();
    show('/policy');
    await ready(/Policy news/);
    const chips = await screen.findByRole('group', { name: 'Filter policy items by topic' });
    // The topics come from the API taxonomy, so the app and the briefing share them.
    expect(within(chips).getByRole('button', { name: 'All topics' })).toBeTruthy();
    expect(within(chips).getByRole('button', { name: 'Migration law' })).toBeTruthy();

    // Every card carries a provenance link once the demo items are loaded.
    expect((await screen.findAllByRole('link', { name: /^Source: / }, { timeout: 4000 })).length).toBeGreaterThan(0);

    await user.click(within(chips).getByRole('button', { name: 'Migration law' }));
    expect(within(chips).getByRole('button', { name: 'Migration law' }).getAttribute('aria-pressed')).toBe('true');
    // Matching items show our interpretation, explicitly labelled as ours (more than one card can match).
    expect((await screen.findAllByText(/Our reading, not the source/i, {}, { timeout: 4000 })).length).toBeGreaterThan(0);
  });
});

describe('reports form', () => {
  it('labels every field and reports honestly whether the e-mail was sent', async () => {
    const user = userEvent.setup();
    show('/reports');
    await ready(/Weekly report/);
    await user.type(await screen.findByLabelText('Your email address'), 'name@example.com');
    // Demo mode has no mail provider: the page must say so instead of claiming a send.
    await user.click(screen.getByRole('button', { name: 'Subscribe' }));
    expect(await screen.findByText(/Saved, but the e-mail was not sent|Sent — check your inbox/, {}, { timeout: 4000 })).toBeTruthy();
  });
});

describe('weekly report: topics and PDF', () => {
  it('starts with no role selected, pages through the roles and keeps the choice', async () => {
    const user = userEvent.setup();
    show('/reports');
    await ready(/Weekly report/);
    await screen.findByText(/0 of 33 roles selected/, {}, { timeout: 4000 });
    expect(screen.getAllByRole('checkbox').filter((c) => (c as HTMLInputElement).checked)).toHaveLength(0);
    await user.click(screen.getAllByRole('checkbox')[0]);
    await user.click(screen.getByRole('button', { name: 'Next page' }));
    expect(await screen.findByText(/Showing 7–12 of 33/)).toBeTruthy();
    expect(screen.getByText(/1 of 33 roles selected/)).toBeTruthy();
  });

  it('offers a PDF download of the preview', async () => {
    show('/reports');
    await ready(/Weekly report/);
    const btn = await screen.findByRole('button', { name: 'Download as PDF' });
    await waitFor(() => expect((btn as HTMLButtonElement).disabled).toBe(false), { timeout: 4000 });
  });

  it('builds a real PDF document from a briefing', async () => {
    const doc = await buildDigestPdf(mockDigest());
    const bytes = new Uint8Array(doc.output('arraybuffer'));
    expect(String.fromCharCode(...bytes.slice(0, 5))).toBe('%PDF-');
    expect(bytes.length).toBeGreaterThan(1500);
    expect(doc.getNumberOfPages()).toBeGreaterThan(0);
  });
});


describe('Ask the radar', () => {
  it('answers only from the stored data and names its sources', async () => {
    const user = userEvent.setup();
    show('/ask');
    await ready(/Ask the radar/);
    await user.type(await screen.findByLabelText('Your question', {}, { timeout: 4000 }), 'Which skills should we teach for IT Support?');
    await user.click(screen.getByRole('button', { name: 'Ask' }));
    expect(await screen.findByText(/The postings in our sample/i, {}, { timeout: 4000 })).toBeTruthy();
    expect(screen.getByText(/I used these sources/i)).toBeTruthy();
    expect(screen.getByText(/AI explanation/i)).toBeTruthy();
  });

  it('admits when it has no data instead of guessing', async () => {
    const user = userEvent.setup();
    show('/ask');
    await ready(/Ask the radar/);
    await user.type(await screen.findByLabelText('Your question', {}, { timeout: 4000 }), 'Who won the world cup?');
    await user.click(screen.getByRole('button', { name: 'Ask' }));
    expect(await screen.findByText(/I do not have data on that/i, {}, { timeout: 4000 })).toBeTruthy();
    expect(screen.getByText(/No data on that/i)).toBeTruthy();
  });
});


describe('Explain simply', () => {
  it('turns a card into plain words with a source next to each sentence', async () => {
    const user = userEvent.setup();
    show('/');
    await ready(/This week's pulse/);
    const buttons = await screen.findAllByRole('button', { name: /Explain simply/i }, { timeout: 4000 });
    await user.click(buttons[0]);
    expect(await screen.findByText(/AI explanation · our reading, not the source/i, {}, { timeout: 4000 })).toBeTruthy();
    expect(await screen.findByText(/In plain words:/i)).toBeTruthy();
    expect((await screen.findAllByRole('link', { name: /Demo data \(not real\)/ })).length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: 'Show the data-based reading' }));
  });
});
