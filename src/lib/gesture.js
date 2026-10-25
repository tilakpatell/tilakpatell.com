// The maps' hands, shared by the galaxy map's useMapView.js and the universe
// chart's useChartView.js: a press that moves less than DRAG px is a click on
// what's under it; one that moves more is a pan (by the share of the box it
// moved) and the click it ends in is swallowed; a press begun with the
// modifier (down's { orbit: true }) is the same drag but says `orbit`, for a
// view that turns and tilts instead. Two fingers are a pinch, zoomed by how far
// apart they've gone, about where they started between them; they also say how
// far the line between them turned (`turn`, radians, clockwise on screen) and
// how far their middle moved up or down (`tilt`, the share of the box's height,
// down positive), each since the last move. Pure: the hook feeds it pointer
// events, and a map that doesn't turn ignores what it doesn't use.
export const DRAG = 5;

// (an angle's change, wrapped to (−π, π]: a line turning across the left is a small turn, not nearly a whole one)
const wrap = (a) => a - 2 * Math.PI * Math.ceil((a - Math.PI) / (2 * Math.PI));

export function createGesture() {
  const ptrs = new Map(); // id → { x, y }
  let press = null; // { x, y, orbit }
  let pinch = null; // { d, u, w, a, my }
  let dragging = false;
  let swallow = false;
  let box = { left: 0, top: 0, width: 1, height: 1 }; // (the last rect it was given)
  // two fingers' pinch, from where they are now (the first two down): apart, the middle, the line's angle
  const seed = () => {
    const [a, b] = [...ptrs.values()];
    return { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, u: ((a.x + b.x) / 2 - box.left) / box.width, w: ((a.y + b.y) / 2 - box.top) / box.height, a: Math.atan2(b.y - a.y, b.x - a.x), my: (a.y + b.y) / 2 };
  };
  return {
    down(id, x, y, rect, opts = {}) {
      box = rect;
      ptrs.set(id, { x, y });
      if (ptrs.size === 1) {
        press = { x, y, orbit: Boolean(opts.orbit) };
        dragging = false;
        swallow = false;
      } else if (ptrs.size === 2) {
        pinch = seed();
        swallow = true;
      }
    },
    move(id, x, y, rect) {
      const p = ptrs.get(id);
      if (!p) return null;
      box = rect;
      const dx = x - p.x;
      const dy = y - p.y;
      p.x = x;
      p.y = y;
      if (ptrs.size > 2) return null; // (three fingers or more: nothing to do till one lifts)
      if (pinch && ptrs.size === 2) {
        const [a, b] = [...ptrs.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
        const angle = Math.atan2(b.y - a.y, b.x - a.x);
        const my = (a.y + b.y) / 2;
        const f = d / pinch.d;
        const turn = wrap(angle - pinch.a);
        const tilt = (my - pinch.my) / rect.height;
        pinch.d = d;
        pinch.a = angle;
        pinch.my = my;
        return { zoom: f, u: pinch.u, w: pinch.w, turn, tilt };
      }
      if (!press) return null;
      if (!dragging && Math.hypot(x - press.x, y - press.y) < DRAG) return null;
      const key = press.orbit ? 'orbit' : 'pan';
      if (!dragging) {
        dragging = true;
        swallow = true;
        // (the first move past DRAG drags by all of it, from the press)
        return { [key]: [(x - press.x) / rect.width, (y - press.y) / rect.height] };
      }
      return { [key]: [dx / rect.width, dy / rect.height] };
    },
    up(id) {
      if (!ptrs.delete(id)) return; // (a press it never saw)
      if (ptrs.size < 2) pinch = null;
      // (from three fingers, the two left pinch from where they are now, not from the old pair)
      else if (ptrs.size === 2) pinch = seed();
      if (!ptrs.size) press = null;
      // (the finger left after a pinch pans from where it is now, not from its first press)
      else if (ptrs.size === 1) press = { ...[...ptrs.values()][0] };
    },
    cancel(id) {
      ptrs.delete(id);
      pinch = null;
      press = null;
      dragging = false;
    },
    takeClick() {
      const s = swallow;
      swallow = false;
      return s;
    },
    get dragging() {
      return dragging;
    },
    // (whether a pointer is down: the hook reads the box's rect only then, not on every move of a mouse that's just passing)
    get active() {
      return ptrs.size > 0;
    },
  };
}
