// Bag End’s study at night (the design’s §6): an oak desk, the round
// window with rain on it and the dark beyond (where the Eye shows as the
// Ring’s dread rises), the fire in its hearth, two candles, a shelf of
// books, the map pinned on the wall, Bilbo’s pipe, an inkpot and quill,
// and Sting on its peg, which glows blue as the Eye comes near. Drawn in
// code; lit by the fire and the candles, which flicker.
//
//   createStudy({ mats, tier, size }) → { group, tick(dt, { dread, vision }), lower(level), dispose() }

import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { texture, uniform, vec4 } from 'three/tsl';
import { fbm, makeCanvas, makeNoise } from '../../../lib/paint';
import { paintMap } from '../mapPaint';
import { eye as eyeArt } from './figures';
import { card as cutCard, pen, sheet } from './paint';
import { canvasMap } from './mats';

// oak, its grain running along the desk
function woodArt(w, h, { tone = [66, 42, 26] } = {}) {
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  const noise = makeNoise(17);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const n = fbm(noise, x / 220, y / 14, { octaves: 4 });
      const ring = 0.5 + 0.5 * Math.sin(n * 22 + y * 0.05);
      const k = 0.72 + ring * 0.28 + (fbm(noise, x / 9, y / 3, { octaves: 2 }) - 0.5) * 0.12;
      const i = (y * w + x) * 4;
      img.data[i] = tone[0] * k;
      img.data[i + 1] = tone[1] * k;
      img.data[i + 2] = tone[2] * k;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// the night through the window: a dark sky, the hill’s line, a few lights
function nightArt(w) {
  const c = makeCanvas(w, w);
  const p = pen(c.getContext('2d'), w, w, 3);
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, w);
  g.addColorStop(0, '#0b1220');
  g.addColorStop(0.7, '#1c2a3e');
  g.addColorStop(1, '#2a3446');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, w);
  p.glow(0.72, 0.28, 0.16, '#8fa4c8', 0.5);
  p.fill([[0, 0.78], [0.2, 0.7], [0.45, 0.74], [0.7, 0.66], [1, 0.72], [1, 1], [0, 1]], '#0a0e14');
  p.dots([[0.18, 0.8], [0.34, 0.83], [0.6, 0.76], [0.82, 0.8]], { size: 0.006, colour: '#ffcf6a' });
  return c;
}

// rain on the glass: streaks and beads, tiled, scrolled down
function rainArt(w) {
  const c = makeCanvas(w, w);
  const p = pen(c.getContext('2d'), w, w, 21);
  p.hatch(0, 0, 1, 1, { n: 120, len: 0.08, angle: 1.62, colour: '#c8d6ea', alpha: 0.5, width: 0.002 });
  p.dots(Array.from({ length: 60 }, () => [p.r(), p.r(), 0.5 + p.r()]), { size: 0.004, colour: '#dfe8f4', alpha: 0.7 });
  return c;
}

// the plaster of the walls, warm and uneven
function plasterArt(w) {
  return sheet(w, w, 51, { tone: '#8f8068', edge: 0.15 });
}

export function createStudy({ mats, tier = 'high', size = 1 }) {
  const group = new THREE.Group();
  const made = [];
  const keep = (x) => (made.push(x), x);
  const low = tier === 'low';
  const px = (n) => Math.max(64, Math.round(n * size));

  // the desk
  const oak = keep(canvasMap(woodArt(px(512), px(256)), { aniso: 8 }));
  const desk = new THREE.Mesh(keep(new THREE.BoxGeometry(1.7, 0.06, 0.95)), mats.lit({ map: oak, roughness: 0.55 }));
  desk.position.set(0, -0.03, -0.12);
  group.add(desk);

  // the back wall and the side wall, plaster under oak beams
  const plaster = keep(canvasMap(plasterArt(px(256)), { repeat: true }));
  plaster.repeat.set(3, 2);
  const wallMat = mats.lit({ map: plaster, roughness: 0.95 });
  const back = new THREE.Mesh(keep(new THREE.PlaneGeometry(3.4, 2)), wallMat);
  back.position.set(0, 0.6, -0.75);
  const side = new THREE.Mesh(keep(new THREE.PlaneGeometry(2.2, 2)), wallMat);
  side.rotation.y = Math.PI / 2;
  side.position.set(-1.25, 0.6, 0.2);
  const floor = new THREE.Mesh(keep(new THREE.PlaneGeometry(3.4, 2.4)), mats.lit({ color: 0x3a2618, roughness: 0.8 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, -0.75, 0.3);
  group.add(back, side, floor);
  const beamMat = mats.lit({ map: oak, color: 0x9a8070, roughness: 0.7 });
  const beam = new THREE.Mesh(keep(new THREE.BoxGeometry(3.4, 0.08, 0.1)), beamMat);
  beam.position.set(0, 1.12, -0.7);
  group.add(beam);

  // the round window: a green ring of a frame, the night, the rain, the Eye
  const win = new THREE.Group();
  win.position.set(0.32, 0.42, -0.745);
  const frame = new THREE.Mesh(keep(new THREE.TorusGeometry(0.25, 0.025, 10, 48)), mats.lit({ color: 0x2f5a3a, roughness: 0.5 }));
  const night = keep(canvasMap(nightArt(px(256))));
  const glassNight = new THREE.Mesh(keep(new THREE.CircleGeometry(0.25, 40)), mats.lit({ map: night, roughness: 1, emissive: 0x0a0e16 }));
  glassNight.position.z = -0.004;
  const eyeCanvas = cutCard(px(256), px(128), eyeArt().outline, eyeArt().draw, { margin: 0.001 });
  const eyeMap = keep(canvasMap(eyeCanvas));
  const uDread = uniform(0);
  const eyeMat = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const et = texture(eyeMap);
  eyeMat.colorNode = vec4(et.rgb.mul(1.6), 1);
  eyeMat.opacityNode = et.a.mul(uDread);
  keep(eyeMat);
  const eyeMesh = new THREE.Mesh(keep(new THREE.PlaneGeometry(0.2, 0.1)), eyeMat);
  eyeMesh.position.set(0.04, 0.05, -0.002);
  const rainMap = keep(canvasMap(rainArt(px(256)), { repeat: true }));
  const rainMat = keep(new MeshBasicNodeMaterial({ map: rainMap, transparent: true, depthWrite: false, opacity: 0.75 }));
  const rain = new THREE.Mesh(keep(new THREE.CircleGeometry(0.25, 40)), rainMat);
  rain.position.z = 0.002;
  rain.visible = !low && tier !== 'mid';
  win.add(frame, glassNight, eyeMesh, rain);
  // the cross of the window’s bars
  const barMat = mats.lit({ color: 0x2f5a3a, roughness: 0.5 });
  for (const r of [0, Math.PI / 2]) {
    const bar = new THREE.Mesh(keep(new THREE.BoxGeometry(0.5, 0.012, 0.012)), barMat);
    bar.rotation.z = r;
    win.add(bar);
  }
  group.add(win);

  // the hearth, to the left: a stone arch and the fire in it
  const hearth = new THREE.Group();
  // (raised so its fire shows over the desk’s far edge from where you sit)
  hearth.position.set(-0.8, 0.2, -0.72);
  const stone = mats.lit({ color: 0x6e665c, roughness: 0.9 });
  const sootMat = mats.lit({ color: 0x120c08, roughness: 1 });
  const jambL = new THREE.Mesh(keep(new THREE.BoxGeometry(0.1, 0.6, 0.12)), stone);
  jambL.position.set(-0.26, 0.0, 0.04);
  const jambR = jambL.clone();
  jambR.position.x = 0.26;
  const lintel = new THREE.Mesh(keep(new THREE.BoxGeometry(0.62, 0.1, 0.14)), stone);
  lintel.position.set(0, 0.32, 0.04);
  const mouth = new THREE.Mesh(keep(new THREE.PlaneGeometry(0.42, 0.55)), sootMat);
  mouth.position.set(0, 0.0, 0.0);
  hearth.add(jambL, jambR, lintel, mouth);
  const flames = [];
  for (let i = 0; i < 3; i++) {
    const f = new THREE.Sprite(mats.glow(i === 1 ? '#ffb347' : '#ff7a2a', 0.9));
    f.position.set((i - 1) * 0.08, -0.18 + (i === 1 ? 0.04 : 0), 0.03);
    f.scale.set(0.22, 0.3, 1);
    hearth.add(f);
    flames.push(f);
  }
  const fire = new THREE.PointLight(0xff8a3a, 0.6, 3.2, 1.6);
  fire.position.set(0, -0.05, 0.25);
  hearth.add(fire);
  group.add(hearth);

  // two candles, each a stick of wax, a flame and its light
  const wax = mats.lit({ color: 0xefe6cf, roughness: 0.6 });
  const brass = mats.lit({ color: 0xb08a3a, roughness: 0.35, metalness: 0.7 });
  const candles = [];
  for (const [x, z, hgt, lit] of [[-0.56, -0.36, 0.14, true], [0.62, -0.42, 0.1, !low]]) {
    const c = new THREE.Group();
    c.position.set(x, 0, z);
    const dish = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.04, 0.045, 0.01, 20)), brass);
    dish.position.y = 0.005;
    const stick = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.014, 0.015, hgt, 14)), wax);
    stick.position.y = 0.01 + hgt / 2;
    const flame = new THREE.Sprite(mats.glow('#ffcf6a', 1));
    flame.scale.set(0.035, 0.06, 1);
    flame.position.y = 0.01 + hgt + 0.02;
    const halo = new THREE.Sprite(mats.glow('#ff9a3a', 0.35));
    halo.scale.setScalar(0.22);
    halo.position.y = flame.position.y;
    c.add(dish, stick, flame, halo);
    let light = null;
    if (lit) {
      light = new THREE.PointLight(0xffb066, 0.34, 2.2, 1.7);
      light.position.y = flame.position.y + 0.02;
      c.add(light);
    }
    candles.push({ flame, halo, light, seed: x * 13 });
    group.add(c);
  }

  // a shelf of books on the back wall, one draw for them all
  const shelf = new THREE.Mesh(keep(new THREE.BoxGeometry(0.9, 0.03, 0.16)), beamMat);
  shelf.position.set(-0.3, 0.72, -0.67);
  group.add(shelf);
  const bookGeo = keep(new THREE.BoxGeometry(1, 1, 1));
  const books = new THREE.InstancedMesh(bookGeo, mats.lit({ color: 0xffffff, roughness: 0.8 }), 26);
  const colours = [0x6a1e1a, 0x2e4a3a, 0x3a3a5a, 0x7a5a2a, 0x4a2a1a, 0x8a7a5a];
  const m4 = new THREE.Matrix4();
  let x = -0.72;
  for (let i = 0; i < 26; i++) {
    const w = 0.022 + ((i * 7) % 5) * 0.004;
    const h = 0.13 + ((i * 11) % 7) * 0.012;
    const lean = i % 9 === 8 ? 0.25 : 0;
    m4.compose(new THREE.Vector3(x + w / 2, 0.735 + h / 2, -0.67), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, -lean)), new THREE.Vector3(w, h, 0.12));
    books.setMatrixAt(i, m4);
    books.setColorAt(i, new THREE.Color(colours[(i * 5) % colours.length]));
    x += w + 0.003 + lean * 0.05;
  }
  group.add(books);

  // the map of Middle-earth pinned on the wall (the same sheet as the hub’s)
  const mapMap = keep(canvasMap(paintMap(px(1024))));
  const mapMesh = new THREE.Mesh(keep(new THREE.PlaneGeometry(0.62, 0.434)), mats.lit({ map: mapMap, roughness: 0.95 }));
  mapMesh.position.set(-0.3, 0.38, -0.745);
  mapMesh.rotation.z = 0.015;
  group.add(mapMesh);

  // Sting on its peg, to the right of the window: it glows as the Eye nears
  const sting = new THREE.Group();
  sting.position.set(0.82, 0.45, -0.735);
  sting.rotation.z = -0.5;
  const uSting = uniform(0);
  const bladeMat = mats.lit({ color: 0xc8d0dc, roughness: 0.25, metalness: 0.8 });
  bladeMat.emissiveNode = vec4(0.25, 0.55, 1, 1).rgb.mul(uSting);
  const blade = new THREE.Mesh(keep(new THREE.BoxGeometry(0.02, 0.42, 0.006)), bladeMat);
  const hilt = new THREE.Mesh(keep(new THREE.BoxGeometry(0.1, 0.014, 0.014)), brass);
  hilt.position.y = -0.21;
  const grip = new THREE.Mesh(keep(new THREE.BoxGeometry(0.018, 0.09, 0.018)), mats.lit({ color: 0x3a2a1a }));
  grip.position.y = -0.26;
  const stingGlow = new THREE.Sprite(mats.glow('#6fa8ff', 0));
  stingGlow.scale.set(0.12, 0.5, 1);
  sting.add(blade, hilt, grip, stingGlow);
  group.add(sting);

  // on the desk: the pipe, the inkpot and the quill
  const pipe = new THREE.Group();
  pipe.position.set(-0.46, 0, 0.16);
  pipe.rotation.y = 0.6;
  const pipeMat = mats.lit({ color: 0x5a3a20, roughness: 0.5 });
  const bowl = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.014, 0.011, 0.03, 14)), pipeMat);
  bowl.position.y = 0.015;
  const stem = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.004, 0.004, 0.2, 8)), pipeMat);
  stem.rotation.z = Math.PI / 2 - 0.08;
  stem.position.set(0.1, 0.01, 0);
  pipe.add(bowl, stem);
  const ink = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.022, 0.026, 0.04, 16)), mats.lit({ color: 0x1a1a24, roughness: 0.2, metalness: 0.2 }));
  ink.position.set(0.31, 0.02, 0.14);
  const quill = new THREE.Mesh(keep(new THREE.ConeGeometry(0.008, 0.2, 6)), mats.lit({ color: 0xf2efe6, roughness: 0.8 }));
  quill.position.set(0.33, 0.11, 0.12);
  quill.rotation.set(0.2, 0, -0.35);
  group.add(pipe, ink, quill);

  // the room’s fill: the moon’s blue from the window, a little warmth below
  const hemi = new THREE.HemisphereLight(0x5a6a8a, 0x1a1210, 0.3);
  const moon = new THREE.DirectionalLight(0x8fa4c8, 0.35);
  moon.position.set(0.4, 1, -1);
  // and the reader’s own candle, out of sight by the reader’s hand: the
  // light the pop-ups are seen by, from the front
  const reader = new THREE.PointLight(0xffc27a, 0.45, 2.4, 1.4);
  reader.position.set(0.35, 0.45, 0.55);
  group.add(hemi, moon, reader);

  let t = 0;
  return {
    group,
    win,
    tick(dt, { dread = 0, vision = 0 } = {}) {
      t += dt;
      rainMap.offset.y = (rainMap.offset.y + dt * 0.12) % 1;
      const f = 0.85 + 0.15 * Math.sin(t * 9.1) * Math.sin(t * 5.3 + 1.2) + 0.05 * Math.sin(t * 23);
      fire.intensity = 0.6 * f * (1 - vision * 0.5);
      flames.forEach((s, i) => s.scale.set(0.22 + Math.sin(t * 7 + i) * 0.02, 0.3 * (0.9 + 0.12 * Math.sin(t * 11 + i * 2)), 1));
      for (const c of candles) {
        const k = 0.9 + 0.1 * Math.sin(t * 13 + c.seed) * Math.sin(t * 7.7 + c.seed * 2);
        c.flame.scale.set(0.035 * (0.95 + 0.05 * k), 0.06 * k, 1);
        c.halo.material.opacity = 0.35 * k;
        if (c.light) c.light.intensity = 0.34 * k * (1 - vision * 0.6);
      }
      reader.intensity = 0.45 * (0.95 + 0.05 * Math.sin(t * 8.3)) * (1 - vision * 0.5);
      // the Eye in the window, and Sting knowing it
      uDread.value = Math.max(0, (dread - 0.15) / 0.85);
      eyeMesh.scale.setScalar(0.6 + dread * 1.2);
      uSting.value = Math.max(0, (dread - 0.3) / 0.7) * 1.4;
      stingGlow.material.opacity = uSting.value * 0.6;
      hemi.intensity = 0.3 + vision * 0.35;
    },
    lower(level) {
      rain.visible = level < 1 && !low && tier !== 'mid';
      if (level >= 2) for (const c of candles.slice(1)) if (c.light) c.light.visible = false;
    },
    dispose() {
      for (const x2 of made) x2.dispose();
      books.dispose();
    },
  };
}
