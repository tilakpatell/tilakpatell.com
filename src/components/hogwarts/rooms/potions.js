// The Potions dungeon (the design’s §4.4): low, cold and vaulted, squat
// pillars down it, the stone benches in rows with a cauldron on a brazier at
// every place, something different simmering in each and the steam going
// up into the dark; the walls shelved to the vault with jars of things
// pickled and powdered (parts/shelves.js); the store cupboard by the door;
// Snape at his desk at the front under the board with the day’s recipe in
// chalk. One place at the front bench is left bare: the lesson’s (Lane E’s
// play/lessons/potions.js sets its own cauldron there), its door the
// room’s `lessons.potions` hook.

import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { attribute, float, fract, mix, mx_fractal_noise_float, positionWorld, sin, smoothstep, time, uv, vec3, length } from 'three/tsl';
import { CURE_FOR_BOILS } from '../rules/potions';
import { LINES, NAMES } from '../rules/lines';
import { bookcase, chair } from './parts/furniture';
import { commonRoom, flat, lessonDoor, paintChalk } from './common/shared';
import { createJars } from './parts/shelves';
import { figure } from '../cast/figures';
import { instanced } from './kit';

const W = 8;
const L = 11;
const H = 4.4;
const RISE = 1.8; // m the vault rises over the walls
const ROWS = [-4, 1, 6]; // z of the benches
const PLACES = [-5.8, -2.6, 2.6, 5.8]; // x of a cauldron along a bench
const LESSON = { x: 2.6, z: -4 }; // the bare place at the front bench
export const CAULDRONS = ROWS.flatMap((z) => PLACES.map((x) => ({ x, z }))).filter((c) => !(c.x === LESSON.x && c.z === LESSON.z));
const BREW = ['#5fae4a', '#9a6ad8', '#d89a3a', '#3aa8a0', '#b8c86a', '#c84a5a', '#7a9a3a', '#e8d8b8', '#4a6ad8', '#a8e04a', '#d86aa8'];

// a cauldron’s side: the lip, the belly, the foot (turned on a lathe)
const POT = [[0.02, 0], [0.16, 0.01], [0.27, 0.07], [0.33, 0.17], [0.34, 0.27], [0.31, 0.37], [0.27, 0.42], [0.3, 0.44], [0.3, 0.46]].map(([x, y]) => new THREE.Vector2(x, y));

// what simmers: its own colour, a slow swirl and bubbles breaking on it
function brewMaterial() {
  const m = new MeshBasicNodeMaterial({ fog: false });
  m.userData.noHouse = true;
  const p = uv().sub(0.5);
  const r = length(p).mul(2);
  const swirl = mx_fractal_noise_float(vec3(positionWorld.x.mul(6), positionWorld.z.mul(6), time.mul(0.35)), 3).mul(0.5).add(0.5);
  const bubble = smoothstep(0.82, 0.9, fract(mx_fractal_noise_float(vec3(positionWorld.x.mul(14), positionWorld.z.mul(14), time.mul(0.9)), 1).mul(3)));
  // (the instance’s own colour multiplies this, as three does for an instanced mesh)
  m.colorNode = vec3(1, 1, 1).mul(mix(float(0.55), float(1.15), swirl)).add(bubble.mul(0.35)).mul(smoothstep(1.0, 0.85, r).mul(0.6).add(0.4));
  return m;
}

// the steam: soft cards rising from each cauldron, each on its own clock
function steamMaterial() {
  const m = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending });
  m.userData.noHouse = true;
  const s = attribute('aSteam', 'vec2');
  const life = fract(time.mul(0.16).add(s.x));
  const r = length(uv().sub(0.5)).mul(2);
  const wisp = smoothstep(1, 0.1, r).mul(mx_fractal_noise_float(vec3(uv().mul(3), time.mul(0.3).add(s.y)), 2).mul(0.5).add(0.6));
  m.colorNode = vec3(0.75, 0.8, 0.72).mul(wisp).mul(smoothstep(0, 0.15, life)).mul(smoothstep(1, 0.5, life)).mul(0.16);
  m.positionNode = attribute('position', 'vec3').mul(life.mul(1.6).add(0.6)).add(vec3(sin(time.mul(0.7).add(s.y.mul(6))).mul(0.12), life.mul(1.7), 0));
  return m;
}

export default commonRoom({
  id: 'potions',
  name: 'The Potions dungeon',
  bounds: { x0: -W + 0.6, x1: W - 0.6, z0: -L + 0.6, z1: L - 0.6 },
  colliders: [
    ...ROWS.flatMap((z) => [-4.4, 4.4].map((x) => ({ kind: 'box', at: [x, z], w: 5.8, d: 1.1, turn: 0 }))),
    { kind: 'box', at: [0, -8.8], w: 2.6, d: 1.0, turn: 0 },
    { kind: 'box', at: [-W + 0.9, 8.6], w: 1.4, d: 2.2, turn: 0 },
  ],
  spawn: { at: [0, 0, L - 1.4], yaw: 0 },
  places: [{ id: 'potions', name: 'The Potions dungeon', at: [0, 0], r: 10 }],
  light: { hemi: [0x8aa898, 0x0e100c, 0.55], points: [[0, 3.0, -8.4, 0xffb070, 6], [-4.4, 1.6, 1, 0xff8a40, 5], [4.4, 1.6, 6, 0xff8a40, 5], [0, 3.6, 4, 0x6ad89a, 4]] },
  poses: {
    benches: { at: [0, 1.7, 9.6], look: [0, 1.0, -8] },
    desk: { at: [1.6, 1.5, -3], look: [0, 1.5, -10] },
    shelves: { at: [-2, 1.5, 0.5], look: [-W, 2.0, -1.5] },
  },
  make(kit, { renderer, group, rt, tell, toast, lesson }) {
    // the dungeon: dark stone walls, a low barrel vault, flags underfoot
    kit.box('stonedark', -W - 0.5, 0, 0, 1, H, L * 2 + 2);
    kit.box('stonedark', W + 0.5, 0, 0, 1, H, L * 2 + 2);
    kit.box('stonedark', 0, 0, -L - 0.5, W * 2, H + RISE, 1);
    kit.box('stonedark', 0, 0, L + 0.5, W * 2, H + RISE, 1);
    kit.box('flags', 0, -0.3, 0, W * 2, 0.3, L * 2);
    const arc = (a) => [Math.cos(a) * W, H + Math.sin(a) * RISE];
    const N = 16;
    for (let i = 0; i < N; i++) {
      const [x0, y0] = arc(Math.PI - (i / N) * Math.PI);
      const [x1, y1] = arc(Math.PI - ((i + 1) / N) * Math.PI);
      const len = Math.hypot(x1 - x0, y1 - y0);
      const rz = Math.atan2(y1 - y0, x1 - x0);
      kit.box('stonedark', (x0 + x1) / 2, (y0 + y1) / 2, 0, len + 0.12, 0.5, L * 2, { rz });
      for (const z of [-6, 0, 6]) kit.box('rock', (x0 + x1) / 2, (y0 + y1) / 2 - 0.34, z, len + 0.14, 0.36, 0.6, { rz });
    }
    // the stone benches, a slate top on stone ends, a cauldron at every place
    for (const z of ROWS)
      for (const side of [-1, 1]) {
        const x = side * 4.4;
        kit.box('slate', x, 0.86, z, 5.8, 0.08, 1.1);
        for (const dx of [-2.6, 0, 2.6]) kit.box('stonedark', x + dx, 0, z, 0.3, 0.86, 0.9);
      }
    const pot = new THREE.LatheGeometry(POT, 14);
    for (const c of CAULDRONS) {
      // the brazier: an iron ring on three legs over its coals, the pot on it
      kit.cyl('iron', c.x, 0.94, c.z, 0.26, 0.22, 0.12, { seg: 12, open: true });
      kit.cyl(kit.glow('#ff6a20', 1.8), c.x, 0.95, c.z, 0.2, 0.2, 0.03, { seg: 12 });
      kit.add('iron', pot.clone(), { at: [c.x, 1.06, c.z] });
      kit.box('iron', c.x - 0.36, 1.4, c.z, 0.08, 0.04, 0.04);
    }
    pot.dispose();
    const brewMat = brewMaterial();
    const discGeo = new THREE.CircleGeometry(0.3, 16);
    discGeo.rotateX(-Math.PI / 2);
    const brews = instanced(discGeo, brewMat, CAULDRONS.map((c) => ({ at: [c.x, 1.43, c.z] })), { colours: CAULDRONS.map((_, i) => BREW[i % BREW.length]) });
    group.add(brews);
    // the steam off them, three wisps a cauldron
    const steamGeo = new THREE.PlaneGeometry(0.5, 0.5);
    const wisps = CAULDRONS.flatMap((c, i) => [0, 1, 2].map((k) => ({ c, s: [(i * 0.37 + k * 0.33) % 1, i + k] })));
    steamGeo.setAttribute('aSteam', new THREE.InstancedBufferAttribute(new Float32Array(wisps.flatMap((w) => w.s)), 2));
    const steamMat = steamMaterial();
    const steam = instanced(steamGeo, steamMat, wisps.map((w) => ({ at: [w.c.x, 1.5, w.c.z] })));
    steam.renderOrder = 3;
    steam.frustumCulled = false;
    group.add(steam);
    // the shelves to the vault along both long walls, jars on every one
    const shelves = [];
    for (const side of [-1, 1])
      for (const z of [-7.5, -2.5, 2.5])
        shelves.push(...bookcase(kit, { at: [side * (W - 0.25), 0, z], ry: -side * (Math.PI / 2), w: 4.4, h: 3.8, shelves: 6, mat: 'darkoak' }));
    const jars = createJars(shelves, { seed: 23 });
    group.add(jars.group);
    // the store cupboard by the door, its doors shut on the good stuff
    kit.box('darkoak', -W + 0.9, 0, 8.6, 1.3, 2.6, 2.1);
    kit.box('iron', -W + 1.56, 1.2, 8.6, 0.03, 0.16, 0.5);
    // Snape’s desk at the front, his chair, his quill and a jar of something worse
    kit.box('darkoak', 0, 0, -8.8, 2.6, 0.8, 1.0);
    kit.box('oak', 0, 0.8, -8.8, 2.8, 0.06, 1.15);
    chair(kit, { at: [0, 0, -9.8], ry: 0, back: 1.4 });
    kit.cyl(kit.paint('#d8d8c8', { rough: 0.2, metal: 0 }), -0.8, 0.86, -8.7, 0.07, 0.07, 0.22, { seg: 10 });
    kit.box(kit.paint('#e8dcc0', { rough: 0.9 }), 0.4, 0.86, -8.6, 0.5, 0.02, 0.36, { ry: -0.2 });
    // the board with the day’s recipe, chalked
    const board = flat(typeof document !== 'undefined' ? paintChalk(CURE_FOR_BOILS.name, CURE_FOR_BOILS.board.map((s) => s.says)) : null, { renderer, w: 3.6, h: 2.4, at: [0, 2.4, -L + 0.06] });
    group.add(board.mesh);
    // Professor Snape behind his desk, watching the door
    const snape = figure('snape', { rt, seed: 8 });
    snape.group.position.set(0.9, 0, -9.6);
    snape.set({ base: null, speed: 0 });
    group.add(snape.group);
    let spoke = false;
    return {
      lessons: { potions: { at: [LESSON.x, 0, LESSON.z + 1.15], yaw: 0 } },
      doors: [lessonDoor({ id: 'potions', name: 'Potions: a Cure for Boils', at: [LESSON.x, LESSON.z + 1.6], spot: [LESSON.x, 0, LESSON.z + 1.15], yaw: 0, teacher: 'Professor Snape', lesson, toast })],
      live: [
        {
          step(dt, c = {}) {
            snape.tick(dt);
            // (he has a word for the first who leans over a cauldron)
            if (!spoke && c.at && CAULDRONS.some((k) => Math.hypot(c.at[0] - k.x, c.at[1] - (k.z + 0.9)) < 0.9)) {
              spoke = true;
              tell('line', { who: 'snape', name: NAMES.snape, text: LINES.snape.soup });
            }
          },
          dispose() {
            snape.dispose();
            jars.dispose();
            board.dispose();
            discGeo.dispose();
            brewMat.dispose();
            steamGeo.dispose();
            steamMat.dispose();
          },
        },
      ],
    };
  },
});
