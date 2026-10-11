// The Rick and Morty cast's twins (src/components/rickmorty: toonNodes,
// meshyCastNodes, dressNodes, cruiser3dNodes), each case built once with
// the GLSL original and once with its twin. The cast and the cruiser are
// the site's own models (public/games/meshy), loaded the same on both sides.
import * as THREE from 'three';
import * as TO from '../../../src/components/rickmorty/portal/toon.js';
import * as TN from '../../../src/components/rickmorty/portal/toonNodes.js';
import * as MO from '../../../src/components/rickmorty/portal/meshyCast.js';
import * as MN from '../../../src/components/rickmorty/portal/meshyCastNodes.js';
import * as DO from '../../../src/components/rickmorty/wardrobe/dress.js';
import * as DN from '../../../src/components/rickmorty/wardrobe/dressNodes.js';
import * as CO from '../../../src/components/rickmorty/cruiser3d.js';
import * as CN from '../../../src/components/rickmorty/cruiser3dNodes.js';
import * as IO from '../../../src/lib/three/ink.js';
import * as IN from '../../../src/lib/three/inkNodes.js';
import { readLooks } from '../../../src/components/rickmorty/wardrobe/looks.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const pair = (make, O, N) => ({ node: make(N), classic: make(O) });

// a texture of stripes, as a Meshy texture is in sRGB: Morty's shirt
// yellow, skin, his trousers' blue, a white coat, a grey, Jesse's
// burnt-orange hoodie
const stripes = () => {
  const cols = [[243, 216, 75], [240, 200, 170], [60, 90, 170], [235, 235, 235], [110, 110, 110], [170, 75, 35]];
  const d = new Uint8Array(cols.length * 4);
  cols.forEach((c, i) => d.set([...c, 255], i * 4));
  const t = new THREE.DataTexture(d, cols.length, 1);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = t.minFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
};

// ── toon.js: the light steps on a few shapes, one of them toonified ──
const toon = (T) => ({ scene }) => {
  scene.add(new THREE.Mesh(new THREE.TorusKnotGeometry(0.9, 0.3, 80, 12), T.toon(0x66aa44)));
  const g = new THREE.Group();
  const glow = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x8899aa, name: 'window' }));
  glow.position.set(-1.8, 0, 0);
  const box = new THREE.Mesh(new THREE.SphereGeometry(0.7, 24, 16), new THREE.MeshStandardMaterial({ map: stripes() }));
  box.position.set(1.8, 0, 0);
  g.add(glow, box);
  T.toonify(g, { tint: 0xcc6633, mix: 0.3, glow: 0xffee88 });
  scene.add(g);
};

// ── meshyCast.js: a figure painted (the light ramp, the rim) and a Morty
// clone's shirt, on Morty himself ──
const cast = (M) => async ({ scene, camera }) => {
  camera.position.set(0, 1.1, 3.4);
  camera.lookAt(0, 0.95, 0);
  // (rigged, so each figure is a skinned clone of its own: in its bind pose,
  // as nothing here steps its animator)
  const c = M.createMeshyCast({ kinds: { mortyclone: M.MESHY.mortyclone, morty: M.MESHY.morty } });
  await c.load(null, ['morty'], { clips: [] });
  const a = c.make('mortyclone', 2);
  const b = c.make('morty');
  a.group.position.x = -0.55;
  b.group.position.x = 0.55;
  scene.add(a.group, b.group);
};

// ── dress.js: a look's colours on a texture, by zone and colour (Morty's
// blended zones; Jesse's one a triangle, his hips' weight read) ──
const dress = (D, I) => ({ scene, camera }) => {
  const piece = (body, colors, x, zone, lower) => {
    // (a card facing the eye, every stripe of the texture across it)
    const g = new THREE.PlaneGeometry(1.7, 1.7);
    const n = g.attributes.position.count;
    g.setAttribute('zone', new THREE.BufferAttribute(new Float32Array(n).fill(zone), 1));
    g.setAttribute('lower', new THREE.BufferAttribute(new Float32Array(n).fill(lower), 1));
    g.setAttribute('upper', new THREE.BufferAttribute(new Float32Array(n), 1));
    const m = D.recolor(I.rimToon(new THREE.MeshToonMaterial({ map: stripes() }), { color: 0xdff6ff, strength: 0.3 }), body, colors);
    const mesh = new THREE.Mesh(g, m);
    mesh.position.set(x, 0, 0);
    mesh.lookAt(camera.position);
    scene.add(mesh);
  };
  piece('morty', { inner: 'portalgreen', legs: 'labwhite' }, -1, 1, 0);
  piece('jesse', { outer: 'portalgreen', legs: 'bluesky' }, 1, 2, 0.8);
};

// ── cruiser3d.js: the glass dome on a toon saucer, and the whole cruiser,
// crew aboard, as the universe map builds it ──
const glass = (C, I) => ({ scene }) => {
  const body = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.SphereGeometry(1.2, 32, 24), I.rimToon(new THREE.MeshToonMaterial({ color: 0x99aabb })));
  body.add(hull);
  C.glassDome(body);
  scene.add(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), new THREE.MeshToonMaterial({ color: 0xcc3322 })), body);
};
const cruiser = (C) => async ({ scene, camera }) => {
  camera.position.set(0, 3.2, 5.5);
  camera.lookAt(0, 0, 0);
  const cr = await C.buildCruiser({ looks: readLooks(null) });
  if (!cr) throw new Error('the cruiser would not build');
  cr.group.rotation.y = 0.6;
  scene.add(cr.group);
  await wait(800); // (the crew sat and fitted under the glass)
};

export default {
  'rickmorty:toon': pair(toon, TO, TN),
  'rickmorty:cast': pair(cast, MO, MN),
  'rickmorty:dress': { node: dress(DN, IN), classic: dress(DO, IO) },
  'rickmorty:glass': { node: glass(CN, IN), classic: glass(CO, IO) },
  'rickmorty:cruiser': pair(cruiser, CO, CN),
};
