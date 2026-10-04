# 3D clicks: no stray "Add your star", working place pins (Claude)

Reported by Alo on 2026-10-04: clicking almost anywhere opened the star form, and Uganda/Fredericksburg on the journey globe did nothing.

## Causes

1. The guest-star sky dome was registered as a click target. It follows the camera, and with an empty guestbook its geometry holds one placeholder point at the camera's own position. With `Points.threshold = 5`, every ray hit it first, so every canvas click opened the guestbook.
2. `Raycaster` ignores `visible`, so hidden objects from other stations could still win a pick.
3. The globe's invisible catch-all sphere encloses the place markers, so it could win over them.
4. 3D actions ran on `pointerup`. A dialog opened there received the browser's follow-up `click` on its scrim and closed at once (phone bottom sheet).
5. Pointer parallax also followed touch, shifting the camera toward each swipe so small edge targets (the Uganda label on phones) moved out from under the finger.

## Change (`src/main.js`, `src/page.html`)

- Sky dome is decoration only (no click target). Visitors add stars from the Visitors' sky station's "Add my star" button; the header "Leave a star" chip is removed.
- `pick()` skips hidden objects and lets entries marked `fallback` (the globe sphere) yield to specific targets.
- 3D actions run in the canvas `click` event, recorded from `pointerup`.
- Flags and poles open their place page; each place dot has a 0.5-unit invisible tap pad. On screens under 720 px, place labels sit at 1.2x the globe radius (1.5x on wider screens) so they stay on screen.
- Parallax and hover ignore touch pointers (no camera drift toward each swipe, no label pulses or pings while scrolling); mouse hover reads the pointer position directly.

## Amadinda over Uganda (same PR)

Alo asked for the amadinda to be more present and symbolic in the Uganda section. The interlocking okunaga/okwawula parts were thin sine beeps every other pulse under the guitar. Now:

- A wooden-bar voice: fundamental plus fast-decaying inharmonic partials (about 2.76x, 5.4x) and a short band-passed mallet knock, on its own bus without the drum low-pass.
- The two parts interlock on every pulse, with okunaga doubled an octave up.
- Over the globe the amadinda bus leads (0.8) and the guitar steps back (0.9 to 0.45). During the flight it sits under the drums (0.5).

## Checks actually run

- Desktop 1440x900 (mouse): Uganda and Fredericksburg pins open their place pages; empty sky does not open the star form; "Add my star" opens it.
- Phones: real touch taps on a 16 px grid over the journey scene (iPhone 15 393x852: 600 taps; iPhone SE 375x667: 414; Galaxy A14 360x800: 506). The star form opened 0 times. Uganda opens from 12-20 grid spots (was 1-8), Fredericksburg 10-17 (was 3-7), UMW 11-12. No page errors.
- Unit and browser suites: see PR.
