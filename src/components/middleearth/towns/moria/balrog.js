// Durin’s Bane. Moved out of props.js as it was; its fire and smoke come
// from the kit (K.shaders).

import * as THREE from 'three';
import { clamp01, fbm, makeCanvas, makeCells, makeNoise, mix, paintPixels, smooth } from '../../../../lib/paint';
import { ball, parts, rng } from '../../shire/build';
import { createStride, createTracker, footAt, legRig } from '../../creatures';
import { along, cardCloud, lump, noise3, sweep3, TAU, tint, UP, V3 } from './helpers';

// ── Durin's Bane ──

// The Balrog's hide, for laying on from three sides: plates of black rock
// split by cracks, the big ones wide and the small hair-fine. Red the
// cracks (where the fire shows), green the plates' shading, blue soot; and
// its relief, the plates domed and the cracks deep.
export function crackCanvas(S = 256) {
  const big = makeCells(201);
  const small = makeCells(203);
  const n = makeNoise(207);
  const field = new Float32Array(S * S);
  const c = paintPixels(makeCanvas(S), (u, v, out, px, py) => {
    const a = big(u * 4, v * 4, 4);
    const b = small(u * 10, v * 10, 10);
    const wob = (fbm(n, u * 8, v * 8, { period: 8, octaves: 3 }) - 0.5) * 0.06;
    const ea = a.f2 - a.f1 + wob;
    const eb = b.f2 - b.f1 + wob * 0.5;
    const wide = 1 - smooth(0.0, 0.05 + a.id * 0.04, ea);
    const fine = (1 - smooth(0.0, 0.035, eb)) * smooth(0.35, 0.6, fbm(n, u * 4 + 9, v * 4, { period: 4, octaves: 2 }));
    const crack = Math.max(wide, fine * 0.65);
    const dome = smooth(0.0, 0.3, ea) * (0.6 + 0.4 * smooth(0.0, 0.25, eb));
    const grain = n(u * 64, v * 64, 64);
    field[py * S + px] = clamp01(dome * 0.75 + grain * 0.12 - crack * 0.4 + a.id * 0.08);
    out[0] = crack * 255;
    out[1] = clamp01(0.35 + dome * 0.4 + (grain - 0.5) * 0.3 + (a.id - 0.5) * 0.3) * 255;
    out[2] = clamp01(smooth(0.6, 0.85, fbm(n, u * 6 + 3, v * 6, { period: 6, octaves: 3 })) * 0.6) * 255;
  });
  return { c, field };
}

// The membrane of a wing between its bones: a fan of panels from the wrist
// W out between each two rim points, bellying, the free edge between them
// scalloped. aWing is (how near the free edge, how near the body).
export function wingSkin(W, rim, body, { n = 8, m = 6 } = {}) {
  const pos = [];
  const uv = [];
  const wing = [];
  const idx = [];
  const w = V3(...W);
  const A = V3();
  const Bv = V3();
  const nor = V3();
  const p = V3();
  const at = V3(...body);
  for (let k = 0; k < rim.length - 1; k++) {
    A.set(...rim[k]).sub(w);
    Bv.set(...rim[k + 1]).sub(w);
    nor.crossVectors(A, Bv).normalize();
    const base = pos.length / 3;
    const freeEdge = rim[k][3] ?? 1;
    for (let i = 0; i <= n; i++) {
      const s = i / n;
      const sag = 1 - 0.22 * Math.sin(Math.PI * s) * freeEdge;
      for (let j = 0; j <= m; j++) {
        const t = j / m;
        p.copy(A).lerp(Bv, s).multiplyScalar(t * sag).add(w).addScaledVector(nor, 0.35 * Math.sin(Math.PI * s) * Math.sin(Math.PI * t * 0.9));
        pos.push(p.x, p.y, p.z);
        uv.push((k + s) * 1.3, t * 2.2);
        const nearBody = Math.exp(-p.distanceTo(at) / 3.2);
        wing.push(t * Math.sin(Math.PI * s) * freeEdge + t * 0.25, clamp01(nearBody + (1 - t) * 0.35));
      }
    }
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < m; j++) {
        const a0 = base + i * (m + 1) + j;
        const b0 = a0 + m + 1;
        idx.push(a0, b0, a0 + 1, a0 + 1, b0, b0 + 1);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('aWing', new THREE.Float32BufferAttribute(wing, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// Durin's Bane, about 9 m to the top of its head and 11 to its horns,
// facing +x: a huge horned demon of black rock, fire flowing in its cracks;
// a bull's legs, a great chest hunched forward, long arms to clawed hands,
// a long tail; wings of shadow and smoke; a mane of flame on its head and
// neck and fire rising off its back and shoulders, smoke above; eyes like
// coals; a sword of flame in its right hand and a whip of fire in its left.
// update(t, { rage, whip }): its walk is read from where the scene puts it
// (../../creatures.js), each great foot held where it comes down however
// the gap to you opens or closes (`stride` is no longer needed); rage 0..1
// the fire up, the wings spread, the head up and
// roaring; whip 0..1 cracks the whip (up and back to 0.4, the lash rolling
// out forward to 0.8, the crack), then reaches it forward and up to wrap
// round the legs of whoever stands on the deck WHIP_REACH ahead: the deck
// it stood on, y = 0 in its parent's frame, however far it has fallen.
export const WHIP_REACH = 2.2;
export function balrog(K) {
  const { mats, U } = K;
  const g = new THREE.Group();
  g.name = 'balrog';
  const n = makeNoise(211);
  const r = rng(211);
  const rock = (geo, dark = 0) => tint(geo, (x, y, z, out, nx, ny) => {
    const v = noise3(n, x * 0.9, y * 0.9, z * 0.9);
    out.setRGB(0.05, 0.042, 0.038).multiplyScalar((0.7 + v * 0.6) * (1 - dark) * (0.7 + 0.3 * smooth(-0.7, 0.5, ny)));
  });
  const plates = (p) => (noise3(n, p.x * 1.3, p.y * 1.3, p.z * 1.3) - 0.5) * 0.22;
  const part = (bk, geo, dark = 0) => bk.add(mats.balrogSkin, rock(geo, dark));
  const knob = (rad, p, s = [1, 1, 1], detail = 2, seed = 0, rot = [0, 0, 0]) => lump(rad, { p, s, r: rot }, { detail, amp: 0.14, freq: 1.3, seed: 220 + seed });
  const spike = (bk, base, dir, len, rad) => bk.add(mats.horn, along(new THREE.ConeGeometry(rad, len, 6).translate(0, len / 2, 0), dir, base));
  const group = (name, parent, p) => {
    const o = new THREE.Group();
    o.name = name;
    o.position.set(...p);
    parent.add(o);
    return o;
  };
  const fire = (parent, pts, o, seed) => parent.add(cardCloud(K.shaders.flame(U, o), pts, seed));
  const smokes = (parent, pts, o, seed) => parent.add(cardCloud(K.shaders.smoke(U, o), pts, seed));
  const along3 = (a, b, count, jitter = 0) => {
    const out = [];
    for (let i = 0; i < count; i++) {
      const t = count > 1 ? i / (count - 1) : 0;
      out.push(V3(...a).lerp(V3(...b), t).add(V3((r() - 0.5) * jitter, (r() - 0.5) * jitter, (r() - 0.5) * jitter)));
    }
    return out;
  };

  // ── the hips, the legs and the tail
  const hips = group('hips', g, [-0.2, 4.9, 0]);
  {
    const bk = parts();
    part(bk, knob(1.25, [0, 0, 0], [1.0, 0.82, 1.25], 2, 1));
    bk.build(hips);
  }
  const legs = [-1, 1].map((s) => {
    const leg = group(s < 0 ? 'legL' : 'legR', hips, [0.1, -0.15, s * 1.15]);
    const bk = parts();
    part(bk, sweep3([[0, 0.2, 0], [0.55, -0.95, s * 0.08], [0.95, -1.75, s * 0.1]], [[0.88, 0.82], [0.78, 0.72], [0.5, 0.5]], { seg: 10, radial: 16, bump: plates }));
    part(bk, knob(0.62, [0.3, -0.55, s * 0.25], [0.8, 1.2, 0.7], 2, 2 + s));
    bk.build(leg);
    const shin = group('shin', leg, [0.95, -1.75, s * 0.1]);
    const sk = parts();
    part(sk, knob(0.5, [0.05, 0, 0], [1, 1, 1], 2, 4 + s));
    part(sk, sweep3([[0, 0, 0], [-0.35, -0.75, 0], [-0.65, -1.45, 0]], [[0.48, 0.46], [0.42, 0.4], [0.32, 0.32]], { seg: 9, radial: 14, bump: plates }));
    spike(sk, V3(0.25, 0.1, 0), V3(1, 0.4, 0), 0.6, 0.14);
    sk.build(shin);
    const foot = group('foot', shin, [-0.65, -1.45, 0]);
    const fk = parts();
    part(fk, knob(0.36, [0, 0, 0], [1, 1, 1], 1, 6 + s));
    part(fk, sweep3([[0, 0, 0], [0.18, -0.75, 0], [0.35, -1.36, 0]], [[0.3, 0.3], [0.27, 0.29], [0.3, 0.34]], { seg: 6, radial: 12, bump: plates }));
    for (let t = 0; t < 3; t++) {
      const z = (t - 1) * 0.28;
      const toe = [V3(0.35, -1.36, z * 0.4), V3(0.75, -1.4, z), V3(1.15, -1.45, z * 1.15)];
      part(fk, sweep3(toe, [[0.17, 0.17], [0.15, 0.15], [0.11, 0.11]], { seg: 5, radial: 8 }));
      spike(fk, toe[2], V3(1, -0.45, z * 0.4), 0.45, 0.09);
    }
    spike(fk, V3(-0.1, -1.2, 0), V3(-1, -0.6, 0), 0.4, 0.09);
    fk.build(foot);
    leg.shin = shin;
    shin.foot = foot;
    return leg;
  });
  const tail = group('tail', hips, [-1.0, 0.0, 0]);
  {
    const bk = parts();
    const pts = [[0, 0, 0], [-1.4, -0.7, 0.25], [-2.8, -1.9, -0.15], [-4.1, -3.4, 0.35], [-5.0, -4.3, 0.9]];
    part(bk, sweep3(pts, [[0.6, 0.6], [0.45, 0.45], [0.3, 0.3], [0.16, 0.16], [0.05, 0.05]], { seg: 18, radial: 12, bump: plates }));
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => V3(...p)));
    for (let i = 1; i < 6; i++) {
      const t = i / 6;
      spike(bk, curve.getPoint(t).add(V3(0, mix(0.55, 0.15, t), 0)), V3(-0.6, 1, 0), mix(0.5, 0.2, t), mix(0.12, 0.05, t));
    }
    bk.build(tail);
    fire(tail, along3([-4.0, -3.2, 0.3], [-5.1, -4.3, 0.95], 14, 0.25), { size: 0.6, rise: 1.3, heat: 0.6 }, 31);
  }

  // ── the body: a waist of plated rock, a vast chest, shoulders like crags
  const body = group('body', hips, [0, 0.1, 0]);
  {
    const bk = parts();
    part(bk, sweep3([[0, -0.5, 0], [0.3, 0.9, 0], [0.6, 2.05, 0], [0.78, 2.95, 0], [0.92, 3.55, 0]], [[1.05, 1.2, 0.95], [0.92, 1.12, 0.9], [1.3, 1.72, 1.12], [1.38, 1.95, 1.2], [0.9, 1.3, 0.85]], { seg: 18, radial: 22, bump: plates }));
    for (const s of [-1, 1]) {
      part(bk, knob(0.78, [1.38, 2.72, s * 0.78], [0.55, 0.85, 1.05], 2, 10 + s));
      for (let k = 0; k < 4; k++) part(bk, knob(0.34, [1.12 - k * 0.04, 0.95 + k * 0.42, s * 0.36], [0.55, 0.7, 0.95], 1, 12 + k + s * 4));
      part(bk, knob(0.62, [0.72, 0.6, s * 1.0], [0.8, 1.2, 0.7], 2, 20 + s));
      // the shoulders, and the spikes on them
      part(bk, knob(1.0, [0.5, 3.4, s * 1.9], [1.05, 0.95, 1], 2, 22 + s));
      spike(bk, V3(0.3, 4.0, s * 2.2), V3(-0.2, 1, s * 0.5), 1.1, 0.24);
      spike(bk, V3(-0.1, 3.7, s * 2.5), V3(-0.6, 0.8, s * 0.6), 0.8, 0.2);
    }
    // the ridge of the back: a row of spines
    for (let k = 0; k < 7; k++) {
      const t = k / 6;
      const at = V3(mix(-0.6, -1.05, Math.sin(t * Math.PI) * 0.6 + t * 0.4), mix(0.6, 3.6, t), 0);
      spike(bk, at, V3(-1, 0.55, 0), mix(0.5, 0.9, Math.sin(t * Math.PI)), 0.16);
    }
    part(bk, knob(0.95, [-0.55, 2.9, 0], [0.8, 1.0, 1.4], 2, 26), 0.1);
    // the neck
    part(bk, sweep3([[0.75, 3.35, 0], [1.35, 3.85, 0], [1.9, 4.12, 0]], [[0.88, 0.98], [0.72, 0.78], [0.56, 0.62]], { seg: 8, radial: 16, bump: plates }));
    bk.build(body);
    // the fire off its back and shoulders, and the smoke going up from it
    const back = [];
    for (let k = 0; k < 46; k++) {
      const t = r();
      back.push(V3(mix(-0.6, -1.15, Math.sin(t * Math.PI) * 0.6 + t * 0.4) + (r() - 0.5) * 0.4, mix(0.8, 3.9, t), (r() - 0.5) * 1.1));
    }
    for (const s of [-1, 1]) for (let k = 0; k < 22; k++) back.push(V3(0.4 + (r() - 0.5) * 1.0, 4.0 + r() * 0.3, s * (1.6 + r() * 0.9)));
    fire(body, back, { size: 1.0, rise: 2.4, heat: 0.5 }, 41);
    smokes(body, back.filter((_, i) => i % 3 === 0), { size: 2.6, rise: 9 }, 43);
  }

  // ── the head: a long skull, a heavy brow over eyes like coals, a muzzle
  // of fangs, horns sweeping back and out and round to the front; a mane of
  // flame from the brow back down the neck
  const head = group('head', body, [1.95, 4.2, 0]);
  const jaw = group('jaw', head, [0.3, -0.1, 0]);
  {
    const bk = parts();
    part(bk, knob(0.64, [0.05, 0.35, 0], [1.2, 0.85, 0.85], 2, 30));
    part(bk, sweep3([[0.55, 0.62, -0.46], [0.72, 0.56, 0], [0.55, 0.62, 0.46]], [[0.16, 0.16], [0.2, 0.18], [0.16, 0.16]], { seg: 6, radial: 8, side: [0, 1, 0] }));
    part(bk, sweep3([[0.35, 0.2, 0], [0.9, 0.12, 0], [1.4, 0.02, 0]], [[0.42, 0.5], [0.32, 0.38], [0.2, 0.25]], { seg: 8, radial: 12, bump: plates }));
    for (const s of [-1, 1]) {
      part(bk, knob(0.24, [0.55, 0.18, s * 0.42], [1.2, 0.8, 0.8], 1, 31 + s));
      // the eyes, deep in their sockets, burning; and the nostrils
      bk.add(mats.balrogEye, ball(0.1, 8, 6), { p: [0.66, 0.42, s * 0.3], s: [0.7, 0.75, 1.1] });
      bk.add(mats.balrogEye, ball(0.045, 6, 4), { p: [1.32, 0.12, s * 0.13] });
      // the horns
      const hp = [[0.0, 0.72, s * 0.42], [-0.65, 1.2, s * 1.0], [-0.55, 1.95, s * 1.55], [0.25, 2.35, s * 1.72], [1.0, 2.15, s * 1.5]];
      bk.add(mats.horn, sweep3(hp, [[0.32, 0.3], [0.27, 0.26], [0.2, 0.19], [0.12, 0.11], [0.02, 0.02]], { seg: 22, radial: 10, bump: (p, o, u, v) => Math.max(0, Math.sin(v * 70)) * 0.025 * (1 - v) }));
      for (let k = 0; k < 5; k++) bk.add(mats.horn, new THREE.ConeGeometry(0.035, 0.16, 4), { p: [1.0 - k * 0.12, 0.0, s * 0.18], r: [Math.PI, 0, 0] });
    }
    bk.build(head);
    const jk = parts();
    part(jk, sweep3([[0, 0, 0], [0.6, -0.16, 0], [1.05, -0.2, 0]], [[0.36, 0.42], [0.26, 0.32], [0.16, 0.2]], { seg: 8, radial: 12, bump: plates }));
    for (const s of [-1, 1]) for (let k = 0; k < 5; k++) jk.add(mats.horn, new THREE.ConeGeometry(0.04, 0.2, 4), { p: [1.0 - k * 0.13, 0.02, s * 0.17] });
    // the furnace of its mouth
    jk.add(mats.fireSolid, knob(0.22, [0.5, 0.05, 0], [1.6, 0.5, 0.9], 1, 35));
    jk.build(jaw);
    const mane = [];
    for (let k = 0; k < 64; k++) {
      const t = r();
      const p = t < 0.55
        ? V3(mix(0.55, -0.5, t / 0.55), 0.85 - (t / 0.55) * 0.2 + r() * 0.1, (r() - 0.5) * 0.7)
        : V3(mix(-0.5, -1.4, (t - 0.55) / 0.45), mix(0.6, -0.2, (t - 0.55) / 0.45), (r() - 0.5) * 1.0);
      mane.push(p);
    }
    fire(head, mane, { size: 0.85, rise: 2.0, heat: 0.6, rate: 1.1 }, 51);
  }

  // ── the arms: shoulders like boulders, elbows spiked, clawed hands
  const arms = [-1, 1].map((s) => {
    const arm = group(s < 0 ? 'armL' : 'armR', body, [0.55, 3.2, s * 2.15]);
    const bk = parts();
    part(bk, knob(0.85, [0, 0.05, s * 0.05], [1, 1, 1], 2, 60 + s));
    part(bk, sweep3([[0, 0, 0], [0.25, -1.1, s * 0.22], [0.4, -2.0, s * 0.32]], [[0.76, 0.74], [0.72, 0.68], [0.5, 0.5]], { seg: 10, radial: 16, bump: plates }));
    bk.build(arm);
    const fore = group('fore', arm, [0.4, -2.0, s * 0.32]);
    const fk = parts();
    part(fk, knob(0.5, [0, 0, 0], [1, 1, 1], 1, 62 + s));
    spike(fk, V3(-0.35, 0.05, 0), V3(-1, -0.2, s * 0.2), 0.8, 0.16);
    part(fk, sweep3([[0, 0, 0], [0.5, -0.85, 0], [0.95, -1.7, 0]], [[0.5, 0.55], [0.56, 0.58], [0.36, 0.4]], { seg: 10, radial: 16, bump: plates }));
    fk.build(fore);
    fire(fore, along3([-0.2, -0.1, s * 0.3], [0.7, -1.4, s * 0.35], 16, 0.3), { size: 0.7, rise: 1.5, heat: 0.55 }, 70 + s);
    const hand = group('hand', fore, [0.95, -1.7, 0]);
    const hk = parts();
    part(hk, knob(0.48, [0.05, -0.28, 0], [0.8, 1.0, 1.0], 2, 64 + s));
    // the fingers, curled round the sword's hilt and the whip's
    for (let f = 0; f < 4; f++) {
      const z = (f - 1.5) * 0.2;
      const pts = [V3(0.15, -0.62, z), V3(0.45, -0.75, z), V3(0.5, -1.0, z * 1.05), V3(0.28, -1.08, z)];
      part(hk, sweep3(pts, [[0.13, 0.13], [0.12, 0.12], [0.1, 0.1], [0.08, 0.08]], { seg: 6, radial: 8 }));
      spike(hk, pts[3], pts[3].clone().sub(pts[2]), 0.22, 0.06);
    }
    part(hk, sweep3([V3(0.15, -0.32, s * 0.36), V3(0.42, -0.55, s * 0.32), V3(0.52, -0.75, s * 0.12)], [[0.15, 0.15], [0.13, 0.13], [0.1, 0.1]], { seg: 5, radial: 8 }));
    hk.build(hand);
    arm.fore = fore;
    fore.hand = hand;
    arm.hand = hand;
    return arm;
  });

  // ── the sword of flame, in its right hand
  const sword = new THREE.Group();
  sword.name = 'sword';
  sword.position.set(0.42, -0.9, 0);
  sword.quaternion.setFromUnitVectors(UP, V3(0.75, -0.55, 0.12).normalize());
  arms[1].hand.add(sword);
  {
    const sk = parts();
    const L = 5.2;
    const blade = sweep3([[0, 0.4, 0], [0.04, 1.6, 0], [0.12, 3.2, 0], [0.04, 4.6, 0], [-0.1, L, 0]], [[0.04, 0.32], [0.05, 0.36], [0.05, 0.3], [0.04, 0.2], [0.01, 0.02]], { seg: 24, radial: 8, side: [0, 0, 1], bump: (p, o, u, v) => (Math.abs(o.z) > 0.5 ? (n(v * 30, u * 4) - 0.5) * 0.12 : 0) });
    sk.add(mats.fireSolid, blade);
    sk.add(mats.horn, sweep3([[0, 0.38, -0.7], [0, 0.48, 0], [0, 0.38, 0.7]], [[0.1, 0.1], [0.14, 0.14], [0.06, 0.06]], { seg: 8, radial: 8, side: [1, 0, 0] }));
    sk.add(mats.horn, sweep3([[0, -0.5, 0], [0, 0.4, 0]], [[0.1, 0.1], [0.1, 0.1]], { seg: 3, radial: 8 }));
    sk.build(sword);
    const pts = [];
    for (let k = 0; k < 52; k++) {
      const t = r();
      pts.push(V3(Math.sin(t * 3) * 0.08, mix(0.6, L - 0.2, t), (r() - 0.5) * 0.5 * (1 - t * 0.7)));
    }
    fire(sword, pts, { size: 0.6, rise: 1.2, heat: 0.7, rate: 1.4 }, 81);
  }

  // ── the whip of fire, in its left hand: a tapering lash rebuilt each frame
  const WN = 56;
  const WR = 8;
  const WLEN = 10.5;
  const wpos = new Float32Array((WN + 1) * (WR + 1) * 3);
  const wnor = new Float32Array((WN + 1) * (WR + 1) * 3);
  const wuv = new Float32Array((WN + 1) * (WR + 1) * 2);
  const widx = [];
  for (let i = 0; i <= WN; i++) {
    for (let j = 0; j <= WR; j++) wuv.set([j / WR, (i / WN) * WLEN], (i * (WR + 1) + j) * 2);
  }
  for (let i = 0; i < WN; i++) {
    for (let j = 0; j < WR; j++) {
      const a = i * (WR + 1) + j;
      widx.push(a, a + WR + 1, a + 1, a + 1, a + WR + 1, a + WR + 2);
    }
  }
  const wgeo = new THREE.BufferGeometry();
  wgeo.setAttribute('position', new THREE.BufferAttribute(wpos, 3).setUsage(THREE.DynamicDrawUsage));
  wgeo.setAttribute('normal', new THREE.BufferAttribute(wnor, 3).setUsage(THREE.DynamicDrawUsage));
  wgeo.setAttribute('uv', new THREE.BufferAttribute(wuv, 2));
  wgeo.setIndex(widx);
  const whipMesh = new THREE.Mesh(wgeo, mats.fireSolid);
  whipMesh.name = 'whip';
  whipMesh.frustumCulled = false;
  g.add(whipMesh);
  const WF = 46;
  const whipFire = cardCloud(K.shaders.flame(U, { size: 0.55, rise: 0.9, heat: 1, rate: 1.5 }), Array.from({ length: WF }, () => V3()), 91);
  g.add(whipFire);
  const wsAt = Array.from({ length: WF }, (_, i) => Math.pow((i + 0.5) / WF, 0.8));
  const whipPts = Array.from({ length: WN + 1 }, () => V3());

  // ── the wings: shadow and smoke on a frame of bones
  const wings = [-1, 1].map((s) => {
    const root = group(s < 0 ? 'wingL' : 'wingR', body, [-0.85, 3.3, s * 0.9]);
    const frame = new THREE.Group();
    frame.scale.z = s;
    root.add(frame);
    const W = [-0.3, 3.4, 5.0];
    const E = [-1.1, 1.8, 2.5];
    const F = [[-1.4, 5.6, 7.6], [-3.6, 4.2, 8.6], [-5.4, 1.6, 7.8], [-5.2, -1.4, 5.4]];
    const bodyEnd = [-2.2, -2.6, 0.9];
    const bk = parts();
    bk.add(mats.horn, sweep3([[0, 0, 0], E, W], [[0.36, 0.36], [0.28, 0.28], [0.2, 0.2]], { seg: 10, radial: 8 }));
    for (const f of F) {
      const mid = V3(...W).lerp(V3(...f), 0.5).add(V3(0.3, 0.35, 0));
      bk.add(mats.horn, sweep3([W, mid.toArray(), f], [[0.14, 0.14], [0.09, 0.09], [0.02, 0.02]], { seg: 10, radial: 6 }));
    }
    spike(bk, V3(...W), V3(0.3, 1, 0.2), 0.9, 0.14);
    bk.build(frame);
    // the skin: between the fingers, back to the body, and before the arm
    const rim = [[...F[0], 1], [...F[1], 1], [...F[2], 1], [...F[3], 1], [...bodyEnd, 0.6]];
    const skin = new THREE.Mesh(wingSkin(W, rim, [0, 0, 0]), mats.wing);
    const front = new THREE.Mesh(wingSkin([0, 0, 0], [[...E, 0.2], [...W, 0.2], [...F[0], 0.9]], [0, 0, 0], { n: 5, m: 4 }), mats.wing);
    const back = new THREE.Mesh(wingSkin([0, 0, 0], [[...W, 0], [...bodyEnd, 0.5]], [0, 0, 0], { n: 4, m: 4 }), mats.wing);
    for (const m of [skin, front, back]) {
      m.renderOrder = 4;
      frame.add(m);
    }
    // smoke streaming off the wing's edge
    const edge = [];
    for (let k = 0; k < 30; k++) {
      const a = Math.floor(r() * (F.length - 1));
      edge.push(V3(...F[a]).lerp(V3(...F[a + 1]), r()).lerp(V3(...W), r() * 0.3));
    }
    smokes(frame, edge, { size: 2.4, rise: 5 }, 100 + s);
    return root;
  });

  // ── moving it
  const rest = { hips: hips.position.clone() };
  const _m = new THREE.Matrix4();
  const _p = V3();
  const _q = V3();
  const _t = V3();
  const _s = V3();
  const _b = V3();
  const _a = V3();
  const _c1 = V3();
  const _c2 = V3();
  const whipAngles = new Float32Array(WN);
  const buildWhip = (t, k) => {
    // where the lash leaves the hand, in the group's frame
    g.updateMatrixWorld(true);
    _m.copy(g.matrixWorld).invert();
    arms[0].hand.localToWorld(_p.set(0.35, -0.95, 0)).applyMatrix4(_m);
    const seg = WLEN / WN;
    const up = smooth(0.02, 0.4, k);
    const lash = clamp01((k - 0.4) / 0.4);
    const crack = smooth(0.74, 0.8, k) * (1 - smooth(0.8, 0.9, k));
    const reach = smooth(0.8, 1, k);
    // lying, raised, then lashing out forward: a chain of fixed links
    for (let i = 0; i < WN; i++) {
      const s = i / (WN - 1);
      const lying = mix(-1.75, -2.95, smooth(0, 0.3, s)) + 0.1 * Math.sin(t * 1.3 + s * 9);
      const raised = mix(2.25, 3.0, s) - 0.5 * s * s + 0.06 * Math.sin(t * 3 + s * 7);
      const out = mix(0.22, -0.1, s) + crack * 0.5 * Math.sin(s * 14 - k * 40) * smooth(0.6, 1, s);
      const p = clamp01((lash - s * 0.55) / 0.45);
      whipAngles[i] = mix(mix(lying, raised, up), out, smooth(0, 1, p));
    }
    whipPts[0].copy(_p);
    let z = 0;
    for (let i = 0; i < WN; i++) {
      const s = i / (WN - 1);
      z += seg * mix(-0.35 * smooth(0.1, 0.8, s), 0.05, up) * (1 - lash * 0.8);
      whipPts[i + 1].set(whipPts[i].x + Math.cos(whipAngles[i]) * seg, Math.max(0.05, whipPts[i].y + Math.sin(whipAngles[i]) * seg), _p.z + z);
    }
    // reaching: up to the deck and twice round the legs of whoever is there
    if (reach > 0) {
      const deck = Math.max(0, -g.position.y);
      const R = 0.3;
      _a.set(WHIP_REACH - R, deck + 0.85, 0);
      const dy = _a.y - _p.y;
      _c1.set(_p.x + 1.4, _p.y + dy * 0.35 + 1.5, _p.z * 0.6);
      _c2.set(_a.x - 1.2, _a.y - dy * 0.3 + 0.4, R * 2);
      const W0 = 0.66;
      for (let i = 1; i <= WN; i++) {
        const s = i / WN;
        if (s <= W0) {
          const u = s / W0;
          const v = 1 - u;
          _q.copy(_p).multiplyScalar(v * v * v).addScaledVector(_c1, 3 * v * v * u).addScaledVector(_c2, 3 * v * u * u).addScaledVector(_a, u * u * u);
        } else {
          const u = (s - W0) / (1 - W0);
          const a = Math.PI + u * TAU * 2.2 + Math.sin(t * 5) * 0.05 * u;
          _q.set(WHIP_REACH + Math.cos(a) * R * (1 - 0.15 * u), deck + mix(0.85, 0.18, u), -Math.sin(a) * R * (1 - 0.15 * u));
        }
        whipPts[i].lerp(_q, reach);
      }
    }
    // the tube round it
    for (let i = 0; i <= WN; i++) {
      const a = whipPts[Math.max(0, i - 1)];
      const b = whipPts[Math.min(WN, i + 1)];
      _t.subVectors(b, a).normalize();
      _s.set(0, 0, 1).addScaledVector(_t, -_t.z);
      if (_s.lengthSq() < 1e-6) _s.set(0, 1, 0);
      _s.normalize();
      _b.crossVectors(_t, _s);
      const rad = mix(0.13, mix(0.025, 0.05, reach), Math.pow(i / WN, 0.7));
      for (let j = 0; j <= WR; j++) {
        const th = (j / WR) * TAU;
        _q.copy(_s).multiplyScalar(Math.cos(th)).addScaledVector(_b, Math.sin(th));
        const o = (i * (WR + 1) + j) * 3;
        wpos[o] = whipPts[i].x + _q.x * rad;
        wpos[o + 1] = whipPts[i].y + _q.y * rad;
        wpos[o + 2] = whipPts[i].z + _q.z * rad;
        wnor[o] = _q.x;
        wnor[o + 1] = _q.y;
        wnor[o + 2] = _q.z;
      }
    }
    wgeo.attributes.position.needsUpdate = true;
    wgeo.attributes.normal.needsUpdate = true;
    // its flames, riding along it
    const em = whipFire.geometry.attributes.aEmit;
    for (let f = 0; f < WF; f++) {
      const x = wsAt[f] * WN;
      const i = Math.min(WN - 1, Math.floor(x));
      _q.copy(whipPts[i]).lerp(whipPts[i + 1], x - i);
      em.setXYZ(f, _q.x, _q.y, _q.z);
    }
    em.needsUpdate = true;
    whipFire.material.uniforms.uHeat.value = 0.8 + crack * 0.8 + reach * 0.3;
  };

  // its walk: a stride from the ground it covers, a heavy tread
  const track = createTracker({ fastest: 40 });
  const gait = createStride({ stride: 6.0, hz: 0.8, longest: 1.3, stance: 0.54, cadence: [0.9, 1.3], seed: 13 });
  // each leg on its rig, to the ankle (the great foot kept level beneath
  // it while it's down): the knee where the shin hangs from the thigh
  const RIG = legRig({ knee: [0.95, -1.75], foot: [-0.65, -1.45], rest: [0.04, 0] });
  const update = (t, { rage = 0, whip = 0 } = {}) => {
    U.uTime.value = t;
    const m = track(t, g.position.x, g.position.z, g.rotation.y, g.scale.x);
    const st = gait.step(m.dt, m.fwd < -0.05 ? -m.speed : m.speed);
    const w = st.amount;
    const ra = clamp01(rage);
    const k = clamp01(whip);
    U.uRage.value = ra;
    const ph = st.phase;
    // the near leg's swing (+ forward), for the body's roll and the arms
    const sw = Math.cos(ph);
    // each great foot held where it comes down, kept level, its knee taking
    // up the rest; the stride under the hips, lower the longer it is
    const cx = RIG.home[0] * (1 - w);
    const lower = RIG.sink(st.travel * w, cx) * (0.8 + 0.2 * Math.cos(2 * ph - 0.54 * Math.PI * 2));
    legs.forEach((leg, i) => {
      const f = footAt(st.cycle + (i ? 0.5 : 0), 0.54);
      const [th, sh] = RIG.reach(cx + ((f.x * st.travel) / 2) * w, RIG.home[1] + lower + ra * 0.15 + f.lift * 0.8 * w);
      leg.rotation.z = th;
      leg.rotation.x = (i ? 1 : -1) * 0.04;
      leg.shin.rotation.z = sh;
      leg.shin.foot.rotation.z = 0.04 - th - sh + f.lift * 0.5 * w;
    });
    hips.position.y = rest.hips.y - lower - ra * 0.15;
    // (its roll with the stride in its body, above the hips, so the
    // planted foot isn't swung about with it)
    hips.rotation.x = 0;
    hips.rotation.y = 0;
    tail.rotation.y = Math.sin(t * 0.8) * 0.25 + sw * 0.12 * w;
    tail.rotation.z = Math.sin(t * 0.6 + 1) * 0.08 - ra * 0.15;
    const heave = Math.sin(t * 1.1) * 0.02 + ra * Math.sin(t * 3.3) * 0.02;
    const reach = smooth(0.8, 1, k);
    body.rotation.y = -sw * 0.01 * w;
    body.rotation.x = sw * 0.05 * w;
    body.rotation.z = -0.12 - 0.05 * w + ra * 0.24 + heave - smooth(0.45, 0.75, k) * 0.12 * (1 - reach);
    head.rotation.z = -0.05 + ra * 0.38 + Math.sin(t * 0.7) * 0.04;
    head.rotation.y = Math.sin(t * 0.33) * 0.18 * (1 - ra);
    jaw.rotation.z = -0.08 - ra * (0.45 + Math.sin(t * 7) * 0.05);
    // the sword arm: low, swinging with the walk, raised in its rage
    const [L, R] = arms;
    R.rotation.z = -sw * 0.22 * w + ra * 0.7 + 0.15;
    R.rotation.x = 0.15 + ra * 0.25;
    R.fore.rotation.z = 0.35 + ra * 0.5;
    // the whip arm: up and back, then down and forward with the lash, then
    // up after it as it reaches
    const wu = smooth(0.02, 0.4, k) * (1 - smooth(0.45, 0.72, k));
    const wd = smooth(0.45, 0.72, k);
    L.rotation.z = mix(mix(sw * 0.22 * w + 0.1 + ra * 0.3, 2.9, wu) * (1 - wd) + wd * 1.15, 1.9, reach);
    L.rotation.x = -0.15 - ra * 0.2 - wu * 0.2 + reach * 0.25;
    L.fore.rotation.z = 0.3 + wu * 0.9 - wd * 0.2 + reach * 0.3;
    // the wings: half open, wide in its rage, slowly beating
    const spread = 0.3 + 0.7 * ra;
    const beat = Math.sin(t * 1.2) * (0.06 + 0.1 * ra);
    wings.forEach((wg, i) => {
      const s = i ? 1 : -1;
      wg.rotation.x = -s * (0.6 * (1 - spread) - beat);
      wg.rotation.y = s * (0.9 * (1 - spread) + 0.05);
      wg.rotation.z = -0.15 * (1 - spread) + beat * 0.5;
    });
    buildWhip(t, k);
  };
  update(0);
  return { group: g, update, body, head, arms, legs, wings, tail, sword, whip: whipMesh };
}
