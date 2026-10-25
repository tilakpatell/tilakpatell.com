// The radar's picture (FlightCluster.jsx's canvas): rings at a half and the
// whole range, a wedge for what's ahead, the ship in the middle, and a dot
// per contact (radar.js placed them): red for hostiles (bigger when they're
// on you), green allies, gold the way to go, cyan a pickup, the lock in a
// white ring; a tick above or below a dot for a contact over or under you;
// the range in the lower part, between the rings (the canvas is clipped to
// its round border, which took a corner's number).
//
// It's drawn ~20 times a second, so what doesn't change is worked out once
// per canvas: its size (again when it's resized or the pixel ratio changes),
// its font and the range's text.
const INK = { hostile: '#ff5a4a', threat: '#ff3b2f', ally: '#6dff9a', goal: '#ffd36a', pickup: '#6fe7ff' };
const RINGS = [0.5, 1];
const looks = new WeakMap(); // canvas → { size, dpr, font, label, range, dirty }

const lookOf = (canvas, dpr) => {
  let k = looks.get(canvas);
  if (!k) {
    // (12 px: nothing a player reads is under 0.7 rem)
    k = { size: 0, dpr: 0, font: `600 12px ${getComputedStyle(canvas).fontFamily || 'monospace'}`, label: '', range: NaN, dirty: true };
    looks.set(canvas, k);
    if (typeof ResizeObserver === 'function') new ResizeObserver(() => (k.dirty = true)).observe(canvas);
  }
  if (k.dirty || k.dpr !== dpr) {
    k.dirty = false;
    k.dpr = dpr;
    k.size = canvas.clientWidth || 132;
    const px = Math.round(k.size * dpr);
    if (canvas.width !== px) {
      canvas.width = px;
      canvas.height = px;
    }
  }
  return k;
};

// `points`: radar.js's (a list it keeps, longer than what's in use: `points.n` of them are)
export function drawRadar(canvas, points, { range, dpr = 1, n = points.n ?? points.length } = {}) {
  const g = canvas.getContext('2d');
  if (!g) return;
  const look = lookOf(canvas, dpr);
  const size = look.size;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, size, size);
  const c = size / 2;
  const r = c - 6;
  g.strokeStyle = 'rgba(127,214,255,0.28)';
  g.lineWidth = 1;
  for (let i = 0; i < RINGS.length; i++) {
    g.beginPath();
    g.arc(c, c, r * RINGS[i], 0, Math.PI * 2);
    g.stroke();
  }
  g.fillStyle = 'rgba(127,214,255,0.08)';
  g.beginPath();
  g.moveTo(c, c);
  g.arc(c, c, r, -Math.PI / 2 - 0.5, -Math.PI / 2 + 0.5);
  g.closePath();
  g.fill();
  g.fillStyle = '#e8f4ff';
  g.beginPath();
  g.moveTo(c, c - 5);
  g.lineTo(c - 3.5, c + 4);
  g.lineTo(c + 3.5, c + 4);
  g.closePath();
  g.fill();
  for (let i = 0; i < n; i++) {
    const p = points[i];
    const x = c + p.x * r;
    const y = c - p.y * r;
    const big = p.kind === 'threat' ? 3.6 : 2.6;
    g.fillStyle = INK[p.kind] ?? '#fff';
    g.globalAlpha = p.rim ? 0.6 : 1;
    g.beginPath();
    g.arc(x, y, big, 0, Math.PI * 2);
    g.fill();
    if (p.up) g.fillRect(x - 0.75, p.up > 0 ? y - big - 5 : y + big, 1.5, 5);
    if (p.lock) {
      g.globalAlpha = 1;
      g.strokeStyle = '#fff';
      g.lineWidth = 1.4;
      g.beginPath();
      g.arc(x, y, big + 3.5, 0, Math.PI * 2);
      g.stroke();
    }
  }
  g.globalAlpha = 1;
  g.fillStyle = 'rgba(217,243,255,0.9)';
  g.font = look.font;
  g.textAlign = 'center';
  if (look.range !== range) {
    look.range = range;
    look.label = String(range);
  }
  g.fillText(look.label, c, c + r * 0.75 + 4);
}
