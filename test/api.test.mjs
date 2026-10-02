import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCorpus, makeIndex } from '../src/ask.js';
import { mockAskFetch } from './ask-rate-limit-fixture.mjs';

// All requests are in-process and fetch is mocked. Never contact production services.
let moduleId = 0;
const fresh = async (name) => (await import(`../api/${name}.js?test=${moduleId++}`)).default;
function response() {
  return {
    statusCode: 200, headers: {}, body: undefined,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}
async function request(handler, body, { method = 'POST', headers = {}, query } = {}) {
  const res = response();
  await handler({ method, body, query, headers: { 'x-forwarded-for': '192.0.2.1', ...headers } }, res);
  return res;
}
function environment(t, vars) {
  const previous = Object.fromEntries(Object.keys(vars).map((key) => [key, process.env[key]]));
  for (const [key, value] of Object.entries(vars)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });
}
const askEnvironment = (t, vars = {}) => environment(t, {
  ANTHROPIC_API_KEY: 'mock-only', KV_REST_API_URL: 'https://redis.invalid', KV_REST_API_TOKEN: 'mock-only', ...vars,
});
const guestEnvironment = (t) => environment(t, {
  KV_REST_API_URL: 'https://redis.invalid', KV_REST_API_TOKEN: 'mock-only', GUESTBOOK_ADMIN_KEY: 'mock-admin',
});
const json = (body, ok = true) => ({ ok, status: ok ? 200 : 500, json: async () => body });
const noNetwork = () => { assert.fail('Unexpected fetch; tests never contact a network'); };
const waitForAbort = (_url, { signal }) => new Promise((_resolve, reject) => {
  assert.ok(signal instanceof AbortSignal);
  if (signal.aborted) reject(new Error('Mock timeout'));
  else signal.addEventListener('abort', () => reject(new Error('Mock timeout')), { once: true });
});

test('retrieval preserves Profile aliases and rejects the unrelated White House question', () => {
  const search = makeIndex(buildCorpus());
  assert.equal(search('Alo')[0].d.src, 'Profile');
  assert.equal(search('Tell me about yourself')[0].d.src, 'Profile');
  assert.deepEqual(search('Tell me about the White House'), []);
});

test('Ask rejects malformed JSON and invalid question types before network access', async (t) => {
  t.mock.method(globalThis, 'fetch', noNetwork);
  const ask = await fresh('ask');
  for (const body of ['{', 'null', null, [], {}, { question: [] }, { question: {} }, { question: '  ' }]) {
    assert.equal((await request(ask, body)).statusCode, 400);
  }
  const invalidMethod = await request(ask, undefined, { method: 'GET' });
  assert.equal(invalidMethod.statusCode, 405);
  assert.equal(invalidMethod.headers.Allow, 'POST');
});

test('Ask returns off-topic fallback without provider access and detects missing configuration', async (t) => {
  askEnvironment(t, { ANTHROPIC_API_KEY: undefined });
  mockAskFetch(t, noNetwork);
  const ask = await fresh('ask');
  const offTopic = await request(ask, { question: 'White House' });
  assert.equal(offTopic.statusCode, 200);
  assert.deepEqual(offTopic.body.sources, []);
  assert.equal((await request(ask, { question: 'Flatter' })).statusCode, 503);
});

test('Ask returns a grounded answer and reuses the successful cached response', async (t) => {
  askEnvironment(t);
  const fetch = mockAskFetch(t, async (_url, options) => {
    assert.ok(options.signal instanceof AbortSignal);
    assert.match(JSON.parse(options.body).messages[0].content, /Sources:/);
    return json({ content: [{ type: 'text', text: 'Alo works at Flatter. [1]' }] });
  });
  const ask = await fresh('ask');
  const first = await request(ask, { question: 'Flatter' });
  const cached = await request(ask, { question: '  FLATTER  ' });
  assert.equal(first.statusCode, 200);
  assert.equal(first.body.answer, 'Alo works at Flatter. [1]');
  assert.ok(first.body.sources.length > 0);
  assert.equal(cached.body.cached, true);
  assert.equal(fetch.providerCalls.length, 1);
  assert.equal(fetch.redisCalls.length, 2, 'Cached replies still consume shared attempts');
});

test('Ask rejects empty or malformed provider output and never caches the failed reply', async (t) => {
  askEnvironment(t);
  const ask = await fresh('ask');
  const payloads = [null, { content: [] }, { content: {} }, { content: [{ type: 'text', text: ' ' }] }, { content: [{ type: 'text', text: 7 }] }];
  const fetch = mockAskFetch(t, async () => json(payloads.shift()));
  for (let i = 0; i < 5; i++) {
    const res = await request(ask, { question: 'Flatter' });
    assert.equal(res.statusCode, 502);
    assert.equal(typeof res.body.error, 'string');
  }
  assert.equal(fetch.providerCalls.length, 5);
});

test('Ask converts provider HTTP, JSON and network failures to controlled responses', async (t) => {
  askEnvironment(t);
  const ask = await fresh('ask');
  const failures = [
    async () => json({}, false),
    async () => ({ ok: true, json: async () => { throw new SyntaxError('Malformed upstream body'); } }),
    async () => { throw new Error('Mock private provider diagnostic'); },
  ];
  mockAskFetch(t, (...args) => failures.shift()(...args));
  for (let i = 0; i < 3; i++) {
    const res = await request(ask, { question: 'Flatter' });
    assert.equal(res.statusCode, 502);
    assert.doesNotMatch(JSON.stringify(res.body), /private provider diagnostic/);
  }
});

test('Ask aborts a hung provider within its serverless duration', async (t) => {
  askEnvironment(t);
  const ask = await fresh('ask');
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const calls = mockAskFetch(t, waitForAbort);
  const pending = request(ask, { question: 'Flatter' });
  await new Promise(setImmediate);
  assert.equal(calls.providerCalls.length, 1);
  t.mock.timers.tick(12_000);
  assert.equal((await pending).statusCode, 504);
});

test('Ask limits repeated requests and allows the client again after the window', async (t) => {
  askEnvironment(t);
  const ask = await fresh('ask');
  t.mock.timers.enable({ apis: ['Date'], now: 100_000 });
  mockAskFetch(t, noNetwork);
  for (let i = 0; i < 8; i++) assert.equal((await request(ask, { question: 'White House' })).statusCode, 200);
  const limited = await request(ask, { question: 'White House' });
  assert.equal(limited.statusCode, 429);
  assert.equal(limited.headers['Retry-After'], '60');
  t.mock.timers.tick(60_000);
  assert.equal((await request(ask, { question: 'White House' })).statusCode, 200);
});

test('Guestbook validates JSON, field types and admin authentication before touching Redis', async (t) => {
  guestEnvironment(t);
  t.mock.method(globalThis, 'fetch', noNetwork);
  const guestbook = await fresh('guestbook');
  for (const body of ['{', 'null', null, [], {}, { name: [], msg: 'Hello' }, { name: 'Visitor', msg: 'Hi', city: {} }, ...[null, 12, '', 'bad-key', 'a'.repeat(10000)].map((submissionId) => ({ name: 'Visitor', msg: 'Hi', submissionId }))]) {
    assert.equal((await request(guestbook, body)).statusCode, 400);
  }
  assert.equal((await request(guestbook, undefined, { method: 'DELETE' })).statusCode, 403);
  assert.equal((await request(guestbook, undefined, { method: 'DELETE', headers: { 'x-admin-key': 'incorrect' } })).statusCode, 403);
});

test('Guestbook fails closed on Redis script errors or malformed results', async (t) => {
  guestEnvironment(t);
  const guestbook = await fresh('guestbook');
  const replies = [
    [{ error: 'Rate storage failed' }], [{ result: null }],
    [{ result: ['rate_limited', 0] }], [{ result: ['rate_limited', 3601] }],
    [{ result: ['saved', '{}'] }], [{ result: ['saved', '{'] }],
    [{ result: ['unknown', '{}'] }], {}, [],
  ];
  const fetch = t.mock.method(globalThis, 'fetch', async (_url, options) => {
    assert.equal(JSON.parse(options.body)[0][0], 'EVAL');
    return json(replies.shift());
  });
  const cases = replies.length;
  for (let i = 0; i < cases; i++) assert.equal((await request(guestbook, { name: 'Visitor', msg: 'Hello' })).statusCode, 502);
  assert.equal(fetch.mock.callCount(), cases);
});

test('Guestbook blocks excess posts and only reports a saved note after valid storage responses', async (t) => {
  guestEnvironment(t);
  const guestbook = await fresh('guestbook');
  let count = 4;
  let stored;
  const fetch = t.mock.method(globalThis, 'fetch', async (_url, options) => {
    assert.ok(options.signal instanceof AbortSignal);
    const commands = JSON.parse(options.body);
    if (commands[0][0] === 'EVAL') {
      if (count > 3) return json([{ result: ['rate_limited', '123'] }]);
      stored = commands[0][3 + commands[0][2]];
      return json([{ result: ['saved', stored] }]);
    }
    return json([{ result: [stored] }]);
  });
  const note = { name: 'Visitor', city: 'Kampala', msg: 'Hello' };
  const limited = await request(guestbook, note);
  assert.equal(limited.statusCode, 429);
  assert.equal(limited.headers['Retry-After'], '123');
  assert.equal(fetch.mock.callCount(), 1);
  count = 1;
  const saved = await request(guestbook, note);
  assert.equal(saved.statusCode, 200);
  assert.equal(saved.body.saved, true);
  assert.deepEqual(saved.body.note, saved.body.notes[0]);
  assert.equal(saved.body.notes[0].msg, 'Hello');
  assert.equal(saved.body.notes[0].city, 'Kampala');
  assert.equal(fetch.mock.callCount(), 3);
});

test('Guestbook confirms a saved note even when the subsequent list refresh fails', async (t) => {
  guestEnvironment(t);
  const guestbook = await fresh('guestbook');
  let stored;
  const fetch = t.mock.method(globalThis, 'fetch', async (_url, options) => {
    const commands = JSON.parse(options.body);
    if (commands[0][0] === 'EVAL') {
      stored = JSON.parse(commands[0][3 + commands[0][2]]);
      return json([{ result: ['saved', JSON.stringify(stored)] }]);
    }
    assert.equal(commands[0][0], 'LRANGE');
    throw new Error('Storage read failed after confirmed write');
  });
  const saved = await request(guestbook, { name: 'Visitor', city: '', msg: 'Hello' });
  assert.equal(saved.statusCode, 200);
  assert.equal(saved.body.saved, true);
  assert.deepEqual(saved.body.note, stored);
  assert.equal(saved.body.notes, null);
  assert.equal(saved.body.refreshPending, true);
  assert.equal(fetch.mock.callCount(), 2);
});

test('Guestbook retries a lost write acknowledgement with the same receipt and original timestamp', async (t) => {
  guestEnvironment(t);
  const guestbook = await fresh('guestbook');
  const note = { name: 'Visitor', city: 'Kampala', msg: 'Hello', submissionId: '74de98cb-574d-4981-9b0c-ef8788170c03' };
  let stored, receiptKey, fingerprint;
  let writes = 0;
  t.mock.timers.enable({ apis: ['Date'], now: 100_000 });
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    const [command] = JSON.parse(options.body);
    if (command[0] === 'LRANGE') return json([{ result: [stored] }]);
    assert.equal(command[0], 'EVAL');
    assert.equal(command[2], 3);
    if (!stored) {
      stored = command[6]; receiptKey = command[5]; fingerprint = command[7]; writes++;
      throw new Error('Write committed; acknowledgement lost');
    }
    assert.equal(command[5], receiptKey);
    assert.equal(command[7], fingerprint, 'Fingerprint must exclude the new timestamp');
    return json([{ result: ['replayed', stored] }]);
  });
  assert.equal((await request(guestbook, note)).statusCode, 502);
  t.mock.timers.tick(1000);
  const retried = await request(guestbook, { ...note, submissionId: note.submissionId.toUpperCase(), t: 999999 });
  assert.equal(retried.statusCode, 200);
  assert.equal(retried.body.replayed, true);
  assert.equal(retried.body.note.t, 100_000);
  assert.equal(retried.body.notes.length, 1);
  assert.equal(writes, 1);
  assert.equal(Object.hasOwn(retried.body.note, 'submissionId'), false);
});

test('Guestbook exposes conflicts without claiming a save and accepts canonical-equivalent replay payloads', async (t) => {
  guestEnvironment(t);
  const guestbook = await fresh('guestbook');
  const submissionId = '74de98cb-574d-4981-9b0c-ef8788170c03';
  const note = { name: 'Visitor', city: '', msg: 'Hello', t: 123 };
  let conflict = true;
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    const [command] = JSON.parse(options.body);
    if (command[0] === 'LRANGE') throw new Error('Refresh unavailable after replay');
    return json([{ result: conflict ? ['conflict'] : ['replayed', JSON.stringify(note)] }]);
  });
  const rejected = await request(guestbook, { ...note, submissionId });
  assert.equal(rejected.statusCode, 409);
  assert.equal(rejected.body.saved, undefined);
  conflict = false;
  const replay = await request(guestbook, { name: ' Visitor ', msg: '<b>Hello</b>', submissionId });
  assert.equal(replay.statusCode, 200);
  assert.deepEqual(replay.body.note, note);
  assert.equal(replay.body.replayed, true);
  assert.equal(replay.body.refreshPending, true);
});

test('Guestbook moderation preserves a note posted between reading and removing the target', async (t) => {
  guestEnvironment(t);
  const guestbook = await fresh('guestbook');
  // Whitespace intentionally differs from JSON.stringify: removal must use the exact stored value.
  const target = '{ "name": "Target", "city": "", "msg": "Remove me", "t": 123 }';
  const previous = JSON.stringify({ name: 'Earlier', city: '', msg: 'Keep me', t: 122 });
  const concurrent = JSON.stringify({ name: 'New visitor', city: '', msg: 'Also keep me', t: 124 });
  let store = [target, previous];
  let firstRead = true;
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    const commands = JSON.parse(options.body);
    if (commands[0][0] === 'LRANGE') {
      const snapshot = [...store];
      if (firstRead) { firstRead = false; store.unshift(concurrent); }
      return json([{ result: snapshot }]);
    }
    return json(commands.map((command) => {
      assert.equal(command[0], 'LREM', 'Moderation must never rebuild the shared list');
      assert.equal(command[2], 0);
      assert.equal(command[3], target);
      const before = store.length;
      store = store.filter((raw) => raw !== command[3]);
      return { result: before - store.length };
    }));
  });
  const res = await request(guestbook, undefined, { method: 'DELETE', headers: { 'x-admin-key': 'mock-admin' }, query: { t: '123' } });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(store, [concurrent, previous]);
  assert.deepEqual(res.body.notes.map((note) => note.t), [124, 122]);
});

test('Guestbook ignores malformed stored notes and rejects a malformed list result', async (t) => {
  guestEnvironment(t);
  const guestbook = await fresh('guestbook');
  const note = { name: 'Visitor', city: '', msg: 'Hello', t: 123 };
  const replies = [[{ result: ['null', '{}', '{', JSON.stringify(note)] }], [{ result: 'not a list' }]];
  t.mock.method(globalThis, 'fetch', async () => json(replies.shift()));
  assert.deepEqual((await request(guestbook, undefined, { method: 'GET' })).body.notes, [note]);
  assert.equal((await request(guestbook, undefined, { method: 'GET' })).statusCode, 502);
});

test('Guestbook applies one timeout budget across a hung storage request', async (t) => {
  guestEnvironment(t);
  const guestbook = await fresh('guestbook');
  t.mock.timers.enable({ apis: ['setTimeout'] });
  t.mock.method(globalThis, 'fetch', waitForAbort);
  const pending = request(guestbook, undefined, { method: 'GET' });
  t.mock.timers.tick(7000);
  assert.equal((await pending).statusCode, 504);
});
