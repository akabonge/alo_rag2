// Flags drawn in code (both designs are public-domain national symbols).
export function ugandaFlag(w = 600, h = 400) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
  ['#000000', '#fcdc04', '#d90000', '#000000', '#fcdc04', '#d90000'].forEach((col, i) => { x.fillStyle = col; x.fillRect(0, (i * h) / 6, w, h / 6 + 1); });
  const cx = w / 2, cy = h / 2, r = h * 0.2;
  x.fillStyle = '#ffffff'; x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill();
  // Grey crowned crane, simplified, facing the hoist side
  x.save(); x.translate(cx, cy); x.scale(r / 80, r / 80);
  x.fillStyle = '#9ca3af'; // body
  x.beginPath(); x.moveTo(-18, 10); x.bezierCurveTo(-30, -10, 10, -22, 26, -2); x.bezierCurveTo(34, 12, 18, 30, -2, 30); x.bezierCurveTo(-14, 30, -20, 22, -18, 10); x.fill();
  x.fillStyle = '#ffffff'; x.beginPath(); x.moveTo(6, -6); x.bezierCurveTo(22, -8, 34, 6, 28, 18); x.bezierCurveTo(20, 10, 12, 4, 6, -6); x.fill(); // wing panel
  x.strokeStyle = '#6b7280'; x.lineWidth = 7; x.lineCap = 'round';
  x.beginPath(); x.moveTo(-10, 0); x.quadraticCurveTo(-20, -30, -8, -48); x.stroke(); // neck
  x.fillStyle = '#111111'; x.beginPath(); x.arc(-8, -52, 8, 0, Math.PI * 2); x.fill(); // head
  x.fillStyle = '#ffffff'; x.beginPath(); x.arc(-11, -52, 3.5, 0, Math.PI * 2); x.fill(); // cheek
  x.fillStyle = '#d90000'; x.beginPath(); x.ellipse(-12, -42, 2.5, 5, 0, 0, Math.PI * 2); x.fill(); // wattle
  x.strokeStyle = '#111111'; x.lineWidth = 3; x.beginPath(); x.moveTo(-15, -52); x.lineTo(-27, -48); x.stroke(); // beak
  x.strokeStyle = '#fcdc04'; x.lineWidth = 2; // crown
  for (let i = 0; i < 9; i++) { const a = -Math.PI / 2 - 0.9 + i * 0.22; x.beginPath(); x.moveTo(-6, -58); x.lineTo(-6 + Math.cos(a) * 16, -58 + Math.sin(a) * 16); x.stroke(); }
  x.strokeStyle = '#6b7280'; x.lineWidth = 3; // legs
  x.beginPath(); x.moveTo(-2, 28); x.lineTo(-6, 58); x.moveTo(8, 28); x.lineTo(12, 58); x.stroke();
  x.restore();
  return c;
}

export function usFlag(w = 760, h = 400) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
  for (let i = 0; i < 13; i++) { x.fillStyle = i % 2 ? '#ffffff' : '#b22234'; x.fillRect(0, (i * h) / 13, w, h / 13 + 1); }
  const cw = w * 0.4, ch = (h * 7) / 13; x.fillStyle = '#3c3b6e'; x.fillRect(0, 0, cw, ch);
  x.fillStyle = '#ffffff';
  const star = (sx, sy, r) => { x.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 5, rr = k % 2 ? r * 0.4 : r; x.lineTo(sx + Math.cos(a) * rr, sy + Math.sin(a) * rr); } x.closePath(); x.fill(); };
  for (let row = 0; row < 9; row++) {
    const n = row % 2 ? 5 : 6;
    for (let col = 0; col < n; col++) {
      const sx = (cw / 12) * (row % 2 ? col * 2 + 2 : col * 2 + 1), sy = (ch / 10) * (row + 1);
      star(sx, sy, h * 0.022);
    }
  }
  return c;
}
