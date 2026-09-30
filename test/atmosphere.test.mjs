import test from 'node:test';
import assert from 'node:assert/strict';
import { localAtmosphere, placeLabels } from '../src/atmosphere.js';

const at = (hour, minute = 0) => localAtmosphere(new Date(2026, 8, 30, hour, minute));
test('local clock produces distinct night, day and evening atmospheres', () => {
  assert.equal(at(3).phase, 'night'); assert.equal(at(3).daylight, 0);
  assert.equal(at(13).phase, 'daytime'); assert.equal(at(13).daylight, 1);
  assert.equal(at(19).phase, 'sunset'); assert.ok(at(19).warmth > 0.6);
  assert.equal(at(7).phase, 'sunrise');
});
test('lighting stays bounded and has no abrupt midnight or minute transitions', () => {
  let previous = at(0);
  for (let minute = 1; minute <= 1440; minute++) {
    const next = at(Math.floor(minute / 60) % 24, minute % 60);
    for (const key of ['daylight', 'warmth']) {
      assert.ok(next[key] >= 0 && next[key] <= 1);
      assert.ok(Math.abs(next[key] - previous[key]) < 0.02);
    }
    previous = next;
  }
});
const view = { width: 390, height: 844 };
test('dense constellation labels respect reserved reading surfaces and each other', () => {
  const labels = Array.from({ length: 30 }, (_, id) => ({ id, x: 190, y: 300, width: 130, height: 32 }));
  const placed = placeLabels(labels, [{ x: 0, y: 320, width: 390, height: 420 }], view, 3);
  assert.ok(placed.length > 0 && placed.length <= 3);
  assert.equal(placed[0].id, 0);
  for (let i = 0; i < placed.length; i++) {
    const a = placed[i]; assert.ok(a.y + a.height < 320);
    for (const b of placed.slice(i + 1)) assert.ok(a.y + a.height + 8 <= b.y || b.y + b.height + 8 <= a.y);
  }
});
test('labels outside the camera or safe viewport remain hidden', () => {
  const labels = [{ id: 0, x: 10, y: 300, width: 150, height: 32 }, { id: 1, x: 190, y: 200, width: 80, height: 32, behind: true }];
  assert.deepEqual(placeLabels(labels, [], view), []);
});
