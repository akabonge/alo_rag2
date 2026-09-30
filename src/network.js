// A cancelled/replaced interaction must not keep an unbounded network request alive.
export async function fetchJSON(url, { signal, timeout = 8000, ...options } = {}) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) abort();
  else signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, timeout);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const value = await response.json();
    if (!response.ok) throw new Error(typeof value?.error === 'string' ? value.error : 'The service is unavailable. Please try again later.');
    return value;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}
