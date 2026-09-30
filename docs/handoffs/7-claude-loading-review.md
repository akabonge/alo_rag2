# Actual Claude review of integrated progressive loading

## Result and provenance

Claude's source-review verdict: **no definite blockers are supported by the supplied source**.

The actual Claude Code 2.1.285 CLI completed a second request using canonical model `claude-opus-5-5`, first-party provider, one turn, in 121,717 ms. It used the same tools-disabled, safe-mode, strict-MCP and no-session-persistence flags documented in [the contribution handoff](7-claude-loading.md). Claude did not edit files, execute tests, or inspect a browser. The local raw response is `alo-office/claude-performance-review.md`; this tracked summary was prepared by the Codex coordinator and is not the model's verbatim response.

The review snapshot was taken at 2026-09-30 19:56 UTC from the integration worktree, before the subsequent removed-hover refinement. SHA-256 values bind the supplied source:

- `src/main.js`: `d1386e53fa83a34a7b8a495ae65bfd8450ea037585ee636933f20e27945bb3ce`
- `src/media.js`: `8bdb3e22ca601ae02cd1a6d05379efd3d296e36fcc3ae5bfb2668934e330ee997`
- `src/page.html`: `fe83fb3050bdf0e6ce20194963effa120ba817713e5febe01eca041a5f7f1fd4`

## What Claude checked

Claude found no photo promise in the supplied boot path; scene consumers begin with procedural stand-ins. It checked finite image dimensions, memoized asynchronous delivery, station indices and Save-Data proximity, `proofHit`/`holoTex` initialization order, and late-callback suppression after boot failure or context loss.

For the interface, Claude checked the cached portrait completion handler, reserved square sizing and accessible AK fallback, same-drawer profile-to-portrait recovery, and demand-created detail media. For guestbook rebuilds, it checked removal of obsolete pick targets, disposal of owned materials/textures/geometries, and preservation of shared Sprite geometry and the glow texture.

## Follow-ups and integration checks

Claude identified stale visitor hover state after a sky rebuild as a nonblocking follow-up. The integrator subsequently added `clearVisitorHover` before disposing removed stars; that later change was not in Claude's snapshot and remains part of Codex's validation responsibility.

Claude explicitly lacked the full globe-update code and image-focused tests in its excerpts. Subsequent **Codex read-only checks**, not additional Claude findings, resolved these points:

- Full-file search found no remaining aggregate `imgReady` or image-cache `loaded` consumers; the remaining `loaded` string names the portrait CSS state.
- `globeInner.quaternion` is set once during scene construction. The flight updater does not rotate it, so the proposed late-postcard anchoring concern is not supported by the current source.
- Focused image tests exist in `test/media.test.mjs`, with deferred loads, invalid dimensions, memoization, cache timing, failed allocation, inactive-scene suppression, and scene hydration. They were not the audio/tour `media-lifecycle` tests supplied to Claude. The integrator owns execution and results.

Other follow-ups were optional older-canvas API fallback, drawer-image layout shifts, limits for future oversized ProofMode images, and cosmetic portrait framing before load. No measured performance gain or browser compatibility guarantee was inferred from source review.

## Validation limits

Source review cannot replace delayed/failed-image browser tests, cached portrait and no-WebGL checks, same-drawer fallback, context-loss tests, station/deep-link network checks, or the 320/390px and desktop layout matrix. Use the integration PR's actual test evidence for those conclusions. This review is scoped to the supplied snapshot, not a blanket approval of later changes.
