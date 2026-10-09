// A squad's link: its pilots in a room of their own on the relays (nostr.js's,
// app APP_ID, the room invite.js's roomOf names), everything said there
// sealed under a key from the sid (chat/seal.js's, info 'tp-squad-room'): the
// relays carry a topic and ciphertext, and only a pilot with the sid can say
// anything in it. Each message is one action, `z`, the sealed JSON of [kind,
// data]: the rules' doc, hi and bye (squadRules.js), and pg, qc and ch.
// Loaded once you're online, as client.js is, and kept apart from it.
//
// Each pilot's messages are opened in the order they came; what won't open
// is dropped, as is anything past what a pilot may send (RATES: z for every
// message, before it's opened, then its kind's own). PILOTS are kept track
// of, a new one making room by forgetting whoever was heard least lately and
// isn't seated. The rules tick twice a second; a hello goes when the room is
// online and every SQUAD.helloMs after (seekMs till seated). A ping (pg,
// onPing(ping, from)), a phrase (qc, onQuick(i, from)) and a line (ch, { t },
// onText(text, from), cleaned by the sender and by each reader) are heard only
// from pilots seated in the document you hold, and not one you've blocked;
// ping(), quick() and text() say whether it went (only while seated, and no
// faster than the others take them).
//
// `via`: asked in from the roster, the inviter (client.js's invite event's
// `from`). `keep(doc)` is handed the document as it changes while you're
// seated (null once it's over), for the page to keep with the sid; handed
// back as `saved`, the squad's picked up from it (squadRules.js's resume).
//
// What the page calls when: leave() when the pilot leaves (their own document
// without them, then goodbye); close() once it's done with it, the page
// closing or reloading (no word: the seat's held) or the squad over. It's
// over at status 'left' (left, turned out, not let in, or the squad gone:
// view().why says which; asking in again is a new one), or 'failed' (no relay
// answered in time: nothing more runs; a new one, handed `saved`, tries again).
//
// createSquad({ sid, lead, via, card, load, now, blocked, saved, keep }) →
// { status ('connecting' | 'online' | 'failed' | 'left'), selfId, view()
// (squadRules.js's), on(fn) → off (fn({ type: 'squad' }) on any change of
// view() or status), leave(), close(), kick(id), lock(yes), rally({ w, p } |
// null), open(yes), lobby(lobby | null), instance(i | null), ping(p),
// quick(i), text(s), onPing, onQuick, onText }. `card()` gives your hello:
// { name, kind, where, shield, level, ready }.

import { SQUAD, joining, newSquad, readCard, resume, squadStep, view, writeCard, writeState } from './squadRules';
import { roomOf } from './invite';
import { createLimiter } from '../protocol';
import { readPing, readQuick, writePing } from '../wire2';
import { CHAT, cleanText } from '../chat/text';
import { seal, sealKey, unseal } from '../chat/seal';

export const APP_ID = 'tilakpatel-portfolio-squad';
const SEALED = 12000; // base64 characters of a sealed message, at most
const TICK_MS = 500; // (a hello till seated goes every SQUAD.seekMs, 1.5 s)
const BYE_MS = 500; // a goodbye goes in the room's next bundle: the room's left after it
const PILOTS = 32; // pilots in the room kept track of, at most
const KINDS = new Set(['doc', 'hi', 'bye', 'pg', 'qc', 'ch']);
// how many one pilot may send: [a second, at most at once] (z: every message, before it's opened)
const RATES = { z: [6, 20], doc: [2, 8], hi: [2, 6], bye: [0.2, 2], pg: [1, 3], qc: [1, 3], ch: [0.5, 3] };
const loadRoom = () => import('../nostr').then((m) => m.joinAsVisitor);

export function createSquad({ sid, lead = false, via = null, card = () => null, load = loadRoom, now = () => Date.now(), blocked = () => false, saved = null, keep = null }) {
  const listeners = new Set();
  const pilots = new Map(); // pilot → { limit, at (last heard), opening (their messages, opened in order) }
  let status = 'connecting';
  let room = null;
  let z = null; // the room's one action
  let key = null; // the room's key, from the sid
  let me = null;
  let state = null;
  let shown = ''; // the view last told of
  let kept; // the document last handed to keep (undefined: none yet)
  let hiAt = -Infinity;
  let timer = 0;
  let sending = Promise.resolve(); // your messages, sealed and sent in order
  let docOut = null; // a document waiting to be sealed (only the newest goes)
  const mine = createLimiter(RATES); // your own words: never more than the others take

  const changed = () => {
    const next = JSON.stringify([status, state && view(state, now())]);
    if (next === shown) return;
    shown = next;
    for (const fn of [...listeners]) fn({ type: 'squad' });
  };
  // what the page keeps for a reload: the document while you're seated, and null once it's over
  const remember = () => {
    if (!keep || !state) return;
    const doc = state.gone || !state.members.includes(me) ? null : writeState(state);
    const next = JSON.stringify(doc);
    if (next === kept) return;
    kept = next;
    keep(doc);
  };
  const setStatus = (s) => {
    if (status === 'left' || status === 'failed' || status === s) return;
    status = s;
    changed();
  };
  // no relay answered in time: nothing more runs, and the room's left (it never was online)
  const failed = () => {
    clearInterval(timer);
    room?.leave();
    setStatus('failed');
  };
  // over (left, turned out, full, gone): no more ticks, and out of the room once a goodbye's had time to go
  const over = () => {
    clearInterval(timer);
    status = 'left';
    const r = room;
    sending.then(() => setTimeout(() => r?.leave(), BYE_MS));
  };
  // a message out, sealed, after those before it
  const send = (kind, data) => {
    if (kind === 'doc') {
      const waiting = docOut !== null;
      docOut = data;
      if (waiting) return;
    }
    sending = sending
      .then(() => {
        const out = kind === 'doc' ? docOut : data;
        if (kind === 'doc') docOut = null;
        return seal(key, JSON.stringify([kind, out]), SEALED);
      })
      .then((sealed) => z.send(sealed))
      .catch(() => {});
  };
  const step = (event) => {
    if (!state) return;
    const was = state.gone;
    const { state: next, send: out } = squadStep(state, event, now());
    state = next;
    for (const [kind, data] of out) send(kind, data);
    remember();
    if (state.gone && !was) over();
    changed();
  };
  // a pilot heard: their entry (a full table forgets the one heard least lately who isn't seated)
  const pilot = (id) => {
    let p = pilots.get(id);
    if (!p) {
      if (pilots.size >= PILOTS) {
        let old = null;
        for (const [k, v] of pilots) if (!state?.members.includes(k) && (old === null || v.at < pilots.get(old).at)) old = k;
        pilots.delete(old);
      }
      pilots.set(id, (p = { limit: createLimiter(RATES), at: now(), opening: Promise.resolve() }));
    }
    p.at = now();
    return p;
  };
  const allow = (id, kind) => pilot(id).limit.allow(kind, now());
  // your hello, into the rules, which send it on naming whom you've heard
  const hello = () => {
    hiAt = now();
    step({ type: 'hello', from: me, card: readCard(writeCard(card())) });
  };
  const tick = () => {
    if (status !== 'online' || !state || state.gone) return;
    step({ type: 'tick' });
    if (!state.gone && now() - hiAt >= (state.members.includes(me) ? SQUAD.helloMs : SQUAD.seekMs)) hello();
  };
  // you seated, online: only then do you say anything or hear anyone, and
  // then only a member seated now whom you haven't blocked
  const seated = () => status === 'online' && Boolean(state) && !state.gone && state.members.includes(me);
  const heard = (id) => seated() && id !== me && state.members.includes(id) && !blocked(id);
  // may you say this now: seated, and no faster than the others take it
  const may = (kind) => seated() && mine.allow(kind, now());

  // a message opened: what it is, if it's anything
  const read = (from, text) => {
    if (text === null || status === 'left' || !state) return;
    let kind;
    let data;
    try {
      [kind, data] = JSON.parse(text);
    } catch {
      return;
    }
    if (!KINDS.has(kind) || !allow(from, kind)) return;
    if (kind === 'hi') {
      const c = readCard(data);
      if (c) step({ type: 'hello', from, card: c, blocked: Boolean(blocked(from)) });
    } else if (kind === 'doc') step({ type: 'doc', from, wire: data });
    else if (kind === 'bye') step({ type: 'bye', from });
    else if (heard(from)) {
      if (kind === 'pg') {
        const ping = readPing(data);
        if (ping) api.onPing?.(ping, from);
      } else if (kind === 'qc') {
        const i = readQuick(data);
        if (i !== null) api.onQuick?.(i, from);
      } else {
        const t = cleanText(data?.t, CHAT.squadMax);
        if (t) api.onText?.(t, from);
      }
    }
  };
  // a sealed message in: counted, then opened after the pilot's others
  const arrive = (data, { peerId }) => {
    if (status === 'left' || !allow(peerId, 'z')) return;
    const p = pilots.get(peerId);
    p.opening = p.opening.then(() => unseal(key, data, SEALED)).then((text) => read(peerId, text), () => {});
  };

  const api = {
    get status() {
      return status;
    },
    get selfId() {
      return me;
    },
    view: () => (state ? view(state, now()) : { sid, leader: null, mine: null, members: [], open: false, rally: null, lobby: null, instance: null, locked: false, gone: status === 'left', why: null }),
    on(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    // out of the squad: your own document without you, then goodbye (nothing kept for a reload)
    leave() {
      if (state && !state.gone) return step({ type: 'leave' });
      if (status !== 'left') over();
      if (keep && kept !== 'null') {
        kept = 'null';
        keep(null);
      }
    },
    // off the relays without a word (a page closing or reloading: the seat's held)
    close() {
      clearInterval(timer);
      status = 'left';
      room?.leave();
      listeners.clear();
    },
    kick: (id) => step({ type: 'kick', id }),
    lock: (yes) => step({ type: 'lock', locked: Boolean(yes) }),
    rally: (rally) => step({ type: 'rally', rally }),
    open: (yes) => step({ type: 'open', open: Boolean(yes) }),
    lobby: (lobby) => step({ type: 'lobby', lobby }),
    instance: (i) => step({ type: 'instance', instance: i }),
    // a ping: { kind ('go', 'help', 'foe', 'look'), where, p ([x, y, z] or none), target }
    ping(p) {
      const data = writePing(p);
      if (!data || !may('pg')) return false;
      send('pg', data);
      return true;
    },
    quick(i) {
      if (readQuick(i) === null || !may('qc')) return false;
      send('qc', i);
      return true;
    },
    text(s) {
      const t = cleanText(s, CHAT.squadMax);
      if (!t || !may('ch')) return false;
      send('ch', { t });
      return true;
    },
    onPing: null,
    onQuick: null,
    onText: null,
  };

  Promise.all([load(), roomOf(sid), sealKey(sid, 'tp-squad-room')])
    .then(([joinRoom, name, k]) => {
      if (status === 'left') return;
      key = k;
      room = joinRoom({ appId: APP_ID, cheap: new Set() }, name);
      me = room.selfId;
      z = room.makeAction('z');
      z.onMessage = arrive;
      // online: the first time, the squad begins (led, picked up, or asked into: its clocks start
      // now, not while the relays were slow to answer); every time, a hello at once
      const online = () => {
        if (status === 'online' || status === 'left' || status === 'failed') return;
        if (!state) {
          const t = now();
          state = lead ? newSquad(sid, me, t) : saved ? resume(sid, me, saved, t) : joining(sid, me, t, via);
          // (picked up from a document that had turned you out)
          if (state.gone) {
            over();
            return changed();
          }
        }
        setStatus('online');
        if (!state.gone) hello();
        remember();
      };
      room.onStatus = (s) => (s === 'online' ? online() : setStatus('connecting'));
      if (room.ready) room.ready.then(online, failed);
      else online();
      timer = setInterval(tick, TICK_MS);
      changed();
    })
    .catch(failed);

  return api;
}
