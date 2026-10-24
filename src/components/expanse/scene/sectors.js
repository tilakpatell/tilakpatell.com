// One loaded sector of the expanse (gen/sector.js's), drawn. Everything in
// it sits in the sector's own frame, its centre at nought, so the numbers
// in its buffers stay small however far out it is; the group is moved to
// where the sector is relative to the floating origin (reanchor). Each
// star is a small bright sphere in its own colour; from further off than
// where farStars.js has it real, it's a star on the sky instead, every star and
// wonder of the sector in one Points, one draw. A system's planets are
// built (galaxy/bodies.js, a look for each type) only when the camera comes
// within PLANET_NEAR of it, the nearest system's alone, and let go again
// past PLANET_NEAR × 1.3. The wonders are cheap: a nebula a cloud of soft
// additive puffs, a pulsar a small bright sphere, a derelict or a rogue
// world a small dark one. No textures.
//
// PLANET_NEAR, TYPE_LOOK: { [planet type]: LOOKS id }, MOON_LOOK: { [moon
//   type]: LOOKS id }, lookColour(id) → a look's colour as a whole ('#rrggbb')
// WONDER: { [kind]: how it looks }; WONDER_SPECK: a wonder's speck's radius,
//   a share of its size (where it's real goes by it: levels.js's realAt)
// createSector(sector, { tier = 'mid', skyFar = SKY_FAR, build = buildBody })
//   → { group, sector, update(t, dt, camera), reanchor(at), dispose(), count() }
//   The caller puts the group under a root at `at` and calls reanchor(at) whenever `at` moves.

import * as THREE from 'three';
import { LOOKS, buildBody } from '../../galaxy/bodies';
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
export const MOON_LOOK = { icy: 'hoth', rocky: 'moon-grey' };
// (its swatch: what a disc of it is drawn in, far off)
export const lookColour = (id) => (LOOKS[id] ?? LOOKS['moon-grey']).swatch;

// how a wonder looks as a speck, and as itself
export const WONDER = {
  nebula: { color: '#b48cff' },
  pulsar: { color: '#b8f4ff', r: 0.15 },
  derelict: { color: '#7a808c', r: 0.12, dark: '#2a2d33' },
  rogue: { color: '#6b5a50', r: 0.5, dark: '#1e1a18' },
};
export const WONDER_SPECK = 0.4;
const PUFFS = 48; // a nebula's

// shared by every sector, never disposed
const BALL = new THREE.SphereGeometry(1, 16, 12);

const PUFF_VERT = /* glsl */ `
  attribute float aSize;
  attribute vec3 aColor;
  uniform float uScale;
  varying vec3 vColor;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = clamp(aSize * uScale / max(-mv.z, 1.0), 1.0, 512.0);
    vColor = aColor;
  }
`;
const PUFF_FRAG = /* glsl */ `
  varying vec3 vColor;
  void main() {
    float d = length(gl_PointCoord * 2.0 - 1.0);
    if (d > 1.0) discard;
    float a = (1.0 - d) * (1.0 - d);
    gl_FragColor = vec4(vColor * a * 0.35, 1.0);
  }
`;

// a nebula: puffs scattered through a flattened ball `size` across, seeded
function nebula(w, made) {
  const rng = rngOf(w.seed);
  const pos = new Float32Array(PUFFS * 3);
  const size = new Float32Array(PUFFS);
  const col = new Float32Array(PUFFS * 3);
  const a = new THREE.Color(WONDER.nebula.color);
  const b = new THREE.Color().setHSL(rng(), 0.7, 0.55);
  const c = new THREE.Color();
  for (let i = 0; i < PUFFS; i++) {
    const u = rng() * 2 - 1;
    const th = rng() * Math.PI * 2;
    const r = w.size * Math.cbrt(rng());
    const s = Math.sqrt(1 - u * u);
    pos.set([r * s * Math.cos(th), r * u * 0.4, r * s * Math.sin(th)], i * 3);
    size[i] = w.size * (0.3 + rng() * 0.4);
    c.copy(a).lerp(b, rng());
    col.set([c.r, c.g, c.b], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.ShaderMaterial({
    vertexShader: PUFF_VERT,
    fragmentShader: PUFF_FRAG,
    uniforms: { uScale: { value: 500 } },
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  });
  const points = new THREE.Points(geo, mat);
  const px = new THREE.Vector2();
  points.onBeforeRender = (renderer, scene, camera) => {
    mat.uniforms.uScale.value = (renderer.getDrawingBufferSize(px).y / 2) * (camera.projectionMatrix.elements[5] || 1);
  };
  made.push(geo, mat);
  return points;
}

export function createSector(sector, { tier = 'mid', skyFar = SKY_FAR, build = buildBody } = {}) {
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

  // the wonders
  const wonders = sector.wonders.map((w) => {
    const look = WONDER[w.kind] ?? WONDER.rogue;
    let obj;
    if (w.kind === 'nebula') {
      obj = nebula(w, made);
      obj.position.set(...local(w.at));
    } else obj = ball('', local(w.at), w.size * look.r, look.dark ?? look.color);
    obj.name = `wonder:${w.id}`;
    group.add(obj);
    return obj;
  });

  // every star and wonder as a speck, from far off
  const far = createFarStars(group, {
    places: [
      ...sector.systems.map((s, i) => ({ id: s.id, at: local(s.at), r: s.star.size, color: s.star.color, group: stars[i] })),
      ...sector.wonders.map((w, i) => ({ id: w.id, at: local(w.at), r: w.size * WONDER_SPECK, color: (WONDER[w.kind] ?? WONDER.rogue).color, group: wonders[i] })),
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
