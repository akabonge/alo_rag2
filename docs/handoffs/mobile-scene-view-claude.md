# Phones: show each 3D scene before its panel (Claude)

Reported by Alo on 2026-10-03: on iPhone, the journey section never shows the globe, the flight or the plane.

## Cause

The scene rendered on phones; it was hidden. At 393×852 the journey panel is 361×913, taller than the screen. Stations were one screen tall (`min-height: 100svh`) and `measureStops()` stopped with a tall panel's top at the HUD, so the camera finished arriving exactly when the panel covered the canvas. Every station on phones was affected; journey was the most visible.

## Change (phones, max-width 720 px; desktop and tablets unchanged)

- `src/page.html`: `.controls-compact .station:not(.welcome) { padding-top: 62svh; }` gives each scene its own screen above the panel.
- `src/main.js`: on phones, `measureStops()` stops with the panel's top at 60% of the viewport, so the scene is framed and the panel's heading peeks from below. Scrolling on slides the panel over the scene as before.
- `src/page.html`: `.controls-compact` sets `scroll-padding-bottom` to the dock height, so `scrollIntoView` and keyboard focus keep targets clear of the fixed dock. This fixed a media-suite failure where the RAG case row stopped behind the dock at 390 px.
- `src/index.html` regenerated.

## Checks actually run

- Local Playwright, Chromium on the Intel GPU (D3D11), 393×852 touch and 1440×900, against `python -m http.server`:
  - Journey on phone: panel top 511 px (was 111), globe, arc, flags, plane and UMW label visible. Desktop journey unchanged (panel top 110, same scroll offset 3261).
  - All nine stations on phone stop with the panel top at 511-512 px and their scene visible above. No page errors.
- `npm test`: 108 pass, 2 skipped, 0 fail.
- `test:browser` 86/86, `test:experience` 47/47, `test:audio` 19/19. `test:media`: see PR.
- `build:page` leaves `index.html`/`text.html` unchanged.

## Trade-offs and open items

- Phone scroll length grows by about 0.6 of a screen per station.
- The hero brain sphere is mostly below the panel at the hero stop on phones; framing per station could be tuned in the camera path later.
- Not checked on a physical iPhone. Alo should confirm on his iPhone 15 Pro after deploy.
