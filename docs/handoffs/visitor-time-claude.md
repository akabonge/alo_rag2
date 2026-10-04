# Journey clocks: English formatting and the visitor's own time (Claude)

Requested by Alo on 2026-10-03 after checking how the site handles visitors in other time zones.

## Findings before the change

- The top clock and the 3D sky already follow the visitor's device time zone, date rollover and locale. No change.
- The journey line ("Right now: Kampala … · Fredericksburg …") used IANA zones, so times and daylight saving were correct everywhere, but it used the visitor's locale inside an English sentence (Belgium: "dim. 04:31 · sam. 21:31"; Japan: "4:31 (日)").

## Change

- `src/main.js`: journey clocks format with `en-US`. The visitor's city is taken from `Intl.DateTimeFormat().resolvedOptions().timeZone` (no geolocation) and shown as "· You (Tokyo) Sun 10:38 AM". Hidden for `Africa/Kampala`, `America/New_York`, `Etc/*` and zones without a region (UTC).
- `src/page.html`: hidden `#t-you-wrap` span in the clocks line. `src/index.html` regenerated.

## Checks actually run

- Local Playwright with emulated time zones and locales: New York, Los Angeles, Brussels (fr-BE), Tokyo (ja-JP), Kampala (en-UG), Buenos Aires (es-AR), UTC. All lines correct; no page errors.
- `npm test` and the four browser suites: see PR.

# Visitors' sky: brighter stars, sharper phones, close-up after posting (Claude)

Requested by Alo on 2026-10-03: visitor stars looked dim, blurry and "as if they are not there", and a visitor should see their own star after posting.

## Causes

- Star sprites were soft 128 px radial blobs at 1.2-1.9 world units, so they read as dim lights.
- Phones start on the low tier, which rendered at 1x pixel ratio. On a 3x iPhone every frame was upscaled 3x, so the whole scene and its labels looked blurry.
- After posting, the camera only returned to the station; the new star pulsed at a distance, partly behind the phone panel.

## Change

- Star texture: 256 px, white-hot core, gold halo and four diffraction rays. Sizes 2.4-3.1 (newest 3.4), labels 1.25 tall, constellation spacing widened. Twinkle via opacity, scale and slight ray rotation (off with reduced motion).
- Low tier renders at `min(devicePixelRatio, 1.5)`. The frame watchdog adds one more step: if still slow at 1.5x, drop to 1x.
- After a confirmed post, the camera eases to 7.5 units (desktop) or 10 units (phone, star framed above the panel) in front of the new star, shows "Your star: name · city: message", holds 4.5 s and eases back. Wheel, touch or key releases it at once. Reduced motion keeps the toast without camera motion.

## Checks actually run

- Local Playwright on the Intel GPU with the guestbook API mocked to the 3 live notes: desktop 1440x900 and phone 393x852 before/after screenshots, a submitted note, the close-up at about 2.3 s after arrival, and the return. No page errors.
- Live guestbook has 3 notes; Alo reported adding 4. Not investigated further here.
