// The multiplayer link: everyone on the site who's gone online, in one
// room (nostr.js: public Nostr relays carry everything, so it works from
// any network, and no pilot sees another's IP address; the site is static,
// so there's no server of its own). It keeps who's here (their callsign,
// ship and what's fitted to it, kills, which page they're on, and whether you're
// allies), where each was last seen on the universe map, the shots they
// fire there, and their pointer on any other page, and sends yours. The scene (scene.js, pilots.js) reads poses and shots from it each
// frame, Presence.jsx the pointers; the page (useOnline.js, Online.jsx)
// shows the roster and what's happening. protocol.js has the wire and the
// rules for what's believed.
//
// Defences, since anyone can join with a client of their own: each pilot
// may send only so much of each kind of message (a flood gets them muted
// for the visit), hits must come from a shot aimed your way, kills are
// counted from what this browser saw (a shot or a hit just before, close
// by), not from what a pilot says of themselves, an alliance turned down
// can't be asked for again straight away, and anyone who goes quiet is
// dropped. A heartbeat keeps you on everyone's list while you sit still.
//
// Allies and blocks last (`allies`, allies.js's store, kept by the other
// pilot's key): a saved ally's first hello is answered with an ask that says
// you know them ({ t: 'ask', k: 1 }), and such an ask from a pilot you've
// saved is a yes without a word to you, so two allies are allies again a
// moment after both are online (and nobody's paid for it again: 'allied' is
// for an alliance newly made). Only an alliance made with the key you fly
// now is asked for like that (a guest tab's key, or a new identity, is one
// they don't know: those are asked for by hand). An alliance made is saved
// with the key you flew; a no or an end,
// theirs or yours, forgets it. A saved block holds from a pilot's first
// word (their row is listed, blocked, to be unblocked); a block or an
// unblock of yours is saved (and a block ends an alliance), while a flood's
// mute is for the visit: nothing's saved, no alliance ends, they're told
// nothing.
//
// The hunters after you are yours to fly (hunters.js), and the others see
// them: while someone's in the same place, where they are goes out a few
// times a second (pack), each pilot's come in as peer.hunters ({ at, list })
// for pilots.js to draw, and a bolt of someone else's into one of yours is
// told to you (hunterHit → a 'hunterHit' event, once it's checked: they'd
// just fired, and were close to it), so a friend can shoot one off your tail.
//
// createClient({ name, kind, loadout, build, looks, where, level, marks, allies }) → { selfId, factions, on(fn) → off, snapshot() (with `away`: the saved allies who aren't here, { id, name, seen }),
//   setProfile({ name, kind, loadout, build, looks, where, level, marks }) (level: the
//   wallet's; marks: its marks(), your standing and oath, read into factions
//   for the side of the ship you fly: relations.js's factionsFrom), pose(ship, { hidden, boost, safe,
//   shield, lane }), poseOf(peerId) (where they were last seen, for the roster), foot(crew | null) (your crew on foot, protocol.js's writeFoot;
//   each pilot's comes in as peer.foot, with `at`), walk(crew | null) (the
//   same down on a world in the galaxy: peer.walk), shot(at, v, weapon),
//   hit(peerId, damage), ram(peerId, into) (you flew into them, at that
//   closing speed), siege(msg) (the Citadel's siege, siege.js),
//   war(msg) (the galaxy's war: what the players have done, a tally.js
//   message), fight(msg) (the battle on where you are: its objectives' damage),
//   down(byId, rammed), cursor(x, y, touch), pack(get) (get() → hunters.js's wire(),
//   asked for only when it's time to send), hunterHit(peerId, hunterId,
//   damage), helped(peerId, what) (their shot took one of yours down),
//   ally(peerId, 'ask' | 'accept' | 'decline' | 'end'), block(peerId, on),
//   peers, takeShots(), leave() }
// Events, to on(fn): { type: 'status' }, { type: 'roster' }, { type: 'feed',
// text, tone }, { type: 'hit', from, damage }, { type: 'rammed', from, into,
// at } (they flew into you: the closing speed believed, and where they
// were), { type: 'downed', id, by }
// (someone was shot down: where they were, for the scene's pop; `by` is
// whoever this browser believes did it), { type: 'hunterHit', from, id,
// damage } (another pilot's bolt hit one of the hunters after you), { type:
// 'siege', from, msg } (another pilot's word on the Citadel's siege, read
// with siege.js's readSiege), { type: 'war', from, msg } (another pilot's
// word on the galaxy's war, from anywhere: tally.js's readTally), { type:
// 'fight', from, msg } (another pilot's on the battle where you are), {
// type: 'allied', id } (an alliance made with them).

import { readBuildWire, writeBuild } from '../shipyard/build';
import { EVERYONE, readLooks, writeLook } from '../../rickmorty/wardrobe/looks';
import { APP_ID, CURSOR_MS, DAMAGE, DAMAGE_MAX, FLAG, FOOT_MS, GUARD, PACK_MS, POSE_MS, PUNCH_MAX, ROOM, allyStep, cleanName, createLimiter, hitCounts, hunterHitCounts, readAlly, readCursor, readFoot, readHello, readHit, readHunterHit, readPack, readPose, readRam, readShot, ramCounts, writeCursor, writeFactions, writeFoot, writeLooksWire, writePack, writePose, writeShot, WALK_MS, readWalk, writeWalk } from './protocol';
import { UNIVERSE, isFlight, placeName } from './where';
import { STOCK_LOADOUT, readLoadout, writeOutfit } from '../outfit';
import { readSiege } from '../siege';
import { readTally } from '../tally';
import { NO_FACTIONS, factionsFrom } from './relations';
import { sideOf } from '../sides';

const SNAPS = 12; // poses kept per pilot
const SHOTS = 48; // shots waiting to be drawn, at most
const AIMS = 8; // each pilot's last shots, kept to check a hit against
const SHOT_GAP = 100; // ms between shots sent (the fastest guns, the X-wing's, fire every 120)
const PILOTS = 32; // pilots kept track of, at most (each one flying sends ten bundles a second)
const HEARTBEAT_MS = 15000; // a hello this often, so a pilot sitting still isn't dropped
const QUIET_MS = 45000; // nothing from a pilot this long: they're gone
const ALLY_AGAIN_MS = 60000; // after you turn someone down, how long before they may ask again
// your level as it goes out (the wallet's: 1 till it's loaded)
const levelOf = (lv) => (Number.isInteger(lv) && lv >= 1 ? lv : 1);
const loadRoom = () => import('./nostr').then((m) => ({ joinRoom: m.joinAsVisitor }));

export function createClient({ name, kind = null, loadout = STOCK_LOADOUT, build = null, looks = null, where = UNIVERSE, level = 1, marks = null, allies = null, load = loadRoom, now = () => performance.now() }) {
  const self = { id: null, name: cleanName(name) ?? 'Pilot', kind, loadout: readLoadout(loadout), build: build ? readBuildWire(writeBuild(build)) : null, looks: looks ? readLooks(looks) : null, kills: 0, where, level: levelOf(level), marks, factions: factionsFrom(sideOf(kind), marks) };
  const peers = new Map();
  const listeners = new Set();
  let status = 'connecting'; // connecting | online | failed | left
  let room = null;
  let send = null; // the actions, once the room's there
  let me = null; // where you are, while a hit on you can count
  let lastPose = -Infinity;
  let lastFoot = -Infinity;
  let footDown = false; // whether the last foot sent had your crew down
  let lastWalk = -Infinity;
  let walkDown = false; // and the last walk, down on a world in the galaxy
  let lastShot = -Infinity;
  let lastPack = -Infinity;
  let packSent = []; // the hunters last told of (a hit on one is checked against where it was)
  let lastCursor = -Infinity;
  let cursorLater = 0; // the last pointer of a quick move, sent once the gap's up
  let heartbeat = 0;
  let shots = [];

  const emit = (e) => {
    for (const fn of listeners) fn(e);
  };
  const roster = () => emit({ type: 'roster' });
  const feed = (text, tone = 'info') => emit({ type: 'feed', text, tone });
  // (the saved allies changed, here or in another tab: the roster's away list with them)
  const offAllies = allies?.on(roster) ?? null;
  const savedName = (id) => allies?.allies().find((a) => a.id === id)?.name ?? null;
  // (a saved alliance made with the key you fly now: one made with another, a
  // guest tab's or yours before a new identity, they can't know you by)
  const madeWithMe = (id) => {
    const as = allies?.madeAs?.(id) ?? null;
    return !as || as === (self.id ?? '').slice(0, 16);
  };
  const hello = () => {
    const f = writeFactions(self.factions);
    return { n: self.name, k: self.kind, p: self.loadout.paint, o: writeOutfit(self.loadout), ...(self.build ? { b: writeBuild(self.build) } : {}), ...writeLooksWire(self.looks), c: self.kills, w: self.where, lv: self.level, ...(f ? { f } : {}) };
  };
  const same = (a, b) => Object.keys(STOCK_LOADOUT).every((slot) => a[slot] === b[slot]);
  const sameBuild = (a, b) => (a ? writeBuild(a).join() : '') === (b ? writeBuild(b).join() : '');
  const factionsKey = (f) => JSON.stringify(writeFactions(f));
  const looksKey = (l) => (l ? JSON.stringify(EVERYONE.map((who) => (l[who] ? writeLook(l[who]) : null))) : ''); // (a peer’s may have one cast’s and not the other’s)

  const peerOf = (id) => {
    let p = peers.get(id);
    if (!p && peers.size < PILOTS) {
      const blocked = Boolean(allies?.isBlocked(id)); // (a saved block holds from their first word)
      p = {
        id,
        name: blocked ? '' : null, // (a blocked pilot's hello isn't read: listed nameless, to be unblocked)
        kind: null,
        loadout: STOCK_LOADOUT,
        build: null, // the garage build they fly, or null: their stock ship
        looks: null, // how they dress their Rick and Morty, their Walt and Jesse (the wardrobe’s), or null: as the show has them
        kills: 0, // the ones this browser saw
        where: null,
        level: 1, // (theirs, as they say: it only labels them)
        factions: NO_FACTIONS,
        ally: 'none',
        blocked,
        snaps: [],
        pose: null,
        foot: null, // their crew on foot, while they're down on a planet
        walk: null, // and down on a world in the galaxy
        hunters: null, // the hunters after them: { at, list } (protocol.js's readPack)
        cur: null,
        shots: [], // their last few, for checking a hit on you
        shotAt: -Infinity,
        hitAt: -Infinity, // their last hit on you that counted
        hitByMeAt: -Infinity, // your last hit on them
        ramAt: -Infinity, // their last ram on you that counted
        rammedByMeAt: -Infinity, // your last ram on them
        declinedAt: -Infinity,
        seen: now(),
        limit: createLimiter(),
      };
      peers.set(id, p);
    }
    return p ?? null;
  };

  const setAlly = (p, event) => {
    const was = p.ally;
    const { state, send: say } = allyStep(was, event);
    const known = Boolean(allies?.isAlly(p.id)); // (saved before now: an alliance made long ago)
    p.ally = state;
    // (an ask to a saved ally says you know them)
    if (say) send?.ally(say === 'ask' && known ? { t: say, k: 1 } : { t: say }, p.id);
    if (event === 'decline') p.declinedAt = now();
    // kept: an alliance made is saved; a no or an end, theirs or yours, forgets it
    const said = typeof event === 'object' ? event.in : event;
    if (state === 'ally' && was !== 'ally') allies?.saveAlly(p.id, p.name, self.id);
    else if (state === 'none' && (said === 'no' || said === 'end')) allies?.dropAlly(p.id);
    if (state === was) return;
    const who = p.name ?? savedName(p.id) ?? 'Someone';
    if (state === 'got') feed(`${who} wants to be allies`, 'ally');
    else if (state === 'ally' && known) feed(`You and ${who} are allies again`, 'ally');
    else if (state === 'ally') {
      feed(`You and ${who} are allies`, 'ally');
      emit({ type: 'allied', id: p.id }); // (the page pays for it: economy.js's allyMade)
    }
    else if (state === 'none' && was === 'ally') feed(typeof event === 'object' ? `${who} ended your alliance` : `You ended your alliance with ${who}`, 'info');
    else if (state === 'none' && was === 'sent' && typeof event === 'object') feed(`${who} turned down the alliance`, 'info');
    roster();
  };

  // (a block ends an alliance; a flood's mute, `muted`, is for the visit: the alliance stands, and they're told nothing)
  const block = (p, on, muted = false) => {
    if (on && !muted && p.ally !== 'none') setAlly(p, p.ally === 'got' ? 'decline' : 'end');
    p.blocked = on;
    p.snaps.length = 0;
    p.pose = null;
    p.foot = null;
    p.walk = null;
    p.hunters = null;
    p.cur = null;
    p.shots.length = 0;
    roster();
  };

  // A message from a pilot, let in or not: known (or, for a hello, new), not
  // blocked, and within what they may send. Too much, and they're muted.
  const admit = (kind, id, create = false) => {
    const p = create ? peerOf(id) : peers.get(id);
    if (!p) return null;
    const t = now();
    p.seen = t;
    if (p.blocked) return null;
    if (p.limit.allow(kind, t)) return p;
    if (p.limit.flooding(t)) {
      block(p, true, true);
      feed(`Muted ${p.name ?? 'a pilot'}: too many messages`, 'info');
    }
    return null;
  };

  // a pilot gone: a saved ally's last seen is now
  const gone = (p) => {
    peers.delete(p.id);
    if (allies?.isAlly(p.id)) allies.seenAlly(p.id, p.name);
    if (p.name && !p.blocked) feed(`${p.name} went offline`, 'info');
    roster();
  };
  // anyone gone quiet is gone (a missed goodbye, or a tab that froze)
  const sweep = () => {
    const t = now();
    for (const p of [...peers.values()]) if (t - p.seen > QUIET_MS) gone(p);
  };

  const near = (a, b) => Boolean(a && b) && Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) <= GUARD.range * 1.5;

  const wire = (r, selfId) => {
    self.id = selfId;
    const action = (ns) => r.makeAction(ns);
    const hi = action('hi');
    const pose = action('pose');
    const foot = action('foot');
    const walk = action('walk');
    const shot = action('shot');
    const hit = action('hit');
    const ram = action('ram');
    const down = action('down');
    const ally = action('ally');
    const cur = action('cur');
    const pack = action('pack');
    const hhit = action('hhit');
    const siege = action('siege');
    const war = action('war');
    const fight = action('fight');
    send = {
      pack: (data) => pack.send(data).catch(() => {}),
      hhit: (data, to) => hhit.send(data, { target: to }).catch(() => {}),
      hi: (data, to) => hi.send(data, to ? { target: to } : undefined).catch(() => {}),
      pose: (data) => pose.send(data).catch(() => {}),
      foot: (data) => foot.send(data).catch(() => {}),
      walk: (data) => walk.send(data).catch(() => {}),
      shot: (data) => shot.send(data).catch(() => {}),
      hit: (data, to) => hit.send(data, { target: to }).catch(() => {}),
      ram: (data, to) => ram.send(data, { target: to }).catch(() => {}),
      down: (data) => down.send(data).catch(() => {}),
      ally: (data, to) => ally.send(data, { target: to }).catch(() => {}),
      cur: (data) => cur.send(data).catch(() => {}),
      siege: (data) => siege.send(data).catch(() => {}),
      war: (data) => war.send(data).catch(() => {}),
      fight: (data) => fight.send(data).catch(() => {}),
    };

    r.onPeerJoin = (id) => {
      if (!peerOf(id)) return;
      send.hi(hello(), id);
    };
    r.onPeerLeave = (id) => {
      const p = peers.get(id);
      if (p) gone(p);
    };

    hi.onMessage = (data, { peerId }) => {
      const h = readHello(data);
      const p = h && admit('hi', peerId, true);
      if (!p) return;
      const first = p.name === null;
      const was = p.where;
      const changed = first || p.name !== h.name || p.kind !== h.kind || !same(p.loadout, h.loadout) || !sameBuild(p.build, h.build) || looksKey(p.looks) !== looksKey(h.looks) || p.where !== h.where || p.level !== h.level || factionsKey(p.factions) !== factionsKey(h.factions);
      // (their own count of their kills isn't taken: p.kills is what this browser saw)
      p.name = h.name;
      p.kind = h.kind;
      p.loadout = h.loadout;
      p.build = h.build;
      p.looks = h.looks;
      p.where = h.where;
      p.level = h.level;
      p.factions = h.factions;
      if (was !== p.where) p.cur = null; // (a pointer is only good on the page it was on)
      if (first) feed(`${p.name} came online`, 'join');
      else if (was !== p.where) {
        // coming to your page, or leaving it
        if (p.where === self.where) feed(`${p.name} is here`, 'join');
        else if (was === self.where) feed(`${p.name} went to ${placeName(p.where)}`, 'info');
      }
      // a saved ally back: seen now, and asked again (an ask that says you
      // know them), if it's from the key they know you by
      if (first && allies?.isAlly(peerId)) {
        allies.seenAlly(peerId, p.name);
        if (p.ally === 'none' && madeWithMe(peerId)) setAlly(p, 'ask');
      }
      if (changed) roster();
    };
    pose.onMessage = (data, { peerId }) => {
      const s = readPose(data);
      const p = s && admit('pose', peerId);
      if (!p) return;
      s.at = now();
      p.pose = s;
      p.snaps.push(s);
      if (p.snaps.length > SNAPS) p.snaps.shift();
    };
    foot.onMessage = (data, { peerId }) => {
      const f = readFoot(data);
      const p = f && admit('foot', peerId);
      if (!p) return;
      p.foot = f.off ? null : { ...f, at: now() };
    };
    walk.onMessage = (data, { peerId }) => {
      const w = readWalk(data);
      const p = w && admit('walk', peerId);
      if (!p) return;
      p.walk = w.off ? null : { ...w, at: now() };
    };
    siege.onMessage = (data, { peerId }) => {
      const msg = readSiege(data);
      const p = msg && admit('siege', peerId);
      // (only from someone on the universe map, where the Citadel is)
      if (!p || p.where !== self.where) return;
      emit({ type: 'siege', from: peerId, msg });
    };
    // the galaxy's war is everyone's, wherever they are; a battle only theirs who're in it
    war.onMessage = (data, { peerId }) => {
      const msg = readTally(data);
      const p = msg && admit('war', peerId);
      if (p) emit({ type: 'war', from: peerId, msg });
    };
    fight.onMessage = (data, { peerId }) => {
      const msg = readTally(data);
      const p = msg && admit('fight', peerId);
      if (!p || p.where !== self.where) return;
      emit({ type: 'fight', from: peerId, msg });
    };
    shot.onMessage = (data, { peerId }) => {
      const known = peers.get(peerId);
      const s = known && readShot(data, known.pose);
      const p = s && admit('shot', peerId);
      if (!p) return;
      const t = now();
      p.shotAt = t;
      p.shots.push({ p: s.p, v: s.v, at: t });
      if (p.shots.length > AIMS) p.shots.shift();
      shots.push({ id: peerId, kind: p.kind, paint: p.loadout.paint, guns: p.loadout.guns, ...s });
      if (shots.length > SHOTS) shots.shift();
    };
    hit.onMessage = (data, { peerId }) => {
      const d = readHit(data);
      const p = d && admit('hit', peerId);
      const t = now();
      // (from someone in the same place: the same numbers in another of the
      // galaxy's systems, or on the universe map, are somewhere else entirely)
      if (!p || p.where !== self.where || !hitCounts(p, me, t)) return;
      p.hitAt = t;
      emit({ type: 'hit', from: peerId, damage: d });
    };
    ram.onMessage = (data, { peerId }) => {
      const v = readRam(data);
      const p = v !== null && admit('ram', peerId);
      const t = now();
      if (!p || p.where !== self.where) return;
      const into = ramCounts(p, me, v, t);
      if (into === null) return;
      p.ramAt = t;
      p.hitAt = t; // (shot down by it, it's theirs: down's `by`)
      emit({ type: 'rammed', from: peerId, into, at: p.pose });
    };
    pack.onMessage = (data, { peerId }) => {
      const list = readPack(data);
      const p = list && admit('pack', peerId);
      if (!p) return;
      p.hunters = list.length ? { at: now(), list } : null;
    };
    hhit.onMessage = (data, { peerId }) => {
      const h = readHunterHit(data);
      const p = h && admit('hhit', peerId);
      const t = now();
      if (!p || p.where !== self.where) return;
      const mine = packSent.find((o) => o[0] === h.id);
      if (!mine || !hunterHitCounts(p, { x: mine[2], y: mine[3], z: mine[4] }, t)) return;
      emit({ type: 'hunterHit', from: peerId, id: h.id, damage: h.damage });
    };
    down.onMessage = (data, { peerId }) => {
      const p = data && typeof data === 'object' && admit('down', peerId);
      if (!p) return;
      p.hunters = null; // (they left with them)
      const said = typeof data.b === 'string' && data.b.length <= 64 ? data.b : null;
      const t = now();
      let by = null;
      if (said && said === self.id) {
        // yours, if you'd just hit them
        if (t - Math.max(p.hitByMeAt, p.rammedByMeAt) <= GUARD.killWindow) {
          by = said;
          self.kills += 1;
          feed(p.rammedByMeAt >= p.hitByMeAt ? `You rammed ${p.name ?? 'someone'} out of the sky` : `You shot down ${p.name ?? 'someone'}`, 'kill');
        }
      } else if (said) {
        // someone else's, if they'd just fired and were close by
        const q = peers.get(said);
        if (q && !q.blocked && t - q.shotAt <= GUARD.killWindow && near(q.pose, p.pose)) {
          by = said;
          q.kills += 1;
          feed(`${q.name ?? 'Someone'} shot down ${p.name ?? 'someone'}`, 'kill');
        }
      }
      if (by) roster();
      emit({ type: 'downed', id: peerId, by, at: p.pose });
      p.snaps.length = 0; // they're gone till they're back
    };
    cur.onMessage = (data, { peerId }) => {
      const c = readCursor(data);
      const p = c && admit('cur', peerId);
      if (!p || isFlight(p.where)) return;
      c.at = now();
      p.cur = c;
    };
    ally.onMessage = (data, { peerId }) => {
      const a = readAlly(data);
      const p = a && admit('ally', peerId);
      if (!p) return;
      // turned down a moment ago: not again yet
      if (a.t === 'ask' && p.ally === 'none' && now() - p.declinedAt < ALLY_AGAIN_MS) {
        send.ally({ t: 'no' }, p.id);
        return;
      }
      // a saved ally asking again, who has you saved too: yes, without asking you
      if (a.t === 'ask' && a.k && allies?.isAlly(p.id) && (p.ally === 'none' || p.ally === 'got')) {
        p.ally = 'got';
        setAlly(p, 'accept');
        return;
      }
      setAlly(p, { in: a.t });
    };

    heartbeat = setInterval(() => {
      send?.hi(hello());
      sweep();
    }, HEARTBEAT_MS);
  };

  const setStatus = (s) => {
    if (status === 'left' || status === s) return;
    status = s;
    emit({ type: 'status' });
  };
  const failed = (err) => {
    if (import.meta.env?.DEV && import.meta.env?.MODE !== 'test') console.error('[online]', err);
    setStatus('failed');
  };

  // into the room (three.js-free, but still a download: only once asked):
  // online once a relay's listening (failed if none answer), and back to
  // connecting while they're all out of reach
  load()
    .then(({ joinRoom, selfId }) => {
      if (status === 'left') return;
      room = joinRoom({ appId: APP_ID }, ROOM);
      wire(room, room.selfId ?? selfId);
      room.onStatus = setStatus;
      if (room.ready) room.ready.then(() => setStatus('online'), failed);
      else setStatus('online');
    })
    .catch(failed);

  return {
    get selfId() {
      return self.id;
    },
    // yours, as the hello says them (for the tags' colours: pilots.js)
    get factions() {
      return self.factions;
    },
    peers,
    on(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    // for the page: who's here, as plain data
    snapshot() {
      const list = [];
      for (const p of peers.values()) if (p.name !== null) list.push({ id: p.id, name: p.name, kind: p.kind, loadout: p.loadout, build: p.build, looks: p.looks, kills: p.kills, where: p.where, level: p.level, factions: p.factions, ally: p.ally, blocked: p.blocked });
      list.sort((a, b) => a.name.localeCompare(b.name));
      // (saved allies who aren't here, newest seen first)
      const away = (allies?.allies() ?? []).filter((a) => !peers.get(a.id)?.name).map(({ id, name, seen }) => ({ id, name, seen }));
      return { status, self: { name: self.name, kind: self.kind, loadout: self.loadout, kills: self.kills, where: self.where, level: self.level, factions: self.factions }, peers: list, away };
    },
    setProfile({ name: n = self.name, kind: k = self.kind, loadout: l = self.loadout, build: b = self.build, looks: lk = self.looks, where: w = self.where, level: lv = self.level, marks: m = self.marks } = {}) {
      const clean = cleanName(n) ?? self.name;
      const fit = readLoadout(l);
      const hull = b ? readBuildWire(writeBuild(b)) : null;
      const dressed = lk ? readLooks(lk) : null;
      const level = levelOf(lv);
      const factions = factionsFrom(sideOf(k), m);
      self.marks = m;
      if (clean === self.name && k === self.kind && same(fit, self.loadout) && sameBuild(hull, self.build) && looksKey(dressed) === looksKey(self.looks) && w === self.where && level === self.level && factionsKey(factions) === factionsKey(self.factions)) return;
      self.level = level;
      self.factions = factions;
      self.looks = dressed;
      self.name = clean;
      self.kind = k;
      self.loadout = fit;
      self.build = hull;
      self.where = w;
      if (!k) me = null;
      send?.hi(hello());
      roster();
    },
    // where your ship is, each frame (sent ten times a second). Hidden
    // (crashed, shot down, diving into a page) or safe (just back), hits
    // on you don't count (`lane` is kept for the protocol: the hyperlanes
    // went, and nothing sets it now)
    pose(s, { hidden = false, boost = false, safe = false, shield = 100, lane = false } = {}) {
      me = hidden || safe || !s ? null : s;
      const t = now();
      if (!send || !s || t - lastPose < POSE_MS) return;
      lastPose = t;
      send.pose(writePose(s, (hidden ? FLAG.hidden : 0) | (boost ? FLAG.boost : 0) | (safe ? FLAG.safe : 0) | (lane ? FLAG.lane : 0), shield));
    },
    // where a pilot was last seen on the universe map: { x, y, z }, or null
    // (not seen there yet, or gone)
    poseOf(id) {
      const p = peers.get(id)?.pose;
      return p ? { x: p.x, y: p.y, z: p.z, ...(p.sec ? { sec: p.sec } : {}) } : null;
    },
    // the hunters after you, for the others to see: get() gives them
    // (hunters.js's wire()), asked for only when it's time to send (five
    // times a second, while someone's in the same place to see them; once
    // more, empty, when they're gone or there's no one left to tell)
    pack(get) {
      const t = now();
      if (!send || t - lastPack < PACK_MS) return;
      let company = false;
      for (const p of peers.values()) if (!p.blocked && p.where === self.where) company = true;
      const list = company && isFlight(self.where) ? get() : [];
      if (!list.length && !packSent.length) return;
      lastPack = t;
      packSent = writePack(list);
      send.pack(packSent);
    },
    // a bolt of yours hit one of the hunters after them: tell them (it's
    // theirs to take the hit off)
    hunterHit(id, hunter, damage = 1) {
      const p = peers.get(id);
      if (!send || !p || p.blocked) return;
      send.hhit({ i: hunter, d: Math.min(PUNCH_MAX, Math.max(1, Math.round(damage))) }, id);
    },
    // their shot took down one of the hunters after you (`what`: its name)
    helped(id, what) {
      const p = peers.get(id);
      if (p && !p.blocked) feed(`${p.name ?? 'Someone'} shot down a ${what} that was after you`, 'ally');
    },
    // your crew on foot, each frame while they're down (sent ten times a
    // second), and null once they're back in (sent once)
    foot(crew) {
      const t = now();
      if (!send) return;
      if (!crew) {
        if (footDown) send.foot(writeFoot(null));
        footDown = false;
        return;
      }
      if (t - lastFoot < FOOT_MS) return;
      lastFoot = t;
      footDown = true;
      send.foot(writeFoot(crew));
    },
    // your crew down on a world in the galaxy (protocol.js's writeWalk),
    // each frame while they're there, and null once you've taken off
    walk(crew) {
      const t = now();
      if (!send) return;
      if (!crew) {
        if (walkDown) send.walk(writeWalk(null));
        walkDown = false;
        return;
      }
      if (t - lastWalk < WALK_MS) return;
      lastWalk = t;
      walkDown = true;
      send.walk(writeWalk(crew));
    },
    shot(at, v, weapon = 0) {
      const t = now();
      // (a heavy round always goes: there are few of them, and they matter)
      if (!send || (t - lastShot < SHOT_GAP && weapon !== 2)) return;
      lastShot = t;
      send.shot(writeShot(at, v, weapon));
    },
    // your word on the Citadel's siege (siege.js's message())
    siege(msg) {
      send?.siege(msg);
    },
    // your word on the galaxy's war, and on the battle where you are (tally.js's message())
    war(msg) {
      send?.war(msg);
    },
    fight(msg) {
      send?.fight(msg);
    },
    // your pointer, off the universe map (x from the middle of the window,
    // y down the page, in px; with touch, where you're reading)
    cursor(x, y, touch = false) {
      if (!send || isFlight(self.where)) return;
      clearTimeout(cursorLater);
      const wait = lastCursor + CURSOR_MS - now();
      if (wait > 0) {
        cursorLater = setTimeout(() => this.cursor(x, y, touch), wait);
        return;
      }
      lastCursor = now();
      send.cur(writeCursor(x, y, touch));
    },
    // a bolt of yours hit them: tell them (they take it off their own shields)
    hit(id, damage = DAMAGE) {
      const p = peers.get(id);
      if (!send || !p || p.blocked || p.ally === 'ally') return;
      p.hitByMeAt = now();
      send.hit({ d: Math.min(DAMAGE_MAX, Math.max(1, Math.round(damage))) }, id);
    },
    // you flew into them: tell them (they take it off their own shields, as
    // hard as they believe it: protocol.js's ramCounts)
    ram(id, into) {
      const p = peers.get(id);
      if (!send || !p || p.blocked || p.ally === 'ally') return;
      p.rammedByMeAt = now();
      send.ram({ v: Math.round(Math.max(0, into) * 100) / 100 }, id);
    },
    // your shields are gone: everyone hears who did it (a pilot whose hit
    // on you counted, so it's theirs on your list too); `rammed`: it was
    // their ram, not a shot
    down(by, rammed = false) {
      send?.down({ b: by ?? null });
      const p = by ? peers.get(by) : null;
      if (!p) return;
      p.kills += 1;
      feed(rammed ? `${p.name ?? 'Someone'} rammed you out of the sky` : `${p.name ?? 'Someone'} shot you down`, 'kill');
      roster();
    },
    ally(id, what) {
      const p = peers.get(id);
      if (p && !p.blocked && send) setAlly(p, what);
    },
    // a block of yours, saved (and an unblock): a flood's mute isn't
    block(id, on = true) {
      const p = peers.get(id);
      if (on) allies?.block(id, p?.name || null);
      else allies?.unblock(id);
      if (p) block(p, on);
    },
    // the shots that came in since last asked
    takeShots() {
      if (!shots.length) return shots;
      const out = shots;
      shots = [];
      return out;
    },
    leave() {
      status = 'left';
      clearTimeout(cursorLater);
      clearInterval(heartbeat);
      offAllies?.();
      // (the saved allies here were last seen now)
      for (const p of peers.values()) if (allies?.isAlly(p.id)) allies.seenAlly(p.id, p.name);
      listeners.clear();
      peers.clear();
      shots = [];
      room?.leave().catch(() => {});
      room = null;
      send = null;
    },
  };
}
