# Portfolio quality plan

Owner: Alo (priorities and acceptance). Integration: Codex. Updated 2026-09-30.

The goal is a distinctive 3D portfolio that remains easy to read and operate on a phone. “10/10” is the ambition, not a measured result. A rating cannot replace device evidence, accessibility checks or visitor performance data. The [32-task roadmap](ROADMAP.md) reconciles the incoming archive with this work; [experience design](EXPERIENCE-DESIGN.md) records research and decisions.

## Working roles

| Owner | Deliverable | Independent reviewer |
| --- | --- | --- |
| Claude / Opus 5.5 | UX hierarchy, interaction design, accessibility critique, review of implemented changes | Grok challenges assumptions; Codex reproduces findings |
| Codex | Implementation, regression tests, performance measurements and reviewed integration | Claude reviews UX/code; Grok reviews claims and failure cases |
| Grok / 4.7 through Cline and OpenRouter | Source-grounded research, adversarial edge cases, public-claim checks | Codex verifies against code/tests; Claude checks clarity |
| Alo | Product priorities, personal facts and acceptance of the experience | Team supplies evidence and unresolved tradeoffs |

These are practical assignments. Each task has one editing owner. A review is not evidence that a model ran a browser or a real-device test.

## Defined tasks

GitHub board: [release #6](https://github.com/akabonge/alo_rag2/issues/6), [performance #7](https://github.com/akabonge/alo_rag2/issues/7), [device QA #8](https://github.com/akabonge/alo_rag2/issues/8), [reliability #9](https://github.com/akabonge/alo_rag2/issues/9), [evidence #10](https://github.com/akabonge/alo_rag2/issues/10), [visual UX #11](https://github.com/akabonge/alo_rag2/issues/11).

| Priority / task | Owner → reviewer | Scope and acceptance | Status |
| --- | --- | --- | --- |
| P0 — Responsive navigation and dialogs | Codex → Claude | Reach every station from a phone; no document overflow from 320px through desktop; Ask fits short landscape; keyboard focus stays inside native modals and returns to the opener; native pinch zoom remains enabled | Implemented; browser evidence in release handoff |
| P0 — Loading and request failures | Codex → Grok | CDN/boot/WebGL failure leaves a visible text escape; malformed API input is 400; hung services have deadlines; stale Ask responses cannot replace/speak over a newer answer; confirmed guestbook writes stay successful if refresh fails | Implemented; API and browser regressions in release handoff |
| P1 — Accessibility and motion | Claude designs, Codex implements → Grok | 44px standalone primary controls where practical; useful focus indicators; no hidden dialog controls in Tab order; reduced-motion changes apply during a session; extracted/AI answers are announced coherently; no scan violations in the tested states | Implemented baseline; scanner/device checks tracked separately |
| P1 — Performance and asset delivery | Codex → Claude | Record three cold/warm runs under the same mobile network/CPU profile; compare median LCP/CLS/TBT and transferred bytes; measure frame pacing on a midrange phone; optimize largest assets and scene initialization; evaluate self-hosted/bundled dependencies and progressive content before changing deployment | Next |
| P1 — Real-device and assistive-technology acceptance | Claude leads → Grok | Current/prior-major iOS Safari and Android Chrome: portrait/landscape, pinch zoom, software keyboard, browser bars, VoiceOver/TalkBack, 200% text, narration and background/foreground transitions; record actual device/browser versions and screenshots | Pending device access; emulation is not a substitute |
| P2 — Persistent abuse controls and delivery semantics | Codex → Grok | Shared deployment-wide Ask rate/cost limits; idempotent guestbook submissions; test uncertain-write retries, concurrent moderation, multiple instances and rate expiry; preserve existing secrets and avoid introducing a paid service without a concrete need | Guestbook retry IDs and fixed quota expiry implemented; current Ask limit remains best effort per instance |
| P2 — Evidence and content credibility | Grok → Claude | Trace each portfolio/security/AI claim to current implementation or owned evidence; qualify unsupported absolutes; verify outgoing demo links and dates; preserve current Flatter employment; propose concise proof-oriented project summaries | Initial audit complete; external product verification remains |
| P2 — Visual hierarchy and conversion | Claude → Codex | Test whether visitors identify Alo’s role, strongest project and contact route quickly; improve first screen and project prioritization without removing the Uganda identity; compare phone/desktop screenshots and validate navigation with a reader | Reading surfaces, local-time lighting, skill navigation and opt-in score implemented; independent visitor task test pending |

## Acceptance and measurement

- Browser matrix: 320×568, 375×667, 390×844, 768×1024, 1024×768, 1440×900 and 844×390. Check the 3D site, text version and ProofMode page. Include keyboard, blocked dependencies, no WebGL, fast/out-of-order AI responses, modal focus and long content.
- Every fix needs a reproduced problem, a focused regression check and another reviewer. Re-test affected behavior after changes; do not repeatedly run unrelated checks to inflate counts.
- Treat 44px primary controls as a product target. WCAG 2.2 AA target-size requirements have a 24px minimum and spacing/exceptions; do not confuse these standards. [W3C target-size guidance](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).
- For modal behavior, contain focus, expose an accessible name, make background content inert and return focus sensibly. [WAI modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).
- Performance outcome targets: LCP ≤2.5s, INP ≤200ms and CLS ≤0.1 at the 75th percentile, evaluated separately for mobile and desktop. These are targets, not current measured results. Lighthouse lab runs do not establish field INP. [Web Vitals guidance](https://web.dev/articles/vitals).
- Preserve current content, real contact/resume links, Ask grounding and the production identity. No synthetic guestbook posts or paid model calls in automated tests; route mocks handle writes.
- Merge only after the relevant checks and review pass. Verify the deployed commit, real page response and key user flows after publication. Do not claim real-device, screen-reader or field performance verification that has not happened.

## Repeatable checks

```sh
npm ci --ignore-scripts
npm run build:page
npm test
npx playwright install chromium
python -m http.server 5174 --directory src
# In another terminal:
npm run test:browser -- http://127.0.0.1:5174 test-results
npm run test:experience -- http://127.0.0.1:5174 test-results/experience
npm run test:media -- http://127.0.0.1:5174 test-results/media
npm run site:audit:phones -- --url http://127.0.0.1:5174/
```

`Portfolio quality` runs the generated-page check, mocked server/client tests and browser regression on pull requests and main. `test/` now contains both historical generators and actual regression tests. The browser harness refuses non-local origins and mocks API writes.

The progressive-media suite holds and aborts JPEG responses, checks late scene enhancement and hit geometry, exercises cached/failing portraits and posters, and loses the actual WebGL context while an image is pending. Instrumentation is injected only into the locally served module for observation; no production debug globals are needed. Node tests independently cover request deduplication, station scheduling, graphics-failure guards and guestbook resource ownership.

## Audit evidence

Actual Claude Opus 5.5 completed a source audit and a separate implementation review. Actual Grok 4.7 completed a source audit through Cline/OpenRouter. A separate Codex test worker reproduced failures in Chromium. Review suggestions were checked against source: several proposed Grok line references/claims were inaccurate, and Claude’s placeholder-label criticism missed existing aria-labels. Those were not accepted as verified bugs.

Baseline production findings reproduced on 2026-09-30: hidden mobile station navigation; drawer/guestbook keyboard escape; Ask internal overflow and 14.72px input; cached AI response overwritten by the typewriter; CDN failure stranding the loader; reduced-motion/no-WebGL HUD missing; unreadably scaled ProofMode diagram. Local screenshots also caught the 320px hint overlapping Enter, which was removed.

Raw local audit reports/screenshots are in `../alo-office/qa`, with actual model reports in `../alo-office/claude-responsive-audit.md`, `claude-responsive-review.md` and `grok-responsive-audit.txt`. These local files are not automatically shared by a Git branch. The release handoff records the final checks and remaining limitations.
