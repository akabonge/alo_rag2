// Optional photos enhance the page; they never gate navigation or scene boot.
export function createImageLoader(images, ImageType = globalThis.Image) {
  const requests = new Map();
  const failed = new Set();
  function load(key) {
    if (!images[key] || failed.has(key)) return Promise.resolve(null);
    if (!requests.has(key)) {
      requests.set(key, new Promise((resolve) => {
        const image = new ImageType();
        image.decoding = 'async';
        image.fetchPriority = 'low';
        const finish = (ok) => {
          image.onload = image.onerror = null;
          if (!ok) failed.add(key); else failed.delete(key);
          resolve(ok ? image : null);
        };
        image.onload = () => finish(Number.isFinite(image.naturalWidth) && image.naturalWidth > 0 && Number.isFinite(image.naturalHeight) && image.naturalHeight > 0);
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
      load(entry.key).then((image) => {
        if (image && isActive()) entry.apply(image);
      }).catch(() => { /* keep the procedural stand-in if enhancement fails */ });
    }
  };
}
