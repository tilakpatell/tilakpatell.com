// The Witch-king on his fell beast. Moved out of props.js as he was.

import * as THREE from 'three';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';
import { clamp01, makeNoise, smooth } from '../../../../lib/paint';
import { hot } from '../../../../lib/three/canvasTexture';
import { ease } from '../../creatures';
import { parts, rng, tube } from '../../shire/build';
import { _kc, bone, C, facet, lump, noise3, rod, spikeAt, sweep, TAU, tint, UP, V3 } from './helpers';

// ── the Witch-king on his fell beast ──

const BEAST = { hide: C(0x2a2724), belly: C(0x433d36), back: C(0x141312), horn: C(0x5a5048), web: C(0x231e1b), vein: C(0x4a3c32), edge: C(0x3a2a24) };

// One wing for side s: an arm out to the wrist, four long fingers from it,
// and the torn membrane between, in two parts that flap about axes along
// their joins so the skin never parts: the inner from the flank (shoulder
// to hip), the outer from the fourth finger.
export function wingParts(K, s, n) {
  const { mats } = K;
  const P = (x, y, z) => V3(x, y, z * s);
  const S = P(0.95, 0.42, 0.45);
  const E = P(0.45, 0.66, 2.4);
  const W = P(1.2, 0.62, 4.15);
  const F = [P(-0.75, 0.52, 7.6), P(-2.1, 0.44, 6.5), P(-2.95, 0.38, 5.0), P(-2.6, 0.3, 3.35)];
  const H = P(-1.5, 0.2, 0.45);
  const frame = (o, axis) => {
    const X = axis.clone().normalize();
    const Y = UP.clone().addScaledVector(X, -X.y).normalize();
    const Z = V3().crossVectors(X, Y);
    return new THREE.Matrix4().makeBasis(X, Y, Z).setPosition(o);
  };
  const Min = frame(S, S.clone().sub(H));
  const Mout = frame(W, F[3].clone().sub(W));
  const inv = (m) => m.clone().invert();
  const sgn = (axis, o, p) => Math.sign(V3().crossVectors(axis.clone().normalize(), p.clone().sub(o)).y) || 1;
  const sIn = sgn(S.clone().sub(H), S, E);
  const sOut = sgn(F[3].clone().sub(W), W, F[0]);
  // the membrane between the leading line L(v) and the trailing line T(v)
  const skinGrid = (L, Tr, nu, nv, { sag = 0.25, holes = 2, seed = 1 } = {}) => {
    const rr = rng(seed);
    const pos = [];
    const col = [];
    const idx = [];
    const cut = [];
    for (let j = 0; j <= nv; j++) cut.push(j === 0 || j === nv ? 0 : rr() * 0.22);
    for (let i = 0; i <= nu; i++) {
      for (let j = 0; j <= nv; j++) {
        const v = j / nv;
        let u = i / nu;
        if (i === nu) u -= cut[j];
        const p = L(v).lerp(Tr(v), u);
        p.y -= sag * Math.sin(Math.PI * u) * Math.sin(Math.PI * v);
        pos.push(p.x, p.y, p.z);
        const near = Math.max(1 - smooth(0, 0.12, u), 1 - smooth(0, 0.1, Math.min(v, 1 - v)));
        _kc.copy(BEAST.web).multiplyScalar(0.8 + noise3(n, p.x * 1.5, p.y, p.z * 1.5) * 0.4).lerp(BEAST.vein, near * 0.6).lerp(BEAST.edge, smooth(0.8, 1, u) * 0.5);
        col.push(_kc.r, _kc.g, _kc.b);
      }
    }
    const skip = new Set();
    for (let h = 0; h < holes; h++) skip.add((nu - 1 - Math.floor(rr() * 2)) * nv + 1 + Math.floor(rr() * (nv - 2)));
    for (let i = 0; i < nu; i++) {
      for (let j = 0; j < nv; j++) {
        if (skip.has(i * nv + j)) continue;
        const a = i * (nv + 1) + j;
        const b = a + nv + 1;
        idx.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return geo;
  };
  const poly = (pts) => {
    const lens = [0];
    for (let i = 1; i < pts.length; i++) lens.push(lens[i - 1] + pts[i].distanceTo(pts[i - 1]));
    const total = lens[lens.length - 1];
    return (v) => {
      const d = v * total;
      let i = 1;
      while (i < pts.length - 1 && lens[i] < d) i++;
      const k = (d - lens[i - 1]) / (lens[i] - lens[i - 1] || 1);
      return pts[i - 1].clone().lerp(pts[i], k);
    };
  };
  const hideTone = (geo) => tint(geo, (x, y, z, out) => out.copy(BEAST.hide).multiplyScalar(0.8 + noise3(n, x * 3, y * 3, z * 3) * 0.4));
  const inner = parts();
  const lead = poly([S, E, W]);
  const trail = (v) => H.clone().lerp(F[3], v).lerp(lead(v), 0.16 * Math.sin(Math.PI * v));
  inner.add(mats.membrane, skinGrid(lead, trail, 6, 10, { sag: 0.3, holes: 2, seed: 11 + s }).applyMatrix4(inv(Min)));
  inner.add(mats.beastHide, hideTone(sweep([S, S.clone().lerp(E, 0.5).add(V3(0, 0.08, 0)), E], [[0.17], [0.12], [0.11]], { seg: 5, radial: 7 })).applyMatrix4(inv(Min)));
  inner.add(mats.beastHide, hideTone(sweep([E, E.clone().lerp(W, 0.5).add(V3(0, 0.04, 0)), W], [[0.11], [0.08], [0.085]], { seg: 5, radial: 7 })).applyMatrix4(inv(Min)));
  inner.add(mats.beastHide, hideTone(lump(0.13, { p: E.toArray() }, { detail: 1 })).applyMatrix4(inv(Min)));
  inner.add(mats.beastHide, hideTone(lump(0.12, { p: W.toArray() }, { detail: 1 })).applyMatrix4(inv(Min)));
  inner.add(mats.beastHorn, spikeAt(W.clone().add(V3(0.05, 0.05, 0)), V3(1, 0.3, 0.15 * s), 0.45, 0.06, 5).applyMatrix4(inv(Min)));
  const outer = parts();
  F.forEach((f, i) => outer.add(mats.beastHide, hideTone(sweep([W, W.clone().lerp(f, 0.5).add(V3(0, 0.05, 0)), f], [[i === 0 ? 0.075 : 0.06], [0.045], [0.018]], { seg: 6, radial: 5 })).applyMatrix4(inv(Mout))));
  for (let i = 0; i < 3; i++) {
    const a = F[i];
    const b = F[i + 1];
    const edge = (v) => a.clone().lerp(b, v).lerp(W, 0.24 * Math.sin(Math.PI * v));
    outer.add(mats.membrane, skinGrid(() => W.clone(), edge, 6, 7, { sag: 0.18, holes: i === 1 ? 2 : 1, seed: 31 + i * 3 + s }).applyMatrix4(inv(Mout)));
  }
  const pivot = new THREE.Group();
  pivot.name = s < 0 ? 'wingL' : 'wingR';
  Min.decompose(pivot.position, pivot.quaternion, pivot.scale);
  const flapIn = bone('flap', pivot);
  inner.build(flapIn, { shadow: false, receive: false });
  const outerPivot = new THREE.Group();
  inv(Min).multiply(Mout).decompose(outerPivot.position, outerPivot.quaternion, outerPivot.scale);
  flapIn.add(outerPivot);
  const flapOut = bone('flapOut', outerPivot);
  outer.build(flapOut, { shadow: false, receive: false });
  return { pivot, flapIn, flapOut, sIn, sOut };
}

// The Witch-king of Angmar on his fell beast, about 15 m from wingtip to
// wingtip: the beast's leathery wings, its snaking neck and hooked beak,
// its barbed tail; on its shoulders the Lord of the Nazgûl, taller than the
// other riders, in his black robes and gauntlets and the spiked crown-helm,
// two pale points of light in the dark under it. Faces +x.
// animate(t, { flap, turn }): `turn` turns his head (radians, + to his
// left), as he feels for the Ring.
export function witchKing(K) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'witchKing';
  const n = makeNoise(733);
  const r = rng(733);
  const body = bone('body', g);
  const hideTone = (geo, { belly = 0, dark = 0 } = {}) =>
    tint(geo, (x, y, z, out, nx, ny) => {
      const m = noise3(n, x * 2.5, y * 2.5, z * 2.5);
      out.copy(BEAST.hide).multiplyScalar(0.78 + m * 0.44);
      out.lerp(BEAST.belly, clamp01(-ny * 0.8) * belly);
      out.lerp(BEAST.back, clamp01(ny) * 0.5 + dark);
    });
  const H = mats.beastHide;
  const bk = parts();
  bk.add(H, hideTone(sweep([[-1.6, 0.0, 0], [-0.7, 0.05, 0], [0.3, 0.12, 0], [1.2, 0.26, 0], [1.85, 0.42, 0]], [[0.4, 0.38, 0.36], [0.6, 0.52, 0.5], [0.78, 0.6, 0.55], [0.66, 0.52, 0.48], [0.38, 0.34, 0.34]], { seg: 12, radial: 14 }), { belly: 1 }));
  for (let i = 0; i < 9; i++) {
    const x = 1.5 - i * 0.36;
    bk.add(mats.beastHorn, spikeAt(V3(x, 0.5 + Math.sin((i / 8) * Math.PI) * 0.12, 0), V3(-0.6, 1, 0), 0.18 + Math.sin((i / 8) * Math.PI) * 0.12, 0.05, 4));
  }
  for (const s of [-1, 1]) {
    bk.add(H, hideTone(sweep([[-0.9, -0.3, s * 0.38], [-1.35, -0.75, s * 0.5], [-1.95, -0.95, s * 0.46]], [[0.24], [0.15], [0.1]], { seg: 6, radial: 8 }), { belly: 0.6 }));
    bk.add(H, hideTone(lump(0.12, { p: [-1.98, -0.97, s * 0.46] }, { detail: 1 })));
    for (let t = 0; t < 3; t++) {
      const z = s * (0.46 + (t - 1) * 0.08);
      bk.add(mats.beastHorn, tube([[-2.0, -0.98, z], [-2.32, -1.04, z * 1.04], [-2.5, -0.92, z * 1.08]], 0.035, 0.008, { seg: 5, radial: 4 }));
    }
  }
  bk.build(body, { shadow: false, receive: false });

  const neckA = bone('neckA', body, [1.75, 0.4, 0]);
  const neckB = bone('neckB', neckA, [1.55, 0.62, 0]);
  const head = bone('head', neckB, [1.45, -0.05, 0]);
  const jaw = bone('jaw', head, [0.25, -0.1, 0]);
  {
    const a = parts();
    a.add(H, hideTone(sweep([[-0.2, -0.05, 0], [0.75, 0.42, 0], [1.6, 0.64, 0]], [[0.4, 0.36], [0.28, 0.26], [0.22, 0.2]], { seg: 9, radial: 10 }), { belly: 0.8 }));
    for (let i = 0; i < 4; i++) a.add(mats.beastHorn, spikeAt(V3(0.2 + i * 0.38, 0.38 + i * 0.12, 0), V3(-0.5, 1, 0), 0.16, 0.04, 4));
    a.build(neckA, { shadow: false, receive: false });
    const b = parts();
    b.add(H, hideTone(sweep([[-0.1, 0.02, 0], [0.7, 0.12, 0], [1.5, -0.05, 0]], [[0.22, 0.2], [0.19, 0.17], [0.17, 0.15]], { seg: 9, radial: 10 }), { belly: 0.8 }));
    b.add(H, hideTone(lump(0.21, { p: [0, 0.02, 0] }, { detail: 1 })));
    for (let i = 0; i < 3; i++) b.add(mats.beastHorn, spikeAt(V3(0.25 + i * 0.4, 0.18, 0), V3(-0.5, 1, 0), 0.13, 0.035, 4));
    b.build(neckB, { shadow: false, receive: false });
    const h = parts();
    h.add(H, hideTone(lump(0.26, { p: [0.12, 0.04, 0], s: [1.35, 0.78, 0.8] }, { detail: 2, amp: 0.08 })));
    h.add(mats.beastHorn, sweep([[0.32, 0.05, 0], [0.72, 0.03, 0], [1.08, -0.04, 0], [1.3, -0.17, 0]], [[0.15, 0.13], [0.11, 0.09], [0.065, 0.055], [0.012, 0.012]], { seg: 9, radial: 8 }));
    for (const s of [-1, 1]) {
      h.add(mats.beastHorn, tube([[0.02, 0.18, s * 0.12], [-0.35, 0.32, s * 0.2], [-0.75, 0.38, s * 0.24]], 0.055, 0.008, { seg: 6, radial: 5 }));
      h.add(mats.beastHorn, tube([[0.0, 0.05, s * 0.18], [-0.3, 0.06, s * 0.3], [-0.55, 0.02, s * 0.36]], 0.04, 0.006, { seg: 5, radial: 4 }));
      h.add(mats.beastEye, new THREE.SphereGeometry(0.028, 6, 4), { p: [0.33, 0.1, s * 0.16] });
    }
    for (let i = 0; i < 3; i++) h.add(mats.beastHorn, spikeAt(V3(-0.05 - i * 0.18, 0.2 - i * 0.02, 0), V3(-0.8, 1, 0), 0.28 - i * 0.05, 0.035, 4));
    h.build(head, { shadow: false, receive: false });
    const j = parts();
    j.add(mats.beastHorn, sweep([[0.0, 0, 0], [0.45, -0.06, 0], [0.88, -0.1, 0]], [[0.09, 0.1], [0.06, 0.06], [0.012, 0.015]], { seg: 7, radial: 7 }));
    j.add(mats.mouth, lump(0.1, { p: [0.25, 0.04, 0], s: [2.2, 0.35, 0.75] }));
    j.build(jaw, { shadow: false, receive: false });
  }

  const tailA = bone('tailA', body, [-1.55, 0.0, 0]);
  const tailB = bone('tailB', tailA, [-2.1, -0.12, 0]);
  {
    const a = parts();
    a.add(H, hideTone(sweep([[0.1, 0, 0], [-1.0, -0.08, 0], [-2.1, -0.12, 0]], [[0.38, 0.34], [0.24, 0.22], [0.16, 0.15]], { seg: 8, radial: 9 }), { belly: 0.6 }));
    for (let i = 0; i < 5; i++) a.add(mats.beastHorn, spikeAt(V3(-0.3 - i * 0.4, 0.2 - i * 0.02, 0), V3(-0.8, 1, 0), 0.14, 0.035, 4));
    a.build(tailA, { shadow: false, receive: false });
    const b = parts();
    b.add(H, hideTone(sweep([[0.05, 0, 0], [-1.2, -0.04, 0], [-2.5, 0.05, 0]], [[0.16, 0.15], [0.1, 0.09], [0.035, 0.035]], { seg: 9, radial: 7 })));
    b.add(mats.beastHorn, facet(new ConvexGeometry([V3(-2.4, 0.05, 0), V3(-2.75, 0.06, 0.2), V3(-2.75, 0.06, -0.2), V3(-3.15, 0.05, 0), V3(-2.7, 0.12, 0), V3(-2.7, 0.0, 0)])));
    b.build(tailB, { shadow: false, receive: false });
  }
  const wings = [-1, 1].map((s) => {
    const w = wingParts(K, s, n);
    body.add(w.pivot);
    return w;
  });

  // the rider: taller than the other Nine, in black robes, gauntleted
  const rider = bone('rider', body, [1.1, 0.6, 0]);
  const R = mats.nazgulRobe;
  {
    const rb = parts();
    rb.add(mats.saddle, new THREE.BoxGeometry(0.75, 0.14, 0.72), { p: [0, 0.05, 0] });
    for (const s of [-1, 1]) {
      rb.add(R, sweep([[0, 0.25, s * 0.18], [0.32, 0.1, s * 0.48], [0.26, -0.5, s * 0.58]], [[0.12], [0.11], [0.1]], { seg: 6, radial: 7 }));
      rb.add(mats.gauntlet, lump(0.08, { p: [0.28, -0.56, s * 0.6], s: [1.4, 0.7, 0.9] }, { detail: 1 }));
    }
    rb.add(R, sweep([[0, 0.1, 0], [0.04, 0.7, 0], [0.12, 1.3, 0]], [[0.32, 0.34], [0.27, 0.32], [0.2, 0.26]], { seg: 6, radial: 12 }));
    // pauldrons of black iron, spiked
    for (const s of [-1, 1]) {
      rb.add(mats.gauntlet, new THREE.SphereGeometry(0.16, 9, 4, 0, TAU, 0, Math.PI / 2).scale(1.1, 0.7, 1).rotateX(-s * 0.4), { p: [0.1, 1.22, s * 0.26] });
      for (let k = 0; k < 3; k++) rb.add(mats.gauntlet, spikeAt(V3(0.04 + k * 0.06, 1.3, s * 0.3), V3(-0.2, 1, s * 0.5), 0.16, 0.022, 4));
    }
    // the arms forward, one to the reins, one holding his mace
    for (const s of [-1, 1]) {
      rb.add(R, sweep([[0.08, 1.15, s * 0.26], [0.38, 0.92, s * 0.3], [0.72, 0.8, s * 0.22]], [[0.085], [0.075], [0.07]], { seg: 5, radial: 7 }));
      rb.add(mats.gauntlet, lump(0.065, { p: [0.76, 0.78, s * 0.2], s: [1.3, 1, 1] }));
      rb.add(mats.gauntlet, spikeAt(V3(0.7, 0.86, s * 0.22), V3(0.3, 1, 0), 0.12, 0.022, 4));
    }
    rb.add(mats.gauntlet, rod([0.78, 0.6, 0.2], [0.86, 1.5, 0.24], 0.022, 0.022, 5));
    rb.add(mats.gauntlet, lump(0.11, { p: [0.87, 1.58, 0.24] }, { detail: 0, amp: 0.2 }));
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * TAU;
      rb.add(mats.gauntlet, spikeAt(V3(0.87, 1.58, 0.24), V3(Math.cos(a), 0.4 * (k % 2 ? -1 : 1), Math.sin(a)), 0.2, 0.03, 4));
    }
    rb.build(rider, { shadow: false, receive: false });
  }
  // his head: the hood, and the crown-helm over it, the light of his eyes
  const riderHead = bone('riderHead', rider, [0.16, 1.38, 0]);
  {
    const hb = parts();
    hb.add(R, lump(0.22, { p: [0.02, 0.04, 0], s: [1.05, 1.0, 0.95] }, { detail: 2, amp: 0.05 }));
    hb.add(mats.void, lump(0.14, { p: [0.15, 0.04, 0], s: [0.55, 0.9, 0.85] }, { detail: 1 }));
    // the helm: a tall iron cone, flaring, a face-plate down over the void
    hb.add(mats.crownHelm, new THREE.CylinderGeometry(0.17, 0.215, 0.3, 10, 1, true).translate(0.02, 0.2, 0));
    hb.add(mats.crownHelm, new THREE.CylinderGeometry(0.2, 0.2, 0.05, 10).translate(0.02, 0.05, 0));
    hb.add(mats.crownHelm, new THREE.BoxGeometry(0.06, 0.24, 0.24).translate(0.22, 0.04, 0));
    hb.add(mats.void, new THREE.BoxGeometry(0.02, 0.035, 0.17).translate(0.255, 0.08, 0));
    // the crown: tall spikes round its rim, the front ones tallest
    for (let k = 0; k < 11; k++) {
      const a = (k / 11) * TAU;
      const front = Math.max(0, Math.cos(a));
      const len = 0.32 + front * 0.26 + (k % 2) * 0.06;
      hb.add(mats.crownHelm, spikeAt(V3(0.02 + Math.cos(a) * 0.17, 0.32, Math.sin(a) * 0.17), V3(Math.cos(a) * 0.22, 1, Math.sin(a) * 0.22), len, 0.03, 4));
    }
    hb.add(mats.crownHelm, spikeAt(V3(0.02, 0.33, 0), V3(-0.05, 1, 0), 0.22, 0.05, 4));
    hb.build(riderHead, { shadow: false, receive: false });
    const eyes = parts();
    for (const s of [-1, 1]) eyes.add(mats.wraithEye, new THREE.SphereGeometry(0.018, 6, 4), { p: [0.258, 0.08, s * 0.045] });
    eyes.build(riderHead, { shadow: false, receive: false });
    const glint = new THREE.Sprite(new THREE.SpriteMaterial({ map: K.tex.glow, color: hot(0xcfe0ff, 1.2), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.6 }));
    glint.position.set(0.27, 0.08, 0);
    glint.scale.setScalar(0.22);
    riderHead.add(glint);
  }
  // the cloak, streaming back from his shoulders: a strip rewritten each frame
  const CW = 5;
  const CH = 8;
  const cloakGeo = new THREE.PlaneGeometry(1, 1, CW, CH);
  const cp = cloakGeo.attributes.position;
  const cloak = new THREE.Mesh(cloakGeo, R);
  cloak.name = 'cloak';
  cloak.frustumCulled = false;
  rider.add(cloak);
  const tatter = Array.from({ length: CW + 1 }, () => r() * 0.5);
  const streamCloak = (t, k) => {
    for (let j = 0; j <= CH; j++) {
      const u = j / CH;
      for (let i = 0; i <= CW; i++) {
        const v = i / CW - 0.5;
        const idx = j * (CW + 1) + i;
        const len = 2.8 - (j === CH ? tatter[i] : 0);
        const x = -u * len;
        const wave = Math.sin(t * 7 - u * 5 + v * 2) * 0.16 * u * k + Math.sin(t * 13 - u * 9) * 0.04 * u;
        cp.setXYZ(idx, 0.02 + x, 1.3 - u * 0.85 + wave, v * (0.6 + u * 0.45) + Math.sin(t * 5 - u * 4) * 0.08 * u);
      }
    }
    cp.needsUpdate = true;
    cloakGeo.computeVertexNormals();
  };

  // its beat carried on from frame to frame, slowing as it glides; how hard
  // it beats and how far he turns his head eased, so nothing jumps
  const E = { t: null, k: null, ph: 0, turn: 0 };
  const animate = (t, { flap = 1, turn = 0 } = {}) => {
    const dt = E.t == null || t < E.t ? 0 : Math.min(0.1, t - E.t);
    E.t = t;
    E.k = E.k == null ? clamp01(flap) : ease(E.k, clamp01(flap), dt, 2.5);
    E.turn = ease(E.turn, turn, dt, 3);
    const k = E.k;
    E.ph += dt * 2.6 * (0.65 + 0.35 * k);
    const ph = E.ph;
    const w = Math.sin(ph) + 0.25 * Math.sin(ph * 2);
    const up = 0.12 + 0.55 * w * k;
    const tip = 0.08 + 0.48 * (Math.sin(ph - 0.7) + 0.25 * Math.sin(ph * 2 - 1.4)) * k;
    for (const W of wings) {
      W.flapIn.rotation.x = W.sIn * up;
      W.flapOut.rotation.x = W.sOut * tip;
    }
    body.position.y = -Math.cos(ph) * 0.2 * k;
    body.rotation.z = Math.cos(ph) * 0.03 * k;
    neckA.rotation.z = Math.sin(ph + 1) * 0.06 + Math.sin(t * 0.6) * 0.04;
    neckA.rotation.y = Math.sin(t * 0.45) * 0.12;
    neckB.rotation.z = -Math.sin(ph + 1.6) * 0.08;
    neckB.rotation.y = Math.sin(t * 0.45 - 0.6) * 0.18;
    head.rotation.z = Math.sin(ph + 2.2) * 0.06 - 0.08;
    head.rotation.y = Math.sin(t * 0.7) * 0.15;
    jaw.rotation.z = -0.08 - 0.42 * Math.pow(Math.max(0, Math.sin(t * 0.8)), 6);
    tailA.rotation.y = Math.sin(t * 1.1) * 0.1;
    tailA.rotation.z = Math.sin(ph - 1) * 0.06 * k;
    tailB.rotation.y = Math.sin(t * 1.1 - 0.9) * 0.22;
    tailB.rotation.z = Math.sin(ph - 1.8) * 0.1 * k;
    rider.rotation.z = Math.cos(ph) * 0.03 * k;
    // he turns his head, and leans a little into it, and lifts his face
    const tr = Math.max(-1.5, Math.min(1.5, E.turn));
    riderHead.rotation.set(0, tr, Math.abs(tr) * 0.12 + Math.sin(t * 0.9) * 0.02, 'YZX');
    rider.rotation.y = tr * 0.25;
    streamCloak(t, 0.6 + k * 0.4);
  };
  animate(0);
  return { group: g, body, head, jaw, wings, rider, riderHead, animate };
}
