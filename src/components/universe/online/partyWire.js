// A party’s words on the wire, and its chat’s and quick chat’s, read as
// anything a stranger sends is: checked, cleaned, and null if it isn’t one.
// Pure, so it’s tested in Node; partyLink.js does the talking (through
// client.js’s room), party.js keeps the rules of who’s in and who leads,
// partyCrypt.js seals the chat.
//
// The wire, by action (protocol.js’s RATES say how much of each a pilot may send):
//   party { t: 'inv', p, l }        an invite to party p, led by l          to one pilot
//         { t: 'join', p }          yes to an invite                        to its leader
//         { t: 'no', p }            no to one                               to whoever asked
//         { t: 'ros', p, l, e, m: [[id, name], …] }                         to everyone
//                                   the roster: its leader, its epoch (a whole number from 1,
//                                   only ever growing) and its members in the order they joined,
//                                   1 to PARTY_MAX, each once, the leader among them
//         { t: 'left', p }          leaving p                               to everyone
//         { t: 'out', p }           you’re removed from p                   to the one removed
//         { t: 'sum', p, w }        the leader summons p to w (where.js’s page key)   to everyone
//   psay  { b: [blob, …] }          a line of chat, sealed for each mate there (a blob each,
//                                   shuffled, base64url) and nothing else: no party, no names,
//                                   so all anyone else learns is who spoke, when, and to how many
//   quip  { q }                     a quick-chat line, its index in quips.js’s QUIPS   to everyone
//
// p is a party’s id (16 hex digits, newPartyId), l and the members pilots'
// keys (64 hex digits: their id online), e an epoch (readEpoch: a whole
// number from 1 to EPOCH_MAX, as a hello’s `pe` is too). Read, a roster’s
// members are [{ id, name }], a name cleaned (names.js: one that can’t be
// shown is “Pilot”). writeParty is readParty the other way round, and writes
// nothing (null) for a word readParty wouldn’t take, so what goes out is
// what comes in.

import { cleanName } from './names';
import { cleanWhere } from './where';
import { QUIPS } from './quips';
import { BLOB_MAX, CHAT_MAX, PARTY_MAX } from './partyLimits';

// the sizes live where the signer worker can read them alone (partyLimits.js)
export { PARTY_MAX, CHAT_MAX, BLOB_MAX };
export const PARTY_ID = /^[0-9a-f]{16}$/;
export const readPartyId = (v) => (typeof v === 'string' && PARTY_ID.test(v) ? v : null);
// One short of the largest whole number a double holds exactly: every
// change is the epoch plus one, and past this the next would be a number two
// epochs share, so a roster there could never be told from the one before.
export const EPOCH_MAX = Number.MAX_SAFE_INTEGER - 1;
// (a whole epoch, exact: it’s only compared, and grows by one)
export const readEpoch = (v) => (Number.isSafeInteger(v) && v >= 1 && v <= EPOCH_MAX ? v : null);

const ID = /^[0-9a-f]{64}$/;
const BLOB = /^[A-Za-z0-9_-]+$/;
const readId = (v) => (typeof v === 'string' && ID.test(v) ? v : null);
const plain = (o) => Boolean(o) && typeof o === 'object' && !Array.isArray(o);
const hex = (bytes) => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');

// a new party’s id: eight random bytes (`rand` fills them, as the browser’s
// crypto.getRandomValues does), so two parties never share one
export function newPartyId(rand = globalThis.crypto.getRandomValues.bind(globalThis.crypto)) {
  const bytes = new Uint8Array(8);
  rand(bytes);
  return hex(bytes);
}

// The members as they came in, or null. One that isn’t a member (no key, or
// there twice) makes it no roster at all: read without them, it would say
// they’d been removed.
function readMembers(m) {
  if (!Array.isArray(m) || m.length < 1 || m.length > PARTY_MAX) return null;
  const out = [];
  for (const x of m) {
    const id = Array.isArray(x) ? readId(x[0]) : null;
    if (!id || out.some((o) => o.id === id)) return null;
    out.push({ id, name: cleanName(x[1]) ?? 'Pilot' });
  }
  return out;
}

// each word: what it carries besides its party, or null if that isn’t there
const WORDS = {
  inv: (d) => {
    const l = readId(d.l);
    return l && { l };
  },
  join: () => ({}),
  no: () => ({}),
  ros: (d) => {
    const m = readMembers(d.m);
    const l = readId(d.l);
    const e = readEpoch(d.e);
    if (!m || !l || !m.some((o) => o.id === l) || !e) return null;
    return { l, e, m };
  },
  left: () => ({}),
  out: () => ({}),
  sum: (d) => {
    const w = cleanWhere(d.w);
    return w && { w };
  },
};

// a party’s word as it came in (see above), or null
export function readParty(data) {
  if (!plain(data) || typeof data.t !== 'string' || !Object.hasOwn(WORDS, data.t)) return null;
  const p = readPartyId(data.p);
  const rest = p && WORDS[data.t](data);
  return rest ? { t: data.t, p, ...rest } : null;
}

// the wire form of a word: its own fields only, the members as [id, name]
export function writeParty(msg) {
  if (!plain(msg)) return null;
  const { t, p, l, e, m, w } = msg;
  const wire = t === 'ros' ? { t, p, l, e, m: Array.isArray(m) ? m.map((x) => [x?.id, cleanName(x?.name) ?? 'Pilot']) : null } : t === 'inv' ? { t, p, l } : t === 'sum' ? { t, p, w } : { t, p };
  return readParty(wire) ? wire : null;
}

// A line of chat as it came in: { b }, a blob for each mate who was there
// (one to PARTY_MAX − 1: the speaker seals none for themselves), or null.
// Opening one is partyCrypt.js’s; this only says it’s the right shape.
export function readSay(data) {
  const b = plain(data) ? data.b : null;
  if (!Array.isArray(b) || b.length < 1 || b.length > PARTY_MAX - 1) return null;
  return b.every((x) => typeof x === 'string' && x.length <= BLOB_MAX && BLOB.test(x)) ? { b: [...b] } : null;
}

// a quick-chat line as it came in: { q }, an index into QUIPS, or null
export function readQuip(data) {
  const q = plain(data) ? data.q : null;
  return Number.isInteger(q) && q >= 0 && q < QUIPS.length ? { q } : null;
}
