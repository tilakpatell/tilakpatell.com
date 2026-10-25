// One loaded sector of the expanse (gen/sector.js's), drawn: its nebulae.
// Everything in it sits in the sector's own frame, its centre at nought, so
// the numbers in its buffers stay small however far out it is; the group is
// moved to where the sector is (reanchor). A nebula is a cloud of soft
// additive puffs, and it has no disc: its cloud shows while all of it is
// within the far plane (FAR less its size), fading over the last fifth of
// that as its speck comes in. No textures. The other wonders (a pulsar a
// small bright sphere, a derelict or a rogue world a small dark one) are
// near things (nearThings.js), built within where they're real (levels.js's
// realAt, of their specks), and discs (discs.js) or specks past that.
//
// Its stars are the far layer's (universe/farStars.js): slotOf gives the
// sector's stars and wonders as a slot of specks, for past the far plane;
// within it they're discs (discs.js), and within a system's reach the
// system's built whole (near.js), in the looks below, which all three share.
//
// TYPE_LOOK: { [planet type]: LOOKS id }, MOON_LOOK: { [moon type]: LOOKS
//   id }, lookColour(id) → a look's colour as a whole ('#rrggbb')
// WONDER, WONDER_SPECK, slotOf: specks.js's (pure, so the sector worker
//   makes a sector's specks too), lent here as they always were
// createSector(sector) → { group, sector, update(t, dt, camera), reanchor(at), dispose(), count() }
//   The caller puts the group under a root at `at` and calls reanchor(at) whenever `at` moves.

import * as THREE from 'three';
import { LOOKS } from '../../galaxy/shared/bodies';
import { rngOf } from '../gen/seed';
import { FAR, levelWeights } from './levels';
import { WONDER } from './specks';

export { WONDER, WONDER_SPECK, slotOf } from './specks';

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

const PUFFS = 48; // a nebula's

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

// a cloud's material, faded as a whole without a change to its shader: added
// as before (its alpha is one), times its blend's constant alpha
function fading(mat) {
  mat.blending = THREE.CustomBlending;
  mat.blendEquation = THREE.AddEquation;
  mat.blendSrc = mat.blendSrcAlpha = THREE.ConstantAlphaFactor;
  mat.blendDst = mat.blendDstAlpha = THREE.OneFactor;
  mat.blendAlpha = 1;
  return mat;
}

export function createSector(sector) {
  const o = sector.origin;
  const local = (p) => [p[0] - o[0], p[1] - o[1], p[2] - o[2]];
  const group = new THREE.Group();
  group.name = `sector:${sector.id}`;
  const made = []; // geometries and materials, this sector's own

  // the nebulae
  const nebulae = sector.wonders.filter((w) => w.kind === 'nebula');
  const wonders = nebulae.map((w) => {
    const obj = nebula(w, made);
    obj.position.set(...local(w.at));
    obj.name = `wonder:${w.id}`;
    group.add(obj);
    return obj;
  });
  // (a nebula has no disc: its cloud stands for it while all of it is
  // within the far plane, fading over the last fifth of that, as its speck
  // comes in over the far plane's)
  const real = nebulae.map((w) => FAR - w.size);
  const clouds = wonders.map((obj) => fading(obj.material));

  const cam = new THREE.Vector3();
  const REACH = { reach: 0 };
  const W = { full: 0, disc: 0, speck: 0 };
  const api = {
    group,
    sector,
    update(t, dt, camera) {
      group.updateWorldMatrix(true, false);
      group.worldToLocal(camera.getWorldPosition(cam));
      wonders.forEach((obj, i) => {
        const d = obj.position.distanceTo(cam);
        obj.visible = d < real[i];
        if (obj.visible) {
          REACH.reach = real[i];
          clouds[i].blendAlpha = levelWeights(d, REACH, W).full;
        }
      });
    },
    reanchor(at) {
      group.position.set(o[0] - at[0], o[1] - at[1], o[2] - at[2]);
    },
    dispose() {
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
