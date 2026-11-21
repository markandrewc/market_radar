import { readFile } from 'node:fs/promises';

const DEFAULT_API_URL = 'http://127.0.0.1:8787';
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

async function readData(file) {
  return JSON.parse(await readFile(new URL('../src/web/data/' + file, import.meta.url), 'utf8'));
}

function source(id, name, url, fetchedAt) {
  if (new URL(url).origin !== 'https://www.itboard.ch' || !Number.isFinite(Date.parse(fetchedAt))) {
    throw new Error('Ungültige ITBoard-Quelle oder Abrufzeit: ' + id);
  }
  return { id, name, url, fetchedAt };
}

function observation({ roleId, period, value, base, skill }) {
  const validValue = Number.isInteger(value) && value >= 0;
  const validBase = Number.isInteger(base) && base > 0 && value <= base;
  if (!MONTH.test(period) || !validValue || (base != null && !validBase) ||
      (skill !== undefined && (typeof skill !== 'string' || !skill.trim() || !validBase))) {
    throw new Error('Ungültiger ITBoard-Wert für ' + roleId + ' im Monat ' + period);
  }
  return {
    metric: skill === undefined ? 'demand' : 'skill',
    roleId,
    period,
    value,
    ...(base == null ? {} : { base }),
    ...(skill === undefined ? {} : { skill }),
  };
}

function request(sourceInfo, roles, observations) {
  const keys = observations.map(({ roleId, period, skill }) => JSON.stringify([roleId, period, skill]));
  if (!observations.length || new Set(keys).size !== keys.length) {
    throw new Error('Leere oder doppelte Beobachtungen: ' + sourceInfo.id);
  }
  return { source: sourceInfo, roles, observations, replace: false };
}

function makeRequests(radar, profiles) {
  const roles = new Map(radar.roles.map(({ id, label }) => [id, { id, name: label }]));
  const demandRoles = new Set();
  const demand = radar.rows.map((row) => {
    if (!roles.has(row.role_id) || row.unit !== 'postings' || row.source_url !== radar.source.url) {
      throw new Error('Unbekannte Rolle, Einheit oder Quelle: ' + row.role_id);
    }
    demandRoles.add(row.role_id);
    return observation({ roleId: row.role_id, period: row.month, value: row.value, base: row.base });
  });
  const requests = [request(
    source('itboard-monthly', 'ITBoard · Schweizer Monatsstichprobe', radar.source.url, radar.fetched_at),
    [...demandRoles].map((id) => roles.get(id)),
    demand,
  )];

  for (const [id, profile] of Object.entries(profiles)) {
    if (profile == null) continue;
    const role = roles.get(id);
    if (!role || !/^\d{4}-\d{2}-\d{2}$/.test(profile.read_on)) {
      throw new Error('Unbekanntes Profil oder fehlendes Abrufdatum: ' + id);
    }
    const observations = profile.skills.map(([skill, value]) => observation({
      roleId: id, period: profile.read_on.slice(0, 7), value, base: profile.base, skill,
    }));
    requests.push(request(
      source('itboard-profile-' + id, 'ITBoard · Berufsprofil ' + role.name, profile.source, profile.read_on),
      [role],
      observations,
    ));
  }
  return requests;
}

function ingestUrl() {
  const url = new URL(process.env.MARKET_RADAR_API_URL || DEFAULT_API_URL);
  const loopback = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
  if (url.username || url.password || url.search || url.hash ||
      (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback))) {
    throw new Error('MARKET_RADAR_API_URL braucht HTTPS oder eine lokale HTTP-Adresse ohne Zugangsdaten.');
  }
  url.pathname = url.pathname.replace(/\/$/, '') + '/api/ingest';
  return url;
}

async function applyRequests(requests) {
  const token = process.env.INGEST_TOKEN?.trim();
  if (!token) throw new Error('Für --apply muss INGEST_TOKEN gesetzt sein.');
  const url = ingestUrl();
  for (const data of requests) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        redirect: 'error',
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const result = await response.json();
      if (result.source !== data.source.id || result.roles !== data.roles.length ||
          result.observations !== data.observations.length) {
        throw new Error('Unerwartete Importbestätigung');
      }
      console.log(JSON.stringify(result));
    } catch (error) {
      throw new Error(data.source.id + ' · ' + error.message, { cause: error });
    }
  }
}

async function main(args) {
  if (args.length && (args.length !== 1 || args[0] !== '--apply')) {
    throw new Error('Aufruf: node scripts/load-itboard-api.mjs [--apply]');
  }
  const [radar, profiles] = await Promise.all([readData('itboard.json'), readData('role-skills.json')]);
  const requests = makeRequests(radar, profiles);
  if (args[0] === '--apply') {
    await applyRequests(requests);
    return;
  }
  console.log(JSON.stringify({
    mode: 'dry-run',
    demand: requests[0].observations.length,
    skills: requests.slice(1).reduce((sum, data) => sum + data.observations.length, 0),
    sources: requests.map(({ source, roles, observations }) => ({
      id: source.id, url: source.url, fetchedAt: source.fetchedAt,
      roles: roles.length, observations: observations.length,
    })),
  }, null, 2));
}

try {
  await main(process.argv.slice(2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
