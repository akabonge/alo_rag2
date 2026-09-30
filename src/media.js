// Optional photos enhance the page; they never gate navigation or scene boot.
export function createImageLoader(images, ImageType = globalThis.Image) {
  const requests = new Map();
  const failed = new Set();
  function load(key, priority = 'low') {
    if (!images[key] || failed.has(key)) return Promise.resolve(null);
    if (!requests.has(key)) {
      requests.set(key, new Promise((resolve) => {
        const image = new ImageType();
        image.decoding = 'async';
        image.fetchPriority = priority;
        const finish = (ok) => {
          image.onload = image.onerror = null;
          if (!ok) failed.add(key); else failed.delete(key);
          resolve(ok ? image : null);
        };
        image.onload = () => {
          const width = image.naturalWidth, height = image.naturalHeight, ratio = width / height;
          // These portfolio photos fit this generous range. Reject malformed or
          // accidental full-page replacements before sizing scene geometry/canvases.
          finish(Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0 && ratio >= 0.25 && ratio <= 4);
        };
        image.onerror = () => finish(false);
        image.src = images[key].src;
      }));
    }
    return requests.get(key);
  }
  return { load, failed };
}

// Call from the existing station loop, after all consumers have been constructed.
// Promises always deliver asynchronously, including cache hits and fast navigation.
export function createStationMedia(entries, load, isActive) {
  const started = new Set();
  return (station, saveData = false) => {
    if (!isActive()) return;
    for (const entry of entries) {
      if (started.has(entry.key) || Math.abs(station - entry.station) > (saveData ? 0.5 : 1)) continue;
      started.add(entry.key);
      load(entry.key, Math.round(station) === entry.station ? 'auto' : 'low').then((image) => {
        if (image && isActive()) entry.apply(image);
      }).catch(() => { /* keep the procedural stand-in if enhancement fails */ });
    }
  };
}
