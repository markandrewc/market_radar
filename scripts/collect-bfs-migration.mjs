import { createHash, randomUUID } from 'node:crypto';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const api = 'https://www.pxweb.bfs.admin.ch/api/v1/de';
const defaultDir = fileURLToPath(new URL('../.market-radar/snapshots/2026-W47/', import.meta.url));
const cantons = ['ZH', 'BE', 'LU', 'ZG', 'GE'];
const cantonLabels = { Zürich: 'ZH', Bern: 'BE', Luzern: 'LU', Zug: 'ZG', Genf: 'GE', Genève: 'GE' };
const headers = ['source', 'indicator', 'year', 'week', 'canton', 'nationality', 'iso3', 'value', 'unit', 'source_url', 'fetched_at'];
const cubes = [
  {
    id: 'px-x-0103020200_104', report2025: 'https://statistik.admin.ch/de/asset/36735109',
    canton: 'Kanton', nationality: 'Staatsangehörigkeit (Kategorie)', counterpart: 'Herkunftsstaat',
    indicator: 'international_arrivals', scope: 'Einwanderung aus dem Ausland in die ständige Wohnbevölkerung. Herkunftsstaat, Alter und Geschlecht jeweils Total.',
  },
  {
    id: 'px-x-0103020300_104', report2025: 'https://statistik.admin.ch/de/asset/36735120',
    canton: 'Kanton', nationality: 'Staatsangehörigkeit (Kategorie)', counterpart: 'Zielstaat',
    indicator: 'international_departures', scope: 'Auswanderung der ständigen Wohnbevölkerung ins Ausland. Zielstaat, Alter und Geschlecht jeweils Total.',
  },
  {
    id: 'px-x-0103010200_121', report2025: 'https://statistik.admin.ch/de/asset/36735086',
    canton: 'Kanton (-) / Bezirk (>>) / Gemeinde (......)', nationality: 'Staatsangehörigkeit (Auswahl)',
    scope: 'Interkantonale Zu- und Wegzüge der ständigen Wohnbevölkerung. Aggregierte Staatsangehörigkeitsgruppen des BFS. Geschlecht Total.',
    migrationTypes: {
      'Interkantonaler Zuzug': 'intercantonal_arrivals',
      'Interkantonaler Wegzug': 'intercantonal_departures',
    },
  },
];

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

async function getJson(url, init, fetchImpl) {
  try {
    const response = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(55_000), redirect: 'error' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > 5 * 1024 * 1024) throw new Error('Unerwartet grosse Antwort');
    return { json: JSON.parse(bytes.toString('utf8')), sha: sha256(bytes), bytes: bytes.length, fetchedAt: new Date().toISOString() };
  } catch (error) {
    throw new Error(`BFS ${init.method ?? 'GET'} ${url} · ${error.message}`, { cause: error });
  }
}

function variable(metadata, code) {
  const found = metadata.variables.find((entry) => entry.code === code);
  if (!found || !Array.isArray(found.values) || found.values.length !== found.valueTexts.length) {
    throw new Error(`BFS-Dimension nicht verfügbar · ${code}`);
  }
  return new Map(found.values.map((value, index) => [value, found.valueTexts[index]]));
}

function codeFor(options, label) {
  const match = [...options.entries()].find(([, name]) => name === label);
  if (!match) throw new Error(`BFS-Ausprägung nicht verfügbar · ${label}`);
  return match[0];
}

function cantonCodes(cube, metadata) {
  const selected = new Map();
  for (const [code, label] of variable(metadata, cube.canton)) {
    if (cube.migrationTypes && !label.startsWith('- ')) continue;
    const canton = cantonLabels[label.replace(/^- /, '').split(' / ', 1)[0]];
    if (!cantons.includes(canton)) continue;
    if ([...selected.values()].includes(canton)) throw new Error(`BFS-Kanton nicht eindeutig · ${canton}`);
    selected.set(code, canton);
  }
  if (selected.size !== cantons.length) throw new Error(`BFS-Kantonsauswahl unvollständig · ${cube.id}`);
  return selected;
}

function queryFor(cube, metadata, year) {
  const cantonByCode = cantonCodes(cube, metadata);
  const nationalityByCode = variable(metadata, cube.nationality);
  const totalSex = codeFor(variable(metadata, 'Geschlecht'), 'Geschlecht - Total');
  const selection = new Map([
    ['Jahr', [year]], [cube.canton, [...cantonByCode.keys()]],
    [cube.nationality, [...nationalityByCode.keys()]], ['Geschlecht', [totalSex]],
  ]);
  let indicatorByCode;
  if (cube.migrationTypes) {
    const types = variable(metadata, 'Migrationstyp');
    indicatorByCode = new Map(Object.entries(cube.migrationTypes).map(([label, name]) => [codeFor(types, label), name]));
    selection.set('Migrationstyp', [...indicatorByCode.keys()]);
  } else {
    selection.set(cube.counterpart, [codeFor(variable(metadata, cube.counterpart), `${cube.counterpart} - Total`)]);
    selection.set('Altersklasse', [codeFor(variable(metadata, 'Altersklasse'), 'Altersklasse - Total')]);
  }
  if (metadata.variables.length !== selection.size || metadata.variables.some((entry) => !selection.has(entry.code))) {
    throw new Error(`Geänderte BFS-Tabellenstruktur · ${cube.id}`);
  }
  const query = metadata.variables.map(({ code }) => ({ code, selection: { filter: 'item', values: selection.get(code) } }));
  return { body: { query, response: { format: 'json-stat2' } }, selection, cantonByCode, nationalityByCode, indicatorByCode };
}

function codeOrder(category) {
  if (Array.isArray(category.index)) return category.index;
  return Object.keys(category.index ?? {}).sort((a, b) => category.index[a] - category.index[b]);
}

function makeRows(dataset, cube, options, year, sourceUrl, fetchedAt) {
  if (dataset.class !== 'dataset' || !Array.isArray(dataset.id) || !dataset.value ||
    dataset.id.length !== options.selection.size || new Set(dataset.id).size !== options.selection.size) {
    throw new Error(`Ungültige BFS-Statistikantwort · ${cube.id}`);
  }
  const axes = dataset.id.map((id, index) => {
    const codes = codeOrder(dataset.dimension[id].category);
    const chosen = options.selection.get(id);
    if (!chosen || codes.length !== dataset.size[index] || codes.length !== chosen.length ||
      new Set(codes).size !== chosen.length || !codes.every((code) => chosen.includes(code))) {
      throw new Error(`BFS-Antwort enthält abweichende Merkmale · ${id}`);
    }
    return codes;
  });
  const rows = [];
  let missing = 0;
  const count = axes.reduce((product, axis) => product * axis.length, 1);
  for (let cell = 0; cell < count; cell += 1) {
    const value = dataset.value[cell];
    if (value == null) {
      missing += 1;
      continue;
    }
    if (!Number.isSafeInteger(value) || value < 0) throw new Error(`Ungültiger BFS-Zählwert · ${cube.id}`);
    let offset = cell;
    const codes = new Map();
    for (let axis = axes.length - 1; axis >= 0; axis -= 1) {
      codes.set(dataset.id[axis], axes[axis][offset % axes[axis].length]);
      offset = Math.floor(offset / axes[axis].length);
    }
    const canton = options.cantonByCode.get(codes.get(cube.canton));
    const nationality = options.nationalityByCode.get(codes.get(cube.nationality));
    const indicator = cube.indicator ?? options.indicatorByCode.get(codes.get('Migrationstyp'));
    if (!canton || !nationality || !indicator) throw new Error(`Fehlende Aggregatzuordnung · ${cube.id}`);
    const nationalLabel = nationality.endsWith(' - Total') ? 'Total' : nationality;
    rows.push(['BFS STATPOP', indicator, year, '', canton, nationalLabel,
      nationalLabel === 'Schweiz' ? 'CHE' : '', value, 'Wanderungen', sourceUrl, fetchedAt]);
  }
  return { rows, missing };
}

const csvField = (value) => {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

async function atomicWrite(path, contents) {
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, contents, { flag: 'wx' });
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true }).catch(() => {});
  }
}

export async function collectBfsMigration({ outputDir = defaultDir, fetchImpl = fetch } = {}) {
  const inputs = await Promise.all(cubes.map(async (cube) => {
    const url = `${api}/${cube.id}/${cube.id}.px`;
    const metadata = await getJson(url, {}, fetchImpl);
    const years = [...variable(metadata.json, 'Jahr').keys()].filter((value) => /^\d{4}$/.test(value));
    return { cube, url, metadata, years };
  }));
  const year = inputs[0].years.filter((value) => inputs.every(({ years }) => years.includes(value))).sort().at(-1);
  if (!year) throw new Error('Kein gemeinsames publiziertes STATPOP-Berichtsjahr');

  const datasets = await Promise.all(inputs.map(async ({ cube, url, metadata }) => {
    const options = queryFor(cube, metadata.json, year);
    const request = JSON.stringify(options.body);
    const data = await getJson(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: request }, fetchImpl);
    const { rows, missing } = makeRows(data.json, cube, options, year, url, data.fetchedAt);
    return {
      rows,
      entry: {
        id: cube.id, title: metadata.json.title, scope: cube.scope, licence: 'OPEN-BY',
        source_url: url, report_url: year === '2025' ? cube.report2025 : `https://www.bfs.admin.ch/asset/de/${cube.id}`,
        report_date: year === '2025' ? '2026-08-20' : null,
        fetched_at: data.fetchedAt, upstream_updated: data.json.updated ?? null,
        metadata_sha256: metadata.sha, metadata_bytes: metadata.bytes, query_sha256: sha256(request), query: options.body,
        response_sha256: data.sha, response_bytes: data.bytes, rows: rows.length, omitted_missing_cells: missing,
      },
    };
  }));

  const rows = datasets.flatMap((dataset) => dataset.rows);
  const keys = rows.map((row) => JSON.stringify([row[1], row[2], row[4], row[5]]));
  if (new Set(keys).size !== rows.length || new Set(rows.map((row) => row[1])).size !== 4 ||
    rows.filter((row) => row[5] === 'Total').length !== 4 * cantons.length) {
    throw new Error('Die BFS-Auswahl enthält unvollständige oder doppelte aggregierte Reihen');
  }
  const csv = [headers, ...rows].map((row) => row.map(csvField).join(',')).join('\r\n') + '\r\n';
  const manifest = {
    schema_version: 1, dataset: 'bfs-migration', year: Number(year), granularity: 'annual', cantons,
    license_url: 'https://www.bfs.admin.ch/de/nutzungsbedingungen',
    coverage: 'Ständige Wohnbevölkerung. Internationale Reihen: Total, Schweiz, Ausland. Interkantonale Reihen: vom BFS publizierte Staatsangehörigkeitsgruppen. ISO3 nur für die explizite schweizerische Staatsangehörigkeit. Keine Wochen- oder Einzelstaatsschätzungen.',
    filename: 'bfs-migration.csv', rows: rows.length, sha256: sha256(csv), sources: datasets.map(({ entry }) => entry),
  };
  await mkdir(outputDir, { recursive: true });
  await atomicWrite(join(outputDir, manifest.filename), csv);
  await atomicWrite(join(outputDir, 'bfs-migration-provenance.json'), JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}

if (import.meta.main) {
  try {
    const [flag, dir, extra] = process.argv.slice(2);
    if (flag && (flag !== '--output-dir' || !dir || extra)) {
      throw new Error('Aufruf: node scripts/collect-bfs-migration.mjs [--output-dir ORDNER]');
    }
    const outputDir = dir ? resolve(dir) : defaultDir;
    const manifest = await collectBfsMigration({ outputDir });
    console.log(`BFS STATPOP ${manifest.year}: ${manifest.rows} Zeilen · ${join(outputDir, manifest.filename)}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
