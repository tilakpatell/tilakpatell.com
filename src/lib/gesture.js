// The hands shared by the galaxy map (useMapView.js) and the universe
// chart (useChartView.js): a press that moves less than DRAG px is a click
// on what's under it; one that moves more is a pan (by the share of the box
// it moved) and the click it ends in is swallowed. A press begun with
// { orbit: true } gives { orbit } in the same shares instead of { pan }.
// Two fingers are a pinch, zoomed by how far apart they've gone, about
// where they started between them; each move also says how far the line
// between them turned (radians, clockwise on screen, wrapped to (-PI, PI])
// and how far their middle went down (a share of the box's height). The
// galaxy ignores turn and tilt. Pure: the hook feeds it pointer events.
export const DRAG = 5;

export function createGesture() {
  const ptrs = new Map(); // id → { x, y }
  let press = null; // { x, y, orbit }
  let pinch = null; // { d, u, w, a, my }
  let dragging = false;
  let swallow = false;
  let box = { left: 0, top: 0, width: 1, height: 1 }; // (the last rect it was given)
  // two fingers' pinch, from where they are now (the first two down)
  const seed = () => {
    const [a, b] = [...ptrs.values()];
    return { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, u: ((a.x + b.x) / 2 - box.left) / box.width, w: ((a.y + b.y) / 2 - box.top) / box.height, a: Math.atan2(b.y - a.y, b.x - a.x), my: (a.y + b.y) / 2 };
  };
  return {
    down(id, x, y, rect, opts = {}) {
      box = rect;
      ptrs.set(id, { x, y });
      if (ptrs.size === 1) {
        press = { x, y, orbit: !!opts.orbit };
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
        const f = d / pinch.d;
        pinch.d = d;
        // (atan2 gives the turn in (-PI, PI]; the difference of two is wrapped back into it)
        const ang = Math.atan2(b.y - a.y, b.x - a.x);
        let turn = ang - pinch.a;
        if (turn > Math.PI) turn -= 2 * Math.PI;
        else if (turn <= -Math.PI) turn += 2 * Math.PI;
        const my = (a.y + b.y) / 2;
        const tilt = (my - pinch.my) / rect.height;
        pinch.a = ang;
        pinch.my = my;
        return { zoom: f, u: pinch.u, w: pinch.w, turn, tilt };
      }
      if (!press) return null;
      if (!dragging && Math.hypot(x - press.x, y - press.y) < DRAG) return null;
      const key = press.orbit ? 'orbit' : 'pan';
      if (!dragging) {
        dragging = true;
        swallow = true;
        // (the first move past DRAG goes by all of it, from the press)
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
