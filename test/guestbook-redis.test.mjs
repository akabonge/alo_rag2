import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { randomUUID } from 'node:crypto';
import { saveNoteCommand, RECEIPT_TTL } from '../lib/guestbook-store.js';

// Optional locally; required in CI with a disposable Redis service. Only loopback
// is supported. Never read production Redis credentials and never flush a database.
const configuredPort = process.env.GUESTBOOK_REDIS_TEST_PORT;
function parse(buffer, offset = 0) {
  const end = buffer.indexOf('\r\n', offset);
  if (end < 0) return;
  const kind = String.fromCharCode(buffer[offset]);
  const line = buffer.toString('utf8', offset + 1, end);
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
  assert.ok(Number.isInteger(port) && port > 0 && port <= 65535, 'Use a valid local Redis test port');
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: '127.0.0.1', port });
    let buffer = Buffer.alloc(0);
    socket.setTimeout(5000, () => socket.destroy(new Error('Local Redis test timeout')));
    socket.on('error', reject);
    socket.on('connect', () => socket.write(`*${args.length}\r\n${args.map((arg) => {
      const value = String(arg);
      return `$${Buffer.byteLength(value)}\r\n${value}\r\n`;
    }).join('')}`));
    socket.on('data', (chunk) => {
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
function harness(t) {
  const prefix = `aialo:test:${randomUUID()}:`;
  const keys = new Set();
  t.after(async () => { if (keys.size) await redis('DEL', ...keys); });
  const command = (note, ip = '192.0.2.1', id = randomUUID()) => {
    const args = saveNoteCommand(note, ip, id);
    for (let i = 3; i < 3 + args[2]; i++) { args[i] = prefix + args[i]; keys.add(args[i]); }
    return args;
  };
  return { command, save: (...args) => redis(...command(...args)) };
}
const note = { name: 'Local test', city: 'Kampala', msg: 'Hello', t: 1000 };

test('Guestbook Lua runs against disposable local Redis', { skip: !configuredPort }, async (t) => {
  assert.equal(await redis('PING'), 'PONG');
  await t.test('concurrent same-ID saves create one note and charge quota once; replay precedes quota', async (t) => {
    const h = harness(t), id = randomUUID();
    const command = h.command(note, '192.0.2.1', id);
    const replies = await Promise.all(Array.from({ length: 24 }, (_, i) => h.save({ ...note, t: 1000 + i }, '192.0.2.1', id)));
    assert.equal(replies.filter(([status]) => status === 'saved').length, 1);
    assert.equal(replies.filter(([status]) => status === 'replayed').length, 23);
    assert.equal(new Set(replies.map(([, raw]) => raw)).size, 1);
    assert.equal(await redis('LLEN', command[3]), 1);
    assert.equal(await redis('GET', command[4]), '1');
    const ttl = await redis('TTL', command[5]);
    assert.ok(ttl > RECEIPT_TTL - 10 && ttl <= RECEIPT_TTL);
    assert.deepEqual(Object.keys(JSON.parse(replies[0][1])).sort(), ['city', 'msg', 'name', 't']);
    await redis('SET', command[4], 3, 'EX', 30);
    assert.equal((await h.save({ ...note, t: 9999 }, '192.0.2.1', id))[0], 'replayed');
    const newIP = h.command(note, '192.0.2.2', id);
    assert.equal((await redis(...newIP))[0], 'replayed', 'Mobile IP changes must not duplicate a saved note');
    assert.equal(await redis('GET', newIP[4]), null);
    assert.equal(await redis('GET', command[4]), '3');
  });

  await t.test('same ID with changed content conflicts without another note or quota charge', async (t) => {
    const h = harness(t), id = randomUUID();
    const command = h.command(note, undefined, id);
    assert.equal((await redis(...command))[0], 'saved');
    assert.deepEqual(await h.save({ ...note, msg: 'Different' }, undefined, id), ['conflict']);
    assert.equal(await redis('LLEN', command[3]), 1);
    assert.equal(await redis('GET', command[4]), '1');
  });

  await t.test('quota is shared and fixed; rejected posts do not extend expiry', async (t) => {
    const h = harness(t);
    const first = h.command(note);
    await redis(...first);
    await redis('PEXPIRE', first[4], 5000);
    const secondID = randomUUID(), thirdID = randomUUID();
    assert.equal((await h.save(note, undefined, secondID))[0], 'saved');
    assert.equal((await h.save(note, undefined, thirdID))[0], 'saved');
    const before = await redis('PTTL', first[4]);
    const rejected = h.command(note);
    const reply = await redis(...rejected);
    assert.equal(reply[0], 'rate_limited');
    assert.ok(Number(reply[1]) >= 1 && Number(reply[1]) <= 5);
    assert.ok(await redis('PTTL', first[4]) <= before);
    assert.equal(await redis('GET', first[4]), '3');
    assert.equal(await redis('GET', rejected[5]), null);
    assert.equal(await redis('LLEN', first[3]), 3);
    await redis('PEXPIRE', first[4], 1);
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal((await redis(...rejected))[0], 'saved');
    assert.equal(await redis('GET', first[4]), '1');
    assert.ok(await redis('TTL', first[4]) > 3590);
  });

  await t.test('legacy posts remain valid and storage stays capped at 300 notes', async (t) => {
    const h = harness(t);
    const command = h.command(note, undefined, null);
    assert.equal(command[2], 2);
    await redis('RPUSH', command[3], ...Array.from({ length: 305 }, (_, t) => JSON.stringify({ ...note, t })));
    assert.equal((await redis(...command))[0], 'saved');
    assert.equal((await h.save({ ...note, t: 1001 }, undefined, null))[0], 'saved');
    assert.equal(await redis('LLEN', command[3]), 300);
    assert.equal(await redis('GET', command[4]), '2');
    assert.equal(JSON.parse(await redis('LINDEX', command[3], 0)).t, 1001);
  });

  await t.test('wrong types and corrupt quota/receipt values fail before writing', async (t) => {
    for (const scenario of ['list-type', 'rate-type', 'rate-value', 'rate-leading-zero', 'rate-no-expiry', 'receipt-type', 'receipt-value']) {
      const h = harness(t), command = h.command(note);
      const [, , , listKey, rateKey, receiptKey] = command;
      if (scenario === 'list-type') await redis('SET', listKey, 'wrong-type');
      if (scenario === 'rate-type') await redis('LPUSH', rateKey, 'wrong-type');
      if (scenario === 'rate-value') await redis('SET', rateKey, '1.5', 'EX', 3600);
      if (scenario === 'rate-leading-zero') await redis('SET', rateKey, '01', 'EX', 3600);
      if (scenario === 'rate-no-expiry') await redis('SET', rateKey, '1');
      if (scenario === 'receipt-type') await redis('LPUSH', receiptKey, 'wrong-type');
      if (scenario === 'receipt-value') await redis('SET', receiptKey, '{}', 'EX', RECEIPT_TTL);
      await assert.rejects(redis(...command), /Invalid/);
      if (scenario !== 'list-type') assert.equal(await redis('EXISTS', listKey), 0, scenario);
      if (!scenario.startsWith('rate')) assert.equal(await redis('EXISTS', rateKey), 0, scenario);
      if (!scenario.startsWith('receipt')) assert.equal(await redis('EXISTS', receiptKey), 0, scenario);
      if (scenario === 'rate-leading-zero') assert.equal(await redis('GET', rateKey), '01');
    }
  });

  await t.test('a replay never reinserts a note removed by moderation', async (t) => {
    const h = harness(t), id = randomUUID(), command = h.command(note, undefined, id);
    const saved = await redis(...command);
    await redis('LREM', command[3], 0, saved[1]);
    assert.deepEqual(await h.save({ ...note, t: 2000 }, undefined, id), ['replayed', saved[1]]);
    assert.equal(await redis('LLEN', command[3]), 0);
    assert.equal(await redis('GET', command[4]), '1');
  });
});
