#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { DEVICES, parseOptions, outputDirectory, mirroredFile, safeName, networkMeter, installProbe, summarizeFindings } from './audit-core.mjs';

const repo = fileURLToPath(new URL('../../', import.meta.url));
const help = `Responsive metrics audit (report-only by default)
  node scripts/audit/site-audit.mjs --quick
  node scripts/audit/site-audit.mjs --url https://preview.example/ --devices iphone-se,laptop
  --enforce                  Exit 1 for budget findings (operational errors always exit 2)
  --out audit-output/name    Output stays inside this repository's audit-output directory
  --cdn-dir node_modules     Explicit local mirror; results are NOT production CDN transfer
  --budget-mb 4.5            Encoded payload plus response headers, MiB, initial snapshot only
  --budget-ready 6000        Content visible AND loader dismissed, milliseconds
  --skip-recovery            Skip the separate blocked-third-party recovery check
Profiles emulate geometry/input in Chromium; names do not mean physical iOS/Android testing.
Uses the repository's locked Playwright installation (npm ci), or PLAYWRIGHT_PACKAGE_PATH for an existing installation.`;

let options;
try { options = parseOptions(process.argv.slice(2)); }
catch (error) { console.error(error.message); process.exitCode = 2; }
if (options?.help) console.log(help);
else if (options) await run(options);

async function run(opts) {
  let browser, out;
  const report = { schemaVersion: 1, url: opts.url, when: new Date().toISOString(), mode: opts.enforce ? 'enforcing' : 'report-only',
    dependencyMode: opts['cdn-dir'] ? 'local mirror (not production transfer)' : 'network dependencies',
    budget: { tapTargetPx: 44, minFontPx: 12, initialTransferMiB: opts.budgetMB, contentReadyMs: opts.budgetReady },
    devices: {}, recovery: null, failures: [], operationalErrors: [], notes: [
      '44px is a project ergonomic target, not a universal WCAG AA minimum for inline links.',
      'Transfer counts are response payload plus response headers; TLS/request overhead is excluded. Decoded bytes are separate.',
      'Findings are sampled layout signals requiring screenshot/manual review. Glass/canvas contrast and physical-device GPU speed are not measured.',
    ] };
  try {
    out = outputDirectory(repo, opts.out);
    let mirrorRoot = null;
    if (opts['cdn-dir']) {
      mirrorRoot = fs.realpathSync(path.resolve(repo, opts['cdn-dir']));
      if (!fs.statSync(mirrorRoot).isDirectory()) throw new Error('cdn-dir must identify a dependency directory.');
    }
    const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE_PATH || 'playwright');
    browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
    for (const name of opts.devices) {
      try { report.devices[name] = await auditDevice(browser, name, DEVICES[name], opts, out, mirrorRoot); }
      catch (error) { report.operationalErrors.push(`${name}: ${error.message}`); }
    }
    if (!opts['skip-recovery']) {
      try { report.recovery = await recoveryCheck(browser, opts, out); }
      catch (error) { report.operationalErrors.push(`recovery: ${error.message}`); }
    }
    for (const [name, device] of Object.entries(report.devices)) {
      if (!device.ready) report.failures.push(`${name}: content and loader were not ready at the measured deadline`);
      if (DEVICES[name].touch && device.contentReadyMs !== null && device.contentReadyMs > opts.budgetReady) report.failures.push(`${name}: content readiness ${Math.round(device.contentReadyMs)}ms exceeds ${opts.budgetReady}ms`);
      const first = device.initialNetwork;
      if (first.pendingRequests || first.unavailableRequests) report.failures.push(`${name}: initial transfer measurement incomplete (${first.pendingRequests} pending, ${first.unavailableRequests} unavailable)`);
      else if (first.transferBytes / 1048576 > opts.budgetMB) report.failures.push(`${name}: initial transfer ${(first.transferBytes / 1048576).toFixed(2)} MiB exceeds ${opts.budgetMB} MiB${mirrorRoot ? ' in local mirror mode' : ''}`);
      if (device.errors.length) report.failures.push(`${name}: ${device.errors.length} distinct runtime/network errors`);
      for (const [station, result] of Object.entries(device.stations)) {
        if (result.overflowX) report.failures.push(`${name}/${station}: horizontal overflow`);
        if (result.smallTaps.length) report.failures.push(`${name}/${station}: ${result.smallTaps.length} targets below the project 44px target`);
        if (result.fixedOverlaps.length) report.failures.push(`${name}/${station}: ${result.fixedOverlaps.length} sampled fixed-control intersections`);
        if (station !== 'ask-open' && result.coveredContent.length) report.failures.push(`${name}/${station}: ${result.coveredContent.length} text/floating-control occlusion candidates`);
        if (DEVICES[name].touch && result.minFontPx !== null && result.minFontPx < 12) report.failures.push(`${name}/${station}: visible text at ${result.minFontPx.toFixed(1)}px`);
      }
    }
    if (report.recovery && !report.recovery.usableEscape) report.failures.push('recovery: no visible, hit-test-usable text-version link at the measured deadline');
  } catch (error) { report.operationalErrors.push(error.message); }
  finally { if (browser) await browser.close().catch((error) => report.operationalErrors.push(`browser cleanup: ${error.message}`)); }
  report.counts = { budgetConditionFailures: report.failures.length, ...summarizeFindings(report.devices) };
  if (out) {
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
    const md = [`# Responsive audit · ${report.when}`, '', `URL: ${opts.url}`, `Mode: ${report.mode}; dependencies: ${report.dependencyMode}`, '',
      `${report.counts.budgetConditionFailures} failed budget conditions. ${report.counts.smallTapOccurrences} small-target occurrences across states; ${report.counts.uniqueSmallTapTargets} unique DOM targets (${report.counts.uniqueSmallTapDevicePairs} target/device pairs).`, '',
      ...report.operationalErrors.map((error) => `- Operational error: ${error}`), ...report.failures.map((failure) => `- ${failure}`), '',
      '| Profile | Content visible ms | Loader dismissed ms | Initial encoded payload / headers / decoded MiB | Later total transfer MiB |',
      '| --- | ---: | ---: | --- | ---: |',
      ...Object.entries(report.devices).map(([name, device]) => {
        const net = device.initialNetwork, mib = (bytes) => (bytes / 1048576).toFixed(2);
        return `| ${name} | ${Math.round(device.timing.contentVisibleMs ?? 0) || 'unobserved'} | ${Math.round(device.timing.loaderDismissedMs ?? 0) || 'unobserved'} | ${mib(net.encodedBodyBytes)} / ${mib(net.responseHeaderBytes)} / ${mib(net.decodedBodyBytes)} | ${mib(device.laterNetwork.transferBytes)} |`;
      }), '', 'Recovery:', '```json', JSON.stringify(report.recovery, null, 2), '```', '', ...report.notes.map((note) => `- ${note}`), '',
      'Per-state rectangles, unique element keys, hit-test samples, navigation timing, accounting completeness and screenshots are in report.json and this directory.'];
    fs.writeFileSync(path.join(out, 'report.md'), md.join('\n'));
    console.log(`${report.failures.length} budget conditions; ${report.operationalErrors.length} operational errors. ${path.join(out, 'report.md')}`);
  } else console.error(report.operationalErrors.join('\n'));
  process.exitCode = report.operationalErrors.length ? 2 : opts.enforce && report.failures.length ? 1 : 0;
}

async function configurePage(context, device, options, mirrorRoot, blocked = false) {
  await context.addInitScript(installProbe);
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  if (device.cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: device.cpu });
  if (blocked) {
    const origin = new URL(options.url).origin;
    await page.route('**/*', (route) => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  } else if (mirrorRoot) {
    await page.route('https://cdn.jsdelivr.net/npm/**', async (route) => {
      let file;
      try { file = mirroredFile(mirrorRoot, route.request().url()); } catch { file = null; }
      return file ? route.fulfill({ body: fs.readFileSync(file), contentType: 'application/javascript' }) : route.abort();
    });
  }
  return page;
}

const contextOptions = (device) => ({ viewport: device.viewport, deviceScaleFactor: device.dpr, isMobile: device.touch, hasTouch: device.touch, serviceWorkers: 'block' });
async function auditDevice(browser, name, device, options, out, mirrorRoot) {
  const context = await browser.newContext(contextOptions(device));
  try {
    const page = await configurePage(context, device, options, mirrorRoot);
    const network = networkMeter(page), errors = new Set();
    page.on('pageerror', (error) => errors.add(`pageerror: ${error.message}`));
    page.on('console', (message) => { if (message.type() === 'error' && !/Failed to load resource/.test(message.text())) errors.add(`console: ${message.text()}`); });
    const origin = new URL(options.url), local = ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname);
    page.on('response', (response) => { const url = new URL(response.url()); if (response.status() >= 400 && !(local && url.origin === origin.origin && url.pathname.startsWith('/api/'))) errors.add(`HTTP ${response.status()}: ${url.origin}${url.pathname}`); });
    page.on('requestfailed', (request) => { const url = new URL(request.url()); errors.add(`request failed: ${url.origin}${url.pathname}`); });
    await page.goto(options.url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    let ready = true;
    await page.waitForFunction(() => { const s = window.__aloAudit.status(); return s.contentVisible && !s.loaderStillCovering; }, null, { timeout: 20_000 }).catch(() => { ready = false; });
    await page.waitForTimeout(700);
    // Freeze before every scroll, screenshot or panel interaction. Await accounting for this initial request set.
    const initialNetwork = await network.snapshot();
    const timing = await page.evaluate(() => ({ ...window.__aloAudit.timing }));
    const contentReadyMs = timing.contentVisibleMs !== null && timing.loaderDismissedMs !== null ? Math.max(timing.contentVisibleMs, timing.loaderDismissedMs) : null;
    const navigation = await page.evaluate(() => performance.getEntriesByType('navigation')[0]?.toJSON() || null);
    let stations = await page.locator('section.station').evaluateAll((elements) => elements.map((el) => el.id).filter(Boolean));
    if (options.quick) stations = stations.filter((station) => ['welcome', 'hero', 'projects', 'contact'].includes(station));
    const result = {};
    for (const station of stations) {
      await page.evaluate((id) => document.getElementById(id)?.scrollIntoView({ block: 'start', behavior: 'instant' }), station);
      await page.waitForTimeout(700);
      result[station] = await page.evaluate(() => window.__aloAudit.inspect());
      await page.screenshot({ path: path.join(out, `${safeName(name)}--${safeName(station)}.png`) });
    }
    const ask = page.locator('#ask-toggle');
    if (await ask.isVisible()) {
      await ask.click({ timeout: 5000 });
      await page.waitForTimeout(300);
      result['ask-open'] = await page.evaluate(() => window.__aloAudit.inspect());
      await page.screenshot({ path: path.join(out, `${safeName(name)}--ask-open.png`) });
    }
    const laterNetwork = await network.snapshot();
    console.log(`${name}: ${ready ? 'content ready' : 'readiness deadline reached'}; ${(initialNetwork.transferBytes / 1048576).toFixed(2)} MiB initial response transfer`);
    return { profile: device, ready, timing, contentReadyMs, navigation, initialNetwork, laterNetwork, errors: [...errors], stations: result };
  } finally { await context.close(); }
}

async function recoveryCheck(browser, options, out) {
  const device = DEVICES['iphone-15'], context = await browser.newContext(contextOptions(device));
  try {
    const page = await configurePage(context, device, options, null, true);
    await page.goto(options.url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    const remaining = await page.evaluate(() => Math.max(0, 10_000 - performance.now()));
    await page.waitForTimeout(remaining);
    const result = await page.evaluate(() => ({ ...window.__aloAudit.status(), measuredAtMs: performance.now(), timing: { ...window.__aloAudit.timing } }));
    await page.screenshot({ path: path.join(out, 'third-party-blocked.png') });
    return { ...result, policy: 'A visible and hit-test-usable text escape in either loader or fallback is required. Loader coverage is reported separately.' };
  } finally { await context.close(); }
}
