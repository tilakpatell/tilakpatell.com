/* global process */
// The party, played at random: a seeded simulation (a PRNG of its own, so a
// seed is one run, the same every time) of two to five honest pilots, each a
// real link (partyLink.js) wired as client.js wires it and remembering its
// party in a store of its own (partyStore.js over saves of its own), and one
// stranger, who reads everything said and says anything well formed about
// any party it has heard of, but is never asked in.
//
// The room is a bus that delays and reorders what’s said (up to LAG_MS, so
// never past the link’s JOIN_GRACE_MS) and loses only what’s sent to a pilot
// offline, as the relays do. A pilot who goes offline lets the link go (the
// party kept) and comes back as a new visit: a new link on the same store
// and key, which re-forms the party from it. The rest is the relay layer’s
// and client.js’s, as they are: a pilot known from their first word (and
// sent a hello then), a party word heard only once their hello’s read, a
// goodbye only for the visit it’s of, a hello at each heartbeat and at each
// change of party or epoch, and anyone quiet past QUIET_MS swept.
//
// Each step does one thing, drawn at random: a pilot offline or back, start,
// invite, yes or no, leave, remove or promote (the leader), summon, a line
// of chat or quick chat, everyone’s heartbeat, words delivered early (out of
// turn), a long pause, or the stranger’s mischief. Then everyone comes back
// and heartbeats run till nothing changes (or too long: that fails too), and
//   1. everyone holding a party holds the same roster of it (id, leader,
//      epoch, members), and everyone it lists holds it;
//   2. no one was put out whom an honest leader didn’t remove (each put-out,
//      as it happens, is held to the log of removes since they came in);
//   3. the stranger was never in anyone’s roster, never sealed a line, never
//      heard as a mate, and never made a member leave (2 again);
//   4. nothing threw, and every epoch held was a safe integer.
// PARTY_SIM_SEEDS sets how many seeds (2,000 by default); PARTY_SIM_SEED=n
// plays one, cut to the fewest steps that still fail it, and prints it.

import { describe, expect, it } from 'vitest';
import { createSaves } from '../../../runtime/saves';
import { createPartyLink } from './partyLink';
import { createPartyStore } from './partyStore';
import { EPOCH_MAX, readPartyId } from './partyWire';
import { beat as beats, blob, close, createRoom, unblob } from './fixtures/partyRoom';

const HEARTBEAT_MS = 15000; // client.js’s: a hello, the sweep and the link’s tick
const QUIET_MS = 45000; // client.js’s: nothing heard this long, and they’re gone
const LAG_MS = 4000; // the longest a word is on its way
const DATE0 = 1.7e12;
const NAMES = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo'];
const SEEDS = Number(process.env.PARTY_SIM_SEEDS) || 2000;
const CHUNK = 100; // seeds a test

// mulberry32: one 32-bit word of state, and the same numbers from the same seed
function prng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let x = Math.imul(s ^ (s >>> 15), 1 | s);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (list, r) => (list.length ? list[Math.floor(r * list.length)] : null);
const hex = (rng, n) => Array.from({ length: n }, () => Math.floor(rng() * 16).toString(16)).join('');
const memory = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};

// A run, drawn from its seed: the pilots’ keys, the stranger’s, and each
// step’s kind, the time before it and four numbers that choose who and what
// (so a step taken out of a run leaves the others meaning what they did)
const WEIGHTS = { toggle: 8, start: 4, invite: 14, accept: 10, decline: 3, leave: 4, remove: 4, promote: 5, summon: 2, say: 5, quip: 2, beat: 8, early: 12, pause: 3, stranger: 14 };
const TOTAL = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);
function script(seed) {
  const rng = prng(Math.imul(seed, 0x9e3779b1) ^ 0x2545f491);
  const kind = () => {
    let r = rng() * TOTAL;
    for (const [k, w] of Object.entries(WEIGHTS)) if ((r -= w) < 0) return k;
    return 'beat';
  };
  const ids = Array.from({ length: 2 + Math.floor(rng() * 4) }, () => hex(rng, 64));
  const stranger = hex(rng, 64);
  const steps = Array.from({ length: 20 + Math.floor(rng() * 100) }, () => ({ kind: kind(), dt: Math.floor(rng() * 3000), r: [rng(), rng(), rng(), rng()] }));
  return { seed, ids, stranger, steps };
}

async function play({ seed, ids, stranger, steps }, trace = null) {
  const net = prng(seed ^ 0x5bd1e995); // the bus’s lags, the heartbeats’ phases, the parties’ ids
  let t = 0;
  let n = 0; // events so far
  let seq = 0;
  const queue = []; // words on their way: { at, seq, from, visit, to, toVisit, ns, data }
  const problems = [];
  const sealed = []; // every line sealed: { from, to }
  const heard = []; // every line or summons taken: { to, from }
  const removals = []; // every remove an honest leader made: { party, id, used }
  const pilots = ids.map((id, i) => ({ id, name: NAMES[i], online: false, visit: 0, held: null, news: [], store: createPartyStore({ saves: createSaves({ local: memory(), session: memory() }), now: () => DATE0 + t }) }));
  const S = { id: stranger, name: 'Stranger', visit: 1, parties: new Map(), rosters: [] };
  const byId = new Map(pilots.map((x) => [x.id, x]));
  const nameOf = (id) => byId.get(id)?.name ?? (id === S.id ? 'Stranger' : id.slice(0, 6));
  const log = (line) => trace?.push(`${String(t).padStart(7)} ${line}`);
  const problem = (text) => {
    if (problems.length < 4) problems.push(`${text} (t ${t})`);
    log(`!! ${text}`);
  };
  const lag = () => Math.floor(net() ** 2 * LAG_MS);
  const partyOf = (x) => (x.online ? x.link.snapshot().party : null);
  const view = (p) => (p ? `${p.id.slice(0, 4)} ${nameOf(p.leader)}@${p.epoch} [${p.members.map((m) => nameOf(m.id)).join(',')}]` : '-');
  const shown = (ns, d) => (ns === 'party' && d.t === 'ros' ? `ros ${d.p.slice(0, 4)} ${nameOf(d.l)}@${d.e} [${d.m.map(([id]) => nameOf(id)).join(',')}]` : ns === 'party' ? `${d.t} ${String(d.p).slice(0, 4)}${d.l ? ` ${nameOf(d.l)}` : ''}` : ns === 'hi' ? `hi ${d.pt ? `${d.pt.slice(0, 4)}@${d.pe}` : '-'}` : ns);

  // the stranger reads every word an honest pilot says, whoever it’s to
  const peek = (ns, d) => {
    const p = ns === 'hi' ? readPartyId(d.pt) : ns === 'party' ? readPartyId(d.p) : null;
    if (!p) return;
    const info = S.parties.get(p) ?? { members: new Set(), leaders: new Set(), epoch: 1 };
    S.parties.set(p, info);
    if (ns === 'hi' && Number.isSafeInteger(d.pe)) info.epoch = Math.max(info.epoch, d.pe);
    if (d.t === 'inv') info.leaders.add(d.l);
    if (d.t !== 'ros') return;
    info.epoch = Math.max(info.epoch, d.e);
    info.leaders.add(d.l);
    for (const [id] of d.m) info.members.add(id);
    S.rosters.push(d);
    if (S.rosters.length > 40) S.rosters.shift();
  };
  const post = (x, ns, data, to) => {
    const wire = JSON.parse(JSON.stringify(data));
    if (x !== S) peek(ns, wire);
    log(`${x.name} → ${to ? nameOf(to) : 'all'}: ${shown(ns, wire)}`);
    for (const y of pilots) if (y !== x && y.online && (!to || to === y.id)) queue.push({ at: t + lag(), seq: seq++, from: x, visit: x.visit, to: y, toVisit: y.visit, ns, data: wire });
  };

  // client.js’s side of each honest pilot: its rows of the others, its hello, its heartbeat
  const row = (x, id) => {
    if (!x.peers.has(id)) x.peers.set(id, { id, name: null, where: null, blocked: false, ally: 'none', mate: false, pt: null, pe: null, quip: null, seen: t });
    return x.peers.get(id);
  };
  const hi = (x, to) => {
    const field = x.link.helloField();
    x.said = JSON.stringify(field);
    post(x, 'hi', { n: x.name, w: '/universe', ...field }, to);
  };
  const gone = (x, p) => {
    x.peers.delete(p.id);
    x.link.gone(p);
  };
  const beat = (x) => {
    hi(x);
    for (const p of [...x.peers.values()]) if (t - p.seen > QUIET_MS) gone(x, p);
    x.link.tick();
    x.next = t + HEARTBEAT_MS - 500 + Math.floor(net() * 1000);
  };
  const crypt = (x) => ({
    seal: (to, party, text) => {
      sealed.push({ from: x.id, to: [...to] });
      return to.map((id) => blob([x.id, id, party, text]));
    },
    open: (from, party, blobs) => blobs.map(unblob).find((b) => Array.isArray(b) && b[0] === from && b[1] === x.id && b[2] === party)?.[3] ?? null,
  });
  const online = (x) => {
    Object.assign(x, { online: true, wired: false, visit: x.visit + 1, peers: new Map(), known: new Map(), actions: {}, said: null, next: t + Math.floor(net() * HEARTBEAT_MS) });
    x.link = createPartyLink({
      self: { id: x.id, name: x.name, where: '/universe' },
      peers: x.peers,
      store: x.store,
      now: () => t,
      date: () => DATE0 + t,
      rand: (bytes) => bytes.forEach((_, i) => (bytes[i] = Math.floor(net() * 256))),
      roster: () => {},
      feed: (text) => x.news.push(text),
      emit: (e) => {
        if (e.type === 'chat' && !e.line.mine) heard.push({ to: x.id, from: e.line.from });
        if (e.type === 'summon') heard.push({ to: x.id, from: e.from });
        if (e.type === 'party' && x.wired && JSON.stringify(x.link.helloField()) !== x.said) hi(x);
      },
    });
    const admit = (kind, id) => {
      const p = x.peers.get(id);
      if (p) p.seen = t;
      return p && !p.blocked ? p : null;
    };
    x.link.wire({ action: (ns) => (x.actions[ns] = { onMessage: null, send: (data, o) => (post(x, ns, data, o?.target), Promise.resolve()) }), admit });
    x.link.setCrypt(crypt(x));
    x.wired = true;
    log(`${x.name} online (visit ${x.visit}): ${view(partyOf(x))}`);
    hi(x);
  };
  const offline = (x) => {
    x.link.dispose();
    x.online = false;
    log(`${x.name} offline`);
    for (const y of pilots) if (y.online) queue.push({ at: t + lag(), seq: seq++, from: x, visit: x.visit, to: y, toVisit: y.visit, ns: '@bye' });
  };
  // a word arriving (nostr.js’s take, then client.js’s handlers)
  const deliver = (m) => {
    const y = m.to;
    if (!y.online || y.visit !== m.toVisit) return; // (sent while they were away: lost)
    const id = m.from.id;
    const k = y.known.get(id);
    if (m.ns === '@bye') {
      if (k?.visit !== m.visit) return;
      y.known.delete(id);
      if (y.peers.has(id)) gone(y, y.peers.get(id));
      return;
    }
    if (k) k.visit = m.visit;
    else {
      y.known.set(id, { visit: m.visit });
      row(y, id);
      hi(y, id);
    }
    if (m.ns !== 'hi') return y.actions[m.ns]?.onMessage?.(m.data, { peerId: id });
    const p = row(y, id);
    p.seen = t;
    const first = p.name === null;
    p.name = typeof m.data.n === 'string' ? m.data.n : 'Pilot';
    y.link.hello(p, m.data, first);
  };

  // after every event: what each pilot online holds, held to the rules
  const audit = () => {
    n += 1;
    for (const x of pilots) {
      if (!x.online) continue;
      const party = partyOf(x);
      const pid = party?.id ?? null;
      if (party && !(Number.isSafeInteger(party.epoch) && party.epoch >= 1 && party.epoch <= EPOCH_MAX)) problem(`${x.name} holds epoch ${party.epoch}`);
      if (party?.members.some((m) => m.id === S.id)) problem(`${x.name} has the stranger in ${view(party)}`);
      if (pid !== x.held && x.held) {
        // (a removal counts once, and only if made since they last went: it may come before the roster that let them in reaches them)
        const news = x.news.join(' | ');
        const out = /no longer in the party|removed you from/.test(news);
        const mine = removals.filter((r) => r.party === x.held && r.id === x.id && !r.used);
        if (out && !mine.length) problem(`${x.name} put out of ${x.held.slice(0, 4)}, removed by no leader`);
        if (!out && !/You left the party|You joined/.test(news)) problem(`${x.name} lost ${x.held.slice(0, 4)} without a word`);
        for (const r of mine) r.used = true;
      }
      if (pid !== x.held) {
        x.held = pid;
        log(`   ${x.name} holds ${view(party)}`);
      }
      x.news.length = 0;
    }
  };
  // the clock on to `end`, each word and heartbeat in its turn
  const advance = (dt) => {
    const end = t + dt;
    for (;;) {
      let m = null;
      for (const q of queue) if (!m || q.at < m.at || (q.at === m.at && q.seq < m.seq)) m = q;
      let b = null;
      for (const x of pilots) if (x.online && (!b || x.next < b.next)) b = x;
      const at = Math.min(m?.at ?? Infinity, b?.next ?? Infinity);
      if (at > end) break;
      t = Math.max(t, at);
      if (m && m.at === at) {
        queue.splice(queue.indexOf(m), 1);
        deliver(m);
      } else beat(b);
      audit();
    }
    t = end;
  };

  // the stranger: anything well formed, about any party it’s heard of (or one made up)
  const mischief = ([r0, r1, r2, r3]) => {
    const pid = pick([...S.parties.keys()], r1) ?? hex(net, 16);
    const info = S.parties.get(pid) ?? { members: new Set(), leaders: new Set(), epoch: 1 };
    const on = pilots.filter((x) => x.online);
    const to = pick(on, r2)?.id;
    const member = pick([...info.members], r3) ?? to;
    const e = pick([info.epoch, info.epoch + 1, info.epoch + 2 + Math.floor(r3 * 300), EPOCH_MAX, 1], r3);
    const word = (data, at) => post(S, 'party', data, at);
    const hello = (pt, pe) => post(S, 'hi', { n: 'Stranger', w: '/universe', ...(pt ? { pt, pe } : {}) });
    switch (Math.floor(r0 * 12)) {
      case 0:
        return hello(r2 < 0.8 ? pid : null, e);
      case 1: // an invite to the party, from someone in it (as its hello says)
        hello(pid, info.epoch);
        return to && member && word({ t: 'inv', p: pid, l: member }, to);
      case 2:
        return word({ t: 'join', p: pid }, pick([...info.leaders], r3) ?? to);
      case 3: {
        const ros = pick(S.rosters, r3);
        return ros && word(ros, r2 < 0.5 ? undefined : to);
      }
      case 4: {
        // a roster made up from one heard: another epoch, leader, members (the stranger among them, or not)
        const base = pick(S.rosters, r3)?.m.map(([id]) => id) ?? [to ?? S.id];
        let m = [...new Set([...base.slice(Math.floor(r1 * base.length)), ...base, ...(r2 < 0.5 ? [S.id] : [])])];
        if (r3 < 0.3 && m.length > 1) m = m.filter((_, i) => i !== Math.floor(r2 * m.length));
        m = m.slice(0, 8);
        return word({ t: 'ros', p: pid, l: pick(m, r2), e, m: m.map((id) => [id, nameOf(id)]) }, r1 < 0.5 ? undefined : to);
      }
      case 5:
        return word({ t: 'left', p: pid });
      case 6:
        return to && word({ t: 'out', p: pid }, to);
      case 7:
        return word({ t: 'sum', p: pid, w: '/universe' });
      case 8:
        return to && word({ t: 'no', p: pid }, to);
      case 9:
        return on.length && post(S, 'psay', { b: on.map((x) => blob([S.id, x.id, pid, 'let me in'])) });
      case 10:
        return post(S, 'quip', { q: Math.floor(r2 * 8) });
      default:
        return hello(pid, info.epoch);
    }
  };

  // an honest pilot’s step
  const act = async ({ kind, r: [r0, r1, r2, r3] }) => {
    const on = pilots.filter((x) => x.online);
    const leaders = on.filter((x) => partyOf(x)?.leader === x.id);
    const inParty = on.filter((x) => partyOf(x));
    const x = pick(kind === 'toggle' ? pilots : kind === 'remove' || kind === 'promote' || kind === 'summon' ? leaders : kind === 'leave' || kind === 'say' ? inParty : on, r0);
    if (!x && kind !== 'beat' && kind !== 'early' && kind !== 'pause' && kind !== 'stranger') return;
    const did = (what, ok) => log(`${x.name} ${what}: ${ok}`);
    switch (kind) {
      case 'toggle':
        return x.online ? offline(x) : online(x);
      case 'start':
        return did('starts', x.link.api.start());
      case 'invite': {
        const y = pick(on.filter((o) => o !== x && x.peers.get(o.id)?.name), r1);
        return y && did(`asks ${y.name}`, x.link.api.invite(y.id));
      }
      case 'accept':
      case 'decline': {
        const inv = pick(x.link.snapshot().invites, r1);
        return inv && did(`${kind}s ${nameOf(inv.from)}’s (${inv.party.slice(0, 4)}, ${nameOf(inv.leader)})`, x.link.api[kind](inv.from));
      }
      case 'leave':
        return did('leaves', x.link.api.leave());
      case 'remove':
      case 'promote': {
        const p = partyOf(x);
        const m = pick(p.members.filter((o) => !o.you), r1);
        if (!m) return;
        const ok = x.link.api[kind](m.id);
        if (ok && kind === 'remove') removals.push({ party: p.id, id: m.id, used: false });
        return did(`${kind}s ${nameOf(m.id)}`, ok);
      }
      case 'summon':
        return did('summons', x.link.api.summon());
      case 'say':
        return did('says', await x.link.api.say(`line ${n}`));
      case 'quip':
        return did('quips', x.link.api.quip(Math.floor(r1 * 8)));
      case 'beat':
        for (const y of [...on.slice(Math.floor(r1 * on.length)), ...on.slice(0, Math.floor(r1 * on.length))]) beat(y);
        return post(S, 'hi', { n: 'Stranger', w: '/universe' });
      case 'early':
        for (let i = 0; i < 1 + Math.floor(r1 * 5) && queue.length; i++) {
          deliver(queue.splice(Math.floor(r2 * queue.length), 1)[0]);
          audit();
        }
        return;
      case 'pause':
        return advance(15000 + Math.floor(r0 * 45000));
      case 'stranger':
        return mischief([r0, r1, r2, r3]);
    }
  };

  try {
    for (const step of steps) {
      advance(step.dt);
      await act(step);
      audit();
    }
    // the end: everyone back, and heartbeats till nothing changes
    for (const x of pilots) {
      if (x.online) continue;
      advance(Math.floor(net() * 3000));
      online(x);
      audit();
    }
    let calm = 0;
    let was = '';
    for (let i = 0; i < 40 && calm < 4; i++) {
      advance(HEARTBEAT_MS);
      const now = pilots.map((x) => view(partyOf(x))).join(' / ');
      calm = now === was ? calm + 1 : 0;
      was = now;
    }
    await new Promise((r) => setTimeout(r, 0)); // (the lines being opened)
    if (calm < 4) problem(`never settles: ${was}`);
    const held = new Map();
    for (const x of pilots) {
      const p = partyOf(x);
      if (p) held.set(p.id, [...(held.get(p.id) ?? []), [x, p]]);
    }
    for (const [pid, list] of held) {
      const views = new Set(list.map(([, p]) => view(p)));
      if (views.size > 1) problem(`split: ${list.map(([x, p]) => `${x.name} ${view(p)}`).join(' / ')}`);
      for (const [x, p] of list) for (const m of p.members) if (partyOf(byId.get(m.id) ?? S)?.id !== pid) problem(`${x.name}’s ${view(p)} lists ${nameOf(m.id)}, who isn’t in it`);
    }
    if (sealed.some((s) => s.to.includes(S.id))) problem('a line sealed for the stranger');
    if (heard.some((h) => h.from === S.id)) problem('the stranger heard as a mate');
  } catch (err) {
    problem(`threw: ${err?.stack ?? err}`);
  }
  return { problems, trace };
}

// the fewest steps of a failing run that still fail it the same way
async function minimise(sc) {
  const kind = (r) => r.problems[0]?.replace(/\(t \d+\)|[0-9a-f]{4}/g, '').split(':')[0];
  const want = kind(await play(sc));
  let { steps } = sc;
  for (let size = Math.ceil(steps.length / 2); size >= 1; size = Math.floor(size / 2)) {
    for (let i = 0; i < steps.length; ) {
      const fewer = [...steps.slice(0, i), ...steps.slice(i + size)];
      if (kind(await play({ ...sc, steps: fewer })) === want) steps = fewer;
      else i += size;
    }
  }
  return { ...sc, steps };
}

// The runs the simulation broke, cut to their steps and played in partyLink.test.js’s room
describe('what the simulation found', () => {
  const [ALPHA, BRAVO] = ['a', 'b'].map((x) => x.repeat(64));
  const ids = (x) => x.link.snapshot().party?.members.map((m) => m.id) ?? null;
  const pair = (opts = {}) => {
    const room = createRoom();
    const a = room.join(ALPHA, 'Alpha', opts.a);
    const b = room.join(BRAVO, 'Bravo', opts.b);
    room.meet();
    a.link.api.invite(BRAVO);
    b.link.api.accept(ALPHA);
    return { room, a, b };
  };

  it('a leader back from the store behind a takeover changes nothing till the party’s roster reaches him', () => {
    // (seed 261: Alpha reloads, Bravo takes over meanwhile, and Alpha, leading as he left it, takes Bravo out: two leaders, neither the other’s)
    const store = createPartyStore();
    const { room, a, b } = pair({ a: { store } });
    close(room, a);
    const a2 = room.join(ALPHA, 'Alpha', { store });
    room.hello(b); // (Bravo’s hello, at epoch 3, reaches Alpha; Alpha’s roster to Bravo is lost, unread)
    expect([a2.link.api.remove(BRAVO), a2.link.api.promote(BRAVO)]).toEqual([false, false]);
    room.meet();
    for (const x of [a2, b]) expect(x.link.snapshot().party).toMatchObject({ leader: BRAVO, epoch: 3, members: [{ id: ALPHA }, { id: BRAVO }] });
  });

  it('a removal that crossed your takeover: the leader you took over from, back, still puts you out', () => {
    // (seed 1402: Alpha takes Bravo out and goes, and the goodbye reaches Bravo first, who takes over;
    // seed 261: Alpha, back from the store, takes Bravo out before Bravo’s takeover reaches him)
    const store = createPartyStore();
    const { room, a, b } = pair({ a: { store } });
    close(room, a);
    expect(b.link.snapshot().party).toMatchObject({ leader: BRAVO, epoch: 3 });
    const elsewhere = createRoom(); // (what Alpha says there reaches no one here: his words lost behind his goodbye)
    const a1 = elsewhere.join(ALPHA, 'Alpha', { store });
    expect(a1.link.api.remove(BRAVO)).toBe(true);
    close(elsewhere, a1);
    const a2 = room.join(ALPHA, 'Alpha', { store });
    room.meet();
    beats(room, [a2, b], 1);
    expect([ids(a2), ids(b)]).toEqual([[ALPHA], null]);
    expect(b.seen.some((e) => e.text === 'You’re no longer in the party')).toBe(true);
  });

  it('one put out while away is told again a while on, whatever epoch they hold: the first was sent before they’d read the leader’s hello', () => {
    // (seed 396: Bravo took over and went; Alpha, back, took him out at the same epoch; Bravo, back, never heard it)
    const [sa, sb] = [createPartyStore(), createPartyStore()];
    const { room, a, b } = pair({ a: { store: sa }, b: { store: sb } });
    close(room, a);
    close(room, b);
    const a2 = room.join(ALPHA, 'Alpha', { store: sa });
    expect(a2.link.api.remove(BRAVO)).toBe(true);
    const b2 = room.join(BRAVO, 'Bravo', { store: sb });
    expect(b2.link.snapshot().party).toMatchObject({ leader: BRAVO, epoch: 3 });
    room.hello(b2); // (Alpha’s roster to him is lost, unread)
    room.meet();
    beats(room, [a2, b2], 1);
    expect([ids(a2), ids(b2)]).toEqual([[ALPHA], null]);
    expect(b2.seen.some((e) => e.text === 'You’re no longer in the party')).toBe(true);
  });

  it('the one who left tells a member back behind it, that visit: here, that they were put out', () => {
    // (seed 388: Alpha hands the lead to Bravo and goes; Bravo takes him out, and leaves, the last one)
    const store = createPartyStore();
    const { room, a, b } = pair({ a: { store } });
    a.link.api.promote(BRAVO);
    close(room, a);
    b.link.api.remove(ALPHA);
    b.link.api.leave();
    const a2 = room.join(ALPHA, 'Alpha', { store });
    room.meet();
    expect(ids(a2)).toBeNull();
  });

  it('back to a party all the others have left since, with no one to say so: you lead what’s left, a while on', () => {
    // (seed 45: the leader left while Bravo was away, and forgot it going offline; Bravo waited for him for ever)
    const store = createPartyStore();
    const { room, a, b } = pair({ b: { store } });
    close(room, b);
    a.link.api.leave();
    close(room, a);
    const [a2, b2] = [room.join(ALPHA, 'Alpha'), room.join(BRAVO, 'Bravo', { store })];
    room.meet();
    beats(room, [a2, b2], 1);
    expect(b2.link.snapshot().party.leader).toBe(ALPHA); // (not at once: a hand-over may be on its way)
    beats(room, [a2, b2], 1);
    expect(b2.link.snapshot().party).toMatchObject({ leader: BRAVO, members: [{ id: BRAVO }] });
  });
});

describe('the party, played at random', () => {
  for (let from = 1; from <= SEEDS; from += CHUNK) {
    const to = Math.min(SEEDS, from + CHUNK - 1);
    it(`seeds ${from} to ${to}: one roster each, no one put out unremoved, no stranger in`, async () => {
      const failed = [];
      for (let seed = from; seed <= to; seed++) {
        const { problems } = await play(script(seed));
        if (problems.length) failed.push(`seed ${seed}: ${problems.join('; ')}`);
      }
      if (process.env.PARTY_SIM_LOG) console.log(failed.join('\n'));
      expect(failed).toEqual([]);
    });
  }

  it.runIf(process.env.PARTY_SIM_SEED)('one seed, cut short and traced', async () => {
    const sc = await minimise(script(Number(process.env.PARTY_SIM_SEED)));
    const { problems, trace } = await play(sc, []);
    console.log(`${sc.steps.length} steps: ${sc.steps.map((s) => s.kind).join(' ')}\n${trace.join('\n')}`);
    expect(problems).toEqual([]);
  });
});
