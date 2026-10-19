import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AWAY } from './where';

// PartyHost run by hand, as React would run it, with no DOM here: its hooks
// kept between runs, its effects run after each and again till its state
// settles, its timers on vitest’s clock. What it draws is read as elements;
// the lazy dialog and calls aren’t loaded, only the props they’re given.
const H = vi.hoisted(() => ({ hooks: [], at: 0, effects: [], dirty: false, navigate: null }));
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
vi.mock('react-router-dom', async (load) => ({ ...(await load()), useNavigate: () => H.navigate }));
vi.mock('react-dom', async (load) => ({ ...(await load()), createPortal: (children, to) => ({ type: 'portal', to, props: { children } }) }));

const { default: PartyHost } = await import('./PartyHost');

// runs it with `online` till it settles: → what it drew
function run(online) {
  for (let n = 0; n < 20; n++) {
    H.at = 0;
    H.effects = [];
    H.dirty = false;
    const out = PartyHost({ online });
    if (H.dirty) continue; // (state set while drawing: drawn again before its effects, as React does)
    for (const fx of H.effects) fx();
    if (!H.dirty) return out;
  }
  throw new Error('it never settles');
}
// every element drawn, depth first
const elements = (node, out = []) => {
  if (Array.isArray(node)) for (const n of node) elements(n, out);
  else if (node?.props) {
    out.push(node);
    elements(node.props.children, out);
  }
  return out;
};
// what PartyCalls is given (null when it isn’t drawn), and what the dialog’s given
const calls = (tree) => elements(tree).find((el) => 'onStay' in el.props)?.props ?? null;
const dialog = (tree) => elements(tree).find((el) => 'request' in el.props)?.props ?? null;

const ALPHA = 'a'.repeat(64);
const BRAVO = 'b'.repeat(64);
const CHARLIE = 'c'.repeat(64);
const PARTY = '0123456789abcdef';
const BREE = '/middle-earth/bree';
// Alpha’s online state on `here`, in Bravo’s party, Bravo at `at` (null: offline)
const online = ({ here = '/projects', at = '/projects', follow = true, summon = null, party } = {}) => ({
  where: here,
  follow: H.follow,
  setFollowLeader: H.setFollowLeader,
  answerSummon: H.answerSummon,
  summon,
  party: {
    follow,
    invites: [],
    party:
      party !== undefined
        ? party
        : {
            id: PARTY,
            leader: BRAVO,
            epoch: 1,
            members: [
              { id: BRAVO, name: 'Bravo', leader: true, you: false, present: at !== null, where: at },
              { id: ALPHA, name: 'Alpha', leader: false, you: true, present: true, where: here },
            ],
          },
  },
});

beforeEach(() => {
  vi.useFakeTimers();
  H.hooks = [];
  H.navigate = vi.fn();
  H.follow = vi.fn();
  H.setFollowLeader = vi.fn();
  H.answerSummon = vi.fn(() => null);
  vi.stubGlobal('window', new EventTarget());
  vi.stubGlobal('document', { body: { tagName: 'BODY' } });
});
afterEach(() => {
  for (const s of H.hooks) s?.undo?.();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('Follow the leader', () => {
  it('sets off after the leader once the moment to stay is up', () => {
    run(online());
    const tree = run(online({ at: BREE }));
    expect(calls(tree).moving).toMatchObject({ id: BRAVO, name: 'Bravo', where: BREE });
    vi.advanceTimersByTime(calls(tree).wait - 1);
    expect(H.navigate).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(H.navigate).toHaveBeenCalledWith(BREE);
  });

  it('lets the move go when the leader comes back to you within the moment', () => {
    run(online());
    const wait = calls(run(online({ at: BREE }))).wait;
    vi.advanceTimersByTime(wait / 2);
    const tree = run(online({ at: '/projects' }));
    expect(calls(tree)).toBeNull();
    vi.advanceTimersByTime(wait * 2);
    expect(H.navigate).not.toHaveBeenCalled();
  });

  it('lets it go when the leader goes on somewhere no one can follow', () => {
    run(online());
    const wait = calls(run(online({ at: BREE }))).wait;
    vi.advanceTimersByTime(wait / 2);
    expect(calls(run(online({ at: AWAY })))).toBeNull();
    vi.advanceTimersByTime(wait * 2);
    expect(H.navigate).not.toHaveBeenCalled();
  });

  it('lets it go when the leader goes offline within the moment', () => {
    run(online());
    const wait = calls(run(online({ at: BREE }))).wait;
    vi.advanceTimersByTime(wait / 2);
    expect(calls(run(online({ at: null })))).toBeNull();
    vi.advanceTimersByTime(wait * 2);
    expect(H.navigate).not.toHaveBeenCalled();
  });

  it('follows the leader’s next move instead of the last', () => {
    run(online());
    const wait = calls(run(online({ at: BREE }))).wait;
    vi.advanceTimersByTime(wait / 2);
    expect(calls(run(online({ at: '/travel' }))).moving.where).toBe('/travel');
    vi.advanceTimersByTime(wait);
    expect(H.navigate.mock.calls).toEqual([['/travel']]);
  });

  it('holds the move while the dialog’s up, and draws no notice under its scrim', () => {
    run(online());
    window.dispatchEvent(new CustomEvent('tp:party', { detail: { tab: 'chat' } }));
    let tree = run(online({ at: BREE }));
    expect(dialog(tree)).not.toBeNull();
    expect(calls(tree)).toBeNull(); // (its Stay couldn’t be pressed under the scrim)
    vi.advanceTimersByTime(60000);
    expect(H.navigate).not.toHaveBeenCalled();
    // shut: the notice, and the whole moment to press Stay from then
    dialog(tree).onClose();
    tree = run(online({ at: BREE }));
    expect(calls(tree).moving.where).toBe(BREE);
    vi.advanceTimersByTime(calls(tree).wait - 1);
    expect(H.navigate).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(H.navigate).toHaveBeenCalledWith(BREE);
  });
});

describe('a summons', () => {
  const summon = { from: BRAVO, name: 'Bravo', where: BREE, key: 1 };

  it('asks a member of the summoner’s party to Go or not', () => {
    expect(calls(run(online({ summon })))?.summon).toEqual(summon);
  });

  it('isn’t shown once you’re out of the party, or it’s someone else’s', () => {
    expect(calls(run(online({ summon, party: null })))).toBeNull();
    const charlies = {
      id: PARTY,
      leader: CHARLIE,
      epoch: 2,
      members: [
        { id: CHARLIE, name: 'Charlie', leader: true, you: false, present: true, where: '/projects' },
        { id: ALPHA, name: 'Alpha', leader: false, you: true, present: true, where: '/projects' },
      ],
    };
    expect(calls(run(online({ summon, party: charlies })))).toBeNull();
  });

  it('waits while the dialog’s up', () => {
    run(online({ summon }));
    window.dispatchEvent(new CustomEvent('tp:party', { detail: {} }));
    const tree = run(online({ summon }));
    expect(calls(tree)).toBeNull();
    dialog(tree).onClose();
    expect(calls(run(online({ summon })))?.summon).toEqual(summon);
  });
});

describe('the calls’ live region', () => {
  const region = (tree) => elements(tree).find((el) => el.props.className === 'party-calls') ?? null;

  it('is on the body from the start, empty, so a call put in it is read out', () => {
    const tree = run(online());
    const portal = elements(tree).find((el) => el.type === 'portal');
    expect(portal?.to).toBe(document.body);
    expect(region(tree)?.props['aria-live']).toBe('polite');
    expect(calls(tree)).toBeNull();
  });

  it('holds the calls when there are some', () => {
    run(online());
    const tree = run(online({ at: BREE }));
    expect(calls(region(tree))?.moving.where).toBe(BREE);
  });
});
