// Drawing the game: an area's shapes (from the course kit) as meshes in
// scanned PBR materials, its terrain in a material that blends three texture
// sets by the kit's splat weights (rock laid on the cliffs by their slope,
// projected three ways so it never smears), the sky that lights it (an HDRI
// and a real sun with shadows following Mario), water and fog; Mario and the
// cast, drawn between the last two steps of the rules so they move smoothly
// at any frame rate; the Lakitu camera; a few effects (dust, sparkles, the
// blast of a Bob-omb). The rules are in game units; this draws in metres
// (units × S).
//
// Mario, the cast and the props are the models of ./models/catalog.js, loaded
// before the first area is built, or the code-made ones where they can't be.
// Mario's body comes through ./motion.js (his actions eased one into the
// next, his stride paced to the ground, his head turning to what's near);
// the cast are turned at their own rates and handed the frame's time, how
// long they've been at what they're doing and how fast they're going, so
// their feet and bobs keep to the ground and their reactions run on time.
//
// createScene(renderer, { small }) → { setArea(id) → Promise, sync(g, alpha),
//   render(), resize(w, h), setLook(name), fx(type, at), dispose() }

import * as THREE from 'three';
import { loadSet, loadSky } from '../avengers/hq/assets';
import { AREAS, SCALE, buildArea } from './courses/index';
import { makeLook } from './looks';
import { hdTemplate, loadHd } from './models/hd';
import { makeActor, makeMario, makeProp } from './models/index';
import { makeHdMario } from './models/mario-hd';
import { canvasTexture } from './models/common';
import { createMarioBody, easeFace, faceFor, lookFor } from './motion';
import { MATS } from './textures';
import { createGhosts } from '../middleearth/shared/ghosts';
import { LIFT } from './online';
import { ghostGeometry } from './models/ghost';

export const S = 0.01;
const lerp = (a, b, t) => a + (b - a) * t;
const lerpAngle = (a, b, t) => {
  let d = b - a;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  return a + d * t;
};

// ─── Materials ─────────────────────────────────────────────────────────────
async function surface(key, small) {
  const spec = MATS[key];
  if (!spec) return new THREE.MeshStandardMaterial({ color: '#8a8a8a', roughness: 0.8 });
  if (spec.color) return new THREE.MeshStandardMaterial({ color: spec.color, roughness: spec.rough ?? 0.5, metalness: spec.metal ?? 0 });
  if (spec.canvas) {
    const map = stainedGlass();
    return new THREE.MeshStandardMaterial({ color: '#ffffff', map, emissiveMap: map, emissive: '#ffffff', emissiveIntensity: spec.emissive ?? 0.5, roughness: spec.rough ?? 0.2 });
  }
  const set = await loadSet(spec.set, { small });
  const m = new THREE.MeshStandardMaterial({ color: spec.tint ?? '#ffffff', roughness: spec.rough ?? 1, metalness: spec.metal ?? 0 });
  if (spec.boost) m.color.multiplyScalar(spec.boost);
  if (set) {
    m.map = set.map;
    m.normalMap = set.normalMap;
    m.roughnessMap = set.arm;
    m.aoMap = set.arm;
    if (spec.metal) m.metalnessMap = set.arm;
  }
  return m;
}

function stainedGlass() {
  return canvasTexture('m64-glass', 256, 256, (g, w, h) => {
    const colors = ['#ff6fb0', '#ffd94a', '#6fd0ff', '#ff8a3a', '#b48aff'];
    for (let i = 0; i < 8; i++)
      for (let j = 0; j < 8; j++) {
        g.fillStyle = colors[(i * 3 + j) % colors.length];
        g.fillRect((i * w) / 8, (j * h) / 8, w / 8, h / 8);
      }
    g.strokeStyle = '#20140a';
    g.lineWidth = 4;
    for (let i = 0; i <= 8; i++) {
      g.beginPath();
      g.moveTo((i * w) / 8, 0);
      g.lineTo((i * w) / 8, h);
      g.moveTo(0, (i * h) / 8);
      g.lineTo(w, (i * h) / 8);
      g.stroke();
    }
  });
}

// The terrain's material: three sets blended by the splat attribute. The
// first is the base (its uv is the kit's, x/z over its scale); the others are
// sampled at their own scales, and the second (rock) is projected on three
// planes by the normal, so cliffs aren't stretched.
async function splatMaterial(mats, small) {
  const sets = await Promise.all(mats.map((k) => loadSet(MATS[k]?.set, { small })));
  const tint = mats.map((k) => new THREE.Color(MATS[k]?.tint ?? '#ffffff').multiplyScalar(MATS[k]?.boost ?? 1));
  const base = sets[0];
  const m = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, metalness: 0 });
  if (!base || !sets[1] || !sets[2]) {
    m.color = tint[0];
    return m;
  }
  m.map = base.map;
  m.normalMap = base.normalMap;
  m.roughnessMap = base.arm;
  m.aoMap = base.arm;
  const s0 = SCALE[mats[0]] ?? 500;
  const uniforms = {
    uMap1: { value: sets[1].map },
    uMap2: { value: sets[2].map },
    uNrm1: { value: sets[1].normalMap },
    uNrm2: { value: sets[2].normalMap },
    uArm1: { value: sets[1].arm },
    uArm2: { value: sets[2].arm },
    uTint0: { value: tint[0] },
    uTint1: { value: tint[1] },
    uTint2: { value: tint[2] },
    uS1: { value: s0 / (SCALE[mats[1]] ?? 500) },
    uS2: { value: s0 / (SCALE[mats[2]] ?? 500) },
    uRockScale: { value: 1 / ((SCALE[mats[1]] ?? 600) * S) },
  };
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 splat;\nvarying vec3 vSplat;\nvarying vec3 vWPos;\nvarying vec3 vWNrm;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSplat = splat;\nvWPos = (modelMatrix * vec4(position, 1.0)).xyz;\nvWNrm = normalize(mat3(modelMatrix) * normal);');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform sampler2D uMap1, uMap2, uNrm1, uNrm2, uArm1, uArm2;
        uniform vec3 uTint0, uTint1, uTint2;
        uniform float uS1, uS2, uRockScale;
        varying vec3 vSplat;
        varying vec3 vWPos;
        varying vec3 vWNrm;
        vec4 tri(sampler2D t) {
          vec3 w = pow(abs(vWNrm), vec3(4.0));
          w /= (w.x + w.y + w.z);
          vec3 p = vWPos * uRockScale;
          return texture2D(t, p.zy) * w.x + texture2D(t, p.xz) * w.y + texture2D(t, p.xy) * w.z;
        }`,
      )
      .replace(
        '#include <map_fragment>',
        `vec4 c0 = texture2D(map, vMapUv) * vec4(uTint0, 1.0);
        vec4 c1 = tri(uMap1) * vec4(uTint1, 1.0);
        vec4 c2 = texture2D(uMap2, vMapUv * uS2) * vec4(uTint2, 1.0);
        // the rock shows through where the splat says, sharpened by the texture's own light and dark
        vec3 sw = vSplat;
        sw.y = clamp(sw.y * (0.7 + c1.g * 0.6), 0.0, 1.0);
        sw /= max(0.001, sw.x + sw.y + sw.z);
        diffuseColor *= c0 * sw.x + c1 * sw.y + c2 * sw.z;`,
      )
      .replace(
        'vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;',
        'vec3 mapN = (texture2D( normalMap, vNormalMapUv ).xyz * sw.x + texture2D( uNrm1, vNormalMapUv * uS1 ).xyz * sw.y + texture2D( uNrm2, vNormalMapUv * uS2 ).xyz * sw.z) * 2.0 - 1.0;',
      )
      .replace(
        'vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );',
        'vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv ) * sw.x + tri( uArm1 ) * sw.y + texture2D( uArm2, vRoughnessMapUv * uS2 ) * sw.z;',
      )
      .replace(
        'float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;',
        'float ambientOcclusion = ( (texture2D( aoMap, vAoMapUv ).r * sw.x + tri( uArm1 ).r * sw.y + texture2D( uArm2, vAoMapUv * uS2 ).r * sw.z) - 1.0 ) * aoMapIntensity + 1.0;',
      );
  };
  return m;
}

// water: a deep clear blue, two layers of ripples crossing in its normals
function waterMaterial() {
  const normals = canvasTexture(
    'm64-water-normals',
    256,
    256,
    (g, w, h) => {
      const img = g.createImageData(w, h);
      const height = (x, y) => Math.sin((x / w) * Math.PI * 8 + Math.sin((y / h) * Math.PI * 4) * 1.5) * 0.5 + Math.sin(((x + y) / w) * Math.PI * 12) * 0.3 + Math.cos(((x - y * 0.6) / w) * Math.PI * 6) * 0.4;
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const dx = height(x + 1, y) - height(x - 1, y);
          const dy = height(x, y + 1) - height(x, y - 1);
          const l = Math.hypot(dx, dy, 1);
          const i = (y * w + x) * 4;
          img.data[i] = (-dx / l) * 127 + 128;
          img.data[i + 1] = (-dy / l) * 127 + 128;
          img.data[i + 2] = (1 / l) * 127 + 128;
          img.data[i + 3] = 255;
        }
      g.putImageData(img, 0, 0);
    },
    { srgb: false, repeat: true },
  );
  const m = new THREE.MeshPhysicalMaterial({ color: '#1f7fc4', roughness: 0.06, metalness: 0, transparent: true, opacity: 0.82, clearcoat: 1, clearcoatRoughness: 0.05 });
  if (normals) {
    m.normalMap = normals;
    m.normalScale = new THREE.Vector2(0.35, 0.35);
    normals.repeat.set(6, 6);
  }
  return m;
}

// a soft round shadow, straight down under each of them
function blobTexture() {
  return canvasTexture('m64-blob', 128, 128, (g, w, h) => {
    const grad = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grad.addColorStop(0, 'rgba(0,0,0,0.55)');
    grad.addColorStop(0.6, 'rgba(0,0,0,0.3)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
  });
}

function geometryOf({ pos, nrm, uv }, index) {
  const geo = new THREE.BufferGeometry();
  const p = new Float32Array(pos.length);
  for (let i = 0; i < pos.length; i++) p[i] = pos[i] * S;
  geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  if (index) geo.setIndex(new THREE.BufferAttribute(index, 1));
  geo.computeBoundingSphere();
  return geo;
}

// ─── The scene ─────────────────────────────────────────────────────────────
export function createScene(renderer, { small = false } = {}) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 700);
  camera.position.set(0, 5, 10);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const look = makeLook(renderer, scene, camera, { bloom: !small });

  const sun = new THREE.DirectionalLight('#fff6e8', 3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(small ? 1024 : 2048, small ? 1024 : 2048);
  const SH = 22;
  Object.assign(sun.shadow.camera, { left: -SH, right: SH, top: SH, bottom: -SH, near: 1, far: 140 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  sun.shadow.radius = 3;
  scene.add(sun, sun.target);
  const fill = new THREE.HemisphereLight('#dff0ff', '#6a8a3a', 0.4);
  scene.add(fill);
  const lamps = new THREE.Group();
  scene.add(lamps);

  const world = new THREE.Group();
  const props = new THREE.Group();
  const cast = new THREE.Group();
  const fxGroup = new THREE.Group();
  scene.add(world, props, cast, fxGroup);

  // the code-made Mario until the loaded one is here (setArea waits for it)
  let mario = makeMario();
  scene.add(mario.root);
  const blobTex = blobTexture();
  const blobMat = new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, color: blobTex ? '#ffffff' : '#000000', opacity: blobTex ? 1 : 0.3 });
  const blobGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const marioBlob = new THREE.Mesh(blobGeo, blobMat);
  marioBlob.renderOrder = 2;
  scene.add(marioBlob);
  // the others online in the area you're in (the module hands them to sync,
  // ./online.js), as the Middle-earth towns show theirs: each a Mario from
  // another save, pale, with their name over him. The code-made Mario in one
  // piece (models/ghost.js: one draw, not his 39 parts'), made the first time
  // someone comes and shared by them all, so a ghost going frees none of it;
  // their height comes lifted by LIFT, and goes down by it here
  let ghostShape = null;
  const ghostPaint = new THREE.MeshBasicMaterial(); // (ghosts.js puts its pale one on)
  const others = createGhosts({
    height: () => -LIFT,
    make: () => {
      ghostShape ??= ghostGeometry();
      const group = new THREE.Group();
      group.add(new THREE.Mesh(ghostShape, ghostPaint));
      return { group, top: 1.6, shared: true, dispose: () => {} };
    },
    animate: () => {},
    tag: 0.3,
    halo: 1,
  });
  scene.add(others.group);

  const materials = new Map();
  const models = new Map(); // actor id → { model, blob }
  let water = [];
  let areaId = null;
  let body = createMarioBody({ leg: mario.leg });
  let lastT = 0;
  const pulses = [];

  const material = (key) => {
    if (!materials.has(key)) materials.set(key, surface(key, small));
    return materials.get(key);
  };

  function clear(group) {
    for (const o of [...group.children]) {
      group.remove(o);
      o.traverse?.((c) => {
        if (c.isMesh && c.parent && (c.userData.own || group === world)) c.geometry.dispose();
      });
    }
  }

  async function setArea(id) {
    const area = AREAS[id];
    // the loaded models first (once): the cast and props are made with them
    await loadHd();
    if (!mario.figure && hdTemplate('mario')) {
      scene.remove(mario.root);
      mario = makeHdMario(hdTemplate('mario'));
      scene.add(mario.root);
      body = createMarioBody({ leg: mario.leg });
    }
    const { built } = buildArea(id);
    const meshes = [];
    for (const [key, data] of built.meshes) {
      if (key === 'none') continue;
      const m = new THREE.Mesh(geometryOf(data), await material(key));
      m.castShadow = m.receiveShadow = true;
      meshes.push(m);
    }
    for (const t of built.terrains) {
      const geo = geometryOf(t, t.index);
      geo.setAttribute('splat', new THREE.BufferAttribute(t.splat, 3));
      const m = new THREE.Mesh(geo, await splatMaterial(t.mats, small));
      m.receiveShadow = true;
      m.castShadow = true;
      meshes.push(m);
    }
    const sky = await loadSky(area.sky === 'inside' ? 'hall' : area.sky, { background: area.sky !== 'inside' });
    // swap in only now it's all here
    clear(world);
    clear(props);
    clear(cast);
    models.clear();
    for (const m of meshes) world.add(m);
    water = [];
    const wm = waterMaterial();
    for (const b of area.water ?? []) {
      const plane = new THREE.Mesh(new THREE.PlaneGeometry((b.x1 - b.x0) * S, (b.z1 - b.z0) * S).rotateX(-Math.PI / 2), wm);
      plane.position.set(((b.x0 + b.x1) / 2) * S, b.y * S, ((b.z0 + b.z1) / 2) * S);
      plane.receiveShadow = true;
      world.add(plane);
      water.push(plane);
    }
    for (const p of area.props ?? []) {
      const model = makeProp(p);
      model.root.position.set(p.x * S, (p.y ?? 0) * S, p.z * S);
      model.root.rotation.y = p.yaw ?? 0;
      model.prop = p;
      props.add(model.root);
      model.root.userData.model = model;
    }
    if (scene.environment) scene.environment.dispose?.();
    scene.environment = pmrem.fromEquirectangular(sky.hdr).texture;
    scene.environmentIntensity = area.sky === 'inside' ? 1.1 : 1.45;
    scene.background = sky.background ?? new THREE.Color(area.fog?.color ?? '#202020');
    scene.backgroundIntensity = 1;
    scene.fog = new THREE.Fog(area.fog?.color ?? '#cfe3ff', (area.fog?.near ?? 6000) * S, (area.fog?.far ?? 26000) * S);
    const sd = sky.meta.sun?.dir;
    if (sd && area.sky !== 'inside') {
      sun.visible = true;
      sun.userData.dir = new THREE.Vector3(sd[0], sd[1], sd[2]).normalize();
      sun.color.setRGB(...sky.meta.sun.color);
      sun.intensity = 4.6;
      fill.intensity = 0.4;
    } else {
      // inside: warm lamps where the chandeliers hang, and no sun
      sun.visible = false;
      fill.intensity = 0.55;
    }
    clear(lamps);
    for (const p of area.props ?? [])
      if (p.kind === 'chandelier') {
        const l = new THREE.PointLight('#ffcf8a', 60, 30, 1.6);
        l.position.set(p.x * S, (p.y - 260) * S, p.z * S);
        lamps.add(l);
      }
    areaId = id;
  }

  // Everything where the rules have it, between their last two steps.
  function sync(g, alpha, travellers = []) {
    if (!areaId || g.areaId !== areaId) return;
    const t = g.t + alpha;
    const dt = Math.max(0, t - lastT);
    lastT = t;
    // (the game's clock is in its steps, thirty a second; the ghosts' in seconds)
    others.update(travellers, t / 30, dt / 30);
    const m = g.mario;
    const l = m.last ?? { x: m.pos.x, y: m.pos.y, z: m.pos.z, yaw: m.yaw };
    const x = lerp(l.x, m.pos.x, alpha) * S, y = lerp(l.y, m.pos.y, alpha) * S, z = lerp(l.z, m.pos.z, alpha) * S;
    mario.root.position.set(x, y, z);
    mario.root.rotation.y = lerpAngle(l.yaw, m.yaw, alpha);
    // (his action's time runs on between the rules' steps while they step him)
    const stepping = g.mode === 'play' || g.mode === 'starget';
    mario.apply(body.pose(m, { dt, alpha, live: stepping, look: stepping ? lookFor(m, g.actors) : null }));
    mario.setVisible(!(m.invuln > 0 && m.action !== 'dead' && Math.floor(t / 2) % 2 === 0));
    // his blob shadow on the floor under him, fainter the higher he is
    const above = Math.max(0, m.pos.y - m.floorY);
    marioBlob.visible = m.floor != null && above < 2500;
    marioBlob.position.set(x, m.floorY * S + 0.02, z);
    const bs = 0.9 * Math.max(0.4, 1 - above / 3000);
    marioBlob.scale.setScalar(bs);

    // the cast: made when they appear, dropped when they go
    const live = new Set();
    for (const a of g.actors) {
      live.add(a.id);
      let entry = models.get(a.id);
      if (!entry) {
        const model = makeActor(a);
        cast.add(model.root);
        let blob = null;
        if (a.r > 0 && a.type !== 'painting' && a.type !== 'door' && a.type !== 'stardoor') {
          blob = new THREE.Mesh(blobGeo, blobMat);
          blob.scale.setScalar(a.r * S * 2.6);
          cast.add(blob);
        }
        entry = { model, blob };
        models.set(a.id, entry);
      }
      const al = a.last ?? { x: a.pos.x, y: a.pos.y, z: a.pos.z, yaw: a.yaw };
      const ax = lerp(al.x, a.pos.x, alpha) * S, ay = lerp(al.y, a.pos.y, alpha) * S, az = lerp(al.z, a.pos.z, alpha) * S;
      entry.model.root.position.set(ax, ay, az);
      // turned at its own rate toward where the rules point it, never snapped
      entry.yaw = easeFace(entry.yaw, a, faceFor(a, m, lerpAngle(al.yaw ?? a.yaw, a.yaw, alpha)), dt);
      entry.model.root.rotation.y = entry.yaw;
      // how long it's been at what it's doing (drawn time), and how fast it goes (metres a second)
      if (entry.state !== a.state) {
        entry.prev = entry.state ?? null;
        entry.state = a.state;
        entry.at = t;
      }
      const speed = Math.hypot(a.pos.x - al.x, a.pos.z - al.z) * 30 * S;
      entry.model.update(a, t, g, { dt, since: t - entry.at, prev: entry.prev, speed });
      if (entry.blob) {
        entry.blob.visible = a.alive && a.state !== 'gone';
        entry.blob.position.set(ax, ((a.floorY ?? a.pos.y) + 2) * S, az);
      }
    }
    for (const [id, entry] of models)
      if (!live.has(id)) {
        cast.remove(entry.model.root);
        if (entry.blob) cast.remove(entry.blob);
        models.delete(id);
      }
    for (const o of props.children) o.userData.model?.update?.(o.userData.model.prop, t, g);

    // the camera: Lakitu's, or circling the castle for the title
    if (g.mode === 'title') {
      const ang = t * 0.0025;
      camera.position.set(Math.sin(ang) * 46, 14, -28 + Math.cos(ang) * 46);
      camera.lookAt(0, 9, -28);
    } else {
      const c = g.cam;
      const cl = c.last ?? { x: c.pos.x, y: c.pos.y, z: c.pos.z, fx: c.focus.x, fy: c.focus.y, fz: c.focus.z };
      camera.position.set(lerp(cl.x, c.pos.x, alpha) * S, lerp(cl.y, c.pos.y, alpha) * S, lerp(cl.z, c.pos.z, alpha) * S);
      camera.lookAt(lerp(cl.fx, c.focus.x, alpha) * S, lerp(cl.fy, c.focus.y, alpha) * S, lerp(cl.fz, c.focus.z, alpha) * S);
    }
    // the sun's shadow box follows him
    if (sun.visible && sun.userData.dir) {
      const d = sun.userData.dir;
      sun.target.position.set(x, y, z);
      sun.position.set(x + d.x * 60, y + d.y * 60, z + d.z * 60);
    }
    for (const w of water) if (w.material.normalMap) w.material.normalMap.offset.set(t * 0.0008, t * 0.0005);
    stepFx(dt);
  }

  // ─── Effects ─────────────────────────────────────────────────────────────
  const puffMat = new THREE.MeshBasicMaterial({ color: '#f4efe6', transparent: true, opacity: 0.8, depthWrite: false });
  const sparkMat = new THREE.MeshBasicMaterial({ color: '#fff3b0', transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending });
  const blastMat = new THREE.MeshBasicMaterial({ color: '#ffb347', transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending });
  const ball = new THREE.SphereGeometry(1, 12, 8);
  function fx(type, at) {
    const p = new THREE.Vector3(at.x * S, at.y * S, at.z * S);
    const add = (mat, n, speed, size, life, up = 0) => {
      for (let i = 0; i < n; i++) {
        const mesh = new THREE.Mesh(ball, mat.clone());
        const ang = (i / n) * Math.PI * 2;
        mesh.position.copy(p);
        mesh.scale.setScalar(size);
        fxGroup.add(mesh);
        pulses.push({ mesh, v: new THREE.Vector3(Math.cos(ang) * speed, up + (i % 3) * 0.02, Math.sin(ang) * speed), life, age: 0, size });
      }
    };
    if (type === 'land' || type === 'pound' || type === 'stomp') add(puffMat, type === 'land' ? 6 : 12, type === 'land' ? 0.04 : 0.08, type === 'land' ? 0.12 : 0.2, 18);
    else if (type === 'coin' || type === 'star' || type === 'oneup') add(sparkMat, 10, 0.06, 0.08, 22, 0.05);
    else if (type === 'explode') {
      add(blastMat, 1, 0, 0.6, 20);
      add(puffMat, 14, 0.12, 0.35, 40, 0.03);
    }
  }
  function stepFx(dt) {
    for (let i = pulses.length - 1; i >= 0; i--) {
      const q = pulses[i];
      q.age += dt;
      const k = q.age / q.life;
      if (k >= 1) {
        fxGroup.remove(q.mesh);
        q.mesh.material.dispose();
        pulses.splice(i, 1);
        continue;
      }
      q.mesh.position.addScaledVector(q.v, dt);
      q.mesh.scale.setScalar(q.size * (1 + k * (q.v.lengthSq() === 0 ? 5 : 1.5)));
      q.mesh.material.opacity = 1 - k;
    }
  }

  return {
    scene,
    camera,
    // (Mario's model, for the browser checks)
    get mario() {
      return mario;
    },
    setArea,
    sync,
    fx,
    render() {
      look.render();
    },
    resize(w, h) {
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
      look.setSize(w, h);
    },
    setLook: (name) => look.setLook(name),
    setBloom: (on) => look.setBloom(on),
    dispose() {
      clear(world);
      clear(props);
      clear(cast);
      mario.dispose?.();
      others.dispose();
      ghostShape?.dispose();
      ghostPaint.dispose();
      look.dispose();
      pmrem.dispose();
      scene.environment?.dispose?.();
    },
  };
}
