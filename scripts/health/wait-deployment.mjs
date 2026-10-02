import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { deploymentTarget, REPOSITORY } from './contracts.mjs';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function githubJson(url, { fetchImpl, token }) {
  const response = await fetchImpl(url, {
    headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28' },
  });
  if (!response.ok) throw new Error(`GitHub deployment lookup failed with HTTP ${response.status}`);
  return response.json();
}

export async function resolveDeployment(sha, {
  fetchImpl = fetch, token = process.env.GITHUB_TOKEN, api = 'https://api.github.com', attempts = 24,
  intervalMs = 10_000, pause = wait,
} = {}) {
  if (!/^[a-f0-9]{40}$/i.test(sha || '')) throw new Error('A full deployment commit SHA is required');
  if (!token) throw new Error('GITHUB_TOKEN is required to read deployment status');
  const query = new URL(`/repos/${REPOSITORY}/deployments`, api);
  query.searchParams.set('sha', sha); query.searchParams.set('per_page', '30');
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const deployments = await githubJson(query, { fetchImpl, token });
    for (const deployment of deployments) {
      if (deployment.sha !== sha || !['Preview', 'Production'].includes(deployment.environment)) continue;
      const statuses = await githubJson(deployment.statuses_url, { fetchImpl, token });
      const status = statuses.find((value) => value.state === 'success');
      if (!status) continue;
      const event = { repository: { full_name: REPOSITORY }, deployment, deployment_status: status };
      deploymentTarget(event);
      return event;
    }
    if (attempt < attempts) await pause(intervalMs);
  }
  throw new Error(`No verified successful Vercel deployment appeared for ${sha}`);
}

export async function main(argv = process.argv.slice(2), env = process.env) {
  const shaAt = argv.indexOf('--sha'), outAt = argv.indexOf('--output');
  if (shaAt < 0 || outAt < 0 || !argv[shaAt + 1] || !argv[outAt + 1]) throw new Error('Use --sha <40-character SHA> --output <event.json>');
  const event = await resolveDeployment(argv[shaAt + 1], { token: env.GITHUB_TOKEN });
  const output = path.resolve(argv[outAt + 1]);
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(output, JSON.stringify(event, null, 2));
  console.log(`Verified ${event.deployment.environment} deployment ${event.deployment.id} for ${event.deployment.sha}`);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
