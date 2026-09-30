# Experience design and research decisions

Updated 2026-09-30. Actual Claude Opus 5.5 reviewed source and proposed the interaction spec. Actual Grok 4.7 researched primary pages through Cline/OpenRouter and challenged the archive and implementation. Codex integrated changes and reproduced findings. Neither source review is a claim of a physical-device test.

## What informed the design

- [Bruno Simon's portfolio](https://bruno-simon.com/) exposes audio, quality, recovery and device-specific controls alongside its world. We adopted visible controls and recovery, while retaining Alo's Uganda-to-Fredericksburg story. HTML inspection does not verify its phone rendering.
- [Lusion](https://lusion.co/) exposes named projects, navigation and media controls. Alo's projects and all skill names remain navigable HTML alongside the 3D presentation.
- [Active Theory](https://activetheory.net/) returned a JavaScript-required message to the text reader. That limitation reinforces the need for Alo's independently reachable text portfolio; no claim is made about its rendered app.
- [W3C target sizing](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) distinguishes AA requirements/exceptions from our larger ergonomic target. [Contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) informs rendered-pixel checks. [Pause/stop/hide](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html) informs the manual motion control.
- [MDN Web Audio practices](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices) and [W3C audio control](https://www.w3.org/WAI/WCAG22/Understanding/audio-control.html) inform explicit opt-in and reachable mute controls.

## Implemented direction

Compact screens have one dock for Ask, Explore, Tour and Sound. It wraps with enlarged text, reserves its measured height and yields to the software keyboard. Desktop Ask joins the header, removing the floating button from the reading area. Explore/Ask are exclusive; native dialogs make the surrounding page inert and explicitly restore their opener across pointer and keyboard browsers.

Welcome/hero text sits on a near-opaque dark surface. Secondary copy is brighter, body copy remains readable and long headings can wrap. Daylight screenshot review caught weak gold-on-sky contrast in welcome and rail labels; both gained dark surfaces. This is a concrete review correction, not a blanket accessibility certification.

`localAtmosphere` follows the visitor's device clock. Daytime changes sky, fog, illumination and stars; evening warms the horizon; night retains the deep-blue identity. It is an artistic daily cycle, not latitude/season-aware astronomy or live weather. The phase is visible on phones. The story's arrival glow remains separate from local time.

Constellation annotations have viewport and reading-panel exclusions, a small-screen cap and collision checks. Compact views hide dense idle sprite names. Five HTML categories expose all 52 skills and their evidence, so a small star is never the only route to the content.

The original procedural score adds a recurring eight-bar piano phrase, chord-aware bells, guitar/percussion around the journey, quieter reverb and narration ducking. It adds no music download or third-party recording. Sound begins off, flight does not enable it, background tabs suspend it, and rapid toggles cannot revive stale intent. Tour narration has its own immediate mute and cancellation generation. Emotional effect remains a listening judgement, not a test score.

Manual Pause motion and live OS reduced-motion changes freeze decorative time while preserving native scrolling and navigation. The renderer may still draw to support interaction; absence of a stopped animation loop is not evidence that the scene keeps animating.

## Review reconciliation

Several Grok concerns described an intermediate tree: header controls are hidden while the dock is shown; sky phase has its own visible span; the reduced-motion change listener is present; skill names have HTML controls. Those concerns were checked rather than copied into a defect list. Its earlier `alo-grok` implementation edits remain isolated and were not merged over newer reviewed work.

The roadmap archive was adapted rather than blindly applied: Playwright remains pinned to 1.62.1, first-load accounting is separated from later interactions, repeated control counts are deduplicated and existing issues #6–#11 remain the task groups. Optional analytics and question logging remain deferred.

Remaining evidence: actual iOS/Android keyboards and screen readers, subjective listening, field performance, live-model adversarial replies, and owned proof for external product claims. The five Railway demo home pages and ProofMode returned HTTP 200 with expected titles; this establishes reachability only, not transaction or assistant correctness.
