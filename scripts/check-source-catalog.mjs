import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';

const { values } = parseArgs({ options: { 'output-dir': { type: 'string' } } });
const outputDir = resolve(values['output-dir'] ?? 'data/runtime');
const catalogUrl = new URL('../data/source-catalog.json', import.meta.url);
const catalog = JSON.parse(await readFile(catalogUrl, 'utf8'));

const sampleChecks = {
  'esco-search': {
    valid: (result) => result?._embedded?.results?.length > 0,
    detail: 'At least one occupation result returned.',
  },
  'pxweb-metadata': {
    valid: (result) => ['Jahr', 'Kanton', 'Staatsangehörigkeit'].every(
      (code) => result?.variables?.some((variable) => variable.code === code),
    ),
    detail: 'Cube metadata returned with year, canton and citizenship dimensions.',
  },
  'ckan-search': {
    valid: (result) => result?.success === true && result.result?.results?.length > 0,
    detail: 'At least one matching BFS dataset record returned.',
  },
  'parliament-odata': {
    valid: (result) => result?.d?.[0]?.ID != null && typeof result.d[0].Title === 'string',
    detail: 'A parliamentary business item returned from the transitional endpoint.',
  },
  'fedlex-sparql': {
    valid: (result) => result?.results?.bindings?.[0]?.act?.value.endsWith('/eli/cc/2007/758'),
    detail: 'One FNIA (SR 142.20) metadata result returned.',
  },
};

async function validateSample(response, probe) {
  if (probe.kind === 'xlsx') {
    const type = response.headers.get('content-type');
    const reader = response.body?.getReader();
    if (!reader) return null;
    try {
      const { value } = await reader.read();
      const hasZipHeader = value?.[0] === 0x50 && value?.[1] === 0x4b
        && value?.[2] === 0x03 && value?.[3] === 0x04;
      return type?.startsWith('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        && hasZipHeader ? 'Workbook download returned an XLSX content type and ZIP signature.' : null;
    } finally {
      await reader.cancel();
    }
  }
  if (probe.kind === 'html') {
    const type = response.headers.get('content-type');
    const body = await response.text();
    return type?.startsWith('text/html') && body.includes(probe.match)
      ? 'Official page returned with its media releases heading.' : null;
  }
  const sample = sampleChecks[probe.kind];
  return sample?.valid(await response.json()) ? sample.detail : null;
}

async function checkSource({ id, name, access, lifecycle, sourceUrl, probe }) {
  const entry = { id, name, access, ...(lifecycle ? { lifecycle } : {}), sourceUrl };
  if (access === 'credentials-required') {
    return { ...entry, status: 'credentials-required', httpStatus: null,
      detail: 'Authenticated endpoint. No request made.' };
  }
  const url = new URL(probe.url);
  if (probe.query) url.searchParams.set('query', probe.query);
  const accept = probe.kind === 'fedlex-sparql' ? 'application/sparql-results+json' : '*/*';
  let httpStatus = null;
  try {
    const response = await fetch(url, { headers: { accept }, signal: AbortSignal.timeout(12_000) });
    httpStatus = response.status;
    if (!response.ok) {
      await response.body?.cancel();
      return { ...entry, status: 'http-error', httpStatus, detail: `HTTP ${httpStatus}.` };
    }
    const verified = await validateSample(response, probe);
    return verified
      ? { ...entry, status: 'verified', httpStatus, detail: verified }
      : { ...entry, status: 'unexpected-response', httpStatus, detail: 'Expected public sample was missing.' };
  } catch (error) {
    const status = error.name === 'SyntaxError' ? 'unexpected-response' : 'request-error';
    return { ...entry, status, httpStatus, detail: error.cause?.code ?? error.name };
  }
}

const checks = await Promise.all(catalog.sources.map(checkSource));
const report = { schemaVersion: 1, checkedAt: new Date().toISOString(), checks };
await mkdir(outputDir, { recursive: true });
const outputFile = resolve(outputDir, 'source-checks.json');
const tempFile = resolve(outputDir, `source-checks.${randomUUID()}.tmp`);
try {
  await writeFile(tempFile, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
  await rename(tempFile, outputFile);
} finally {
  await rm(tempFile, { force: true });
}
for (const check of checks) {
  console.log(`${check.id}: ${check.status} ${check.httpStatus ?? ''} ${check.detail}`);
}
console.log(outputFile);
if (checks.some(({ status }) => !['verified', 'credentials-required'].includes(status))) {
  process.exitCode = 1;
}
