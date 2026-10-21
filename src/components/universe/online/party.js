// A party’s rules, as plain data: who’s in it, who leads it, and which
// roster to believe. Pure (no network, and no clock of its own: the time
// comes in), so it’s tested in Node; partyLink.js does the talking and keeps
// the party these hand back, partyWire.js reads the words off the wire.
//
// A party is { id (16 hex digits), leader, epoch, members: [{ id, name,
// since }] }, the members in the order they joined, PARTY_MAX at most. The
// roster is the leader’s: each change (a member in or out, a new leader) is
// the party at the next epoch, which the leader sends to everyone, and what
// a member holds is only ever what a leader said. Nothing here changes the
// party it’s handed: each rule gives a new one, or null where there’s
// nothing to do.
//
// When the leader’s gone (offline, or quiet past the room’s patience) the
// first member here in joining order, the one who’s been in longest, takes
// over at the next epoch (successor, takeOver).
//
// Whom a party trusts: its members, who were let in. One running a changed
// client can disrupt it (name itself leader, push the epoch); that’s
// accepted. What holds: a pilot never let in (anyone can read the rosters
// and hellos, and every party’s id) can’t be believed about it; pilots of a
// party online together end, in a few heartbeats, holding one roster
// whatever changed while some were away, so long as each has someone there
// they knew in it (one let in while you were away is a stranger to you till
// then); no one’s put out whom no leader put out; and nothing pins or
// overflows the epoch. So a roster for your party is believed (applyRoster):
// - from the leader you have, at a newer epoch, whatever it says: an add, a
//   removal (you too), a new leader. At the same epoch only as a rename, or
//   the roster again;
// - from the leader you had before you took another member’s word
//   (`prior`: { leader, epoch, from, had }), at a newer epoch than you had
//   it, leaving out the one whose word you took: they were put out, and
//   their word goes with them; or from another of the party as you had it
//   then (`had`), the same, if it keeps you in and is no further off than a
//   member’s may be: one who saw them put out (the leader you had may never
//   be back, and the one put out may have named another of it leader, or
//   you, to keep you);
// - while you lead, from the leader you took over from (`ousted`), at your
//   epoch or past it, whatever it says: they weren’t gone, and their word
//   crossed your takeover;
// - from another member (of the party as you hold it, or, while that’s only
//   the store’s word, as it gave it back, `kept`: you may have put them out
//   since): a takeover (naming its sender leader) newer by at most
//   EPOCH_SPAN, or at the same epoch winning the tie (beats); a roster
//   passed on (naming another leader, or a hand-over without the one who
//   left), the same, but only while your leader isn’t here to say it
//   (`present`: a leader asks it of themselves, and is “not here” only while
//   what they hold may be out of date, back from last visit, so the members
//   can tell them how the party moved on without them). Only if it keeps you
//   in: only your own leader puts you out, or, while you lead as you were
//   last visit, one of it at your epoch or past it, who took over from you
//   while you were away or passes on the word of one who did.
// A party you aren’t in is believed only as your way in: the one whose
// invite you said yes to, from the leader it named, with you in it.
//
// newParty({ id, self: { id, name }, now }) → party; isMember(party, id),
// isLeader(party, id) → bool; addMember(party, { id, name }, now) → party |
// null (full, there already); removeMember(party, id) → party | null (not
// in it, or no one left); promote(party, id) → party | null (not in it, or
// leading already); successor(party, present) → id | null; takeOver(party,
// selfId) → party | null (not in it); each change null at EPOCH_MAX;
// rosterMsg(party) → { t: 'ros', p, l, e, m: [{ id, name }] }; beats(a, b)
// → bool (party a over b, at one epoch); applyRoster(party, msg, { fromId,
// selfId, joining, now, present, prior, ousted, kept }) → { party, why:
// 'joined' | 'updated' | 'removed' | 'ignored' }

import { cleanName } from './names';
import { EPOCH_MAX, PARTY_MAX, readEpoch } from './partyWire';

// How far past yours a member’s roster may be: further than any party moves
// while one of it’s away, and short of letting one roster pin the epoch past
// every one to come.
export const EPOCH_SPAN = 256;

const named = (name) => cleanName(name) ?? 'Pilot';
// the party changed, at the next epoch (none past EPOCH_MAX: no change is made)
const bump = (party, change) => (party.epoch >= EPOCH_MAX ? null : { ...party, ...change, epoch: party.epoch + 1 });

export function newParty({ id, self, now }) {
  return { id, leader: self.id, epoch: 1, members: [{ id: self.id, name: named(self.name), since: now }] };
}

export const isMember = (party, id) => Boolean(party?.members?.some((m) => m.id === id));
export const isLeader = (party, id) => Boolean(party) && party.leader === id;

export function addMember(party, { id, name }, now) {
  if (!party || party.members.length >= PARTY_MAX || isMember(party, id)) return null;
  return bump(party, { members: [...party.members, { id, name: named(name), since: now }] });
}

// (the leader taken out: whoever’s been in longest leads, as they would
// have taken over had the leader just gone quiet)
export function removeMember(party, id) {
  if (!isMember(party, id)) return null;
  const members = party.members.filter((m) => m.id !== id);
  if (!members.length) return null;
  return bump(party, { members, leader: party.leader === id ? members[0].id : party.leader });
}

export function promote(party, id) {
  if (!isMember(party, id) || party.leader === id) return null;
  return bump(party, { leader: id });
}

// who leads when the leader’s gone: present(id) says who’s here. The leader
// is never their own successor, so a leader leaving asks it who to hand to.
export function successor(party, present) {
  return party?.members.find((m) => m.id !== party.leader && present(m.id))?.id ?? null;
}

export function takeOver(party, selfId) {
  return isMember(party, selfId) ? bump(party, { leader: selfId }) : null;
}

export function rosterMsg(party) {
  return { t: 'ros', p: party.id, l: party.leader, e: party.epoch, m: party.members.map(({ id, name }) => ({ id, name })) };
}

// A roster’s shape, checked again: partyWire.js has read what came off the
// wire, but a rule shouldn’t trust its caller to have.
function wellFormed(msg) {
  if (!msg || typeof msg !== 'object' || msg.t !== 'ros' || typeof msg.p !== 'string' || typeof msg.l !== 'string') return false;
  if (!readEpoch(msg.e) || !Array.isArray(msg.m) || msg.m.length < 1 || msg.m.length > PARTY_MAX) return false;
  const ids = new Set(msg.m.map((m) => m?.id));
  return ids.size === msg.m.length && ids.has(msg.l) && [...ids].every((id) => typeof id === 'string');
}

const idsOf = (party) => party.members.map((m) => m.id);
const sameIds = (a, b) => a.members.length === b.members.length && a.members.every((m, i) => m.id === b.members[i].id);

// Two rosters at one epoch (two forks: a takeover from a roster another had
// moved on from, or two at once): the one with more members wins, as a
// stale takeover is a roster from before someone came in; then the lower
// leader’s id; then the lower ids, sorted. An order over every pair, so
// wherever the two meet the same one wins, and no one answers back for ever.
export function beats(a, b) {
  if (a.members.length !== b.members.length) return a.members.length > b.members.length;
  if (a.leader !== b.leader) return a.leader < b.leader;
  const [x, y] = [a, b].map((p) => idsOf(p).sort().join());
  return x < y;
}

// whether `next` (the roster as read) is believed over your party, as above
function believed(party, next, { fromId, selfId, present, prior, ousted, kept }) {
  const listed = (id) => isMember(next, id);
  const near = next.epoch - party.epoch <= EPOCH_SPAN;
  // (the leader you had, or another of the party as you had it, saying the one whose word you took is out)
  if (prior && next.epoch > prior.epoch && !listed(prior.from)) {
    if (fromId === prior.leader) return true;
    if (fromId !== prior.from && prior.had?.includes(fromId) && listed(selfId) && near) return true;
  }
  if (fromId === party.leader) return next.epoch > party.epoch || (next.epoch === party.epoch && next.leader === party.leader && sameIds(party, next));
  // (the leader you took over from, at your epoch or past it: they weren’t
  // gone, and their word, whatever it says, crossed your takeover)
  if (fromId === ousted && party.leader === selfId) return next.epoch >= party.epoch && near;
  // (one of it: as you hold it, or as the store gave it back while that’s all you hold, though you’ve put them out since)
  if (!isMember(party, fromId) && !isMember(kept, fromId)) return false;
  // (you out: only your own leader says so; or, while you lead it as you
  // were last visit, at your epoch or past it, one of it who took over from
  // you while you were away, or passes on the word of one who did)
  if (!listed(selfId)) return party.leader === selfId && !present(selfId) && next.epoch >= party.epoch && near;
  // (another’s roster passed on, or their hand-over as they left it, while your own leader’s here to say it: theirs stands)
  if (next.leader !== fromId && present(party.leader)) return false;
  if (next.epoch > party.epoch) return near;
  return next.epoch === party.epoch && beats(next, party);
}

// Another party, as your way in: `joining` is the party whose invite you said
// yes to, by its id, or the invite itself ({ party, leader }: then only its
// leader’s roster lets you in, as your yes went to them and anyone can read it).
function wayIn(msg, fromId, joining) {
  if (fromId !== msg.l || !joining) return false;
  if (typeof joining === 'string') return joining === msg.p;
  return joining.party === msg.p && joining.leader === fromId;
}

const same = (a, b) => a.leader === b.leader && a.epoch === b.epoch && a.members.length === b.members.length && a.members.every((m, i) => m.id === b.members[i].id && m.name === b.members[i].name);

export function applyRoster(party, msg, { fromId, selfId, joining = null, now, present = () => false, prior = null, ousted = null, kept = null }) {
  const ignored = { party, why: 'ignored' };
  if (!wellFormed(msg)) return ignored;
  const ours = Boolean(party) && party.id === msg.p;
  const was = new Map(ours ? party.members.map((m) => [m.id, m.since]) : []);
  const next = { id: msg.p, leader: msg.l, epoch: msg.e, members: msg.m.map(({ id, name }) => ({ id, name: named(name), since: was.get(id) ?? now })) };
  if (ours ? !believed(party, next, { fromId, selfId, present, prior, ousted, kept }) : !wayIn(msg, fromId, joining)) return ignored;
  // (a roster for a party you’re joining that hasn’t you in it yet crossed your yes)
  if (!isMember(next, selfId)) return ours ? { party: null, why: 'removed' } : ignored;
  if (!ours) return { party: next, why: 'joined' };
  return same(party, next) ? ignored : { party: next, why: 'updated' };
}
