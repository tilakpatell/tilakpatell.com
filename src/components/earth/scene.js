// Earth, the world, in 3D: the globe from NASA's Blue Marble (with the
// sea floor's shape, and the land's relief lit by the sun), the 2016 Black
// Marble's city lights on the night side, the sun glinting off the sea, a
// shell of clouds that casts its shadows on the ground, an atmosphere that's
// a blue rim from orbit and a sky from low down, the stars behind, a beacon
// at every place in the passport, the other pilots online as pale planes
// with a glow and their name (the same size on the screen from anywhere),
// and the plane (a 737, repainted) with its
// lights and contrails. The sun is where it really is now.
//
// It draws what the component hands it every frame (the flight from
// ./rules.js, where the camera is in its dive from orbit, which places are
// stamped, the trail) and decides nothing.
//
// createEarth(renderer, { small, lost, compile }) returns { render(state, ms),
// screenOf(v), pick(ndcX, ndcY), resize, snap(), warm(state), dispose, ready }. The
// renderer is the world runtime's node renderer (src/runtime); `lost` says if
// its context has gone; `compile(scene, camera)` readies its shaders (the
// runtime's rt.gfx.compile); resize is told the canvas's CSS size (the
// runtime sizes the renderer itself).

import * as THREE from 'three';
import { disposeTree } from '../../lib/three/renderer';
import { gltfLoader } from '../../lib/three/gltf';
import { loadTexture, sharpen, sharpenMaterial } from '../../lib/three/textures';
import { device } from '../../lib/device';
import { ghostNodeMaterial } from '../middleearth/shared/ghostNodes';
import { AIR, airMaterial, beamMaterial, classicOutput, cloudMaterial, globeMaterial, skyMaterial, trailMaterial } from './nodes';
import { CLOUD_ALT, HOME_V, STAMPS, TRAIL as LOG, cross, placeById, routeArc, unit, unpackPose } from './rules';

const BASE = '/textures/earth/';
const CLOUDS_UP = CLOUD_ALT; // the cloud shell's height over the ground (the plane can get under it)
const PLANE = 0.0075; // the plane's length, in Earth radii (a toy: you'd never see a real one from up here)
const TRAIL_UP = 0.004; // the trail flown is drawn this far under where the plane was (about 25 km)
const ROUTE_UP = 0.008; // the routes to the places stamped

const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);

// ── the globe ──
//
// Lit by hand, so the day side, the night lights, the glint, the cloud
// shadows and the haze at the rim are one pass; the clouds a shell over it;
// the air a sphere's inside drawn behind everything. Their materials are
// TSL (./nodes.js), so the world draws on WebGPU where there is one and on
// WebGL 2 where there isn't.

// a soft round glow, for the sun and the plane's lights
function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)');
  r.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  sharpen(t);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// The plane in code, for while the model loads (or if it doesn't): a
// fuselage, swept wings, a tail and two engines, nose along +z, 1 long.
function paperPlane() {
  const g = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: '#f2f4f7', roughness: 0.45, metalness: 0.1 });
  const blue = new THREE.MeshStandardMaterial({ color: '#1f5f99', roughness: 0.5 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.86, 6, 12).rotateX(Math.PI / 2), white);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.012, 0.16), white);
  wing.position.set(0, -0.015, 0.02);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.18, 0.14), blue);
  fin.position.set(0, 0.11, -0.42);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.01, 0.08), white);
  tail.position.set(0, 0.02, -0.43);
  const eng = new THREE.CylinderGeometry(0.035, 0.03, 0.14, 10).rotateX(Math.PI / 2);
  for (const x of [-0.2, 0.2]) {
    const e = new THREE.Mesh(eng, blue);
    e.position.set(x, -0.06, 0.08);
    g.add(e);
  }
  g.add(body, wing, fin, tail);
  return g;
}

// a name on a card, as a sprite that stays the same size on the screen
function nameSprite(name, h = 0.028) {
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  const font = '600 30px system-ui, sans-serif';
  g.font = font;
  const w = Math.ceil(g.measureText(name).width) + 28;
  c.width = w;
  c.height = 44;
  g.font = font;
  g.fillStyle = 'rgba(6, 14, 28, 0.7)';
  g.beginPath();
  g.roundRect(0, 0, w, 44, 12);
  g.fill();
  g.fillStyle = '#e6eeff';
  g.textBaseline = 'middle';
  g.fillText(name, 14, 23);
  const tex = new THREE.CanvasTexture(c);
  sharpen(tex);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false, sizeAttenuation: false, opacity: 0 }));
  sp.scale.set((w / 44) * h, h, 1);
  sp.center.set(0.5, -0.9);
  sp.renderOrder = 6;
  return sp;
}

// the largest picture the renderer can hold, whichever renderer it is
// (the classic one says it in capabilities; the node renderer's backend, as
// a WebGPU device's limit or its WebGL 2 context's)
function maxTexture(r) {
  const gl = r.backend?.gl;
  return r.capabilities?.maxTextureSize ?? r.backend?.device?.limits?.maxTextureDimension2D ?? (gl ? gl.getParameter(gl.MAX_TEXTURE_SIZE) : 4096);
}

export function createEarth(renderer, { small = false, lost = () => false, compile = () => Promise.resolve() } = {}) {
  const tier = device().tier;
  // the renderer's own output off: each material tone maps and encodes
  // itself before it's blended, as the classic renderer did (./nodes.js's
  // classicOutput says why), so nothing is converted at the end
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.setClearColor(0x000000, 1);
  const big = !small && tier === 'high' && maxTexture(renderer) >= 8192;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.0005, 80);
  const blank = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
  blank.needsUpdate = true;
  const flat = new THREE.DataTexture(new Uint8Array([128, 128, 128, 255]), 1, 1);
  flat.needsUpdate = true;
  const sunDir = new THREE.Vector3(0, 0, 1);

  // the maps: the day side first (the world waits for it), the rest as they come
  // (decoded off the main thread, as sharp as the device's tier allows, and
  // shared with the universe map where they want the same file)
  const tex = (name, colour) =>
    loadTexture(`${BASE}${name}${big ? '' : '-sm'}.webp`, { renderer, color: colour }).then((t) => {
      t.wrapS = THREE.RepeatWrapping;
      return t;
    });
  const globeLook = globeMaterial({ blank, flat, sunDir });
  const globeU = globeLook.u;
  const owned = [];
  const want = (name, colour, set) =>
    tex(name, colour)
      .then((t) => {
        owned.push(t);
        set(t);
        return t;
      })
      .catch(() => null);
  const ready = want('day', true, (t) => (globeU.tDay.value = t));
  want('water', false, (t) => (globeU.tWater.value = t));
  want('relief', false, (t) => (globeU.tRelief.value = t));
  want('night', true, (t) => {
    globeU.tNight.value = t;
    globeU.uHasNight.value = 1;
  });
  want('clouds', false, (t) => {
    globeU.tClouds.value = t;
    cloudU.tClouds.value = t;
    cloudMat.visible = true;
  });

  const seg = tier === 'low' || small ? [160, 96] : [288, 160];
  const globe = new THREE.Mesh(new THREE.SphereGeometry(1, seg[0], seg[1]), globeLook.material);
  scene.add(globe);
  const { material: cloudMat, u: cloudU } = cloudMaterial({ blank, sunDir, uCloud: globeU.uCloud });
  cloudMat.visible = false;
  const clouds = new THREE.Mesh(new THREE.SphereGeometry(1 + CLOUDS_UP, seg[0], seg[1]), cloudMat);
  clouds.renderOrder = 2;
  scene.add(clouds);
  const air = new THREE.Mesh(new THREE.SphereGeometry(AIR, 96, 48), airMaterial({ sunDir }).material);
  air.renderOrder = 1;
  scene.add(air);

  // the stars (the universe map's Milky Way), faint: a sphere kept round the
  // camera, drawn first and behind everything (./nodes.js says why it isn't
  // scene.background)
  const skyLook = skyMaterial(blank);
  const sky = new THREE.Mesh(new THREE.SphereGeometry(40, 64, 32), skyLook.material);
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  sky.visible = false;
  scene.add(sky);
  loadTexture(`/textures/universe/sky${big ? '' : '-sm'}.webp`, { renderer, color: true })
    .then((t) => {
      owned.push(t);
      skyLook.u.tSky.value = t;
      sky.visible = true;
    })
    .catch(() => {});

  // the sun, far off in its direction
  const glow = glowTexture();
  const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: new THREE.Color(1, 0.93, 0.8).multiplyScalar(3), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  sun.scale.setScalar(5);
  scene.add(sun);
  const light = new THREE.DirectionalLight(0xffffff, 2.6);
  scene.add(light, light.target, new THREE.HemisphereLight(0xb8d4ff, 0x203040, 0.35));

  // ── the beacons ──
  const beamGeo = new THREE.CylinderGeometry(0.0022, 0.0042, 0.07, 10, 1, true).translate(0, 0.035, 0);
  const ringGeo = new THREE.RingGeometry(0.004, 0.0062, 32);
  const beacons = new Map();
  const place = (id, v, colour) => {
    const g = new THREE.Group();
    g.position.copy(v3(v));
    g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v3(v));
    const { material: mat, u } = beamMaterial(colour);
    const beam = new THREE.Mesh(beamGeo, mat);
    const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(colour), transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.0004;
    g.add(beam, ring);
    beam.renderOrder = ring.renderOrder = 3;
    scene.add(g);
    beacons.set(id, { g, mat, u, ringMat, ring, colour });
  };
  for (const s of STAMPS) place(s.id, s.v, '#5cb8ff');
  place('home', HOME_V, '#ffe6a8');
  const STAMPED = new THREE.Color('#ffd27a');
  const OPEN = new THREE.Color('#5cb8ff');

  // ── the flight log ──
  // the trail flown, as a line just over the ground: the component keeps
  // the points (rules' logTrail) and bumps `trailV` when they change
  const trailPos = new Float32Array(LOG.max * 3);
  const trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3).setUsage(THREE.DynamicDrawUsage));
  trailGeo.setDrawRange(0, 0);
  const trailLine = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({ color: '#8fd3ff', transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending }));
  trailLine.frustumCulled = false;
  trailLine.renderOrder = 3;
  scene.add(trailLine);
  let trailSeen = -1;
  // the route home to each place stamped, along the great circle, in gold
  const routes = new Map();
  const routeMat = new THREE.LineBasicMaterial({ color: '#ffd27a', transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending });
  const route = (id) => {
    const s = placeById(id);
    if (!s) return;
    const pts = routeArc(HOME_V, s.v, 64).map((v) => v3(v).multiplyScalar(1 + ROUTE_UP));
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), routeMat);
    line.renderOrder = 3;
    scene.add(line);
    routes.set(id, line);
  };

  // ── the plane ──
  const plane = new THREE.Group(); // placed and turned each frame
  const body = new THREE.Group(); // banks and pitches inside it
  plane.add(body);
  body.scale.setScalar(PLANE);
  let model = paperPlane();
  body.add(model);
  scene.add(plane);
  let gone = false;
  gltfLoader()
    .loadAsync('/models/sketchfab/earth-plane.glb')
    .then((g) => {
      if (gone) return disposeTree(g.scene);
      g.scene.traverse((o) => {
        if (!o.isMesh) return;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) {
          sharpenMaterial(m, { renderer });
          if ('roughness' in m) m.roughness = Math.min(m.roughness, 0.5);
        }
      });
      body.remove(model);
      disposeTree(model);
      model = g.scene;
      body.add(model);
      return null;
    })
    .catch(() => {});
  // its lights: red on the left wingtip, green on the right, a white strobe on the tail
  const navMat = (c) => new THREE.SpriteMaterial({ map: glow, color: new THREE.Color(c), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
  const nav = [
    [navMat('#ff3b30'), [0.45, -0.02, -0.02]],
    [navMat('#30ff7a'), [-0.45, -0.02, -0.02]],
    [navMat('#ffffff'), [0, 0.17, -0.48]],
  ].map(([m, at]) => {
    const s = new THREE.Sprite(m);
    s.position.set(...at);
    s.scale.setScalar(0.09);
    body.add(s);
    return s;
  });

  // two contrails, from the engines, fading behind
  const TRAIL = 64;
  const trails = [-0.2, 0.2].map((x) => {
    const pos = new Float32Array(TRAIL * 2 * 3);
    const fade = new Float32Array(TRAIL * 2);
    for (let i = 0; i < TRAIL; i++) fade[i * 2] = fade[i * 2 + 1] = 1 - i / (TRAIL - 1);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aFade', new THREE.BufferAttribute(fade, 1));
    const idx = [];
    for (let i = 0; i < TRAIL - 1; i++) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    geo.setIndex(idx);
    const { material: mat, u } = trailMaterial();
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = 4;
    scene.add(mesh);
    return { x, pos, geo, mat, u, mesh, pts: [], acc: 0 };
  });

  // ── the other pilots ──
  // each a pale plane with a glow and a name that keep their size on the
  // screen, eased towards where they said they were, gone when they are; the
  // towns' ghost pale and rim of light, in nodes (middleearth/shared/
  // ghostNodes.js: the same ghost on this renderer as on the classic one),
  // its glow a little up, for a plane seen small against the globe
  const ghostMat = ghostNodeMaterial({ glowStrength: 0.8 });
  const ghosts = new Map();
  const makeGhost = (p) => {
    const g = new THREE.Group();
    const body = new THREE.Group();
    body.scale.setScalar(PLANE);
    const model = paperPlane();
    const old = new Set();
    model.traverse((o) => {
      if (!o.isMesh) return;
      old.add(o.material);
      o.material = ghostMat;
    });
    for (const m of old) m.dispose();
    body.add(model);
    const dot = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: new THREE.Color('#8fd3ff'), blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true, sizeAttenuation: false, opacity: 0 }));
    dot.scale.set(0.03, 0.03, 1);
    dot.renderOrder = 6;
    const tag = nameSprite(p.name);
    g.add(body, dot, tag);
    scene.add(g);
    const at = unpackPose(p);
    return { g, body, dot, tag, name: p.name, p: v3(at.p), h: v3(at.h), alt: at.alt, fade: 0 };
  };
  const dropGhost = (id, gh) => {
    scene.remove(gh.g);
    gh.tag.material.map.dispose();
    gh.tag.material.dispose();
    gh.dot.material.dispose();
    gh.g.traverse((o) => o.geometry?.dispose());
    ghosts.delete(id);
  };
  const gBasis = new THREE.Matrix4();
  const updateGhosts = (list, dt) => {
    const here = new Set();
    const k = 1 - Math.exp(-dt * 6);
    for (const p of list) {
      here.add(p.id);
      let gh = ghosts.get(p.id);
      if (!gh) {
        gh = makeGhost(p);
        ghosts.set(p.id, gh);
      }
      if (gh.name !== p.name) {
        gh.g.remove(gh.tag);
        gh.tag.material.map.dispose();
        gh.tag.material.dispose();
        gh.tag = nameSprite(p.name);
        gh.g.add(gh.tag);
        gh.name = p.name;
      }
      const at = unpackPose(p);
      const tp = v3(at.p);
      // a long way off (a jump): straight there
      if (gh.p.angleTo(tp) > 0.2) {
        gh.p.copy(tp);
        gh.h.copy(v3(at.h));
        gh.alt = at.alt;
      }
      gh.p.lerp(tp, k).normalize();
      gh.h.lerp(v3(at.h), k);
      gh.h.addScaledVector(gh.p, -gh.h.dot(gh.p)).normalize();
      gh.alt += (at.alt - gh.alt) * k;
      const want = p.inside ? 0 : 1;
      gh.fade += (want - gh.fade) * Math.min(1, dt * 3);
      gBasis.makeBasis(gh.p.clone().cross(gh.h).normalize(), gh.p, gh.h);
      gh.g.position.copy(gh.p).multiplyScalar(1 + gh.alt);
      gh.body.quaternion.setFromRotationMatrix(gBasis);
      gh.dot.material.opacity = 0.85 * gh.fade;
      gh.tag.material.opacity = 0.95 * gh.fade;
      gh.g.visible = gh.fade > 0.02;
    }
    for (const [id, gh] of ghosts) {
      if (here.has(id)) continue;
      gh.fade -= dt * 2;
      gh.dot.material.opacity = 0.85 * Math.max(0, gh.fade);
      gh.tag.material.opacity = Math.max(0, gh.fade);
      if (gh.fade <= 0) dropGhost(id, gh);
    }
    // (one material for every ghost plane: as pale as the most faded-in of them)
    let top = 0;
    for (const gh of ghosts.values()) top = Math.max(top, gh.fade);
    ghostMat.opacity = 0.5 * top;
  };

  // ── sizes ──
  const size = { w: 1, h: 1 };
  const resize = (w, h) => {
    size.w = Math.max(1, w);
    size.h = Math.max(1, h);
    camera.aspect = size.w / size.h;
    camera.updateProjectionMatrix();
  };

  // ── per frame ──
  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  const basis = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const qb = new THREE.Quaternion();
  const X = new THREE.Vector3(1, 0, 0);
  const Z = new THREE.Vector3(0, 0, 1);
  const pose = { pos: new THREE.Vector3(0, 0, 3), look: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0), ready: false };
  let disposed = false;
  let warmed = false;

  // where the chase camera wants to be: behind and above the plane, swung
  // round it by the look (yaw to either side, pitch up and down); or, in
  // the cockpit, at the nose looking ahead, banking with the wings
  const chase = (f, out, look = null, cockpit = false) => {
    const p = v3(f.p);
    const h = v3(f.h);
    const r = 1 + f.alt;
    out.plane = p.clone().multiplyScalar(r);
    if (cockpit) {
      out.pos = out.plane.clone().addScaledVector(h, 0.0045).addScaledVector(p, 0.0012);
      out.look = out.plane.clone().addScaledVector(h, 0.06).addScaledVector(p, 0.0012 + 0.003 * (f.climb ?? 0));
      out.up = p.clone().applyAxisAngle(h, -(f.turn * 0.6 + (f.roll ?? 0)));
      return out;
    }
    const yaw = look?.yaw ?? 0;
    const pitch = look?.pitch ?? 0;
    const right = h.clone().cross(p).normalize();
    // the way back from the plane, swung round by the yaw and tipped by the pitch
    const back = h.clone().multiplyScalar(-Math.cos(yaw)).addScaledVector(right, Math.sin(yaw));
    // (under the cloud deck the camera comes down with the plane, so the
    // clouds go by overhead instead of hiding it)
    const base = Math.min(0.0105, Math.max(0.0015, CLOUD_ALT - 0.0008 - f.alt));
    const lift = base + 0.03 * Math.sin(pitch) + 0.012 * (1 - Math.cos(yaw));
    out.pos = out.plane.clone().addScaledVector(back, 0.03 * Math.cos(pitch)).addScaledVector(p, lift);
    out.look = out.plane.clone().addScaledVector(h, 0.022 * Math.max(0, Math.cos(yaw))).addScaledVector(p, 0.002);
    out.up = p.clone().applyAxisAngle(h, -f.turn * 0.18 * Math.cos(yaw));
    return out;
  };
  const chaseNow = {};

  const render = (state, ms = 16) => {
    if (disposed || lost()) return;
    const dt = Math.min(0.05, ms / 1000);
    const { flight: f, sun: s, view, stamped, orbit, trail = null, trailV = 0, look = null, cockpit = false, travellers = null } = state;
    // (the clouds' drift, the strobe and the beacons' pulse run on the clock,
    // unless a view held it: module.js's, for the parity check)
    const t = state.t ?? performance.now() / 1000;
    sunDir.set(s[0], s[1], s[2]);
    sun.position.copy(sunDir).multiplyScalar(40);
    light.position.copy(sunDir).multiplyScalar(10);
    globeU.uCloud.value = (t * 0.0006) % 1;

    // the plane: on the sphere at its height, nose along its heading
    const p = v3(f.p);
    const h = v3(f.h);
    // (the model's +x is its left wing, +y its top, +z its nose)
    basis.makeBasis(v3(unit(cross(f.p, f.h))), p, h);
    plane.position.copy(p).multiplyScalar(1 + f.alt);
    plane.quaternion.setFromRotationMatrix(basis);
    q.setFromAxisAngle(Z, f.turn * 0.6 + (f.roll ?? 0));
    qb.setFromAxisAngle(X, -f.climb * 0.22);
    body.quaternion.copy(q).multiply(qb);
    nav[2].visible = t % 1.2 < 0.07; // the strobe
    const lightUp = Math.max(0, p.dot(sunDir));

    // the camera: orbit, the dive between, or the chase (or the cockpit)
    const inside = cockpit && view >= 1;
    chase(f, chaseNow, look, inside);
    body.visible = !inside;
    const k = view; // 0 orbit … 1 chase
    const orbitPos = v3(orbit).multiplyScalar(3.1);
    // in a dive the camera comes in along the way, then swings in behind
    const e = k * k * (3 - 2 * k);
    const r0 = orbitPos.length();
    const r1 = chaseNow.pos.length();
    const dirA = orbitPos.clone().normalize();
    const dirB = chaseNow.pos.clone().normalize();
    const dir = dirA.clone().lerp(dirB, Math.min(1, e * 1.25)).normalize();
    const radius = r1 + (r0 - r1) * Math.pow(1 - k, 2.4);
    const target = tmp.copy(chaseNow.look).multiplyScalar(Math.pow(e, 0.6));
    const up = tmp2.set(0, 1, 0).lerp(chaseNow.up, e).normalize();
    if (k >= 1) {
      // the chase: follow smoothly (the cockpit at once, or the nose would lag)
      const a = pose.ready && !inside ? 1 - Math.exp(-9 * dt) : 1;
      pose.pos.lerp(chaseNow.pos, a);
      pose.look.lerp(chaseNow.look, a);
      pose.up.lerp(chaseNow.up, a).normalize();
    } else {
      pose.pos.copy(dir).multiplyScalar(radius);
      pose.look.copy(target);
      pose.up.copy(up);
    }
    pose.ready = true;
    camera.position.copy(pose.pos);
    camera.up.copy(pose.up);
    camera.lookAt(pose.look);
    // near and far for where the camera is: close in for the plane, far out for the globe
    const height = camera.position.length() - 1;
    camera.near = Math.max(0.00025, Math.min(0.2, height * 0.04));
    camera.far = 80;
    camera.fov = inside ? 58 : 50 - 8 * k;
    camera.updateProjectionMatrix();
    // no stars by day, inside the air
    const inAir = 1 - THREE.MathUtils.smoothstep(height, 0.06, 0.13);
    const sunHere = THREE.MathUtils.clamp(camera.position.clone().normalize().dot(sunDir) * 4 + 0.6, 0, 1);
    skyLook.u.uIntensity.value = 0.32 * (1 - inAir * sunHere * 0.94);
    sky.position.copy(camera.position);

    // the beacons: gold once stamped, the beam shorter as you come in low
    for (const [id, b] of beacons) {
      const got = id === 'home' || stamped.has(id);
      if (id !== 'home') {
        b.u.uColor.value.copy(got ? STAMPED : OPEN);
        b.ringMat.color.copy(got ? STAMPED : OPEN);
      }
      const pulse = 1 + 0.25 * Math.sin(t * 3 + b.g.position.x * 9);
      b.ring.scale.setScalar(pulse);
      b.u.uOpacity.value = 0.22 + 0.7 * (1 - k);
      b.g.scale.setScalar(1 + (1 - k) * 0.8);
    }

    // the flight log: the trail as it grows, and a route for each new stamp
    if (trail && trailV !== trailSeen) {
      trailSeen = trailV;
      const n = Math.min(trail.length, LOG.max);
      for (let i = 0; i < n; i++) {
        const pt = trail[trail.length - n + i];
        const r = 1 + Math.max(0.002, (pt[3] ?? 0.01) - TRAIL_UP);
        trailPos[i * 3] = pt[0] * r;
        trailPos[i * 3 + 1] = pt[1] * r;
        trailPos[i * 3 + 2] = pt[2] * r;
      }
      trailGeo.setDrawRange(0, n);
      trailGeo.attributes.position.needsUpdate = true;
    }
    for (const id of stamped) if (!routes.has(id)) route(id);
    trailLine.material.opacity = 0.45 + 0.3 * (1 - k);
    routeMat.opacity = 0.35 + 0.3 * (1 - k);
    updateGhosts(travellers ?? [], dt);

    // contrails: a point dropped behind each engine every little while
    for (const tr of trails) {
      tr.acc += dt;
      const at = tmp.set(tr.x * PLANE, -0.05 * PLANE, -0.15 * PLANE).applyQuaternion(plane.quaternion).add(plane.position);
      if (!tr.pts.length || tr.acc > 0.04) {
        tr.acc = 0;
        tr.pts.unshift(at.clone());
        if (tr.pts.length > TRAIL) tr.pts.pop();
      } else tr.pts[0].copy(at);
      const side = tmp2.copy(p).cross(h).normalize();
      for (let i = 0; i < TRAIL; i++) {
        const pt = tr.pts[Math.min(i, tr.pts.length - 1)];
        const w = PLANE * (0.012 + 0.05 * (i / TRAIL));
        tr.pos.set([pt.x + side.x * w, pt.y + side.y * w, pt.z + side.z * w, pt.x - side.x * w, pt.y - side.y * w, pt.z - side.z * w], i * 6);
      }
      tr.geo.attributes.position.needsUpdate = true;
      tr.u.uLight.value = 0.08 + 0.92 * Math.min(1, lightUp * 3);
      tr.mesh.visible = k > 0.6 && !inside;
    }

    // three's own materials (sprites, lines, the plane, a ghost come online)
    // given the classic output before they're first drawn
    scene.traverse((o) => {
      for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) classicOutput(m);
    });
    renderer.render(scene, camera);
  };

  // where a point on the globe is on the canvas, in CSS pixels, and whether
  // it's facing the camera
  const screenOf = (v, lift = 0) => {
    const w = v3(v).multiplyScalar(1 + lift);
    const facing = w.clone().normalize().dot(tmp.copy(camera.position).sub(w).normalize()) > 0.02;
    w.project(camera);
    return { x: ((w.x + 1) / 2) * size.w, y: ((1 - w.y) / 2) * size.h, on: facing && w.z < 1 && Math.abs(w.x) < 1.05 && Math.abs(w.y) < 1.05 };
  };

  // the place under a click, if any (for picking a destination from orbit)
  const pick = (nx, ny) => {
    let best = null;
    let bd = 0.06;
    for (const s of STAMPS) {
      const o = screenOf(s.v, 0.01);
      if (!o.on) continue;
      const d = Math.hypot((o.x / size.w) * 2 - 1 - nx, 1 - (o.y / size.h) * 2 - ny);
      if (d < bd) {
        bd = d;
        best = s.id;
      }
    }
    return best;
  };

  return {
    ready,
    render,
    resize,
    screenOf,
    pick,
    // the chase camera straight to where it wants to be on the next frame, not eased there
    snap() {
      pose.ready = false;
    },
    warm(state) {
      if (warmed) return Promise.resolve();
      warmed = true;
      render(state, 16);
      return compile(scene, camera);
    },
    dispose() {
      disposed = true;
      gone = true;
      // (the renderer's output as the runtime made it, for the next world on it)
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      for (const [id, gh] of ghosts) dropGhost(id, gh);
      ghostMat.dispose();
      disposeTree(scene);
      for (const t of owned) t.dispose();
      glow.dispose();
      blank.dispose();
      flat.dispose();
    },
  };
}
