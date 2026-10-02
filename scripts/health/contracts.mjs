export const REPOSITORY = 'akabonge/alo_rag2';
export const PRODUCTION_ORIGIN = 'https://3d.aialo.io';
const DEPLOYMENT_HOST = /^alorag2-[a-z0-9]{9}-alo-0ac6\.vercel\.app$/;
export const isDeploymentOrigin = (origin) => /^https:\/\/alorag2-[a-z0-9]{9}-alo-0ac6\.vercel\.app$/.test(origin);
const isVercel = (actor) => actor?.login === 'vercel[bot]' && actor?.type === 'Bot';

export function deploymentTarget(event) {
  const deployment = event?.deployment, status = event?.deployment_status;
  if (event?.repository?.full_name !== REPOSITORY || deployment?.repository_url !== `https://api.github.com/repos/${REPOSITORY}`) throw new Error('Deployment repository is not trusted');
  if (!isVercel(deployment.creator) || !isVercel(status?.creator)) throw new Error('Deployment must be created and confirmed by the Vercel bot');
  if (status.state !== 'success') throw new Error('Deployment is not successful');
  if (!['Preview', 'Production'].includes(deployment.environment)) throw new Error('Unknown deployment environment');
  if (!/^[a-f0-9]{40}$/i.test(deployment.sha || '')) throw new Error('Deployment commit is invalid');
  let url;
  try { url = new URL(status.environment_url); } catch { throw new Error('Deployment URL is missing or invalid'); }
  if (url.protocol !== 'https:' || !DEPLOYMENT_HOST.test(url.hostname) || url.port || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('Deployment URL is outside the verified project and scope');
  return { origin: url.origin, sha: deployment.sha, environment: deployment.environment };
}

// Redirects are followed manually: failures stay failures and credentials never
// leave the original origin. One deadline covers redirects AND body consumption.
export async function request(url, { fetchImpl = fetch, method = 'GET', body, headers = {}, timeoutMs = 20_000, allowedOrigins, expectedStatus, maxBytes = 2 * 1024 * 1024 } = {}) {
  let current = new URL(url);
  const originalOrigin = current.origin;
  const allowed = new Set(allowedOrigins || [originalOrigin]);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    for (let redirects = 0; redirects <= 4; redirects++) {
      if (current.protocol !== 'https:' || current.username || current.password || !allowed.has(current.origin)) throw new Error('Redirect or request left its trusted HTTPS origin');
      if (current.origin !== originalOrigin && Object.keys(headers).some((key) => /authorization|cookie|bypass/i.test(key))) throw new Error('Refusing to forward authentication to another origin');
      let response;
      try { response = await fetchImpl(current.href, { method, body, headers, redirect: 'manual', signal: controller.signal }); }
      catch { throw new Error(controller.signal.aborted ? 'Request timed out' : 'Transport failed'); }
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        await response.body?.cancel();
        if (!location || redirects === 4 || method !== 'GET') throw new Error(`Unresolved redirect (HTTP ${response.status})`);
        const next = new URL(location, current);
        if (next.hostname === 'vercel.com' && next.pathname.startsWith('/sso-api')) throw new Error('Protected deployment redirected to Vercel authentication; deployment is not verified');
        current = next;
        continue;
      }
      if (response.status === 401 || response.status === 403) {
        await response.body?.cancel();
        throw new Error(`Access denied (HTTP ${response.status}); protected deployment is not verified`);
      }
      if (expectedStatus !== undefined ? response.status !== expectedStatus : response.status < 200 || response.status >= 300) {
        await response.body?.cancel();
        throw new Error(`Unexpected HTTP ${response.status}`);
      }
      const reader = response.body?.getReader();
      let length = 0; const chunks = [];
      if (reader) {
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            length += value.byteLength;
            if (length > maxBytes) { await reader.cancel(); throw new Error('Response exceeds the health-check size limit'); }
            chunks.push(value);
          }
        } catch { throw new Error(controller.signal.aborted ? 'Response timed out' : 'Response body could not be read within its limit'); }
      }
      return { status: response.status, headers: response.headers, text: Buffer.concat(chunks).toString('utf8'), url: current.href };
    }
    throw new Error('Unresolved redirect');
  } finally { clearTimeout(timer); }
}

function contentType(response, pattern, label) {
  if (!pattern.test(response.headers.get('content-type') || '')) throw new Error(`${label} content type is invalid`);
}
export function html(response, marker) {
  contentType(response, /^text\/html\b/i, 'HTML');
  if (!/<(?:!doctype\s+html|html)\b/i.test(response.text) || (marker && !marker.test(response.text))) throw new Error('Expected page content is missing');
}
export function javascript(response) {
  contentType(response, /^(?:text|application)\/(?:java|ecma)script\b/i, 'JavaScript');
  if (!response.text.trim() || /<(?:!doctype|html)\b/i.test(response.text)) throw new Error('Expected JavaScript asset is missing');
}
export function svg(response) {
  contentType(response, /^image\/svg\+xml\b/i, 'SVG');
  if (!/<svg\b/i.test(response.text)) throw new Error('Expected SVG is missing');
}
function json(response) {
  contentType(response, /^application\/json\b/i, 'JSON');
  try { return JSON.parse(response.text); } catch { throw new Error('Response is not valid JSON'); }
}
export function guestbook(response) {
  const value = json(response);
  if (!value || !Array.isArray(value.notes) || value.notes.length > 300 || value.notes.some((note) => !note || typeof note.name !== 'string' || typeof note.city !== 'string' || typeof note.msg !== 'string' || !Number.isFinite(note.t))) throw new Error('Guestbook response does not match the public notes contract');
}
export function ask(response) {
  const value = json(response);
  if (!value || typeof value.answer !== 'string' || value.answer.trim().length <= 20 || !Array.isArray(value.sources) || !value.sources.length || value.sources.some((source) => typeof source !== 'string' || !source.trim())) throw new Error('Ask response is not a sourced answer');
  return { cached: value.cached === true };
}
export function invalidAsk(response) {
  const value = json(response);
  if (!value || typeof value.error !== 'string' || !value.error.trim()) throw new Error('Ask invalid-input response is malformed');
}
