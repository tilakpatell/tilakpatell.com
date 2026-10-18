// The One Ring in WebGL: a plain gold band turning slowly over the dark,
// polished so it holds the fire round it. Held to the fire, the letters come
// up out of the gold and burn; cast in, it falls tumbling into the lava,
// which flares and takes it. Ring.jsx keeps the drawing for browsers without
// WebGL and decides everything; this only draws `heat` and `fate`.
//
// Everything is made here at full resolution, nothing is downloaded: the
// band is turned on a lathe (512 steps round, a domed outside and a flat,
// comfort-fit inside), the gold's fine polishing marks and the inscription
// are painted on 2048- and 4096-wide canvases, and the reflections come from
// a small lit room rendered once into an environment map.

import * as THREE from 'three';
// (the node renderer's: the classic one's passes are GLSL)
import { PMREMGenerator } from 'three/webgpu';
import { createStage, canvasTexture, hot } from './nodes/stage';
import { sharpen } from '../../lib/three/textures';
import { fbm, makeCanvas, makeNoise } from '../../lib/paint';
import { EMBER, FIRE, createParticles, lavaMaterial, skyDome } from './nodes/kit';
import { ringGeometry } from './ringShape';
import { BLOOMS } from './look';

const INSCRIPTION = 'Ash nazg durbatulûk · ash nazg gimbatul · ash nazg thrakatulûk · agh burzum-ishi krimpatul ·';
const LAVA_Y = -3.4;
const R = (a) => (Math.random() - 0.5) * 2 * a;
const ease = (from, to, rate, dt) => from + (to - from) * (1 - Math.exp(-rate * dt));

// The gold's surface: fine polishing marks running round the band, a few
// longer scratches, and soft wear. Roughness only; the colour stays plain.
function polishTexture(renderer, size) {
  const c = makeCanvas(size, size / 4);
  const ctx = c.getContext('2d');
  const W = c.width;
  const H = c.height;
  const n = makeNoise(41);
  const img = ctx.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const u = x / W;
      const v = y / H;
      const wear = fbm(n, u * 6, v * 1.5, { period: 6, octaves: 4 });
      const lines = fbm(n, u * 2 + 50, v * 220, { octaves: 2 });
      const r = 70 + wear * 46 + (lines - 0.5) * 40;
      const i = (y * W + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.max(0, Math.min(255, r));
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  // scratches: thin, light, at shallow angles to the polish
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 140; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    const len = 20 + Math.random() * 120;
    const a = R(0.35);
    ctx.strokeStyle = `rgba(60,60,60,${0.25 + Math.random() * 0.35})`;
    ctx.lineWidth = 0.6 + Math.random();
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    ctx.stroke();
  }
  return canvasTexture(c, renderer, { srgb: false });
}

// The letters, white on black: the emissive map. Twice round would be too
// small to read, so the inscription goes round once, in the band's middle.
function letters(renderer, band) {
  const c = makeCanvas(4096, 512);
  const ctx = c.getContext('2d');
  const tex = canvasTexture(c, renderer, { srgb: true });
  const draw = () => {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, c.width, c.height);
    // the texture is flipped: v = 1 is the canvas's top row
    const top = (1 - band[1]) * c.height;
    const h = (band[1] - band[0]) * c.height;
    const mid = top + h / 2;
    // fit the line to the circumference
    let size = h * 0.62;
    ctx.font = `600 ${size}px Cinzel, Georgia, serif`;
    const w = ctx.measureText(INSCRIPTION).width;
    const gap = c.width * 0.02;
    const k = (c.width - gap) / w;
    ctx.save();
    ctx.translate(gap / 2, mid);
    ctx.scale(k, 1);
    ctx.textBaseline = 'middle';
    // a soft glow under, then the letter's core
    ctx.shadowColor = 'rgba(255,255,255,0.9)';
    ctx.shadowBlur = size * 0.35;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(INSCRIPTION, 0, 0);
    ctx.shadowBlur = 0;
    ctx.fillText(INSCRIPTION, 0, 0);
    ctx.restore();
    tex.needsUpdate = true;
  };
  draw();
  // the inscription's face, once it has loaded
  document.fonts?.load?.('600 64px Cinzel').then(draw, () => {});
  sharpen(tex, { renderer });
  return tex;
}

// What the gold reflects: a dark room with a cool light high on one side,
// a warm one low on the other, and fire glowing up from the floor.
function environment(renderer) {
  const room = new THREE.Scene();
  const glow = (color, k, w, h, pos, look) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: hot(color, k), side: THREE.DoubleSide }));
    m.position.set(...pos);
    m.lookAt(...look);
    room.add(m);
  };
  // the walls: dark, warmer towards the floor, so no part of the gold goes dead black
  const walls = new THREE.BoxGeometry(20, 20, 20);
  const shade = [];
  const p = walls.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const k = (p.getY(i) + 10) / 20;
    shade.push(0.2 - k * 0.13, 0.13 - k * 0.08, 0.075 - k * 0.045);
  }
  walls.setAttribute('color', new THREE.Float32BufferAttribute(shade, 3));
  room.add(new THREE.Mesh(walls, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  glow(0xfff1dc, 9, 9, 4, [-5, 7, 4], [0, 0, 0]); // the key, high left
  glow(0xfff6ea, 5, 1.2, 9, [-8, 1, -2], [0, 0, 0]); // a tall strip, for a long highlight
  glow(0xa9c3ff, 2.5, 2.5, 8, [8, 2, -3], [0, 0, 0]); // a cool rim
  glow(0xffd9a8, 3, 9, 1, [2, 9.5, 0], [0, 0, 0]); // overhead
  glow(0xff5a14, 1.6, 9, 9, [0, -9.5, 2], [0, 0, 0]); // the fire below
  glow(0xffb36b, 1.2, 10, 1.6, [0, 2.5, -9], [0, 0, 0]); // a warm strip behind
  glow(0xfff1dc, 3.5, 6, 3, [5, -1, 8], [0, 0, 0]); // a fill, low front right
  glow(0xffe2b8, 2.5, 6, 3, [-6, -2, 7], [0, 0, 0]); // and low front left
  const pmrem = new PMREMGenerator(renderer);
  const env = pmrem.fromScene(room, 0.02).texture;
  pmrem.dispose();
  room.traverse((o) => {
    o.geometry?.dispose();
    o.material?.dispose();
  });
  return env;
}

export function createRing3D(canvas, { soft = false, reduced = false, onLost } = {}) {
  const stage = createStage(canvas, { soft, fov: 30, near: 0.1, far: 120, exposure: 1.05, bloom: BLOOMS.ring, onLost });
  stage.tune(); // ?debug: its bloom on the panel
  const { scene, camera, renderer } = stage;
  scene.fog = new THREE.FogExp2(0x0c0503, 0.085);
  scene.add(skyDome(60, { top: 0x010000, horizon: 0x0c0503, bottom: 0x3a1004 }));
  scene.environment = environment(renderer);
  scene.environmentIntensity = 1;
  stage.grade({ contrast: 0.16, saturation: 1.06, vignette: 0.5, shadow: [0.008, 0.003, 0], high: [0.03, 0.014, 0] });

  // ── the Ring ──
  const { geo, band } = ringGeometry();
  const gold = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color().setRGB(1, 0.77, 0.36),
    metalness: 1,
    roughness: 0.2,
    roughnessMap: polishTexture(renderer, soft ? 1024 : 2048),
    emissive: new THREE.Color(0xff6a10),
    emissiveMap: letters(renderer, band),
    emissiveIntensity: 0,
    envMapIntensity: 1.25,
  });
  sharpen(gold.roughnessMap, { renderer });
  const ring = new THREE.Mesh(geo, gold);
  const holder = new THREE.Group(); // tilts towards the pointer
  const spin = new THREE.Group(); // turns
  spin.add(ring);
  holder.add(spin);
  scene.add(holder);

  // ── the light ──
  const key = new THREE.DirectionalLight(0xfff0dc, 2.2);
  key.position.set(-3, 5, 4);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x9fb8ff, 1.2);
  rim.position.set(4, 1.5, -3);
  scene.add(rim);
  const fireLight = new THREE.PointLight(0xff5a14, 0, 12, 2);
  fireLight.position.set(0, LAVA_Y + 0.6, 0.5);
  scene.add(fireLight);

  // ── the fire below ──
  const lavaMat = lavaMaterial({ scale: 0.85, heat: 0.1, reach: 0.05 });
  const lava = new THREE.Mesh(new THREE.PlaneGeometry(60, 40, 1, 1).rotateX(-Math.PI / 2), lavaMat);
  lava.position.set(0, LAVA_Y, -6);
  scene.add(lava);
  const fire = createParticles(soft ? 120 : 260, { ramp: FIRE, gravity: 1.6, drag: 1.1, swirl: 0.8 });
  const embers = createParticles(soft ? 90 : 200, { ramp: EMBER, gravity: 0.5, drag: 0.4, swirl: 1.4, stretch: 1.6 });
  scene.add(fire.mesh, embers.mesh);

  // the pointer, over the stage: the Ring leans to look at it
  const look = { x: 0, y: 0, tx: 0, ty: 0 };
  const onMove = (e) => {
    const r = canvas.getBoundingClientRect();
    if (!r.width) return;
    look.tx = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1));
    look.ty = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height) * 2 - 1));
  };
  window.addEventListener('pointermove', onMove, { passive: true });

  const S = { heat: false, fate: null };
  const A = { t: 0, heat: 0, fall: -1, flare: 0, gone: false, turn: 0, emberT: 0, down: 0 };
  const start = { y: 0.15 };

  const update = (n) => {
    if (n.fate !== S.fate) {
      if (n.fate === 'falling') {
        A.fall = 0;
        A.gone = false;
      } else if (!n.fate) {
        A.fall = -1;
        A.gone = false;
        spin.visible = true;
        holder.position.set(0, start.y, 0);
        spin.rotation.set(0, spin.rotation.y, 0);
      }
    }
    S.heat = n.heat;
    S.fate = n.fate;
  };

  let last = 0;
  const render = (ms) => {
    const now = performance.now();
    const dt = Math.min(0.05, last ? (now - last) / 1000 : ms / 1000);
    last = now;
    A.t += dt;
    const t = A.t;

    // the heat: the letters come up slowly, and go slowly
    A.heat = ease(A.heat, S.heat || S.fate === 'falling' ? 1 : S.fate === 'gone' ? 0.3 : 0, S.heat ? 0.9 : 0.6, dt);
    const flicker = 0.85 + 0.15 * Math.sin(t * 13) * Math.sin(t * 7.3 + 1);
    gold.emissiveIntensity = A.heat * 2.4 * flicker;
    lavaMat.uniforms.uHeat.value = 0.1 + A.heat * 0.28 + A.flare * 0.55;
    lavaMat.uniforms.uTime.value = t;
    fireLight.intensity = (A.heat * 14 + A.flare * 40) * flicker;
    key.intensity = 2.2 * (1 - A.heat * 0.35);

    // turning, and leaning to the pointer
    look.x = ease(look.x, look.tx, 3, dt);
    look.y = ease(look.y, look.ty, 3, dt);
    if (A.fall < 0) {
      // the letters creep round as it turns about its own axis, and it rocks
      // slowly from side to side, so the light runs over the gold
      spin.rotation.y += dt * (reduced ? 0.05 : 0.18);
      const rock = reduced ? 0 : Math.sin(t * 0.33) * 0.55;
      holder.rotation.set(1.02 + look.y * 0.22, 0, -0.18 + rock + look.x * 0.35, 'YXZ');
      holder.position.y = start.y + (reduced ? 0 : Math.sin(t * 0.9) * 0.05);
    } else if (!A.gone) {
      // cast in: it drops, turning over, and the fire takes it
      A.fall += dt;
      const k = A.fall;
      holder.position.y = start.y - 1.9 * k * k;
      spin.rotation.x += dt * 2.2;
      spin.rotation.z += dt * 0.9;
      if (holder.position.y < LAVA_Y + 0.1) {
        A.gone = true;
        spin.visible = false;
        A.flare = 1;
        const x = holder.position.x;
        for (let i = 0; i < (soft ? 50 : 110); i++) fire.emit(x + R(0.6), LAVA_Y + 0.1, R(0.6), R(1.4), 1.5 + Math.random() * 3, R(1.4), 0.7 + Math.random() * 0.9, 0.35, 1.3, 1.1);
        for (let i = 0; i < (soft ? 40 : 90); i++) embers.emit(x + R(0.4), LAVA_Y + 0.15, R(0.4), R(2.5), 2 + Math.random() * 4, R(2.5), 1 + Math.random() * 1.4, 0.05, 0.02);
      }
    }
    A.flare = Math.max(S.fate === 'gone' ? 0.12 : 0, A.flare - dt * 0.3);

    // embers rising off the fire, more of them as it heats
    A.emberT -= dt;
    if (!reduced && A.emberT <= 0) {
      A.emberT = 0.22 - A.heat * 0.16;
      embers.emit(R(3.5), LAVA_Y + 0.1, R(2) - 0.5, R(0.2), 0.6 + Math.random() * 0.9, R(0.2), 2.2 + Math.random() * 1.5, 0.04, 0.015, 0.6 + A.heat);
    }
    fire.step(dt);
    embers.step(dt);

    // the camera: a little above, the fire just in frame below the Ring
    // once it is cast in, the camera tips down to watch it go into the fire
    A.down = ease(A.down, S.fate ? 1 : 0, S.fate ? 1.6 : 1, dt);
    const fit = Math.max(1, 1.45 / camera.aspect);
    camera.position.set(Math.sin(t * 0.13) * (reduced ? 0 : 0.12), 0.55 - A.down * 1.2, 6.1 * fit);
    camera.lookAt(0, -0.05 + A.down * (LAVA_Y + 0.9), 0);

    stage.render(ms);
  };

  const dispose = () => {
    window.removeEventListener('pointermove', onMove);
    stage.dispose();
  };

  holder.position.set(0, start.y, 0);
  return {
    update,
    fx() {},
    render,
    resize: stage.resize,
    dispose,
    stage,
    get lost() {
      return stage.lost;
    },
  };
}
