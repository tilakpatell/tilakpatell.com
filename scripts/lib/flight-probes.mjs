/* global window, document */
// The flight checks' hands in the page (scripts/flight-probe.mjs and
// universe-check.mjs --lock): a hunter put where the guns can see it and
// locked by hand, the HUD's overlay read back, what's in flight counted,
// and who takes a shot recorded. Every function but lockSpot runs in the
// page, through the scenes' DEV hooks (window.__universeDebug,
// window.__galaxyDebug), and calls the hooks' objects by property at call
// time, so a wrap here sees what the scene does. pageScript() is all of
// them as one script for the page; in Node they run against a fake window
// (flight-probes.test.mjs).

// where a held lock's hunter sits: ahead of the nose, a little up and to
// the right, so the bracket is clear of the reticle
export const LOCK_SPOT = { ahead: 6, up: 0.6, right: 1.2 };

export function lockSpot(ship, spot = LOCK_SPOT) {
  const h = ship.heading || 0;
  // (the nose along −z at heading 0, its right +x: universe/ship.js's frame)
  const [fx, fz] = [-Math.sin(h), -Math.cos(h)];
  const [rx, rz] = [Math.cos(h), -Math.sin(h)];
  return { x: ship.x + fx * spot.ahead + rx * spot.right, y: ship.y + spot.up, z: ship.z + fz * spot.ahead + rz * spot.right };
}

// the hunters' clock stopped (once): a hunter put somewhere stays there and
// never fires, whatever the frame's dt
export function freeze(hook = '__universeDebug') {
  const h = window[hook]?.hunters;
  if (!h || h.update.stopped) return;
  const real = h.update;
  const still = (dt, ...rest) => real.call(h, 0, ...rest);
  still.stopped = true;
  h.update = still;
}

// a TIE at `at`, still, facing the ship, locked by hand
export function forceLock(at) {
  const d = window.__universeDebug;
  if (window.__universe().foot) return { skipped: 'on foot' };
  const h = d.hunters;
  if (!h) return { skipped: 'no hunters' };
  const s = d.state.ship;
  h.pack('empire', s, { size: 1, ace: false, kinds: ['tie'], more: 0 });
  const b = h.bodies.at(-1);
  Object.assign(b.at, at);
  Object.assign(b.prev, at);
  // (a crawl toward the ship: its model turns to face it)
  Object.assign(b.vel, { x: (s.x - at.x) * 0.002, y: (s.y - at.y) * 0.002, z: (s.z - at.z) * 0.002 });
  freeze('__universeDebug');
  d.state.lock = { id: b.id, out: 0, manual: true };
  return { id: b.id, at: [at.x, at.y, at.z] };
}

export function lockHeld(id) {
  return window.__universe().lock === id;
}

// the overlay's marks as drawn: each span of .universe-hud, in order
export function overlay() {
  const marks = [];
  for (const el of document.querySelectorAll('.universe-hud > span')) {
    const c = el.classList[0];
    if (!el.hasAttribute('data-on')) {
      marks.push({ c, on: false });
      continue;
    }
    const v = (k) => el.style.getPropertyValue(k) || null;
    marks.push({ c, on: true, off: el.hasAttribute('data-off'), hot: el.hasAttribute('data-hot'), hit: el.hasAttribute('data-hit'), tough: el.hasAttribute('data-tough'), t: el.style.transform || null, r: v('--r'), a: v('--a'), hp: v('--hp'), text: el.textContent });
  }
  return marks;
}

// heavy rounds and bolts in flight (shown): rounds.js's and the scene's pools
export function inFlight(hook = '__universeDebug') {
  let rounds = 0;
  let bolts = 0;
  window[hook].scene.traverse((o) => {
    if (!o.isMesh || !o.visible) return;
    if (o.userData?.heavy === true) rounds++;
    else if (o.userData?.heavy === false) bolts++;
  });
  return { rounds, bolts };
}

// who is asked about a shot (window.__asked: hunter, pilot, citadel, rock)
// and who takes one, in order (window.__takers)
export function recordTakers(hook = '__universeDebug') {
  const d = window[hook];
  window.__asked = { hunter: 0, pilot: 0, citadel: 0, rock: 0 };
  window.__takers = [];
  const wrap = (o, key, name, any = false) => {
    if (!o || typeof o[key] !== 'function' || o[key].recorded) return;
    const real = o[key];
    const f = (...a) => {
      window.__asked[name]++;
      const r = real.apply(o, a);
      // (the Citadel's strike answers with what happened, or nothing on a shield already up: asked at all, it took it)
      if (r || any) window.__takers.push(name);
      return r;
    };
    f.recorded = true;
    o[key] = f;
  };
  wrap(d.hunters, 'hit', 'hunter');
  wrap(d.pilots, 'hit', 'pilot');
  wrap(d.siege, 'strike', 'citadel', true);
  wrap(d.meteors, 'hit', 'rock');
}

// The Citadel, a rock and a hunter in a line ahead of the ship, held still
// (the order a bolt's sources are asked in shows in who takes it): the
// ship `r` + 0.6 out from the Citadel's middle (r: its shield, or `from`),
// facing in; the rock and, with `hunter`, a TIE locked by hand at r − 0.1.
export async function stack({ from = null, hunter = true, line = 0 } = {}) {
  const d = window.__universeDebug;
  const u = window.__universe();
  const C = d.citadelGeo.center;
  const n = [0.6, 0, 0.8];
  const r = from ?? d.citadelGeo.shield;
  const at = (k) => ({ x: C[0] + n[0] * k, y: C[1] + n[1] * k, z: C[2] + n[2] * k });
  if (!d.meteors.count) d.meteors.storm(d.state.ship);
  d.hunters?.clear();
  d.state.lock = null;
  d.state.ship = { ...d.state.ship, ...at(r + 0.6), heading: Math.atan2(0.6, 0.8), pitch: 0, bank: 0, speed: 0, vy: 0, lift: 0, rate: 0, tipRate: 0, rollRate: 0 };
  d.state.held = { name: 'flight-probe', view: null };
  // (the jump there swept first: a rock on its way would hit the ship)
  await u.frames(2);
  const P = at(r - 0.1);
  const rocks = d.meteors.targets;
  for (const o of rocks) {
    o.vel.set(0, 0, 0);
    if (o !== rocks[0]) o.at.set(0, 10000, 0);
  }
  rocks[0].at.set(P.x, P.y, P.z);
  // (clear of the ship's own reach: a bigger one this near meets the ship)
  rocks[0].size = 0.25;
  if (hunter) forceLock(P);
  d.arms().select(line);
  await u.frames(2);
  return { rock: rocks[0].id, lock: window.__universe().lock };
}

// the ship pointed at the sun's face, at speed: a crash on the next frames
export function intoTheSun() {
  const d = window.__universeDebug;
  d.state.held = null;
  d.state.ship = { ...d.state.ship, x: 0, y: 0.3, z: 75.45, heading: 0, pitch: 0, bank: 0, speed: 12, vy: 0, lift: 0, rate: 0, tipRate: 0, rollRate: 0 };
}

// a unique weapon fitted on its line and picked (as if bought and its skill taken)
export function fitUnique(hook, id) {
  const d = window[hook];
  const slot = id === 'seismic' || id === 'crystal' ? 'ordnance' : 'secondary';
  const a = d.arms();
  a.refit({ ...d.state.loadout, [slot]: id }, { ...d.state.fx, arms: [...(d.state.fx?.arms ?? []), id] });
  a.select(slot === 'ordnance' ? 2 : 1);
  return a.id ?? a.weapon?.id ?? null;
}

// all of the page's functions as one script, for page.addScriptTag: window.__fp
export function pageScript() {
  const fns = [freeze, forceLock, lockHeld, overlay, inFlight, recordTakers, stack, intoTheSun, fitUnique];
  return `(() => { ${fns.map((f) => f.toString()).join('\n')}\nwindow.__fp = { ${fns.map((f) => f.name).join(', ')} }; })();`;
}
