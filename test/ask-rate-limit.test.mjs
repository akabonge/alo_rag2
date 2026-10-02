import test from 'node:test';
import assert from 'node:assert/strict';
import { askRateCommand, consumeAskAttempt, ASK_LIMIT_TIMEOUT_MS } from '../lib/ask-rate-limit.js';

const vars = ['KV_REST_API_URL', 'KV_REST_API_TOKEN', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'ANTHROPIC_API_KEY'];
function environment(t, values = {}) {
  const before = Object.fromEntries(vars.map(key => [key, process.env[key]]));
  for (const key of vars) { if (values[key] === undefined) delete process.env[key]; else process.env[key] = values[key]; }
  t.after(() => { for (const key of vars) { if (before[key] === undefined) delete process.env[key]; else process.env[key] = before[key]; } });
}
const configured = { KV_REST_API_URL: 'https://redis.invalid', KV_REST_API_TOKEN: 'private-fixture-token', ANTHROPIC_API_KEY: 'private-model-fixture' };
let instance = 0;
const fresh = async () => (await import(`../api/ask.js?limit=${instance++}`)).default;
async function request(handler, question = 'Who is Alo?') {
  const result = { statusCode: 200, headers: {}, setHeader(key, value) { this.headers[key] = value; }, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  await handler({ method: 'POST', body: { question }, headers: { 'x-forwarded-for': '192.0.2.42, 203.0.113.8' } }, result);
  return result;
}
const response = result => ({ ok: true, json: async () => [{ result }] });

test('Ask keys are fixed-length keyed digests and canonicalize forwarded IPv6 addresses', () => {
  const a = askRateCommand('192.0.2.42, 203.0.113.8', 'secret-a');
  const b = askRateCommand('192.0.2.42', 'secret-a');
  assert.equal(a[3], b[3]);
  assert.notEqual(a[4], b[4], 'Parallel attempts need distinct members even in the same millisecond');
  assert.match(a[3], /^aialo:ask-rate:v1:[a-f0-9]{64}$/);
  assert.doesNotMatch(JSON.stringify(a), /192\.0\.2\.42|203\.0\.113\.8|secret-a/);
  assert.notEqual(a[3], askRateCommand('192.0.2.43', 'secret-a')[3]);
  assert.notEqual(a[3], askRateCommand('192.0.2.42', 'secret-b')[3]);
  assert.equal(askRateCommand('2001:0DB8:0:0:0:0:0:1', 'key')[3], askRateCommand('2001:db8::1', 'key')[3]);
  assert.equal(askRateCommand('untrusted-invalid-address', 'key')[3], askRateCommand(undefined, 'key')[3]);
});

test('missing or incomplete Redis credentials fail closed before cache, retrieval or model access', async t => {
  environment(t, { ANTHROPIC_API_KEY: 'unused' });
  t.mock.method(globalThis, 'fetch', () => assert.fail('No network with missing rate configuration'));
  const handler = await fresh();
  for (const question of ['Who is Alo?', 'White House']) {
    const result = await request(handler, question);
    assert.equal(result.statusCode, 503);
    assert.equal(result.headers['Cache-Control'], 'no-store');
  }
  process.env.KV_REST_API_URL = 'https://redis.invalid';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'other-pair';
  assert.equal((await request(handler)).statusCode, 503, 'Incomplete credential aliases must not be mixed');
});

test('Upstash alias pair is accepted and a denied response supplies the actual Retry-After', async t => {
  environment(t, { UPSTASH_REDIS_REST_URL: 'https://redis.invalid/', UPSTASH_REDIS_REST_TOKEN: 'alias-fixture' });
  const calls = t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://redis.invalid/pipeline');
    assert.equal(options.headers.Authorization, 'Bearer alias-fixture');
    assert.ok(options.signal instanceof AbortSignal);
    assert.equal(JSON.parse(options.body).length, 1);
    return response(['limited', 17]);
  });
  const result = await request(await fresh());
  assert.equal(result.statusCode, 429);
  assert.equal(result.headers['Retry-After'], '17');
  assert.equal(calls.mock.callCount(), 1);
});

test('storage HTTP, JSON, Lua and malformed decision failures become private 503 responses', async t => {
  environment(t, configured);
  const bad = [
    async () => ({ ok: false }),
    async () => { throw new Error('private network diagnostic'); },
    async () => ({ ok: true, json: async () => { throw new SyntaxError('private invalid JSON'); } }),
    ...[null, {}, [], [{ error: 'private wrong type' }], [{ result: ['allowed', 0] }, { result: ['allowed', 0] }],
      [{ result: ['allowed', 1] }], [{ result: ['allowed', '0'] }], [{ result: ['limited', 0] }],
      [{ result: ['limited', 61] }], [{ result: ['limited', 1.5] }], [{ result: ['limited', '3'] }],
      [{ result: ['unknown', 1] }], [{ result: ['allowed', 0, 'extra'] }], [{ result: null }]
    ].map(body => async () => ({ ok: true, json: async () => body })),
  ];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://redis.invalid/pipeline', 'No provider call after storage failure');
    return bad.shift()(url, options);
  });
  const handler = await fresh();
  while (bad.length) {
    const result = await request(handler);
    assert.equal(result.statusCode, 503);
    assert.doesNotMatch(JSON.stringify(result.body), /private|token|Lua|Redis/);
  }
});

test('the two-second storage deadline covers both unresponsive fetch and body parsing', async t => {
  environment(t, configured);
  t.mock.timers.enable({ apis: ['setTimeout'] });
  for (const bodyStall of [false, true]) {
    let signal;
    const mock = t.mock.method(globalThis, 'fetch', async (url, options) => {
      assert.equal(url, 'https://redis.invalid/pipeline'); signal = options.signal;
      return bodyStall ? { ok: true, json: () => new Promise(() => {}) } : new Promise(() => {});
    });
    const pending = request(await fresh());
    await new Promise(setImmediate);
    t.mock.timers.tick(ASK_LIMIT_TIMEOUT_MS);
    assert.equal((await pending).statusCode, 503);
    assert.equal(signal.aborted, true);
    mock.mock.restore();
  }
});

test('a cached answer never bypasses an unavailable shared limiter', async t => {
  environment(t, configured);
  let redisCalls = 0, modelCalls = 0;
  t.mock.method(globalThis, 'fetch', async url => {
    if (url === 'https://redis.invalid/pipeline') {
      redisCalls++;
      if (redisCalls === 1) return response(['allowed', 0]);
      throw new Error('private storage outage');
    }
    assert.equal(url, 'https://api.anthropic.com/v1/messages'); modelCalls++;
    return { ok: true, json: async () => ({ content: [{ type: 'text', text: 'Fixture answer [1]' }] }) };
  });
  const handler = await fresh();
  assert.equal((await request(handler)).statusCode, 200);
  assert.equal((await request(handler)).statusCode, 503);
  assert.equal(redisCalls, 2);
  assert.equal(modelCalls, 1);
});

test('valid admission is the only decision that permits a later provider request', async t => {
  environment(t, configured);
  t.mock.method(globalThis, 'fetch', async url => { assert.equal(url, 'https://redis.invalid/pipeline'); return response(['allowed', 0]); });
  assert.deepEqual(await consumeAskAttempt('192.0.2.42'), { allowed: true, retryAfter: 0 });
});
