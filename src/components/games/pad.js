// The first connected gamepad, read once a frame, with a dead zone so a
// resting stick reads as zero. Standard mapping: A/Cross 0, B/Circle 1,
// X/Square 2, Y/Triangle 3, LB 4, RB 5, LT 6, RT 7, Start 9.

const DEAD = 0.18;
const dz = (v) => (Math.abs(v) < DEAD ? 0 : (v - Math.sign(v) * DEAD) / (1 - DEAD));

// (read every frame by every world: the list is walked as it is, where two
// copies of it a frame were garbage with no pad in sight; a pad's own
// reading stays a new object, since the worlds keep the last one to find
// presses with edges())
export function readPad() {
  let pads = null;
  try {
    pads = navigator.getGamepads?.() ?? null;
  } catch {
    return null; // blocked by a permissions policy
  }
  if (!pads) return null;
  let p = null;
  for (let i = 0; i < pads.length; i++) {
    const g = pads[i];
    if (!g || !g.connected) continue;
    if (g.mapping === 'standard') {
      p = g;
      break;
    }
    p ??= g;
  }
  if (!p) return null;
  const b = (i) => Boolean(p.buttons[i]?.pressed);
  return {
    lx: dz(p.axes[0] ?? 0),
    ly: dz(p.axes[1] ?? 0),
    rx: dz(p.axes[2] ?? 0),
    ry: dz(p.axes[3] ?? 0),
    a: b(0),
    b: b(1),
    x: b(2),
    y: b(3),
    lb: b(4),
    rb: b(5),
    lt: b(6),
    rt: b(7),
    // how far each trigger is pulled, 0…1 (1 or 0 on a pad whose triggers only click)
    ltv: p.buttons[6]?.value ?? 0,
    rtv: p.buttons[7]?.value ?? 0,
    start: b(9),
    left: b(14),
    right: b(15),
    up: b(12),
    down: b(13),
  };
}

// Presses (not holds) since the last frame, for buttons that act once.
export function edges(now, before) {
  const out = {};
  if (!now) return out;
  for (const k of Object.keys(now)) if (typeof now[k] === 'boolean' && now[k] && !before?.[k]) out[k] = true;
  return out;
}

// A press since the last frame, or a stick off rest: the pad's first move
// (an episode's card goes at it, as at a key: rickmorty/adventure/EpisodeCard.jsx)
export const stirs = (now, before) => Boolean(now) && (Object.keys(edges(now, before)).length > 0 || Boolean(now.lx || now.ly || now.rx || now.ry));

// Whether a key press belongs to a text field (where the game keeps out).
export const typing = (t) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
