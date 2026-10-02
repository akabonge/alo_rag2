# AK icons and current-employment wording

Implemented on `codex/mobile-audio-release-safety`, based on main `c1b120ec13902c2531b17680038c60fb685e34b3`. Integration, page generation, commit and PR are owned by the release lead; this handoff does not claim deployment.

The previous main page's icon link was already inside the generated `<head>`: `src/page.html` is a template fragment, and `test/wrap.py` places its prefix there. The concrete compatibility gap was a single SVG icon with no conventional ICO, PNG or Apple touch fallback. This inspection does not establish the cause of a particular iPhone browser's blank globe.

The new hand-drawn AK paths use the 2D site's rounded square, dark `#0B0D12` background and teal `#0F766E` lettering. They do not depend on an installed font. `test/make_icons.py` reproducibly generates the SVG, ICO containing 16/32/48 sizes, 16/32/192 PNG files and an opaque 180-pixel Apple touch icon using Pillow. The committed output can be served without Pillow or a generation step. Icon links in the main template, text-page generator and ProofMode page use `?v=2`; `/favicon.ico` also exists for conventional discovery. No web manifest or installable-app claim was added.

`src/ask.js` now states only **Currently working at Flatter, Inc.** The former job-search statement is removed. Availability and hire questions still retrieve Contact through query aliases for current employment; the query-free content import, profile aliases and unrelated-question grounding remain intact. Local excerpts and numbered prompt sources contain the employment fact without inventing a positive or negative availability status. `AGENTS.md` now records that same rule. Historical handoffs remain dated evidence, not current copy.

Validation completed:

- `node --test test/ask-redteam.test.mjs`: 9/9 passed, including seven availability/hire phrasings, local excerpts, prompt sources and mocked API metadata.
- `node --test --test-name-pattern="Ask|retrieval" test/api.test.mjs`: 8/8 passed, including Profile/White House grounding, provider failures, timeout and caching contracts.
- Changed JavaScript syntax checks and `git diff --check` passed.
- Pillow readback verified PNG/Apple dimensions and all three ICO sizes. The 192-pixel icon was visually inspected; it shows clear teal AK on the rounded dark square.

No live model call, production write, browser launch or physical iPhone verification occurred for this scoped work. Mocked provider tests verify retrieval and prompt assembly, not whether a live model follows those instructions.

Integration follow-through: regenerate `src/index.html` and `src/text.html` after the audio markup is complete. Update the browser import from `ask.js?v=16` to a new version and the session answer-cache key so reloaded tabs do not reuse older wording. The release lead owns those `main.js` changes and final generated-page validation. Browser icon stores and existing installed home-screen shortcuts may retain an old icon until their own refresh; `?v=2` requests the new assets without claiming control over those stores.
