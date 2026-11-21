import { execFile } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const project = fileURLToPath(new URL('../', import.meta.url));
const header = 'source,indicator,year,week,canton,nationality,iso3,value,unit,source_url,fetched_at';

export function zurichWeek(now = new Date()) {
  const fields = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Zurich', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const date = Object.fromEntries(fields.map(({ type, value }) => [type, Number(value)]));
  const thursday = new Date(Date.UTC(date.year, date.month - 1, date.day));
  thursday.setUTCDate(thursday.getUTCDate() + 3 - (thursday.getUTCDay() + 6) % 7);
  const year = thursday.getUTCFullYear();
  const number = Math.ceil(((thursday - Date.UTC(year, 0, 1)) / 86_400_000 + 1) / 7);
  return `${year}-W${String(number).padStart(2, '0')}`;
}

async function atomicWrite(file, contents) {
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, contents, { flag: 'wx' });
    await rename(temporary, file);
  } finally {
    await rm(temporary, { force: true }).catch(() => {});
  }
}

async function measure(directory, file) {
  try {
    const contents = await readFile(join(directory, file));
    return { file, bytes: contents.length, sha256: createHash('sha256').update(contents).digest('hex') };
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

async function plainStats(directory, files) {
  const csv = await Promise.all(files.map(async (file) => {
    const text = await readFile(join(directory, file), 'utf8');
    const newline = text.indexOf('\n');
    if (newline < 0 || text.slice(0, newline).trim() !== header) throw new Error(`Ungültige Kopfzeile in ${file}`);
    return text.slice(newline + 1).trimEnd();
  }));
  if (csv.length) await atomicWrite(join(directory, 'stats.csv'), `${header}\n${csv.join('\n')}\n`);
}

export async function collectWeeklySnapshot({ now = new Date(), outputDir } = {}) {
  const week = zurichWeek(now);
  const directory = outputDir ?? join(project, '.market-radar', 'snapshots', week);
  const rawDirectory = resolve(process.env.MARKET_RADAR_RAW_DIR || join(project, '.market-radar', 'raw'));
  await mkdir(directory, { recursive: true });
  const tasks = [
    { id: 'originals', script: 'stage-raw-sources.mjs', directory: rawDirectory, files: ['latest.json'], args: [] },
    { id: 'bfs', script: 'collect-bfs-migration.mjs', directory, files: ['bfs-migration.csv', 'bfs-migration-provenance.json'] },
    { id: 'owid', script: 'collect-owid-context.mjs', directory, files: ['owid-context.csv', 'owid-context-provenance.json'] },
    { id: 'sources', script: 'check-source-catalog.mjs', directory, files: ['source-checks.json'] },
  ];
  const outcomes = await Promise.all(tasks.map(async (task) => {
    let exitCode = 0;
    try {
      await run(process.execPath, [join(project, 'scripts', task.script), ...(task.args ?? ['--output-dir', directory])],
        { timeout: 90_000, windowsHide: true, env: { ...process.env, MARKET_RADAR_RAW_DIR: rawDirectory } });
    } catch (error) {
      exitCode = Number.isInteger(error.code) ? error.code : 1;
    }
    const files = await Promise.all(task.files.map((file) => measure(task.directory, file)));
    const availableFiles = files.filter(Boolean).map((entry) => ({ ...entry, file: relative(directory, join(task.directory, entry.file)).replaceAll('\\', '/') }));
    const status = exitCode === 0 && files.every(Boolean) ? 'ready' : availableFiles.length ? 'retained-or-partial' : 'unavailable';
    return { id: task.id, status, exitCode, files: availableFiles };
  }));
  const stats = outcomes.filter(({ id }) => id === 'bfs' || id === 'owid')
    .flatMap(({ files }) => files.map(({ file }) => file).filter((file) => file.endsWith('.csv')));
  await plainStats(directory, stats);
  const manifest = { schemaVersion: 1, week, generatedAt: new Date().toISOString(), sources: outcomes, stats: await measure(directory, 'stats.csv') };
  await atomicWrite(join(directory, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return { directory, manifest };
}

if (import.meta.main) {
  try {
    const [, , flag, path, extra] = process.argv;
    if ((flag && (flag !== '--output-dir' || !path)) || extra) throw new Error('Verwendung: node scripts/weekly-snapshot.mjs [--output-dir ORDNER]');
    const { directory, manifest } = await collectWeeklySnapshot({ outputDir: path ? resolve(path) : undefined });
    console.log(`${manifest.week} · ${directory}`);
    for (const { id, status } of manifest.sources) console.log(`${id}: ${status}`);
    if (manifest.sources.some(({ status }) => status !== 'ready')) process.exitCode = 1;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
