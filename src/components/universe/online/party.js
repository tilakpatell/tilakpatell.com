// A party's rules, as plain data: who's in it, who leads it, and which
// roster to believe. Pure (no network, and no clock of its own: the time
// comes in), so it's tested in Node; partyLink.js does the talking and keeps
// the party these hand back, partyWire.js reads the words off the wire.
//
// A party is { id (16 hex digits), leader, epoch, members: [{ id, name,
// since }] }, the members in the order they joined, PARTY_MAX at most. The
// roster is the leader's: each change (a member in or out, a new leader) is
// the party at the next epoch, which the leader sends to everyone, and what
// a member holds is only ever what a leader said. Nothing here changes the
// party it's handed: each rule gives a new one, or null where there's
// nothing to do.
//
// When the leader's gone (offline, or quiet past the room's patience) the
// first member here in joining order, the one who's been in longest, takes
// over at the next epoch (successor, takeOver). Two who both did: the higher
// epoch wins, and at the same epoch the lower id, so everyone ends with the
// same leader whichever of the two they hear first. A roster is believed
// (applyRoster) from the leader it names, if they're in your party as you
// have it (a party's id is public, in every member's hello: a stranger could
// otherwise name themselves its leader and be sealed every line said in it),
// or from the leader you have, handing over to another (Make leader, or
// leaving). A party you aren't in is believed only as your way in: the one
// whose invite you said yes to, from the leader it named, with you in it.
//
// newParty({ id, self: { id, name }, now }) → party; isMember(party, id),
// isLeader(party, id) → bool; addMember(party, { id, name }, now) → party |
// null (full, there already); removeMember(party, id) → party | null (not
// in it, or no one left); promote(party, id) → party | null (not in it, or
// leading already); successor(party, present) → id | null; takeOver(party,
// selfId) → party | null (not in it); rosterMsg(party) → { t: 'ros', p, l,
// e, m: [{ id, name }] }; applyRoster(party, msg, { fromId, selfId, joining,
// now }) → { party, why: 'joined' | 'updated' | 'removed' | 'ignored' }

import { cleanName } from './names';
import { PARTY_MAX } from './partyWire';

const named = (name) => cleanName(name) ?? 'Pilot';
// the party changed, at the next epoch
const bump = (party, change) => ({ ...party, ...change, epoch: party.epoch + 1 });

export function newParty({ id, self, now }) {
  return { id, leader: self.id, epoch: 1, members: [{ id: self.id, name: named(self.name), since: now }] };
}

export const isMember = (party, id) => Boolean(party?.members?.some((m) => m.id === id));
export const isLeader = (party, id) => Boolean(party) && party.leader === id;

export function addMember(party, { id, name }, now) {
  if (!party || party.members.length >= PARTY_MAX || isMember(party, id)) return null;
  return bump(party, { members: [...party.members, { id, name: named(name), since: now }] });
}

// (the leader taken out: whoever's been in longest leads, as they would
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

// who leads when the leader's gone: present(id) says who's here. The leader
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

// A roster's shape, checked again: partyWire.js has read what came off the
// wire, but a rule shouldn't trust its caller to have.
function wellFormed(msg) {
  if (!msg || typeof msg !== 'object' || msg.t !== 'ros' || typeof msg.p !== 'string' || typeof msg.l !== 'string') return false;
  if (!Number.isSafeInteger(msg.e) || msg.e < 1 || !Array.isArray(msg.m) || msg.m.length < 1 || msg.m.length > PARTY_MAX) return false;
  const ids = new Set(msg.m.map((m) => m?.id));
  return ids.size === msg.m.length && ids.has(msg.l) && [...ids].every((id) => typeof id === 'string');
}

// For your party: from the leader it names, one of yours, at a newer epoch
// (at the same one, the same leader saying it again, or a lower id: two who
// took over at once); or from the leader you have, handing over.
function believed(party, msg, fromId) {
  if (fromId === msg.l) return isMember(party, fromId) && (msg.e > party.epoch || (msg.e === party.epoch && msg.l <= party.leader));
  return fromId === party.leader && msg.e > party.epoch;
}

// Another party, as your way in: `joining` is the party whose invite you said
// yes to, by its id, or the invite itself ({ party, leader }: then only its
// leader's roster lets you in, as your yes went to them and anyone can read it).
function wayIn(msg, fromId, joining) {
  if (fromId !== msg.l || !joining) return false;
  if (typeof joining === 'string') return joining === msg.p;
  return joining.party === msg.p && joining.leader === fromId;
}

const same = (a, b) => a.leader === b.leader && a.epoch === b.epoch && a.members.length === b.members.length && a.members.every((m, i) => m.id === b.members[i].id && m.name === b.members[i].name);

export function applyRoster(party, msg, { fromId, selfId, joining = null, now }) {
  const ignored = { party, why: 'ignored' };
  if (!wellFormed(msg)) return ignored;
  const ours = Boolean(party) && party.id === msg.p;
  if (ours ? !believed(party, msg, fromId) : !wayIn(msg, fromId, joining)) return ignored;
  const was = new Map(ours ? party.members.map((m) => [m.id, m.since]) : []);
  const next = { id: msg.p, leader: msg.l, epoch: msg.e, members: msg.m.map(({ id, name }) => ({ id, name: named(name), since: was.get(id) ?? now })) };
  // (a roster for a party you're joining that hasn't you in it yet crossed your yes)
  if (!isMember(next, selfId)) return ours ? { party: null, why: 'removed' } : ignored;
  if (!ours) return { party: next, why: 'joined' };
  return same(party, next) ? ignored : { party: next, why: 'updated' };
}
