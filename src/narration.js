// A single media element keeps the visitor's per-element playback permission.
// First play/retry is synchronous so callers can use a real click activation.
export function setAudioSessionType(type, navigatorObject = globalThis.navigator) {
  try { if (navigatorObject?.audioSession) navigatorObject.audioSession.type = type; } catch { /* optional platform API */ }
}

export function createNarrationPlayer({ createAudio = () => new Audio(), onState = () => {},
  schedule = setTimeout, cancel = clearTimeout, timeout = 10000 } = {}) {
  let media = null, request = null, generation = 0, attempt = 0, timer = null;
  const clear = () => { cancel(timer); timer = null; };
  const notify = (status, error) => {
    if (!request || request.status === status) return;
    request.status = status;
    const state = { status, error, src: request.src };
    onState(state); request.onState?.(state);
  };
  const stop = () => {
    generation++; attempt++; clear(); request = null;
    if (media) { media.onplaying = media.onended = media.onerror = media.onpause = media.onwaiting = null; media.pause(); }
    onState({ status: 'idle' });
  };
  const begin = (restart = false) => {
    if (!request) return;
    const active = request, id = generation, playId = ++attempt;
    const valid = () => request === active && id === generation && playId === attempt;
    clear();
    if (restart) {
      const reload = active.status === 'error' || media.error || media.networkState === 3;
      if (reload) { media.src = active.src; media.load?.(); }
      else { try { media.currentTime = 0; } catch { /* not loaded yet */ } }
    }
    media.playbackRate = 1; media.preservesPitch = true;
    const blocked = (status, error) => {
      if (!valid()) return;
      clear(); attempt++; notify(status, error); media.pause();
    };
    const waiting = () => {
      if (!valid()) return;
      notify('loading'); clear();
      timer = schedule(() => blocked('blocked', new Error('Playback did not start. Tap to retry.')), timeout);
    };
    const playing = () => { if (valid() && !media.paused) { clear(); notify('playing'); } };
    media.onplaying = playing;
    media.onwaiting = waiting;
    media.onpause = () => { if (valid() && media.paused && !media.ended && active.status === 'playing') { clear(); notify('paused'); } };
    media.onerror = () => blocked('error', media.error);
    media.onended = () => {
      if (!valid() || !media.ended || !['loading', 'playing'].includes(active.status)) return;
      clear(); notify('ended'); active.onEnd?.();
    };
    waiting();
    try {
      // Do not await metadata, a timer, or a promise before invoking play().
      Promise.resolve(media.play()).then(playing, error => blocked(error?.name === 'NotAllowedError' ? 'blocked' : 'error', error));
    } catch (error) { blocked(error?.name === 'NotAllowedError' ? 'blocked' : 'error', error); }
  };
  return {
    play(src, options = {}) {
      stop();
      if (!media) { media = createAudio(); media.preload = 'none'; media.playsInline = true; }
      request = { src, ...options, status: 'idle' }; media.src = src;
      begin();
    },
    retry({ restart = false } = {}) { begin(restart); },
    pause() {
      if (!request) return;
      attempt++; clear(); notify('paused'); media.pause();
    },
    stop,
    get status() { return request?.status || 'idle'; },
  };
}
