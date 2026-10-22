// The top of the Astronomy Tower (the design’s §4.4): the open gallery round
// the castle’s highest tower, stone-floored, a crenellated parapet at your
// waist, six brass telescopes on their tripods turned up at the sky, a table
// of star charts weighted down with an armillary sphere, and a lantern. It
// stands in the world, not below it (the room host’s `origin`): the far castle’s
// own gallery, so the lake, the shore’s lights and the sky are really there,
// a hundred and fifty metres down and all round. By night, E at a telescope
// is a look along it: the view narrows to the eyepiece’s and the stars in it
// are named (rules/stars.js); E again and you’re back.

import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { cameraProjectionMatrix, length, modelViewMatrix, positionGeometry, sin, smoothstep, time, uv, vec3, vec4, attribute } from 'three/tsl';
import { CRAG, PLAN } from '../world/castle/silhouette';
import { CASTLE } from '../rules/shore';
import { STARS, TELESCOPES, along, caption, dirOf, night } from '../rules/stars';
import { countOf, createRoomKit, instanced } from './kit';
import { rod } from './parts/furniture';

const TOWER = PLAN.find((p) => p.name === 'Astronomy');
// (the gallery’s ring on the far castle stands six metres under the tower’s top, 2.2 deep: its top is our floor)
export const AT = [CASTLE.at[0] + TOWER.at[0], CRAG.top + TOWER.h - 6 + 1.1 + 0.05, CASTLE.at[1] + TOWER.at[1]];
const R0 = TOWER.r + 0.05; // the tower’s wall
const R1 = 12.4; // the parapet’s inside
const TAU = Math.PI * 2;
const SKY = 3000; // m out the named stars are drawn
const LOOK = 22; // degrees across the eyepiece’s view (narrower, and the sky’s own stars show their squares)
const DOOR_A = Math.PI * 0.75; // where the door into the tower is, round the wall

// each telescope on its tripod on the side of the gallery facing where it looks (rules/stars.js),
// near the parapet and high enough to see over it; the two that look nearly overhead stand
// a little round from the low ones beside them. STAND: the azimuth each stands at.
const STAND = { north: 4, queen: 332, andromeda: 214, west: 292, orion: 112, twins: 66 };
const EYE = 1.45; // m the tube’s pivot stands over the floor
export const scopes = TELESCOPES.map((t) => {
  const az = ((STAND[t.id] ?? t.az) * Math.PI) / 180;
  const r = R1 - 0.95;
  // (azimuth from north, clockwise: north is −z, east +x)
  return { ...t, at: [Math.sin(az) * r, 0, -Math.cos(az) * r] };
});

// the named stars, bright points far out, each twinkling on its own (one draw)
function namedStars() {
  const geo = new THREE.PlaneGeometry(1, 1);
  const spots = new Float32Array(STARS.length * 4);
  STARS.forEach((s, i) => {
    const d = dirOf(s.az, s.el);
    spots.set([d[0] * SKY, d[1] * SKY, d[2] * SKY, Math.max(0.4, 2.2 - s.mag * 0.7)], i * 4);
  });
  geo.setAttribute('aStar', new THREE.InstancedBufferAttribute(spots, 4));
  const mat = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  mat.userData.noHouse = true;
  const s = attribute('aStar', 'vec4');
  const r = length(uv().sub(0.5)).mul(2);
  mat.colorNode = vec3(0.95, 0.95, 1.0).mul(smoothstep(1, 0, r).pow(3)).mul(sin(time.mul(3.1).add(s.x)).mul(0.25).add(1)).mul(s.w);
  mat.vertexNode = cameraProjectionMatrix.mul(modelViewMatrix.mul(vec4(s.xyz, 1)).add(vec4(positionGeometry.xy.mul(s.w.mul(9)), 0, 0)));
  const mesh = instanced(geo, mat, STARS.map(() => ({ at: [0, 0, 0] })));
  mesh.frustumCulled = false;
  return { mesh, dispose: () => (geo.dispose(), mat.dispose()) };
}

function build(rt, ctx = {}) {
  const tier = ctx.tier ?? rt?.quality?.tier ?? 'high';
  const tell = ctx.tell ?? (() => {});
  const toast = (text) => tell('toast', { text });
  const hour = ctx.props?.hour ?? 22;
  const group = new THREE.Group();
  group.name = 'room:astronomy';
  const kit = createRoomKit({ house: ctx.house, tier });
  // the gallery’s floor, flags in a ring, and the parapet round it: a low wall, merlons on it
  const segs = 48;
  const run = TAU / segs;
  for (let i = 0; i < segs; i++) {
    const a = (i + 0.5) * run;
    const mid = (R0 + R1 + 0.6) / 2;
    kit.box('flags', Math.sin(a) * mid, -0.4, Math.cos(a) * mid, 2 * (R1 + 0.6) * Math.tan(run / 2) + 0.05, 0.4, R1 + 0.6 - R0, { ry: a });
    const pr = R1 + 0.3;
    const len = 2 * pr * Math.tan(run / 2) + 0.04;
    kit.box('ashlar', Math.sin(a) * pr, 0, Math.cos(a) * pr, len, 1.0, 0.55, { ry: a });
    if (i % 2 === 0) kit.box('ashlar', Math.sin(a) * pr, 1.0, Math.cos(a) * pr, len, 0.62, 0.55, { ry: a });
    // (the corbels under the gallery’s edge, seen from the lawn)
    if (i % 3 === 0) kit.box('ashlar', Math.sin(a) * (R1 + 0.4), -1.3, Math.cos(a) * (R1 + 0.4), 0.5, 0.9, 0.7, { ry: a });
  }
  // the door into the tower: oak in a pointed arch on the tower’s wall
  const dx = Math.sin(DOOR_A) * (R0 + 0.05);
  const dz = Math.cos(DOOR_A) * (R0 + 0.05);
  kit.box('darkoak', dx, 0, dz, 1.3, 2.4, 0.14, { ry: DOOR_A });
  kit.box('ashlar', dx, 2.4, dz, 1.8, 0.4, 0.3, { ry: DOOR_A });
  for (const s of [-1, 1]) kit.box('ashlar', dx + Math.cos(DOOR_A) * s * 0.8, 0, dz - Math.sin(DOOR_A) * s * 0.8, 0.3, 2.4, 0.3, { ry: DOOR_A });
  // the telescopes: a brass tube on a wooden tripod, its eyepiece low, its end up to the sky
  for (const s of scopes) {
    const [x, , z] = s.at;
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * TAU;
      rod(kit, 'board', [x + Math.sin(a) * 0.45, 0, z + Math.cos(a) * 0.45], [x, EYE - 0.1, z], 0.025, { seg: 5 });
    }
    const d = dirOf(s.az, s.el);
    const back = [x - d[0] * 0.55, EYE - d[1] * 0.55, z - d[2] * 0.55];
    const front = [x + d[0] * 0.75, EYE + d[1] * 0.75, z + d[2] * 0.75];
    rod(kit, 'brass', back, front, 0.06, { seg: 12 });
    rod(kit, 'brass', front, [front[0] + d[0] * 0.08, front[1] + d[1] * 0.08, front[2] + d[2] * 0.08], 0.075, { seg: 12 });
    rod(kit, 'brass', back, [back[0] - d[0] * 0.12, back[1] - d[1] * 0.12, back[2] - d[2] * 0.12], 0.025, { seg: 8 });
  }
  // the table of charts, the armillary sphere weighting them down, a lantern
  const ta = DOOR_A + 0.55;
  const tx = Math.sin(ta) * 9.2;
  const tz = Math.cos(ta) * 9.2;
  kit.box('oak', tx, 0.74, tz, 1.4, 0.06, 0.8, { ry: ta });
  for (const [u, v] of [[-0.6, -0.32], [0.6, -0.32], [-0.6, 0.32], [0.6, 0.32]]) kit.box('oak', tx + u * Math.cos(ta) + v * Math.sin(ta), 0, tz - u * Math.sin(ta) + v * Math.cos(ta), 0.06, 0.74, 0.06);
  kit.box(kit.paint('#e8dcc0', { rough: 0.9 }), tx, 0.8, tz, 0.9, 0.01, 0.6, { ry: ta + 0.1 });
  kit.box(kit.paint('#1a2a4a', { rough: 0.9 }), tx + 0.2, 0.81, tz, 0.5, 0.01, 0.4, { ry: ta - 0.2 });
  for (const [rx, ry] of [[0, 0], [Math.PI / 2, 0], [Math.PI / 2, Math.PI / 2], [0.4, 0.8]]) kit.add('brass', new THREE.TorusGeometry(0.16, 0.008, 5, 28), { at: [tx - 0.35, 1.0, tz], rx, ry });
  kit.cyl('brass', tx - 0.35, 0.8, tz, 0.07, 0.05, 0.05, { seg: 10 });
  kit.cyl('iron', tx + 0.45, 0.8, tz - 0.15, 0.08, 0.08, 0.04, { seg: 8 });
  kit.cyl(kit.glow('#ffcf80', 2.2), tx + 0.45, 0.84, tz - 0.15, 0.06, 0.06, 0.16, { seg: 8 });
  kit.build(group);
  const lamp = new THREE.PointLight(0xffc070, tier === 'low' ? 0 : 5, 9, 1.6);
  lamp.position.set(tx + 0.45, 1.2, tz - 0.15);
  group.add(lamp);
  const stars = namedStars();
  stars.mesh.visible = night(hour);
  group.add(stars.mesh);

  // ── looking along a telescope
  let looking = null; // { scope, t, fov }
  const camera = { fov: null };
  const look = (s) => {
    if (looking) return stop();
    if (!night(hour)) return toast('Nothing but blue. The stars are there; come back when it’s dark.');
    looking = { scope: s, t: 0 };
    tell('line', { who: 'stars', name: s.name, text: caption(along(s.az, s.el, { fov: LOOK * 1.7 })) });
  };
  let held = null;
  const stop = () => {
    if (!looking) return;
    looking = null;
    held?.(false);
    if (camera.ref && camera.fov) {
      camera.ref.fov = camera.fov;
      camera.ref.updateProjectionMatrix();
    }
  };

  const room = {
    id: 'astronomy',
    name: 'The top of the Astronomy Tower',
    origin: AT,
    group,
    spawn: { at: [Math.sin(DOOR_A) * (R0 + 1.2), 0, Math.cos(DOOR_A) * (R0 + 1.2)], yaw: DOOR_A + Math.PI },
    colliders: [
      { kind: 'circle', at: [0, 0], r: R0 + 0.3 },
      ...Array.from({ length: 40 }, (_, i) => ({ kind: 'circle', at: [Math.sin((i / 40) * TAU) * (R1 + 0.4), Math.cos((i / 40) * TAU) * (R1 + 0.4)], r: 0.6 })),
      ...scopes.map((s) => ({ kind: 'circle', at: [s.at[0], s.at[2]], r: 0.5 })),
      { kind: 'circle', at: [tx, tz], r: 0.75 },
    ],
    bounds: { x0: -R1, x1: R1, z0: -R1, z1: R1 },
    floorAt: () => 0,
    get doors() {
      return [
        { id: 'down', at: [Math.sin(DOOR_A) * (R0 + 0.6), Math.cos(DOOR_A) * (R0 + 0.6)], r: 0.9, verb: 'Go down', name: 'The tower stair', act: () => ctx.leave?.() },
        ...scopes.map((s) => {
          const d = dirOf(s.az, s.el);
          return { id: `scope:${s.id}`, at: [s.at[0] - d[0] * 0.9, s.at[2] - d[2] * 0.9], r: 0.7, verb: looking?.scope === s ? 'Stop looking through' : 'Look through', name: s.name, act: () => look(s) };
        }),
      ];
    },
    places: [{ id: 'astronomy-tower', name: 'The Astronomy Tower', at: [0, 0], r: 13 }],
    poses: {
      // (out over the parapet, south-south-west to the lake and the shore’s lights)
      lake: { at: [Math.sin(3.28) * 11.7, 1.8, -Math.cos(3.28) * 11.7], look: [Math.sin(3.28) * 400, -140, -Math.cos(3.28) * 400] },
      gallery: { at: [Math.sin(DOOR_A) * 9.6, 1.6, Math.cos(DOOR_A) * 9.6], look: [Math.sin(DOOR_A + 1.2) * 11, 1.2, Math.cos(DOOR_A + 1.2) * 11] },
      orion: { at: [scopes[4].at[0] * 0.8, 1.6, scopes[4].at[2] * 0.8], look: [scopes[4].at[0] * 3, 6, scopes[4].at[2] * 3] },
    },
    lessons: {},
    step(dt, c = {}) {
      held = c.hold ?? held;
      if (!looking || !c.camera) return;
      // (the eye at the eyepiece, the view narrowed along the tube; the walk holds still)
      const cam = c.camera;
      if (!camera.ref) camera.ref = cam;
      if (camera.fov == null) camera.fov = cam.fov;
      c.hold?.(true);
      const s = looking.scope;
      const d = dirOf(s.az, s.el);
      looking.t += dt;
      const k = Math.min(1, looking.t / 0.6);
      // (just past the tube’s end, so the brass isn’t in the way: the eyepiece’s view without the eyepiece)
      cam.position.set(AT[0] + s.at[0] + d[0] * 0.95, AT[1] + EYE + d[1] * 0.95, AT[2] + s.at[2] + d[2] * 0.95);
      cam.lookAt(cam.position.x + d[0], cam.position.y + d[1], cam.position.z + d[2]);
      cam.fov = camera.fov + (LOOK - camera.fov) * (k * k * (3 - 2 * k));
      cam.updateProjectionMatrix();
      // (the walk holds while you look, and E with it: E again is heard here)
      if (looking.t > 0.3 && (c.input?.pressed?.has?.('KeyE') || c.input?.pressed?.has?.('Enter'))) stop();
    },
    set(p = {}) {
      if (p.hour != null) stars.mesh.visible = night(p.hour);
    },
    info: () => ({ ...countOf(group), looking: looking?.scope.id ?? null }),
    dispose() {
      stop();
      kit.dispose();
      stars.dispose();
      group.removeFromParent();
    },
  };
  return room;
}

export default { id: 'astronomy', name: 'The top of the Astronomy Tower', build };
