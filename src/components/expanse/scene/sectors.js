// One loaded sector of the expanse (gen/sector.js's), drawn. Everything in
// it sits in the sector's own frame, its centre at nought, so the numbers
// in its buffers stay small however far out it is; the group is moved to
// where the sector is relative to the floating origin (reanchor). Each
// star is a small bright sphere in its own colour; from further off than
// where farStars.js has it real, it's a star on the sky instead, every star and
// wonder of the sector in one Points, one draw. A system's planets are
// built (galaxy/bodies.js, a look for each type) only when the camera comes
// within PLANET_NEAR of it, the nearest system's alone, and let go again
// past PLANET_NEAR × 1.3. The wonders are cheap: a pulsar a small bright
// sphere, a derelict or a rogue world a small dark one. No textures.
//
// A nebula is not drawn here. It is handed to the one nebula renderer
// (universe/nebula/, deep space's, lent through `nebulae`) on build and
// taken back on dispose: a cloud fixed in the world, drawn in the map's
// space, so the sector gives it the wonder's absolute place, not its own
// frame's. It has no speck either; its cloud is its far self. Its
// `wonder:<id>` object stays, an empty group at its place, so names and
// picks find it. With no renderer a nebula isn't drawn at all.
//
// PLANET_NEAR, TYPE_LOOK: { [planet type]: LOOKS id }
// createSector(sector, { tier = 'mid', skyFar = SKY_FAR, build = buildBody, nebulae = null })
//   → { group, sector, update(t, dt, camera), reanchor(at), dispose(), count() }
//   The caller puts the group under a root at `at` and calls reanchor(at) whenever `at` moves.
// nebulaOf(wonder) → the renderer's desc for a nebula wonder: { id, at, r, colors, seed }

import * as THREE from 'three';
import { buildBody } from '../../galaxy/bodies';
import { SKY_FAR } from '../../universe/deepspace';
import { createFarStars } from '../../universe/farStars';
import { rngOf } from '../gen/seed';

export const PLANET_NEAR = 9000; // a system's planets are built inside this
const LET_GO = 1.3; // and let go past this many times it
const SWITCH = 1000; // how much nearer another system must be to take over

export const TYPE_LOOK = {
  rock: 'moon-dust',
  ice: 'hoth',
  gas: 'yavin',
  ringed: 'bespin',
  lava: 'mustafar',
  ocean: 'kamino',
  forest: 'endor',
  desert: 'tatooine',
};

// how a wonder looks as a speck, and as itself
const WONDER = {
  nebula: { color: '#b48cff' },
  pulsar: { color: '#b8f4ff', r: 0.15 },
  derelict: { color: '#7a808c', r: 0.12, dark: '#2a2d33' },
  rogue: { color: '#6b5a50', r: 0.5, dark: '#1e1a18' },
};

// shared by every sector, never disposed
const BALL = new THREE.SphereGeometry(1, 16, 12);

// a nebula, as the renderer takes it: its place absolute (the renderer
// draws in the map's space, not the sector's frame), its size its radius,
// and its two colours: the nebula swatch and a hue of its own, the seed's
// first draw, as the puffs it used to be were coloured
export function nebulaOf(w) {
  const rng = rngOf(w.seed);
  const hue = new THREE.Color().setHSL(rng(), 0.7, 0.55);
  return { id: w.id, at: [...w.at], r: w.size, colors: [WONDER.nebula.color, `#${hue.getHexString()}`], seed: w.seed };
}

export function createSector(sector, { tier = 'mid', skyFar = SKY_FAR, build = buildBody, nebulae = null } = {}) {
  const o = sector.origin;
  const local = (p) => [p[0] - o[0], p[1] - o[1], p[2] - o[2]];
  const group = new THREE.Group();
  group.name = `sector:${sector.id}`;
  const made = []; // geometries and materials, this sector's own
  const mats = new Map(); // a basic material per colour
  const matOf = (color) => {
    if (!mats.has(color)) {
      const m = new THREE.MeshBasicMaterial({ color, toneMapped: false });
      mats.set(color, m);
      made.push(m);
    }
    return mats.get(color);
  };
  const ball = (name, at, r, color) => {
    const m = new THREE.Mesh(BALL, matOf(color));
    m.name = name;
    m.position.set(...at);
    m.scale.setScalar(r);
    return m;
  };

  // the stars
  const stars = sector.systems.map((s) => {
    const g = new THREE.Group();
    g.name = `star:${s.id}`;
    g.position.set(...local(s.at));
    g.add(ball('star-core', [0, 0, 0], s.star.size, s.star.color));
    group.add(g);
    return g;
  });

  // the wonders: a nebula's is an empty group at its place, its cloud the
  // nebula renderer's, held by its handle until dispose
  const clouds = [];
  const wonders = sector.wonders.map((w) => {
    const look = WONDER[w.kind] ?? WONDER.rogue;
    let obj;
    if (w.kind === 'nebula') {
      obj = new THREE.Group();
      obj.position.set(...local(w.at));
      if (nebulae) clouds.push(nebulae.add(nebulaOf(w)));
    } else obj = ball('', local(w.at), w.size * look.r, look.dark ?? look.color);
    obj.name = `wonder:${w.id}`;
    group.add(obj);
    return obj;
  });

  // every star and wonder as a speck, from far off (a nebula has none)
  const far = createFarStars(group, {
    places: [
      ...sector.systems.map((s, i) => ({ id: s.id, at: local(s.at), r: s.star.size, color: s.star.color, group: stars[i] })),
      ...sector.wonders.flatMap((w, i) => (w.kind === 'nebula' ? [] : [{ id: w.id, at: local(w.at), r: w.size * 0.4, color: (WONDER[w.kind] ?? WONDER.rogue).color, group: wonders[i] }])),
    ],
    skyFar,
  });

  // the planets of the system the camera's nearest, while it's near
  let near = null; // { i, bodies }
  const letGo = () => {
    for (const b of near?.bodies ?? []) {
      b.group.removeFromParent();
      b.dispose();
    }
    near = null;
  };
  const buildPlanets = (i) => {
    const s = sector.systems[i];
    const star = new THREE.Vector3(...local(s.at));
    const color = new THREE.Color(s.star.color);
    near = {
      i,
      bodies: s.planets.map((p) => {
        const b = build(TYPE_LOOK[p.type] ?? TYPE_LOOK.rock, { r: p.radius, tier });
        b.group.name = `planet:${p.id}`;
        b.group.position.set(...local(p.at));
        b.setSuns([{ dir: star.clone().sub(b.group.position).normalize(), color }]);
        group.add(b.group);
        return b;
      }),
    };
  };

  const cam = new THREE.Vector3();
  const api = {
    group,
    sector,
    update(t, dt, camera) {
      group.updateWorldMatrix(true, false);
      group.worldToLocal(camera.getWorldPosition(cam));
      let best = -1;
      let bestD = Infinity;
      stars.forEach((g, i) => {
        const d = g.position.distanceTo(cam);
        if (d < bestD) (best = i), (bestD = d);
      });
      const heldD = near ? stars[near.i].position.distanceTo(cam) : Infinity;
      if (near && heldD > PLANET_NEAR * LET_GO) letGo();
      if (best >= 0 && bestD <= PLANET_NEAR && best !== near?.i && (!near || bestD < heldD - SWITCH)) {
        letGo();
        buildPlanets(best);
      }
      for (const b of near?.bodies ?? []) b.update(t, camera);
      far.update(camera, dt);
    },
    reanchor(at) {
      group.position.set(o[0] - at[0], o[1] - at[1], o[2] - at[2]);
    },
    dispose() {
      letGo();
      for (const h of clouds) nebulae.remove(h);
      far.dispose();
      group.clear();
      for (const m of made) m.dispose();
      group.removeFromParent();
    },
    count() {
      let n = -1;
      group.traverse(() => n++);
      return n;
    },
  };
  api.reanchor([0, 0, 0]);
  return api;
}
