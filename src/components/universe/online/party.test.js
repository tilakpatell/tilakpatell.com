import { describe, expect, it } from 'vitest';
import { EPOCH_MAX, PARTY_MAX } from './partyWire';
import { EPOCH_SPAN, addMember, applyRoster, beats, isLeader, isMember, newParty, promote, removeMember, rosterMsg, successor, takeOver } from './party';

const pilot = (n) => n.toString(16).padStart(64, '0'); // (a pilot’s id is their key: 64 hex digits)
const CALLSIGNS = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel', 'India'];
const nameOf = (id) => CALLSIGNS[parseInt(id, 16) - 1] ?? 'Pilot';
const [ALPHA, BRAVO, CHARLIE, DELTA] = [1, 2, 3, 4].map(pilot);
const P = 'a1b2c3d4e5f60718'; // a party’s id: 16 hex digits
const OTHER = '0123456789abcdef';

// deep-frozen, so a rule that changed what it was handed would throw
const freeze = (o) => {
  if (o && typeof o === 'object') {
    Object.values(o).forEach(freeze);
    Object.freeze(o);
  }
  return o;
};
// a party of these pilots, the first leading, the rest joining a second apart
function partyOf(...ids) {
  let party = newParty({ id: P, self: { id: ids[0], name: nameOf(ids[0]) }, now: 1000 });
  ids.slice(1).forEach((id, i) => {
    party = addMember(party, { id, name: nameOf(id) }, 2000 + 1000 * i);
  });
  return freeze(party);
}
// a roster as the wire would bring it
const ros = (l, e, ids, p = P) => freeze({ t: 'ros', p, l, e, m: ids.map((id) => ({ id, name: nameOf(id) })) });
const here = (...ids) => (id) => ids.includes(id);

describe('newParty, isMember, isLeader', () => {
  it('starts a party of one, its leader, at epoch 1', () => {
    expect(newParty({ id: P, self: { id: ALPHA, name: 'Alpha' }, now: 1000 })).toEqual({ id: P, leader: ALPHA, epoch: 1, members: [{ id: ALPHA, name: 'Alpha', since: 1000 }] });
  });
  it('shows an unreadable name as Pilot', () => {
    expect(newParty({ id: P, self: { id: ALPHA, name: '‮' }, now: 1 }).members[0].name).toBe('Pilot');
  });
  it('knows who is in it and who leads', () => {
    const party = partyOf(ALPHA, BRAVO);
    expect(isMember(party, ALPHA)).toBe(true);
    expect(isMember(party, BRAVO)).toBe(true);
    expect(isMember(party, CHARLIE)).toBe(false);
    expect(isLeader(party, ALPHA)).toBe(true);
    expect(isLeader(party, BRAVO)).toBe(false);
  });
  it('says no for no party at all', () => {
    expect(isMember(null, ALPHA)).toBe(false);
    expect(isLeader(null, ALPHA)).toBe(false);
  });
});

describe('addMember', () => {
  it('adds a pilot last, in joining order, since now, at the next epoch', () => {
    const party = partyOf(ALPHA);
    const next = addMember(party, { id: BRAVO, name: 'Bravo' }, 5000);
    expect(next).toEqual({ id: P, leader: ALPHA, epoch: 2, members: [{ id: ALPHA, name: 'Alpha', since: 1000 }, { id: BRAVO, name: 'Bravo', since: 5000 }] });
    expect(party.members).toHaveLength(1); // (what it was handed is as it was)
  });
  it('adds no one already in it', () => {
    expect(addMember(partyOf(ALPHA, BRAVO), { id: BRAVO, name: 'Bravo' }, 5000)).toBeNull();
  });
  it('adds no one past PARTY_MAX', () => {
    expect(PARTY_MAX).toBe(8);
    const ids = Array.from({ length: PARTY_MAX }, (_, i) => pilot(i + 1));
    const full = partyOf(...ids);
    expect(full.members).toHaveLength(PARTY_MAX);
    expect(full.epoch).toBe(PARTY_MAX);
    expect(addMember(full, { id: pilot(PARTY_MAX + 1), name: 'India' }, 9000)).toBeNull();
  });
  it('adds to no party', () => {
    expect(addMember(null, { id: BRAVO, name: 'Bravo' }, 5000)).toBeNull();
  });
});

describe('removeMember', () => {
  it('takes a member out, the rest in order, at the next epoch', () => {
    const next = removeMember(partyOf(ALPHA, BRAVO, CHARLIE), BRAVO);
    expect(next.epoch).toBe(4);
    expect(next.leader).toBe(ALPHA);
    expect(next.members.map((m) => m.id)).toEqual([ALPHA, CHARLIE]);
    expect(next.members[1].since).toBe(3000);
  });
  it('takes out no one who isn’t in it', () => {
    expect(removeMember(partyOf(ALPHA, BRAVO), CHARLIE)).toBeNull();
    expect(removeMember(null, ALPHA)).toBeNull();
  });
  it('hands the lead to the next member in order when the leader goes', () => {
    const next = removeMember(partyOf(ALPHA, BRAVO, CHARLIE), ALPHA);
    expect(next.leader).toBe(BRAVO);
    expect(next.members.map((m) => m.id)).toEqual([BRAVO, CHARLIE]);
    expect(next.epoch).toBe(4);
    // (a leader made later in the order: the one in longest still leads after them)
    const led = promote(partyOf(ALPHA, BRAVO, CHARLIE), CHARLIE);
    expect(removeMember(led, CHARLIE).leader).toBe(ALPHA);
  });
  it('is no party once the last one goes', () => {
    expect(removeMember(partyOf(ALPHA), ALPHA)).toBeNull();
  });
});

describe('promote and takeOver', () => {
  it('makes another member leader at the next epoch', () => {
    const next = promote(partyOf(ALPHA, BRAVO, CHARLIE), CHARLIE);
    expect(next.leader).toBe(CHARLIE);
    expect(next.epoch).toBe(4);
    expect(next.members.map((m) => m.id)).toEqual([ALPHA, BRAVO, CHARLIE]);
  });
  it('makes no leader of a stranger, nor of the leader already', () => {
    expect(promote(partyOf(ALPHA, BRAVO), CHARLIE)).toBeNull();
    expect(promote(partyOf(ALPHA, BRAVO), ALPHA)).toBeNull();
    expect(promote(null, ALPHA)).toBeNull();
  });
  it('takes the lead for yourself at the next epoch', () => {
    const next = takeOver(partyOf(ALPHA, BRAVO, CHARLIE), BRAVO);
    expect(next.leader).toBe(BRAVO);
    expect(next.epoch).toBe(4);
  });
  it('takes no lead in a party you aren’t in', () => {
    expect(takeOver(partyOf(ALPHA, BRAVO), CHARLIE)).toBeNull();
    expect(takeOver(null, ALPHA)).toBeNull();
  });
});

describe('the epoch’s edge', () => {
  it('makes no change past EPOCH_MAX, so the epoch never leaves the whole numbers it can be compared in', () => {
    // (one past Number.MAX_SAFE_INTEGER is a number two epochs share: the next roster couldn’t be told from the last)
    const edge = freeze({ ...partyOf(ALPHA, BRAVO, CHARLIE), epoch: EPOCH_MAX });
    expect(addMember(edge, { id: DELTA, name: 'Delta' }, 1)).toBeNull();
    expect(removeMember(edge, CHARLIE)).toBeNull();
    expect(promote(edge, BRAVO)).toBeNull();
    expect(takeOver(edge, BRAVO)).toBeNull();
    expect(takeOver({ ...edge, epoch: EPOCH_MAX - 1 }, BRAVO).epoch).toBe(EPOCH_MAX);
  });
});

describe('successor', () => {
  it('is the first member present in joining order, the leader aside', () => {
    const party = partyOf(ALPHA, BRAVO, CHARLIE, DELTA);
    expect(successor(party, here(BRAVO, CHARLIE, DELTA))).toBe(BRAVO);
    expect(successor(party, here(CHARLIE, DELTA))).toBe(CHARLIE);
    expect(successor(party, here(DELTA))).toBe(DELTA);
    // (the leader, here and handing over as they leave, isn’t their own successor)
    expect(successor(party, here(ALPHA, CHARLIE))).toBe(CHARLIE);
  });
  it('goes by joining order wherever the leader is in it', () => {
    const party = promote(partyOf(ALPHA, BRAVO, CHARLIE), BRAVO);
    expect(successor(party, here(ALPHA, CHARLIE))).toBe(ALPHA);
  });
  it('is no one when no one else is here', () => {
    expect(successor(partyOf(ALPHA, BRAVO), here())).toBeNull();
    expect(successor(partyOf(ALPHA), here(ALPHA))).toBeNull();
    expect(successor(null, here(ALPHA))).toBeNull();
  });
});

describe('rosterMsg', () => {
  it('says the party, its leader, its epoch and its members in order', () => {
    expect(rosterMsg(partyOf(ALPHA, BRAVO))).toEqual({ t: 'ros', p: P, l: ALPHA, e: 2, m: [{ id: ALPHA, name: 'Alpha' }, { id: BRAVO, name: 'Bravo' }] });
  });
});

describe('applyRoster', () => {
  const at = (fromId, selfId, extra = {}) => ({ fromId, selfId, now: 9000, ...extra });

  describe('as your way in', () => {
    it('joins the party whose invite you said yes to, everyone since now', () => {
      const out = applyRoster(null, ros(ALPHA, 2, [ALPHA, BRAVO]), at(ALPHA, BRAVO, { joining: P }));
      expect(out.why).toBe('joined');
      expect(out.party).toEqual({ id: P, leader: ALPHA, epoch: 2, members: [{ id: ALPHA, name: 'Alpha', since: 9000 }, { id: BRAVO, name: 'Bravo', since: 9000 }] });
    });
    it('joins from another party (the caller leaves that one)', () => {
      const mine = freeze(newParty({ id: OTHER, self: { id: BRAVO, name: 'Bravo' }, now: 1 }));
      expect(applyRoster(mine, ros(ALPHA, 2, [ALPHA, BRAVO]), at(ALPHA, BRAVO, { joining: P })).why).toBe('joined');
    });
    it('takes a roster as the invite’s only from the leader it named, when the invite is handed in', () => {
      const invite = { from: CHARLIE, name: 'Charlie', party: P, leader: ALPHA, at: 1 };
      expect(applyRoster(null, ros(DELTA, 9, [DELTA, BRAVO]), at(DELTA, BRAVO, { joining: invite }))).toEqual({ party: null, why: 'ignored' });
      expect(applyRoster(null, ros(ALPHA, 3, [ALPHA, CHARLIE, BRAVO]), at(ALPHA, BRAVO, { joining: invite })).why).toBe('joined');
    });
    it('ignores a party you didn’t say yes to', () => {
      expect(applyRoster(null, ros(ALPHA, 2, [ALPHA, BRAVO]), at(ALPHA, BRAVO))).toEqual({ party: null, why: 'ignored' });
      expect(applyRoster(null, ros(ALPHA, 2, [ALPHA, BRAVO]), at(ALPHA, BRAVO, { joining: OTHER })).why).toBe('ignored');
      const mine = partyOf(BRAVO);
      expect(applyRoster(mine, ros(ALPHA, 2, [ALPHA, BRAVO], OTHER), at(ALPHA, BRAVO))).toEqual({ party: mine, why: 'ignored' });
    });
    it('ignores one from anyone but the leader it names', () => {
      expect(applyRoster(null, ros(ALPHA, 2, [ALPHA, BRAVO]), at(CHARLIE, BRAVO, { joining: P })).why).toBe('ignored');
    });
    it('waits for one with you in it (a roster sent before you were let in)', () => {
      expect(applyRoster(null, ros(ALPHA, 1, [ALPHA]), at(ALPHA, BRAVO, { joining: P }))).toEqual({ party: null, why: 'ignored' });
    });
  });

  describe('for your party', () => {
    it('takes a newer roster from its leader, members keeping their since', () => {
      const mine = partyOf(ALPHA, BRAVO); // (Bravo’s view)
      const out = applyRoster(mine, ros(ALPHA, 3, [ALPHA, BRAVO, CHARLIE]), at(ALPHA, BRAVO));
      expect(out.why).toBe('updated');
      expect(out.party).toEqual({ id: P, leader: ALPHA, epoch: 3, members: [{ id: ALPHA, name: 'Alpha', since: 1000 }, { id: BRAVO, name: 'Bravo', since: 2000 }, { id: CHARLIE, name: 'Charlie', since: 9000 }] });
    });
    it('ignores a stale epoch', () => {
      const mine = partyOf(ALPHA, BRAVO, CHARLIE);
      expect(applyRoster(mine, ros(ALPHA, 2, [ALPHA, BRAVO]), at(ALPHA, BRAVO))).toEqual({ party: mine, why: 'ignored' });
    });
    it('hears the same roster again as nothing new, and a new name as news', () => {
      const mine = partyOf(ALPHA, BRAVO);
      expect(applyRoster(mine, rosterMsg(mine), at(ALPHA, BRAVO))).toEqual({ party: mine, why: 'ignored' });
      const renamed = freeze({ ...rosterMsg(mine), m: [{ id: ALPHA, name: 'Alpha Two' }, { id: BRAVO, name: 'Bravo' }] });
      const out = applyRoster(mine, renamed, at(ALPHA, BRAVO));
      expect(out.why).toBe('updated');
      expect(out.party.members[0]).toEqual({ id: ALPHA, name: 'Alpha Two', since: 1000 });
      expect(out.party.epoch).toBe(2);
    });
    it('takes a member passing on the roster they hold only while your leader isn’t here to say it', () => {
      // (a member back from last visit catches up from whoever of the party is
      // here: the leader may be someone they’ve never met, or away)
      const mine = partyOf(ALPHA, BRAVO, CHARLIE);
      const away = applyRoster(mine, ros(ALPHA, 9, [ALPHA, BRAVO, CHARLIE]), at(CHARLIE, BRAVO));
      expect(away.why).toBe('updated');
      expect(away.party).toMatchObject({ leader: ALPHA, epoch: 9 });
      expect(applyRoster(mine, ros(ALPHA, 9, [ALPHA, BRAVO, CHARLIE]), at(CHARLIE, BRAVO, { present: here(ALPHA) })).why).toBe('ignored');
      // (and only from one who’s in what they pass on)
      expect(applyRoster(mine, ros(ALPHA, 9, [ALPHA, BRAVO]), at(CHARLIE, BRAVO)).why).toBe('ignored');
    });
    it('a leader takes another’s word for the party only while theirs may be out of date (`present` says they aren’t)', () => {
      // (Alpha, back from the store, leading as he left it: the party moved on without him)
      const mine = partyOf(ALPHA, BRAVO, CHARLIE);
      const moved = ros(DELTA, 6, [ALPHA, BRAVO, CHARLIE, DELTA]);
      expect(applyRoster(mine, moved, at(BRAVO, ALPHA)).party.leader).toBe(DELTA);
      expect(applyRoster(mine, moved, at(BRAVO, ALPHA, { present: here(ALPHA) })).why).toBe('ignored');
    });
    it('is removed only by its own leader: a member’s roster without you is ignored', () => {
      // (a takeover from a fork you never saw doesn’t put you out: only the one you follow does)
      const mine = partyOf(ALPHA, BRAVO, CHARLIE);
      expect(applyRoster(mine, ros(CHARLIE, 4, [ALPHA, CHARLIE]), at(CHARLIE, BRAVO))).toEqual({ party: mine, why: 'ignored' });
      expect(applyRoster(mine, ros(ALPHA, 4, [ALPHA, CHARLIE]), at(CHARLIE, BRAVO))).toEqual({ party: mine, why: 'ignored' });
      expect(applyRoster(mine, ros(ALPHA, 4, [ALPHA, CHARLIE]), at(ALPHA, BRAVO)).why).toBe('removed');
    });
    it('a leader back from last visit is put out by the member who took over from them, and by no one else', () => {
      // (Alpha led, went, and Bravo, taking over, took him out: back as he left it, Alpha leads, and no one else would tell him)
      const mine = partyOf(ALPHA, BRAVO, CHARLIE);
      const out = ros(BRAVO, 5, [BRAVO, CHARLIE]);
      expect(applyRoster(mine, out, at(BRAVO, ALPHA))).toEqual({ party: null, why: 'removed' });
      // (or at the epoch he holds: Bravo, back from the store too, leading as he left it, put him out while he was away)
      expect(applyRoster(mine, ros(BRAVO, 3, [BRAVO, CHARLIE]), at(BRAVO, ALPHA)).why).toBe('removed');
      // not once what he holds is more than the store’s word, nor on a member passing on another’s, nor at an older epoch
      expect(applyRoster(mine, out, at(BRAVO, ALPHA, { present: here(ALPHA) })).why).toBe('ignored');
      expect(applyRoster(mine, ros(CHARLIE, 5, [BRAVO, CHARLIE]), at(BRAVO, ALPHA)).why).toBe('ignored');
      expect(applyRoster(mine, ros(BRAVO, 2, [BRAVO, CHARLIE]), at(BRAVO, ALPHA)).why).toBe('ignored');
      expect(applyRoster(mine, ros(BRAVO, 4 + EPOCH_SPAN, [BRAVO, CHARLIE]), at(BRAVO, ALPHA)).why).toBe('ignored');
    });
    it('takes a member’s word at most EPOCH_SPAN past yours, so no one can push the epoch past every roster to come', () => {
      expect(EPOCH_SPAN).toBe(256);
      const mine = partyOf(ALPHA, BRAVO, CHARLIE); // (epoch 3)
      expect(applyRoster(mine, ros(CHARLIE, 3 + EPOCH_SPAN, [ALPHA, BRAVO, CHARLIE]), at(CHARLIE, BRAVO)).party.epoch).toBe(3 + EPOCH_SPAN);
      expect(applyRoster(mine, ros(CHARLIE, 4 + EPOCH_SPAN, [ALPHA, BRAVO, CHARLIE]), at(CHARLIE, BRAVO)).why).toBe('ignored');
      for (const e of [Number.MAX_SAFE_INTEGER, EPOCH_MAX]) expect(applyRoster(mine, ros(CHARLIE, e, [CHARLIE, BRAVO, ALPHA]), at(CHARLIE, BRAVO)).why).toBe('ignored');
      // (no epoch the wire couldn’t carry, from anyone)
      expect(applyRoster(mine, ros(ALPHA, Number.MAX_SAFE_INTEGER, [ALPHA, BRAVO, CHARLIE]), at(ALPHA, BRAVO)).why).toBe('ignored');
    });
    it('takes its leader’s roster at the same epoch only as a rename, or the roster again', () => {
      const mine = partyOf(ALPHA, BRAVO, CHARLIE);
      expect(applyRoster(mine, ros(ALPHA, 3, [ALPHA, BRAVO, DELTA]), at(ALPHA, BRAVO)).why).toBe('ignored');
      expect(applyRoster(mine, ros(ALPHA, 3, [ALPHA, BRAVO]), at(ALPHA, BRAVO)).why).toBe('ignored');
    });
    it('ignores a stranger naming themselves leader of it (its id is public)', () => {
      const mine = partyOf(ALPHA, BRAVO);
      expect(applyRoster(mine, ros(DELTA, 9, [DELTA, ALPHA, BRAVO]), at(DELTA, BRAVO))).toEqual({ party: mine, why: 'ignored' });
      expect(applyRoster(mine, ros(DELTA, 9, [DELTA]), at(DELTA, BRAVO))).toEqual({ party: mine, why: 'ignored' });
    });
    it('is out of it when its leader’s roster leaves you out', () => {
      const mine = partyOf(ALPHA, BRAVO, CHARLIE);
      expect(applyRoster(mine, rosterMsg(removeMember(mine, BRAVO)), at(ALPHA, BRAVO))).toEqual({ party: null, why: 'removed' });
    });
    it('takes the leader handing over to another member (Make leader)', () => {
      const mine = partyOf(ALPHA, BRAVO, CHARLIE);
      const handed = rosterMsg(promote(mine, CHARLIE));
      // (from the leader you know, naming the new one: Bravo’s view and Charlie’s)
      expect(applyRoster(mine, handed, at(ALPHA, BRAVO)).party.leader).toBe(CHARLIE);
      expect(applyRoster(mine, handed, at(ALPHA, CHARLIE)).party.leader).toBe(CHARLIE);
      // (a hand-over is always to a new epoch; from anyone but the leader you know, while they’re here, nothing)
      expect(applyRoster(mine, { ...handed, e: mine.epoch }, at(ALPHA, BRAVO)).why).toBe('ignored');
      expect(applyRoster(mine, handed, at(BRAVO, CHARLIE, { present: here(ALPHA) })).why).toBe('ignored');
    });
    it('takes a leader leaving: handed over, then out', () => {
      const mine = partyOf(ALPHA, BRAVO, CHARLIE);
      const left = removeMember(mine, ALPHA);
      const out = applyRoster(mine, rosterMsg(left), at(ALPHA, CHARLIE));
      expect(out.why).toBe('updated');
      expect(out.party.leader).toBe(BRAVO);
      expect(out.party.members.map((m) => m.id)).toEqual([BRAVO, CHARLIE]);
    });
    it('ignores junk', () => {
      const mine = partyOf(ALPHA, BRAVO);
      const junk = [null, 'ros', {}, { ...rosterMsg(mine), t: 'inv' }, { ...rosterMsg(mine), e: 0 }, { ...rosterMsg(mine), e: 2.5 }, { ...rosterMsg(mine), m: [] }, { ...rosterMsg(mine), m: [{ id: BRAVO, name: 'Bravo' }] }, { ...rosterMsg(mine), e: 3, m: [{ id: ALPHA, name: 'Alpha' }, { id: ALPHA, name: 'Alpha' }, { id: BRAVO, name: 'Bravo' }] }];
      for (const msg of junk) expect(applyRoster(mine, msg, at(ALPHA, BRAVO))).toEqual({ party: mine, why: 'ignored' });
      const many = ros(ALPHA, 9, Array.from({ length: PARTY_MAX + 1 }, (_, i) => pilot(i + 1)));
      expect(applyRoster(mine, many, at(ALPHA, BRAVO)).why).toBe('ignored');
    });
  });

  describe('when the leader is gone', () => {
    it('the first member here takes over and the others follow', () => {
      const party = partyOf(ALPHA, BRAVO, CHARLIE, DELTA);
      const present = here(BRAVO, CHARLIE, DELTA); // (Alpha’s gone)
      expect(successor(party, present)).toBe(BRAVO);
      const led = takeOver(party, BRAVO);
      expect(led.epoch).toBe(5);
      for (const self of [CHARLIE, DELTA]) {
        const out = applyRoster(party, rosterMsg(led), at(BRAVO, self));
        expect(out.why).toBe('updated');
        expect(out.party).toEqual(led);
      }
    });
    it('two taking over at once from one roster: the lower leader id leads, whoever hears what first', () => {
      const party = partyOf(ALPHA, BRAVO, CHARLIE, DELTA);
      const byBravo = takeOver(party, BRAVO);
      const byCharlie = takeOver(party, CHARLIE);
      expect(byBravo.epoch).toBe(byCharlie.epoch);
      // Charlie hears Bravo’s and gives way; Bravo hears Charlie’s and keeps it
      expect(applyRoster(byCharlie, rosterMsg(byBravo), at(BRAVO, CHARLIE)).party.leader).toBe(BRAVO);
      expect(applyRoster(byBravo, rosterMsg(byCharlie), at(CHARLIE, BRAVO))).toEqual({ party: byBravo, why: 'ignored' });
      // Delta, in either order, ends with Bravo
      const first = applyRoster(party, rosterMsg(byCharlie), at(CHARLIE, DELTA)).party;
      expect(applyRoster(first, rosterMsg(byBravo), at(BRAVO, DELTA)).party.leader).toBe(BRAVO);
      const other = applyRoster(party, rosterMsg(byBravo), at(BRAVO, DELTA)).party;
      expect(applyRoster(other, rosterMsg(byCharlie), at(CHARLIE, DELTA)).why).toBe('ignored');
    });
    it('a higher epoch wins over a lower id', () => {
      const party = partyOf(ALPHA, BRAVO, CHARLIE);
      const byCharlie = takeOver(takeOver(party, BRAVO), CHARLIE);
      const byBravo = takeOver(party, BRAVO);
      expect(applyRoster(byBravo, rosterMsg(byCharlie), at(CHARLIE, BRAVO)).party.leader).toBe(CHARLIE);
    });
    it('at the same epoch, the roster with more members wins: a stale takeover is one with fewer', () => {
      // Bravo led {Bravo, Alpha}; Alpha, away, kept it. Bravo let Charlie in
      // (epoch 3). Alpha, back alone, took over his old roster (epoch 3 too):
      // the live roster wins wherever it’s heard, and no one’s put out.
      const live = freeze(addMember(partyOf(BRAVO, ALPHA), { id: CHARLIE, name: 'Charlie' }, 5000));
      const stale = freeze(takeOver(partyOf(BRAVO, ALPHA), ALPHA));
      expect([live.epoch, stale.epoch]).toEqual([3, 3]);
      expect(beats(live, stale)).toBe(true);
      expect(beats(stale, live)).toBe(false);
      expect(applyRoster(stale, rosterMsg(live), at(BRAVO, ALPHA)).party.members.map((m) => m.id)).toEqual([BRAVO, ALPHA, CHARLIE]);
      expect(applyRoster(live, rosterMsg(stale), at(ALPHA, BRAVO)).why).toBe('ignored');
      expect(applyRoster(live, rosterMsg(stale), at(ALPHA, CHARLIE)).why).toBe('ignored');
    });
    it('the tie is a total order: the same members, the lower leader id; the same leader, the lower ids', () => {
      const a = { leader: ALPHA, members: [{ id: ALPHA }, { id: BRAVO }] };
      const b = { leader: BRAVO, members: [{ id: BRAVO }, { id: ALPHA }] };
      const c = { leader: ALPHA, members: [{ id: ALPHA }, { id: CHARLIE }] };
      expect([beats(a, b), beats(b, a)]).toEqual([true, false]);
      expect([beats(a, c), beats(c, a)]).toEqual([true, false]);
      expect([beats(a, a), beats(a, { ...a, members: [...a.members].reverse() })]).toEqual([false, false]);
    });
    it('the old leader, back, takes the newer roster like any member', () => {
      const party = partyOf(ALPHA, BRAVO, CHARLIE);
      const led = takeOver(party, BRAVO);
      const out = applyRoster(party, rosterMsg(led), at(BRAVO, ALPHA));
      expect(out.why).toBe('updated');
      expect(isLeader(out.party, ALPHA)).toBe(false);
      expect(isLeader(out.party, BRAVO)).toBe(true);
      // and what it says as leader still, the others don’t take
      expect(applyRoster(led, rosterMsg(party), at(ALPHA, CHARLIE))).toEqual({ party: led, why: 'ignored' });
    });
  });

  describe('remembered, and blocks', () => {
    it('a party kept from last visit takes the roster as it is now', () => {
      // (Charlie’s, from the store: Alpha leading at epoch 3; since then Bravo
      // took over and Delta joined)
      const kept = partyOf(ALPHA, BRAVO, CHARLIE);
      const now = addMember(takeOver(kept, BRAVO), { id: DELTA, name: 'Delta' }, 8000);
      const out = applyRoster(kept, rosterMsg(now), at(BRAVO, CHARLIE));
      expect(out.why).toBe('updated');
      expect(out.party.leader).toBe(BRAVO);
      expect(out.party.members.map((m) => [m.id, m.since])).toEqual([
        [ALPHA, 1000],
        [BRAVO, 2000],
        [CHARLIE, 3000],
        [DELTA, 9000],
      ]);
    });
    it('the leader you had, back with a newer roster that leaves out the one whose word you took, is believed', () => {
      // Charlie, back from last visit with Alpha leading at epoch 4, took Delta
      // at his word (Delta, removed while Charlie was away, says he leads at
      // epoch 9). Alpha’s roster at epoch 5, without Delta, is believed over
      // it: the leader you had says the one you listened to is out.
      const kept = partyOf(ALPHA, BRAVO, CHARLIE, DELTA);
      const lied = applyRoster(kept, ros(DELTA, 9, [DELTA, ALPHA, BRAVO, CHARLIE]), at(DELTA, CHARLIE)).party;
      expect(lied).toMatchObject({ leader: DELTA, epoch: 9 });
      const real = rosterMsg(removeMember(kept, DELTA));
      const prior = { leader: ALPHA, epoch: 4, from: DELTA };
      expect(applyRoster(lied, real, at(ALPHA, CHARLIE)).why).toBe('ignored');
      const out = applyRoster(lied, real, at(ALPHA, CHARLIE, { prior }));
      expect(out.why).toBe('updated');
      expect(out.party).toMatchObject({ leader: ALPHA, epoch: 5 });
      expect(out.party.members.map((m) => m.id)).toEqual([ALPHA, BRAVO, CHARLIE]);
      // (one that still has Delta in it, or no newer than you had, or from anyone else, isn’t)
      expect(applyRoster(lied, ros(ALPHA, 5, [ALPHA, BRAVO, CHARLIE, DELTA]), at(ALPHA, CHARLIE, { prior })).why).toBe('ignored');
      expect(applyRoster(lied, ros(ALPHA, 4, [ALPHA, BRAVO, CHARLIE]), at(ALPHA, CHARLIE, { prior })).why).toBe('ignored');
      expect(applyRoster(lied, ros(BRAVO, 5, [BRAVO, CHARLIE]), at(BRAVO, CHARLIE, { prior })).why).toBe('ignored');
    });
    it('alone after a reload with the leader not back, you take over', () => {
      const kept = partyOf(ALPHA, BRAVO);
      expect(successor(kept, here(BRAVO))).toBe(BRAVO);
      expect(takeOver(kept, BRAVO)).toEqual({ ...kept, leader: BRAVO, epoch: 3 });
    });
    it('a blocked member is taken out by the leader, and a member who blocks the leader leaves', () => {
      const party = partyOf(ALPHA, BRAVO, CHARLIE);
      // Alpha blocks Charlie: out, and Charlie hears so
      const without = removeMember(party, CHARLIE);
      expect(applyRoster(party, rosterMsg(without), at(ALPHA, CHARLIE))).toEqual({ party: null, why: 'removed' });
      // Bravo blocks Alpha: Bravo leaves, and Alpha’s roster says so
      const left = removeMember(without, BRAVO);
      expect(left.members.map((m) => m.id)).toEqual([ALPHA]);
    });
  });
});
