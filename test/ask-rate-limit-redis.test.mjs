import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { randomUUID } from 'node:crypto';
import { askRateCommand } from '../lib/ask-rate-limit.js';

// Execute the production Lua against disposable Redis only. The existing CI
// service is sufficient; no production credentials, external hosts or FLUSH.
const configuredPort = process.env.ASK_REDIS_TEST_PORT || process.env.GUESTBOOK_REDIS_TEST_PORT;
function parse(buffer, offset = 0) {
  const end = buffer.indexOf('\r\n', offset);
  if (end < 0) return;
  const kind = String.fromCharCode(buffer[offset]), line = buffer.toString('utf8', offset + 1, end);
  let next = end + 2;
  if (kind === '+') return { value: line, next };
  if (kind === '-') return { value: new Error(line), next };
  if (kind === ':') return { value: Number(line), next };
  if (kind === '$') {
    const length = Number(line);
    if (length === -1) return { value: null, next };
    if (buffer.length < next + length + 2) return;
    return { value: buffer.toString('utf8', next, next + length), next: next + length + 2 };
  }
  if (kind === '*') {
    if (Number(line) === -1) return { value: null, next };
    const value = [];
    for (let i = 0; i < Number(line); i++) {
      const item = parse(buffer, next);
      if (!item) return;
      value.push(item.value); next = item.next;
    }
    return { value, next };
  }
  throw new Error('Unexpected Redis protocol response');
}
function redis(...args) {
  const port = Number(configuredPort);
  assert.ok(Number.isInteger(port) && port > 0 && port <= 65535, 'Use a valid loopback Redis test port');
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: '127.0.0.1', port });
    let buffer = Buffer.alloc(0);
    socket.setTimeout(5000, () => socket.destroy(new Error('Local Redis test timeout')));
    socket.on('error', reject);
    socket.on('connect', () => socket.write(`*${args.length}\r\n${args.map(arg => {
      const value = String(arg); return `$${Buffer.byteLength(value)}\r\n${value}\r\n`;
    }).join('')}`));
    socket.on('data', chunk => {
      buffer = Buffer.concat([buffer, chunk]);
      try {
        const result = parse(buffer);
        if (!result) return;
        socket.destroy();
        if (result.value instanceof Error) reject(result.value); else resolve(result.value);
      } catch (error) { socket.destroy(); reject(error); }
    });
  });
}
const token = 'disposable-test-only';
function harness(t) {
  const prefix = `aialo:test:ask:${randomUUID()}:`, keys = new Set();
  t.after(async () => { if (keys.size) await redis('DEL', ...keys); });
  function namespace(command) { command[3] = prefix + command[3]; keys.add(command[3]); return command; }
  const command = (ip = '192.0.2.1') => namespace(askRateCommand(ip, token));
  return { namespace, command, keys, attempt: (ip) => redis(...command(ip)) };
}
async function now() { const [seconds, micros] = await redis('TIME'); return Number(seconds) * 1000 + Math.floor(Number(micros) / 1000); }
let serial = 0;
const fresh = async () => (await import(`../api/ask.js?realredis=${serial++}`)).default;
async function request(handler, ip = '192.0.2.1') {
  const res = { statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(v) { this.statusCode = v; return this; }, json(v) { this.body = v; return this; } };
  await handler({ method: 'POST', headers: { 'x-forwarded-for': ip }, body: { question: 'Who is Alo?' } }, res);
  return res;
}

test('Ask rolling limit executes against disposable local Redis', { skip: !configuredPort }, async t => {
  assert.equal(await redis('PING'), 'PONG');
  await t.test('12 concurrent requests across two handlers admit eight and charge cache hits before provider access', async t => {
    const h = harness(t), values = { KV_REST_API_URL: 'https://redis.invalid', KV_REST_API_TOKEN: token, ANTHROPIC_API_KEY: 'mock-only' };
    const before = Object.fromEntries(Object.keys(values).map(key => [key, process.env[key]]));
    Object.assign(process.env, values);
    t.after(() => { for (const [key, value] of Object.entries(before)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });
    let providerCalls = 0;
    t.mock.method(globalThis, 'fetch', async (url, options) => {
      if (url === 'https://redis.invalid/pipeline') {
        const commands = JSON.parse(options.body);
        assert.equal(commands.length, 1);
        try { return { ok: true, json: async () => [{ result: await redis(...h.namespace(commands[0])) }] }; }
        catch (error) { return { ok: true, json: async () => [{ error: error.message }] }; }
      }
      assert.equal(url, 'https://api.anthropic.com/v1/messages');
      providerCalls++;
      return { ok: true, json: async () => ({ content: [{ type: 'text', text: 'Mock provider answer [1]' }] }) };
    });
    const handlers = [await fresh(), await fresh()];
    const replies = await Promise.all(Array.from({ length: 12 }, (_, i) => request(handlers[i % 2])));
    assert.equal(replies.filter(reply => reply.statusCode === 200).length, 8);
    assert.equal(replies.filter(reply => reply.statusCode === 429).length, 4);
    for (const reply of replies.filter(reply => reply.statusCode === 429)) assert.ok(Number(reply.headers['Retry-After']) >= 1 && Number(reply.headers['Retry-After']) <= 60);
    const [key] = h.keys;
    assert.equal(await redis('ZCARD', key), 8);
    assert.ok(providerCalls > 0 && providerCalls <= 8);
    const calls = providerCalls;
    for (const handler of handlers) assert.equal((await request(handler)).statusCode, 429, 'A warm cache must still hit the shared limit');
    assert.equal(providerCalls, calls);
    assert.equal((await request(handlers[0], '192.0.2.2')).statusCode, 200);
    assert.equal(h.keys.size, 2, 'A second address gets a separate private key');
  });

  await t.test('rolling expiry removes only old attempts and Retry-After follows the oldest active score', async t => {
    const h = harness(t), command = h.command(), key = command[3], clock = await now();
    await redis('ZADD', key, clock - 35_000, 'oldest', ...Array.from({ length: 7 }, (_, i) => [clock, `new-${i}`]).flat());
    await redis('PEXPIRE', key, 60_000);
    const ttlBefore = await redis('PTTL', key);
    const reply = await redis(...command);
    assert.equal(reply[0], 'limited');
    const remaining = Math.max(1, Math.ceil((clock - 35_000 + 60_000 - await now()) / 1000));
    assert.ok(reply[1] >= remaining && reply[1] <= remaining + 1, 'Retry-After must use Redis time and the oldest attempt');
    assert.ok(await redis('PTTL', key) <= ttlBefore, 'A denied request must not extend expiry');
    assert.equal(await redis('ZCARD', key), 8);
    // Advance only the disposable fixture's oldest score, not the app clock or
    // production window. Its seven recent attempts must still count.
    await redis('ZADD', key, (await now()) - 60_000, 'oldest');
    assert.deepEqual(await h.attempt(), ['allowed', 0]);
    assert.equal(await redis('ZSCORE', key, 'oldest'), null);
    assert.equal(await redis('ZCARD', key), 8);
    assert.equal((await h.attempt())[0], 'limited');
    await redis('PEXPIRE', key, 1);
    await new Promise(resolve => setTimeout(resolve, 20));
    assert.equal(await redis('EXISTS', key), 0);
    assert.deepEqual(await h.attempt(), ['allowed', 0]);
    assert.equal(await redis('ZCARD', key), 1);
    assert.ok(await redis('PTTL', key) > 59_000);
  });

  await t.test('wrong key types, excessive counts, invalid scores and missing expiry fail before changes', async t => {
    for (const scenario of ['type', 'count', 'fractional-score', 'negative-score', 'future-score', 'no-expiry']) {
      const h = harness(t), command = h.command(), key = command[3], clock = await now();
      if (scenario === 'type') await redis('SET', key, 'wrong-type', 'PX', 60_000);
      else {
        const score = scenario === 'fractional-score' ? clock - 0.5 : scenario === 'negative-score' ? -1 : scenario === 'future-score' ? clock + 60_000 : clock;
        await redis('ZADD', key, score, 'existing');
        if (scenario === 'count') await redis('ZADD', key, ...Array.from({ length: 8 }, (_, i) => [clock, `excess-${i}`]).flat());
        if (scenario !== 'no-expiry') await redis('PEXPIRE', key, 60_000);
      }
      const before = scenario === 'type' ? await redis('GET', key) : await redis('ZRANGE', key, 0, -1, 'WITHSCORES');
      await assert.rejects(redis(...command), /Invalid Ask rate/, scenario);
      assert.deepEqual(scenario === 'type' ? await redis('GET', key) : await redis('ZRANGE', key, 0, -1, 'WITHSCORES'), before);
    }
  });
});
