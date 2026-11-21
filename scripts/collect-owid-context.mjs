import { createHash, randomUUID } from 'node:crypto';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const chartBase = 'https://ourworldindata.org/grapher/';
const defaultCountries = 'CHE,AFG,ERI,UKR';
const defaultOutput = fileURLToPath(new URL('../.market-radar/context/', import.meta.url));
const csvName = 'owid-context.csv';
const metadataName = 'owid-context-provenance.json';
const columns = ['source', 'indicator', 'year', 'week', 'canton', 'nationality', 'iso3', 'value', 'unit', 'source_url', 'fetched_at'];
const series = [
  {
    slug: 'net-migration-metrics',
    metric: 'net_migration',
    indicator: 'net_migration',
    column: 'Annual net migration',
    unit: 'migrants',
    upstream_url: 'https://population.un.org/wpp/',
  },
  {
    slug: 'share-of-individuals-using-the-internet',
    indicator: 'internet_use_share',
    column: 'Share of the population using the Internet',
    unit: '% of population',
    upstream_url: 'https://data.worldbank.org/indicator/IT.NET.USER.ZS',
  },
];

const hash = (data) => createHash('sha256').update(data).digest('hex');

function chartUrls(item) {
  const chart = new URL(item.slug, chartBase);
  const query = new URLSearchParams({ v: '1', csvType: 'full', useColumnShortNames: 'false' });
  if (item.metric) {
    chart.searchParams.set('metric', item.metric);
    query.set('metric', item.metric);
  }
  return {
    chart_url: chart.href,
    csv_url: chartBase + item.slug + '.csv?' + query.toString(),
    metadata_url: chartBase + item.slug + '.metadata.json?' + query.toString(),
  };
}

async function download(url, contentType) {
  const response = await fetch(url, {
    headers: { Accept: contentType, 'User-Agent': 'Market Radar public data fetch/1.0' },
    redirect: 'error',
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error('HTTP ' + response.status + ' von ' + url);
  const bytes = Buffer.from(await response.arrayBuffer());
  return { bytes, fetchedAt: new Date().toISOString() };
}

function parseRows(csv, item, countries) {
  const [header, ...records] = csv.replace(/^\uFEFF/, '').split(/\r?\n/);
  if (header !== 'Entity,Code,Year,' + item.column) {
    throw new Error('Unerwartete CSV-Spalten: ' + item.slug);
  }
  const output = [];
  const keys = new Set();
  for (const line of records) {
    const row = /^(?:"((?:[^"]|"")*)"|([^,]*)),([A-Z]{3}),(\d{4}),([^,]*)$/.exec(line);
    if (!row || !countries.has(row[3]) || !row[5].trim()) continue;
    const [, quoted, plain, iso3, year, value] = row;
    const entity = quoted === undefined ? plain : quoted.replaceAll('""', '"');
    const numeric = Number(value);
    const validValue = item.unit === 'migrants' ? Number.isSafeInteger(numeric) : numeric >= 0 && numeric <= 100;
    const key = iso3 + '/' + year;
    if (!entity || !Number.isFinite(numeric) || !validValue || keys.has(key)) {
      throw new Error('Ungültiger oder doppelter Wert in ' + item.slug + ' für ' + key);
    }
    keys.add(key);
    output.push({ entity, iso3, year: Number(year), value });
  }
  if (!output.length) throw new Error('Keine Länderwerte in ' + item.slug);
  return output.sort((a, b) => a.iso3.localeCompare(b.iso3) || a.year - b.year);
}

async function collectSeries(item, countries) {
  const urls = chartUrls(item);
  const [csv, metadata] = await Promise.all([
    download(urls.csv_url, 'text/csv'),
    download(urls.metadata_url, 'application/json'),
  ]);
  const sourceMetadata = JSON.parse(metadata.bytes.toString('utf8'));
  const variable = Object.values(sourceMetadata.columns).find((entry) => entry.titleShort === item.column);
  if (variable?.unit !== item.unit || !variable?.citationLong || !variable?.lastUpdated) {
    throw new Error('OWID-Metadaten oder Einheit passen nicht zu ' + item.slug);
  }
  const observations = parseRows(csv.bytes.toString('utf8'), item, countries);
  const presentCountries = new Set(observations.map((row) => row.iso3));
  return {
    rows: observations.map(({ iso3, year, value }) => [
      'OWID', item.indicator, year, '', '', '', iso3, value, item.unit, urls.chart_url, csv.fetchedAt,
    ]),
    metadata: {
      ...urls,
      upstream_url: item.upstream_url,
      indicator: item.indicator,
      title: variable.titleLong,
      unit: variable.unit,
      original_citation: variable.citationLong,
      series_last_updated: variable.lastUpdated,
      series_timespan: variable.timespan,
      csv_fetched_at: csv.fetchedAt,
      metadata_fetched_at: metadata.fetchedAt,
      csv_sha256: hash(csv.bytes),
      metadata_sha256: hash(metadata.bytes),
      country_coverage: Array.from(countries, (iso3) => {
        const rows = observations.filter((row) => row.iso3 === iso3);
        return {
          iso3,
          country_name: rows.at(-1)?.entity ?? null,
          first_year: rows[0]?.year ?? null,
          last_year: rows.at(-1)?.year ?? null,
          count: rows.length,
        };
      }),
      missing_country_codes: [...countries].filter((code) => !presentCountries.has(code)),
      rows: observations.length,
    },
  };
}

function encodeRow(cells) {
  return cells.map((value) => {
    const text = String(value);
    return /[,"\r\n]/.test(text) ? '"' + text.replaceAll('"', '""') + '"' : text;
  }).join(',');
}

async function publish(output, csv, metadata) {
  await mkdir(output, { recursive: true });
  const temporaryId = randomUUID();
  const temporaryCsv = join(output, csvName + '.' + temporaryId + '.tmp');
  const temporaryMetadata = join(output, metadataName + '.' + temporaryId + '.tmp');
  try {
    await writeFile(temporaryCsv, csv, { flag: 'wx' });
    await writeFile(temporaryMetadata, JSON.stringify(metadata, null, 2) + '\n', { flag: 'wx' });
    await rename(temporaryCsv, join(output, csvName));
    await rename(temporaryMetadata, join(output, metadataName));
  } finally {
    await Promise.allSettled([rm(temporaryCsv, { force: true }), rm(temporaryMetadata, { force: true })]);
  }
}

async function main() {
  const { values } = parseArgs({
    options: { 'output-dir': { type: 'string' }, countries: { type: 'string' } },
  });
  const countries = new Set((values.countries ?? defaultCountries).split(',').map((code) => code.trim().toUpperCase()));
  if ([...countries].some((code) => !/^[A-Z]{3}$/.test(code))) {
    throw new Error('--countries erwartet durch Kommas getrennte ISO-3-Ländercodes.');
  }
  const output = resolve(values['output-dir'] ?? defaultOutput);
  const results = await Promise.all(series.map((item) => collectSeries(item, countries)));
  const rows = results.flatMap((result) => result.rows);
  const csv = [columns, ...rows].map(encodeRow).join('\n') + '\n';
  const metadata = {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    csv_file: csvName,
    csv_sha256: hash(csv),
    country_codes: [...countries],
    country_column: 'iso3 bezeichnet das beobachtete Land. Die Felder Woche, Kanton und Staatsangehörigkeit bleiben leer.',
    scope: 'Jahreswerte für Länder. Arbeitsmarktzugang und individuelle Fähigkeiten werden nicht gemessen.',
    attribution: 'Bei Weitergabe die ursprünglichen Datenanbieter und Our World in Data nennen und die Anbieterbedingungen beachten.',
    sources: results.map((result) => result.metadata),
  };
  await publish(output, csv, metadata);
  console.log(JSON.stringify({ rows: rows.length, csv: join(output, csvName), metadata: join(output, metadataName) }));
}

try {
  await main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
