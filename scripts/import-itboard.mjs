import { randomUUID } from 'node:crypto';
import { readFile, rename, rm, writeFile } from 'node:fs/promises';

const source = {
  name: 'ITBoard.ch',
  url: 'https://www.itboard.ch/arbeitsmarkt/daten.csv',
  report_index_url: 'https://www.itboard.ch/arbeitsmarkt',
  licence: 'CC BY 4.0',
  scope: 'Monatsstichproben der im ITBoard-Bericht gezählten Schweizer IT-Inserate. Die Rollen und das Erfahrungsniveau stammen aus der Klassifizierung von ITBoard.',
};

const roles = [
  { id: 'it-support', label: 'IT-Support' },
  { id: 'fullstack-developer', label: 'Fullstack-Webentwicklung' },
  { id: 'data-engineer', label: 'Data Engineering' },
  { id: 'software-engineer', label: 'Software Engineer / Developer' },
  { id: 'data-analyst', label: 'Data Analyst' },
];

const skillIds = new Map([
  ['Python', 'python'],
  ['Security', 'security'],
  ['Docker', 'docker'],
]);

const monthSlugs = [
  'januar', 'februar', 'maerz', 'april', 'mai', 'juni',
  'juli', 'august', 'september', 'oktober', 'november', 'dezember',
];

export function parseCsv(csv) {
  const input = csv.replace(/^\uFEFF/, '');
  const records = [];
  let record = [];
  let value = '';
  let state = 'start';

  function finishField() {
    record.push(value);
    value = '';
    state = 'start';
  }

  function finishRecord() {
    finishField();
    if (record.length !== 1 || record[0] !== '') records.push(record);
    record = [];
  }

  for (let offset = 0; offset < input.length; offset += 1) {
    const character = input[offset];
    if (state === 'quoted') {
      if (character !== '"') value += character;
      else if (input[offset + 1] === '"') {
        value += '"';
        offset += 1;
      } else state = 'closedQuote';
      continue;
    }
    if (character === ',') finishField();
    else if (character === '\n' || character === '\r') {
      finishRecord();
      if (character === '\r' && input[offset + 1] === '\n') offset += 1;
    } else if (state === 'start' && character === '"') state = 'quoted';
    else if (state === 'closedQuote' || character === '"') {
      throw new Error(`Unexpected character in CSV record ${records.length + 1}`);
    } else {
      value += character;
      state = 'unquoted';
    }
  }
  if (state === 'quoted') throw new Error('Unterminated quoted CSV field');
  if (record.length || state !== 'start') finishRecord();
  return records;
}

function count(text, identifier) {
  const value = Number(text);
  if (!/^\d+$/.test(text) || !Number.isSafeInteger(value)) {
    throw new Error(`Invalid count for ${identifier}`);
  }
  return value;
}

export function buildDataset(csv, { fetchedAt = null, reportDates = new Map() } = {}) {
  const [header, ...records] = parseCsv(csv);
  if (header?.join(',') !== 'monat,kennzahl,auspraegung,anzahl,basis') {
    throw new Error('Unexpected ITBoard CSV headers');
  }

  const roleIds = new Set(roles.map(({ id }) => id));
  const rows = [];
  const totals = [];
  const junior = [];
  const skillTrends = [];
  const seen = new Set();
  for (const record of records) {
    const [month, metric, dimension, rawValue, rawBase] = record;
    if (record.length !== header.length || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      throw new Error(`Invalid ITBoard CSV record for ${month}`);
    }
    const identifier = `${month}/${metric}/${dimension}`;
    if (seen.has(identifier)) throw new Error(`Duplicate ITBoard observation: ${identifier}`);
    seen.add(identifier);

    let destination;
    let subject;
    if (metric === 'rolle' && roleIds.has(dimension)) {
      destination = rows;
      subject = { role_id: dimension };
    } else if (metric === 'inserate' && dimension === 'gezaehlt') {
      destination = totals;
      subject = { role_id: 'all-itboard' };
    } else if (metric === 'erfahrung' && dimension === 'junior') {
      destination = junior;
      subject = { role_id: 'junior-itboard' };
    } else if (metric === 'technologie' && skillIds.has(dimension)) {
      destination = skillTrends;
      subject = { skill_id: skillIds.get(dimension) };
    } else continue;

    const value = count(rawValue, identifier);
    const base = rawBase === '' ? null : count(rawBase, identifier);
    if (base !== null && value > base) throw new Error(`Count exceeds base for ${identifier}`);
    destination.push({
      ...subject,
      month,
      value,
      base,
      unit: 'postings',
      source_url: source.url,
      data_cutoff: null,
      cutoff_source_url: null,
    });
  }

  if (!roles.every(({ id }) => rows.some(({ role_id }) => role_id === id))) {
    throw new Error('ITBoard CSV is missing a selected role');
  }
  for (const observations of [rows, totals, junior]) {
    observations.sort((a, b) => a.month.localeCompare(b.month) || a.role_id.localeCompare(b.role_id));
  }
  skillTrends.sort((a, b) => a.month.localeCompare(b.month) || a.skill_id.localeCompare(b.skill_id));
  const dataset = {
    source: { ...source, fetched_at: fetchedAt },
    fetched_at: fetchedAt,
    roles,
    rows,
    totals,
    junior,
    skill_trends: skillTrends,
  };
  return addReportDates(dataset, reportDates);
}

export { buildDataset as normalize };

function allObservations({ rows, totals, junior, skill_trends }) {
  return [...rows, ...totals, ...junior, ...skill_trends];
}

function addReportDates(dataset, reportDates) {
  for (const row of allObservations(dataset)) {
    const report = reportDates.get(row.month);
    if (report) {
      row.data_cutoff = report.date;
      row.cutoff_source_url = report.url;
    }
  }
  return dataset;
}

function publishedCutoff(html, month) {
  const visibleText = html
    .replace(/<(head|script|style)\b[^>]*>[\s\S]*?<\/\1\s*>|<!--[\s\S]*?-->/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|&#160;|&#xA0;/gi, ' ');
  const matchingDates = new Set();
  for (const [, day, monthNumber, year] of visibleText.matchAll(/\bStand\s*:\s*(\d{1,2})\.(\d{1,2})\.(\d{4})\b/gi)) {
    const prefix = `${year}-${monthNumber.padStart(2, '0')}`;
    if (prefix !== month) continue;
    const date = `${prefix}-${day.padStart(2, '0')}`;
    const parsed = new Date(`${date}T00:00:00.000Z`);
    if (!Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(`${date}T`)) {
      matchingDates.add(date);
    }
  }
  return matchingDates.size === 1 ? matchingDates.values().next().value : null;
}

async function fetchReportDate(month, fetchImpl) {
  const [year, monthNumber] = month.split('-');
  const url = `${source.report_index_url}/${monthSlugs[Number(monthNumber) - 1]}-${year}`;
  try {
    const response = await fetchImpl(url, {
      signal: AbortSignal.timeout(4_000),
      cache: 'no-store',
      redirect: 'error',
    });
    if (!response.ok) return null;
    const date = publishedCutoff(await response.text(), month);
    return date ? [month, { date, url }] : null;
  } catch {
    return null;
  }
}

export async function fetchItboard({ fetchImpl = fetch } = {}) {
  const response = await fetchImpl(source.url, {
    signal: AbortSignal.timeout(15_000),
    cache: 'no-store',
    redirect: 'error',
  });
  if (!response.ok) throw new Error(`ITBoard CSV returned HTTP ${response.status}`);
  const csv = await response.text();
  const dataset = buildDataset(csv, { fetchedAt: new Date().toISOString() });
  const months = [...new Set(allObservations(dataset).map(({ month }) => month))];
  const reportDates = new Map();
  const concurrentReports = 6;
  for (let offset = 0; offset < months.length; offset += concurrentReports) {
    const reports = await Promise.all(months.slice(offset, offset + concurrentReports).map((month) => fetchReportDate(month, fetchImpl)));
    for (const report of reports) {
      if (report) reportDates.set(...report);
    }
  }
  return addReportDates(dataset, reportDates);
}

export async function writeItboard(dataset) {
  const directory = new URL('../src/web/data/', import.meta.url);
  const output = new URL('itboard.json', directory);
  const temporary = new URL(`.itboard-${randomUUID()}.json.tmp`, directory);
  try {
    await writeFile(temporary, `${JSON.stringify(dataset, null, 2)}\n`, { flag: 'wx' });
    await rename(temporary, output);
  } finally {
    await rm(temporary, { force: true }).catch(() => {});
  }
}

if (import.meta.main) {
  try {
    const path = process.argv[2];
    const data = path ? buildDataset(await readFile(path, 'utf8')) : await fetchItboard();
    await writeItboard(data);
    console.log(`ITBoard: ${data.rows.length} role, ${data.totals.length} total, ${data.junior.length} junior, ${data.skill_trends.length} skill observations.`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
