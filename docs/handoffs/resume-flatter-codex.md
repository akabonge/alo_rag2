# Resume and Flatter content refresh

## Changes

- Replaced the downloadable resume with Alo's supplied two-page PDF. The published bytes match the source SHA-256 `7ECF1B1A6513BDAE57317ECE1B6C7291F31C9F15B3077504EDA07C385D40145E`; extracted text contains no phone-number pattern.
- Set every 3D and text-fallback download name to `Aloysious Kabonge Resume.pdf`.
- Rewrote the Flatter entry in present tense around PersonaOpps, emerging-technology evaluation, governed agentic workflows, Azure DevOps CI/CD, Azure Static Web Apps, Vue.js, JavaScript, HTML and CSS, removing duplicated responsibilities.
- Regenerated `src/index.html` and `src/text.html`, and bumped the content/Ask/main cache versions to 24.

## Validation

- `python -X utf8 test/wrap.py`
- `node test/make_text.mjs`
- `node --check src/main.js`
- `node --check src/content.js`
- `node --check test/make_text.mjs`
- `git diff --check`
- `npm test`: 108 passed, 2 intentionally skipped local-Redis tests, 0 failed.
- `test/browser-smoke.cjs`: the layout and interaction run passed 82 checks before an unrelated guestbook locator timing timeout; the isolated guestbook run then passed 14/14 with no uncaught JavaScript errors.
- Source PDF rendered at 144 DPI and both pages were visually inspected; no clipping, overlap or malformed glyphs were found.

## Release

- Branch: `codex/resume-flatter-refresh`
- Commit and pull request: recorded after publication.
- Remaining acceptance: confirm the named download and updated Flatter copy on the production domain after merge.
