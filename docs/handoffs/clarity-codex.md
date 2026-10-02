# Microsoft Clarity analytics

## Changes

- Added the Microsoft Clarity loader for public project `yr9ooxj17y`.
- Limited the loader to the canonical `3d.aialo.io` hostname so local development, CI and Vercel previews do not create analytics sessions.
- Included the loader in the main 3D experience, generated text alternative and ProofMode case study.
- Documented Clarity in the README architecture diagram and the complete technology inventory.

## Validation

- `python -X utf8 test/wrap.py`
- `node test/make_text.mjs`
- `node --check src/clarity.js`
- `node --check test/make_text.mjs`
- `git diff --check`
- Focused Playwright check: zero Clarity requests on localhost; exactly one request to `https://www.clarity.ms/tag/yr9ooxj17y` from each of the main, text and ProofMode pages when served under a simulated `3d.aialo.io` hostname. The external script was fulfilled locally, so this check created no Clarity session.
- `npm test`: 108 passed, 2 intentionally skipped local-Redis tests, 0 failed.

## Release

- Branch: `codex/clarity-analytics`
- Implementation commit: `80ab9a7`
- Pull request: <https://github.com/akabonge/alo_rag2/pull/22>
- Remaining acceptance: confirm the production page requests the project tag after merge. Clarity states that dashboard data can take up to two hours to appear.
