// A party, on the link: client.js's side of it, kept apart so client.js
// stays a size one can read. It holds your party (party.js's rules say who's
// in it and who leads; partyStore.js remembers it, so you're in it again
// next visit), the invites waiting for you, and which of the pilots here are
// your mates (`peer.mate`: a member of your party who's here, drawn in the
// ally green and spared, mates.js's isMate). It says the party's words
// (partyWire.js), seals its chat and opens a mate's (the room's seal and
// open: partyCrypt.js's, on the room's own key) and passes quick chat along
// (quips.js: `peer.quip`, { text, at }).
//
// Who's here, of a party: a member whose hello names it (`pt`, which every
// hello carries: `peer.pt`). Back online with a party remembered, you're in
// it alone till the others come; the leader sends the roster to each member
// who turns up, on every change and with every heartbeat while anyone else
// is here, so a member who missed one catches up. When the leader's gone
// (offline, quiet past the room's patience, or their hello naming no party
// or another) the first member here in joining order takes over (party.js's
// successor). A member whose hello names no party or another has left it,
// a goodbye the leader missed, and the leader takes them out (unless they've
// only just joined: a hello sent before the roster reached them).
//
// Anyone can send anything, so: nothing from a pilot unknown (no hello
// read) or blocked changes anything (client.js's admit); a roster is
// believed only as applyRoster says (from the leader it names, one of yours,
// or from the leader you have, handing over; another party's only as your
// way in, from the leader whose invite you said yes to); a yes is let in
// only if the pilot was asked, by the leader or by a member who told the
// leader whom (the same `inv`, sent to the leader with its `l` the pilot
// asked: the leader can't read an invite sent to another); an invite is
// believed only from someone whose hello names its party, led by someone
// whose hello does too; a summons or a removal only from the leader; a line
// of chat opened only from a mate. A pilot blocked is taken out (if you
// lead) or you leave (if you don't). What you send keeps within what the
// others take (protocol.js's RATES), and no two lines of chat go in one of
// nostr.js's bundles (two long ones could be more than an event may carry).
//
// createPartyLink({ self (client.js's: id, name, where), peers, emit, feed,
// roster, now, store (partyStore.js's, or null), rand, date }) → {
//   wire({ action, admit }), setCrypt({ seal, open } | null), helloField()
//   → { pt } | {}, hello(p, data, first) (a pilot's hello as it came in),
//   gone(p), blocked(p, on, muted) (muted: a flood's, for the visit),
//   tick() (the heartbeat's), snapshot() → { party: { id, leader, epoch,
//   members: [{ id, name, since, present, where, leader, you }] } | null,
//   invites: [{ from, name, party, leader, at }], follow }, quipOf(id) → the
//   line over them now (yours too) or null, api: { start(), invite(id),
//   accept(fromId), decline(fromId), leave(), remove(id), promote(id),
//   summon(), say(text) → Promise<bool>, quip(i), setFollow(on) }, dispose() }
// `now` is the client's clock; `date` the wall clock, for a member's
// `since`, which is kept across visits. Events, to emit: { type: 'party' }
// (any of the snapshot changed), { type: 'chat', line: { from, name, text,
// at, mine } }, { type: 'summon', from, name, where }, { type: 'quip', id,
// text }.

import { addMember, applyRoster, isLeader, isMember, newParty, promote as handTo, removeMember, rosterMsg, successor, takeOver } from './party';
import { CHAT_MAX, PARTY_MAX, newPartyId, readParty, readPartyId, readQuip, readSay, writeParty } from './partyWire';
import { QUIP_MS, quipText } from './quips';
import { createLimiter } from './protocol';
import { isMate } from './mates';
import { AWAY } from './where';

const INVITE_MS = 120000; // an invite waits this long for an answer, and a yes for its roster
const NO_AGAIN_MS = 60000; // after you turn an invite down, how long before they may ask again (as an alliance)
const JOIN_GRACE_MS = 20000; // a new member's hello may name no party this long (one sent before the roster reached them: a heartbeat and more)
const SAY_GAP = 150; // ms between lines of chat sent: past nostr.js's FLUSH_MS, so never two in a bundle
const SUMMON_GAP = 5000; // a summons at most this often

// a line as it goes: trimmed, and cut to CHAT_MAX characters (whole ones: an emoji isn't split)
const cut = (text) => [...text.trim()].slice(0, CHAT_MAX).join('');

export function createPartyLink({ self, peers, emit, feed, roster, now, store = null, rand, date = () => Date.now() }) {
  let party = null;
  let joining = null; // { party, leader, at }: the invite you said yes to, till its roster comes
  let crypt = null;
  let send = null;
  let admit = () => null;
  let follow = false;
  let mine = null; // your quick-chat line: { text, at }
  let lastSay = -Infinity;
  let lastSent = -Infinity;
  let lastSummon = -Infinity;
  const invites = new Map(); // from → { from, name, party, leader, at }
  const declined = new Map(); // from → when you said no
  const invited = new Map(); // id → { party, at }: whom you asked
  const asked = new Map(); // (leading) id → when they were asked in, by you or a member
  const added = new Map(); // (leading) id → when they came in
  const own = createLimiter(); // what you send, as the others count it

  const key = () => (typeof self.id === 'string' && self.id ? self.id : null);
  const changed = () => emit({ type: 'party' });
  // here, of your party: you, or a member not blocked whose hello names it
  const here = (id) => {
    if (!party) return false;
    if (id === key()) return true;
    const p = peers.get(id);
    return Boolean(p) && !p.blocked && p.pt === party.id;
  };
  const nameOf = (id) => peers.get(id)?.name || party?.members.find((m) => m.id === id)?.name || 'Someone';

  // a party word out (partyWire.js's writeParty: nothing that wouldn't read back), to one or all
  const tell = (msg, to) => {
    const wire = writeParty(msg);
    if (!wire || !send) return false;
    send.party(wire, to);
    return true;
  };
  // who's a mate now (the roster hears of a change: they're drawn apart)
  const mark = () => {
    let moved = false;
    for (const p of peers.values()) {
      const mate = Boolean(party) && p.id !== key() && isMember(party, p.id) && here(p.id);
      if ((p.mate === true) !== mate) moved = true;
      p.mate = mate;
    }
    if (moved) roster();
  };
  // kept (seen now), or forgotten: only a party kept for the key you fly
  // (another's, a guest tab's on this browser, isn't yours to forget)
  const keep = () => {
    if (party && key()) store?.save(party, key());
  };
  const forget = () => {
    const kept = store?.get();
    if (!kept || kept.as === key()?.slice(0, 16)) store?.clear();
  };
  // what changed in your party, said: who came, who went, who leads
  const news = (was, next) => {
    for (const m of next.members) if (!isMember(was, m.id) && m.id !== key()) feed(`${nameOf(m.id)} joined the party`, 'ally');
    for (const m of was.members) if (!isMember(next, m.id) && m.id !== key()) feed(`${m.name} left the party`, 'info');
    if (was.leader !== next.leader) feed(next.leader === key() ? 'You lead the party now' : `${nameOf(next.leader)} leads the party now`, 'ally');
  };
  const change = (next, told = true) => {
    const was = party;
    party = next;
    if (party) keep();
    else forget();
    if (told && was && party && was.id === party.id) news(was, party);
    mark();
    changed();
  };
  // the leader gone and you next: you lead, and say so
  const lead = () => {
    if (!party || isLeader(party, key()) || here(party.leader) || successor(party, here) !== key()) return;
    const next = takeOver(party, key());
    if (!next) return;
    change(next);
    tell(rosterMsg(next));
  };
  // out of your party: the leader hands over first, to whoever's here and in longest
  const leaveParty = () => {
    const was = party;
    if (!was) return;
    let handed = null;
    if (isLeader(was, key())) {
      const heir = successor(was, here);
      handed = removeMember(heir ? handTo(was, heir) : was, key());
    }
    change(null);
    if (handed) tell(rosterMsg(handed));
    tell({ t: 'left', p: was.id });
    feed('You left the party', 'info');
  };
  const removeOne = (id) => {
    if (!party || !isLeader(party, key()) || id === key()) return false;
    const next = removeMember(party, id);
    if (!next) return false;
    const name = nameOf(id);
    const pid = party.id;
    change(next, false);
    feed(`You removed ${name} from the party`, 'info');
    tell({ t: 'out', p: pid }, id);
    tell(rosterMsg(next));
    return true;
  };

  // The party's words, by what they are (`p`: the pilot who said it, heard and not blocked).
  const WORDS = {
    inv(msg, p) {
      // a member telling you, the leader, whom they asked (its `l`)
      if (party?.id === msg.p) {
        if (isLeader(party, key()) && isMember(party, p.id) && !isMember(party, msg.l)) asked.set(msg.l, now());
        return;
      }
      if (joining?.party === msg.p) return;
      // (from someone in the party it names, led by someone in it too)
      const leader = msg.l === p.id ? p : peers.get(msg.l);
      if (p.pt !== msg.p || !leader || leader.blocked || leader.pt !== msg.p) return;
      // turned down a moment ago: not again yet, and you're not asked
      if (now() - (declined.get(p.id) ?? -Infinity) < NO_AGAIN_MS) {
        tell({ t: 'no', p: msg.p }, p.id);
        return;
      }
      const fresh = invites.get(p.id)?.party !== msg.p;
      invites.set(p.id, { from: p.id, name: p.name, party: msg.p, leader: msg.l, at: now() });
      if (fresh) feed(`${p.name} asks you to their party`, 'ally');
      changed();
    },
    join(msg, p) {
      if (party?.id !== msg.p || !isLeader(party, key())) return;
      // (in already: their roster went astray, so again)
      if (isMember(party, p.id)) {
        tell(rosterMsg(party), p.id);
        return;
      }
      if (now() - (asked.get(p.id) ?? -Infinity) > INVITE_MS) return;
      asked.delete(p.id);
      const next = addMember(party, { id: p.id, name: p.name }, date());
      // (full: they're told no)
      if (!next) {
        tell({ t: 'no', p: msg.p }, p.id);
        return;
      }
      added.set(p.id, now());
      change(next);
      tell(rosterMsg(next));
    },
    no(msg, p) {
      if (joining?.party === msg.p && joining.leader === p.id) {
        joining = null;
        feed(`Couldn’t join ${p.name}’s party`, 'info');
        changed();
        return;
      }
      if (invited.get(p.id)?.party !== msg.p) return;
      invited.delete(p.id);
      feed(`${p.name} said no to the party`, 'info');
    },
    ros(msg, p) {
      const was = party;
      const { party: next, why } = applyRoster(party, msg, { fromId: p.id, selfId: key(), joining, now: date() });
      if (why === 'ignored') {
        // a member behind, thinking another leads: put right, if you lead
        if (was?.id === msg.p && isLeader(was, key()) && msg.l !== key() && isMember(was, p.id)) tell(rosterMsg(was), p.id);
        return;
      }
      if (why === 'removed') {
        change(null);
        feed('You’re no longer in the party', 'info');
        return;
      }
      if (why === 'joined') {
        joining = null;
        for (const [from, inv] of invites) if (inv.party === next.id) invites.delete(from);
        change(next);
        feed(`You joined ${nameOf(next.leader)}’s party`, 'ally');
        return;
      }
      change(next);
    },
    left(msg, p) {
      if (p.pt === msg.p) p.pt = null;
      if (party?.id !== msg.p || !isMember(party, p.id)) return;
      if (isLeader(party, key())) {
        const next = removeMember(party, p.id);
        if (next) {
          change(next);
          tell(rosterMsg(next));
        }
        return;
      }
      mark();
      changed();
      if (p.id === party.leader) lead();
    },
    out(msg, p) {
      if (party?.id !== msg.p || p.id !== party.leader) return;
      change(null);
      feed(`${p.name} removed you from the party`, 'info');
    },
    sum(msg, p) {
      if (party?.id !== msg.p || p.id !== party.leader) return;
      emit({ type: 'summon', from: p.id, name: p.name, where: msg.w });
    },
  };

  const onParty = (data, { peerId }) => {
    const msg = readParty(data);
    const p = msg && admit('party', peerId);
    if (!p || p.name === null || !key() || p.id === key()) return;
    WORDS[msg.t](msg, p);
  };
  // a line of chat: opened only from a mate, and still theirs once it's open
  const onSay = (data, { peerId }) => {
    const said = readSay(data);
    const p = said && admit('psay', peerId);
    if (!p || !party || !crypt || p.mate !== true || !isMember(party, p.id)) return;
    const pid = party.id;
    const c = crypt;
    Promise.resolve()
      .then(() => c.open(p.id, pid, said.b))
      .then(
        (text) => {
          const line = typeof text === 'string' ? cut(text) : '';
          if (!line || party?.id !== pid || p.mate !== true || peers.get(p.id) !== p) return;
          emit({ type: 'chat', line: { from: p.id, name: p.name, text: line, at: now(), mine: false } });
        },
        () => {},
      );
  };
  const onQuip = (data, { peerId }) => {
    const q = readQuip(data);
    const p = q && admit('quip', peerId);
    if (!p || p.name === null) return;
    const text = quipText(q.q);
    p.quip = { text, at: now() };
    emit({ type: 'quip', id: p.id, text });
    if (isMate(p)) feed(`${p.name}: ${text}`, 'ally');
  };

  const api = {
    start() {
      if (party || !key() || !send) return false;
      joining = null;
      change(newParty({ id: newPartyId(rand), self: { id: key(), name: self.name }, now: date() }));
      return true;
    },
    // asked to your party (none yet: one's started, you leading)
    invite(id) {
      const p = peers.get(id);
      if (!key() || !send || !p || p.blocked || p.name === null || id === key() || isMember(party, id)) return false;
      if ((!party && !api.start()) || party.members.length >= PARTY_MAX) return false;
      tell({ t: 'inv', p: party.id, l: party.leader }, id);
      if (isLeader(party, key())) asked.set(id, now());
      else tell({ t: 'inv', p: party.id, l: id }, party.leader);
      invited.set(id, { party: party.id, at: now() });
      return true;
    },
    // yes: to the leader it names (out of yours first, if you're in one)
    accept(fromId) {
      const inv = invites.get(fromId);
      if (!inv || !send) return false;
      invites.delete(fromId);
      if (party?.id === inv.party || !peers.has(inv.leader)) {
        changed();
        return false;
      }
      if (party) leaveParty();
      joining = { party: inv.party, leader: inv.leader, at: now() };
      tell({ t: 'join', p: inv.party }, inv.leader);
      changed();
      return true;
    },
    decline(fromId) {
      const inv = invites.get(fromId);
      if (!inv) return false;
      invites.delete(fromId);
      declined.set(fromId, now());
      tell({ t: 'no', p: inv.party }, fromId);
      changed();
      return true;
    },
    leave() {
      if (!party) return false;
      leaveParty();
      return true;
    },
    remove: (id) => removeOne(id),
    promote(id) {
      if (!party || !isLeader(party, key())) return false;
      const next = handTo(party, id);
      if (!next) return false;
      change(next);
      tell(rosterMsg(next));
      return true;
    },
    // the party to where you are (only somewhere they can follow you to)
    summon() {
      const t = now();
      if (!party || !isLeader(party, key()) || self.where === AWAY || t - lastSummon < SUMMON_GAP) return false;
      if (!party.members.some((m) => m.id !== key() && here(m.id))) return false;
      if (!tell({ t: 'sum', p: party.id, w: self.where })) return false;
      lastSummon = t;
      return true;
    },
    // a line of chat, sealed for each mate here
    async say(text) {
      if (!party || !crypt || !send || typeof text !== 'string') return false;
      const line = cut(text);
      const to = party.members.filter((m) => m.id !== key() && here(m.id)).map((m) => m.id);
      const t = now();
      if (!line || !to.length || t - lastSay < SAY_GAP || !own.allow('psay', t)) return false;
      lastSay = t;
      const pid = party.id;
      let blobs = null;
      try {
        blobs = await crypt.seal(to, pid, line);
      } catch {
        return false;
      }
      // (still in it, still online, and not on the heels of another line)
      if (!Array.isArray(blobs) || !blobs.length || party?.id !== pid || !send || now() - lastSent < SAY_GAP) return false;
      lastSent = now();
      send.psay({ b: blobs });
      emit({ type: 'chat', line: { from: key(), name: self.name, text: line, at: now(), mine: true } });
      return true;
    },
    quip(i) {
      const text = quipText(i);
      const t = now();
      if (!text || !send || !own.allow('quip', t)) return false;
      mine = { text, at: t };
      send.quip({ q: i });
      emit({ type: 'quip', id: key(), text });
      return true;
    },
    setFollow(on) {
      follow = Boolean(on);
      changed();
    },
  };

  return {
    api,
    wire({ action, admit: let_ }) {
      admit = let_;
      const words = action('party');
      const lines = action('psay');
      const quips = action('quip');
      send = {
        party: (data, to) => words.send(data, to ? { target: to } : undefined).catch(() => {}),
        psay: (data) => lines.send(data).catch(() => {}),
        quip: (data) => quips.send(data).catch(() => {}),
      };
      words.onMessage = onParty;
      lines.onMessage = onSay;
      quips.onMessage = onQuip;
      // your party, remembered: yours again if it was kept for the key you fly now
      const kept = key() && !party ? store?.get() : null;
      if (kept && kept.as === key().slice(0, 16) && isMember(kept.party, key())) {
        party = kept.party;
        keep();
        changed();
      }
    },
    setCrypt(c) {
      crypt = c && typeof c.seal === 'function' && typeof c.open === 'function' ? c : null;
    },
    helloField: () => (party ? { pt: party.id } : {}),
    hello(p, data, first = false) {
      if (!p || !key()) return;
      const was = here(p.id);
      p.pt = readPartyId(data?.pt);
      // (a stranger naming your party is nothing to it)
      if (!party || p.id === key() || !isMember(party, p.id)) return;
      const is = here(p.id);
      if (isLeader(party, key())) {
        // their hello names no party, or another: gone from it (a goodbye missed)
        if (!is && now() - (added.get(p.id) ?? -Infinity) > JOIN_GRACE_MS) {
          const next = removeMember(party, p.id);
          if (next) {
            change(next);
            tell(rosterMsg(next));
          }
          return;
        }
        // here (again): the roster, so they're up to date
        if (is && (first || !was)) tell(rosterMsg(party), p.id);
      } else if (p.id === party.leader && !is) lead();
      if (is !== was) {
        mark();
        changed();
      }
    },
    gone(p) {
      if (!p) return;
      p.mate = false;
      let moved = invites.delete(p.id);
      asked.delete(p.id);
      invited.delete(p.id);
      if (joining?.leader === p.id) {
        joining = null;
        moved = true;
      }
      if (party && isMember(party, p.id)) {
        moved = true;
        lead();
      }
      if (moved) changed();
    },
    // a block of yours takes them out of your party (you lead) or you out of
    // theirs (you don't); a flood's mute (`muted`) only stops them being a mate
    blocked(p, on, muted = false) {
      if (!p) return;
      if (on) {
        p.pt = null;
        p.quip = null;
        invites.delete(p.id);
        asked.delete(p.id);
        invited.delete(p.id);
        if (joining?.leader === p.id) joining = null;
        if (!muted && party && isMember(party, p.id)) {
          if (isLeader(party, key())) removeOne(p.id);
          else leaveParty();
        }
      }
      mark();
      lead();
      changed();
    },
    tick() {
      const t = now();
      let moved = false;
      for (const [from, inv] of invites) {
        if (t - inv.at <= INVITE_MS) continue;
        invites.delete(from);
        moved = true;
      }
      for (const [id, at] of asked) if (t - at > INVITE_MS) asked.delete(id);
      for (const [id, x] of invited) if (t - x.at > INVITE_MS) invited.delete(id);
      for (const [id, at] of declined) if (t - at >= NO_AGAIN_MS) declined.delete(id);
      for (const [id, at] of added) if (t - at > JOIN_GRACE_MS) added.delete(id);
      if (joining && t - joining.at > INVITE_MS) {
        joining = null;
        moved = true;
      }
      if (party) {
        if (!isLeader(party, key())) lead();
        else if (party.members.some((m) => m.id !== key() && here(m.id))) tell(rosterMsg(party));
        keep();
      }
      if (moved) changed();
    },
    snapshot() {
      const members = party?.members.map((m) => {
        const you = m.id === key();
        const present = here(m.id);
        const p = present && !you ? peers.get(m.id) : null;
        return { id: m.id, name: you ? self.name : p?.name || m.name, since: m.since, present, where: you ? self.where : (p?.where ?? null), leader: m.id === party.leader, you };
      });
      return { party: party && { id: party.id, leader: party.leader, epoch: party.epoch, members }, invites: [...invites.values()].map((i) => ({ ...i })), follow };
    },
    quipOf(id) {
      const p = id && id === key() ? null : peers.get(id);
      const q = id && id === key() ? mine : p && !p.blocked ? p.quip : null;
      return q && now() - q.at < QUIP_MS ? q.text : null;
    },
    // leaving the room, not the party: kept, seen now, for next time
    dispose() {
      keep();
      send = null;
      crypt = null;
      party = null;
      joining = null;
      mine = null;
      for (const m of [invites, declined, invited, asked, added]) m.clear();
    },
  };
}
