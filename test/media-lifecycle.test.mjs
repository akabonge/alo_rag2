import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createNarrationPlayer, setAudioSessionType } from '../src/narration.js';

// Execute actual application handlers with deterministic activation, media and time.
const source = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
function section(start, end) {
  const from = source.indexOf(start), to = source.indexOf(end, from);
  assert.ok(from >= 0 && to > from, 'Update extraction boundaries after restructuring.');
  return source.slice(from, to);
}
const audioSource = section('const audio = {', "let skyPhase = '';");
const tourSource = section("const tourEl = $('#tour');", 'const guest = {');
const voiceSource = section('const synth = window.speechSynthesis;', '// Voice questions');
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const flush = () => new Promise(resolve => setImmediate(resolve));
function fakeClock() {
  let now = 0, id = 0; const jobs = new Map();
  return {
    setTimeout(fn, delay = 0) { jobs.set(++id, { fn, at: now + delay }); return id; },
    clearTimeout(key) { jobs.delete(key); },
    tick(ms) {
      const target = now + ms; let count = 0;
      for (;;) {
        const next = [...jobs].sort((a, b) => a[1].at - b[1].at).find(([, job]) => job.at <= target);
        if (!next) break; assert.ok(++count < 1000); jobs.delete(next[0]); now = next[1].at; next[1].fn();
      }
      now = target;
    },
  };
}
function element() {
  const events = new Map(), attributes = new Map();
  return {
    hidden: true, checked: true, style: {}, textContent: '', focus() {}, append() {},
    addEventListener(name, fn) { if (!events.has(name)) events.set(name, []); events.get(name).push(fn); },
    emit(name, event = {}) { const e = { target: this, ...event }; for (const fn of events.get(name) || []) fn(e); this['on' + name]?.(e); },
    setAttribute(name, value) { attributes.set(name, String(value)); }, getAttribute(name) { return attributes.get(name); },
  };
}
function audioHarness() {
  const clock = fakeClock(), document = element(), buttons = [element(), element()], resumes = [];
  document.hidden = false; document.querySelectorAll = () => buttons;
  const context = { document, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout, toast() {}, setAudioSessionType() {} };
  vm.runInNewContext(`${audioSource}\nglobalThis.subject = { audio, syncSound };`, context);
  const { audio, syncSound } = context.subject;
  const ctx = { currentTime: 0, state: 'suspended', resume() { const d = deferred(); resumes.push(d); return d.promise; }, suspend() { this.state = 'suspended'; return Promise.resolve(); } };
  audio.ctx = ctx; audio.master = { gain: { cancelScheduledValues() {}, setTargetAtTime() {} } };
  return { audio, ctx, clock, document, buttons, resumes, syncSound, toggle: () => buttons[0].emit('click') };
}
function voiceHarness() {
  const clock = fakeClock(), nodes = new Map(), clips = [], calls = [], utterances = [], speech = [], visits = [], buttons = [element(), element()];
  let activated = false; const responses = [];
  const $ = key => { if (!nodes.has(key)) nodes.set(key, element()); return nodes.get(key); };
  const document = element(); document.hidden = false; document.querySelector = $; document.querySelectorAll = () => buttons;
  document.body = { append() {}, classList: { add() {}, remove() {} } };
  const audio = { on: false, ducked: false, duck(value) { this.ducked = value; } };
  class Media {
    constructor() { Object.assign(this, element()); this.paused = true; this.ended = false; this.unlocked = false; this.duration = 2; clips.push(this); }
    set src(value) { this.url = value; this.ended = false; }
    get src() { return this.url; }
    play() {
      calls.push({ src: this.src, activated });
      if (!activated && !this.unlocked) return Promise.reject(Object.assign(new Error('Gesture required'), { name: 'NotAllowedError' }));
      if (activated) this.unlocked = true;
      this.paused = false; this.ended = false;
      return responses.shift() || Promise.resolve();
    }
    pause() { this.paused = true; }
    end() { this.ended = true; this.paused = true; this.emit('ended'); }
  }
  const synth = { getVoices: () => [], addEventListener() {}, cancel() {}, speak(u) { speech.push(u.text); } };
  class Utterance { constructor(text) { this.text = text; utterances.push(this); } }
  const context = { $, document, audio, window: { speechSynthesis: synth }, SpeechSynthesisUtterance: Utterance,
    store: { get: () => null, set() {} }, setAudioSessionType() {},
    createNarrationPlayer: options => createNarrationPlayer({ ...options, createAudio: () => new Media(), schedule: clock.setTimeout, cancel: clock.clearTimeout }),
    TOUR: [{ station: 'hero', secs: 3, text: 'First narration' }, { station: 'journey', secs: 3, text: 'Second narration' }], STATIONS: [{ id: 'hero', label: 'About' }, { id: 'journey', label: 'Journey' }],
    askPanel: { hidden: true }, closeAsk() {}, closeDrawer() {}, stopFlight() {}, goTo: station => visits.push(station), toast() {},
    lenis: { start() {}, stop() {} }, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout, addEventListener() {},
  };
  vm.runInNewContext(`${voiceSource}\n${tourSource}\nglobalThis.subject = { startTour, endTour, speak, stopVoice, playVoice, playSequence, narration };`, context);
  const gesture = fn => { activated = true; try { return fn(); } finally { activated = false; } };
  const click = key => gesture(() => $(key).emit('click'));
  const setNarration = checked => gesture(() => { $('#tour-voice').checked = checked; $('#tour-voice').emit('change'); });
  return { ...context.subject, $, audio, synth, clips, calls, utterances, speech, visits, clock, context, document, buttons, gesture, click, setNarration, queue: promise => responses.push(promise) };
}

test('rapid soundtrack ON/OFF/ON ignores an older rejected resume', async () => {
  const h = audioHarness(); h.toggle(); h.toggle(); h.toggle();
  h.ctx.state = 'running'; h.resumes[0].reject(new Error('old')); h.resumes[1].resolve(); await flush(); h.clock.tick(1000);
  assert.equal(h.audio.on, true); assert.equal(h.audio.blocked, false); assert.equal(h.ctx.state, 'running');
  assert.ok(h.buttons.every(b => b.getAttribute('aria-pressed') === 'true'));
});
test('returning interrupted soundtrack retries on a tap rather than requiring OFF/ON', async () => {
  const h = audioHarness(); h.toggle(); h.ctx.state = 'running'; h.resumes[0].resolve(); await flush();
  h.ctx.state = 'interrupted'; h.syncSound(); assert.equal(h.buttons[0].getAttribute('aria-label'), 'Resume score');
  h.toggle(); assert.equal(h.audio.on, true); assert.equal(h.resumes.length, 2);
  h.ctx.state = 'running'; h.resumes[1].resolve(); await flush(); assert.equal(h.audio.blocked, false);
});
test('a hanging context resume surfaces a retry state', () => {
  const h = audioHarness(); h.toggle(); h.clock.tick(5001);
  assert.equal(h.audio.starting, false); assert.equal(h.audio.blocked, true);
  assert.equal(h.buttons[0].getAttribute('aria-pressed'), 'false'); assert.equal(h.buttons[0].getAttribute('aria-label'), 'Resume score');
});
test('a late visibility resume cannot restart sound after explicit opt-out', async () => {
  const h = audioHarness(); const track = { paused: true, play() { this.paused = false; return Promise.resolve(); }, pause() { this.paused = true; } }; h.audio.track = track;
  h.toggle(); h.ctx.state = 'running'; h.resumes[0].resolve(); await flush();
  h.document.hidden = true; h.document.emit('visibilitychange'); h.document.hidden = false; h.document.emit('visibilitychange'); h.toggle();
  h.clock.tick(1000); h.ctx.state = 'running'; h.resumes[1].resolve(); await flush();
  assert.equal(h.audio.on, false); assert.equal(track.paused, true); assert.equal(h.ctx.state, 'suspended');
});
test('tour starts in the click, reuses one activated element and advances only after ended', async () => {
  const h = voiceHarness(); h.gesture(h.startTour); assert.deepEqual(h.calls, [{ src: 'assets/tour-1.mp3?v=22', activated: true }]);
  await flush(); h.clock.tick(20000); assert.deepEqual(h.visits, ['hero']); assert.equal(h.clips[0].playbackRate, 1);
  h.clips[0].end(); h.clock.tick(1600); await flush(); assert.equal(h.clips.length, 1);
  assert.equal(h.calls[1].src, 'assets/tour-2.mp3?v=22'); assert.equal(h.calls[1].activated, false); assert.equal(h.narration.status, 'playing');
  h.clips[0].end(); h.clock.tick(1600); assert.equal(h.$('#tour').hidden, true);
});
test('blocked tour holds its caption and offers a direct-gesture continuation', async () => {
  const h = voiceHarness(); h.startTour(); await flush(); h.clock.tick(30000);
  assert.equal(h.narration.status, 'blocked'); assert.deepEqual(h.visits, ['hero']); assert.match(h.$('#tour-status').textContent, /Tap Continue/);
  assert.deepEqual(h.speech, []); h.click('#tour-replay'); await flush(); assert.equal(h.narration.status, 'playing');
});
test('caption-only tour never constructs or plays a media element', () => {
  const h = voiceHarness(); h.$('#tour-voice').checked = false; h.gesture(h.startTour); h.clock.tick(10000);
  assert.deepEqual(h.visits, ['hero', 'journey']); assert.equal(h.clips.length, 0); assert.equal(h.$('#tour').hidden, true);
});
test('turning narration off cancels playback and continues caption timing', async () => {
  const h = voiceHarness(); h.gesture(h.startTour); await flush(); h.setNarration(false);
  assert.equal(h.clips[0].paused, true); assert.equal(h.audio.ducked, false); h.clock.tick(10000);
  assert.deepEqual(h.visits, ['hero', 'journey']); assert.equal(h.calls.length, 1); assert.equal(h.$('#tour').hidden, true);
});
test('canceled deferred play and captured ended callbacks cannot revive a tour', async () => {
  const h = voiceHarness(), pending = deferred(); h.queue(pending.promise); h.gesture(h.startTour);
  const ended = h.clips[0].onended; h.endTour(); pending.reject(new Error('late')); h.clips[0].ended = true; ended(); await flush(); h.clock.tick(30000);
  assert.deepEqual(h.visits, ['hero']); assert.deepEqual(h.speech, []); assert.equal(h.$('#tour').hidden, true);
});
test('greeting sequence reuses permission and starting Tour cancels old sequence callbacks', async () => {
  const h = voiceHarness(); h.gesture(() => h.playSequence(['one.mp3', 'two.mp3'], 'Greeting')); await flush();
  h.clips[0].end(); await flush(); assert.equal(h.calls[1].src, 'two.mp3?v=22'); assert.equal(h.clips.length, 1);
  const stale = h.clips[0].onended; h.gesture(h.startTour); await flush(); h.clips[0].ended = true; stale(); h.clock.tick(1000);
  assert.equal(h.calls.length, 3); assert.equal(h.calls[2].src, 'assets/tour-1.mp3?v=22'); assert.deepEqual(h.speech, []);
});
test('Gyendi stays replayable and successful greeting audio does not show a playback banner', async () => {
  const h = voiceHarness(); h.$('#greet-reply').hidden = false;
  h.click('#greet-reply'); await flush();
  assert.equal(h.$('#greet-reply').hidden, false); assert.equal(h.$('#oli-reply').hidden, false);
  assert.equal(h.$('#voice-feedback').hidden, true); assert.equal(h.calls[0].src, 'assets/gyendi.mp3?v=22');
  h.click('#greet-reply'); await flush();
  assert.equal(h.calls.length, 2); assert.equal(h.calls[1].src, 'assets/gyendi.mp3?v=22');
  assert.equal(h.$('#voice-feedback').hidden, true);
});
test('recording failure and later rejection produce retry UI without impersonating the recording', async () => {
  const h = voiceHarness(), pending = deferred(); h.queue(pending.promise); h.gesture(() => h.playVoice('missing.mp3', 'Welcome'));
  h.clips[0].emit('error'); pending.reject(new Error('decode')); await flush();
  assert.deepEqual(h.speech, []); assert.match(h.$('#voice-status').textContent, /Recording unavailable/); assert.equal(h.$('#voice-retry').hidden, false);
});
test('backgrounding pauses tour without advancing, and continuation needs a tap', async () => {
  const h = voiceHarness(); h.gesture(h.startTour); await flush(); h.document.hidden = true; h.document.emit('visibilitychange');
  h.clock.tick(30000); assert.deepEqual(h.visits, ['hero']); assert.equal(h.clips[0].paused, true);
  h.document.hidden = false; h.document.emit('visibilitychange'); await flush(); assert.equal(h.calls.length, 1);
  h.click('#tour-replay'); await flush(); assert.equal(h.calls.length, 2); assert.equal(h.narration.status, 'playing');
});
test('speech is not reported playing before onstart and blocked speech has a gesture retry', () => {
  const h = voiceHarness(); h.speak('Answer'); assert.equal(h.audio.ducked, false); assert.match(h.$('#voice-status').textContent, /Starting/);
  h.clock.tick(5001); assert.match(h.$('#voice-status').textContent, /did not start/); h.click('#voice-retry');
  h.utterances[1].onstart(); assert.equal(h.audio.ducked, true); assert.match(h.$('#voice-status').textContent, /Reading aloud/);
});
test('old speech callbacks cannot unduck newer narration or speech', async () => {
  const h = voiceHarness(); h.speak('Old'); const old = h.utterances[0]; h.gesture(h.startTour); await flush();
  old.onstart(); old.onerror(); old.onend(); assert.equal(h.audio.ducked, true); assert.equal(h.narration.status, 'playing');
});
test('speech construction failure stays recoverable and never claims audible output', () => {
  const h = voiceHarness(); h.context.SpeechSynthesisUtterance = class { constructor() { throw Error('Unsupported'); } };
  assert.doesNotThrow(() => h.speak('Answer')); assert.equal(h.audio.ducked, false); assert.match(h.$('#voice-status').textContent, /did not start/);
});
test('AudioSession enhancement is optional and setter failures do not block playback', () => {
  assert.doesNotThrow(() => setAudioSessionType('playback', {}));
  assert.doesNotThrow(() => setAudioSessionType('playback', { get audioSession() { throw Error('Unavailable'); } }));
  const nav = { audioSession: { type: 'auto' } }; setAudioSessionType('playback', nav); assert.equal(nav.audioSession.type, 'playback');
});

test('retrying a failed recording reloads its source before playing again', async () => {
  let assignments = 0, loads = 0;
  const states = [];
  const media = {
    paused: true, ended: false, error: null, networkState: 1,
    set src(value) { this.url = value; assignments++; }, get src() { return this.url; },
    load() { loads++; this.error = null; this.networkState = 1; },
    play() {
      if (assignments === 1) { this.error = new Error('network'); this.networkState = 3; return Promise.reject(this.error); }
      this.paused = false; this.ended = false; return Promise.resolve();
    },
    pause() { this.paused = true; },
  };
  const player = createNarrationPlayer({ createAudio: () => media, onState: state => states.push(state.status) });
  player.play('recording.mp3'); await flush();
  assert.equal(player.status, 'error');
  player.retry({ restart: true }); await flush();
  assert.equal(assignments, 2); assert.equal(loads, 1); assert.equal(player.status, 'playing');
  assert.deepEqual(states, ['idle', 'loading', 'error', 'loading', 'playing']);
});
