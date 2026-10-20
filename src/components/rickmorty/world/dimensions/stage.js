// What every destination's builder (./<id>.js) starts from: the room kit
// (../interiors/shell.js's makeRoom) with the place's box from
// ./destinations.js, and
//   - outdoors, a sky (../sky.js) and a painted ground running out past the box;
//   - indoors, a floor, a ceiling and four walls round the box;
//   - the portal home, swirling where the place's way back is;
//   - its people and things from the Meshy cast, fetched once the place is
//     up (so the portal's swirl never waits on them) and left out if one
//     won't load: never a person in shapes (the plan's rule).
//
// stage(kit, id, opts) → { R, d, A, cx, cz, P(dx, dz) (a spot in the world
// from the place's middle), figure(kind, at), people(), done(light, update),
// hunt(on), calm(), power({ glow }), freeze({ splash }) } (and the NPC behaviour below: anyone
// placed with `ai`; and a place run on power, below; whichever game a place
// runs, its `meter` action is the HUD's readout of it: ../games/meter.js)

import * as THREE from 'three';
import { makeSky } from '../sky';
import { BOX, ceilings, makeRoom, tiledPaint, wallLine } from '../interiors/shell';
import { at, speckle } from '../kit';
import { RIGGED } from '../../portal/meshyCast';
import { destinationById } from './destinations';
import { nameOf } from './names';
import { createNpcs } from '../npc';
import { attend } from '../living';
import { TUNING as POWER, newPower, powerNews, powerReadout, stepPower } from '../games/power';
import { curse, dealNews, dealReadout, newDeal, stepDeal } from '../games/deal';
import { freezeEyes, freezeNews, freezeReadout, jumpSplashes, moving, newFreeze, stepFreeze } from '../games/freeze';
import { findNews, findReadout, newFind, pickOurs, stepFind } from '../games/find';

// a speckled paint for a floor or the ground
export const specks = (base, specks, seed = 7, n = 1600, size = 2) => (g, w, h) => speckle(g, w, h, { base, specks, n, size, seed });

export function stage(kit, id, { ground, groundTile = 4, floor, floorTile = 2, wall = 0xd8d0c0, wallH = null, ceiling = 0xe9e0cc, skirt = 0x5e4734, dado = null } = {}) {
  const d = destinationById(id);
  const A = d.area;
  const R = makeRoom(kit, id);
  const { x: cx, z: cz } = d.centre;
  const P = (dx, dz) => [cx + dx, cz + dz];
  let sky = null;

  if (d.kind === 'outdoor') {
    sky = makeSky(560, d.sky);
    R.group.add(sky.dome);
    R.noInk.push(sky.dome);
    // the ground, out well past the box to the horizon's fog
    const mat = tiledPaint(kit.mats, `c137-${id}-ground`, 256, groundTile, ground ?? specks('#7a9a52', ['#6a8a46', '#8aaa5e']), { color: 0xffffff });
    R.tiled.add(BOX, mat, at(cx, -0.05, cz, 0, A.x1 - A.x0 + 260, 0.1, A.z1 - A.z0 + 260));
  } else {
    const H = d.ceiling;
    const mat = tiledPaint(kit.mats, `c137-${id}-floor`, 256, floorTile, floor ?? specks('#bfb6a6', ['#b0a796', '#cbc3b4']), { color: 0xffffff });
    R.tiled.add(BOX, mat, at(cx, -0.05, cz, 0, A.x1 - A.x0 + 0.4, 0.1, A.z1 - A.z0 + 0.4));
    ceilings(R, [[A.x0 - 0.2, A.x1 + 0.2, A.z0 - 0.2, A.z1 + 0.2]], H, ceiling);
    const w = { color: wall, skirt, h: wallH ?? H, ...(dado && { dado }) };
    const F = R.fixed;
    wallLine(R, F, [A.x0, A.z0 - 0.2], [A.x0, A.z1 + 0.2], { ...w, into: [1, 0] });
    wallLine(R, F, [A.x1, A.z0 - 0.2], [A.x1, A.z1 + 0.2], { ...w, into: [-1, 0] });
    wallLine(R, F, [A.x0 - 0.2, A.z0], [A.x1 + 0.2, A.z0], { ...w, into: [0, 1] });
    wallLine(R, F, [A.x0 - 0.2, A.z1], [A.x1 + 0.2, A.z1], { ...w, into: [0, -1] });
  }

  // ── the portal home, turned to the camera, shrinking away while the camera's on it ──
  const portalMat = R.own(kit.portal());
  const portal = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 3.3), portalMat);
  portal.position.set(d.back.x, 1.75, d.back.z);
  R.add(portal, { ink: false });
  R.tick((t, dt, state, camera) => {
    if (!camera) return;
    const pd = Math.hypot(camera.position.x - portal.position.x, camera.position.z - portal.position.z);
    portal.rotation.y = Math.atan2(camera.position.x - portal.position.x, camera.position.z - portal.position.z);
    portalMat.uniforms.open.value = Math.min(1, Math.max(0, (pd - 2.2) / 2.4));
    portalMat.uniforms.t.value = t;
  });

  // ── the cast ──
  const fetched = new Map();
  const load = (kinds) => {
    const key = kinds.join(',');
    if (!fetched.has(key)) {
      // (the run too: a place's hunters run at Morty)
      const clips = kinds.some((k) => RIGGED.has(k)) ? ['idle', 'walk', 'run'] : [];
      fetched.set(
        key,
        kit.need(kinds, { clips }).catch(() => null),
      );
    }
    return fetched.get(key);
  };
  // ── the people who do something (../npc.js): the place's brains ──
  const N = createNpcs({ id, area: A, solids: d.solids, words: { caught: d.caught, spotted: d.spotted } });

  // what a place's game says has happened, said through the render state as
  // the hunters say it (won: its task done, with its achievement if it has
  // one; lost: caught, back at the way in, which calms the place and starts
  // it afresh): the game, marked told once its loss is said
  const told = (news, game, { task, who, lost, unlock = null }, state) => {
    if (news === 'done') state.emit?.('done', { area: id, task, unlock });
    if (news !== 'caught') return game;
    state.emit?.('caught', { area: id, who, text: lost });
    return { ...game, told: true };
  };

  // ── a place run on power (../games/power.js, place.js's `power`): its run,
  // stepped in the place's own update; its spots tell it (`power-take`,
  // `power-give`); it says what's happened through the render state as the
  // hunters do (won: the task done; lost: caught, back at the way in, which
  // calms the place and starts it afresh). Idle once its task's done. The
  // builder may hand it a glow to light with the charge (`power({ glow })`). ──
  const pw = d.power;
  const fresh = () => newPower({ need: pw.need, charge: pw.s });
  let run = pw ? fresh() : null;
  let asked = {};
  let glow = null;
  const powered = (t, dt, state) => {
    const done = (state.done ?? []).includes(pw.task);
    if (!done && !state.fading) {
      run = stepPower(run, asked, dt);
      asked = {};
      run = told(powerNews(run, { done, fading: false }), run, pw, state);
    }
    if (!glow) return;
    const share = done || run.phase !== 'run' ? (run.phase === 'lost' ? 0 : 1) : run.charge / run.max;
    const blink = run.phase === 'run' && share < POWER.low ? 0.65 + 0.35 * Math.sin(t * 10) : 1;
    glow.material.color.setScalar(Math.max(0.15, share) * blink);
  };

  // ── a place run on a deal (../games/deal.js, place.js's `deal`): each of
  // its things' spots queues a use (`deal-<id>`: two presses in one frame
  // are both kept), stepped in the place's own update and said as power's
  // run is. Dealt afresh, curses and all, whenever the place calms. ──
  const dl = d.deal;
  const dealt = () => newDeal({ items: dl.items, need: dl.need, looks: dl.looks, bad: Array.isArray(dl.bad) ? dl.bad : curse(dl.items, dl.bad, Math.random) });
  let deal = dl ? dealt() : null;
  let used = [];
  const dealing = (state) => {
    const done = (state.done ?? []).includes(dl.task);
    if (done || state.fading) {
      used = [];
      return;
    }
    for (const u of used.splice(0)) deal = stepDeal(deal, { use: u });
    deal = told(dealNews(deal, { done, fading: false }), deal, dl, state);
  };

  // ── a place run on a freeze (../games/freeze.js, place.js's `freeze`):
  // stepped in the place's own update on Morty's own motion (the render
  // state's), its spot's press the jump in (`freeze-in`, with the builder's
  // splash); said as power's run is, the win with its achievement; its
  // lookouts turned where the game says the buyers' eyes are. (Its task done
  // before the game was built, its achievement is handed over on the visit.) ──
  const fz = d.freeze;
  let still = fz ? newFreeze() : null;
  let jumped = false;
  let splash = null;
  let granted = false;
  let finished = false; // (its task done: the vat's just a vat to jump in)
  const freezing = (dt, state) => {
    const done = (state.done ?? []).includes(fz.task);
    finished = done;
    if (done && fz.unlock && !granted && !state.fading) {
      granted = true;
      state.emit?.('done', { area: id, task: fz.task, unlock: fz.unlock });
    }
    if (!done && !state.fading) {
      still = stepFreeze(still, { moving: moving(state.morty), jumped }, dt);
      still = told(freezeNews(still, { done, fading: false }), still, fz, state);
    }
    jumped = false;
    N.lookout(done ? null : freezeEyes(still));
  };

  // ── a place run on a find (../games/find.js, place.js's `find`): each
  // candidate's spot queues a use (`find-<id>`), stepped at no time in the
  // place's own update, then the clock; said as power's run is, the win
  // with its achievement. Ours dealt afresh whenever the place calms. ──
  const fd = d.find;
  const sought = () => newFind({ items: fd.items, ours: fd.ours ?? pickOurs(fd.items, Math.random), s: fd.s, cost: fd.cost });
  let search = fd ? sought() : null;
  let asks = [];
  const finding = (dt, state) => {
    const done = (state.done ?? []).includes(fd.task);
    if (done || state.fading) {
      asks = [];
      return;
    }
    for (const u of asks.splice(0)) {
      search = stepFind(search, { use: u }, 0);
      // (a wrong one taken: the time it cost is heard as well as seen)
      if (search.events.some((e) => e.type === 'wrong')) state.emit?.('miss', { area: id });
    }
    search = stepFind(search, {}, dt);
    search = told(findNews(search, { done, fading: false }), search, fd, state);
  };

  // (calmed: its people home, and its game started afresh)
  const calm = () => {
    N.calm();
    if (pw) {
      run = fresh();
      asked = {};
    }
    if (dl) {
      deal = dealt();
      used = [];
    }
    if (fz) {
      still = newFreeze();
      jumped = false;
    }
    if (fd) {
      search = sought();
      asks = [];
    }
  };

  // one of the cast at (x, z) facing `face`, `h` tall (its own height if not
  // given), gone once `until` is done and till `after` is (`when(state)`, if
  // given, says instead); with `ai`, someone who does something (above);
  // `person`: one of the place's people, who turns their head to Morty as he
  // comes up and talks with their hands when he talks to them (../living.js's
  // attend); null if it won't load
  const make = (kind, { x, z, face = 0, h = null, y = 0, until = null, after = null, when = null, onPlace = null, ai = null, id = kind, who = null, name = null, person = false }) => {
    const c = kit.cast?.make?.(kind);
    if (!c) return null;
    if (h) c.group.scale.setScalar(h / c.height);
    c.group.position.set(x, y, z);
    c.group.rotation.y = face + Math.PI / 2;
    R.group.add(c.group);
    const n = ai ? N.add(c, { x, z, y, face, ai, id, who, name }) : null;
    const b = person ? {} : null;
    R.tick((t, dt, state) => {
      const done = state?.done ?? [];
      c.group.visible = when ? when(state) : (!until || !done.includes(until)) && (!after || done.includes(after));
      if (!c.group.visible) return;
      if (n) N.step(n, t, dt, state);
      else {
        c.update?.(t, 0, 0, { dt });
        if (b) attend(c, b, id, t, state, { y, near: 3 });
      }
    });
    onPlace?.(c);
    return c;
  };
  const placed = [];
  let cast = false; // the place's people stood (./done, below)
  // things to place once their models are in: [kind, at] pairs (`at.onPlace(c)`: told when it's stood)
  const figure = (kind, spot) => placed.push([kind, spot]);
  // the place's people and its crowd, from ./destinations.js (`extras`:
  // what the crowd stands with, as `when` for a crowd that runs off; `who`:
  // more for a person by id, say a `when` of their own)
  const people = ({ extras = {}, who = {} } = {}) => {
    for (const p of d.people) figure(p.who ?? p.id, { x: p.x, z: p.z, y: p.y ?? 0, face: p.face, until: p.until, after: p.after, ai: p.ai ?? null, id: p.id, who: d.say[p.id]?.who ?? null, name: nameOf(p.who ?? p.id), person: true, ...(who[p.id] ?? {}) });
    for (const [i, e] of d.extras.entries()) figure(e.kind, { x: e.x, z: e.z, y: e.y ?? 0, face: e.face, h: e.h ?? null, ai: e.ai ?? null, id: `${e.kind}-${i}`, name: nameOf(e.kind), ...extras });
  };

  const done = (light, update) => {
    const area = R.build({
      light,
      update: (t, dt, state, camera) => {
        sky?.update(t, camera);
        // (a game waits for the place's people: no clock runs, no look is
        // taken, before there's anyone there to see him)
        if (run && state && cast) powered(t, dt, state);
        if (deal && state && cast) dealing(state);
        if (still && state && cast) freezing(dt, state);
        if (search && state && cast) finding(dt, state);
        update?.(t, dt, state, camera);
      },
    });
    // the cast, fetched behind the scenes and stood in place as each arrives
    const kinds = [...new Set(placed.map(([k]) => k))];
    cast = !kinds.length;
    if (kinds.length)
      kit.track(
        Promise.all(kinds.map((k) => load([k]))).then(() => {
          for (const [k, spot] of placed) make(k, spot);
          cast = true; // (stood, or left out if one wouldn't load: the game goes on either way)
        }),
      );
    // (every place settles when Morty leaves it: its hunters go home. A
    // builder adds its own actions to these. `npcs`: where everyone is, for
    // the QA scripts; `fire`, `bodies` and `hit`: Morty's shot in a duel,
    // where it aims, what it can hit, and what it did when it landed.)
    // (a place run on power, a deal, a freeze or a find: its spots, where its game is for the
    // checks, its meter for the HUD, and, in development, a way for the
    // checks to set it)
    area.actions = { calm, npcs: N.list, fire: N.fire, bodies: N.bodies, hit: N.hit };
    if (run)
      Object.assign(area.actions, {
        'power-take': () => (asked.take = true),
        'power-give': () => (asked.give = true),
        power: () => ({ phase: run.phase, charge: run.charge, max: run.max, need: run.need, delivered: run.delivered, carrying: run.carrying }),
        meter: () => powerReadout(run),
        ...(import.meta.env.DEV && { setPower: (patch) => (run = { ...run, ...patch }) }),
      });
    if (deal)
      Object.assign(area.actions, {
        ...Object.fromEntries(dl.items.map((u) => [`deal-${u}`, () => used.push(u)])),
        deal: () => ({ phase: deal.phase, need: deal.need, looks: deal.looks, left: deal.left, seen: { ...deal.seen }, taken: [...deal.taken], last: deal.last }),
        meter: () => dealReadout(deal, dl.words),
        ...(import.meta.env.DEV && { setDeal: (patch) => (deal = { ...deal, ...patch }) }),
      });
    if (still)
      Object.assign(area.actions, {
        'freeze-in': () => {
          // (the vat splashes for a jump that takes him in, or any once its task's done)
          if (jumpSplashes(still, { done: finished })) splash?.();
          jumped = true;
        },
        freeze: () => ({ phase: still.phase, eyes: still.eyes, left: still.left, len: still.len, beat: still.beat }),
        // (whether a jump in now would take him, so the vat's long line isn't said before a catch's)
        'freeze-takes': () => jumpSplashes(still, { done: finished }),
        meter: () => freezeReadout(still),
        ...(import.meta.env.DEV && { setFreeze: (patch) => (still = { ...still, ...patch }) }),
      });
    if (search)
      Object.assign(area.actions, {
        ...Object.fromEntries(fd.items.map((u) => [`find-${u}`, () => asks.push(u)])),
        // (never ours: the checks set it, a player finds it)
        find: () => ({ phase: search.phase, left: search.left, len: search.len, heard: [...search.heard], wrong: [...search.wrong], last: search.last }),
        meter: () => findReadout(search, fd.tells),
        ...(import.meta.env.DEV && { setFind: (patch) => (search = { ...search, ...patch }) }),
      });
    return area;
  };
  // (`taken()`: what a deal's had off the shelves this run, for the builder to take away)
  return { R, d, A, cx, cz, P, figure, people, done, hunt: N.hunt, npcs: N.npcs, calm, power: (o) => (glow = o.glow ?? null), freeze: (o) => (splash = o.splash ?? null), taken: () => deal?.taken ?? [] };

}
