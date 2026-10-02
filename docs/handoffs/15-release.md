# Mobile audio and release-safety integration

Owner: Codex. Branch: `codex/mobile-audio-release-safety`. Starting commit: `c1b120e`.

This release combines the iPhone audio repair, AK favicon set, current-employment wording, shared Ask limit, hardened live checks, immediate first paint and the final mobile overlap fixes. The visible developer progress screen and the intrusive automatic “running slowly” prompt are gone. Slow rendering still drops to the low graphics tier. The text version remains available through Explore and through the renderer/CDN failure notice.

Local verification at final working-tree state:

- `npm test`: 108 tests, 106 passed, 2 skipped, 0 failed. The skipped suites execute real Ask and guestbook Lua against loopback Redis; CI supplies Redis and requires them.
- Native audio browser suite: 15/15 at 390×844 and 1440×900.
- Browser smoke suite before the final focus tweak: 83/83. After removing the slow-device overlay, the added mobile reachability checks passed for the hero calls to action, last project and resume link. A focused follow-up passed Ask close/focus restoration at 320×568, 390×844, 844×390 and 1024×768.
- Experience suite: 46/46, including 200% text and control reachability.
- Progressive media/WebGL suite: 41/41 after fixing the lite prompt intercepting an open Explore menu.
- Audit probe: 6/6. The locked-dependency phone audit found zero sub-44px targets. Its remaining occlusion candidates are the intentional fixed control zone crossing a sampled part of a long scrollable card; focused browser checks prove representative last items scroll fully above that zone.
- `git diff --check` and page generation passed. No production API writes or model calls occurred in local browser tests.

The MP3s were level-adjusted with constant gain only. Duration and decoded waveform correlation were verified against local backups; no trimming, denoising, time stretching, pitch shifting or voice replacement was used. The longer original M4A takes remain local, including material that may contain Alo's laughter. Restoring a specific moment requires Alo to identify the preferred take, or a new clean recording.

Physical iPhone 15 Pro Chrome acceptance is still required after deployment: hear at least two consecutive tour stops, replay greetings, start/stop Sound, background and return, and exercise Continue/Resume. Headless Chromium cannot prove a phone speaker, volume route, Bluetooth route or WebKit media policy.
