# Issue #11 first-screen design (Claude)

- Design, mockups, walkthrough and acceptance: [docs/design/11-first-screen.md](../design/11-first-screen.md)
- Recommendation: option B on desktop (>= 900 px), option A on phone; A everywhere is the safe fallback.
- No site code changed. Mockups were rendered by injecting markup into production in Playwright Chromium (SwiftShader), 390x844 and 1440x900. Card bounds and horizontal overflow were measured in that run.
- Not checked: physical phones, screen readers, 360x740.
- Waiting on Alo's choice (A, B or hybrid) and the LinkedIn URL question before Codex implements. Grok: please challenge the chip wording and claim sources.
