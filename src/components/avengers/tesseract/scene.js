// Tesseract Run in 3D: the compound's airfield and the country beyond it at
// golden hour, seen side-on by a camera that follows the Quinjet (rules x and
// y are world x and y; the way runs along z = 0, the camera looks at it from
// +z). It draws the rules' state (./rules.js) and turns their events into
// dust, sparks, flashes and fire; the HUD is drawn by the page on top.

import * as THREE from 'three';
import { createStage, hot } from '../hq/stage';
import { loadSet, pbr, preload } from '../hq/assets';
import { buildCompound, fbm, scatter, trees } from '../hq/kit/world';
import { canvasTexture } from '../hq/kit/shapes';
import { createVfx } from '../hq/vfx';
import { createFeel, feelGroups } from '../hq/feel';
import { prefersReducedMotion } from '../../../lib/hooks';
import { lightningPool } from '../lawn/models';
import { CABLE, CASE, GANTRY, HANGAR, JET, LEGS, PADS, TREES, caseHeight, groundAt, hookAt, inHangar, pitchOf, ringAt, windAt } from './rules';
import {
  BLUE,
  buildCable,
  buildCase,
  buildGantry,
  buildHangar,
  buildQuinjet,
  buildRain,
  buildStreaks,
  caseMaterials,
  clamp,
  hazardTexture,
  leafTexture,
  lerp,
  padTexture,
  quinjetMaterials,
  smooth,
  windsockGeometries,
  windsockTexture,
} from './models';

const FOV = 38;

// A texture set's material with its own roughness (and metalness) instead of
// the set's: grass and concrete seen at a low angle mustn't shine like glass.
function matte(m, roughness = 1, metalness = 0, env = 0.6) {
  m.roughnessMap = null;
  m.metalnessMap = null;
  m.roughness = roughness;
  m.metalness = metalness;
  m.envMapIntensity = env;
  m.needsUpdate = true;
  return m;
}
const approach = (v, to, rate, dt) => v + (to - v) * (1 - Math.exp(-rate * dt));
const SKIES = {
  // The sun low behind the scene and to the left: haze glowing through the
  // woods, long shadows toward you; a soft key from the camera's side keeps
  // the near faces from going blue. (A sunDir is in the sky's own frame.)
  airfield: { rotate: 3.2, bgIntensity: 1.0, envIntensity: 0.5, sunIntensity: 4.2, fill: 0.12, fog: { density: 0.0033, color: 0xa39a90 }, exposure: 1.05, key: 1.3 },
  dusk: { rotate: 3.35, bgIntensity: 1.0, envIntensity: 0.5, sunIntensity: 3.8, fill: 0.12, fog: { density: 0.0034, color: 0xa48e80 }, exposure: 1.05, key: 1.1 },
  storm: { rotate: 1.2, bgIntensity: 0.32, envIntensity: 0.55, sunDir: [-0.35, 0.7, 0.5], sunIntensity: 0.55, sunColor: [0.62, 0.72, 0.95], fill: 0.12, fog: { density: 0.0052, color: 0x272d38 }, exposure: 1.05, key: 0.6, wet: true },
};

// The ground away from the way: the profile carried off into the distance
// (the ridge runs back from the camera and dips toward it), hills behind,
// flat where the airfield, the runway and the hangar are.
function terrainHeight(x, z) {
  const off = smooth(3, 26, Math.abs(z));
  const warp = (fbm(z * 0.012 + 4, 1.3, 3) - 0.5) * 50 * off;
  let h = groundAt(x + warp);
  // toward the camera the ground falls away, so it never blocks the view; behind,
  // the ridge sinks too, so its crest on the way stands out against the haze
  if (z > 4) h *= 1 - smooth(4, 26, z) * 0.85;
  else h *= 1 - smooth(-12, -110, z) * 0.5;
  // rolling ground everywhere but the way
  h += off * (fbm(x * 0.025 + 7, z * 0.025 - 3, 3) - 0.5) * 2.4;
  // hills far behind
  h += smooth(-70, -260, z) * fbm(x * 0.005 + 1, z * 0.005 + 2, 4) ** 1.4 * 95;
  if (z > 20) h -= (z - 20) * 0.1;
  // flattened: the airfield, the runway and the hangar's apron
  const flat = Math.max(airfield(x, z), hangarApron(x, z));
  return lerp(h, Math.min(h, 0) * 0.3, flat);
}
const box = (x, z, x0, x1, z0, z1, soft = 8) => smooth(x0 - soft, x0, x) * (1 - smooth(x1, x1 + soft, x)) * smooth(z0 - soft, z0, z) * (1 - smooth(z1, z1 + soft, z));
const airfield = (x, z) => Math.max(box(x, z, -150, 112, -36, -8), box(x, z, -260, 470, -70, -30));
const hangarApron = (x, z) => box(x, z, 690, 840, -44, 26, 12);

// Is a spot clear of the airfield, the runway, the hangar and the way itself?
const open = (x, z, way = 6) => airfield(x, z) < 0.05 && hangarApron(x, z) < 0.05 && Math.abs(z) > way;

export async function create(rt, { onSlow, tier } = {}) {
  const calm = prefersReducedMotion();
  const engine = createStage(rt, { exposure: 1.0, fov: FOV, near: 0.5, far: 2600, bloom: { strength: 0.55, radius: 0.5, threshold: 0.92 }, onSlow, tier });
  const { scene, camera, sun, hemi } = engine;
  const small = engine.small;

  const sets = ['grass', 'rock', 'concrete-floor', 'concrete-worn', 'asphalt', 'corrugated', 'sci-panels', 'brushed-steel', 'painted-metal', 'steel-plate'];
  await preload({ sets, skies: ['airfield', 'dusk', 'storm'], models: ['rocks', 'shrub', 'grass-clump', 'lamp', 'barrel', 'crate', 'toolchest', 'barrier'], impostors: ['fir-a', 'fir-b', 'fir-c', 'broadleaf'], small });

  // ── the sky and the light ──
  let sky = null;
  let skyBg = 1;
  let sunBase = 2.6;
  let hemiBase = 0.2;
  const setWeather = async (name, tweak = null) => {
    if (sky === name && !tweak) return;
    sky = name;
    const S = { ...SKIES[name], ...tweak };
    await engine.setSky(name, S);
    skyBg = S.bgIntensity;
    sunBase = sun.intensity;
    hemiBase = hemi.intensity;
    engine.exposure = S.exposure;
    keyLight.intensity = S.key ?? 0.8;
    keyLight.color.set(name === 'storm' ? 0x9fb4d8 : 0xffe6cc);
    storm = name === 'storm';
    rain.lines.visible = storm;
    for (const l of hangarLights) l.intensity = storm ? l.userData.peak : l.userData.peak * 0.45;
    landing.visible = storm || name === 'dusk';
    landing.intensity = storm ? 700 : 260;
    // rain on the ground: it shines
    groundMat.roughness = S.wet ? 0.62 : 1;
    groundMat.envMapIntensity = S.wet ? 0.8 : 0.5;
    apronMat.roughness = S.wet ? 0.35 : 0.95;
    runwayMat.roughness = S.wet ? 0.4 : 0.92;
    padMat.roughness = S.wet ? 0.4 : 0.9;
  };
  // the key from the camera's side (no shadows)
  const keyLight = new THREE.DirectionalLight(0xffe6cc, 0.8);
  scene.add(keyLight, keyLight.target);
  // lightning lights everything from above, cold and hard
  const flashLight = new THREE.DirectionalLight(0xdfe9ff, 0);
  flashLight.position.set(-20, 80, 40);
  scene.add(flashLight);
  let storm = false;

  // ── the ground ──
  const X0 = -300;
  const X1 = 1050;
  const step = small ? 4 : 3;
  const zs = [90, 70, 56, 46, 38, 31, 25, 20, 16, 12.5, 9.5, 7, 5, 3, 1.5, 0, -1.5, -3, -5, -7.5, -10.5, -14, -18, -23, -29, -36, -44, -54, -66, -80, -96, -115, -138, -165, -196, -232, -275, -325, -385, -460, -560];
  const nx = Math.round((X1 - X0) / step) + 1;
  const pos = new Float32Array(nx * zs.length * 3);
  const col = new Float32Array(nx * zs.length * 3);
  const uvs = new Float32Array(nx * zs.length * 2);
  for (let j = 0; j < zs.length; j++)
    for (let i = 0; i < nx; i++) {
      const x = X0 + i * step;
      const z = zs[j];
      const h = terrainHeight(x, z);
      const k = j * nx + i;
      pos.set([x, h - (Math.abs(z) < 1 ? 0.02 : 0.06), z], k * 3);
      uvs.set([x / 4, z / 4], k * 2);
      // colour at a large scale, so the tiling doesn't show: drier patches,
      // darker under the woods, a little lighter on the airfield's mown grass
      const n = fbm(x * 0.03 + 11, z * 0.03 + 5, 3);
      const m = fbm(x * 0.006 - 4, z * 0.006 + 9, 2);
      let v = 0.78 + n * 0.4;
      // mown stripes on the airfield's grass
      if (x < 125 && z > -40 && z < 60) v *= Math.floor((x + 400) / 9) % 2 ? 1.08 : 0.92;
      const dry = (m - 0.45) * 0.5;
      col.set([v * (0.98 + dry), v * (1.02 + dry * 0.3), v * (0.84 - dry * 0.6)], k * 3);
    }
  const idx = [];
  for (let j = 0; j < zs.length - 1; j++)
    for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i;
      const b = a + nx;
      idx.push(a, a + 1, b, a + 1, b + 1, b);
    }
  const groundGeo = new THREE.BufferGeometry();
  groundGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  groundGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  groundGeo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  groundGeo.setIndex(idx);
  groundGeo.computeVertexNormals();
  const groundMat = await pbr('grass', { repeat: [1, 1], small, vertexColors: true, normalScale: 1.1, color: 0x8aa660 });
  matte(groundMat, 1, 0, 0.5);
  const rockSet = await loadSet('rock', { small });
  if (rockSet) {
    // rock on the steep ground: the ridge's faces
    groundMat.onBeforeCompile = (sh) => {
      sh.uniforms.uRock = { value: rockSet.map };
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWorldP;\nvarying float vUp;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWorldP = (modelMatrix * vec4(position, 1.0)).xyz;\nvUp = normal.y;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform sampler2D uRock;\nvarying vec3 vWorldP;\nvarying float vUp;')
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
          float steep = 1.0 - smoothstep(0.66, 0.86, vUp);
          vec3 rockA = texture2D(uRock, vWorldP.xz * 0.07 + vec2(0.0, vWorldP.y * 0.07)).rgb;
          vec3 rockB = texture2D(uRock, vec2(vWorldP.x, vWorldP.y) * 0.09).rgb;
          diffuseColor.rgb = mix(diffuseColor.rgb, mix(rockA, rockB, 0.5) * 0.95, steep);`,
        );
    };
    groundMat.customProgramCacheKey = () => 'tesseract-ground';
  }
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.receiveShadow = true;
  ground.name = 'ground';
  scene.add(ground);

  // ── the airfield: an apron of concrete, the runway behind it, lights ──
  const apronMat = matte(await pbr('concrete-worn', { repeat: [1, 1], small, color: 0xa4a29c }), 0.95, 0, 0.55);
  // a taxiway behind the pads, and two links to the runway
  const slabUV = (geo) => {
    const p = geo.attributes.position;
    const uv = geo.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 7, p.getZ(i) / 7);
    return geo;
  };
  const taxi = [
    [-19, -16, 250, 12],
    [-70, -27, 14, 12],
    [60, -27, 14, 12],
  ];
  for (const [x, z, w, d] of taxi) {
    const m = new THREE.Mesh(slabUV(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2).translate(x, 0, z)), apronMat);
    m.position.y = 0.012;
    m.receiveShadow = true;
    scene.add(m);
  }
  const runwayMat = matte(await pbr('asphalt', { repeat: [730 / 9, 30 / 9], small, color: 0x8c8a88 }), 0.92, 0, 0.55);
  const runway = new THREE.Mesh(new THREE.PlaneGeometry(730, 30).rotateX(-Math.PI / 2), runwayMat);
  runway.position.set(105, 0.01, -50);
  runway.receiveShadow = true;
  scene.add(runway);
  const paint = canvasTexture(
    1024,
    64,
    (x, w, h) => {
      x.clearRect(0, 0, w, h);
      x.fillStyle = 'rgba(240,240,236,0.85)';
      x.fillRect(0, 2, w, 3); // edge lines
      x.fillRect(0, h - 5, w, 3);
      x.fillRect(w * 0.1, h / 2 - 1.5, w * 0.45, 3); // the centre line's dash
    },
    { repeat: [730 / 60, 1] },
  );
  const runwayPaint = new THREE.Mesh(new THREE.PlaneGeometry(730, 30).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: paint, transparent: true, roughness: 0.7, metalness: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  runwayPaint.position.set(105, 0.03, -50);
  runwayPaint.receiveShadow = true;
  scene.add(runwayPaint);
  // edge lights along the runway and the apron
  const studGeo = new THREE.CylinderGeometry(0.16, 0.2, 0.3, 8);
  const studs = [];
  for (let x = -250; x <= 465; x += 26) studs.push([x, -35.5], [x, -64.5]);
  const runLights = new THREE.InstancedMesh(studGeo, new THREE.MeshBasicMaterial({ color: hot(0xffe2a8, 2.2), toneMapped: false }), studs.length);
  studs.forEach(([x, z], i) => runLights.setMatrixAt(i, new THREE.Matrix4().makeTranslation(x, 0.15, z)));
  scene.add(runLights);
  // blue lights along the taxiway
  const taxiStuds = [];
  for (let x = -140; x <= 104; x += 12) taxiStuds.push([x, -9.6], [x, -22.4]);
  const taxiLights = new THREE.InstancedMesh(studGeo, new THREE.MeshBasicMaterial({ color: hot(0x3d7dff, 2.6), toneMapped: false }), taxiStuds.length);
  taxiStuds.forEach(([x, z], i) => taxiLights.setMatrixAt(i, new THREE.Matrix4().makeTranslation(x, 0.15, z)));
  scene.add(taxiLights);

  // the compound, behind the start
  const compound = await buildCompound({ small, lights: 0.55 });
  compound.position.set(-26, 0, -112);
  scene.add(compound);

  // ── the pads, their lights and windsocks ──
  const padMat = matte(await pbr('concrete-floor', { repeat: [2.2, 2.2], small, color: 0xc4c0b8 }), 0.9, 0, 0.55);
  const padGeo = new THREE.BoxGeometry(1, 0.4, 1);
  const pads = new THREE.InstancedMesh(padGeo, padMat, PADS.length);
  const decals = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: padTexture(), transparent: true, roughness: 0.75, metalness: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }), PADS.length);
  const LIGHTS_PER = 14;
  const padLights = new THREE.InstancedMesh(new THREE.BoxGeometry(0.3, 0.12, 0.3), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), PADS.length * LIGHTS_PER);
  const m4 = new THREE.Matrix4();
  const padLightPos = [];
  PADS.forEach((p, i) => {
    const w = p.half * 2;
    const d = 14;
    m4.compose(new THREE.Vector3(p.x, -0.18, 0), new THREE.Quaternion(), new THREE.Vector3(w, 1, d));
    pads.setMatrixAt(i, m4);
    m4.compose(new THREE.Vector3(p.x, 0.035, 0), new THREE.Quaternion(), new THREE.Vector3(w - 0.4, 1, d - 0.4));
    decals.setMatrixAt(i, m4);
    for (let k = 0; k < LIGHTS_PER; k++) {
      // round the edge, in order, so they can chase
      const t = k / LIGHTS_PER;
      const per = 2 * (w + d);
      let s = t * per;
      let lx;
      let lz;
      if (s < w) [lx, lz] = [-w / 2 + s, d / 2];
      else if ((s -= w) < d) [lx, lz] = [w / 2, d / 2 - s];
      else if ((s -= d) < w) [lx, lz] = [w / 2 - s, -d / 2];
      else [lx, lz] = [-w / 2, -d / 2 + (s - w)];
      const at = new THREE.Vector3(p.x + lx * 0.97, 0.06, lz * 0.97);
      padLights.setMatrixAt(i * LIGHTS_PER + k, m4.makeTranslation(at.x, at.y, at.z));
      padLights.setColorAt(i * LIGHTS_PER + k, new THREE.Color(0.3, 0.3, 0.3));
      padLightPos.push(at);
    }
  });
  pads.receiveShadow = true;
  pads.castShadow = true;
  decals.receiveShadow = true;
  scene.add(pads, decals, padLights);
  // windsocks beside the outdoor pads
  const sockG = windsockGeometries();
  const steelDark = new THREE.MeshStandardMaterial({ color: 0x5b6168, metalness: 0.9, roughness: 0.4 });
  const sockPads = PADS.slice(0, 6);
  const poles = new THREE.InstancedMesh(sockG.pole, steelDark, sockPads.length);
  const socks = new THREE.InstancedMesh(sockG.sock, new THREE.MeshStandardMaterial({ map: windsockTexture(), roughness: 0.85, metalness: 0, side: THREE.DoubleSide }), sockPads.length);
  const sockAt = sockPads.map((p) => new THREE.Vector3(p.x - p.half - 3, groundAt(p.x - p.half - 3), -9));
  sockAt.forEach((v, i) => poles.setMatrixAt(i, m4.makeTranslation(v.x, v.y, v.z)));
  poles.castShadow = socks.castShadow = true;
  socks.frustumCulled = false;
  scene.add(poles, socks);
  const sockAngle = sockPads.map(() => ({ yaw: 0, droop: 1.2 }));

  // ── trees: the woods on the way (the rules' trees, exactly), more behind,
  // and the forest out to the hills ──
  const treePts = [];
  TREES.forEach(([x, h], i) => treePts.push([x, 0, h, 0, i * 3.7]));
  // the woods around the trees in the way, behind them
  const woods = [
    [104, 202],
    [650, 702],
  ];
  for (const [a, c] of woods)
    for (let i = 0; i < (small ? 50 : 100); i++) {
      const x = a + ((i * 0.618034) % 1) * (c - a);
      const z = -24 - ((i * 0.7548776) % 1) * 60;
      treePts.push([x, z, 12 + fbm(x * 0.1, z * 0.1) * 14, i % 3, i]);
    }
  // the forest beyond
  const N = small ? 2600 : 5200;
  for (let i = 0; i < N; i++) {
    const x = X0 + 30 + ((i * 0.6180339) % 1) * (X1 - X0 - 60);
    const z = -40 - ((i * 0.7548776) % 1) ** 1.4 * 300;
    if (!open(x, z, 30)) continue;
    if (box(x, z, -130, 70, -160, -60, 4) > 0) continue; // the compound
    if (fbm(x * 0.012 + 2, z * 0.012 - 5) < 0.4) continue;
    const kind = fbm(x * 0.02 + 5, z * 0.02) > 0.6 ? 3 : i % 5 < 3 ? 0 : i % 5 === 3 ? 1 : 2;
    treePts.push([x, z, kind === 3 ? 8 + fbm(x, z) * 6 : 15 + fbm(x * 0.07, z * 0.07) * 16, kind, i * 2.3]);
  }
  // a few out in front, low down, for depth
  for (let i = 0; i < 26; i++) {
    const x = -120 + i * 37 + (fbm(i, 3) - 0.5) * 20;
    const z = 34 + fbm(i, 7) * 26;
    if (!open(x, z, 30)) continue;
    treePts.push([x, z, 9 + fbm(i, 1) * 6, 3, i]);
  }
  scene.add(await trees(treePts, { heightAt: (x, z) => (Math.abs(z) < 0.5 ? groundAt(x) : terrainHeight(x, z)) }));

  // rocks on the ridge's flanks, scrub and grass along the near side
  const props = [];
  const rockPts = [[], [], []];
  for (let i = 0; i < (small ? 14 : 26); i++) {
    const x = 490 + ((i * 0.618) % 1) * 110;
    const sd = i % 3 === 0 ? 1 : -1;
    const z = sd > 0 ? 14 + ((i * 0.7548) % 1) * 18 : -8 - ((i * 0.7548) % 1) * 60;
    rockPts[i % 3].push([x, z, sd > 0 ? 0.5 + ((i * 0.37) % 1) * 0.8 : 1 + ((i * 0.37) % 1) * 2.6, i]);
  }
  rockPts.forEach((pts, k) => props.push(scatter('rocks', pts, { heightAt: terrainHeight, node: `rock_moss_set_01_rock0${k + 1}`, sink: 0.3, tilt: 0.4, shadows: false })));
  const grassPts = [[], [], [], [], []];
  for (let i = 0; i < (small ? 30 : 70); i++) {
    const x = X0 + 60 + ((i * 0.618) % 1) * (X1 - X0 - 120);
    const z = 5 + ((i * 0.7548) % 1) * 24;
    if (!open(x, z, 4)) continue;
    grassPts[i % 5].push([x, z, 1.4 + (i % 3) * 0.4, i]);
  }
  grassPts.forEach((pts, k) => props.push(scatter('grass-clump', pts, { heightAt: terrainHeight, node: `grass_medium_02_${'abcde'[k]}`, shadows: false })));
  // the airfield's kit: lamps along the apron, barriers, drums and crates by the pads
  props.push(scatter('lamp', [-100, -40, 20, 80].map((x) => [x, -24, 1.4, 0]), {}));
  props.push(scatter('barrier', [[-60, -31, 1, 0], [-56, -31, 1, 0], [30, -31, 1, 0], [34, -31, 1, 0], [470, -9, 1, 1.4], [637, -8, 1, 0.2]], {}));
  props.push(scatter('barrel', [[-3, -9, 1.1, 0], [-2.2, -10.4, 1.1, 1], [92, -8, 1.1, 0], [341, -9, 1.1, 2], [796, -26, 1.2, 0], [797, -24.6, 1.2, 1]], { shadows: false }));
  props.push(scatter('crate', [[-6, -10, 1.3, 0.3], [94, -10, 1.2, 0.8], [742, -27, 1.6, 0.1], [745, -27.4, 1.6, 0.5]], { shadows: false }));
  props.push(scatter('toolchest', [[-8, -8, 1.6, 0.4], [806, -14, 1.8, -1.57], [806, -6, 1.8, -1.57]], {}));
  for (const p of await Promise.all(props)) scene.add(p);

  // ── the gantry ──
  const hazard = hazardTexture();
  hazard.wrapS = hazard.wrapT = THREE.RepeatWrapping;
  hazard.repeat.set(1, 6);
  const gantryMats = {
    steel: matte(await pbr('brushed-steel', { repeat: [1, 4], small, color: 0x737a82 }), 0.55, 0.5, 0.8),
    hazard: new THREE.MeshStandardMaterial({ map: hazard, roughness: 0.6, metalness: 0.4 }),
    cab: matte(await pbr('brushed-steel', { repeat: [1, 1], small, color: 0x9aa0a6 }), 0.5, 0.4, 0.8),
    concrete: apronMat,
  };
  const gantry = buildGantry(gantryMats, { lite: small });
  gantry.group.position.x = GANTRY.x;
  scene.add(gantry.group);
  const gantryApron = new THREE.Mesh(new THREE.PlaneGeometry(26, 30).rotateX(-Math.PI / 2), apronMat);
  gantryApron.position.set(GANTRY.x, 0.0, -10);
  gantryApron.receiveShadow = true;
  scene.add(gantryApron);
  const flood = small ? null : new THREE.SpotLight(0xfff0d8, 0, 60, 0.7, 0.6, 1.4);
  if (flood) {
    flood.position.set(GANTRY.x, GANTRY.y - 0.4, -2);
    flood.target.position.set(GANTRY.x, 0, 0);
    scene.add(flood, flood.target);
  }

  // ── the hangar ──
  const cladMat = await pbr('corrugated', { repeat: [30, 9], small, roughness: 1, metalness: 1, color: 0xa7adb3, side: THREE.DoubleSide });
  const roofMat = await pbr('corrugated', { repeat: [30, 6], small, roughness: 1, metalness: 1, color: 0x8f959b, side: THREE.DoubleSide });
  const hangarMats = {
    frame: matte(await pbr('brushed-steel', { repeat: [1, 3], small, color: 0x58606a }), 0.5, 0.55, 0.8),
    clad: cladMat,
    roof: roofMat,
    door: await pbr('corrugated', { repeat: [3, 5], small, roughness: 1, metalness: 1, color: 0x7d8790 }),
    floor: matte(await pbr('concrete-floor', { repeat: [14, 8], small, color: 0xbab6ae }), 0.75, 0, 0.6),
    kerb: apronMat,
  };
  const hangar = buildHangar(hangarMats, { lite: small });
  scene.add(hangar.group);
  const hangarApronMesh = new THREE.Mesh(new THREE.PlaneGeometry(70, 60).rotateX(-Math.PI / 2), apronMat);
  hangarApronMesh.position.set(HANGAR.x0 - 30, 0.0, -8);
  hangarApronMesh.receiveShadow = true;
  scene.add(hangarApronMesh);
  // warm light inside
  const hangarLights = [];
  for (const [x, z, k] of small ? [[770, -6, 900]] : [[746, -4, 520], [794, -4, 520], [770, -24, 380]]) {
    const l = new THREE.PointLight(0xffd9a8, k, 80, 1.6);
    l.position.set(x, HANGAR.roof - 3, z);
    l.userData.peak = k;
    scene.add(l);
    hangarLights.push(l);
  }

  // ── the Quinjet, its cable and the case ──
  // the stealth paint: gunmetal, with the plates' seams from the texture set's relief
  const jetPaint = matte(await pbr('sci-panels', { repeat: [1, 1], small, color: 0x50555b, normalScale: 0.55 }), 0.55, 0.22, 0.5);
  jetPaint.map = null;
  const qMats = quinjetMaterials(jetPaint);
  const jet = buildQuinjet(qMats, { lite: small });
  scene.add(jet.group);
  // another one parked in the hangar
  if (!small) {
    const parked = buildQuinjet(qMats, { lite: true });
    parked.group.position.set(768, 2.4, -21);
    parked.group.rotation.y = 0.12;
    parked.update({ spool: 0, gear: 1 });
    scene.add(parked.group);
  }
  // a landing light under the nose, for the dark
  const landing = new THREE.SpotLight(0xf4f0ff, 260, 70, 0.42, 0.5, 1.3);
  landing.position.set(6.2, -1.0, 0);
  landing.target.position.set(16, -14, 0);
  jet.body.add(landing, landing.target);
  landing.visible = false;

  const steel = await pbr('brushed-steel', { repeat: [1, 1], small, roughness: 0.6, metalness: 1, color: 0xd4d9de });
  const tcase = buildCase(caseMaterials(steel));
  scene.add(tcase.group);
  const caseLight = new THREE.PointLight(BLUE, 9, 16, 1.6);
  caseLight.position.y = 1.1;
  tcase.group.add(caseLight);
  const cableMat = await pbr('brushed-steel', { repeat: [1, 1], small, roughness: 0.5, metalness: 1, color: 0x6d737a });
  const cable = buildCable(cableMat, { nodes: small ? 10 : 14, radius: 0.065 });
  scene.add(cable.mesh);

  // the downwash on the ground: rings of flattened grass and blown dust
  const washMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    uniforms: { uTime: { value: 0 }, uPower: { value: 0 }, uColor: { value: new THREE.Color(0xd9d2bf) } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv * 2.0 - 1.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uPower;
      uniform vec3 uColor;
      varying vec2 vUv;
      void main() {
        float r = length(vUv);
        float rings = 0.5 + 0.5 * sin(r * 28.0 - uTime * 14.0);
        float a = uPower * smoothstep(1.0, 0.25, r) * smoothstep(0.05, 0.3, r) * (0.25 + rings * 0.45);
        gl_FragColor = vec4(uColor, a * 0.5);
      }`,
  });
  const wash = new THREE.Mesh(new THREE.PlaneGeometry(26, 26).rotateX(-Math.PI / 2), washMat);
  wash.renderOrder = 1;
  scene.add(wash);

  // ── weather and wind ──
  const rain = buildRain({ count: small ? 2200 : 5200, calm });
  rain.lines.visible = false;
  scene.add(rain.lines);
  const streaks = buildStreaks({ count: small ? 90 : 180 });
  scene.add(streaks.lines);
  const zap = lightningPool(scene, 6);
  // leaves carried by the gusts
  const LEAVES = small ? 50 : 110;
  const leafGeo = new THREE.BufferGeometry();
  const leafPos = new Float32Array(LEAVES * 3);
  const leafSpin = new Float32Array(LEAVES);
  const leafSize = new Float32Array(LEAVES);
  leafGeo.setAttribute('position', new THREE.BufferAttribute(leafPos, 3).setUsage(THREE.DynamicDrawUsage));
  leafGeo.setAttribute('aSpin', new THREE.BufferAttribute(leafSpin, 1).setUsage(THREE.DynamicDrawUsage));
  leafGeo.setAttribute('aSize', new THREE.BufferAttribute(leafSize, 1).setUsage(THREE.DynamicDrawUsage));
  const leafMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uMap: { value: leafTexture() }, uScale: { value: 400 }, uLight: { value: 1 } },
    vertexShader: /* glsl */ `attribute float aSpin; attribute float aSize; varying float vSpin; varying float vTone; uniform float uScale;
      void main() { vSpin = aSpin; vTone = fract(sin(float(gl_VertexID) * 12.9898) * 43758.5); vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = aSize * uScale / max(0.1, -mv.z); }`,
    fragmentShader: /* glsl */ `uniform sampler2D uMap; uniform float uLight; varying float vSpin; varying float vTone;
      void main() { vec2 p = gl_PointCoord - 0.5; float c = cos(vSpin), s = sin(vSpin); p = mat2(c, -s, s, c) * p; p.x *= 1.0 + 0.8 * abs(sin(vSpin * 1.7)); p += 0.5;
        vec4 t = texture2D(uMap, p); if (t.a < 0.4) discard;
        vec3 col = mix(vec3(0.32, 0.36, 0.12), vec3(0.62, 0.42, 0.14), vTone) * uLight; gl_FragColor = vec4(col, t.a); }`,
  });
  const leaves = new THREE.Points(leafGeo, leafMat);
  leaves.frustumCulled = false;
  scene.add(leaves);
  const leaf = Array.from({ length: LEAVES }, () => ({ alive: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, s: 0, w: 0, age: 0, life: 0 }));

  const vfx = createVfx(scene, { calm, ground: 0.05, maxSparks: small ? 500 : 900, maxPuffs: small ? 160 : 260 });
  const feel = createFeel({ calm, baseFov: FOV, offset: 0.9 });
  // ?debug: the feel's numbers on the one panel (hq/stage's tune)
  engine.tune(feelGroups(feel), 'tesseract');

  // ── state for drawing ──
  const v3 = new THREE.Vector3();
  const v4 = new THREE.Vector3();
  let clock = 0;
  let fov = FOV;
  let snap = true;
  let lastLeg = -1;
  let lastPhase = '';
  const cam = { x: 0, y: 12, d: 70, lx: 0, ly: 10 };
  const look = new THREE.Vector3();
  const vis = { angle: 0, caseAngle: 0, caseW: 0, hover: 0, wreck: null, caseWreck: null, deliveredT: 0, flare: 0, nextStorm: 4, flash: 0, gust: 0 };
  let stormSound = null;
  let tall = false;

  // the wreck: after a crash the jet (and the case, if the cable went) fall on
  function startWreck(g, e) {
    const J = g.jet;
    vis.wreck = { x: J.x, y: J.y, vx: J.vx * 0.6, vy: Math.min(J.vy, 0) * 0.5, pitch: pitchOf(J), spin: (Math.random() - 0.5) * 1.6, down: false, t: 0, burn: 0 };
    if (e.what === 'case' || e.what === 'jet') vis.caseWreck = { x: g.case.x, y: g.case.y, vx: g.case.vx * 0.5, vy: g.case.vy * 0.4, a: vis.caseAngle, w: (Math.random() - 0.5) * 2, down: g.case.grounded };
  }
  function stepWreck(dt) {
    const w = vis.wreck;
    if (!w) return;
    w.t += dt;
    if (!w.down) {
      w.vy -= 9.8 * dt;
      w.x += w.vx * dt;
      w.y += w.vy * dt;
      w.pitch += w.spin * dt;
      const floor = (inHangar(w.x, w.y) ? 0 : groundAt(w.x)) + 1.4;
      if (w.y < floor) {
        w.y = floor;
        w.down = true;
        w.pitch *= 0.4;
        vfx.explode(v3.set(w.x, w.y, 0), { scale: 1.3 });
        feel.trauma(0.7);
      }
    }
    w.burn += dt;
    if (!calm && w.burn > 0.06) {
      w.burn = 0;
      vfx.fire(v3.set(w.x - 1 + Math.random() * 2, w.y + 0.6, 0.5), { size: 1.6, count: 2, life: 0.7 });
      vfx.smoke(v3.set(w.x, w.y + 1.4, 0), { size: 3.2, count: 1, life: 3, rise: 3, opacity: 0.55, color: 0x2a2726, to: 0x55504c });
    }
    const c = vis.caseWreck;
    if (c && !c.down) {
      c.vy -= 9.8 * dt;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.a += c.w * dt;
      if (c.y < groundAt(c.x)) {
        c.y = groundAt(c.x);
        c.down = true;
        c.a = 0;
        vfx.sparks(v3.set(c.x, c.y + 1, 0), { count: 40, speed: 7, color: 0xdff4ff, to: BLUE, life: 0.7, size: 0.12 });
      }
    }
  }

  // ── render ──
  function render(g, dt) {
    const realDt = Math.min(0.05, dt);
    clock += realDt;
    const J = g.jet;
    const C = g.case;
    const L = LEGS[g.leg];
    const pad = PADS[L.to];
    if (g.leg !== lastLeg || (g.phase === 'fly' && lastPhase !== 'fly')) {
      if (g.t < 0.05) snap = snap || g.leg !== lastLeg;
      setWeather(L.sky);
      if (g.phase === 'fly') {
        vis.wreck = null;
        vis.caseWreck = null;
        vis.deliveredT = 0;
        cable.reset(v3.set(...hookAt(J), 0), v4.set(...ringAt(C), 0));
      }
      lastLeg = g.leg;
    }
    lastPhase = g.phase;

    // ── the jet ──
    let jx = J.x;
    let jy = J.y;
    let pitch = pitchOf(J);
    let fanTilt = J.angle - pitch;
    let spool = J.spool;
    if (g.phase === 'ready' || g.phase === 'delivered' || (g.phase === 'fly' && g.hold > 0)) {
      // F.R.I.D.A.Y. holds the hover: a gentle bob
      vis.hover += realDt;
      if (g.phase === 'delivered') {
        vis.deliveredT += realDt;
        jy += Math.min(2.5, vis.deliveredT * 1.2);
        spool = 0.5 + Math.sin(clock * 2) * 0.05;
        pitch *= Math.exp(-vis.deliveredT * 2);
        fanTilt *= Math.exp(-vis.deliveredT * 2);
      } else spool = 0.45;
      jy += calm ? 0 : Math.sin(vis.hover * 1.7) * 0.18;
    }
    if (g.phase === 'crashed' && vis.wreck) {
      stepWreck(realDt);
      jx = vis.wreck.x;
      jy = vis.wreck.y;
      pitch = vis.wreck.pitch;
      spool = Math.max(0, 0.6 - vis.wreck.t);
      fanTilt = 0;
    }
    jet.group.position.set(jx, jy, 0);
    const rear = clamp(J.spool * Math.abs(J.angle) * 2.2, 0, 1);
    jet.update({ pitch, fanTilt, spool, gear: J.gear, t: clock, dt: realDt, rear, calm, scale: engine.size.h / (2 * Math.tan((camera.fov * Math.PI) / 360)) });
    jet.group.updateMatrixWorld(true);

    // ── the case, swinging from its ring ──
    const hook = jet.body.localToWorld(v3.set(0, -JET.hook, 0)).clone();
    let cx = C.x;
    let cy = C.y;
    const ringH = CASE.h + CASE.sling;
    const h = caseHeight(g);
    if (vis.caseWreck) {
      cx = vis.caseWreck.x;
      cy = vis.caseWreck.y;
      vis.caseAngle = vis.caseWreck.a;
    } else {
      // it hangs along the cable, with a little lag; level on the ground
      const [rx, ry] = ringAt(C);
      const end = cable.end();
      const want = Math.atan2(end.x - rx, end.y - ry) * smooth(0.25, 2.5, h);
      vis.caseW += (want - vis.caseAngle) * 30 * realDt - vis.caseW * 6 * realDt;
      vis.caseAngle += vis.caseW * realDt;
      if (C.grounded) vis.caseAngle = approach(vis.caseAngle, 0, 12, realDt);
    }
    const ca = vis.caseAngle;
    // place it so it turns about its ring (where the rules have the ring)
    const ringX = cx;
    const ringY = cy + ringH;
    tcase.group.position.set(ringX - Math.sin(-ca) * -ringH * 0 - ringH * Math.sin(ca), ringY - ringH * Math.cos(ca), 0);
    tcase.group.rotation.z = -ca;
    const delivered = g.phase === 'delivered';
    vis.flare = delivered ? Math.min(1, vis.flare + realDt * 1.5) : Math.max(0, vis.flare - realDt);
    tcase.update(clock, 1 + vis.flare * 1.5 + (storm ? 0.2 : 0));
    caseLight.intensity = (storm ? 14 : 8) * (1 + vis.flare);

    // ── the cable ──
    const ring = tcase.group.localToWorld(v4.set(0, ringH, 0)).clone();
    if (vis.wreck && vis.caseWreck) {
      // it parted: the end trails from the jet
      cable.step(hook, hook.clone().add(new THREE.Vector3(0, -2, 0)), realDt);
    } else cable.step(hook, ring, realDt, windAt(g, (jx + cx) / 2, (jy + cy) / 2)[0]);
    cable.mesh.visible = !(vis.wreck && vis.caseWreck && vis.wreck.t > 0.05);

    // ── the wind, made visible ──
    const [wx] = windAt(g, jx, jy);
    const [gwx] = windAt(g, jx, groundAt(jx) + 2);
    vis.gust = approach(vis.gust, wx, 3, realDt);
    streaks.mat.uniforms.uTime.value = clock;
    streaks.mat.uniforms.uWind.value = vis.gust;
    streaks.mat.uniforms.uAmount.value = calm ? 0 : clamp((Math.abs(vis.gust) - 1.5) / 9, 0, 0.9);
    streaks.mat.uniforms.uCenter.value.set(cam.lx, cam.ly + 4, 0);
    streaks.mat.uniforms.uTint.value.set(storm ? 0xbfd0ff : 0xfff0d6);
    // windsocks point downwind and fill as it blows
    sockAt.forEach((p, i) => {
      const [w] = windAt(g, p.x, p.y + 5);
      const s = sockAngle[i];
      const k = clamp(Math.abs(w) / 8, 0, 1);
      s.yaw = approach(s.yaw, w >= 0 ? 0 : Math.PI, 2, realDt);
      s.droop = approach(s.droop, 1.35 * (1 - k) + 0.05, 2.5, realDt);
      const flap = calm ? 0 : Math.sin(clock * (5 + k * 8) + i) * 0.06 * (0.3 + k);
      m4.compose(v3.set(p.x, p.y + 5.15, p.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, s.yaw + flap, -s.droop - flap * 0.5, 'YZX')), v4.set(1, 1, 1));
      socks.setMatrixAt(i, m4);
    });
    socks.instanceMatrix.needsUpdate = true;
    // leaves, in a gust or a strong wind, near the ground in view
    if (!calm) {
      const strength = Math.abs(gwx);
      if (strength > 3.5 && Math.random() < realDt * strength * 3) {
        const q = leaf.find((l) => !l.alive);
        if (q) {
          const x = cam.lx + (Math.random() - 0.5) * 120 - Math.sign(gwx) * 30;
          Object.assign(q, { alive: true, x, y: terrainHeight(x, 0) + 0.5 + Math.random() * 8, z: (Math.random() - 0.4) * 30, vx: gwx, vy: Math.random() * 2, vz: (Math.random() - 0.5) * 2, s: Math.random() * 6, w: (Math.random() - 0.5) * 12, age: 0, life: 4 + Math.random() * 3 });
        }
      }
    }
    for (const [i, q] of leaf.entries()) {
      if (q.alive) {
        q.age += realDt;
        const [lw] = windAt(g, q.x, q.y);
        q.vx = approach(q.vx, lw * 1.1, 1.5, realDt);
        q.vy = approach(q.vy, -0.8 + Math.sin(clock * 3 + i) * 1.2, 2, realDt);
        q.x += q.vx * realDt;
        q.y = Math.max(terrainHeight(q.x, q.z) + 0.1, q.y + q.vy * realDt);
        q.z += q.vz * realDt;
        q.s += q.w * realDt;
        if (q.age > q.life) q.alive = false;
      }
      leafPos.set(q.alive ? [q.x, q.y, q.z] : [0, -999, 0], i * 3);
      leafSpin[i] = q.s;
      leafSize[i] = q.alive ? 0.22 : 0;
    }
    leafGeo.attributes.position.needsUpdate = true;
    leafGeo.attributes.aSpin.needsUpdate = true;
    leafGeo.attributes.aSize.needsUpdate = true;

    // ── dust and the downwash, under the fans near the ground ──
    const floorY = inHangar(jx, jy) ? 0 : groundAt(jx);
    const clear = jy - floorY;
    const wk = clamp((16 - clear) / 12, 0, 1) * clamp(spool * 1.6, 0, 1);
    wash.position.set(jx - Math.sin(J.angle) * clear * 0.5, floorY + 0.06, 0);
    washMat.uniforms.uPower.value = wk;
    washMat.uniforms.uTime.value = clock;
    wash.visible = wk > 0.01;
    const concrete = Math.abs(jx - pad.x) < pad.half + 3 || airfield(jx, 0) > 0.5 || inHangar(jx, jy);
    if (!calm && wk > 0.12 && Math.random() < realDt * 26 * wk) {
      const side = Math.random() < 0.5 ? 1 : -1;
      const a = Math.random() * Math.PI * 2;
      const r = 3 + Math.random() * 5;
      vfx.smoke(v3.set(jx - 1.2 + Math.cos(a) * r, floorY + 0.4, 3.9 * side * 0.6 + Math.sin(a) * r), {
        size: 2.4 + wk * 2,
        count: 1,
        life: 1.4,
        rise: 0.5,
        opacity: (concrete ? 0.2 : 0.14) * wk,
        color: concrete ? 0xb3aca0 : 0x8b8a6a,
        to: concrete ? 0xd6d0c4 : 0xb8b49a,
        spread: 3.5 + wk * 3,
      });
    }

    // ── pads: the one you're making for chases blue; the rest glow dim ──
    const target = g.phase === 'fly' || g.phase === 'ready' ? L.to : -1;
    const c = new THREE.Color();
    for (let i = 0; i < PADS.length; i++)
      for (let k = 0; k < LIGHTS_PER; k++) {
        if (i === target) {
          const ph = (clock * 1.4 - k / LIGHTS_PER) % 1;
          const on = calm ? 0.8 : 0.35 + 0.65 * Math.max(0, 1 - ph * 3);
          c.set(BLUE).multiplyScalar(on * 3.2);
        } else if (delivered && i === L.to) c.set(0x7dffb0).multiplyScalar(2.2 + Math.sin(clock * 6) * 0.6);
        else c.setRGB(1.2, 0.95, 0.6);
        padLights.setColorAt(i * LIGHTS_PER + k, c);
      }
    padLights.instanceColor.needsUpdate = true;
    gantry.beaconMat.color.set(0xff2a1a).multiplyScalar(calm ? 2 : 0.6 + 2.8 * (Math.sin(clock * 4) > 0.2 ? 1 : 0));
    if (flood) flood.intensity = Math.abs(jx - GANTRY.x) < 80 ? 260 : 0;

    // ── the storm ──
    if (storm) {
      if (!calm) {
        vis.nextStorm -= realDt;
        if (vis.nextStorm <= 0) {
          vis.nextStorm = 5 + Math.random() * 8;
          vis.flash = Math.max(vis.flash, 0.6 + Math.random() * 0.4);
          const x = cam.lx + (Math.random() - 0.3) * 220;
          const z = -180 - Math.random() * 160;
          zap.strike(new THREE.Vector3(x, 150, z), new THREE.Vector3(x + (Math.random() - 0.5) * 50, terrainHeight(x, z), z + 20), camera, { width: 0.9, jag: 0.12, forks: 3, life: 0.5, k: 2.8 });
          stormSound?.();
        }
      }
      vis.flash = Math.max(0, vis.flash - realDt * 3.2);
      const fl = vis.flash > 0 ? vis.flash * (0.55 + 0.45 * Math.sin(clock * 70) ** 2) : 0;
      flashLight.intensity = fl * 6;
      scene.backgroundIntensity = skyBg + fl * 1.4;
      sun.intensity = sunBase + fl * 0.6;
      hemi.intensity = hemiBase + fl * 0.5;
      rain.mat.uniforms.uFlash.value = fl;
      rain.mat.uniforms.uTime.value = clock;
      rain.mat.uniforms.uWind.value = vis.gust;
      rain.mat.uniforms.uCenter.value.set(cam.lx, cam.ly, 8);
      leafMat.uniforms.uLight.value = 0.4 + fl;
    } else {
      flashLight.intensity = 0;
      leafMat.uniforms.uLight.value = 1;
    }
    zap.update(realDt);

    // ── the camera: side-on, a little above, leading where it's going ──
    const lead = clamp(J.vx * 0.9, -14, 14);
    const midX = jx * 0.55 + cx * 0.45;
    const toPad = Math.abs(pad.x - cx);
    const near = 1 - smooth(18, 70, toPad);
    let fx = lerp(midX + lead, (cx + pad.x) / 2 + (jx - cx) * 0.3, near * 0.55);
    // frame it from the ground under the case up to the jet, as far as that
    // allows; higher than that, keep the jet and the case
    const halfV = Math.tan(THREE.MathUtils.degToRad(fov / 2));
    const under = inHangar(cx, cy) ? 0 : terrainHeight(cx, 0);
    const topY = jy + 4.5;
    const lowY = Math.min(cy - 1, under - 1.5);
    let dist = clamp(((topY - lowY) / 2 + 3) / halfV, tall ? 58 : 46, tall ? 98 : 84) + Math.min(10, Math.hypot(J.vx, J.vy) * 0.6);
    let fy = (topY + lowY) / 2;
    const fit = halfV * dist;
    if (topY - fy > fit - 4) fy = topY - fit + 4;
    if (g.phase === 'ready') {
      // the title: drift slowly round the hovering jet
      fx = jx + 6 + Math.sin(clock * 0.15) * 6;
      fy = jy - 2;
      dist = tall ? 64 : 48;
    }
    if (g.phase === 'delivered' || g.phase === 'crashed') {
      // the result card covers the lower part of the screen: fit the ground to
      // the jet into the part above it
      const wantFit = (topY + 2 - lowY) / 1.22;
      dist = Math.max(tall ? 58 : 46, wantFit / halfV);
      const f2 = halfV * dist;
      fy = topY + 2 - f2;
    }
    if (snap) {
      cam.lx = fx;
      cam.ly = fy;
      cam.d = dist;
    } else {
      cam.lx = approach(cam.lx, fx, 2.2, realDt);
      cam.ly = approach(cam.ly, fy, 2.0, realDt);
      cam.d = approach(cam.d, dist, 1.2, realDt);
    }
    snap = false;
    const ex = cam.lx - 3.5;
    const ey = cam.ly + 1.5 + cam.d * 0.05;
    camera.position.set(ex, Math.max(ey, terrainHeight(ex, cam.d) + 3), cam.d);
    look.set(cam.lx, cam.ly - 1.5, 0);
    camera.lookAt(look);
    camera.rotation.z = 0;
    keyLight.position.set(camera.position.x - 30, camera.position.y + 40, camera.position.z + 20);
    keyLight.target.position.copy(look);
    const speedFov = calm ? 0 : clamp((Math.hypot(J.vx, J.vy) - 4) * 0.35, 0, 5);
    feel.setBaseFov(fov + speedFov);
    feel.update(realDt, camera);
    // the sun's shadows follow the action
    const texel = 1;
    engine.setShadowBox(v3.set(Math.round(cam.lx / texel) * texel, Math.round(Math.max(0, cam.ly - 8) / texel) * texel, 0), small ? 34 : 44, 160);

    vfx.update(realDt, camera, engine.size.h);
    leafMat.uniforms.uScale.value = engine.size.h / (2 * Math.tan((camera.fov * Math.PI) / 360));
    engine.render();
  }

  // ── the rules' events, as effects ──
  function fx(events, g) {
    for (const e of events) {
      switch (e.type) {
        case 'start':
          vis.wreck = null;
          vis.caseWreck = null;
          vis.flare = 0;
          break;
        case 'taut':
          feel.trauma(clamp(e.speed / 12, 0.08, 0.35));
          break;
        case 'touch': {
          const k = clamp(e.speed / CASE.crash, 0.15, 1);
          vfx.smoke(v3.set(e.x, groundAt(e.x) + 0.3, 0), { size: 1.8, count: Math.round(4 + k * 8), life: 1.2, rise: 0.4, opacity: 0.3, color: 0xa8a294, to: 0xcfc9bc, spread: 2.2 });
          if (e.speed > 1.6) feel.trauma(0.12 + k * 0.2);
          break;
        }
        case 'lift':
          vfx.smoke(v3.set(e.x, groundAt(e.x) + 0.2, 0), { size: 1.4, count: 4, life: 1, rise: 0.4, opacity: 0.25, color: 0xa8a294, to: 0xcfc9bc, spread: 1.4 });
          break;
        case 'bump':
          feel.trauma(clamp(e.speed / 8, 0.05, 0.3));
          vfx.sparks(v3.set(g.jet.x, g.jet.y - 1.4, 0), { count: 10, speed: 4, life: 0.35, size: 0.08 });
          break;
        case 'crash': {
          startWreck(g, e);
          const at = new THREE.Vector3(e.x, e.y, 0);
          if (e.what === 'case') {
            vfx.sparks(at, { count: 70, speed: 9, color: 0xe6f8ff, to: BLUE, life: 0.8, size: 0.13 });
            vfx.debris(at, { count: 14, speed: 6, size: 0.12, color: 0xbfe6ff });
            vfx.flash(at, { color: BLUE, intensity: 90, distance: 26, life: 0.6 });
            vfx.ring(at.clone().setY(groundAt(e.x) + 0.2), { color: BLUE, from: 0.5, to: 9, life: 0.6 });
            feel.trauma(0.55);
            feel.hitstop(70);
          } else if (e.what === 'jet') {
            vfx.explode(at, { scale: 1.6 });
            vfx.debris(at, { count: 20, speed: 10, size: 0.2, color: 0x3a3e44 });
            feel.trauma(0.85);
            feel.punch(5);
            // a crash stops the game a beat (the loop's timeScale), the camera and the fire don't
            feel.hitstop(90);
          }
          break;
        }
        case 'settling':
          break;
        case 'delivered': {
          const p = PADS[LEGS[g.leg].to];
          vfx.ring(v3.set(g.case.x, groundAt(p.x) + 0.15, 0), { color: 0x9fe0ff, from: 1, to: 11, life: 0.9, opacity: 0.8 });
          vfx.sparks(v3.set(g.case.x, groundAt(p.x) + 1.2, 0), { count: 50, speed: 5, color: 0xe8f8ff, to: BLUE, life: 0.9, size: 0.1, gravity: -1 });
          break;
        }
        case 'won':
          vfx.flash(v3.set(g.case.x, 3, 0), { color: BLUE, intensity: 160, distance: 40, life: 1.4 });
          vfx.ring(v3.set(g.case.x, 1.2, 0), { color: 0xbfeaff, from: 1, to: 22, life: 1.6, normal: new THREE.Vector3(0, 0, 1), opacity: 0.9 });
          break;
        default:
      }
    }
  }

  const project = (x, y, z = 0) => engine.project(v3.set(x, y, z));
  const resize = (w, h2) => {
    engine.resize(w, h2);
    const aspect = w / Math.max(1, h2);
    tall = aspect < 1.2;
    fov = tall ? FOV + (1.2 - aspect) * 30 : FOV;
    feel.setBaseFov(fov);
    camera.fov = fov;
    camera.updateProjectionMatrix();
    snap = true;
  };

  await setWeather('airfield');
  // (its shaders are compiled before the first frame: hq/useStage waits for engine.precompile)

  return {
    engine,
    render,
    fx,
    project,
    resize,
    setWeather,
    timeScale: (dt) => feel.scale(dt),
    snap() {
      snap = true;
    },
    onStorm(fn) {
      stormSound = fn;
    },
    // where the case and the pad are on screen, for the HUD
    caseScreen: (g) => engine.project(v3.set(g.case.x, g.case.y + CASE.h / 2, 0)),
    groundScreen: (x) => engine.project(v3.set(x, inHangar(x, 1) ? 0 : groundAt(x), 0)),
    jetScreen: (g) => engine.project(v3.set(g.jet.x, g.jet.y, 0)),
    padScreen: (i, y = 0) => engine.project(v3.set(PADS[i].x, groundAt(PADS[i].x) + y, 0)),
    info: engine.info,
    dispose() {
      vfx.dispose();
      engine.dispose();
    },
  };
}

export { CABLE };
