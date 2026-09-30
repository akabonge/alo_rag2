import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as THREE from 'three';

// Execute the actual rebuild function with real Three.js ownership/dispose events.
// Labels use blank textures so this needs no browser, canvas, renderer or network.
const source = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const start = source.indexOf('  let visItems = []');
const end = source.indexOf('  guest.onChange =', start);
assert.ok(start >= 0 && end > start, 'Visitor sky section moved; update harness boundaries.');

function harness() {
  const vis = new THREE.Group(), glowTex = new THREE.Texture();
  const unrelated = new THREE.Object3D(), hits = [unrelated], messages = [], counter = {};
  const context = {
    THREE, vis, glowTex, hits, GOLD: new THREE.Color(0xe8b54a),
    $: () => counter, hash01: () => 0.5,
    gsap: { killTweensOf() {} }, tween() {}, audio: { ping() {} }, toast: (text) => messages.push(text),
    register: (object, entry) => { object.userData.hit = entry; hits.push(object); },
    label: () => new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.Texture() })),
  };
  vm.runInNewContext(source.slice(start, end) + '\nglobalThis.sky = { rebuild: buildVisitorSky, state: () => ({ items: visItems, line: visLine, empty: visEmpty }) };', context);
  return { ...context.sky, vis, glowTex, hits, unrelated, messages, counter };
}

const notes = (count, prefix = 'Visitor') => Array.from({ length: count }, (_, i) => ({ name: `${prefix} ${i}`, city: 'Kampala', msg: `Hello ${i}`, t: i }));
function disposalCounts(resources) {
  const counts = new Map(resources.map((resource) => [resource, 0]));
  for (const resource of counts.keys()) resource.addEventListener('dispose', () => counts.set(resource, counts.get(resource) + 1));
  return counts;
}

test('visitor rebuilds keep only current pick targets and preserve unrelated scene targets', () => {
  const sky = harness();
  for (let revision = 0; revision < 4; revision++) {
    const oldHits = sky.hits.slice(1);
    sky.rebuild(notes(75, `Revision ${revision}`));
    assert.equal(sky.hits.length, 61, 'Only the 60 visible visitor stars should be pickable');
    assert.equal(sky.hits[0], sky.unrelated);
    assert.ok(oldHits.every((hit) => !sky.hits.includes(hit)), 'Removed notes must not remain raycast targets');
    assert.ok(sky.hits.slice(1).every((hit) => hit.parent?.parent === sky.vis));
    sky.hits[1].userData.hit.click();
    assert.match(sky.messages.at(-1), new RegExp(`Revision ${revision} 0`));
  }
  sky.rebuild([]);
  assert.deepEqual(sky.hits, [sky.unrelated]);
  assert.equal(sky.counter.textContent, 'No stars yet');
});

test('rebuild disposes per-note and connection resources exactly once without disposing shared sprite assets', () => {
  const sky = harness();
  sky.rebuild(notes(2));
  const previous = sky.state();
  const owned = previous.items.flatMap(({ star, tag, hit }) => [star.material, tag.material.map, tag.material, hit.geometry, hit.material]);
  owned.push(previous.line.geometry, previous.line.material);
  const disposed = disposalCounts(owned);
  const shared = disposalCounts([sky.glowTex, previous.items[0].star.geometry, previous.items[0].tag.geometry]);
  sky.rebuild(notes(1, 'Replacement'));
  sky.rebuild([]);
  assert.ok([...disposed.values()].every((count) => count === 1), 'Every replaced owned resource should be released exactly once');
  assert.ok([...shared.values()].every((count) => count === 0), 'Shared glow texture and Sprite geometry must remain usable');
  assert.ok(previous.items.every(({ g }) => g.parent === null && g.children.length === 0));
});

test('empty-state labels release their unique texture and material on subsequent updates', () => {
  const sky = harness();
  sky.rebuild([]);
  const first = sky.state().empty, disposed = disposalCounts([first.material, first.material.map]);
  const shared = disposalCounts([first.geometry, sky.glowTex]);
  sky.rebuild([]);
  const second = sky.state().empty, nextDisposed = disposalCounts([second.material, second.material.map]);
  sky.rebuild(notes(1));
  assert.ok([...disposed.values(), ...nextDisposed.values()].every((count) => count === 1));
  assert.ok([...shared.values()].every((count) => count === 0));
  assert.equal(sky.state().empty, null);
  assert.equal(sky.vis.children.length, 1);
});
