// The Tower of Cirith Ungol's mess: black stone and iron by red torchlight,
// the orcs' shields with the Eye on them and their banner between, spears
// racked and a whip on its hook, skulls on the spikes, bones and spilt
// draught about the floor, a slit window on Mordor with the mountain
// burning and the Eye's beam sweeping the plain, and Frodo's cage on its
// chain over it all. The webs dragged up from Shelob's tunnels lie on the
// floor (the ',' tiles: slow going) and hang in the corners; and as the
// round goes on, her children come creeping along the top of the wall.

import * as THREE from 'three';
import { hot } from '../../../../lib/three/stage3dNodes';
import { B, ball, cyl, lathe } from '../../shire/props';
import { V, motes, webTexture } from './common';
import { sharpen } from '../../../../lib/three/textures';

// the orcs' banner: the red Eye on black
function eyeBanner() {
  const cv = document.createElement('canvas');
  cv.width = 64;
  cv.height = 128;
  const g = cv.getContext('2d');
  g.fillStyle = '#100a0a';
  g.fillRect(0, 0, 64, 128);
  g.strokeStyle = '#4a1a10';
  g.lineWidth = 3;
  g.strokeRect(4, 4, 56, 120);
  g.fillStyle = '#e8401a';
  g.beginPath();
  g.ellipse(32, 60, 22, 11, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#ffb060';
  g.beginPath();
  g.ellipse(32, 60, 14, 8, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#100a0a';
  g.beginPath();
  g.ellipse(32, 60, 3, 9, 0, 0, Math.PI * 2);
  g.fill();
  // the hand under it, white
  g.fillStyle = '#e8e4d8';
  g.fillRect(28, 84, 8, 22);
  for (let k = 0; k < 4; k++) g.fillRect(22 + k * 5, 78, 3, 10);
  const tex = new THREE.CanvasTexture(cv);
  sharpen(tex);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// the view from the slit: Mordor's sky, red over black, the plain, and
// the mountain's cone against it
function mordorView() {
  const cv = document.createElement('canvas');
  cv.width = 64;
  cv.height = 128;
  const g = cv.getContext('2d');
  const sky = g.createLinearGradient(0, 0, 0, 128);
  sky.addColorStop(0, '#1a0806');
  sky.addColorStop(0.55, '#6a1a0a');
  sky.addColorStop(0.8, '#c0401a');
  sky.addColorStop(1, '#2a0c06');
  g.fillStyle = sky;
  g.fillRect(0, 0, 64, 128);
  // the mountain, and its fire
  g.fillStyle = '#140806';
  g.beginPath();
  g.moveTo(0, 128);
  g.lineTo(8, 112);
  g.lineTo(30, 70);
  g.lineTo(36, 70);
  g.lineTo(58, 114);
  g.lineTo(64, 128);
  g.fill();
  g.fillStyle = '#ff7a30';
  g.fillRect(31, 68, 4, 3);
  g.fillStyle = 'rgba(255, 120, 40, 0.6)';
  g.fillRect(32, 71, 2, 20);
  g.fillRect(29, 74, 2, 14);
  const tex = new THREE.CanvasTexture(cv);
  sharpen(tex);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export const TOWER = {
  sky: { background: 0x0c0707, fog: [0x140a08, 16, 40], hemi: [0x9a7466, 0x2a1410, 1.0], sun: [0xff9a6a, 1.5], sunAt: [4, 9, 6] },
  setup({ mats }) {
    const black = mats.ashlar.clone();
    black.color = new THREE.Color(0x6a615a);
    const floor = mats.ashlar.clone();
    floor.color = new THREE.Color(0x5c544e);
    const web = new THREE.MeshBasicMaterial({ map: webTexture(), transparent: true, depthWrite: false, opacity: 0.62, color: 0xb8b0a0 });
    const eye = new THREE.MeshBasicMaterial({ color: hot(0xff3a10, 1.6) });
    const bone = new THREE.MeshStandardMaterial({ color: 0xd8d0b8, roughness: 0.8 });
    const grime = new THREE.MeshStandardMaterial({ color: 0x120806, roughness: 1, transparent: true, opacity: 0.5, depthWrite: false });
    const sticky = new THREE.MeshStandardMaterial({ color: 0x9a948a, roughness: 1, transparent: true, opacity: 0.22, depthWrite: false });
    const hide = new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 1 });
    const draught = new THREE.MeshStandardMaterial({ color: 0x4a1a12, roughness: 0.3, transparent: true, opacity: 0.7, depthWrite: false });
    const banner = new THREE.MeshStandardMaterial({ map: eyeBanner(), roughness: 0.95, side: THREE.DoubleSide });
    return { black, floor, web, eye, bone, grime, sticky, hide, draught, banner, oven: black };
  },
  room({ bk, room, at, mats, W, D, X, Z, wallH, lamps }, { black, floor, web, eye, bone, grime, sticky, hide, draught, banner }) {
    bk.add(floor, B(W + 2, 0.1, D + 2), { p: [0, -0.05, 0.5], uv: 0.4 });
    const zb = Z(0) - 0.2;
    bk.add(black, B(W + 2, wallH + 1, 0.4), { p: [0, (wallH + 1) / 2, zb - 0.1], uv: 0.4 });
    for (const sx of [-1, 1]) bk.add(black, B(0.4, wallH + 1, D + 1), { p: [sx * (W / 2 + 0.2), (wallH + 1) / 2, 0], uv: 0.4 });
    // iron bands, spikes along the top (two with skulls on them), and
    // shields with the red Eye, a torch in a bracket by each
    bk.add(mats.iron, B(W + 2, 0.12, 0.06), { p: [0, 2.3, zb + 0.12] });
    bk.add(mats.iron, B(W + 2, 0.08, 0.06), { p: [0, 0.9, zb + 0.12] });
    for (let n = 0; n < 13; n++) bk.add(mats.iron, new THREE.ConeGeometry(0.06, 0.4, 5), { p: [-W / 2 + n * (W / 12), wallH + 1.2, zb] });
    for (const n of [2, 10]) {
      const x = -W / 2 + n * (W / 12);
      bk.add(bone, ball(0.13, 9, 7), { p: [x, wallH + 1.3, zb], s: [1, 1.1, 1.05] });
      bk.add(bone, B(0.14, 0.06, 0.1), { p: [x, wallH + 1.17, zb + 0.06] });
      for (const ex of [-0.05, 0.05]) bk.add(mats.void, ball(0.03, 6, 4), { p: [x + ex, wallH + 1.32, zb + 0.12] });
    }
    for (let n = 0; n < 4; n++) {
      const x = -W / 2 + 1.8 + n * ((W - 3.6) / 3);
      bk.add(mats.iron, cyl(0.32, 0.32, 0.05, 10), { p: [x, 1.7, zb + 0.15], r: [Math.PI / 2, 0, 0] });
      bk.add(mats.iron, cyl(0.07, 0.09, 0.08, 8), { p: [x, 1.7, zb + 0.2], r: [Math.PI / 2, 0, 0] });
      bk.add(eye, ball(0.08, 8, 6), { p: [x, 1.7, zb + 0.19], s: [1, 0.5, 0.4] });
      bk.add(mats.iron, cyl(0.025, 0.03, 0.4, 6), { p: [x + 1.2, 1.8, zb + 0.3], r: [0.35, 0, 0] });
      bk.add(mats.iron, cyl(0.03, 0.03, 0.2, 6), { p: [x + 1.2, 1.72, zb + 0.18], r: [Math.PI / 2, 0, 0] });
      lamps.push(V(x + 1.2, 2.0, zb + 0.36));
    }
    // and torches on the side walls
    for (const sx of [-1, 1])
      for (const k of [0.3, 0.7]) {
        const z = Z(0) + D * k;
        bk.add(mats.iron, cyl(0.025, 0.03, 0.4, 6), { p: [sx * (W / 2 - 0.1), 1.8, z], r: [0, 0, -sx * 0.35] });
        lamps.push(V(sx * (W / 2 - 0.2), 2.0, z));
    }
    // the banner of the Eye, between the shields
    const banners = [-W / 2 + 1.8 + (W - 3.6) / 6, W / 2 - 1.8 - (W - 3.6) / 6];
    for (const x of banners) {
      bk.add(mats.iron, cyl(0.02, 0.02, 0.7, 5), { p: [x, 2.55, zb + 0.22], r: [0, 0, Math.PI / 2] });
      const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 1.2), banner);
      cloth.position.set(x, 1.95, zb + 0.24);
      room.add(cloth);
    }
    // the slit window on Mordor: a dark recess, bars across it (the view
    // itself is drawn behind the bars by extras)
    const win = { x: -1.1, y: 2.05, w: 0.5, h: 1.3 };
    bk.add(mats.void, B(win.w + 0.1, win.h + 0.1, 0.05), { p: [win.x, win.y, zb + 0.14] });
    for (const dy of [-0.35, 0, 0.35]) bk.add(mats.iron, cyl(0.02, 0.02, win.w + 0.16, 5), { p: [win.x, win.y + dy, zb + 0.2], r: [0, 0, Math.PI / 2] });
    bk.add(mats.iron, cyl(0.02, 0.02, win.h + 0.16, 5), { p: [win.x, win.y, zb + 0.2] });
    bk.add(black, B(win.w + 0.5, 0.1, 0.3), { p: [win.x, win.y - win.h / 2 - 0.1, zb + 0.22], uv: 1 });
    // spears racked against the back wall, and a whip coiled on its hook
    for (let k = 0; k < 5; k++) {
      const x = W / 2 - 3.1 + k * 0.2;
      bk.add(hide, cyl(0.018, 0.022, 2.1, 5), { p: [x, 1.05, zb + 0.3 - k * 0.02], r: [0.08, 0, (k - 2) * 0.05] });
      bk.add(mats.steel, new THREE.ConeGeometry(0.035, 0.26, 4), { p: [x - (k - 2) * 0.1, 2.2, zb + 0.22] });
    }
    bk.add(mats.iron, cyl(0.02, 0.02, 0.16, 5), { p: [-W / 2 + 1.0, 1.95, zb + 0.22], r: [Math.PI / 2, 0, 0] });
    bk.add(hide, new THREE.TorusGeometry(0.17, 0.035, 6, 18), { p: [-W / 2 + 1.0, 1.75, zb + 0.3], r: [0, 0, 0.3] });
    bk.add(hide, cyl(0.012, 0.012, 0.7, 4), { p: [-W / 2 + 1.1, 1.3, zb + 0.32], r: [0, 0, 0.12] });
    // bones in the corners and under the counters, mugs knocked over and
    // the draught spilt, and grime where the orcs have been
    const corners = [[-W / 2 + 0.3, Z(1) + 0.3], [W / 2 - 0.3, Z(1) + 0.5], [-W / 2 + 0.4, Z(D - 2) + 0.4], [W / 2 - 0.35, Z(D - 2) + 0.2]];
    corners.forEach(([x, z], c) => {
      for (let n = 0; n < 4; n++) bk.add(bone, cyl(0.02, 0.025, 0.28 + (n % 2) * 0.1, 5), { p: [x + Math.cos(n * 2.1 + c) * 0.12, 0.025, z + Math.sin(n * 2.1 + c) * 0.12], r: [Math.PI / 2, n * 0.9 + c, 0] });
      bk.add(bone, cyl(0.05, 0.04, 0.03, 8), { p: [x + 0.1, 0.02, z - 0.1], r: [Math.PI / 2, 0, 0] });
      bk.add(grime, new THREE.CircleGeometry(0.45, 12), { p: [x, 0.012, z], r: [-Math.PI / 2, 0, 0], s: [1.3, 1, 0.8] });
    });
    for (const [x, z, a] of [[X(1.5), Z(D - 1.6), 0.4], [X(W - 2.4), Z(1.7), 2.2], [X(W / 2 + 0.4), Z(D - 1.4), 1.1]]) {
      bk.add(mats.iron, lathe([[0, 0], [0.06, 0], [0.07, 0.14], [0.055, 0.14], [0.05, 0.015], [0, 0.015]], 10), { p: [x, 0.07, z], r: [Math.PI / 2, 0, a] });
      bk.add(draught, new THREE.CircleGeometry(0.16, 10), { p: [x + Math.sin(a) * 0.18, 0.011, z + Math.cos(a) * 0.18], r: [-Math.PI / 2, 0, 0], s: [1.4, 1, 1] });
    }
    for (const [x, z] of [[X(3.5), Z(2.5)], [X(W - 3.5), Z(D - 3.5)], [X(W / 2), Z(1.5)]]) bk.add(grime, new THREE.CircleGeometry(0.5, 12), { p: [x, 0.011, z], r: [-Math.PI / 2, 0, 0], s: [1.6, 1, 1] });
    // the webs on the floor (a sticky grey under each, so the tiles read),
    // and slung across the corners
    for (let j = 0; j < D; j++)
      for (let i = 0; i < W; i++)
        if (at(i, j) === ',') {
          bk.add(sticky, new THREE.PlaneGeometry(1, 1), { p: [X(i + 0.5), 0.01, Z(j + 0.5)], r: [-Math.PI / 2, 0, 0] });
          const w = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 1.15), web);
          w.rotation.set(-Math.PI / 2, 0, (i * 7 + j * 3) % 6);
          w.scale.setScalar(0.85 + ((i * 3 + j * 5) % 4) * 0.08);
          w.position.set(X(i + 0.5), 0.014 + ((i + j) % 3) * 0.002, Z(j + 0.5));
          room.add(w);
        }
    for (const [x, y, ry] of [[-W / 2 + 0.2, 2.6, Math.PI / 4], [W / 2 - 0.2, 2.6, -Math.PI / 4]]) {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), web);
      w.position.set(x, y, zb + 0.6);
      w.rotation.y = ry;
      room.add(w);
    }
  },
  counter: (c, stone, { mats, m }, { black }) => [black, c === 'S' ? m.darkWood : mats.iron],
  stations: {
    W({ bk }, { black }) {
      // a black stone trough
      bk.add(black, B(0.86, 0.28, 0.6), { p: [0, 0.14, 0], uv: 1 });
    },
  },
  extras(ctx) {
    const { room, scene, lamps, W, D, Z, mats, wallH } = ctx;
    const zb = Z(0) - 0.2;
    // torches in iron brackets, their red light, and the embers off them
    const flame = new THREE.MeshBasicMaterial({ color: hot(0xff6a1a, 3) });
    const geo = new THREE.ConeGeometry(0.09, 0.32, 6);
    const flames = lamps.map((p) => {
      const f = new THREE.Mesh(geo, flame);
      f.position.copy(p);
      room.add(f);
      return f;
    });
    const lights = [-0.3, 0.3].map((sx) => {
      const l = new THREE.PointLight(0xff6a2a, 4.5, 12, 1.4);
      l.position.set(sx * W, 2.3, zb + 1.2);
      scene.add(l);
      return l;
    });
    const embers = motes(ctx, { n: 40, colour: 0xff8a3a, size: 0.06, rise: 0.7, sway: 0.2, life: [0.6, 1.6], glow: 2, from: () => lamps[Math.floor(Math.random() * lamps.length)].clone().add(V((Math.random() - 0.5) * 0.1, 0.15, (Math.random() - 0.5) * 0.1)) });
    // ash, sifting down from the mountain
    const ash = motes(ctx, { n: 30, colour: 0x7a7068, size: 0.07, rise: -0.25, sway: 0.4, life: [5, 9], glow: 0.6, from: () => V((Math.random() - 0.5) * (W + 2), 3.4 + Math.random(), Z(0) + Math.random() * 7) });
    // the slit window: Mordor behind the bars, the mountain burning, and
    // the Eye's beam sweeping the plain
    const win = { x: -1.1, y: 2.05, w: 0.5, h: 1.3 };
    const view = new THREE.Mesh(new THREE.PlaneGeometry(win.w, win.h), new THREE.MeshBasicMaterial({ map: mordorView(), fog: false }));
    view.position.set(win.x, win.y, zb + 0.125);
    const beam = new THREE.Mesh(new THREE.PlaneGeometry(0.05, win.h * 0.55), new THREE.MeshBasicMaterial({ color: hot(0xffd080, 1.8), transparent: true, opacity: 0.7, fog: false, depthWrite: false }));
    beam.position.set(win.x, win.y + win.h * 0.1, zb + 0.13);
    room.add(view, beam);
    const glow = new THREE.PointLight(0xff4a1a, 1.6, 5, 1.6);
    glow.position.set(win.x, win.y, zb + 0.6);
    scene.add(glow);
    // Frodo's cage, hung on its chain from the dark above
    const cage = new THREE.Group();
    const iron = mats.iron;
    for (const y of [0, 0.9]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.025, 6, 16), iron);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = y;
      cage.add(ring);
    }
    for (let k = 0; k < 8; k++) {
      const bar = new THREE.Mesh(cyl(0.015, 0.015, 0.9, 5), iron);
      bar.position.set(Math.cos((k / 8) * Math.PI * 2) * 0.34, 0.45, Math.sin((k / 8) * Math.PI * 2) * 0.34);
      cage.add(bar);
    }
    const chain = new THREE.Mesh(cyl(0.02, 0.02, 2.4, 5), iron);
    chain.position.y = 2.1;
    cage.add(chain);
    cage.position.set(2.4, 2.0, zb + 1.5);
    room.add(cage);
    // Shelob's children: small spiders that come creeping down the side
    // walls as the round goes on
    const spiderMat = new THREE.MeshStandardMaterial({ color: 0x1a1412, roughness: 0.85 });
    const eyeMat = new THREE.MeshBasicMaterial({ color: hot(0xff3a1a, 2.2) });
    const legGeo = cyl(0.012, 0.018, 0.34, 4);
    const spiders = Array.from({ length: 5 }, (_, k) => {
      const g = new THREE.Group();
      const body = new THREE.Mesh(ball(0.14, 8, 6), spiderMat);
      body.scale.set(1, 0.7, 1.3);
      const head = new THREE.Mesh(ball(0.08, 6, 5), spiderMat);
      head.position.set(0, 0.0, 0.2);
      g.add(body, head);
      // a pair of eyes, red, so they read on the dark wall
      for (const ex of [-0.035, 0.035]) {
        const eye = new THREE.Mesh(ball(0.018, 6, 4), eyeMat);
        eye.position.set(ex, 0.03, 0.27);
        g.add(eye);
      }
      const legs = [];
      for (let n = 0; n < 8; n++) {
        const s = n < 4 ? -1 : 1;
        const leg = new THREE.Mesh(legGeo, spiderMat);
        leg.position.set(s * 0.22, -0.03, -0.14 + (n % 4) * 0.09);
        leg.rotation.z = s * 1.1;
        leg.rotation.x = ((n % 4) - 1.5) * 0.35;
        g.add(leg);
        legs.push(leg);
      }
      g.userData = { legs, side: k % 2 ? 1 : -1, lane: k, speed: 0.2 + (k % 3) * 0.06 };
      g.visible = false;
      room.add(g);
      return g;
    });
    return {
      tick(dt, t, s) {
        flames.forEach((f, k) => f.scale.set(1, 1 + Math.sin(t * 13 + k) * 0.18, 1));
        lights.forEach((l, k) => (l.intensity = 4.2 + Math.sin(t * 9 + k * 2) * 0.6));
        embers.tick(dt, t);
        ash.tick(dt, t);
        // the beam, to and fro across the plain
        beam.position.x = win.x + Math.sin(t * 0.35) * win.w * 0.42;
        beam.rotation.z = Math.sin(t * 0.35) * 0.25;
        beam.material.opacity = 0.5 + 0.2 * Math.sin(t * 2.3);
        glow.intensity = 1.4 + Math.sin(t * 0.7) * 0.3;
        // the cage, swinging a little in the draught
        cage.rotation.z = Math.sin(t * 0.9) * 0.04;
        cage.rotation.x = Math.cos(t * 0.7) * 0.03;
        // the spiders: one more as the round goes on, each on a side wall,
        // creeping down from the dark and along it
        const k = s?.level?.time ? 1 - s.left / s.level.time : 0;
        spiders.forEach((g, i) => {
          const due = 0.3 + i * 0.14;
          g.visible = k >= due;
          if (!g.visible) return;
          const u = g.userData;
          const since = Math.max(0, k - due) * (s.level.time / 60); // minutes since it came
          const down = Math.min(1, since * 1.6);
          const along = Math.sin(t * u.speed + i * 1.7); // -1..1 along the wall
          g.position.set(u.side * (W / 2 - 0.2), wallH + 0.6 - down * (2.3 + (u.lane % 2) * 0.5), Z(0) + 1 + (along * 0.5 + 0.5) * (D - 2.5));
          // flat to the wall, head the way it's going
          g.rotation.set(0, 0, u.side * Math.PI / 2);
          g.rotation.y = Math.cos(t * u.speed + i * 1.7) * u.side > 0 ? 0 : Math.PI;
          u.legs.forEach((leg, n) => (leg.rotation.x = ((n % 4) - 1.5) * 0.35 + Math.sin(t * 14 + n * 1.3) * 0.25));
        });
      },
    };
  },
};
