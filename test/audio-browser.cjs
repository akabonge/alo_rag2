// Local-only media/UI regressions. Native recordings decode/play muted; APIs are mocked.
const { chromium } = require('playwright');
const fs = require('node:fs'), path = require('node:path');
const base = new URL(process.argv[2] || 'http://127.0.0.1:5174');
if (!['localhost', '127.0.0.1', '[::1]'].includes(base.hostname)) throw Error('Local server required.');
const out = path.resolve(process.argv[3] || 'test-results/audio'); fs.mkdirSync(out, { recursive: true });
const mirror = process.env.AUDIO_CDN_DIR ? fs.realpathSync(process.env.AUDIO_CDN_DIR) : null;
const checks = [], errors = []; let completed = false, failure, browser;
const check = (name, pass, evidence) => { checks.push({ name, pass: !!pass, evidence }); console.log(`${pass ? 'PASS' : 'FAIL'} ${name}`); };
async function clickVisible(page, selector) { await page.locator(selector).filter({ visible: true }).first().click(); }
(async () => {
  try {
    browser = await chromium.launch({ headless: true, args: ['--mute-audio', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    for (const width of [390, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: width < 768 ? 844 : 900 }, isMobile: width < 768, hasTouch: width < 768, reducedMotion: 'reduce' });
      try {
        await context.route('**/*', async route => {
          const req = route.request(), url = new URL(req.url());
          if (url.pathname.startsWith('/api/')) return route.fulfill({ contentType: 'application/json', body: '{"notes":[],"answer":"Alo builds AI applications.","sources":["Profile"]}' });
          if (!['GET', 'HEAD'].includes(req.method())) return route.fulfill({ status: 405, body: 'Read-only test' });
          if (mirror && url.hostname === 'cdn.jsdelivr.net' && url.pathname.startsWith('/npm/')) {
            const { mirroredFile } = await import('../scripts/audit/audit-core.mjs');
            const file = mirroredFile(mirror, req.url()), pkg = url.pathname.match(/^\/npm\/(three|gsap|lenis)@([^/]+)\//);
            if (!file || !pkg || JSON.parse(fs.readFileSync(path.join(mirror, pkg[1], 'package.json'))).version !== pkg[2]) return route.abort();
            return route.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(file), headers: { 'access-control-allow-origin': '*' } });
          }
          return route.continue();
        });
        await context.addInitScript(() => {
          window.__recordings = []; window.__playCalls = []; window.__contexts = []; window.__blockedPlay = false;
          const OriginalAudio = window.Audio;
          window.Audio = function (...args) { const el = new OriginalAudio(...args); window.__recordings.push(el); return el; };
          window.Audio.prototype = OriginalAudio.prototype;
          const originalPlay = HTMLMediaElement.prototype.play;
          HTMLMediaElement.prototype.play = function () {
            window.__playCalls.push({ src: this.src, activation: navigator.userActivation?.isActive, rate: this.playbackRate });
            if (window.__blockedPlay) { window.__blockedPlay = false; return Promise.reject(new DOMException('Controlled policy block', 'NotAllowedError')); }
            return originalPlay.call(this);
          };
          const OriginalContext = window.AudioContext || window.webkitAudioContext;
          if (OriginalContext) {
            const Wrapped = function (...args) { const ctx = new OriginalContext(...args); window.__contexts.push(ctx); return ctx; }; Wrapped.prototype = OriginalContext.prototype;
            if (window.AudioContext) window.AudioContext = Wrapped; else window.webkitAudioContext = Wrapped;
          }
        });
        const page = await context.newPage(); page.setDefaultTimeout(20000);
        page.on('pageerror', error => errors.push({ width, message: error.message }));
        await page.goto(new URL('/#hero', base).href, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => getComputedStyle(document.querySelector('#loader')).visibility === 'hidden' && document.querySelector('#tour-replay'));
        await clickVisible(page, '[data-tour]');
        for (let index = 1; index <= 2; index++) {
          await page.waitForFunction(index => { const a = window.__recordings[0]; return a && a.currentSrc.includes(`tour-${index}.mp3`) && !a.paused && a.readyState >= 2 && document.querySelector('#tour-status').textContent.includes('is playing'); }, index);
          const state = await page.evaluate(() => ({ count: window.__recordings.length, rate: window.__recordings[0].playbackRate, calls: window.__playCalls, duration: window.__recordings[0].duration }));
          check(`${width}: native tour recording ${index} plays on the shared element at normal speed`, state.count === 1 && state.rate === 1 && state.duration > 0 && state.calls[0].activation, state);
          if (index === 1) await page.evaluate(() => { const audio = window.__recordings[0]; audio.currentTime = audio.duration - 0.08; });
        }
        const layout = await page.locator('#tour').evaluate(el => { const r = el.getBoundingClientRect(); return { width: r.width, top: r.top, bottom: r.bottom, overflow: el.scrollWidth > el.clientWidth, viewport: innerHeight }; });
        check(`${width}: tour controls fit the viewport`, !layout.overflow && layout.top >= 0 && layout.bottom <= layout.viewport + 1, layout);
        await page.screenshot({ path: path.join(out, `tour-${width}.png`) });
        await page.locator('#tour-skip').click();
        const greetingCalls = await page.evaluate(() => window.__playCalls.length);
        await page.locator('#greet-reply').click();
        await page.waitForFunction(() => window.__recordings[0].currentSrc.includes('gyendi.mp3') && !window.__recordings[0].paused);
        const greeting = await page.evaluate(() => ({ replyButtonVisible: !document.querySelector('#greet-reply').hidden, replyVisible: !document.querySelector('#oli-reply').hidden, feedbackHidden: document.querySelector('#voice-feedback').hidden }));
        await page.locator('#greet-reply').click();
        await page.waitForFunction(before => window.__playCalls.length >= before + 2 && window.__recordings[0].currentSrc.includes('gyendi.mp3'), greetingCalls);
        check(`${width}: Gyendi remains replayable without a playback banner`, greeting.replyButtonVisible && greeting.replyVisible && greeting.feedbackHidden, greeting);
        await page.locator('#voice-dismiss').evaluate(button => button.click());
        await page.evaluate(() => { window.__blockedPlay = true; });
        await page.locator('#hear-greet').click();
        await page.waitForFunction(() => !document.querySelector('#voice-retry').hidden);
        check(`${width}: denied recording shows actionable continuation`, (await page.locator('#voice-status').innerText()).includes('paused'), await page.locator('#voice-status').innerText());
        await page.locator('#voice-retry').click();
        await page.waitForFunction(() => !window.__recordings[0].paused && document.querySelector('#voice-feedback').hidden);
        check(`${width}: a direct retry plays unobtrusively on the same recording element`, await page.evaluate(() => window.__recordings.length === 1 && !window.__recordings[0].paused && document.querySelector('#voice-feedback').hidden), await page.evaluate(() => window.__playCalls.slice(-2)));
        // Dispatch synchronously: this short greeting can end between Playwright's
        // visibility check and pointer action on slower CI runners.
        await page.locator('#voice-dismiss').evaluate(button => button.click());
        await page.waitForFunction(() => window.__recordings[0].paused);
        check(`${width}: Stop voice halts the shared recording element`, true);
        await clickVisible(page, '[data-sound]');
        await page.waitForFunction(() => window.__contexts.length && window.__contexts[0].state === 'running' && [...document.querySelectorAll('[data-sound]')].every(el => el.getAttribute('aria-pressed') === 'true'));
        await page.evaluate(() => window.__contexts[0].suspend());
        await page.waitForFunction(() => [...document.querySelectorAll('[data-sound]')].every(el => el.getAttribute('aria-label') === 'Resume score'));
        await clickVisible(page, '[data-sound]');
        await page.waitForFunction(() => window.__contexts[0].state === 'running' && [...document.querySelectorAll('[data-sound]')].every(el => el.getAttribute('aria-pressed') === 'true'));
        check(`${width}: suspended soundtrack resumes with one direct tap`, true, await page.evaluate(() => window.__contexts.map(ctx => ctx.state)));
        await clickVisible(page, '[data-sound]');
        await page.waitForFunction(() => window.__contexts[0].state === 'suspended');
        check(`${width}: soundtrack opt-out suspends the context`, true);
      } finally { await context.close(); }
    }
    check('Audio flows have no uncaught JavaScript errors', errors.length === 0, errors); completed = true;
  } catch (error) { failure = error.message; console.error(error); process.exitCode = 1; }
  finally { await browser?.close(); fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ completed, failure, dependencyMode: mirror ? 'locked local mirror' : 'native CDN', checks, errors, limitations: ['Muted Chromium media playback is not a physical iPhone speaker/autoplay-policy test.', 'One deliberate play() rejection and one explicit context suspension exercise recovery UI; API calls are mocked.'] }, null, 2)); }
  if (checks.some(item => !item.pass)) process.exitCode = 1;
  console.log(`${checks.filter(item => item.pass).length}/${checks.length} audio checks passed; completed=${completed}`);
})();
