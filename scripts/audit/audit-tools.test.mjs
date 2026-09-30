import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { parseOptions, isWithin, mirroredFile, outputDirectory, networkMeter, summarizeFindings } from './audit-core.mjs';
import { parseTickets, planLinks, linkedBody, marker } from '../roadmap/issue-core.mjs';

test('audit CLI rejects unknown/empty selections and invalid budgets', () => {
  for (const args of [['--devices', ''], ['--devices', 'unknown'], ['--devices', 'iphone-se,'], ['--budget-mb', 'NaN'], ['--budget-ready', '0'], ['--wat'], ['--url', 'file:///tmp/site'], ['--url', 'https://secret@example.org/']]) assert.throws(() => parseOptions(args));
  assert.deepEqual(parseOptions(['--devices', 'iphone-se,laptop,iphone-se']).devices, ['iphone-se', 'laptop']);
  assert.equal(parseOptions([]).enforce, undefined);
});

test('local mirror and output paths remain bounded', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'alo-audit-test-'));
  t.after(() => {
    const resolved = fs.realpathSync(root);
    assert.ok(isWithin(fs.realpathSync(os.tmpdir()), resolved));
    assert.match(path.basename(resolved), /^alo-audit-test-/);
    fs.rmSync(resolved, { recursive: true });
  });
  const packages = path.join(root, 'node_modules');
  fs.mkdirSync(path.join(packages, 'three', 'build'), { recursive: true });
  fs.writeFileSync(path.join(packages, 'three', 'build', 'module.js'), 'export const ok = true;');
  assert.equal(mirroredFile(packages, 'https://cdn.jsdelivr.net/npm/three@0.186.1/build/module.js'), fs.realpathSync(path.join(packages, 'three', 'build', 'module.js')));
  assert.equal(mirroredFile(packages, 'https://cdn.jsdelivr.net/npm/three@0.186.1/build%2f..%2f..%2fsecret'), null);
  assert.equal(mirroredFile(packages, 'https://other.example/npm/three@0.186.1/build/module.js'), null);
  assert.throws(() => outputDirectory(root, '../outside'));
  assert.throws(() => outputDirectory(root, 'audit-output'));
  assert.equal(outputDirectory(root, 'audit-output/safe'), path.join(root, 'audit-output', 'safe'));
});

test('initial network snapshot awaits its requests, separates encoded/decoded bytes and excludes later requests', async () => {
  const page = new EventEmitter(), meter = networkMeter(page);
  const first = { url: () => 'https://example.org/first.js?private=excluded', sizes: async () => ({ responseBodySize: 100, responseHeadersSize: 20 }) };
  let release;
  page.emit('request', first);
  page.emit('response', { request: () => first, finished: () => new Promise((resolve) => { release = resolve; }), body: async () => Buffer.alloc(1000) });
  const snapshot = meter.snapshot();
  const later = { url: () => 'https://example.org/lazy.jpg', sizes: async () => ({ responseBodySize: 200, responseHeadersSize: 30 }) };
  page.emit('request', later);
  page.emit('response', { request: () => later, finished: async () => null, body: async () => Buffer.alloc(2000) });
  release(null);
  const initial = await snapshot;
  assert.equal(initial.requests, 1);
  assert.equal(initial.encodedBodyBytes, 100);
  assert.equal(initial.transferBytes, 120);
  assert.equal(initial.decodedBodyBytes, 1000);
  assert.equal(initial.pendingRequests, 0);
  assert.equal(initial.entries[0].url, 'https://example.org/first.js');
  assert.equal((await meter.snapshot()).transferBytes, 350);
  assert.equal(initial.transferBytes, 120, 'Later accounting cannot mutate the frozen initial result');
});

test('unfinished network requests are reported as incomplete instead of invented zero-byte success', async () => {
  const page = new EventEmitter(), meter = networkMeter(page);
  page.emit('request', { url: () => 'https://example.org/hung.js' });
  const result = await meter.snapshot(1);
  assert.equal(result.pendingRequests, 1);
  assert.equal(result.completeRequests, 0);
});

test('tap occurrences and distinct controls are counted separately across repeated stations and profiles', () => {
  const station = { smallTaps: [{ key: '#ask-toggle' }] };
  assert.deepEqual(summarizeFindings({ phone: { stations: { hero: station, contact: station } }, tablet: { stations: { hero: station } } }), {
    smallTapOccurrences: 3, uniqueSmallTapTargets: 1, uniqueSmallTapDevicePairs: 2,
  });
});

test('roadmap IDs map to existing issues regardless of changed titles, and duplicate mappings fail', () => {
  const tasks = parseTickets('### M1 Mobile controls\n\n### O1 Optional analytics\n');
  assert.throws(() => parseTickets('### M1 One\n### M1 Two\n'));
  const issues = [{ number: 11, title: 'Renamed UX issue', body: marker('M1'), state: 'open' }];
  const plan = planLinks(tasks, { M1: 11, O1: null }, issues, true);
  assert.equal(plan[0].action, 'already-linked');
  assert.equal(plan[1].action, 'deferred');
  assert.throws(() => planLinks(tasks, { M1: 11, O1: null }, [...issues, { number: 90, title: 'M1: Old duplicate' }], true));
  assert.throws(() => planLinks(tasks, { M1: 11, O1: null }, [], true));
  assert.throws(() => planLinks(tasks, {}, [], false));
});

test('issue body updates preserve existing content and checkbox state and are idempotent', () => {
  const tasks = [{ id: 'M1', title: 'Mobile controls' }, { id: 'M4', title: 'Hero' }];
  const original = '# Existing acceptance criteria\nKeep this text.';
  const once = linkedBody(original, tasks.slice(0, 1), 'akabonge/alo_rag2');
  const completed = once.replace('- [ ]', '- [x]');
  const twice = linkedBody(completed, tasks, 'akabonge/alo_rag2');
  assert.ok(twice.startsWith(original));
  assert.match(twice, /- \[x\] <!-- alo-roadmap:M1 -->/);
  assert.equal(twice.split(marker('M1')).length, 2);
  assert.equal(linkedBody(twice, tasks, 'akabonge/alo_rag2'), twice);
  assert.throws(() => linkedBody('<!-- alo-roadmap-map:start --> malformed', tasks, 'akabonge/alo_rag2'));
  assert.throws(() => linkedBody(once + once, tasks, 'akabonge/alo_rag2'));
});
