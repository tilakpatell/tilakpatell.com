// The other pilots over this planet: the flight's room (`fly-v1:<planetId>`,
// nostr.js's joinRoom heard by cell), what you say in it and what you hear.
// Your events carry the cell you're in (lib/net/cells.js, 2,048 m a side)
// and the room listens only for the 3 × 3 round it, asked again of the
// relays only when you cross a cell line, so a busy planet costs each
// browser the few ships near it. What comes in is read by flightProtocol.js
// (a pose has to be where its cell tag says) and rated by its limiter, a
// pilot each; anyone the site's roster has blocked (`hidden`) is not kept.
//
// A peer's ship is drawn a little in the past (DELAY), between the two poses
// either side, so it glides at ten poses a second; one not heard for
// STALE_MS (the universe's) is let go of, as a pilot who flies out of your
// cells stops being heard and goes quiet.
//
// createFlightOnline({ planetId, name, kind, load, now, hidden, radius }) → {
//   status ('connecting' | 'online' | 'failed' | 'off'), update(ship) (each
//   frame: the cell kept current, a pose POSE_MS apart at most), peers() →
//   [{ id, name, pose: { x, y, z, pitch, yaw, roll, speed }, at }],
//   shot(p, v), built(id, cellTag), gone(id), event(ev), cell(), selfId(),
//   on(fn) → off, stats(), leave() }
// events: { type: 'shot', id, p, v }, { type: 'built', id, cell, key },
//   { type: 'gone', id }, { type: 'event', event } (something happening, read
//   by flightProtocol's readEvent: lib/land/flight/director.js weighs it),
//   { type: 'joined', id } (a pilot new to you said hello: tell them what's on)

import { STALE_MS } from '../../universe/shared/online';
import { cellTag, netCellOf, netCellsAround, parseTag } from '../../../lib/net/cells';
import { EVENT_KINDS } from '../../../lib/land/flight/eventTables';
import { APP_ID, ROOM, flightLimiter, readBuilt, readEvent, readGone, readHi, readPose, readShot, writeEvent, writeHi, writePose, writeShot } from './flightProtocol';

export const POSE_MS = 100; // ten poses a second
const HELLO_MS = 8000; // who you are, again, for anyone who came in since
const DELAY = 140; // ms a peer is drawn behind its newest pose
export const MAX_PEERS = 32; // ships kept at most: a 3 × 3 of cells rarely holds more
const LATEST = new Set(['pose']); // only the newest pose of a bundle matters
const CHEAP = new Set(['pose', 'shot']); // trusted to the relays' own check of the signature
const KNOWN = new Set(EVENT_KINDS);
const loadRoom = () => import('../../universe/shared/room').then((m) => m.joinAsVisitor);

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const lerpAngle = (a, b, k) => a + wrap(b - a) * k;

// where a peer is at `t`, from its last two poses (each with `at`)
function easePose(a, b, t) {
  if (!a || t >= b.at) return b;
  const k = b.at > a.at ? Math.max(0, (t - a.at) / (b.at - a.at)) : 1;
  const lerp = (p, q) => p + (q - p) * k;
  return {
    x: lerp(a.x, b.x),
    y: lerp(a.y, b.y),
    z: lerp(a.z, b.z),
    pitch: lerpAngle(a.pitch, b.pitch, k),
    yaw: lerpAngle(a.yaw, b.yaw, k),
    roll: lerpAngle(a.roll, b.roll, k),
    speed: lerp(a.speed, b.speed),
    at: t,
  };
}

export function createFlightOnline({ planetId, name, kind = 'wedge', load = loadRoom, now = () => Date.now(), hidden = () => false, radius = 1 }) {
  const peers = new Map(); // id → { id, name, prev, last }
  const limits = new Map();
  const listeners = new Set();
  let room = null;
  let acts = {};
  let status = 'connecting';
  let left = false;
  let key = null; // the cell you're in, 'cx,cz'
  let listening = null; // the tags asked for
  let lastPose = -Infinity;
  let lastHello = -Infinity;
  const counts = { poses: 0, dropped: 0 };
  const emit = (e) => listeners.forEach((fn) => fn(e));
  const allow = (id, k) => {
    if (!limits.has(id)) limits.set(id, flightLimiter());
    return limits.get(id).allow(k, now());
  };
  const unseen = (id) => {
    if (!hidden(id)) return false;
    peers.delete(id);
    return true;
  };
  const peerOf = (id) => {
    let p = peers.get(id);
    if (!p && peers.size < MAX_PEERS) peers.set(id, (p = { id, name: 'Pilot', prev: null, last: null }));
    return p ?? null;
  };
  const hello = () => {
    lastHello = now();
    acts.hi?.send(writeHi({ name, kind }));
  };
  const sweep = () => {
    const t = now();
    for (const [id, p] of peers) if (!p.last || t - p.last.at > STALE_MS) peers.delete(id);
  };

  load()
    .then((join) => {
      if (left) return;
      room = join({ appId: APP_ID, latest: LATEST, cheap: CHEAP, cells: () => listening }, ROOM(planetId));
      for (const ns of ['hi', 'pose', 'shot', 'built', 'gone', 'event']) acts[ns] = room.makeAction(ns);
      acts.hi.onMessage = (data, { peerId }) => {
        if (unseen(peerId) || !allow(peerId, 'hi')) return;
        const hi = readHi(data);
        const p = hi && peerOf(peerId);
        if (!p) return;
        const fresh = p.name === 'Pilot' && !p.last;
        p.name = hi.name;
        // someone new: who you are straight back, so they needn't wait
        if (fresh && now() - lastHello > 1000) hello();
        if (fresh) emit({ type: 'joined', id: peerId });
      };
      acts.pose.onMessage = (data, { peerId, tag }) => {
        if (unseen(peerId) || !allow(peerId, 'pose')) return;
        const pose = readPose(data, tag, planetId);
        if (!pose) return void counts.dropped++;
        const p = peerOf(peerId);
        if (!p) return;
        counts.poses++;
        p.prev = p.last;
        p.last = { ...pose, at: now() };
      };
      acts.shot.onMessage = (data, { peerId }) => {
        if (unseen(peerId) || !allow(peerId, 'shot')) return;
        const shot = readShot(data, peers.get(peerId)?.last ?? null);
        if (shot) emit({ type: 'shot', id: peerId, ...shot });
      };
      acts.built.onMessage = (data, { peerId }) => {
        if (unseen(peerId) || !allow(peerId, 'built')) return;
        const b = readBuilt(data);
        const at = b && parseTag(b.cell);
        // (a hint for another planet's cell names nothing here)
        if (at?.planetId === planetId) emit({ type: 'built', id: b.id, cell: b.cell, key: `${at.cx},${at.cz}` });
      };
      acts.gone.onMessage = (data, { peerId }) => {
        if (unseen(peerId) || !allow(peerId, 'gone')) return;
        const g = readGone(data);
        if (g) emit({ type: 'gone', id: g.id });
      };
      acts.event.onMessage = (data, { peerId }) => {
        if (unseen(peerId) || !allow(peerId, 'event')) return;
        const ev = readEvent(data, KNOWN);
        if (ev) emit({ type: 'event', event: ev });
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
      return left ? 'off' : status;
    },
    update(ship) {
      if (left || !room) return;
      const [cx, cz] = netCellOf(ship.x, ship.z);
      const next = `${cx},${cz}`;
      if (next !== key) {
        key = next;
        room.setCell(cellTag(planetId, key));
        listening = netCellsAround(cx, cz, radius).map((k) => cellTag(planetId, k));
        room.setCells(listening);
      }
      if (status !== 'online') return;
      const t = now();
      if (t - lastPose >= POSE_MS) {
        lastPose = t;
        acts.pose.send(writePose(ship));
      }
      if (t - lastHello >= HELLO_MS) hello();
    },
    peers() {
      sweep();
      const t = now() - DELAY;
      const out = [];
      for (const p of peers.values()) if (p.last && !hidden(p.id)) out.push({ id: p.id, name: p.name, pose: easePose(p.prev, p.last, t), at: p.last.at });
      return out;
    },
    shot(p, v) {
      if (status === 'online') acts.shot?.send(writeShot(p, v));
    },
    built(id, cell) {
      if (status === 'online') acts.built?.send({ id, cell });
    },
    gone(id) {
      if (status === 'online') acts.gone?.send({ id });
    },
    // something happening, as lib/land/flight/director.js's wire() gives it
    event(ev) {
      if (status === 'online') acts.event?.send(writeEvent(ev));
    },
    // the cell you're in as the room tags it (null before the first update)
    cell: () => (key ? cellTag(planetId, key) : null),
    // your id in the room (the visit's key: a turret you build carries it, so it never fires at you)
    selfId: () => room?.selfId ?? null,
    on(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    stats: () => ({ ...counts, peers: peers.size, offCell: room?.stats?.().offCell ?? 0 }),
    leave() {
      if (left) return;
      left = true;
      listeners.clear();
      peers.clear();
      room?.leave();
    },
  };
}
