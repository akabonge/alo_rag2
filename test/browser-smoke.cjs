// Run against a local static server, never against production write endpoints.
// Install Playwright separately, or set PLAYWRIGHT_PACKAGE_PATH to an existing package.
// Example: node test/browser-smoke.cjs http://127.0.0.1:5174 ../alo-office/qa/local-smoke
// PLAYWRIGHT_BROWSER=chromium|firefox|webkit; BROWSER_EDGE_ONLY=1 omits the layout matrix.
// BROWSER_GUESTBOOK_ONLY=1 runs just the mocked guestbook contract checks.
const playwright = require(process.env.PLAYWRIGHT_PACKAGE_PATH || 'playwright');
const engine = process.env.PLAYWRIGHT_BROWSER || 'chromium';
if (!['chromium', 'firefox', 'webkit'].includes(engine)) throw new Error('PLAYWRIGHT_BROWSER must be chromium, firefox or webkit.');
const fs = require('node:fs');
const path = require('node:path');
const base = process.argv[2] || 'http://127.0.0.1:5174';
const output = process.argv[3] ? path.resolve(process.argv[3]) : null;
if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(base).hostname)) {
  throw new Error('Use a local static server: this suite mocks API requests and must not write to production.');
}
if (output) fs.mkdirSync(output, { recursive: true });
const results = [];
const limitations = engine === 'firefox' ? ['Playwright Firefox does not support isMobile; phone sizes use viewport and touch emulation only.'] : [];
limitations.forEach(message => console.log(`COVERAGE NOTE: ${message}`));
const check = (name, passed, evidence) => { results.push({ name, passed: !!passed, evidence }); console.log(`${passed ? 'PASS' : 'FAIL'} ${name}: ${JSON.stringify(evidence)}`); };
const pause = (ms) => new Promise(resolve => setTimeout(resolve, ms));
let browser;
let runtimeFailure = null;
async function context(options = {}) {
  if (engine === 'firefox') { options = { ...options }; delete options.isMobile; }
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', ...options });
  await ctx.route('**/api/guestbook', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ notes: [] }) }));
  // Default catches accidental submissions. Individual Ask tests replace this route.
  await ctx.route('**/api/ask', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  const page = await ctx.newPage();
  return { ctx, page };
}
async function load(page, suffix = '/') {
  await page.goto(base + suffix, { waitUntil: 'networkidle' });
  if (suffix === '/') {
    await page.locator('#loader.done').waitFor({ state: 'attached', timeout: 20000 });
    await page.waitForFunction(() => getComputedStyle(document.querySelector('#loader')).visibility === 'hidden');
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  }
}
async function screenshot(page, name) { if (output) await page.screenshot({ path: path.join(output, name + '.png') }); }
async function submit(page, question) { await page.locator('#ask-input').fill(question); await page.locator('#ask-form').evaluate(form => form.requestSubmit()); }

(async () => {
  browser = await playwright[engine].launch({ headless: true });
  try {
    if (!process.env.BROWSER_GUESTBOOK_ONLY) {
    for (const route of (process.env.BROWSER_EDGE_ONLY ? [] : ['/', '/text.html', '/proofmode.html'])) {
      for (const [width, height] of [[320, 568], [375, 667], [390, 844], [768, 1024], [1024, 768], [1440, 900], [844, 390]]) {
        const { ctx, page } = await context({ viewport: { width, height }, isMobile: width < 768, hasTouch: width < 1024 });
        const errors = []; page.on('pageerror', error => errors.push(error.message));
        await load(page, route);
        const layout = await page.evaluate(() => ({ width: innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
        check(`${route} ${width}x${height}: no outer overflow or runtime error`, layout.document <= width && errors.length === 0, { ...layout, errors });
        if (width === 390 || width === 1440) await screenshot(page, `initial-${route === '/' ? 'home' : route.slice(1, -5)}-${width}`);
        if (route === '/') {
          await page.locator('#ask-toggle').click();
          const ask = await page.locator('#ask').evaluate(el => ({ client: el.clientWidth, scroll: el.scrollWidth, font: parseFloat(getComputedStyle(document.querySelector('#ask-input')).fontSize), top: el.getBoundingClientRect().top, bottom: el.getBoundingClientRect().bottom, viewport: innerHeight }));
          check(`Ask ${width}x${height}: fits viewport, no inner overflow, readable input`, ask.scroll <= ask.client + 1 && ask.font >= 16 && ask.top >= 0 && ask.bottom <= height, ask);
          await page.keyboard.press('Escape');
          check(`Ask ${width}: Escape restores toggle`, await page.evaluate(() => document.querySelector('#ask').hidden && document.activeElement.id === 'ask-toggle'), {});
          const menuVisible = await page.locator('#section-menu').isVisible();
          const railVisible = await page.locator('#rail').isVisible();
          check(`Navigation ${width}x${height}: a visible station control is available`, menuVisible || railVisible, { menuVisible, railVisible });
          if (menuVisible) {
            await page.locator('#section-menu summary').click();
            await page.locator('#section-menu [data-jump="projects"]').click();
            await page.waitForTimeout(250);
            const menu = await page.evaluate(() => ({ open: document.querySelector('#section-menu').open, top: document.querySelector('#projects .panel').getBoundingClientRect().top, bottom: document.querySelector('#projects .panel').getBoundingClientRect().bottom, hud: document.querySelector('.hud-top').getBoundingClientRect().bottom, hash: location.hash, focus: document.activeElement.id || document.activeElement.tagName }));
            check(`Explore ${width}x${height}: closes and reveals project heading`, !menu.open && menu.top >= menu.hud - 2 && menu.top < height - 120, menu);
          }
          if (width === 390 || width === 1440) await screenshot(page, `home-${width}`);
        }
        if (route === '/proofmode.html' && width === 390) {
          const diagram = await page.locator('.arch-scroll').evaluate(el => ({ client: el.clientWidth, scroll: el.scrollWidth, tabindex: el.tabIndex, svg: el.querySelector('svg').getBoundingClientRect().width }));
          await page.locator('.arch-scroll').focus(); await page.keyboard.press('ArrowRight'); await page.waitForTimeout(250);
          diagram.scrolled = await page.locator('.arch-scroll').evaluate(el => el.scrollLeft);
          check('ProofMode phone: diagram remains readable and keyboard-scrollable', diagram.svg >= 720 && diagram.scroll > diagram.client && diagram.tabindex === 0 && diagram.scrolled > 0, diagram);
          await screenshot(page, 'proofmode-390');
        }
        await ctx.close();
      }
    }
    {
      const { ctx, page } = await context(); await load(page);
      for (const [opener, dialog, close] of [['#portrait-btn', '#drawer', '#drawer-close'], ['#stars [data-guestbook]', '#guestbook', '#gb-close']]) {
        await page.locator(opener).click();
        check(`${dialog}: native modal`, await page.locator(dialog).evaluate(el => el.open && el.matches(':modal')), {});
        const escapes = [];
        for (let i = 0; i < 20; i++) {
          await page.keyboard.press('Tab');
          const focus = await page.evaluate(sel => ({ inDialog: !!document.activeElement.closest(sel), tag: document.activeElement.tagName, id: document.activeElement.id }), dialog);
          // Browsers allow a modal's Tab loop to pass through browser chrome (BODY).
          if (!focus.inDialog && focus.tag !== 'BODY') escapes.push(focus);
        }
        check(`${dialog}: no focusable background targets`, escapes.length === 0, escapes);
        await page.keyboard.press('Escape');
        const restoration = await page.evaluate(({ dialog, opener }) => ({ closed: !document.querySelector(dialog).open, restored: document.activeElement === document.querySelector(opener), scrollUnlocked: !document.documentElement.classList.contains('modal-open') }), { dialog, opener });
        check(`${dialog}: Escape closes, restores opener and unlocks scroll`, restoration.closed && restoration.restored && restoration.scrollUnlocked, restoration);
        await page.locator(opener).click(); await page.locator(close).click();
        check(`${dialog}: visible close button works`, !await page.locator(dialog).evaluate(el => el.open), {});
      }
      await ctx.close();
    }
    {
      const { ctx, page } = await context({ reducedMotion: 'no-preference' });
      await page.route('**/main.js?*', async route => {
        const original = await route.fetch();
        const source = (await original.text()).replace('async function boot() {', 'async function boot() { throw new Error("Injected renderer boot failure");');
        await route.fulfill({ response: original, body: source });
      });
      await load(page); await page.locator('#boot-fallback').waitFor({ state: 'visible' });
      await page.mouse.move(200, 300); await page.mouse.wheel(0, 500); await page.waitForTimeout(350);
      const boot = await page.evaluate(() => ({ notice: !document.querySelector('#boot-fallback').hidden, scrollY, lenisClass: document.documentElement.className }));
      check('Renderer boot rejection releases smooth scrolling and shows escape', boot.notice && boot.scrollY > 100 && !boot.lenisClass.includes('lenis'), boot); await ctx.close();
    }
    {
      for (const [width, height] of [[320, 568], [384, 844]]) {
        const { ctx, page } = await context({ viewport: { width, height }, isMobile: true, hasTouch: true }); await load(page);
        for (const selector of ['#welcome [data-jump="hero"]', '#welcome [data-tour]']) {
          // A short phone may need ordinary vertical scrolling past the fixed dock.
          await page.locator(selector).evaluate(el => el.scrollIntoView({ block: 'center', inline: 'nearest' }));
          const hit = await page.locator(selector).evaluate(el => { const r = el.getBoundingClientRect(); const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return { accessible: hit === el || el.contains(hit), hit: hit?.id || hit?.tagName, x: r.x, y: r.y, width: r.width, height: r.height }; });
          check(`Phone ${width}: welcome ${selector} receives pointer input after scrolling`, hit.accessible, hit);
        }
        await screenshot(page, `welcome-controls-${width}`); await ctx.close();
      }
    }
    {
      const { ctx, page } = await context(); await page.route('**/npm/three@**', route => route.abort('failed')); await page.goto(base, { waitUntil: 'domcontentloaded' });
      const escape = await page.evaluate(() => [...document.querySelectorAll('#loader a[href="text.html"], #boot-fallback a[href="text.html"]')].map(link => {
        // A wrapped inline link has separate text rectangles; its bounding-box
        // center can be empty space between lines (not a clickable part of it).
        const rectangles = [...link.getClientRects()].map(rect => {
          const x = rect.left + rect.width / 2, y = rect.top + rect.height / 2;
          const hit = document.elementFromPoint(x, y);
          return { visible: rect.width > 0 && rect.height > 0 && getComputedStyle(link).visibility !== 'hidden' && x >= 0 && x <= innerWidth && y >= 0 && y <= innerHeight, receivesPointer: hit === link || link.contains(hit) };
        });
        return { container: link.parentElement.id, visible: rectangles.some(rect => rect.visible), receivesPointer: rectangles.some(rect => rect.visible && rect.receivesPointer), rectangles };
      }));
      check('CDN failure: immediate visible text escape receives pointer input', escape.some(link => link.visible && link.receivesPointer), escape);
      await page.locator('#boot-fallback').waitFor({ state: 'visible', timeout: 16000 });
      check('CDN failure: loader dismissed and fallback available', await page.locator('#loader').evaluate(el => el.classList.contains('done')) && await page.locator('#boot-fallback a').isVisible(), {});
      await screenshot(page, 'cdn-failure'); await ctx.close();
    }
    {
      const { ctx, page } = await context({ reducedMotion: 'no-preference' }); await load(page);
      await page.locator('[data-flight]').click(); await page.keyboard.press('Escape'); await page.waitForTimeout(2100);
      const before = await page.evaluate(() => scrollY);
      await page.mouse.move(200, 300); await page.mouse.wheel(0, 350); await page.waitForTimeout(450);
      const flight = await page.evaluate(() => ({ hudHidden: document.querySelector('#flight-hud').hidden, endClosed: !document.querySelector('#flight-end').open, stopped: document.documentElement.classList.contains('lenis-stopped'), scrollY, noWebGL: document.documentElement.classList.contains('no-webgl') }));
      check('Escape cancels pending flight startup and leaves scrolling available', !flight.noWebGL && flight.hudHidden && flight.endClosed && !flight.stopped && Math.abs(flight.scrollY - before) > 5, { before, ...flight }); await ctx.close();
    }
    {
      const { ctx, page } = await context();
      await page.addInitScript(() => { const original = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (type, ...args) { return /^(webgl|experimental-webgl)/.test(type) ? null : original.call(this, type, ...args); }; });
      await load(page); await page.locator('[data-jump="hero"]').filter({ visible: true }).first().click(); await page.waitForTimeout(250);
      const fallback = await page.evaluate(() => ({ noWebGL: document.documentElement.classList.contains('no-webgl'), hash: location.hash, active: document.querySelector('#rail [aria-current="location"]')?.dataset.jump }));
      check('No WebGL + reduced motion: navigation state updates', fallback.noWebGL && fallback.hash === '#hero' && fallback.active === 'hero', fallback); await ctx.close();
    }
    {
      const { ctx, page } = await context({ reducedMotion: 'no-preference' });
      await page.route('**/api/ask', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ answer: 'MOCK SERVER ANSWER: stable completed response.', sources: ['Profile'] }) }));
      await load(page); await page.locator('#ask-toggle').click(); await submit(page, 'Tell me about Alo'); await page.waitForTimeout(2000);
      const answer = await page.locator('#ask-a').innerText(); check('Fast Ask response is not overwritten by local typing', answer === 'MOCK SERVER ANSWER: stable completed response.', answer); await ctx.close();
    }
    {
      const { ctx, page } = await context(); const received = [];
      await page.route('**/api/ask', async route => {
        const question = route.request().postDataJSON().question; received.push(question);
        if (question.includes('Alo')) await pause(700);
        try { await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ answer: `RESPONSE: ${question}`, sources: ['Test fixture'] }) }); } catch { /* first request may be aborted by new question */ }
      });
      await load(page); await page.locator('#ask-toggle').click(); await submit(page, 'Tell me about Alo'); await page.waitForTimeout(50); await submit(page, 'How do I contact him?'); await page.waitForTimeout(1100);
      const answer = await page.locator('#ask-a').innerText(); check('Out-of-order Ask responses preserve latest question', answer === 'RESPONSE: How do I contact him?', { answer, received });
      await submit(page, 'What is the White House cafeteria menu?'); await page.waitForTimeout(100);
      check('Unrelated Ask prompt stays grounded without another API request', (await page.locator('#ask-out').innerText()).includes('isn’t covered') && received.length === 2, { received }); await ctx.close();
    }
    }
    for (const scenario of ['local-only', 'confirmed', 'refresh-pending', 'timeout']) {
      const { ctx, page } = await context(); let posts = 0;
      await page.route('**/api/guestbook', async route => {
        if (route.request().method() === 'GET') {
          return route.fulfill({ status: scenario === 'local-only' ? 503 : 200, contentType: 'application/json', body: JSON.stringify(scenario === 'local-only' ? { error: 'Guestbook temporarily unavailable' } : { notes: [] }) });
        }
        posts++;
        const note = route.request().postDataJSON();
        if (scenario === 'timeout') await pause(9000);
        else await pause(300); // keep the first request pending during the second click
        const reply = scenario === 'refresh-pending' ? { saved: true, note, notes: null, refreshPending: true } : { saved: true, note, notes: [note] };
        try { await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(reply) }); } catch { /* timeout may already have aborted the request */ }
      });
      await load(page); await page.locator('#stars [data-guestbook]').click();
      await page.locator('#gb-name').fill('Browser fixture'); await page.locator('#gb-city').fill('Test suite'); await page.locator('#gb-msg').fill(`Guestbook ${scenario} fixture`);
      if (scenario === 'local-only') {
        check('Guestbook local-only: limitation is visible before submission', (await page.locator('#gb-status').innerText()).includes('only in this browser'), {});
      }
      const button = await page.locator('#gb-form button[type="submit"]').boundingBox();
      await page.mouse.dblclick(button.x + button.width / 2, button.y + button.height / 2, { delay: 30 });
      await page.waitForFunction(() => !document.querySelector('#gb-form button[type="submit"]').disabled, undefined, { timeout: 11000 });
      const state = await page.evaluate(() => {
        const toast = document.querySelector('#toast'), status = document.querySelector('#gb-status'), dialog = document.querySelector('#guestbook');
        const confirmation = toast.classList.contains('show') ? toast.textContent : dialog.open ? status.textContent : '';
        return { confirmation, status: status.textContent, message: document.querySelector('#gb-msg').value, notes: [...document.querySelectorAll('#gb-list li')].map(el => el.textContent), local: JSON.parse(localStorage.getItem('aialo3d-guest') || '[]'), dialogOpen: dialog.open, noWebGL: document.documentElement.classList.contains('no-webgl') };
      });
      if (scenario === 'local-only') {
        check('Guestbook local-only: truthful visible confirmation, one local note and no POST', state.confirmation.includes('only in this browser') && !state.confirmation.includes('every visitor') && posts === 0 && state.local.length === 1 && state.message === '', { posts, ...state });
      } else if (scenario === 'timeout') {
        check('Guestbook timeout: uncertainty stated, draft retained and no blind retry', state.confirmation.includes('timed out') && state.confirmation.includes('may have arrived') && state.confirmation.includes('check the guestbook') && state.message === `Guestbook ${scenario} fixture` && posts === 1, { posts, ...state });
      } else {
        const expected = scenario === 'refresh-pending' ? 'Your star was saved. Reload to refresh the visitor list when the connection recovers.' : 'Your star is in the sky for every visitor.';
        check(`Guestbook ${scenario}: saved confirmation visible and draft cleared`, state.confirmation === expected && state.message === '' && state.notes.filter(note => note.includes(`Guestbook ${scenario} fixture`)).length === 1, { posts, ...state });
        check(`Guestbook ${scenario}: double click sends exactly one POST`, posts === 1, { posts });
      }
      await screenshot(page, `guestbook-${scenario}`); await ctx.close();
    }
  } catch (error) {
    runtimeFailure = { name: error.name, message: error.message };
    throw error;
  } finally {
    await browser.close();
    if (output) fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ timestamp: new Date().toISOString(), base, engine, browserVersion: browser.version(), limitations, completed: !runtimeFailure, runtimeFailure, results }, null, 2));
    const failures = results.filter(result => !result.passed);
    console.log(`${results.length - failures.length}/${results.length} checks passed.${runtimeFailure ? ' Suite incomplete: browser/runtime operation failed.' : ''}`);
    if (failures.length) process.exitCode = 1;
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
