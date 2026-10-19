// Inside the Mountain: the Sammath Naur, the spur over the Crack of Doom,
// its walls lit from below. Moved out of props.js as it was; its haze and
// sparks come from the kit (K.shaders).

import * as THREE from 'three';
import { hot } from '../../../../lib/three/canvasTexture';
import { clamp01, fbm, makeNoise, mix, smooth } from '../../../../lib/paint';
import { boxUV, rng } from '../../shire/build';
import { cardCloud, facet, geoOf, glowSprite, hullRock, noise3, oneGeo, spikeAt, tint, V3 } from './helpers';
import { ASH } from './plain';

// ── inside the Mountain ──

// A wall of the cavern: a grid from `o` along U (uLen) and V (vLen), facing
// `into` the cavern and pushed that way by `bulge(u, v)`, minus a `hole(u, v)`.
function wallGeo(o, U, Vv, uLen, vLen, nu, nv, bulge, hole = () => false, into = null) {
  const N = V3().crossVectors(U, Vv).normalize();
  const flip = into && N.dot(into) < 0;
  if (flip) N.negate();
  const pos = [];
  const idx = [];
  for (let j = 0; j <= nv; j++) {
    for (let i = 0; i <= nu; i++) {
      const u = (i / nu) * uLen;
      const v = (j / nv) * vLen;
      const p = o.clone().addScaledVector(U, u).addScaledVector(Vv, v).addScaledVector(N, bulge(u, v));
      pos.push(p.x, p.y, p.z);
    }
  }
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) {
      if (hole(((i + 0.5) / nu) * uLen, ((j + 0.5) / nv) * vLen)) continue;
      const a = j * (nu + 1) + i;
      if (flip) idx.push(a, a + nu + 1, a + 1, a + 1, a + nu + 1, a + nu + 2);
      else idx.push(a, a + 1, a + nu + 1, a + 1, a + nu + 2, a + nu + 1);
    }
  }
  return geoOf(pos, idx);
}

// The Sammath Naur, the Chambers of Fire: the tunnel in from the door
// comes out at x = 0 through a sheer wall, onto a narrow jagged spur of
// rock 1.6 m wide, its top at y = 0, running out along +x to its broken tip
// at x = 14 over the Crack of Doom: a chasm 30 m across and 40 deep, lava
// flowing at its bottom, its glow coming up red on the cavern's walls and
// roof, haze and sparks rising. update(t, { erupt }): the fire rises,
// fiercer, flames bursting up out of it.
export function sammathNaur(K) {
  const { mats, U } = K;
  const g = new THREE.Group();
  g.name = 'sammathNaur';
  const n = makeNoise(4101);
  const r = rng(4101);
  const DEEP = 40;
  const X1 = 31;
  const Z = 34;
  const TOP = 30;
  const rough = (a, b, k = 1) => (fbm(n, a * 0.09 * k, b * 0.09 * k, { octaves: 4 }) - 0.5) * 7 + (n(a * 0.6, b * 0.6) - 0.5) * 0.8;
  const pieces = [];
  // the near wall, the tunnel's mouth through it
  const mouth = (u, v) => Math.abs(u - Z) < 2.3 && v > DEEP - 1 && v < DEEP + 4.8;
  pieces.push(
    wallGeo(V3(0, -DEEP - 4, -Z), V3(0, 0, 1), V3(0, 1, 0), Z * 2, DEEP + TOP + 4, 48, 50, (u, v) => {
      const calm = smooth(3, 8, Math.hypot(u - Z, (v - DEEP - 2) * 0.7));
      return (rough(u, v) - 4) * calm - 0.3 * (1 - calm);
    }, mouth, V3(1, 0, 0)),
  );
  // the far wall, and the sides
  pieces.push(wallGeo(V3(X1, -DEEP - 4, Z), V3(0, 0, -1), V3(0, 1, 0), Z * 2, DEEP + TOP + 4, 40, 44, (u, v) => rough(u + 50, v) - 3, undefined, V3(-1, 0, 0)));
  pieces.push(wallGeo(V3(-2, -DEEP - 4, Z), V3(1, 0, 0), V3(0, 1, 0), X1 + 4, DEEP + TOP + 4, 22, 44, (u, v) => rough(u + 90, v) - 2 + smooth(20, 0, Math.abs(u - 15)) * -6, undefined, V3(0, 0, -1)));
  pieces.push(wallGeo(V3(X1 + 2, -DEEP - 4, -Z), V3(-1, 0, 0), V3(0, 1, 0), X1 + 4, DEEP + TOP + 4, 22, 44, (u, v) => rough(u + 130, v) - 2, undefined, V3(0, 0, 1)));
  // the roof, fangs of rock hanging from it
  pieces.push(wallGeo(V3(-2, TOP, -Z - 2), V3(1, 0, 0), V3(0, 0, 1), X1 + 4, Z * 2 + 4, 22, 40, (u, v) => rough(u + 170, v, 1.4) * 1.4 - 6 * smooth(10, 0, Math.min(u, X1 + 4 - u)), undefined, V3(0, -1, 0)));
  for (let i = 0; i < 24; i++) {
    const x = 1 + r() * (X1 - 2);
    const z = (r() - 0.5) * Z * 1.8;
    pieces.push(facet(spikeAt(V3(x, TOP + 2, z), V3((r() - 0.5) * 0.2, -1, (r() - 0.5) * 0.2), 4 + r() * 9, 0.8 + r() * 1.4, 5)));
  }
  // the tunnel in from the door, rough-walled, its floor at y = 0
  {
    const L = 16;
    const SEG = 16;
    const RAD = 14;
    const pos = [];
    const idx = [];
    for (let k = 0; k <= SEG; k++) {
      const x = -(k / SEG) * L + 0.4;
      for (let j = 0; j <= RAD; j++) {
        const a = Math.PI * (j / RAD);
        const w = 2.3 + (n(k * 0.7, j * 0.5) - 0.5) * 0.5;
        const h = 4.6 + (n(k * 0.5 + 9, j * 0.4) - 0.5) * 0.6;
        const z = Math.cos(a) * w;
        const y = Math.max(-0.05, Math.sin(a) * h * (j === 0 || j === RAD ? 0 : 1) + (j === 0 || j === RAD ? -0.05 : 0));
        pos.push(x, y, z);
      }
    }
    for (let k = 0; k < SEG; k++) for (let j = 0; j < RAD; j++) {
      const a = k * (RAD + 1) + j;
      idx.push(a, a + RAD + 1, a + 1, a + 1, a + RAD + 1, a + RAD + 2);
    }
    pieces.push(facet(geoOf(pos, idx)));
    const floor = new THREE.PlaneGeometry(L, 4.6, 8, 2).rotateX(-Math.PI / 2).translate(-L / 2 + 0.4, -0.02, 0);
    pieces.push(facet(floor));
  }
  // the spur: a tongue of rock out over the chasm, flat enough on top to
  // walk, ragged at its edges, thinning to its broken tip
  {
    const NX = 30;
    const sec = [];
    const pos = [];
    const idx = [];
    for (let i = 0; i <= NX; i++) {
      const x = (i / NX) * 14.3;
      const f = x / 14;
      const w = 0.8 * (1 + 1.4 * smooth(2.5, 0, x)) + (n(x * 2.1, 3) - 0.5) * 0.14;
      const deep = mix(9, 0.9, Math.pow(f, 0.7)) + (n(x * 0.9, 7) - 0.5) * 1.2;
      const tip = x > 13.4 ? (x - 13.4) * 1.2 : 0;
      const top = (n(x * 3.3, 1) - 0.5) * 0.05 - tip * 0.3;
      const pts = [
        [-w, top - 0.02],
        [-w * 0.5, top + 0.01],
        [0, top + 0.02],
        [w * 0.5, top + 0.01],
        [w, top - 0.02],
        [w * 1.05, top - 0.35 - n(x * 4, 5) * 0.3],
        [w * 0.7, -deep * 0.55],
        [w * 0.15, -deep],
        [-w * 0.2, -deep * 0.9],
        [-w * 0.75, -deep * 0.5],
        [-w * 1.05, top - 0.3 - n(x * 4, 9) * 0.35],
      ];
      sec.push(pts.map(([z, y]) => [x, y, z * (1 - tip * 0.6)]));
    }
    const M = sec[0].length;
    for (const row of sec) for (const p of row) pos.push(...p);
    for (let i = 0; i < NX; i++) for (let k = 0; k < M; k++) {
      const a = i * M + k;
      const b = i * M + ((k + 1) % M);
      idx.push(a, b, a + M, b, b + M, a + M);
    }
    // the broken tip, closed
    const e = NX * M;
    const c = pos.length / 3;
    pos.push(14.4, -0.4, 0);
    for (let k = 0; k < M; k++) idx.push(e + k, e + ((k + 1) % M), c);
    pieces.push(facet(geoOf(pos, idx)));
  }
  // boulders fallen on the ledge by the mouth
  for (let i = 0; i < 6; i++) pieces.push(hullRock(4200 + i, [0.4 + r() * 0.4, 0.3 + r() * 0.3, 0.4], [-0.5 - r() * 0.5, 0.1, (i % 2 ? 1 : -1) * (1.9 + r() * 0.6)], 10));
  const geo = oneGeo(pieces);
  boxUV(geo, 0.25);
  tint(geo, (x, y, z, o, nx, ny) => {
    o.copy(ASH.base).multiplyScalar(0.55 + noise3(n, x * 0.3, y * 0.3, z * 0.3) * 0.6);
    o.lerp(ASH.dark, smooth(-5, -DEEP, y) * 0.6);
    if (ny > 0.6 && y > -3) o.lerp(ASH.ash, 0.35);
    o.lerp(ASH.rust, smooth(0.6, 0.75, noise3(n, x * 0.15 + 4, y * 0.15, z * 0.15)) * 0.3);
  });
  const rock = new THREE.Mesh(geo, mats.cavern);
  rock.name = 'chambersOfFire';
  g.add(rock);

  // the fire at the bottom of the Crack
  const lavaGeo = new THREE.PlaneGeometry(X1 + 6, Z * 2 + 6, 24, 40).rotateX(-Math.PI / 2);
  {
    const p = lavaGeo.attributes.position;
    const u2 = lavaGeo.attributes.uv;
    for (let i = 0; i < p.count; i++) u2.setXY(i, p.getX(i), p.getZ(i));
  }
  const lava = new THREE.Mesh(lavaGeo, mats.crackLava);
  lava.position.set(X1 / 2, -DEEP, 0);
  lava.name = 'crackOfDoom';
  g.add(lava);
  const hazeMat = K.shaders.haze(U);
  for (let i = 0; i < 5; i++) {
    const card = new THREE.Mesh(new THREE.PlaneGeometry(40, DEEP + 10), hazeMat);
    const a = (i / 5) * Math.PI;
    card.position.set(X1 / 2 + Math.cos(a) * 3, -DEEP / 2 + 4, Math.sin(a) * 8 - 4);
    card.rotation.y = a * 0.4 - 0.3;
    card.renderOrder = 3;
    g.add(card);
  }
  const NS = 220;
  const ss = new Float32Array(NS * 4);
  for (let i = 0; i < NS; i++) ss.set([r(), r(), r(), r()], i * 4);
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NS * 3), 3));
  sg.setAttribute('aSeed', new THREE.BufferAttribute(ss, 4));
  const sparkMat = K.shaders.spark(U);
  sparkMat.uniforms.uSpan.value.set(X1, DEEP + 20, Z * 1.4);
  const sparks = new THREE.Points(sg, sparkMat);
  sparks.position.set(X1 / 2, -DEEP, 0);
  sparks.frustumCulled = false;
  sparks.renderOrder = 4;
  g.add(sparks);
  const burst = [];
  for (let i = 0; i < 40; i++) burst.push(V3(2 + r() * (X1 - 4), 0, (r() - 0.5) * Z * 1.4));
  const flames = cardCloud(mats.burst, burst, 4301);
  flames.position.y = -DEEP;
  g.add(flames);
  const glow = glowSprite(K.tex.glow, hot(0xff4a12, 0.6), 60, 0.2, false);
  glow.position.set(X1 / 2, -DEEP + 6, 0);
  g.add(glow);
  const tmp = V3();
  const update = (t, { erupt = 0 } = {}) => {
    const e = clamp01(erupt);
    U.uTime.value = t;
    U.uErupt.value = e;
    lava.position.y = -DEEP + e * 12 + Math.sin(t * 0.7) * 0.15;
    flames.position.y = lava.position.y;
    g.updateWorldMatrix(true, false);
    mats.cavern.userData.lavaY.value = g.localToWorld(tmp.set(0, lava.position.y, 0)).y;
    mats.cavern.userData.fire.value = (1 + 1.4 * e) * (0.92 + 0.08 * Math.sin(t * 2.3) * Math.sin(t * 1.3));
    mats.crackLava.uniforms.uHeat.value = 0.95 + 0.55 * e;
    hazeMat.uniforms.uK.value = 1 + 1.5 * e;
    sparkMat.uniforms.uK.value = 1 + 2 * e;
    if (K.renderer) {
      const v = new THREE.Vector2();
      K.renderer.getDrawingBufferSize(v);
      sparkMat.uniforms.uScale.value = v.y * 0.9;
    }
    mats.burst.uniforms.uK.value = e * 1.4;
    flames.visible = e > 0.01;
    glow.material.opacity = 0.2 + 0.4 * e;
  };
  update(0);
  return { group: g, tip: V3(14, 0, 0), door: V3(0, 0, 0), update };
}
