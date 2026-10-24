// Bird World ("Rickdependence Spray"'s and "Auto Erotic Assimilation"'s
// Birdperson): a planet of tall tan clay towers grown round trees, each
// under a flat umbrella canopy like an acacia's, in long golden-green grass
// with teal crystals coming up through it and glowing pods hanging from the
// branches; Birdperson's tower-house (Meshy) at the end of a path of flat
// stones, Birdperson at his door until the wedding (Phoenixperson after it,
// as the show has it), and Unity on a visit. The two clay towers in the
// clearing are climbed (./claytowers.js): each drawn as the walker has it, a
// column to its top with a flight of clay drums round it, three of them
// cracked and crumbling (the stage wobbles and slumps each such stair as its
// mood has it: ../games/climb.js); five crystals to pick up turn where they
// grow, one on each top, gone once picked up (`S.picked()`) or the task done.

import * as THREE from 'three';
import { BALL } from '../interiors/shell';
import { mergeParts } from '../kit';
import { CLAY_TOWERS } from './claytowers';
import { specks, stage } from './stage';

const LIGHT = { sun: [0xfff8d8, 1.7], hemi: [0xd8f2c8, 0x4a5a2a, 1.3], fog: [0xd2ecc8, 60, 320] };
const CLAY = 0xd8b88a;
const CLAY_DARK = 0xb8946a;
const CLAY_TOP = 0xe8cca0;
const LEAF = 0xb8d88a;
const PICKS = ['bcrystal-path', 'bcrystal-trees', 'bcrystal-east', 'bcrystal-west', 'bcrystal-grass'];

export async function buildBirdworld(kit) {
  const S = stage(kit, 'birdworld', { ground: specks('#8aa83a', ['#7a9a32', '#9ab84a', '#a8c45a', '#6a8a2a'], 53), groundTile: 6 });
  const { R, P } = S;

  // Birdperson's house, at the end of the path
  S.figure('birdperson-house', { x: P(0, -16)[0], z: P(0, -16)[1], face: -Math.PI / 2, h: 14 });
  for (let i = 0; i < 9; i++) R.frame(...P(Math.sin(i * 0.9) * 0.8, 14 - i * 2.8), i * 0.7, { list: 'fixed' }).cyl(i % 2 ? 0xc8b48a : 0xb8a47a, 0, 0, 0, 0.7, 0.05);

  // a clay tower of the city round a tree, `h` tall, under its canopy
  const tower = (dx, dz, h, r) => {
    const f = R.frame(...P(dx, dz), dx * 0.2, { list: 'fixed' });
    for (let k = 0, y = 0; k < 4; k++) {
      const seg = h / 4;
      f.cyl(k % 2 ? CLAY : CLAY_DARK, Math.sin(k) * 0.3, y, Math.cos(k) * 0.3, r * (1 - k * 0.12), seg);
      // round windows, dark, on the side facing the path
      for (const a of [0.3, -0.5]) f.cyl(0x3a2a1a, Math.sin(a) * r * (1 - k * 0.12), y + seg * 0.5, Math.cos(a) * r * (1 - k * 0.12), 0.35, 0.12, Math.PI / 2);
      y += seg;
    }
    f.cyl(0x7a5a3a, 0, h, 0, 0.5, 3).ball(LEAF, 0, h + 3.2, 0, r * 2.4, 0.12).ball(0xa8c87a, 0, h + 3.4, 0, r * 2, 0.1);
  };
  // the clearing's two, climbed: each a straight column to its top, the
  // tree it's grown round out through it and its canopy well over a climber's
  // head, and its flight of drums, each a column from the ground with a pale
  // lip; the crumbling ones cracked, each stair a group of its own the stage
  // poses (its pivot on the ground under the treads' middle)
  const solid = (id) => CLAY_TOWERS.solids.find((o) => o.id === id);
  for (const [id, wide] of [
    ['tower-a', 3],
    ['tower-b', 3.4],
  ]) {
    const o = solid(id);
    const f = R.frame(...P(o.dx, o.dz), o.dx * 0.2);
    for (let k = 0; k < 4; k++) {
      f.cyl(k % 2 ? CLAY : CLAY_DARK, 0, (o.top * k) / 4, 0, o.r, o.top / 4);
      for (const a of [0.3, -0.5]) f.cyl(0x3a2a1a, Math.sin(a) * o.r, (o.top * (k + 0.5)) / 4, Math.cos(a) * o.r, 0.3, 0.12, Math.PI / 2);
    }
    f.cyl(CLAY_TOP, 0, o.top - 0.06, 0, o.r + 0.05, 0.06);
    f.cyl(0x7a5a3a, 0, o.top, 0, 0.4, 6).ball(LEAF, 0, o.top + 6, 0, wide * 2.4, 0.12).ball(0xa8c87a, 0, o.top + 6.2, 0, wide * 2, 0.1);
  }
  const crumbling = new Map(CLAY_TOWERS.stairs.flatMap((st) => st.steps.map((d) => [d, st.id])));
  const drum = (f, o, cracked) => {
    f.cyl(cracked ? CLAY_DARK : CLAY, 0, 0, 0, o.r, o.top - 0.08).cyl(cracked ? CLAY_DARK : CLAY_TOP, 0, o.top - 0.08, 0, o.r, 0.08);
    if (cracked) for (const a of [0.4, 2.3, 4.1]) f.box(0x4a3424, Math.cos(a) * o.r, o.top * 0.3, Math.sin(a) * o.r, 0.05, o.top * 0.6, 0.05, -a);
  };
  for (const o of CLAY_TOWERS.solids.filter((s) => /-\d+$/.test(s.id) && !crumbling.has(s.id))) drum(R.frame(...P(o.dx, o.dz), 0), o, false);
  const stairs = {};
  for (const st of CLAY_TOWERS.stairs) {
    const treads = st.steps.map(solid);
    const mx = treads.reduce((a, o) => a + o.dx, 0) / treads.length;
    const mz = treads.reduce((a, o) => a + o.dz, 0) / treads.length;
    const parts = [];
    for (const o of treads) drum(R.frame(o.dx - mx, o.dz - mz, 0, { list: parts }), o, true);
    const g = new THREE.Group();
    const [gx, gz] = P(mx, mz);
    g.position.set(gx, 0, gz);
    const mesh = new THREE.Mesh(R.own(mergeParts(parts)), kit.mats.toon(0xffffff, { vertexColors: true }));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    g.add(mesh);
    R.add(g);
    stairs[st.id] = g;
  }
  S.climb({ stairs });
  // and the city's beyond the box, hazy
  for (const [dx, dz, h, r] of [
    [-55, -95, 30, 6],
    [-18, -120, 40, 7],
    [26, -110, 34, 6],
    [70, -80, 26, 5],
    [95, -20, 22, 5],
    [-95, -10, 24, 5],
  ])
    tower(dx, dz, h, r);

  // umbrella trees round the clearing
  const tree = (dx, dz, h, list = 'solid') => {
    const f = R.frame(...P(dx, dz), dx, { list });
    f.cyl(0x6a4a2a, 0, 0, 0, 0.45, h).cyl(0x6a4a2a, 0.8, h * 0.7, 0, 0.18, h * 0.3, 0, -0.5).ball(LEAF, 0, h + 0.4, 0, 4.2, 0.18).ball(0x9ac86a, 0.6, h + 0.7, 0.4, 3.2, 0.16);
    // pods hanging from it, glowing orange
    for (const [u, v] of [
      [1.8, 0.6],
      [-1.4, 1.2],
      [0.4, -1.8],
    ])
      f.cyl(0x5a7a2a, u, h - 1.1, v, 0.02, 1.1).glow(BALL, 0xffb84a, 1.6, u, h - 1.3, v, 0, 0.32, 0.5, 0.32);
  };
  tree(-16, 10, 6.5);
  tree(18, 6, 7);
  for (const [dx, dz, h] of [
    [-30, -2, 8],
    [30, -4, 7.5],
    [-28, 18, 6],
    [28, 20, 7],
    [8, 26, 6],
  ])
    tree(dx, dz, h, 'fixed');

  // teal crystals, a cluster by the path and more about
  const shard = R.own(new THREE.ConeGeometry(0.5, 1, 5));
  const crystals = (dx, dz, n, s) => {
    const f = R.frame(...P(dx, dz), dx + dz, { list: 'fixed' });
    for (let i = 0; i < n; i++) {
      const a = i * 2.4;
      f.glow(shard, i % 2 ? 0x7af2e8 : 0x4ad8d0, 1.2, Math.cos(a) * 0.5 * s, 0.4 * s * (1 + (i % 3) * 0.4), Math.sin(a) * 0.5 * s, a, 0.32 * s, 0.8 * s * (1 + (i % 3) * 0.5), 0.32 * s, Math.cos(a) * 0.2, Math.sin(a) * 0.2);
    }
  };
  crystals(-12, 6, 7, 1.4);
  for (const [dx, dz, n] of [
    [-6, -4, 3],
    [14, -8, 5],
    [-4, 20, 3],
  ])
    crystals(dx, dz, n, 1);
  // the five to pick up, each a cluster of its own (one draw each), turning
  // slowly where it grows, on the ground or up on its tower's top
  const cluster = [];
  for (let i = 0; i < 3; i++) {
    const a = i * 2.1;
    cluster.push({ geo: shard, color: i % 2 ? 0x8af8f0 : 0x5ae2da, matrix: new THREE.Matrix4().compose(new THREE.Vector3(Math.cos(a) * 0.22, 0.4 * (1 + i * 0.3), Math.sin(a) * 0.22), new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.cos(a) * 0.25, a, Math.sin(a) * 0.25)), new THREE.Vector3(0.32 * 1.6, 0.8 * 1.6 * (1 + i * 0.3), 0.32 * 1.6)) });
  }
  const gem = R.own(mergeParts(cluster));
  const gemMat = R.own(new THREE.MeshBasicMaterial({ vertexColors: true }));
  const picks = PICKS.map((id) => {
    const h = S.d.hotspots.find((o) => o.id === id);
    const m = new THREE.Mesh(gem, gemMat);
    m.position.set(h.x, h.y ?? 0, h.z);
    R.add(m, { ink: false });
    return [id, m];
  });
  // long grass in tufts, thin blades leaning out
  const blade = R.own(new THREE.ConeGeometry(0.07, 1, 3));
  for (let i = 0; i < 110; i++) {
    const dx = ((i * 47) % 64) - 32;
    const dz = ((i * 31) % 46) - 23;
    if (Math.abs(dx) < 3 && dz > -12) continue;
    const f = R.frame(...P(dx, dz), i, { list: 'fixed' });
    for (let k = 0; k < 5; k++) f.part(blade, [0xa8c45a, 0x7a9a32, 0xc8d46a][(i + k) % 3], Math.cos(k * 1.3) * 0.16, 0.35 + (k % 2) * 0.1, Math.sin(k * 1.3) * 0.16, 0, 1, 0.7 + (k % 3) * 0.25, 1, Math.cos(k * 1.3) * 0.3, Math.sin(k * 1.3) * 0.3);
  }

  S.people();
  return S.done(LIGHT, (t, dt, state) => {
    const done = (state?.done ?? []).includes('birdworld');
    const picked = S.picked();
    for (const [id, m] of picks) {
      m.visible = !done && !picked.includes(id);
      m.rotation.y = 0.6 * t;
    }
  });
}
