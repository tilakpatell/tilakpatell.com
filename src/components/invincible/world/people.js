// The people Mark meets about the city, modelled in code on the HQ games'
// humanoid kit (avengers/hq/kit/humanoid: rigid parts on a skeleton, one
// mesh per material): Atom Eve in her pink suit with the atom on her chest,
// who flies; Debbie on the porch at home; Cecil Stedman of the GDA, in his
// suit with an earpiece; Allen the Alien, one great eye and the Coalition's
// suit; and the townspeople, in their own colours. Mark, his father and
// Thragg are the page's HD figures (../cast.js), not these; and where the
// cast has a figure for one of these (Eve, Debbie, Cecil, Allen),
// `personFor` stands it in, keeping the kit's person as the fallback.
// Everyone, HD or kit, wears one finish (`castMaterial`), as Mark does.

import * as THREE from 'three';
import { buildHumanoid } from '../../avengers/hq/kit/humanoid';
import { limb, rbox, taper } from '../../avengers/hq/kit/shapes';
import { hot } from '../../avengers/hq/stage';
import { POSES, figure, loadFigure } from '../../../lib/three/rig';
import { CAST, asset } from '../cast';
import { GUARDIANS, guardianOf } from './guardians';

// ── one finish for the whole cast ──

// The style line's matte surfaces: rough and unmetallic, the sky's light
// only a hint on them, so a figure reads by its colours and not by the
// HDRI's reflections. The colour map a little richer (`saturation`: Meshy's
// atlases come out a shade grey under the city's light). And a rim of cool
// light where the surface turns from the eye (`rimPower`: the higher, the
// thinner), the show's back light, which lifts his outline off a busy
// street by day and off the dark at night; `rimTint` of it takes the
// surface's own colour, so it's light on the suit, not a neon line round it.
const FINISH = { roughness: 0.78, metalness: 0, env: 0.2, saturation: 1.1, rim: 0xdff1ff, rimPower: 2.5, rimTint: 0.25 };

const RIM_RGB = new THREE.Color(FINISH.rim)
  .toArray()
  .map((v) => v.toFixed(4))
  .join(', ');
const FINISH_KEY = `cast-${FINISH.saturation}-${FINISH.rimPower}-${FINISH.rimTint}-${FINISH.rim}`;

// each finished material's uRim (a WeakMap, not userData: Material.copy
// carries userData to a clone through JSON, which would mark a copy as done
// that never got the hook)
const FINISHED = new WeakMap();
// every castMaterial's rims, for setCastRim; and the level the next person
// made starts at, so one made after dark isn't lit as at noon
const RIMS = new Set();
let castRim = 0.35;

// The finish onto one lit material, after whatever hook it already has
// (the house look's, a facade's), on a program of its own.
function finish(m, uRim, uFloor) {
  m.roughness = FINISH.roughness;
  m.metalness = FINISH.metalness;
  m.envMapIntensity = FINISH.env;
  const before = m.onBeforeCompile;
  const key = Object.hasOwn(m, 'customProgramCacheKey') ? m.customProgramCacheKey : null;
  m.onBeforeCompile = (sh, r) => {
    before?.call(m, sh, r);
    sh.uniforms.uRim = uRim;
    sh.uniforms.uFloor = uFloor;
    sh.fragmentShader = sh.fragmentShader
      .replace('void main() {', 'uniform float uRim;\nuniform vec3 uFloor;\nvoid main() {')
      // (in linear light, on the map's texels only: a kit person's flat
      // colours are chosen as they are)
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        #ifdef USE_MAP
          diffuseColor.rgb = max(mix(vec3(dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722))), diffuseColor.rgb, ${FINISH.saturation.toFixed(3)}), 0.0);
          diffuseColor.rgb = max(diffuseColor.rgb, uFloor * (1.0 - smoothstep(0.02, 0.08, dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722)))));
        #endif`,
      )
      // the surface's own normal, not a normal map's, so the rim is an
      // edge and not a speckle; added before the fog, so it fades with him
      .replace(
        '#include <opaque_fragment>',
        `{
          vec3 castV = isOrthographic ? vec3(0.0, 0.0, 1.0) : normalize(vViewPosition);
          float castF = pow(1.0 - saturate(dot(nonPerturbedNormal, castV)), ${FINISH.rimPower.toFixed(3)});
          outgoingLight += vec3(${RIM_RGB}) * mix(vec3(1.0), diffuseColor.rgb, ${FINISH.rimTint.toFixed(3)}) * castF * uRim;
        }
        #include <opaque_fragment>`,
      );
  };
  m.customProgramCacheKey = () => `${key ? key.call(m) : String(before)}|${FINISH_KEY}`;
  m.needsUpdate = true;
  FINISHED.set(m, uRim);
}

// The finish on every lit material under `root` (a figure's model, a kit
// person's root: three's standard ones, the only lit kind the cast has),
// once each however often it's asked; its rim at `rim`. `floor` (a colour,
// or none) is the darkest its colour map's near-black texels go: a suit
// drawn black in the atlas sinks into a dark street or the night, his arms
// and legs gone, where the show's ink is a navy that still reads as blue.
// Returns { setRim(k) } for all of them, and dispose() to let them go from
// setCastRim's list.
export function castMaterial(root, { rim = 0.35, floor = null } = {}) {
  const uRim = { value: rim };
  const uFloor = { value: new THREE.Color(floor ?? 0x000000) };
  const rims = new Set([uRim]);
  root?.traverse?.((o) => {
    if (!o.isMesh) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      // (an unlit one, Eve's glowing atom, is left as it is)
      if (!m?.isMeshStandardMaterial) continue;
      const had = FINISHED.get(m);
      if (had) rims.add(had);
      else finish(m, uRim, uFloor);
    }
  });
  const cast = {
    setRim(k) {
      for (const u of rims) u.value = k;
    },
    dispose() {
      RIMS.delete(cast);
    },
  };
  cast.setRim(rim);
  RIMS.add(cast);
  return cast;
}

// Every rim castMaterial made (the crowd's, and whoever the scene cast),
// and everyone made from now on: the time of day's level.
export function setCastRim(k) {
  castRim = k;
  for (const c of RIMS) c.setRim(k);
}

const ball = (r, w = 10, h = 8) => new THREE.SphereGeometry(r, Math.min(w, 12), Math.min(h, 9));

// a slimmer frame (the kit's own, as for Natasha)
const SLIM = {
  hips: [null, 0, 1.0, 0],
  spine: ['hips', 0, 0.11, 0],
  chest: ['spine', 0, 0.19, 0],
  neck: ['chest', 0, 0.27, 0],
  head: ['neck', 0, 0.08, 0],
  shoulderL: ['chest', 0.185, 0.2, 0],
  elbowL: ['shoulderL', 0, -0.28, 0],
  handL: ['elbowL', 0, -0.25, 0],
  shoulderR: ['chest', -0.185, 0.2, 0],
  elbowR: ['shoulderR', 0, -0.28, 0],
  handR: ['elbowR', 0, -0.25, 0],
  thighL: ['hips', 0.09, -0.05, 0],
  kneeL: ['thighL', 0, -0.45, 0],
  footL: ['kneeL', 0, -0.45, 0],
  thighR: ['hips', -0.09, -0.05, 0],
  kneeR: ['thighR', 0, -0.45, 0],
  footR: ['kneeR', 0, -0.45, 0],
};
// and a broader one (Cecil, Allen)
const BROAD = {
  ...SLIM,
  spine: ['hips', 0, 0.12, 0],
  chest: ['spine', 0, 0.2, 0],
  neck: ['chest', 0, 0.3, 0],
  shoulderL: ['chest', 0.25, 0.22, 0],
  elbowL: ['shoulderL', 0, -0.3, 0],
  handL: ['elbowL', 0, -0.27, 0],
  shoulderR: ['chest', -0.25, 0.22, 0],
  elbowR: ['shoulderR', 0, -0.3, 0],
  handR: ['elbowR', 0, -0.27, 0],
  thighL: ['hips', 0.11, -0.05, 0],
  thighR: ['hips', -0.11, -0.05, 0],
  kneeL: ['thighL', 0, -0.44, 0],
  footL: ['kneeL', 0, -0.44, 0],
  kneeR: ['thighR', 0, -0.44, 0],
  footR: ['kneeR', 0, -0.44, 0],
};

// ── the parts every person has, in their materials ──
// torso: { top, bottom } keys; slim or broad
function body(add, { top = 'top', bottom = 'bottom', shoe = 'shoe', skin = 'skin', hand = 'skin', slim = true, sleeve = top }) {
  const w = slim ? 1 : 1.18;
  add('hips', bottom, taper(rbox(0.28 * w, 0.2, 0.19, 0.08), 1.04, 0.9), { p: [0, -0.035, 0] });
  for (const sd of [-1, 1]) add('hips', bottom, ball(0.08 * w, 14, 10), { p: [sd * 0.088 * w, -0.07, 0] });
  add('spine', top, new THREE.CylinderGeometry(0.1 * w, 0.112 * w, 0.2, 16), { p: [0, 0.09, 0] });
  add('chest', top, taper(rbox(0.32 * w, 0.3, 0.2 * (slim ? 1 : 1.12), 0.09), 0.8, 1), { p: [0, 0.13, 0] });
  if (slim) for (const sd of [-1, 1]) add('chest', top, ball(0.06, 12, 10), { p: [sd * 0.055, 0.135, 0.068], s: [1, 0.88, 0.72] });
  for (const sd of [-1, 1]) add('chest', top, ball(0.07 * w, 14, 10), { p: [sd * 0.15 * w, 0.25, -0.005], s: [1, 0.8, 1] });
  add('neck', skin, new THREE.CylinderGeometry(0.036 * w, 0.042 * w, 0.09, 12), { p: [0, 0.035, 0] });
  for (const [sh, el, ha, sd] of [
    ['shoulderL', 'elbowL', 'handL', 1],
    ['shoulderR', 'elbowR', 'handR', -1],
  ]) {
    add(sh, sleeve, ball(0.054 * w, 14, 10), { p: [sd * 0.004, -0.005, 0] });
    add(sh, sleeve, limb(0.05 * w, 0.28, 0.042 * w), { p: [0, -0.28, 0] });
    add(el, sleeve, ball(0.041 * w, 12, 10));
    add(el, sleeve, limb(0.042 * w, 0.24, 0.033 * w), { p: [0, -0.24, 0] });
    add(ha, hand, rbox(0.05 * w, 0.085, 0.03, 0.013), { p: [0, -0.045, 0] });
  }
  for (const [th, kn, ft] of [
    ['thighL', 'kneeL', 'footL'],
    ['thighR', 'kneeR', 'footR'],
  ]) {
    add(th, bottom, limb(0.082 * w, 0.45, 0.056 * w), { p: [0, -0.45, 0] });
    add(kn, bottom, ball(0.054 * w, 12, 10));
    add(kn, bottom, limb(0.056 * w, 0.44, 0.04 * w), { p: [0, -0.44, 0] });
    add(ft, shoe, taper(rbox(0.078 * w, 0.07, 0.21, 0.026), 1, 0.85, { axis: 'z' }), { p: [0, -0.02, 0.035] });
  }
}
// a face: the head, a jaw, a nose, eyes
function face(add, { skin = 'skin', w = 1 } = {}) {
  add('head', skin, ball(0.086 * w, 22, 18), { p: [0, 0.1, 0.01], s: [0.88, 1.12, 1] });
  add('head', skin, rbox(0.096 * w, 0.05, 0.08, 0.025), { p: [0, 0.045, 0.03] });
  add('head', skin, ball(0.012, 8, 6), { p: [0, 0.092, 0.093] });
  for (const sd of [-1, 1]) {
    add('head', 'dark', ball(0.009, 8, 6), { p: [sd * 0.028, 0.112, 0.082] });
    add('head', skin, ball(0.018, 8, 6), { p: [sd * 0.083 * w, 0.1, 0.0], s: [0.5, 1, 0.8] }); // ears
  }
}

const STYLES = {
  // Atom Eve: the pink suit, a darker magenta down the sides and on the
  // gloves and boots, the atom on her chest, red hair up in a tail
  eve(add) {
    body(add, { top: 'suit', bottom: 'suit', shoe: 'trim', hand: 'trim', sleeve: 'suit' });
    for (const sd of [-1, 1]) add('chest', 'trim', rbox(0.025, 0.26, 0.17, 0.01), { p: [sd * 0.148, 0.12, 0], r: [0, 0, sd * 0.14] });
    for (const sd of [-1, 1]) add('hips', 'trim', rbox(0.03, 0.16, 0.18, 0.01), { p: [sd * 0.13, -0.03, 0] });
    for (const el of ['elbowL', 'elbowR']) add(el, 'trim', limb(0.045, 0.14, 0.036), { p: [0, -0.24, 0] });
    for (const kn of ['kneeL', 'kneeR']) add(kn, 'trim', limb(0.06, 0.26, 0.044), { p: [0, -0.44, 0] });
    // the atom: a glowing nucleus, three rings round it
    add('chest', 'glow', ball(0.022, 12, 10), { p: [0, 0.17, 0.112] });
    for (let i = 0; i < 3; i++) add('chest', 'glow', new THREE.TorusGeometry(0.055, 0.006, 6, 28), { p: [0, 0.17, 0.11], r: [0, 0, (i * Math.PI) / 3], s: [1, 0.42, 1] });
    face(add);
    // the hair: a crown, swept up, and the tail
    add('head', 'hair', ball(0.096, 22, 16), { p: [0, 0.13, -0.012], s: [1.0, 0.95, 1.06] });
    add('head', 'hair', ball(0.05, 12, 10), { p: [0.02, 0.19, 0.05], s: [1.5, 0.5, 0.9], r: [0.3, 0, -0.2] });
    add('head', 'hair', ball(0.05, 12, 10), { p: [0, 0.16, -0.1], s: [0.9, 0.9, 0.9] });
    add('head', 'hair', limb(0.035, 0.2, 0.015, 10), { p: [0, 0.16, -0.12], r: [2.6, 0, 0] });
    for (const sd of [-1, 1]) add('head', 'hair', ball(0.04, 10, 8), { p: [sd * 0.08, 0.08, 0.0], s: [0.45, 1.3, 0.9] });
  },

  // Debbie at home: a teal cardigan over a white top, slacks, flats, her
  // brown hair to her jaw
  debbie(add) {
    body(add, { top: 'top', bottom: 'bottom', shoe: 'shoe', sleeve: 'top' });
    add('chest', 'shirt', rbox(0.1, 0.24, 0.02, 0.01), { p: [0, 0.14, 0.1] });
    add('chest', 'shirt', new THREE.CylinderGeometry(0.05, 0.065, 0.06, 14), { p: [0, 0.29, 0] });
    face(add);
    add('head', 'hair', ball(0.097, 22, 16), { p: [0, 0.125, -0.014], s: [1.02, 1.0, 1.08] });
    add('head', 'hair', ball(0.097, 18, 14), { p: [0, 0.07, -0.04], s: [1.1, 1.05, 0.85] });
    for (const sd of [-1, 1]) add('head', 'hair', ball(0.05, 12, 10), { p: [sd * 0.084, 0.06, 0.0], s: [0.5, 1.4, 1] });
    add('head', 'hair', ball(0.055, 14, 10), { p: [-0.03, 0.18, 0.05], s: [1.4, 0.45, 0.8], r: [0.35, 0, 0.3] });
  },

  // Cecil Stedman: a broad man in a dark suit, a white shirt and dark tie,
  // bald, a grey moustache and an earpiece
  cecil(add) {
    body(add, { top: 'suit', bottom: 'suit', shoe: 'shoe', slim: false, sleeve: 'suit' });
    add('chest', 'shirt', taper(rbox(0.1, 0.26, 0.02, 0.008), 0.4, 1), { p: [0, 0.14, 0.112] });
    add('chest', 'tie', taper(rbox(0.04, 0.22, 0.01, 0.004), 0.6, 1), { p: [0, 0.13, 0.124] });
    for (const sd of [-1, 1]) add('chest', 'suit', rbox(0.06, 0.2, 0.012, 0.005), { p: [sd * 0.05, 0.17, 0.118], r: [0, 0, sd * 0.35] }); // lapels
    face(add, { w: 1.08 });
    add('head', 'skin', ball(0.09, 20, 14), { p: [0, 0.15, -0.006], s: [0.92, 0.95, 1.02] }); // the bald crown
    add('head', 'grey', rbox(0.06, 0.012, 0.016, 0.005), { p: [0, 0.07, 0.093] });
    add('head', 'dark', ball(0.012, 8, 6), { p: [-0.09, 0.1, 0.01] }); // the earpiece
  },

  // Allen the Alien: big and blue, one great eye, the Coalition's suit
  allen(add) {
    body(add, { top: 'suit', bottom: 'suit', shoe: 'trim', hand: 'skin', slim: false, sleeve: 'suit' });
    add('chest', 'trim', rbox(0.3, 0.06, 0.24, 0.02), { p: [0, 0.27, 0] });
    add('hips', 'trim', rbox(0.34, 0.04, 0.22, 0.014), { p: [0, 0.05, 0] });
    for (const sd of [-1, 1]) add('chest', 'trim', rbox(0.04, 0.24, 0.2, 0.01), { p: [sd * 0.17, 0.12, 0] });
    add('head', 'skin', ball(0.1, 22, 18), { p: [0, 0.11, 0.0], s: [1, 1.15, 1] });
    add('head', 'white', ball(0.052, 18, 14), { p: [0, 0.13, 0.07], s: [1.25, 1, 0.7] });
    add('head', 'dark', ball(0.026, 12, 10), { p: [0, 0.13, 0.1] });
    add('head', 'skin', rbox(0.1, 0.04, 0.06, 0.02), { p: [0, 0.05, 0.05] });
  },

  // a townsperson: a top, trousers or a skirt, shoes, hair
  person(add) {
    body(add, { top: 'top', bottom: 'bottom', shoe: 'shoe', sleeve: 'top' });
    face(add);
    add('head', 'hair', ball(0.094, 20, 14), { p: [0, 0.135, -0.014], s: [1.02, 0.8, 1.06] });
  },
};

const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.65, ...o });

// Each person's materials.
const DRESS = {
  eve: () => ({ suit: mat(0xec5fae, { roughness: 0.45 }), trim: mat(0x9c1f6c, { roughness: 0.45 }), skin: mat(0xf0c4a8), hair: mat(0xc2421f), dark: mat(0x22181a), glow: new THREE.MeshBasicMaterial({ color: hot(0xffb6e6, 2.6), toneMapped: false }) }),
  debbie: () => ({ top: mat(0x2f8a87), shirt: mat(0xf1efe9), bottom: mat(0xb9a98c), shoe: mat(0x3a2c24), skin: mat(0xf0c8ae), hair: mat(0x5a3a26), dark: mat(0x22181a) }),
  cecil: () => ({ suit: mat(0x23262d, { roughness: 0.55 }), shirt: mat(0xf3f3f0), tie: mat(0x1a1d24), shoe: mat(0x111214, { roughness: 0.3 }), skin: mat(0xd9a888), grey: mat(0x8f8b86), dark: mat(0x0d0d0f) }),
  allen: () => ({ suit: mat(0xdfe3e6, { roughness: 0.4 }), trim: mat(0x2b6b52, { roughness: 0.4 }), skin: mat(0x3e7fd4, { roughness: 0.5 }), white: mat(0xf4f4f0, { roughness: 0.2 }), dark: mat(0x0b0b10) }),
};
// ── the Guardians of the Globe (./guardians.js): each a body in the team's
// tint with its trim on the gloves, boots and belt and a glowing badge on the
// chest, until a model of their own lands (a gen3d issue each); Robot a
// drone: a visor for a face, an aerial, no hair ──
const guardianDress = (g) => ({ suit: mat(g.tint, { roughness: 0.5 }), trim: mat(g.trim, { roughness: 0.45 }), skin: mat(g.skin ?? 0xe0ac8a), hair: mat(g.hair ?? 0x2a1d17), dark: mat(0x1a1416), glow: new THREE.MeshBasicMaterial({ color: hot(g.trim, 1.8), toneMapped: false }) });
STYLES.guardian = (add) => {
  body(add, { top: 'suit', bottom: 'suit', shoe: 'trim', hand: 'trim', sleeve: 'suit' });
  add('hips', 'trim', rbox(0.3, 0.05, 0.2, 0.012), { p: [0, 0.04, 0] }); // the belt
  for (const el of ['elbowL', 'elbowR']) add(el, 'trim', limb(0.045, 0.12, 0.036), { p: [0, -0.24, 0] }); // the gloves
  for (const kn of ['kneeL', 'kneeR']) add(kn, 'trim', limb(0.06, 0.22, 0.044), { p: [0, -0.44, 0] }); // the boots
  add('chest', 'glow', ball(0.03, 12, 10), { p: [0, 0.17, 0.112], s: [1, 1, 0.5] }); // the badge
  face(add);
  add('head', 'hair', ball(0.094, 20, 14), { p: [0, 0.135, -0.014], s: [1.02, 0.8, 1.06] });
};
STYLES.robot = (add) => {
  body(add, { top: 'suit', bottom: 'suit', shoe: 'trim', hand: 'trim', slim: false, sleeve: 'suit' });
  add('chest', 'trim', rbox(0.3, 0.06, 0.24, 0.02), { p: [0, 0.27, 0] });
  add('head', 'suit', ball(0.095, 22, 18), { p: [0, 0.1, 0.01], s: [0.92, 1.05, 1] });
  add('head', 'glow', rbox(0.11, 0.03, 0.02, 0.008), { p: [0, 0.11, 0.085] }); // the visor
  add('head', 'trim', limb(0.008, 0.12, 0.006, 6), { p: [0.05, 0.3, 0] }); // the aerial
  add('head', 'glow', ball(0.014, 8, 6), { p: [0.05, 0.31, 0] });
};
// Mars (./offworld/marsScene.js): an astronaut in a white suit with a gold visor, and the
// host, a Martian in grey-green with the Sequids' purple on him (kit figures, each with a gen3d issue)
DRESS.astronaut = () => ({ suit: mat(0xf2f2ee, { roughness: 0.5 }), trim: mat(0x9aa3ad, { roughness: 0.4 }), skin: mat(0xf0c4a8), hair: mat(0x2a1d17), dark: mat(0x1a1416), glow: new THREE.MeshBasicMaterial({ color: hot(0xe6b84a, 1.4), toneMapped: false }) });
DRESS.host = () => ({ suit: mat(0x5f7a66, { roughness: 0.7 }), trim: mat(0x6a3a9a, { roughness: 0.5 }), skin: mat(0x8fa892), hair: mat(0x3a2a4a), dark: mat(0x1a1416), glow: new THREE.MeshBasicMaterial({ color: hot(0xb04dff, 2), toneMapped: false }) });
STYLES.astronaut = (add) => {
  body(add, { top: 'suit', bottom: 'suit', shoe: 'trim', hand: 'trim', slim: false, sleeve: 'suit' });
  add('chest', 'trim', rbox(0.3, 0.2, 0.12, 0.03), { p: [0, 0.12, -0.14] }); // the pack
  add('head', 'suit', ball(0.12, 20, 16), { p: [0, 0.1, 0] }); // the helmet
  add('head', 'glow', ball(0.1, 16, 12), { p: [0, 0.1, 0.03], s: [0.85, 0.8, 0.6] }); // its visor
};
STYLES.host = (add) => {
  body(add, { top: 'suit', bottom: 'suit', shoe: 'trim', hand: 'skin', slim: false, sleeve: 'suit' });
  for (const sd of [-1, 1]) add('chest', 'glow', ball(0.04, 10, 8), { p: [sd * 0.12, 0.22, 0.08] }); // the Sequids on him
  add('head', 'skin', ball(0.1, 20, 16), { p: [0, 0.1, 0], s: [1, 1.2, 1] });
  for (const sd of [-1, 1]) add('head', 'dark', ball(0.016, 8, 6), { p: [sd * 0.035, 0.12, 0.085] });
  add('head', 'glow', ball(0.05, 10, 8), { p: [0, 0.22, -0.02], s: [1.6, 0.6, 1.2] }); // one riding his crown
};
for (const g of GUARDIANS) {
  DRESS[g.id] = () => guardianDress(g);
  STYLES[g.id] = g.id === 'robot' ? STYLES.robot : STYLES.guardian;
}

const TOPS = [0xc94b3a, 0x3a6fb5, 0x2f8a5f, 0xe2b13c, 0x7a4fa0, 0xe8e6e0, 0x2c2f36, 0xd67b3a, 0x4fa3b8];
const BOTTOMS = [0x2c3a55, 0x3b3b3e, 0x6b5a45, 0x1d1f24, 0x8a7c66, 0x41556b];
const SKINS = [0xf2cfb4, 0xe0ac8a, 0xc68863, 0x9b6747, 0x6e4632, 0xf5d7c2];
const HAIRS = [0x1d1612, 0x4a3020, 0x7a5232, 0xc49a5a, 0x8a8a88, 0x2a1d17];

// One person: { h (the kit's figure), kind, height, materials, cast (its
// castMaterial) }. `seed` picks a townsperson's colours.
export function buildPerson(kind, seed = 0) {
  const pick = (list, k) => list[Math.floor(Math.abs(Math.sin(seed * 12.9898 + k * 78.233)) * 43758.5453) % list.length];
  const materials =
    DRESS[kind]?.() ??
    {
      top: mat(pick(TOPS, 1)),
      bottom: mat(pick(BOTTOMS, 2)),
      shoe: mat(0x222224),
      skin: mat(pick(SKINS, 3)),
      hair: mat(pick(HAIRS, 4)),
      dark: mat(0x1a1416),
    };
  const g = guardianOf(kind);
  const joints = kind === 'cecil' || kind === 'allen' || kind === 'astronaut' || kind === 'host' || g?.broad ? BROAD : SLIM;
  const scale = { eve: 0.88, debbie: 0.88, cecil: 0.95, allen: 1.12 }[kind] ?? (g ? (g.broad ? 1.02 : 0.94) : 0.86 + (seed % 5) * 0.03);
  const h = buildHumanoid({ style: STYLES[kind] ?? STYLES.person, materials, scale, joints });
  return { h, kind, height: h.height, materials, cast: castMaterial(h.root, { rim: castRim }) };
}

const set = (b, x = 0, y = 0, z = 0) => b.rotation.set(x, y, z);

// Pose a person: 'idle' (weight shifting), 'walk', 'wave', 'talk' (hands
// moving), 'hover' (in the air, legs loose), 'fly' (flat out: the root is
// turned along the flight by the caller, so in the figure's frame he or she
// points up: one arm ahead, the other along the side, legs trailing).
export function posePerson(person, { mode = 'idle', t = 0, phase = 0 } = {}) {
  const h = person.h;
  const b = h.bones;
  const k = t + phase;
  b.hips.position.copy(h.rest.hips);
  for (const n of Object.keys(b)) b[n].rotation.set(0, 0, 0);
  if (mode === 'walk') {
    const s = Math.sin(k * 5.5);
    const c = Math.cos(k * 5.5);
    b.hips.position.y = h.rest.hips.y - Math.abs(c) * 0.02 * h.scale;
    set(b.hips, 0.04, s * 0.06, 0);
    set(b.thighL, -s * 0.42, 0, 0.03);
    set(b.thighR, s * 0.42, 0, -0.03);
    set(b.kneeL, Math.max(0, c) * 0.6 + 0.05);
    set(b.kneeR, Math.max(0, -c) * 0.6 + 0.05);
    set(b.shoulderL, s * 0.35, 0, 0.08);
    set(b.shoulderR, -s * 0.35, 0, -0.08);
    set(b.elbowL, -0.25);
    set(b.elbowR, -0.25);
    return;
  }
  if (mode === 'hover' || mode === 'fly') {
    const bob = Math.sin(k * 1.7);
    if (mode === 'fly') {
      set(b.shoulderR, -Math.PI + 0.12, 0, 0.05); // the lead arm, ahead
      set(b.elbowR, -0.05);
      set(b.shoulderL, 0.15, 0, 0.12);
      set(b.elbowL, -0.2);
      set(b.thighL, 0.06 + bob * 0.03, 0, 0.03);
      set(b.thighR, 0.0 - bob * 0.03, 0, -0.03);
      set(b.kneeL, 0.25);
      set(b.kneeR, 0.15);
      set(b.footL, 0.5);
      set(b.footR, 0.5);
    } else {
      set(b.thighL, -0.1 + bob * 0.05, 0, 0.05);
      set(b.thighR, -0.02 - bob * 0.05, 0, -0.05);
      set(b.kneeL, 0.45);
      set(b.kneeR, 0.3);
      set(b.footL, 0.4);
      set(b.footR, 0.35);
      set(b.shoulderL, 0.1 + bob * 0.05, 0, 0.3);
      set(b.shoulderR, 0.1 - bob * 0.05, 0, -0.3);
      set(b.elbowL, -0.4);
      set(b.elbowR, -0.4);
      set(b.head, 0.05, Math.sin(k * 0.6) * 0.2, 0);
    }
    return;
  }
  // standing: weight shifting from foot to foot, breathing
  const sway = Math.sin(k * 0.8);
  set(b.hips, 0, 0, sway * 0.03);
  set(b.spine, 0.02 + Math.sin(k * 1.9) * 0.01, 0, -sway * 0.02);
  set(b.thighL, 0, 0, 0.04 + sway * 0.02);
  set(b.thighR, 0, 0, -0.04 + sway * 0.02);
  set(b.shoulderL, 0.05, 0, 0.12);
  set(b.shoulderR, 0.05, 0, -0.12);
  set(b.elbowL, -0.18);
  set(b.elbowR, -0.18);
  set(b.head, 0, Math.sin(k * 0.37) * 0.25, 0);
  if (mode === 'wave') {
    set(b.shoulderR, -0.3, 0, -2.5);
    set(b.elbowR, 0, 0, -0.6 + Math.sin(k * 9) * 0.35);
  } else if (mode === 'talk') {
    set(b.shoulderL, -0.3 + Math.sin(k * 2.3) * 0.15, 0, 0.18);
    set(b.elbowL, -1.1 + Math.sin(k * 3.1) * 0.25);
    set(b.shoulderR, -0.2 + Math.sin(k * 1.7 + 1) * 0.12, 0, -0.18);
    set(b.elbowR, -0.9 + Math.sin(k * 2.6) * 0.2);
  } else if (mode === 'arms') {
    // arms folded
    set(b.shoulderL, -0.55, 0.5, 0.3);
    set(b.elbowL, -1.9, 0.2, 0);
    set(b.shoulderR, -0.55, -0.5, -0.3);
    set(b.elbowR, -1.9, -0.2, 0);
  }
}

// ── the HD figures (../cast.js), standing in for the kit's people ──

// The templates for `names`, each null when its model can't be had (so the
// kit's person stands in): { [name]: template | null }.
export async function loadCast(names) {
  const got = await Promise.all(names.map((n) => loadFigure(asset(CAST[n].file)).catch(() => null)));
  return Object.fromEntries(names.map((n, i) => [n, got[i]]));
}

// the clip (scripts/meshy-invincible.mjs's CLIPS) each of the kit's modes plays
const CLIP_OF = { idle: 'idle', walk: 'walk', run: 'run', wave: 'wave', talk: 'talk', phone: 'phone', cheer: 'cheer', hover: 'hover', fly: 'fly' };

// the bones a person's poses need
const NEED = ['hips', 'armL', 'foreL', 'armR', 'foreR', 'thighL', 'calfL', 'thighR', 'calfR'];

// A figure in the kit's modes, in the figure's frame (+x its left, +z ahead).
function figurePose(mode, k) {
  const s = Math.sin(k * 0.8);
  const base = { ...POSES.stand, torso: { pitch: 0.02, yaw: Math.sin(k * 0.37) * 0.08, roll: s * 0.02 } };
  if (mode === 'walk') return POSES.stride(k * 5.5 / (2 * Math.PI), 1, 0);
  if (mode === 'hover') return POSES.hover(k);
  if (mode === 'fly') return POSES.fly();
  if (mode === 'wave') return { ...base, armR: [-0.75, 0.65, 0.1], foreR: [-0.15 + Math.sin(k * 9) * 0.35, 1, 0.1] };
  if (mode === 'talk') return { ...base, armL: [0.25, -1, 0.25], foreL: [0.15, 0.1 + Math.sin(k * 3.1) * 0.25, 1], armR: [-0.25, -1, 0.2], foreR: [-0.15, 0.05 + Math.sin(k * 2.6) * 0.2, 1] };
  if (mode === 'arms') return { ...base, armL: [0.35, -0.85, 0.45], foreL: [-1, 0.12, 0.3], armR: [-0.35, -0.85, 0.42], foreR: [1, 0.2, 0.32] };
  return base;
}

// One of the town's people, as the world places and poses them, the HD
// figure when there is one and it can be posed, else the kit's:
// { root (its hips at its origin), hipY, height, pose({ mode, t, phase }, dt) }.
export function personFor(kind, seed, template = null, spec = CAST[kind]) {
  if (template && spec) {
    try {
      const f = figure(template, spec);
      for (const b of NEED) if (!f.bones[b]) throw new Error(`${spec.file}: no bone ${b}`);
      f.snap(figurePose('idle', 0));
      const cast = castMaterial(f.model, { rim: castRim });
      // its motion-captured clip for a mode where it has one (arms folded
      // has none: posed), started somewhere of its own in it
      const pose = ({ mode = 'idle', t = 0, phase = 0 }, dt = 1 / 60) => {
        if (!(CLIP_OF[mode] && f.act(CLIP_OF[mode], { at: phase * 0.37, fade: 0.4 }))) f.pose(figurePose(mode, t + phase), dt, 10);
        f.tick(dt);
      };
      const dispose = () => {
        cast.dispose();
        f.dispose();
      };
      return { root: f.holder, hipY: f.hipHeight, height: f.height, fig: f, clips: f.clips, pose, cast, dispose };
    } catch (e) {
      if (import.meta.env?.DEV) console.warn(String(e.message ?? e)); // the kit's person stands in, not a T-pose
    }
  }
  const p = buildPerson(kind, seed);
  const hipY = p.h.rest.hips.y;
  p.h.root.position.y = -hipY;
  const root = new THREE.Group();
  root.add(p.h.root);
  return { root, hipY, height: p.height, kit: p, clips: [], pose: (o) => posePerson(p, o), cast: p.cast, dispose: () => p.cast.dispose() };
}
