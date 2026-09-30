import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchJSON } from '../src/network.js';

test('client network requests forward data and surface service errors', async (t) => {
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    assert.equal(options.method, 'POST');
    assert.equal(options.body, '{"question":"Alo"}');
    assert.ok(options.signal instanceof AbortSignal);
    return new Response(JSON.stringify({ error: 'Try again later' }), { status: 429 });
  });
  await assert.rejects(fetchJSON('/api/ask', { method: 'POST', body: '{"question":"Alo"}' }), /Try again later/);
});

test('client timeout aborts a hung connection', async (t) => {
  let aborted = false;
  t.mock.method(globalThis, 'fetch', async (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => { aborted = true; reject(new DOMException('Aborted', 'AbortError')); }, { once: true });
  }));
  await assert.rejects(fetchJSON('/api/ask', { timeout: 10 }), { name: 'AbortError' });
  assert.equal(aborted, true);
});

test('replacing an interaction aborts its active connection', async (t) => {
  const controller = new AbortController();
  t.mock.method(globalThis, 'fetch', async (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
  }));
  const request = fetchJSON('/api/ask', { signal: controller.signal });
  controller.abort();
  await assert.rejects(request, { name: 'AbortError' });
});

test('malformed JSON cannot become a successful client response', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('<html>Service unavailable</html>'));
  await assert.rejects(fetchJSON('/api/ask'), SyntaxError);
});
