# Phone narration and score recovery

Owner: Codex. Branch: `codex/mobile-audio-release-safety`. This is implementation and test evidence, not an actual Claude-authored change or a physical-phone verification.

## Report and source cause

Alo reported that the greeting worked once on iPhone 15 Pro in Chrome, later narration did not play, and the ambient score was silent. The previous tour constructed a new `Audio` element for every stop, then waited for metadata and a 1.8-second timer before calling `play()`. The greeting sequence also created a new element per recording. WebKit documents per-element playback permission and recommends changing an existing element's source for sequential media. [WebKit playback guidance](https://webkit.org/blog/7734/auto-play-policy-changes-for-macos/).

The prior recordings ran at 0.94×, not an accelerated rate. They now play at their original 1× rate. Existing recorded voice files remain the source; no external voice cloning or replacement service is introduced.

## Implementation

- `src/narration.js` owns one lazy media element for all greetings and tour recordings. First play and explicit retries run synchronously in the initiating tap. A promise rejection, missing media, stalled start, or unexpected pause produces an actionable state. Cancellation invalidates pending callbacks and promises.
- Narrated tour stops advance after the actual recording ends and a short pause. They do not silently run through captions while audio is blocked. Continue/Replay, Next stop, End tour, and caption-only mode stay available. Browser speech is an explicitly chosen caption fallback, labeled separately from Alo's recording.
- Backgrounding pauses the tour and requires a direct continuation. Recording, browser speech, Ask, greeting and tour ownership are mutually canceled; stale errors cannot start a replacement voice. Speech is only reported as reading after its start event; a start timeout offers a direct Read aloud retry.
- Ambient sound distinguishes starting, running and interrupted states. A direct Resume sound tap retries a suspended/interrupted context. Background return may resume previously consented sound; stale promises cannot undo a later opt-out. Both sound controls share status.
- On explicit audio consent, supported browsers receive `navigator.audioSession.type = 'playback'`. This optional API expresses media playback and may pause other device media; it is not proof that an iPhone speaker produced sound. Microphone use requests recording mode, then restores the appropriate output mode. [MDN audio session types](https://developer.mozilla.org/en-US/docs/Web/API/AudioSession/type), [interrupted audio contexts](https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/state).
- Recording URLs and the narration module use `?v=22`, main imports Ask v17, and its cache namespace is `ask:v21:` so older cached answers do not outlive updated public facts.
- A failed recording retry now reloads its source before playing again. This repairs network/decode failures that cannot be recovered by changing `currentTime` alone. Caption-only timing restarts when a backgrounded tab returns; narrated mode remains paused until a direct tap.
- The visible developer progress sequence was removed. Text and controls render immediately while the scene initializes; the independent 12-second failure notice and fast text escape remain.
- Tour captions use a larger, high-contrast reading style with a bounded line length. The words remain synchronized with the existing recordings; no facts or transcript wording were invented.

Playback UI follows actual media promises/events, as recommended by [MDN's play method guidance](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/play). Native start confirmation still cannot measure the physical speaker, volume setting, Bluetooth route, or the listener's hearing.

## Validation

The focused Node suite passes against the actual application handlers and player. It includes per-element activation, first play within a gesture, shared sequential recordings, original rate, actual-ended advancement, failed-source reload, blocked hold/retry, caption-only silence, stale deferred callbacks, greeting/tour cancellation, background pause, speech-start failure and interrupted score recovery.

Claude Opus 5.5 completed an independent source review. Its two release-blocking findings were accepted and fixed: failed media must reload its source, and deployment health must not run a changeable event workflow with access to a preview bypass secret. The deployment workflow now uses `workflow_run`, whose definition comes from the trusted default branch, and resolves deployment status through the read-only GitHub API. Claude's optional production-binding and caption-background findings were also incorporated.

`test/audio-browser.cjs` adds muted native recording playback at 390 and 1440 widths, seeks the first recording to its real end to verify the next stop, injects one deliberate policy rejection, retries through the visible control, and suspends/resumes the real AudioContext. It mocks API routes and rejects non-read requests outside those fixtures. Browser results are recorded separately after completion; muted headless playback is not physical iPhone acceptance.

Required phone acceptance remains: after a fresh load on the reported iPhone, tap Tour and hear multiple stops; end it, replay both greetings, try Sound with the intended device output/volume, background/return, use Continue/Resume, and confirm no stale or unrequested audio. The actual device result must be supplied before claiming the reported phone issue is fully verified.
