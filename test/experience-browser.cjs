// Focused UI-state checks. Run against a local static server; APIs are mocked.
// node test/experience-browser.cjs http://127.0.0.1:5174 ../alo-office/qa/experience
// EXPERIENCE_LAYOUT_ONLY=1 limits a secondary-engine run to the viewport/text matrix.
const playwright = require(process.env.PLAYWRIGHT_PACKAGE_PATH || 'playwright');
const fs = require('node:fs');
const path = require('node:path');
const engine = process.env.PLAYWRIGHT_BROWSER || 'chromium';
if (!['chromium', 'firefox', 'webkit'].includes(engine)) throw new Error('Unsupported PLAYWRIGHT_BROWSER.');
const base = process.argv[2] || 'http://127.0.0.1:5174';
if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(base).hostname)) throw new Error('Use a local server; this suite must not write to production.');
const output = process.argv[3] ? path.resolve(process.argv[3]) : null;
if (output) fs.mkdirSync(output, { recursive: true });
const results = [];
const check = (name, passed, evidence) => { results.push({ name, passed: !!passed, evidence }); console.log(`${passed ? 'PASS' : 'FAIL'} ${name}: ${JSON.stringify(evidence)}`); };
let browser, runtimeFailure;
async function open(width = 390, height = 844, options = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce', hasTouch: width < 1100, ...(engine !== 'firefox' ? { isMobile: width < 768 } : {}), ...options });
  await ctx.route('**/api/guestbook', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{"notes":[]}' }));
  await ctx.route('**/api/ask', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await ctx.addInitScript(() => {
    window.__observedAudioContexts = [];
    const instrument = Constructor => Constructor && new Proxy(Constructor, { construct(Target, args, NewTarget) { const instance = Reflect.construct(Target, args, NewTarget); window.__observedAudioContexts.push(instance); return instance; } });
    if (window.AudioContext) window.AudioContext = instrument(window.AudioContext);
    if (window.webkitAudioContext) window.webkitAudioContext = instrument(window.webkitAudioContext);
  });
  const page = await ctx.newPage();
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.locator('#loader.done').waitFor({ state: 'attached', timeout: 20000 });
  await page.waitForFunction(() => getComputedStyle(document.querySelector('#loader')).visibility === 'hidden');
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  return { ctx, page };
}
async function screenshot(page, name) { if (output) await page.screenshot({ path: path.join(output, name + '.png') }); }

(async () => {
  browser = await playwright[engine].launch({ headless: true });
  try {
    if (!process.env.EXPERIENCE_LAYOUT_ONLY) {
      const { ctx, page } = await open();
      const soundState = () => page.evaluate(() => ({ contexts: window.__observedAudioContexts.map(ctx => ctx.state), pressed: [...document.querySelectorAll('[data-sound]')].map(button => button.getAttribute('aria-pressed')) }));
      const initial = await soundState();
      check('Sound starts off and creates no AudioContext before consent', initial.contexts.length === 0 && initial.pressed.length === 2 && initial.pressed.every(value => value === 'false'), initial);
      await page.locator('[data-sound]').filter({ visible: true }).first().click();
      await page.waitForFunction(() => window.__observedAudioContexts.some(ctx => ctx.state === 'running'));
      const on = await soundState();
      check('Sound opt-in starts one context and synchronizes both controls', on.contexts.length === 1 && on.contexts[0] === 'running' && on.pressed.every(value => value === 'true'), on);
      await page.locator('[data-sound]').filter({ visible: true }).first().click();
      await page.waitForFunction(() => window.__observedAudioContexts.every(ctx => ctx.state !== 'running'));
      const off = await soundState();
      check('Sound opt-out suspends audio and synchronizes both controls', off.contexts.length === 1 && off.contexts[0] !== 'running' && off.pressed.every(value => value === 'false'), off);

      await page.locator('#ask-toggle').click(); await page.locator('#section-menu summary').click();
      await page.waitForFunction(() => document.querySelector('#ask').hidden);
      check('Explore closes Ask while keeping navigation open', await page.evaluate(() => document.querySelector('#ask').hidden && document.querySelector('#section-menu').open), {});
      await page.locator('#ask-toggle').click();
      check('Ask closes Explore while keeping the question panel open', await page.evaluate(() => !document.querySelector('#ask').hidden && !document.querySelector('#section-menu').open), {});
      await page.keyboard.press('Escape');

      const { SKILLS, COMMUNITY } = await import('../src/content.js');
      const expected = Object.values(SKILLS).flat();
      const exposed = [];
      const groups = page.locator('#skill-cats details');
      for (let index = 0; index < await groups.count(); index++) {
        const group = groups.nth(index);
        await group.locator('summary').click();
        exposed.push(...await group.locator('button').filter({ visible: true }).allTextContents());
      }
      const missing = expected.filter(name => !exposed.includes(name));
      check('Every published skill is available through readable category controls', expected.length > 0 && exposed.length === expected.length && missing.length === 0, { categories: await groups.count(), expected: expected.length, exposed: exposed.length, missing });
      const skill = groups.first().locator('button').first();
      const skillName = await skill.innerText(); await skill.click();
      check('A text skill control opens its matching native detail dialog', await page.locator('#drawer').evaluate(el => el.matches(':modal')) && (await page.locator('#drawer-title').innerText()) === skillName, { skillName });
      await page.keyboard.press('Escape');
      const videoBuild = COMMUNITY.builds.find(build => build.video);
      await page.locator(`[data-open="build:${videoBuild.id}"]`).first().click();
      const video = page.locator('#drawer video');
      const media = await video.evaluate(el => ({ controls: el.controls, preload: el.preload, autoplay: el.autoplay, paused: el.paused, playsInline: el.playsInline }));
      check('Video starts paused with native controls, inline playback and no preload', media.controls && media.preload === 'none' && !media.autoplay && media.paused && media.playsInline, media);
      // Observe the real cleanup method without downloading/decoding the full clip.
      await video.evaluate(el => { window.__drawerVideoPauseCalls = 0; const original = el.pause.bind(el); el.pause = () => { window.__drawerVideoPauseCalls++; return original(); }; });
      await page.keyboard.press('Escape');
      const cleanup = await page.evaluate(() => ({ calls: window.__drawerVideoPauseCalls, paused: document.querySelector('#drawer video').paused }));
      check('Closing a video drawer explicitly pauses its media', cleanup.calls === 1 && cleanup.paused, cleanup);
      await ctx.close();
    }
    if (!process.env.EXPERIENCE_LAYOUT_ONLY) {
      const { ctx, page } = await open(1440, 900, { reducedMotion: 'no-preference' });
      const state = () => page.evaluate(() => ({ reduced: document.documentElement.classList.contains('motion-paused'), lenis: document.documentElement.classList.contains('lenis'), scrollY, buttons: [...document.querySelectorAll('[data-motion]')].map(button => ({ pressed: button.getAttribute('aria-pressed'), disabled: button.disabled })) }));
      await page.locator('[data-motion]').filter({ visible: true }).first().click();
      const paused = await state();
      check('Manual motion pause synchronizes controls and releases smooth scrolling', paused.reduced && !paused.lenis && paused.buttons.every(button => button.pressed === 'true' && !button.disabled), paused);
      await page.mouse.move(200, 300); await page.mouse.wheel(0, 350);
      await page.waitForFunction(before => document.documentElement.classList.contains('motion-paused') && Math.abs(scrollY - before) > 5, paused.scrollY, { timeout: 5000 }).catch(() => {});
      const scrolled = await state();
      check('Manual motion pause preserves ordinary scrolling', scrolled.reduced && !scrolled.lenis && Math.abs(scrolled.scrollY - paused.scrollY) > 5, { before: paused.scrollY, after: scrolled.scrollY, reduced: scrolled.reduced, lenis: scrolled.lenis });
      await page.locator('[data-motion]').filter({ visible: true }).first().click();
      const resumed = await state();
      check('Manual motion resume restores the chosen interactive mode', !resumed.reduced && resumed.lenis && resumed.buttons.every(button => button.pressed === 'false' && !button.disabled), resumed);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.waitForFunction(() => [...document.querySelectorAll('[data-motion]')].every(button => button.disabled));
      const forced = await state();
      check('OS reduced-motion preference forces pause and disables overrides', forced.reduced && !forced.lenis && forced.buttons.every(button => button.pressed === 'true' && button.disabled), forced);
      await ctx.close();
    }
    for (const [width, height] of [[320, 568], [390, 844], [1101, 900], [1280, 900], [1440, 900], [1920, 1080]]) {
      const { ctx, page } = await open(width, height);
      const initialWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      check(`Initial controls at ${width}px fit without horizontal overflow`, initialWidth <= width, { width, document: initialWidth });
      const initialTargets = await page.evaluate(() => [...document.querySelectorAll('.hud-top a, .hud-top button, #experience-controls > button, #experience-controls > details > summary')].map(el => {
        const rect = el.getBoundingClientRect(), style = getComputedStyle(el);
        if (!rect.width || !rect.height || style.visibility === 'hidden' || style.display === 'none') return null;
        const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        return { text: el.textContent.trim(), left: rect.left, right: rect.right, inside: rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight, receivesPointer: hit === el || el.contains(hit) };
      }).filter(Boolean));
      check(`100% text at ${width}px keeps visible header/dock controls inside the viewport and reachable`, initialTargets.length > 0 && initialTargets.every(target => target.inside && target.receivesPointer), initialTargets);
      await screenshot(page, `welcome-${width}`);
      if (width === 320) {
        for (const selector of ['#welcome [data-jump="hero"]', '#welcome [data-tour]']) {
          await page.locator(selector).evaluate(el => el.scrollIntoView({ block: 'center', inline: 'nearest' }));
          const hit = await page.locator(selector).evaluate(el => { const rect = el.getBoundingClientRect(); const node = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2); return { receivesPointer: node === el || el.contains(node), top: rect.top, bottom: rect.bottom, height: rect.height }; });
          check(`320px welcome reading surface preserves ${selector} pointer access`, hit.receivesPointer && hit.height >= 44, hit);
        }
      }
      await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
      await page.waitForFunction(() => parseFloat(getComputedStyle(document.documentElement).fontSize) === 32 && document.documentElement.classList.contains('controls-compact'));
      await page.waitForFunction(() => getComputedStyle(document.querySelector('#experience-controls')).display === 'grid');
      const resize = await page.evaluate(() => {
        const dock = document.querySelector('#experience-controls');
        const controls = [...dock.querySelectorAll(':scope > button, :scope > details > summary')].map(el => ({ text: el.textContent.trim(), width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height, top: el.getBoundingClientRect().top }));
        const targets = [...document.querySelectorAll('.hud-top a, .hud-top button, #experience-controls > button, #experience-controls > details > summary')].map(el => {
          const rect = el.getBoundingClientRect(), style = getComputedStyle(el);
          if (!rect.width || !rect.height || style.visibility === 'hidden' || style.display === 'none') return null;
          const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
          return { text: el.textContent.trim(), left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, inside: rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight, receivesPointer: hit === el || el.contains(hit) };
        }).filter(Boolean);
        return { width: innerWidth, document: document.documentElement.scrollWidth, rootFont: getComputedStyle(document.documentElement).fontSize, dockVisible: getComputedStyle(dock).display !== 'none', dock: dock.getBoundingClientRect().toJSON(), controls, targets };
      });
      check(`200% text at ${width}px avoids document overflow`, resize.document <= width, resize);
      check(`200% text at ${width}px keeps visible header/dock controls inside the viewport and reachable`, resize.targets.length > 0 && resize.targets.every(target => target.inside && target.receivesPointer), resize.targets);
      if (resize.dockVisible) check(`200% text at ${width}px keeps every dock target at least 48px`, resize.controls.length === 4 && resize.controls.every(control => control.width >= 48 && control.height >= 48), resize.controls);
      await screenshot(page, `text-200-${width}`); await ctx.close();
    }
  } catch (error) { runtimeFailure = { name: error.name, message: error.message }; throw error; }
  finally {
    const browserVersion = browser.version(); await browser.close();
    if (output) fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ timestamp: new Date().toISOString(), engine, browserVersion, completed: !runtimeFailure, runtimeFailure, results }, null, 2));
    const failures = results.filter(result => !result.passed);
    console.log(`${results.length - failures.length}/${results.length} checks passed.${runtimeFailure ? ' Suite incomplete.' : ''}`);
    if (failures.length) process.exitCode = 1;
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
