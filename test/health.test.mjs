import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { deploymentTarget, request, guestbook, ask, javascript, html, svg, PRODUCTION_ORIGIN } from '../scripts/health/contracts.mjs';
import { runChecks, bindProductionAssets } from '../scripts/health/check-live.mjs';
import { resolveDeployment } from '../scripts/health/wait-deployment.mjs';
import { trackContextErrors } from '../scripts/health/browser-errors.cjs';

// No external requests: every HTTP path below injects fetch, including CLI tests.
const origin = 'https://alorag2-bviimg7np-alo-0ac6.vercel.app';
const event = () => ({
  repository: { full_name: 'akabonge/alo_rag2' },
  deployment: { creator: { login: 'vercel[bot]', type: 'Bot' }, repository_url: 'https://api.github.com/repos/akabonge/alo_rag2', environment: 'Preview', sha: 'c'.repeat(40) },
  deployment_status: { creator: { login: 'vercel[bot]', type: 'Bot' }, state: 'success', environment_url: origin },
});
const response = (text, type = 'application/json', status = 200) => new Response(text, { status, headers: { 'content-type': type } });
const document = (text, type = 'application/json') => ({ text, headers: new Headers({ 'content-type': type }) });
const json = (value) => document(JSON.stringify(value));
const noLog = () => {};

test('Deployment validation binds the bot, repository, commit and exact project/scope URL', () => {
  assert.equal(deploymentTarget(event()).origin, origin);
  const changes = [
    (e) => { e.repository.full_name = 'attacker/alo_rag2'; },
    (e) => { e.deployment.repository_url = 'https://api.github.com/repos/attacker/alo_rag2'; },
    (e) => { e.deployment.creator.login = 'someone'; },
    (e) => { e.deployment_status.creator.type = 'User'; },
    (e) => { e.deployment_status.state = 'pending'; },
    (e) => { e.deployment.sha = '../main'; },
    (e) => { e.deployment.environment = 'Unknown'; },
  ];
  for (const change of changes) { const value = event(); change(value); assert.throws(() => deploymentTarget(value)); }
  for (const url of [
    'http://alorag2-bviimg7np-alo-0ac6.vercel.app',
    'https://other-bviimg7np-alo-0ac6.vercel.app',
    'https://alorag2-bviimg7np-other.vercel.app',
    'https://alorag2-bviimg7np-alo-0ac6.vercel.app.attacker.example',
    'https://attacker.example/alorag2-bviimg7np-alo-0ac6.vercel.app',
    `${origin}:444`, `${origin}/api/guestbook`, `${origin}/?token=value`, `${origin}/#hash`,
    origin.replace('https://', 'https://user:password@'), 'https://3d.aialo.io',
  ]) { const value = event(); value.deployment_status.environment_url = url; assert.throws(() => deploymentTarget(value), undefined, url); }
});

test('Trusted workflow resolves the successful Vercel deployment for the tested SHA', async () => {
  const sha = 'e'.repeat(40), calls = [];
  const deployment = { id: 42, sha, environment: 'Preview', repository_url: 'https://api.github.com/repos/akabonge/alo_rag2', statuses_url: 'https://api.github.com/repos/akabonge/alo_rag2/deployments/42/statuses', creator: { login: 'vercel[bot]', type: 'Bot' } };
  const status = { state: 'success', environment_url: origin, creator: { login: 'vercel[bot]', type: 'Bot' } };
  const fetchImpl = async (url, options) => {
    calls.push({ url: String(url), options });
    return response(JSON.stringify(String(url).endsWith('/statuses') ? [status] : [deployment]));
  };
  const found = await resolveDeployment(sha, { fetchImpl, token: 'test-token', attempts: 1 });
  assert.equal(deploymentTarget(found).sha, sha);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].options.headers.Authorization, 'Bearer test-token');
  await assert.rejects(resolveDeployment('bad', { fetchImpl, token: 'test-token', attempts: 1 }), /full deployment commit SHA/);
});

test('Redirect transport failure and unresolved 3xx are failures, not the former false green', async () => {
  let calls = 0;
  await assert.rejects(request(origin, { fetchImpl: async () => {
    if (calls++ === 0) return new Response(null, { status: 302, headers: { location: '/again' } });
    throw new Error('Simulated curl-equivalent transport failure after HTTP302');
  } }), /Transport failed/);
  assert.equal(calls, 2);
  calls = 0;
  await assert.rejects(request(origin, { fetchImpl: async () => { calls++; return new Response(null, { status: 302, headers: { location: '/loop' } }); } }), /Unresolved redirect/);
  assert.equal(calls, 5);
  await assert.rejects(request(origin, { fetchImpl: async () => new Response(null, { status: 304 }) }), /Unresolved redirect/);
  await assert.rejects(request(origin, { fetchImpl: async () => response('Bad gateway', 'text/plain', 502) }), /HTTP 502/);
});

test('Protected previews fail explicitly and bypass credentials never follow a foreign redirect', async () => {
  for (const status of [401, 403]) await assert.rejects(request(origin, { fetchImpl: async () => response('protected', 'text/html', status) }), /protected deployment is not verified/);
  await assert.rejects(request(origin, { fetchImpl: async () => new Response(null, { status: 302, headers: { location: 'https://vercel.com/sso-api?next=test' } }) }), /Protected deployment/);
  let calls = 0;
  await assert.rejects(request(origin, { headers: { 'x-vercel-protection-bypass': 'mock-secret' }, fetchImpl: async (_url, options) => {
    calls++; assert.equal(options.headers['x-vercel-protection-bypass'], 'mock-secret');
    return new Response(null, { status: 307, headers: { location: 'https://attacker.example/' } });
  } }), /trusted HTTPS origin/);
  assert.equal(calls, 1);
  await assert.rejects(runChecks(PRODUCTION_ORIGIN, { bypassToken: 'mock-secret' }), /restricted/);
});

test('Same-origin redirects reach a real 2xx; POST redirects never replay the request', async () => {
  let calls = 0;
  const found = await request(origin, { fetchImpl: async () => calls++ ? response('ok', 'text/plain') : new Response(null, { status: 301, headers: { location: '/canonical' } }) });
  assert.equal(found.text, 'ok'); assert.equal(found.url, `${origin}/canonical`);
  calls = 0;
  await assert.rejects(request(origin, { method: 'POST', body: '{', fetchImpl: async () => { calls++; return new Response(null, { status: 307, headers: { location: '/again' } }); } }), /Unresolved redirect/);
  assert.equal(calls, 1);
});

test('The HTTP deadline aborts hangs and response size is bounded', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const pending = request(origin, { timeoutMs: 25, fetchImpl: (_url, { signal }) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')))) });
  t.mock.timers.tick(25);
  await assert.rejects(pending, /timed out/);
  await assert.rejects(request(origin, { maxBytes: 2, fetchImpl: async () => response('oversized') }), /within its limit/);
});

test('Live contracts reject HTML masquerading as APIs, malformed notes and unsourced Ask output', () => {
  guestbook(json({ notes: [] }));
  guestbook(json({ notes: [{ name: 'A', city: '', msg: 'Hi', t: 1 }] }));
  for (const value of [{}, { notes: 'wrong' }, { notes: [null] }, { notes: [{ name: 'A', msg: 'Hi', t: 1 }] }, { notes: [{ name: 'A', city: '', msg: 'Hi', t: '1' }] }]) assert.throws(() => guestbook(json(value)));
  assert.throws(() => guestbook(document('<html>catch-all</html>', 'text/html')));
  assert.throws(() => guestbook(document('{')));
  assert.throws(() => ask(json({ answer: 'This could be a generic fallback answer.', sources: [] })));
  assert.throws(() => ask(json({ answer: 'Alo works at Flatter as an engineer.', sources: [{}] })));
  assert.deepEqual(ask(json({ answer: 'Alo works at Flatter as an engineer.', sources: ['[1] Profile'], cached: true })), { cached: true });
  assert.throws(() => javascript(document('<html>catch-all</html>', 'text/html')));
  assert.throws(() => html(document('OK', 'text/html')));
  assert.throws(() => svg(document('<html>catch-all</html>', 'image/svg+xml')));
});

function healthyFetch(requests) {
  return async (url, options) => {
    requests.push({ url, ...options });
    const { pathname } = new URL(url);
    if (pathname === '/api/guestbook') return response('{"notes":[]}');
    if (pathname === '/api/ask') return options.body === '{' ? response('{"error":"Send valid JSON"}', undefined, 400) : response('{"answer":"Alo works at Flatter as an engineer.","sources":["[1] Profile"],"cached":true}');
    if (pathname.endsWith('.js')) return response('export const fixture = true;', 'text/javascript');
    if (pathname.endsWith('.svg')) return response('<svg xmlns="http://www.w3.org/2000/svg"/>', 'image/svg+xml');
    if (pathname === '/text.html') return response('<html><h1>Aloysious Kabonge</h1></html>', 'text/html');
    if (pathname === '/proofmode.html') return response('<html><title>ProofMode case study</title></html>', 'text/html');
    return response('<html><script id="portfolio-main"></script></html>', 'text/html');
  };
}

test('Deployment checks make no model request or guestbook write; uptime sends Ask exactly once', async () => {
  const calls = [];
  const deployment = await runChecks(origin, { fetchImpl: healthyFetch(calls), log: noLog });
  assert.ok(deployment.length >= 10 && deployment.every((result) => result.passed));
  assert.equal(calls.filter((call) => call.method === 'POST').length, 1);
  assert.equal(calls.find((call) => call.method === 'POST').body, '{');
  assert.ok(calls.filter((call) => call.url.endsWith('/api/guestbook')).every((call) => call.method === 'GET'));
  calls.length = 0;
  const uptime = await runChecks(PRODUCTION_ORIGIN, { liveAsk: true, linked: true, fetchImpl: healthyFetch(calls), log: noLog });
  assert.ok(uptime.every((result) => result.passed));
  assert.equal(calls.filter((call) => call.method === 'POST').length, 1);
  assert.match(calls.find((call) => call.method === 'POST').body, /Flatter/);
  assert.equal(uptime.find((result) => result.name.startsWith('Ask')).cached, true);
});

test('The report retains an API failure even when every other probe succeeds', async () => {
  const calls = [], good = healthyFetch(calls);
  const results = await runChecks(origin, { log: noLog, fetchImpl: async (url, options) => url.endsWith('/api/guestbook') ? response('<html>wrong route</html>', 'text/html') : good(url, options) });
  assert.deepEqual(results.filter((result) => !result.passed).map((result) => result.name), ['Guestbook GET']);
});

test('Production alias binding compares fixed assets with the deployed SHA, not main', async () => {
  const sha = 'd'.repeat(40), calls = [];
  const fixture = async (url) => {
    const parsed = new URL(url); calls.push(parsed.href);
    const file = parsed.pathname.split('/').pop() || 'index.html';
    if (parsed.hostname === 'raw.githubusercontent.com') assert.ok(parsed.pathname.includes(`/${sha}/src/`));
    return response(`fixture for ${file}`, 'text/plain');
  };
  const files = await bindProductionAssets(sha, { fetchImpl: fixture });
  assert.ok(files.includes('main.js') && files.includes('index.html'));
  assert.equal(calls.length, files.length * 2);
  await assert.rejects(bindProductionAssets(sha, { fetchImpl: async (url) => String(url).includes('3d.aialo.io/main.js') ? response('stale asset') : fixture(url) }), /main.js does not match/);
  await assert.rejects(bindProductionAssets('../main', { fetchImpl: () => assert.fail('Invalid SHA must not fetch') }), /commit is invalid/);
});

test('The real health CLI exits nonzero for HTTP200 HTML API catch-alls', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'alo-health-test-'));
  t.after(() => { assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir())); fs.rmSync(directory, { recursive: true, force: true }); });
  const bootstrap = 'globalThis.fetch = async () => new Response("<html>catch-all</html>", {status:200,headers:{"content-type":"text/html"}});';
  const file = fileURLToPath(new URL('../scripts/health/check-live.mjs', import.meta.url));
  const child = spawnSync(process.execPath, ['--import', `data:text/javascript,${encodeURIComponent(bootstrap)}`, file, '--production'], { cwd: directory, encoding: 'utf8', timeout: 5000 });
  assert.equal(child.status, 1, child.stderr);
  assert.match(child.stdout, /FAIL Guestbook GET/);
  assert.match(child.stderr, /health checks failed/);
  const report = JSON.parse(fs.readFileSync(path.join(directory, 'test-results/health/uptime.json'), 'utf8'));
  assert.equal(report.results.find((result) => result.name === 'Guestbook GET').passed, false);
});

test('Browser error tracking retains late interaction errors and covers new popup pages', () => {
  const page = new EventEmitter(); page.url = () => `${origin}/`;
  const context = new EventEmitter(); context.pages = () => [page];
  const errors = [];
  trackContextErrors(context, errors);
  assert.equal(errors.length, 0); // the initial render check has already passed
  context.emit('page', page); // re-observation must not duplicate listeners
  page.emit('pageerror', new TypeError('Late sound interaction failure'));
  const popup = new EventEmitter(); popup.url = () => `${origin}/text.html`;
  context.emit('page', popup);
  popup.emit('pageerror', new Error('Popup failure'));
  context.emit('close');
  assert.deepEqual(errors.map((error) => error.message), ['Late sound interaction failure', 'Popup failure']);
  assert.equal(errors.length === 0, false, 'Final suite assertion must fail even after the contexts close');
});
