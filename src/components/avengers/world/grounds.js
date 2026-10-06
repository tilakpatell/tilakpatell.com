// The compound, the world: what's about the grounds besides the buildings.
// Benches and planters of shrubs, the flags inside the gate (flying), the
// plant on the roofs and the main building's comms mast, the parapets you
// land behind, and the rings of the swing tour. Where they stand is in
// ./rules.js; this draws them.
//
// staticGrounds(add, M) adds the parts that never move to the scene's merged
// statics; createFlags(scene, M) and createRings(scene) are the moving ones.

import * as THREE from 'three';
import { hot } from '../hq/engine';
import { canvasTexture } from '../hq/kit/shapes';
import { BENCHES, COMMS, FLAGS, FLAG_H, PLANTERS, RING_R, ROOF_PLANT, TOUR, V } from './rules';

const UP = new THREE.Vector3(0, 1, 0);
const m4 = new THREE.Matrix4();
const q = new THREE.Quaternion();
const one = new THREE.Vector3(1, 1, 1);
// a geometry turned by `yaw` and stood at (x, y, z)
const placed = (geo, x, y, z, yaw = 0) => geo.applyMatrix4(m4.compose(new THREE.Vector3(x, y, z), q.setFromAxisAngle(UP, yaw), one));

// Benches, planters, flagpoles, the roof plant and the comms mast, as
// geometry for the scene's merged statics: add(geo, material, opts).
// M: { steel, concrete, wood, soil, plant, dark, white }
export function staticGrounds(add, M) {
  // a bench: two concrete ends, a seat and a back of wooden slats; its front is +z
  for (const b of BENCHES) {
    for (const k of [-0.78, 0.78]) add(placed(new THREE.BoxGeometry(0.16, 0.46, 0.56).translate(k, 0.23, 0), b.x, 0, b.z, b.yaw), M.concrete);
    for (const k of [-0.17, 0, 0.17]) add(placed(new THREE.BoxGeometry(1.84, 0.05, 0.13).translate(0, 0.48, k), b.x, 0, b.z, b.yaw), M.wood);
    for (const y of [0.66, 0.84]) add(placed(new THREE.BoxGeometry(1.84, 0.12, 0.04).rotateX(-0.18).translate(0, y, -0.29 - (y - 0.66) * 0.18), b.x, 0, b.z, b.yaw), M.wood);
    for (const k of [-0.78, 0.78]) add(placed(new THREE.BoxGeometry(0.05, 0.42, 0.05).translate(k, 0.7, -0.3), b.x, 0, b.z, b.yaw), M.steel);
  }
  // a planter: a round concrete pot, soil in it (the shrubs go in it later)
  for (const p of PLANTERS) {
    add(new THREE.CylinderGeometry(0.72, 0.66, 0.62, 28).translate(p.x, 0.31, p.z), M.concrete);
    add(new THREE.CylinderGeometry(0.64, 0.64, 0.04, 24).translate(p.x, 0.6, p.z), M.soil, { cast: false });
  }
  // the flagpoles: on a plinth, a ball on top
  for (const f of FLAGS) {
    add(new THREE.CylinderGeometry(0.5, 0.56, 0.3, 20).translate(f.x, 0.15, f.z), M.concrete);
    add(new THREE.CylinderGeometry(0.05, 0.09, FLAG_H, 10).translate(f.x, FLAG_H / 2 + 0.3, f.z), M.steel);
    add(new THREE.SphereGeometry(0.12, 12, 8).translate(f.x, FLAG_H + 0.36, f.z), M.gold);
  }
  // air handlers on the roofs: a cabinet, louvres down its sides, two fans on top
  for (const u of ROOF_PLANT) {
    const xs = u.foot.map(([x]) => x * 1.6);
    const zs = u.foot.map(([, y]) => y * 1.6);
    const [x0, x1, z0, z1] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
    const w = x1 - x0;
    const d = z1 - z0;
    const h = u.h - u.y0;
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    add(new THREE.BoxGeometry(w, h - 0.2, d).translate(cx, u.y0 + 0.2 + (h - 0.2) / 2, cz), M.white);
    add(new THREE.BoxGeometry(w + 0.1, 0.2, d + 0.1).translate(cx, u.y0 + 0.1, cz), M.dark);
    for (let k = 1; k < 6; k++) {
      const y = u.y0 + 0.35 + ((h - 0.7) * k) / 6;
      add(new THREE.BoxGeometry(w + 0.04, 0.05, 0.04).translate(cx, y, z0 - 0.02), M.dark, { cast: false });
      add(new THREE.BoxGeometry(w + 0.04, 0.05, 0.04).translate(cx, y, z1 + 0.02), M.dark, { cast: false });
    }
    for (const k of [-0.25, 0.25]) {
      const fx = cx + w * k;
      add(new THREE.CylinderGeometry(Math.min(w, d) * 0.22, Math.min(w, d) * 0.22, 0.12, 24).translate(fx, u.h + 0.06, cz), M.steel);
      add(new THREE.CylinderGeometry(Math.min(w, d) * 0.19, Math.min(w, d) * 0.19, 0.02, 24).translate(fx, u.h + 0.13, cz), M.dark, { cast: false });
    }
  }
  // the comms mast on the main building's roof, and its dish
  {
    const x = COMMS.x * 1.6;
    const z = COMMS.y * 1.6;
    const y0 = 13 * V;
    add(new THREE.BoxGeometry(1.1, 0.3, 1.1).translate(x, y0 + 0.15, z), M.concrete);
    add(new THREE.CylinderGeometry(0.09, 0.14, COMMS.h, 10).translate(x, y0 + COMMS.h / 2, z), M.steel);
    for (const y of [y0 + COMMS.h * 0.55, y0 + COMMS.h * 0.85]) add(new THREE.BoxGeometry(1.4, 0.06, 0.06).translate(x, y, z), M.steel);
    for (const k of [-0.65, 0.65]) add(new THREE.CylinderGeometry(0.03, 0.03, 1.6, 6).translate(x + k, y0 + COMMS.h * 0.85 + 0.8, z), M.steel);
    // the dish: a shallow cup tipped up toward the southern sky
    const dish = new THREE.SphereGeometry(1.6, 28, 10, 0, Math.PI * 2, 0, 0.62).scale(1, 0.5, 1).rotateX(Math.PI).rotateX(0.95);
    add(placed(dish, x, y0 + COMMS.h * 0.45, z + 0.7, 0.35), M.white);
    add(placed(new THREE.CylinderGeometry(0.03, 0.03, 1.5, 6).rotateX(0.95).translate(0, 0.45, 0.55), x, y0 + COMMS.h * 0.45, z + 0.7, 0.35), M.steel);
  }
}

// The flags, flying: Old Glory between two of the compound's own (navy, a
// white star), each rippling out from its pole in the breeze.
const usFlag = () =>
  canvasTexture(512, 270, (x, w, h) => {
    const stripe = h / 13;
    for (let i = 0; i < 13; i++) {
      x.fillStyle = i % 2 ? '#ffffff' : '#b22234';
      x.fillRect(0, i * stripe, w, stripe + 1);
    }
    const cw = w * 0.4;
    const ch = stripe * 7;
    x.fillStyle = '#3c3b6e';
    x.fillRect(0, 0, cw, ch);
    x.fillStyle = '#ffffff';
    const star = (cx, cy, r) => {
      x.beginPath();
      for (let k = 0; k < 10; k++) {
        const a = -Math.PI / 2 + (k * Math.PI) / 5;
        const rr = k % 2 ? r * 0.4 : r;
        x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
      }
      x.closePath();
      x.fill();
    };
    for (let row = 0; row < 9; row++) {
      const n = row % 2 ? 5 : 6;
      for (let c = 0; c < n; c++) star(((c * 2 + (row % 2 ? 2 : 1)) * cw) / 12, ((row + 1) * ch) / 10, ch * 0.038);
    }
  });
const starFlag = () =>
  canvasTexture(512, 270, (x, w, h) => {
    x.fillStyle = '#1b2a4a';
    x.fillRect(0, 0, w, h);
    x.strokeStyle = '#f2f4f6';
    x.lineWidth = 10;
    x.strokeRect(14, 14, w - 28, h - 28);
    x.fillStyle = '#f2f4f6';
    x.beginPath();
    for (let k = 0; k < 10; k++) {
      const a = -Math.PI / 2 + (k * Math.PI) / 5;
      const r = k % 2 ? h * 0.12 : h * 0.3;
      x.lineTo(w / 2 + Math.cos(a) * r, h / 2 + Math.sin(a) * r);
    }
    x.closePath();
    x.fill();
  });

export function createFlags(scene) {
  const time = { value: 0 };
  const group = new THREE.Group();
  const W = 2.6;
  const H = 1.4;
  const geo = new THREE.PlaneGeometry(W, H, 16, 6).translate(W / 2, 0, 0);
  const maps = [starFlag(), usFlag(), starFlag()];
  const mats = maps.map((map, i) => {
    const m = new THREE.MeshStandardMaterial({ map, side: THREE.DoubleSide, roughness: 0.85, metalness: 0 });
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = time;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;')
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          {
            // the further from the pole, the more it ripples
            float k = position.x / ${W.toFixed(2)};
            float ph = uTime * 4.2 + ${(i * 1.7).toFixed(2)};
            transformed.z += (sin(position.x * 2.4 - ph) * 0.22 + sin(position.x * 4.1 - ph * 1.3 + position.y * 1.5) * 0.08) * k;
            transformed.y -= k * k * 0.12;
          }`,
        );
    };
    return m;
  });
  FLAGS.forEach((f, i) => {
    const mesh = new THREE.Mesh(geo, mats[i]);
    mesh.position.set(f.x + 0.06, FLAG_H - H / 2 - 0.05, f.z);
    // flying downwind, to the north east
    mesh.rotation.y = 0.8;
    mesh.receiveShadow = true;
    group.add(mesh);
  });
  scene.add(group);
  return {
    update(t) {
      time.value = t;
    },
    dispose() {
      geo.dispose();
      for (const m of mats) {
        m.map.dispose();
        m.dispose();
      }
    },
  };
}

// The swing tour's rings: the next one red and pulsing, the ones after it
// faint, the ones gone through out of the way; before a tour, only the first.
// The glow round the next ring: brightest where its tube faces you, gone at
// its edges, so it's a soft halo, not a flat orange band beside the ring.
function ringGlow() {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(0xff4b3e) }, uOpacity: { value: 0 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    vertexShader: /* glsl */ `
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity;
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        float facing = abs(dot(normalize(vN), normalize(vV)));
        gl_FragColor = vec4(uColor * pow(facing, 2.5) * uOpacity, 1.0);
      }`,
  });
}

export function createRings(scene) {
  const group = new THREE.Group();
  const geo = new THREE.TorusGeometry(RING_R, 0.14, 12, 72);
  const glowGeo = new THREE.TorusGeometry(RING_R, 0.42, 8, 72);
  const Z = new THREE.Vector3(0, 0, 1);
  const rings = TOUR.map((r) => {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4, depthWrite: false, toneMapped: false });
    const glowMat = ringGlow();
    const g = new THREE.Group();
    g.add(new THREE.Mesh(geo, mat), new THREE.Mesh(glowGeo, glowMat));
    g.position.set(r.x, r.y, r.z);
    g.quaternion.setFromUnitVectors(Z, new THREE.Vector3(...r.n));
    g.renderOrder = 6;
    group.add(g);
    return { g, mat, glowMat };
  });
  const red = hot(0xff4b3e, 2.2);
  const white = new THREE.Color(0xe8eef6);
  scene.add(group);
  return {
    // tour: rules' newTour/stepTour state
    update(tour, t) {
      rings.forEach(({ g, mat, glowMat }, i) => {
        const next = i === tour.next;
        const ahead = tour.on ? i > tour.next : i > 0;
        g.visible = next || (ahead && tour.on) || (!tour.on && i === 0);
        if (!g.visible) return;
        const pulse = 0.5 + 0.5 * Math.sin(t * 5);
        mat.color.copy(next ? red : white);
        mat.opacity = next ? 0.95 : 0.28;
        glowMat.uniforms.uOpacity.value = next ? 0.3 + pulse * 0.3 : 0;
        glowMat.visible = next;
        g.scale.setScalar(next ? 1 + pulse * 0.04 : 1);
      });
    },
    dispose() {
      geo.dispose();
      glowGeo.dispose();
      for (const r of rings) {
        r.mat.dispose();
        r.glowMat.dispose();
      }
      scene.remove(group);
    },
  };
}
