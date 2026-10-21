// Pickle Rick's sewer run, drawn: a storm drain running away from the
// camera, ribbed concrete walls, a channel of green water down the middle,
// lamps every so often, the rats (the cast's sewer rat), the grates (gaps
// in the floor) and the screws, and Pickle Rick himself (the cast's pickle,
// which hops as it rolls), seen from behind and a little above, drawn as the
// show is (flat colour, one step of shadow, a line round the cast only, no
// film grade: ../look.js). It draws the run it's handed and decides nothing
// (./rules.js).
//
// createSewerScene(canvas, { onLost }) resolves to { render(run, ms),
// resize(w, h), dispose(), lost }.

import * as THREE from 'three';
import { createStage, disposeTree } from '../../../../lib/stage3d';
import { toon } from '../../portal/toon';
import { createMeshyCast } from '../../portal/meshyCast';
import { TUNING, laneX } from './rules';
import { createFeel, feelGroups } from '../../../../lib/three/feel';
import { BLOOMS, CAST_INK, PLAIN } from '../look';

const SEG = 12; // metres of drain per segment
const SEGS = 7; // segments ahead of him
const W = 3 * TUNING.laneW + 1.6; // the drain's width
const LAMP = 0xffd080;
const RAT_RUN = Object.freeze({ speed: TUNING.rat, side: 0, turn: 0 }); // (a rat's own run along the drain, m/s)

export async function createSewerScene(canvas, { onLost } = {}) {
  const stage = createStage(canvas, { shadows: false, fov: 55, near: 0.1, far: 160, exposure: 1.05, bloom: BLOOMS.sewer, onLost });
  const { scene, camera } = stage;
  stage.grade(PLAIN);
  scene.background = new THREE.Color(0x0a1410);
  scene.fog = new THREE.Fog(0x0a1410, 30, 90);
  scene.add(new THREE.HemisphereLight(0xa8ffd0, 0x1a2a1a, 1.6));
  const sun = new THREE.DirectionalLight(0xdfffe8, 0.9);
  sun.position.set(4, 10, -6);
  scene.add(sun);

  const owned = [];
  const own = (o) => (owned.push(o), o);
  const mat = (color, opts) => own(toon(color, opts));
  const BOX = own(new THREE.BoxGeometry(1, 1, 1));
  const CYL = own(new THREE.CylinderGeometry(0.5, 0.5, 1, 14));

  // ── the drain: SEGS segments, recycled as he rolls ──
  const concrete = mat(0x5a6a60);
  const dark = mat(0x2a3430);
  const water = own(new THREE.MeshBasicMaterial({ color: 0x3aa85a, transparent: true, opacity: 0.8 }));
  const lampMat = own(new THREE.MeshBasicMaterial({ color: LAMP }));
  const segments = [];
  for (let i = 0; i < SEGS; i++) {
    const g = new THREE.Group();
    const floor = new THREE.Mesh(BOX, concrete);
    floor.scale.set(W, 0.4, SEG);
    floor.position.set(0, -0.2, 0);
    g.add(floor);
    for (const s of [-1, 1]) {
      const wall = new THREE.Mesh(BOX, concrete);
      wall.scale.set(0.4, 4.2, SEG);
      wall.position.set((s * (W + 0.4)) / 2, 2.1, 0);
      g.add(wall);
      for (let k = 0; k < 3; k++) {
        const rib = new THREE.Mesh(BOX, dark);
        rib.scale.set(0.3, 4.2, 0.3);
        rib.position.set((s * (W + 0.3)) / 2, 2.1, -SEG / 2 + 2 + k * 4);
        g.add(rib);
      }
    }
    const roof = new THREE.Mesh(BOX, dark);
    roof.scale.set(W + 0.8, 0.4, SEG);
    roof.position.set(0, 4.4, 0);
    g.add(roof);
    const w = new THREE.Mesh(BOX, water);
    w.scale.set(W * 0.5, 0.06, SEG);
    w.position.set(0, 0.04, 0);
    g.add(w);
    const lamp = new THREE.Mesh(CYL, lampMat);
    lamp.scale.set(0.3, 0.12, 0.3);
    lamp.position.set(0, 4.14, 0);
    g.add(lamp);
    const glow = new THREE.PointLight(LAMP, 1.6, 14, 1.6);
    glow.position.set(0, 3.9, 0);
    g.add(glow);
    scene.add(g);
    segments.push(g);
  }

  // ── the cast: Pickle Rick and the rats ──
  const cast = createMeshyCast({ ink: CAST_INK });
  await cast.load(null, ['pickle', 'sewerrat']).catch(() => {});
  const pickle = cast.make('pickle');
  const hero = new THREE.Group();
  if (pickle) {
    pickle.group.rotation.y = Math.PI; // (made facing +z: turned to roll away from the camera)
    hero.add(pickle.group);
  } else {
    const m = new THREE.Mesh(own(new THREE.CapsuleGeometry(0.3, 0.7, 6, 12)), mat(0x5aa83a));
    m.position.y = 0.65;
    hero.add(m);
  }
  scene.add(hero);
  const shots = new THREE.Group();
  scene.add(shots);
  const laserMat = own(new THREE.MeshBasicMaterial({ color: 0xff3a3a }));

  // ── the things in the drain: a mesh each, kept by id ──
  const things = new Map();
  const grateMat = mat(0x1a2420);
  const screwMat = own(new THREE.MeshBasicMaterial({ color: 0xffe24a }));
  const ratFallback = mat(0x7a5a3a);
  const makeThing = (o) => {
    const g = new THREE.Group();
    if (o.kind === 'rat') {
      const r = cast.make('sewerrat');
      if (r) {
        r.group.rotation.y = 0; // (made facing +z: it runs at the camera)
        g.add(r.group);
        g.userData.rat = r;
      } else {
        const m = new THREE.Mesh(BOX, ratFallback);
        m.scale.set(0.5, 0.3, 0.8);
        m.position.y = 0.15;
        g.add(m);
      }
    } else if (o.kind === 'grate') {
      const m = new THREE.Mesh(BOX, grateMat);
      m.scale.set(TUNING.laneW - 0.2, 0.3, 1.6);
      m.position.y = -0.1;
      g.add(m);
      for (let k = -2; k <= 2; k++) {
        const bar = new THREE.Mesh(BOX, concrete);
        bar.scale.set(0.08, 0.1, 1.6);
        bar.position.set(k * 0.3, 0.02, 0);
        g.add(bar);
      }
    } else {
      const m = new THREE.Mesh(CYL, screwMat);
      m.scale.set(0.24, 0.5, 0.24);
      m.position.y = 0.6;
      g.add(m);
      const head = new THREE.Mesh(CYL, screwMat);
      head.scale.set(0.4, 0.1, 0.4);
      head.position.y = 0.9;
      g.add(head);
    }
    scene.add(g);
    return g;
  };

  let lastEvents = null;
  // a bite or a splash shakes the camera (lib/three/feel: trauma², still
  // under reduced motion), at its old 0.5, its decay of 1.5 a second, and
  // the 0.15 off the old sines had at full
  const feel = createFeel({ baseFov: 55, offset: 0.15 });
  feel.set({ decay: 1.5 });
  const render = (run, ms) => {
    if (stage.lost || stage.disposed || !run) return;
    const dt = Math.min(0.1, ms / 1000);
    const t = run.t;
    // the drain under him: the segment grid rides with x
    const base = Math.floor(run.x / SEG) * SEG;
    for (const [i, g] of segments.entries()) g.position.z = -(base + (i - 1) * SEG + SEG / 2 - run.x);
    // him: in his lane, hopping, leaning into a lane change
    const hx = laneX(run.lane);
    hero.position.x += (hx - hero.position.x) * Math.min(1, dt * 12);
    const hopK = run.hop > 0 ? Math.sin((run.hop / TUNING.air) * Math.PI) : 0;
    hero.position.y = hopK * 1.1;
    hero.position.z = 0;
    hero.rotation.z = (hero.position.x - hx) * 0.5;
    // (his hops in step with the drain going by under him, as fast as he's running)
    pickle?.update?.(t, run.stun > 0 ? 0.3 : 1, 0, { dt, motion: { speed: run.speed * (run.stun > 0 ? 0.5 : 1), side: 0, turn: 0 } });
    // the things, by id: made as they appear, gone as they pass
    const seen = new Set();
    for (const o of run.items) {
      seen.add(o.id);
      let g = things.get(o.id);
      if (!g) {
        g = makeThing(o);
        things.set(o.id, g);
      }
      g.position.set(laneX(o.lane), 0, -(o.at - run.x));
      g.visible = !o.hit || o.kind === 'grate';
      // (a rat's scurry in step with its own run at him, each rat in its own stride: the cast's gait.js)
      if (o.kind === 'rat' && !o.hit) g.userData.rat?.update?.(t, 1, 0, { dt, motion: RAT_RUN });
      if (o.kind === 'screw') g.rotation.y = t * 3;
    }
    for (const [id, g] of things) {
      if (!seen.has(id)) {
        scene.remove(g);
        things.delete(id);
      }
    }
    // the frame's events: a shake for a bite, a bolt for a zap
    if (run.events !== lastEvents) {
      lastEvents = run.events;
      for (const e of run.events) {
        if (e.type === 'bite' || e.type === 'splash') feel.trauma(0.5);
        if (e.type === 'zap' || e.type === 'miss') {
          const bolt = new THREE.Mesh(BOX, laserMat);
          bolt.scale.set(0.08, 0.08, TUNING.range);
          bolt.position.set(hero.position.x, 0.8, -TUNING.range / 2);
          bolt.userData.until = t + 0.12;
          shots.add(bolt);
        }
      }
    }
    for (const b of [...shots.children]) if (t > b.userData.until) shots.remove(b);
    // the camera, behind and above, a little to the side of his lane
    camera.position.set(hero.position.x * 0.4, 2.6, 6.5);
    camera.lookAt(hero.position.x * 0.6, 1.0, -8);
    feel.update(dt, camera);
    stage.render(ms);
  };

  return {
    render,
    resize: (w, h) => stage.resize(w, h),
    // behind ?debug: the stage's bloom, the shake's numbers, and what the game adds
    tune: (groups = []) => stage.tune([...feelGroups(feel), ...groups]),
    dispose() {
      for (const g of things.values()) disposeTree(g);
      disposeTree(hero);
      cast.dispose();
      for (const o of owned) o.dispose?.();
      stage.dispose();
    },
    get lost() {
      return stage.lost;
    },
  };
}
