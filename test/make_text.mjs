// Builds src/text.html: a fast, accessible, crawlable text version of the 3D site, straight from content.js.
// Run: node test/make_text.mjs   (also run by test/wrap.py)
import { writeFileSync } from 'fs';
import * as C from '../src/content.js';

const e = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const links = (l = []) => l.length ? `<p class="links">${l.map((x) => `<a href="${e(x.href)}" rel="noopener">${e(x.label)}</a>`).join(' · ')}</p>` : '';
const P = C.PROFILE;

const html = `<!doctype html>
<html lang="en"><head>
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${e(P.name)} · AI/ML Engineer (text version)</title>
<meta name="description" content="${e(P.pitch)}">
<link rel="canonical" href="https://3d.aialo.io/text.html">
<style>
:root { --bg:#fff; --fg:#111; --muted:#555; --line:#ddd; --accent:#8a5a00; color-scheme: light dark; }
@media (prefers-color-scheme: dark) { :root { --bg:#0b1024; --fg:#eef0f7; --muted:#a9b1cc; --line:#262e4d; --accent:#e8b54a; } }
body { margin:0; background:var(--bg); color:var(--fg); font:17px/1.6 system-ui,-apple-system,Segoe UI,Roboto,sans-serif; }
main { max-width: 760px; margin: 0 auto; padding: 32px 16px 64px; }
h1 { font-size: 2rem; margin: 0 0 4px; } h2 { margin: 44px 0 10px; padding-top: 12px; border-top: 1px solid var(--line); } h3 { margin: 22px 0 4px; }
.meta, .links, small { color: var(--muted); } a { color: var(--accent); }
ul { padding-left: 20px; } .top { display:flex; gap:12px; flex-wrap:wrap; margin: 12px 0 0; }
.tags { color: var(--muted); font-size: .9rem; }
</style>
</head><body><main>
<p class="top"><a href="./">← Back to the 3D site</a> <a href="${e(P.site2d)}">2D site</a> <a href="assets/Aloysious_Kabonge_AI_ML_Engineer_Resume.pdf">Resume (PDF)</a></p>
<header>
<p class="meta" lang="lg"><b>Oli otya?</b> (How are you? in Luganda)</p>
<h1>${e(P.name)}</h1>
<p><b>${e(P.role)}</b> · ${e(P.focus)}</p>
<p>${e(P.pitch)}</p>
<p><a href="mailto:${e(P.email)}">${e(P.email)}</a> · <a href="${e(P.linkedin)}">LinkedIn</a> · <a href="${e(P.github)}">GitHub</a></p>
</header>

<h2 id="journey">Journey</h2>
<p>From ${e(C.ORIGIN.label)} to ${e(C.DEST.label)}: 11,619 km and a 23-hour flight from Entebbe to start a new life.</p>
<ul>${C.TIMELINE.map((t) => `<li><b>${e(t.year)}</b>: ${e(t.text)}</li>`).join('')}</ul>
${Object.values(C.PLACES).map((p) => `<h3>${e(p.title)}</h3><p class="meta">${e(p.kicker)}</p>${p.body.map((b) => `<p>${e(b)}</p>`).join('')}${links(p.links)}`).join('')}

<h2 id="experience">Experience</h2>
${C.EXPERIENCE.map((x) => `<h3>${e(x.title)} · ${e(x.org)}</h3><p class="meta">${e(x.when)} · ${e(x.where)}</p><p>${e(x.body)}</p>${(x.bullets || []).length ? `<ul>${x.bullets.map((b) => `<li>${e(b)}</li>`).join('')}</ul>` : ''}<p class="tags">${x.tags.map(e).join(' · ')}</p>`).join('')}

<h2 id="projects">Projects</h2>
${C.PROJECTS.map((p) => `<h3>${e(p.name)}</h3><p class="meta">${e(p.badge)} · ${e(p.when)}</p><p><b>Problem:</b> ${e(p.problem)}</p><p><b>Approach:</b> ${e(p.approach)}</p><p><b>Result:</b> ${e(p.result)}</p><p class="tags">${p.tags.map(e).join(' · ')}</p>${links(p.links)}`).join('')}

<h2 id="demos">Live AI demos</h2>
<ul>${C.DEMOS.map((d) => `<li><a href="${e(d.href)}" rel="noopener">${e(d.name)}</a> (${e(d.vertical)}): ${e(d.text)}</li>`).join('')}</ul>

<h2 id="skills">Skills</h2>
${Object.entries(C.SKILLS).map(([k, v]) => `<h3>${e(k)}</h3><p>${v.map(e).join(' · ')}</p>`).join('')}
<h3>CliftonStrengths Top 5</h3>
<ul>${C.STRENGTHS.map((s) => `<li><b>${e(s.name)}</b>: ${e(s.text)}</li>`).join('')}</ul>

<h2 id="community">${e(C.COMMUNITY.title)}</h2>
${C.COMMUNITY.intro.map((p) => `<p>${e(p)}</p>`).join('')}
<p class="meta">${C.COMMUNITY.stats.map(([n, l]) => `${e(n)} ${e(l)}`).join(' · ')}</p>
<ul>${C.COMMUNITY.builds.map((b) => `<li><b>${e(b.year)}</b> · ${e(b.city)}, ${e(b.state)} · ${e(b.role)} with <a href="${e(b.href)}" rel="noopener">${e(b.org)}</a>. ${e(b.text)}</li>`).join('')}</ul>

<h2 id="contact">Contact</h2>
<p>Always happy to connect about AI, data and building useful things: <a href="mailto:${e(P.email)}">${e(P.email)}</a>.</p>
<p lang="lg"><b>Webale kujja!</b> <span lang="en">Thank you for coming.</span></p>
<p><small>${e(P.mantra)}</small></p>
</main></body></html>
`;
writeFileSync(new URL('../src/text.html', import.meta.url), html);
console.log('wrote src/text.html', html.length, 'bytes');
