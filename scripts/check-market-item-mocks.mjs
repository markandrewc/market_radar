// Checks the 30 mock market items against docs/market-item.schema.json.
// The contract is frozen in step 1, so frontend, backend and AI can build against
// the same shape; this script fails the build if the mocks drift.
//
//   npm run check:contract
import { readFile } from 'node:fs/promises';

const schemaUrl = new URL('../docs/market-item.schema.json', import.meta.url);
const mocksUrl = new URL('../src/web/mocks/market-items.json', import.meta.url);

const schema = JSON.parse(await readFile(schemaUrl, 'utf8'));
const items = JSON.parse(await readFile(mocksUrl, 'utf8'));

const categories = schema.$defs.category.enum;
const required = new Set(schema.required);
const dateTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
const uri = /^https?:\/\/\S+$/;
const minimumItems = 30;

const problems = [];
const fail = (where, message) => problems.push(`${where}: ${message}`);
const isDateTime = (value) => typeof value === 'string' && dateTime.test(value) && !Number.isNaN(Date.parse(value));
const isUri = (value) => typeof value === 'string' && uri.test(value);

if (!Array.isArray(items)) {
  console.error('market-items.json: expected a JSON array.');
  process.exit(1);
}
if (items.length < minimumItems) fail('market-items.json', `expected at least ${minimumItems} items, found ${items.length}`);

const seen = new Set();
for (const [index, item] of items.entries()) {
  const where = `items[${index}] (${item?.id ?? 'no id'})`;
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    fail(where, 'expected an object');
    continue;
  }
  for (const key of required) if (!(key in item)) fail(where, `missing field "${key}"`);
  for (const key of Object.keys(item)) if (!required.has(key)) fail(where, `unexpected field "${key}"`);

  if (typeof item.id !== 'string' || !item.id) fail(where, 'id must be a non-empty string');
  else if (seen.has(item.id)) fail(where, `duplicate id "${item.id}"`);
  else seen.add(item.id);

  if (!categories.includes(item.category)) fail(where, `category must be one of ${categories.join(', ')}`);
  if (!Array.isArray(item.categories) || item.categories.length === 0) fail(where, 'categories must be a non-empty array');
  else {
    if (new Set(item.categories).size !== item.categories.length) fail(where, 'categories must be unique');
    for (const category of item.categories) {
      if (!categories.includes(category)) fail(where, `categories contains "${category}", expected ${categories.join(', ')}`);
    }
    if (!item.categories.includes(item.category)) fail(where, 'categories must contain category');
  }

  if (typeof item.title !== 'string' || !item.title.trim()) fail(where, 'title must be a non-empty string');
  if (typeof item.summary !== 'string') fail(where, 'summary must be a string');
  if (typeof item.source_name !== 'string' || !item.source_name.trim()) fail(where, 'source_name must be a non-empty string');
  if (!isUri(item.source_url)) fail(where, 'source_url must be an http(s) URI');
  if (item.url !== null && !isUri(item.url)) fail(where, 'url must be null or an http(s) URI');
  if (item.published_at !== null && !isDateTime(item.published_at)) fail(where, 'published_at must be null or a UTC date-time');
  if (!isDateTime(item.fetched_at)) fail(where, 'fetched_at must be a UTC date-time');
  if (item.region !== null && typeof item.region !== 'string') fail(where, 'region must be null or a string');
  else if (typeof item.region === 'string' && !/^[A-Z]{2}$/.test(item.region)) fail(where, 'region must be a two-letter canton code or null');

  if (!Array.isArray(item.tags)) fail(where, 'tags must be an array');
  else if (item.tags.some((tag) => typeof tag !== 'string' || !tag)) fail(where, 'tags must be non-empty strings');

  if (!item.metrics || typeof item.metrics !== 'object' || Array.isArray(item.metrics)) fail(where, 'metrics must be an object');
  else {
    for (const [key, value] of Object.entries(item.metrics)) {
      const ok = value === null || (typeof value === 'number' && Number.isFinite(value));
      if (!ok) fail(where, `metrics.${key} must be a number or null`);
    }
  }
}

const counts = Object.fromEntries(categories.map((category) => [category, 0]));
for (const item of items) if (item && categories.includes(item.category)) counts[item.category] += 1;
for (const category of categories) {
  if (counts[category] === 0) fail('market-items.json', `no mock covers category ${category}`);
}

if (problems.length) {
  console.error(`MarketItem contract check failed (${problems.length} problem${problems.length === 1 ? '' : 's'}):`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

const distribution = categories.map((category) => `${category}:${counts[category]}`).join(' ');
console.log(`MarketItem contract ok – ${items.length} mocks, categories ${distribution}, unique ids ${seen.size}.`);
