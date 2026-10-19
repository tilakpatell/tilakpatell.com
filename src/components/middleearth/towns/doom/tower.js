// Barad-dûr: the Tower on its fins and buttresses, the horns of its crown
// and the Eye between them with its searching beam. Moved out of props.js
// as it was; the Eye and the beam are the kit's materials.

import * as THREE from 'three';
import { clamp01, makeNoise, mix, smooth } from '../../../../lib/paint';
import { boxUV, rng } from '../../shire/build';
import { _kc, _kc2, facet, geoOf, noise3, oneGeo, prof, spikeAt, sweep, TAU, V3 } from './helpers';

// ── Barad-dûr ──

// A wedge-sectioned fin: rows [y, rIn, rOut, halfThick] up it, the blade's
// edge out along +x, its back against the tower. Turned to `a` about y.
export function finGeo(rows, a) {
  const pos = [];
  const idx = [];
  rows.forEach(([y, ri, ro, h]) => pos.push(ri, y, -h, ro, y, 0, ri, y, h));
  for (let i = 0; i < rows.length - 1; i++) {
    const b = i * 3;
    idx.push(b, b + 3, b + 1, b + 1, b + 3, b + 4, b + 1, b + 4, b + 2, b + 2, b + 4, b + 5);
  }
  const t = (rows.length - 1) * 3;
  idx.push(t, t + 1, t + 2);
  const g = geoOf(pos, idx);
  g.rotateY(-a);
  return facet(g);
}

// Barad-dûr: the Dark Tower, 420 m to the tips of its crown. A great
// plinth on the rock; black tiers narrowing up, each turned against the
// one below and fringed with spikes, ribbed all over; blade buttresses
// sweeping out and down from its flanks like roots; needle spires; and at
// the top the two horns of its crown curving out and in, the Eye between
// them at eyeAt, wreathed in fire, its beam thrown down to the ground.
// The horns open to ±x, so it is best seen from ±z. aim(target) points the
// beam at a world point; doom (world, default the origin) is where the Eye
// turns at the last: update(t, { k, look }), k how fierce, look 0..1.
export function baradDur(K) {
  const { mats, U } = K;
  const g = new THREE.Group();
  g.name = 'baradDur';
  const eyeAt = V3(0, 394, 0);
  const n = makeNoise(2101);
  const r = rng(2101);
  const T = [];
  const oct = (y0, y1, r0, r1, turn, sides = 8) => T.push(new THREE.CylinderGeometry(r1, r0, y1 - y0, sides, 1).rotateY(turn).translate(0, (y0 + y1) / 2, 0));
  // the plinth, and the rock it stands on
  oct(-12, 6, 104, 92, 0.2, 10);
  oct(6, 22, 84, 74, 0.5, 8);
  const TIERS = [
    [22, 90, 62, 52],
    [90, 100, 57, 57],
    [100, 180, 47, 39],
    [180, 189, 43, 43],
    [189, 262, 35, 28],
    [262, 269, 31, 31],
    [269, 326, 25, 19.5],
    [326, 332, 22, 22],
    [332, 366, 17.5, 13],
    [366, 372, 15, 15],
  ];
  TIERS.forEach(([y0, y1, r0, r1], i) => {
    const turn = (Math.floor(i / 2) % 2) * (Math.PI / 8);
    oct(y0, y1, r0, r1, turn);
    const cornice = i % 2 === 1;
    if (cornice) {
      // a fringe of spikes about the ledge, leaning out
      const count = Math.round(r0 * 0.5);
      for (let j = 0; j < count; j++) {
        const a = (j / count) * TAU + turn;
        const len = 5 + (j % 3) * 3 + r() * 3;
        T.push(spikeAt(V3(Math.cos(a) * r0 * 0.96, y1 - 0.5, Math.sin(a) * r0 * 0.96), V3(Math.cos(a) * 0.35, 1, Math.sin(a) * 0.35), len, 1 + r0 * 0.012, 4));
      }
    } else {
      // ribs up its faces, the tower's grain
      const ribs = 16;
      for (let j = 0; j < ribs; j++) {
        const a = (j / ribs) * TAU + turn + Math.PI / ribs;
        const rr0 = r0 * Math.cos(Math.PI / 8) + 0.5;
        const rr1 = r1 * Math.cos(Math.PI / 8) + 0.5;
        const h = y1 - y0;
        const rib = new THREE.CylinderGeometry(1.4, 1.9, h, 3).rotateY(-a);
        const p = rib.attributes.position;
        for (let v = 0; v < p.count; v++) {
          const k = (p.getY(v) + h / 2) / h;
          const rr = mix(rr0, rr1, k);
          p.setX(v, p.getX(v) + Math.cos(a) * rr);
          p.setZ(v, p.getZ(v) + Math.sin(a) * rr);
        }
        rib.translate(0, (y0 + y1) / 2, 0);
        T.push(rib);
      }
    }
  });
  // the great buttresses, blades sweeping out from its flanks to the rock
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + Math.PI / 8;
    const H = 300;
    const rows = [];
    for (let k = 0; k <= 12; k++) {
      const y = 8 + (k / 12) * (H - 8);
      const f = (y - 8) / (H - 8);
      rows.push([y, Math.max(12, prof(TIERS.map(([y0, , r0]) => [y0, r0]), y)[0] - 6), prof(TIERS.map(([y0, , r0]) => [y0, r0]), y)[0] + 4 + 64 * Math.pow(1 - f, 3.2) + 4 * (1 - f), 8 * (1 - f) + 1.8]);
    }
    T.push(finGeo(rows, a));
    // hooked spurs along its edge
    for (let k = 1; k < 11; k += 2) {
      const [y, , ro] = rows[k];
      T.push(spikeAt(V3(Math.cos(a) * (ro - 2), y, Math.sin(a) * (ro - 2)), V3(Math.cos(a), 0.9, Math.sin(a)), 9 + (k % 3) * 3, 2.2, 4));
    }
    // and lesser blades between, not so high
    const b = a + Math.PI / 8;
    const rows2 = [];
    for (let k = 0; k <= 8; k++) {
      const y = 8 + (k / 8) * 170;
      const f = k / 8;
      rows2.push([y, Math.max(12, prof(TIERS.map(([y0, , r0]) => [y0, r0]), y)[0] - 6), prof(TIERS.map(([y0, , r0]) => [y0, r0]), y)[0] + 2 + 40 * Math.pow(1 - f, 2.6), 5 * (1 - f) + 1.4]);
    }
    T.push(finGeo(rows2, b));
  }
  // needle spires about its upper tiers
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + 0.3;
    const rr = i % 2 ? 31 : 22;
    const y = i % 2 ? 252 : 320;
    T.push(spikeAt(V3(Math.cos(a) * rr, y - 4, Math.sin(a) * rr), V3(Math.cos(a) * 0.06, 1, Math.sin(a) * 0.06), i % 2 ? 62 : 38, i % 2 ? 4.5 : 3.2, 4));
  }
  // the crown: two horns, out and up and in, spurred along their backs
  for (const sd of [-1, 1]) {
    const P = [[sd * 10, 364, 0], [sd * 22, 376, 0], [sd * 30, 393, 0], [sd * 26, 409, 0], [sd * 12, 421, 0]];
    T.push(sweep(P, [[7, 9], [6, 7], [4.6, 5], [3, 3.2], [0.5, 0.5]], { seg: 16, radial: 7, side: [0, 0, 1] }));
    for (let k = 0; k < 6; k++) {
      const f = 0.12 + k * 0.15;
      const c = new THREE.CatmullRomCurve3(P.map((p) => V3(...p))).getPoint(f);
      T.push(spikeAt(c, V3(sd * 1, 0.5 - k * 0.12, (k % 2 ? 0.4 : -0.4)), 10 - k * 0.8, 1.6, 4));
    }
    // a lesser horn below each, the crown's outer points
    T.push(sweep([[sd * 14, 360, 9], [sd * 24, 368, 13], [sd * 32, 382, 12]], [[3.5], [2.4], [0.3]], { seg: 8, radial: 5 }));
    T.push(sweep([[sd * 14, 360, -9], [sd * 24, 368, -13], [sd * 32, 382, -12]], [[3.5], [2.4], [0.3]], { seg: 8, radial: 5 }));
  }
  // the cup between the horns
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU;
    T.push(spikeAt(V3(Math.cos(a) * 12, 368, Math.sin(a) * 12), V3(Math.cos(a) * 0.5, 1, Math.sin(a) * 0.5), 7 + (i % 2) * 5, 1.6, 4));
  }
  const geo = oneGeo(T.map((x) => (x.index ? facet(x) : x)), ['heat']);
  const to = V3();
  const heat = geo.attributes.heat;
  const nr = geo.attributes.normal;
  const p = geo.attributes.position;
  const col = geo.attributes.color;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const ny = nr.getY(i);
    _kc.setRGB(0.05, 0.043, 0.042).multiplyScalar(0.75 + noise3(n, x * 0.05, y * 0.05, z * 0.05) * 0.6);
    if (ny > 0.55) _kc.lerp(_kc2.setRGB(0.12, 0.1, 0.095), 0.6);
    col.setXYZ(i, _kc.r, _kc.g, _kc.b);
    // the Eye's fire on the stone about it
    to.set(eyeAt.x - x, eyeAt.y - y, eyeAt.z - z);
    const d = to.length();
    const facing = Math.max(0, (nr.getX(i) * to.x + ny * to.y + nr.getZ(i) * to.z) / d);
    heat.setX(i, Math.min(1, Math.exp(-d / 40) * (0.35 + 0.95 * facing)));
  }
  boxUV(geo, 0.05);
  const tower = new THREE.Mesh(geo, mats.tower);
  tower.name = 'darkTower';
  g.add(tower);

  // the Eye
  const eye = new THREE.Mesh(new THREE.PlaneGeometry(150, 150), mats.eye);
  eye.position.copy(eyeAt);
  eye.renderOrder = 8;
  eye.frustumCulled = false;
  eye.name = 'eyeOfSauron';
  g.add(eye);

  // the beam, from the Eye down to where it is aimed, and its pool of light
  const beamGeo = new THREE.CylinderGeometry(1, 0.12, 1, 28, 10, true).translate(0, 0.5, 0).rotateX(Math.PI / 2);
  const beam = new THREE.Mesh(beamGeo, mats.beam);
  beam.name = 'eyeBeam';
  beam.renderOrder = 7;
  beam.frustumCulled = false;
  g.add(beam);
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), mats.beamPool);
  pool.renderOrder = 7;
  pool.name = 'beamPool';
  g.add(pool);
  const RADIUS = 24;
  const aimed = V3(0, 0, 600);
  const doom = V3(0, 0, 0);
  const tmp = V3();
  const at = V3();
  const Z = V3(0, 0, 1);
  let look = 0;
  const place = () => {
    g.updateWorldMatrix(true, false);
    tmp.copy(doom);
    g.worldToLocal(tmp);
    at.copy(aimed).lerp(tmp, smooth(0, 1, look));
    const dir = tmp.subVectors(at, eyeAt);
    const L = Math.max(1, dir.length());
    beam.position.copy(eyeAt);
    beam.quaternion.setFromUnitVectors(Z, dir.divideScalar(L));
    beam.scale.set(RADIUS, RADIUS, L);
    pool.position.copy(at).add(V3(0, 0.4, 0));
    pool.scale.set(RADIUS * 3, 1, RADIUS * 3);
    mats.eye.uniforms.uGazeAt.value.copy(at);
    g.localToWorld(mats.eye.uniforms.uGazeAt.value);
  };
  const aim = (target) => {
    g.updateWorldMatrix(true, false);
    aimed.copy(target);
    g.worldToLocal(aimed);
    place();
  };
  const update = (t, { k = 1, look: lk = 0 } = {}) => {
    const kk = clamp01(k);
    U.uTime.value = t;
    look = clamp01(lk);
    mats.eye.uniforms.uK.value = kk;
    mats.eye.uniforms.uFix.value = 0.55 + 0.45 * look;
    mats.beam.uniforms.uK.value = 0.4 + 0.8 * kk;
    mats.beamPool.opacity = 0.35 + 0.4 * kk;
    mats.tower.userData.glow.value = 0.45 + 0.9 * kk;
    place();
  };
  update(0);
  return { group: g, eyeAt: eyeAt.clone(), eye, beam, doom, aim, update };
}
