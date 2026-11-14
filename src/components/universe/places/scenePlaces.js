// The scene's generated places, put together: what's round the ship, the
// stations drawn and solid, the carry that keeps a parked ship parked at a
// moving planet, which place the ship is at, docking, and the lookups the
// trips, the nav and the HUD take. It never makes a sector on the main
// thread: it reads the Expanse's loaded sectors and the few it fetched from
// the worker pool, each by its own id.
//
// One frame. Everything here is in `group`'s frame (the map's, which is
// turned by state.yaw after an arrival, a spawn or a pose): the ship, the
// rows, the parks, the stations, the solids, and what goes to toScreen. Only
// the three.js camera comes from the scene's frame, and it is brought in
// with group.worldToLocal each update, as scene.js's camLocal is.
//
// createScenePlaces({ group, universe, expanse, workers, startAt, toScreen,
//   prepare, emit, note, device, clock, tags, onPick, frame, makeTags }) → {
//   setStep(step, floor), update({ ship, camera, t, flying, nose, going,
//   arrived, held, aim, picked }), pick(px, py, { tanHalf, height }),
//   screen(id), around(), carry(ship, t0, t1), solids(), here(),
//   docked(), resolve(id), fetch(id), find(id), missing(id), park(id, from),
//   look, mark(id, dest), name(id), nearby(max), aimTargets(sector, at),
//   debug, dispose() }
// Events ({ type: 'place', what, id, name, open?, dest? }): 'arrive' (only
// when going nowhere or there), 'leave', 'dock' (open: the trip that ended
// there, once), 'undock', 'found' (a start or a find that had to wait; dest
// is null when there's nothing there).
// The names: tags (a thunk, the scene's tag box) shows at most budget.tags
// of them, the gone-to, aimed and picked places first, then the one it's at,
// then those near the nose (pick.js's tagsFor), none while held or not
// flying. frame() is the scene's { w, h }; onPick(id) is a tag's click.

import * as THREE from 'three';
import { parseSpaceId } from '../../../lib/space/address.js';
import { UNIVERSE, withMoons } from '../../expanse/shared/gen';
import { universeBudget } from '../budget';
import { NAME_CONE, aimTargets as handMadeTargets } from '../aim';
import { destinationById } from '../nav';
import { PLACE } from '../words';
import { AROUND, aimStars, hereZone, orbitingPlace, placesAround } from './around';
import { carry, carryFrames, frameOf } from './carry';
import { dockState } from './dock';
import { atTime, canonicalPlace } from './ids';
import { followPark, parkPlace } from './park';
import { PICK, pickPlace, tagsFor } from './pick';
import { createPlaceTags } from './placeTags';
import { resolvePlace } from './resolve';
import { createStationLook } from './stationLook';

const REFRESH = 0.25; // (seconds of the wall clock between lists of what's near)
const MOVED = 500; // (or the camera this far since the last)
const STARS_EVERY = 1; // (seconds between the generated stars the aim takes)
const FETCHED = 4; // (sectors fetched from the pool kept beside the loaded ones)
const smoothstep = (e0, e1, x) => {
  const u = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return u * u * (3 - 2 * u);
};
const len = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

export function createScenePlaces({ group, universe = UNIVERSE, expanse, workers = null, startAt = null, toScreen = null, prepare = () => {}, emit = () => {}, note = () => {}, device = {}, clock = () => performance.now() / 1000, tags = () => null, onPick = () => {}, frame = () => ({ w: 0, h: 0 }), makeTags = createPlaceTags }) {
  // (the list's cap is the far layer's own room, made at step 0, so it holds
  // whatever the disc layer draws at any step; the names come down with it)
  const room = universeBudget(device, 0).discs;
  let budget = universeBudget(device, 0);
  const look3 = createStationLook(group, { prepare });
  const v = new THREE.Vector3();
  const cam = [0, 0, 0];
  const listedAt = [NaN, NaN, NaN];
  let listedWhen = -Infinity;
  let rows = [];
  let t = 0;
  let lastT = null;
  let here = null;
  let docked = null;
  let frames = [];
  let drawn = []; // ({ id, at, size, grow }: the stations in view)
  let solidList = [];
  let seenArrival = null; // (the latest trip's end, as the scene keeps it)
  let prefer = null; // (where that trip ended, till the ship's there or gone)
  let opens = null; // (the trip's end a dock may open the hangar for, once)
  const fetched = new Map();
  const asking = new Map();
  let starList = [];
  let starsWhen = -Infinity;
  let aimList = null;
  let aimKey = null;
  let flyingNow = false;
  let tagBox = null;
  let tagView = null;
  const pt = { x: 0, y: 0, z: 0 };
  // the tag view, made on the box the scene has now (a page can swap it)
  const tagsNow = () => {
    const box = tags() ?? null;
    if (box !== tagBox) {
      tagView?.dispose();
      tagBox = box;
      tagView = box ? makeTags(box, { onPick: (id) => onPick(id) }) : null;
    }
    return tagView;
  };
  const showTags = (ship, nose, focus) => {
    const view = tagsNow();
    if (!view) return;
    if (!ship) return view.show([], frame());
    const list = [];
    for (const r of tagsFor(rows, { ship, nose: nose ?? [0, 0, -1], focus, here, max: budget.tags, cone: NAME_CONE })) {
      const p = toScreen(r.at[0], r.at[1], r.at[2], pt);
      if (!(p.z > PICK.near)) continue; // (behind the camera, or at it)
      list.push({ id: r.id, name: r.name, dist: Math.max(0, Math.hypot(ship.x - r.at[0], ship.y - r.at[1], ship.z - r.at[2]) - (r.reach ?? 0)), x: p.x, y: p.y });
    }
    view.show(list, frame());
  };

  // the loaded sectors and the fetched ones, each by its own id (lane 2's
  // chunk grid names its cells otherwise), made again once an update
  let sectorsMemo = null;
  const sectors = () => {
    if (sectorsMemo) return sectorsMemo;
    const m = new Map();
    for (const s of expanse?.sectors?.()?.values?.() ?? []) if (s?.id) m.set(s.id, s);
    for (const [k, s] of fetched) if (!m.has(k)) m.set(k, s);
    return (sectorsMemo = m);
  };
  const keyOf = (id) => (canonicalPlace(id) ? parseSpaceId(id).key : null);
  const atHand = (key) => key !== null && sectors().has(key);
  const resolve = (id) => resolvePlace(id, { universe, t, sectors: sectors(), build: false });
  const missing = (id) => {
    const key = keyOf(id);
    return key !== null && !atHand(key);
  };
  const keep = (sector) => {
    fetched.delete(sector.id);
    fetched.set(sector.id, sector);
    while (fetched.size > FETCHED) fetched.delete(fetched.keys().next().value);
    sectorsMemo = null;
  };
  const fetch = (id) => {
    const key = keyOf(id);
    if (key === null) return Promise.resolve(null);
    if (atHand(key)) return Promise.resolve(resolve(id));
    if (!workers?.request) return Promise.resolve(null);
    let ask = asking.get(key);
    if (!ask) {
      const { sx, sy, sz } = parseSpaceId(id);
      // (its own key, so it never settles the Expanse's ask for the same sector)
      let req;
      try {
        req = Promise.resolve(workers.request('expanse', { type: 'sector', key: `place|${key}`, universe, sx, sy, sz }));
      } catch {
        req = Promise.resolve(null);
      }
      ask = req
        .then(
          (answer) => {
            if (answer?.sector) keep(withMoons(answer.sector));
          },
          () => {},
        )
        .finally(() => asking.delete(key));
      asking.set(key, ask);
    }
    return ask.then(() => (atHand(key) ? resolve(id) : null));
  };
  const find = (id) => {
    const d = resolve(id);
    if (d || !missing(id)) return d;
    const canon = canonicalPlace(id);
    fetch(id).then((dest) => emit({ type: 'place', what: 'found', id: canon, name: dest?.name ?? null, dest }));
    return null;
  };
  const park = (id, from) => {
    const d = resolve(id);
    return d ? parkPlace(d, from, t) : null;
  };
  const look = { place: (id) => resolve(id), park };
  const rowOf = (id) => (id == null ? null : (rows.find((r) => r.id === id) ?? null));

  // the stations of the systems the camera is inside, grown in from the edge
  const placeStations = () => {
    drawn = [];
    for (const s of sectors().values()) {
      for (const st of s.stations ?? []) {
        const sys = s.systems?.[st.i];
        if (!sys) continue;
        const d = len(cam, sys.at);
        if (d >= sys.reach) continue;
        drawn.push({ id: st.id, at: st.at, size: st.size, grow: smoothstep(sys.reach, 0.85 * sys.reach, d), d });
      }
    }
    drawn.sort((a, b) => a.d - b.d);
    look3.update(drawn);
    solidList = drawn.filter((r) => r.grow > 0).map((r) => ({ id: r.id, at: r.at, r: r.size, reach: r.size * 1.5 }));
  };

  const placeEvent = (what, id, more = {}) => emit({ type: 'place', what, id, name: rowOf(id)?.name ?? resolve(id)?.name ?? null, ...more });

  if (startAt && missing(startAt)) find(startAt); // (the link's sector asked for at once, seconds before a ship spawns)

  return {
    setStep(step, floor) {
      budget = universeBudget(device, step, floor);
    },
    get budget() {
      return budget;
    },
    update({ ship, camera, t: now, flying, nose = null, going = null, arrived = null, held = false, aim = null, picked = null }) {
      sectorsMemo = null;
      const dt = held || lastT === null ? 0 : Math.max(0, now - lastT);
      lastT = now;
      t = now;
      group.updateWorldMatrix(true, false);
      group.worldToLocal(v.copy(camera.position));
      cam[0] = v.x;
      cam[1] = v.y;
      cam[2] = v.z;
      const wall = clock();
      if (wall - listedWhen >= REFRESH || !(len(cam, listedAt) <= MOVED)) {
        rows = placesAround(sectors(), cam, t, { ...AROUND, max: room });
        listedWhen = wall;
        listedAt[0] = cam[0];
        listedAt[1] = cam[1];
        listedAt[2] = cam[2];
      }
      if (wall - starsWhen >= STARS_EVERY) {
        starList = aimStars(sectors(), cam, { max: 2000 });
        starsWhen = wall;
        aimList = null;
      }
      placeStations();
      flyingNow = Boolean(flying && ship);
      if (!flyingNow || held) showTags(null);
      if (!flyingNow) return;

      // a trip's end: preferred where it ended, and a dock there may open the hangar
      if (arrived !== seenArrival) {
        seenArrival = arrived;
        prefer = arrived?.id ?? null;
        opens = arrived ?? null;
      }
      const at = [ship.x, ship.y, ship.z];
      const outOf = (id) => {
        const r = rowOf(id);
        return !r || r.park == null || len(at, r.at) > hereZone(r).out;
      };
      if (opens && outOf(opens.id)) opens = null;

      // off the dock first, then where it's at, then onto a dock
      if (docked) {
        const r = rowOf(docked);
        if (!r || !dockState(ship, r, true)) {
          const was = docked;
          docked = null;
          placeEvent('undock', was);
        }
      }
      const next = orbitingPlace(ship, here, rows, prefer);
      if (prefer && (next === prefer || outOf(prefer))) prefer = null;
      if (next !== here) {
        const was = here;
        here = next;
        if (was) placeEvent('leave', was);
        if (here && (going == null || going === here)) placeEvent('arrive', here);
      }
      if (!docked) {
        for (const r of rows) {
          if (r.place !== 'station' || !dockState(ship, r, false)) continue;
          docked = r.id;
          const open = Boolean(opens && opens.id === r.id);
          if (open) opens = null;
          placeEvent('dock', r.id, { open });
          note(PLACE.docked(r.name));
          break;
        }
      }
      frames = carryFrames(frames, frameOf(rows, { here, going }), dt);
      if (!held) showTags(ship, nose, [going, aim, picked]);
    },
    // a click on the flight: the place under it, where it shows (a far thing as much as a near one)
    pick: (px, py, opts) => (flyingNow && toScreen ? pickPlace(rows, toScreen, px, py, opts) : null),
    screen(id) {
      const r = rowOf(id);
      if (!r || !toScreen) return null;
      const p = toScreen(r.at[0], r.at[1], r.at[2], { x: 0, y: 0, z: 0 });
      return { x: p.x, y: p.y };
    },
    around: () => rows,
    carry: (ship, t0, t1) => carry(ship, frames, t0, t1),
    solids: () => solidList,
    here: () => (here ? { id: here, place: rowOf(here)?.place ?? null } : null),
    docked: () => docked,
    resolve,
    fetch,
    find,
    missing,
    park,
    look,
    mark(id, dest = null) {
      const canon = canonicalPlace(id);
      if (!canon) return null;
      const d = dest && dest.id === canon ? dest : resolve(canon);
      if (!d) return null;
      return { at: atTime(d, t), reach: d.reach, name: d.name };
    },
    name: (id) => destinationById(id, look)?.name ?? null,
    nearby: (max = 60) =>
      rows
        .slice(0, max)
        .map((r) => resolve(r.id))
        .filter(Boolean),
    // the hand-made places, then (in the main map, not the Curve) the
    // generated stars, as one array kept until the stars refresh
    aimTargets(sector, at) {
      const key = `${sector}|${at}`;
      if (aimList && aimKey === key) return aimList;
      const base = handMadeTargets(sector, at);
      aimList = sector === 'main' ? [...base, ...starList] : base;
      aimKey = key;
      return aimList;
    },
    debug: {
      resolve,
      parkAt(id, from, t0, t1) {
        const d = resolvePlace(id, { universe, t: t0, sectors: sectors(), build: false });
        return d && followPark(d, parkPlace(d, from, t0), t1);
      },
      screen: (id) => {
        const r = rowOf(id);
        return r && toScreen ? toScreen(r.at[0], r.at[1], r.at[2], { x: 0, y: 0, z: 0 }) : null;
      },
      stations() {
        const all = [];
        for (const s of sectors().values()) for (const st of s.stations ?? []) all.push({ id: st.id, name: st.name, at: st.at, size: st.size, d: len(cam, st.at) });
        return all.sort((a, b) => a.d - b.d).slice(0, 20);
      },
    },
    toScreen,
    dispose() {
      for (const key of asking.keys()) workers?.cancel?.('expanse', `place|${key}`);
      asking.clear();
      look3.dispose();
      tagView?.dispose();
    },
  };
}
