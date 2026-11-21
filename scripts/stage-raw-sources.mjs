import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const localDir = fileURLToPath(new URL('../.market-radar/raw/', import.meta.url));
const xlsx = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const maxBytes = 8 * 1024 * 1024;
const bfsAlias = 'https://www.bfs.admin.ch/asset/de/je-d-06.02.00.02.01';
const semAsylum = 'https://www.sem.admin.ch/de/asylstatistik';
const semResidents = 'https://www.sem.admin.ch/de/auslaenderstatistik';
const itboardReport = 'https://www.itboard.ch/arbeitsmarkt';
const months = ['januar', 'februar', 'maerz', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'dezember'];

const sources = [
  {
    id: 'itboard-monthly', name: 'ITBoard · IT-Arbeitsmarkt Schweiz', publisher: 'ITBoard.ch', extension: 'csv',
    discovery_url: itboardReport, licence: 'CC BY 4.0',
    licence_url: 'https://creativecommons.org/licenses/by/4.0/',
    scope: 'Monatliche Kennzahlen der ITBoard-Stelleninserate.',
  },
  {
    id: 'bfs-besta-regions', name: 'BFS · Offene Stellen nach Branche und Grossregion (BESTA)',
    publisher: 'Bundesamt für Statistik', extension: 'xlsx',
    discovery_url: bfsAlias, licence: 'OPEN-BY',
    licence_url: 'https://www.bfs.admin.ch/de/nutzungsbedingungen',
    scope: 'BESTA-Quartalswerte zu offenen Stellen nach Wirtschaftsabteilung und Grossregion.',
    // Provenance on opendata.swiss (checked 2026-11-21: same BESTA publication, quarterly since 1997).
    dataset_url: 'https://opendata.swiss/de/dataset/offene-stellen-nach-grossregion7',
    dataset_modified: '2026-11-20',
  },
  // The SEM monthly tables are published on sem.admin.ch only: no matching opendata.swiss entry exists
  // (checked 2026-11-21), so `report_url` stays the provenance and `dataset_url` is absent.
  {
    id: 'sem-asylum-applications', name: 'SEM · Asylgesuche (Tabelle 7-21)',
    publisher: 'Staatssekretariat für Migration', extension: 'xlsx',
    discovery_url: semAsylum, table: '7-21',
    scope: 'Monatstabelle 7-21 zu Primär- und Sekundärgesuchen im Asylbereich.',
  },
  {
    id: 'sem-provisional-employment', name: 'SEM · Vorläufig Aufgenommene mit Erwerb (Tabelle 6-22)',
    publisher: 'Staatssekretariat für Migration', extension: 'xlsx',
    discovery_url: semAsylum, table: '6-22',
    scope: 'Monatstabelle 6-22 zum Bestand vorläufig aufgenommener Personen mit Erwerb (Ausweis F).',
  },
  {
    id: 'sem-status-s-monthly', name: 'SEM · Schutzstatus S (Tabelle 7-70)',
    publisher: 'Staatssekretariat für Migration', extension: 'xlsx',
    discovery_url: semAsylum, table: '7-70',
    scope: 'Monatstabelle 7-70 zu Gesuchen, Erledigungen und Beendigungen von Schutzstatus S.',
  },
  {
    id: 'sem-immigration-canton-nationality', name: 'SEM · Einwanderung nach Kanton und Staatsangehörigkeit (Tabelle 3-25)',
    publisher: 'Staatssekretariat für Migration', extension: 'xlsx',
    discovery_url: semResidents, table: '3-25',
    scope: 'Monatstabelle 3-25 zur Einwanderung der ständigen und nichtständigen ausländischen Wohnbevölkerung nach Kanton und Staatsangehörigkeit.',
  },
];

const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const assetName = (source, hash) => `${source.id}-${hash}.${source.extension}`;

function allowedUrl(url) {
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.search || url.hash) return false;
  const { hostname, pathname } = url;
  if (hostname === 'www.itboard.ch') return pathname === '/arbeitsmarkt/daten.csv' || pathname === '/arbeitsmarkt';
  if (hostname === 'www.bfs.admin.ch') return url.href === bfsAlias;
  if (hostname === 'statistik.admin.ch') {
    return /^\/de\/asset\/\d+$/.test(pathname) ||
      pathname === '/de/redirect/asset/de/je-d-06.02.00.02.01' || pathname === '/de/asset/je-d-06.02.00.02.01';
  }
  if (hostname === 'dam-api.bfs.admin.ch') return /^\/hub\/api\/dam\/assets\/\d+\/master$/.test(pathname);
  if (hostname !== 'www.sem.admin.ch') return false;
  return /^\/de\/(?:asylstatistik|auslaenderstatistik)(?:-[a-z]+-\d{4})?$/.test(pathname) ||
    /^\/dam\/de\/sd-web\/[a-z0-9_-]+\/(?:7-21|6-22|7-70|3-25)-[a-z0-9-]+\.xlsx$/i.test(pathname);
}

async function fetchBytes(input, contentType, fetchImpl) {
  let url = new URL(input);
  const signal = AbortSignal.timeout(18_000);
  for (let redirects = 0; redirects <= 4; redirects += 1) {
    if (!allowedUrl(url)) throw new Error('URL ausserhalb der bestätigten Amts- und Datenquellen');
    const response = await fetchImpl(url.href, { cache: 'no-store', redirect: 'manual', signal });
    const location = response.headers.get('location');
    if ([301, 302, 303, 307, 308].includes(response.status) && location) {
      await response.body?.cancel();
      url = new URL(location, url);
      continue;
    }
    if (response.status !== 200 || !response.body) {
      await response.body?.cancel();
      throw new Error(`HTTP ${response.status} · ${url.href}`);
    }
    const mediaType = response.headers.get('content-type');
    const advertisedBytes = Number(response.headers.get('content-length'));
    if (mediaType?.split(';', 1)[0].trim().toLowerCase() !== contentType || advertisedBytes > maxBytes) {
      await response.body.cancel();
      throw new Error(`Unerwarteter Inhaltstyp oder Dateigrösse · ${url.href}`);
    }
    const chunks = [];
    let length = 0;
    const reader = response.body.getReader();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > maxBytes) {
          await reader.cancel();
          throw new Error('Datei überschreitet die Abrufgrenze');
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    return { url: url.href, bytes: Buffer.concat(chunks, length), contentType: mediaType, fetchedAt: new Date().toISOString() };
  }
  throw new Error('Zu viele Weiterleitungen auf der Quellseite');
}

const plain = (html) => html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>|<!--[\s\S]*?-->/gi, ' ')
  .replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;|&#xA0;/gi, ' ').replace(/\s+/g, ' ').trim();

function anchors(html, base) {
  return [...html.matchAll(/<a\b[^>]*?\bhref\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a\s*>/gi)]
    .flatMap(([, href, label]) => {
      try {
        return [{ url: new URL(href.replaceAll('&amp;', '&'), base), label: plain(label) }];
      } catch {
        return [];
      }
    });
}

function isoDate(day, month, year) {
  const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const date = new Date(`${iso}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().startsWith(`${iso}T`) ? iso : null;
}

function germanDate(text, marker = '') {
  const match = new RegExp(`${marker}(\\d{1,2})\\.\\s*([a-zä]+)\\s+(\\d{4})`, 'i').exec(text);
  if (!match) return null;
  const month = months.indexOf(match[2].toLowerCase().replace('ä', 'ae')) + 1;
  return month ? isoDate(match[1], month, match[3]) : null;
}

async function discoverBfs(fetchImpl) {
  const page = await fetchBytes(bfsAlias, 'text/html', fetchImpl);
  const version = /^https:\/\/statistik\.admin\.ch\/de\/asset\/(\d+)$/.exec(page.url)?.[1];
  const html = page.bytes.toString('utf8');
  const text = plain(html);
  const file = anchors(html, page.url).find(({ url, label }) =>
    version && allowedUrl(url) && url.pathname === `/hub/api/dam/assets/${version}/master` && /\bXLSX\b/i.test(label));
  if (!file || !text.includes('je-d-06.02.00.02.01')) throw new Error('BFS verlinkt kein bestätigtes BESTA-Arbeitsbuch');
  const reportDate = /Veröffentlicht am\s*:\s*(\d{1,2})\.(\d{1,2})\.(\d{4})/i.exec(text);
  const end = /Dargestellter Zeitraum\s*\d{1,2}\.\d{1,2}\.\d{4}\s*[-–]\s*(\d{1,2})\.(\d{1,2})\.(\d{4})/i.exec(text);
  const periodEnd = end ? isoDate(end[1], end[2], end[3]) : null;
  if (!periodEnd || !reportDate) throw new Error('Zeitraum oder Ausgabedatum des BFS nicht lesbar');
  return {
    source_url: file.url.href, report_url: page.url,
    report_date: isoDate(reportDate[1], reportDate[2], reportDate[3]),
    report_date_basis: 'Publikationsdatum der BFS-Tabelle.',
    period: `${periodEnd.slice(0, 4)}-Q${Math.ceil(Number(periodEnd.slice(5, 7)) / 3)}`,
    period_end: periodEnd,
  };
}

// The report page states the cutoff of the latest edition ("Stand: 15.11.2026"). If it cannot be read, the CSV is
// still staged, just without a publisher date.
async function discoverItboard(fetchImpl) {
  const base = { source_url: `${itboardReport}/daten.csv`, report_url: itboardReport, report_date: null, period_end: null,
    report_date_basis: 'Stichtag der neuesten Ausgabe laut ITBoard-Berichtsseite ("Stand").' };
  try {
    const page = await fetchBytes(itboardReport, 'text/html', fetchImpl);
    const stand = /Stand:\s*(\d{1,2})\.(\d{1,2})\.(\d{4})/.exec(plain(page.bytes.toString('utf8')));
    return { ...base, report_date: stand ? isoDate(stand[1], stand[2], stand[3]) : null };
  } catch {
    return base;
  }
}

async function discoverSem(indexUrl, fetchImpl) {
  const index = await fetchBytes(indexUrl, 'text/html', fetchImpl);
  const prefix = new URL(indexUrl).pathname;
  const editions = [];
  for (const { url } of anchors(index.bytes.toString('utf8'), index.url)) {
    if (!allowedUrl(url) || !url.pathname.startsWith(`${prefix}-`)) continue;
    const [, slug, year] = /^([a-z]+)-(\d{4})$/.exec(url.pathname.slice(prefix.length + 1)) ?? [];
    const month = months.indexOf(slug) + 1;
    if (month) editions.push({ url, year, month, period: `${year}-${String(month).padStart(2, '0')}` });
  }
  const latest = editions.sort((a, b) => b.period.localeCompare(a.period))[0];
  if (!latest) throw new Error('Kein verlinkter SEM-Monatsbericht gefunden');
  const page = await fetchBytes(latest.url.href, 'text/html', fetchImpl);
  const html = page.bytes.toString('utf8');
  return {
    period: latest.period, period_end: new Date(Date.UTC(Number(latest.year), latest.month, 0)).toISOString().slice(0, 10),
    report_url: page.url, report_date: germanDate(plain(html), 'Veröffentlicht am\\s*:?[ ]*'),
    report_date_basis: 'Publikationsdatum der SEM-Monatsseite.',
    links: anchors(html, page.url),
  };
}

function semDownload(source, edition) {
  const { links, ...report } = edition;
  const candidates = links.filter(({ url }) => {
    if (!allowedUrl(url)) return false;
    const name = url.pathname.split('/').at(-1);
    return name.startsWith(`${source.table}-`) && name.endsWith(`-${report.period}-d.xlsx`) &&
      (source.table === '6-22' || name.endsWith(`-m-${report.period}-d.xlsx`));
  });
  const distinct = new Map(candidates.map(({ url, label }) => [url.href, label]));
  if (distinct.size !== 1) throw new Error(`Monats-XLSX ${source.table} nicht eindeutig verlinkt · ${report.report_url}`);
  const [[sourceUrl, label]] = distinct;
  return { ...report, source_url: sourceUrl, linked_file_date: germanDate(label) };
}

function validate(source, bytes) {
  if (source.extension === 'csv') {
    const text = bytes.toString('utf8').replace(/^\uFEFF/, '');
    const header = text.split(/\r?\n/, 1)[0];
    const period = [...text.matchAll(/^(\d{4}-(?:0[1-9]|1[0-2])),/gm)].map((match) => match[1]).sort().at(-1);
    if (header !== 'monat,kennzahl,auspraegung,anzahl,basis' || !period) throw new Error('Unerwarteter ITBoard-CSV-Aufbau');
    return { period };
  }
  if (bytes.length < 4 || bytes.readUInt32LE() !== 0x04034b50 ||
    !bytes.includes('xl/workbook.xml') || !bytes.includes('[Content_Types].xml')) {
    throw new Error('Unerwarteter XLSX-Aufbau');
  }
  return {};
}

async function atomicWrite(file, content) {
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, content, { flag: 'wx' });
    await rename(temporary, file);
  } finally {
    await rm(temporary, { force: true }).catch(() => {});
  }
}

async function loadPrevious(outputDir) {
  try {
    const data = JSON.parse(await readFile(join(outputDir, 'latest.json'), 'utf8'));
    if (data.schema_version !== 1 || !Array.isArray(data.sources)) throw new Error('Unbekanntes Rohdatenmanifest');
    return new Map(data.sources.map((source) => [source.id, source]));
  } catch (error) {
    if (error.code === 'ENOENT') return new Map();
    throw error;
  }
}

async function canKeep(outputDir, source, previous) {
  if (!previous || !/^[a-f0-9]{64}$/.test(previous.sha256 ?? '') ||
    previous.relative_path !== assetName(source, previous.sha256)) return false;
  const file = join(outputDir, previous.relative_path);
  try {
    const info = await stat(file);
    return info.isFile() && info.size === previous.bytes && info.size <= maxBytes &&
      digest(await readFile(file)) === previous.sha256;
  } catch {
    return false;
  }
}

async function stageSource(source, previous, outputDir, discover, fetchImpl) {
  const { extension, ...metadata } = source;
  const attempt = { licence: null, licence_url: null, ...metadata, last_attempt_at: new Date().toISOString() };
  let report;
  try {
    report = await discover(source);
    const received = await fetchBytes(report.source_url, extension === 'csv' ? 'text/csv' : xlsx, fetchImpl);
    const observation = validate(source, received.bytes);
    const period = observation.period ?? report.period;
    if ((previous?.period && period < previous.period) ||
      (previous?.period_end && report.period_end && report.period_end < previous.period_end)) {
      throw new Error('Die Quelle liefert eine ältere Ausgabe');
    }
    const hash = digest(received.bytes);
    const relativePath = assetName(source, hash);
    const unchanged = previous?.sha256 === hash && await canKeep(outputDir, source, previous);
    if (!unchanged) await atomicWrite(join(outputDir, relativePath), received.bytes);
    return {
      ...attempt, ...report, ...observation, source_url: received.url,
      status: unchanged ? 'unchanged' : 'downloaded', relative_path: relativePath,
      sha256: hash, bytes: received.bytes.byteLength, content_type: received.contentType, fetched_at: received.fetchedAt,
      first_staged_at: unchanged ? previous.first_staged_at : received.fetchedAt, error: null,
    };
  } catch (error) {
    if (await canKeep(outputDir, source, previous)) {
      return { ...previous, ...attempt, status: 'retained', error: error.message };
    }
    return { ...attempt, ...report, status: 'unavailable', relative_path: null, sha256: null,
      bytes: null, content_type: null, fetched_at: null, first_staged_at: null, error: error.message };
  }
}

export async function stageRawSources({ outputDir = process.env.MARKET_RADAR_RAW_DIR || localDir, fetchImpl = fetch } = {}) {
  await mkdir(outputDir, { recursive: true });
  const previous = await loadPrevious(outputDir);
  const resolutions = new Map();
  function discover(source) {
    if (source.id === 'itboard-monthly') return discoverItboard(fetchImpl);
    if (source.id === 'bfs-besta-regions') return discoverBfs(fetchImpl);
    if (!resolutions.has(source.discovery_url)) resolutions.set(source.discovery_url, discoverSem(source.discovery_url, fetchImpl));
    return resolutions.get(source.discovery_url).then((edition) => semDownload(source, edition));
  }
  const staged = await Promise.all(sources.map((source) => stageSource(source, previous.get(source.id), outputDir, discover, fetchImpl)));
  const manifest = { schema_version: 1, updated_at: new Date().toISOString(), sources: staged };
  await atomicWrite(join(outputDir, 'latest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

if (import.meta.main) {
  try {
    const outputDir = resolve(process.env.MARKET_RADAR_RAW_DIR || localDir);
    const { sources: staged } = await stageRawSources({ outputDir });
    for (const { id, status, bytes, error } of staged) {
      console.log(`${id}: ${status}${bytes ? ` (${bytes} Bytes)` : ''}${error ? ` · ${error}` : ''}`);
      if (error) process.exitCode = 1;
    }
    console.log(join(outputDir, 'latest.json'));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
