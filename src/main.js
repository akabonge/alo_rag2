// AI Alo 3D — interactive portfolio.
// Stack: three.js (WebGL2 + UnrealBloom), GSAP (intro + tweens), Lenis (smooth scroll).
// Procedural scenes and ambient audio are complemented by local photos, video and recordings.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { gsap } from 'gsap';
import Lenis from 'lenis';
import { PROFILE, ORIGIN, DEST, TIMELINE, EXPERIENCE, PROJECTS, DEMOS, SKILLS, STATIONS, IMAGES, ASK_ENDPOINT, SOUNDTRACK, PLACES, STRENGTHS, COMMUNITY, GUESTBOOK_ENDPOINT, TOUR, UGANDA_FACTS, DREAMS } from './content.js';
import { LAND_N, decodeLand, UGANDA_DOTS } from './landmask.js?v=16';
import { US_DOTS, US_PINS } from './usmap.js?v=16';
import { ugandaFlag, usFlag } from './flags.js?v=16';
import { buildCorpus, makeIndex, extract, ragPrompt } from './ask.js?v=16';
import { fetchJSON } from './network.js?v=17';
import { localAtmosphere, placeLabels } from './atmosphere.js?v=18';
import { createImageLoader, createStationMedia } from './media.js?v=19';

/* ------------------------------------------------------------------ */
/* Environment                                                         */
/* ------------------------------------------------------------------ */
const $ = (s) => document.querySelector(s);
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
let reduced = motionPreference.matches;
let motionPaused = false;
let finishIntro = null;
const touch = matchMedia('(hover: none)').matches;
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage blocked */ } },
};
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));
const tween = (target, options) => gsap.to(target, { ...options, ...(reduced ? { duration: 0, delay: 0 } : {}) });
const GOLD = new THREE.Color(0xe8b54a);
const SIGNAL = new THREE.Color(0x6fe3d6);
const NIGHT = new THREE.Color(0x060a17);

let tier = ((touch || (navigator.hardwareConcurrency || 4) <= 4) ? 'low' : 'high');
const HIGH = () => tier === 'high';

const linkHover = {}; // data-open key -> hover(on), filled by the 3D scene
const lineMats = [];  // LineMaterials that need the viewport size
let onMissClick = null, onLeaveSkills = null, stopFlight = null; // scene interaction cleanup
let sceneFailed = false;
const { load: loadPhoto, failed: photoFailed } = createImageLoader(IMAGES);
const hasPhoto = (key) => !!IMAGES[key] && !photoFailed.has(key);
// The browser starts the small welcome portrait directly from HTML. Keep its
// reserved space and profile button even when the image fails (AK is the fallback).
{ const badge = $('#portrait-badge');
  const reveal = () => { if (badge.naturalWidth) badge.classList.add('loaded'); };
  badge.addEventListener('load', reveal, { once: true });
  if (badge.complete) reveal(); }
const photo = (k) => hasPhoto(k) ? `<figure class="proof"><img src="${IMAGES[k].src}" width="${IMAGES[k].width}" height="${IMAGES[k].height}" style="aspect-ratio:${IMAGES[k].width}/${IMAGES[k].height}" alt="${esc(IMAGES[k].alt)}" data-photo="${esc(k)}" decoding="async">${IMAGES[k].caption ? `<figcaption>${esc(IMAGES[k].caption)}</figcaption>` : ''}</figure>` : '';
// Capture errors before inserting drawer markup, including immediate cache errors.
$('#drawer-body').addEventListener('error', (event) => {
  const image = event.target;
  if (!image.matches?.('img[data-photo]')) return;
  photoFailed.add(image.dataset.photo);
  if (image.dataset.photo === 'profile' && hasPhoto('portrait')) {
    image.dataset.photo = 'portrait'; image.alt = IMAGES.portrait.alt; image.src = IMAGES.portrait.src;
  } else image.closest('figure')?.remove();
}, true);
// Lite offer: a dismissible bar pointing weak/slow devices to the fast text version (stays hidden once dismissed).
function offerLite(why) {
  const el = $('#lite-offer'); if (!el || !el.hidden || store.get('lite-dismissed') === '1') return;
  el.querySelector('span').textContent = why === 'slow' ? 'Running slowly on this device?' : 'On a slow connection or low-memory device?';
  el.hidden = false;
  el.querySelector('button').addEventListener('click', () => { el.hidden = true; store.set('lite-dismissed', '1'); }, { once: true });
}
if (navigator.connection?.saveData || (navigator.deviceMemory && navigator.deviceMemory <= 2)) setTimeout(() => offerLite('light'), 2500);
const toast = (msg) => { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('show'), Math.min(8000, Math.max(3200, msg.length * 55))); };

/* ------------------------------------------------------------------ */
/* DOM content (works with or without WebGL)                           */
/* ------------------------------------------------------------------ */
$('#timeline').innerHTML = TIMELINE.map((t) => `<div><b>${t.year}</b><span>${esc(t.text)}</span></div>`).join('');
$('#exp-list').innerHTML = EXPERIENCE.map((e) => `<li><button class="list-btn" data-open="exp:${e.id}"><strong>${esc(e.org)}</strong><small>${esc(e.title)}</small><span class="mono">${esc(e.when.split('–')[0].trim())}</span></button></li>`).join('');
$('#proj-list').innerHTML = PROJECTS.map((p) => `<li><button class="list-btn" data-open="proj:${p.id}"><strong>${esc(p.name)}</strong><small>${esc(p.badge)}</small><span class="mono">Case ↗</span></button></li>`).join('');
$('#demo-list').innerHTML = DEMOS.map((d) => `<li><button class="list-btn" data-open="demo:${d.id}"><strong>${esc(d.name)}</strong><small>${esc(d.agent)} · ${esc(d.text)}</small><span class="mono">Live</span></button></li>`).join('');
$('#build-list').innerHTML = COMMUNITY.builds.map((b) => `<li><button class="list-btn" data-open="build:${b.id}"><strong>${esc(b.year)} · ${esc(b.city)}, ${esc(b.state)}</strong><small>${esc(b.role)}</small><span class="mono">${esc(b.state)}</span></button></li>`).join('');
$('#skill-cats').innerHTML = Object.entries(SKILLS).map(([category, skills]) => `<details class="skill-group"><summary>${esc(category)} <span>${skills.length}</span></summary><div>${skills.map((skill) => `<button class="chip-btn" type="button" data-open="skill:${esc(skill)}">${esc(skill)}</button>`).join('')}</div></details>`).join('');
$('#strength-list').innerHTML = STRENGTHS.map((x, i) => `<button class="strength" type="button" data-open="strengths:all" title="${esc(x.text)}"><b>${i + 1}</b>${esc(x.name)}</button>`).join('');
$('#email').textContent = PROFILE.email;
$('#linkedin').href = PROFILE.linkedin;
$('#github').href = PROFILE.github;
$('#rail').innerHTML = STATIONS.map((s, i) => `<li><button type="button" data-jump="${s.id}" aria-label="Go to ${esc(s.label)}"><span>${esc(s.label)}</span><i></i></button></li>`).join('');

$('#copy').addEventListener('click', async () => {
  const btn = $('#copy');
  try { await navigator.clipboard.writeText(PROFILE.email); btn.textContent = 'Copied'; }
  catch {
    const r = document.createRange(); r.selectNodeContents($('#email'));
    const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); btn.textContent = 'Selected, press Ctrl+C';
  }
  setTimeout(() => { btn.textContent = 'Copy email'; }, 2200);
});

/* Drawer ------------------------------------------------------------ */
const drawer = $('#drawer'), scrim = $('#scrim');
const modalOpeners = new WeakMap();
function showModal(dialog, focusTarget, opener = document.activeElement) {
  if (askPanel.contains(opener)) opener = askBtn;
  if (!dialog.open) modalOpeners.set(dialog, opener);
  endTour(); stopFlight?.();
  $('#section-menu').open = false;
  if (!askPanel.hidden) closeAsk();
  document.querySelectorAll('dialog[open]').forEach((other) => {
    if (other !== dialog) other.dispatchEvent(new Event('dismiss'));
  });
  if (!dialog.open) dialog.showModal();
  document.documentElement.classList.add('modal-open');
  lenis?.stop();
  focusTarget?.focus({ preventScroll: true });
}
function hideModal(dialog) {
  if (!dialog.open) return;
  dialog.close();
  const opener = modalOpeners.get(dialog); modalOpeners.delete(dialog);
  if (opener?.isConnected && opener.getClientRects().length) opener.focus({ preventScroll: true });
  if (!document.querySelector('dialog[open]')) {
    document.documentElement.classList.remove('modal-open');
    lenis?.start();
  }
}
function modalDismissal(dialog, close) {
  dialog.addEventListener('cancel', (event) => { event.preventDefault(); close(); });
  dialog.addEventListener('dismiss', close);
  dialog.addEventListener('click', (event) => {
    const r = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom)) close();
  });
}
const tagHTML = (tags) => `<div class="tags">${tags.map((t) => `<span>${esc(t)}</span>`).join('')}</div>`;
const SKILL_KEYS = {
  'Claude API': ['claude'], 'RAG Pipelines': ['rag', 'retrieval'], 'LLM Evaluation': ['evaluation', 'faithfulness'], 'PII/PHI Redaction': ['pii'], 'Prompt-Injection Defense': ['prompt-injection', 'prompt injection'],
  'Structured JSON': ['structured', 'schema'], 'Fine-tuning': ['fine-tun', 'fine tun'], 'OpenAI API': ['openai'], 'Agentic AI': ['agentic', 'tool-calling', 'agents'], 'Feature Engineering': ['feature'],
  'Azure Static Web Apps': ['static web apps'], 'Azure DevOps': ['devops'], 'Semantic Search': ['vector', 'embedding', 'retrieval'], 'Embeddings': ['embedding'], 'Stakeholder Comms': ['stakeholder', 'leadership', 'executives'],
  Communication: ['present', 'communicat', 'stakeholder'], 'Problem Solving': ['problem', 'pain point'], 'Critical Thinking': ['evaluat', 'validat', 'analysis', 'analyz'],
  'Global Awareness': ['uganda', 'african', 'international'], 'Intercultural Communication': ['african student', 'international', 'families'], Leadership: ['lead', 'vice president'],
  Mentorship: ['mentor'], Teamwork: ['collaborat', 'crew', 'team'], Adaptability: ['adapt', 'remote', 'hybrid'], Statistics: ['analysis', 'analyz', 'statistic'], R: [' r,', ' r '],
};
function skillUses(name) {
  const keys = (SKILL_KEYS[name] || [name.toLowerCase()]).map((k) => k.toLowerCase());
  const hit = (txt) => keys.some((k) => txt.toLowerCase().includes(k));
  const out = [];
  EXPERIENCE.forEach((e) => { if (hit([e.title, e.body, ...(e.bullets || []), ...e.tags].join(' '))) out.push({ key: `exp:${e.id}`, name: e.org, detail: e.title }); });
  PROJECTS.forEach((p) => { if (hit([p.name, p.problem, p.approach, p.result, ...p.tags].join(' '))) out.push({ key: `proj:${p.id}`, name: p.name, detail: p.badge }); });
  return out;
}
const builders = {
  exp: (id) => {
    const e = EXPERIENCE.find((x) => x.id === id);
    const body = e.bullets ? `<ul class="bullets">${e.bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>` : `<p>${esc(e.body)}</p>`;
    return `${photo(e.id)}<span class="eyebrow">${esc(e.when)} · ${esc(e.where)}</span><h3 id="drawer-title">${esc(e.org)}</h3><p class="sub">${esc(e.title)}</p>${body}${tagHTML(e.tags)}`;
  },
  proj: (id) => {
    const p = PROJECTS.find((x) => x.id === id);
    const links = p.links.map((l) => `<a class="cta ghost" href="${l.href}" target="_blank" rel="noopener">${esc(l.label)} ↗</a>`).join('');
    const extra = p.id === 'aialo' ? `<button class="cta" type="button" data-jump="demos" data-close>See the 5 demos</button>` : '';
    return `${photo(p.id)}<span class="eyebrow">${esc(p.when)}</span><h3 id="drawer-title">${esc(p.name)}</h3><p class="sub">${esc(p.badge)}</p>
      <dl><div><dt>Problem</dt><dd>${esc(p.problem)}</dd></div><div><dt>Approach</dt><dd>${esc(p.approach)}</dd></div><div><dt>Result</dt><dd>${esc(p.result)}</dd></div></dl>
      ${tagHTML(p.tags)}<div class="cta-row">${links}${extra}</div>`;
  },
  demo: (id) => {
    const d = DEMOS.find((x) => x.id === id);
    return `<span class="eyebrow">${esc(d.vertical)} · live on Railway</span><h3 id="drawer-title">${esc(d.name)}</h3><p class="sub">Meet ${esc(d.agent)}.</p><p>${esc(d.text)}</p>
      <p>Claude tool-calling with an Ollama fallback, ChromaDB embeddings, an MCP server and an operator dashboard. Guardrails cover 23 prompt-injection patterns.</p>
      <div class="cta-row"><a class="cta" href="${d.href}" target="_blank" rel="noopener">Open ${esc(d.agent)} live ↗</a></div>`;
  },
  about: () => `${photo('profile') || photo('portrait')}<span class="eyebrow">AI/ML Engineer · Fredericksburg, VA</span><h3 id="drawer-title">${esc(PROFILE.name)}</h3>
      <p class="sub">${esc(PROFILE.focus)}</p><p>${esc(PROFILE.pitch)}</p>
      <p>B.S. Data Science, University of Mary Washington (May 2026), first-generation graduate. Currently at Flatter, Inc.; previously SyncData.ai, Navy Federal Credit Union and banduri.</p>
      <div class="cta-row"><a class="cta" href="${PROFILE.linkedin}" target="_blank" rel="noopener">LinkedIn ↗</a><a class="cta ghost" href="${PROFILE.github}" target="_blank" rel="noopener">GitHub ↗</a><button class="cta ghost" type="button" data-jump="contact" data-close>Contact</button></div>`,
  place: (id) => {
    const p = PLACES[id];
    const hero = id === 'uganda' ? `<figure class="proof"><img src="${ugandaFlag(900, 600).toDataURL('image/png')}" alt="Flag of Uganda"><figcaption>Flag of Uganda · the grey crowned crane at its center</figcaption></figure>` : (p.photo ? photo(p.photo) : '');
    return `${hero}<span class="eyebrow">${esc(p.kicker)}</span><h3 id="drawer-title">${esc(p.title)}</h3>${p.body.map((t) => `<p>${esc(t)}</p>`).join('')}
      <div class="link-list">${p.links.map((l) => `<a class="cta ghost" href="${l.href}" target="_blank" rel="noopener">${esc(l.label)} ↗</a>`).join('')}</div>`;
  },
  strengths: () => `<span class="eyebrow">CliftonStrengths · Top 5</span><h3 id="drawer-title">How I work best</h3>
      <ol class="strengths">${STRENGTHS.map((x) => `<li><strong>${esc(x.name)}</strong><span>${esc(x.text)}</span></li>`).join('')}</ol>
      <p class="sub">Soft skills</p>${tagHTML(SKILLS['Human Skills'])}`,
  skill: (name) => {
    const uses = skillUses(name);
    const cat = Object.keys(SKILLS).find((k) => SKILLS[k].includes(name));
    return `<span class="eyebrow">${esc(cat || 'Skill')}</span><h3 id="drawer-title">${esc(name)}</h3>
      <p class="sub">${uses.length ? 'Where I’ve used it' : 'Part of my toolkit'}</p>
      ${uses.length ? `<ul class="uses">${uses.map((u) => `<li><button class="list-btn" type="button" data-open="${u.key}"><strong>${esc(u.name)}</strong><small>${esc(u.detail)}</small><span class="mono">Open</span></button></li>`).join('')}</ul>` : `<p>${esc(name)} is part of the ${esc(cat || '')} toolkit I bring to every project.</p>`}
      <div class="cta-row"><button class="cta ghost" type="button" data-ask="Where has he used ${esc(name)}?">Ask about ${esc(name)}</button></div>`;
  },
  community: () => {
    const C = COMMUNITY;
    return `${photo('habitat_gc')}<span class="eyebrow">Habitat for Humanity · 2023 – 2026</span><h3 id="drawer-title">${esc(C.title)}</h3>
      ${C.intro.map((t) => `<p>${esc(t)}</p>`).join('')}
      <div class="stat-row">${C.stats.map(([n, l]) => `<div><b>${esc(n)}</b><span>${esc(l)}</span></div>`).join('')}</div>
      <p class="sub">The builds</p>
      <ul class="uses">${C.builds.map((b) => `<li><button class="list-btn" type="button" data-open="build:${b.id}"><strong>${esc(b.year)} · ${esc(b.city)}, ${esc(b.state)}</strong><small>${esc(b.role)} · ${esc(b.org)}</small><span class="mono">Open</span></button></li>`).join('')}</ul>
      <div class="link-list">${C.links.map((l) => `<a class="cta ghost" href="${l.href}" target="_blank" rel="noopener">${esc(l.label)} ↗</a>`).join('')}</div>`;
  },
  build: (id) => {
    const b = COMMUNITY.builds.find((x) => x.id === id);
    const media = b.video ? `<figure class="proof"><video src="${b.video}" width="${b.videoWidth}" height="${b.videoHeight}" style="aspect-ratio:${b.videoWidth}/${b.videoHeight}" ${hasPhoto(b.photo) ? `data-poster="${esc(b.photo)}"` : ''} controls preload="none" muted playsinline aria-label="Short clip of the Goose Creek Habitat crew"></video><figcaption>${esc(IMAGES[b.photo]?.caption || '')}</figcaption></figure>` : (b.photo ? photo(b.photo) : '');
    return `${media}<span class="eyebrow">Spring Break ${esc(b.year)} · ${esc(b.role)}</span><h3 id="drawer-title">${esc(b.city)}, ${esc(b.state)}</h3>
      <p>${esc(b.text)}</p><p class="sub">With ${esc(b.org)}</p>
      <div class="cta-row"><a class="cta" href="${b.href}" target="_blank" rel="noopener">Visit ${esc(b.org)} ↗</a><button class="cta ghost" type="button" data-open="community:all">All builds</button></div>`;
  },
  journey: () => `${photo('graduation')}<span class="eyebrow">2022 → 2026</span><h3 id="drawer-title">The journey</h3>
      <p>A first-generation degree built on family sacrifice, mentorship and steady follow-through. Learning from mistakes, picking myself up and doing better.</p>
      <p>From <button class="inline-link" type="button" data-open="place:uganda">Uganda</button> to <button class="inline-link" type="button" data-open="place:fredericksburg">Fredericksburg</button>: 11,619 km, one day at a time.</p>
      <p class="sub">Success is rarely a solo journey.</p><div class="timeline">${$('#timeline').innerHTML}</div>`,
};
function openDrawer(key, opener = document.activeElement) {
  const [kind, id] = key.split(':');
  $('#drawer-body').innerHTML = builders[kind](id);
  $('#drawer-body').querySelectorAll('video[data-poster]').forEach((video) => {
    loadPhoto(video.dataset.poster, 'auto').then((image) => {
      if (image && video.isConnected) video.poster = image.src;
    }).catch(() => { /* a missing poster does not prevent video playback */ });
  });
  drawer.classList.add('open');
  showModal(drawer, $('#drawer-close'), opener);
  audio.ping(kind === 'demo' ? 880 : 660);
}
function closeDrawer() {
  drawer.querySelectorAll('video').forEach((video) => video.pause());
  drawer.classList.remove('open');
  hideModal(drawer);
}
$('#drawer-close').addEventListener('click', closeDrawer);
scrim.addEventListener('click', closeDrawer);
modalDismissal(drawer, closeDrawer);
addEventListener('keydown', (e) => { if (e.key === 'Escape' && drawer.classList.contains('open')) closeDrawer(); });

document.addEventListener('click', (e) => {
  const open = e.target.closest('[data-open]');
  if (open) { openDrawer(open.dataset.open, open); return; }
  const ask = e.target.closest('[data-ask]');
  if (ask) { closeDrawer(); openAsk(); askInput.value = ask.dataset.ask; answer(ask.dataset.ask); return; }
  const jump = e.target.closest('[data-jump]');
  if (jump) {
    e.preventDefault();
    endTour(); stopFlight?.();
    if (jump.hasAttribute('data-close')) closeDrawer();
    goTo(jump.dataset.jump);
    if (jump.closest('#section-menu')) {
      const heading = document.getElementById(jump.dataset.jump)?.querySelector('h1, h2');
      if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
    }
  }
});

/* Ask the world ------------------------------------------------------ */
const search = makeIndex(buildCorpus());
const askPanel = $('#ask'), askInput = $('#ask-input'), askOut = $('#ask-out'), askBtn = $('#ask-toggle');
const chipsHTML = askOut.innerHTML;
function openAsk() {
  endTour(); stopFlight?.(); onLeaveSkills?.();
  stopVoice();
  $('#section-menu').open = false;
  document.querySelectorAll('dialog[open]').forEach((el) => el.dispatchEvent(new Event('dismiss')));
  askPanel.hidden = false; askBtn.setAttribute('aria-expanded', 'true'); askInput.focus({ preventScroll: true });
}
function closeAsk({ restoreFocus = true } = {}) {
  askCtl?.abort(); askSequence++; askOut.removeAttribute('aria-busy');
  if (voiceOn()) stopVoice();
  askPanel.hidden = true; askBtn.setAttribute('aria-expanded', 'false'); if (restoreFocus) askBtn.focus({ preventScroll: true });
}
$('#section-menu').addEventListener('toggle', () => {
  if ($('#section-menu').open) { if (!askPanel.hidden) closeAsk({ restoreFocus: false }); endTour(); stopFlight?.(); onLeaveSkills?.(); }
});
askBtn.addEventListener('click', () => (askPanel.hidden ? openAsk() : closeAsk()));
$('#ask-close').addEventListener('click', closeAsk);
addEventListener('keydown', (e) => {
  const typing = /INPUT|TEXTAREA/.test(document.activeElement?.tagName || '');
  if ((e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) { e.preventDefault(); openAsk(); }
  else if (e.key === 'Escape' && !askPanel.hidden && !drawer.classList.contains('open')) closeAsk();
});
$('#ask-form').addEventListener('submit', (e) => { e.preventDefault(); answer(askInput.value); });
askPanel.addEventListener('click', (e) => { const c = e.target.closest('[data-q]'); if (c) { askInput.value = c.dataset.q; answer(c.dataset.q); } });
let askSequence = 0, askCtl = null, sampleOff = false;
const samplerP = (window.claude?.use ? window.claude.use('sample').catch(() => null) : Promise.resolve(null));
const citeList = (r) => r.map((x, i) => `[${i + 1}] ${esc(x.d.src)}`).join(' · ');
async function generate(q, r, el, srcEl, signal, current) {
  // 1) your own serverless endpoint (does retrieval + Claude server-side)
  if (ASK_ENDPOINT) {
    try {
      srcEl.textContent = 'Writing an answer…';
      const ck = 'ask:' + q.toLowerCase().replace(/\s+/g, ' ').trim();
      let j = null; try { j = JSON.parse(sessionStorage.getItem(ck) || 'null'); } catch { /* storage blocked */ }
      const valid = (value) => typeof value?.answer === 'string' && value.answer.trim() && Array.isArray(value.sources) && value.sources.every((s) => typeof s === 'string');
      if (!valid(j)) j = null;
      if (!j) {
        j = await fetchJSON(ASK_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: q }), signal, timeout: 12000 });
        if (!valid(j)) throw new Error('Invalid answer');
        if (!current()) return;
        try { sessionStorage.setItem(ck, JSON.stringify(j)); } catch { /* storage blocked */ }
      }
      if (!current()) return;
      el.textContent = j.answer; srcEl.textContent = `Claude · grounded in ${j.sources?.join(' · ') || 'site content'}`;
      return;
    } catch { /* fall through */ }
  }
  if (!current()) return;
  // 2) Claude inside claude.ai (viewer's own account, asks consent on first use)
  const sample = sampleOff ? null : await samplerP;
  if (!current()) return;
  if (!sample) { srcEl.textContent = `Retrieved · ${citeList(r)}`; return; }
  srcEl.textContent = 'Retrieved sources · Claude is writing…';
  try {
    await sample(ragPrompt(q, r), { modelTier: 'quick', signal, onText: ({ text }) => { if (current()) el.textContent = text; } });
    if (!current()) return;
    srcEl.textContent = `Claude · grounded in ${citeList(r)}`;
  } catch (e) {
    if (!current()) return;
    if (e?.text) el.textContent = e.text;
    if (['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed'].includes(e?.code)) sampleOff = true;
    srcEl.textContent = e?.code === 'cancelled' ? '' : `Retrieved · ${citeList(r)}`;
  }
}
function answer(q) {
  q = q.trim(); if (!q) return;
  askCtl?.abort(); askCtl = new AbortController();
  const signal = askCtl.signal, sequence = ++askSequence;
  const current = () => sequence === askSequence && !signal.aborted;
  if (voiceOn()) synth?.cancel();
  const r = search(q, 4);
  askOut.removeAttribute('aria-busy');
  if (!r.length) {
    askOut.innerHTML = `<p class="ask-a">That isn’t covered on this site. Try experience, projects, demos, skills or how to get in touch.</p>${chipsHTML}`;
    return;
  }
  const top = r[0].d, text = extract(top.text, q);
  askOut.innerHTML = `<p class="ask-a" id="ask-a"></p><p class="ask-src" id="ask-src"></p>${top.open ? `<button class="chip-btn" type="button" data-open="${top.open}">Open details</button>` : ''}`;
  const el = $('#ask-a');
  el.textContent = text;
  askOut.setAttribute('aria-busy', 'true');
  generate(q, r, el, $('#ask-src'), signal, current).finally(() => {
    if (!current()) return;
    askOut.removeAttribute('aria-busy');
    if (voiceOn()) speak((el.textContent.length > 20 ? el.textContent : text).replace(/\[\d+\]/g, ''));
  });
  if (!touch) goTo(top.station);
  const hv = linkHover[top.open];
  if (hv) { setTimeout(() => hv(true), 1700); setTimeout(() => hv(false), 4800); }
  audio.ping(700);
}

/* ------------------------------------------------------------------ */
/* Ambient sound (Web Audio, generated)                                */
/* ------------------------------------------------------------------ */
// Generative score (all synthesized, no recordings):
// - a soft felt piano playing slow broken chords that change at every station, in a long reverb
// - over Uganda and during the flight: nylon guitar fingerpicking (Karplus-Strong) with the drums
// - sparse bell "stars" in D major pentatonic that twinkle at random
// - over the Uganda globe: Kiganda drums (low mbuutu, mid, and high engalabi taps in a 12-pulse
//   cycle) and an amadinda-style interlocking xylophone, both soft and distant
const CHORDS = [ // one per station, mid register (no low drone)
  [146.83, 220, 293.66, 369.99],
  [146.83, 220, 293.66, 369.99], [146.83, 220, 277.18, 369.99], [123.47, 185, 246.94, 293.66], [98, 196, 246.94, 293.66],
  [146.83, 196, 246.94, 369.99], [110, 164.81, 220, 277.18], [123.47, 185, 246.94, 329.63], [98, 196, 246.94, 392], [146.83, 220, 293.66, 440],
];
const AMADINDA = Array.from({ length: 10 }, (_, k) => 196 * Math.pow(2, k / 5));
const OKUNAGA = [0, 2, 4, 2, 1, 3, 0, 2, 4, 3, 1, 2], OKWAWULA = [5, 7, 6, 8, 5, 6, 7, 9, 6, 8, 7, 5];
const DRUM_LOW = new Set([0, 7]), DRUM_MID = new Set([3, 5, 10]), DRUM_HIGH = new Set([1, 2, 4, 6, 8, 9, 11]);
const audio = {
  ctx: null, on: false, chord: -1, afro: 0, bellRate: 1, track: null, ducked: false, intent: 0,
  init() {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const master = ctx.createGain(); master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -24; comp.ratio.value = 2.5;
    master.connect(comp).connect(ctx.destination);
    // long, dark stereo reverb
    const len = Math.floor(ctx.sampleRate * 5.5), ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); let lp = 0; for (let i = 0; i < len; i++) { lp = lp * 0.6 + (Math.random() * 2 - 1) * 0.4; d[i] = lp * Math.pow(1 - i / len, 2.2); } }
    const verb = ctx.createConvolver(); verb.buffer = ir;
    const wet = ctx.createGain(); wet.gain.value = 0.42; verb.connect(wet).connect(master);
    const dry = ctx.createGain(); dry.gain.value = 0.68; dry.connect(master);
    // piano and guitar buses (the old hum pad is gone)
    const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 4200; filter.Q.value = 0.2;
    const padBus = ctx.createGain(); padBus.gain.value = 0.9; padBus.connect(filter); filter.connect(dry); filter.connect(verb);
    const guitarBus = ctx.createGain(); guitarBus.gain.value = 0; guitarBus.connect(dry); guitarBus.connect(verb);
    this.ks = new Map();
    const bellBus = ctx.createGain(); bellBus.gain.value = 0.5; bellBus.connect(dry); bellBus.connect(verb);
    const afroLp = ctx.createBiquadFilter(); afroLp.type = 'lowpass'; afroLp.frequency.value = 2600;
    const afroBus = ctx.createGain(); afroBus.gain.value = 0; afroBus.connect(afroLp); afroLp.connect(dry); afroLp.connect(verb);
    Object.assign(this, { ctx, master, filter, padBus, guitarBus, bellBus, afroBus, dry, verb });
    this.next = ctx.currentTime + 0.2; this.step = 0; this.nextBell = ctx.currentTime + 4; this.pnext = ctx.currentTime + 0.3; this.pstep = 0;
    this.timer = setInterval(() => this.schedule(), 60);
    if (SOUNDTRACK) {
      const el = new Audio(SOUNDTRACK); el.loop = true; el.preload = 'auto';
      const g = ctx.createGain(); g.gain.value = 0.7; ctx.createMediaElementSource(el).connect(g).connect(master);
      padBus.gain.value = 0.35; this.track = el;
    }
  },
  // Soft felt piano: slightly inharmonic partials with a natural decay
  piano(freq, t, vel = 0.2) {
    const { ctx } = this, g = ctx.createGain(), dur = Math.max(1.6, 4.2 - Math.log2(freq / 110) * 0.9);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel, t + 0.006); g.gain.exponentialRampToValueAtTime(vel * 0.35, t + 0.35); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(Math.min(9000, freq * 10), t); lp.frequency.exponentialRampToValueAtTime(Math.max(400, freq * 2.2), t + dur * 0.7);
    [[1, 1], [2, 0.45], [3, 0.2], [4, 0.12], [5, 0.06], [6, 0.035]].forEach(([n, a]) => {
      const o = ctx.createOscillator(), og = ctx.createGain(); o.frequency.value = freq * n * Math.sqrt(1 + 0.00035 * n * n); o.detune.value = (Math.random() - 0.5) * 4;
      og.gain.value = a; o.connect(og).connect(g); o.start(t); o.stop(t + dur + 0.05);
    });
    g.connect(lp).connect(this.padBus);
  },
  // Nylon-string guitar: Karplus-Strong plucked string, one cached buffer per pitch
  guitar(freq, t, vel = 0.3) {
    const { ctx } = this, key = Math.round(freq * 10);
    let buf = this.ks.get(key);
    if (!buf) {
      const sr = ctx.sampleRate, len = Math.floor(sr * 2.6), N = Math.max(2, Math.round(sr / freq)); buf = ctx.createBuffer(1, len, sr);
      const d = buf.getChannelData(0), ring = new Float32Array(N); let lp = 0;
      for (let i = 0; i < N; i++) { lp = lp * 0.5 + (Math.random() * 2 - 1) * 0.5; ring[i] = lp; }
      for (let i = 0; i < len; i++) { const k = i % N, nk = (i + 1) % N; d[i] = ring[k]; ring[k] = 0.4985 * (ring[k] + ring[nk]); }
      this.ks.set(key, buf);
    }
    const src = ctx.createBufferSource(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
    src.buffer = buf; lp.type = 'lowpass'; lp.frequency.value = 2400; g.gain.value = vel;
    src.connect(lp).connect(g).connect(this.guitarBus); src.start(t);
  },
  bell(freq, t, level = 0.12) {
    const { ctx } = this, g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(level, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 3.6);
    [[1, 1], [2.76, 0.18], [5.4, 0.05]].forEach(([m, a]) => { const o = ctx.createOscillator(), og = ctx.createGain(); o.frequency.value = freq * m; og.gain.value = a; o.connect(og).connect(g); o.start(t); o.stop(t + 3.7); });
    g.connect(this.bellBus);
  },
  drum(kind, t, level) {
    const { ctx } = this, g = ctx.createGain(), o = ctx.createOscillator();
    const [f0, f1, dec] = kind === 'low' ? [120, 58, 0.55] : kind === 'mid' ? [230, 170, 0.28] : [420, 340, 0.1];
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dec * 0.6);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(level, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
    o.connect(g).connect(this.afroBus); o.start(t); o.stop(t + dec + 0.05);
    // skin slap: short filtered noise
    const n = ctx.createBufferSource(), nbuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.05), ctx.sampleRate), d = nbuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    n.buffer = nbuf; const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = kind === 'high' ? 3000 : 1200; bp.Q.value = 1.2;
    const ngn = ctx.createGain(); ngn.gain.value = level * (kind === 'high' ? 0.5 : 0.25); n.connect(bp).connect(ngn).connect(this.afroBus); n.start(t);
  },
  pluck(freq, t) {
    const { ctx } = this, g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.35, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    [[1, 'sine', 1], [3.9, 'sine', 0.06]].forEach(([m, type, a]) => { const o = ctx.createOscillator(), og = ctx.createGain(); o.type = type; o.frequency.value = freq * m; og.gain.value = a; o.connect(og).connect(g); o.start(t); o.stop(t + 0.5); });
    g.connect(this.afroBus);
  },
  schedule() {
    if (!this.on || document.hidden || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    // Background throttling must not schedule a burst of missed notes on return.
    this.next = Math.max(this.next, now); this.pnext = Math.max(this.pnext, now); this.nextBell = Math.max(this.nextBell, now);
    while (this.nextBell < now + 0.3) {
      const harmony = CHORDS[Math.max(0, this.chord)] || CHORDS[0];
      const n = harmony[1 + (this.pstep % 3)] * 2;
      this.bell(n, this.nextBell, 0.05 + Math.random() * 0.07);
      if (Math.random() < 0.3) this.bell(n * 1.5 > 1000 ? n * 0.75 : n * 1.5, this.nextBell + 0.35, 0.04);
      this.nextBell += (5 + Math.random() * 6) / this.bellRate;
    }
    // "One day at a time": an eight-bar phrase with a returning melody and breathing room.
    // Chord tones keep the melody consonant as visitors move between stations.
    while (this.pnext < now + 0.3) {
      const c = CHORDS[Math.max(0, this.chord)] || CHORDS[0], s = this.pstep % 8, bar = Math.floor(this.pstep / 8) % 8, t = this.pnext, piano = 1 - this.afro * 0.65;
      if (piano > 0.08) {
        const human = Math.random() * 0.016, swell = 0.78 + Math.sin(bar / 7 * Math.PI) * 0.22;
        if (s === 0) this.piano(c[0] / 2, t, 0.13 * piano * swell);
        if (s < 6) this.piano([c[1], c[2], c[3], c[2], c[1], c[3]][s], t + human, (s === 0 ? 0.11 : 0.075) * piano * swell);
        const motif = [[2, 3, 2, 1], [1, 2, 3, 2], [2, 3, 1, 2], [3, 2, 1, 0]][bar % 4];
        if (!this.ducked && s % 2 === 0 && !(bar === 7 && s > 2)) this.piano(c[motif[s / 2]] * 2, t + 0.025, 0.085 * piano * swell);
      }
      this.pnext += 0.48; this.pstep++;
    }
    while (this.next < now + 0.25) {
      if (this.afro > 0.03) {
        const c = CHORDS[Math.max(0, this.chord)] || CHORDS[0], gs = this.step % 12;
        if (gs % 2 === 0) this.guitar([c[0] / 2, c[2], c[1], c[3], c[2], c[1]][gs / 2], this.next, gs === 0 ? 0.42 : 0.28);
        const s = this.step % 12, t = this.next;
        if (DRUM_LOW.has(s)) this.drum('low', t, 0.5);
        if (DRUM_MID.has(s)) this.drum('mid', t, 0.22);
        if (DRUM_HIGH.has(s)) this.drum('high', t, 0.09 + Math.random() * 0.05);
        if (this.step % 2 === 0) { const k = (this.step >> 1) % 12; this.pluck(AMADINDA[(this.step >> 1) % 2 ? OKWAWULA[k] : OKUNAGA[k]], t); }
      }
      this.next += 0.24; this.step++;
    }
  },
  toggle() {
    if (!this.ctx) this.init();
    this.on = !this.on;
    const intent = ++this.intent;
    clearTimeout(this.suspendTimer);
    const t = this.ctx.currentTime; this.next = t + 0.2; this.pnext = t + 0.25; this.nextBell = t + 2;
    if (this.on) this.ctx.resume().then(() => { if (intent === this.intent && this.on && !document.hidden && this.ctx.state !== 'running') { this.on = false; syncSound(); } }).catch(() => { if (intent === this.intent && !document.hidden) { this.on = false; syncSound(); } });
    this.level(this.on ? 0.9 : 0.12);
    if (this.track) { if (this.on) this.track.play().catch(() => {}); else this.track.pause(); }
    if (!this.on) this.suspendTimer = setTimeout(() => { if (!this.on) this.ctx.suspend().catch(() => {}); }, 700);
    return this.on;
  },
  level(fade = 0.3) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, gain = !this.on || document.hidden ? 0 : this.ducked ? 0.12 : 0.42;
    this.master.gain.cancelScheduledValues(t); this.master.gain.setTargetAtTime(gain, t, fade);
  },
  update(f) {
    if (!this.on) return;
    const t = this.ctx.currentTime, c = Math.min(CHORDS.length - 1, Math.round(f));
    this.chord = c;
    if (this.flightAmt >= 0) return;
    const amt = Math.max(0, 1 - Math.abs(f - 2) * 1.2);
    if (Math.abs(amt - this.afro) > 0.02) { this.afro = amt; this.afroBus.gain.setTargetAtTime(amt * 0.5, t, 0.6); this.guitarBus.gain.setTargetAtTime(amt * 0.9, t, 0.6); }
    this.bellRate = Math.abs(f - 6) < 0.6 ? 2 : 1; // more "stars" over the skill constellation
  },
  duck(on) { this.ducked = on; this.level(); },
  flightAmt: -1,
  flight(p) { // p: 0..1 during the flight, -1 when not flying
    this.flightAmt = p;
    if (!this.on) return;
    const t = this.ctx.currentTime;
    if (p < 0) return;
    const drums = p < 0.75 ? 1 : Math.max(0, 1 - (p - 0.75) / 0.2);
    this.afro = drums; this.afroBus.gain.setTargetAtTime(drums * 0.6, t, 0.4); this.guitarBus.gain.setTargetAtTime(drums, t, 0.4);

  },
  arrive() {
    if (!this.on) return; const t = this.ctx.currentTime + 0.05;
    [293.66, 369.99, 440, 587.33, 739.99].forEach((f, i) => this.bell(f, t + i * 0.18, 0.12));
  },
  ping(freq = 740, level = 0.1) {
    if (!this.on) return;
    const t = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(level * 0.6, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    o.connect(g); g.connect(this.dry); g.connect(this.verb); o.start(t); o.stop(t + 1);
  },
};
function syncSound() {
  document.querySelectorAll('[data-sound]').forEach((button) => {
    button.setAttribute('aria-pressed', String(audio.on));
    button.setAttribute('aria-label', audio.on ? 'Mute original ambient score' : 'Play original ambient score');
  });
}
document.querySelectorAll('[data-sound]').forEach((button) => button.addEventListener('click', () => {
  try { audio.toggle(); syncSound(); } catch { toast('Sound is unavailable in this browser.'); }
}));
document.addEventListener('visibilitychange', () => {
  if (!audio.ctx) return;
  const intent = ++audio.intent;
  clearTimeout(audio.suspendTimer);
  if (document.hidden) { audio.track?.pause(); audio.ctx.suspend().catch(() => {}); }
  else if (audio.on) {
    audio.next = audio.pnext = audio.ctx.currentTime + 0.2; audio.nextBell = audio.ctx.currentTime + 2;
    audio.ctx.resume().then(() => { if (intent !== audio.intent || !audio.on || document.hidden) return; audio.level(); audio.track?.play().catch(() => {}); }).catch(() => { if (intent === audio.intent && !document.hidden) { audio.on = false; syncSound(); } });
  }
});

/* ------------------------------------------------------------------ */
/* Live clock: the visitor's date and time, plus Kampala and Fredericksburg */
/* ------------------------------------------------------------------ */
let skyPhase = '';
const fmt = (opts, tz) => new Intl.DateTimeFormat([], tz ? { ...opts, timeZone: tz } : opts);
const fDate = fmt({ weekday: 'short', month: 'short', day: 'numeric' }), fTime = fmt({ hour: 'numeric', minute: '2-digit', second: '2-digit' });
const fKla = fmt({ hour: 'numeric', minute: '2-digit', weekday: 'short' }, 'Africa/Kampala'), fFxb = fmt({ hour: 'numeric', minute: '2-digit', weekday: 'short' }, 'America/New_York');
function tickClock() {
  const d = new Date();
  $('#sky-chip').innerHTML = `<span class="sc-date">${fDate.format(d)} · </span><time datetime="${d.toISOString()}">${fTime.format(d)}</time>${skyPhase ? `<span class="sky-phase">${esc(skyPhase)}</span>` : ''}`;
  const k = $('#t-kla'), f = $('#t-fxb'); if (k) { k.textContent = fKla.format(d); f.textContent = fFxb.format(d); }
}
tickClock(); setInterval(tickClock, 1000);

/* ------------------------------------------------------------------ */
/* Voice: speak (browser speech synthesis, free) and listen            */
/* ------------------------------------------------------------------ */
const synth = window.speechSynthesis;
let activeUtterance = null, voiceClip = null, voiceSequence = 0;
function stopVoice() {
  voiceSequence++; voiceClip?.pause(); voiceClip = null; activeUtterance = null;
  synth?.cancel(); audio.duck(false);
}
let voices = [];
const loadVoices = () => { try { voices = synth?.getVoices() || []; } catch { voices = []; } };
loadVoices(); try { synth?.addEventListener?.('voiceschanged', loadVoices); } catch { /* old browser */ }
function pickVoice() {
  const en = voices.filter((v) => /^en/i.test(v.lang));
  return en.find((v) => /natural|neural|online|google us|samantha|aria|jenny|guy/i.test(v.name)) || en.find((v) => /en-US/i.test(v.lang)) || en[0] || null;
}
function speak(text, { rate = 1, pitch = 1 } = {}) {
  if (!synth || !text) return;
  try {
    stopVoice();
    const u = new SpeechSynthesisUtterance(text.slice(0, 600)); const v = pickVoice(); if (v) u.voice = v;
    activeUtterance = u;
    u.rate = rate; u.pitch = pitch; u.volume = 1;
    audio.duck(true);
    u.onend = u.onerror = () => { if (activeUtterance === u) { activeUtterance = null; audio.duck(false); } };
    synth.speak(u);
  } catch { activeUtterance = null; audio.duck(false); }
}
const voiceOn = () => $('#ask-voice').checked;
try { $('#ask-voice').checked = store.get('aialo3d-voice') === '1'; } catch { /* storage */ }
$('#ask-voice').addEventListener('change', (e) => { store.set('aialo3d-voice', e.target.checked ? '1' : '0'); if (!e.target.checked) stopVoice(); });
if (!synth) $('#ask-voice').closest('label').hidden = true;

// Luganda greeting: plays assets/oli-otya.mp3 (record your own voice!) or falls back to a phonetic read.
$('#greet-reply').addEventListener('click', () => {
  $('#oli-reply').hidden = false; $('#greet-reply').hidden = true;
  playSequence(['assets/gyendi.mp3', 'assets/tukusanyukidde.mp3', 'assets/im-aloysious.mp3'], 'Jen-dee! I am fine.');
});
// My own voice: assets/oli-otya.mp3 and assets/webale-kujja.mp3 (falls back to a phonetic read)
function playVoice(src, fallback) {
  endTour(); stopVoice();
  const token = voiceSequence, clip = new Audio(src); voiceClip = clip;
  const valid = () => token === voiceSequence && voiceClip === clip;
  audio.duck(true);
  clip.onended = () => { if (valid()) { voiceClip = null; audio.duck(false); } };
  const fail = () => { if (valid()) { stopVoice(); speak(fallback, { rate: 0.85 }); } };
  clip.onerror = fail; clip.play().catch(fail);
}
function playSequence(list, fallback, i = 0, token) {
  if (i === 0) { endTour(); stopVoice(); token = voiceSequence; }
  if (token !== voiceSequence) return;
  if (i >= list.length) { voiceClip = null; audio.duck(false); return; }
  const clip = new Audio(list[i]); voiceClip = clip;
  const valid = () => token === voiceSequence && voiceClip === clip;
  audio.duck(true);
  clip.onended = () => setTimeout(() => { if (valid()) playSequence(list, fallback, i + 1, token); }, 260);
  const fail = () => { if (valid()) { stopVoice(); if (i === 0) speak(fallback, { rate: 0.9 }); } };
  clip.onerror = fail; clip.play().catch(fail);
}
$('#hear-greet').addEventListener('click', () => playVoice('assets/oli-otya.mp3', 'Oh-lee, oh-chah?'));
$('#hear-webale').addEventListener('click', () => playVoice('assets/webale-kujja.mp3', 'Weh-bah-leh koo-jah!'));

// Voice questions (Chrome, Edge, Safari). Hidden where the browser has no speech recognition.
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SR) {
  const mic = $('#ask-mic'); mic.hidden = false;
  let rec = null;
  mic.addEventListener('click', () => {
    if (rec) { rec.stop(); return; }
    try {
      rec = new SR(); rec.lang = 'en-US'; rec.interimResults = true; rec.maxAlternatives = 1;
      mic.classList.add('live'); mic.textContent = 'Listening…';
      rec.onresult = (ev) => { const t = [...ev.results].map((r) => r[0].transcript).join(' '); askInput.value = t; if (ev.results[ev.results.length - 1].isFinal) answer(t); };
      rec.onerror = (ev) => { toast(ev.error === 'not-allowed' ? 'Microphone access was blocked. You can type your question instead.' : 'Voice input stopped. You can type your question instead.'); };
      rec.onend = () => { rec = null; mic.classList.remove('live'); mic.textContent = 'Speak'; };
      rec.start();
    } catch { rec = null; mic.hidden = true; toast('Voice input is not available in this browser.'); }
  });
}

/* ------------------------------------------------------------------ */
/* Resume download (native link on your domain, downloads capability in claude.ai) */
/* ------------------------------------------------------------------ */
document.querySelectorAll('.resume-link').forEach((a) => a.addEventListener('click', async (e) => {
  if (!window.claude?.use) return; // normal site: the browser downloads the PDF
  e.preventDefault();
  try {
    const dl = await window.claude.use('downloads');
    if (!dl) throw new Error('no downloads');
    const blob = await fetch(a.getAttribute('href')).then((r) => r.blob());
    await dl.save({ filename: 'Aloysious_Kabonge_AI_ML_Engineer_Resume.pdf', data: blob });
  } catch (err) {
    if (err?.code === 'cancelled' || err?.code === 'declined') return;
    toast('The resume download opens on aialo.io');
  }
}));

/* ------------------------------------------------------------------ */
/* Guided tour (recruiter mode)                                     */
/* ------------------------------------------------------------------ */
const tourEl = $('#tour');
let tourTimer = 0, touring = false, tourClip = null, tourRun = 0, tourMediaTimer = 0, tourArrivalTimer = 0, tourSettleTimer = 0;
const syncTour = () => document.querySelectorAll('[data-tour]').forEach((button) => button.setAttribute('aria-pressed', String(touring)));
function endTour() {
  if (!touring) return; touring = false; tourRun++;
  clearTimeout(tourTimer); clearTimeout(tourMediaTimer); clearTimeout(tourArrivalTimer); clearTimeout(tourSettleTimer);
  stopVoice(); tourClip?.pause(); tourClip = null; audio.duck(false); syncTour();
  tourEl.hidden = true; document.body.classList.remove('touring'); lenis?.start();
}
function startTour() {
  if (touring) return; stopFlight?.(); closeDrawer(); if (!askPanel.hidden) closeAsk();
  stopVoice();
  touring = true; tourEl.hidden = false; document.body.classList.add('touring');
  const runId = ++tourRun; syncTour();
  let k = 0; const total = TOUR.reduce((a, t) => a + t.secs, 0); let elapsed = 0;
  const step = () => {
    if (!touring || runId !== tourRun) return;
    if (k >= TOUR.length) { endTour(); toast('That’s the tour. The resume is one click away.'); document.querySelector('#contact .resume-link')?.focus({ preventScroll: true }); return; }
    const t = TOUR[k];
    lenis?.start(); goTo(t.station); clearTimeout(tourSettleTimer); tourSettleTimer = setTimeout(() => { if (touring && runId === tourRun) lenis?.stop(); }, 2300);
    $('#tour-step').textContent = `${k + 1} / ${TOUR.length} · ${STATIONS.find((s) => s.id === t.station)?.label || ''}`;
    $('#tour-text').textContent = t.text;
    const run = (secs) => {
      if (!touring || runId !== tourRun) return;
      const bar = $('#tour-progress'); bar.style.transition = 'none'; bar.style.width = `${(elapsed / total) * 100}%`;
      requestAnimationFrame(() => { if (!touring || runId !== tourRun) return; bar.style.transition = `width ${secs}s linear`; bar.style.width = `${Math.min(100, ((elapsed + t.secs) / total) * 100)}%`; });
      elapsed += t.secs; k++; tourTimer = setTimeout(step, secs * 1000);
    };
    if (!$('#tour-voice').checked) { run(t.secs); return; }
    // Narration: my recorded voice (assets/tour-1.mp3 … tour-8.mp3), else the browser voice
    // Pacing: let the camera arrive, breathe, speak (a touch slower), then breathe again before moving on
    const ARRIVE = 1.8, BREATH = 2.6, RATE = 0.94;
    tourClip?.pause(); const clip = new Audio(`assets/tour-${k + 1}.mp3`); tourClip = clip;
    clip.preservesPitch = true; clip.playbackRate = RATE;
    const valid = () => touring && runId === tourRun && clip === tourClip;
    let done = false;
    clip.addEventListener('loadedmetadata', () => {
      if (done || !valid()) return; done = true; clearTimeout(tourMediaTimer);
      tourArrivalTimer = setTimeout(() => { if (!valid() || !$('#tour-voice').checked) return; audio.duck(true); clip.playbackRate = RATE; clip.play().catch(() => { if (valid()) { audio.duck(false); if ($('#tour-voice').checked) speak(t.text, { rate: 1.03 }); } }); }, ARRIVE * 1000);
      run(Math.max(t.secs, ARRIVE + (Number.isFinite(clip.duration) ? clip.duration / RATE : t.secs) + BREATH));
    });
    clip.addEventListener('ended', () => { if (valid()) audio.duck(false); });
    const fallback = () => { if (done || !valid()) return; done = true; clearTimeout(tourMediaTimer); if ($('#tour-voice').checked) speak(t.text, { rate: 1.03 }); run(t.secs); };
    clip.addEventListener('error', fallback);
    tourMediaTimer = setTimeout(fallback, 4000);
  };
  step();
}
$('#tour-skip').addEventListener('click', endTour);
$('#tour-voice').addEventListener('change', () => {
  if (!$('#tour-voice').checked) { clearTimeout(tourArrivalTimer); tourClip?.pause(); stopVoice(); }
});
document.addEventListener('visibilitychange', () => { if (document.hidden) { endTour(); stopVoice(); } });
document.addEventListener('click', (e) => { if (e.target.closest('[data-tour]')) { e.preventDefault(); $('#section-menu').open = false; touring ? endTour() : startTour(); } });
addEventListener('keydown', (e) => { if (e.key === 'Escape' && touring) endTour(); });

/* ------------------------------------------------------------------ */
/* Guestbook: notes become stars in the sky                            */
/* Order: your /api/guestbook (Vercel + Upstash) → claude.ai db → this browser only */
/* ------------------------------------------------------------------ */
const guest = { mode: 'local', notes: [], db: null, onChange: null };
const BAD = /\b(fuck|shit|bitch|cunt|nigg|fag|slut|whore|dick|pussy|rape|kill yourself|kys)\w*/i;
const cleanNote = (v, n) => String(v || '').replace(/https?:\/\/\S+|www\.\S+|<[^>]*>/gi, '').replace(/[\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);
function setNotes(list) { guest.notes = list.slice(0, 300); renderGuestList(); guest.onChange?.(guest.notes); }
function renderGuestList() {
  $('#gb-list').innerHTML = guest.notes.slice(0, 40).map((n) => `<li><b>${esc(n.name)}</b>${n.city ? ` · ${esc(n.city)}` : ''}<small>${esc(n.msg)}</small></li>`).join('') || '<li><small>No stars yet. Be the first.</small></li>';
}
async function loadGuestbook() {
  if (GUESTBOOK_ENDPOINT) {
    try { const j = await fetchJSON(GUESTBOOK_ENDPOINT); if (Array.isArray(j.notes)) { guest.mode = 'server'; setNotes(j.notes); return; } } catch { /* next */ }
  }
  try {
    const db = window.claude?.use ? await window.claude.use('db') : null;
    if (db) {
      guest.db = db; guest.mode = 'db';
      db.collection('guestbook').orderBy('t', 'desc').limit(300).onSnapshot((snap) => setNotes(snap.docs.map((d) => d.data())), () => { guest.mode = 'local'; });
      return;
    }
  } catch { /* next */ }
  try { setNotes(JSON.parse(localStorage.getItem('aialo3d-guest') || '[]')); } catch { setNotes([]); }
}
async function addNote(n) {
  if (guest.mode === 'server') {
    const j = await fetchJSON(GUESTBOOK_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(n) });
    if (Array.isArray(j.notes)) setNotes(j.notes);
    else if (j.saved === true && typeof j.note?.name === 'string' && typeof j.note?.msg === 'string' && Number.isFinite(j.note.t)) setNotes([j.note, ...guest.notes]);
    else throw new Error('Could not confirm your star. Please check the guestbook before trying again.');
    return j.refreshPending ? 'Your star was saved. Reload to refresh the visitor list when the connection recovers.' : 'Your star is in the sky for every visitor.';
  }
  if (guest.mode === 'db') { await guest.db.collection('guestbook').add(n); return 'Your star is in the sky.'; }
  const list = [n, ...guest.notes];
  try { localStorage.setItem('aialo3d-guest', JSON.stringify(list.slice(0, 50))); }
  catch { throw new Error('The shared guestbook and browser storage are unavailable. Please try again later.'); }
  setNotes(list); return 'The shared guestbook is unavailable. Your star is saved only in this browser.';
}
const gb = $('#guestbook');
const openGuestbook = (opener = document.activeElement) => { showModal(gb, $('#gb-name'), opener); renderGuestList(); $('#gb-status').textContent = guest.mode === 'local' ? 'Shared guestbook unavailable. Notes will be saved only in this browser.' : ''; };
const closeGuestbook = () => hideModal(gb);
modalDismissal(gb, closeGuestbook);
document.addEventListener('click', (e) => { const opener = e.target.closest('[data-guestbook]'); if (opener) openGuestbook(opener); });
$('#gb-close').addEventListener('click', closeGuestbook);
scrim.addEventListener('click', closeGuestbook);
addEventListener('keydown', (e) => { if (e.key === 'Escape' && gb.open) closeGuestbook(); });
$('#gb-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const n = { name: cleanNote($('#gb-name').value, 30), city: cleanNote($('#gb-city').value, 30), msg: cleanNote($('#gb-msg').value, 90), t: Date.now() };
  const st = $('#gb-status');
  const submit = $('#gb-form button[type="submit"]');
  if (submit.disabled) return;
  if (!n.name || !n.msg) { st.textContent = 'Add your first name and a short note.'; return; }
  if (BAD.test(`${n.name} ${n.city} ${n.msg}`)) { st.textContent = 'Please keep it kind. Try rewording your note.'; return; }
  st.textContent = 'Placing your star…';
  submit.disabled = true;
  try { st.textContent = await addNote(n); $('#gb-msg').value = ''; audio.ping(990, 0.12); guest.onPlaced?.(n, st.textContent); }
  catch (err) {
    st.textContent = err.name === 'AbortError' ? 'The connection timed out. Your note may have arrived; check the guestbook before trying again.' :
      err instanceof SyntaxError || err instanceof TypeError ? 'Could not confirm your star. Please check the guestbook before trying again.' :
      err.message || 'Could not save your star right now. Please try again later.';
  }
  finally { submit.disabled = false; }
});
loadGuestbook();

/* ------------------------------------------------------------------ */
/* Hidden surprises: type "habitat" or "oli otya" anywhere             */
/* ------------------------------------------------------------------ */
let typed = '', onHabitatEgg = null;
addEventListener('keydown', (e) => {
  if (/INPUT|TEXTAREA/.test(document.activeElement?.tagName || '') || e.key.length !== 1) return;
  typed = (typed + e.key.toLowerCase()).slice(-12);
  if (typed.endsWith('habitat')) { typed = ''; goTo('community'); setTimeout(() => onHabitatEgg?.(), 1800); toast('12 homes, rising. Thank you, Habitat for Humanity.'); }
  if (typed.replace(/\s/g, '').endsWith('oliotya')) { typed = ''; toast('Gyendi! I’m fine, thanks for asking.'); speak('Jen-dee! I am fine, thanks for asking.', { rate: 0.9 }); }
});

/* ------------------------------------------------------------------ */
/* Smooth scroll + station mapping                                     */
/* ------------------------------------------------------------------ */
let lenis = reduced ? null : new Lenis({ lerp: 0.09, smoothWheel: true, wheelMultiplier: 0.9 });
function updateMotion() {
  endTour(); stopFlight?.();
  reduced = motionPreference.matches || motionPaused;
  lenis?.destroy();
  lenis = reduced ? null : new Lenis({ lerp: 0.09, smoothWheel: true, wheelMultiplier: 0.9 });
  if (document.querySelector('dialog[open]')) lenis?.stop();
  document.documentElement.classList.toggle('motion-paused', reduced);
  if (reduced) finishIntro?.();
  document.querySelectorAll('[data-motion]').forEach((button) => {
    button.textContent = motionPreference.matches ? 'Reduced motion' : motionPaused ? 'Resume motion' : 'Pause motion';
    button.setAttribute('aria-pressed', String(reduced)); button.disabled = motionPreference.matches;
  });
}
motionPreference.addEventListener('change', updateMotion);
document.querySelectorAll('[data-motion]').forEach((button) => button.addEventListener('click', () => { motionPaused = !motionPaused; updateMotion(); }));
updateMotion();
const sections = STATIONS.map((s) => document.querySelector(`[data-station="${s.id}"]`));
let stops = [];
function measureStops() {
  const max = document.documentElement.scrollHeight - innerHeight;
  const headroom = Math.max(110, $('.hud-top').getBoundingClientRect().bottom + 12);
  stops = sections.map((el, i) => {
    if (i === 0) return 0;
    const content = el.querySelector('.panel, .hero-copy, .welcome-card') || el;
    const rect = content.getBoundingClientRect(), top = rect.top + scrollY;
    const target = rect.height > innerHeight - headroom - 90 ? top - headroom : top + rect.height / 2 - innerHeight / 2;
    return Math.max(0, Math.min(max, target));
  });
}
function stationFloat(y) {
  if (y <= stops[0]) return 0;
  for (let i = 0; i < stops.length - 1; i++) {
    if (y <= stops[i + 1]) return i + (y - stops[i]) / Math.max(1, stops[i + 1] - stops[i]);
  }
  return stops.length - 1;
}
if (/\.vercel\.app$|aialo\.io$/.test(location.hostname)) { const va = document.createElement('script'); va.defer = true; va.src = '/_vercel/insights/script.js'; document.head.appendChild(va); window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); }; }
function goTo(id) {
  const i = STATIONS.findIndex((s) => s.id === id);
  if (i < 0) return;
  if (lenis) lenis.scrollTo(stops[i], { duration: 2.2, easing: (t) => 1 - Math.pow(1 - t, 4) });
  else scrollTo({ top: stops[i], behavior: 'auto' });
}
measureStops();
addEventListener('resize', measureStops);
new ResizeObserver(measureStops).observe($('#track'));
document.fonts?.ready.then(measureStops);

const railBtns = [...document.querySelectorAll('#rail button')];
let activeStation = -1;
function updateHUD(f) {
  const a = Math.round(f);
  if (a !== activeStation) {
    activeStation = a;
    railBtns.forEach((b, i) => { b.classList.toggle('active', i === a); if (i === a) b.setAttribute('aria-current', 'location'); else b.removeAttribute('aria-current'); });
    document.querySelectorAll('#section-menu [data-jump]').forEach((link) => {
      if (link.dataset.jump === STATIONS[a]?.id) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current');
    });
    if (STATIONS[a]?.id !== 'skills') onLeaveSkills?.();
    if (deepReady && STATIONS[a]) { try { history.replaceState(null, '', a === 0 ? location.pathname + location.search : `#${STATIONS[a].id}`); } catch { /* sandboxed */ } }
  }
}
// Deep links: 3d.aialo.io/#community opens straight on that stop; the address bar follows the visitor.
let deepReady = false;
const hashStation = () => { try { const h = decodeURIComponent(location.hash.slice(1)); return STATIONS.some((s) => s.id === h) ? h : null; } catch { return null; } };
function openDeepLink() {
  const id = hashStation();
  if (id) { measureStops(); goTo(id); setTimeout(() => { deepReady = true; }, 2600); } else deepReady = true;
}
addEventListener('hashchange', () => { const id = hashStation(); if (id) goTo(id); });
addEventListener('scroll', () => { if (scrollY > 60) $('#hint').classList.add('hide'); }, { passive: true });

/* ------------------------------------------------------------------ */
/* WebGL                                                               */
/* ------------------------------------------------------------------ */
const canvas = $('#world');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  if (!renderer.capabilities.isWebGL2) throw new Error('WebGL2 required');
} catch (err) {
  document.documentElement.classList.add('no-webgl');
  document.body.classList.add('no-webgl');
  window.portfolioBoot?.ready(); openDeepLink();
  $('#hint').innerHTML = 'Your browser could not start 3D, so this is the simple version. <a href="text.html">Read the text version</a>';
  renderer = null;
  updateHUD(stationFloat(scrollY));
  addEventListener('scroll', () => updateHUD(stationFloat(scrollY)), { passive: true });
  (function raf(t) { lenis?.raf(t); updateHUD(stationFloat(scrollY)); requestAnimationFrame(raf); })(0);
}

if (renderer) boot().catch(() => {
  sceneFailed = true;
  renderer.setAnimationLoop(null); lenis?.destroy(); lenis = null;
  document.documentElement.classList.add('no-webgl');
  window.portfolioBoot?.fail();
});

async function boot() {
  const loaderCount = $('#loader-count'), loaderBar = $('#loader-bar');
  const bootLog = $('#boot');
  const progress = async (p, line) => {
    loaderCount.textContent = String(Math.round(p * 100)).padStart(2, '0'); loaderBar.style.width = `${p * 100}%`;
    if (line) { const d = document.createElement('div'); d.textContent = line; bootLog.append(d); while (bootLog.children.length > 4) bootLog.firstChild.remove(); }
    await nextFrame();
  };

  renderer.setPixelRatio(Math.min(devicePixelRatio, HIGH() ? 2 : 1));
  renderer.setSize(innerWidth, innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(NIGHT.clone(), 0.0105);
  const camera = new THREE.PerspectiveCamera(46, innerWidth / innerHeight, 0.1, 1400);
  camera.position.set(0, 6, 44);

  const clock = new THREE.Timer();
  const U = { uTime: { value: 0 }, uDawn: { value: 0 }, uPR: { value: renderer.getPixelRatio() }, uDay: { value: 0 }, uWarm: { value: 0 } };
  const hits = []; // raycast targets
  const register = (obj, entry) => { obj.userData.hit = entry; hits.push(obj); };

  await Promise.race([document.fonts?.ready, new Promise((r) => setTimeout(r, 1500))]);
  await progress(0.05, 'Loading type and shaders');

  const hemisphere = new THREE.HemisphereLight(0x8fa8ff, 0x0a0f24, 0.6); scene.add(hemisphere);
  const key = new THREE.DirectionalLight(0xffe2b0, 1.2); key.position.set(10, 20, 10); scene.add(key);

  /* ---------- sky + stars ---------- */
  const SUN_POS = new THREE.Vector3(0, 26, -640);
  const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 24), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uDawn: U.uDawn, uDay: U.uDay, uWarm: U.uWarm, uSun: { value: new THREE.Vector3(0, 0.085, -1).normalize() } },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
    fragmentShader: `varying vec3 vDir; uniform float uDawn, uDay, uWarm; uniform vec3 uSun;
      void main(){
        float h = vDir.y;
        vec3 nTop = vec3(0.004,0.007,0.025), nHor = vec3(0.025,0.04,0.11);
        vec3 dTop = vec3(0.03,0.04,0.12), dHor = vec3(0.5,0.24,0.14);
        nTop = mix(nTop, vec3(0.07,0.22,0.42), uDay); nHor = mix(nHor, vec3(0.38,0.60,0.72), uDay); nHor = mix(nHor, vec3(0.48,0.21,0.12), uWarm);
        vec3 top = mix(nTop, dTop, uDawn), hor = mix(nHor, dHor, uDawn);
        vec3 c = mix(hor, top, smoothstep(-0.02, 0.45, h));
        float s = max(dot(vDir, uSun), 0.);
        c += vec3(1.0,0.62,0.3) * (pow(s, 40.) * 0.5 + pow(s, 6.) * 0.08) * uDawn;
        c = mix(c, nTop * 0.6, (1. - smoothstep(-0.25, 0.0, h)));
        gl_FragColor = vec4(c, 1.);
      }`,
  }));
  sky.frustumCulled = false; scene.add(sky);
  // The sky follows the visitor's own clock: night, sunrise, daytime blue, sunset
  function applyLocalSky() {
    const { daylight, warmth, phase } = localAtmosphere();
    U.uDay.value = daylight; U.uWarm.value = warmth;
    hemisphere.intensity = 0.6 + daylight * 0.7;
    key.intensity = 1.2 + daylight * 0.65;
    key.color.setHex(warmth > 0.25 ? 0xffc58b : daylight > 0.3 ? 0xfff0d8 : 0xffe2b0);
    skyPhase = phase;
    document.documentElement.dataset.skyPhase = phase;
  }
  applyLocalSky(); setInterval(applyLocalSky, 60000);

  const pointsMat = (vs, fs, extra = {}) => new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { ...U, ...extra }, vertexShader: vs, fragmentShader: fs });
  const starGeo = new THREE.BufferGeometry();
  { const n = HIGH() ? 2600 : 1200, p = new Float32Array(n * 3), s = new Float32Array(n);
    for (let i = 0; i < n; i++) { const v = new THREE.Vector3().randomDirection(); v.y = Math.abs(v.y) * 0.95 + 0.02; v.normalize().multiplyScalar(800); p.set([v.x, v.y, v.z], i * 3); s[i] = Math.random(); }
    starGeo.setAttribute('position', new THREE.BufferAttribute(p, 3)); starGeo.setAttribute('aSeed', new THREE.BufferAttribute(s, 1)); }
  const stars = new THREE.Points(starGeo, pointsMat(
    `attribute float aSeed; uniform float uTime; uniform float uPR; varying float vA;
     void main(){ vec4 mv = modelViewMatrix * vec4(position,1.); gl_Position = projectionMatrix * mv;
       vA = 0.35 + 0.65 * sin(uTime * (0.6 + aSeed * 2.) + aSeed * 40.) * 0.5 + 0.5; gl_PointSize = (1.0 + aSeed * 2.2) * uPR; }`,
    `uniform float uDawn, uDay; varying float vA; void main(){ float d = length(gl_PointCoord - .5); if(d > .5) discard; gl_FragColor = vec4(vec3(0.85,0.9,1.), (1. - d*2.) * vA * (1. - uDawn * 0.92) * max(0., 1. - uDay * 1.4)); }`));
  stars.frustumCulled = false; scene.add(stars);

  /* ---------- ground grid with the river ---------- */
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600, 1, 1), new THREE.ShaderMaterial({
    transparent: true, fog: false, uniforms: U,
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `varying vec3 vW; uniform float uTime; uniform float uDawn;
      void main(){
        vec2 c = vW.xz / 4.0; vec2 g = abs(fract(c - .5) - .5) / fwidth(c);
        float line = 1. - min(min(g.x, g.y), 1.);
        vec2 c2 = vW.xz / 20.0; vec2 g2 = abs(fract(c2 - .5) - .5) / fwidth(c2);
        float major = 1. - min(min(g2.x, g2.y), 1.);
        float dist = distance(cameraPosition.xz, vW.xz);
        float fade = exp(-dist * 0.016);
        float rx = sin(vW.z * 0.03) * 10. + sin(vW.z * 0.011) * 6. - 2.;
        float river = (1. - smoothstep(0., 2.2, abs(vW.x - rx)));
        float flow = 0.55 + 0.45 * sin(vW.z * 0.35 + uTime * 2.2);
        vec3 base = mix(vec3(0.02,0.035,0.09), vec3(0.09,0.06,0.07), uDawn);
        vec3 col = base + vec3(0.25,0.35,0.75) * line * 0.22 + vec3(0.9,0.7,0.3) * major * 0.10;
        col += vec3(0.44,0.89,0.84) * river * flow * 0.28;
        gl_FragColor = vec4(col, fade);
      }`,
  }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -4; scene.add(ground);

  /* ---------- drifting data motes ---------- */
  { const n = HIGH() ? 3500 : 1400, p = new Float32Array(n * 3), s = new Float32Array(n);
    for (let i = 0; i < n; i++) { p.set([(Math.random() - 0.5) * 70, Math.random() * 18 - 3, 30 - Math.random() * 430], i * 3); s[i] = Math.random(); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('aSeed', new THREE.BufferAttribute(s, 1));
    const motes = new THREE.Points(g, pointsMat(
      `attribute float aSeed; uniform float uTime; uniform float uPR; varying float vS;
       void main(){ vec3 p = position; p.y = mod(p.y + 3. + uTime * (0.15 + aSeed * 0.35), 18.) - 3.; p.x += sin(uTime * 0.3 + aSeed * 20.) * 0.6;
         vec4 mv = modelViewMatrix * vec4(p,1.); gl_Position = projectionMatrix * mv; vS = aSeed; gl_PointSize = min((1.2 + aSeed * 2.4) * (28. / -mv.z), 5.) * uPR; }`,
      `varying float vS; void main(){ float d = length(gl_PointCoord - .5); if(d > .5) discard; vec3 c = mix(vec3(0.91,0.71,0.29), vec3(0.44,0.89,0.84), step(0.55, vS)); gl_FragColor = vec4(c, (1. - d * 2.) * 0.55); }`));
    motes.frustumCulled = false; scene.add(motes); }
  // Guestbook stars: each visitor note is a gold star in a dome that follows the camera
  const guestGeo = new THREE.BufferGeometry(); guestGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(3), 3)); guestGeo.setAttribute('aSeed', new THREE.Float32BufferAttribute(new Float32Array(1), 1));
  const guestStars = new THREE.Points(guestGeo, pointsMat(
    `attribute float aSeed; uniform float uTime; uniform float uPR; varying float vA;
     void main(){ vec4 mv = modelViewMatrix * vec4(position,1.); gl_Position = projectionMatrix * mv;
       vA = 0.75 + 0.25 * sin(uTime * 1.7 + aSeed * 30.); gl_PointSize = (4.5 + aSeed * 2.5) * uPR; }`,
    `varying float vA; void main(){ float d = length(gl_PointCoord - .5); if(d > .5) discard; float core = smoothstep(0.5, 0.0, d);
      gl_FragColor = vec4(vec3(1.0, 0.82, 0.45) * (0.8 + core), core * vA); }`));
  guestStars.frustumCulled = false; guestStars.visible = false; scene.add(guestStars);
  let guestList = [], guestFlash = -1;
  const hash01 = (str, k) => { let x = 2166136261 ^ k; for (let i = 0; i < str.length; i++) { x ^= str.charCodeAt(i); x = Math.imul(x, 16777619); } return ((x >>> 0) % 10000) / 10000; };
  function buildGuestStars(list) {
    guestList = list; const pos = new Float32Array(Math.max(1, list.length) * 3), seed = new Float32Array(Math.max(1, list.length));
    list.forEach((n, i) => {
      const key = `${n.name}|${n.t}`, az = hash01(key, 1) * Math.PI * 2, el = 0.12 + hash01(key, 2) * 0.62, r = 300;
      pos.set([Math.cos(az) * Math.cos(el) * r, Math.sin(el) * r, Math.sin(az) * Math.cos(el) * r], i * 3); seed[i] = hash01(key, 3);
    });
    guestGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); guestGeo.setAttribute('aSeed', new THREE.Float32BufferAttribute(seed, 1));
    guestGeo.computeBoundingSphere(); guestStars.visible = list.length > 0;
  }
  register(guestStars, {
    points: true,
    label: (hit) => { const n = guestList[hit.index]; return n ? `${n.name}${n.city ? ` · ${n.city}` : ''}: “${n.msg}”` : 'A visitor’s star'; },
    click: () => openGuestbook(),
  });
  await progress(0.2, 'Painting the sky, the river and the data motes');

  /* ---------- labels ---------- */
  function label(title, sub = '', { accent = '#e8b54a', h = 0.9 } = {}) {
    const dpr = 2, pad = 28 * dpr, c = document.createElement('canvas'), x = c.getContext('2d');
    const tf = `600 ${46 * dpr}px "Bricolage Grotesque", system-ui, sans-serif`, sf = `500 ${22 * dpr}px "IBM Plex Mono", monospace`;
    x.font = tf; const tw = x.measureText(title).width; x.font = sf; const sw = sub ? x.measureText(sub).width : 0;
    c.width = Math.ceil(Math.max(tw, sw) + pad * 2); c.height = (sub ? 128 : 88) * dpr;
    x.fillStyle = 'rgba(8,12,30,0.72)'; x.strokeStyle = 'rgba(154,165,194,0.35)'; x.lineWidth = 2 * dpr;
    x.beginPath(); x.roundRect(dpr, dpr, c.width - 2 * dpr, c.height - 2 * dpr, 16 * dpr); x.fill(); x.stroke();
    x.fillStyle = '#eef1f8'; x.font = tf; x.textBaseline = 'middle'; x.fillText(title, pad, (sub ? 46 : 44) * dpr);
    if (sub) { x.fillStyle = accent; x.font = sf; x.fillText(sub, pad, 94 * dpr); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, fog: false }));
    const hh = h * (sub ? 1 : 0.7); s.scale.set(hh * c.width / c.height, hh, 1); s.renderOrder = 10;
    return s;
  }

  /* ---------- simplex noise GLSL (Ashima Arts, MIT) ---------- */
  const NOISE = `vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;} vec4 mod289(vec4 x){return x-floor(x*(1./289.))*289.;}
    vec4 permute(vec4 x){return mod289(((x*34.)+1.)*x);} vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
    float snoise(vec3 v){ const vec2 C=vec2(1./6.,1./3.); const vec4 D=vec4(0.,.5,1.,2.);
      vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx); vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
      vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy; i=mod289(i);
      vec4 p=permute(permute(permute(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
      float n_=.142857142857; vec3 ns=n_*D.wyz-D.xzx; vec4 j=p-49.*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.*x_);
      vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.-abs(x)-abs(y); vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
      vec4 s0=floor(b0)*2.+1.; vec4 s1=floor(b1)*2.+1.; vec4 sh=-step(h,vec4(0.)); vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
      vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
      vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3))); p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
      vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.); m=m*m;
      return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3))); }`;

  /* ================================================================ */
  /* Station 0 — the signal core                                       */
  /* ================================================================ */
  const P = { // world anchors for each station
    hero: new THREE.Vector3(0, 0.4, 0),
    journey: new THREE.Vector3(7.5, 1.2, -62),
    experience: new THREE.Vector3(-9.5, 0, -124),
    projects: new THREE.Vector3(7, 0.8, -186),
    demos: new THREE.Vector3(-8.5, -1, -248),
    skills: new THREE.Vector3(8, 1.2, -310),
    community: new THREE.Vector3(-8, -0.6, -370),
    stars: new THREE.Vector3(3, 24, -404),
    contact: new THREE.Vector3(6.5, 5.2, -430),
  };

  // ---------- Visitors' sky: every guestbook note as a named star in its own constellation ----------
  const vis = new THREE.Group(); vis.position.copy(P.stars); scene.add(vis);
  const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.18, 'rgba(255,226,150,0.95)'); g.addColorStop(0.45, 'rgba(232,181,74,0.35)'); g.addColorStop(1, 'rgba(232,181,74,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  let visItems = [], visLine = null, visEmpty = null, visCount = $('#vis-count');
  let clearVisitorHover = () => {}; // assigned after pointer state exists below
  function buildVisitorSky(list) {
    visItems.forEach((it) => {
      const index = hits.indexOf(it.hit); if (index !== -1) hits.splice(index, 1);
      clearVisitorHover(it.hit);
      gsap.killTweensOf(it.star.scale);
      vis.remove(it.g); it.g.clear();
      it.tag.material.map.dispose(); it.tag.material.dispose();
      // Sprite geometry and glowTex are shared; only these per-note resources are owned here.
      it.star.material.dispose(); it.hit.geometry.dispose(); it.hit.material.dispose();
    }); visItems = [];
    if (visLine) { vis.remove(visLine); visLine.geometry.dispose(); visLine.material.dispose(); visLine = null; }
    if (visEmpty) { vis.remove(visEmpty); visEmpty.material.map.dispose(); visEmpty.material.dispose(); visEmpty = null; }
    const shown = list.slice(0, 60), ga = Math.PI * (3 - Math.sqrt(5)), pts = [];
    shown.forEach((n, i) => {
      const r = 1.4 + Math.sqrt(i) * 1.9, a = i * ga + 0.4, p = new THREE.Vector3(Math.cos(a) * r * 1.3, Math.sin(a) * r * 0.8, Math.sin(i * 1.3) * 0.8);
      const g = new THREE.Group(); g.position.copy(p); vis.add(g); pts.push(p);
      const star = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      const size = i === 0 ? 1.9 : 1.2 + hash01(`${n.name}${n.t}`, 5) * 0.5; star.scale.setScalar(size); g.add(star);
      const tag = label(n.name, n.city || 'a visitor', { h: 1.0 }); tag.position.y = -1.05; g.add(tag);
      const hit = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 6), new THREE.MeshBasicMaterial({ visible: false })); g.add(hit);
      register(hit, { label: `${n.name}${n.city ? ` · ${n.city}` : ''}: “${n.msg}”`, click: () => { toast(`${n.name}${n.city ? ` from ${n.city}` : ''}: “${n.msg}”`); audio.ping(1046, 0.08); },
        hover: (on) => tween(star.scale, { x: size * (on ? 1.5 : 1), y: size * (on ? 1.5 : 1), duration: 0.3 }) });
      visItems.push({ g, star, tag, hit, size, seed: hash01(n.name, 7) });
    });
    if (pts.length > 1) {
      const seg = []; for (let i = 1; i < pts.length; i++) { let j = 0, bd = Infinity; for (let k = 0; k < i; k++) { const d = pts[k].distanceToSquared(pts[i]); if (d < bd) { bd = d; j = k; } } seg.push(pts[j], pts[i]); }
      visLine = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(seg), new THREE.LineBasicMaterial({ color: GOLD, transparent: true, opacity: 0.28, depthWrite: false }));
      vis.add(visLine);
    }
    if (!shown.length) { visEmpty = label('Be the first star', 'leave a note below', { h: 0.9 }); vis.add(visEmpty); }
    const places = new Set(list.map((n) => (n.city || '').toLowerCase()).filter(Boolean)).size;
    if (visCount) visCount.textContent = list.length ? `${list.length} ${list.length === 1 ? 'star' : 'stars'}${places ? ` from ${places} ${places === 1 ? 'place' : 'places'}` : ''}` : 'No stars yet';
  }
  guest.onChange = (list) => { buildGuestStars(list); buildVisitorSky(list); }; guest.onChange(guest.notes);
  guest.onPlaced = (_note, confirmation) => {
    closeGuestbook(); goTo('stars'); toast(confirmation);
    setTimeout(() => { const it = visItems[0]; if (it && !reduced) gsap.fromTo(it.star.scale, { x: 0.1, y: 0.1 }, { x: it.size * 1.8, y: it.size * 1.8, duration: 1.2, yoyo: true, repeat: 1, ease: 'power3.out' }); audio.arrive(); }, 2400);
  };

  const core = new THREE.Group(); core.position.copy(P.hero); scene.add(core);
  const coreU = { ...U, uHover: { value: 0 }, uPulse: { value: 0 } };
  const coreMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(2.1, HIGH() ? 56 : 20), new THREE.ShaderMaterial({
    uniforms: coreU,
    vertexShader: `${NOISE} uniform float uTime, uHover, uPulse; varying vec3 vN; varying vec3 vV; varying float vD;
      void main(){ float n = snoise(position * 0.55 + vec3(0., uTime * 0.22, 0.)); float n2 = snoise(position * 1.8 + uTime * 0.5);
        float d = n * (0.28 + uHover * 0.22) + n2 * (0.05 + uPulse * 0.35); vD = d;
        vec3 p = position + normal * d; vec4 mv = modelViewMatrix * vec4(p, 1.); vN = normalize(normalMatrix * normal); vV = -mv.xyz; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float uTime, uPulse; varying vec3 vN; varying vec3 vV; varying float vD;
      void main(){ float f = pow(clamp(1. - abs(dot(normalize(vN), normalize(vV))), 0., 1.), 2.2);
        vec3 deep = vec3(0.03, 0.05, 0.16), sig = vec3(0.44, 0.89, 0.84), gold = vec3(0.91, 0.71, 0.29);
        vec3 c = mix(deep, sig * 0.8, f) + gold * smoothstep(0.14, 0.5, vD) * 0.7;
        c += gold * pow(abs(sin(vD * 26. - uTime * 1.5)), 24.) * 0.35 + sig * uPulse * 0.6;
        gl_FragColor = vec4(c, 1.); }`,
  }));
  core.add(coreMesh);
  const shell = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(3.05, 1)), new THREE.LineBasicMaterial({ color: GOLD, transparent: true, opacity: 0.22 }));
  core.add(shell);
  const rings = [[3.5, 0.014, GOLD, [1.2, 0.2, 0]], [4.2, 0.01, SIGNAL, [0.3, 0.9, 0.2]], [5.1, 0.008, GOLD, [1.7, -0.4, 0.5]]].map(([r, t, c, rot]) => {
    const m = new THREE.Mesh(new THREE.TorusGeometry(r, t, 8, 256), new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(1.6), transparent: true, opacity: 0.85 }));
    m.rotation.set(...rot); core.add(m); return m;
  });
  { const n = HIGH() ? 1600 : 700, p = new Float32Array(n * 3), s = new Float32Array(n);
    for (let i = 0; i < n; i++) { const v = new THREE.Vector3().randomDirection().multiplyScalar(4.3 + Math.random() * 3.8); p.set([v.x, v.y * 0.6, v.z], i * 3); s[i] = Math.random(); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('aSeed', new THREE.BufferAttribute(s, 1));
    const orbit = new THREE.Points(g, pointsMat(
      `attribute float aSeed; uniform float uPR; varying float vS; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.); gl_Position = projectionMatrix * mv; vS = aSeed; gl_PointSize = min((1. + aSeed * 2.) * (22. / -mv.z), 5.) * uPR; }`,
      `varying float vS; void main(){ float d = length(gl_PointCoord - .5); if(d > .5) discard; gl_FragColor = vec4(mix(vec3(0.91,0.71,0.29), vec3(0.6,0.95,0.9), vS), (1. - d * 2.) * 0.8); }`));
    orbit.name = 'orbit'; core.add(orbit); }
  const coreHit = new THREE.Mesh(new THREE.SphereGeometry(3.2, 16, 12), new THREE.MeshBasicMaterial({ visible: false }));
  core.add(coreHit);
  register(coreHit, {
    label: 'Signal core · click to pulse',
    hover: (on) => tween(coreU.uHover, { value: on ? 1 : 0, duration: 0.6 }),
    click: () => { audio.ping(520); gsap.fromTo(coreU.uPulse, { value: 1 }, { value: 0, duration: 1.6, ease: 'power3.out' }); },
  });
  await progress(0.32, 'Igniting the signal core');

  /* ================================================================ */
  /* Station 1 — globe + Uganda → Fredericksburg arc                   */
  /* ================================================================ */
  const R = 5;
  const ll = (lat, lon, r = R) => { const phi = THREE.MathUtils.degToRad(90 - lat), th = THREE.MathUtils.degToRad(lon + 180); return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(th), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(th)); };
  const globe = new THREE.Group(); globe.position.copy(P.journey); scene.add(globe);
  const globeInner = new THREE.Group(); globe.add(globeInner);
  // Continents: 14k Fibonacci dots classified against Natural Earth land (see landmask.js)
  { const mask = decodeLand(), n = LAND_N, golden = Math.PI * (3 - Math.sqrt(5));
    const sea = [], land = [], landCol = [];
    const cLand = new THREE.Color(0xa9bcff), cUS = new THREE.Color(0x8fe8dd), cUG = new THREE.Color(0xf5c75a);
    for (let i = 0; i < n; i++) {
      const y = 1 - (i / (n - 1)) * 2, r = Math.sqrt(1 - y * y), t = golden * i, x = Math.cos(t) * r * R, z = Math.sin(t) * r * R;
      if (mask[i] === 0) { if (HIGH() || i % 2 === 0) sea.push(x, y * R, z); }
      else { land.push(x * 1.004, y * R * 1.004, z * 1.004); const c = mask[i] === 2 ? cUG : mask[i] === 3 ? cUS : cLand; landCol.push(c.r, c.g, c.b); }
    }
    for (let k = 0; k < UGANDA_DOTS.length; k += 2) { const v = ll(UGANDA_DOTS[k] / 10, UGANDA_DOTS[k + 1] / 10, R * 1.006); land.push(v.x, v.y, v.z); landCol.push(cUG.r * 1.6, cUG.g * 1.6, cUG.b * 1.6); }
    const gs = new THREE.BufferGeometry(); gs.setAttribute('position', new THREE.Float32BufferAttribute(sea, 3));
    globeInner.add(new THREE.Points(gs, new THREE.PointsMaterial({ color: 0x33427a, size: 0.045, transparent: true, opacity: 0.55, depthWrite: false })));
    const gl = new THREE.BufferGeometry(); gl.setAttribute('position', new THREE.Float32BufferAttribute(land, 3)); gl.setAttribute('color', new THREE.Float32BufferAttribute(landCol, 3));
    globeInner.add(new THREE.Points(gl, new THREE.PointsMaterial({ vertexColors: true, size: 0.085, transparent: true, opacity: 0.95, depthWrite: false }))); }
  globeInner.add(new THREE.Mesh(new THREE.SphereGeometry(R * 0.985, 48, 32), new THREE.MeshBasicMaterial({ color: 0x050918, transparent: true, opacity: 0.7 })));
  for (let lat = -60; lat <= 60; lat += 30) {
    const pts = []; for (let lon = -180; lon <= 180; lon += 6) pts.push(ll(lat, lon, R * 1.002));
    globeInner.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: lat === 0 ? GOLD : 0x2a3970, transparent: true, opacity: lat === 0 ? 0.5 : 0.5 })));
  }
  const A = ll(ORIGIN.lat, ORIGIN.lon), B = ll(DEST.lat, DEST.lon);
  const arcPts = []; for (let i = 0; i <= 64; i++) { const t = i / 64; const v = new THREE.Vector3().copy(A).normalize().lerp(B.clone().normalize(), t).normalize(); arcPts.push(v.multiplyScalar(R + Math.sin(Math.PI * t) * 2.6)); }
  const arcCurve = new THREE.CatmullRomCurve3(arcPts);
  const arcU = { ...U, uDraw: { value: 0 } };
  globeInner.add(new THREE.Mesh(new THREE.TubeGeometry(arcCurve, 160, 0.045, 8), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: arcU,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
    fragmentShader: `uniform float uTime, uDraw; varying vec2 vUv; void main(){ if (vUv.x > uDraw) discard;
      vec3 c = mix(vec3(0.91,0.71,0.29), vec3(0.44,0.89,0.84), vUv.x); float dash = smoothstep(0.7, 1., fract(vUv.x * 6. - uTime * 0.5));
      gl_FragColor = vec4(c * (1.2 + dash * 2.), 0.55 + dash * 0.45); }`,
  })));
  const markers = [[A, GOLD, ORIGIN.label, `${ORIGIN.lat.toFixed(2)}°N ${ORIGIN.lon.toFixed(2)}°E`], [B, SIGNAL, DEST.label, `${DEST.lat.toFixed(2)}°N ${Math.abs(DEST.lon).toFixed(2)}°W`]].map(([pos, col, name, sub]) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 12), new THREE.MeshBasicMaterial({ color: col.clone().multiplyScalar(2) }));
    m.position.copy(pos); globeInner.add(m);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.26, 40), new THREE.MeshBasicMaterial({ color: col, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
    ring.position.copy(pos).multiplyScalar(1.005); ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), pos.clone().normalize()); globeInner.add(ring);
    const l = label(name, `${sub} · explore ↗`, { h: 0.85 }); l.position.copy(pos).multiplyScalar(1.5); globeInner.add(l);
    const key = name === ORIGIN.label ? 'place:uganda' : 'place:fredericksburg';
    const entry = { label: `${name} · open`, click: () => openDrawer(key), hover: (on) => tween(l.scale, { x: l.userData.sx * (on ? 1.12 : 1), y: l.userData.sy * (on ? 1.12 : 1), duration: 0.3 }) };
    l.userData.sx = l.scale.x; l.userData.sy = l.scale.y; register(l, entry); register(m, entry);
    return ring;
  });
  TIMELINE.forEach((t, i) => { const s = label(t.year, '', { h: 0.62 }); s.position.copy(arcCurve.getPoint([0.28, 0.46, 0.62, 0.76][i])).multiplyScalar(1.1); globeInner.add(s);
    register(s, { label: `${t.year} · click`, click: () => { audio.ping(760 + i * 60); toast(`${t.year} · ${t.text}`); } }); });
  // turn the globe so the arc faces the viewer
  const faceDir = new THREE.Vector3(-0.35, 0.25, 1).normalize();
  globeInner.quaternion.setFromUnitVectors(A.clone().add(B).normalize(), faceDir);
  const globeHit = new THREE.Mesh(new THREE.SphereGeometry(R * 1.1, 16, 12), new THREE.MeshBasicMaterial({ visible: false }));
  globe.add(globeHit);
  register(globeHit, { label: 'The journey · open the story', click: () => openDrawer('journey'), hover: (on) => tween(globe.scale, { x: on ? 1.04 : 1, y: on ? 1.04 : 1, z: on ? 1.04 : 1, duration: 0.6 }) });
  // Waving flags planted at both ends of the arc
  const faceLocal = faceDir.clone().applyQuaternion(globeInner.quaternion.clone().invert());
  function plantFlag(canvasEl, pos) {
    const tex = new THREE.CanvasTexture(canvasEl); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const g = new THREE.Group(), n = pos.clone().normalize();
    g.position.copy(pos); g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
    const d = faceLocal.clone().applyQuaternion(g.quaternion.clone().invert()); g.rotateY(Math.atan2(d.x, d.z));
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 2, 6), new THREE.MeshBasicMaterial({ color: 0xd6d9e2 }));
    pole.position.y = 1; g.add(pole);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), new THREE.MeshBasicMaterial({ color: GOLD.clone().multiplyScalar(2) })); knob.position.y = 2.02; g.add(knob);
    const w = 1.3, hgt = w * canvasEl.height / canvasEl.width;
    const geo = new THREE.PlaneGeometry(w, hgt, 28, 14); geo.translate(w / 2, 0, 0);
    const m = new THREE.Mesh(geo, new THREE.ShaderMaterial({
      side: THREE.DoubleSide, uniforms: { uTime: U.uTime, uMap: { value: tex }, uW: { value: w } },
      vertexShader: `uniform float uTime, uW; varying vec2 vUv; varying float vS;
        void main(){ vUv = uv; vec3 p = position; float k = p.x / uW;
          float ph = p.x * 4.6 - uTime * 3.1; p.z += (sin(ph) * 0.1 + sin(p.x * 9. + p.y * 3. - uTime * 4.4) * 0.025) * k; p.y -= k * k * 0.05;
          vS = cos(ph) * k; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.); }`,
      fragmentShader: `uniform sampler2D uMap; varying vec2 vUv; varying float vS;
        void main(){ vec3 c = texture2D(uMap, vUv).rgb; c *= 0.72 + vS * 0.28 + 0.12; gl_FragColor = vec4(c, 1.); }`,
    }));
    m.position.y = 2 - hgt / 2; g.add(m);
    globeInner.add(g);
  }
  plantFlag(ugandaFlag(), A);
  plantFlag(usFlag(), B);

  // Claude's late-media design: attach the postcard once, whenever its photo arrives.
  let postcard = null;
  function addPostcard(im) {
    if (postcard) return;
    const tex = new THREE.Texture(im); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8; tex.needsUpdate = true;
    const pw = 5.2, ph = pw * im.naturalHeight / im.naturalWidth;
    const pcU = { uTime: U.uTime, uMap: { value: tex }, uHover: { value: 0 } };
    postcard = new THREE.Group();
    const card = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), new THREE.ShaderMaterial({ uniforms: pcU, side: THREE.DoubleSide,
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
      fragmentShader: `uniform sampler2D uMap; uniform float uTime, uHover; varying vec2 vUv;
        void main(){ vec3 c = texture2D(uMap, vUv).rgb * (0.86 + uHover * 0.14);
          float e = min(min(vUv.x, 1. - vUv.x), min(vUv.y, 1. - vUv.y));
          c += vec3(0.44, 0.89, 0.84) * (1. - smoothstep(0., 0.012, e)) * (1. + uHover);
          c += vec3(1.) * (1. - smoothstep(0., 0.05, abs(vUv.x - vUv.y * 0.4 - fract(uTime * 0.07) * 1.8 + 0.3))) * 0.06;
          gl_FragColor = vec4(c, 1.); }` }));
    postcard.add(card);
    const pl = label('University of Mary Washington', 'Fredericksburg, VA · 2022 – 2026', { h: 0.8, accent: '#6fe3d6' });
    pl.position.y = ph / 2 + 0.55; postcard.add(pl);
    // world-ish position of the Fredericksburg marker in the globe's own space
    const bLocal = B.clone().applyQuaternion(globeInner.quaternion);
    postcard.position.copy(bLocal).add(new THREE.Vector3(0.4, -3.9, 3.6));
    globe.add(postcard);
    const tether = new THREE.Line(new THREE.BufferGeometry().setFromPoints([bLocal, postcard.position.clone().add(new THREE.Vector3(0, ph / 2, 0))]),
      new THREE.LineDashedMaterial({ color: SIGNAL, dashSize: 0.12, gapSize: 0.1, transparent: true, opacity: 0.7 }));
    tether.computeLineDistances(); globe.add(tether);
    const entry = { label: 'UMW · open campus leadership', click: () => openDrawer('exp:umw'),
      hover: (on) => { tween(pcU.uHover, { value: on ? 1 : 0, duration: 0.4 }); tween(postcard.scale, { x: on ? 1.06 : 1, y: on ? 1.06 : 1, z: 1, duration: 0.5 }); } };
    register(card, entry); linkHover['exp:umw'] = entry.hover;
  }

  // A comet that makes the crossing again and again
  const comet = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfff2d0).multiplyScalar(4) }));
  globeInner.add(comet);
  const TRAIL = 48, trailPos = new Float32Array(TRAIL * 3), trailA = new Float32Array(TRAIL);
  for (let k = 0; k < TRAIL; k++) trailA[k] = 1 - k / TRAIL;
  const trailGeo = new THREE.BufferGeometry(); trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3)); trailGeo.setAttribute('aA', new THREE.BufferAttribute(trailA, 1));
  const trail = new THREE.Points(trailGeo, pointsMat(
    `attribute float aA; uniform float uPR; varying float vA; void main(){ vA = aA; vec4 mv = modelViewMatrix * vec4(position,1.); gl_Position = projectionMatrix * mv; gl_PointSize = min(aA * 30. / -mv.z, 6.) * uPR; }`,
    `varying float vA; void main(){ float d = length(gl_PointCoord - .5); if(d > .5) discard; gl_FragColor = vec4(mix(vec3(0.44,0.89,0.84), vec3(1.,0.85,0.5), vA) * 1.6, (1. - d * 2.) * vA); }`));
  trail.frustumCulled = false; globeInner.add(trail);
  const tmpC = new THREE.Vector3();
  function updateComet(t) {
    const ct = Math.min((t * 0.16) % 1.25, 1), e = ct < 0.5 ? 2 * ct * ct : 1 - Math.pow(-2 * ct + 2, 2) / 2;
    const vis = arcU.uDraw.value >= 0.99 && ct < 1;
    comet.visible = trail.visible = vis;
    if (!vis) return;
    arcCurve.getPoint(e, tmpC); comet.position.copy(tmpC);
    for (let k = 0; k < TRAIL; k++) { arcCurve.getPoint(Math.max(0, e - k * 0.0045), tmpC); trailPos.set([tmpC.x, tmpC.y, tmpC.z], k * 3); }
    trailGeo.attributes.position.needsUpdate = true;
  }

  // Grey crowned crane, Uganda's national bird, circling the globe. Click it.
  const crane = new THREE.Group(); scene.add(crane);
  { const grey = new THREE.MeshStandardMaterial({ color: 0x9aa0ae, roughness: 0.65, flatShading: true });
    const dark = new THREE.MeshStandardMaterial({ color: 0x15171d, roughness: 0.6, flatShading: true });
    const white = new THREE.MeshStandardMaterial({ color: 0xeef0f4, roughness: 0.6, flatShading: true, emissive: 0x222222 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), grey); body.scale.set(0.55, 0.5, 1.15); crane.add(body);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.95, 6), grey); neck.position.set(0, 0.28, 0.78); neck.rotation.x = 1.05; crane.add(neck);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), dark); head.position.set(0, 0.5, 1.2); crane.add(head);
    const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), white); cheek.position.set(0.08, 0.5, 1.22); crane.add(cheek);
    const wattle = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 4), new THREE.MeshBasicMaterial({ color: 0xff3030 })); wattle.position.set(0, 0.4, 1.24); crane.add(wattle);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.3, 5), dark); beak.position.set(0, 0.47, 1.42); beak.rotation.x = Math.PI / 2; crane.add(beak);
    const crownP = new Float32Array(60 * 3); for (let k = 0; k < 60; k++) { const a = Math.random() * Math.PI * 2, r = Math.random() * 0.16; crownP.set([Math.cos(a) * r, 0.66 + Math.random() * 0.12, 1.16 + Math.sin(a) * r], k * 3); }
    const cg = new THREE.BufferGeometry(); cg.setAttribute('position', new THREE.BufferAttribute(crownP, 3));
    crane.add(new THREE.Points(cg, new THREE.PointsMaterial({ color: new THREE.Color(0xfcdc04).multiplyScalar(2.2), size: 0.05 })));
    const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.1, 4), dark); legs.position.set(0, -0.12, -1.05); legs.rotation.x = Math.PI / 2; crane.add(legs);
    crane.userData.wings = [-1, 1].map((sd) => {
      const pivot = new THREE.Group(); pivot.position.set(sd * 0.2, 0.08, 0.1); crane.add(pivot);
      const wing = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.03, 0.72), white); wing.position.x = sd * 0.95; pivot.add(wing);
      const tip = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.035, 0.5), dark); tip.position.x = sd * 1.75; tip.position.z = -0.1; pivot.add(tip);
      pivot.userData.sd = sd; return pivot;
    });
    const craneHit = new THREE.Mesh(new THREE.SphereGeometry(1.8, 8, 6), new THREE.MeshBasicMaterial({ visible: false })); crane.add(craneHit);
    let craneClicks = 0;
    register(craneHit, { label: 'Grey crowned crane · click me', click: () => {
      audio.ping(1180); setTimeout(() => audio.ping(1480), 140);
      const n = craneClicks % UGANDA_FACTS.length; craneClicks++;
      toast(`Uganda fact ${n + 1} of ${UGANDA_FACTS.length} · ${UGANDA_FACTS[n]}`);
      if (n + 1 === 5 || n + 1 === UGANDA_FACTS.length) { // celebrate: a victory loop, a little tune, and my voice
        craneSpin = 1; gsap.fromTo(crane.scale, { x: 0.75, y: 0.75, z: 0.75 }, { x: 1.6, y: 1.6, z: 1.6, duration: 0.8, yoyo: true, repeat: 1, ease: 'power2.inOut' });
        if (audio.on) [587.33, 739.99, 880, 987.77, 1174.66].forEach((f, i) => setTimeout(() => audio.ping(f, 0.12), i * 130));
        setTimeout(() => { playVoice('assets/webale-nnyo.mp3', 'Webale nnyo! Thank you very much.'); toast(n + 1 === 5 ? 'Webale nnyo! Thank you very much. Keep clicking, 10 more facts to go.' : 'You found all 15 facts! Webale nnyo, thank you very much.'); }, 4200);
      }
    } });
    crane.scale.setScalar(0.75);
  }
  const craneNext = new THREE.Vector3();
  const cranePath = (a, out) => out.set(P.journey.x + Math.cos(a) * 12, P.journey.y + 5.5 + Math.sin(a * 2) * 1.2, P.journey.z + Math.sin(a) * 8.5);
  let craneSpin = 0;
  function updateCrane(t) {
    const a = t * 0.22;
    cranePath(a, crane.position); cranePath(a + 0.02, craneNext); crane.lookAt(craneNext);
    crane.rotateZ(-0.25); if (craneSpin > 0) { craneSpin = Math.max(0, craneSpin - 0.012); crane.rotateZ((1 - craneSpin) * Math.PI * 4); }
    crane.userData.wings.forEach((w) => { w.rotation.z = w.userData.sd * Math.sin(t * 5.2) * 0.55; });
  }
  // ---------- Flight replay: 23 hours from Entebbe, collect the dreams on the way ----------
  const plane = new THREE.Group(); plane.visible = false; globeInner.add(plane);
  { const body = new THREE.MeshStandardMaterial({ color: 0xf1f3f8, roughness: 0.35, metalness: 0.3, emissive: 0x333a4a });
    const accent = new THREE.MeshStandardMaterial({ color: 0xe8b54a, roughness: 0.4, emissive: 0x5a4210 });
    const fus = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.42, 4, 10), body); fus.rotation.x = Math.PI / 2; plane.add(fus);
    const wing = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.014, 0.12), body); wing.position.z = 0.02; plane.add(wing);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.012, 0.07), body); tail.position.z = -0.24; plane.add(tail);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.11, 0.08), accent); fin.position.set(0, 0.06, -0.25); plane.add(fin);
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 4), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff5050).multiplyScalar(3) })); light.position.set(-0.31, 0, 0.02); plane.add(light);
    const light2 = light.clone(); light2.material = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x50ff90).multiplyScalar(3) }); light2.position.x = 0.31; plane.add(light2);
    plane.userData.lights = [light, light2]; plane.scale.setScalar(2.4); }
  const dreamOrbs = DREAMS.map((word, i) => {
    const u = [0.16, 0.33, 0.5, 0.67, 0.84][i], p = arcCurve.getPoint(u), out = p.clone().normalize();
    const g = new THREE.Group(); g.position.copy(p).add(out.multiplyScalar(0.55)).add(new THREE.Vector3(0, i % 2 ? 0.35 : -0.35, 0)); g.visible = false; globeInner.add(g);
    const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.13, 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffd47a).multiplyScalar(1.6), transparent: true })); g.add(orb);
    const halo = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.24, 32), new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false })); g.add(halo);
    const tag = label(word, 'dream collected', { h: 0.5 }); tag.position.y = 0.45; tag.material.opacity = 0; g.add(tag);
    const hit = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 6), new THREE.MeshBasicMaterial({ visible: false })); g.add(hit);
    const d = { word, g, orb, halo, tag, got: false };
    register(hit, { label: `Collect “${word}”`, click: () => collectDream(d) });
    return d;
  });
  const flight = { on: false, t0: 0, dur: 23, got: 0 };
  const fh = { hud: $('#flight-hud'), end: $('#flight-end') };
  let flightTimer = 0;
  stopFlight = () => { clearTimeout(flightTimer); flightTimer = 0; endFlight(false); };
  function collectDream(d) {
    if (!flight.on || d.got) return;
    d.got = true; flight.got++; audio.ping(880 + flight.got * 110, 0.14);
    tween(d.orb.scale, { x: 2.2, y: 2.2, z: 2.2, duration: 0.5, ease: 'back.out(3)' }); tween(d.orb.material, { opacity: 0, duration: 0.8, delay: 0.3 });
    tween(d.tag.material, { opacity: 1, duration: 0.4 }); d.halo.visible = false;
    $('#fh-dreams').textContent = `Dreams collected ${flight.got} / ${DREAMS.length}`; toast(`${d.word} ✓`);
  }
  function startFlight() {
    if (flight.on || flightTimer) return;
    endTour(); if (!askPanel.hidden) closeAsk();
    closeDrawer(); hideModal(fh.end); lenis?.start(); goTo('journey');
    flightTimer = setTimeout(() => {
      flightTimer = 0;
      lenis?.stop();
      flight.on = true; flight.t0 = clock.getElapsed(); flight.got = 0;
      dreamOrbs.forEach((d) => { d.got = false; d.g.visible = true; d.orb.scale.setScalar(1); d.orb.material.opacity = 1; d.tag.material.opacity = 0; d.halo.visible = true; });
      plane.visible = true; comet.visible = trail.visible = false; arcU.uDraw.value = 0;
      $('#fh-dreams').textContent = `Dreams collected 0 / ${DREAMS.length}`; fh.hud.hidden = false;
      audio.ping(523.25, 0.1);
    }, 1400);
  }
  function endFlight(landed) {
    if (!flight.on) return;
    flight.on = false; fh.hud.hidden = true; plane.visible = false; arcU.uDraw.value = 1;
    dreamOrbs.forEach((d) => { d.g.visible = false; });
    audio.flight(-1);
    if (!landed) { lenis?.start(); return; }
    audio.arrive();
    const got = dreamOrbs.filter((d) => d.got).map((d) => d.word);
    $('#fe-text').textContent = `${got.length ? `You collected ${got.length} of ${DREAMS.length} dreams: ${got.join(', ')}. ` : ''}In 2022 I spent 23 hours in the air to start a new life in the United States, filled with hope and dreams. That flight led to a first-generation degree, four internships and this site.`;
    showModal(fh.end, $('#fe-again'));
  }
  function updateFlight() {
    if (!flight.on) return;
    const p = Math.min(1, (clock.getElapsed() - flight.t0) / flight.dur), e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
    arcCurve.getPoint(e, tmpC); plane.position.copy(tmpC);
    const nxt = arcCurve.getPoint(Math.min(1, e + 0.01)), up = tmpC.clone().normalize();
    plane.quaternion.setFromRotationMatrix(new THREE.Matrix4().lookAt(nxt, tmpC, up));
    plane.userData.lights.forEach((l, k) => { l.visible = Math.sin(clock.getElapsed() * 6 + k * 3) > 0.3; });
    arcU.uDraw.value = e;
    dreamOrbs.forEach((d, i) => { if (!d.got) { d.orb.rotation.y += 0.03; d.halo.lookAt(camera.position); d.g.position.y += Math.sin(clock.getElapsed() * 2 + i) * 0.0015; } });
    $('#fh-hours').textContent = String(Math.floor(p * 23)).padStart(2, '0');
    $('#fh-km').textContent = `${Math.round(p * 11619).toLocaleString('en-US')} km`;
    audio.flight(p);
    if (p >= 1) endFlight(true);
  }
  document.addEventListener('click', (e) => { if (e.target.closest('[data-flight]')) { e.preventDefault(); startFlight(); } });
  $('#fh-skip').addEventListener('click', () => endFlight(false));
  $('#fe-again').addEventListener('click', () => { hideModal(fh.end); startFlight(); });
  $('#fe-close').addEventListener('click', () => hideModal(fh.end));
  modalDismissal(fh.end, () => hideModal(fh.end));
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && (flight.on || flightTimer)) stopFlight(); });
  await progress(0.45, 'Plotting Uganda → Fredericksburg · 11,619 km');

  /* ================================================================ */
  /* Station 2 — experience towers                                      */
  /* ================================================================ */
  const towerVS = `varying vec2 vUv; varying vec3 vP; void main(){ vUv = uv; vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`;
  const towerFS = `uniform float uTime, uHover, uH, uSeed; uniform vec3 uCol; varying vec2 vUv; varying vec3 vP;
    void main(){ float e = min(min(vUv.x, 1. - vUv.x), min(vUv.y, 1. - vUv.y));
      float edge = (1. - smoothstep(0., 0.035, e));
      float y = vP.y / uH + 0.5;
      float floors = (1. - smoothstep(0., 0.08, abs(fract(y * uH * 1.2) - 0.5) - 0.42)) * 0.12;
      float wx = step(0.3, fract(vUv.x * 4.)) * step(fract(vUv.x * 4.), 0.7);
      float win = wx * step(0.5, fract(sin(floor(y * uH * 1.2) * 12.9898 + floor(vUv.x * 4.) * 78.233 + uSeed) * 43758.5453)) * 0.18;
      float band = (1. - smoothstep(0., 0.06, abs(y - fract(uTime * 0.12 + uSeed))));
      vec3 c = vec3(0.025, 0.04, 0.1) + uCol * (edge * (0.9 + uHover * 1.6) + floors + win * (0.6 + uHover) + band * (0.5 + uHover));
      gl_FragColor = vec4(c, 1.); }`;
  const towers = EXPERIENCE.map((e, i) => {
    const h = e.height, g = new THREE.Group();
    const x = P.experience.x - 8 + i * 4, z = P.experience.z + (i % 2 ? -2.5 : 1.5);
    g.position.set(x, -4, z);
    const u = { uTime: U.uTime, uHover: { value: 0 }, uH: { value: h }, uSeed: { value: i * 0.21 }, uCol: { value: (i % 2 ? SIGNAL : GOLD).clone() } };
    const m = new THREE.Mesh(new THREE.BoxGeometry(1.7, h, 1.7), new THREE.ShaderMaterial({ uniforms: u, vertexShader: towerVS, fragmentShader: towerFS }));
    m.position.y = h / 2; g.add(m);
    const cap = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), new THREE.MeshBasicMaterial({ color: u.uCol.value.clone().multiplyScalar(2) }));
    cap.position.y = h + 0.8; g.add(cap);
    const l = label(e.org, e.when, { h: 0.8 }); l.position.y = h + 1.9; g.add(l);
    scene.add(g);
    const entry = {
      label: `${e.org} · open role`,
      hover: (on) => { tween(u.uHover, { value: on ? 1 : 0, duration: 0.4 }); tween(g.position, { y: on ? -3.6 : -4, duration: 0.6, ease: 'power3.out' }); },
      click: () => openDrawer(`exp:${e.id}`),
    };
    register(m, entry); linkHover[`exp:${e.id}`] = entry.hover;
    return { g, cap };
  });
  await progress(0.58, 'Raising five experience towers');

  /* ================================================================ */
  /* Station 3 — ProofMode sealed document + RAG shard spiral           */
  /* ================================================================ */
  const proof = new THREE.Group(); proof.position.copy(P.projects); proof.rotation.y = -0.35; scene.add(proof);
  const docU = { uTime: U.uTime, uHover: { value: 0 } };
  const doc = new THREE.Mesh(new THREE.BoxGeometry(3.2, 4.2, 0.1), new THREE.ShaderMaterial({ uniforms: docU,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
    fragmentShader: `uniform float uTime, uHover; varying vec2 vUv;
      float hash(float n){ return fract(sin(n) * 43758.5453); }
      void main(){ float rows = 24.; float r = floor(vUv.y * rows); float fy = fract(vUv.y * rows);
        float len = 0.3 + 0.55 * hash(r + 3.);
        float bar = step(0.35, fy) * step(fy, 0.65) * step(0.12, vUv.x) * step(vUv.x, 0.12 + len * 0.76) * step(2., r) * step(r, rows - 4.);
        float title = step(rows - 3., r) * step(r, rows - 2.) * step(0.12, vUv.x) * step(vUv.x, 0.6) * step(0.25, fy);
        float scan = fract(1. - uTime * 0.12);
        float sealed = step(scan, vUv.y);
        float sl = (1. - smoothstep(0., 0.012, abs(vUv.y - scan)));
        float e = min(min(vUv.x, 1. - vUv.x), min(vUv.y, 1. - vUv.y)); float edge = (1. - smoothstep(0., 0.018, e));
        vec3 paper = vec3(0.035, 0.05, 0.12);
        vec3 ink = mix(vec3(0.45, 0.5, 0.68), vec3(0.91, 0.71, 0.29), sealed);
        vec3 c = paper + ink * (bar * 0.55 + title * 0.9) + vec3(0.44, 0.89, 0.84) * sl * 1.8 + vec3(0.91, 0.71, 0.29) * edge * (1. + uHover);
        gl_FragColor = vec4(c, 1.); }`,
  }));
  proof.add(doc);
  const seal = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.72, 6), new THREE.MeshBasicMaterial({ color: GOLD.clone().multiplyScalar(2), side: THREE.DoubleSide }));
  seal.position.set(1.15, -1.5, 0.12); proof.add(seal);
  const seal2 = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.46, 6), new THREE.MeshBasicMaterial({ color: GOLD.clone().multiplyScalar(1.5), side: THREE.DoubleSide }));
  seal2.position.copy(seal.position); proof.add(seal2);
  const checkRing = new THREE.Group(); checkRing.rotation.x = 1.2; proof.add(checkRing);
  checkRing.add(new THREE.Mesh(new THREE.TorusGeometry(3, 0.008, 6, 200), new THREE.MeshBasicMaterial({ color: SIGNAL, transparent: true, opacity: 0.6 })));
  for (let i = 0; i < 10; i++) { const c = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), new THREE.MeshBasicMaterial({ color: SIGNAL.clone().multiplyScalar(1.8) })); const a = (i / 10) * Math.PI * 2; c.position.set(Math.cos(a) * 3, Math.sin(a) * 3, 0); checkRing.add(c); }
  // The live app floats in front of the sealed proof it produces
  const screenU = { uTime: U.uTime, uHover: docU.uHover, uMap: { value: null } };
  function addProofScreen(im) {
    if (screenU.uMap.value) return;
    const W = 1400, H = Math.round(W * im.naturalHeight / im.naturalWidth), bar = 56;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H + bar; const x = cv.getContext('2d');
    x.fillStyle = '#0b1128'; x.fillRect(0, 0, W, bar);
    ['#ff5f57', '#febc2e', '#28c840'].forEach((c, i) => { x.fillStyle = c; x.beginPath(); x.arc(32 + i * 28, bar / 2, 8, 0, Math.PI * 2); x.fill(); });
    x.fillStyle = '#1a2350'; x.beginPath(); x.roundRect(150, 12, W - 300, bar - 24, 14); x.fill();
    x.fillStyle = '#9aa5c2'; x.font = '500 22px "IBM Plex Mono", monospace'; x.textBaseline = 'middle'; x.fillText('proofmode · live app', 176, bar / 2);
    x.drawImage(im, 0, bar, W, H);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8; screenU.uMap.value = tex;
    const sw = 4.6, sh = sw * cv.height / cv.width;
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), new THREE.ShaderMaterial({ uniforms: screenU, side: THREE.DoubleSide,
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
      fragmentShader: `uniform sampler2D uMap; uniform float uTime, uHover; varying vec2 vUv;
        void main(){ vec3 c = texture2D(uMap, vUv).rgb * 0.82;
          c *= 0.94 + 0.06 * sin(vUv.y * 700.);
          float e = min(min(vUv.x, 1. - vUv.x), min(vUv.y, 1. - vUv.y)); c += vec3(0.44, 0.89, 0.84) * (1. - smoothstep(0., 0.01, e)) * (0.8 + uHover);
          c += vec3(0.44, 0.89, 0.84) * (1. - smoothstep(0., 0.02, abs(vUv.y - fract(uTime * 0.09)))) * 0.12;
          gl_FragColor = vec4(c, 1.); }` }));
    screen.position.set(-1.7, -0.7, 1.2); screen.rotation.y = 0.3; proof.add(screen);
    doc.position.set(1.5, 0.7, -0.6); seal.position.set(2.65, -0.8, -0.48); seal2.position.copy(seal.position);
    checkRing.position.copy(doc.position);
    proofHit.scale.x = 7.4 / 3.6;
  }
  const proofLabel = label('ProofMode', '2nd Place · UMW Eagle Egg Pitch'); proofLabel.position.set(0, 3.4, 0); proof.add(proofLabel);
  const proofHit = new THREE.Mesh(new THREE.BoxGeometry(3.6, 5.2, 2.6), new THREE.MeshBasicMaterial({ visible: false })); proof.add(proofHit);
  const proofEntry = { label: 'ProofMode · open case study', click: () => openDrawer('proj:proofmode'),
    hover: (on) => { tween(docU.uHover, { value: on ? 1 : 0, duration: 0.4 }); tween(proof.rotation, { y: on ? -0.15 : -0.35, duration: 0.8 }); } };
  register(proofHit, proofEntry); linkHover['proj:proofmode'] = proofEntry.hover;

  const rag = new THREE.Group(); rag.position.set(P.projects.x + 7.5, -0.6, P.projects.z - 8); scene.add(rag);
  const shardGeo = new THREE.PlaneGeometry(0.8, 1.05);
  const shards = [];
  for (let i = 0; i < 44; i++) {
    const m = new THREE.Mesh(shardGeo, new THREE.MeshBasicMaterial({ color: SIGNAL, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    const a = i * 0.5, y = i * 0.14 - 3; m.userData = { a, y, r: 2.3, out: 0 };
    m.position.set(Math.cos(a) * 2.3, y, Math.sin(a) * 2.3); m.lookAt(0, y, 0);
    rag.add(m); shards.push(m);
    const ed = new THREE.LineSegments(new THREE.EdgesGeometry(shardGeo), new THREE.LineBasicMaterial({ color: SIGNAL, transparent: true, opacity: 0.35 })); m.add(ed);
  }
  const query = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), new THREE.MeshBasicMaterial({ color: GOLD.clone().multiplyScalar(2.2) }));
  query.position.set(0, 4, 0); rag.add(query);
  const beamGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const beam = new THREE.Line(beamGeo, new THREE.LineBasicMaterial({ color: GOLD, transparent: true, opacity: 0.9 })); rag.add(beam);
  const ragLabel = label('Emergency Alerting RAG', 'NCUR 2026 · Pinecone', { accent: '#6fe3d6' }); ragLabel.position.set(0, 5.2, 0); rag.add(ragLabel);
  const ragHit = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 8, 12), new THREE.MeshBasicMaterial({ visible: false })); ragHit.position.y = 0.5; rag.add(ragHit);
  let ragHover = 0;
  const ragEntry = { label: 'RAG research · open case study', click: () => openDrawer('proj:rag'), hover: (on) => { ragHover = on ? 1 : 0; } };
  register(ragHit, ragEntry); linkHover['proj:rag'] = ragEntry.hover;
  await progress(0.7, 'Sealing ProofMode · indexing RAG shards');

  /* ================================================================ */
  /* Station 4 — five live demo pedestals                               */
  /* ================================================================ */
  const demoGroup = new THREE.Group(); demoGroup.position.copy(P.demos); scene.add(demoGroup);
  const gems = DEMOS.map((d, i) => {
    const a = THREE.MathUtils.degToRad(-64 + i * 32), col = new THREE.Color(d.color);
    const g = new THREE.Group(); g.position.set(Math.sin(a) * 6.2, 0, -Math.cos(a) * 6.2 + 4); demoGroup.add(g);
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.95, 3.2, 6), new THREE.MeshStandardMaterial({ color: 0x0c1330, metalness: 0.75, roughness: 0.3, emissive: col, emissiveIntensity: 0.05, flatShading: true }));
    ped.position.y = -1.4; g.add(ped);
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.02, 6, 64), new THREE.MeshBasicMaterial({ color: col.clone().multiplyScalar(2) }));
    halo.rotation.x = Math.PI / 2; halo.position.y = 0.22; g.add(halo);
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.62, 0), new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 1.4, metalness: 0.2, roughness: 0.25, flatShading: true }));
    gem.position.y = 1.4; g.add(gem);
    if (HIGH()) { const pl = new THREE.PointLight(col, 8, 9, 1.6); pl.position.y = 1.4; g.add(pl); }
    const l = label(d.name, `${d.agent} · ${d.vertical}`, { accent: `#${col.getHexString()}`, h: 0.62 }); l.position.y = 2.8 + (i % 2) * 0.8; g.add(l);
    const hit = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 5.4, 8), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = 0; g.add(hit);
    const entry = { label: `${d.agent} · ${d.name}`, click: () => openDrawer(`demo:${d.id}`),
      hover: (on) => { tween(gem.scale, { x: on ? 1.35 : 1, y: on ? 1.35 : 1, z: on ? 1.35 : 1, duration: 0.5, ease: 'back.out(2)' }); tween(gem.material, { emissiveIntensity: on ? 2.6 : 1.4, duration: 0.4 }); } };
    register(hit, entry); linkHover[`demo:${d.id}`] = entry.hover;
    return { gem, halo, i };
  });
  await progress(0.8, 'Waking Aria, Scout, Luna, Rex and Vera');

  /* ================================================================ */
  /* Station 5 — skill constellation                                    */
  /* ================================================================ */
  const cons = new THREE.Group(); cons.position.copy(P.skills); scene.add(cons);
  const catCols = [GOLD, SIGNAL, new THREE.Color(0x8fa8ff), new THREE.Color(0xc59bff), new THREE.Color(0xff9d7a)];
  const CATS = Object.keys(SKILLS);
  const catCenters = CATS.map((_, ci) => { const a = -Math.PI / 2 + Math.PI + (ci / CATS.length) * Math.PI * 2; return new THREE.Vector3(Math.cos(a) * 7.6, Math.sin(a) * 4.1 + 0.2, 0); });
  const catDirs = catCenters.map((c) => c.clone().normalize());
  const nodes = [];
  const goldenA = Math.PI * (3 - Math.sqrt(5));
  Object.entries(SKILLS).forEach(([cat, list], ci) => list.forEach((name, j) => {
    const rr = 0.55 + Math.sqrt(j) * 0.72, ang = j * goldenA;
    const v = catCenters[ci].clone().add(new THREE.Vector3(Math.cos(ang) * rr * 1.25, Math.sin(ang) * rr * 0.8, Math.sin(j * 1.7) * 0.8));
    nodes.push({ name, ci, pos: v });
  }));
  const idx = Object.fromEntries(nodes.map((n, i) => [n.name, i]));
  const edges = [];
  nodes.forEach((n, i) => {
    const near = nodes.map((m, j) => [j, m.ci === n.ci && j !== i ? n.pos.distanceTo(m.pos) : Infinity]).sort((a, b) => a[1] - b[1]).slice(0, 2);
    near.forEach(([j]) => { if (!edges.some(([a, b]) => (a === j && b === i))) edges.push([i, j]); });
  });
  [['RAG Pipelines', 'Pinecone'], ['RAG Pipelines', 'Embeddings'], ['ChromaDB', 'Embeddings'], ['Claude API', 'MCP'], ['FastAPI', 'Claude API'], ['Python', 'FastAPI'], ['Python', 'PySpark'],
    ['AWS Bedrock', 'Ollama'], ['Docker', 'Railway'], ['PII/PHI Redaction', 'PostgreSQL'], ['LLM Evaluation', 'Statistics'], ['Mentorship', 'Leadership'], ['Stakeholder Comms', 'Power BI'], ['Agentic AI', 'MCP']]
    .forEach(([a, b]) => { if (a in idx && b in idx) edges.push([idx[a], idx[b]]); });
  // Co-usage graph: two skills link when I used them in the same role or project
  nodes.forEach((n) => { n.uses = new Set(skillUses(n.name).map((u) => u.key)); });
  const neighborsOf = (i) => {
    const n = nodes[i];
    let out = nodes.map((_, j) => j).filter((j) => j !== i && [...nodes[j].uses].some((k) => n.uses.has(k)));
    if (!out.length) out = nodes.map((_, j) => j).filter((j) => j !== i && nodes[j].ci === n.ci);
    return out;
  };
  const nodeMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.26, 2), new THREE.MeshBasicMaterial({ color: 0xffffff }), nodes.length);
  nodeMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); nodeMesh.frustumCulled = false;
  const dummy = new THREE.Object3D(), tmpCol = new THREE.Color(), labelOff = new THREE.Vector3();
  const baseCols = nodes.map((n) => catCols[n.ci].clone().multiplyScalar(1.15));
  nodes.forEach((n, i) => { dummy.position.copy(n.pos); dummy.updateMatrix(); nodeMesh.setMatrixAt(i, dummy.matrix); nodeMesh.setColorAt(i, baseCols[i]); });
  cons.add(nodeMesh);
  const N = nodes.length, livePos = nodes.map((n) => n.pos.clone());
  const cur = { lift: new Float32Array(N), scl: new Float32Array(N).fill(1), bright: new Float32Array(N).fill(1), pull: new Float32Array(N) };
  const tgt = { lift: new Float32Array(N), scl: new Float32Array(N).fill(1), bright: new Float32Array(N).fill(1), pull: new Float32Array(N) };
  // Thick screen-space lines so connections stay visible at any distance
  // Buffers are sized once: three caches the instance count on first draw, so they are updated in place.
  const mkLine = (w, op, segs) => { const m = new LineMaterial({ linewidth: w, vertexColors: true, transparent: true, opacity: op, depthWrite: false }); m.resolution.set(innerWidth, innerHeight); lineMats.push(m); const g = new LineSegmentsGeometry(); g.setPositions(new Float32Array(segs * 6)); g.setColors(new Float32Array(segs * 6)); const l = new LineSegments2(g, m); l.frustumCulled = false; cons.add(l); return l; };
  const updLine = (l, pos, col) => { const a = l.geometry.attributes.instanceStart.data, c = l.geometry.attributes.instanceColorStart.data; a.array.fill(0); a.array.set(pos); a.needsUpdate = true; c.array.fill(0); c.array.set(col); c.needsUpdate = true; };
  const baseLines = mkLine(1.6, 0.7, edges.length), focusLines = mkLine(2.6, 0, N);
  const basePos = new Float32Array(edges.length * 6), baseCol = new Float32Array(edges.length * 6);
  const nodeLabels = nodes.map((n) => { const s = label(n.name, '', { h: 0.42 }); s.material.opacity = 0.92; s.userData.base = s.scale.clone(); cons.add(s); return s; });
  CATS.forEach((cat, ci) => { const s = label(cat, `${SKILLS[cat].length} skills`, { h: 0.78, accent: `#${catCols[ci].getHexString()}` }); s.position.copy(catCenters[ci]).add(new THREE.Vector3(0, catCenters[ci].y >= 0 ? 3.1 : -3.1, 0.6)); cons.add(s); });
  // Strengths at the heart of the constellation
  { const s = label('CliftonStrengths', STRENGTHS.map((x) => x.name).join(' · '), { h: 0.72 }); s.position.set(0, 0.3, 0.8); cons.add(s);
    register(s, { label: 'My Top 5 strengths · open', click: () => openDrawer('strengths:all') }); }
  let consFocus = -1, consHover = -1, focusNbrs = [], graphDirty = true;
  const center = new THREE.Vector3(0, 0.4, 0);
  function writeGraph() {
    nodes.forEach((n, i) => {
      livePos[i].copy(n.pos).lerp(center, cur.pull[i]); livePos[i].z += cur.lift[i];
      dummy.position.copy(livePos[i]); dummy.scale.setScalar(cur.scl[i]); dummy.updateMatrix(); nodeMesh.setMatrixAt(i, dummy.matrix);
      nodeMesh.setColorAt(i, tmpCol.copy(baseCols[i]).multiplyScalar(cur.bright[i]));
      const L = nodeLabels[i], k = 0.7 + cur.scl[i] * 0.3;
      L.visible = innerWidth > 1100 && consFocus < 0;
      L.position.copy(livePos[i]).add(labelOff.set(0, 0.3 + 0.26 * cur.scl[i], 0.05)); L.scale.copy(L.userData.base).multiplyScalar(k);
      L.material.opacity = starEls.has(i) ? 0 : Math.min(1, 0.1 + cur.bright[i] * 0.85);
    });
    nodeMesh.instanceMatrix.needsUpdate = true; nodeMesh.instanceColor.needsUpdate = true;
    edges.forEach(([a, b], k) => {
      basePos.set([livePos[a].x, livePos[a].y, livePos[a].z, livePos[b].x, livePos[b].y, livePos[b].z], k * 6);
      const hot = consHover >= 0 && (a === consHover || b === consHover);
      const sc = consFocus >= 0 ? 0.08 : hot ? 1 : 0.55, ca = catCols[nodes[a].ci], cb = catCols[nodes[b].ci];
      baseCol.set([ca.r * sc, ca.g * sc, ca.b * sc, cb.r * sc, cb.g * sc, cb.b * sc], k * 6);
    });
    updLine(baseLines, basePos, baseCol);
    if (consFocus >= 0 && focusNbrs.length) {
      const fp = [], fc = [], c0 = catCols[nodes[consFocus].ci], p0 = livePos[consFocus];
      focusNbrs.forEach((j) => { const p1 = livePos[j], c1 = catCols[nodes[j].ci]; fp.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z); fc.push(c0.r, c0.g, c0.b, c1.r * 0.95, c1.g * 0.95, c1.b * 0.95); });
      updLine(focusLines, fp, fc);
    }
  }
  const card = $('#skill-card'), starLayer = $('#star-labels'), starEls = new Map(), projV = new THREE.Vector3();
  let lastLabels = 0;
  function placeStarLabels() {
    const now = performance.now(); if (now - lastLabels < 100) return; lastLabels = now;
    const obstacles = [...document.querySelectorAll('.hud-top, #experience-controls, #skills .panel, #skill-card, #ask:not([hidden]), #tour:not([hidden])')]
      .filter((el) => !el.hidden && el.getClientRects().length)
      .map((el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
    const labels = [];
    starEls.forEach((el, j) => {
      projV.copy(livePos[j]); cons.localToWorld(projV); projV.project(camera);
      el.style.opacity = '0';
      labels.push({ id: j, x: (projV.x + 1) / 2 * innerWidth, y: (1 - projV.y) / 2 * innerHeight, width: el.offsetWidth, height: el.offsetHeight, behind: projV.z > 1 || projV.z < -1 });
    });
    placeLabels(labels, obstacles, { width: innerWidth, height: innerHeight }, innerWidth <= 720 ? 3 : 7).forEach(({ id, x, y }) => {
      const el = starEls.get(id); el.style.opacity = '1'; el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    });
  }
  function setFocus(i) {
    consFocus = i; focusNbrs = i >= 0 ? neighborsOf(i) : [];
    const nb = new Set(focusNbrs);
    for (let j = 0; j < N; j++) {
      const f = j === i, m = nb.has(j), none = i < 0;
      tgt.lift[j] = none ? 0 : f ? 3.5 : m ? 1.8 : -2; tgt.scl[j] = none ? 1 : f ? 1.7 : m ? 1.2 : 0.6;
      tgt.bright[j] = none ? 1 : f ? 1.05 : m ? 0.95 : 0.12; tgt.pull[j] = none ? 0 : f ? 0.45 : m ? 0.12 : 0;
    }
    graphDirty = true;
    starLayer.innerHTML = ''; starEls.clear();
    if (i >= 0) [i, ...focusNbrs].forEach((j) => {
      const el = document.createElement('span'); el.className = j === i ? 'star-label main' : 'star-label';
      el.style.setProperty('--c', `#${catCols[nodes[j].ci].getHexString()}`); el.textContent = nodes[j].name; starLayer.append(el); starEls.set(j, el);
    });
    if (i < 0) { card.hidden = true; return; }
    const n = nodes[i], uses = skillUses(n.name);
    $('#sc-cat').textContent = CATS[n.ci]; $('#sc-name').textContent = n.name;
    $('#sc-text').textContent = `Linked to ${focusNbrs.length} skills${uses.length ? ` through ${uses.map((u) => u.name).join(', ')}` : ` in ${CATS[n.ci]}`}.`;
    $('#sc-open').dataset.open = `skill:${n.name}`; card.hidden = false;
  }
  $('#sc-clear').addEventListener('click', () => setFocus(-1));
  onMissClick = () => { if (consFocus >= 0) setFocus(-1); };
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && consFocus >= 0 && !drawer.classList.contains('open')) setFocus(-1); });
  function stepGraph(dt) {
    const k = reduced ? 1 : 1 - Math.exp(-dt * 7); let moving = false;
    for (const key of ['lift', 'scl', 'bright', 'pull']) for (let j = 0; j < N; j++) { const d = tgt[key][j] - cur[key][j]; if (Math.abs(d) > 0.002) { cur[key][j] += d * k; moving = true; } else cur[key][j] = tgt[key][j]; }
    focusLines.material.opacity += ((consFocus >= 0 ? 1 : 0) - focusLines.material.opacity) * k;
    if (moving || graphDirty) { writeGraph(); graphDirty = false; }
    if (starEls.size) placeStarLabels();
  }
  const leaveSkills = () => { if (consFocus >= 0) setFocus(-1); };
  onLeaveSkills = leaveSkills;
  register(nodeMesh, {
    instanced: true,
    label: (hit) => { const n = nodes[hit.instanceId]; return consFocus === hit.instanceId ? `${n.name} · click for details` : `${n.name} · click to see connections`; },
    hover: (on, hit) => { consHover = on ? hit.instanceId : -1; graphDirty = true; },
    click: (hit) => {
      const i = hit.instanceId; audio.ping(600 + nodes[i].ci * 120);
      if (consFocus === i) openDrawer(`skill:${nodes[i].name}`); else setFocus(i);
    },
  });
  await progress(0.88, 'Linking the skill constellation');

  /* ================================================================ */
  /* Station 6 — community: Habitat builds on a US dot map              */
  /* ================================================================ */
  const comm = new THREE.Group(); comm.position.copy(P.community); comm.rotation.x = -0.95; scene.add(comm);
  const MS = 1 / 40, mp = (key) => new THREE.Vector3(US_PINS[key][0] * MS, -US_PINS[key][1] * MS, 0);
  { const pos = [], col = [], pal = [new THREE.Color(0x5a70c0), new THREE.Color(0xf2b655), new THREE.Color(0xff9d7a), new THREE.Color(0x6fe3d6), new THREE.Color(0xa9bcff)];
    for (let k = 0; k < US_DOTS.length; k += 3) { pos.push(US_DOTS[k] * MS, -US_DOTS[k + 1] * MS, 0); const c = pal[US_DOTS[k + 2]], m = US_DOTS[k + 2] ? 2.2 : 1; col.push(c.r * m, c.g * m, c.b * m); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    comm.add(new THREE.Points(g, new THREE.PointsMaterial({ vertexColors: true, size: 0.16, transparent: true, opacity: 1, depthWrite: false }))); }
  const home = mp('home');
  { const r = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.3, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xa9bcff).multiplyScalar(2), side: THREE.DoubleSide, transparent: true }));
    r.position.copy(home).setZ(0.02); comm.add(r);
    const l = label('Home · Fredericksburg, VA', 'every trip starts here', { h: 0.7, accent: '#a9bcff' }); l.position.copy(home).add(new THREE.Vector3(2.8, 1.4, 1.4)); comm.add(l); }
  const buildPins = COMMUNITY.builds.map((b, i) => {
    const p = mp(b.pin), g = new THREE.Group(); g.position.copy(p); comm.add(g);
    const col = b.year === '2026' ? GOLD.clone() : SIGNAL.clone();
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.4, 8), new THREE.MeshBasicMaterial({ color: col.clone().multiplyScalar(1.6), transparent: true, opacity: 0.85 }));
    beam.rotation.x = Math.PI / 2; beam.position.z = 1.2; g.add(beam);
    const head = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), new THREE.MeshBasicMaterial({ color: col.clone().multiplyScalar(2.4) })); head.position.z = 2.45; g.add(head);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.18, 0.26, 32), new THREE.MeshBasicMaterial({ color: col, transparent: true, side: THREE.DoubleSide, depthWrite: false })); ring.position.z = 0.02; g.add(ring);
    const side = { ws: [-2.2, 0.5], ftl: [2.2, 0], gc: [2.4, 0.3], avery: [-2.6, -0.4] }[b.id] || [2, 0];
    const l = label(`${b.year} · ${b.city}, ${b.state}`, b.role, { h: 0.66, accent: `#${col.getHexString()}` }); l.position.set(side[0], side[1], 2.9); g.add(l);
    // road-trip arc from home
    const mid = home.clone().lerp(p, 0.5); mid.z = 1.6 + home.distanceTo(p) * 0.18;
    const curve = new THREE.QuadraticBezierCurve3(home.clone(), mid, p.clone());
    const arc = new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(48)), new THREE.LineDashedMaterial({ color: col, dashSize: 0.18, gapSize: 0.12, transparent: true, opacity: 0.9 }));
    arc.computeLineDistances(); comm.add(arc);
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), new THREE.MeshBasicMaterial({ color: col.clone().multiplyScalar(3) })); comm.add(dot);
    const hit = new THREE.Mesh(new THREE.SphereGeometry(0.8, 8, 6), new THREE.MeshBasicMaterial({ visible: false })); hit.position.z = 2.3; g.add(hit);
    const entry = { label: `${b.year} · ${b.city} · open`, click: () => openDrawer(`build:${b.id}`),
      hover: (on) => tween(head.scale, { x: on ? 1.6 : 1, y: on ? 1.6 : 1, z: on ? 1.6 : 1, duration: 0.4, ease: 'back.out(2)' }) };
    register(hit, entry); register(l, entry); linkHover[`build:${b.id}`] = entry.hover;
    return { head, ring, curve, dot, i };
  });
  { const l = label('4 builds · 3 states · 12 homes', 'Habitat for Humanity · 2023 – 2026', { h: 0.8 }); l.position.set(-2, 5.6, 1.2); comm.add(l);
    register(l, { label: 'Open the community story', click: () => openDrawer('community:all') }); }
  // Easter egg: type "habitat" and 12 little homes rise on the map, three per build
  const houses = [];
  { const wall = new THREE.MeshStandardMaterial({ color: 0xf4efe6, roughness: 0.8, emissive: 0x2a2620 });
    const roof = new THREE.MeshStandardMaterial({ color: 0xc8553d, roughness: 0.7, emissive: 0x3a120a });
    COMMUNITY.builds.forEach((b) => { const base = mp(b.pin); for (let k = 0; k < 3; k++) {
      const h = new THREE.Group(); h.userData.big = 2.2; const w = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.3), wall); w.position.z = 0.15; h.add(w);
      const r = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.22, 4), roof); r.rotation.x = Math.PI / 2; r.rotation.y = Math.PI / 4; r.position.z = 0.41; h.add(r);
      const a = (k / 3) * Math.PI * 2 + 0.6; h.position.copy(base).add(new THREE.Vector3(Math.cos(a) * 0.85, Math.sin(a) * 0.85, 0)); h.scale.setScalar(0.001); h.visible = false; comm.add(h); houses.push(h);
    } }); }
  onHabitatEgg = () => houses.forEach((h, i) => { h.visible = true; gsap.fromTo(h.scale, { x: 0.001, y: 0.001, z: 0.001 }, { x: 1.3, y: 1.3, z: 1.3, duration: reduced ? 0 : 0.7, delay: reduced ? 0 : i * 0.12, ease: 'back.out(2.5)', onStart: () => audio.ping(660 + (i % 4) * 110, 0.06) }); });
  function updateCommunity(t) {
    buildPins.forEach(({ head, ring, curve, dot, i }) => {
      if (!reduced) head.rotation.z += 0.02;
      const s = 1 + ((t * 0.7 + i * 0.3) % 1) * 1.8; ring.scale.setScalar(s); ring.material.opacity = 1 - ((t * 0.7 + i * 0.3) % 1);
      curve.getPoint((t * 0.22 + i * 0.25) % 1, dot.position);
    });
  }

  /* ================================================================ */
  /* Station 7 — first light                                             */
  /* ================================================================ */
  const sun = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending, uniforms: U,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
    fragmentShader: `uniform float uDawn; varying vec2 vUv; void main(){ float d = length(vUv - .5) * 2.;
      float disc = (1. - smoothstep(0.19, 0.2, d)); float glow = pow(max(1. - d, 0.), 3.) * 0.8;
      vec3 c = vec3(1.0, 0.72, 0.38) * disc * 1.1 + vec3(0.9, 0.45, 0.2) * glow * 0.35; gl_FragColor = vec4(c * uDawn, 1.); }`,
  }));
  sun.position.copy(SUN_POS); scene.add(sun);
  const ridge = new THREE.Mesh(new THREE.PlaneGeometry(1800, 160), new THREE.ShaderMaterial({
    transparent: true, fog: false, uniforms: U,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
    fragmentShader: `${NOISE} uniform float uDawn; varying vec2 vUv; void main(){
      float h1 = 0.22 + snoise(vec3(vUv.x * 7., 0., 0.)) * 0.08 + snoise(vec3(vUv.x * 23., 1., 0.)) * 0.025;
      float h2 = 0.14 + snoise(vec3(vUv.x * 11., 5., 0.)) * 0.06;
      float a1 = step(vUv.y, h1), a2 = step(vUv.y, h2);
      float rim = (1. - smoothstep(0., 0.012, abs(vUv.y - h1))) * uDawn;
      vec3 far = mix(vec3(0.04,0.06,0.15), vec3(0.28,0.16,0.2), uDawn), near = mix(vec3(0.02,0.03,0.08), vec3(0.1,0.06,0.1), uDawn);
      vec3 c = mix(far, near, a2) + vec3(1.,0.6,0.3) * rim * 0.8;
      gl_FragColor = vec4(c, max(a1, rim)); }`,
  }));
  ridge.position.set(0, 57, -560); scene.add(ridge);
  // Portrait hologram starts as a monogram; late media repaints the same texture.
  const holoCanvas = document.createElement('canvas'); holoCanvas.width = 640; holoCanvas.height = 800;
  { const x = holoCanvas.getContext('2d');
      const g = x.createRadialGradient(320, 360, 40, 320, 400, 420); g.addColorStop(0, '#1b2a5c'); g.addColorStop(1, '#060a17');
      x.fillStyle = g; x.fillRect(0, 0, 640, 800);
      x.strokeStyle = 'rgba(232,181,74,0.8)'; x.lineWidth = 3; x.beginPath(); x.arc(320, 380, 190, 0, Math.PI * 2); x.stroke();
      x.fillStyle = '#eef1f8'; x.font = '800 210px "Bricolage Grotesque", system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('AK', 320, 392);
    }
  const holoTex = new THREE.CanvasTexture(holoCanvas); holoTex.colorSpace = THREE.SRGBColorSpace;
  function paintHolo(im) {
    const x = holoCanvas.getContext('2d'), sc = Math.max(640 / im.naturalWidth, 800 / im.naturalHeight), w = im.naturalWidth * sc, h = im.naturalHeight * sc;
    x.drawImage(im, (640 - w) / 2, 0, w, h); holoTex.needsUpdate = true;
  }
  const holoU = { uTime: U.uTime, uDawn: U.uDawn, uMap: { value: holoTex }, uHover: { value: 0 } };
  const holo = new THREE.Group(); holo.position.copy(P.contact); scene.add(holo);
  const holoPlane = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 4.25, 1, 1), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: holoU,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
    fragmentShader: `uniform sampler2D uMap; uniform float uTime, uHover, uDawn; varying vec2 vUv;
      float h(float n){ return fract(sin(n) * 43758.5453); }
      void main(){
        vec2 uv = vUv; float glitch = uHover * step(0.97, h(floor(uTime * 9.) + floor(uv.y * 40.)));
        uv.x += glitch * (h(floor(uv.y * 40.) + uTime) - .5) * 0.04;
        float sp = 0.004 + uHover * 0.01;
        vec3 c = vec3(texture2D(uMap, uv + vec2(sp, 0.)).r, texture2D(uMap, uv).g, texture2D(uMap, uv - vec2(sp, 0.)).b);
        float scan = 0.82 + 0.18 * sin(uv.y * 520. - uTime * 6.);
        float band = (1. - smoothstep(0., 0.03, abs(uv.y - fract(uTime * 0.18)))) * 0.35;
        float e = min(min(uv.x, 1. - uv.x), min(uv.y, 1. - uv.y));
        float edge = (1. - smoothstep(0., 0.012, e));
        float fade = smoothstep(0., 0.25, uv.y);
        vec3 tint = mix(vec3(0.6, 0.95, 0.92), vec3(1.0, 0.86, 0.66), uDawn);
        vec3 col = c * tint * scan * 1.05 + tint * band + vec3(0.91, 0.71, 0.29) * edge * 1.4;
        gl_FragColor = vec4(col, (0.9 * fade + edge) * (0.97 + 0.03 * sin(uTime * 2.)));
      }`,
  }));
  holo.add(holoPlane);
  const beamCone = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 0.5, 2.2, 32, 1, true), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: U,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
    fragmentShader: `uniform float uTime; varying vec2 vUv; void main(){ float a = pow(clamp(1. - vUv.y, 0., 1.), 1.6) * 0.25 * (0.8 + 0.2 * sin(vUv.x * 60. + uTime * 3.)); gl_FragColor = vec4(vec3(0.44,0.89,0.84) * a, a); }`,
  }));
  beamCone.position.y = -3.2; beamCone.rotation.x = Math.PI; holo.add(beamCone);
  const pad = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.03, 8, 64), new THREE.MeshBasicMaterial({ color: SIGNAL.clone().multiplyScalar(2) }));
  pad.rotation.x = Math.PI / 2; pad.position.y = -4.3; holo.add(pad);
  const holoLabel = label(PROFILE.name, PROFILE.mantra, { h: 0.9 }); holoLabel.position.y = 2.8; holo.add(holoLabel);
  const holoHit = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 4.25), new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide })); holo.add(holoHit);
  register(holoHit, { label: 'Aloysious Kabonge · first light', hover: (on) => tween(holoU.uHover, { value: on ? 1 : 0, duration: 0.4 }), click: () => audio.ping(880) });
  await progress(0.95, 'Waiting for first light');

  /* ================================================================ */
  /* Camera path                                                         */
  /* ================================================================ */
  let posCurve, lookCurve, narrow;
  function buildPath() {
    narrow = innerWidth < 720;
    camera.fov = narrow ? 62 : 46; camera.updateProjectionMatrix();
    // side = where the HTML panel is, so the object sits on the opposite half of the screen.
    const st = [
      { p: P.hero, off: [0, 3, narrow ? 40 : 34], side: 0, shift: 0, y: 26 },
      { p: P.hero, off: [0, 0.4, narrow ? 15 : 10.5], side: -1, shift: 3.4, y: narrow ? 3.4 : 0 },
      { p: P.journey, off: [-7.5, 2.2, narrow ? 24 : 23], side: -1, shift: 5.2, y: narrow ? -2.4 : 0 },
      { p: P.experience, off: [9.5, 4.5, 29], side: 1, shift: 6.5, y: narrow ? -1 : 0 },
      { p: P.projects, off: [-7, 1.6, 17], side: -1, shift: 2.2, y: narrow ? -2.2 : 0 },
      { p: P.demos, off: [8.5, 3.8, 21], side: 1, shift: 5.2, y: narrow ? -1.8 : 0 },
      { p: P.skills, off: [0, 0.2, narrow ? 34 : 22], side: -1, shift: narrow ? 0 : 3.2, y: narrow ? -4 : 0.6 },
      { p: P.community, off: [8, 11, narrow ? 30 : 21], side: 1, shift: narrow ? 13 : 7, y: narrow ? -5 : -1.2 },
      { p: P.stars, off: [-2, -3, narrow ? 30 : 21], side: -1, shift: narrow ? 0 : 5.5, y: narrow ? -3 : 0 },
      { p: P.contact, off: [-6.5, -0.6, narrow ? 17 : 13], side: -1, shift: 4, y: narrow ? -1.6 : 0 },
    ];
    posCurve = new THREE.CatmullRomCurve3(st.map((s) => s.p.clone().add(new THREE.Vector3(...s.off))), false, 'centripetal');
    lookCurve = new THREE.CatmullRomCurve3(st.map((s) => s.p.clone().add(new THREE.Vector3(narrow ? 0 : s.side * s.shift, s.y, 0))), false, 'centripetal');
  }
  buildPath();

  /* ---------- post-processing ---------- */
  const rt = new THREE.WebGLRenderTarget(innerWidth, innerHeight, { type: THREE.HalfFloatType, samples: 0 });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new ShaderPass({
    uniforms: { tDiffuse: { value: null } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
    fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv;
      void main(){ vec4 c = texture2D(tDiffuse, vUv);
        if (any(isnan(c)) || any(isinf(c))) c = vec4(0., 0., 0., 1.);
        gl_FragColor = vec4(clamp(c.rgb, 0., 40.), 1.); }`,
  }));
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.7, 0.5, 0.8);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const grade = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uTime: U.uTime, uCA: { value: 1 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
    fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime, uCA; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main(){ vec2 d = vUv - .5; float r = dot(d, d); vec2 o = d * r * 0.02 * uCA;
        vec3 c = vec3(texture2D(tDiffuse, vUv + o).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - o).b);
        c *= 1. - smoothstep(0.1, 0.6, r) * 0.42;
        c = mix(c, c * c * (3. - 2. * c), 0.18);
        c += (h(vUv * 900. + fract(uTime * 0.5) * 91.) - .5) * 0.016;
        gl_FragColor = vec4(c, 1.); }`,
  });
  composer.addPass(grade);
  function applyTier() {
    renderer.setPixelRatio(Math.min(devicePixelRatio, HIGH() ? 2 : 1));
    U.uPR.value = renderer.getPixelRatio();
    bloom.enabled = true; bloom.strength = HIGH() ? 0.7 : 0.5;
    composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(innerWidth, innerHeight);
    
  }
  applyTier();
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); sceneFailed = true; renderer.setAnimationLoop(null); lenis?.destroy(); lenis = null; window.portfolioBoot?.fail(); }, false);
  canvas.addEventListener('webglcontextrestored', () => location.reload(), false);
  

  addEventListener('resize', () => {
    graphDirty = true; lastLabels = 0;
    lineMats.forEach((m) => m.resolution.set(innerWidth, innerHeight));
    camera.aspect = innerWidth / innerHeight; renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
    if ((innerWidth < 720) !== narrow) buildPath(); else camera.updateProjectionMatrix();
  });

  /* ---------- pointer: parallax, drag-to-look, raycast ---------- */
  const mouse = new THREE.Vector2(), ndc = new THREE.Vector2(-9, -9), look = { x: 0, y: 0, tx: 0, ty: 0 };
  const ray = new THREE.Raycaster(); ray.params.Points.threshold = 5;
  const cursor = $('#cursor'), cLabel = $('#cursor-label');
  let drag = null, hovered = null, hoveredHit = null, needsPick = false;
  clearVisitorHover = (hit) => { if (hoveredHit?.object === hit) setHover(null); };
  canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, moved: 0, lx: look.tx, ly: look.ty }; });
  addEventListener('pointermove', (e) => {
    mouse.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    cursor.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
    cLabel.style.transform = `translate(${e.clientX + 26}px, ${e.clientY + 18}px)`;
    if (e.target === canvas) { ndc.copy(mouse); needsPick = true; } else if (hovered) { setHover(null); }
    if (drag) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.moved = Math.max(drag.moved, Math.hypot(dx, dy));
      if (e.pointerType !== 'touch' || Math.abs(dx) > Math.abs(dy)) { look.tx = THREE.MathUtils.clamp(drag.lx - dx * 0.004, -0.9, 0.9); look.ty = THREE.MathUtils.clamp(drag.ly + dy * 0.003, -0.5, 0.5); }
    }
  });
  addEventListener('pointerup', (e) => {
    if (drag && drag.moved < 6 && e.target === canvas) {
      ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); const h = pick();
      if (h) h.entry.click?.(h.hit); else onMissClick?.();
    }
    drag = null; look.tx = 0; look.ty = 0;
  });
  canvas.addEventListener('pointerleave', () => setHover(null));
  addEventListener('pointercancel', () => { drag = null; look.tx = 0; look.ty = 0; });
  function pick() {
    ray.setFromCamera(ndc, camera);
    const list = ray.intersectObjects(hits, false);
    return list.length ? { entry: list[0].object.userData.hit, hit: list[0] } : null;
  }
  function setHover(h) {
    const same = h && hovered === h.entry && (!h.entry.instanced || hoveredHit?.instanceId === h.hit.instanceId) && (!h.entry.points || hoveredHit?.index === h.hit.index);
    if (same) return;
    if (hovered) hovered.hover?.(false, hoveredHit);
    hovered = h ? h.entry : null; hoveredHit = h ? h.hit : null;
    if (hovered) { hovered.hover?.(true, hoveredHit); audio.ping(990, 0.05); }
    cursor.classList.toggle('hot', !!hovered);
    canvas.style.cursor = hovered ? 'pointer' : '';
    cLabel.textContent = hovered ? (typeof hovered.label === 'function' ? hovered.label(hoveredHit) : hovered.label) : '';
    cLabel.classList.toggle('show', !!hovered);
  }
  // DOM list hover lights up the matching 3D object
  document.querySelectorAll('[data-open]').forEach((b) => {
    const fn = () => linkHover[b.dataset.open];
    b.addEventListener('pointerenter', () => fn()?.(true)); b.addEventListener('pointerleave', () => fn()?.(false));
    b.addEventListener('focus', () => fn()?.(true)); b.addEventListener('blur', () => fn()?.(false));
  });

  /* ---------- intro ---------- */
  await progress(1, 'Ready');
  let camT = 0; // smoothed path progress
  const intro = { k: reduced ? 1 : 0 };
  finishIntro = () => { gsap.killTweensOf(intro); intro.k = 1; gsap.killTweensOf('.welcome-card > *'); gsap.set('.welcome-card > *', { clearProps: 'transform,opacity' }); };
  const startPos = new THREE.Vector3(0, 9, 48);
  window.portfolioBoot?.ready();
  setTimeout(openDeepLink, hashStation() ? 900 : 0);
  if (!reduced) {
    tween(intro, { k: 1, duration: 3.2, ease: 'power3.inOut' });
    gsap.from('.welcome-card > *', { y: 24, opacity: 0, duration: 1.1, stagger: 0.1, delay: 0.6, ease: 'power3.out' });
  }

  // Compile every shader up front so nothing stalls or flashes the first time it comes into view
  try { renderer.compile(scene, camera); } catch { /* optional */ }
  // Fetch only media near the current section. Save-Data narrows the window to
  // half a station; drawer-only photos are requested only when opened.
  const updateScenePhotos = createStationMedia([
    { key: 'umw', station: 2, apply: addPostcard },
    { key: 'proofmode', station: 4, apply: addProofScreen },
    { key: 'finale', station: 9, apply: paintHolo },
  ], loadPhoto, () => !sceneFailed);

  /* ---------- loop ---------- */
  const fogNight = NIGHT.clone(), fogDay = new THREE.Color(0x365879), fogDawn = new THREE.Color(0x24141f);
  const tmpP = new THREE.Vector3(), tmpL = new THREE.Vector3();
  let frames = 0, slow = 0, watched = false, arcDrawn = false, lastKm = -1, animationTime = 0;
  const kmEl = $('#km-n');
  const ease = (x) => { const s = THREE.MathUtils.smoothstep(x, 0.12, 0.88); return s; };

  renderer.setAnimationLoop(() => {
    clock.update();
    if (document.hidden) return;
    const raw = clock.getDelta(), dt = reduced ? 0 : Math.min(raw, 0.05), dtCam = Math.min(raw, 0.25), t = animationTime += dt;
    U.uTime.value = t;
    if (lenis) lenis.raf(performance.now());
    const y = lenis ? lenis.scroll : scrollY;
    const f = stationFloat(y);
    updateScenePhotos(f, !!navigator.connection?.saveData);
    updateHUD(f);
    audio.update(f);

    // eased station progress with a short dwell at every station
    const i = Math.min(Math.floor(f), STATIONS.length - 2), frac = f - i;
    const target = (i + ease(frac)) / (STATIONS.length - 1);
    if (reduced) camT = target;
    else camT += (target - camT) * (1 - Math.exp(-dtCam * 3.2));

    posCurve.getPoint(THREE.MathUtils.clamp(camT, 0, 1), tmpP);
    lookCurve.getPoint(THREE.MathUtils.clamp(camT, 0, 1), tmpL);
    if (intro.k < 1) tmpP.lerpVectors(startPos, tmpP, intro.k);
    look.x += (look.tx - look.x) * (1 - Math.exp(-dt * 5)); look.y += (look.ty - look.y) * (1 - Math.exp(-dt * 5));
    const par = reduced ? 0 : 1;
    camera.position.set(tmpP.x + mouse.x * 0.7 * par, tmpP.y + mouse.y * 0.35 * par, tmpP.z);
    tmpL.x += look.x * 12; tmpL.y += look.y * 8;
    camera.lookAt(tmpL);
    sky.position.copy(camera.position); stars.position.copy(camera.position); guestStars.position.copy(camera.position);

    const km = Math.round(THREE.MathUtils.clamp(camT, 0, 1) * 11619 / 10) * 10;
    if (km !== lastKm) { lastKm = km; kmEl.textContent = km.toLocaleString('en-US').padStart(6, '0'); }
    // dawn at the end of the journey
    const dawn = THREE.MathUtils.smoothstep(f, 7.9, 9);
    U.uDawn.value = dawn;
    scene.fog.color.copy(fogNight).lerp(fogDay, U.uDay.value * 0.8).lerp(fogDawn, Math.max(dawn * 0.8, U.uWarm.value * 0.4));
    scene.fog.density = 0.0105 - dawn * 0.003;
    renderer.toneMappingExposure = 1.0;

    // animate only what is near the camera
    const near = (p, r = 90) => Math.abs(camera.position.z - p.z) < r;
    if (near(P.hero)) {
      core.rotation.y += dt * 0.12; shell.rotation.y -= dt * 0.05; shell.rotation.x += dt * 0.03;
      rings[0].rotation.z += dt * 0.25; rings[1].rotation.x += dt * 0.18; rings[2].rotation.y += dt * 0.12;
      core.getObjectByName('orbit').rotation.y -= dt * 0.06;
    }
    if (near(P.journey)) {
      if (flight.on) updateFlight(); else updateComet(t);
      if (postcard) postcard.visible = !flight.on;
      updateCrane(t);
      if (postcard) { postcard.lookAt(camera.position); postcard.position.y += Math.sin(t * 0.9) * 0.002; }
      globe.rotation.y = Math.sin(t * 0.25) * 0.18;
      markers.forEach((m, k) => { const s = 1 + ((t * 0.8 + k * 0.5) % 1) * 1.6; m.scale.setScalar(s); m.material.opacity = 1 - ((t * 0.8 + k * 0.5) % 1); });
      if (!arcDrawn && f > 0.4) { arcDrawn = true; arcU.uDraw.value = 0; tween(arcU.uDraw, { value: 1, duration: reduced ? 0 : 2.4, ease: 'power2.inOut' }); }
    }
    if (near(P.experience)) towers.forEach(({ cap }, k) => { cap.rotation.y += dt * 0.8; cap.position.y = EXPERIENCE[k].height + 0.8 + Math.sin(t * 1.4 + k) * 0.15; });
    if (near(P.projects)) {
      seal.rotation.z -= dt * 0.5; seal2.rotation.z += dt * 0.8; checkRing.rotation.z += dt * 0.2;
      proof.position.y = P.projects.y + Math.sin(t * 0.8) * 0.15;
      const active = Math.floor(t * (ragHover ? 1.6 : 0.8)) % shards.length;
      shards.forEach((s, k) => {
        const on = k === active; s.userData.out += ((on ? 1 : 0) - s.userData.out) * (1 - Math.exp(-dt * 6));
        const a = s.userData.a + t * 0.12, r = s.userData.r + s.userData.out * 1.6;
        s.position.set(Math.cos(a) * r, s.userData.y, Math.sin(a) * r); s.lookAt(0, s.userData.y, 0);
        s.material.opacity = 0.14 + s.userData.out * 0.7 + ragHover * 0.1;
        if (on) { const b = beamGeo.attributes.position; b.setXYZ(0, query.position.x, query.position.y, query.position.z); b.setXYZ(1, s.position.x, s.position.y, s.position.z); b.needsUpdate = true; }
      });
    }
    if (near(P.demos)) gems.forEach(({ gem, halo, i: k }) => { gem.rotation.y += dt * 0.9; gem.position.y = 1.4 + Math.sin(t * 1.3 + k) * 0.18; halo.scale.setScalar(1 + Math.sin(t * 2 + k) * 0.05); });
    if (!near(P.skills, 40)) leaveSkills();
    if (near(P.skills)) { stepGraph(dt); const sway = consFocus < 0 && !reduced ? 1 : 0; cons.rotation.y += (Math.sin(t * 0.18) * 0.12 * sway - cons.rotation.y) * 0.05; cons.rotation.x += (Math.sin(t * 0.13) * 0.05 * sway - cons.rotation.x) * 0.05; }
    if (near(P.community)) updateCommunity(t);
    vis.visible = near(P.stars, 70); if (vis.visible) visItems.forEach((it, i) => { it.star.material.opacity = 0.75 + 0.25 * Math.sin(t * (1.2 + it.seed) + i); });
    comm.visible = near(P.community, 70) && camera.position.distanceTo(P.community) < camera.position.distanceTo(P.stars) + 4; cons.visible = near(P.skills, 70); globe.visible = near(P.journey, 90); crane.visible = globe.visible; holo.visible = near(P.contact, 90);
    if (near(P.contact, 120)) { holo.position.y = P.contact.y + Math.sin(t * 0.9) * 0.12; pad.scale.setScalar(1 + Math.sin(t * 2.4) * 0.08); }

    if (needsPick && !drag) { needsPick = false; setHover(pick()); }

    composer.render(dt);

    // performance watchdog: drop to LQ once if the device struggles
    if (!watched && t > 4) {
      frames++; if (dt > 1 / 36) slow++;
      if (frames === 150) {
        if (slow > 90 && HIGH()) { tier = 'low'; applyTier(); frames = 0; slow = 0; } // re-check once in low quality
        else { watched = true; if (slow > 90) offerLite('slow'); }                   // still struggling: offer the text version
      }
    }
  });
}
