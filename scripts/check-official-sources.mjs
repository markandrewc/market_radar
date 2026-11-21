import { randomUUID } from 'node:crypto';
import { readFile, rename, rm, writeFile } from 'node:fs/promises';

const output = new URL('../src/web/data/source-checks.json', import.meta.url);
const sources = [
  { id: 'sem-asylum-statistics', label: 'SEM Asylstatistik', url: 'https://www.sem.admin.ch/de/asylstatistik', publication: 'monthly-sem', seriesName: 'Asylstatistik' },
  { id: 'sem-resident-statistics', label: 'SEM Ausländerstatistik', url: 'https://www.sem.admin.ch/de/auslaenderstatistik', publication: 'monthly-sem', seriesName: 'Ausländerstatistik' },
  { id: 'sem-asylum-employment', label: 'SEM employment in the asylum system', url: 'https://www.sem.admin.ch/de/arbeit-asylbereich', publication: 'sem-page' },
  { id: 'sem-status-s-statistics', label: 'SEM protection status S statistics', url: 'https://www.sem.admin.ch/de/statistiken-ukraine' },
  { id: 'sem-visa-entry', label: 'SEM entry and visa guidance', url: 'https://www.sem.admin.ch/de/in-die-schweiz-einreisen' },
  { id: 'sem-residence', label: 'SEM residence guidance', url: 'https://www.sem.admin.ch/de/aufenthalt' },
  { id: 'sem-status-s-travel', label: 'Federal Council protection status S travel proposal', url: 'https://www.sem.admin.ch/de/newnsb/Oq0CiNf6IUcX', publication: 'sem-page' },
  { id: 'sem-permit-quotas', label: 'Federal Council 2026 permit quotas', url: 'https://www.ejpd.admin.ch/de/newnsb/7HwBjdg5HpBA' },
  { id: 'sem-non-eu-work', label: 'SEM work permits and quota publications', url: 'https://www.sem.admin.ch/de/nicht-eu-efta-angehoerige' },
  { id: 'bfs-vacancies', label: 'BFS Offene Stellen nach Wirtschaftsabteilung', url: 'https://www.pxweb.bfs.admin.ch/api/v1/de/px-x-0602000000_103/px-x-0602000000_103.px', publication: 'bfs-quarter' },
  { id: 'bfs-vacancies-region', label: 'BFS Offene Stellen nach Grossregion', url: 'https://www.pxweb.bfs.admin.ch/api/v1/de/px-x-0602000000_104/px-x-0602000000_104.px', publication: 'bfs-quarter' },
  { id: 'seco-job-notification', label: 'SECO Stellenmeldepflicht', url: 'https://www.arbeit.swiss/de/arbeitgebende/stellenmeldepflichten' },
  { id: 'parliament-work-access', label: 'Swiss Parliament committee update on work access', url: 'https://www.parlament.ch/press-releases/Pages/mm-spk-s-2026-11-06.aspx?lang=1031' },
  { id: 'parliament-open-data', label: 'Swiss Parliament Open Data', url: 'https://www.parlament.ch/de/%C3%BCber-das-parlament/fakten-und-zahlen/open-data-web-services' },
  { id: 'fedlex-status-s-employment', label: 'Fedlex work notification ordinance', url: 'https://www.fedlex.admin.ch/eli/oc/2025/669/de' },
  { id: 'fedlex-migration-act', label: 'Fedlex Foreign Nationals and Integration Act', url: 'https://www.fedlex.admin.ch/eli/cc/2007/758/de' },
];

const germanMonths = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];
const dateText = /\b(\d{1,2})\.\s*([\p{L}]+)\s+(20\d{2})\b/u;

function plainText(html) {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;|&#xA0;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function dateFromText(text) {
  const match = text.match(dateText);
  if (!match) return null;
  const [, day, month, year] = match;
  const index = germanMonths.indexOf(month);
  if (index === -1) return null;
  const date = `${year}-${String(index + 1).padStart(2, '0')}-${day.padStart(2, '0')}`;
  const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().startsWith(date) ? date : null;
}

function semMonthlyPublication(html, sourceUrl, seriesName) {
  const issues = [];
  for (const card of html.matchAll(/<li\b[^>]*>[\s\S]*?<\/li>/gi)) {
    const heading = card[0].match(/<h3\b[^>]*>([\s\S]*?)<\/h3>/i)?.[1];
    if (!heading) continue;
    const [name, month, year] = plainText(heading).split(' ');
    if (name !== seriesName || !/^20\d{2}$/.test(year)) continue;
    const index = germanMonths.indexOf(month);
    if (index === -1) continue;
    const period = `${year}-${String(index + 1).padStart(2, '0')}`;
    const link = card[0].match(/<a\b[^>]*href="([^"]+)"[^>]*>/i)?.[1];
    if (!link) continue;
    const report = new URL(link, sourceUrl);
    if (report.origin !== new URL(sourceUrl).origin || !report.pathname.endsWith(`-${year}`)) continue;
    const metadata = card[0].match(/<span\b[^>]*class="[^"]*\bmeta-info__item\b[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
    const publishedOn = metadata ? dateFromText(plainText(metadata[1])) : null;
    if (!publishedOn) continue;
    issues.push({ period, title: `${seriesName} ${month} ${year}`, publishedOn, url: report.href });
  }
  return issues.sort((left, right) => right.period.localeCompare(left.period))[0] ?? null;
}

function semPagePublication(html, sourceUrl) {
  const [, heading] = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i) ?? [];
  const text = plainText(html.replace(/<(head|script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ''));
  const [, date] = text.match(/Veröffentlicht am\s+(.{1,35})/i) ?? [];
  const publishedOn = date ? dateFromText(date) : null;
  return heading && publishedOn ? { title: plainText(heading), publishedOn, url: sourceUrl } : null;
}

function bfsQuarterPublication(document, sourceUrl) {
  const metadata = JSON.parse(document);
  const quarter = metadata.variables?.find((variable) => variable.code === 'Quartal');
  const period = quarter?.values?.filter((value) => /^\d{4}Q[1-4]$/.test(value)).sort().at(-1);
  return period && typeof metadata.title === 'string'
    ? { period, title: metadata.title, publishedOn: null, url: sourceUrl }
    : null;
}

async function probeSource(source, previous, fetchImpl) {
  const checkedAt = new Date().toISOString();
  const signal = AbortSignal.timeout(10_000);
  const options = { cache: 'no-store', redirect: 'follow', signal };
  let response;
  let publication = null;
  let status = 'request_failed';
  let errorCode;

  try {
    response = await fetchImpl(source.url, { ...options, method: source.publication ? 'GET' : 'HEAD' });
    if ([405, 501].includes(response.status) && !source.publication) {
      await response.body?.cancel();
      response = await fetchImpl(source.url, { ...options, headers: { Range: 'bytes=0-0' } });
    }
    status = response.ok ? 'reachable' : 'http_error';
    if (response.ok && source.publication) {
      const body = await response.text();
      if (source.publication === 'monthly-sem') {
        publication = semMonthlyPublication(body, source.url, source.seriesName);
      } else if (source.publication === 'bfs-quarter') {
        publication = bfsQuarterPublication(body, source.url);
      } else {
        publication = semPagePublication(body, source.url);
      }
    } else {
      await response.body?.cancel();
    }
  } catch (error) {
    status = signal.aborted ? 'timeout' : 'request_failed';
    errorCode = error?.cause?.code ?? error?.name;
  }

  const oldPublication = previous?.publication ?? null;
  const publicationChanged = publication && oldPublication
    ? publication.url !== oldPublication.url || publication.publishedOn !== oldPublication.publishedOn ||
      publication.title !== oldPublication.title || publication.period !== oldPublication.period
    : null;
  const attempt = { checkedAt, status, httpStatus: response?.status ?? null };
  if (errorCode) attempt.errorCode = errorCode;
  return {
    id: source.id,
    label: source.label,
    url: source.url,
    attempt,
    lastSuccess: status === 'reachable' ? { checkedAt, httpStatus: response.status } : previous?.lastSuccess ?? null,
    ...(source.publication && {
      publicationStatus: status !== 'reachable' ? 'source_unavailable' : publication ? 'confirmed' : 'metadata_unreadable',
      publication: publication ? { ...publication, observedAt: checkedAt } : oldPublication,
      publicationChanged,
      lastPublicationChange: publicationChanged ? { detectedAt: checkedAt, previous: oldPublication } : previous?.lastPublicationChange ?? null,
    }),
  };
}

export async function checkOfficialSources({ fetchImpl = fetch, previous = null } = {}) {
  const oldSources = new Map(previous?.sources.map((source) => [source.id, source]) ?? []);
  const results = await Promise.all(sources.map((source) => probeSource(source, oldSources.get(source.id), fetchImpl)));
  return { schemaVersion: 1, completedAt: new Date().toISOString(), sources: results };
}

async function loadHistory() {
  try {
    const previous = JSON.parse(await readFile(output, 'utf8'));
    if (previous.schemaVersion !== 1 || !Array.isArray(previous.sources)) throw new Error('Unexpected source-check history format');
    return previous;
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

async function saveHistory(result) {
  const temporary = new URL(`.source-checks-${randomUUID()}.tmp`, output);
  try {
    await writeFile(temporary, `${JSON.stringify(result, null, 2)}\n`, { flag: 'wx' });
    await rename(temporary, output);
  } finally {
    await rm(temporary, { force: true }).catch(() => {});
  }
}

if (import.meta.main) {
  try {
    const result = await checkOfficialSources({ previous: await loadHistory() });
    await saveHistory(result);
    for (const { id, attempt, lastSuccess, publicationStatus, publication, publicationChanged } of result.sources) {
      const http = attempt.httpStatus ? ` · HTTP ${attempt.httpStatus}` : '';
      const note = publicationChanged ? ' · publication changed' : '';
      const report = publication ? ` · ${publication.title} (${publication.publishedOn ?? publication.period})` : '';
      const last = attempt.status !== 'reachable' && lastSuccess ? ` · last successful check ${lastSuccess.checkedAt}` : '';
      const metadata = publicationStatus ? ` · ${publicationStatus}` : '';
      console.log(`${id} · ${attempt.status}${http}${last}${metadata}${report}${note}`);
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
