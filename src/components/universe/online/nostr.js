// The room the pilots meet in: public Nostr relays carrying everything, so
// it works from any network a web page can load from (each browser opens
// ordinary secure WebSockets out to the relays; nothing has to reach in, so
// no NAT or firewall gets in the way), and no pilot ever learns another's IP
// address (only the relays see yours, as any website does). The site is
// static, so there's no server of its own: these are run by others, free.
//
// What each browser sends goes out as Nostr events of an ephemeral kind
// (KIND: relays pass it on to whoever's listening and keep nothing), tagged
// with the room, to every relay in RELAYS; each listens for the same on all
// of them, and an event that comes in from more than one is taken once (by
// its id). Messages are bundled: whatever's waiting goes out together at
// most every FLUSH_MS (only the latest pose and pointer of a bundle are
// kept), which keeps each pilot well inside what the relays allow. The
// sockets are pool.js's: one to each relay, shared by every room on the
// page, each room a subscription of its own on them (`pool`, the page's
// for the WebSocket class and relays given, unless one's handed in).
//
// Who you are is the key you sign with (identity.js's: kept in this browser
// unless you've said not to, or a key of the tab's own when another tab's
// already flying on it; the same in every room you join, visitKeys(): the
// site's own and each world's, so the person walking your Bree is the one in
// the roster, and a block holds everywhere): every event is signed, the
// relays check it, and anything that matters (a hello, a hit, being shot
// down, an alliance, leaving) is checked again here, so no one can speak as
// another pilot. A key lasts, so a pilot's words from a past visit are
// still theirs, and mustn't be played back as new: an event much older than
// the pilot's others is dropped, and so is one from a pilot first heard
// whose time is further than SKEW_S from your clock. Each room's events
// carry a tag of the visit's own ('visit'), and a goodbye (signed ahead, so
// it can go out as the page closes) is believed only when its tag is the
// one the pilot's other words, checked, carry now: one recorded on a past
// visit removes nobody. This module is ready only once the
// identity's roll-call of the browser's tabs is over (a moment, ROLL_MS at
// most), so nothing that imports it signs as another tab's pilot.
//
// joinRoom({ appId, relays, WebSocket, pool, keys }, roomId) → { selfId, ready (resolves
// once a relay's listening, rejects if none answer), makeAction(ns) →
// { send(data, { target }), onMessage(data, { peerId, tag }) }, onPeerJoin(id),
// onPeerLeave(id), onStatus('online' | 'connecting'), seal(to, party, text)
// → the blobs, open(from, party, blobs) → the line or null (a party's chat,
// below), leave() }: what client.js takes. (Other games pass `latest`, the kinds of message of
// which only the newest in a bundle matters, and `cheap`, those trusted to
// the relays' own check of the signature.)
//
// A room can be heard by cell (src/lib/net/cells.js), for a world too big
// for everyone to hear everyone: joined with `cells` (a function giving the
// tags to listen for, or null for all), its REQ asks for '#g' too, so the
// relays pass on only the events of pilots near you. setCell(tag) is what
// your own events carry from then (['g', tag]); setCells(tags) is what you
// listen for, asked of the relays again (one REQ each, under the same id) on
// the next tick and only when the set changed, since the relays count REQs
// (said ten times in a frame, it's one REQ). An event from a cell not
// listened for (a relay that ignores '#g', or one still on the REQ before)
// is dropped here and counted (stats().offCell). A message for one
// pilot carries their cell as well, the one their last words carried, so a
// hit or an ask from cells away still passes their filter. A room joined
// without `cells`, and never told otherwise, asks and sends exactly what it
// always did.

import { schnorr } from '@noble/secp256k1';
import { KIND, checkEvent, hex, signEvent } from './events';
import { createIdentity } from './identity';
import { openFrom, sealFor } from './partyCrypt';
import { poolFor } from './pool';
import { localSaves } from '../../../runtime/local';
import { sameCells } from '../../../lib/net/cells';

export { KIND, checkEvent, eventId, hex, signEvent } from './events';
// relays that took ten events a second for a minute without dropping any
// (others tried passed half, or banned the test)
export const RELAYS = ['nostr-01.uid.ovh', 'relay.mostro.network', 'bucket.coracle.social', 'nostr-01.yakihonne.com'].map((h) => `wss://${h}`);
export const FLUSH_MS = 100; // a bundle at most this often
const READY_MS = 12000; // no relay listening by now: couldn't connect
const STALE_S = 30; // an event this much older than the pilot's others is a replay
// A pilot first heard: their clock may be this far from yours, no further.
// Clocks set from the network agree to within seconds; five minutes leaves
// room for one kept by hand, and turns away a word from a past visit (minutes
// to days old) played back before anything of theirs from this one.
const SKEW_S = 300;
const QUIET_MS = 60000; // a pilot not heard from this long is forgotten (they'll be met again)
const CONTENT_MAX = 16000; // characters of content taken from an event
const QUEUE_MAX = 64; // messages waiting, at most
const LATEST = new Set(['pose', 'foot', 'walk', 'cur', 'pack']); // only the newest of these in a bundle
const CHEAP = new Set(['pose', 'foot', 'walk', 'cur', 'shot', 'pack']); // trusted to the relay's own check of the signature

const TAG_MAX = 80; // characters of a pilot's cell tag kept
const isHex = (s, n) => typeof s === 'string' && s.length === n && /^[0-9a-f]+$/.test(s);

// Who signs (identity.js): one for the page, made as this module loads, on
// the browser's storage and a channel to its other tabs. useOnline.js reads
// it for the roster's switch and its “New identity”.
const keygen = (secretKey) => (secretKey ? { secretKey, publicKey: schnorr.getPublicKey(secretKey) } : schnorr.keygen());
const tabs = () => {
  try {
    return typeof window !== 'undefined' && typeof BroadcastChannel === 'function' ? new BroadcastChannel('tp-pilot') : null;
  } catch {
    return null;
  }
};
let pilot = null;
export const identity = () => (pilot ??= createIdentity({ saves: localSaves(), keygen, channel: tabs() }));
// (a test's own in its place; null: the page's, made afresh when next asked)
export function setIdentity(next) {
  pilot = next;
}
// the visit's key: the identity's, the same for every room till the page
// goes (a room joined without it makes its own)
export const visitKeys = () => identity().keys();
// a room joined as the visit's one self (what the site's rooms all do)
export const joinAsVisitor = (opts, roomId) => joinRoom({ ...opts, keys: visitKeys() }, roomId);

// Signing and checking (events.js) in a worker of their own where the
// browser has one (signer.worker.js): each is a few milliseconds of sums on
// big numbers, and ten or more a second, in the page, would take that out of
// the universe map's frames. Where there's no worker, or it fails, here.
let worker; // undefined: not made yet; null: none to be had
let nextJob = 0;
const jobs = new Map(); // id → (reply or null) → void
function signer() {
  if (worker !== undefined) return worker;
  worker = null;
  if (typeof Worker === 'undefined') return null;
  try {
    worker = new Worker(new URL('./signer.worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = ({ data }) => {
      const job = jobs.get(data?.id);
      jobs.delete(data?.id);
      job?.(data);
    };
    worker.onerror = () => {
      // it couldn't start (or broke): what was waiting is done here, and so is the rest
      worker?.terminate();
      worker = null;
      const waiting = [...jobs.values()];
      jobs.clear();
      for (const job of waiting) job(null);
    };
  } catch {
    worker = null;
  }
  return worker;
}
const offPage = (op, payload, here) => {
  const w = signer();
  if (!w) return here();
  return new Promise((resolve) => {
    const id = nextJob++;
    jobs.set(id, (reply) => resolve(reply && !reply.error ? reply.out : here()));
    w.postMessage({ id, op, ...payload });
  });
};
const signAway = (key, pubkey, ev) => offPage('sign', { key, pubkey, ev }, () => signEvent(key, pubkey, ev));
const checkAway = (ev) => offPage('check', { ev }, () => checkEvent(ev));

// A party's chat, sealed for each mate and opened (partyCrypt.js), off the
// page as well: each mate's pair key is a sum on big numbers like a
// signature's. The pair keys are kept where the work's done (the worker's
// own, or `pairs` here when there's no worker), and dropped when a room
// leaves, so a secret agreed with a mate lasts no longer than you're there
// (another room on the same key makes them again, once).
const pairs = new Map();
const sealAway = (key, pubkey, party, to, text) => offPage('seal', { key, pubkey, party, to, text }, () => sealFor({ secretKey: key, selfPub: pubkey, to, party, text, cache: pairs }));
const openAway = (key, pubkey, party, from, blobs) => offPage('open', { key, pubkey, party, from, blobs }, () => openFrom({ secretKey: key, selfPub: pubkey, from, party, blobs, cache: pairs }));
const forgetPairs = () => {
  pairs.clear();
  if (worker) offPage('forget', {}, () => true);
};

export function joinRoom({ appId, relays = RELAYS, WebSocket = globalThis.WebSocket, pool = poolFor(WebSocket, relays), flushMs = FLUSH_MS, readyMs = READY_MS, latest = LATEST, cheap = CHEAP, keys = schnorr.keygen(), cells = null }, roomId) {
  const { secretKey, publicKey } = keys;
  const self = hex(publicKey);
  const topic = `${appId}/${roomId}`;
  // (this visit's own tag on everything sent: a goodbye's good only for the visit it was signed in)
  const visit = hex(globalThis.crypto.getRandomValues(new Uint8Array(8)));
  const tags = [
    ['x', topic],
    ['visit', visit],
  ];
  const actions = {};
  const known = new Map(); // pilot → { heard (ms), skew (s, their clock against yours), chain, met, visit (theirs now, from a word whose signature checked out) }
  const seen = new Map(); // event id → ms (taken once, from whichever relay's first)
  let queue = [];
  let timer = 0;
  let lastFlush = -Infinity;
  let left = false;
  let status = 'connecting';
  let bye = null; // the goodbye, signed ahead so it can go out as the page closes
  let cell = null; // the tag your own events carry (setCell)
  let want; // the cells listened for once setCells has said (till then, cells()'s)
  let reask = 0; // setCells said something new: the relays asked on the next tick
  let offCell = 0; // events dropped for a cell not listened for
  // (an empty list is no list: all)
  const listening = () => {
    const g = want !== undefined ? want : cells?.();
    return g?.length ? g : null;
  };
  // the cells the room last asked for (at joining, or on a change; not each
  // socket's reopening, which only asks for what's listened for then)
  let asked = listening();
  // what your events are tagged with: the room, the visit, your cell
  const ownTags = () => (cell ? [...tags, ['g', cell]] : tags);

  const nowS = () => Math.floor(Date.now() / 1000);

  // a message in from a pilot (p, what's known of them): who's new, who's
  // leaving, then the room's actions. `theirs`: the visit the event's tag
  // names (null for an older client's, which has none), when its signature
  // was checked; undefined when it wasn't
  const take = (ev, msgs, p, theirs) => {
    const id = ev.pubkey;
    if (msgs.length === 1 && msgs[0][0] === '@bye') {
      // (only the goodbye of the visit they're on: one from a past visit, played back, is nothing)
      if (known.get(id) === p && p.met && theirs !== undefined && theirs === p.visit) {
        known.delete(id);
        room.onPeerLeave?.(id);
      }
      return;
    }
    if (theirs !== undefined) p.visit = theirs;
    if (!known.has(id)) known.set(id, p); // (forgotten while this was checked)
    if (!p.met) {
      p.met = true;
      room.onPeerJoin?.(id);
    }
    // the cell the sender's words carry (theirs comes first; a message for
    // one pilot adds that pilot's after it), for a reader that holds a pose to it
    const tag = ev.tags.find((t) => Array.isArray(t) && t[0] === 'g')?.[1] ?? null;
    for (const m of msgs) {
      const [ns, data, to] = m;
      if (ns[0] === '@' || (to !== undefined && to !== self)) continue;
      actions[ns]?.onMessage?.(data, { peerId: id, tag });
    }
  };

  const onEvent = (ev) => {
    if (left || !ev || typeof ev !== 'object' || ev.kind !== KIND || !isHex(ev.id, 64) || !isHex(ev.pubkey, 64) || !isHex(ev.sig, 128)) return;
    if (ev.pubkey === self || seen.has(ev.id)) return;
    const near = listening();
    if (near && !ev.tags?.some?.((t) => Array.isArray(t) && t[0] === 'g' && near.includes(t[1]))) {
      offCell += 1;
      return;
    }
    if (!Number.isInteger(ev.created_at) || typeof ev.content !== 'string' || ev.content.length > CONTENT_MAX) return;
    if (!Array.isArray(ev.tags) || !ev.tags.some((t) => Array.isArray(t) && t[0] === 'x' && t[1] === topic)) return;
    let msgs;
    try {
      msgs = JSON.parse(ev.content);
    } catch {
      return;
    }
    if (!Array.isArray(msgs) || !msgs.length || msgs.length > QUEUE_MAX) return;
    msgs = msgs.filter((m) => Array.isArray(m) && typeof m[0] === 'string' && m[0].length <= 16);
    if (!msgs.length) return;
    seen.set(ev.id, Date.now());
    const leaving = msgs.length === 1 && msgs[0][0] === '@bye';
    let p = known.get(ev.pubkey);
    if (!p) {
      // someone not heard from: a goodbye of theirs is nothing, and a word
      // further from now than SKEW_S is an old one of theirs played back
      // (their key lasts, so a past visit's words are still theirs)
      if (leaving || Math.abs(nowS() - ev.created_at) > SKEW_S) return;
      known.set(ev.pubkey, (p = { heard: Date.now(), skew: nowS() - ev.created_at, chain: Promise.resolve(), met: false, visit: undefined }));
    }
    // (a goodbye's signed ahead of time, so it may be old: its visit tag says whether it's this visit's)
    if (!leaving && nowS() - ev.created_at - p.skew > STALE_S) return;
    p.heard = Date.now();
    // (where they are, for a message to them to carry: their last words' cell, or none)
    const g = ev.tags.find((t) => Array.isArray(t) && t[0] === 'g');
    p.cell = typeof g?.[1] === 'string' && g[1].length <= TAG_MAX ? g[1] : null;
    const check = msgs.some((m) => !cheap.has(m[0]));
    const tagged = ev.tags.find((t) => Array.isArray(t) && t[0] === 'visit' && typeof t[1] === 'string' && t[1].length <= 32);
    // in order, per pilot (a check takes a moment)
    p.chain = p.chain.then(async () => {
      if (check && !(await checkAway(ev))) {
        seen.delete(ev.id); // (a forged copy mustn't keep the real one out)
        return;
      }
      if (!left) take(ev, msgs, p, check ? (tagged?.[1] ?? null) : undefined);
    });
  };

  // the room's listening, on the pool's sockets (asked for afresh each time one opens)
  // (with cells, only theirs: '#g' between the topic and `since`, so a room without asks exactly as before)
  const filter = () => {
    const g = listening();
    return g ? { kinds: [KIND], '#x': [topic], '#g': [...g], since: nowS() - 10 } : { kinds: [KIND], '#x': [topic], since: nowS() - 10 };
  };
  const sub = pool.subscribe({ filter, onEvent, onChange: () => setStatus() });
  const setStatus = () => {
    const next = sub.up() > 0 ? 'online' : 'connecting';
    if (left || next === status) return;
    status = next;
    if (next === 'online') {
      readyNow();
      announce();
    }
    room.onStatus?.(next);
  };

  let readyNow;
  const ready = new Promise((resolve, reject) => {
    readyNow = resolve;
    setTimeout(() => (status === 'online' ? resolve() : reject(new Error('no relay answered'))), readyMs);
  });
  ready.catch(() => {});

  const broadcast = (ev) => sub.send(JSON.stringify(['EVENT', ev]));

  // out with what's waiting (the newest pose and pointer only)
  const flush = async () => {
    timer = 0;
    if (!queue.length || left) return;
    lastFlush = Date.now();
    const out = [];
    const last = {};
    for (const m of queue.splice(0)) {
      if (latest.has(m[0])) last[m[0]] = m;
      else out.push(m);
    }
    out.push(...Object.values(last));
    // your cell, and the cell of each pilot a message is for (so it passes their filter)
    const g = new Set();
    for (const m of out) if (m[2] !== undefined && known.get(m[2])?.cell) g.add(known.get(m[2]).cell);
    if (cell) g.delete(cell);
    broadcast(await signAway(secretKey, self, { tags: [...ownTags(), ...[...g].map((t) => ['g', t])], content: JSON.stringify(out) }));
  };
  const post = (m) => {
    if (left) return;
    queue.push(m);
    if (queue.length > QUEUE_MAX) queue.splice(0, queue.length - QUEUE_MAX);
    if (!timer) timer = setTimeout(flush, Math.max(0, lastFlush + flushMs - Date.now()));
  };
  // here: so the pilots already in meet you straight away (and the
  // goodbye's signed now, ready for when you go)
  const announce = () => {
    post(['@join']);
    if (!bye) signBye();
  };
  // (signed again when your cell changes, so it passes the filters of those round you now;
  // only the newest signing is kept, whichever finishes first)
  let byes = 0;
  const signBye = () => {
    const n = ++byes;
    signAway(secretKey, self, { tags: ownTags(), content: JSON.stringify([['@bye']]) }).then((ev) => n === byes && (bye = ev));
  };

  // pilots not heard from in a while are forgotten (met again if they're back)
  const sweep = setInterval(() => {
    const t = Date.now();
    for (const [id, p] of known) if (t - p.heard > QUIET_MS) known.delete(id);
    for (const [id, at] of seen) if (t - at > QUIET_MS) seen.delete(id);
  }, QUIET_MS / 2);

  const room = {
    selfId: self,
    ready,
    onPeerJoin: null,
    onPeerLeave: null,
    onStatus: null,
    makeAction(ns) {
      const a = {
        onMessage: null,
        send(data, opts) {
          const to = opts?.target;
          post(to ? [ns, data, to] : [ns, data]);
          return Promise.resolve();
        },
      };
      actions[ns] = a;
      return a;
    },
    setCell(tag) {
      const next = typeof tag === 'string' && tag ? tag : null;
      if (left || next === cell) return;
      cell = next;
      if (byes) signBye();
    },
    setCells(next) {
      const g = next?.length ? [...next] : null;
      if (left || sameCells(listening(), g)) return;
      want = g;
      reask ||= setTimeout(() => {
        reask = 0;
        if (left || sameCells(asked, listening())) return;
        asked = listening();
        sub.refresh();
      }, 0);
    },
    stats: () => ({ offCell }),
    // the party's chat on the room's own key: a line sealed for each of `to`
    // (their ids) → the blobs; a mate's blobs opened → the line, or null.
    // Junk is null, never a throw (it may have come from anyone), and so is
    // anything asked once the room's left
    seal: (to, party, text) => (left ? Promise.resolve(null) : sealAway(secretKey, self, party, to, text).catch(() => null)),
    open: (from, party, blobs) => (left ? Promise.resolve(null) : openAway(secretKey, self, party, from, blobs).catch(() => null)),
    leave() {
      if (left) return Promise.resolve();
      left = true;
      clearTimeout(timer);
      clearTimeout(reask);
      clearInterval(sweep);
      if (bye) broadcast(bye);
      sub.close();
      known.clear();
      forgetPairs();
      return Promise.resolve();
    },
  };
  // (the pool's sockets may be open already, for another room: online at once)
  setStatus();
  return room;
}

// Ready once the roll-call's over: a tab already flying on the kept key
// answers within identity.js's ROLL_MS, and then this one is a guest, so
// whatever imports this module (the site's link, a world's, a Rush kitchen)
// joins its rooms on the right key.
await identity().ready;
