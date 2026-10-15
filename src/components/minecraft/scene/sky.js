// Minecraft, the sky, by the hour (rules/time.js has the game's sums): the
// biome's sky colour over the fog's at the horizon, both dimming to near
// black at night; the orange glow low toward the sun at sunrise and sunset;
// the pack's square sun on its east-to-west arc and the moon opposite in
// its eight phases; the stars (1500 of them, as the game scatters them)
// fading in as the sky darkens; and the cloud layer at y = 128 from the
// pack's cloud map, a texel to a 12-block cell, drifting 0.03 blocks a tick
// and greying at night as the game's do. Everything follows the camera,
// drawn first, behind the terrain.

import * as THREE from 'three';
import { seeded } from '../../../lib/seeded.js';
import { instancedBufferAttribute } from 'three/tsl';
import { cloudMaterial as cloudLook, domeMaterial, spriteMaterial, starsMaterial } from './nodes.js';
import { moonPhase, skyColours, starBrightness, sunAngle, sunrise } from '../rules/time.js';

const CLOUDS_Y = 128;
const SUN_DISTANCE = 300;
const SUN_SIZE = 90; // the game's 30 at 100
const MOON_SIZE = 60; // the game's 20 at 100

// The game's sky colour for a biome's temperature (0.8 for plains), as an
// [r, g, b] in 0–1.
export function skyColour(temperature = 0.8) {
  const f = Math.max(-1, Math.min(1, temperature / 3));
  return hsb(0.6222222 - f * 0.05, 0.5 + f * 0.1, 1);
}
function hsb(h, s, v) {
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][((i % 6) + 6) % 6];
}

export function createSky(scene, { sun, moon, clouds }) {
  const sky = new THREE.Vector3(...skyColour());
  const fog = new THREE.Vector3();
  const group = new THREE.Group();
  group.name = 'sky';
  scene.add(group);
  let distance = 10;

  const domeLook = domeMaterial({ fog });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(500, 24, 12), domeLook.material);
  dome.renderOrder = -4;
  dome.frustumCulled = false;
  group.add(dome);

  // the stars: 1500 points on a sphere, a seeded scatter so they're the same each night
  const rand = seeded(10842);
  const pts = [];
  for (let i = 0; i < 1500; i++) {
    const u = rand() * 2 - 1;
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(1 - u * u);
    pts.push(r * Math.cos(a) * 400, u * 400, r * Math.sin(a) * 400);
  }
  // (a sprite drawn once a star, two pixels across: nodes.js's starsMaterial says why not points)
  const starLook = starsMaterial();
  starLook.material.positionNode = instancedBufferAttribute(new THREE.InstancedBufferAttribute(new Float32Array(pts), 3));
  const stars = new THREE.Sprite(starLook.material);
  stars.count = pts.length / 3;
  stars.renderOrder = -3;
  stars.frustumCulled = false;
  group.add(stars);

  const sprite = (map, size) => {
    const look = spriteMaterial(map);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), look.material);
    m.userData.u = look.u;
    m.renderOrder = -2;
    m.frustumCulled = false;
    m.visible = Boolean(map);
    group.add(m);
    return m;
  };
  const sunMesh = sprite(sun, SUN_SIZE);
  const moonMesh = sprite(moon, MOON_SIZE);

  const { material: cloudMaterial, u: cloudU } = cloudLook({ map: clouds, fog });
  if (clouds) {
    clouds.wrapS = clouds.wrapT = THREE.RepeatWrapping;
    clouds.needsUpdate = true;
  }
  const cloudPlane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), cloudMaterial);
  cloudPlane.renderOrder = 3;
  cloudPlane.frustumCulled = false;
  cloudPlane.visible = Boolean(clouds);
  group.add(cloudPlane);

  const dir = new THREE.Vector3();
  return {
    fog,
    // the time of day in ticks, the camera, the render distance in blocks, the ticks for the clouds' drift
    update(time, camera, far, ticks) {
      const c = skyColours(time, [sky.x, sky.y, sky.z], distance);
      domeLook.u.sky.value.set(...c.sky);
      fog.set(...c.fog);
      const glow = sunrise(time);
      domeLook.u.glow.value.set(...(glow ?? [0, 0, 0, 0]));
      dome.position.copy(camera.position);
      stars.position.copy(camera.position);
      starLook.u.strength.value = starBrightness(time);
      // the sky turns about the north–south axis: the sun up in the east, down in the west
      const a = sunAngle(time);
      dir.set(-Math.sin(a), Math.cos(a), 0);
      stars.rotation.z = a;
      domeLook.u.sunDir.value.copy(dir);
      sunMesh.position.copy(camera.position).addScaledVector(dir, SUN_DISTANCE);
      sunMesh.lookAt(camera.position);
      moonMesh.position.copy(camera.position).addScaledVector(dir, -SUN_DISTANCE);
      moonMesh.lookAt(camera.position);
      // the moon's picture is four by two phases
      const phase = moonPhase(time);
      moonMesh.userData.u.frame.value.set((phase % 4) / 4, Math.floor(phase / 4) / 2, 0.25, 0.5);
      // clouds grey with the night, as the game's
      const f = Math.max(0, Math.min(1, Math.cos(a) * 2 + 0.5));
      cloudU.tint.value.set(f * 0.9 + 0.1, f * 0.9 + 0.1, f * 0.85 + 0.15);
      const size = Math.max(far * 2.2, 400);
      cloudPlane.scale.set(size, 1, size);
      cloudPlane.position.set(camera.position.x, CLOUDS_Y, camera.position.z);
      cloudU.offset.value.set(ticks * 0.03, 0);
      cloudU.far.value = size / 2;
    },
    setFog(n) {
      distance = n;
    },
    dispose() {
      scene.remove(group);
      for (const m of [dome, sunMesh, moonMesh, cloudPlane]) {
        m.geometry.dispose();
        m.material.dispose();
      }
      // (a sprite's quad is every sprite's: only the stars' material goes)
      stars.material.dispose();
    },
  };
}
