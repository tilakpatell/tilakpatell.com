// Gwaihir the Windlord: feathers, wings and all, rigged to fly. Moved out
// of props.js as he was.

import * as THREE from 'three';
import { clamp01, makeNoise, mix, smooth } from '../../../../lib/paint';
import { parts, rng, tube } from '../../shire/build';
import { ease } from '../../creatures';
import { bone, C, geoOf, lump, noise3, rod, solid, spikeAt, sweep, TAU, tint, V3 } from './helpers';

// ── Gwaihir ──

const EAGLE = {
  gold: C(0x9a6428),
  brown: C(0x4e3018),
  dark: C(0x22140a),
  pale: C(0xeadcb8),
  cream: C(0xc8a874),
  nape: C(0xc8902e),
  beak: C(0xd8b048),
  tip: C(0x2a2218),
  yellow: C(0xe0b030),
  talon: C(0x121010),
  under: C(0x8a6a44),
};

// One feather, lying flat in x-z, from its root at the origin out along +x:
// `len` long, `wid` wide, its tip rounded, bending down a little.
export function featherGeo(len, wid, droop = 0.06) {
  const s = new THREE.Shape();
  s.moveTo(0, -wid * 0.28);
  s.quadraticCurveTo(len * 0.5, -wid * 0.55, len * 0.9, -wid * 0.38);
  s.quadraticCurveTo(len * 1.03, 0, len * 0.88, wid * 0.42);
  s.quadraticCurveTo(len * 0.5, wid * 0.55, 0, wid * 0.28);
  s.lineTo(0, -wid * 0.28);
  const g = new THREE.ShapeGeometry(s, 4).rotateX(Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, -droop * len * (p.getX(i) / len) ** 2);
  g.computeVertexNormals();
  return g;
}

// Gwaihir the Windlord, the great eagle: about 14 m from wingtip to wingtip,
// golden-brown, darker in his flight feathers, his head and nape pale gold,
// a great hooked beak, fierce brows over golden eyes; the long primaries
// spread like fingers at his wingtips; a broad fanned tail; yellow feet and
// black talons. Faces +x. animate(t, { flap, glide, reach }): flap 0..1
// the beat of his wings, glide 0..1 holding them out still, reach 0..1
// bringing his talons down and forward, open, to take someone up.
export function eagle(K) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'gwaihir';
  const n = makeNoise(6101);
  const body = bone('body', g);
  const F = mats.eagle;
  const Hn = mats.eagleHorn;
  const plume = (base, { dark = 0, under = 0, mott = 0.35, to = null, k = 0 } = {}) => (geo) =>
    tint(geo, (x, y, z, out, nx, ny) => {
      out.copy(base).multiplyScalar(1 - mott * 0.5 + noise3(n, x * 2.5, y * 2.5, z * 2.5) * mott);
      if (to) out.lerp(to, k);
      if (dark) out.lerp(EAGLE.dark, dark);
      if (under) out.lerp(EAGLE.under, clamp01(-ny) * under);
    });
  const build = (grp, fn) => {
    const bk = parts();
    fn(bk);
    bk.build(grp, { shadow: false, receive: false });
  };
  // the body: a deep chest, narrowing to the tail; a ruff of golden hackles
  // about the nape, feathered thighs
  build(body, (bk) => {
    bk.add(F, plume(EAGLE.brown, { under: 0.5 })(sweep([[-1.7, 0.1, 0], [-0.8, 0.0, 0], [0.2, 0.04, 0], [1.0, 0.22, 0], [1.5, 0.44, 0]], [[0.3, 0.32, 0.26], [0.56, 0.56, 0.42], [0.68, 0.6, 0.48], [0.52, 0.46, 0.42], [0.33, 0.32, 0.32]], { seg: 14, radial: 16 })), { uv: 1.6 });
    const r = rng(6111);
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * TAU;
      const at = V3(1.35 + r() * 0.15, 0.45 + Math.sin(a) * 0.3, Math.cos(a) * 0.32);
      bk.add(F, plume(EAGLE.nape, { to: EAGLE.gold, k: r() * 0.5 })(spikeAt(at, V3(-1, Math.sin(a) * 0.3, Math.cos(a) * 0.3), 0.55 + r() * 0.2, 0.12, 4)), { uv: 2 });
    }
    // the back's coverts in rows, lying over one another
    for (let i = 0; i < 16; i++) {
      const x = 0.9 - (i % 8) * 0.28;
      const z = (i < 8 ? -1 : 1) * (0.12 + (i % 3) * 0.08);
      bk.add(F, plume(EAGLE.gold, { to: EAGLE.brown, k: 0.4 })(featherGeo(0.7, 0.3, 0.1).rotateZ(0.12).translate(0, 0, 0).rotateY(Math.PI + z * 0.6).translate(x, 0.6 - Math.abs(x - 0.2) * 0.12, z)), { uv: 2 });
    }
    for (const s of [-1, 1]) bk.add(F, plume(EAGLE.brown, { dark: 0.15 })(lump(0.34, { p: [-0.25, -0.4, s * 0.32], s: [1.3, 1.05, 0.85] }, { detail: 2, amp: 0.18, seed: 4 })), { uv: 2 });
  });

  // the neck and the head: pale gold, the brows heavy, the beak hooked
  const neck = bone('neck', body, [1.42, 0.45, 0]);
  build(neck, (bk) => {
    bk.add(F, plume(EAGLE.cream, { to: EAGLE.nape, k: 0.3 })(sweep([[0, 0, 0], [0.32, 0.17, 0], [0.62, 0.28, 0]], [[0.34, 0.33], [0.28, 0.28], [0.25, 0.25]], { seg: 6, radial: 12 })), { uv: 2.2 });
  });
  const head = bone('head', neck, [0.66, 0.3, 0]);
  build(head, (bk) => {
    bk.add(F, plume(EAGLE.pale, { mott: 0.2, to: EAGLE.cream, k: 0.2 })(lump(0.27, { p: [0.04, 0.06, 0], s: [1.3, 1.0, 0.9] }, { detail: 2, amp: 0.06, seed: 7 })), { uv: 3 });
    for (const s of [-1, 1]) {
      // the brow, jutting over the eye: the frown
      bk.add(F, plume(EAGLE.pale, { mott: 0.15, to: EAGLE.cream, k: 0.5 })(lump(0.12, { p: [0.2, 0.14, s * 0.13], s: [1.0, 0.32, 0.62], r: [s * 0.25, 0, -0.32] }, { detail: 1, amp: 0.05 })), { uv: 3 });
      bk.add(mats.eagleEye, new THREE.SphereGeometry(0.046, 12, 8), { p: [0.21, 0.075, s * 0.152] });
      bk.add(Hn, solid(new THREE.SphereGeometry(0.022, 8, 6), EAGLE.talon), { p: [0.245, 0.077, s * 0.168] });
      // the gape, a dark line back from the beak
      bk.add(Hn, solid(new THREE.BoxGeometry(0.14, 0.012, 0.012), C(0x3a2a1a)), { p: [0.32, -0.04, s * 0.085], r: [0, s * 0.35, -0.1] });
    }
    // the cere, yellow, and the beak: deep, narrow, hooked over at its tip
    bk.add(Hn, solid(lump(0.1, { p: [0.29, 0.05, 0], s: [0.55, 0.62, 0.9] }, { detail: 1, amp: 0.03 }), EAGLE.yellow));
    const beak = (geo) => tint(geo, (x, y, z, out) => out.copy(EAGLE.beak).lerp(EAGLE.tip, smooth(0.5, 0.7, x)));
    bk.add(Hn, beak(sweep([[0.27, 0.03, 0], [0.45, 0.04, 0], [0.6, -0.01, 0], [0.67, -0.12, 0], [0.62, -0.24, 0]], [[0.1, 0.075, 0.09], [0.085, 0.06, 0.08], [0.065, 0.045, 0.06], [0.04, 0.03, 0.04], [0.006, 0.006, 0.006]], { seg: 14, radial: 10 })));
    bk.add(Hn, beak(sweep([[0.28, -0.08, 0], [0.44, -0.1, 0], [0.55, -0.14, 0]], [[0.045, 0.06], [0.035, 0.045], [0.008, 0.01]], { seg: 6, radial: 8 })));
  });

  // the tail: a fan of broad feathers, barred
  const tail = bone('tail', body, [-1.62, 0.1, 0]);
  build(tail, (bk) => {
    for (let i = 0; i < 12; i++) {
      const a = Math.PI + ((i - 5.5) / 5.5) * 0.42;
      const len = 1.55 - Math.abs(i - 5.5) * 0.03;
      const geo = featherGeo(len, 0.36, 0.05).rotateY(-a).translate(0, (i % 2) * 0.012, 0);
      bk.add(F, tint(geo, (x, y, z, out) => {
        const d = Math.hypot(x, z);
        out.copy(EAGLE.brown).lerp(EAGLE.dark, 0.25 + 0.35 * smooth(0.4, 0.6, Math.sin(d * 11) * 0.5 + 0.5)).lerp(EAGLE.dark, smooth(1.1, 1.5, d) * 0.6);
      }), { uv: 1.5 });
    }
  });

  // the wings: the arm out to the wrist, its broad inner panel scalloped at
  // the trailing edge by the secondaries; the hand, and the primaries
  // splayed from it like fingers
  const wings = [-1, 1].map((s) => {
    const P = (x, y, z) => V3(x, y, z * s);
    const S = P(0.55, 0.38, 0.42);
    const E = P(0.78, 0.5, 2.5);
    const W = P(0.5, 0.52, 4.1);
    const pivot = bone(s < 0 ? 'wingL' : 'wingR', body, S.toArray());
    const flapIn = bone('flap', pivot);
    const wristAt = W.clone().sub(S);
    const wrist = bone('wrist', flapIn, wristAt.toArray());
    const flapOut = bone('flapOut', wrist);
    const panel = (lead, trail, nu, nv, { scallop = 12, camber = 0.12, colour }) => {
      const pos = [];
      const idx = [];
      for (let i = 0; i <= nu; i++) {
        const u = i / nu;
        const a = lead(u);
        const b = trail(u);
        for (let j = 0; j <= nv; j++) {
          const v = j / nv;
          const cut = j === nv ? 1 - 0.09 * Math.abs(Math.sin(Math.PI * scallop * u)) : 1;
          const p = a.clone().lerp(b, v * cut);
          p.y += camber * Math.sin(Math.PI * v) * (1 - u * 0.5);
          pos.push(p.x, p.y, p.z);
        }
      }
      for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
        const a = i * (nv + 1) + j;
        const b = a + nv + 1;
        idx.push(a, b, a + 1, a + 1, b, b + 1);
      }
      return tint(geoOf(pos, idx), colour);
    };
    const poly = (pts) => (u) => {
      const k = u * (pts.length - 1);
      const i = Math.min(pts.length - 2, Math.floor(k));
      return pts[i].clone().lerp(pts[i + 1], k - i);
    };
    const wingTone = (x, y, z, out) => {
      // coverts golden over the arm, the flight feathers darker behind
      const back = clamp01((0.6 - x) / 1.6);
      out.copy(EAGLE.gold).lerp(EAGLE.brown, smooth(0.15, 0.55, back)).lerp(EAGLE.dark, smooth(0.65, 1, back) * 0.45);
      out.multiplyScalar(1.0 + noise3(n, x * 3, y * 3, z * 3) * 0.3);
    };
    const inner = parts();
    const lead = poly([S, E, W].map((p) => p.clone().sub(S)));
    const trail = poly([P(-0.95, 0.32, 0.5), P(-1.05, 0.44, 2.4), P(-0.75, 0.5, 4.1)].map((p) => p.sub(S)));
    inner.add(F, panel(lead, trail, 16, 6, { colour: wingTone }), { uv: 1.4 });
    inner.add(F, plume(EAGLE.gold, { to: EAGLE.brown, k: 0.3 })(sweep([S, S.clone().lerp(E, 0.5).add(V3(0.05, 0.06, 0)), E, W].map((p) => p.clone().sub(S)), [[0.2, 0.22], [0.15, 0.17], [0.12, 0.13], [0.1, 0.1]], { seg: 12, radial: 8 })), { uv: 1.6 });
    inner.build(flapIn, { shadow: false, receive: false });
    const outer = parts();
    // the hand: broad, its outer edge running back from the leading edge
    const H0 = P(0.45, 0.52, 4.1).sub(W);
    const H1 = P(0.25, 0.5, 5.25).sub(W);
    const T0 = P(-0.75, 0.5, 4.1).sub(W);
    const T1 = P(-0.7, 0.5, 4.95).sub(W);
    outer.add(F, panel(poly([H0, H1]), poly([T0, T1]), 6, 4, { scallop: 0, camber: 0.08, colour: wingTone }), { uv: 1.4 });
    outer.add(F, plume(EAGLE.gold, { to: EAGLE.brown, k: 0.4 })(sweep([V3(), H1.clone().multiplyScalar(0.55), H1.clone()], [[0.1], [0.075], [0.04]], { seg: 6, radial: 6 })), { uv: 1.6 });
    // the primaries from its outer edge, splayed like fingers, the
    // outermost a little shorter
    for (let i = 0; i < 6; i++) {
      const f = i / 5;
      const root = H1.clone().lerp(T1, f).add(V3(0.05, 0, -s * 0.55));
      const a = mix(-0.14, 0.5, f);
      const len = 2.75 + Math.sin(f * Math.PI * 0.8) * 0.3 - (i === 0 ? 0.3 : 0) - f * 0.5;
      const geo = featherGeo(len, 0.42 - f * 0.03, 0.05).rotateY(-(Math.PI / 2) * s).rotateY(-a * s).translate(root.x, root.y + i * 0.008, root.z);
      outer.add(F, tint(geo, (x, y, z, out) => {
        const d = Math.hypot(x - root.x, z - root.z);
        out.copy(EAGLE.brown).lerp(EAGLE.dark, 0.35 + 0.5 * smooth(0.4, 2.2, d)).multiplyScalar(0.85 + noise3(n, x * 4, y * 4, z * 4) * 0.3);
      }), { uv: 1.4 });
    }
    outer.build(flapOut, { shadow: false, receive: false });
    return { s, pivot, flapIn, wrist, flapOut };
  });

  // the legs, tucked back in flight: feathered high, yellow and scaled
  // below; four toes, three forward and one back, each with its talon
  const legs = [-1, 1].map((s) => {
    const hip = bone(s < 0 ? 'legL' : 'legR', body, [-0.25, -0.45, s * 0.3]);
    build(hip, (bk) => {
      bk.add(F, plume(EAGLE.brown, { dark: 0.1 })(lump(0.17, { p: [0, -0.2, 0], s: [1, 1.5, 1] }, { detail: 1, amp: 0.12 })), { uv: 2 });
      bk.add(Hn, tint(rod([0, -0.3, 0], [0, -0.82, 0], 0.075, 0.065, 8), (x, y, z, out) => out.copy(EAGLE.yellow).multiplyScalar(0.8 + 0.2 * Math.sin(y * 70))));
    });
    const foot = bone('foot', hip, [0, -0.84, 0]);
    build(foot, (bk) => bk.add(Hn, solid(lump(0.08, { s: [1.2, 0.8, 1.1] }, { detail: 1, amp: 0.05 }), EAGLE.yellow)));
    const toes = [0.42, 0, -0.42, Math.PI].map((a, i) => {
      const toe = bone('toe', foot, [0, -0.02, 0]);
      toe.rotation.y = a;
      const curl = bone('curl', toe);
      const L = i === 3 ? 0.24 : 0.34;
      build(curl, (bk) => {
        bk.add(Hn, solid(tube([[0, 0, 0], [L * 0.5, -0.01, 0], [L, -0.03, 0]], 0.042, 0.03, { seg: 4, radial: 6 }), EAGLE.yellow));
        bk.add(Hn, solid(tube([[L - 0.02, -0.02, 0], [L + 0.07, -0.02, 0], [L + 0.12, -0.08, 0], [L + 0.1, -0.16, 0]], 0.03, 0.004, { seg: 8, radial: 5 }), EAGLE.talon));
      });
      return curl;
    });
    return { hip, foot, toes, s };
  });

  // the beat carried on from frame to frame, slower gliding; flap, glide
  // and the talons' reach eased, so a change never jumps a wing or a leg
  const E = { t: null, fl: null, gl: 0, rc: 0, ph: 0 };
  const animate = (t, { flap = 1, glide = 0, reach = 0 } = {}) => {
    const dt = E.t == null || t < E.t ? 0 : Math.min(0.1, t - E.t);
    E.t = t;
    E.fl = E.fl == null ? clamp01(flap) : ease(E.fl, clamp01(flap), dt, 2.5);
    E.gl = ease(E.gl, clamp01(glide), dt, 2.5);
    E.rc = dt === 0 && E.rc === 0 ? clamp01(reach) : ease(E.rc, clamp01(reach), dt, 5);
    const gl = E.gl;
    const k = E.fl * (1 - gl);
    const rc = E.rc;
    E.ph += dt * 2.4 * (0.6 + 0.4 * k);
    const ph = E.ph;
    const w = Math.sin(ph) + 0.22 * Math.sin(ph * 2);
    const up = mix(0.1 + 0.035 * Math.sin(t * 0.8), 0.12 + 0.62 * w, k);
    const tip = mix(-0.06 + 0.03 * Math.sin(t * 1.1), 0.05 + 0.5 * (Math.sin(ph - 0.7) + 0.2 * Math.sin(ph * 2 - 1.4)), k);
    const sweepBack = k * 0.22 * Math.max(0, -Math.cos(ph));
    for (const W of wings) {
      W.flapIn.rotation.set(-W.s * up, W.s * sweepBack * 0.5, 0);
      W.flapOut.rotation.set(-W.s * tip, W.s * sweepBack, 0);
    }
    body.position.y = -Math.cos(ph) * 0.22 * k;
    body.rotation.z = 0.04 * Math.cos(ph) * k + 0.22 * rc;
    // the head held steady, looking about
    neck.rotation.z = -body.rotation.z * 0.7 + Math.sin(t * 0.5) * 0.03;
    head.rotation.set(0, Math.sin(t * 0.37) * 0.18, -0.05 - 0.15 * rc);
    tail.rotation.set(0, Math.sin(t * 0.6) * 0.04, -0.25 * rc + Math.cos(ph) * 0.05 * k);
    for (const L of legs) {
      L.hip.rotation.z = mix(-1.35, 0.6, smooth(0, 1, rc));
      L.hip.rotation.x = L.s * 0.12 * rc;
      L.foot.rotation.z = mix(1.0, -0.35, rc);
      L.toes.forEach((c, i) => {
        c.rotation.z = mix(-0.9, i === 3 ? 0.1 : 0.15, rc);
      });
    }
  };
  animate(0);
  return { group: g, body, head, wings, legs, animate };
}
