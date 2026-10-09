import { describe, expect, it } from 'vitest';
import { JOIN_MS, SQUAD, joining, newSquad, readCard, readState, resume, squadStep, view, writeCard, writeState } from './squadRules';

const SID = 'BCDFGHJKLMNP';
// pilots by their keys (a pilot's id online: 64 hex digits)
const [L, A, B, C, D, R, X] = ['1', '2', '3', '4', '5', '6', 'e'].map((c) => c.repeat(64));
const NAMES = { [L]: 'Leia', [A]: 'Ackbar', [B]: 'Biggs', [C]: 'Chewie', [D]: 'Dak', [R]: 'Rogue', [X]: 'Xizor' };
const card = (id) => readCard({ n: NAMES[id], k: 'falcon', w: '/universe', sh: 80, lv: 3, rd: 0 });
const hello = (from, extra = {}) => ({ type: 'hello', from, card: card(from), ...extra });
// a document, as the wire has it
const doc = (patch = {}) => ({ n: 5, by: L, m: [L, A], x: [], k: 0, o: 0, r: null, lb: null, i: null, ...patch });
const heard = (s, from, d, t = 100) => squadStep(s, { type: 'doc', from, wire: d }, t).state;
const step = (s, e, t) => squadStep(s, e, t).state;
const json = (s) => JSON.stringify(writeState(s));

// Pilots on one clock (ms), each a state of its own. What one sends the
// others hear at once (through JSON, as the wire carries it), unless either
// is `away` (its page gone, or not online yet) or the pair is `deaf`
// ('from>to'). Every half second each pilot ticks and, as squad.js does,
// says hello every helloMs (seekMs till seated). A `stalled` pilot's page
// has frozen: it neither ticks nor says anything, and what's said to it waits
// till it wakes. `writes()`: every stamp a document went out under.
function crew(states) {
  const pilots = new Map(states.map((s) => [s.me, s]));
  const hiAt = new Map();
  const away = new Set();
  const deaf = new Set();
  const stalled = new Map(); // id → what came in while frozen, in order
  const stamps = new Set();
  let t = 0;
  const hears = (from, to) => to !== from && pilots.has(to) && !away.has(to) && !away.has(from) && !deaf.has(`${from}>${to}`);
  const deliver = (to, e) => (stalled.has(to) ? stalled.get(to).push(e) : run(to, e));
  function broadcast(from, kind, data) {
    const wire = JSON.parse(JSON.stringify(data));
    if (kind === 'doc') stamps.add(`${wire.n} ${wire.by}`);
    for (const to of [...pilots.keys()]) {
      if (hears(from, to)) deliver(to, kind === 'doc' ? { type: 'doc', from, wire } : kind === 'hi' ? { type: 'hello', from, card: readCard(wire) } : { type: 'bye', from });
    }
  }
  function run(id, e) {
    const { state, send } = squadStep(pilots.get(id), e, t);
    pilots.set(id, state);
    for (const [kind, data] of send) broadcast(id, kind, data);
  }
  function greet(id) {
    hiAt.set(id, t);
    run(id, { type: 'hello', from: id, card: card(id) });
  }
  return {
    get t() {
      return t;
    },
    state: (id) => pilots.get(id),
    view: (id) => view(pilots.get(id), t),
    put: (s) => pilots.set(s.me, s),
    remove: (id) => pilots.delete(id),
    writes: () => [...stamps],
    stall: (id) => stalled.set(id, []),
    // the page unfreezes: what came in is heard, in order, then it ticks
    wake(id) {
      const waiting = stalled.get(id) ?? [];
      stalled.delete(id);
      for (const e of waiting) run(id, e);
      run(id, { type: 'tick' });
    },
    away,
    deaf,
    run,
    greet,
    broadcast,
    pass(ms) {
      for (const end = t + ms; t < end; ) {
        t += 500;
        for (const id of [...pilots.keys()]) {
          if (away.has(id) || stalled.has(id) || pilots.get(id).gone) continue;
          run(id, { type: 'tick' });
          const s = pilots.get(id);
          if (!s.gone && t - (hiAt.get(id) ?? -Infinity) >= (s.members.includes(id) ? SQUAD.helloMs : SQUAD.seekMs)) greet(id);
        }
      }
    },
  };
}
// a squad led by the first, the rest seated in order, each having said hello
function formed(...ids) {
  const c = crew([newSquad(SID, ids[0], 0), ...ids.slice(1).map((id) => joining(SID, id, 0))]);
  for (const id of ids) c.greet(id);
  return c;
}
// every one of these holding the same document and naming the same leader
const one = (c, ids) => ids.every((id) => !c.state(id).gone && c.view(id).leader !== null && json(c.state(id)) === json(c.state(ids[0])) && c.view(id).leader === c.view(ids[0]).leader);
// Within 20 s of the fault clearing, one document and one leader on every
// view, and still so for a further 30 s: when it came to one, and what.
function settles(c, ids) {
  const from = c.t;
  while (!one(c, ids) && c.t - from < 20000) c.pass(500);
  expect(one(c, ids), 'one document and one leader within 20 s').toBe(true);
  const at = c.t - from;
  for (const end = c.t + 30000; c.t < end; ) {
    c.pass(500);
    expect(one(c, ids), `still one, ${c.t - from} ms on`).toBe(true);
  }
  return { at, leader: c.view(ids[0]).leader, members: c.state(ids[0]).members };
}

describe('the squad’s rules', () => {
  it('has the values the design gives', () => {
    expect(SQUAD).toEqual({ size: 4, stateMs: 2000, helloMs: 3000, seekMs: 1500, awayMs: 10000, goneMs: 45000, leaderQuietMs: 8000, liveMs: 6000 });
    expect(JOIN_MS).toBe(15000);
  });

  it('a document is newer by its stamp: a higher n, then the lower by, and one stamp on two documents by the lower as JSON', () => {
    const a = resume(SID, A, doc({ m: [L, A, B] }), 0);
    expect(heard(a, L, doc({ n: 6, m: [L, A, B] })).n).toBe(6);
    expect(heard(a, L, doc({ n: 4, m: [L, A, B] }))).toMatchObject({ n: 5, by: L });
    // the same n: the lower by (as text) is the newer
    const byB = resume(SID, A, doc({ by: B, m: [L, A, B] }), 0);
    expect(heard(byB, L, doc({ m: [L, A, B] }))).toMatchObject({ n: 5, by: L });
    expect(heard(a, B, doc({ by: B, m: [L, A, B] }))).toMatchObject({ n: 5, by: L });
    // one stamp, two documents (a client of someone's own): everyone keeps the same one, whichever came first
    const shut = doc({ m: [L, A, B] });
    const open = doc({ m: [L, A, B], o: 1 });
    expect(heard(heard(a, L, open), L, shut).open).toBe(false);
    expect(heard(heard(resume(SID, A, open, 0), L, shut), L, open).open).toBe(false);
  });

  it('whose document is taken: one sent by a member and written by one; not an older one, a stranger’s, a turned-out pilot’s, or one run more than a million on', () => {
    const a = resume(SID, A, doc({ m: [L, A, B], x: [C] }), 0);
    const next = doc({ n: 6, m: [L, A, B, D], x: [C] });
    expect(heard(a, B, next).members).toEqual([L, A, B, D]); // (passed on by a member, written by the leader)
    for (const [from, d] of [
      [X, next], // (a stranger's)
      [B, { ...next, by: X }], // (written by one who isn't seated)
      [C, { ...next, by: C }], // (a turned-out pilot's)
      [L, doc({ n: 5 + 1e6 + 1, m: [L, A, B], x: [C] })], // (a stamp run on)
    ])
      expect(heard(a, from, d), `${from.slice(0, 4)} ${d.n}`).toMatchObject({ n: 5, members: [L, A, B] });
    expect(heard(a, L, doc({ n: 5 + 1e6, m: [L, A, B], x: [C] })).n).toBe(5 + 1e6);
  });

  it('the leader seats a hello: not one turned out or blocked, not a fifth, and nobody while locked', () => {
    const { state, send } = squadStep(newSquad(SID, L, 0), hello(A), 100);
    expect(state.members).toEqual([L, A]);
    expect(send).toEqual([['doc', writeState(state)]]); // (written n + 1 by the leader, out at once)
    expect(readState(send[0][1])).toMatchObject({ n: 2, by: L, members: [L, A] });
    expect(view(state, 100).members[1]).toMatchObject({ id: A, seat: 1, name: 'Ackbar', kind: 'falcon', shield: 80, level: 3, ready: false, away: false, leader: false });
    expect(squadStep(state, hello(A), 200).send).toEqual([]); // (seated already)
    // only the leader seats anyone
    const a = heard(joining(SID, A, 0), L, doc());
    expect(step(a, hello(B), 200).members).toEqual([L, A]);
    // nobody blocked, nobody turned out, no fifth, nobody while it's locked
    let s = state;
    for (const id of [B, C]) s = step(s, hello(id), 300);
    expect(step(s, hello(D), 400).members).toEqual([L, A, B, C]);
    s = step(s, { type: 'kick', id: C }, 500);
    expect(s).toMatchObject({ members: [L, A, B], out: [C], locked: true });
    expect(step(s, hello(D), 600).members).toEqual([L, A, B]);
    s = step(s, { type: 'lock', locked: false }, 700);
    expect(s.locked).toBe(false);
    expect(step(s, hello(C), 800).members).toEqual([L, A, B]);
    expect(step(s, hello(D, { blocked: true }), 800).members).toEqual([L, A, B]);
    expect(step(s, hello(D), 900).members).toEqual([L, A, B, D]);
  });

  it('turning out: off the seats, into x, and the squad locks; their words are dropped by everyone holding it', () => {
    const c = formed(L, A, B, C);
    c.run(L, { type: 'kick', id: C });
    for (const id of [L, A, B]) expect(c.state(id)).toMatchObject({ members: [L, A, B], out: [C], locked: true });
    expect(c.view(C)).toMatchObject({ gone: true, why: 'out' });
    // what they send now moves nobody, and only the leader turns anyone out
    const before = json(c.state(A));
    c.broadcast(C, 'doc', doc({ n: 99, by: C, m: [C, A, B] }));
    expect(json(c.state(A))).toBe(before);
    expect(squadStep(c.state(B), { type: 'kick', id: A }, c.t).send).toEqual([]);
  });

  it('a member not there 10 s is away, and at 45 s the leader frees the seat', () => {
    const c = formed(L, A, B);
    c.pass(3000);
    c.away.add(B); // (gone without a goodbye)
    // (there while heard within 6 s, or named by a member who's there: till then)
    while (c.state(L).seen.get(B) === c.t) c.pass(500);
    const last = c.state(L).seen.get(B);
    c.pass(last + 9500 - c.t);
    expect(c.view(L).members[2]).toMatchObject({ id: B, away: false });
    c.pass(500);
    expect(c.view(L).members[2]).toMatchObject({ id: B, away: true });
    c.pass(last + 44500 - c.t);
    expect(c.view(A).members[2]).toMatchObject({ id: B, away: true });
    expect(c.state(L).members).toEqual([L, A, B]);
    c.pass(500);
    expect(c.state(L).members).toEqual([L, A]);
    expect(c.state(A).members).toEqual([L, A]);
  });

  it('a locked squad frees nobody for being away, and a goodbye still frees the seat', () => {
    const c = formed(L, A, B, C);
    c.run(L, { type: 'lock', locked: true });
    c.pass(3000);
    c.away.add(B);
    c.pass(90000);
    expect(c.state(L).members).toEqual([L, A, B, C]);
    expect(c.view(A).members[2]).toMatchObject({ id: B, away: true });
    // and back, the seat's still theirs
    c.away.delete(B);
    c.pass(4000);
    expect(c.view(B)).toMatchObject({ mine: 2, leader: L, locked: true });
    c.run(C, { type: 'leave' });
    for (const id of [L, A, B]) expect(c.state(id).members).toEqual([L, A, B]);
  });

  it('a reload keeps the seat: back with what it kept, the document still seats it', () => {
    const c = formed(L, A, B);
    c.pass(3000);
    const kept = writeState(c.state(B));
    c.away.add(B);
    c.pass(20000);
    c.put(resume(SID, B, kept, c.t));
    c.away.delete(B);
    c.pass(6000);
    expect(c.state(L).members).toEqual([L, A, B]);
    expect(c.view(B)).toMatchObject({ mine: 2, leader: L, gone: false });
    // back after its seat was freed: the newer document has it asking in again, and it's seated again
    c.away.add(B);
    c.pass(60000);
    expect(c.state(L).members).toEqual([L, A]);
    c.put(resume(SID, B, kept, c.t));
    c.away.delete(B);
    c.pass(6000);
    expect(c.view(B)).toMatchObject({ mine: 2, leader: L, gone: false });
    expect(c.state(A).members).toEqual([L, A, B]);
  });

  it('the leader is worked out: the first seat there, passed over once not there 8 s, and back when it’s back, with nothing written', () => {
    const c = formed(L, A, B);
    c.pass(3000);
    for (const id of [L, A, B]) expect(c.view(id).leader).toBe(L);
    const writes = c.writes();
    c.away.add(L);
    while (c.state(A).seen.get(L) === c.t) c.pass(500);
    const last = c.state(A).seen.get(L);
    c.pass(last + 8000 - c.t);
    expect(c.view(A).leader).toBe(L);
    c.pass(500);
    expect(c.view(A)).toMatchObject({ leader: A, members: [{ id: L, leader: false }, { id: A, leader: true }, { id: B }] });
    c.pass(3000); // (B names A too, its own 8 s up)
    expect(c.view(B).leader).toBe(A);
    c.away.delete(L);
    c.pass(3000);
    for (const id of [L, A, B]) expect(c.view(id).leader).toBe(L);
    expect(c.writes()).toEqual(writes); // (no claim, no new document: only who's there changed)
  });

  it('a seat is there by the word of a member who’s there, and only while that word is fresh', () => {
    // A hears B, and B hears L; A never hears L
    let a = resume(SID, A, doc({ m: [L, A, B] }), 0);
    a = step(a, { type: 'hello', from: B, card: { ...card(B), h: [L, X] } }, 7000);
    for (let t = 7000; t < 9000; t += 500) a = step(a, { type: 'tick' }, t);
    expect(view(a, 8500)).toMatchObject({ leader: L, members: [{ id: L, away: false }, { id: A }, { id: B, away: false }] });
    // B's next hello names nobody: L isn't there from then, and is passed over 8 s after it last was
    a = step(a, { type: 'hello', from: B, card: { ...card(B), h: [] } }, 9000);
    for (let t = 9000; t <= 16500; t += 500) a = step(a, { type: 'tick' }, t);
    expect(view(a, 16500).leader).toBe(L);
    a = step(a, { type: 'tick' }, 17000);
    expect(view(a, 17000).leader).toBe(A);
    // nor does a hello older than 6 s count
    let b = resume(SID, A, doc({ m: [L, A, B] }), 0);
    b = step(b, { type: 'hello', from: B, card: { ...card(B), h: [L] } }, 1000);
    for (let t = 1500; t <= 20000; t += 500) b = step(b, { type: 'tick' }, t);
    expect(view(b, 20000)).toMatchObject({ leader: A, members: [{ id: L, away: true }, { id: A }, { id: B, away: true }] });
  });

  it('asking in: the first document that seats you; one that turns you away is the answer only once nothing has seated you in 15 s', () => {
    // (X holds the sid, and answers anyone asking in)
    const c = formed(L, A);
    c.pass(2000);
    c.put(joining(SID, B, c.t));
    c.broadcast(X, 'doc', doc({ n: 9, by: X, m: [X], x: [B] }));
    c.broadcast(X, 'doc', doc({ n: 9, by: X, m: [X, C, D, A] }));
    expect(c.view(B)).toMatchObject({ gone: false, mine: null, leader: null });
    c.greet(B);
    expect(c.view(B)).toMatchObject({ gone: false, mine: 2, leader: L });
    c.pass(20000);
    expect(one(c, [L, A, B])).toBe(true);
    // with nothing to seat them, the last answer holds at 15 s
    for (const [d, why] of [
      [doc({ m: [L, A, C, D] }), 'full'],
      [doc({ k: 1 }), 'locked'],
      [doc({ x: [B] }), 'out'],
      [doc(), 'refused'],
    ]) {
      let s = heard(joining(SID, B, 0), L, d, 1000);
      for (let t = 1000; t < JOIN_MS; t += 500) s = step(s, { type: 'tick' }, t);
      expect(view(s, JOIN_MS - 500)).toMatchObject({ gone: false, mine: null });
      expect(view(step(s, { type: 'tick' }, JOIN_MS), JOIN_MS)).toMatchObject({ gone: true, why });
    }
    // and with no document at all: the squad has gone
    expect(view(step(joining(SID, B, 0), { type: 'tick' }, JOIN_MS), JOIN_MS)).toMatchObject({ gone: true, why: 'quiet' });
  });

  it('asked in from the roster, a pilot takes only a document written by the inviter or seating them', () => {
    const c = formed(L, A);
    c.pass(2000);
    c.put(joining(SID, B, c.t, A));
    c.broadcast(X, 'doc', doc({ n: 9, by: X, m: [X, B] }));
    expect(c.view(B)).toMatchObject({ mine: null, leader: null });
    c.greet(B);
    expect(c.view(B)).toMatchObject({ mine: 2, leader: L });
    expect(heard(joining(SID, B, 0, L), L, doc({ m: [L, B] })).members).toEqual([L, B]);
  });

  it('a document that leaves you out has you asking in again: seated again if there’s room, told if there isn’t', () => {
    let b = resume(SID, B, doc({ m: [L, A, B] }), 0);
    b = heard(b, L, doc({ n: 6, m: [L, A] }), 100);
    expect(view(b, 100)).toMatchObject({ mine: null, gone: false });
    b = heard(b, A, doc({ n: 7, m: [L, A, B] }), 2000);
    expect(view(b, 2000)).toMatchObject({ mine: 2 });
    b = heard(b, L, doc({ n: 8, m: [L, A, C, D] }), 3000);
    for (let t = 3500; t < 3000 + JOIN_MS; t += 500) b = step(b, { type: 'tick' }, t);
    expect(view(b, 17500)).toMatchObject({ mine: null, gone: false });
    expect(view(step(b, { type: 'tick' }, 18000), 18000)).toMatchObject({ gone: true, why: 'full' });
  });

  it('leaving: your own document without you, then goodbye, and the next seat leads at once', () => {
    const c = formed(L, A, B);
    c.pass(3000);
    const { state, send } = squadStep(c.state(L), { type: 'leave' }, c.t);
    expect(send.map(([kind]) => kind)).toEqual(['doc', 'bye']);
    expect(readState(send[0][1])).toMatchObject({ n: state.n, by: L, members: [A, B] });
    c.run(L, { type: 'leave' });
    expect(c.view(L)).toMatchObject({ gone: true, why: 'left' });
    c.away.add(L);
    for (const id of [A, B]) expect(c.view(id)).toMatchObject({ leader: A, members: [{ id: A }, { id: B }] });
    // a goodbye frees the seat even when its pilot's own document was behind
    let a = resume(SID, A, doc({ n: 9, by: L, m: [L, A, B] }), 0);
    a = heard(a, L, doc({ n: 8, by: L, m: [A, B] }), 100);
    const { state: after, send: out } = squadStep(a, { type: 'bye', from: L }, 100);
    expect(after).toMatchObject({ n: 10, by: A, members: [A, B] });
    expect(out).toEqual([['doc', writeState(after)]]);
  });

  it('the leader’s changes go out to everyone, and nobody else’s', () => {
    const c = formed(L, A);
    c.run(L, { type: 'rally', rally: { w: '/galaxy/hoth', p: { x: 10, y: 2, z: -30 } } });
    c.run(L, { type: 'open', open: true });
    c.run(L, { type: 'instance', instance: '0123456789' });
    c.run(L, { type: 'lock', locked: true });
    expect(c.view(A)).toMatchObject({ rally: { w: '/galaxy/hoth', p: { x: 10, y: 2, z: -30 } }, open: true, instance: '0123456789', locked: true });
    c.run(L, { type: 'rally', rally: null });
    c.run(L, { type: 'instance', instance: null });
    expect(c.view(A)).toMatchObject({ rally: null, instance: null });
    // junk changes nothing, and a member's own changes are nothing
    const s = c.state(L);
    for (const e of [{ type: 'rally', rally: { w: 'nowhere' } }, { type: 'instance', instance: 'xyz' }, { type: 'lock', locked: true }]) expect(squadStep(s, e, c.t).state).toBe(s);
    for (const e of [{ type: 'open', open: false }, { type: 'lock', locked: false }, { type: 'kick', id: L }]) expect(squadStep(c.state(A), e, c.t).send).toEqual([]);
  });

  it('what a squad keeps through a reload is its document, read back as any is', () => {
    const c = formed(L, A, B);
    c.run(L, { type: 'kick', id: B });
    const kept = writeState(c.state(A));
    const s = resume(SID, A, kept, 100);
    expect(view(s, 100)).toMatchObject({ sid: SID, leader: L, mine: 1, gone: false, locked: true });
    expect(s.out).toEqual([B]);
    expect(view(resume(SID, B, kept, 100), 100)).toMatchObject({ gone: true, why: 'out' });
    expect(view(resume(SID, A, 'junk', 100), 100)).toMatchObject({ leader: null, mine: null, gone: false });
  });

  it('a document with five seats, a field of the wrong kind, an out list over 32 or a stamp out of range is dropped whole', () => {
    const ids = (n, from = 0) => Array.from({ length: n }, (_, i) => (from + i + 16).toString(16).padStart(64, '0'));
    expect(readState(doc())).toEqual({ n: 5, by: L, members: [L, A], out: [], locked: false, open: false, rally: null, lobby: null, instance: null });
    expect(readState({ n: 0, by: A, m: [] })).toMatchObject({ n: 0, members: [] }); // (the last one's leaving)
    const bad = [doc({ m: [L, ...ids(4)] }), doc({ x: ids(33) }), doc({ n: '1' }), doc({ n: -1 }), doc({ n: 1.5 }), doc({ n: 2 ** 53 }), doc({ by: null }), doc({ by: 'han' }), doc({ m: L }), doc({ m: [L, 'han'] }), doc({ m: [L, L] }), doc({ x: [A] }), doc({ x: 'none' }), doc({ k: true }), doc({ k: 2 }), doc({ o: 2 }), doc({ r: 5 }), doc({ r: { w: '/universe', p: 'here' } }), doc({ r: { w: 'nowhere', p: null } }), doc({ i: 'abc' }), doc({ i: 7 }), null, 'doc', [], 42];
    for (const w of bad) expect(readState(w), JSON.stringify(w)).toBeNull();
    expect(readState(doc({ x: ids(32) })).out).toHaveLength(32);
    // dropped whole: nothing of it is taken
    const a = resume(SID, A, doc(), 0);
    expect(heard(a, L, doc({ n: 6, m: [L, A, B], o: 1, i: 'nope' }))).toMatchObject({ n: 5, members: [L, A], open: false });
  });

  it('a lobby isn’t read yet: a document carrying one is dropped (PR 3’s readLobby reads them)', () => {
    expect(readState(doc({ lb: null }))).not.toBeNull();
    const { lb, ...without } = doc();
    expect(lb).toBeNull();
    expect(readState(without)).not.toBeNull();
    expect(readState(doc({ lb: { a: 'roam', ph: 'open' } }))).toBeNull();
    expect(squadStep(newSquad(SID, L, 0), { type: 'lobby', lobby: { a: 'roam' } }, 100).send).toEqual([]);
  });

  it('reads a hello’s card, with whom it has heard, and junk as none', () => {
    const c = { name: 'Leia', kind: 'falcon', where: '/galaxy/hoth', shield: 42, level: 5, ready: true, h: [A, B] };
    expect(readCard(writeCard(c))).toEqual(c);
    expect(readCard({})).toEqual({ name: 'Pilot', kind: null, where: null, shield: null, level: 1, ready: false, h: [] });
    expect(readCard({ n: 'Han‮Solo', k: 'tardis', w: 'javascript:alert(1)', sh: 1e9, lv: 99, rd: true, h: 'all' })).toEqual({ name: 'HanSolo', kind: null, where: null, shield: 100, level: 11, ready: false, h: [] });
    // h: ids only, each once, eight at most
    const many = Array.from({ length: 12 }, (_, i) => (i + 16).toString(16).padStart(64, '0'));
    expect(readCard({ h: [A, 'han', 42, A, null, ...many] }).h).toEqual([A, ...many.slice(0, 7)]);
    for (const junk of [null, undefined, 'hi', 42, []]) expect(readCard(junk)).toBeNull();
    // your own hello goes out naming whom you've heard within 6 s, seats first
    let s = resume(SID, A, doc({ m: [L, A, B] }), 0);
    s = step(s, hello(X), 1000);
    s = step(s, hello(B), 2000);
    s = step(s, hello(L), 3000);
    expect(squadStep(s, hello(A), 7500).send).toEqual([['hi', writeCard({ ...card(A), h: [L, B] })]]);
  });
});

describe('the squad on a harness: one document and one leader, whatever the links do', () => {
  it('(a) the leader’s words lost to the others for 10 s, then heard again', () => {
    const c = formed(L, A, B);
    c.pass(4000);
    c.deaf.add(`${L}>${A}`);
    c.deaf.add(`${L}>${B}`);
    c.pass(10000);
    c.deaf.clear();
    expect(settles(c, [L, A, B])).toMatchObject({ leader: L, members: [L, A, B] });
    // and the other way: the leader hearing nobody for 10 s
    const d = formed(L, A, B);
    d.pass(4000);
    d.deaf.add(`${A}>${L}`);
    d.deaf.add(`${B}>${L}`);
    d.pass(10000);
    d.deaf.clear();
    expect(settles(d, [L, A, B])).toMatchObject({ leader: L, members: [L, A, B] });
  });

  it('(b) the leader reloads, and its relays take 7 s to answer', () => {
    const c = formed(L, A, B);
    c.pass(4000);
    const kept = writeState(c.state(L));
    c.away.add(L);
    c.put(resume(SID, L, kept, c.t));
    c.pass(7000);
    c.away.delete(L);
    c.greet(L); // (online: a hello at once)
    expect(settles(c, [L, A, B])).toMatchObject({ leader: L, members: [L, A, B] });
  });

  it('(c) a page stalled for 7.5 s, then woken with what came in meanwhile', () => {
    for (const who of [L, A]) {
      const c = formed(L, A, B);
      c.pass(4000);
      c.stall(who);
      c.pass(7500);
      c.wake(who);
      expect(settles(c, [L, A, B])).toMatchObject({ leader: L, members: [L, A, B] });
    }
  });

  it('(d) the leader really gone: the next seat leads and frees the seat, and only it writes', () => {
    const c = formed(L, A, B);
    c.pass(4000);
    const before = c.writes();
    c.away.add(L);
    c.remove(L);
    c.pass(60000);
    expect(settles(c, [A, B])).toMatchObject({ leader: A, members: [A, B] });
    expect(c.writes().filter((w) => !before.includes(w))).toEqual([`${c.state(A).n} ${A}`]); // (one document written, by the one who leads)
    // and with a goodbye, at once
    const d = formed(L, A, B);
    d.pass(4000);
    d.run(L, { type: 'leave' });
    d.remove(L);
    expect(one(d, [A, B])).toBe(true);
    expect(d.view(A)).toMatchObject({ leader: A, members: [{ id: A }, { id: B }] });
  });

  it('(e) the leader and a member who can’t hear each other, both heard by a third, for 60 s: the leader leads throughout', () => {
    const c = formed(L, A, B);
    c.pass(4000);
    c.deaf.add(`${L}>${A}`);
    c.deaf.add(`${A}>${L}`);
    let rallied = -Infinity;
    for (let i = 0; i < 120; i++) {
      c.pass(500);
      for (const id of [L, A, B]) expect(c.view(id).leader, `${c.t} ms`).toBe(L);
      expect(c.view(L).members.every((m) => !m.away)).toBe(true);
      // (a change of the leader's reaches A through B, who passes on the document it holds)
      if (c.t - rallied > SQUAD.stateMs) expect(one(c, [L, A, B]), `${c.t} ms`).toBe(true);
      if (i === 60) {
        c.run(L, { type: 'rally', rally: { w: '/galaxy/hoth', p: null } });
        rallied = c.t;
      }
    }
    expect(c.view(A).rally).toEqual({ w: '/galaxy/hoth', p: null });
    c.deaf.clear();
    expect(settles(c, [L, A, B])).toMatchObject({ leader: L, members: [L, A, B] });
  });

  it('(f) the leader’s link drops for 7 s in every 12, ten times over, then holds', () => {
    const c = formed(L, A, B);
    c.pass(4000);
    for (let i = 0; i < 10; i++) {
      for (const id of [A, B]) {
        c.deaf.add(`${L}>${id}`);
        c.deaf.add(`${id}>${L}`);
      }
      c.pass(7000);
      c.deaf.clear();
      c.pass(5000);
    }
    expect(settles(c, [L, A, B])).toMatchObject({ leader: L, members: [L, A, B] });
  });

  it('(g) two halves each changing the squad for 60 s, a rally on one side and a seat freed on the other, then one again', () => {
    const c = formed(L, A, B, C);
    c.pass(4000);
    for (const x of [L, A]) for (const y of [B, C]) c.deaf.add(`${x}>${y}`).add(`${y}>${x}`);
    c.pass(10000);
    c.run(L, { type: 'rally', rally: { w: '/galaxy/hoth', p: null } });
    c.run(C, { type: 'leave' }); // (B's half: C goes, and its seat is freed)
    c.remove(C);
    expect(c.state(B).members).toEqual([L, A, B]);
    c.pass(50000);
    c.deaf.clear();
    const end = settles(c, [L, A, B]);
    expect([...end.members].sort()).toEqual([L, A, B].sort());
  });

  it('(h) a long split whose halves let each other go: four pilots end as one squad of four, five as one of four and the fifth told it’s full', () => {
    const c = formed(L, A, B, C);
    c.pass(4000);
    for (const x of [L, A]) for (const y of [B, C]) c.deaf.add(`${x}>${y}`).add(`${y}>${x}`);
    c.pass(60000);
    expect(c.state(L).members).toEqual([L, A]);
    expect(c.state(B).members).toEqual([B, C]);
    c.deaf.clear();
    expect([...settles(c, [L, A, B, C]).members].sort()).toEqual([L, A, B, C].sort());

    const d = formed(L, A, B, C);
    d.pass(4000);
    for (const x of [L, A, D]) for (const y of [B, C]) d.deaf.add(`${x}>${y}`).add(`${y}>${x}`);
    d.pass(60000);
    d.put(joining(SID, D, d.t)); // (a fifth, asking in on L's side)
    d.greet(D);
    expect(d.state(L).members).toEqual([L, A, D]);
    // healed, each half's leader hearing the other's first: L seats B, B seats L and then A. (Heard the
    // other way, L seating C and B seating A and D, the halves stay two: each document names a pilot
    // who holds the other, and neither leader has a seat for the other's writer.)
    d.deaf.clear();
    for (const id of [B, L, A]) d.greet(id);
    d.pass(20000);
    const all = [L, A, B, C, D];
    const left = all.filter((id) => d.state(id).gone);
    expect(left).toHaveLength(1);
    expect(d.view(left[0])).toMatchObject({ gone: true, why: 'full' });
    const end = settles(d, all.filter((id) => id !== left[0]));
    expect(end.members).toHaveLength(4);
  });

  it('(i) a member with a client of its own writes a newer document turning the leader out while the leader is there: it’s taken, and the squad is still one', () => {
    const c = formed(L, A, B, R);
    c.pass(4000);
    const rogue = { ...writeState(c.state(R)), n: c.state(R).n + 1, by: R, m: [A, B, R], x: [L], k: 1 };
    c.put(resume(SID, R, rogue, c.t)); // (its client holds it, and passes it on as any member does)
    c.broadcast(R, 'doc', rogue);
    expect(c.view(L)).toMatchObject({ gone: true, why: 'out' });
    expect(settles(c, [A, B, R])).toMatchObject({ leader: A, members: [A, B, R] });
    expect(c.state(A)).toMatchObject({ out: [L], locked: true });
  });
});
