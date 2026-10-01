import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as THREE from 'three';
import { createImageLoader, createStationMedia } from '../src/media.js';

const images = { umw: { src: '/umw.jpg' }, proofmode: { src: '/proof.jpg' }, finale: { src: '/finale.jpg' } };
const flush = () => new Promise((resolve) => setImmediate(resolve));
function fakeImages(cached = false) {
  const instances = [];
  class ImageType {
    constructor() { instances.push(this); this.naturalWidth = this.naturalHeight = 0; }
    set src(value) { this.url = value; if (cached) this.complete(800, 1000); }
    complete(width = 800, height = 1000) { this.naturalWidth = width; this.naturalHeight = height; this.onload?.(); }
    fail() { this.onerror?.(); }
  }
  return { instances, ImageType };
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function stationHarness() {
  const requested = [], applied = [], jobs = new Map();
  let active = true;
  const entries = [['umw', 2], ['proofmode', 4], ['finale', 9]].map(([key, station]) => ({ key, station, apply: (image) => applied.push({ key, image }) }));
  const update = createStationMedia(entries, (key) => {
    requested.push(key); const job = deferred(); jobs.set(key, job); return job.promise;
  }, () => active);
  return { update, requested, applied, jobs, stop: () => { active = false; } };
}

test('image loader is demand-driven and shares pending and completed requests', async () => {
  const fake = fakeImages(), loader = createImageLoader(images, fake.ImageType);
  assert.equal(fake.instances.length, 0);
  assert.equal(await loader.load('missing'), null);
  const first = loader.load('umw'), second = loader.load('umw');
  assert.equal(first, second);
  assert.equal(fake.instances.length, 1);
  assert.equal(fake.instances[0].url, '/umw.jpg');
  fake.instances[0].complete(1800, 947);
  assert.equal(await first, fake.instances[0]);
  assert.equal(await loader.load('umw'), fake.instances[0]);
  assert.equal(fake.instances.length, 1);
  assert.equal(fake.instances[0].onload, null);
  assert.equal(fake.instances[0].onerror, null);
});

test('broken or invalid-dimension photos resolve to a stand-in and do not retry every frame', async () => {
  for (const dimensions of [null, [0, 100], [100, 0], [-1, 100], [NaN, 100], [100, Infinity], ['100', 100], [8000, 10], [10, 8000], [199, 800], [800, 199]]) {
    const fake = fakeImages(), loader = createImageLoader(images, fake.ImageType), result = loader.load('umw');
    if (dimensions) fake.instances[0].complete(...dimensions); else fake.instances[0].fail();
    assert.equal(await result, null);
    assert.equal(loader.failed.has('umw'), true);
    assert.equal(await loader.load('umw'), null);
    assert.equal(fake.instances.length, 1);
  }
});

test('valid landscape and portrait ratios, including the allowed boundaries, remain usable', async () => {
  for (const [width, height] of [[1800, 947], [800, 1000], [200, 800], [800, 200]]) {
    const fake = fakeImages(), loader = createImageLoader(images, fake.ImageType);
    const pending = loader.load('umw');
    fake.instances[0].complete(width, height);
    assert.equal(await pending, fake.instances[0]);
    assert.equal(loader.failed.has('umw'), false);
  }
});

test('current-station requests use normal priority while lookahead requests remain low priority', async () => {
  const fake = fakeImages(), loader = createImageLoader(images, fake.ImageType);
  const update = createStationMedia([
    { key: 'umw', station: 2, apply() {} },
    { key: 'proofmode', station: 4, apply() {} },
    { key: 'finale', station: 9, apply() {} },
  ], loader.load, () => true);
  update(1); update(4); update(9, true);
  assert.deepEqual(fake.instances.map((image) => [image.url, image.fetchPriority]), [
    ['/umw.jpg', 'low'], ['/proof.jpg', 'auto'], ['/finale.jpg', 'auto'],
  ]);
  update(2); update(4); update(9);
  assert.equal(fake.instances.length, 3, 'Priority changes must not cause duplicate image requests');
  fake.instances.forEach((image) => image.complete());
  await flush();
});

test('cached and delayed images hydrate asynchronously exactly once across repeated station frames', async () => {
  for (const cached of [false, true]) {
    const fake = fakeImages(cached), loader = createImageLoader(images, fake.ImageType), applied = [];
    const update = createStationMedia([{ key: 'umw', station: 2, apply: (image) => applied.push(image) }], loader.load, () => true);
    for (let frame = 0; frame < 200; frame++) update(2);
    assert.equal(fake.instances.length, 1);
    assert.equal(applied.length, 0, 'Hydration must not execute inside the scheduling call, even on a cache hit');
    if (!cached) { await flush(); assert.equal(applied.length, 0); fake.instances[0].complete(); }
    await flush();
    assert.deepEqual(applied, [fake.instances[0]]);
    for (let frame = 0; frame < 200; frame++) update(2);
    await flush();
    assert.equal(applied.length, 1, 'Completed media must not upload its texture again on every frame');
  }
});

test('station scheduling follows rapid jumps without loading every intermediate photo', async () => {
  const h = stationHarness();
  h.update(0);
  assert.deepEqual(h.requested, []);
  h.update(1); h.update(9); h.update(4); h.update(9);
  assert.deepEqual(h.requested, ['umw', 'finale', 'proofmode']);
  h.jobs.get('finale').resolve({ name: 'last station first' });
  h.jobs.get('umw').resolve({ name: 'late first station' });
  h.jobs.get('proofmode').resolve(null);
  await flush();
  assert.deepEqual(h.applied.map(({ key }) => key), ['finale', 'umw']);
  h.update(4);
  assert.equal(h.requested.length, 3, 'A missing optional image must not create a request loop');
});

test('Save-Data suppresses neighboring-station prefetch but still permits the current station', async () => {
  const h = stationHarness();
  h.update(1, true); h.update(3, true); h.update(8, true);
  assert.deepEqual(h.requested, []);
  h.update(2, true);
  assert.deepEqual(h.requested, ['umw']);
  h.update(3, false);
  assert.deepEqual(h.requested, ['umw', 'proofmode']);
  h.update(9, true);
  assert.deepEqual(h.requested, ['umw', 'proofmode', 'finale']);
  for (const job of h.jobs.values()) job.resolve(null);
  await flush();
});

test('inactive scenes neither request new media nor apply in-flight results', async () => {
  const h = stationHarness();
  h.update(2);
  h.stop(); h.update(9);
  h.jobs.get('umw').resolve({ name: 'arrived after context loss' });
  await flush();
  assert.deepEqual(h.requested, ['umw']);
  assert.deepEqual(h.applied, []);
});

test('rejected loads and failed enhancements leave other station media operational', async () => {
  const calls = [];
  const update = createStationMedia([
    { key: 'rejected', station: 1, apply: () => assert.fail('Rejected image was applied') },
    { key: 'broken-canvas', station: 3, apply: () => { throw new Error('Canvas unavailable'); } },
    { key: 'valid', station: 9, apply: () => calls.push('valid') },
  ], (key) => key === 'rejected' ? Promise.reject(new Error('Network unavailable')) : Promise.resolve({}), () => true);
  update(1); update(3); update(9);
  await flush();
  assert.deepEqual(calls, ['valid']);
  const throwingLoader = createImageLoader(images, class { constructor() { throw new Error('Image allocation failed'); } });
  const failed = createStationMedia([{ key: 'umw', station: 2, apply: () => assert.fail('Failed allocation was applied') }], throwingLoader.load, () => true);
  failed(2); await flush();
});

// Small actual-source integration checks: keep the consumers and WebGL loss
// handler under test without evaluating the whole app or creating a renderer.
const source = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
function section(start, end) {
  const from = source.indexOf(start), to = source.indexOf(end, from);
  assert.ok(from >= 0 && to > from, 'Media consumer boundaries moved; update the extraction.');
  return source.slice(from, to);
}
function fakeCanvas() {
  const calls = [], context = { calls, failDraw: false };
  for (const name of ['fillRect', 'beginPath', 'arc', 'fill', 'roundRect', 'fillText', 'clearRect']) context[name] = (...args) => calls.push({ name, args });
  context.drawImage = (...args) => { if (context.failDraw) throw new Error('Draw failed'); calls.push({ name: 'drawImage', args }); };
  return { width: 640, height: 800, getContext: () => context, context };
}

test('actual welcome badge reveals cached and late photos while leaving broken media behind its reserved fallback', () => {
  const code = section("{ const badge = $('#portrait-badge');", 'const photo =');
  for (const cached of [false, true]) {
    const classes = new Set(), events = new Map();
    const badge = {
      complete: cached, naturalWidth: cached ? 900 : 0,
      classList: { add: (name) => classes.add(name) },
      addEventListener: (name, handler) => events.set(name, handler),
    };
    vm.runInNewContext(code, { $: () => badge });
    assert.equal(classes.has('loaded'), cached);
    if (!cached) { badge.naturalWidth = 900; events.get('load')(); }
    assert.equal(classes.has('loaded'), true);
  }
  const classes = new Set();
  const broken = { complete: true, naturalWidth: 0, classList: { add: (name) => classes.add(name) }, addEventListener() {} };
  vm.runInNewContext(code, { $: () => broken });
  assert.equal(classes.has('loaded'), false);
});

test('actual WebGL context-loss handler prevents a queued enhancement and stops rendering', async () => {
  let lost, failCount = 0, destroyed = 0;
  const loops = [], context = {
    canvas: { addEventListener: (name, fn) => { if (name === 'webglcontextlost') lost = fn; } },
    renderer: { setAnimationLoop: (loop) => loops.push(loop) },
    lenis: { destroy: () => destroyed++ }, window: { portfolioBoot: { fail: () => failCount++ } },
  };
  const handler = source.split('\n').find((line) => line.includes("canvas.addEventListener('webglcontextlost'"));
  assert.ok(handler);
  vm.runInNewContext('let sceneFailed = false;\n' + handler + '\nglobalThis.active = () => !sceneFailed;', context);
  const job = deferred(), applied = [];
  const update = createStationMedia([{ key: 'umw', station: 2, apply: (image) => applied.push(image) }], () => job.promise, context.active);
  update(2);
  let prevented = false;
  lost({ preventDefault: () => { prevented = true; } });
  job.resolve({}); await flush();
  assert.equal(prevented, true);
  assert.equal(context.active(), false);
  assert.deepEqual(loops, [null]);
  assert.equal(destroyed, 1);
  assert.equal(failCount, 1);
  assert.deepEqual(applied, []);
});

test('actual UMW attachment uses late dimensions and registers one working postcard target', () => {
  const targets = [], opened = [], globe = new THREE.Group();
  const context = {
    THREE, globe, globeInner: new THREE.Group(), B: new THREE.Vector3(1, 2, 3),
    U: { uTime: { value: 0 } }, SIGNAL: new THREE.Color(0x6fe3d6), linkHover: {}, tween() {},
    label: () => new THREE.Sprite(), register: (mesh, entry) => targets.push({ mesh, entry }),
    openDrawer: (key) => opened.push(key),
  };
  vm.runInNewContext(section('  let postcard = null,', '  // A comet') + '\nglobalThis.attach = addPostcard;', context);
  const image = { naturalWidth: 1800, naturalHeight: 947 };
  context.attach(image); context.attach(image);
  assert.equal(targets.length, 1);
  assert.equal(targets[0].mesh.geometry.parameters.height, 5.2 * 947 / 1800);
  assert.equal(targets[0].mesh.material.uniforms.uMap.value.image, image);
  assert.equal(targets[0].mesh.material.uniforms.uMap.value.colorSpace, THREE.SRGBColorSpace);
  assert.equal(globe.children.length, 2, 'One postcard and one tether should attach');
  assert.equal(context.linkHover['exp:umw'], targets[0].entry.hover);
  targets[0].entry.click();
  assert.deepEqual(opened, ['exp:umw']);
});

test('actual ProofMode enhancement widens its pick target once and preserves image proportions', () => {
  const canvases = [], proof = new THREE.Group();
  const context = {
    THREE, proof, U: { uTime: { value: 0 } }, docU: { uHover: { value: 0 } },
    doc: new THREE.Object3D(), seal: new THREE.Object3D(), seal2: new THREE.Object3D(), checkRing: new THREE.Group(),
    label: () => new THREE.Sprite(), document: { createElement: () => { const canvas = fakeCanvas(); canvases.push(canvas); return canvas; } },
  };
  vm.runInNewContext(section('  const screenU =', '  const proofEntry =') + '\nglobalThis.attach = addProofScreen; globalThis.hit = proofHit;', context);
  assert.equal(context.hit.geometry.parameters.width * context.hit.scale.x, 3.6);
  const image = { naturalWidth: 1400, naturalHeight: 733 };
  context.attach(image); context.attach(image);
  assert.equal(canvases.length, 1);
  assert.ok(Math.abs(context.hit.geometry.parameters.width * context.hit.scale.x - 7.4) < 1e-12);
  const screen = proof.children.find((child) => child.geometry?.type === 'PlaneGeometry');
  assert.equal(screen.geometry.parameters.height, 4.6 * 789 / 1400);
  assert.equal(screen.material.uniforms.uMap.value.colorSpace, THREE.SRGBColorSpace);
  assert.deepEqual(context.doc.position.toArray(), [1.5, 0.7, -0.6]);
  assert.deepEqual(context.checkRing.position.toArray(), context.doc.position.toArray());
});

test('actual finale painter uploads once when scheduled and preserves its stand-in if drawing fails', async () => {
  const canvas = fakeCanvas(), texture = new THREE.CanvasTexture(canvas), context = { holoCanvas: canvas, holoTex: texture };
  vm.runInNewContext(section('  function paintHolo(im)', '  const holoU =') + '\nglobalThis.paint = paintHolo;', context);
  const version = texture.version, image = { naturalWidth: 800, naturalHeight: 1000 };
  const update = createStationMedia([{ key: 'finale', station: 9, apply: context.paint }], () => Promise.resolve(image), () => true);
  for (let frame = 0; frame < 100; frame++) update(9);
  await flush();
  assert.equal(texture.version, version + 1);
  assert.equal(canvas.context.calls.filter(({ name }) => name === 'drawImage').length, 1);
  assert.deepEqual(canvas.context.calls[0].args, [image, 0, 0, 640, 800]);
  canvas.context.failDraw = true;
  const failed = createStationMedia([{ key: 'finale', station: 9, apply: context.paint }], () => Promise.resolve(image), () => true);
  failed(9); await flush();
  assert.equal(texture.version, version + 1);
  assert.equal(canvas.context.calls.some(({ name }) => name === 'clearRect'), false);
});
