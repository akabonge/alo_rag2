import test from 'node:test';
import assert from 'node:assert/strict';
import { createSubmissionTracker } from '../src/guestbook.js';

const note = { name: 'Visitor', city: 'Kampala', msg: 'Hello', t: 10 };
const tracker = (options = {}) => {
  let sequence = 0;
  return createSubmissionTracker({ makeId: () => `fixture-${++sequence}`, ...options });
};

test('Uncertain unchanged notes reuse their ID despite a new client timestamp', () => {
  const pending = tracker();
  const id = pending.begin(note);
  assert.equal(pending.begin({ ...note, t: 20 }), id);
  assert.equal(pending.begin({ ...note, t: 30 }), id);
});

test('An edited draft or a confirmed new submission gets a new ID', () => {
  const pending = tracker();
  const first = pending.begin(note);
  const edited = pending.begin({ ...note, msg: 'A different note' });
  assert.notEqual(edited, first);
  pending.confirm(first); // a late confirmation must not clear another draft
  assert.equal(pending.begin({ ...note, msg: 'A different note' }), edited);
  pending.confirm(edited);
  assert.notEqual(pending.begin({ ...note, msg: 'A different note' }), edited);
});

test('Retry expiry blocks reuse before the server receipt can expire', () => {
  let time = 0;
  const pending = tracker({ now: () => time });
  const id = pending.begin(note);
  time = 23 * 60 * 60 * 1000 - 1;
  assert.equal(pending.begin(note), id);
  time++;
  assert.throws(() => pending.begin(note), /retry window has ended/);
  assert.throws(() => pending.begin(note), /retry window has ended/);
});

test('Real client IDs are unique UUIDs and no draft is stored outside the page', () => {
  const pending = createSubmissionTracker();
  const first = pending.begin(note);
  assert.match(first, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  pending.confirm(first);
  assert.notEqual(pending.begin(note), first);
});
