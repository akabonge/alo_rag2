// Progressive-media regressions. Local server only; every API request is mocked.
// node test/media-browser.cjs http://127.0.0.1:5174 ../alo-office/qa/media
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE_PATH || 'playwright');
const fs = require('node:fs'), path = require('node:path');
const base = new URL(process.argv[2] || 'http://127.0.0.1:5174');
if (!['localhost', '127.0.0.1', '[::1]'].includes(base.hostname)) throw new Error('Run this controlled-network suite against localhost.');
const output = process.argv[3] ? path.resolve(process.argv[3]) : null;
const viewsOnly = process.env.MEDIA_VIEWS_ONLY === '1';
if (output) fs.mkdirSync(output, { recursive: true });
const results = [], errors = [];
let runtimeFailure = null, browserVersion;
const check = (name, passed, evidence = {}) => { results.push({ name, passed: !!passed, evidence }); console.log(`${passed ? 'PASS' : 'FAIL'} ${name}: ${JSON.stringify(evidence)}`); };
const source = fs.readFileSync(path.join(__dirname, '../src/main.js'), 'utf8');
const marker = 'const updateScenePhotos = createStationMedia([';
if (source.split(marker).length !== 2) throw new Error('Update the test-only integration hook for the current scene source.');
const instrumented = source.replace(marker, `window.__mediaQA = {
  state: () => ({ postcard: postcard?.uuid || null, proofTexture: screenU.uMap.value?.uuid || null, proofHitScale: proofHit.scale.x, holoTexture: holoTex.uuid, holoVersion: holoTex.version, sceneFailed }),
  settled: key => loadPhoto(key).then(image => !!image),
  loseContext: () => { const extension = renderer.getContext().getExtension('WEBGL_lose_context'); if (!extension) return false; extension.loseContext(); return true; }
};
  ${marker}`);

async function scenario(width = 390, options = {}) {
  // A fresh browser per scenario avoids retaining several software WebGL scenes.
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  browserVersion = browser.version();
  const context = await browser.newContext({ viewport: { width, height: width < 768 ? 844 : 900 }, isMobile: width < 768, hasTouch: width < 768, reducedMotion: 'reduce' });
  const requested = [], videoRequests = [], pending = new Set(); let released = false;
  const failed = new Set(options.fail || []);
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url()), file = path.posix.basename(url.pathname);
    if (/\.mp4$/i.test(url.pathname)) videoRequests.push(file);
    if (url.pathname.startsWith('/api/')) return route.fulfill({ status: 200, contentType: 'application/json', body: '{"notes":[]}' });
    if (!['GET', 'HEAD'].includes(request.method())) return route.fulfill({ status: 405, body: 'Read-only test' });
    if (url.origin === base.origin && url.pathname === '/main.js') return route.fulfill({ contentType: 'application/javascript', body: instrumented });
    if (!/\.jpe?g$/i.test(url.pathname)) return route.continue();
    requested.push(file);
    if (failed.has(file)) return route.fulfill({ status: 404, body: 'Controlled image failure' });
    if ((options.extremeRatio || []).includes(file)) return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="8000" height="10"><rect width="8000" height="10" fill="gray"/></svg>' });
    if (file !== 'portrait-square.jpg' && options.hold && !released) {
      let release;
      const answer = new Promise(resolve => { release = resolve; });
      const entry = { file, release }; pending.add(entry);
      const action = await answer; pending.delete(entry);
      if (action === 'abort') return route.abort().catch(() => {});
    }
    return route.continue().catch(() => {});
  });
  if (options.noWebGL) await context.addInitScript(() => { const original = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (type, ...args) { return /^(webgl|experimental-webgl)/.test(type) ? null : original.call(this, type, ...args); }; });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push({ width, message: error.message }));
  return {
    page, requested, videoRequests, pending,
    async load(hash = '') {
      await page.goto(new URL('/' + hash, base).href, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => getComputedStyle(document.querySelector('#loader')).visibility === 'hidden', null, { timeout: 30000 });
      if (!options.noWebGL) await page.waitForFunction(() => !!window.__mediaQA, null, { timeout: 20000 });
    },
    async waitRequest(file) { await page.waitForFunction(file => performance.getEntriesByType('resource').some(r => r.name.endsWith(file)), file, { timeout: 100 }).catch(() => {}); const deadline = Date.now() + 10000; while (!requested.includes(file) && Date.now() < deadline) await page.waitForTimeout(50); if (!requested.includes(file)) throw new Error(`Expected request not observed: ${file}`); },
    release() { released = true; for (const entry of pending) entry.release('continue'); },
    async close() { for (const entry of pending) entry.release('abort'); try { await context.close(); } finally { await browser.close(); } },
  };
}
async function jump(page, station) {
  if (await page.locator('#section-menu summary').isVisible()) { await page.locator('#section-menu summary').click(); await page.locator(`#section-menu [data-jump="${station}"]`).click(); }
  else await page.locator(`#rail [data-jump="${station}"]`).click();
  await page.waitForFunction(station => location.hash === `#${station}`, station);
}
async function shot(page, name) { if (output) await page.screenshot({ path: path.join(output, name + '.png') }); }
async function projectCases(page) {
  const evidence = [];
  for (const [id, title] of [['proofmode', 'ProofMode'], ['rag', 'Emergency Alerting RAG']]) {
    const button = page.locator(`#projects [data-open="proj:${id}"]`);
    await button.scrollIntoViewIfNeeded();
    const target = await button.evaluate(element => { const rect = element.getBoundingClientRect(), hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2); return { text: element.textContent, hit: hit === element || element.contains(hit) }; });
    await button.click();
    const modal = await page.locator('#drawer').evaluate(element => element.matches(':modal'));
    const openedTitle = await page.locator('#drawer-title').innerText();
    await page.locator('#drawer-close').click();
    evidence.push({ id, title, ...target, modal, openedTitle, passed: target.text.includes(title) && target.hit && modal && openedTitle.includes(title) });
  }
  return evidence;
}
const fullRequests = list => list.filter(file => file !== 'portrait-square.jpg');

(async () => {
  try {
    for (const width of [390, 1440]) {
      const s = await scenario(width, { hold: true });
      try {
        await s.load();
        await s.page.waitForFunction(() => document.querySelector('#portrait-badge').naturalWidth > 0 && document.querySelector('#portrait-badge').classList.contains('loaded'));
        const initial = await s.page.evaluate(() => ({ noWebGL: document.documentElement.classList.contains('no-webgl'), fallback: !document.querySelector('#boot-fallback').hidden, badge: document.querySelector('#portrait-badge').naturalWidth, ...window.__mediaQA.state() }));
        check(`${width}: scene and independent badge initialize without full-size photos`, !initial.noWebGL && !initial.fallback && initial.badge > 0 && fullRequests(s.requested).length === 0, { ...initial, requested: s.requested });
        await shot(s.page, `initial-${width}`);
        await jump(s.page, 'journey'); await s.waitRequest('umw.jpg');
        await jump(s.page, 'projects'); await s.waitRequest('proofmode.jpg');
        await jump(s.page, 'contact'); await s.waitRequest('finale.jpg');
        const before = await s.page.evaluate(() => window.__mediaQA.state());
        check(`${width}: fast station navigation requests only nearby scene photos`, ['umw.jpg','proofmode.jpg','finale.jpg'].every(file => s.requested.includes(file)) && fullRequests(s.requested).length === 3 && !before.postcard && !before.proofTexture, { requested: s.requested, before });
        // Request a drawer-only image while the scene photos are still held.
        await s.page.locator('#portrait-btn').click(); await s.waitRequest('profile.jpg');
        check(`${width}: profile drawer text and close control work before its photo finishes`, await s.page.locator('#drawer').evaluate(el => el.matches(':modal')) && (await s.page.locator('#drawer-title').innerText()).includes('Aloysious') && await s.page.locator('#drawer-close').isVisible(), { requested: s.requested });
        const drawerGeometry = () => s.page.evaluate(() => ({ image: document.querySelector('#drawer img[data-photo]').getBoundingClientRect().toJSON(), headingTop: document.querySelector('#drawer-title').getBoundingClientRect().top }));
        const drawerBefore = await drawerGeometry();
        await s.page.waitForTimeout(5100); // Exceeds the removed four-second image batch deadline.
        s.release();
        await s.page.evaluate(() => Promise.all(['umw','proofmode','finale'].map(key => window.__mediaQA.settled(key))));
        await s.page.waitForFunction(() => { const img = document.querySelector('#drawer img[data-photo]'); return img?.complete && img.naturalWidth > 0; });
        const drawerAfter = await drawerGeometry();
        check(`${width}: delayed drawer photo preserves its reserved geometry`, drawerBefore.image.height > 0 && Math.abs(drawerBefore.image.height - drawerAfter.image.height) <= 1 && Math.abs(drawerBefore.headingTop - drawerAfter.headingTop) <= 1, { before: drawerBefore, after: drawerAfter });
        await s.page.locator('#drawer-close').click();
        await s.page.waitForFunction(version => { const s = window.__mediaQA.state(); return s.postcard && s.proofTexture && s.proofHitScale > 1 && s.holoVersion > version; }, before.holoVersion);
        const enhanced = await s.page.evaluate(() => window.__mediaQA.state());
        check(`${width}: photos arriving after five seconds enhance all existing scene stand-ins`, !!enhanced.postcard && !!enhanced.proofTexture && enhanced.proofHitScale > 1 && enhanced.holoTexture === before.holoTexture && enhanced.holoVersion > before.holoVersion, enhanced);
        await jump(s.page, 'projects'); await shot(s.page, `proof-enhanced-${width}`);
        const projectEvidence = await projectCases(s.page);
        check(`${width}: project names remain reachable and both case-study drawers open`, projectEvidence.every(item => item.passed), projectEvidence);
        await jump(s.page, 'journey'); await shot(s.page, `journey-enhanced-${width}`);
        await jump(s.page, 'contact'); await shot(s.page, `contact-enhanced-${width}`);
        const repeated = await s.page.evaluate(() => window.__mediaQA.state());
        check(`${width}: repeated navigation does not duplicate downloads or scene attachments`, ['umw.jpg','proofmode.jpg','finale.jpg'].every(file => s.requested.filter(x => x === file).length === 1) && repeated.postcard === enhanced.postcard && repeated.proofTexture === enhanced.proofTexture && repeated.holoVersion === enhanced.holoVersion, { requested: s.requested, repeated });
      } finally { await s.close(); }
    }
    if (!viewsOnly) {
    for (const [station, file] of [['journey','umw.jpg'], ['projects','proofmode.jpg'], ['contact','finale.jpg']]) {
      const s = await scenario(390, { hold: true });
      try { await s.load('#' + station); await s.waitRequest(file); check(`Deep link #${station}: matching scene photo loads without unrelated images`, fullRequests(s.requested).length === 1 && fullRequests(s.requested)[0] === file, { requested: s.requested }); }
      finally { await s.close(); }
    }
    {
      const s = await scenario(390, { fail: ['portrait-square.jpg','profile.jpg'] });
      try {
        await s.load();
        const badge = await s.page.locator('#portrait-btn').evaluate(el => ({ visible: el.checkVisibility(), width: el.getBoundingClientRect().width, fallback: el.querySelector('.portrait-fallback').textContent, imageOpacity: getComputedStyle(el.querySelector('img')).opacity }));
        check('Failed square portrait keeps a reserved, usable monogram profile button', badge.visible && badge.width > 100 && badge.fallback === 'AK' && Number(badge.imageOpacity) === 0, badge);
        await s.page.locator('#portrait-btn').click();
        await s.page.waitForFunction(() => { const img = document.querySelector('#drawer img[data-photo="portrait"]'); return img?.complete && img.naturalWidth > 0; });
        check('Failed full profile photo falls back to the alternate portrait', s.requested.includes('profile.jpg') && s.requested.includes('portrait.jpg'), { requested: s.requested });
        await shot(s.page, 'profile-fallback-390');
      } finally { await s.close(); }
    }
    {
      const s = await scenario(390, { fail: ['profile.jpg','portrait.jpg','umw.jpg','proofmode.jpg','finale.jpg'] });
      try {
        await s.load(); await s.page.locator('#portrait-btn').click();
        await s.page.waitForFunction(() => document.querySelector('#drawer-body img[data-photo]') === null);
        check('Failed profile and alternate remove broken image markup while preserving profile text', (await s.page.locator('#drawer-title').innerText()).includes('Aloysious'), {});
        await s.page.locator('#drawer-close').click();
        for (const [station,file] of [['journey','umw.jpg'],['projects','proofmode.jpg'],['contact','finale.jpg']]) { await jump(s.page,station); await s.waitRequest(file); }
        await s.page.evaluate(() => Promise.all(['umw','proofmode','finale'].map(key => window.__mediaQA.settled(key))));
        const state = await s.page.evaluate(() => ({ ...window.__mediaQA.state(), fallback: !document.querySelector('#boot-fallback').hidden }));
        check('Scene photo failures preserve procedural stand-ins and active 3D', !state.postcard && !state.proofTexture && state.proofHitScale === 1 && !state.sceneFailed && !state.fallback, state);
      } finally { await s.close(); }
    }
    {
      const { COMMUNITY, IMAGES } = await import('../src/content.js');
      const build = COMMUNITY.builds.find(item => item.video), poster = path.posix.basename(IMAGES[build.photo].src);
      const s = await scenario(390, { fail: [poster] });
      try {
        await s.load();
        const open = () => s.page.locator(`[data-open="build:${build.id}"]`).first().click();
        await open(); await s.waitRequest(poster);
        await s.page.waitForFunction(() => !document.querySelector('#drawer video').hasAttribute('poster'));
        const initial = await s.page.locator('#drawer video').evaluate(video => ({ controls: video.controls, preload: video.preload, paused: video.paused, autoplay: video.autoplay, width: video.getBoundingClientRect().width, height: video.getBoundingClientRect().height, objectFit: getComputedStyle(video).objectFit, aspectRatio: getComputedStyle(video).aspectRatio }));
        await s.page.locator('#drawer-close').click(); await open();
        const reopened = await s.page.locator('#drawer video').evaluate(video => ({ poster: video.getAttribute('poster'), preload: video.preload, height: video.getBoundingClientRect().height }));
        check('Failed video poster is not retried on reopen and video keeps controls with no preload', s.requested.filter(file => file === poster).length === 1 && !reopened.poster && initial.controls && initial.paused && !initial.autoplay && initial.preload === 'none' && reopened.preload === 'none' && s.videoRequests.length === 0, { initial, reopened, requested:s.requested, videoRequests:s.videoRequests });
        check('Video reserves a meaningful frame even when its poster fails', initial.width > 100 && initial.height > 80 && Math.abs(initial.height - reopened.height) <= 1, { initial, reopened });
        check('Video reserves its actual 9:16 aspect ratio and contains the uncropped picture', initial.aspectRatio.split('/').map(Number).reduce((width, height) => width / height) === 9 / 16 && initial.objectFit === 'contain', initial);
        await shot(s.page, 'video-poster-failure-390');
      } finally { await s.close(); }
    }
    {
      const s = await scenario(390, { extremeRatio: ['umw.jpg','proofmode.jpg','finale.jpg'] });
      try {
        await s.load();
        for (const [station,file] of [['journey','umw.jpg'],['projects','proofmode.jpg'],['contact','finale.jpg']]) { await jump(s.page,station); await s.waitRequest(file); }
        const loaded = await s.page.evaluate(() => Promise.all(['umw','proofmode','finale'].map(key => window.__mediaQA.settled(key))));
        const state = await s.page.evaluate(() => window.__mediaQA.state());
        check('8000×10 image geometry is rejected before scene enhancement', loaded.every(value => value === false) && !state.postcard && !state.proofTexture && state.proofHitScale === 1 && state.holoVersion === 1 && !state.sceneFailed, { loaded, state });
      } finally { await s.close(); }
    }
    {
      const s = await scenario(390, { noWebGL: true });
      try { await s.load(); for (const station of ['journey','projects','contact']) await jump(s.page,station); check('No-WebGL navigation never downloads optional 3D scene photos', await s.page.evaluate(() => document.documentElement.classList.contains('no-webgl')) && fullRequests(s.requested).length === 0, { requested:s.requested }); }
      finally { await s.close(); }
    }
    {
      const s = await scenario(390, { hold: true });
      try {
        await s.load('#projects'); await s.waitRequest('proofmode.jpg'); const before = await s.page.evaluate(() => window.__mediaQA.state());
        const supported = await s.page.evaluate(() => window.__mediaQA.loseContext());
        if (!supported) throw new Error('WEBGL_lose_context unavailable; cannot claim context-loss coverage.');
        await s.page.waitForFunction(() => window.__mediaQA.state().sceneFailed);
        s.release(); await s.page.evaluate(() => window.__mediaQA.settled('proofmode'));
        const after = await s.page.evaluate(() => ({ ...window.__mediaQA.state(), fallback: !document.querySelector('#boot-fallback').hidden }));
        check('Context loss prevents pending photo application after response completion', after.sceneFailed && after.fallback && !after.proofTexture && after.proofHitScale === before.proofHitScale && after.holoVersion === before.holoVersion, after);
      } finally { await s.close(); }
    }
    }
    check('Progressive-media scenarios have no uncaught JavaScript errors', errors.length === 0, errors);
  } catch (error) { runtimeFailure = { name: error.name, message: error.message }; console.error(error); process.exitCode = 1; }
  finally { if (output) fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({ timestamp:new Date().toISOString(),browserVersion,scope:viewsOnly?'views':'full',completed:!runtimeFailure,runtimeFailure,results,errors },null,2)); }
  if (results.some(r=>!r.passed)) process.exitCode=1;
  console.log(`${results.filter(r=>r.passed).length}/${results.length} media checks passed; completed=${!runtimeFailure}.`);
})().catch(error=>{console.error(error);process.exitCode=1;});
