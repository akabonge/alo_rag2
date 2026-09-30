# Responsive experience release

Issue: [#6](https://github.com/akabonge/alo_rag2/issues/6). Branch: `codex/mobile-architecture`. Review: [PR #5](https://github.com/akabonge/alo_rag2/pull/5), including the earlier ProofMode diagram fixes. Updated 2026-09-30.

## Changes

- One compact-screen dock contains Ask, Explore, Tour and Sound. Desktop Ask joins the header. Controls adapt to short landscape and enlarged text; measured header/dock space protects reading areas. Ask becomes a phone sheet with wrapping input controls and keyboard-aware positioning.
- Near-opaque welcome/hero surfaces protect text from the sky. Body text and primary targets are larger, long headings wrap, and all 52 skills have HTML category links. Constellation labels avoid reading panels and one another; compact views suppress dense idle labels.
- The visitor's local clock changes sky, fog, illumination and stars through day, sunset and night. This is an artistic clock cycle, not weather or astronomical sunrise prediction. The original procedural score adds a piano motif and chord-aware bells; sound stays opt-in, suspends in background tabs and ducks beneath narration.
- Manual Pause motion and live OS reduced-motion changes stop decorative time. Tour/flight cancellation, narration ownership, rapid sound toggles and rejected playback cannot revive stale activity.
- Native project, guestbook and flight-completion dialogs contain focus and explicitly restore a usable opener. Opening incompatible activities closes/cancels the previous state. Detail videos have controls and do not preload or autoplay.
- Dependency-free loading escape, error notice and watchdog preserve access when a CDN, WebGL or boot step fails. The text portfolio remains independently reachable.
- Ask removes the response-overwriting typewriter, validates replies/cache data, aborts superseded requests and preserves grounded source fallback. Guestbook messages distinguish confirmed public saves, local drafts and uncertain writes. A successful write stays successful when its subsequent list refresh fails; moderation removes exact records without replacing concurrent notes.
- Server APIs validate input, bound provider/storage waits and reject malformed upstream responses. Ask's limit is explicitly best effort per warm instance; shared limits and idempotent guestbook writes remain issue #9.
- ProofMode has a readable, keyboard-scrollable architecture diagram and text equivalent. Existing Flatter employment and the query-free shared content module remain intact.
- Locked dependencies, portable page generation, Node/browser regressions and a PR/main quality workflow make checks repeatable. The archive's 32 tasks are reconciled with issues #6–#11; its importer defaults to dry-run and does not create duplicates. See [roadmap](../ROADMAP.md) and [audit methodology](../audit/METHODOLOGY.md).

## Independent review

Actual Claude Opus 5.5 completed source, implementation and experience reviews. Actual Grok 4.7 through Cline/OpenRouter researched primary sources and supplied adversarial cases. Separate Codex workers reproduced browser failures and audited APIs/media behavior. Recommendations were checked against the current source; stale line references and unsupported findings were not accepted as facts. Grok's separate uncommitted implementation remains isolated from this release.

Cross-review caught overwritten answers, hidden-opener focus restoration, stale narration callbacks, motion/tour conflicts, misleading guestbook confirmation and enlarged desktop text overflow. No production guestbook notes were submitted by automated tests. Research and design decisions: [EXPERIENCE-DESIGN.md](../EXPERIENCE-DESIGN.md).

## Validation

- Generated pages rebuilt; JavaScript syntax and `git diff --check` pass. `npm ci --ignore-scripts` completes with the lockfile.
- 44 Node tests pass: API/client failures, grounding/cancellation, atmosphere/label placement, media lifecycle, and audit/importer helpers. Media checks exercise the actual source with controlled audio/speech implementations.
- Chromium experience suite: 35/35 checks, including sound opt-in/races, narration mute, 52 skill links, OS/manual motion changes, and actual 200% root text at phone and desktop widths. Browser smoke coverage also includes seven viewport geometries across home/text/ProofMode, failed dependencies/WebGL, modal focus, Ask races and guestbook failures. The PR's CI report is the final complete smoke-suite record.
- WebKit: 22/22 layout checks and focused modal containment/opener-restoration checks passed. Wider edge-case verification is recorded separately on the PR. Firefox completed earlier guestbook checks; the wider final run was incomplete amid browser/runtime stalls. It is not reported as a Firefox release pass.
- Initial axe checks found no automated WCAG A/AA violations across 12 states. Final-state scans and fresh day/night screenshots are recorded on the PR; canvas/glass contrast still needs manual judgement. Automated scans are not a complete accessibility audit.

Local raw reports, screenshots and score preview are in `../alo-office/qa`; actual model reports are in `../alo-office` and `../alo-grok/docs/handoffs/grok-experience-research.md`. Those local artifacts do not automatically travel with this branch. CI uploads its browser artifacts. This handoff describes source validation, not proof that a deployment completed; use the PR/deployment record for publication status.

## Remaining acceptance

Actual iOS/Android keyboards, browser bars, pinch gestures, VoiceOver/TalkBack, subjective soundtrack listening and field performance need their own evidence. Software browser emulation cannot establish phone GPU performance. Live-model adversarial results, transaction-level demo verification and owned case-study numbers remain open. See [QUALITY-PLAN.md](../QUALITY-PLAN.md) and issues #7–#11. This release does not claim a universal 10/10 score.
