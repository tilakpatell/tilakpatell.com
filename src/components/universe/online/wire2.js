// More of the wire between pilots (protocol.js's, which is near the size a
// file may be): pure readers for what the squads and the chat brought, each
// taking what a peer sent, untrusted, and giving back what may be believed,
// or null for junk. Tested in Node (wire2.test.js).
//
// In the site's room (client.js), beside protocol.js's words, with rates of
// their own (RATES2: [a second, at most at once], merged into the client's
// limiter as CLIENT_RATES):
//   inv  { s: sid }             to one pilot: come and fly with my squad (squad/invite.js's sid)
//   say  { t: text, s: 0 | 1 }  a line to everyone (s: 1) or to those in the same place (0),
//                               cleaned again as it comes in (chat/text.js, CHAT.everyoneMax)
//   qc   phrase id              a quick-chat phrase (chat/text.js's PHRASES), for those in the same place
// In a squad's own room (squad/squad.js), from its members:
//   pg   { k: kind, w: where, p: [x, y, z, sector?] or none, t: target or none }  a ping
//   qc   phrase id
//   ch   { c: sealed text }     (chat/seal.js)
//
// A point on the map goes as a pose's place does (protocol.js's writePose
// and readPose: the same rounding and the same clamps, and out in the
// Expanse x and z from its sector's middle, with the sector): [x, y, z,
// sector?]. writePoint({ x, y, z }) → that; readPoint(data) → { x, y, z,
// sec? } or null.
//
// readInvite(data) → { sid } | null; readSay(data) → { text, all } | null;
// readQuick(data) → a phrase id | null; readPing(data) → { kind, where, p:
// [x, y, z] or null, sec (the Expanse's sector, or null), target } | null;
// writePing({ kind, where, p ([x, y, z] or { x, y, z }, or none), target })
// → a ping's data, or null if it couldn't be one.

import { RATES, readPose, writePose } from './protocol';
import { cleanWhere } from './where';
import { cleanSid } from './squad/invite';
import { CHAT, cleanText, phrase } from './chat/text';

export const RATES2 = { inv: [0.2, 2], say: [0.5, 3], qc: [1, 3] };
export const CLIENT_RATES = { ...RATES, ...RATES2 };
export const PING_KINDS = ['go', 'help', 'foe', 'look'];
const TARGET = /^[\w:.-]{1,64}$/; // what a ping marks: a pilot's id, a hunter's, an NPC's

const isObject = (v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v);

// an invite as it came in: { sid }, or null
export function readInvite(data) {
  const sid = isObject(data) ? cleanSid(data.s) : null;
  return sid ? { sid } : null;
}

export function readSay(data) {
  if (!isObject(data) || (data.s !== 0 && data.s !== 1)) return null;
  const text = cleanText(data.t, CHAT.everyoneMax);
  return text ? { text, all: data.s === 1 } : null;
}

export const readQuick = (data) => (phrase(data) === null ? null : data);

export function writePoint({ x, y, z }) {
  const w = writePose({ x, y, z });
  return w.length > 10 ? [w[0], w[1], w[2], w[10]] : [w[0], w[1], w[2]];
}

export function readPoint(data) {
  if (!Array.isArray(data) || data.length < 3 || data.length > 4) return null;
  // (as the rest of a pose: still, level, shields up)
  const s = readPose([data[0], data[1], data[2], 0, 0, 0, 0, 0, 0, 100, ...data.slice(3)]);
  return s && { x: s.x, y: s.y, z: s.z, ...(s.sec ? { sec: s.sec } : {}) };
}

// what a ping marks, as it came in: a string id, a whole number, or none (null);
// undefined if it's junk
const readTarget = (t) => {
  if (t === undefined || t === null) return null;
  if (Number.isInteger(t) && t >= 0 && t < 1e9) return String(t);
  return typeof t === 'string' && TARGET.test(t) ? t : undefined;
};

export function readPing(data) {
  if (!isObject(data) || !PING_KINDS.includes(data.k)) return null;
  const where = cleanWhere(data.w);
  const point = data.p === undefined || data.p === null ? null : readPoint(data.p);
  const target = readTarget(data.t);
  if (!where || (data.p != null && !point) || target === undefined) return null;
  return { kind: data.k, where, p: point && [point.x, point.y, point.z], sec: point?.sec ?? null, target };
}

export function writePing({ kind, where, p = null, target = null } = {}) {
  const at = Array.isArray(p) ? { x: p[0], y: p[1], z: p[2] } : p;
  const data = { k: kind, w: where, ...(at ? { p: writePoint(at) } : {}), ...(target !== null && target !== undefined ? { t: target } : {}) };
  // (what goes out is read as what comes in is)
  return readPing(data) ? data : null;
}
