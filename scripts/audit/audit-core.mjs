import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

export const DEVICES = {
  'iphone-se': { viewport: { width: 375, height: 667 }, dpr: 2, touch: true, cpu: 6 },
  'iphone-15': { viewport: { width: 393, height: 852 }, dpr: 3, touch: true, cpu: 4 },
  'android-mid': { viewport: { width: 412, height: 915 }, dpr: 2.6, touch: true, cpu: 6 },
  'phone-landscape': { viewport: { width: 844, height: 390 }, dpr: 3, touch: true, cpu: 4 },
  ipad: { viewport: { width: 820, height: 1180 }, dpr: 2, touch: true, cpu: 2 },
  laptop: { viewport: { width: 1366, height: 768 }, dpr: 1, touch: false, cpu: 1 },
  desktop: { viewport: { width: 1920, height: 1080 }, dpr: 1, touch: false, cpu: 1 },
};

export function parseOptions(argv) {
  const { values } = parseArgs({ args: argv, strict: true, allowPositionals: false, options: {
    url: { type: 'string', default: 'http://localhost:5173/' }, devices: { type: 'string' },
    quick: { type: 'boolean' }, out: { type: 'string' }, 'cdn-dir': { type: 'string' },
    'budget-mb': { type: 'string', default: '4.5' }, 'budget-ready': { type: 'string', default: '6000' },
    enforce: { type: 'boolean' }, 'skip-recovery': { type: 'boolean' }, help: { type: 'boolean' },
  } });
  if (values.help) return values;
  const url = new URL(values.url);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Use an HTTP(S) URL without embedded credentials.');
  const devices = values.devices === undefined ? (values.quick ? ['iphone-se', 'android-mid', 'phone-landscape'] : Object.keys(DEVICES)) : values.devices.split(',').map((x) => x.trim());
  if (!devices.length || devices.some((name) => !Object.hasOwn(DEVICES, name))) throw new Error(`Unknown or empty device. Choose: ${Object.keys(DEVICES).join(', ')}`);
  for (const key of ['budget-mb', 'budget-ready']) if (!Number.isFinite(Number(values[key])) || Number(values[key]) <= 0) throw new Error(`${key} must be a positive number.`);
  for (const key of ['out', 'cdn-dir']) if (values[key] !== undefined && !values[key].trim()) throw new Error(`${key} cannot be empty.`);
  return { ...values, url: url.href, devices: [...new Set(devices)], budgetMB: Number(values['budget-mb']), budgetReady: Number(values['budget-ready']) };
}

export function isWithin(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`));
}

export function outputDirectory(repo, requested) {
  const base = path.join(repo, 'audit-output');
  const result = path.resolve(repo, requested || `audit-output/${new Date().toISOString().replace(/[:.]/g, '-')}`);
  if (!isWithin(base, result) || result === base) throw new Error('Output must be a subdirectory of this repository’s audit-output directory.');
  let ancestor = result;
  while (!fs.existsSync(ancestor)) ancestor = path.dirname(ancestor);
  const realRepo = fs.realpathSync(repo);
  const expectedAncestor = path.join(realRepo, path.relative(repo, ancestor));
  if (path.relative(expectedAncestor, fs.realpathSync(ancestor)) !== '') throw new Error('Output path crosses a symlink or junction.');
  fs.mkdirSync(result, { recursive: true });
  if (path.relative(path.join(realRepo, path.relative(repo, result)), fs.realpathSync(result)) !== '') throw new Error('Output path crosses a symlink or junction.');
  return result;
}

export function mirroredFile(root, requestUrl) {
  const url = new URL(requestUrl);
  if (url.hostname !== 'cdn.jsdelivr.net') return null;
  const match = decodeURIComponent(url.pathname).match(/^\/npm\/(three|gsap|lenis)@[^/]+\/(.+)$/);
  if (!match || match[2].includes('\\') || match[2].split('/').some((part) => part === '..' || part === '.')) return null;
  const file = path.resolve(root, match[1], match[2]);
  if (!isWithin(root, file) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return null;
  const real = fs.realpathSync(file);
  return isWithin(fs.realpathSync(root), real) ? real : null;
}

export const safeName = (name) => String(name).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 90) || 'unnamed';
const safeUrl = (url) => { try { const u = new URL(url); return `${u.origin}${u.pathname}`; } catch { return '(non-HTTP resource)'; } };

// responseBodySize is encoded payload; response.body() is decoded bytes. Neither substitutes for the other.
export function networkMeter(page) {
  const records = new Map();
  const begin = (request) => {
    let finish;
    const done = new Promise((resolve) => { finish = resolve; });
    const record = { url: safeUrl(request.url()), started: Date.now(), complete: false, failed: false, encodedBodyBytes: 0, responseHeaderBytes: 0, decodedBodyBytes: 0, done, finish };
    records.set(request, record);
    return record;
  };
  page.on('request', begin);
  page.on('requestfailed', (request) => { const r = records.get(request) || begin(request); r.failed = true; r.finish(); });
  page.on('response', async (response) => {
    const request = response.request(), record = records.get(request) || begin(request);
    try {
      const error = await response.finished();
      if (error) throw error;
      const [sizes, body] = await Promise.all([request.sizes(), response.body()]);
      record.encodedBodyBytes = sizes.responseBodySize;
      record.responseHeaderBytes = sizes.responseHeadersSize;
      record.decodedBodyBytes = body.byteLength;
      record.complete = true;
    } catch { record.failed = true; }
    finally { record.finish(); }
  });
  return { async snapshot(waitMs = 3000) {
    const cutoff = Date.now(), selected = [...records.values()];
    let timer;
    try { await Promise.race([Promise.all(selected.map((r) => r.done)), new Promise((resolve) => { timer = setTimeout(resolve, waitMs); })]); }
    finally { clearTimeout(timer); }
    const entries = selected.map(({ done, finish, ...record }) => ({ ...record }));
    const sum = (field) => entries.reduce((total, item) => total + item[field], 0);
    return { requestStartCutoff: new Date(cutoff).toISOString(), frozenAt: new Date().toISOString(), requests: entries.length,
      completeRequests: entries.filter((r) => r.complete).length, unavailableRequests: entries.filter((r) => r.failed).length,
      pendingRequests: entries.filter((r) => !r.complete && !r.failed).length,
      encodedBodyBytes: sum('encodedBodyBytes'), responseHeaderBytes: sum('responseHeaderBytes'),
      transferBytes: sum('encodedBodyBytes') + sum('responseHeaderBytes'), decodedBodyBytes: sum('decodedBodyBytes'),
      entries: entries.sort((a, b) => b.encodedBodyBytes - a.encodedBodyBytes),
    };
  } };
}

// Installed before site scripts. All helpers below execute inside the measured browser.
export function installProbe() {
  const shown = (el) => {
    if (!el?.getBoundingClientRect) return false;
    if (el.checkVisibility && !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false;
    for (let p = el; p; p = p.parentElement) {
      const s = getComputedStyle(p);
      if (p.hidden || s.display === 'none' || s.visibility !== 'visible' || Number(s.opacity) < 0.05) return false;
      // Closed details can retain nonzero descendant rectangles in Chromium.
      // Only the first summary (and its descendants) remains rendered.
      if (p.tagName === 'DETAILS' && !p.open && p !== el && !p.querySelector(':scope > summary')?.contains(el)) return false;
    }
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight;
  };
  const points = (r) => {
    const left = Math.max(0, r.left), right = Math.min(innerWidth, r.right), top = Math.max(0, r.top), bottom = Math.min(innerHeight, r.bottom);
    if (right <= left || bottom <= top) return [];
    return [0.25, 0.5, 0.75].map((fraction) => ({ x: left + (right - left) * fraction, y: top + (bottom - top) / 2 }));
  };
  // Wrapped inline links have separate line fragments. Their union box can have
  // an empty middle that is not part of the link and must not decide reachability.
  const reachable = (el) => shown(el) && [...el.getClientRects()].some((r) => points(r).some(({ x, y }) => el.contains(document.elementFromPoint(x, y))));
  const key = (el) => {
    if (el.id) return `#${el.id}`;
    const parts = [];
    for (let p = el; p && p !== document.body; p = p.parentElement) {
      if (p.id) { parts.unshift(`#${p.id}`); break; }
      const siblings = [...p.parentElement.children].filter((s) => s.tagName === p.tagName);
      parts.unshift(`${p.tagName.toLowerCase()}:nth-of-type(${siblings.indexOf(p) + 1})`);
    }
    return parts.join(' > ');
  };
  const label = (el) => (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 70);
  const fixedAncestor = (el) => {
    for (let p = el; p && p !== document.body; p = p.parentElement) {
      if (['world', 'cursor', 'cursor-label'].includes(p.id) || p.closest('#loader')) return null;
      if (['fixed', 'sticky'].includes(getComputedStyle(p).position)) return p;
    }
    return null;
  };
  const timing = { contentVisibleMs: null, loaderDismissedMs: null, usableEscapeMs: null };
  const status = () => ({
    loaderStillCovering: shown(document.querySelector('#loader')),
    contentVisible: [...document.querySelectorAll('main h1, main h2, main p')].some(reachable),
    usableEscape: [...document.querySelectorAll('a[href]')].some((el) => {
      try { return new URL(el.href).pathname.endsWith('/text.html') && reachable(el); } catch { return false; }
    }),
  });
  const tick = () => {
    const now = performance.now(), s = status();
    if (s.contentVisible && timing.contentVisibleMs === null) timing.contentVisibleMs = now;
    if (document.querySelector('#loader') && !s.loaderStillCovering && timing.loaderDismissedMs === null) timing.loaderDismissedMs = now;
    if (s.usableEscape && timing.usableEscapeMs === null) timing.usableEscapeMs = now;
    if (Object.values(timing).some((value) => value === null) && now < 35_000) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  window.__aloAudit = { timing, status, inspect(tapPx = 44) {
    const controls = [...new Set(document.querySelectorAll('button, a[href], input, select, textarea, summary, [role="button"]'))].filter(shown);
    const smallTaps = [], tapExceptions = [], fixedOverlaps = [], coveredContent = new Map();
    const touch = matchMedia('(hover: none)').matches;
    for (const el of controls) {
      const r = el.getBoundingClientRect();
      if (touch && reachable(el) && (r.width < tapPx || r.height < tapPx)) {
        const finding = { key: key(el), label: label(el), width: r.width, height: r.height };
        const associatedLabel = [...(el.labels || [])].find((candidate) => {
          const lr = candidate.getBoundingClientRect();
          return shown(candidate) && reachable(candidate) && lr.width >= tapPx && lr.height >= tapPx;
        });
        const reason = el.getAttribute('data-audit-tap-exception')?.trim() || (associatedLabel && `Associated visible label ${key(associatedLabel)} provides a ${tapPx}px target`);
        if (reason) tapExceptions.push({ ...finding, reason }); else smallTaps.push(finding);
      }
    }
    const fixed = controls.filter(fixedAncestor);
    for (let i = 0; i < fixed.length; i++) for (let j = i + 1; j < fixed.length; j++) {
      const a = fixed[i], b = fixed[j];
      if (a.contains(b) || b.contains(a)) continue;
      const ar = a.getBoundingClientRect(), br = b.getBoundingClientRect();
      const samples = points({ left: Math.max(ar.left, br.left), right: Math.min(ar.right, br.right), top: Math.max(ar.top, br.top), bottom: Math.min(ar.bottom, br.bottom) });
      const obstructed = samples.filter(({ x, y }) => { const hit = document.elementFromPoint(x, y); return a.contains(hit) || b.contains(hit); });
      if (obstructed.length) fixedOverlaps.push({ key: [key(a), key(b)].sort().join(' | '), controls: [label(a), label(b)], samples: obstructed });
    }
    let minFontPx = null;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode, el = node.parentElement;
      if (!node.textContent.trim() || !shown(el) || el.closest('script, style, #loader')) continue;
      const range = document.createRange(); range.selectNodeContents(node);
      for (const r of range.getClientRects()) for (const point of points(r)) {
        const hit = document.elementFromPoint(point.x, point.y);
        if (!hit) continue;
        if (el.contains(hit)) {
          const size = parseFloat(getComputedStyle(el).fontSize);
          minFontPx = minFontPx === null ? size : Math.min(minFontPx, size);
        } else if (el.closest('main') && fixedAncestor(hit) && !hit.contains(el)) {
          const id = `${key(el)} | ${key(hit)}`;
          if (!coveredContent.has(id)) coveredContent.set(id, { key: id, content: label(el), occluder: label(hit), samples: [] });
          if (coveredContent.get(id).samples.length < 5) coveredContent.get(id).samples.push(point);
        }
      }
    }
    return { overflowX: document.documentElement.scrollWidth > innerWidth + 1, viewport: { width: innerWidth, height: innerHeight }, smallTaps, tapExceptions, fixedOverlaps, coveredContent: [...coveredContent.values()], minFontPx };
  } };
}

export function summarizeFindings(devices) {
  const keys = new Set(), pairs = new Set();
  let occurrences = 0;
  for (const [device, report] of Object.entries(devices)) for (const station of Object.values(report.stations || {})) for (const target of station.smallTaps) {
    occurrences++; keys.add(target.key); pairs.add(`${device}:${target.key}`);
  }
  return { smallTapOccurrences: occurrences, uniqueSmallTapTargets: keys.size, uniqueSmallTapDevicePairs: pairs.size };
}
