// The galaxy’s level areas (galaxy/levelArea.js against galaxy/nodes/levelArea.js):
// Kamino’s Starfighter Assault low over Tipoca City’s sea (its sky the
// level’s panorama, horizon to zenith, the storm’s fog over the sea and on
// what’s inside), the same struck by lightning, and a space level’s star
// field round the whole dome (Fondor’s, the droid battleship’s). The
// panorama is drawn here (the level’s sky.webp is the bucket’s), the light
// records and the stages’ area options are the site’s own.
import * as THREE from 'three';
import * as AO from '../../../src/components/galaxy/levelArea.js';
import * as AN from '../../../src/components/galaxy/nodes/levelArea.js';
import { LIGHTS } from '../../../src/data/bf2017/light/index.js';
import KAMINO from '../../../src/data/bf2017/maps/sb_kamino.stages.json';
import FONDOR from '../../../src/data/bf2017/maps/sb_fondor.stages.json';

const METRES = 53.3;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// a storm’s panorama (or a star field): bands of cloud, a brighter rift, stars where `stars`
const panorama = (stars) => {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, stars ? '#05070d' : '#5a6e80');
  gr.addColorStop(1, stars ? '#0d1220' : '#1c2a36');
  g.fillStyle = gr;
  g.fillRect(0, 0, 512, 256);
  let s = 7;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < (stars ? 500 : 60); i++) {
    g.fillStyle = stars ? `rgba(255,${200 + r() * 55},${180 + r() * 75},${0.4 + r() * 0.6})` : `rgba(${120 + r() * 60},${140 + r() * 60},${160 + r() * 60},0.25)`;
    const w = stars ? 1 + r() * 1.5 : 30 + r() * 120;
    g.fillRect(r() * 512, r() * 256, w, stars ? w : 8 + r() * 20);
  }
  return c.toDataURL('image/png');
};

// the stages’ area as spaceLevel.js hands it to createLevelArea, laid at [0, 0, 0]
const optsOf = (stages, sky) => {
  const a = stages.area;
  const frame = (p) => p.map((x, k) => (x - stages.origin[k]) / METRES);
  return {
    at: [0, 0, 0],
    radius: a.radius / METRES,
    sea: a.sea === null ? null : frame([0, a.sea, 0])[1],
    sky: { ...a.sky, url: sky },
    fog: a.fog ? { ...a.fog, density: a.fog.density * METRES } : null,
    light: a.light ? (LIGHTS[a.light] ?? null) : null,
    fill: a.fill ?? null,
    probe: a.probe ? (LIGHTS[a.probe] ?? null) : null,
    metres: METRES,
  };
};

const area = (L, stages, { stars = false, flash = 0, eye, to }) => async ({ scene, camera }) => {
  camera.position.set(...eye);
  camera.lookAt(...to);
  camera.fov = 70;
  camera.far = 400;
  camera.updateProjectionMatrix();
  const a = L.createLevelArea(scene, optsOf(stages, panorama(stars)));
  // (something inside, under the storm’s fog)
  const box = new THREE.Mesh(new THREE.BoxGeometry(6, 14, 6), new THREE.MeshStandardMaterial({ color: 0x8090a0 }));
  box.position.set(4, -12, -30);
  scene.add(box);
  await wait(500); // (the panorama loads)
  a.update(camera, 12.5, 1 / 60);
  for (const part of ['level-area-sky', 'level-area-sea']) {
    const m = a.group.getObjectByName(part);
    if (m) m.material.uniforms.uFlash.value = flash;
  }
};
const pair = (stages, o) => ({ node: area(AN, stages, o), classic: area(AO, stages, o) });

export default {
  'galaxy:levelArea:kamino': pair(KAMINO, { eye: [0, -15, 0], to: [0, -18, -40] }),
  'galaxy:levelArea:kamino-up': pair(KAMINO, { eye: [0, -15, 0], to: [20, 10, -40] }),
  'galaxy:levelArea:kamino-flash': pair(KAMINO, { flash: 0.7, eye: [0, -15, 0], to: [-10, -12, -40] }),
  'galaxy:levelArea:fondor': pair(FONDOR, { stars: true, eye: [0, 0, 0], to: [10, 30, -40] }),
};
