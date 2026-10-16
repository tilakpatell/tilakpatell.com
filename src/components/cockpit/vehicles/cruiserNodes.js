// cruiser.js on the node renderer: the same cruiser, the same exports
// (prefetch, and build({ rich, coarse }) → the same result), its materials
// node materials with the same settings and flags: the cel materials
// MeshToonNodeMaterials on the same ramp, Morty from
// rickmorty/portal/meshyCastNodes.js, Kenney’s suburbs turned toon by
// rickmorty/portal/toonNodes.js, the kit from ../kitNodes.js (so the
// galaxy frees what this made with kitNodes’s freeKit, not kit.js’s). The
// shaders (the ink line, Morty’s cel snap, the portal, the dusk sky and the
// dome) are line for line in TSL in ./cruiserNodesParts.js, split off to
// keep this file under the size the rules allow. What differs on the node
// renderer: the portal’s and the sky’s uniforms are nodes (on
// `material.uniforms`, and the portal’s still on `portal.u`, so `.value`
// writes them as before), and a ShaderMaterial took no fog, so those two
// take none.
//
// Rick's space cruiser, the classic one: you're Rick, at the wheel, and
// Morty rides beside you. Drawn the way the show draws it: flat colours with
// barely a shadow, and a bold dark ink line round everything (Morty's own
// texture is snapped to his flat colours, so he looks drawn, not painted).
// Your arms are Rick's, in the lab coat's sleeves: the left hand on the
// wheel, the right holding the portal gun. The grey hood runs away in front
// of you with its two orange stripes and the headlights up on their stalks,
// under the bubble of the glass dome; on the dash, a few big knobs, a little
// screen of squiggles, a can in the holder and a hank of wires. You're
// hovering over the street outside the Smiths' house at dusk. Going: you
// raise the portal gun and fire, the portal opens in the air ahead, Morty
// panics, you floor it, the houses stream past, the swirl fills the glass,
// and the green flash.
//
// The cruiser's floor is y = 0, its nose down −z; units are metres.

import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { createMeshyCast } from '../../rickmorty/portal/meshyCastNodes';
import { toonify } from '../../rickmorty/portal/toonNodes';
import { glowSprite, rng, roundedBox, screen, tubeAlong } from '../kitNodes';
import { clamp01, smooth } from '../timeline';
import { gltfLoader } from '../../../lib/three/gltf';
import { UP, cel, domeMaterial, drawnSkin, duskSky, elbow, flatRamp, hand, ink, portalDisc, portalGun, setBetween } from './cruiserNodesParts';

const EYE = [-0.36, 1.42, 0.38];
const HOVER = 3.4; // how high over the street the cruiser hangs
const PORTAL_Z = -38; // where the portal opens, ahead
const KENNEY = '/games/kenney';
const MODELS = '/games/models';

// Morty's colours, as the show paints him (his texture is snapped to these)
const MORTY = ['#f6c0a0', '#f4ec6c', '#f1f5f7', '#2a5b86', '#6a4416', '#e9a184'];
// Rick's, for your own arms
const COAT = 0xe6eaec;
const SHIRT = 0x9fd0e6;
const SKIN = 0xf0d6bf;

export function prefetch() {
  for (const f of ['/games/meshy/morty.glb', '/games/meshy/morty-sit.glb', '/games/meshy/morty-walk.glb', `${KENNEY}/house-a.glb`, `${KENNEY}/house-c.glb`, `${KENNEY}/house-f.glb`, `${KENNEY}/house-k.glb`, `${KENNEY}/oak.glb`])
    fetch(f).catch(() => {});
}

// a model from a folder, or null
const loader = gltfLoader();
const loadModel = (url) => loader.loadAsync(url).then((g) => g.scene).catch(() => null);

export async function build({ rich, coarse }) {
  const inside = new THREE.Group();
  const outside = new THREE.Group();
  const r = rng(13);
  const disposers = [];

  // ── the cruiser: toon materials ──
  const M = {
    hull: cel(0xbcc4c9),
    hullDark: cel(0x939ca3),
    stripe: cel(0xf0a238),
    dash: cel(0x6b737a),
    dashTop: cel(0x585f66),
    seat: cel(0x9a6440),
    seatDark: cel(0x6e4429),
    black: cel(0x2b2b33),
    chrome: cel(0xdfe5e8),
    red: cel(0xe0453a),
    yellow: cel(0xf2d14a),
    blue: cel(0x4a8fe0),
    can: cel(0xd9d4c6),
    lamp: cel(0xfff3b0, { emissive: new THREE.Color(0xfff0a0), emissiveIntensity: 1.4 }),
    coat: cel(COAT),
    shirt: cel(SHIRT),
    skin: cel(SKIN),
    gun: cel(0xdfe6e8),
    gunDark: cel(0x8d979e),
    green: new MeshBasicNodeMaterial({ color: 0x9dff5a, toneMapped: false }),
    bulb: new MeshBasicNodeMaterial({ color: 0xe6fff4, transparent: true, opacity: 0.28, depthWrite: false }),
    wire: [cel(0xe0453a), cel(0x3f8fd8), cel(0xf2d14a), cel(0x3a3a3a)],
  };
  Object.values(M)
    .flat()
    .forEach((m) => disposers.push(m));

  const ship = new THREE.Group();
  inside.add(ship);

  // the hood: the top front of the saucer, running away and down from the
  // rim of the cabin (you sit above it, so its ink line draws round it)
  const HOOD = { y: 0.6, rx: 2.4, ry: 0.42, rz: 2.8 };
  const hood = new THREE.Mesh(new THREE.SphereGeometry(1, 72, 36, Math.PI * 1.04, Math.PI * 0.92, 0.5, 1.25), M.hull);
  hood.scale.set(HOOD.rx, HOOD.ry, HOOD.rz);
  hood.position.set(0, HOOD.y, 0.12);
  ship.add(hood);
  // its two orange stripes, laid on it
  for (const sx of [-1, 1]) {
    const stripe = new THREE.Mesh(new THREE.SphereGeometry(1.006, 6, 30, Math.PI * 1.5 + sx * 0.13 - 0.04, 0.08, 0.5, 1.0), M.stripe);
    stripe.scale.copy(hood.scale);
    stripe.position.copy(hood.position);
    ship.add(stripe);
  }
  // the rim round the cabin, where the dome sits
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.065, 12, 72), M.hullDark);
  rim.rotation.x = Math.PI / 2;
  rim.scale.set(1.16, 1.24, 1);
  rim.position.set(0, 0.97, 0.12);
  ship.add(rim);
  // the inside of the tub, and its floor
  const tubIn = new THREE.Mesh(new THREE.CylinderGeometry(1.14, 0.95, 0.97, 48, 1, true), cel(0x7c858c, { side: THREE.BackSide }));
  disposers.push(tubIn.material);
  tubIn.scale.set(1, 1, 1.07);
  tubIn.position.set(0, 0.485, 0.12);
  tubIn.userData.noInk = true;
  ship.add(tubIn);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(1.0, 40), M.black);
  floor.rotation.x = -Math.PI / 2;
  floor.scale.set(1, 1.1, 1);
  floor.position.set(0, 0.02, 0.12);
  floor.userData.noInk = true;
  ship.add(floor);

  // the headlights, up on their stalks at the front of the hood
  const onHood = (x, t) => {
    // a point on the hood at height angle t (0 top, π/2 the widest), x across
    const rr = Math.sin(t);
    const zz = -Math.sqrt(Math.max(0, rr * rr - (x / HOOD.rx) ** 2)) * HOOD.rz + 0.12;
    return new THREE.Vector3(x, HOOD.y + HOOD.ry * Math.cos(t), zz);
  };
  for (const sx of [-1, 1]) {
    const base = onHood(sx * 0.95, 1.3);
    const stalk = new THREE.Mesh(
      tubeAlong(
        [
          [base.x, base.y - 0.05, base.z + 0.05],
          [base.x, base.y + 0.16, base.z - 0.02],
          [base.x, base.y + 0.26, base.z - 0.16],
        ],
        0.04,
        { segs: 10, radial: 8 },
      ),
      M.hullDark,
    );
    ship.add(stalk);
    const lampCan = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.22, 20), M.hull);
    lampCan.rotation.x = Math.PI / 2;
    lampCan.position.set(base.x, base.y + 0.28, base.z - 0.26);
    ship.add(lampCan);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.11, 20), M.lamp);
    lens.position.set(base.x, base.y + 0.28, base.z - 0.372);
    lens.rotation.y = Math.PI;
    lens.userData.noInk = true;
    ship.add(lens);
    const beam = glowSprite('#fff2b0', 1.1, 0.4);
    beam.position.set(base.x, base.y + 0.28, base.z - 0.5);
    ship.add(beam);
  }

  // ── the dash: a curved panel round the front of the cabin, facing you ──
  const DASH = { r: 0.98, y: 0.76, h: 0.3, z: 0.12 };
  const dash = new THREE.Mesh(new THREE.CylinderGeometry(DASH.r, DASH.r * 1.04, DASH.h, 48, 1, true, Math.PI * 0.64, Math.PI * 0.72), cel(0x6b737a, { side: THREE.BackSide }));
  disposers.push(dash.material);
  dash.position.set(0, DASH.y, DASH.z);
  dash.userData.noInk = true;
  ship.add(dash);
  const dashTop = new THREE.Mesh(new THREE.RingGeometry(0.74, DASH.r + 0.02, 48, 1, Math.PI * 1.14, Math.PI * 0.72), M.dashTop);
  dashTop.rotation.x = -Math.PI / 2;
  dashTop.position.set(0, DASH.y + DASH.h / 2 + 0.005, DASH.z);
  dashTop.userData.noInk = true;
  ship.add(dashTop);
  const dashLip = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.022, 8, 48, Math.PI * 0.72), M.black);
  dashLip.rotation.set(Math.PI / 2, 0, Math.PI * 1.14);
  dashLip.position.set(0, DASH.y + DASH.h / 2 + 0.01, DASH.z);
  ship.add(dashLip);
  // big knobs and buttons, in flat colours: `a` runs round from straight ahead
  const onDash = (a, y, inset = 0) => new THREE.Vector3(Math.sin(a) * (DASH.r - inset), y, DASH.z - Math.cos(a) * (DASH.r - inset));
  // turned to face the middle of the cabin
  const facing = (obj, y) => obj.lookAt(0, y, DASH.z);
  const knob = (mat, a, y, rad) => {
    const k = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad * 1.12, 0.05, 20), mat);
    k.position.copy(onDash(a, y, 0.02));
    facing(k, y);
    k.rotateX(Math.PI / 2);
    ship.add(k);
    return k;
  };
  knob(M.red, 0.2, 0.79, 0.04);
  knob(M.yellow, 0.33, 0.8, 0.03);
  knob(M.blue, 0.45, 0.79, 0.034);
  knob(M.chrome, -0.62, 0.79, 0.03);
  knob(M.red, -0.72, 0.8, 0.022);
  for (let i = 0; i < 6; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.026, 0.02), [M.red, M.yellow, M.blue][i % 3]);
    const a = 0.16 + i * 0.055;
    b.position.copy(onDash(a, 0.69, 0.01));
    facing(b, 0.69);
    ship.add(b);
  }
  // Rick's screen: squiggles, a sine, a counter
  const scr = screen(
    0.2,
    0.12,
    (g, w, h, t) => {
      g.fillStyle = '#0c2a14';
      g.fillRect(0, 0, w, h);
      g.strokeStyle = '#8cff6a';
      g.lineWidth = 3;
      g.beginPath();
      for (let x = 0; x <= w; x += 4) {
        const y = h * 0.5 + Math.sin(x * 0.07 + t * 5) * h * 0.18 + Math.sin(x * 0.19 - t * 9) * h * 0.06;
        if (x === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
      g.fillStyle = '#8cff6a';
      g.font = `bold ${Math.round(h * 0.2)}px monospace`;
      g.fillText(`C-137 ${(Math.floor(t * 13) % 1000).toString().padStart(3, '0')}`, 8, h * 0.24);
      g.strokeStyle = '#1b1424';
      g.lineWidth = 6;
      g.strokeRect(0, 0, w, h);
    },
    { px: 192, fps: 15, glow: 1.2 },
  );
  const scrA = -0.1;
  scr.mesh.position.copy(onDash(scrA, 0.78, 0.012));
  scr.mesh.lookAt(0, 0.78, DASH.z);
  ship.add(scr.mesh);
  // a can in the holder, and a hank of wires hanging under the dash
  const can = new THREE.Mesh(new THREE.CylinderGeometry(0.033, 0.033, 0.12, 16), M.can);
  can.position.set(0.16, 0.97, -0.6);
  ship.add(can);
  const canBand = new THREE.Mesh(new THREE.CylinderGeometry(0.0335, 0.0335, 0.05, 16), M.red);
  canBand.position.set(0.16, 0.97, -0.6);
  ship.add(canBand);
  for (let i = 0; i < 4; i++) {
    const x = -0.05 + i * 0.05;
    const w = new THREE.Mesh(
      tubeAlong(
        [
          [x + 0.2, 0.62, -0.78],
          [x + 0.2 + (r() - 0.5) * 0.1, 0.42, -0.66],
          [x + 0.2 + (r() - 0.5) * 0.15, 0.36, -0.52],
          [x + 0.2 + (r() - 0.5) * 0.1, 0.46, -0.4],
        ],
        0.006,
        { segs: 16, radial: 6 },
      ),
      M.wire[i],
    );
    ship.add(w);
  }

  // the wheel, before you: click it to go
  const wheel = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.02, 10, 40), M.black);
  wheel.add(ring);
  for (let i = 0; i < 3; i++) {
    const sp = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.022, 0.016), M.hullDark);
    sp.position.x = 0.075;
    const arm = new THREE.Group();
    arm.rotation.z = Math.PI / 2 + (i * Math.PI * 2) / 3;
    arm.add(sp);
    wheel.add(arm);
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.04, 16), M.red);
  hub.rotation.x = Math.PI / 2;
  wheel.add(hub);
  wheel.scale.setScalar(0.8);
  wheel.position.set(EYE[0], 0.94, -0.3);
  wheel.rotation.x = -0.85;
  ship.add(wheel);
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.024, 0.34, 10), M.hullDark);
  column.position.set(EYE[0], 0.86, -0.44);
  column.rotation.x = -0.85 - Math.PI / 2;
  ship.add(column);

  // the seats
  const seat = (x) => {
    const g = new THREE.Group();
    const base = new THREE.Mesh(roundedBox(0.5, 0.14, 0.5, 0.05), M.seat);
    base.position.set(0, 0.42, 0.42);
    const back = new THREE.Mesh(roundedBox(0.5, 0.62, 0.13, 0.05), M.seat);
    back.position.set(0, 0.78, 0.72);
    back.rotation.x = -0.18;
    const stitch = new THREE.Mesh(roundedBox(0.36, 0.42, 0.02, 0.01), M.seatDark);
    stitch.position.set(0, 0.8, 0.645);
    stitch.rotation.x = -0.18;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.36, 10), M.black);
    post.position.set(0, 0.18, 0.45);
    g.add(base, back, stitch, post);
    g.position.x = x;
    return g;
  };
  ship.add(seat(0.36), seat(EYE[0]));

  // ── Morty, beside you ──
  const cast = createMeshyCast();
  await cast.load(null, ['morty'], { clips: ['sit', 'walk'] });
  const morty = cast.make('morty');
  if (morty) {
    morty.group.scale.setScalar(1.5 / morty.height);
    morty.group.rotation.y = Math.PI;
    for (const [n, a] of Object.entries(morty.act ?? {})) a.setEffectiveWeight(n === 'sit' ? 1 : 0);
    morty.mixer?.update(0.01);
    // drawn, not painted: his texture snapped to the show's colours for him
    morty.group.traverse((o) => {
      if (!o.isMesh || !o.material?.map) return;
      const drawn = drawnSkin(o.material.map, MORTY);
      disposers.push(drawn);
      o.material = drawn;
    });
    ship.add(morty.group);
    // sat on his seat: his hips just above the cushion
    ship.updateMatrixWorld(true);
    const hips = morty.group.getObjectByName('Hips');
    if (hips) {
      const at = hips.getWorldPosition(new THREE.Vector3());
      ship.worldToLocal(at);
      morty.group.position.add(new THREE.Vector3(0.4, 0.6, 0.5).sub(at));
    } else morty.group.position.set(0.4, 0.35, 0.4);
  }
  disposers.push({ dispose: () => cast.dispose() });

  // ── your arms: Rick's, in the lab coat ──
  const SHOULDER = { l: new THREE.Vector3(EYE[0] - 0.21, EYE[1] - 0.29, EYE[2] + 0.02), r: new THREE.Vector3(EYE[0] + 0.21, EYE[1] - 0.29, EYE[2] + 0.02) };
  const UPPER = 0.3;
  const FORE = 0.29;
  const sleeveGeo = new THREE.CylinderGeometry(0.052, 0.058, 1, 14, 1, true);
  const foreGeo = new THREE.CylinderGeometry(0.046, 0.052, 1, 14, 1, true);
  const jointGeo = new THREE.SphereGeometry(0.056, 14, 10);
  const arm = (side) => {
    const g = new THREE.Group();
    const upper = new THREE.Mesh(sleeveGeo, M.coat);
    const fore = new THREE.Mesh(foreGeo, M.coat);
    const joint = new THREE.Mesh(jointGeo, M.coat);
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.044, 0.03, 14), M.shirt);
    const h = hand(M.skin);
    g.add(upper, fore, joint, cuff, h);
    ship.add(g);
    return { side, upper, fore, joint, cuff, hand: h, e: new THREE.Vector3() };
  };
  const arms = { l: arm('l'), r: arm('r') };
  const gun = portalGun(M);
  arms.r.hand.add(gun);
  gun.scale.setScalar(1.25);
  gun.position.set(0, 0.022, 0.03); // the grip in the fist, the body over it
  // pose an arm: the wrist at `w`, the hand pointing along `dir`
  const look = new THREE.Vector3();
  const lean = new THREE.Vector3();
  const pose = (a, w, dir, pole) => {
    const S = SHOULDER[a.side];
    elbow(S, w, UPPER, FORE, pole, a.e);
    setBetween(a.upper, S, a.e);
    setBetween(a.fore, a.e, w);
    a.joint.position.copy(a.e);
    lean.subVectors(w, a.e).normalize();
    a.cuff.position.copy(w).addScaledVector(lean, -0.01);
    a.cuff.quaternion.setFromUnitVectors(UP, lean);
    a.hand.position.copy(w);
    a.hand.lookAt(look.copy(w).add(dir));
  };
  // the left hand on the wheel, at ten to; the right resting with the gun
  wheel.updateMatrixWorld(true);
  const grip = new THREE.Vector3(-0.155, 0.07, 0.01).applyMatrix4(wheel.matrixWorld);
  ship.worldToLocal(grip);
  const leftWrist = grip.clone().add(new THREE.Vector3(-0.03, -0.02, 0.07));
  const leftDir = new THREE.Vector3().subVectors(grip, leftWrist).normalize();
  const POLE = { l: new THREE.Vector3(-1, -0.6, 0.3), r: new THREE.Vector3(1, -0.7, 0.3) };
  pose(arms.l, leftWrist, leftDir, POLE.l);
  const REST = { w: new THREE.Vector3(-0.06, 1.0, -0.14), dir: new THREE.Vector3(-0.15, 0.05, -1).normalize() };
  const AIM = { w: new THREE.Vector3(-0.08, 1.16, -0.1), dir: new THREE.Vector3(0.02, 0.05, -1).normalize() };
  const rw = new THREE.Vector3();
  const rd = new THREE.Vector3();
  const tipAt = new THREE.Vector3();

  // the dome: a bubble of glass, faintly cyan, white where it turns away
  const domeMat = domeMaterial();
  disposers.push(domeMat);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1.0, 48, 20, 0, Math.PI * 2, 0, Math.PI / 2), domeMat);
  dome.scale.set(1.04, 0.95, 1.2);
  dome.position.set(0, 0.95, 0.12);
  dome.renderOrder = 10;
  ship.add(dome);
  // two highlights painted on the glass, as the show does
  const shine = new MeshBasicNodeMaterial({ color: 0xffffff, transparent: true, opacity: 0.14, depthWrite: false, side: THREE.DoubleSide });
  disposers.push(shine);
  for (const [a, w] of [[0.9, 0.05]]) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(1.003, 32, 4, Math.PI * 1.55 + a * 0.3, 0.6, 0.55 + w, 0.035), shine);
    s.scale.copy(dome.scale);
    s.position.copy(dome.position);
    s.renderOrder = 11;
    ship.add(s);
  }

  // ink round everything but the glass and the screen
  const inkMat = ink(ship, 0.0105, { skip: (o) => o.userData.noInk || o === dome || o.material === shine || o === scr.mesh || o.material === M.bulb });
  disposers.push(inkMat);

  // ── light: dusk ──
  // (near-white, so the lab coat reads white; the dusk is outside)
  const hemi = new THREE.HemisphereLight(0xf2f2ff, 0x6a6478, 1.9);
  const sun = new THREE.DirectionalLight(0xffe6cc, 1.6);
  sun.position.set(1.5, 2.5, 4);
  const front = new THREE.DirectionalLight(0xc8b8ff, 0.8);
  front.position.set(-1, 2, -3);
  const green = new THREE.PointLight(0x8cff6a, 0, 30, 1.2);
  green.position.set(0, 1.4, -4);
  inside.add(hemi, sun, front, green);

  // ── outside: the street ──
  const street = new THREE.Group();
  street.position.y = -HOVER;
  outside.add(street);
  outside.add(duskSky());
  const grass = cel(0x6fae5a);
  const tar = cel(0x5a5d66);
  const walk = cel(0xc9c3b8);
  const line = cel(0xf2d14a);
  disposers.push(grass, tar, walk, line);
  const LEN = 420;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, LEN), grass);
  ground.rotation.x = -Math.PI / 2;
  ground.position.z = -LEN / 2 + 60;
  street.add(ground);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(10, LEN), tar);
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0.02, ground.position.z);
  street.add(road);
  for (const sx of [-1, 1]) {
    const sw = new THREE.Mesh(new THREE.PlaneGeometry(2.4, LEN), walk);
    sw.rotation.x = -Math.PI / 2;
    sw.position.set(sx * 6.4, 0.03, ground.position.z);
    street.add(sw);
  }
  const dashes = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.2, 2.4), line, 60);
  for (let i = 0; i < 60; i++) dashes.setMatrixAt(i, new THREE.Matrix4().makeRotationX(-Math.PI / 2).setPosition(0, 0.04, 40 - i * 7));
  street.add(dashes);

  // the houses either side, and their trees and fences
  const [houses, oak, lamp] = await Promise.all([
    Promise.all(['house-a', 'house-c', 'house-f', 'house-k'].map((n) => loadModel(`${KENNEY}/${n}.glb`))),
    loadModel(`${KENNEY}/oak.glb`),
    loadModel(`${MODELS}/street-lamp.glb`),
  ]);
  // Kenney's suburbs in the show's flat light
  const flat = (root) => {
    toonify(root);
    root.traverse((o) => {
      if (!o.isMesh) return;
      for (const m of [o.material].flat()) {
        m.gradientMap = flatRamp();
        m.needsUpdate = true;
      }
    });
    return root;
  };
  const kinds = houses.filter(Boolean).map(flat);
  if (oak) flat(oak);
  if (lamp) flat(lamp);
  const SPACING = 15;
  const ROWS = coarse ? 10 : 16;
  for (let i = 0; i < ROWS; i++) {
    for (const sx of [-1, 1]) {
      const z = 30 - i * SPACING + (sx > 0 ? 6 : 0);
      if (kinds.length) {
        const h = kinds[Math.floor(r() * kinds.length)].clone();
        h.scale.setScalar(8 + r() * 1.5);
        h.position.set(sx * (17 + r() * 2), 0, z);
        h.rotation.y = sx > 0 ? -Math.PI / 2 : Math.PI / 2;
        street.add(h);
      }
      if (oak && r() < 0.7) {
        const tr = oak.clone();
        tr.scale.setScalar(6 + r() * 2.5);
        tr.position.set(sx * (10 + r() * 2), 0, z - 6 - r() * 3);
        tr.rotation.y = r() * Math.PI * 2;
        street.add(tr);
      }
      if (lamp && i % 2 === 0) {
        const l = lamp.clone();
        l.scale.setScalar(1.6);
        l.position.set(sx * 5.4, 0, z + 3);
        l.rotation.y = sx > 0 ? Math.PI : 0;
        street.add(l);
        const g = glowSprite('#ffe0a0', 3.2, 0.7);
        g.position.set(sx * 5.4 - sx * 0.4, 6.0, z + 3);
        street.add(g);
      }
    }
  }
  // lit windows as the evening comes on: the houses' own, a touch warmer
  street.traverse((o) => {
    if (o.isMesh && o.material?.isMeshToonMaterial && /window|glass/i.test(o.material.name ?? '')) o.material.emissive = new THREE.Color(0x553a10);
  });
  // ink on the houses, a little heavier for the distance
  if (rich) disposers.push(ink(street, 0.02, { skip: (o) => o === ground || o === road || o.isInstancedMesh || o.geometry?.type === 'PlaneGeometry' }));
  const outLight = [new THREE.HemisphereLight(0xffd9e8, 0x4a4060, 1.7), new THREE.DirectionalLight(0xffc49a, 1.8)];
  outLight[1].position.set(20, 30, 60);
  outside.add(...outLight);

  // the portal, and the shot that opens it
  const portal = portalDisc();
  portal.mesh.position.set(0, 1.4, PORTAL_Z);
  portal.mesh.visible = false;
  outside.add(portal.mesh);
  disposers.push(portal.mesh.material);
  const shot = glowSprite('#9dff6e', 0.9, 1);
  shot.visible = false;
  outside.add(shot);
  const shotFrom = new THREE.Vector3();
  // the gun's flash as it fires
  const muzzle = glowSprite('#b8ff7a', 0.22, 0);
  gun.userData.tip.add(muzzle);

  return {
    inside,
    outside,
    eye: EYE,
    rest: [-0.06, -0.24],
    range: [1.5, 0.5],
    hfov: 90,
    vmin: 56,
    vmax: 98,
    exposure: 1.0,
    // flat colours as painted: no filmic curve
    toneMapping: THREE.NoToneMapping,
    envIntensity: 0.15,
    bloom: [0.5, 0.4, 0.97], // only the portal's green and the lights
    flash: '#b4f36c',
    glance: -0.8, // over at Morty
    rumble: 0.6,
    triggers: [wheel],
    resize() {},
    launch() {},
    update(dt, t, { launching, t: lt, plan, throttle }) {
      scr.tick(t);
      // Morty: sat up, looking over at you now and then (nervously); when
      // you go, his arms up and his head back
      if (morty) {
        morty.update?.(t, 0, 0);
        morty.mixer?.update(0);
        const g = morty.group;
        const spine = g.getObjectByName('Spine01');
        const head = g.getObjectByName('Head');
        const panic = launching ? smooth((lt - 250) / 400) : 0;
        const glance = launching ? 0 : smooth(Math.sin(t * 0.55 + 1) * 2 - 0.4);
        spine?.rotateX(-0.42 + 0.12 * panic);
        head?.rotateY(0.6 * glance);
        head?.rotateX(0.18 - 0.35 * panic + Math.sin(t * 9) * 0.03 * glance);
        for (const [n, sx] of [
          ['LeftArm', -1],
          ['RightArm', 1],
        ]) {
          const b = g.getObjectByName(n);
          if (!b) continue;
          b.rotateX(-1.6 * panic);
          b.rotateZ(sx * 0.4 * panic);
        }
      }
      // your right arm: the gun up and aimed from the start of the launch,
      // a kick when it fires
      const up = launching ? smooth(lt / 300) : 0;
      const kick = launching ? Math.max(0, 1 - Math.abs(lt - 330) / 160) * (lt > 300 ? 1 : 0) : 0;
      rw.lerpVectors(REST.w, AIM.w, up);
      rw.z += kick * 0.035;
      rw.y += Math.sin(t * 1.7) * 0.004 * (1 - up);
      rd.lerpVectors(REST.dir, AIM.dir, up);
      rd.y += kick * 0.25;
      rd.normalize();
      pose(arms.r, rw, rd, POLE.r);
      muzzle.material.opacity = launching ? Math.max(0, 1 - Math.abs(lt - 330) / 120) : 0;
      muzzle.scale.setScalar(0.12 + 0.25 * muzzle.material.opacity);
      if (!launching || lt < 300) {
        gun.userData.tip.getWorldPosition(tipAt);
        shotFrom.copy(tipAt);
      }
      // the shot, then the portal opening
      const fired = launching ? clamp01((lt - 300) / 420) : 0;
      shot.visible = launching && lt > 300 && lt < 760;
      if (shot.visible) shot.position.lerpVectors(shotFrom, portal.mesh.position, smooth(fired));
      const open = launching ? smooth((lt - 700) / 650) : 0;
      portal.mesh.visible = open > 0.001;
      portal.u.open.value = open;
      portal.u.t.value = t;
      const R = 5.2;
      portal.mesh.scale.set(R, R * 1.25, 1);
      // floor it: the street comes at you, the portal with it
      let travel = 0;
      if (launching && lt > plan.spool) {
        const k = clamp01((lt - plan.spool) / (plan.peak - plan.spool));
        travel = -PORTAL_Z * Math.pow(k, 2.2);
      }
      street.position.z = travel;
      // hovering: a slow bob, settling as you go
      street.position.y = -HOVER + Math.sin(t * 1.3) * 0.07 * (1 - throttle) + Math.sin(t * 0.7) * 0.03;
      portal.mesh.position.z = PORTAL_Z + travel;
      green.intensity = launching ? 30 * open * (0.3 + 0.7 * throttle) : 0;
      green.position.z = Math.min(-1.5, PORTAL_Z + travel);
    },
    dispose() {
      for (const d of disposers) d.dispose?.();
    },
  };
}
