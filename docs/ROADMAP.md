# Portfolio roadmap

Reconciled 2026-09-30 from Alo's `alo_rag2-roadmap-10.zip`, current source, Claude's design review, Grok's research and browser regressions. These 32 stable IDs map to the existing [quality issues](QUALITY-PLAN.md); the importer does not create duplicate tickets. Implementation status below is separate from deployment and real-device acceptance. The release handoff records checks actually completed.

“10/10” is a design ambition, not a measured score. The incoming archive's 153 number counts budget conditions across repeated states, not 153 distinct controls. Its approximately 4.1 MB local-mirror measurement is decoded data, not measured production transfer. A finite blocked-CDN test cannot establish “forever.” See [audit methodology](audit/METHODOLOGY.md) for corrected measurements.

## Foundation

### T0.1 Land the audit harness
Owner: Codex. Reviewer: Claude. Adapted harness and helper tests are implemented. Done: a rendered run records readiness, initial encoded bytes, unique controls, screenshots and usable recovery separately. Run `npm run site:audit:phones -- --url http://127.0.0.1:5174/`; inspect findings before enforcing budgets.

### T0.2 Research strong interactive portfolios
Owner: Grok. Reviewer: Claude. Source research completed for Bruno Simon, Lusion and Active Theory; rendered mobile behavior was not evaluated. Done: recommendations distinguish observed HTML, source evidence and design hypotheses. Decisions and primary links: [experience design](EXPERIENCE-DESIGN.md).

### T0.3 Real-device baseline
Owner: Alo. Reviewer: Codex. Pending. Record phone model, browser, mobile-data load, orientation, text scaling, keyboard and audio behavior. Done: an actual iPhone and Android can reach work, resume and contact without a blocked or hidden control.

### T0.4 PR audit and performance checks
Owner: Codex. Reviewer: Grok. Generated-page, Node and Chromium CI implemented; preview Lighthouse remains follow-up. Done: checks run on the actual PR commit, archive evidence and distinguish local lab measurements from field Web Vitals.

## Reliability

### R1 Never stranded during loading
Owner: Codex. Reviewer: Grok. Dependency-free loader link, error notice and watchdog implemented. Done: blocked dependencies, boot rejection and no-WebGL leave a reachable reading path. Self-hosted/bundled dependencies remain a performance follow-up; a fallback is not evidence that third-party dependencies disappeared.

### R2 One copy of each module
Owner: Codex. Reviewer: Claude. Main now uses the same query-free content import as Ask. Done: inspect the network graph for duplicate content downloads and keep a regression record after bundling changes.

### R3 Friendly and truthful failure states
Owner: Codex. Reviewer: Grok. API validation, deadlines, canceled Ask replies and confirmed-save semantics implemented. Done: mocked provider/Redis errors, missing configuration and ambiguous write timeouts preserve content and drafts without claiming unconfirmed success. Deployment-wide rate limits and idempotent writes remain issue #9.

## Mobile experience

### M1 One mobile control dock
Owner: Codex. Reviewer: Claude. Ask, Explore, Tour and Sound share one responsive dock; desktop Ask moves to the header. Done: controls fit 320px, landscape and enlarged text; Explore/Ask are exclusive, Escape/focus work and native dialogs make background controls inert.

### M2 Comfortable touch targets
Owner: Codex. Reviewer: Grok. Primary controls use at least 44px targets, dock buttons 48px. Done: measure reachable controls per state and review justified inline-link exceptions. 44px is a product target, not a blanket WCAG AA rule.

### M3 Readable mobile type
Owner: Codex. Reviewer: Claude. Reading copy enlarged, label floor raised and long words allowed to wrap. Done: 200% text does not widen the page; 16px inputs avoid small-input zoom; check browser text scaling on real phones.

### M4 Readable welcome and hero
Owner: Claude design, Codex implementation. Reviewer: Grok. Dark reading surfaces and stronger secondary text protect copy from the brighter scene. Done: inspect day, dusk and night at phone/desktop sizes; sample text against actual rendered backgrounds. Content may scroll vertically.

### M5 Ask as a phone sheet
Owner: Codex. Reviewer: Claude. Full-width compact sheet, wrapping form, visible-viewport sizing and keyboard-aware positioning implemented. Done: submit, close and focus return work at 320px and short landscape; physical software-keyboard testing remains required.

### M6 Landscape and short screens
Owner: Codex. Reviewer: Grok. Dock replaces the rail below the compact breakpoint and on short screens. Done: header, dock and sheets remain distinct; necessary content remains reachable by scrolling, including short-phone welcome CTAs.

### M7 Accessible detail sheets
Owner: Codex. Reviewer: Claude. Native modal dialogs with explicit opener restoration implemented. Done: keyboard/pointer open, Escape, backdrop and close restore a useful focus target on Chromium, Firefox and WebKit. Swipe dismissal is optional and must not interfere with scrolling.

### M8 Clear interaction instructions
Owner: Claude. Reviewer: Grok. Skills now describe selecting stars or browsing categories. Done: no essential action depends on hover, dragging or discovering an unlabeled canvas object; each scene has a text route.

### M9 Readable constellation labels
Owner: Codex. Reviewer: Claude. Dense idle labels are hidden on compact screens, focused labels have caps/collision checks, and all 52 skills have HTML category controls. Done: labels stay outside reading panels and viewport edges; every skill opens its evidence without WebGL selection.

### M10 iOS and Android browser behavior
Owner: Alo with Claude. Reviewer: Codex. Pending real devices. Done: safe areas, dynamic browser bars, visual viewport, orientation, pinch zoom, backgrounding and audio policies work on current/prior-major Safari and Chrome. Playwright WebKit on Windows is not an iPhone test.

## Performance

### P1 Progressive image delivery
Owner: Codex. Reviewer: Claude. Pending. Audit the eager image preload before adding responsive WebP/AVIF variants and lazy detail photos. Done: compare visual quality and three equivalent cold-load runs; preserve useful local fallbacks.

### P2 Lean first load
Owner: Codex. Reviewer: Grok. Duplicate content import corrected; bundling/self-hosting and font reductions remain. Done: establish encoded-byte budgets from reproducible deployment runs, then reduce them without losing blocked-network recovery.

### P3 GPU and battery budget
Owner: Codex. Reviewer: Claude. Hidden-tab score suspension and render work guard implemented; manual/OS reduced motion available. Done: measure frame pacing and battery behavior on a midrange phone before selecting bloom, pixel-ratio and scene-detail budgets. Software-rendered FPS is not phone FPS.

### P4 Performance regression budgets
Owner: Codex. Reviewer: Grok. Audit supports report-only and explicit enforcing modes. Done: set budgets from a stable baseline and exercise failure in CI; field targets remain LCP ≤2.5s, INP ≤200ms and CLS ≤0.1 at p75, not claimed current results.

## Accessibility

### A1 Keyboard and screen readers
Owner: Claude. Reviewer: Codex. Modal, Explore, skill-list and Ask keyboard behavior implemented/tested in emulation. Done: VoiceOver/TalkBack users find resume, ask a question and close details; record real assistive-technology sessions.

### A2 Contrast audit
Owner: Grok. Reviewer: Claude. Brighter daylight exposed welcome/rail contrast issues; dark surfaces were added. Done: normal text ≥4.5:1 and large text ≥3:1 against worst relevant rendered backgrounds; canvas/glass needs manual sampling beyond axe.

### A3 Reduced and paused motion
Owner: Codex. Reviewer: Claude. OS preference updates and explicit Pause motion stop decorative time while keeping navigation/scrolling usable. Done: change preference mid-session, pause/resume, open overlays and background/return without a catch-up animation burst.

### A4 Automated accessibility checks
Owner: Codex. Reviewer: Grok. Initial axe checks covered 12 states; repeat after final UI changes. Done: no unexplained A/AA violations in tested states, with incomplete canvas contrast and manual coverage clearly reported. Scans do not establish full conformance.

## Credibility and visitor tasks

### C1 Real case-study numbers
Owner: Alo. Reviewer: Grok. Pending owned evidence. Done: every performance/user-impact number has a traceable source and scope. Do not invent numbers to strengthen a case study.

### C2 Emergency Alerting RAG case study
Owner: Claude. Reviewer: Codex. Pending evidence from the owning project. Done: explain problem, approach, limitations and results, with readable architecture and citations to real artifacts.

### C3 Claims and Ask red team
Owner: Grok. Reviewer: Codex. Research report supplies 20 cases; API mocks cover malformed input, rates, provider failures, grounding and cancellation. Live-model adversarial outcomes are not yet established. Done: record observed answers, citations and limitations; verify claims against owning repos.

### C4 Thirty-second visitor path
Owner: Claude. Reviewer: Alo. Navigation now exposes work, resume and contact. Done: unfamiliar visitors can explain Alo's role and reach those destinations within 30 seconds; do not substitute an internal opinion for this user test.

### C5 Search and sharing
Owner: Codex. Reviewer: Grok. Existing metadata/text route preserved. Done: validate public titles, canonical URLs, preview image, resume and sitemap without unsupported structured-data claims.

## Optional measurement

### O1 Useful analytics
Owner: Alo decision, Codex implementation. Reviewer: Grok. Deferred. First define a visitor question and necessary aggregate measurement; evaluate existing analytics before collecting more data.

### O2 Questions the site cannot answer
Owner: Alo decision, Codex implementation. Reviewer: Grok. Deferred. Any question logging needs an explicit retention/privacy design; no new logging is added by this roadmap.

## Quick real-phone check

Open the preview over mobile data. Reach Projects from Explore, open/close a case study, find the resume, type in Ask with the keyboard open, rotate the phone, enlarge text, and toggle Sound/motion. Report anything cut off, covered, unexpectedly playing or hard to tap, with device/browser and a screenshot. Optional soundtrack quality is a listening judgement on both headphones and the phone speaker.
