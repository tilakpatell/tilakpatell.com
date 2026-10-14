// The things in the courses, made in code: spinning coins (gold, red, blue),
// Power Stars with their eyes (a star already got is a pale ghost of one),
// 1-Up mushrooms, signs, doors and star doors, the castle's paintings of
// each world (they ripple when Mario jumps in), and the props: trees,
// pines, boulders, the waterfall, the flag, the stained-glass window and the
// chandeliers. Each is { root, update(a, t, g) }.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { paintingMaterial, waterfallMaterial } from '../nodes';
import { COLORS, canvasTexture, cone, cylinder, mesh, pbr, sphere, starShape, torus } from './common';

const COIN = { yellow: '#ffc93a', red: '#ff2b2b', blue: '#3b7bff' };

// a coin: one turned shape, its rim raised round a dished face
const COIN_GEO = (() => {
  const pts = [
    [0, -0.05],
    [0.26, -0.045],
    [0.31, -0.07],
    [0.36, -0.06],
    [0.37, 0],
    [0.36, 0.06],
    [0.31, 0.07],
    [0.26, 0.045],
    [0, 0.05],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  return new THREE.LatheGeometry(pts, 40).rotateX(Math.PI / 2);
})();
// (a loaded coin, its gold the kind's colour, one material a kind)
const coinMats = new Map();
function coinLook(hd, kind) {
  hd.traverse((o) => {
    if (!o.isMesh) return;
    const key = `${kind}:${o.material.uuid}`;
    if (!coinMats.has(key)) {
      const m = o.material.clone();
      m.color.set(COIN[kind]);
      m.emissive?.set(COIN[kind]).multiplyScalar(0.18);
      coinMats.set(key, m);
    }
    o.material = coinMats.get(key);
    o.castShadow = false;
  });
  hd.position.y = -0.37;
  return hd;
}
function coin(a, hd) {
  const kind = a?.def?.kind ?? 'yellow';
  const root = new THREE.Group();
  const spin = new THREE.Group();
  spin.position.y = 0.5;
  root.add(spin);
  if (hd) spin.add(coinLook(hd, kind));
  else spin.add(mesh(COIN_GEO, pbr(COIN[kind], { rough: 0.22, metal: 1, emissive: COIN[kind], emissiveIntensity: 0.18 }), { shadow: false }));
  return {
    root,
    update(_, t) {
      spin.rotation.y = t * 0.16;
    },
  };
}

function star(a, hd) {
  const ghost = Boolean(a?.got);
  if (hd) {
    const root = new THREE.Group();
    const spin = new THREE.Group();
    spin.position.y = 0.85;
    root.add(spin);
    hd.position.y = -0.62;
    spin.add(hd);
    // one already got: a see-through blue ghost of itself
    if (ghost)
      hd.traverse((o) => {
        if (!o.isMesh) return;
        o.material = pbr('#9fd2ff', { rough: 0.1, metal: 0.2, transparent: true, opacity: 0.55, emissive: '#5aa8ff', emissiveIntensity: 0.4 });
      });
    return {
      root,
      update(_, t) {
        spin.rotation.y = t * 0.09;
        spin.position.y = 0.85 + Math.sin(t * 0.08) * 0.08;
      },
    };
  }
  const gold = ghost
    ? pbr('#9fd2ff', { rough: 0.1, metal: 0.2, transparent: true, opacity: 0.55, emissive: '#5aa8ff', emissiveIntensity: 0.4 })
    : pbr('#ffd23a', { rough: 0.18, metal: 1, emissive: '#ffb000', emissiveIntensity: 0.45 });
  const geo = new THREE.ExtrudeGeometry(starShape(0.62, 0.28), { depth: 0.16, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.1, bevelSegments: 4, curveSegments: 6 });
  geo.translate(0, 0, -0.08);
  const root = new THREE.Group();
  const spin = new THREE.Group();
  spin.position.y = 0.85;
  root.add(spin);
  const m = mesh(geo, gold);
  m.userData.own = true;
  spin.add(m);
  for (const sx of [-1, 1]) spin.add(mesh(sphere(), pbr('#141414', { rough: 0.1, clearcoat: 1 }), { x: sx * 0.09, y: 0.08, z: 0.19, sx: 0.035, sy: 0.08, sz: 0.03 }));
  return {
    root,
    update(_, t) {
      spin.rotation.y = t * 0.09;
      spin.position.y = 0.85 + Math.sin(t * 0.08) * 0.08;
    },
  };
}

function oneup(_, hd) {
  if (hd) {
    const root = new THREE.Group();
    root.add(hd);
    return {
      root,
      update(_, t) {
        root.position.y = Math.abs(Math.sin(t * 0.15)) * 0.1;
      },
    };
  }
  const spots = canvasTexture('m64-oneup', 256, 128, (g, w, h) => {
    g.fillStyle = '#29b34a';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#f6f6ef';
    for (const [x, y, r] of [
      [0.25, 0.45, 0.14],
      [0.75, 0.45, 0.14],
      [0.5, 0.25, 0.1],
    ]) {
      g.beginPath();
      g.arc(x * w, y * h, r * w * 0.5, 0, Math.PI * 2);
      g.fill();
    }
  });
  const root = new THREE.Group();
  root.add(mesh(new THREE.SphereGeometry(0.42, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), spots ? pbr('#ffffff', { rough: 0.35, clearcoat: 0.8, map: spots }) : pbr('#29b34a', { rough: 0.35 }), { y: 0.35 }));
  root.add(mesh(cylinder(0.9, 1, 32), pbr('#f6eedc', { rough: 0.5 }), { y: 0.2, sx: 0.24, sy: 0.32, sz: 0.24 }));
  for (const sx of [-1, 1]) root.add(mesh(sphere(), pbr('#141414', { rough: 0.1 }), { x: sx * 0.08, y: 0.24, z: 0.22, sx: 0.03, sy: 0.06, sz: 0.02 }));
  return {
    root,
    update(_, t) {
      root.position.y = Math.abs(Math.sin(t * 0.15)) * 0.1;
    },
  };
}

function sign(a, hd) {
  const root = new THREE.Group();
  if (hd) {
    root.add(hd);
    return { root, update() {} };
  }
  const wood = pbr('#8a5a32', { rough: 0.8 });
  root.add(mesh(cylinder(1, 1, 12), wood, { y: 0.55, sx: 0.08, sy: 1.1, sz: 0.08 }));
  const board = canvasTexture(`m64-sign-${(a?.def?.title ?? 'Sign').length}`, 256, 160, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#b07a46');
    grad.addColorStop(1, '#8a5a32');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(60,30,10,0.35)';
    for (let y = 18; y < h; y += 26) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(w, y + 4);
      g.stroke();
    }
    g.fillStyle = '#2a1508';
    g.font = 'bold 60px Georgia, serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('?', w / 2, h / 2);
  });
  root.add(mesh(new THREE.BoxGeometry(1.0, 0.62, 0.08), board ? pbr('#ffffff', { rough: 0.75, map: board }) : wood, { y: 1.15 }));
  return { root, update() {} };
}

function doorModel(a) {
  const root = new THREE.Group();
  const wood = pbr('#6b3d1e', { rough: 0.6, clearcoat: 0.2 });
  const frame = pbr('#c9b28a', { rough: 0.55 });
  const brass = pbr(COLORS.gold, { rough: 0.25, metal: 1 });
  const w = (a?.def?.w ?? 260) * 0.01, h = (a?.def?.dh ?? 400) * 0.01;
  // an arched double door in a stone frame
  for (const sx of [-1, 1]) {
    root.add(mesh(new THREE.BoxGeometry(w / 2 - 0.04, h - 0.1, 0.12), wood, { x: (sx * w) / 4, y: (h - 0.1) / 2 }));
    root.add(mesh(sphere(), brass, { x: sx * 0.12, y: h * 0.45, z: 0.09, sx: 0.05, sy: 0.05, sz: 0.05 }));
  }
  root.add(mesh(new THREE.BoxGeometry(w + 0.3, 0.18, 0.3), frame, { y: h }));
  for (const sx of [-1, 1]) root.add(mesh(new THREE.BoxGeometry(0.15, h, 0.3), frame, { x: (sx * (w + 0.15)) / 2, y: h / 2 }));
  if (a?.type === 'stardoor') {
    const star = mesh(new THREE.ExtrudeGeometry(starShape(0.32, 0.14), { depth: 0.04, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02 }), pbr('#ffd23a', { rough: 0.2, metal: 1, emissive: '#ffb000', emissiveIntensity: 0.4 }), { y: h * 0.62, z: 0.08 });
    star.userData.own = true;
    root.add(star);
    const n = a.def.need;
    const label = canvasTexture(`m64-door-${n}`, 128, 128, (g, cw, ch) => {
      g.clearRect(0, 0, cw, ch);
      g.fillStyle = '#ffe9a8';
      g.font = '900 84px "Luckiest Guy", "Arial Black", sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(String(n), cw / 2, ch / 2 + 4);
    });
    if (label) root.add(mesh(new THREE.PlaneGeometry(0.42, 0.42), pbr('#ffffff', { map: label, transparent: true, rough: 0.6 }), { y: h * 0.3, z: 0.08, shadow: false }));
  }
  const parts = root.children.filter((c) => c.material === wood);
  return {
    root,
    update(d) {
      // an open star door stands open
      if (d.type === 'stardoor') parts.forEach((p, i) => (p.rotation.y = d.open ? (i ? 1.3 : -1.3) : 0));
    },
  };
}

// ─── The paintings ─────────────────────────────────────────────────────────
const SCENES = {
  bobomb(g, w, h) {
    sky(g, w, h, '#6fb6ff', '#d8f0ff');
    hill(g, w, h, 0.68, '#4fae4a', 0.55);
    // the mountain with its path and a Bob-omb
    g.fillStyle = '#6d8f3d';
    g.beginPath();
    g.moveTo(w * 0.18, h * 0.78);
    g.lineTo(w * 0.5, h * 0.22);
    g.lineTo(w * 0.82, h * 0.78);
    g.fill();
    g.strokeStyle = '#c9a36a';
    g.lineWidth = w * 0.03;
    g.beginPath();
    g.moveTo(w * 0.28, h * 0.74);
    g.quadraticCurveTo(w * 0.62, h * 0.62, w * 0.42, h * 0.48);
    g.quadraticCurveTo(w * 0.36, h * 0.38, w * 0.56, h * 0.3);
    g.stroke();
    g.fillStyle = '#1c1c22';
    g.beginPath();
    g.arc(w * 0.72, h * 0.82, w * 0.08, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#fff';
    g.fillRect(w * 0.7, h * 0.79, w * 0.012, h * 0.03);
    g.fillRect(w * 0.73, h * 0.79, w * 0.012, h * 0.03);
  },
  snow(g, w, h) {
    sky(g, w, h, '#8fb8e8', '#eef6ff');
    g.fillStyle = '#e8f1ff';
    g.beginPath();
    g.moveTo(0, h);
    g.lineTo(w * 0.45, h * 0.2);
    g.lineTo(w, h);
    g.fill();
    g.fillStyle = '#c4d8f2';
    g.beginPath();
    g.moveTo(w * 0.45, h * 0.2);
    g.lineTo(w * 0.62, h * 0.55);
    g.lineTo(w * 0.52, h * 0.5);
    g.fill();
    // a penguin
    g.fillStyle = '#16202c';
    g.beginPath();
    g.ellipse(w * 0.3, h * 0.8, w * 0.06, h * 0.1, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#fff';
    g.beginPath();
    g.ellipse(w * 0.3, h * 0.83, w * 0.035, h * 0.07, 0, 0, Math.PI * 2);
    g.fill();
  },
  beach(g, w, h) {
    sky(g, w, h, '#4fb4ff', '#c8ecff');
    g.fillStyle = '#1f8fd6';
    g.fillRect(0, h * 0.55, w, h * 0.45);
    g.fillStyle = '#f2dca0';
    g.beginPath();
    g.ellipse(w * 0.5, h * 0.9, w * 0.6, h * 0.18, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#6b4a24';
    g.lineWidth = w * 0.025;
    g.beginPath();
    g.moveTo(w * 0.2, h * 0.85);
    g.quadraticCurveTo(w * 0.24, h * 0.6, w * 0.3, h * 0.45);
    g.stroke();
    g.fillStyle = '#2e9c3a';
    for (const a of [-0.9, -0.3, 0.3, 0.9]) {
      g.beginPath();
      g.ellipse(w * 0.3 + Math.cos(a) * w * 0.08, h * 0.45 + Math.sin(a) * h * 0.04, w * 0.1, h * 0.025, a, 0, Math.PI * 2);
      g.fill();
    }
  },
  haunt(g, w, h) {
    sky(g, w, h, '#1a1030', '#4a3a70');
    g.fillStyle = '#2a2238';
    g.fillRect(w * 0.22, h * 0.4, w * 0.56, h * 0.45);
    g.beginPath();
    g.moveTo(w * 0.18, h * 0.42);
    g.lineTo(w * 0.5, h * 0.18);
    g.lineTo(w * 0.82, h * 0.42);
    g.fill();
    g.fillStyle = '#ffd86a';
    for (const [x, y] of [
      [0.32, 0.5],
      [0.6, 0.5],
      [0.46, 0.66],
    ])
      g.fillRect(w * x, h * y, w * 0.08, h * 0.1);
    // a Boo
    g.fillStyle = 'rgba(255,255,255,0.92)';
    g.beginPath();
    g.arc(w * 0.78, h * 0.25, w * 0.09, 0, Math.PI * 2);
    g.fill();
  },
  bowser(g, w, h) {
    sky(g, w, h, '#2a0606', '#a8230c');
    g.fillStyle = '#ff5a14';
    g.fillRect(0, h * 0.7, w, h * 0.3);
    g.fillStyle = '#331410';
    g.fillRect(w * 0.1, h * 0.62, w * 0.8, h * 0.06);
    // the Bowser emblem
    g.fillStyle = '#2c8a2a';
    g.beginPath();
    g.arc(w * 0.5, h * 0.4, w * 0.18, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#f7e9c0';
    for (const a of [-0.8, 0, 0.8]) {
      g.beginPath();
      g.moveTo(w * 0.5 + Math.sin(a) * w * 0.16, h * 0.4 - Math.cos(a) * h * 0.16);
      g.lineTo(w * 0.5 + Math.sin(a) * w * 0.26, h * 0.4 - Math.cos(a) * h * 0.26);
      g.lineTo(w * 0.5 + Math.sin(a + 0.15) * w * 0.16, h * 0.4 - Math.cos(a + 0.15) * h * 0.16);
      g.fill();
    }
  },
};
function sky(g, w, h, top, bottom) {
  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, top);
  grad.addColorStop(1, bottom);
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
}
function hill(g, w, h, y, color, r) {
  g.fillStyle = color;
  g.beginPath();
  g.ellipse(w * 0.5, h * (y + r), w * 0.8, h * r, 0, 0, Math.PI * 2);
  g.fill();
}

// a painting: its course's picture in a gold frame; `ripple` (0…1) for the
// wave across it when he jumps in
function painting(a) {
  const course = a?.def?.course ?? 'bobomb';
  const pw = (a?.def?.w ?? 600) * 0.01, ph = (a?.def?.h ?? 600) * 0.01;
  const art = canvasTexture(`m64-painting-${course}`, 512, 512, (g, w, h) => {
    (SCENES[course] ?? SCENES.bobomb)(g, w, h);
    // a painted look: brush grain over it
    g.globalAlpha = 0.06;
    for (let i = 0; i < 900; i++) {
      g.fillStyle = i % 2 ? '#fff' : '#000';
      g.fillRect(((i * 7919) % w) | 0, ((i * 104729) % h) | 0, 6, 2);
    }
    g.globalAlpha = 1;
  });
  const root = new THREE.Group();
  const canvas = new THREE.PlaneGeometry(pw, ph, 48, 48);
  // (the ripple pushes the canvas's vertices: ../nodes.js)
  const { material: mat, uniforms } = paintingMaterial(art);
  const pic = mesh(canvas, mat, { y: ph / 2, z: 0.06, shadow: false });
  pic.userData.own = true;
  root.add(pic);
  const gold = pbr(COLORS.gold, { rough: 0.3, metal: 1 });
  const t = 0.16;
  for (const [x, y, w, h] of [
    [0, ph + t / 2, pw + 2 * t, t],
    [0, -t / 2, pw + 2 * t, t],
    [-(pw + t) / 2, ph / 2, t, ph],
    [(pw + t) / 2, ph / 2, t, ph],
  ])
    root.add(mesh(new THREE.BoxGeometry(w, h, 0.18), gold, { x, y, z: 0.05 }));
  return {
    root,
    uniforms,
    update(p, tt) {
      uniforms.uTime.value = tt / 30;
      uniforms.uRipple.value = Math.max(0, (p.cool ?? 0) / 90);
    },
  };
}

// ─── Props ─────────────────────────────────────────────────────────────────
// a tree's crown: soft blobs in three greens, one mesh
const CROWN = (() => {
  const blobs = [
    [0, 4.4, 0, 1.9],
    [1.0, 3.8, 0.4, 1.3],
    [-0.9, 3.9, -0.3, 1.4],
    [0.2, 3.6, -1.0, 1.2],
    [-0.3, 5.3, 0.3, 1.2],
  ];
  const greens = ['#3f8f2c', '#4fa83a', '#357a26'].map((c) => new THREE.Color(c));
  const parts = blobs.map(([x, y, z, r], i) => {
    const g = new THREE.IcosahedronGeometry(r, 3);
    g.scale(1, 0.9, 1);
    g.translate(x, y, z);
    const n = g.attributes.position.count;
    const col = new Float32Array(n * 3);
    for (let k = 0; k < n; k++) greens[i % 3].toArray(col, k * 3);
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
  });
  return mergeGeometries(parts);
})();
const crownMat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.85, sheen: 0.3, sheenColor: '#9be07a' });
// (a loaded prop, at the prop's size)
function hdProp(p, hd, y = 0) {
  const root = new THREE.Group();
  hd.position.y = y;
  root.add(hd);
  root.scale.setScalar(p?.s ?? 1);
  return { root, update() {} };
}

function tree(p, hd) {
  if (hd) return hdProp(p, hd);
  const root = new THREE.Group();
  const bark = pbr('#6a4a2e', { rough: 0.9 });
  root.add(mesh(cylinder(0.7, 1, 16), bark, { y: 1.6, sx: 0.32, sy: 3.2, sz: 0.32 }));
  root.add(mesh(CROWN, crownMat));
  root.scale.setScalar(p?.s ?? 1);
  return { root, update() {} };
}

function pine(p, hd) {
  if (hd) return hdProp(p, hd);
  const root = new THREE.Group();
  root.add(mesh(cylinder(0.7, 1, 12), pbr('#5a3a22', { rough: 0.9 }), { y: 1, sx: 0.28, sy: 2, sz: 0.28 }));
  const needles = pbr('#2b6b3a', { rough: 0.9, sheen: 0.2 });
  for (let i = 0; i < 4; i++) root.add(mesh(cone(18), needles, { y: 2.2 + i * 1.1, sx: 2.2 - i * 0.45, sy: 2.2, sz: 2.2 - i * 0.45 }));
  root.scale.setScalar(p?.s ?? 1);
  return { root, update() {} };
}

function rock(p, hd) {
  if (hd) return hdProp(p, hd, -0.9);
  const root = new THREE.Group();
  const geo = new THREE.DodecahedronGeometry(1, 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const k = 0.82 + 0.3 * Math.abs(Math.sin(i * 12.9898) * 43758.5453 % 1);
    pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * k * 0.7, pos.getZ(i) * k);
  }
  geo.computeVertexNormals();
  const m = mesh(geo, pbr('#77705f', { rough: 0.92 }), { y: 0.55, sx: 1.6, sy: 1.6, sz: 1.6 });
  m.userData.own = true;
  root.add(m);
  root.scale.setScalar(p?.s ?? 1);
  return { root, update() {} };
}

function flag() {
  const root = new THREE.Group();
  root.add(mesh(cylinder(1, 1, 10), pbr('#d8d8d8', { rough: 0.3, metal: 1 }), { y: 1.5, sx: 0.05, sy: 3, sz: 0.05 }));
  const cloth = new THREE.PlaneGeometry(1.4, 0.9, 16, 6);
  const base = cloth.attributes.position.array.slice();
  const m = mesh(cloth, pbr('#e52521', { rough: 0.8, sheen: 0.5, side: THREE.DoubleSide }), { x: 0.72, y: 2.5 });
  m.userData.own = true;
  root.add(m);
  return {
    root,
    update(_, t) {
      const pos = cloth.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = base[i * 3];
        pos.setZ(i, Math.sin(x * 4 - t * 0.25) * 0.12 * (x + 0.7));
      }
      pos.needsUpdate = true;
    },
  };
}

function waterfall() {
  const root = new THREE.Group();
  // (the streaks run down it in its output: ../nodes.js)
  const { material: mat, uniforms } = waterfallMaterial();
  const sheet = mesh(new THREE.PlaneGeometry(3, 8, 1, 1), mat, { y: 4, shadow: false });
  sheet.userData.own = true;
  root.add(sheet);
  return {
    root,
    update(_, t) {
      uniforms.uTime.value = t / 30;
    },
  };
}

function windowGlass() {
  const art = canvasTexture('m64-window', 512, 512, (g, w, h) => {
    g.fillStyle = '#20154a';
    g.fillRect(0, 0, w, h);
    const colors = ['#ff6fb0', '#ffd94a', '#6fd0ff', '#ff8a3a', '#b48aff', '#7fe08a'];
    for (let r = 0; r < 6; r++)
      for (let i = 0; i < 12; i++) {
        g.fillStyle = colors[(i + r) % colors.length];
        g.beginPath();
        g.moveTo(w / 2, h / 2);
        g.arc(w / 2, h / 2, w * 0.48 - r * w * 0.06, (i / 12) * Math.PI * 2, ((i + 1) / 12) * Math.PI * 2);
        g.fill();
      }
    g.strokeStyle = '#1a1206';
    g.lineWidth = 6;
    for (let i = 0; i < 12; i++) {
      g.beginPath();
      g.moveTo(w / 2, h / 2);
      g.lineTo(w / 2 + Math.cos((i / 12) * Math.PI * 2) * w * 0.48, h / 2 + Math.sin((i / 12) * Math.PI * 2) * h * 0.48);
      g.stroke();
    }
    // the princess, in profile, crowned
    g.fillStyle = '#ffe9c8';
    g.beginPath();
    g.arc(w / 2, h * 0.5, w * 0.14, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#ffd23a';
    g.fillRect(w * 0.42, h * 0.33, w * 0.16, h * 0.06);
    g.fillStyle = '#ff6fb0';
    g.fillRect(w * 0.36, h * 0.62, w * 0.28, h * 0.18);
  });
  const root = new THREE.Group();
  const glass = art ? pbr('#ffffff', { map: art, rough: 0.15, emissive: '#ffffff', emissiveIntensity: 0.45 }) : pbr('#8a7ad0', { rough: 0.2 });
  root.add(mesh(new THREE.CircleGeometry(2.4, 64), glass, { shadow: false }));
  root.add(mesh(torus(0.08), pbr(COLORS.gold, { rough: 0.3, metal: 1 }), { sx: 2.45, sy: 2.45, sz: 2.45 }));
  if (art) glass.emissiveMap = art;
  return { root, update() {} };
}

function chandelier(p, hd) {
  // (it hangs from where it's placed)
  if (hd) return hdProp(p, hd, -2.6);
  const root = new THREE.Group();
  const gold = pbr(COLORS.gold, { rough: 0.25, metal: 1 });
  root.add(mesh(cylinder(1, 1, 8), gold, { y: -1.2, sx: 0.04, sy: 2.4, sz: 0.04 }));
  root.add(mesh(torus(0.06), gold, { y: -2.4, sx: 1.6, sy: 1.6, sz: 1.6, rx: Math.PI / 2 }));
  const flame = pbr('#ffe6a0', { emissive: '#ffb84a', emissiveIntensity: 4, rough: 1 });
  for (let i = 0; i < 10; i++) {
    const ang = (i / 10) * Math.PI * 2;
    const x = Math.sin(ang) * 1.6, z = Math.cos(ang) * 1.6;
    root.add(mesh(cylinder(1, 1, 8), pbr('#fbf6e8', { rough: 0.6 }), { x, y: -2.2, z, sx: 0.06, sy: 0.3, sz: 0.06 }));
    root.add(mesh(sphere(), flame, { x, y: -1.98, z, sx: 0.06, sy: 0.12, sz: 0.06, shadow: false }));
  }
  root.scale.setScalar(p?.s ?? 1);
  return { root, update() {} };
}

export const THINGS = { coin, star, oneup, sign, door: doorModel, stardoor: doorModel, painting };
export const PROPS = { tree, pine, rock, flag, waterfall, window: windowGlass, chandelier };
