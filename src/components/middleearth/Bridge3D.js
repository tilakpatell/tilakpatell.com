// The Bridge of Khazad-dûm in WebGL: the great hall's columns going down
// into the fire, the slender bridge between two ledges, the Balrog coming
// across it and Gandalf at the near end. It draws what ./duel.js says is
// happening (the host hands it the duel's state every frame, and tells it
// about the moments: a block, a strike, a lash), and decides nothing.
//
// Loaded only when the bridge is on screen and WebGL works.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createStage, hot } from './stage';
import { houseOn } from '../../lib/three/house';
import { fbm, makeNoise, mix } from '../../lib/paint';
import { DUEL } from './duel';
import { EMBER, FIRE, LIGHT, SMOKE, createParticles, lavaMaterial, makeBalrog, makeGandalf, skyDome, stoneTextures } from './kit';
import { createShake } from './feel';
import { BLOOMS } from './look';
import { houseGroups } from '../../lib/three/houseTuning';

// the drawing's x (see duel.js) to the scene's
const X = (svg) => (svg - 320) / 20;
const DECK = { x0: X(70), x1: X(570), n: 20, w: 1.9 };
const HOME = X(540); // where Gandalf stands
const LAVA_Y = -22;
const deckY = (x) => Math.max(0, 0.34 * (1 - (x / DECK.x1) ** 2));
const R = (a) => (Math.random() - 0.5) * 2 * a;

// A block of the mountain: flat on top, ragged down its sides.
function cliff(w, h, d, seed) {
  const g = new THREE.BoxGeometry(w, h, d, Math.ceil(w / 3), Math.ceil(h / 3), Math.ceil(d / 3));
  const n = makeNoise(seed);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    if (y > h / 2 - 0.01) continue;
    const deep = Math.min(1, (h / 2 - y) / 7);
    const a = fbm(n, x * 0.16 + y * 0.07, z * 0.16, { octaves: 3 }) - 0.5;
    const b = fbm(n, x * 0.16 + 40, z * 0.16 + y * 0.09, { octaves: 3 }) - 0.5;
    p.setXYZ(i, x + a * 5 * deep, y, z + b * 5 * deep);
  }
  g.computeVertexNormals();
  return g;
}

// One of the hall's columns: eight-sided, banded.
function column(h) {
  const parts = [new THREE.CylinderGeometry(2.3, 2.75, h, 8, 1).rotateY(Math.PI / 8)];
  for (let y = -h / 2 + 9; y < h / 2; y += 11) {
    parts.push(new THREE.BoxGeometry(5.9, 1.3, 5.9).translate(0, y, 0));
    parts.push(new THREE.CylinderGeometry(2.95, 2.95, 0.5, 8).rotateY(Math.PI / 8).translate(0, y + 1.3, 0));
  }
  return mergeGeometries(parts);
}

// The whip: a ribbon that turns to face the camera, drawn through points
// that chase wherever the whip should be.
function createWhip(n = 28) {
  const pos = new Float32Array(n * 6);
  const col = new Float32Array(n * 6);
  const idx = [];
  for (let i = 0; i < n; i++) {
    col.fill(1 - 0.7 * (i / (n - 1)), i * 6, i * 6 + 6);
    if (i < n - 1) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(idx);
  const material = new THREE.MeshBasicMaterial({ color: hot(0xff8a2a, 2), vertexColors: true, side: THREE.DoubleSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const mesh = new THREE.Mesh(geo, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 4;
  const pts = Array.from({ length: n }, () => new THREE.Vector3());
  const tan = new THREE.Vector3();
  const side = new THREE.Vector3();
  const view = new THREE.Vector3();
  const write = (camera) => {
    for (let i = 0; i < n; i++) {
      tan.subVectors(pts[Math.min(n - 1, i + 1)], pts[Math.max(0, i - 1)]);
      view.subVectors(camera.position, pts[i]);
      side.crossVectors(tan, view).normalize().multiplyScalar(mix(0.085, 0.02, i / (n - 1)));
      const o = i * 6;
      pos[o] = pts[i].x + side.x;
      pos[o + 1] = pts[i].y + side.y;
      pos[o + 2] = pts[i].z + side.z;
      pos[o + 3] = pts[i].x - side.x;
      pos[o + 4] = pts[i].y - side.y;
      pos[o + 5] = pts[i].z - side.z;
    }
    geo.attributes.position.needsUpdate = true;
  };
  return { mesh, material, pts, write, n };
}

export function createBridge3D(canvas, { soft = false, reduced = false, onLost } = {}) {
  const stage = createStage(canvas, { soft, shadows: true, fov: 38, near: 0.5, far: 800, exposure: 1.15, bloom: BLOOMS.bridge, onLost });
  const { scene, camera, renderer } = stage;
  scene.fog = new THREE.FogExp2(0x140805, 0.011);
  scene.background = new THREE.Color(0x050302);
  stage.grade({ contrast: 0.2, saturation: 1.08, vignette: 0.42, shadow: [0.01, 0.004, 0], high: [0.03, 0.012, 0] });

  // ── the light: fire from below, a cold key from above, the two figures' own ──
  const hemi = new THREE.HemisphereLight(0x2a3550, 0xff6a22, 0.5);
  scene.add(hemi);
  const under = new THREE.DirectionalLight(0xff6a22, 0.7);
  under.position.set(3, -30, 16);
  scene.add(under);
  // the fire's own reach: brightest low on the columns and the cliffs, gone by the roof
  for (const [x, y, z, power] of [
    [-9, LAVA_Y + 6, -6, 700],
    [10, LAVA_Y + 6, -7, 700],
    [0, LAVA_Y + 8, -30, 1100],
    [-26, LAVA_Y + 8, 14, 600],
    [27, LAVA_Y + 8, 14, 600],
  ]) {
    const glow = new THREE.PointLight(0xff5a1a, power, 110, 2);
    glow.position.set(x, y, z);
    scene.add(glow);
  }
  const key = new THREE.DirectionalLight(0x9fb4d8, 1.25);
  key.position.set(9, 26, 15);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -22, right: 22, top: 16, bottom: -8, near: 2, far: 70 });
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.04;
  scene.add(key);

  // ── the hall ──
  scene.add(skyDome(420, { top: 0x020101, horizon: 0x140805, bottom: 0x7a2607 }));
  const lava = lavaMaterial({ scale: 0.06, spot: [0.5, -6], reach: 0.0026 });
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(520, 360).rotateX(-Math.PI / 2), lava);
  sea.position.set(0, LAVA_Y, -90);
  scene.add(sea);

  const masonry = stoneTextures(renderer, { seed: 5, courses: 4, joint: 0.3, repeat: [2, 12], dark: [44, 40, 38], light: [126, 117, 109] });
  const colMat = new THREE.MeshStandardMaterial({ map: masonry.map, normalMap: masonry.normalMap, roughness: 0.95, flatShading: true });
  const spots = [];
  // none straight behind the middle of the bridge: the drop there stays open
  for (const [z, xs] of [
    [-20, [-33, -18, 17, 32]],
    [-38, [-40, -25, -9, 8, 24, 39]],
    [-58, [-48, -32, -16, 0, 16, 32, 48]],
  ]) {
    for (const x of xs) spots.push([x, z]);
  }
  const H = 96;
  const columns = new THREE.InstancedMesh(column(H), colMat, spots.length);
  const m4 = new THREE.Matrix4();
  spots.forEach(([x, z], i) => columns.setMatrixAt(i, m4.makeTranslation(x, LAVA_Y - 4 + H / 2, z)));
  columns.receiveShadow = true;
  scene.add(columns);

  const rock = stoneTextures(renderer, { seed: 9, joint: 0.3, repeat: [4, 4], dark: [34, 28, 26], light: [120, 104, 94], relief: 4 });
  const rockMat = new THREE.MeshStandardMaterial({ map: rock.map, normalMap: rock.normalMap, roughness: 1, flatShading: true });
  const paving = stoneTextures(renderer, { seed: 13, courses: 8, joint: 0.35, repeat: [4, 4], dark: [44, 40, 39], light: [140, 130, 122] });
  const paveMat = new THREE.MeshStandardMaterial({ map: paving.map, normalMap: paving.normalMap, roughness: 0.9 });
  for (const s of [-1, 1]) {
    const ledge = new THREE.Mesh(cliff(36, 44, 44, s > 0 ? 21 : 34), rockMat);
    ledge.position.set(s * (DECK.x1 + 18), -22.02, -12);
    ledge.receiveShadow = true;
    scene.add(ledge);
    const floor = new THREE.Mesh(new THREE.BoxGeometry(34, 0.3, 40), paveMat);
    floor.position.set(s * (DECK.x1 + 17.2), -0.13, -11.5);
    floor.receiveShadow = true;
    scene.add(floor);
  }
  // the far side: a wall across the hall and the gate the Balrog came through
  const wallTex = { map: masonry.map.clone(), normalMap: masonry.normalMap.clone() };
  for (const t of Object.values(wallTex)) {
    t.repeat.set(3, 5);
    t.needsUpdate = true;
  }
  const wallMat = new THREE.MeshStandardMaterial({ ...wallTex, roughness: 0.95 });
  const wallX = DECK.x0 - 9;
  const block = (w, h, d, x, y, z, mat = wallMat) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    b.position.set(x, y, z);
    b.castShadow = true;
    b.receiveShadow = true;
    scene.add(b);
    return b;
  };
  block(20, 60, 14, wallX - 10, 30, 3.4 + 7); // this side of the gate
  block(20, 60, 28, wallX - 10, 30, -3.4 - 14); // the far side of it
  block(20, 48, 6.8, wallX - 10, 36, 0); // over it
  block(2.4, 12, 1.6, wallX + 1.2, 6, 4.2, colMat);
  block(2.4, 12, 1.6, wallX + 1.2, 6, -4.2, colMat);
  block(3, 1.8, 11.4, wallX + 1.2, 12.9, 0, colMat);
  // the near side: steps up and away
  for (let i = 0; i < 6; i++) block(2.2, 0.5 * (i + 1), 12, DECK.x1 + 6.6 + i * 2.2, 0.25 * (i + 1), -1, paveMat);
  block(3, 5, 3, DECK.x1 + 5, 2.5, -9.5, colMat).rotation.y = 0.3;
  block(3.6, 0.8, 3.6, DECK.x1 + 5, 5.2, -9.5, colMat).rotation.y = 0.3;

  // ── the bridge: twenty stones, so the ones under the Balrog can fall ──
  const deckTex = stoneTextures(renderer, { seed: 17, repeat: [1, 1], dark: [46, 40, 37], light: [170, 152, 138], relief: 3.4 });
  const deckMat = new THREE.MeshStandardMaterial({ map: deckTex.map, normalMap: deckTex.normalMap, roughness: 0.92 });
  const len = (DECK.x1 - DECK.x0) / DECK.n;
  const stoneGeo = new THREE.BoxGeometry(len * 0.985, 1, DECK.w);
  const stones = Array.from({ length: DECK.n }, (_, i) => {
    const cx = DECK.x0 + (i + 0.5) * len;
    const u = cx / DECK.x1;
    const thick = 0.62 + 0.9 * u * u;
    const mesh = new THREE.Mesh(stoneGeo, deckMat);
    mesh.scale.y = thick;
    mesh.position.set(cx, deckY(cx) - thick / 2, 0);
    mesh.rotation.z = -0.054 * u;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    return { mesh, home: mesh.position.clone(), tilt: mesh.rotation.z, fall: -1, delay: 0, vy: 0, spin: new THREE.Vector3() };
  });
  // over the deepest part of the drop: a line of fire along the deck's edges
  const sweetMat = new THREE.MeshBasicMaterial({ color: hot(0xff8a2a, 1.8), transparent: true, opacity: 0, fog: false });
  const sx0 = X(DUEL.sweet[0]);
  const sx1 = X(DUEL.sweet[1]);
  for (const s of [-1, 1]) {
    const line = new THREE.Mesh(new THREE.BoxGeometry(sx1 - sx0, 0.06, 0.06), sweetMat);
    line.position.set((sx0 + sx1) / 2, deckY((sx0 + sx1) / 2) + 0.02, s * (DECK.w / 2 + 0.02));
    scene.add(line);
  }

  // ── the two of them ──
  const balrog = makeBalrog(renderer);
  scene.add(balrog.group);
  const gandalf = makeGandalf();
  gandalf.group.position.set(HOME, deckY(HOME), 0);
  scene.add(gandalf.group);
  const whip = createWhip();
  scene.add(whip.mesh);

  // the staff's ward: a shell of light, bright at its rim
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(1.5, 32, 18),
    new THREE.ShaderMaterial({
      uniforms: { opacity: { value: 0 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: 'varying vec3 vN; varying vec3 vV; void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
      fragmentShader: `
        uniform float opacity;
        varying vec3 vN;
        varying vec3 vV;
        void main() {
          float rim = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2);
          gl_FragColor = vec4(vec3(1.5, 2.1, 3.2) * (0.06 + rim), opacity);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    }),
  );
  dome.visible = false;
  scene.add(dome);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.82, 1, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: hot(0xdfeaff, 2.4), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  ring.visible = false;
  scene.add(ring);

  // ── fire, smoke, sparks ──
  const k = soft ? 0.4 : 1;
  const fire = createParticles(520, { ramp: FIRE, stretch: 1.5, gravity: 2.4, drag: 0.9, swirl: 1.4 });
  const smoke = createParticles(140, { ramp: SMOKE, additive: false, gravity: 0.5, drag: 0.4, swirl: 0.6 });
  const embers = createParticles(420, { ramp: EMBER, gravity: 0.25, drag: 0.15, swirl: 1.6 });
  const sparks = createParticles(160, { ramp: LIGHT, gravity: -5, drag: 1.4 });
  scene.add(smoke.mesh, fire.mesh, embers.mesh, sparks.mesh);
  const burst = (pool, p, n, speed, size, life = 0.7) => {
    for (let i = 0; i < n * k; i++) pool.emit(p.x + R(0.2), p.y + R(0.2), p.z + R(0.2), R(speed), R(speed) + speed * 0.4, R(speed), life * (0.5 + Math.random()), size * (0.6 + Math.random() * 0.8), size * 0.2);
  };
  // a hall full of rising sparks already, not an empty one filling up
  for (let i = 0; i < 150 * k; i++) embers.emit(R(22), LAVA_Y + Math.random() * 30, -22 + R(26), R(0.4), 1.4 + Math.random() * 1.6, R(0.4), 5 + Math.random() * 6, 0.1 + Math.random() * 0.1, 0.03);

  // ── what is going on ──
  const S = { phase: 'idle', x: DUEL.start, whip: null, grey: 'standing', broken: null };
  // one shake, the site's (./feel.js), with the bridge's own numbers: trauma² × 0.7, fading 1.8 a second
  const shake = createShake({ calm: reduced, offset: 0.7, decay: 1.8 });
  const A = { t: 0, moving: 0, spread: 0.22, raise: 0, lash: 0, lashPose: 0, roar: 0, flare: 0.5, fall: -1, fallen: false, gFall: -1, gDrop: -1, gapX: 0, glow: 0, slam: -1, hurt: 0, shake: 0, dome: 0, ring: -1, step: 0, sweet: 0, ember: 0, smoke: 0 };
  let cam = null;
  const v = new THREE.Vector3();
  const hand = new THREE.Vector3();
  const tip = new THREE.Vector3();
  const goal = new THREE.Vector3();
  const dir = new THREE.Vector3(0.3, 0.27, 1).normalize();

  const restore = () => {
    for (const s of stones) {
      s.mesh.position.copy(s.home);
      s.mesh.rotation.set(0, 0, s.tilt);
      s.mesh.visible = true;
      s.fall = -1;
    }
  };
  const drop = (list) => {
    if (!list) return restore();
    const hit = stones.map((_, i) => list.includes(70 + i * 25));
    const first = hit.indexOf(true);
    const last = hit.lastIndexOf(true);
    A.gapX = last < 0 ? HOME : DECK.x0 + (last + 1) * len;
    stones.forEach((s, i) => {
      if (!hit[i]) return;
      s.fall = 0;
      s.delay = Math.abs(i - (first + last) / 2) * 0.06;
      s.vy = 0;
      s.spin.set(R(1.6), R(0.6), R(2.2));
    });
    return undefined;
  };
  const reset = () => {
    restore();
    A.fall = -1;
    A.fallen = false;
    A.gFall = -1;
    A.gDrop = -1;
    balrog.group.visible = true;
    balrog.group.rotation.set(0, 0, 0);
  };

  const update = (n) => {
    if (n.phase !== S.phase) {
      if (n.phase === 'drums') reset();
      else if (n.phase === 'coming') A.roar = 1;
      else if (n.phase === 'won') A.fall = 0;
      else if (n.phase === 'lost') {
        A.roar = 1;
        A.shake = Math.max(A.shake, 0.5);
      }
    }
    if (n.broken !== S.broken) drop(n.broken);
    if (n.grey !== S.grey) {
      if (n.grey === 'falling') {
        A.gFall = 0;
        A.gDrop = -1;
      } else {
        A.gFall = -1;
        gandalf.setWhite(n.grey === 'white');
        if (n.grey === 'white') {
          A.glow = 1.4;
          burst(sparks, v.set(HOME, 1.4, 0), 40, 3, 0.5, 1.1);
        }
      }
      gandalf.group.visible = n.grey !== 'gone';
    }
    if (n.whip === 'lash' && S.whip !== 'lash') A.lash = 1;
    S.phase = n.phase;
    S.x = n.x;
    S.whip = n.whip;
    S.grey = n.grey;
    S.broken = n.broken;
  };

  // the moments the duel's numbers don't carry
  const fx = (name) => {
    gandalf.staff.getWorldPosition(tip);
    tip.y += 1.06;
    if (name === 'block') {
      shake.hitstop(60); // the staff turns the whip: the duel holds a moment
      A.glow = 1;
      A.dome = 1;
      A.shake = Math.max(A.shake, 0.18);
      burst(sparks, tip, 36, 5, 0.42);
    } else if (name === 'strike') {
      A.slam = 0;
      A.glow = 1.7;
      A.ring = 0;
      A.shake = 0.8;
      burst(sparks, v.set(HOME - 0.45, deckY(HOME) + 0.1, 0.37), 50, 6, 0.5, 0.9);
    } else if (name === 'soon') {
      A.slam = 0;
      A.glow = 0.7;
      A.shake = Math.max(A.shake, 0.25);
    } else if (name === 'lash') {
      shake.hitstop(70); // the whip lands
      A.hurt = 1;
      A.shake = Math.max(A.shake, 0.45);
      burst(fire, v.set(HOME, deckY(HOME) + 1.2, 0), 26, 3, 0.9, 0.5);
    } else if (name === 'miss') A.glow = Math.max(A.glow, 0.3);
  };

  // the house look (lib/three/house), as in Middle-earth's towns: the house
  // tone mapper, the shade one colour from the cold light from above; its own fog kept
  const house = houseOn({ renderer, scene, sun: key, hemi, look: { fog: false } });
  stage.tune([...houseGroups(house), ...shake.groups()]); // ?debug: the bloom, the look and the shake on one panel
  let houseFrames = 0;

  const render = (ms = 16) => {
    const dt = Math.min(0.05, ms / 1000);
    A.t += dt;
    const t = A.t;
    const ease = (cur, to, rate) => cur + (to - cur) * (1 - Math.exp(-rate * dt));
    const fighting = S.phase === 'drums' || S.phase === 'coming';
    lava.uniforms.uTime.value = t;

    A.moving = ease(A.moving, S.phase === 'coming' ? 1 : 0, 6);
    A.spread = ease(A.spread, S.phase === 'idle' ? 0.22 : S.phase === 'drums' ? 0.42 : 1, 2.5);
    A.raise = ease(A.raise, S.whip === 'up' ? 1 : 0, S.whip === 'up' ? 7 : 10);
    A.lash = Math.max(0, A.lash - dt / 0.32);
    A.lashPose = ease(A.lashPose, A.lash > 0 ? 1 : 0, A.lash > 0 ? 30 : 5);
    A.roar = Math.max(0, A.roar - dt / 1.6);
    A.flare = ease(A.flare, S.phase === 'idle' ? 0.5 : S.phase === 'drums' ? 0.72 : S.phase === 'lost' ? 1.7 : 1.05, 2);
    A.glow = Math.max(0, A.glow - dt * 2.2);
    A.hurt = Math.max(0, A.hurt - dt * 1.5);
    A.sweet = ease(A.sweet, fighting ? 1 : 0, 4);
    sweetMat.opacity = A.sweet * (0.55 + 0.25 * Math.sin(t * 3.2));

    // ── the Balrog ──
    const bx = X(S.x);
    const B = balrog.group;
    // gone for good once Gandalf has come back as the White, until the next duel
    if (S.grey === 'white' && S.phase === 'idle') B.visible = false;
    let by = deckY(bx);
    if (A.fall >= 0 && !A.fallen) {
      A.fall += dt;
      const tau = Math.max(0, A.fall - 0.35);
      by -= 4.2 * tau * tau;
      B.rotation.z = tau * 0.32;
      B.rotation.x = tau * 0.18;
      if (by < LAVA_Y - 5) {
        A.fallen = true;
        B.visible = false;
        v.set(bx, LAVA_Y + 0.5, 0);
        burst(fire, v, 70, 7, 3.2, 1.4);
        burst(embers, v, 90, 9, 0.2, 3);
      }
    }
    B.position.set(bx, by, 0);
    const flail = A.fall > 0.35 ? 0.5 + 0.5 * Math.sin(t * 9) : 0;
    // (its walk is its own: read from where it's put, ./kit.js)
    balrog.animate({ t, spread: A.spread, raise: Math.max(A.raise, flail), lash: A.lashPose, roar: Math.max(A.roar, flail * 0.6), flare: A.flare });
    B.updateMatrixWorld(true);
    balrog.hand.getWorldPosition(hand);
    if (B.visible) {
      // each footfall, as a foot comes down
      const step = balrog.steps ?? 0;
      if (step !== A.step) {
        A.step = step;
        if (A.moving > 0.5) {
          A.shake = Math.max(A.shake, 0.14);
          burst(embers, v.set(bx + 0.6, by + 0.1, R(0.6)), 10, 1.6, 0.14, 1.2);
        }
      }
      for (const f of balrog.flames) {
        f.acc += f.rate * k * A.flare * dt;
        while (f.acc >= 1) {
          f.acc -= 1;
          f.at.getWorldPosition(v);
          fire.emit(v.x + R(0.25), v.y + R(0.15), v.z + R(0.25), -1.5 * A.moving + R(0.5), 1.4 + Math.random() * 1.8, R(0.5), 0.4 + Math.random() * 0.55, f.size * (0.8 + Math.random() * 0.6), f.size * 0.2, 0.5);
        }
      }
      A.smoke += 16 * k * dt;
      while (A.smoke >= 1) {
        A.smoke -= 1;
        smoke.emit(bx - 1 + R(0.9), by + 4.2 + R(1.6), R(1.2), -0.7 * A.moving + R(0.3), 0.9 + Math.random(), R(0.3), 2 + Math.random() * 1.4, 2.2, 5.5);
      }
    }

    // ── the whip ──
    const mode = S.grey === 'falling' ? 'catch' : !B.visible ? 'gone' : A.lash > 0 ? 'lash' : S.whip === 'up' ? 'up' : 'idle';
    whip.mesh.visible = mode !== 'gone';
    if (whip.mesh.visible) {
      const G = gandalf.group.position;
      const rate = mode === 'lash' ? 42 : mode === 'catch' ? 16 : 11;
      const follow = 1 - Math.exp(-rate * dt);
      for (let i = 0; i < whip.n; i++) {
        const s = i / (whip.n - 1);
        if (mode === 'idle') {
          goal.set(hand.x - 0.8 * s - 2.8 * s * s * (0.6 + 0.4 * Math.sin(t * 1.3)), hand.y - 3.7 * s + 0.3 * s * Math.sin(t * 2 + s * 5), hand.z + 0.5 * s * Math.sin(t * 1.7 + s * 4));
          if (bx > DECK.x0 - 2 && A.fall < 0) goal.y = Math.max(goal.y, deckY(goal.x) + 0.08);
        } else if (mode === 'up') {
          const a = s * 3.5;
          goal.set(hand.x - 2.6 * Math.sin(a) - 0.6 * s, hand.y + 2.5 * (1 - Math.cos(a)), hand.z + 0.4 * Math.sin(a * 2 + t * 6));
        } else if (mode === 'lash') {
          const kk = 1 - A.lash;
          goal.set(mix(hand.x, HOME - 0.2, s), mix(hand.y, deckY(HOME) + 1.3, s) + Math.sin(Math.PI * s) * 2.4 * (1 - kk), mix(hand.z, 0.2, s) + Math.sin(s * 9 - kk * 12) * 0.4 * (1 - s));
        } else {
          const from = B.visible ? hand : v.set(bx + 1, LAVA_Y, 0);
          goal.set(mix(from.x, G.x - 0.1, s), mix(from.y, G.y + 0.25, s) + Math.sin(Math.PI * s) * 1.6, mix(from.z, G.z, s));
        }
        if (cam) whip.pts[i].lerp(goal, follow);
        else whip.pts[i].copy(goal);
      }
      whip.write(camera);
      whip.material.color.copy(hot(0xff8a2a, 1.6 + 3.2 * A.raise + (mode === 'lash' ? 2.4 : 0)));
      if (A.raise > 0.3 && Math.random() < 0.6 * k) {
        const p = whip.pts[Math.floor(Math.random() * whip.n)];
        embers.emit(p.x, p.y, p.z, R(1.5), R(1.5), R(1.5), 0.5 + Math.random() * 0.5, 0.16, 0.04);
      }
    }

    // ── Gandalf ──
    const G = gandalf.group;
    if (G.visible) {
      let gx = HOME;
      let gy = deckY(HOME);
      let tilt = 0;
      if (A.gFall >= 0) {
        // the whip has him by the ankle: dragged to where the bridge ends, and over
        A.gFall += dt;
        gx = Math.max(A.gapX - 0.8, HOME - 6.5 * A.gFall * A.gFall);
        tilt = Math.min(1, A.gFall * 2.2);
        if (gx <= A.gapX && A.gDrop < 0) A.gDrop = A.gFall;
        gy = deckY(gx) + 0.25 * tilt;
        if (A.gDrop >= 0) gy -= 9 * (A.gFall - A.gDrop) ** 2;
      }
      G.position.set(gx + A.hurt * 0.25, gy, 0);
      G.rotation.z = -tilt * 1.45;
      if (A.slam >= 0) {
        A.slam += dt / 0.5;
        if (A.slam >= 1) A.slam = -1;
      }
      gandalf.animate({ t, raise: Math.min(1, A.dome * 1.4), slam: Math.max(0, A.slam), glow: A.glow, lean: A.hurt });
    }
    if (A.dome > 0) {
      A.dome = Math.max(0, A.dome - dt * 2.6);
      dome.visible = A.dome > 0;
      dome.position.set(HOME - 0.2, deckY(HOME) + 1.1, 0);
      dome.scale.setScalar(1 + (1 - A.dome) * 0.7);
      dome.material.uniforms.opacity.value = A.dome;
    }
    if (A.ring >= 0) {
      A.ring += dt / 0.7;
      ring.visible = A.ring < 1;
      ring.position.set(HOME - 0.45, deckY(HOME) + 0.06, 0.2);
      ring.scale.setScalar(1 + A.ring * 15);
      ring.material.opacity = (1 - A.ring) ** 2;
      if (A.ring >= 1) A.ring = -1;
    }

    // ── the stones that fall ──
    for (const s of stones) {
      if (s.fall < 0 || !s.mesh.visible) continue;
      s.fall += dt;
      if (s.fall < s.delay) continue;
      s.vy -= 11 * dt;
      s.mesh.position.y += s.vy * dt;
      s.mesh.rotation.x += s.spin.x * dt;
      s.mesh.rotation.y += s.spin.y * dt;
      s.mesh.rotation.z += s.spin.z * dt;
      if (s.mesh.position.y < LAVA_Y) {
        s.mesh.visible = false;
        burst(embers, s.mesh.position, 14, 4, 0.18, 2);
      }
    }

    // ── sparks rising through the hall ──
    A.ember += 24 * k * dt;
    while (A.ember >= 1) {
      A.ember -= 1;
      embers.emit(R(24), LAVA_Y + 1, -22 + R(27), R(0.4), 1.4 + Math.random() * 1.8, R(0.4), 6 + Math.random() * 6, 0.09 + Math.random() * 0.11, 0.03);
    }
    fire.step(dt);
    smoke.step(dt);
    embers.step(dt);
    sparks.step(dt);

    // ── the camera: both of them in frame, closer as the gap closes ──
    const won = S.phase === 'won' && A.fall >= 0;
    const left = (B.visible || won ? Math.min(bx, HOME - 6) : HOME - 13) - (won ? 6 : 8.5);
    const right = HOME + 2.8;
    const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const wantX = (left + right) / 2;
    // after the strike it looks down into the drop, to see it fall
    const wantD = Math.max(won ? 27 : 17, ((right - left) / 2 / (tanV * camera.aspect)) * 1.04);
    const wantY = won && !A.fallen ? -3.5 : 0;
    if (!cam) cam = { x: wantX, d: wantD, y: wantY };
    cam.x = ease(cam.x, wantX, 1.5);
    cam.d = ease(cam.d, wantD, 1.5);
    cam.y = ease(cam.y, wantY, 1.2);
    const ty = 2.3 + cam.d * 0.04 + cam.y;
    camera.position.set(cam.x + dir.x * cam.d, ty + dir.y * cam.d, dir.z * cam.d);
    if (!reduced) {
      camera.position.x += Math.sin(t * 0.23) * 0.4;
      camera.position.y += Math.sin(t * 0.31) * 0.22;
    }
    shake.update(dt, camera, A.shake);
    A.shake = 0;
    camera.lookAt(cam.x, ty, 0);

    // (what's come in since, taken on now and then)
    house.follow({ adopt: houseFrames++ % 60 === 0 });
    stage.render(ms);
  };

  return {
    update,
    fx,
    render,
    resize: stage.resize,
    timeScale: shake.feel.timeScale, // how much of a frame the duel runs: less for a moment in a hitstop
    dispose() {
      shake.dispose();
      stage.dispose();
    },
    stage,
    get lost() {
      return stage.lost;
    },
  };
}
