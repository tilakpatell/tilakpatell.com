// Other travellers in a walkable town: everyone online (the site's own
// switch, ../../universe/online/useOnline.js) who's walking the same town
// shows in yours as a ghost from another world, and you in theirs. Nothing
// passes between you but where each of you is: no one bumps into anyone,
// the Nazgûl don't see them, and your story's your own.
//
// Each town is a room of its own on the public Nostr relays the universe
// uses (../../universe/online/nostr.js). A traveller says who they are now
// and then, and where they are a few times a second while walking (once a
// second standing still); anyone not heard from in a while is gone.
//
// createTravellers({ town, name, bound, motion, hidden }) → { status, list(),
// pose(h, { inside, ring, ride, area }, { force }), rename(name), leave() };
// list() gives [{ id, name, x, z, face, moving, inside, ring, ride, area, at }] (and speed
// and y, with `motion`). `bound` is how far from the middle a town reaches, in
// metres; `force` sends a pose now (going indoors, say), whatever the pace.
// A world with areas of its own ground (rooms, zones, interiors, each with
// its own coordinates) says which one you're in with the pose's `area`, and
// list() gives only those in the same one (a world without areas: everyone).
// `hidden(id)` is true of anyone not to be shown (the site's roster has them
// blocked: a traveller's id is their id there too, nostr.js's visitKeys).

import { createLimiter } from '../../universe/online/protocol';
import { cleanName } from '../../universe/online/names';

export const APP_ID = 'tilakpatel-portfolio-towns';
const ROOM = (town) => `${town}-v1`;
const MOVING_MS = 200; // a pose this often while walking
const STILL_MS = 1000; // and this often standing still
const HELLO_MS = 8000; // who you are, again
export const QUIET_MS = 12000; // nothing heard this long: gone
export const MAX = 24; // travellers kept, at most
const RATES = { p: [8, 12], hi: [0.5, 3] };
const LATEST = new Set(['p']);
const CHEAP = new Set(['p']);
const loadRoom = () => import('../../universe/online/nostr').then((m) => m.joinAsVisitor);

const num = (v, lo, hi) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : null);
const r2 = (v) => Math.round(v * 100) / 100;

// [x, z, face, moving, flags], and back (flags: 1 indoors, 2 wearing the Ring,
// 4 riding something: a world's own vehicle, drawn instead of the walker).
// A world whose people run and jump (the Avengers compound) adds how fast
// and how high, [… speed, y], with `motion`; a town that doesn't never sees
// them. An area (a short id: letters, digits and dashes) comes last, after
// those (naught for a world without motion).
const AREA = /^[a-z0-9-]{1,24}$/i;
export const writeStep = (h, { inside = false, ring = false, ride = false, motion = false, area = null } = {}) => {
  const step = [r2(h.x), r2(h.z), r2(h.face), (h.speed ?? 0) > 0.4 ? 1 : 0, (inside ? 1 : 0) | (ring ? 2 : 0) | (ride ? 4 : 0)];
  if (motion) step.push(Math.round((h.speed ?? 0) * 10) / 10, r2(h.y ?? 0));
  else if (area) step.push(0, 0);
  if (area) step.push(area);
  return step;
};
export function readStep(data, bound = 200) {
  if (!Array.isArray(data) || data.length < 3) return null;
  const x = num(data[0], -bound, bound);
  const z = num(data[1], -bound, bound);
  const face = num(data[2], -10, 10);
  if (x == null || z == null || face == null) return null;
  const flags = Number.isInteger(data[4]) ? data[4] : 0;
  const step = { x, z, face, moving: data[3] === 1, inside: Boolean(flags & 1), ring: Boolean(flags & 2), ride: Boolean(flags & 4) };
  if (data.length >= 7) {
    // (Spider-Man swings at up to 40 m/s, and as high as the roofs and more)
    step.speed = num(data[5], 0, 45) ?? 0;
    step.y = num(data[6], 0, 80) ?? 0;
  }
  if (typeof data[7] === 'string' && AREA.test(data[7])) step.area = data[7];
  return step;
}

export function createTravellers({ town, name, load = loadRoom, now = () => Date.now(), bound = 200, motion = false, hidden = () => false }) {
  const peers = new Map();
  const limits = new Map();
  let me = { name: cleanName(name) ?? 'Traveller' };
  let room = null;
  let acts = {};
  let left = false;
  let status = 'connecting';
  let lastStep = -Infinity;
  let lastHello = -Infinity;
  let lastSent = null;
  let area = null; // the area you're in (a world with them)
  let timer = 0;
  const allow = (id, kind) => {
    if (!limits.has(id)) limits.set(id, createLimiter(RATES));
    return limits.get(id).allow(kind, now());
  };
  const sweep = () => {
    const t = now();
    for (const [id, p] of peers) if (t - p.at > QUIET_MS) peers.delete(id);
  };
  const hello = () => {
    lastHello = now();
    acts.hi?.send(me.name);
  };

  load()
    .then((joinRoom) => {
      if (left) return;
      room = joinRoom({ appId: APP_ID, latest: LATEST, cheap: CHEAP }, ROOM(town));
      acts = { hi: room.makeAction('hi'), p: room.makeAction('p') };
      acts.hi.onMessage = (data, { peerId }) => {
        if (!allow(peerId, 'hi')) return;
        const p = peers.get(peerId);
        const n = cleanName(typeof data === 'string' ? data : '') ?? 'Traveller';
        if (p) {
          p.name = n;
          p.at = now();
        } else if (peers.size < MAX) peers.set(peerId, { id: peerId, name: n, x: 0, z: 0, face: 0, moving: false, inside: true, ring: false, at: now(), placed: false });
        // someone new: say who you are straight back, so they needn't wait
        if (!p && now() - lastHello > 1000) hello();
      };
      acts.p.onMessage = (data, { peerId }) => {
        if (!allow(peerId, 'p')) return;
        const step = readStep(data, bound);
        if (!step) return;
        let p = peers.get(peerId);
        if (!p) {
          if (peers.size >= MAX) return;
          p = { id: peerId, name: 'Traveller', at: 0 };
          peers.set(peerId, p);
        }
        Object.assign(p, { area: null }, step, { at: now(), placed: true });
      };
      room.onPeerLeave = (id) => peers.delete(id);
      room.onStatus = (s) => {
        if (!left && status !== 'failed') status = s === 'online' ? 'online' : 'connecting';
      };
      room.ready
        .then(() => {
          if (left) return;
          status = 'online';
          hello();
          timer = setInterval(() => {
            sweep();
            if (now() - lastHello >= HELLO_MS) hello();
          }, 1000);
        })
        .catch(() => {
          if (!left) status = 'failed';
        });
    })
    .catch(() => {
      status = 'failed';
    });

  return {
    get status() {
      return status;
    },
    // the travellers here now, walking the town (not indoors)
    list() {
      sweep();
      return [...peers.values()].filter((p) => p.placed && (p.area ?? null) === area && !hidden(p.id));
    },
    // where you are: sent often while you walk, now and then when you don't
    pose(h, flags = {}, { force = false } = {}) {
      // (an area's yours at once, for who's listed; and goes out at once)
      const moved = (flags.area ?? null) !== area;
      area = flags.area ?? null;
      if (status !== 'online' || !acts.p) return;
      const t = now();
      const step = writeStep(h, { ...flags, motion });
      const changed = !lastSent || step.length !== lastSent.length || step.some((v, i) => v !== lastSent[i]);
      if (!force && !moved && t - lastStep < (changed ? MOVING_MS : STILL_MS)) return;
      lastStep = t;
      lastSent = step;
      acts.p.send(step);
    },
    rename(n) {
      me = { name: cleanName(n) ?? me.name };
      if (status === 'online') hello();
    },
    leave() {
      if (left) return;
      left = true;
      status = 'left';
      clearInterval(timer);
      room?.leave();
      peers.clear();
    },
  };
}
