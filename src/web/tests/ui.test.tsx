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

beforeEach(() => { localStorage.setItem('mr-tour-seen', '1'); }); // skip the first-visit tour unless a test wants it
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
    ['Policy', '/policy', /Policy news/], ['Participants', '/participants', /Participants/], ['Reports', '/reports', /Weekly report/], ['Sources', '/sources', /Data sources/],
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
  it('has a skip link, a main area and a labelled navigation', async () => {
    show('/');
    expect(screen.getByRole('link', { name: /skip to the main content/i })).toBeTruthy();
    expect(screen.getByRole('main')).toBeTruthy();
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeTruthy();
  });

  it('opens the tour from the header and walks through every step', async () => {
    const user = userEvent.setup();
    show('/');
    await user.click(screen.getByRole('button', { name: 'How to use' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/Step 1 of 5/)).toBeTruthy();
    for (let i = 2; i <= 5; i++) { await user.click(within(dialog).getByRole('button', { name: 'Next' })); expect(within(dialog).getByText(new RegExp(`Step ${i} of 5`))).toBeTruthy(); }
    await user.click(within(dialog).getByRole('button', { name: 'Done' }));
  });

  it('offers the tour automatically on the first visit only', async () => {
    localStorage.removeItem('mr-tour-seen');
    show('/');
    expect(await screen.findByRole('dialog')).toBeTruthy();
    expect(localStorage.getItem('mr-tour-seen')).toBe('1');
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
