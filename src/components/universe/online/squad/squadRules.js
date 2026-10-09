// The squad's rules: one document, the newest taken by all, and a leader
// worked out from the seats, as plain steps with no network and no clock of
// their own (squadRules.test.js). squad.js carries the words; this says what
// each pilot makes of them.
//
// The document (writeState's): the seats in order, who's been turned out
// (the newest OUT_MAX), whether it's locked (nobody new is seated) and open,
// the rally, the lobby (PR 3's: none yet), the private game; stamped n and
// by: a change is n + 1, by its writer. A document is newer by a higher n,
// then a `by` lower as text, then (two different ones under one stamp, which
// only a client of someone's own writes) lower as JSON, so all order alike.
//
// Seated, you take a newer document sent by a member of yours and written by
// one, unless it's more than JUMP_MAX past yours; every seated member sends
// the one it holds every stateMs, and at once on a change of its own. One
// that doesn't seat you has you asking in again, one that turns you out ends
// it. Asking in, you take the first that seats you (asked in from the roster,
// `via`, only one written by the inviter or seating them); one that turns you
// away (out, full, locked) or doesn't seat you is an answer that holds if
// nothing seats you by JOIN_MS; with no document by then, 'quiet'.
//
// A member is there, to you, when you've heard them within liveMs, or a
// member who's there named them (`h`) in a hello you had within liveMs;
// away, not there for awayMs. The leader is the first seat there within
// leaderQuietMs (you're always there to yourself), and only the leader writes
// the squad's changes: seating a hello (not turned out, not blocked, a seat
// free, not locked), freeing a seat (a goodbye; or not there goneMs, unless
// locked), turning out (which locks), the lock, rally, open, lobby and
// instance. Anyone writes their own leaving, then says goodbye.
//
// newSquad(sid, me, now), joining(sid, me, now, via) and resume(sid, me,
// wire, now) (the kept document, read as any is) → state. squadStep(state,
// event, now) → { state, send: [[kind, data]] }, for { type: 'hello', from,
// card, blocked } (your own goes out with `h`), { type: 'doc', from, wire },
// { type: 'bye', from }, { type: 'tick' } (twice a second), and your own
// { type: 'leave' }, { type: 'kick', id }, { type: 'lock', locked }, { type:
// 'rally', rally }, { type: 'open', open }, { type: 'lobby', lobby } (null
// only, till PR 3's readLobby) and { type: 'instance', instance }. view(state,
// now) → { sid, leader, mine, members: [{ id, seat, name, kind, where,
// shield, level, ready, away, leader }], open, rally, lobby, instance,
// locked, gone, why ('left', 'out', 'full', 'locked', 'quiet', 'refused' or
// null) }. readState(wire) → the document, or null if any of it is junk;
// writeState(state) → { n, by, m, x, k, o, r, lb, i }; readCard(data) → a
// hello's { name, kind, where, shield, level, ready, h } or null; writeCard.

import { cleanName } from '../names';
import { cleanWhere } from '../where';
import { readPoint, writePoint } from '../wire2';
import { parseShip } from '../../crews';
import { LEVELS } from '../../economy';

export const SQUAD = { size: 4, stateMs: 2000, helloMs: 3000, seekMs: 1500, awayMs: 10000, goneMs: 45000, leaderQuietMs: 8000, liveMs: 6000 };
export const JOIN_MS = 15000; // asking in: nothing has seated you by now, and the answer holds
const OUT_MAX = 32; // pilots turned out, kept at most (the oldest let go past that)
const HEARD_MAX = 8; // ids in a hello's h, at most
const JUMP_MAX = 1e6; // a stamp further than this past yours isn't taken (it can't be run to its end)
const STRANGERS = 8; // cards kept of pilots who aren't seated, at most
const ID = /^[0-9a-f]{64}$/; // a pilot's id: their key, 64 hex digits
const INSTANCE = /^[0-9a-f]{10}$/; // invite.js's instanceOf
const NO_CARD = { name: null, kind: null, where: null, shield: null, level: null, ready: false };
const NONE = Object.freeze([]);

const isId = (v) => typeof v === 'string' && ID.test(v);
const isObject = (v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v);
const num = (v, lo, hi) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : null);
const distinct = (list) => new Set(list).size === list.length;

// ── the wire ──

// a hello's card as it came in, or null if it isn't one (a name cleaned, a
// ship and a place only from the lists there are, numbers clamped, and of
// `h` only ids, HEARD_MAX at most)
export function readCard(data) {
  if (!isObject(data)) return null;
  const shield = num(data.sh, 0, 100);
  const h = Array.isArray(data.h) ? [...new Set(data.h.slice(0, 64).filter(isId))].slice(0, HEARD_MAX) : [];
  return { name: cleanName(data.n) ?? 'Pilot', kind: parseShip(data.k), where: cleanWhere(data.w), shield: shield === null ? null : Math.round(shield), level: Math.floor(num(data.lv, 1, LEVELS.length) ?? 1), ready: data.rd === 1, h };
}
export const writeCard = (c) => ({ n: c?.name ?? null, k: c?.kind ?? null, w: c?.where ?? null, sh: c?.shield ?? null, lv: c?.level ?? 1, rd: c?.ready ? 1 : 0, h: [...(c?.h ?? NONE)] });

// a rally: { w: where, p: a point or null }, or null if it isn't one
const writeRally = (r) => ({ w: r.w, p: r.p ? writePoint(r.p) : null });
function readRally(data) {
  if (!isObject(data)) return null;
  const w = cleanWhere(data.w);
  const p = data.p === null || data.p === undefined ? null : readPoint(data.p);
  return w && (p || data.p == null) ? { w, p } : null;
}

export function writeState(s) {
  return { n: s.n, by: s.by, m: [...s.members], x: [...s.out], k: s.locked ? 1 : 0, o: s.open ? 1 : 0, r: s.rally ? writeRally(s.rally) : null, lb: s.lobby ?? null, i: s.instance ?? null };
}

// A document as it came in, or null if any of it is junk: it's taken whole
// or not at all. (A field left out is its empty value; one there of the
// wrong kind is junk.)
export function readState(w) {
  if (!isObject(w)) return null;
  const { n, by, m, x = [], k = 0, o = 0, r = null, lb = null, i = null } = w;
  if (!Number.isSafeInteger(n) || n < 0 || !isId(by)) return null;
  if (!Array.isArray(m) || m.length > SQUAD.size || !m.every(isId) || !distinct(m)) return null;
  if (!Array.isArray(x) || x.length > OUT_MAX || !x.every(isId) || !distinct(x) || x.some((id) => m.includes(id))) return null;
  if ((k !== 0 && k !== 1) || (o !== 0 && o !== 1)) return null;
  const rally = r === null ? null : readRally(r);
  if (r !== null && !rally) return null;
  // (a lobby is PR 3's, for its readLobby to read: till then, a document with one isn't ours to take)
  if (lb !== null) return null;
  if (i !== null && !(typeof i === 'string' && INSTANCE.test(i))) return null;
  return { n, by, members: [...m], out: [...x], locked: k === 1, open: o === 1, rally, lobby: null, instance: i };
}

// ── the squad ──

// State: the document held (n, by, members, out, locked, open, rally, lobby,
// instance; n 0 and by null for none), cards (id → { …card, h, at: heard
// last, hAt: their hello last }), seen (seat → when last there), quit (seats
// whose goodbye came), joinedAt (asking in since), sentAt (your document
// last sent), via, answer (asking in: what you were told), gone.
const base = (sid, me, now) => ({ sid, me, n: 0, by: null, members: [], out: [], locked: false, open: false, rally: null, lobby: null, instance: null, cards: new Map(), seen: new Map(), quit: new Set(), joinedAt: now, sentAt: -Infinity, via: null, answer: null, gone: null });
export const newSquad = (sid, me, now) => ({ ...base(sid, me, now), n: 1, by: me, members: [me], seen: new Map([[me, now]]) });
export const joining = (sid, me, now, via = null) => ({ ...base(sid, me, now), via: isId(via) ? via : null });
export function resume(sid, me, wire, now) {
  const w = readState(wire);
  return w ? take(joining(sid, me, now), w, now) : joining(sid, me, now);
}

const seated = (s) => s.members.includes(s.me);
const same = (s) => ({ state: s, send: NONE });
const answerOf = (me, w) => (w.out.includes(me) ? 'out' : w.members.length >= SQUAD.size ? 'full' : w.locked ? 'locked' : 'refused');
// when each seat was last there: kept, and a new one as good as there now
const seenOf = (s, now) => new Map(s.members.map((id) => [id, s.seen.get(id) ?? now]));

// Is document a newer than b? A higher n; the same n and a lower by, as text;
// one stamp on two different documents, the lower as JSON.
function newer(a, b) {
  if (a.n !== b.n) return a.n > b.n;
  if (a.by !== b.by) return a.by < b.by;
  return JSON.stringify(writeState(a)) < JSON.stringify(writeState(b));
}

// The members there to you now: you; those heard within liveMs; and, along
// the chain, those a member who's there named in a hello you had within
// liveMs (a seat whose goodbye came is none of these)
function thereNow(s, now) {
  const can = (id) => s.members.includes(id) && !s.quit.has(id);
  const there = new Set(seated(s) ? [s.me] : NONE);
  for (const id of s.members) if (id !== s.me && can(id) && now - (s.cards.get(id)?.at ?? -Infinity) <= SQUAD.liveMs) there.add(id);
  for (let more = true; more; ) {
    more = false;
    for (const by of [...there]) {
      const c = by === s.me ? null : s.cards.get(by);
      if (c && now - c.hAt <= SQUAD.liveMs) {
        for (const id of c.h) {
          if (can(id) && !there.has(id)) {
            there.add(id);
            more = true;
          }
        }
      }
    }
  }
  return there;
}
// the leader: the first seat there within leaderQuietMs
const leaderOf = (s, now, there = thereNow(s, now)) => s.members.find((id) => !s.quit.has(id) && (id === s.me || there.has(id) || now - (s.seen.get(id) ?? -Infinity) <= SQUAD.leaderQuietMs)) ?? null;
const leads = (s, now) => seated(s) && leaderOf(s, now) === s.me;

// whom you've heard yourself within liveMs, seats first: your hello's h
function heardLately(s, now) {
  const fresh = [...s.cards].filter(([id, c]) => id !== s.me && now - c.at <= SQUAD.liveMs);
  fresh.sort(([a, ca], [b, cb]) => Number(s.members.includes(b)) - Number(s.members.includes(a)) || cb.at - ca.at);
  return fresh.slice(0, HEARD_MAX).map(([id]) => id);
}

// your document out now (its clock started again)
const say = (s, now) => ({ state: { ...s, sentAt: now }, send: [['doc', writeState(s)]] });
// a change of yours: a new document, stamped n + 1 by you, out at once
function change(s, patch, now) {
  const next = { ...s, ...patch, n: s.n + 1, by: s.me };
  return say({ ...next, seen: seenOf(next, now), quit: new Set([...s.quit].filter((id) => next.members.includes(id))) }, now);
}

// a document taken: it's the squad now (seated in it, asking in again, or out)
function take(s, w, now) {
  const next = { ...s, ...w, answer: null };
  const taken = { ...next, seen: seenOf(next, now), quit: new Set([...s.quit].filter((id) => w.members.includes(id))) };
  if (w.out.includes(s.me)) return { ...taken, gone: 'out' };
  if (w.members.includes(s.me)) return taken;
  return { ...taken, joinedAt: now, answer: answerOf(s.me, w) };
}

// heard from: their card's time, or a bare card for one not met
function met(s, from, now) {
  const c = s.cards.get(from);
  const quit = s.quit.has(from) ? new Set([...s.quit].filter((id) => id !== from)) : s.quit;
  return { ...s, quit, cards: new Map(s.cards).set(from, c ? { ...c, at: now } : { ...NO_CARD, h: NONE, hAt: -Infinity, at: now }) };
}

function hello(s, { from, card, blocked = false }, now) {
  if (!isId(from) || !isObject(card)) return same(s);
  const { h, ...rest } = card;
  // your own: your card, and the hello as it goes, naming whom you've heard
  if (from === s.me) return { state: { ...s, cards: new Map(s.cards).set(from, { ...rest, h: NONE, hAt: -Infinity, at: now }) }, send: [['hi', writeCard({ ...rest, h: heardLately(s, now) })]] };
  const was = met(s, from, now);
  const next = { ...was, cards: new Map(was.cards).set(from, { ...rest, h: Array.isArray(h) ? h : NONE, hAt: now, at: now }) };
  const free = !next.members.includes(from) && !next.out.includes(from) && !blocked && !next.locked && next.members.length < SQUAD.size;
  return free && leads(next, now) ? change(next, { members: [...next.members, from] }, now) : same(next);
}

function heard(s, { from, wire }, now) {
  if (!isId(from) || from === s.me) return same(s);
  const next = met(s, from, now);
  const w = readState(wire);
  if (!w || w.n - s.n > JUMP_MAX) return same(next);
  if (!seated(s)) return asking(next, w, now);
  // seated: a newer one, sent by a member of yours and written by one
  return s.members.includes(from) && s.members.includes(w.by) && newer(w, s) ? same(take(next, w, now)) : same(next);
}

// asking in: the first that seats you; any other is an answer that holds
// only if nothing seats you in time (from the roster: the inviter's only)
function asking(s, w, now) {
  if (s.via && w.by !== s.via && !w.members.includes(s.via)) return same(s);
  return same(w.members.includes(s.me) ? take(s, w, now) : { ...s, answer: answerOf(s.me, w) });
}

// a goodbye: not there from now, till heard again; the leader frees the seat
function bye(s, { from }, now) {
  if (!isId(from) || from === s.me) return same(s);
  const cards = new Map(s.cards);
  cards.delete(from);
  if (!s.members.includes(from)) return same({ ...s, cards });
  const next = { ...s, cards, quit: new Set(s.quit).add(from) };
  return leads(next, now) ? change(next, { members: s.members.filter((id) => id !== from) }, now) : same(next);
}

// cards of pilots who aren't seated: only those heard lately, STRANGERS at most
function prune(s, now) {
  const strangers = [...s.cards].filter(([id]) => id !== s.me && !s.members.includes(id)).sort((a, b) => b[1].at - a[1].at);
  const drop = strangers.filter(([, c], n) => n >= STRANGERS || now - c.at > SQUAD.liveMs);
  if (!drop.length) return s;
  const cards = new Map(s.cards);
  for (const [id] of drop) cards.delete(id);
  return { ...s, cards };
}

function tick(s, now) {
  let next = prune(s, now);
  const there = thereNow(next, now);
  if ([...there].some((id) => next.seen.get(id) !== now)) next = { ...next, seen: new Map(next.members.map((id) => [id, there.has(id) ? now : next.seen.get(id) ?? now])) };
  if (!seated(next)) return now - next.joinedAt < JOIN_MS ? same(next) : same({ ...next, gone: next.answer ?? 'quiet' });
  if (leaderOf(next, now, there) === next.me) {
    // a goodbye's seat, and (unlocked) one not there for goneMs
    const kept = next.members.filter((id) => !next.quit.has(id) && (id === next.me || there.has(id) || next.locked || now - next.seen.get(id) < SQUAD.goneMs));
    if (kept.length < next.members.length) return change(next, { members: kept }, now);
  }
  return now - next.sentAt >= SQUAD.stateMs ? say(next, now) : same(next);
}

// your own changes: your leaving, anyone's; the rest only the leader's
function local(s, e, now) {
  if (e.type === 'leave') {
    if (!seated(s)) return { state: { ...s, gone: 'left' }, send: [['bye', null]] };
    const { state, send } = change(s, { members: s.members.filter((id) => id !== s.me) }, now);
    return { state: { ...state, gone: 'left' }, send: [...send, ['bye', null]] };
  }
  if (!leads(s, now)) return same(s);
  if (e.type === 'kick') {
    if (e.id === s.me || !s.members.includes(e.id)) return same(s);
    const cards = new Map(s.cards);
    cards.delete(e.id);
    // (past OUT_MAX turned out, the first of them may ask in again: a squad that's turned out 32 is a rare one)
    return change({ ...s, cards }, { members: s.members.filter((id) => id !== e.id), out: [...s.out.filter((id) => id !== e.id), e.id].slice(-OUT_MAX), locked: true }, now);
  }
  if (e.type === 'lock') return Boolean(e.locked) === s.locked ? same(s) : change(s, { locked: Boolean(e.locked) }, now);
  if (e.type === 'rally') {
    const rally = e.rally ? readRally(writeRally(e.rally)) : null;
    return e.rally && !rally ? same(s) : change(s, { rally }, now);
  }
  if (e.type === 'open') return Boolean(e.open) === s.open ? same(s) : change(s, { open: Boolean(e.open) }, now);
  // (a lobby: none but null till PR 3's readLobby reads one)
  if (e.type === 'lobby') return e.lobby !== null || s.lobby === null ? same(s) : change(s, { lobby: null }, now);
  if (e.type === 'instance') {
    const ok = e.instance === null || (typeof e.instance === 'string' && INSTANCE.test(e.instance));
    return !ok || e.instance === s.instance ? same(s) : change(s, { instance: e.instance }, now);
  }
  return same(s);
}

export function squadStep(state, event, now) {
  if (!state || state.gone || !event) return same(state);
  switch (event.type) {
    case 'hello':
      return hello(state, event, now);
    case 'doc':
      return heard(state, event, now);
    case 'bye':
      return bye(state, event, now);
    case 'tick':
      return tick(state, now);
    default:
      return local(state, event, now);
  }
}

export function view(s, now) {
  const there = thereNow(s, now);
  const leader = leaderOf(s, now, there);
  const mine = s.members.indexOf(s.me);
  return {
    sid: s.sid,
    leader,
    mine: mine >= 0 ? mine : null,
    members: s.members.map((id, seat) => {
      const c = s.cards.get(id) ?? NO_CARD;
      const away = id !== s.me && !there.has(id) && (s.quit.has(id) || now - (s.seen.get(id) ?? -Infinity) >= SQUAD.awayMs);
      return { id, seat, name: c.name, kind: c.kind, where: c.where, shield: c.shield, level: c.level, ready: Boolean(c.ready), away, leader: id === leader };
    }),
    open: s.open,
    rally: s.rally,
    lobby: s.lobby,
    instance: s.instance,
    locked: s.locked,
    gone: Boolean(s.gone),
    why: s.gone,
  };
}
