import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { REPOSITORY, PRODUCTION_ORIGIN, deploymentTarget, isDeploymentOrigin, request, html, javascript, svg, guestbook, ask, invalidAsk } from './contracts.mjs';

const linkedSites = [
  'https://aialo.io/', 'https://app.proofmode.co/',
  'https://alorestaurant-production.up.railway.app/',
  'https://ironclad-production-a158.up.railway.app/',
  'https://med-spa-production.up.railway.app/',
  'https://realestate-production-bbce.up.railway.app/',
  'https://web-production-f0d91.up.railway.app/',
];

export async function runChecks(origin, { liveAsk = false, linked = false, fetchImpl = fetch, bypassToken = '', log = console.log } = {}) {
  if (bypassToken && !isDeploymentOrigin(origin)) throw new Error('Bypass credentials are restricted to this project’s immutable Vercel origin');
  const headers = bypassToken ? { 'x-vercel-protection-bypass': bypassToken } : {};
  const checks = [
    ['3D page', '/', (r) => html(r, /id=["']portfolio-main["']/)],
    ['Text page', '/text.html', (r) => html(r, /<h1\b[^>]*>Aloysious Kabonge<\/h1>/)],
    ['ProofMode page', '/proofmode.html', (r) => html(r, /<title>ProofMode case study/)],
    ['SVG favicon', '/favicon.svg', svg],
    ...['boot.js', 'main.js', 'ask.js', 'guestbook.js'].map((file) => [`Asset ${file}`, `/${file}`, javascript]),
    ['Guestbook GET', '/api/guestbook', guestbook],
    liveAsk
      ? ['Ask sourced answer (one model request; cached responses are reported)', '/api/ask', ask, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: 'What does Alo do at Flatter?' }) }]
      : ['Ask invalid-input contract (no model call)', '/api/ask', invalidAsk, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{', expectedStatus: 400 }],
  ];
  if (linked) for (const url of linkedSites) checks.push([`Linked site ${new URL(url).hostname}`, url, html, { allowedOrigins: url === 'https://aialo.io/' ? ['https://aialo.io', 'https://www.aialo.io'] : undefined }]);
  const results = [];
  // Sequential checks bound concurrent external load. Every failure is retained,
  // and the one Ask request is never automatically retried.
  for (const [name, route, validate, options = {}] of checks) {
    const url = new URL(route, origin);
    try {
      const response = await request(url, { fetchImpl, ...options, headers: { ...(url.origin === origin ? headers : {}), ...options.headers } });
      const detail = validate(response);
      results.push({ name, passed: true, status: response.status, ...(detail || {}) });
      log(`PASS ${name}${detail?.cached ? ' [cached; provider was not rechecked]' : ''}`);
    } catch (error) {
      results.push({ name, passed: false, error: error.message });
      log(`FAIL ${name}: ${error.message}`);
    }
  }
  return results;
}

// Read SHA-pinned source as data only. A public production alias is allowed only
// after its browser assets match this deployment, not merely the latest main.
// This checks asset consistency; identical assets do not identify a server build.
export async function bindProductionAssets(sha, { fetchImpl = fetch } = {}) {
  if (!/^[a-f0-9]{40}$/i.test(sha || '')) throw new Error('Deployment commit is invalid');
  const files = ['index.html', 'page.html', 'main.js', 'narration.js', 'boot.js', 'ask.js', 'guestbook.js', 'content.js', 'media.js', 'network.js', 'atmosphere.js', 'favicon.svg'];
  const digest = (text) => createHash('sha256').update(text).digest('hex');
  await Promise.all(files.map(async (file) => {
    const [expected, actual] = await Promise.all([
      request(`https://raw.githubusercontent.com/${REPOSITORY}/${sha}/src/${file}`, { fetchImpl, expectedStatus: 200 }),
      request(new URL(file === 'index.html' ? '/' : `/${file}`, PRODUCTION_ORIGIN), { fetchImpl, expectedStatus: 200 }),
    ]);
    if (!expected.text || digest(expected.text) !== digest(actual.text)) throw new Error(`Production asset ${file} does not match deployment ${sha}`);
  }));
  return files;
}

export async function main(argv = process.argv.slice(2), env = process.env) {
  if (argv.length !== 1 || !['--production', '--deployment-event'].includes(argv[0])) throw new Error('Use --production or --deployment-event. Production performs one live Ask request; deployment checks use no model.');
  const deployment = argv[0] === '--deployment-event';
  // GITHUB_EVENT_PATH is reserved by Actions and points at workflow_run.json.
  // The deployment resolver writes a separate, already validated handoff file.
  if (deployment && !env.DEPLOYMENT_EVENT_PATH) throw new Error('DEPLOYMENT_EVENT_PATH is required for deployment checks');
  const target = deployment ? deploymentTarget(JSON.parse(await fs.readFile(env.DEPLOYMENT_EVENT_PATH, 'utf8'))) : { origin: PRODUCTION_ORIGIN, environment: 'Production' };
  let checkedOrigin = target.origin, verifiedAssets;
  if (deployment && target.environment === 'Production') {
    verifiedAssets = await bindProductionAssets(target.sha);
    checkedOrigin = PRODUCTION_ORIGIN;
    console.log(`Production alias browser assets match deployment ${target.sha}; probing the public alias. Immutable origin access is not asserted.`);
  }
  const results = await runChecks(checkedOrigin, { liveAsk: !deployment, linked: !deployment, bypassToken: deployment && target.environment === 'Preview' ? env.VERCEL_AUTOMATION_BYPASS_SECRET || '' : '' });
  const report = { timestamp: new Date().toISOString(), mode: deployment ? 'deployment' : 'uptime', ...target, checkedOrigin, verifiedAssets, results };
  const directory = path.resolve('test-results/health');
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, `${report.mode}.json`), JSON.stringify(report, null, 2));
  const failures = results.filter((result) => !result.passed);
  console.log(`${results.length - failures.length}/${results.length} health checks passed`);
  if (failures.length) throw new Error(`${failures.length} health checks failed; deployment/site is not verified`);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
