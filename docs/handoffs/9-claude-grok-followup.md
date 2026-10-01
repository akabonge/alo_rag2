# Actual Claude review of the Grok reliability follow-up

This is a Codex-prepared summary of a real Claude Code review, not a renamed Codex agent's opinion. Claude Code 2.1.285 returned a successful source-only result using runtime-reported canonical model `claude-opus-5-5`, first-party provider, one turn, in 128,257 ms. Invocation used tools disabled, safe mode, strict MCP configuration, no Chrome integration, and no session persistence. No authentication/settings were changed. Claude did not edit files, run tests, operate a browser, or call Redis.

Local evidence: `alo-office/claude-grok-followup-review.md`, `claude-grok-followup-review-raw.json`, and `claude-grok-followup-review-provenance.json`. The review snapshot includes the revised acknowledgment for a replayed/moderated guestbook note. Account/session identifiers are not included in this tracked handoff.

## Review result

Claude found no blocking defect in the supplied guestbook client/server idempotency changes, Lua storage checks, Ask grounding aliases, or the two targeted motion corrections. It checked stable retry IDs, uncertain-response handling, receipt-before-quota ordering, moderated-note replay behavior, and the qualified public claim. These are source-review findings; execution and deployment evidence belong to the integration PR.

Claude identified two adjacent motion problems for integrator review:

1. After WebGL context loss, `updateMotion` could create a fresh Lenis instance even though the scene animation loop had stopped. The new instance would intercept wheel input without receiving frame updates. Its suggested correction is to preserve native scrolling while `sceneFailed` is true. Codex's full-file check confirmed that the alternative Lenis loop belongs only to the initial no-WebGL fallback, not the context-loss path.
2. The performance watchdog used decorative `t` and `dt`, which freeze under reduced motion. It could therefore skip slow-device classification entirely or count paused frames as healthy. The suggested correction is to measure rendering with elapsed/frame timing independent of decorative animation.

Both findings were addressed in Codex integration after the review. The initial Lenis setup and `updateMotion` now require `!sceneFailed`; `sceneFailed` is declared before either use. The watchdog now accumulates `performanceElapsed` from raw frame timing and classifies slow frames using `raw`, independent of decorative `t`/`dt`. A Codex source check confirmed these corrections, and `test/motion-recovery.test.mjs` exercises the actual extracted watchdog and motion-update code. These later corrections are not a second Claude approval; execution evidence belongs to the integration PR.

## Browser-discovered follow-up

The first targeted Windows Chromium run stalled when emulation changed from reduced to ordinary motion. A test-only observer recorded that `motionPreference.matches` became false, but its change-event count stayed zero; the healthy, visible scene retained `reduced = true` and animation time zero. A minimal blank-page control delivered the event normally. Linux CI run `36798803510` independently timed out at the same transition after its preceding media checks passed. This evidence concerns headless browser behavior, not a claim that physical devices reproduce it.

Codex added a cached applied OS preference and reconciles it at the beginning of scene and initial no-WebGL frames. The native listener remains, unchanged preferences do not recreate Lenis, and manual pause remains independent. The dynamic browser assertions were retained: they must enter nonzero animation time, freeze actual postcard/crane transforms, pause an active celebration through an OS preference change, and restore motion through completion. No synthetic event dispatch substitutes for that transition.

The subsequent Codex local Chromium run completed **15/15 checks**, exit zero, with no uncaught JavaScript errors. At 390 and 1440 pixels it covered reduced-motion fact access, nonzero-time manual pause, bounded postcard position, ordinary crane celebration, dynamic OS pause, and resumed completion at the original scale. It also covered pending-image suppression after context loss and real wheel scrolling after Pause/Resume without recreating Lenis. The two paused-state screenshots were inspected. Local evidence is `alo-office/qa/grok-motion-final/results.json` and `motion-paused-{390,1440}.png`; the earlier incomplete run is retained in `grok-motion-followup/results.json`.

This targeted run used the exact pinned Three.js, GSAP, and Lenis versions through an explicitly labeled local module mirror, mocked APIs, and software WebGL. It verifies interaction and scene-state behavior; it does not establish CDN transfer performance, real-device GPU performance, or production deployment. Final Linux CI and release verification remain the integrator's responsibility.

## Confirmed targeted design

The postcard now assigns a bounded offset from a stored base Y instead of accumulating a per-frame displacement. The crane celebration starts only when motion is allowed and uses the same pausable animation clock, while its factual click response remains available. Claude found no declaration-order problem in the callback closure. It also confirmed that the proposed browser assertions examine actual postcard/crane transforms after nonzero animation time.

## Limits and follow-ups

Optional observations included the frozen crane pose during a mid-celebration pause, older-browser UUID support, and presentation when an acknowledged replay cannot refresh its list. The review did not establish browser behavior, live Upstash compatibility, real-provider grounding, physical-phone performance, or actual test success. It warned that a short celebration could finish before OS emulation takes effect in a slow browser run; targeted tests must wait on observable state and report incomplete runs honestly.

The full raw report and per-file hashes are retained locally. Any application or test change made after that snapshot is Codex integration work, not new Claude-authored code or a new Claude approval.
