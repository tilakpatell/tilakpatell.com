// Infiltration in 3D: the level as a miniature HYDRA facility on the
// operations room's holotable, seen from above and to the south. It draws a
// level's state (./rules.js): Natasha, the guards and what their torches
// reach (stopped by the walls), the cameras' sweeps, the lasers, the file and
// the lift out, and turns the rules' events into takedowns, the Widow's Bite,
// hacks and alarms. Every change of state is eased over a quarter second, so a
// turn plays out rather than jumps.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createStage, hot } from '../hq/stage';
import { instanceModel, preload } from '../hq/assets';
import { buildHumanoid, poseHumanoid } from '../hq/kit/humanoid';
import { mixPose, snapPose } from '../hq/kit/blend';
import { canvasTexture } from '../hq/kit/shapes';
import { createVfx } from '../hq/vfx';
import { createFeel, feelGroups } from '../hq/feel';
import { prefersReducedMotion } from '../../../lib/hooks';
import { BITE, CAMERA, DIRS, VISION, angleOf, camAngle, cell, intent, laserOn, solid, visibleTiles, visionPolygon } from './rules';
import { BLUE, CUT_H, RED, T, WALL_H, backdropTexture, buildCamera, buildExit, buildFile, buildTable, buildWalls, caseGeometry, deskGeometry, emitterGeometry, facilityMaterials, floorDecal, glassGeometry, rackGeometry, terminalGeometry, toWorld } from './models';

const TURN = 0.26; // seconds a turn takes to play out
const REWIND = 0.5;
const RAYS = 44;
const FOV = 30;

const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2);
// how much of a step's stride to show at k of the way across a tile: in
// over its first fifth, out over its last (the figure's at rest at both ends)
const stepIn = (k) => {
  const w = Math.max(0, Math.min(1, k / 0.2, (1 - k) / 0.2));
  return w * w * (3 - 2 * w);
};
// the stride's legs go round once a tile (1.6 m), in step with the eased
// slide across it, so the feet stay where they're put
const GUARD_STRIDE = (Math.PI * 2) / (1.1 * 5); // poseHumanoid's walk at speed 1.1: a stride in this much of its t
const lerpAngle = (a, b, k) => {
  let d = ((b - a + 540) % 360) - 180;
  return a + d * k;
};
const rad = (deg) => (deg * Math.PI) / 180;
// a facing in grid degrees (0 east, 90 south) as a figure's rotation about y (it faces +z)
const yawOf = (deg) => Math.PI / 2 - rad(deg);

// One figure's place on the board, eased between turns.
class Tween {
  constructor(x, y, deg) {
    this.x = this.x0 = this.x1 = x;
    this.y = this.y0 = this.y1 = y;
    this.a = this.a0 = this.a1 = deg;
    this.k = 1;
    this.dur = TURN;
  }
  to(x, y, deg, dur = TURN) {
    if (x === this.x1 && y === this.y1 && deg === this.a1) return false;
    this.x0 = this.x;
    this.y0 = this.y;
    this.a0 = this.a;
    this.x1 = x;
    this.y1 = y;
    this.a1 = deg;
    this.k = 0;
    this.dur = dur;
    return true;
  }
  snap(x, y, deg) {
    this.x = this.x0 = this.x1 = x;
    this.y = this.y0 = this.y1 = y;
    this.a = this.a0 = this.a1 = deg;
    this.k = 1;
  }
  step(dt) {
    if (this.k >= 1) return false;
    this.k = Math.min(1, this.k + dt / this.dur);
    const e = ease(this.k);
    this.x = this.x0 + (this.x1 - this.x0) * e;
    this.y = this.y0 + (this.y1 - this.y0) * e;
    this.a = lerpAngle(this.a0, this.a1, Math.min(1, this.k * 1.6));
    return true;
  }
  get moving() {
    return this.k < 1 && (this.x0 !== this.x1 || this.y0 !== this.y1);
  }
}

// A soft square for the tiles the rules count as seen.
function tileTexture() {
  return canvasTexture(128, 128, (x, w) => {
    x.clearRect(0, 0, w, w);
    // a faint wash, and corner brackets: a targeting overlay, not a board
    const g = x.createRadialGradient(w / 2, w / 2, 6, w / 2, w / 2, w * 0.7);
    g.addColorStop(0, 'rgba(255,255,255,0.05)');
    g.addColorStop(1, 'rgba(255,255,255,0.22)');
    x.fillStyle = g;
    x.fillRect(10, 10, w - 20, w - 20);
    x.strokeStyle = 'rgba(255,255,255,0.95)';
    x.lineWidth = 4;
    x.lineCap = 'round';
    const m = 12;
    const L = 26;
    for (const [cx, cy, sx, sy] of [
      [m, m, 1, 1],
      [w - m, m, -1, 1],
      [m, w - m, 1, -1],
      [w - m, w - m, -1, -1],
    ]) {
      x.beginPath();
      x.moveTo(cx, cy + sy * L);
      x.lineTo(cx, cy);
      x.lineTo(cx + sx * L, cy);
      x.stroke();
    }
  });
}

// A light cone on the floor: bright at the source, fading to its reach, soft
// at its sides, a faint rim where nothing stopped it; drawn additively, so it
// reads as light. The volume version rises from the torch to that floor.
const CONE_VERT = /* glsl */ `
  attribute float aDist;
  attribute float aSide;
  varying float vDist;
  varying float vSide;
  void main() {
    vDist = aDist;
    vSide = aSide;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const CONE_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uTime;
  uniform float uVolume;
  varying float vDist;
  varying float vSide;
  void main() {
    float side = smoothstep(1.0, 0.55, abs(vSide));
    float a;
    if (uVolume > 0.5) {
      a = pow(1.0 - vDist, 2.2) * 0.22 * smoothstep(1.0, 0.25, abs(vSide));
    } else {
      float fall = (1.0 - smoothstep(0.5, 1.0, vDist)) * (0.45 + 0.55 * smoothstep(0.0, 0.35, vDist)) + 0.2 * (1.0 - vDist);
      float bands = 0.9 + 0.1 * sin(vDist * 46.0 - uTime * 3.0);
      float rim = smoothstep(0.93, 0.995, vDist) * 0.6;
      a = (fall * bands + rim) * side;
      a *= smoothstep(0.0, 0.08, vDist) * 0.6 + 0.4;
    }
    gl_FragColor = vec4(uColor * a * uOpacity, 1.0);
  }
`;

function makeCone(scene) {
  const n = RAYS + 2;
  const mk = (volume) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aDist', new THREE.BufferAttribute(new Float32Array(n), 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aSide', new THREE.BufferAttribute(new Float32Array(n), 1).setUsage(THREE.DynamicDrawUsage));
    const idx = [];
    for (let i = 1; i <= RAYS; i++) idx.push(0, i + 1, i);
    geo.setIndex(idx);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color() }, uOpacity: { value: 1 }, uTime: { value: 0 }, uVolume: { value: volume ? 1 : 0 } },
      vertexShader: CONE_VERT,
      fragmentShader: CONE_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = volume ? 4 : 3;
    mesh.visible = false;
    scene.add(mesh);
    return mesh;
  };
  const floor = mk(false);
  const volume = mk(true);
  let key = '';
  return {
    floor,
    volume,
    hide() {
      floor.visible = volume.visible = false;
      key = '';
    },
    // ox, oy, angle in grid terms; apex: the source's height
    set(def, ox, oy, angle, spec, apex, color, opacity, time) {
      floor.visible = volume.visible = true;
      for (const m of [floor, volume]) {
        m.material.uniforms.uColor.value.copy(color);
        m.material.uniforms.uOpacity.value = opacity;
        m.material.uniforms.uTime.value = time;
      }
      const k = `${ox.toFixed(3)},${oy.toFixed(3)},${angle.toFixed(2)},${apex.x.toFixed(2)},${apex.z.toFixed(2)}`;
      if (k === key) return;
      key = k;
      const poly = visionPolygon(def, ox, oy, angle, spec, RAYS);
      const fp = floor.geometry.attributes.position;
      const fd = floor.geometry.attributes.aDist;
      const fs = floor.geometry.attributes.aSide;
      const vp = volume.geometry.attributes.position;
      const vd = volume.geometry.attributes.aDist;
      const vs = volume.geometry.attributes.aSide;
      for (let i = 0; i < poly.length; i++) {
        const [px, py] = poly[i];
        const [wx, wz] = toWorld(def, px, py);
        const d = i === 0 ? 0 : Math.hypot(px - ox, py - oy) / spec.range;
        const side = i === 0 ? 0 : ((i - 1) / RAYS) * 2 - 1;
        fp.setXYZ(i, wx, 0.035, wz);
        fd.setX(i, d);
        fs.setX(i, side);
        if (i === 0) vp.setXYZ(i, apex.x, apex.y, apex.z);
        else vp.setXYZ(i, wx, 0.04, wz);
        vd.setX(i, i === 0 ? 0 : Math.min(1, d * 1.1));
        vs.setX(i, side);
      }
      for (const a of [fp, fd, fs, vp, vd, vs]) a.needsUpdate = true;
      floor.geometry.computeBoundingSphere();
      volume.geometry.computeBoundingSphere();
    },
  };
}

// A thin glow round a figure's edges (the holotable picks out who's who):
// light added where the surface turns away from the camera.
function addRim(material, color, strength = 0.6, power = 2.6) {
  const m = material.clone();
  const c = new THREE.Color(color);
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uRim = { value: c };
    sh.uniforms.uRimK = { value: strength };
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uRim;\nuniform float uRimK;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float rimF = 1.0 - clamp(dot(normalize(vNormal), normalize(vViewPosition)), 0.0, 1.0);
        totalEmissiveRadiance += uRim * uRimK * pow(rimF, ${power.toFixed(1)});`);
  };
  m.customProgramCacheKey = () => `rim-${c.getHexString()}-${strength}-${power}`;
  return m;
}

// A whole figure as one skinned mesh in one material (for the hologram).
function mergeFigure(h, material) {
  const meshes = Object.values(h.meshes);
  const geo = mergeGeometries(meshes.map((m) => m.geometry));
  for (const m of meshes) {
    h.root.remove(m);
    m.geometry.dispose();
  }
  const mesh = new THREE.SkinnedMesh(geo, material);
  mesh.frustumCulled = false;
  mesh.bind(h.skeleton, new THREE.Matrix4());
  h.root.add(mesh);
  return mesh;
}

// The hologram: blue, see-through, with scan lines climbing it.
function holoMaterial(color = BLUE) {
  const m = new THREE.MeshBasicMaterial({ color: hot(color, 1.4), transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  m.userData.time = { value: 0 };
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = m.userData.time;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vHoloY;').replace('#include <skinning_vertex>', '#include <skinning_vertex>\nvHoloY = (modelMatrix * vec4(transformed, 1.0)).y;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vHoloY;\nuniform float uTime;')
      .replace('#include <opaque_fragment>', 'float scan = 0.55 + 0.45 * step(0.5, fract(vHoloY * 28.0 - uTime * 1.5));\ndiffuseColor.a *= scan;\n#include <opaque_fragment>');
  };
  return m;
}

export async function create(rt, { onSlow, tier } = {}) {
  const calm = prefersReducedMotion();
  const engine = createStage(rt, { exposure: 1.2, fov: FOV, near: 0.5, far: 300, bloom: { strength: 0.65, radius: 0.55, threshold: 0.9 }, onSlow, tier });
  const { scene, camera } = engine;
  const small = engine.small;
  await preload({ sets: ['concrete-floor', 'concrete-worn', 'sci-panels', 'painted-metal', 'steel-plate', 'brushed-steel', 'carbon', 'plywood'], skies: ['hall'], models: ['extinguisher'], small, renderer: engine.renderer });
  // overhead strip lighting: a cool key straight down, a little from the south-west
  await engine.setSky('hall', { background: false, envIntensity: 0.7, sunDir: [-0.35, 1, 0.5], sunIntensity: 2.6, sunColor: [0.9, 0.94, 1], fill: 0.18 });
  // a soft light from the camera's side, so faces turned to it aren't black
  const front = new THREE.DirectionalLight(0xdfe6f0, 0.9);
  front.position.set(4, 5, 14);
  scene.add(front);
  engine.sun.shadow.bias = -0.0005;
  engine.sun.shadow.normalBias = 0.02;
  scene.background = backdropTexture();
  scene.fog = new THREE.Fog(0x05080c, 46, 110);

  const mats = await facilityMaterials({ small });

  // red accents: HYDRA's lamps over the facility, and the alarm
  const accents = [0, 1].map(() => {
    const l = new THREE.PointLight(0xff3020, 0, 9, 1.6);
    scene.add(l);
    return l;
  });
  // overhead strip lights: soft pools on the floor (no shadows: the sun has those)
  const pools = [0, 1, 2].map(() => {
    const l = new THREE.SpotLight(0xe8f0ff, small ? 70 : 95, 10, 0.6, 0.9, 1.5);
    scene.add(l, l.target);
    return l;
  });
  const alarmLight = new THREE.PointLight(0xff2010, 0, 40, 1.2);
  alarmLight.position.set(0, 7, 0);
  scene.add(alarmLight);
  const tableGlow = new THREE.PointLight(0x4fc8ff, 0, 30, 1.4);
  scene.add(tableGlow);

  // ── the figures ──
  const widowMats = {
    suit: new THREE.MeshPhysicalMaterial({ color: 0x08090b, roughness: 0.42, metalness: 0.1, clearcoat: 0.45, clearcoatRoughness: 0.35, sheen: 0.3, sheenColor: new THREE.Color(0x39465c), sheenRoughness: 0.5, envMapIntensity: 0.55 }),
    trim: new THREE.MeshStandardMaterial({ color: 0x2c3036, roughness: 0.75, metalness: 0.3 }),
    metal: new THREE.MeshStandardMaterial({ color: 0xc9ced6, roughness: 0.3, metalness: 1 }),
    red: new THREE.MeshBasicMaterial({ color: hot(0xff2a1a, 1.8), toneMapped: false }),
    skin: new THREE.MeshStandardMaterial({ color: 0xe9bfa2, roughness: 0.6 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x1f1a17, roughness: 0.4 }),
    hair: new THREE.MeshPhysicalMaterial({ color: 0x4a0c06, roughness: 0.6, sheen: 0.5, sheenColor: new THREE.Color(0xb8301c), sheenRoughness: 0.45 }),
    belt: new THREE.MeshStandardMaterial({ color: 0x2a2d32, roughness: 0.45, metalness: 0.8 }),
    bite: new THREE.MeshBasicMaterial({ color: hot(0x7fdcff, 2.2), toneMapped: false }),
    boot: new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.45, metalness: 0.2 }),
  };
  const hydraMats = {
    cloth: new THREE.MeshStandardMaterial({ color: 0x30342f, roughness: 0.92 }),
    gear: new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.75, metalness: 0.2 }),
    helmet: new THREE.MeshPhysicalMaterial({ color: 0x1c2024, roughness: 0.45, metalness: 0.3, clearcoat: 0.6 }),
    lens: new THREE.MeshBasicMaterial({ color: hot(0xff3622, 1.5), toneMapped: false }),
    metal: new THREE.MeshStandardMaterial({ color: 0x2b2e33, roughness: 0.4, metalness: 0.9 }),
    red: new THREE.MeshStandardMaterial({ color: 0xa8141a, roughness: 0.6, emissive: 0x3a0405 }),
    torch: new THREE.MeshBasicMaterial({ color: hot(0xfff0d0, 3), toneMapped: false }),
  };
  const rimmed = (mats, color, k, skip = []) => Object.fromEntries(Object.entries(mats).map(([key, m]) => [key, m.isMeshStandardMaterial && !skip.includes(key) ? addRim(m, color, k) : m]));
  const guardMats = rimmed(hydraMats, 0xff5a3a, 0.45);
  const WIDOW_SCALE = 1.12;
  const GUARD_SCALE = 1.18;
  const widow = buildHumanoid({ style: 'widow', materials: rimmed(widowMats, 0x5fd4ff, 0.75, ['skin']), scale: WIDOW_SCALE });
  scene.add(widow.root);
  const guards = Array.from({ length: 4 }, () => {
    const h = buildHumanoid({ style: 'hydra', materials: guardMats, scale: GUARD_SCALE });
    h.root.visible = false;
    scene.add(h.root);
    return h;
  });
  // on phones the figures throw no shadows (their rings and the light pools
  // still ground them): a shadow pass for every part of every figure is a
  // third of the frame
  if (small) for (const h of [widow, ...guards]) h.root.traverse((o) => o.isMesh && (o.castShadow = false));
  // the planned move: a hologram of her where a click would take her
  const ghostMat = holoMaterial(BLUE);
  const ghostRed = holoMaterial(RED);
  const ghost = buildHumanoid({ style: 'widow', materials: widowMats, scale: WIDOW_SCALE });
  const ghostMesh = mergeFigure(ghost, ghostMat);
  ghostMesh.renderOrder = 9;
  ghost.root.visible = false;
  scene.add(ghost.root);

  // her ring on the floor, and the markers
  const ringTex = canvasTexture(128, 128, (x, w) => {
    x.clearRect(0, 0, w, w);
    x.strokeStyle = '#fff';
    x.lineWidth = 6;
    x.beginPath();
    x.arc(w / 2, w / 2, w * 0.42, 0, Math.PI * 2);
    x.stroke();
    x.lineWidth = 2;
    x.globalAlpha = 0.6;
    x.beginPath();
    x.arc(w / 2, w / 2, w * 0.33, 0, Math.PI * 2);
    x.stroke();
  });
  const ring = new THREE.Mesh(new THREE.PlaneGeometry(T * 0.7, T * 0.7).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: ringTex, color: hot(BLUE, 1.5), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  ring.renderOrder = 5;
  scene.add(ring);

  // tiles the rules say are seen, and tiles of the planned route
  const tileGeo = new THREE.PlaneGeometry(T, T).rotateX(-Math.PI / 2);
  const tiles = new THREE.InstancedMesh(tileGeo, new THREE.MeshBasicMaterial({ map: tileTexture(), transparent: true, opacity: 0.32, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }), 220);
  tiles.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(220 * 3), 3);
  tiles.frustumCulled = false;
  tiles.renderOrder = 2;
  tiles.count = 0;
  scene.add(tiles);
  const dotGeo = new THREE.CircleGeometry(0.09, 16).rotateX(-Math.PI / 2);
  const dots = new THREE.InstancedMesh(dotGeo, new THREE.MeshBasicMaterial({ color: hot(BLUE, 1.6), transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false }), 80);
  dots.frustumCulled = false;
  dots.renderOrder = 6;
  dots.count = 0;
  scene.add(dots);
  // the guards' next moves: chevrons on the floor, arcs for turns
  const chevShape = new THREE.Shape();
  chevShape.moveTo(-0.26, -0.1);
  chevShape.lineTo(0, 0.14);
  chevShape.lineTo(0.26, -0.1);
  chevShape.lineTo(0.26, 0.02);
  chevShape.lineTo(0, 0.26);
  chevShape.lineTo(-0.26, 0.02);
  chevShape.closePath();
  const chevGeo = new THREE.ShapeGeometry(chevShape).rotateX(-Math.PI / 2);
  const arrowMat = new THREE.MeshBasicMaterial({ color: hot(0xffa060, 1.2), transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false });
  const chevrons = new THREE.InstancedMesh(chevGeo, arrowMat, 12);
  chevrons.frustumCulled = false;
  chevrons.renderOrder = 6;
  chevrons.count = 0;
  scene.add(chevrons);
  const arcGeo = (() => {
    const pts = [];
    const r0 = 0.5;
    const r1 = 0.58;
    const seg = 18;
    const a0 = -Math.PI / 2 + 0.25;
    const a1 = 0 - 0.3;
    const shape = new THREE.Shape();
    for (let i = 0; i <= seg; i++) {
      const a = a0 + ((a1 - a0) * i) / seg;
      pts.push([Math.cos(a) * r1, Math.sin(a) * r1]);
    }
    shape.moveTo(...pts[0]);
    for (const p of pts) shape.lineTo(...p);
    // the head
    const ah = a1 + 0.02;
    shape.lineTo(Math.cos(ah) * (r1 + 0.1), Math.sin(ah) * (r1 + 0.1));
    shape.lineTo(Math.cos(a1 + 0.38) * ((r0 + r1) / 2), Math.sin(a1 + 0.38) * ((r0 + r1) / 2));
    shape.lineTo(Math.cos(ah) * (r0 - 0.1), Math.sin(ah) * (r0 - 0.1));
    for (let i = seg; i >= 0; i--) {
      const a = a0 + ((a1 - a0) * i) / seg;
      shape.lineTo(Math.cos(a) * r0, Math.sin(a) * r0);
    }
    return new THREE.ShapeGeometry(shape).rotateX(Math.PI / 2);
  })();
  const arcs = new THREE.InstancedMesh(arcGeo, arrowMat, 8);
  arcs.frustumCulled = false;
  arcs.renderOrder = 6;
  arcs.count = 0;
  scene.add(arcs);
  // reticles round the guards the Bite can reach
  const reticleGeo = (() => {
    const s = new THREE.Shape();
    s.absarc(0, 0, 0.62, 0, Math.PI * 2, false);
    const hole = new THREE.Path();
    hole.absarc(0, 0, 0.55, 0, Math.PI * 2, true);
    s.holes.push(hole);
    const g = [new THREE.ShapeGeometry(s, 48)];
    for (let i = 0; i < 4; i++) {
      const tick = new THREE.PlaneGeometry(0.06, 0.22);
      tick.translate(0, 0.74, 0);
      tick.rotateZ((i * Math.PI) / 2);
      g.push(tick);
    }
    return mergeGeometries(g).rotateX(-Math.PI / 2);
  })();
  const reticles = new THREE.InstancedMesh(reticleGeo, new THREE.MeshBasicMaterial({ color: hot(BLUE, 1.8), transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }), 4);
  reticles.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(4 * 3), 3);
  reticles.frustumCulled = false;
  reticles.renderOrder = 7;
  reticles.count = 0;
  scene.add(reticles);
  // the beacons over the file and the lift
  const beamGeo = new THREE.CylinderGeometry(0.16, 0.42, 3.2, 24, 1, true).translate(0, 1.6, 0);
  const beamTex = canvasTexture(16, 128, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.75, 'rgba(255,255,255,0.35)');
    g.addColorStop(1, 'rgba(255,255,255,0.9)');
    x.fillStyle = g;
    x.fillRect(0, 0, w, h);
  });
  const beacon = (color) => {
    const m = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ map: beamTex, color: hot(color, 1.2), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false }));
    m.renderOrder = 8;
    scene.add(m);
    return m;
  };
  const fileBeacon = beacon(BLUE);
  const exitBeacon = beacon(RED);

  const vfx = createVfx(scene, { calm, ground: 0.04, maxDebris: 40 });
  const feel = createFeel({ seed: 7, calm, baseFov: FOV, offset: 0.06 });
  // ?debug: the feel's numbers on the one panel (hq/stage's tune)
  engine.tune(feelGroups(feel), 'widow');
  const coneColor = new THREE.Color();
  const tmpColor = new THREE.Color();
  const v3 = new THREE.Vector3();
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const one = new THREE.Vector3(1, 1, 1);
  const up = new THREE.Vector3(0, 1, 0);

  // ── a level ──
  let def = null;
  let built = null; // the state the board was last built for
  const levelGroup = new THREE.Group();
  scene.add(levelGroup);
  const cones = [];
  const camModels = [];
  let laserParts = [];
  let terminalScreens = [];
  let fileModel = null;
  let exitModel = null;
  let shown = null; // what's drawn: tweens and flags per guard
  let her = null;
  let ghostTween = null;

  const dispose = (root) =>
    root.traverse((o) => {
      if (o.isMesh || o.isInstancedMesh) {
        o.geometry?.dispose?.();
        const ms = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of ms) {
          if (m?.userData?.shared) continue;
          if (m?.map?.userData?.own) m.map.dispose();
          m?.dispose?.();
        }
      }
    });
  for (const m of Object.values(mats)) m.userData.shared = true;

  async function build(s) {
    def = s.def;
    for (const c of levelGroup.children.slice()) {
      levelGroup.remove(c);
      dispose(c);
    }
    camModels.length = 0;
    laserParts = [];
    terminalScreens = [];
    const W = def.w * T;
    const D = def.h * T;

    // the table, the floor and its paint
    const table = buildTable(def, mats, `HYDRA FACILITY // ${String(def.index + 1).padStart(2, '0')} ${def.name.toUpperCase()}`);
    levelGroup.add(table);
    const floorMat = mats.floor.clone();
    for (const k of ['map', 'normalMap', 'aoMap', 'roughnessMap', 'metalnessMap']) {
      if (!floorMat[k]) continue;
      floorMat[k] = floorMat[k].clone();
      floorMat[k].repeat.set(W / 2.4, D / 2.4);
      floorMat[k].needsUpdate = true;
    }
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D).rotateX(-Math.PI / 2), floorMat);
    floor.receiveShadow = true;
    floor.position.y = 0.005;
    levelGroup.add(floor);
    const decalTex = floorDecal(def, small ? 64 : 112);
    decalTex.userData.own = true;
    const decal = new THREE.Mesh(new THREE.PlaneGeometry(W, D).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: decalTex, transparent: true, roughness: 0.85, metalness: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    decal.position.y = 0.012;
    decal.receiveShadow = true;
    levelGroup.add(decal);
    levelGroup.add(buildWalls(def, mats));

    // the props on the map's letters
    const place = (x, y, rot = 0, lift = 0) => {
      const [wx, wz] = toWorld(def, x, y);
      return new THREE.Matrix4().compose(new THREE.Vector3(wx, lift, wz), new THREE.Quaternion().setFromAxisAngle(up, rot), one);
    };
    const facing = (x, y) => {
      // turn a prop to face open floor: the side with the most room, the camera's first
      for (const [d, rot] of [
        ['S', 0],
        ['N', Math.PI],
        ['E', Math.PI / 2],
        ['W', -Math.PI / 2],
      ]) {
        const [dx, dy] = DIRS[d];
        if (!solid(def, x + dx, y + dy)) {
          const g = def.guards.find((gg) => Math.abs(gg.x - x) + Math.abs(gg.y - y) === 1);
          if (g) return Math.atan2(g.x - x, g.y - y);
          return rot;
        }
      }
      return 0;
    };
    const lists = { R: [], d: [], T: [] };
    const casePB = [];
    const glassPB = [];
    for (let y = 0; y < def.h; y++)
      for (let x = 0; x < def.w; x++) {
        const c = cell(def, x, y);
        if (c === 'R') lists.R.push(place(x, y, facing(x, y)));
        else if (c === 'd') lists.d.push(place(x, y, facing(x, y)));
        else if (c === 'T') lists.T.push({ x, y, m: place(x, y, facing(x, y)) });
        else if (c === 'C') casePB.push({ geos: caseGeometry(x * 31 + y * 7), m: place(x, y, ((x * 7 + y * 3) % 4) * 0.1) });
        else if (c === '=') {
          const alongX = !(solid(def, x, y - 1) || solid(def, x, y + 1)) || solid(def, x - 1, y) || solid(def, x + 1, y);
          glassPB.push({ geos: glassGeometry(alongX), m: place(x, y) });
        }
      }
    const instanceParts = (geos, matsFor, list, shadows = true) => {
      for (const [k, g] of Object.entries(geos)) {
        const inst = new THREE.InstancedMesh(g, matsFor[k], list.length);
        list.forEach((m, i) => inst.setMatrixAt(i, m));
        inst.castShadow = shadows && k !== 'face' && k !== 'screen';
        inst.receiveShadow = true;
        inst.computeBoundingSphere();
        levelGroup.add(inst);
      }
    };
    if (lists.R.length) instanceParts(rackGeometry(), { body: mats.dark, face: mats.rack, steel: mats.steel }, lists.R);
    if (lists.d.length) instanceParts(deskGeometry(), { top: mats.brushed, dark: mats.dark, screen: mats.screen, steel: mats.steel }, lists.d);
    const mergeAll = (items, matsFor) => {
      const by = {};
      for (const { geos, m } of items) for (const [k, g] of Object.entries(geos)) (by[k] ??= []).push(g.clone().applyMatrix4(m));
      for (const [k, gs] of Object.entries(by)) {
        const mesh = new THREE.Mesh(mergeGeometries(gs), matsFor[k]);
        mesh.castShadow = k !== 'glass';
        mesh.receiveShadow = true;
        levelGroup.add(mesh);
      }
    };
    if (casePB.length) mergeAll(casePB, { case: mats.case, steel: mats.steel, dark: mats.dark });
    if (glassPB.length) mergeAll(glassPB, { glass: mats.glass, frame: mats.cap });
    for (const t of lists.T) {
      const geos = terminalGeometry();
      const g = new THREE.Group();
      for (const [k, geo] of Object.entries(geos)) {
        const mesh = new THREE.Mesh(geo, k === 'body' ? mats.dark : k === 'screen' ? mats.screen : k === 'led' ? mats.ledRed : mats.steel);
        mesh.castShadow = k === 'body';
        mesh.name = k;
        g.add(mesh);
      }
      g.applyMatrix4(t.m);
      levelGroup.add(g);
      terminalScreens.push(g);
    }

    // extinguishers and wall lamps on some faces that look south
    const ext = [];
    const lamps = [];
    for (let y = 1; y < def.h - 1; y++)
      for (let x = 1; x < def.w - 1; x++) {
        if (cell(def, x, y) !== '#' || solid(def, x, y + 1)) continue;
        const [wx, wz] = toWorld(def, x, y);
        if ((x * 5 + y * 3 + def.index) % 7 === 0) ext.push(new THREE.Matrix4().compose(new THREE.Vector3(wx + 0.35, 0.02, wz + T / 2 + 0.16), q.setFromAxisAngle(up, Math.PI), new THREE.Vector3(0.75, 0.75, 0.75)));
        else if ((x + y * 2 + def.index) % 4 === 0) lamps.push([wx, wz + T / 2 + 0.03]);
      }
    if (ext.length) levelGroup.add(await instanceModel('extinguisher', ext));
    if (lamps.length) {
      const lampMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.9, 0.05, 0.05), mats.tube, lamps.length);
      lamps.forEach(([lx, lz], i) => lampMesh.setMatrixAt(i, m4.makeTranslation(lx, 0.74, lz)));
      levelGroup.add(lampMesh);
    }

    // the lasers: emitters on the walls at each end, three beams across, a glow on the floor
    const emit = emitterGeometry();
    for (const l of def.lasers) {
      const along = l.along ?? (solid(def, l.cells[0][0] - 1, l.cells[0][1]) && solid(def, l.cells[0][0] + 1, l.cells[0][1]) ? 'x' : 'y');
      const first = l.cells[0];
      const last = l.cells[l.cells.length - 1];
      let a;
      let b;
      if (along === 'x') {
        a = toWorld(def, Math.min(first[0], last[0]) - 0.5, first[1]);
        b = toWorld(def, Math.max(first[0], last[0]) + 0.5, first[1]);
      } else {
        a = toWorld(def, first[0], Math.min(first[1], last[1]) - 0.5);
        b = toWorld(def, first[0], Math.max(first[1], last[1]) + 0.5);
      }
      const g = new THREE.Group();
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const rot = along === 'x' ? Math.PI / 2 : 0;
      const beamMat = new THREE.MeshBasicMaterial({ color: hot(RED, 4), transparent: true, toneMapped: false, blending: THREE.AdditiveBlending, depthWrite: false });
      const beams = [];
      for (const y of [0.25, 0.55, 0.85]) {
        const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, len, 6).rotateX(Math.PI / 2).rotateY(rot), beamMat);
        beam.position.set(mid[0], y, mid[1]);
        g.add(beam);
        beams.push(beam);
      }
      const glowMat = new THREE.MeshBasicMaterial({ map: beamTex, color: hot(RED, 1.4), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.7, len).rotateX(-Math.PI / 2).rotateY(rot), glowMat);
      glow.position.set(mid[0], 0.02, mid[1]);
      g.add(glow);
      const lensMat = mats.ledRed.clone();
      for (const [px, pz, face] of [
        [a[0], a[1], 1],
        [b[0], b[1], -1],
      ]) {
        const e = new THREE.Group();
        for (const [k, geo] of Object.entries(emit)) {
          const mesh = new THREE.Mesh(geo, k === 'lens' ? lensMat : mats.dark);
          mesh.castShadow = k === 'body';
          e.add(mesh);
        }
        e.position.set(px, 0, pz);
        e.rotation.y = along === 'x' ? (face > 0 ? Math.PI / 2 : -Math.PI / 2) : face > 0 ? 0 : Math.PI;
        g.add(e);
      }
      levelGroup.add(g);
      laserParts.push({ id: l.id, beams, beamMat, glowMat, lensMat });
    }

    // cameras: on a post on the wall behind their tile
    for (const c of def.cameras) {
      const m = buildCamera(mats);
      const [dx, dy] = DIRS[c.wall];
      const [wx, wz] = toWorld(def, c.x + dx * 0.5, c.y + dy * 0.5);
      m.position.set(wx, WALL_H, wz);
      levelGroup.add(m);
      camModels.push(m);
    }

    // the file and the lift out
    fileModel = buildFile(mats);
    const [fx, fz] = toWorld(def, def.file[0], def.file[1]);
    fileModel.position.set(fx, 0, fz);
    levelGroup.add(fileModel);
    exitModel = buildExit(mats);
    const [ex, ez] = toWorld(def, def.exit[0], def.exit[1]);
    exitModel.position.set(ex, 0, ez);
    levelGroup.add(exitModel);
    fileBeacon.position.set(fx, 0.75, fz);
    exitBeacon.position.set(ex, 0.06, ez);

    // pools of light from the strip lights overhead, over the most open floor
    const open = [];
    for (let y = 1; y < def.h - 1; y++)
      for (let x = 1; x < def.w - 1; x++) {
        let n = 0;
        for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (!solid(def, x + i, y + j)) n++;
        open.push({ x, y, n: n + ((x * 7 + y * 13) % 5) * 0.01 });
      }
    open.sort((p, q) => q.n - p.n);
    const picked = [];
    for (const o of open) {
      if (picked.length >= pools.length) break;
      if (picked.every((p) => Math.abs(p.x - o.x) + Math.abs(p.y - o.y) >= 4)) picked.push(o);
    }
    pools.forEach((l, i) => {
      const p = picked[i];
      l.visible = !!p;
      if (!p) return;
      const [px, pz] = toWorld(def, p.x, p.y);
      l.position.set(px, 5.2, pz);
      l.target.position.set(px, 0, pz);
      l.target.updateMatrixWorld();
    });
    // HYDRA's red lamps over the two biggest rooms (roughly: the level's thirds)
    accents[0].position.set(-W * 0.25, 2.4, -D * 0.15);
    accents[1].position.set(W * 0.28, 2.4, D * 0.1);
    tableGlow.position.set(0, -1.2, D / 2 + 2);

    // cones: one per guard and camera
    while (cones.length < def.guards.length + def.cameras.length) cones.push(makeCone(scene));
    for (const c of cones) c.hide();

    engine.setShadowBox(new THREE.Vector3(0, 0, 0), Math.max(W, D) / 2 + 1.5, 40);
    fit();
  }

  // ── what's drawn, eased from turn to turn ──
  function reset(s, { rewind = false } = {}) {
    const dur = rewind ? REWIND : TURN;
    if (!her || !rewind) {
      her = new Tween(s.px, s.py, angleOf(s.face));
      shown = s.guards.map((g) => ({ tw: new Tween(g.x, g.y, angleOf(g.dir)), down: g.down, fall: g.down ? 1 : 0, stun: g.stun, alert: 0 }));
      ghostTween = new Tween(s.px, s.py, angleOf(s.face));
    } else {
      her.to(s.px, s.py, angleOf(s.face), dur);
      s.guards.forEach((g, i) => {
        const sh = shown[i];
        sh.tw.to(g.x, g.y, angleOf(g.dir), dur);
        sh.down = g.down;
        sh.fall = g.down ? 1 : 0;
        sh.stun = g.stun;
        sh.alert = 0;
      });
    }
    camAngles = def.cameras.map((c) => ({ a: camAngle(def, s, c.id), from: camAngle(def, s, c.id), k: 1 }));
    lastT = s.t;
    lastTurns = s.turns;
    alarm = 0;
    strike = null;
    biteArc = null;
    fileTaken = s.file ? 1 : 0;
  }

  // ── the camera: the whole board in view, leaning a little towards her ──
  // On a tall (phone) screen the whole board would be tiny: the camera comes in
  // to about nine tiles across and follows her, kept inside the board, with her
  // above the middle (the pad is below).
  const view = { look: new THREE.Vector3(), dist: 30, pitch: 1.0, followK: 0.22, follow: false, rx: 0, rz: 0, lift: 0 };
  const camLook = new THREE.Vector3();
  let camReady = false;
  function fit() {
    if (!def) return;
    const aspect = engine.size.w / Math.max(1, engine.size.h);
    const W = def.w * T;
    const D = def.h * T;
    view.pitch = aspect < 1 ? 1.06 : 0.9;
    view.followK = aspect < 1 ? 0.4 : 0.18;
    const look = new THREE.Vector3(0, 0, aspect < 1 ? D * 0.04 : D * 0.03);
    const pts = [
      [-W / 2 - 0.2, 0, -D / 2],
      [W / 2 + 0.2, 0, -D / 2],
      [-W / 2 - 0.2, 0, D / 2 + 0.3],
      [W / 2 + 0.2, 0, D / 2 + 0.3],
      [-W / 2, WALL_H, -D / 2],
      [W / 2, WALL_H, -D / 2],
    ].map((p) => new THREE.Vector3(...p));
    let lo = 5;
    let hi = 160;
    const margin = aspect < 1 ? [0.99, 0.78] : [0.97, 0.86];
    for (let i = 0; i < 26; i++) {
      const d = (lo + hi) / 2;
      camera.position.set(look.x, look.y + Math.sin(view.pitch) * d, look.z + Math.cos(view.pitch) * d);
      camera.lookAt(look);
      camera.updateMatrixWorld();
      camera.updateProjectionMatrix();
      const ok = pts.every((p) => {
        const v = p.clone().project(camera);
        return Math.abs(v.x) < margin[0] && v.y < margin[1] && v.y > -0.95;
      });
      if (ok) hi = d;
      else lo = d;
    }
    view.dist = hi * (aspect < 1 ? 0.93 : 1);
    view.look.copy(look);
    view.follow = false;
    const span = 9.5 * T;
    if (aspect < 1 && W > span * 1.1) {
      // the distance at which `span` fills the width
      const fovX = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * aspect);
      view.dist = span / 2 / Math.tan(fovX / 2) / 0.96;
      view.follow = true;
      const halfD = (span / aspect / Math.sin(view.pitch)) * 0.5;
      view.rx = Math.max(0, W / 2 - span / 2 + 0.3);
      view.rz = Math.max(0, D / 2 - halfD * 0.8);
      view.lift = halfD * 0.28;
    }
    camReady = false;
  }
  let debugCam = null;
  function placeCamera(dt) {
    if (!def || !her) return;
    if (debugCam) {
      camera.position.set(...debugCam.pos);
      camera.lookAt(...debugCam.look);
      return;
    }
    const [hx, hz] = toWorld(def, her.x, her.y);
    const want = view.follow
      ? v3.set(THREE.MathUtils.clamp(hx, -view.rx, view.rx), 0, THREE.MathUtils.clamp(hz + view.lift, -view.rz, view.rz + view.lift))
      : v3.set(view.look.x + hx * view.followK, 0, view.look.z + hz * view.followK * 0.7);
    if (!camReady) {
      camLook.copy(want);
      camReady = true;
    } else camLook.lerp(want, 1 - Math.exp(-dt * 3));
    const sway = calm ? 0 : Math.sin(clock * 0.25) * 0.012;
    camera.position.set(camLook.x + Math.sin(sway) * view.dist * 0.3, Math.sin(view.pitch) * view.dist, camLook.z + Math.cos(view.pitch) * view.dist);
    camera.lookAt(camLook);
  }

  // ── poses ──
  function poseWidow(h, { t, moving, k, crouch = 1, strikeK = 0, biteK = 0, won = 0, caught = 0 }) {
    const b = h.bones;
    const s = h.scale;
    const breathe = Math.sin(t * 2.2) * 0.015;
    if (moving) {
      // a quick, low stride: one step per tile, in time with how far across it she is
      const ph = ease(k) * Math.PI;
      const sw = Math.sin(ph * 2);
      b.hips.position.y = h.rest.hips.y - (0.13 - Math.abs(Math.sin(ph * 2)) * 0.04) * s * crouch;
      b.hips.rotation.set(0.32 * crouch, sw * 0.12, 0);
      b.spine.rotation.set(0.08, -sw * 0.15, 0);
      b.chest.rotation.set(0.02, 0, 0);
      b.thighL.rotation.set(-0.6 * crouch - sw * 0.7, 0, 0.04);
      b.thighR.rotation.set(-0.6 * crouch + sw * 0.7, 0, -0.04);
      b.kneeL.rotation.set(0.75 * crouch + Math.max(0, sw) * 0.6, 0, 0);
      b.kneeR.rotation.set(0.75 * crouch + Math.max(0, -sw) * 0.6, 0, 0);
      b.footL.rotation.set(-0.25, 0, 0);
      b.footR.rotation.set(-0.25, 0, 0);
      b.shoulderL.rotation.set(-0.35 + sw * 0.5, 0, 0.16);
      b.shoulderR.rotation.set(-0.35 - sw * 0.5, 0, -0.16);
      b.elbowL.rotation.set(-1.15, 0, 0);
      b.elbowR.rotation.set(-1.15, 0, 0);
    } else {
      // a fighter's crouch, side-on: left foot forward, weight back, guard up
      b.hips.position.y = h.rest.hips.y - (0.15 * crouch - breathe) * s;
      b.hips.rotation.set(0.22 * crouch, 0.35, 0);
      b.spine.rotation.set(0.1 * crouch, -0.12, 0);
      b.chest.rotation.set(0.04 + breathe, -0.16, 0);
      b.thighL.rotation.set(-0.85 * crouch, 0, 0.1);
      b.kneeL.rotation.set(1.0 * crouch, 0, 0);
      b.footL.rotation.set(-0.15 * crouch, 0, 0);
      b.thighR.rotation.set(0.05 * crouch, 0, -0.14);
      b.kneeR.rotation.set(0.75 * crouch, 0, 0);
      b.footR.rotation.set(-0.55 * crouch, 0, 0);
      b.shoulderL.rotation.set(-1.0, 0.1, 0.22);
      b.elbowL.rotation.set(-1.75, 0, 0);
      b.shoulderR.rotation.set(-0.75, -0.1, -0.24);
      b.elbowR.rotation.set(-1.95, 0, 0);
    }
    b.neck.rotation.set(0, 0, 0);
    b.head.rotation.set(-0.18 * crouch, moving ? 0 : -0.25, 0);
    b.handL.rotation.set(0, 0, 0);
    b.handR.rotation.set(0, 0, 0);
    if (strikeK > 0) {
      // the takedown: a lunge, an elbow, a twist
      const e = Math.sin(strikeK * Math.PI);
      b.spine.rotation.y += e * 0.6;
      b.shoulderR.rotation.set(-1.4 * e - 0.3, 0, -0.3);
      b.elbowR.rotation.set(-0.4 - (1 - e) * 1.2, 0, 0);
      b.shoulderL.rotation.set(-1.1 * e - 0.4, 0, 0.5);
    }
    if (biteK > 0) {
      // the Bite: the right arm out straight at him
      const e = Math.min(1, biteK * 3) * (1 - Math.max(0, (biteK - 0.7) / 0.3));
      b.shoulderR.rotation.set(-0.35 - 1.2 * e, -0.15 * e, -0.35 + 0.2 * e);
      b.elbowR.rotation.set(-1.35 * (1 - e), 0, 0);
      b.handR.rotation.set(0.2 * e, 0, 0);
    }
    if (caught > 0 && won <= 0) {
      // caught: jolted upright, head up, the guard thrown higher
      b.chest.rotation.x -= 0.3 * caught;
      b.spine.rotation.x -= 0.1 * caught;
      b.head.rotation.x -= 0.2 * caught;
      b.shoulderL.rotation.x -= 0.3 * caught;
      b.shoulderR.rotation.x -= 0.3 * caught;
    }
    if (won > 0) {
      b.hips.position.y = h.rest.hips.y;
      b.hips.rotation.set(0, 0, 0);
      b.spine.rotation.set(0, 0, 0);
      b.thighL.rotation.set(0, 0, 0.05);
      b.thighR.rotation.set(0, 0, -0.05);
      b.kneeL.rotation.set(0, 0, 0);
      b.kneeR.rotation.set(0, 0, 0);
      b.footL.rotation.set(0, 0, 0);
      b.footR.rotation.set(0, 0, 0);
      b.shoulderL.rotation.set(0.05, 0, 0.12);
      b.shoulderR.rotation.set(0.05, 0, -0.12);
      b.elbowL.rotation.set(-0.2, 0, 0);
      b.elbowR.rotation.set(-0.2, 0, 0);
      b.head.rotation.set(0, 0, 0);
    }
  }

  function poseGuard(h, { t, moving, k, phase, aim = 0, stun = 0, fall = 0 }) {
    const b = h.bones;
    const s = h.scale;
    poseHumanoid(h, { t: moving ? ease(k) * GUARD_STRIDE + phase : t * 0.4 + phase, mode: moving ? 'walk' : 'idle', speed: moving ? 1.1 : 1, phase: 0 });
    // the rifle at the low ready: both hands on it
    b.shoulderR.rotation.set(-0.55 - aim * 0.9, -0.2, -0.25);
    b.elbowR.rotation.set(-1.25 + aim * 0.9, 0, 0);
    b.handR.rotation.set(0.1, 0, 0);
    b.shoulderL.rotation.set(-0.85 - aim * 0.6, 0.35, 0.1);
    b.elbowL.rotation.set(-0.95 + aim * 0.5, 0, 0);
    b.chest.rotation.x = -aim * 0.25;
    if (!moving) b.head.rotation.y = Math.sin(t * 0.7 + phase) * 0.18;
    if (stun > 0) {
      // dazed: down on one knee, head hanging
      b.hips.position.y = h.rest.hips.y - 0.42 * s;
      b.hips.rotation.set(0.25, 0, 0);
      b.spine.rotation.set(0.35, 0, 0.08);
      b.chest.rotation.set(0.2, 0, 0);
      b.head.rotation.set(0.6, Math.sin(t * 3) * 0.2, 0);
      b.thighL.rotation.set(-1.5, 0, 0.1);
      b.kneeL.rotation.set(1.6, 0, 0);
      b.footL.rotation.set(-0.1, 0, 0);
      b.thighR.rotation.set(-0.2, 0, -0.1);
      b.kneeR.rotation.set(1.9, 0, 0);
      b.footR.rotation.set(0.5, 0, 0);
      b.shoulderR.rotation.set(-0.2, 0, -0.2);
      b.elbowR.rotation.set(-0.5, 0, 0);
      b.shoulderL.rotation.set(-0.1, 0, 0.25);
      b.elbowL.rotation.set(-0.4, 0, 0);
    }
    if (fall > 0) {
      const e = ease(Math.min(1, fall));
      b.hips.position.y = h.rest.hips.y * (1 - e) + 0.12 * s * e;
      b.hips.rotation.set(-1.5 * e, 0, 0.1 * e);
      b.spine.rotation.set(0.1 * e, 0, 0);
      b.head.rotation.set(-0.4 * e, 0.6 * e, 0);
      b.thighL.rotation.set(1.4 * e, 0, 0.15 * e);
      b.thighR.rotation.set(1.2 * e, 0, -0.1 * e);
      b.kneeL.rotation.set(0.3 * e, 0, 0);
      b.kneeR.rotation.set(0.7 * e, 0, 0);
      b.shoulderR.rotation.set(-2.6 * e, 0, -0.4 * e);
      b.shoulderL.rotation.set(-2.4 * e, 0, 0.6 * e);
      b.elbowR.rotation.set(-0.3 * e, 0, 0);
      b.elbowL.rotation.set(-0.5 * e, 0, 0);
    }
  }

  // ── per frame ──
  let clock = 0;
  let lastT = 0;
  let lastTurns = 0;
  let camAngles = [];
  let alarm = 0;
  let alarmBy = null;
  let strike = null;
  let biteArc = null;
  let fileTaken = 0;
  let wonK = 0;
  let rewindK = 1;
  let bump = null;
  let holo = 0;
  let holoWant = 0;
  // the poses crossed between as a step starts and ends (../hq/kit/blend.js), kept to fill again
  const snaps = { her: { a: null, b: null }, guards: [] };

  function render(s, dt, ui = {}) {
    const rdt = Math.min(0.05, dt);
    clock += rdt;
    if (s && built !== s) {
      // a new level (or the same one again): rebuild only when the map changes
      const fresh = !def || def !== s.def;
      if (fresh) {
        built = s;
        return build(s).then(() => {
          reset(s);
          engine.renderOnce();
        });
      }
      const rewind = built && built.index === s.index && s.turns === 0 && built !== s;
      built = s;
      reset(s, { rewind });
      if (rewind) rewindK = 0;
    }
    if (!def || !s) {
      engine.render();
      return undefined;
    }

    // a turn has been taken: ease everything to where the rules put it
    if (s.turns !== lastTurns || s.t !== lastT) {
      her.to(s.px, s.py, angleOf(s.face));
      s.guards.forEach((g, i) => {
        const sh = shown[i];
        sh.tw.to(g.x, g.y, angleOf(g.dir));
        if (g.down && !sh.down) {
          sh.down = true;
          sh.fall = 0.001;
        }
        sh.stun = g.stun;
      });
      def.cameras.forEach((c, i) => {
        const a = camAngle(def, s, c.id);
        if (a !== camAngles[i].a) camAngles[i] = { a, from: camAngles[i].shown ?? camAngles[i].a, k: 0 };
      });
      lastT = s.t;
      lastTurns = s.turns;
    }
    her.step(rdt);
    for (const sh of shown) {
      sh.tw.step(rdt);
      if (sh.fall > 0 && sh.fall < 1) sh.fall = Math.min(1, sh.fall + rdt / 0.55);
      sh.alert = Math.max(0, sh.alert - rdt * 0.5);
    }
    rewindK = Math.min(1, rewindK + rdt / REWIND);
    holo += (holoWant - holo) * (1 - Math.exp(-rdt * 6));

    placeCamera(rdt);
    feel.update(rdt, camera);

    // Natasha
    const [hx, hz] = toWorld(def, her.x, her.y);
    let ox = 0;
    let oz = 0;
    if (strike) {
      strike.k += rdt / 0.42;
      const e = Math.sin(Math.min(1, strike.k) * Math.PI);
      ox = strike.dx * e * T * 0.32;
      oz = strike.dy * e * T * 0.32;
      if (strike.k >= 1) strike = null;
    }
    if (bump) {
      bump.k += rdt / 0.22;
      const e = Math.sin(Math.min(1, bump.k) * Math.PI) * 0.1 * T;
      ox += bump.dx * e;
      oz += bump.dy * e;
      if (bump.k >= 1) bump = null;
    }
    widow.root.position.set(hx + ox, 0, hz + oz);
    widow.root.rotation.y = yawOf(her.a);
    if (s.phase === 'won') wonK = Math.min(1, wonK + rdt * 1.5);
    else wonK = 0;
    // her crouch, crossed into her stride as a step starts and back as it
    // ends (it was one or the other, snapping at each end of every tile)
    const herOpts = { t: clock, k: her.k, strikeK: strike ? strike.k : 0, biteK: biteArc ? biteArc.k : 0, won: wonK, caught: Math.min(1, alarm) };
    poseWidow(widow, { ...herOpts, moving: false });
    const herW = her.moving ? stepIn(her.k) : 0;
    if (herW > 0) {
      snaps.her.a = snapPose(widow, snaps.her.a);
      poseWidow(widow, { ...herOpts, moving: true });
      snaps.her.b = snapPose(widow, snaps.her.b);
      mixPose(widow, snaps.her.a, snaps.her.b, herW);
    }
    widow.root.visible = !(s.phase === 'won' && wonK >= 1 && Math.floor(clock * 12) % 2 === 0 && !calm) || calm;
    ring.position.set(hx, 0.04, hz);
    ring.material.opacity = 0.55 + Math.sin(clock * 3) * 0.15;
    ring.rotation.y = clock * 0.4;

    // guards
    guards.forEach((h, i) => {
      const g = s.guards[i];
      h.root.visible = !!g;
      if (!g) return;
      const sh = shown[i];
      const [gx, gz] = toWorld(def, sh.tw.x, sh.tw.y);
      h.root.position.set(gx, 0, gz);
      h.root.rotation.y = yawOf(sh.tw.a);
      const aim = alarm > 0 && alarmBy?.by === 'guard' && alarmBy.id === i ? 1 : 0;
      const stun = g.stun > 0 && !g.down ? 1 : 0;
      // standing crossed into walking as a step starts and back as it ends
      const gOpts = { t: clock, k: sh.tw.k, phase: i * 1.7, aim, stun, fall: sh.down ? sh.fall : 0 };
      poseGuard(h, { ...gOpts, moving: false });
      const walkW = sh.tw.moving ? stepIn(sh.tw.k) : 0;
      if (walkW > 0) {
        const sn = (snaps.guards[i] ??= { a: null, b: null });
        sn.a = snapPose(h, sn.a);
        poseGuard(h, { ...gOpts, moving: true });
        sn.b = snapPose(h, sn.b);
        mixPose(h, sn.a, sn.b, walkW);
      }
      // The one that caught her: its head snaps round to her, its shoulders
      // after, with a jolt as it does (drawn only: who saw what is the rules').
      if (sh.alert > 0 && !sh.alerted) sh.jolt = 1;
      sh.alerted = sh.alert > 0;
      sh.jolt = Math.max(0, (sh.jolt ?? 0) - rdt * 3);
      let want = 0;
      if (sh.alert > 0 && !stun && !sh.down) {
        const d = Math.atan2(hx - gx, hz - gz) - yawOf(sh.tw.a);
        want = Math.max(-1.3, Math.min(1.3, Math.atan2(Math.sin(d), Math.cos(d))));
      }
      sh.look = (sh.look ?? 0) + (want - (sh.look ?? 0)) * (1 - Math.exp(-rdt * (want ? 22 : 4)));
      if (Math.abs(sh.look) > 1e-3 || sh.jolt > 0) {
        const b = h.bones;
        b.head.rotation.y += sh.look * 0.6;
        b.neck.rotation.y += sh.look * 0.25;
        b.chest.rotation.y += sh.look * 0.3;
        b.chest.rotation.x -= sh.jolt * 0.22;
        b.head.rotation.x -= sh.jolt * 0.15;
      }
      if (g.stun > 0 && !g.down && !calm && Math.random() < rdt * 6) vfx.sparks(v3.set(gx + (Math.random() - 0.5) * 0.4, 0.9 + Math.random() * 0.5, gz + (Math.random() - 0.5) * 0.4), { count: 5, speed: 2.4, color: 0xd8f4ff, to: BLUE, life: 0.3, size: 0.05, gravity: 2 });
    });

    // cones: guards' torches and the cameras' sweeps
    let ci = 0;
    const flash = alarm > 0 ? 0.5 + 0.5 * Math.sin(clock * 22) : 0;
    s.guards.forEach((g, i) => {
      const cone = cones[ci++];
      if (g.down || g.stun > 0) return cone.hide();
      const sh = shown[i];
      const [gx, gz] = toWorld(def, sh.tw.x, sh.tw.y);
      const a = rad(sh.tw.a);
      const spotted = alarm > 0 && alarmBy?.by === 'guard' && alarmBy.id === i;
      coneColor.setRGB(1, 0.74, 0.5);
      if (spotted) coneColor.lerp(tmpColor.setRGB(1.6, 0.1, 0.06), 0.6 + flash * 0.4);
      cone.set(def, sh.tw.x, sh.tw.y, sh.tw.a, VISION, v3.set(gx + Math.cos(a) * 0.45, 1.02, gz + Math.sin(a) * 0.45), coneColor, spotted ? 1.1 : 0.42, clock);
    });
    def.cameras.forEach((c, i) => {
      const cone = cones[ci++];
      const st = s.cams[c.id];
      const m = camModels[i];
      const ca = camAngles[i];
      if (ca.k < 1) ca.k = Math.min(1, ca.k + rdt / TURN);
      ca.shown = lerpAngle(ca.from, ca.a, ease(ca.k));
      // the head: turned to its sweep, tipped down at the floor; dark and drooping when hacked
      m.userData.yaw.rotation.y = yawOf(ca.shown) - 0;
      m.userData.pitch.rotation.x = st.off ? 0.9 : 0.55;
      m.userData.led.material.color.copy(st.off ? tmpColor.setRGB(0.05, 0.05, 0.05) : hot(RED, 2 + Math.sin(clock * 5) * 1.2));
      if (st.off) return cone.hide();
      const [lx, lz] = toWorld(def, c.x + DIRS[c.wall][0] * 0.5, c.y + DIRS[c.wall][1] * 0.5);
      const spotted = alarm > 0 && alarmBy?.by === 'camera' && alarmBy.id === c.id;
      coneColor.setRGB(1, 0.25, 0.2);
      if (spotted) coneColor.setRGB(1.6, 0.1, 0.06);
      cone.set(def, c.x, c.y, ca.shown, CAMERA, v3.set(lx, WALL_H + 0.6, lz), coneColor, spotted ? 1.1 : 0.4, clock);
    });
    for (; ci < cones.length; ci++) cones[ci].hide();

    // the tiles the rules count as seen, for this turn
    let n = 0;
    const mark = (k, r, g, b) => {
      if (n >= 220) return;
      const [x, y] = k.split(',').map(Number);
      const [wx, wz] = toWorld(def, x, y);
      tiles.setMatrixAt(n, m4.makeTranslation(wx, 0.03, wz));
      tiles.setColorAt(n, tmpColor.setRGB(r, g, b));
      n++;
    };
    const seen = new Set();
    for (const g of s.guards) if (!g.down && g.stun === 0) for (const k of visibleTiles(def, g.x, g.y, angleOf(g.dir), VISION)) seen.add(k);
    for (const c of def.cameras) if (!s.cams[c.id].off) for (const k of visibleTiles(def, c.x, c.y, camAngle(def, s, c.id), CAMERA)) seen.add(k);
    const settled = her.k >= 1 && shown.every((sh) => sh.tw.k >= 1);
    const fade = settled ? 1 : 0.35;
    for (const k of seen) mark(k, 1 * fade, 0.2 * fade, 0.14 * fade);
    // live lasers' tiles
    for (const l of def.lasers) if (laserOn(def, l.id, s.t)) for (const [x, y] of l.cells) mark(`${x},${y}`, 1 * fade, 0.1 * fade, 0.08 * fade);
    // the planned route
    let dn = 0;
    if (ui.path?.length && s.phase === 'play') {
      let [px, py] = [s.px, s.py];
      for (const [x, y] of ui.path) {
        for (const f of [0.33, 0.66, 1]) {
          if (dn >= 80) break;
          const [wx, wz] = toWorld(def, px + (x - px) * f, py + (y - py) * f);
          dots.setMatrixAt(dn++, m4.makeScale(f === 1 ? 1.6 : 1, 1, f === 1 ? 1.6 : 1).setPosition(wx, 0.05, wz));
        }
        [px, py] = [x, y];
      }
      const [fx, fy] = ui.path[ui.path.length - 1];
      mark(`${fx},${fy}`, 0.18, 0.6, 1);
    }
    dots.count = dn;
    dots.instanceMatrix.needsUpdate = true;
    tiles.count = n;
    tiles.instanceMatrix.needsUpdate = true;
    if (tiles.instanceColor) tiles.instanceColor.needsUpdate = true;
    tiles.material.opacity = 0.55 + holo * 0.2;

    // the ghost: where a click takes her, blue if it's safe and red if it isn't
    const step = ui.step;
    if (step && s.phase === 'play' && !ui.busy) {
      if (!ghost.root.visible) ghostTween.snap(s.px, s.py, angleOf(s.face));
      ghostTween.to(step.x, step.y, step.dir != null ? angleOf(step.dir) : angleOf(s.face), 0.18);
      ghostTween.step(rdt);
      const [gx, gz] = toWorld(def, ghostTween.x, ghostTween.y);
      ghost.root.position.set(gx, 0, gz);
      ghost.root.rotation.y = yawOf(ghostTween.a);
      poseWidow(ghost, { t: clock, moving: false, k: 1 });
      ghostMesh.material = step.danger ? ghostRed : ghostMat;
      ghostMesh.material.userData.time.value = clock;
      ghost.root.visible = step.x !== s.px || step.y !== s.py;
    } else ghost.root.visible = false;

    // the guards' next moves
    let cn = 0;
    let an = 0;
    if (s.phase === 'play' && settled) {
      s.guards.forEach((g) => {
        if (g.down || g.stun > 0) return;
        const nx = intent(s, g);
        const [wx, wz] = toWorld(def, g.x, g.y);
        if (nx.x !== g.x || nx.y !== g.y) {
          const [tx, tz] = toWorld(def, nx.x, nx.y);
          const yaw = Math.atan2(tx - wx, tz - wz) + Math.PI;
          chevrons.setMatrixAt(cn++, m4.compose(v3.set((wx + tx) / 2 + (tx - wx) * 0.2, 0.06, (wz + tz) / 2 + (tz - wz) * 0.2), q.setFromAxisAngle(up, yaw), one));
        } else if (nx.dir !== g.dir) {
          // an arc from where he looks to where he'll look
          const from = angleOf(g.dir);
          const to = angleOf(nx.dir);
          const cw = ((to - from + 360) % 360) <= 180;
          const mid = rad(from + (cw ? 1 : -1) * ((((to - from) * (cw ? 1 : -1)) + 360) % 360) / 2);
          const sc = new THREE.Vector3(cw ? 1 : -1, 1, 1);
          arcs.setMatrixAt(an++, m4.compose(v3.set(wx, 0.06, wz), q.setFromAxisAngle(up, -mid - Math.PI / 4 * (cw ? 1 : -1) + (cw ? 0 : Math.PI)), sc));
        }
      });
    }
    chevrons.count = cn;
    chevrons.instanceMatrix.needsUpdate = true;
    arcs.count = an;
    arcs.instanceMatrix.needsUpdate = true;

    // reticles on the guards she can bite
    let rn = 0;
    if (s.phase === 'play' && settled && ui.bites?.length) {
      for (const bt of ui.bites) {
        const g = s.guards[bt.guard];
        const [wx, wz] = toWorld(def, g.x, g.y);
        const hot1 = ui.hoverBite === bt.guard;
        reticles.setMatrixAt(rn, m4.compose(v3.set(wx, 0.07, wz), q.setFromAxisAngle(up, clock * 0.8), new THREE.Vector3(hot1 ? 1.12 : 1, 1, hot1 ? 1.12 : 1)));
        reticles.setColorAt(rn, tmpColor.setRGB(hot1 ? 1.4 : 0.8, hot1 ? 1.4 : 0.9, hot1 ? 1.4 : 1));
        rn++;
      }
    }
    reticles.count = rn;
    reticles.instanceMatrix.needsUpdate = true;
    if (reticles.instanceColor) reticles.instanceColor.needsUpdate = true;

    // lasers: on, off, or about to come on (they flicker the turn before)
    for (const lp of laserParts) {
      const on = laserOn(def, lp.id, s.t);
      const next = laserOn(def, lp.id, s.t + 1);
      const warn = !on && next;
      const flick = warn ? (calm ? 0.35 : 0.2 + 0.25 * (Math.sin(clock * 30) > 0 ? 1 : 0)) : on ? 0.92 + Math.sin(clock * 40) * 0.08 : 0;
      for (const b of lp.beams) b.visible = flick > 0;
      lp.beamMat.opacity = flick;
      lp.glowMat.opacity = on ? 0.55 : warn ? 0.15 : 0;
      lp.lensMat.color.copy(on ? hot(RED, 3) : warn ? hot(RED, Math.sin(clock * 16) > 0 ? 3 : 0.4) : tmpColor.setRGB(0.25, 0.03, 0.02));
    }

    // terminals: red until hacked
    terminalScreens.forEach((g, i) => {
      const used = s.terminals[i]?.used;
      const scr = g.getObjectByName('screen');
      if (scr) scr.material = used ? mats.screenOk : mats.screen;
    });

    // the file and the lift
    if (s.file && fileTaken < 1) fileTaken = Math.min(1, fileTaken + rdt * 3);
    fileModel.userData.folder.visible = fileTaken < 0.5;
    fileModel.userData.folder.position.y = 0.75 + Math.sin(clock * 2) * 0.01;
    fileBeacon.visible = !s.file;
    fileBeacon.material.opacity = 0.75 + Math.sin(clock * 2.5) * 0.2;
    fileBeacon.rotation.y = clock;
    const open = s.file;
    exitModel.userData.ringMat.color.copy(open ? hot(BLUE, 1.8 + Math.sin(clock * 4) * 0.5) : hot(RED, 1.1));
    exitBeacon.material.color.copy(open ? hot(BLUE, 1.3) : hot(RED, 0.5));
    exitBeacon.scale.set(1, open ? 1 : 0.45, 1);

    // light: the alarm, HYDRA's red, the table's blue
    alarm = Math.max(0, alarm - rdt * 0.6);
    const pulse = calm ? 0.5 : 0.5 + 0.5 * Math.sin(clock * 9);
    alarmLight.intensity = alarm > 0 ? (calm ? 18 : 40 * pulse) * Math.min(1, alarm * 2) : 0;
    for (const a of accents) a.intensity = 22 + Math.sin(clock * 1.3) * 2;
    tableGlow.intensity = 14;

    ghostMat.userData.time.value = clock;
    vfx.update(rdt, camera, engine.size.h);
    // the bite's arc
    if (biteArc) {
      biteArc.k += rdt / 0.5;
      if (biteArc.k < 0.6 && Math.random() < 0.85) {
        const { a, b } = biteArc;
        let prev = a.clone();
        const segs = 6;
        for (let i = 1; i <= segs; i++) {
          const p = a.clone().lerp(b, i / segs);
          if (i < segs) p.add(v3.set((Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3));
          vfx.beam(prev, p, { color: 0xbff0ff, width: 0.018, life: 0.06 });
          prev = p;
        }
      }
      if (biteArc.k >= 1) biteArc = null;
    }
    engine.render();
    return undefined;
  }

  // the rules' events, as effects
  function fx(events) {
    if (!def) return;
    for (const e of events) {
      if (e.type === 'takedown') {
        const [dx, dy] = DIRS[e.dir];
        strike = { k: 0, dx, dy };
        const [wx, wz] = toWorld(def, e.x, e.y);
        vfx.sparks(v3.set(wx, 1.1, wz), { count: 18, speed: 4, color: 0xffffff, to: 0x9fdcff, life: 0.35, size: 0.06 });
        vfx.debris(v3.set(wx, 0.4, wz), { count: 4, speed: 2, size: 0.04 });
        feel.trauma(0.25);
        feel.hitstop(70);
      } else if (e.type === 'bite') {
        const [ax, az] = toWorld(def, e.from[0], e.from[1]);
        const [bx, bz] = toWorld(def, e.to[0], e.to[1]);
        const [dx, dy] = DIRS[e.dir];
        biteArc = { k: 0, a: new THREE.Vector3(ax + dx * 0.35, 1.0, az + dy * 0.35), b: new THREE.Vector3(bx, 1.15, bz) };
        vfx.sparks(v3.set(bx, 1.2, bz), { count: 40, speed: 5, color: 0xe8fbff, to: BLUE, life: 0.5, size: 0.08 });
        vfx.flash(v3.set(bx, 1.4, bz), { color: 0x7fdcff, intensity: 30, distance: 8, life: 0.35 });
        vfx.ring(v3.set(bx, 0.08, bz), { color: BLUE, from: 0.2, to: 1.6, life: 0.4, opacity: 0.8 });
        feel.trauma(0.18);
      } else if (e.type === 'hack') {
        const [wx, wz] = toWorld(def, e.x, e.y);
        vfx.sparks(v3.set(wx, 1.2, wz), { count: 26, speed: 3, color: 0xd8f6ff, to: BLUE, life: 0.6, size: 0.06, gravity: 1 });
        for (const id of e.cams) {
          const c = def.cameras[id];
          const [cx, cz] = toWorld(def, c.x + DIRS[c.wall][0] * 0.5, c.y + DIRS[c.wall][1] * 0.5);
          vfx.sparks(v3.set(cx, WALL_H + 0.65, cz), { count: 20, speed: 3, color: 0xffd0a0, to: 0xff4020, life: 0.5, size: 0.05 });
        }
      } else if (e.type === 'file') {
        const [wx, wz] = toWorld(def, e.x, e.y);
        vfx.ring(v3.set(wx, 0.8, wz), { color: BLUE, from: 0.2, to: 2.2, life: 0.6, opacity: 0.9 });
        vfx.sparks(v3.set(wx, 0.9, wz), { count: 30, speed: 3, color: 0xe8fbff, to: BLUE, life: 0.7, size: 0.06, gravity: -1 });
      } else if (e.type === 'caught') {
        alarm = 1.4;
        alarmBy = { by: e.by, id: e.id };
        if (e.by === 'guard' && shown[e.id]) shown[e.id].alert = 1;
        feel.trauma(calm ? 0 : 0.35);
        const [wx, wz] = toWorld(def, e.x, e.y);
        vfx.ring(v3.set(wx, 0.08, wz), { color: RED, from: 0.3, to: 2.6, life: 0.6, opacity: 0.9 });
      } else if (e.type === 'won') {
        const [wx, wz] = toWorld(def, def.exit[0], def.exit[1]);
        vfx.ring(v3.set(wx, 0.1, wz), { color: BLUE, from: 0.3, to: 3, life: 0.8, opacity: 0.9 });
        vfx.sparks(v3.set(wx, 0.5, wz), { count: 60, speed: 3, color: 0xe8fbff, to: BLUE, life: 1.1, size: 0.07, gravity: -2 });
        vfx.flash(v3.set(wx, 1.5, wz), { color: 0x7fdcff, intensity: 40, distance: 10, life: 0.8 });
      } else if (e.type === 'bump') {
        if (e.dir) bump = { k: 0, dx: DIRS[e.dir][0], dy: DIRS[e.dir][1] };
      }
    }
  }

  // which tile is under the pointer (screen in NDC)
  const ray = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const tileAt = (nx, ny) => {
    if (!def) return null;
    ray.setFromCamera(new THREE.Vector2(nx, ny), camera);
    const p = new THREE.Vector3();
    if (!ray.ray.intersectPlane(plane, p)) return null;
    // lift the plane to a figure's waist so a click on a body counts
    const x = Math.round(p.x / T + (def.w - 1) / 2);
    const y = Math.round(p.z / T + (def.h - 1) / 2);
    if (x < 0 || y < 0 || x >= def.w || y >= def.h) return null;
    return { x, y };
  };
  // where a tile (and a height over it) is on screen, in CSS pixels
  const project = (x, y, h = 0) => {
    const [wx, wz] = toWorld(def, x, y);
    return engine.project(v3.set(wx, h, wz));
  };
  // where a guard is drawn now, on screen
  const guardScreen = (i, h = 2.1) => {
    const sh = shown?.[i];
    if (!sh) return null;
    return project(sh.tw.x, sh.tw.y, h);
  };

  const resize = (w, h) => {
    engine.resize(w, h);
    fit();
  };

  return {
    engine,
    render,
    fx,
    tileAt,
    project,
    guardScreen,
    resize,
    setHolo(on) {
      holoWant = on ? 1 : 0;
    },
    // for close-ups while checking the models: { pos: [x, y, z], look: [x, y, z] } in world metres, or null
    debugCamera(c) {
      debugCam = c;
    },
    worldOf: (x, y) => (def ? toWorld(def, x, y) : null),
    timeScale: (dt) => feel.scale(dt),
    info: engine.info,
    dispose() {
      vfx.dispose();
      engine.dispose();
    },
  };
}

export { BITE, CUT_H };
