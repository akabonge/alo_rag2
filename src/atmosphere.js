// An artistic cycle based on the visitor's local clock, not a weather forecast.
const clamp = (n) => Math.max(0, Math.min(1, n));
const smooth = (n) => { const t = clamp(n); return t * t * (3 - 2 * t); };
export function localAtmosphere(date = new Date()) {
  const hour = date.getHours() + date.getMinutes() / 60;
  const daylight = smooth((hour - 6) / 2) * (1 - smooth((hour - 17) / 3));
  const warmth = Math.max(0, 1 - Math.abs(hour - 6.8) / 1.4, 1 - Math.abs(hour - 18.5) / 1.5);
  const phase = warmth > 0.25 ? (hour < 12 ? 'sunrise' : 'sunset') : daylight > 0.3 ? 'daytime' : 'night';
  return { hour, daylight, warmth, phase };
}

// Labels are optional scene annotations. Never cover a reading panel to fit one.
export function placeLabels(labels, obstacles, viewport, limit = 7) {
  const gap = 8, out = [], occupied = [...obstacles];
  const overlaps = (a, b) => a.x < b.x + b.width + gap && a.x + a.width + gap > b.x && a.y < b.y + b.height + gap && a.y + a.height + gap > b.y;
  for (const label of labels) {
    if (out.length >= limit || label.behind) continue;
    for (const dy of [-label.height - 16, 16, -label.height - 48]) {
      const box = { ...label, x: label.x - label.width / 2, y: label.y + dy };
      if (box.x < 12 || box.x + box.width > viewport.width - 12 || box.y < 100 || box.y + box.height > viewport.height - 90) continue;
      if (occupied.some((obstacle) => overlaps(box, obstacle))) continue;
      out.push(box); occupied.push(box); break;
    }
  }
  return out;
}
