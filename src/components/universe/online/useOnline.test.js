import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// (what useOnline.js reads the ship and the wallet from, stood in for: only
// the chat’s count is tested here, and the real ones bring the crews and the
// wallet, a second’s import)
vi.mock('../EconomyProvider', () => ({ useEconomy: () => ({ marks: () => null }) }));
vi.mock('../shipyard/build', () => ({ HULL_KEY: 'hull', readHulls: () => ({}) }));
vi.mock('../../rickmorty/wardrobe/looks', () => ({ LOOK_KEY: 'looks', readLooks: () => ({}) }));
vi.mock('../outfit', () => ({ LOADOUT_KEY: 'loadout', STOCK_LOADOUT: {}, readLoadouts: () => ({}) }));

// useOnlineState run by hand, as React would run it, with no DOM here (as
// PartyHost.test.jsx runs PartyHost): its hooks kept between runs, its
// effects run after each and again till its state settles. Online as Alpha,
// on a stand-in link (`H.link`) whose events the test sends itself.
const H = vi.hoisted(() => ({ hooks: [], at: 0, effects: [], dirty: false, store: {}, link: null }));
vi.mock('react', async (load) => {
  const React = await load();
  const same = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => Object.is(x, b[i]));
  const slot = (make) => {
    const i = H.at++;
    H.hooks[i] ??= make();
    return H.hooks[i];
  };
  return {
    ...React,
    useState(init) {
      const s = slot(() => ({ v: typeof init === 'function' ? init() : init }));
      s.set ??= (next) => {
        const v = typeof next === 'function' ? next(s.v) : next;
        if (Object.is(v, s.v)) return;
        s.v = v;
        H.dirty = true;
      };
      return [s.v, s.set];
    },
    useRef: (current) => slot(() => ({ current })),
    useCallback(fn, deps) {
      const s = slot(() => ({}));
      if (!same(s.deps, deps)) Object.assign(s, { fn, deps });
      return s.fn;
    },
    useEffect(fn, deps) {
      const s = slot(() => ({}));
      if (same(s.deps, deps)) return;
      H.effects.push(() => {
        s.deps = deps;
        s.undo?.();
        const undo = fn();
        s.undo = typeof undo === 'function' ? undo : null;
      });
    },
  };
});
vi.mock('../../../lib/hooks', () => ({ local: { get: (k) => H.store[k] ?? null, set: (k, v) => (H.store[k] = v) } }));
vi.mock('./client', () => ({ createClient: () => H.link }));
vi.mock('./allies', () => ({ createAllies: () => ({}) }));
vi.mock('./partyStore', () => ({ createPartyStore: () => ({ follow: () => false, setFollow() {} }) }));
vi.mock('../../../runtime/local', () => ({ localSaves: () => ({}) }));
vi.mock('./nostr', () => ({ identity: () => ({ remember: true, guest: false }) }));

// (the hook by another name: run by hand below, not by React, which the hooks’ rules can’t tell)
const { unreadIn, useOnlineState: onlineState } = await import('./useOnline');

const OURS = '0123456789abcdef';
const OLD = 'fedcba9876543210';
// a line as useOnline keeps it: the link’s, stamped with its party, and its key here
const line = (key, party, mine = false) => ({ key, party, mine, from: 'b'.repeat(64), name: 'Bravo', text: 'Over here', at: 1, seen: 1 });

describe('the chat’s unread count', () => {
  it('counts the others’ lines in your party since you last read it', () => {
    const chat = [line(0, OURS), line(1, OURS, true), line(2, OURS), line(3, OURS)];
    expect(unreadIn(chat, OURS, 0)).toBe(3);
    expect(unreadIn(chat, OURS, 3)).toBe(1);
    expect(unreadIn(chat, OURS, 4)).toBe(0);
  });

  it('counts none from a party you were in before, and none out of a party', () => {
    const chat = [line(0, OLD), line(1, OLD), line(2, OURS)];
    expect(unreadIn(chat, OURS, 0)).toBe(1);
    expect(unreadIn(chat, OLD, 0)).toBe(2);
    expect(unreadIn(chat, null, 0)).toBe(0);
  });
});

describe('useOnline’s unread', () => {
  // runs it on /projects till it settles: → what it hands the pages
  function run() {
    for (let n = 0; n < 20; n++) {
      H.at = 0;
      H.effects = [];
      H.dirty = false;
      const out = onlineState('/projects');
      if (H.dirty) continue;
      for (const fx of H.effects) fx();
      if (!H.dirty) return out;
    }
    throw new Error('it never settles');
  }
  // (the link comes in by import: let it, then run again)
  const settle = async () => {
    await vi.dynamicImportSettled();
    await new Promise((r) => setTimeout(r, 0));
    return run();
  };
  const partyOf = (id) => ({ party: id && { id, leader: 'b'.repeat(64), epoch: 1, members: [] }, invites: [], follow: false });
  const heard = (party, mine = false) => ({ type: 'chat', line: { from: mine ? 'a'.repeat(64) : 'b'.repeat(64), name: mine ? 'Alpha' : 'Bravo', text: 'Over here', at: 1, mine, party } });

  beforeEach(() => {
    H.hooks = [];
    H.store = { 'tp-universe-online': 'on', 'tp-universe-callsign': 'Alpha' };
    let listener = null;
    H.link = {
      snap: { status: 'online', self: null, peers: [], away: [], party: partyOf(OURS) },
      snapshot() {
        return this.snap;
      },
      on: (fn) => ((listener = fn), () => (listener = null)),
      emit: (e) => listener?.(e), // (an event from the link, as it would send it)
      party: { setFollow() {} },
      setProfile() {},
      leave() {},
    };
    vi.stubGlobal('window', new EventTarget());
    vi.stubGlobal('document', Object.assign(new EventTarget(), { hidden: false }));
  });
  afterEach(() => {
    for (const s of H.hooks) s?.undo?.();
    vi.unstubAllGlobals();
  });

  it('is the party you’re in now’s lines from the others, till the Chat tab reads them', async () => {
    run();
    expect((await settle()).party?.party?.id).toBe(OURS);
    H.link.emit(heard(OURS));
    H.link.emit(heard(OURS, true)); // (your own isn’t yours to read)
    expect(run().unread).toBe(1);
    // in another party now: none of this one’s lines are its to read
    H.link.snap = { ...H.link.snap, party: partyOf(OLD) };
    H.link.emit({ type: 'party' });
    expect(run().unread).toBe(0);
    // out of a party, or the link dropped a moment: none
    H.link.snap = { ...H.link.snap, party: partyOf(null) };
    H.link.emit({ type: 'party' });
    expect(run().unread).toBe(0);
    // back in it: the line still waits; read, it doesn’t; a new one does
    H.link.snap = { ...H.link.snap, party: partyOf(OURS) };
    H.link.emit({ type: 'party' });
    const back = run();
    expect(back.unread).toBe(1);
    back.markRead();
    expect(run().unread).toBe(0);
    H.link.emit(heard(OURS));
    expect(run().unread).toBe(1);
  });
});
