import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Exercise the actual main.js handlers with deterministic media events and time.
// No browser, audio device, HTTP request or copy of the production state machine is used.
const source = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
function section(start, end) {
  const from = source.indexOf(start), to = source.indexOf(end, from);
  assert.ok(from >= 0 && to > from, 'Media section boundaries moved; update the harness extraction.');
  return source.slice(from, to);
}
const audioSource = section('const audio = {', "let skyPhase = '';");
const tourSource = section("const tourEl = $('#tour');", "const guest = {");
const voiceSource = section('const synth = window.speechSynthesis;', '// Voice questions');

function fakeClock() {
  let now = 0, nextId = 0;
  const jobs = new Map();
  return {
    setTimeout(fn, delay = 0) { const id = ++nextId; jobs.set(id, { fn, at: now + delay }); return id; },
    clearTimeout(id) { jobs.delete(id); },
    tick(duration) {
      const target = now + duration;
      let executed = 0;
      while (true) {
        const next = [...jobs].sort((a, b) => a[1].at - b[1].at || a[0] - b[0]).find(([, job]) => job.at <= target);
        if (!next) break;
        assert.ok(++executed < 1000, 'Unexpected timer loop');
        jobs.delete(next[0]); now = next[1].at; next[1].fn();
      }
      now = target;
    },
  };
}
function eventTarget() {
  const handlers = new Map(), attributes = new Map();
  return {
    hidden: true, checked: true, style: {}, textContent: '', focusCount: 0,
    addEventListener(name, fn) { if (!handlers.has(name)) handlers.set(name, []); handlers.get(name).push(fn); },
    emit(name, event = {}) {
      const payload = { target: this, ...event };
      for (const fn of handlers.get(name) || []) fn(payload);
      this[`on${name}`]?.(payload);
    },
    setAttribute(name, value) { attributes.set(name, String(value)); },
    getAttribute(name) { return attributes.get(name); },
    focus() { this.focusCount++; },
  };
}
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

function audioHarness() {
  const clock = fakeClock(), buttons = [eventTarget(), eventTarget()], document = eventTarget();
  document.hidden = false;
  document.querySelectorAll = (selector) => selector === '[data-sound]' ? buttons : [];
  const resumes = [], gainChanges = [];
  const ctx = {
    currentTime: 0, state: 'suspended',
    resume() { const pending = deferred(); resumes.push(pending); return pending.promise; },
    suspend() { this.state = 'suspended'; return Promise.resolve(); },
  };
  const context = { document, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout, toast() {} };
  vm.runInNewContext(`${audioSource}\nglobalThis.mediaUnderTest = audio;`, context);
  const audio = context.mediaUnderTest;
  // Inject a media device so tests exercise toggle/visibility behavior without synthesizing sound.
  audio.ctx = ctx;
  audio.master = { gain: { cancelScheduledValues() {}, setTargetAtTime(value) { gainChanges.push(value); } } };
  return { audio, ctx, resumes, buttons, document, clock, gainChanges, toggle: () => buttons[0].emit('click') };
}

function tourHarness({ actualVoice = false } = {}) {
  const clock = fakeClock(), elements = new Map(), clips = [], speech = [], utterances = [], playResponses = [], visits = [], buttons = [eventTarget(), eventTarget()];
  const $ = (selector) => { if (!elements.has(selector)) elements.set(selector, eventTarget()); return elements.get(selector); };
  const document = eventTarget();
  document.hidden = false;
  document.querySelectorAll = (selector) => selector === '[data-tour]' ? buttons : [];
  document.querySelector = $;
  const classes = new Set();
  document.body = { classList: { add: (name) => classes.add(name), remove: (name) => classes.delete(name) } };
  const audio = { on: true, ducked: false, duck(value) { this.ducked = value; } };
  const synth = {
    cancellations: 0, cancel() { this.cancellations++; }, getVoices: () => [], addEventListener() {},
    speak(utterance) { speech.push(utterance.text); },
  };
  class FakeUtterance { constructor(text) { this.text = text; utterances.push(this); } }
  class FakeAudio {
    constructor(url) { Object.assign(this, eventTarget()); this.url = url; this.duration = 1; this.plays = 0; this.paused = true; clips.push(this); }
    pause() { this.paused = true; }
    play() { this.plays++; this.paused = false; return this.pendingPlay?.promise || playResponses.shift() || Promise.resolve(); }
  }
  const context = {
    $, Audio: FakeAudio, document, audio, synth,
    window: { speechSynthesis: synth }, SpeechSynthesisUtterance: FakeUtterance,
    store: { get: () => null, set() {} },
    TOUR: [{ station: 'welcome', secs: 3, text: 'First narration' }, { station: 'journey', secs: 3, text: 'Second narration' }],
    STATIONS: [{ id: 'welcome', label: 'Welcome' }, { id: 'journey', label: 'Journey' }],
    askPanel: { hidden: true }, closeAsk() {}, closeDrawer() {}, stopFlight() {}, onLeaveSkills() {},
    goTo: (station) => visits.push(station), speak: (text) => speech.push(text), toast() {},
    stopVoice() { synth.cancel(); audio.duck(false); },
    lenis: { start() {}, stop() {} }, requestAnimationFrame: (fn) => fn(),
    setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout, addEventListener() {},
  };
  vm.runInNewContext(`${actualVoice ? voiceSource : ''}\n${tourSource}\nglobalThis.mediaUnderTest = { startTour, endTour${actualVoice ? ', speak, stopVoice, playVoice, playSequence' : ''} };`, context);
  const setNarration = (checked) => { const checkbox = $('#tour-voice'); checkbox.checked = checked; checkbox.emit('change'); };
  return { ...context.mediaUnderTest, $, clips, speech, utterances, visits, audio, synth, document, buttons, clock, setNarration, context, queuePlay: (promise) => playResponses.push(promise) };
}

test('an older failed audio resume cannot undo the latest ON after ON/OFF/ON', async () => {
  const h = audioHarness();
  h.toggle(); h.toggle(); h.toggle();
  h.ctx.state = 'running';
  h.resumes[0].reject(new Error('Old resume failed'));
  h.resumes[1].resolve();
  await flushPromises();
  h.clock.tick(1000);
  assert.equal(h.audio.on, true);
  assert.equal(h.ctx.state, 'running');
  assert.ok(h.buttons.every((button) => button.getAttribute('aria-pressed') === 'true'));
});

test('a pending visibility resume cannot restart a soundtrack after the visitor switches sound off', async () => {
  const h = audioHarness();
  const track = { plays: 0, paused: true, play() { this.plays++; this.paused = false; return Promise.resolve(); }, pause() { this.paused = true; } };
  h.audio.track = track;
  h.toggle(); h.ctx.state = 'running'; h.resumes[0].resolve(); await flushPromises();
  h.document.hidden = true; h.document.emit('visibilitychange');
  h.document.hidden = false; h.document.emit('visibilitychange');
  const playsBeforeOff = track.plays;
  h.toggle(); h.ctx.state = 'running'; h.resumes[1].resolve(); await flushPromises();
  h.clock.tick(1000);
  assert.equal(track.plays, playsBeforeOff);
  assert.equal(track.paused, true);
  assert.equal(h.ctx.state, 'suspended');
  assert.ok(h.buttons.every((button) => button.getAttribute('aria-pressed') === 'false'));
});

test('ending a tour prevents delayed media errors and metadata from producing speech or navigation', () => {
  const h = tourHarness();
  h.startTour(); const oldClip = h.clips[0]; h.endTour();
  oldClip.emit('error'); oldClip.emit('loadedmetadata');
  h.clock.tick(30_000);
  assert.equal(oldClip.plays, 0);
  assert.deepEqual(h.speech, []);
  assert.deepEqual(h.visits, ['welcome']);
  assert.equal(h.$('#tour').hidden, true);
  assert.ok(h.buttons.every((button) => button.getAttribute('aria-pressed') === 'false'));
});

test('old tour metadata after restart cannot duplicate playback or advance the new tour twice', () => {
  const h = tourHarness();
  h.startTour(); const oldClip = h.clips[0]; h.endTour(); h.startTour(); const currentClip = h.clips[1];
  oldClip.emit('loadedmetadata'); oldClip.emit('error'); currentClip.emit('loadedmetadata');
  h.clock.tick(2000);
  assert.equal(oldClip.plays, 0);
  assert.equal(currentClip.plays, 1);
  assert.deepEqual(h.speech, []);
  h.clock.tick(30_000);
  assert.deepEqual(h.visits, ['welcome', 'welcome', 'journey']);
  assert.equal(h.$('#tour').hidden, true);
});

test('unchecking Narration before delayed playback keeps the tour silent while it progresses', () => {
  const h = tourHarness();
  h.startTour(); h.clips[0].emit('loadedmetadata'); h.setNarration(false);
  h.clock.tick(30_000);
  assert.ok(h.clips.every((clip) => clip.plays === 0));
  assert.deepEqual(h.speech, []);
  assert.deepEqual(h.visits, ['welcome', 'journey']);
  assert.equal(h.audio.ducked, false);
  assert.equal(h.$('#tour').hidden, true);
});

test('unchecking Narration immediately pauses an already-playing recording and cancels speech', () => {
  const h = tourHarness();
  h.startTour(); h.clips[0].emit('loadedmetadata'); h.clock.tick(2000);
  assert.equal(h.clips[0].paused, false);
  const cancellations = h.synth.cancellations;
  h.setNarration(false);
  assert.equal(h.clips[0].paused, true);
  assert.ok(h.synth.cancellations > cancellations);
  assert.equal(h.audio.ducked, false);
});

test('missing media metadata falls back and the tour completes instead of waiting indefinitely', () => {
  const h = tourHarness();
  h.startTour();
  h.clock.tick(30_000); // No metadata or error event is delivered by either media element.
  assert.deepEqual(h.speech, ['First narration', 'Second narration']);
  assert.deepEqual(h.visits, ['welcome', 'journey']);
  assert.equal(h.$('#tour').hidden, true);
  assert.ok(h.clips.every((clip) => clip.plays === 0));
  h.clips.forEach((clip) => clip.emit('loadedmetadata'));
  h.clock.tick(30_000);
  assert.deepEqual(h.speech, ['First narration', 'Second narration']);
  assert.ok(h.clips.every((clip) => clip.plays === 0));
});

test('a recording play rejection after End tour cannot start fallback narration', async () => {
  const h = tourHarness();
  h.startTour(); const clip = h.clips[0]; clip.pendingPlay = deferred(); clip.emit('loadedmetadata');
  h.clock.tick(2000); h.endTour(); clip.pendingPlay.reject(new Error('Playback rejected after cancellation'));
  await flushPromises();
  h.clock.tick(30_000);
  assert.deepEqual(h.speech, []);
  assert.equal(h.$('#tour').hidden, true);
});

test('an old utterance error or end cannot unduck newer speech', () => {
  const h = tourHarness({ actualVoice: true });
  h.speak('First answer'); const old = h.utterances[0];
  h.speak('Newer answer'); const current = h.utterances[1];
  assert.equal(h.audio.ducked, true);
  old.onerror(); old.onend();
  assert.equal(h.audio.ducked, true);
  assert.deepEqual(h.speech, ['First answer', 'Newer answer']);
  current.onend();
  assert.equal(h.audio.ducked, false);
});

test('starting a tour cancels a greeting sequence, including its queued next clip and stale errors', () => {
  const h = tourHarness({ actualVoice: true });
  h.playSequence(['greeting-one.mp3', 'greeting-two.mp3'], 'Greeting fallback');
  const greeting = h.clips[0]; greeting.emit('ended');
  h.startTour(); const narration = h.clips[1]; narration.emit('loadedmetadata');
  h.clock.tick(2000);
  assert.equal(greeting.paused, true);
  assert.equal(narration.plays, 1);
  assert.equal(h.clips.length, 2, 'The canceled sequence must not create its second greeting clip');
  assert.equal(h.audio.ducked, true);
  greeting.emit('error'); greeting.emit('ended'); h.clock.tick(500);
  assert.equal(h.audio.ducked, true);
  assert.equal(h.clips.length, 2);
  assert.deepEqual(h.speech, []);
});

test('a canceled greeting play rejection cannot replace current tour narration or change its ducking', async () => {
  const h = tourHarness({ actualVoice: true }), pending = deferred();
  h.queuePlay(pending.promise); h.playVoice('greeting.mp3', 'Old fallback');
  const greeting = h.clips[0];
  h.startTour(); h.clips[1].emit('loadedmetadata'); h.clock.tick(2000);
  greeting.emit('error'); pending.reject(new Error('Old recording failed')); await flushPromises();
  assert.equal(h.audio.ducked, true);
  assert.deepEqual(h.speech, []);
  assert.equal(h.$('#tour').hidden, false);
});

test('a missing greeting recording falls back exactly once when error precedes the play rejection', async () => {
  const h = tourHarness({ actualVoice: true }), pending = deferred();
  h.queuePlay(pending.promise); h.playVoice('missing.mp3', 'Spoken greeting');
  h.clips[0].emit('error'); pending.reject(new Error('Unsupported recording')); await flushPromises();
  assert.deepEqual(h.speech, ['Spoken greeting']);
  assert.equal(h.audio.ducked, true);
  h.utterances[0].onend();
  assert.equal(h.audio.ducked, false);
});

test('a missing first sequence recording falls back once without continuing canceled clips', async () => {
  const h = tourHarness({ actualVoice: true }), pending = deferred();
  h.queuePlay(pending.promise); h.playSequence(['missing.mp3', 'next.mp3'], 'Sequence fallback');
  const failed = h.clips[0]; failed.emit('error'); pending.reject(new Error('Missing recording')); await flushPromises();
  failed.emit('ended'); h.clock.tick(1000);
  assert.deepEqual(h.speech, ['Sequence fallback']);
  assert.equal(h.clips.length, 1);
  assert.equal(h.audio.ducked, true);
});

test('speech constructor failure releases ducking and does not prevent a later valid utterance', () => {
  const h = tourHarness({ actualVoice: true });
  const Constructor = h.context.SpeechSynthesisUtterance;
  h.context.SpeechSynthesisUtterance = class { constructor() { throw new Error('Speech unavailable'); } };
  assert.doesNotThrow(() => h.speak('Unavailable speech'));
  assert.equal(h.audio.ducked, false);
  assert.deepEqual(h.speech, []);
  h.context.SpeechSynthesisUtterance = Constructor;
  h.speak('Available again');
  assert.deepEqual(h.speech, ['Available again']);
  assert.equal(h.audio.ducked, true);
});
