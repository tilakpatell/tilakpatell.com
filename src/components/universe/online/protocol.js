// Multiplayer on the universe map, as plain rules: what goes over the wire
// between pilots and how anything that comes in is read. Pure (no three.js,
// no network), so it's tested in Node; client.js does the talking (through
// nostr.js's relays) and pilots.js draws everyone else.
//
// Everything a peer sends is untrusted: a name is cleaned before it's shown
// (and only ever set as text), numbers are checked and clamped, each pilot
// may send only so much of each kind of message (createLimiter: past that
// it's dropped, and a flood gets them muted), and a hit is believed only
// from someone who isn't an ally, fired a shot that would have passed near
// you a moment ago (aimedAt), was close enough, and isn't hitting faster
// than the guns fire; a ram only from someone who isn't an ally and was last
// seen touching you, as hard as both your speeds allow (ramCounts). The
// hunters after a pilot are theirs to fly: what they
// say of them is only drawn, and a hit on one of yours by someone else is
// believed only from a pilot who's here, has just fired and is close to it
// (any pilot here can still clear your hunters for you: that's the point).
//
// The wire, by action:
//   hi    { n: name, k: ship kind or null, p: its paint job, o: its parts
//           (outfit.js), b: its garage build (shipyard/build.js's ids) or
//           none, l: [Rick's look, Morty's] (wardrobe/looks.js's ids) or
//           none, lb: [Walt’s look, Jesse’s] or none, c: kills, w: where
//           on the site, lv: level (economy.js's, 1 to 11), f: factions
//           { s: side (sides.js), st: { law, civil, outlaw } standing.js's
//           level names, w: war, o: the side sworn to in it (galaxy/sides.js),
//           r: rank on that side (galaxy/ranks.js) } or none; a build older
//           than these sends neither: level 1, nobody's }  on joining, and on any change
//   pose  [x, y, z, heading, pitch, bank, speed, vy, flags, shields, sec?]  ten times a second while flying
//         (sec: out in the Expanse, its sector, 'E:sx,sz', and x and z then
//         from that sector's middle; without it, the authored map's, as ever)
//         (flags: hidden, boosting, safe: just back, your hits don't count, and
//         lane, from when there were hyperlanes: read by nothing now)
//   shot  [x, y, z, vx, vy, vz, w?]                      a bolt fired (for drawing it); w: the
//                                                       weapon (weapons.js's code), 0 if left off
//   hit   { d: damage }                                  to the pilot a bolt of yours hit (up to
//                                                       DAMAGE_MAX, a heavy round's)
//   ram   { v: closing speed }                           to the pilot you flew into (they take it off
//                                                       their own shields by the contact law,
//                                                       lib/combat/contact.js, at no more than both
//                                                       your speeds allow: ramCounts)
//   down  { b: who shot you down }                       to everyone, when your shields go
//   pack  [[id, kind, x, y, z, vx, vy, vz, hits left], …] five times a second while hunters are
//                                                       after you and someone's there to see ([]: gone)
//   hhit  { i: hunter id, d: damage }                    to the pilot a hunter's after, when a bolt of yours hit it
//   ally  { t: 'ask' | 'yes' | 'no' | 'end', k?: 1 }     to one pilot (k: an ask from a pilot who has
//                                                       you saved as an ally, allies.js: one who has
//                                                       them saved too says yes without asking)
//   foot  { p: planet, k: ship kind, s: [n, f] where it's parked, a: walker, b: walker or null }
//         ten times a second while your crew are down on a planet ({ p: null }: back in);
//         a walker is [who, n (3), f (3), h, speed, side, aim] (footScene.js, foot.js)
//   siege { e, m, t, x, l, i }                           the Citadel's siege (siege.js): its epoch,
//                                                       your share of each part's damage, the
//                                                       totals you know, when it went up, the last
//                                                       hit; your siege id, the same through a reload
//   war   { e, m, t, i }                               the galaxy's war (galaxy/gcw.js, a tally.js
//                                                       message): the campaign, your points and the
//                                                       totals you know, a page of TALLY.keys at a
//                                                       time, now and then from anywhere; your
//                                                       tally id, the same through a reload
//   fight { e, m, t }                                  the battle where you are (galaxy/warfront.js):
//                                                       its id, your damage on its objectives, the totals
//   cur   [x, y, touch]                                  off the universe map: your pointer
//                                                       (x from the middle of the window, y
//                                                       down the page, in px), or with touch
//                                                       where you're reading

import { parseShip } from '../crews';
import { FOOT, METRE } from '../foot';
import { readOutfit } from '../outfit';
import { readBuildWire } from '../shipyard/build';
import { CASTS, defaultLook, readLookWire, writeLook } from '../../rickmorty/wardrobe/looks';
import { byId } from '../universes';
import { KINDS as HUNTERS } from '../../galaxy/hunted';
import { fromAngles, slerp, toAngles } from '../orient';
import { cleanWhere } from './where';
import { inExpanse, sectorOf } from '../layout';
import { SECTOR, parseSector, sectorCentre } from '../../expanse/gen/grid';
import { cleanName } from './names';
import { LEVELS as XP_LEVELS } from '../economy';
import { SIDES } from '../sides';
import { AXES, LEVELS as STANDING_LEVELS } from '../standing';
import { SIDES as WAR_SIDES, WARS, warOfSide } from '../../galaxy/sides';
import { RANKS } from '../../galaxy/ranks';
import { STANCE_IDS } from '../../galaxy/surface/combatRules';
import { NO_FACTIONS } from './relations';
import { motionPacket, readEmoteWire, readMotion } from '../../../lib/emote';
import { WEAPONS, byCode } from '../weaponTable';
import { CONTACT } from '../../../lib/combat/contact';

export { NAME_MAX, cleanName, randomCallsign } from './names';

export const APP_ID = 'tilakpatel-portfolio-universe';
// (v2: the home system grew, scale.js; a pilot on an older build would be
// drawn parked where its stations used to be)
export const ROOM = 'universe-v2';
export const POSE_MS = 100; // how often a pose goes out
export const CURSOR_MS = 80; // and a pointer, off the map
export const STALE_MS = 2500; // a ship with no pose this long is hidden
export const PACK_MS = 200; // how often the hunters after you go out
export const PACK_MAX = 8; // hunters in one of those, at most
export const PUNCH_MAX = 24; // hits one shot is worth on a hunter, at most (a heavy round, weapons.js, from a fusion-fitted ship)
export const DAMAGE = 10; // a bolt from another pilot (a hunter's laser is 12)
export const DAMAGE_MAX = 30; // a heavy round from another pilot (weapons.js)
export const BOLT_LIFE = 1.1; // seconds a bolt flies, at the most (targeting.js's AIM.life, with room to spare)
export const GUARD = {
  shotWindow: 1500, // ms: a hit counts only this soon after a shot from the same pilot
  gap: 90, // ms between hits from one pilot (the fastest guns, the X-wing's, fire every 120)
  range: 70, // map units: further off than this, they couldn't have hit you
  near: 2, // map units: how close a shot's path must pass you (more, the faster you go)
  killWindow: 3000, // ms: a kill is believed only this soon after the killer's shot or hit
  reach: 95, // map units: further than this from one of your hunters, they couldn't have hit it (a bolt at the boost goes 85)
  ramNear: 1.5, // map units: how far apart a rammer's last pose and you may be (two ships touching, and a little)
  ramLag: 0.35, // s: and more for each unit a second of your speeds together (a pose is up to 100 ms old, then the trip)
};
export const RAM_MAX = 600; // a closing speed, at most (two ships head on, on the pulse drive)
// how many of each message one pilot may send: [a second, at most at once]
export const RATES = { pose: [20, 30], foot: [20, 30], walk: [20, 30], cur: [25, 40], shot: [10, 12], hit: [10, 12], ram: [3, 4], siege: [2, 6], war: [0.5, 3], fight: [2, 6], hi: [1, 4], ally: [0.5, 3], down: [0.4, 2], pack: [8, 12], hhit: [10, 12] }; // (the X-wing fires 8 a second)
export const FLOOD = { denied: 60, window: 5000 }; // turned away this often in this long: muted
export const FLAG = { hidden: 1, boost: 2, safe: 4, lane: 8 };
// how far out a pilot can be, level, and how fast they can go: the universe
// spread four times wider (scale.js's SPREAD: places reach 36,000 out, the
// Rick and Morty sector sits at z −48,000) and the fastest ever ran at
// 4,000 a second, so a little past both
export const FAR = 60000;
export const FAST = 5000;

const num = (v, lo, hi) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : null);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// a hello: { name, kind, loadout, build, looks, kills, where }, or null if it
// isn't one (a loadout is only ever outfit.js's ids, never a colour or a
// shape: the factory's for anything else, or from a pilot whose site is
// older than the hangar; a build only ever shipyard/parts.js's modules, or
// null, the stock ship)
export function readHello(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  return { name: cleanName(data.n) ?? 'Pilot', kind: parseShip(data.k), loadout: readOutfit(data.o, data.p), build: readBuildWire(data.b), looks: readLooksWire(data), kills: Math.floor(num(data.c, 0, 9999) ?? 0), where: cleanWhere(data.w), level: Math.floor(num(data.lv, 1, XP_LEVELS.length) ?? 1), factions: readFactions(data.f) };
}

// A pilot's factions (relations.js's shape), for a hello's `f`: only what
// there is to say goes, and nothing at all for nobody's
export function writeFactions({ side = null, standing = null, war = null, oath = null, rank = null } = {}) {
  const st = side && standing ? Object.fromEntries(AXES.filter((a) => standing[a]).map((a) => [a, standing[a]])) : null;
  const out = { ...(side ? { s: side } : {}), ...(st && Object.keys(st).length ? { st } : {}), ...(war ? { w: war } : {}), ...(oath ? { o: oath } : {}), ...(rank ? { r: rank } : {}) };
  return Object.keys(out).length ? out : null;
}

// a hello's `f` as it came in: each field an id from the lists we have, or
// null (a rank only on the side sworn to, an oath only to a side of the war
// named, a standing only with a side to have it with)
const named = (v, list) => (typeof v === 'string' && Object.hasOwn(list, v) ? v : null);
const standingName = (axis, v) => (typeof v === 'string' && STANDING_LEVELS[axis].some(([, name]) => name === v) ? v : null);
function readFactions(f) {
  if (!f || typeof f !== 'object' || Array.isArray(f)) return { ...NO_FACTIONS };
  const side = named(f.s, SIDES);
  const standing = side && f.st && typeof f.st === 'object' && !Array.isArray(f.st) ? Object.fromEntries(AXES.map((a) => [a, standingName(a, f.st[a])])) : null;
  const war = named(f.w, WARS);
  const sworn = named(f.o, WAR_SIDES);
  const oath = sworn && warOfSide(sworn) && (!war || warOfSide(sworn) === war) ? sworn : null;
  const rank = oath && typeof f.r === 'string' && RANKS[oath]?.some((r) => r.id === f.r) ? f.r : null;
  return { side, standing, war, oath, rank };
}

// Each cast’s pair of looks under a key of its own (Rick and Morty’s under
// `l`, as it always was, so a pilot whose site knows only them still reads
// theirs), and none for a pair both as the show has them (there’s nothing
// to tell: that’s how they’re shown anyway). → { l, lb } for a hello, from
// looks.js’s { rick, morty, walt, jesse }
const LOOK_WIRE = { rickmorty: 'l', breakingbad: 'lb' };
const plain = (who, look) => JSON.stringify(writeLook(look)) === JSON.stringify(writeLook(defaultLook(who)));
export function writeLooksWire(looks) {
  if (!looks) return {};
  const sent = Object.entries(LOOK_WIRE).filter(([cast]) => CASTS[cast].every((who) => looks[who]) && !CASTS[cast].every((who) => plain(who, looks[who])));
  return Object.fromEntries(sent.map(([cast, k]) => [k, CASTS[cast].map((who) => writeLook(looks[who]))]));
}
// their looks, cast by cast, or null (none sent, or nothing that could be
// one); in a pair that’s read, one that can’t be is as the show has him
function readLooksWire(data) {
  let out = null;
  for (const [cast, k] of Object.entries(LOOK_WIRE)) {
    const who = CASTS[cast];
    const pair = data[k];
    if (!Array.isArray(pair) || pair.length !== who.length) continue;
    const got = Object.fromEntries(who.map((w, i) => [w, readLookWire(w, pair[i])]));
    if (who.every((w) => !got[w])) continue;
    for (const w of who) got[w] ??= defaultLook(w);
    out = { ...out, ...got };
  }
  return out;
}

export const writeCursor = (x, y, touch = false) => [Math.round(x), Math.round(y), touch ? 1 : 0];

// a pointer as it came in: { x, y, touch }, or null
export function readCursor(data) {
  if (!Array.isArray(data) || data.length < 3) return null;
  const x = num(data[0], -5000, 5000);
  const y = num(data[1], 0, 500000);
  if (x === null || y === null) return null;
  return { x, y, touch: data[2] === 1 };
}

// what goes out as a pose, from ship.js's numbers (and the shields, 0 to
// 100); the bank with the lean into a turn on it, so others see that too
export function writePose(s, flags = 0, shield = 100) {
  const r = (v, k = 1000) => Math.round((v || 0) * k) / k;
  const sec = sectorOf(s.x || 0, s.y || 0, s.z || 0);
  const o = inExpanse(sec) ? sectorCentre(...parseSector(sec)) : null;
  const out = [r(s.x - (o?.[0] ?? 0), 100), r(s.y, 100), r(s.z - (o?.[2] ?? 0), 100), r(s.heading), r(s.pitch), r(wrap((s.bank || 0) + (s.lean || 0))), r(s.speed, 100), r(s.vy, 100), flags | 0, Math.round(shield)];
  if (o) out.push(sec);
  return out;
}
// how far from its sector's middle an Expanse pose may be (its half and a margin)
const SEC_FAR = SECTOR / 2 + 2000;

// a pose as it came in: { x, y, z, heading, pitch, bank, speed, vy, hidden,
// boost, safe, lane, shield, sec? }, or null if it isn't one (out past deep space's
// edge, it's clamped; an older pilot's never has the lane bit, so reads not riding).
// x and z are the map's: an Expanse pose's are put back from its sector's
// middle (and `sec` kept); one without a sector is the authored map's.
export function readPose(data) {
  if (!Array.isArray(data) || data.length < 9) return null;
  const at = data.length > 10 ? parseSector(data[10]) : null;
  const sec = at && inExpanse(data[10]) ? data[10] : null;
  const o = sec ? sectorCentre(...at) : null;
  const lx = o ? num(data[0], -SEC_FAR, SEC_FAR) : num(data[0], -FAR, FAR);
  const y = num(data[1], -1300, 1300);
  const lz = o ? num(data[2], -SEC_FAR, SEC_FAR) : num(data[2], -FAR, FAR);
  const x = lx === null ? null : lx + (o?.[0] ?? 0);
  const z = lz === null ? null : lz + (o?.[2] ?? 0);
  const heading = num(data[3], -100, 100);
  if (x === null || y === null || z === null || heading === null) return null;
  const flags = Math.floor(num(data[8], 0, 255) ?? 0);
  return {
    x,
    y,
    z,
    heading: wrap(heading),
    pitch: num(data[4], -1.6, 1.6) ?? 0,
    bank: wrap(num(data[5], -4, 4) ?? 0), // (all the way round: upside down is ±π)
    speed: num(data[6], -FAST, FAST) ?? 0,
    vy: num(data[7], -300, 300) ?? 0,
    hidden: Boolean(flags & FLAG.hidden),
    boost: Boolean(flags & FLAG.boost),
    safe: Boolean(flags & FLAG.safe),
    lane: Boolean(flags & FLAG.lane),
    shield: num(data[9], 0, 100) ?? 100,
    ...(sec ? { sec } : {}),
  };
}

export const writeShot = (p, v, w = 0) => {
  const out = [p.x, p.y, p.z, v[0], v[1], v[2]].map((n) => Math.round(n * 1000) / 1000);
  if (w) out.push(w);
  return out;
};

// a shot as it came in: { p: [x, y, z], v: [vx, vy, vz] }, or null; it has
// to start near where the pilot was last seen (`from`, a pose, if known)
export function readShot(data, from = null) {
  if (!Array.isArray(data) || data.length < 6) return null;
  // (anywhere in the universe; its speed's checked just below)
  const n = data.slice(0, 6).map((v, i) => (i < 3 ? num(v, -FAR, FAR) : num(v, -7500, 7500)));
  if (n.some((v) => v === null)) return null;
  if (Math.hypot(n[3], n[4], n[5]) > 800) return null;
  // (as far as it could have gone since that pose, on the pulse drive)
  if (from && Math.hypot(n[0] - from.x, n[1] - from.y, n[2] - from.z) > 6 + Math.abs(from.speed ?? 0) * 0.3) return null;
  // (a code from the weapon table; a newer peer's or junk is the blaster)
  const w = Number.isInteger(data[6]) ? WEAPONS[byCode(data[6])].code : 0;
  return { p: n.slice(0, 3), v: n.slice(3), w };
}

export function readHit(data) {
  const d = num(data?.d, 0, DAMAGE_MAX);
  return d === null || d <= 0 ? null : d;
}

// a ram as it came in: the closing speed it says, or null
export function readRam(data) {
  const v = num(data?.v, 0, RAM_MAX);
  return v === null ? null : v;
}

// Should a ram from this pilot count, and how hard? They're not blocked or
// an ally, were last seen close enough to have touched you (more room the
// faster you both go: their pose is a moment old), and it's not sooner after
// their last than a contact counts again (the law's `cool`). The closing
// speed believed is theirs (`into`), but never more than both your speeds
// together; null when it doesn't count.
export function ramCounts(peer, me, into, now) {
  if (!peer || !me || peer.blocked || peer.ally === 'ally') return null;
  const p = peer.pose;
  if (!p || now - (peer.ramAt ?? -Infinity) < CONTACT.cool * 1000) return null;
  const both = Math.abs(p.speed ?? 0) + Math.abs(me.speed ?? 0);
  if (Math.hypot(p.x - me.x, p.y - me.y, p.z - me.z) > GUARD.ramNear + both * GUARD.ramLag) return null;
  return Math.min(into, both);
}

// ── The hunters after a pilot: for the others to see, and to help with ──
// what goes out, from hunters.js's wire(): [id, kind, x, y, z, vx, vy, vz,
// hits left] each, rounded
export function writePack(list) {
  const r = (v, k) => Math.round((v || 0) * k) / k;
  return list.slice(0, PACK_MAX).map((h) => [h[0], h[1], r(h[2], 100), r(h[3], 100), r(h[4], 100), r(h[5], 10), r(h[6], 10), r(h[7], 10), h[8]]);
}

// a pack as it came in: [{ id, kind, x, y, z, vx, vy, vz, hp }] (none: they're
// gone), or null if it isn't one. A hunter of a kind there isn't, or that's
// there twice, is left out; no more than PACK_MAX are taken.
export function readPack(data) {
  if (!Array.isArray(data)) return null;
  const out = [];
  for (const h of data.slice(0, PACK_MAX)) {
    if (!Array.isArray(h) || h.length < 9) continue;
    const id = num(h[0], 1, 1e9);
    const kind = typeof h[1] === 'string' && Object.hasOwn(HUNTERS, h[1]) ? h[1] : null;
    const x = num(h[2], -FAR, FAR);
    const y = num(h[3], -1300, 1300);
    const z = num(h[4], -FAR, FAR);
    if (id === null || !Number.isInteger(id) || !kind || x === null || y === null || z === null || out.some((o) => o.id === id)) continue;
    out.push({ id, kind, x, y, z, vx: num(h[5], -80, 80) ?? 0, vy: num(h[6], -80, 80) ?? 0, vz: num(h[7], -80, 80) ?? 0, hp: Math.max(1, Math.floor(num(h[8], 1, 99) ?? 1)) });
  }
  return out;
}

// a hit on one of your hunters as it came in: { id, damage }, or null
export function readHunterHit(data) {
  const id = num(data?.i, 1, 1e9);
  // (whole hits only: a sliver of one would still make it flinch)
  const d = Math.floor(num(data?.d, 0, PUNCH_MAX) ?? 0);
  return id === null || !Number.isInteger(id) || d < 1 ? null : { id, damage: d };
}

// Should a hit on one of your hunters, from this pilot, count? They're not
// blocked, fired a moment ago, and were close enough to it (`at`: where the
// hunter was when you last said). (How often is the limiter's to say, RATES:
// hits come in bundles, so two fair ones can arrive in the same moment.)
export function hunterHitCounts(peer, at, now) {
  if (!peer || !at || peer.blocked) return false;
  if (now - (peer.shotAt ?? -Infinity) > GUARD.shotWindow) return false;
  const p = peer.pose;
  return Boolean(p) && Math.hypot(p.x - at.x, p.y - at.y, p.z - at.z) <= GUARD.reach;
}

// ── On foot: where a pilot's crew are, down on a planet ──
// (in the planet's own space, foot.js: n out from its middle, f along the
// ground, both in the map's axes, so it's the same spot for everyone
// whatever turn their planet was held at when they landed)
export const FOOT_MS = 100; // how often it goes out, while they're down
export const WALKERS = ['rick', 'morty', 'walt', 'jesse', 'chewie', 'han', 'luke', 'artoo', 'leia', 'ahsoka', 'bobafett']; // footScene.js's PARTY, and galaxy/heroes.js's heroes
const r5 = (v) => Math.round((v || 0) * 1e5) / 1e5;
// (then what the body's doing, which an older reader stops before: the
// emote [id, seconds on] or 0, the flinch and the fall, 0…1: footLife.js's)
const writeWalker = (w) => (w ? [w.who, ...w.n.map(r5), ...w.f.map(r5), r5(w.h), r5(w.speed), r5(w.side), Math.round((w.aim || 0) * 100) / 100, Array.isArray(w.e) ? [String(w.e[0]).slice(0, 16), r2(w.e[1])] : 0, r2(w.hurt || 0), r2(w.down || 0)] : null);

// what goes out while down: { planet, kind, ship: { n, f }, lead, mate }
// (each walker { who, n, f, h, speed, side, aim }), or null once back in
export function writeFoot(f) {
  if (!f) return { p: null };
  return { p: f.planet, k: f.kind, s: [...f.ship.n.map(r5), ...f.ship.f.map(r5)], a: writeWalker(f.lead), b: writeWalker(f.mate) };
}

// a direction as it came in, made a unit one (null if it's nowhere near one)
const unit3 = (data, i) => {
  const v = [0, 1, 2].map((k) => num(data[i + k], -1.5, 1.5));
  if (v.some((x) => x === null)) return null;
  const l = Math.hypot(...v);
  return l < 0.5 || l > 1.5 ? null : v.map((x) => x / l);
};
// along the ground at n: f with its part out from the middle taken off
const along = (f, n) => {
  const d = f[0] * n[0] + f[1] * n[1] + f[2] * n[2];
  const g = [f[0] - n[0] * d, f[1] - n[1] * d, f[2] - n[2] * d];
  const l = Math.hypot(...g);
  return l < 0.2 ? null : g.map((x) => x / l);
};
const readWalker = (data) => {
  if (!Array.isArray(data) || data.length < 11 || !WALKERS.includes(data[0])) return null;
  const n = unit3(data, 1);
  const f = n && unit3(data, 4) && along(unit3(data, 4), n);
  if (!f) return null;
  return {
    who: data[0],
    n,
    f,
    h: num(data[7], 0, 3 * METRE) ?? 0,
    speed: num(data[8], -FOOT.run * 1.5, FOOT.run * 1.5) ?? 0,
    side: num(data[9], -FOOT.side * 1.5, FOOT.side * 1.5) ?? 0,
    aim: num(data[10], 0, 1) ?? 0,
    // (an older client's packet stops at the aim: none of these)
    e: Array.isArray(data[11]) && typeof data[11][0] === 'string' && num(data[11][1], 0, 600) != null ? [data[11][0], num(data[11][1], 0, 600)] : null,
    hurt: num(data[12], 0, 1) ?? 0,
    down: num(data[13], 0, 1) ?? 0,
  };
};

// a crew on foot as it came in: { planet, kind, ship, lead, mate }, { off:
// true } (back in their ship), or null if it isn't one (a planet you can't
// land on, someone who isn't in a crew)
export function readFoot(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  if (data.p === null) return { off: true };
  const u = typeof data.p === 'string' ? byId(data.p) : null;
  if (!u || u.kind === 'core' || u.portal || !Array.isArray(data.s) || data.s.length < 6) return null;
  const n = unit3(data.s, 0);
  const f = n && unit3(data.s, 3) && along(unit3(data.s, 3), n);
  // (nobody out yet, while the ship's coming down: a = null)
  const lead = data.a === null ? null : readWalker(data.a);
  if (!f || (data.a !== null && !lead)) return null;
  return { planet: u.id, kind: parseShip(data.k), ship: { n, f }, lead, mate: lead ? readWalker(data.b) : null };
}

// ── Down on a world in the galaxy (galaxy/surface/scene.js) ──
// where a pilot's crew are, in that world's own metres: { world, kind,
// lead, mate, ride }, each walker [who, x, y, z, yaw, speed, aim, arms,
// emote, motion], ride the kind they're on (or null); or null once
// they've taken off again. `arms` (newer pilots; older readers stop before
// it) is what's in the hand: [gun kind, lit (a saber: 0 | 1), blade colour
// (#rrggbb), stance, swinging (0 | 1), and, newer, the stroke's clip
// ('sword.light.a': the clip library's name, so a peer plays the one
// they're playing; an older reader stops at the five)]; `emote` and `motion` (newer still,
// and only when there's one: lib/emote.js's emotePacket and motionPacket)
// what they're doing ([id, seconds on]) and how they're moving ([speed,
// side, turn] in metres and radians a second), so their feet keep pace
export const WALK_MS = 100;
const RIDES_SEEN = ['landspeeder', 'speederbike', 'tauntaun', 'kaadu', 'bantha']; // galaxy/surface/rides.js's
const r2 = (v) => Math.round((v || 0) * 100) / 100;
// (the gun up, 0…1, then the arms: an older reader stops at the speed)
export const ARMS_GUNS = ['blaster', 'laser', 'portal', 'revolver', 'pistol', 'bowcaster', 'rifle', 'coppistol', 'saber', 'a280', 'dlt19', 'ee3', 'westar', 'shotgun', 'sniper', 'smg']; // universe/gunplay.js's GUNS
const STANCES_SEEN = STANCE_IDS;
const strokeOf = (s) => (typeof s === 'string' && s.length <= 32 && /^sword(\.[a-z]+)+$/.test(s) ? s : null);
const writeArms = (a) => {
  if (!a || !ARMS_GUNS.includes(a.gun)) return null;
  const out = [a.gun, a.lit ? 1 : 0, typeof a.color === 'string' ? a.color.slice(0, 7) : '', STANCES_SEEN.includes(a.stance) ? a.stance : 'single', a.swing ? 1 : 0];
  if (strokeOf(a.stroke)) out.push(a.stroke);
  return out;
};
const writeStroller = (w) => {
  if (!w) return null;
  const out = [w.who, r2(w.x), r2(w.y), r2(w.z), r2(wrap(w.yaw || 0)), r2(w.speed), Math.round((w.aim || 0) * 100) / 100];
  // (what goes out checked as what comes in is; the arms' place kept, empty, ahead of them)
  const e = readEmoteWire(w.emote);
  const m = motionPacket(w.motion);
  if (w.arms || e || m) out.push(writeArms(w.arms));
  if (e || m) out.push(e ? [e.id, e.age] : null, m);
  return out;
};
const readArms = (a) => {
  if (!Array.isArray(a) || !ARMS_GUNS.includes(a[0])) return null;
  const stroke = strokeOf(a[5]);
  return { gun: a[0], lit: a[1] === 1, color: typeof a[2] === 'string' && /^#[0-9a-fA-F]{6}$/.test(a[2]) ? a[2] : '#4aa8ff', stance: STANCES_SEEN.includes(a[3]) ? a[3] : 'single', swing: a[4] === 1, ...(stroke ? { stroke } : {}) };
};
export function writeWalk(w) {
  if (!w) return { w: null };
  return { w: w.world, k: w.kind, a: writeStroller(w.lead), b: writeStroller(w.mate), r: w.ride ?? null };
}
const readStroller = (data) => {
  if (!Array.isArray(data) || data.length < 6 || !WALKERS.includes(data[0])) return null;
  const [x, y, z] = [num(data[1], -10000, 10000), num(data[2], -3000, 3000), num(data[3], -10000, 10000)];
  const yaw = num(data[4], -7, 7);
  if (x === null || y === null || z === null || yaw === null) return null;
  const e = readEmoteWire(data[8]);
  const m = readMotion(data[9]);
  return { who: data[0], x, y, z, yaw: wrap(yaw), speed: num(data[5], -80, 80) ?? 0, aim: num(data[6], 0, 1) ?? 0, arms: readArms(data[7]), ...(e ? { emote: e } : {}), ...(m ? { motion: m } : {}) };
};
// a crew down on a world as it came in: { world, kind, lead, mate, ride },
// { off: true } (back in their ship), or null if it isn't one
export function readWalk(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  if (data.w === null) return { off: true };
  if (typeof data.w !== 'string' || !/^[a-z0-9]{2,16}$/.test(data.w)) return null;
  const lead = readStroller(data.a);
  if (!lead) return null;
  return { world: data.w, kind: parseShip(data.k), lead, mate: readStroller(data.b), ride: RIDES_SEEN.includes(data.r) ? data.r : null };
}

// Did one of these shots ({ p, v, at }, as they came in) pass near enough
// `me` (where you are now, with your speed) in the last moment to have hit?
// Its path is the line it flies in its life; you may have moved since, so
// the faster you go the more room it's given.
export function aimedAt(shots, me, now) {
  const room = GUARD.near + Math.abs(me.speed || 0) * BOLT_LIFE;
  for (const s of shots ?? []) {
    if (now - s.at > GUARD.shotWindow) continue;
    const [px, py, pz] = s.p;
    const dx = s.v[0] * BOLT_LIFE;
    const dy = s.v[1] * BOLT_LIFE;
    const dz = s.v[2] * BOLT_LIFE;
    const len2 = dx * dx + dy * dy + dz * dz || 1;
    const k = Math.min(1, Math.max(0, ((me.x - px) * dx + (me.y - py) * dy + (me.z - pz) * dz) / len2));
    if (Math.hypot(px + dx * k - me.x, py + dy * k - me.y, pz + dz * k - me.z) <= room) return true;
  }
  return false;
}

// Should a hit from this pilot count? `peer` is what's known of them: { ally,
// blocked, shots (their last few, as they came in), hitAt (ms, their last
// hit that counted), pose (where they were) }; `me` is where you are (or
// null, not flying); `now` in ms.
export function hitCounts(peer, me, now) {
  if (!peer || !me || peer.blocked || peer.ally === 'ally') return false;
  if (!aimedAt(peer.shots, me, now)) return false;
  if (now - (peer.hitAt ?? -Infinity) < GUARD.gap) return false;
  const p = peer.pose;
  if (!p || Math.hypot(p.x - me.x, p.y - me.y, p.z - me.z) > GUARD.range) return false;
  return true;
}

// How much one pilot may send: for each kind of message (RATES), a bucket
// that holds `at most at once` and fills at `a second`; allow(kind, now)
// takes one if there's one to take. flooding(now): turned away more than
// FLOOD.denied times in FLOOD.window ms.
export function createLimiter(rates = RATES) {
  const buckets = {};
  const denied = [];
  return {
    allow(kind, now) {
      const r = rates[kind];
      if (!r) return false;
      const b = (buckets[kind] ??= { tokens: r[1], at: now });
      b.tokens = Math.min(r[1], b.tokens + (Math.max(0, now - b.at) / 1000) * r[0]);
      b.at = now;
      if (b.tokens >= 1) {
        b.tokens -= 1;
        return true;
      }
      denied.push(now);
      while (denied.length && now - denied[0] > FLOOD.window) denied.shift();
      if (denied.length > FLOOD.denied + 1) denied.shift();
      return false;
    },
    flooding(now) {
      while (denied.length && now - denied[0] > FLOOD.window) denied.shift();
      return denied.length > FLOOD.denied;
    },
  };
}

// an alliance's word as it came in: { t: 'ask' | 'yes' | 'no' | 'end', k:
// 1 (an ask from a pilot who has you saved) or 0 }, or null if it isn't one
const ALLY_WORDS = ['ask', 'yes', 'no', 'end'];
export function readAlly(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data) || !ALLY_WORDS.includes(data.t)) return null;
  return { t: data.t, k: data.k === 1 ? 1 : 0 };
}

// An alliance between you and one pilot, one step on. States: 'none',
// 'sent' (you asked), 'got' (they asked), 'ally'. Events: what you do
// ('ask', 'accept', 'decline', 'end') or what came in ({ in: 'ask' | 'yes' |
// 'no' | 'end' }). Returns { state, send } (send: what to tell them, or
// null). A 'yes' you never asked for is ignored, so no one can make you
// their ally; asking someone who asked you is a yes.
export function allyStep(state, event) {
  const s = state ?? 'none';
  const said = typeof event === 'object' && event ? event.in : null;
  if (said) {
    if (said === 'ask') {
      if (s === 'sent' || s === 'ally') return { state: 'ally', send: 'yes' };
      return { state: 'got', send: null };
    }
    if (said === 'yes') return s === 'sent' || s === 'ally' ? { state: 'ally', send: null } : { state: s, send: null };
    if (said === 'no') return s === 'sent' ? { state: 'none', send: null } : { state: s, send: null };
    if (said === 'end') return { state: 'none', send: null };
    return { state: s, send: null };
  }
  if (event === 'ask') {
    if (s === 'got') return { state: 'ally', send: 'yes' };
    if (s === 'none') return { state: 'sent', send: 'ask' };
    return { state: s, send: null };
  }
  if (event === 'accept') return s === 'got' ? { state: 'ally', send: 'yes' } : { state: s, send: null };
  if (event === 'decline') return s === 'got' ? { state: 'none', send: 'no' } : { state: s, send: null };
  if (event === 'end') return s === 'ally' || s === 'sent' ? { state: 'none', send: 'end' } : { state: s, send: null };
  return { state: s, send: null };
}

// Where a pilot is now, from the poses that came in (oldest first, each
// with `at`, the ms it arrived): drawn a little in the past (`delay`), between
// the two poses either side, so the motion is smooth (turned the shortest way
// from one to the next, so it doesn't spin over the top of a loop); past the
// newest, a short guess ahead along its nose. null with nothing to go on, or
// once it's gone quiet (STALE_MS).
export function sample(snaps, now, delay = 140) {
  if (!snaps.length) return null;
  const newest = snaps[snaps.length - 1];
  if (now - newest.at > STALE_MS) return null;
  const t = now - delay;
  for (let i = snaps.length - 1; i > 0; i--) {
    const a = snaps[i - 1];
    const b = snaps[i];
    if (t < a.at || t > b.at) continue;
    const k = b.at > a.at ? (t - a.at) / (b.at - a.at) : 1;
    const lerp = (p, q) => p + (q - p) * k;
    const { heading, pitch, bank } = toAngles(slerp(fromAngles(a.heading, a.pitch, a.bank), fromAngles(b.heading, b.pitch, b.bank), k));
    return {
      x: lerp(a.x, b.x),
      y: lerp(a.y, b.y),
      z: lerp(a.z, b.z),
      heading,
      pitch,
      bank,
      speed: lerp(a.speed, b.speed),
      vy: lerp(a.vy, b.vy),
      hidden: b.hidden,
      boost: b.boost,
      safe: b.safe,
      lane: b.lane,
      shield: b.shield,
    };
  }
  if (t < snaps[0].at) return { ...snaps[0] };
  // ahead of the newest: on the way it was going a little way (no further
  // than 250 ms; ship.js moves along the nose, vy its way up and down)
  const ahead = Math.min(250, t - newest.at) / 1000;
  const level = Math.cos(newest.pitch || 0);
  return {
    ...newest,
    x: newest.x - Math.sin(newest.heading) * level * newest.speed * ahead,
    y: newest.y + newest.vy * ahead,
    z: newest.z - Math.cos(newest.heading) * level * newest.speed * ahead,
  };
}
