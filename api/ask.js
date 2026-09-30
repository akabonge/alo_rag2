// Vercel serverless function: POST /api/ask  { question } -> { answer, sources }
// Retrieval runs here over the same corpus as the site, then Claude writes a grounded answer.
// Env vars (Vercel → Project → Settings → Environment Variables):
//   ANTHROPIC_API_KEY  (required)   ANTHROPIC_MODEL (optional, default Claude Haiku 4.5)
import { buildCorpus, makeIndex, ragPrompt } from '../src/ask.js';

const search = makeIndex(buildCorpus());
const recent = new Map(); // best-effort per-instance rate limit
// Answer cache: the same question (normalized) is answered once per warm instance, for 24 h.
// Suggested questions get asked over and over, so this removes most of the paid calls.
const cache = new Map(), TTL = 24 * 3600 * 1000, MAX = 300;
const norm = (q) => q.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const q = String(body.question || '').replace(/\s+/g, ' ').trim().slice(0, 300);
  if (!q) return res.status(400).json({ error: 'Ask a question' });

  const ip = String(req.headers['x-forwarded-for'] || 'anon').split(',')[0].trim();
  const now = Date.now(), times = (recent.get(ip) || []).filter((t) => now - t < 60_000);
  if (times.length >= 8) return res.status(429).json({ error: 'Too many questions, try again in a minute' });
  times.push(now); recent.set(ip, times);

  const key = norm(q), hit = cache.get(key);
  if (hit && now - hit.t < TTL) return res.json({ ...hit.v, cached: true });

  // Fewer, shorter sources = fewer input tokens. 3 chunks capped at 700 characters each.
  const results = search(q, 3).map((x) => ({ ...x, d: { ...x.d, text: x.d.text.slice(0, 700) } }));
  if (!results.length) return res.json({ answer: 'That isn’t covered on this site. Try asking about his experience, projects, live demos, skills or how to contact him.', sources: [] });

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001', max_tokens: 220, messages: [{ role: 'user', content: ragPrompt(q, results) }] }),
  });
  if (!r.ok) return res.status(502).json({ error: 'The model is unavailable right now' });
  const j = await r.json();
  const answer = (j.content || []).map((c) => c.text || '').join('').trim();
  const v = { answer, sources: results.map((x, i) => `[${i + 1}] ${x.d.src}`) };
  if (cache.size >= MAX) cache.delete(cache.keys().next().value);
  cache.set(key, { t: now, v });
  return res.json(v);
}
