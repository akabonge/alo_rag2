import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const main = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const start = main.indexOf('    // performance watchdog:');
const end = main.indexOf('\n  });', start);
assert.ok(start >= 0 && end > start, 'Update watchdog extraction after scene restructuring');
const watchdog = new vm.Script(main.slice(start, end));

test('Slow rendering still downgrades and offers the text path with decorative time frozen', () => {
  const actions = [];
  const ctx = vm.createContext({ frames: 0, slow: 0, watched: false, performanceElapsed: 5, raw: 0.04, t: 0, dt: 0, tier: 'high',
    HIGH() { return ctx.tier === 'high'; }, applyTier() { actions.push('low'); }, offerLite(reason) { actions.push(reason); },
  });
  for (let i = 0; i < 300; i++) watchdog.runInContext(ctx);
  assert.deepEqual(actions, ['low', 'slow']);
  assert.equal(ctx.watched, true);
});

test('Healthy frame timing completes measurement while animation is paused', () => {
  const ctx = vm.createContext({ frames: 0, slow: 0, watched: false, performanceElapsed: 5, raw: 1 / 60, t: 0, dt: 0,
    HIGH: () => true, applyTier: () => assert.fail('Healthy renderer should retain its tier'), offerLite: () => assert.fail('No slow-render offer expected'),
  });
  for (let i = 0; i < 150; i++) watchdog.runInContext(ctx);
  assert.equal(ctx.frames, 150);
  assert.equal(ctx.slow, 0);
  assert.equal(ctx.watched, true);
});

test('Motion toggles after graphics failure retain native scrolling', () => {
  const start = main.indexOf('function updateMotion() {');
  const end = main.indexOf('\nmotionPreference.addEventListener', start);
  assert.ok(start > 0 && end > start);
  let creations = 0, destructions = 0;
  const ctx = vm.createContext({ sceneFailed: true, reduced: true, appliedMotionPreference: true, motionPaused: false, motionPreference: { matches: false }, lenis: { destroy() { destructions++; } },
    Lenis: class { constructor() { creations++; } }, endTour() {}, stopFlight() {}, finishIntro() {},
    document: { querySelector: () => null, documentElement: { classList: { toggle() {} } }, querySelectorAll: () => [] },
  });
  vm.runInContext(main.slice(start, end), ctx);
  for (const paused of [false, true, false]) { ctx.motionPaused = paused; ctx.updateMotion(); }
  assert.equal(creations, 0);
  assert.equal(destructions, 1);
  assert.equal(ctx.lenis, null);
});

test('A missed media-query event reconciles on a frame without resetting manual pause', () => {
  const start = main.indexOf('function updateMotion() {');
  const end = main.indexOf('\nmotionPreference.addEventListener', start);
  let creations = 0;
  const button = { setAttribute() {} };
  const ctx = vm.createContext({ sceneFailed: false, reduced: true, appliedMotionPreference: true, motionPaused: false, motionPreference: { matches: false }, lenis: null,
    Lenis: class { constructor() { creations++; } destroy() {} }, endTour() {}, stopFlight() {}, finishIntro() {},
    document: { querySelector: () => null, documentElement: { classList: { toggle() {} } }, querySelectorAll: () => [button] },
  });
  vm.runInContext(main.slice(start, end), ctx);
  ctx.syncMotionPreference();
  assert.equal(ctx.reduced, false);
  assert.equal(creations, 1);
  ctx.syncMotionPreference();
  assert.equal(creations, 1, 'Unchanged media must not recreate scrolling every frame');
  ctx.motionPaused = true; ctx.updateMotion();
  ctx.motionPreference.matches = true; ctx.syncMotionPreference();
  assert.equal(button.disabled, true);
  ctx.motionPreference.matches = false; ctx.syncMotionPreference();
  assert.equal(button.disabled, false);
  assert.equal(ctx.motionPaused, true);
  assert.equal(ctx.reduced, true);
  assert.equal(ctx.lenis, null);
});
