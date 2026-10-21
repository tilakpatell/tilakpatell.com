// Planet Squanch ("The Wedding Squanchers"): red grass under a teal sky with
// a ringed planet low over it, Squanchy's cat-tree house (Meshy) and two
// more like it, built here, suckulents in fat teal clumps, and the wedding:
// a white arch of flowers, two blocks of white chairs with the aisle between,
// lanterns, and the long table where the toast is given. Raised (the area's
// 'raid'), Federation portals open round the arch, Gromflomite agents step
// out, the arch goes over and the guests are gone; the wedding stays over
// once Morty's got away (the `squanch` thing done).

import * as THREE from 'three';
import { BALL } from '../interiors/shell';
import { specks, stage } from './stage';

const LIGHT = { sun: [0xfff0d8, 1.6], hemi: [0xbfefe8, 0x6a2a2a, 1.25], fog: [0x9adcd2, 60, 300] };
const SISAL = 0xcdb68a;
const CARPET = 0xd8c8a8;
const BROWN = 0x8a6a4a;

// a cat tree, `h` tall: posts wrapped in rope, round carpeted platforms, a den on top
function catTree(R, x, z, turn, h = 7) {
  const f = R.frame(x, z, turn);
  const k = h / 7;
  f.cyl(CARPET, 0, 0, 0, 2.4 * k, 0.35 * k);
  for (const [u, v, top] of [
    [0, 0, 6],
    [1.3, 0.6, 3.2],
    [-1.2, -0.7, 4.6],
  ])
    f.cyl(SISAL, u * k, 0, v * k, 0.3 * k, top * k);
  for (const [u, v, y, r, c] of [
    [1.3, 0.6, 3.2, 1.3, CARPET],
    [-1.2, -0.7, 4.6, 1.2, BROWN],
    [0, 0, 2, 1.8, BROWN],
  ])
    f.cyl(c, u * k, y * k, v * k, r * k, 0.25 * k);
  // the den at the top, its round door facing out
  f.cyl(CARPET, 0, 6 * k, 0, 1.1 * k, 1.4 * k).cyl(BROWN, 0, 7.4 * k, 0, 1.15 * k, 0.12 * k).cyl(0x3a2a1a, 0, 6.7 * k, 1.02 * k, 0.45 * k, 0.1 * k, Math.PI / 2);
  // toys on strings
  for (const [u, v, y, c] of [
    [1.9, 1.2, 3.2, 0xe84a4a],
    [-1.8, -1.4, 4.6, 0x4aa8e8],
  ])
    f.cyl(0xf6f2e6, u * k, (y - 1) * k, v * k, 0.01, 1 * k).ball(c, u * k, (y - 1.05) * k, v * k, 0.18 * k);
}

export async function buildSquanch(kit) {
  const S = stage(kit, 'squanch', { ground: specks('#b83a3a', ['#a83232', '#c84a42', '#d85a4a', '#9a2c2c'], 31), groundTile: 6 });
  const { R, P } = S;

  // the ringed planet, low in the sky
  const [px, pz] = P(-110, -260);
  const far = R.frame(px, pz, 0.3, { list: 'fixed' });
  far.ball(0xd88a5a, 0, 95, 0, 28).ball(0xe8a070, 5, 102, 11, 18, 0.4);
  far.part(R.own(new THREE.TorusGeometry(1, 0.04, 4, 64)), 0xf2d8b0, 0, 95, 0, 0, 48, 48, 12, 1.25);

  // Squanchy's house, and two more of the street's
  S.figure('squanchy-house', { x: P(-14, -14)[0], z: P(-14, -14)[1], face: -Math.PI / 2 + 0.4, h: 9 });
  catTree(R, ...P(22, -14), -0.5, 7.5);
  catTree(R, ...P(-25, 4), 1.2, 6.5);

  // the suckulents: fat teal leaves in clumps, all round the edges
  const clump = (dx, dz, s) => {
    const f = R.frame(...P(dx, dz), dx * 0.7);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      f.ball(i % 2 ? 0x3aa8a0 : 0x2a8a84, Math.cos(a) * 0.45 * s, 0.35 * s, Math.sin(a) * 0.45 * s, 0.4 * s, 1.5);
    }
    f.ball(0x6ad2c0, 0, 0.6 * s, 0, 0.3 * s, 1.3).ball(0xd84a6a, 0, 0.95 * s, 0, 0.12 * s);
  };
  clump(-19, 11, 1.4);
  for (const [dx, dz, s] of [
    [-28, -8, 1.1],
    [27, 2, 1.2],
    [-8, 19, 0.9],
    [28, 17, 1],
    [-30, 16, 1.3],
    [14, 20, 0.8],
  ])
    clump(dx, dz, s);

  // the red grass in tufts, blades of three reds
  const blade = R.own(new THREE.ConeGeometry(0.06, 1, 3));
  for (let i = 0; i < 90; i++) {
    const dx = ((i * 47) % 66) - 33;
    const dz = ((i * 31) % 46) - 23;
    if (Math.abs(dx - 8) < 9 && dz > -16 && dz < 2) continue;
    const f = R.frame(...P(dx, dz), i, { list: 'fixed' });
    for (let k = 0; k < 4; k++) f.part(blade, [0x8a2222, 0xc84a42, 0xa83232][(i + k) % 3], Math.cos(k * 1.7) * 0.14, 0.25 + (k % 2) * 0.08, Math.sin(k * 1.7) * 0.14, 0, 1, 0.5 + (k % 3) * 0.15, 1, Math.cos(k) * 0.25, Math.sin(k) * 0.25);
  }

  // the wedding: two blocks of white chairs facing the arch, the aisle between
  for (const [x0, x1] of [
    [1.2, 4.4],
    [7.6, 10.8],
  ])
    for (let dz = -8; dz <= -2.5; dz += 1.4)
      for (let dx = x0; dx <= x1; dx += 0.8) {
        const c = R.frame(...P(dx, dz), 0, { list: 'fixed' });
        c.box(0xf6f2ea, 0, 0.42, 0, 0.5, 0.06, 0.48).box(0xf6f2ea, 0, 0.45, -0.22, 0.5, 0.5, 0.05);
        for (const [u, v] of [
          [-0.21, -0.2],
          [0.21, -0.2],
          [-0.21, 0.2],
          [0.21, 0.2],
        ])
          c.box(0xf6f2ea, u, 0, v, 0.04, 0.42, 0.04);
      }
  // the long table, a white cloth, glasses and the cake
  const tb = R.frame(...P(16, -3.4), 0);
  tb.box(0xf6f2ea, 0, 0, 0, 5, 0.78, 1.2).box(0xe8e2d6, 0, 0.78, 0, 5.1, 0.04, 1.3);
  for (let i = 0; i < 8; i++) tb.cyl(0xd8eef2, -2.1 + i * 0.6, 0.82, 0.3, 0.05, 0.18);
  tb.cyl(0xf6e8f0, 1.6, 0.82, -0.1, 0.36, 0.3).cyl(0xf6e8f0, 1.6, 1.12, -0.1, 0.26, 0.26).cyl(0xf6e8f0, 1.6, 1.38, -0.1, 0.16, 0.22).ball(0xd84a6a, 1.6, 1.64, -0.1, 0.06);
  // lanterns round the wedding
  for (const [dx, dz] of [
    [0, -10],
    [12, -10],
    [0, 0],
    [12, 0],
    [19, -6],
  ])
    R.frame(...P(dx, dz), 0).box(0x5a3a2a, 0, 0, 0, 0.12, 2.8, 0.12).glow(BALL, 0xffd890, 1.7, 0, 2.9, 0, 0, 0.36);

  // the arch of flowers, its own group so the raid can knock it over
  const arch = new THREE.Group();
  const white = kit.mats.toon(0xf6f2ea);
  const flower = [kit.mats.toon(0xf6d2e0), kit.mats.toon(0xffffff), kit.mats.toon(0xe8a0c0)];
  const post = R.own(new THREE.CylinderGeometry(0.12, 0.12, 2.6, 8));
  for (const u of [-2, 2]) {
    const m = new THREE.Mesh(post, white);
    m.position.set(u, 1.3, 0);
    arch.add(m);
  }
  for (let i = 0; i <= 16; i++) {
    const a = (i / 16) * Math.PI;
    const m = new THREE.Mesh(BALL, flower[i % 3]);
    m.scale.setScalar(0.42 + (i % 2) * 0.12);
    m.position.set(-Math.cos(a) * 2, 2.6 + Math.sin(a) * 1.2, 0);
    arch.add(m);
  }
  const [ax, az] = P(6, -12.6);
  arch.position.set(ax, 0, az);
  R.add(arch);

  // the raid: Federation portals round the arch, the agents stepping out of them
  const swirls = [];
  const raidAt = [
    [0.5, -15.5],
    [11.5, -15.5],
    [-2, -9],
    [14, -9],
  ];
  for (const [dx, dz] of raidAt) {
    const m = R.own(kit.portal());
    const sw = new THREE.Mesh(R.own(new THREE.PlaneGeometry(2.6, 3)), m);
    const [x, z] = P(dx, dz);
    sw.position.set(x, 1.6, z - 0.6);
    sw.visible = false;
    R.add(sw, { ink: false });
    swirls.push([sw, m]);
  }
  let raiding = false;
  for (const [i, [dx, dz]] of raidAt.entries()) S.figure('gromflomite', { x: P(dx, dz)[0], z: P(dx, dz)[1] + 0.6, face: -Math.PI / 2 + (i - 1.5) * 0.3, when: () => raiding, id: `raider-${i}`, who: 'A Gromflomite', ai: { hunt: { speed: 2.6 + i * 0.15, catchR: 1.1 } } });

  // the guests stay for the wedding, and are gone once the raid comes
  S.people({ extras: { when: (state) => !raiding && !state?.done?.includes('squanch') } });

  const glare = new THREE.PointLight(0x6ad8ff, 0, 30);
  glare.position.set(ax, 3, az - 2);
  R.group.add(glare);
  const area = S.done(LIGHT, (t, dt, state, camera) => {
    const over = raiding || state?.done?.includes('squanch');
    // over it goes, and stays down
    arch.rotation.x = THREE.MathUtils.damp(arch.rotation.x, over ? -1.45 : 0, raiding ? 4 : 50, dt);
    for (const [sw, m] of swirls) {
      sw.visible = raiding;
      if (!raiding) continue;
      if (camera) sw.rotation.y = Math.atan2(camera.position.x - sw.position.x, camera.position.z - sw.position.z);
      m.uniforms.t.value = t;
      m.uniforms.open.value = 1;
    }
    glare.intensity = raiding ? 2 + Math.sin(t * 7) : 0;
  });
  area.actions = {
    ...area.actions,
    raid: () => {
      raiding = true;
      S.hunt(true); // the agents out of their portals, after him
    },
    calm: () => {
      raiding = false;
      S.calm();
    },
  };
  return area;
}
