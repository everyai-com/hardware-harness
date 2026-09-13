import { ApifyClient } from 'apify-client';

const ACTOR_ID = process.env.APIFY_ACTOR ?? 'BELjuwQScEd6DZpW3';

const token = process.env.APIFY_TOKEN;
if (!token) {
  console.error('APIFY_TOKEN is not set. Add it to .env and run: npm run check');
  process.exit(1);
}

const client = new ApifyClient({ token });

try {
  const me = await client.user().get();
  console.log(`Token OK - authenticated as "${me.username}" (${me.email ?? 'no email'})`);
  console.log(`Plan: ${me.plan?.id ?? 'unknown'} | Monthly usage: $${me.plan?.monthlyUsageUsd ?? 0}`);
} catch (error) {
  console.error(`Token check failed: ${error.statusCode ?? ''} ${error.message}`);
  process.exit(1);
}

try {
  const actor = await client.actor(ACTOR_ID).get();
  console.log(`Actor: ${actor.title} by ${actor.username} (${actor.id})`);
  console.log(`Total runs: ${actor.stats?.totalRuns ?? 0}`);

  const versionNumber = actor.defaultRunOptions?.build ?? actor.versions?.[0]?.versionNumber ?? 'latest';
  const version = (await client.actor(ACTOR_ID).version(versionNumber).get()) ?? {};
  const schema = version.inputSchema ?? {};
  const properties = schema.properties ?? {};
  const required = schema.required ?? [];

  console.log(`\nInput fields for version ${versionNumber}:`);
  for (const [name, spec] of Object.entries(properties)) {
    const flag = required.includes(name) ? ' (required)' : '';
    const type = spec.type ?? spec.editor ?? 'any';
    console.log(`  - ${name}: ${type}${flag}`);
  }
} catch (error) {
  console.error(`Actor lookup failed: ${error.statusCode ?? ''} ${error.message}`);
}
