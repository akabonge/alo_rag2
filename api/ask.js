// Vercel serverless function: POST /api/ask  { question } -> { answer, sources }
// Retrieval runs here over the same corpus as the site, then Claude writes a grounded answer.
// Env vars (Vercel → Project → Settings → Environment Variables):
//   ANTHROPIC_API_KEY  (required)   ANTHROPIC_MODEL (optional, default Claude Haiku 4.5)
//   KV_REST_API_URL/TOKEN or UPSTASH_REDIS_REST_URL/TOKEN (shared attempt limit)
import { buildCorpus, makeIndex, ragPrompt } from '../src/ask.js';
import { consumeAskAttempt } from '../lib/ask-rate-limit.js';

const search = makeIndex(buildCorpus());
const UPSTREAM_TIMEOUT = 12_000;
// Answer cache: the same question (normalized) is answered once per warm instance, for 24 h.
// Suggested questions get asked over and over, so this removes most of the paid calls.
const cache = new Map(), TTL = 24 * 3600 * 1000, MAX = 300;
const norm = (q) => q.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Use POST' });
  }
  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body; }
  catch { return res.status(400).json({ error: 'Send a valid JSON question' }); }
  if (!body || Array.isArray(body) || typeof body.question !== 'string') return res.status(400).json({ error: 'Ask a question' });
  const q = body.question.replace(/\s+/g, ' ').trim().slice(0, 300);
  if (!q) return res.status(400).json({ error: 'Ask a question' });

  // Charge every valid attempt, including cache hits, off-topic questions and
  // provider failures. An unavailable limiter must never open a paid-call path.
  let limit;
  try { limit = await consumeAskAttempt(req.headers['x-forwarded-for']); }
  catch { return res.status(503).json({ error: 'Ask is temporarily unavailable. Please try again later.' }); }
  if (!limit.allowed) {
    res.setHeader('Retry-After', String(limit.retryAfter));
    return res.status(429).json({ error: 'Too many questions. Please try again shortly.' });
  }
  const now = Date.now();

  const key = norm(q), hit = cache.get(key);
  if (hit && now - hit.t < TTL) return res.json({ ...hit.v, cached: true });

  // Fewer, shorter sources = fewer input tokens. 3 chunks capped at 700 characters each.
  const results = search(q, 3).map((x) => ({ ...x, d: { ...x.d, text: x.d.text.slice(0, 700) } }));
  if (!results.length) return res.json({ answer: 'That isn’t covered on this site. Try asking about his experience, projects, live demos, skills or how to contact him.', sources: [] });

  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'The model is unavailable right now' });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT);
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', signal: controller.signal,
      headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001', max_tokens: 220, messages: [{ role: 'user', content: ragPrompt(q, results) }] }),
    });
    if (!r.ok) throw new Error('Provider unavailable');
    const j = await r.json();
    const answer = Array.isArray(j?.content) ? j.content.filter((c) => c?.type === 'text' && typeof c.text === 'string').map((c) => c.text).join('').trim() : '';
    if (!answer) throw new Error('Provider returned no answer');
    const v = { answer, sources: results.map((x, i) => `[${i + 1}] ${x.d.src}`) };
    if (cache.size >= MAX) cache.delete(cache.keys().next().value);
    cache.set(key, { t: now, v });
    return res.json(v);
  } catch {
    return res.status(controller.signal.aborted ? 504 : 502).json({ error: 'The model is unavailable right now. Please try again later.' });
  } finally {
    clearTimeout(timer);
  }
}
