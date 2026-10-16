// The Death Star’s inside (lane P1): each of its twins built once with the
// GLSL original (scripts/twin-parity/originals/deathstar/, which the
// world no longer imports) and once with the TSL one (scene/nodes/), the
// same in every other way: the windows’ sky, planets, battle and the view’s
// sun on a loaded ship; the rooms’ glows, haze, fields, water and the stars
// past a mouth; the fight’s and the duel’s sprites; and the two shared twins
// the inside took up, lib/three’s explosionsNodes and dyeNodes.
import * as THREE from 'three';
import * as SO from '../originals/deathstar/sky.js';
import * as SN from '../../../src/components/deathstar/inside/scene/nodes/sky.js';
import * as RO from '../originals/deathstar/rooms.js';
import * as RN from '../../../src/components/deathstar/inside/scene/nodes/rooms.js';
import * as FO from '../originals/deathstar/fx.js';
import * as FN from '../../../src/components/deathstar/inside/scene/nodes/fx.js';
import * as BO from '../originals/deathstar/saber.js';
import * as BN from '../../../src/components/deathstar/inside/scene/nodes/saber.js';
import * as EO from '../../../src/lib/three/explosions.js';
import * as EN from '../../../src/lib/three/explosionsNodes.js';
import * as DO from '../../../src/lib/three/dye.js';
import * as DN from '../../../src/lib/three/dyeNodes.js';
import { waterNormals } from '../../../src/components/deathstar/inside/scene/rooms/deep/compactor.js';
import { paintGiant, paintPlanet } from '../../../src/components/deathstar/planetPaint.js';
import { starSprite } from '../../../src/components/deathstar/plating.js';

const pair = (make, O, N) => ({ node: make(N), classic: make(O) });
// a seeded stream, the same on both sides
const seeded = (s = 7) => () => (s = (s * 16807) % 2147483647) / 2147483647;
const canvasTexture = (canvas, srgb) => {
  const t = new THREE.CanvasTexture(canvas);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
};

// ── the windows’ views ──

// the sky round the camera, its group a little off the origin (the sky is
// pinned round the eye from where its window is: uOrigin), looking out
// towards its sun
const SUN = [3.1, 2.95, 2.75];
const sunDir = new THREE.Vector3(0.62, 0.3, -0.72).normalize();
const skyCamera = (camera, look = [0.5, 0.2, -1]) => {
  camera.position.set(0, 0, 0);
  camera.fov = 70;
  camera.far = 2000;
  camera.updateProjectionMatrix();
  camera.lookAt(...look);
};
const windowOf = (S, scene) => {
  const group = new THREE.Group();
  group.position.set(3, 1, -2);
  scene.add(group);
  scene.background = new THREE.Color(0x000000);
  group.updateMatrixWorld(true);
  const u = S.skyUniforms(sunDir, SUN);
  group.getWorldPosition(u.uOrigin.value);
  return { group, u };
};
const far = (o, order, name) => Object.assign(o, { renderOrder: order, frustumCulled: false, name });

const stars = (S) => ({ scene, camera }) => {
  skyCamera(camera);
  const { group, u } = windowOf(S, scene);
  const rand = seeded(1977);
  const n = 600;
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const size = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const d = new THREE.Vector3(rand() * 2 - 1, rand() - 0.4, -0.4 - rand()).normalize().multiplyScalar(1000);
    pos.set(d.toArray(), i * 3);
    const k = 0.18 + rand() ** 4 * 1.4;
    col.set([k, k * 0.9, k * 0.8], i * 3);
    size[i] = 1.3 + k * 1.5;
  }
  group.add(far(S.starsMesh(pos, col, size, u, 1), 900, 'stars'));
};
const band = (S) => ({ scene, camera }) => {
  skyCamera(camera, [0.2, 0.1, -1]);
  const { group, u } = windowOf(S, scene);
  group.add(far(new THREE.Mesh(new THREE.SphereGeometry(1000, 48, 24), S.bandMaterial(u, [0.35, 0.8, 0.45])), 901, 'galaxy'));
};
const sun = (S) => ({ scene, camera }) => {
  skyCamera(camera, sunDir.toArray());
  const { group, u } = windowOf(S, scene);
  const mesh = far(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), S.sunMaterial(u, 1000 * Math.tan((12 * Math.PI) / 180))), 902, 'sun');
  mesh.position.copy(sunDir).multiplyScalar(1000);
  group.add(mesh);
};
// a planet (Alderaan, with its relief and clouds) or a gas giant (Yavin), and its air
const body = (giant) => (S) => ({ scene, camera }) => {
  const at = new THREE.Vector3(0.1, -0.06, -1).normalize().multiplyScalar(1000);
  skyCamera(camera, at.toArray());
  const { group, u } = windowOf(S, scene);
  const size = { w: 256, h: 128 };
  const maps = giant ? { color: paintGiant('yavin', size) } : paintPlanet('alderaan', size);
  const own = giant ? { map: canvasTexture(maps.color, true), giant } : { map: canvasTexture(maps.color, true), normal: canvasTexture(maps.normal, false), rough: canvasTexture(maps.rough, false), clouds: maps.clouds ? canvasTexture(maps.clouds, true) : null };
  const r = 240;
  const mat = S.bodyMaterial(u, { air: giant ? [1, 0.72, 0.45] : [0.5, 0.68, 1], ...own });
  mat.uniforms.uDrift.value = 0.02;
  const mesh = far(new THREE.Mesh(new THREE.SphereGeometry(r, 64, 32), mat), 910, 'body');
  mesh.rotation.order = 'ZYX';
  mesh.rotation.set(0, 0.6, giant ? 0.12 : 0.4);
  mesh.position.copy(at);
  const halo = far(new THREE.Mesh(new THREE.SphereGeometry(r * 1.06, 64, 21), S.haloMaterial(u, { air: mat.uniforms.uAir, r })), 911, 'air');
  halo.position.copy(at);
  group.add(mesh, halo);
};
// the battle’s glows and flashes: one instanced draw of camera-facing quads, each its own colour
const flashes = (S) => ({ scene, camera }) => {
  camera.position.set(0, 0, 8);
  camera.lookAt(0, 0, 0);
  scene.background = new THREE.Color(0x000000);
  const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(2, 2), S.flashMaterial(), 6);
  const m = new THREE.Matrix4();
  const c = new THREE.Color();
  [
    [-2.5, 1, 0, 1.2, [4, 0.35, 0.25]],
    [0, 1.4, -1, 2, [0.35, 4, 0.45]],
    [2.4, 0.8, 0.5, 0.8, [3, 2.1, 1.2]],
    [-1.5, -1.5, 0, 1.6, [0.3, 0.7, 2]],
    [1.2, -1.2, -2, 2.4, [4, 2.6, 1.2]],
    [2.8, -2, 1, 0.6, [2.6, 0.75, 0.5]],
  ].forEach(([x, y, z, s, rgb], i) => {
    mesh.setMatrixAt(i, m.makeScale(s, s, s).setPosition(x, y, z));
    mesh.setColorAt(i, c.setRGB(...rgb));
  });
  mesh.frustumCulled = false;
  scene.add(mesh);
};
// a loaded ship’s own material lit by the view’s sun as well as the scene’s lights
const sunlit = (S) => ({ scene, camera }) => {
  const u = S.skyUniforms(new THREE.Vector3(-0.8, 0.5, 0.3).normalize(), SUN);
  const geo = new THREE.TorusKnotGeometry(1, 0.35, 120, 16);
  const colours = [];
  for (let i = 0; i < geo.attributes.position.count; i++) colours.push(0.55 + 0.2 * Math.sin(i * 0.05), 0.56, 0.6);
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
  scene.add(new THREE.Mesh(geo, S.sunlit(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.1 }), u)));
  camera.position.set(2.5, 1.5, 4);
  camera.lookAt(0, 0, 0);
};

// ── the rooms ──

const dark = (scene) => {
  scene.background = new THREE.Color(0x05070a);
};
// the tractor beam’s glow up its shaft (a haze, softened edge-on, its bands
// climbing) and the discs it lights, seen through from above
const glow = (R) => ({ scene, camera }) => {
  dark(scene);
  camera.position.set(0, 4, 9);
  camera.lookAt(0, 0, 0);
  const column = R.glowMaterial({ color: 0xa9cbff, base: -3, fall: 3, strength: 1.4, rim: true, top: 3, soft: 2 });
  column.uniforms.uTime.value = 3.7;
  scene.add(new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 8, 32, 1, true), column));
  const discs = R.glowMaterial({ color: 0x8fb6ff, base: -3, fall: 4, strength: 0.6, rim: false, axis: { x: 0, z: 0 }, radius: 3.5 });
  discs.uniforms.uTime.value = 3.7;
  for (const y of [-2, -0.5, 1]) {
    const disc = new THREE.Mesh(new THREE.CircleGeometry(3.5, 40).rotateX(-Math.PI / 2).translate(0, y, 0), discs);
    scene.add(disc);
  }
};
// light down a vent onto the water (a cone of haze) and a pool of it lying flat
const haze = (R) => ({ scene, camera }) => {
  dark(scene);
  camera.position.set(0, 1.5, 6);
  camera.lookAt(0, 0.5, 0);
  const shaft = R.hazeMaterial({ color: 0xd2dcb4, strength: 0.5 });
  shaft.uniforms.uTime.value = 5;
  scene.add(new THREE.Mesh(new THREE.CylinderGeometry(0.42, 1.4, 4, 20, 1, true).translate(0, 1, 0), shaft));
  const pool = R.hazeMaterial({ color: 0xe6eeff, strength: 0.6, flat: true });
  pool.uniforms.uTime.value = 5;
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(4, 2.5).rotateX(-Math.PI / 2).translate(0, -0.9, 0.5), pool));
};
const field = (kind) => (R) => ({ scene, camera }) => {
  dark(scene);
  camera.position.set(0.6, 0.4, 4.2);
  camera.lookAt(0, 0, 0);
  const m = R[kind]();
  m.uniforms.uTime.value = 12.5;
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(5, 3), m));
};
// the compactor’s murky water, its map repeated more along x than z (the
// tangent frame is the map’s, so an uneven repeat shows it), the dianoga’s
// rings off to one side
const water = (R) => ({ scene, camera }) => {
  camera.position.set(0, 2.2, 4);
  camera.lookAt(0, 0, -0.5);
  const n = 128;
  const map = new THREE.DataTexture(waterNormals(n, 3263827), n, n, THREE.RGBAFormat);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.magFilter = THREE.LinearFilter;
  map.minFilter = THREE.LinearMipmapLinearFilter;
  map.generateMipmaps = true;
  map.repeat.set(3.8, 1.6);
  map.needsUpdate = true;
  const { material, uniforms } = R.waterSurface({ name: 'ds-water', color: 0x3d3f20, roughness: 0.16, metalness: 0.1, emissive: 0x10130a, normalMap: map, normalScale: new THREE.Vector2(0.45, 0.45), transparent: true, opacity: 0.88, envMapIntensity: 1.2 });
  uniforms.uTime.value = 4;
  uniforms.uRipple.value.set(0.6, -0.4, 0.5);
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(10, 6).rotateX(-Math.PI / 2), material));
  const lamp = new THREE.PointLight(0xcbd9a6, 30, 11, 2);
  lamp.position.set(0.5, 2.5, -1);
  scene.add(lamp);
};
// the stars past a bay’s mouth, seen through it
const mouthStars = (R) => ({ scene, camera }) => {
  dark(scene);
  camera.position.set(0, 0, 0);
  camera.lookAt(0, 0, -1);
  const rand = seeded(1983);
  const n = 400;
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    pos.set(new THREE.Vector3(rand() * 2 - 1, rand() * 2 - 1, -1.2).normalize().multiplyScalar(380).toArray(), i * 3);
    const k = 0.22 + rand() ** 3 * 0.95;
    col.set([k, k * 0.92, k * 0.85], i * 3);
  }
  const points = R.starPoints(pos, col, canvasTexture(starSprite(32), true), { size: 2.2 });
  points.frustumCulled = false;
  scene.add(points);
};

// ── the fight and the duel ──

const quad = () => {
  const g = new THREE.InstancedBufferGeometry();
  g.setIndex([0, 1, 2, 0, 2, 3]);
  g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
  return g;
};
const each = (g, name, size, rows) => {
  g.setAttribute(name, new THREE.InstancedBufferAttribute(new Float32Array(rows.flat()), size));
  g.instanceCount = rows.length;
};
const fightCamera = (camera) => {
  camera.position.set(0, 1.4, 4.5);
  camera.lookAt(0, 1, 0);
};
// bolts' glows along their ways (one coming at you), sparks streaking, a muzzle flash
const glows = (F) => ({ scene, camera }) => {
  dark(scene);
  fightCamera(camera);
  const g = quad();
  each(g, 'aAt', 3, [[-1.2, 1.2, 0], [0.6, 1.6, -1], [1.4, 0.6, 0.5], [0, 0.4, 1], [-0.5, 0.8, 1.5]]);
  each(g, 'aDir', 3, [[1, 0.1, 0], [0.3, 0.2, 0.93], [0.7, 0.7, 0], [-0.8, 0.6, 0], [0, 0, 0]]);
  each(g, 'aSize', 2, [[0.45, 0.16], [0.45, 0.16], [0.08, 0.014], [0.06, 0.014], [0, 0.22]]);
  each(g, 'aColour', 3, [[1.6, 0.16, 0.08], [0.2, 1.5, 0.25], [4, 2.2, 0.9], [1.2, 0.25, 0.04], [3.2, 0.9, 0.5]]);
  const m = new THREE.Mesh(g, F.spriteMaterial());
  m.frustumCulled = false;
  scene.add(m);
};
// fire (adding light, covering a little) and smoke (covering) in one draw, premultiplied
const puffs = (F) => ({ scene, camera }) => {
  dark(scene);
  scene.background = new THREE.Color(0x3a4048);
  fightCamera(camera);
  const g = quad();
  each(g, 'aAt', 3, [[-0.6, 1, 0], [0.5, 1.2, -0.2], [0, 1.8, -0.5], [0.9, 0.6, 0.3]]);
  each(g, 'aShape', 4, [[0.6, 0.3, 4.1, 17.3], [0.8, 1.7, 22.5, 3.9], [1.1, 2.6, 9.4, 31.2], [0.5, 0.9, 13.7, 7.7]]);
  each(g, 'aColour', 4, [[5, 3.6, 2, 0.1], [2, 0.8, 0.2, 0.06], [0.05, 0.05, 0.055, 0.45], [0.03, 0.03, 0.035, 0.3]]);
  const m = new THREE.Mesh(g, F.puffMaterial());
  m.frustumCulled = false;
  scene.add(m);
};
// scorches on a wall, one still glowing, one cooled to soot
const scorches = (F) => ({ scene, camera }) => {
  scene.background = new THREE.Color(0x202428);
  camera.position.set(0, 1, 3);
  camera.lookAt(0, 1, 0);
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(6, 4).translate(0, 1, 0), new THREE.MeshStandardMaterial({ color: 0x8a9098, roughness: 0.8 })));
  const plane = new THREE.PlaneGeometry(1, 1);
  plane.setAttribute('aBurn', new THREE.InstancedBufferAttribute(new Float32Array([1, 1, 12.5, 0.3, 1, 33.1, 0, 0.6, 7.9]), 3));
  const mesh = new THREE.InstancedMesh(plane, F.scorchMaterial(), 3);
  const m = new THREE.Matrix4();
  [[-0.8, 1.2, 1.1], [0.5, 0.8, 0.8], [0.9, 1.6, 0.6]].forEach(([x, y, s], i) => mesh.setMatrixAt(i, m.makeScale(s, s, s).setPosition(x, y, 0.012)));
  mesh.frustumCulled = false;
  scene.add(mesh);
};
// a blade’s glow and core-line (one pointed at you), a ripple’s ring, and a trail behind a swing
const saber = (B) => ({ scene, camera }) => {
  dark(scene);
  fightCamera(camera);
  const g = quad();
  each(g, 'aAt', 3, [[-0.8, 1.2, 0], [0.6, 1.1, 0.4], [0.2, 1.5, -0.5]]);
  each(g, 'aDir', 3, [[0.4, 0.9, 0], [0.1, 0.1, 0.98], [0, 0, 0]]);
  each(g, 'aSize', 3, [[0.47, 0.15, 0], [0.47, 0.15, 0], [0, 0.6, 0.12]]);
  each(g, 'aColour', 3, [[2.6, 0.1, 0.06], [0.3, 1.1, 2.6], [0.05, 0.06, 0.08]]);
  const sprites = new THREE.Mesh(g, B.bladeGlowMaterial());
  sprites.frustumCulled = false;
  const trail = new THREE.BufferGeometry();
  const pos = [];
  const colour = [];
  const edge = [];
  const index = [];
  for (let q = 0; q < 6; q++) {
    const a = (q / 6) * 1.2 - 0.3;
    const b = ((q + 1) / 6) * 1.2 - 0.3;
    const at = (t, r) => [Math.sin(t) * r, 0.6 + Math.cos(t) * r, 0];
    pos.push(...at(a, 0.2), ...at(a, 1.1), ...at(b, 1.1), ...at(b, 0.2));
    for (let k = 0; k < 4; k++) colour.push(0.6 * (q + 1) * 0.15, 0.04, 0.02);
    edge.push(0, 1, 1, 0);
    index.push(q * 4, q * 4 + 1, q * 4 + 2, q * 4, q * 4 + 2, q * 4 + 3);
  }
  trail.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  trail.setAttribute('aColour', new THREE.Float32BufferAttribute(colour, 3));
  trail.setAttribute('aEdge', new THREE.Float32BufferAttribute(edge, 1));
  trail.setIndex(index);
  scene.add(sprites, new THREE.Mesh(trail, B.trailMaterial()));
};

// ── the shared twins ──

// a ship going up: the fireball, its shards and the ring, 0.3 s in
const blast = (E) => ({ scene, camera }) => {
  dark(scene);
  camera.position.set(0, 0.5, 6);
  camera.lookAt(0, 0, 0);
  const e = E.createExplosions({ parent: scene, pool: 2 });
  e.burst(new THREE.Vector3(0, 0, 0), 1.2, [0.4, 0.7, 1]);
  e.update(0.3);
};
// a uniform’s cloth dyed charcoal, its face and hands (warm) kept
const dye = (D) => ({ scene }) => {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  x.fillStyle = '#6b7046';
  x.fillRect(0, 0, 64, 64);
  x.fillStyle = '#4c5232';
  for (let i = 0; i < 64; i += 8) x.fillRect(0, i, 64, 3);
  x.fillStyle = '#c99a7a';
  x.fillRect(40, 0, 24, 20);
  const map = canvasTexture(c, true);
  const own = new THREE.MeshStandardMaterial({ map, roughness: 0.6 });
  scene.add(new THREE.Mesh(new THREE.TorusKnotGeometry(1, 0.38, 100, 16), D.dyed(own, { color: 0x2a2c30, roughness: 0.85, metalness: 0 })));
};

export default {
  'deathstar:sky:stars': pair(stars, SO, SN),
  'deathstar:sky:band': pair(band, SO, SN),
  'deathstar:sky:sun': pair(sun, SO, SN),
  'deathstar:sky:planet': pair(body(false), SO, SN),
  'deathstar:sky:giant': pair(body(true), SO, SN),
  'deathstar:sky:flashes': pair(flashes, SO, SN),
  'deathstar:sky:sunlit': pair(sunlit, SO, SN),
  'deathstar:rooms:glow': pair(glow, RO, RN),
  'deathstar:rooms:haze': pair(haze, RO, RN),
  'deathstar:rooms:bayField': pair(field('bayField'), RO, RN),
  'deathstar:rooms:ds2Field': pair(field('ds2Field'), RO, RN),
  'deathstar:rooms:water': pair(water, RO, RN),
  'deathstar:rooms:stars': pair(mouthStars, RO, RN),
  'deathstar:fx:glows': pair(glows, FO, FN),
  'deathstar:fx:puffs': pair(puffs, FO, FN),
  'deathstar:fx:scorches': pair(scorches, FO, FN),
  'deathstar:saber': pair(saber, BO, BN),
  'explosions': pair(blast, EO, EN),
  'dye': pair(dye, DO, DN),
};
