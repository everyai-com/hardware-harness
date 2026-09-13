import { ApifyClient } from 'apify-client';
import { readFile, mkdir, writeFile } from 'node:fs/promises';

const ACTOR_ID = process.env.APIFY_ACTOR ?? 'BELjuwQScEd6DZpW3';

const token = process.env.APIFY_TOKEN;
if (!token) {
  console.error('APIFY_TOKEN is not set. Add it to .env and run via: npm start');
  process.exit(1);
}

const inputPath = process.argv[2] ?? 'apify-input.json';
const input = JSON.parse(await readFile(inputPath, 'utf8'));

const client = new ApifyClient({ token });

console.log(`Running actor ${ACTOR_ID} with input from ${inputPath}`);
console.log(`Input: ${JSON.stringify(input)}`);

const run = await client.actor(ACTOR_ID).call(input);
console.log(`Run ${run.id} finished with status: ${run.status}`);
console.log(`Console: https://console.apify.com/actors/runs/${run.id}`);
console.log(`Cost: $${run.usageTotalUsd ?? 'unknown'}`);

const { items } = await client.dataset(run.defaultDatasetId).listItems({ limit: 100000 });
console.log(`Fetched ${items.length} items from dataset ${run.defaultDatasetId}`);

if (items.length === 0) {
  console.log('No items returned - nothing written.');
  process.exit(0);
}

await mkdir('apify-output', { recursive: true });
const base = `apify-output/${ACTOR_ID.replace(/\W+/g, '-')}-${run.id}`;

await writeFile(`${base}.json`, JSON.stringify(items, null, 2));
console.log(`Saved ${items.length} items to ${base}.json`);

const columns = [
  'id',
  'url',
  'createdAt',
  'text',
  'authorUsername',
  'authorName',
  'authorFollowers',
  'likeCount',
  'replyCount',
  'retweetCount',
  'quoteCount',
  'bookmarkCount',
  'viewCount',
  'lang',
  'conversationId',
  'inReplyToUsername',
  'depth',
];

function pick(item, column) {
  if (column === 'authorUsername') return item.author?.username ?? item.author?.userName ?? item.author?.screenName;
  if (column === 'authorName') return item.author?.name;
  if (column === 'authorFollowers') return item.author?.followers ?? item.author?.followersCount;
  return item[column];
}

function cell(value) {
  if (value === null || value === undefined) return '';
  const text = String(value).replace(/\s+/g, ' ').trim();
  return `"${text.replaceAll('"', '""')}"`;
}

const header = Object.keys(items[0]).length > 0 ? columns : columns;
const rows = items.map((item) => columns.map((column) => cell(pick(item, column))).join(','));
await writeFile(`${base}.csv`, [header.join(','), ...rows].join('\n'));
console.log(`Saved CSV to ${base}.csv`);

console.log('First 3 rows:');
for (const item of items.slice(0, 3)) {
  console.log({
    url: pick(item, 'url'),
    author: pick(item, 'authorUsername'),
    likes: pick(item, 'likeCount'),
    text: String(pick(item, 'text') ?? '').slice(0, 120),
  });
}
