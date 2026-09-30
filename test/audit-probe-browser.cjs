// Small real-DOM regressions for audit visibility and hit geometry. No app/API traffic.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE_PATH || 'playwright');
(async () => {
  const { installProbe } = await import('../scripts/audit/audit-core.mjs');
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await context.addInitScript(installProbe);
    await context.route('**/*', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><meta name="viewport" content="width=device-width"><style>
      body{font:16px/32px sans-serif;margin:16px} #fallback{width:180px} #menu summary{min-height:44px} #menu nav{position:fixed;top:500px;left:16px} #menu button,#ask{width:140px;height:44px} #ask{position:fixed;top:500px;left:16px} #hidden-content{position:fixed;top:500px;left:16px} label{display:flex;align-items:center;width:240px;min-height:44px} input{width:16px;height:16px} #tiny{width:20px;height:20px;padding:0}
      </style><div id="loader" hidden></div><main><h1>Audit fixture</h1><div id="fallback"><a href="text.html">Read the complete portfolio in the fast text version.</a></div><details id="menu"><summary>Explore</summary><nav><button id="hidden-button">Hidden nav</button><p id="hidden-content">Hidden text</p></nav></details><button id="ask">Ask</button><label id="voice-label"><input id="voice" type="checkbox">Read answers aloud</label><button id="tiny">x</button></main>` }));
    const page = await context.newPage(); await page.goto('https://audit-fixture.invalid/');
    const result = await page.evaluate(() => ({ status: window.__aloAudit.status(), report: window.__aloAudit.inspect(), linkRects: document.querySelector('#fallback a').getClientRects().length }));
    assert.ok(result.linkRects > 1, 'Fixture must exercise a wrapped inline link');
    assert.equal(result.status.usableEscape, true, 'Visible inline fragments make the escape usable');
    assert.deepEqual(result.report.fixedOverlaps, [], 'Closed menu contents cannot intersect visible Ask');
    assert.ok(result.report.coveredContent.every(row => !row.key.includes('#hidden-content')), 'Closed text is excluded from coverage findings');
    assert.deepEqual(result.report.smallTaps.map(row => row.key), ['#tiny'], 'Keep genuine small target while excluding labeled checkbox');
    assert.ok(result.report.tapExceptions.some(row => row.key === '#voice' && row.reason.includes('#voice-label')), 'Report the effective label target explicitly');
    console.log('6/6 audit probe browser assertions passed.');
    await context.close();
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
