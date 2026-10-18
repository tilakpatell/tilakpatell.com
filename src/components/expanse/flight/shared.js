// The shared world over a planet: the other pilots and what everyone has
// built. Two paths that never mix (the spec's Pillar 3): the room
// (./online.js, Nostr, by cell) carries what dies in a second, poses and
// shots and the hints; the durable world (lib/durable's loader, Supabase)
// carries what is built and its health. A turret you build goes to the
// database first, then a `built` hint names its cell so the pilots near you
// ask for that cell now (realtime is the backstop for anyone whose relay
// missed it); a hint is never believed as the thing.
//
// Every client runs every turret it holds against the ships it sees, its
// own included: a turret's bolt at your ship is yours to take (your shield,
// then back up you go), your bolt on a turret is a hit the database counts
// (damage_entity), and at nothing the turret leaves everyone's world.
//
// With no durable layer (no Supabase in the build) building still works,
// for the visit only, and says so once. A thing built on an older ground
// (planetSpec.js's TERRAIN_VERSION) is drawn on the ground there is now.
//
// createSharedWorld({ parent, spec, palette, groundAt, tell, respawn, durable,
//   makeLoader, makeOnline, makeStructures, makePeers, makeBolts, signIn })
//   → { join(name | null, hidden), step(dt, ship, snap), draw(at), build(ship),
//       unbuild(ship), prompt(ship), pilots(), built(), stats(), dispose() }
// SHARED_KEYS: what it adds to the flight's keys.

import { client as durableClient, signIn as durableSignIn } from '../../../lib/durable/supabase';
import { createEntityLoader } from '../../../lib/durable/entityLoader';
import { cellOf } from '../../../lib/durable/entities';
import { TERRAIN_VERSION } from '../../../lib/land/flight/planetSpec';
import { forwardOf } from './flightRules';
import { BUILD, canBuild, grounded, nearestOwn, placementFor } from './buildRules';
import { BOLT, TURRET, aimTurret, boltHits, muzzleOf, newTurret, stepBolt } from './turretRules';
import { createFlightOnline } from './online';
import { createStructures } from './structures';
import { createPeers } from './peers';
import { createBolts } from './bolts';

export const SHARED_KEYS = { build: ['KeyB'], unbuild: ['KeyX'], fire: ['Space'] };

const FIRE_EVERY = 0.25; // s between your bolts
const SHIELD = { full: 100, wait: 3, regen: 5 }; // regen a second, after `wait` s unhit
const TELL_EVERY = 0.25; // s between the HUD's 'shared' events
const TURRET_REACH = 5; // m: a bolt this close to a turret's head has hit it

// (the browser checks hand in a durable store of their own, in development only)
const devDurable = () => (import.meta.env?.DEV && typeof window !== 'undefined' ? (window.__FLIGHT_DURABLE__ ?? null) : null);

export function createSharedWorld({
  parent,
  spec,
  palette,
  groundAt,
  tell = () => {},
  respawn = () => {},
  durable,
  makeLoader = (opts) => createEntityLoader(opts),
  makeOnline = (opts) => createFlightOnline(opts),
  makeStructures = createStructures,
  makePeers = createPeers,
  makeBolts = createBolts,
  signIn = durableSignIn,
}) {
  const planetId = spec.id;
  // (building is for the 50 roster planets alone: on any other world there is
  // no database client at all, so no sign-in and no read or write, and the
  // room carries on as before. A spec with no `buildable` key is as it was.)
  const readOnly = spec.buildable === false;
  const db = readOnly ? null : durable === undefined ? (devDurable() ?? durableClient()) : durable;
  const loader = db ? makeLoader({ client: db, planetId }) : null;
  const local = new Map(); // id → entity: this visit's own, with no durable layer
  const structures = makeStructures(parent, palette);
  const peerShips = makePeers(parent, palette);
  const boltDraw = makeBolts(parent, palette);
  const turrets = new Map(); // id → a turret's aim (turretRules' newTurret)
  let online = null;
  let offOnline = () => {};
  let name = 'Pilot';
  let owner = db ? null : 'me'; // the database's id for you (signed in), or the visit's
  let signing = null;
  let busy = false; // a build or a take-down on its way
  let toldLocal = false;
  let localN = 0;
  let boltN = 0;
  let bolts = []; // { id, p, v, life, turret, mine }
  let fireIn = 0;
  let shield = SHIELD.full;
  let unhit = SHIELD.wait;
  let tellIn = 0;
  let disposed = false;
  const toast = (text) => tell('toast', { text });

  // what a held entity is, drawn and aimed
  const show = (e) => {
    const g = grounded(e, TERRAIN_VERSION, groundAt);
    structures.set(g);
    if (g.type !== 'turret') return;
    const was = turrets.get(g.id);
    turrets.set(g.id, was ? { ...was, owner: g.owner ?? null, by: g.metadata?.by ?? null } : newTurret(g));
  };
  const hide = (id) => {
    structures.remove(id);
    turrets.delete(id);
  };
  const offLoader =
    loader?.on((e) => {
      if (e.type === 'add' || e.type === 'change') show(e.entity);
      else if (e.type === 'remove') hide(e.id);
      else if (e.type === 'error' && e.where === 'place') toast(placeRefused(e.error));
    }) ?? (() => {});
  const all = () => (loader ? loader.all() : [...local.values()]);
  const held = (id) => (loader ? loader.get(id) : local.get(id) ?? null);

  const signedIn = () => {
    if (owner || !db) return Promise.resolve(owner);
    signing ??= Promise.resolve(signIn(db)).then((id) => {
      signing = null;
      owner = id ?? null;
      return owner;
    });
    return signing;
  };
  // (asked as you arrive, so B needn't wait on it)
  if (db) signedIn();

  function onRoom(e) {
    if (e.type === 'shot') bolts.push({ id: `b${boltN++}`, p: e.p, v: e.v, life: BOLT.life, turret: false, mine: false });
    else if (e.type === 'built') loader?.refetch(e.key);
    else if (e.type === 'gone') {
      // (the realtime DELETE is what takes it away; asking its cell again
      // only brings what changed, so a removal the hint names is waited for)
      const e2 = loader?.get(e.id);
      if (e2) loader.refetch(cellOf(e2.x, e2.z).join(','));
    }
  }

  async function build(ship) {
    if (busy) return;
    // (not even a turret of this visit's own)
    if (readOnly) return toast('Nothing can be built on this world.');
    const ground = groundAt(ship.x, ship.z);
    // (a soft world's ground is cloud: the flight flies through it, nothing stands on it)
    if (spec.soft) return toast('Nothing stands on a cloud deck.');
    const can = canBuild(ship, ground, spec.pois);
    if (!can.ok) return toast(can.why);
    const at = placementFor(ship, ground);
    if (!db) {
      const id = `local-${++localN}`;
      local.set(id, { id, type: 'turret', owner, ...at, hp: 100, metadata: { pilot: name, by: online?.selfId() ?? null }, terrainVersion: TERRAIN_VERSION });
      show(local.get(id));
      if (toldLocal) toast('Turret built.');
      else toast('Nothing is kept on this build.');
      toldLocal = true;
      return;
    }
    busy = true;
    try {
      if (!(await signedIn())) return toast('Building is off: the sign-in was turned away.');
      const placed = await loader.place({ type: 'turret', ...at, hp: 100, terrainVersion: TERRAIN_VERSION, metadata: { pilot: name, by: online?.selfId() ?? null } });
      if (!placed || disposed) return;
      toast('Turret built.');
      online?.built(placed.id, `${planetId}/${cellOf(placed.x, placed.z).join(',')}`);
    } finally {
      busy = false;
    }
  }

  async function unbuild(ship) {
    if (busy) return;
    const mine = nearestOwn(all(), ship, owner);
    if (!mine) return toast(`None of yours within ${BUILD.reach} m.`);
    if (!loader) {
      local.delete(mine.id);
      hide(mine.id);
      return toast('Turret taken down.');
    }
    busy = true;
    try {
      if (await loader.remove(mine.id)) {
        toast('Turret taken down.');
        online?.gone(mine.id);
      }
    } finally {
      busy = false;
    }
  }

  // a hit on a turret: the database's to count, or this visit's own
  function damage(t) {
    if (loader) return void loader.damage(t.id, TURRET.damage);
    const e = local.get(t.id);
    if (!e) return;
    const hp = Math.max(0, e.hp - TURRET.damage);
    if (hp === 0) {
      local.delete(t.id);
      hide(t.id);
    } else show(local.set(t.id, { ...e, hp }).get(t.id));
  }

  function stepBolts(dt, me) {
    const next = [];
    for (const b of bolts) {
      let spent = false;
      if (b.turret && me && boltHits(b, dt, me)) {
        spent = true;
        shield -= TURRET.damage;
        unhit = 0;
      } else if (b.mine) {
        for (const t of turrets.values()) {
          // (your own turrets let your bolts by)
          if (t.owner === owner) continue;
          if (boltHits(b, dt, { x: t.x, y: t.y + TURRET.height, z: t.z }, TURRET_REACH)) {
            spent = true;
            damage(t);
            break;
          }
        }
      }
      const moved = spent ? null : stepBolt(b, dt);
      // (into the ground: gone)
      if (moved && !(moved.p[1] < groundAt(moved.p[0], moved.p[2]))) next.push(moved);
    }
    bolts = next;
  }

  // what the HUD shows: the prompt (B, or X by one of yours), the shield, who's near
  function prompt(ship) {
    const can = canBuild(ship, groundAt(ship.x, ship.z), spec.pois);
    return { build: can.ok && !spec.soft && !readOnly, unbuild: Boolean(nearestOwn(all(), ship, owner)), shield: Math.round(shield), others: online?.peers().length ?? 0, kept: Boolean(db) };
  }

  return {
    // into the planet's room as `name` (null: out of it); `hidden(id)` is the roster's blocks
    join(next, hidden = () => false) {
      if (disposed) return;
      if (!next) {
        offOnline();
        online?.leave();
        online = null;
        return;
      }
      name = next;
      if (online) return;
      online = makeOnline({ planetId, name, hidden });
      offOnline = online.on(onRoom);
    },
    step(dt, ship, snap) {
      if (disposed) return;
      online?.update(ship);
      loader?.update(ship.x, ship.z);
      if (snap?.pressed?.has('KeyB')) build(ship);
      if (snap?.pressed?.has('KeyX')) unbuild(ship);

      // your guns
      fireIn -= dt;
      if (snap?.action?.('fire') && fireIn <= 0) {
        fireIn = FIRE_EVERY;
        const [fx, fy, fz] = forwardOf(ship);
        const sp = BOLT.speed + ship.speed;
        const p = [ship.x + fx * 8, ship.y + fy * 8, ship.z + fz * 8];
        const v = [fx * sp, fy * sp, fz * sp];
        bolts.push({ id: `b${boltN++}`, p, v, life: BOLT.life, turret: false, mine: true });
        online?.shot({ x: p[0], y: p[1], z: p[2] }, v);
      }

      // every turret held, against every ship seen (yours too)
      const [fx, fy, fz] = forwardOf(ship);
      const me = { id: owner ?? online?.selfId() ?? 'me', x: ship.x, y: ship.y, z: ship.z, vx: fx * ship.speed, vy: fy * ship.speed, vz: fz * ship.speed };
      const targets = [me];
      for (const p of online?.peers() ?? []) {
        const [px, py, pz] = forwardOf(p.pose);
        targets.push({ id: p.id, x: p.pose.x, y: p.pose.y, z: p.pose.z, vx: px * p.pose.speed, vy: py * p.pose.speed, vz: pz * p.pose.speed });
      }
      for (const [id, t] of turrets) {
        const aimed = aimTurret(t, targets, dt);
        turrets.set(id, aimed);
        structures.aim(id, aimed.yaw, aimed.pitch);
        if (aimed.fireAt) bolts.push({ id: `b${boltN++}`, ...muzzleOf(aimed), turret: true, mine: false });
      }

      stepBolts(dt, me);
      unhit += dt;
      if (unhit >= SHIELD.wait) shield = Math.min(SHIELD.full, shield + SHIELD.regen * dt);
      if (shield <= 0) {
        shield = SHIELD.full;
        unhit = SHIELD.wait;
        bolts = bolts.filter((b) => !b.turret);
        toast('Shot down by a turret: back up you go.');
        respawn();
      }

      tellIn -= dt;
      if (tellIn <= 0) {
        tellIn = TELL_EVERY;
        tell('shared', prompt(ship));
      }
    },
    draw(at) {
      structures.draw(at);
      peerShips.draw(online?.peers() ?? [], at);
      boltDraw.draw(bolts, at);
    },
    build,
    unbuild,
    prompt,
    // for the planet map's markers (./mapRules.js's markersOf): the pilots heard round you, what's held round you
    pilots: () => online?.peers() ?? [],
    built: () => all(),
    stats: () => ({ structures: structures.count(), turrets: turrets.size, peers: peerShips.count(), bolts: bolts.length, shield, online: online?.status ?? 'off', room: online?.stats() ?? null, cell: online?.cell() ?? null, held: all().length }),
    // (the checks read what's held by id)
    get: held,
    dispose() {
      disposed = true;
      offLoader();
      offOnline();
      online?.leave();
      loader?.dispose();
      structures.dispose();
      peerShips.dispose();
      boltDraw.dispose();
      local.clear();
      turrets.clear();
    },
  };
}

// what the database said, as a toast
function placeRefused(error) {
  const m = String(error?.message ?? '');
  if (/point of interest/.test(m)) return 'Nothing can be built here.';
  if (/already/.test(m)) return 'You’ve built all you may on this planet.';
  return 'The turret wasn’t built: try again.';
}
