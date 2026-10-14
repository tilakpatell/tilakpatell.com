// The Mario 64 tribute’s twins (src/components/mario64/nodes.js and the
// look’s chain, looks.js): the terrain’s splat, a painting mid-ripple, the
// waterfall’s streaks and the finished picture’s bloom, each built once with
// the GLSL original (glsl.js, which the world no longer imports) and once
// with its twin. The splat reads the game’s own sets from public/hq.
import * as THREE from 'three';
import * as O from '../../../src/components/mario64/glsl.js';
import * as N from '../../../src/components/mario64/nodes.js';
import { makeLook as chainLook } from '../../../src/components/mario64/looks.js';
import { buildPostProcessing } from '../../../src/runtime/webgpu.js';

// a hill and a valley, its splat as the kit paints one: rock where it is
// steep, the path in a band across, grass the rest; the uv the kit's, x and
// z over the grass's scale (520 units, 5.2 m), seen from where Lakitu might
const terrain = () => {
  const g = new THREE.PlaneGeometry(40, 40, 96, 96).rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, Math.max(0, 9 - Math.hypot(p.getX(i) - 6, p.getZ(i) + 6)) * 1.6 + Math.sin(p.getX(i) * 0.3) * 0.8);
  g.computeVertexNormals();
  const n = g.attributes.normal;
  const uv = g.attributes.uv;
  const splat = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    uv.setXY(i, p.getX(i) / 5.2, p.getZ(i) / 5.2);
    const rock = Math.min(1, Math.max(0, (1 - n.getY(i)) * 3));
    const path = Math.abs(p.getZ(i) - 4) < 2.5 ? 1 - rock : 0;
    splat.set([Math.max(0, 1 - rock - path), rock, path], i * 3);
  }
  g.setAttribute('splat', new THREE.BufferAttribute(splat, 3));
  return g;
};
const splat = (make) => async ({ scene, camera }) => {
  camera.position.set(0, 14, 26);
  camera.lookAt(0, 2, 0);
  scene.fog = new THREE.Fog('#cfe3ff', 20, 80);
  scene.add(new THREE.Mesh(terrain(), await make(['grass', 'rock', 'path'], false)));
};

// a painting's picture: a sky, a hill, a sun (as things.js paints one)
const picture = () => {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const sky = g.createLinearGradient(0, 0, 0, 128);
  sky.addColorStop(0, '#5ab0ff');
  sky.addColorStop(1, '#d8f0ff');
  g.fillStyle = sky;
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#3f9a3a';
  g.beginPath();
  g.ellipse(64, 128, 100, 50, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#ffd94a';
  g.beginPath();
  g.arc(96, 32, 14, 0, Math.PI * 2);
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
};
// mid-ripple, seen at a slant so the push along its z shows
const painting = (make) => ({ scene, camera }) => {
  camera.position.set(4.5, 1.5, 6);
  camera.lookAt(0, 0, 0);
  const { material, uniforms } = make(picture());
  uniforms.uRipple.value = 0.8;
  uniforms.uTime.value = 1.3;
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(7, 7, 48, 48), material));
};

// the sheet in front of a rock face (its glass shows what is behind), in
// the grounds' fog, so the streaks are added to what the fog left
const waterfall = (make) => ({ scene, camera }) => {
  camera.position.set(0, 4, 9);
  camera.lookAt(0, 4, 0);
  scene.fog = new THREE.Fog('#cfe3ff', 6, 30);
  const rock = new THREE.Mesh(new THREE.BoxGeometry(6, 10, 0.5), new THREE.MeshStandardMaterial({ color: '#77705f', roughness: 0.9 }));
  rock.position.set(0, 4, -1.5);
  scene.add(rock);
  const { material, uniforms } = make();
  uniforms.uTime.value = 0.7;
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(3, 8), material);
  sheet.position.y = 4;
  scene.add(sheet);
};

// The finished picture: a lit white wall over the bloom's threshold, a
// glowing star well over it and a dark floor under it, through each look
// with the world's Neutral at 1.05 (module.js's; the page's renderers are
// ACES, put back after each frame)
const neutral = (renderer, draw) => {
  const was = [renderer.toneMapping, renderer.toneMappingExposure];
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.05;
  draw();
  [renderer.toneMapping, renderer.toneMappingExposure] = was;
};
const glowing = (scene, camera) => {
  camera.position.set(0, 1.5, 6);
  camera.lookAt(0, 1, 0);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 12).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#2a2f38', roughness: 0.8 }));
  const wall = new THREE.Mesh(new THREE.BoxGeometry(3, 2, 0.3), new THREE.MeshStandardMaterial({ color: '#fff1dc', roughness: 0.6 }));
  wall.position.set(-1.2, 1, -1);
  const star = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 3.2, 1) }));
  star.position.set(1.4, 1.4, 0);
  scene.add(floor, wall, star);
};
const lookNode = async ({ scene, camera, renderer }) => {
  glowing(scene, camera);
  const look = chainLook((passes) => buildPostProcessing(renderer, passes), scene, camera);
  await look.ready;
  return { render: () => neutral(renderer, () => look.render()) };
};
const lookClassic = ({ scene, camera, renderer }) => {
  glowing(scene, camera);
  const look = O.makeLook(renderer, scene, camera);
  look.setSize(256, 256);
  return { render: () => neutral(renderer, () => look.render()) };
};

export default {
  'mario64:splat': { node: splat(N.splatMaterial), classic: splat(O.splatMaterial) },
  'mario64:painting': { node: painting(N.paintingMaterial), classic: painting(O.paintingMaterial) },
  'mario64:waterfall': { node: waterfall(N.waterfallMaterial), classic: waterfall(O.waterfallMaterial) },
  'mario64:look': { node: lookNode, classic: lookClassic },
};
