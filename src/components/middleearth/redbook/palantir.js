// The Palantír and the One Ring on Bilbo’s desk (the design’s §5, and the
// owner’s notes: look in the stone and the Eye looks back; make the Ring
// better).
//
// The stone: dark glass on an iron stand whose claws hold it, a cold light
// in its rim; inside, smoke turning, and when it is taken up the smoke
// parts on the Eye of Sauron (./eye.js), which turns to whoever looks
// (`look`), lights the desk red and, as it comes to know them (`seen`),
// burns brighter until it has seen them.
//
// The Ring: a band of gold turned on a lathe, round in its section,
// reflecting the room (a small painting of the room’s lights, ./envArt);
// the fire-letters on it, which show only when it is hot: warm in the hand,
// bright in the fire. It lies on the desk, lifts when the mouse is on it,
// is held up before the eyes, or lies in the hearth.
//
//   createPalantir({ mats, env }) → { group, stone (to pick), tick(dt, { held, eye, seen, look, camera }), dispose() }
//   createRing({ mats, env }) → { group, band (to pick), tick(dt, { hover, worn, heat, held, camera, at }), dispose() }
//   envArt() → a canvas: the room’s lights as an equirectangular picture, for metal and glass to reflect

import * as THREE from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { abs, dot, float, mix, positionViewDirection, normalView, pow, texture, uniform, uv, vec3, vec4 } from 'three/tsl';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { makeCanvas } from '../../../lib/paint';
import { rand } from './brush';
import { canvasMap } from './mats';
import { eyeMaterial, towerArt } from './eye';

export const RADIUS = 0.07; // the stone, m
const SEAT = 0.075; // the stone’s middle over the stand’s foot, less its radius

// the room’s lights, painted round: the dark of the room, the fire to one
// side, the candles, the moon in the window, the lantern up in the vault
export function envArt(w = 512) {
  const h = w / 2;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#2a1c12');
  g.addColorStop(0.5, '#1a120c');
  g.addColorStop(1, '#0c0806');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const spot = (x, y, r, colour, a = 1) => {
    const s = ctx.createRadialGradient(x * w, y * h, 0, x * w, y * h, r * w);
    s.addColorStop(0, colour);
    s.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = a;
    ctx.fillStyle = s;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
  };
  spot(0.25, 0.62, 0.16, '#ff8a3a', 0.9);
  spot(0.47, 0.45, 0.03, '#ffe2a0');
  spot(0.62, 0.48, 0.025, '#ffe2a0');
  spot(0.5, 0.36, 0.06, '#9fb4e8', 0.8);
  spot(0.5, 0.08, 0.05, '#ffc070', 0.7);
  spot(0.85, 0.5, 0.08, '#ffd8a8', 0.5);
  return c;
}

export function createPalantir({ mats, env }) {
  const group = new THREE.Group();
  const made = [];
  const keep = (x) => (made.push(x), x);

  // the stand, turned, and four claws up round the stone
  const iron = mats.lit({ color: 0x2a2620, roughness: 0.32, metalness: 0.85 });
  iron.envMap = env;
  const profile = [[0, 0], [0.068, 0], [0.07, 0.008], [0.052, 0.016], [0.03, 0.028], [0.02, 0.048], [0.026, 0.058], [0.05, 0.066], [0.054, 0.072], [0, 0.072]].map(([x, y]) => new THREE.Vector2(x, y));
  const stand = new THREE.Mesh(keep(new THREE.LatheGeometry(profile, 32)), iron);
  const claws = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const at = (r, y) => new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
    const curve = new THREE.CatmullRomCurve3([at(0.05, 0.068), at(0.066, 0.095), at(0.062, 0.13), at(0.045, 0.16)]);
    claws.push(new THREE.TubeGeometry(curve, 10, 0.0032, 6, false));
  }
  const clawMesh = new THREE.Mesh(keep(mergeGeometries(claws)), iron);
  claws.forEach((g) => g.dispose());
  group.add(stand, clawMesh);

  // inside: the smoke and the Eye, on a plane that always faces the one looking
  const tower = keep(canvasMap(towerArt(256)));
  const eye = eyeMaterial({ fog: false, tower });
  keep(eye.material);
  const inside = new THREE.Mesh(keep(new THREE.PlaneGeometry(RADIUS * 1.8, RADIUS * 1.8)), eye.material);
  inside.position.y = SEAT + RADIUS;
  inside.renderOrder = 3;
  group.add(inside);
  const heart = new THREE.Sprite(mats.glow('#ff5a1a', 0));
  heart.scale.setScalar(RADIUS * 2.4);
  heart.position.copy(inside.position);
  heart.renderOrder = 3;
  group.add(heart);

  // the glass: dark, glossy, its rim cold blue and turning to fire; clearer as the Eye opens
  const uRim = uniform(new THREE.Color(0x3a5a9a));
  const uRimPower = uniform(0.6);
  const glass = new MeshStandardNodeMaterial({ color: 0x06080e, roughness: 0.06, metalness: 0.1, transparent: true, opacity: 0.94, depthWrite: false });
  glass.envMap = env;
  glass.envMapIntensity = 0.5;
  const rim = pow(float(1).sub(abs(dot(normalView, positionViewDirection))), 2.5);
  glass.emissiveNode = vec3(uRim).mul(rim).mul(uRimPower);
  keep(glass);
  const stone = new THREE.Mesh(keep(new THREE.SphereGeometry(RADIUS, 48, 32)), glass);
  stone.position.y = SEAT + RADIUS;
  stone.renderOrder = 4;
  stone.userData.stone = true;
  group.add(stone);
  // the Eye’s light on the desk round it, there always and dark until the Eye is
  const red = new THREE.PointLight(0xff3a10, 0, 1.2, 1.6);
  red.position.set(0, SEAT + RADIUS, 0.05);
  group.add(red);

  let t = 0;
  let show = 0;
  const camPos = new THREE.Vector3();
  const cold = new THREE.Color(0x3a5a9a);
  const hot = new THREE.Color(0xff4a10);
  return {
    group,
    stone,
    tick(dt, { held = false, eye: open = 0, seen = 0, look = null, camera = null } = {}) {
      t += dt;
      show += ((held ? 1 : 0) - show) * Math.min(1, dt * (held ? 3 : 6));
      if (camera) {
        camera.getWorldPosition(camPos);
        inside.lookAt(camPos);
      }
      // (idle, a slow smoke with a dull ember in it: something is in there)
      eye.open.value = open;
      eye.power.value = 0.3 + show * 0.55 + seen * 0.35;
      eye.focus.value = seen;
      if (look) eye.look.value.set(look[0], look[1]);
      glass.opacity = 0.94 - show * 0.55 - open * 0.25;
      uRim.value.copy(cold).lerp(hot, Math.min(1, open * 0.6 + seen * 0.4));
      uRimPower.value = 0.5 + show * 0.6 + seen * 0.8 + 0.1 * Math.sin(t * 1.3);
      heart.material.opacity = 0.08 + open * (0.16 + seen * 0.2) + 0.04 * Math.sin(t * 2);
      red.intensity = open * (0.5 + seen * 0.9) * (0.9 + 0.1 * Math.sin(t * 7));
    },
    dispose() {
      for (const x of made) x.dispose();
      heart.material.dispose();
      iron.dispose();
    },
  };
}

// the fire-letters, in a flowing hand of the Elves’ kind round the band:
// bowls and stems and the strokes over them, painted white on black, the
// fire’s colour added in the material
function lettersArt(w = 1024, h = 64) {
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#fff';
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(1, h * 0.05);
  const r = rand(19);
  const y0 = h * 0.42;
  const y1 = h * 0.62;
  let x = 4;
  while (x < w - 12) {
    const k = r();
    const s = (y1 - y0) * (0.7 + r() * 0.3);
    ctx.beginPath();
    if (k < 0.35) {
      // a stem with a bowl
      ctx.moveTo(x, y0 - s * 0.3);
      ctx.lineTo(x, y1 + s * 0.2);
      ctx.moveTo(x, y0 + s * 0.2);
      ctx.quadraticCurveTo(x + s * 0.9, y0, x + s * 0.2, y1);
    } else if (k < 0.65) {
      // two bowls
      ctx.moveTo(x, y1);
      ctx.quadraticCurveTo(x + s * 0.5, y0 - s * 0.3, x + s * 0.6, y1);
      ctx.quadraticCurveTo(x + s * 1.1, y0 - s * 0.3, x + s * 1.2, y1);
    } else {
      // a curl
      ctx.arc(x + s * 0.4, (y0 + y1) / 2, s * 0.35, Math.PI * 0.2, Math.PI * 1.8);
    }
    ctx.stroke();
    // the strokes over the letters, the vowels
    if (r() < 0.5) {
      ctx.beginPath();
      ctx.moveTo(x + s * 0.2, y0 - s * 0.6);
      ctx.lineTo(x + s * 0.5, y0 - s * 0.8);
      ctx.stroke();
    }
    x += s * (k < 0.65 && k >= 0.35 ? 1.6 : 1.1) + (r() < 0.15 ? s * 0.8 : 0);
  }
  return c;
}

export function createRing({ mats, env }) {
  const group = new THREE.Group();
  const made = [];
  const keep = (x) => (made.push(x), x);
  // the band’s section: round, a little taller than it is thick, turned
  const section = [];
  const n = 28;
  for (let i = 0; i <= n; i++) {
    const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
    section.push(new THREE.Vector2(0.0156 + Math.cos(a) * 0.0024, Math.sin(a) * 0.0034));
  }
  const geo = keep(new THREE.LatheGeometry(section, 96));
  const letters = keep(canvasMap(lettersArt(), { aniso: 8 }));
  letters.wrapS = THREE.RepeatWrapping;
  const uHeat = uniform(0);
  const gold = new MeshStandardNodeMaterial({ roughness: 0.14, metalness: 1 });
  gold.envMap = env;
  gold.envMapIntensity = 1.6;
  gold.colorNode = vec4(1.0, 0.74, 0.3, 1);
  // (the letters on the outside of the band: its section’s outer half)
  const glyph = texture(letters, uv()).r;
  gold.emissiveNode = mix(vec3(0.05, 0.03, 0.0), vec3(1.0, 0.42, 0.06).mul(3.2), glyph.mul(uHeat)).add(vec3(1.0, 0.3, 0.05).mul(uHeat.mul(0.15)));
  keep(gold);
  const band = new THREE.Mesh(geo, gold);
  band.userData.ring = true;
  const holder = new THREE.Group();
  holder.add(band);
  holder.position.y = 0.0034;
  const glint = new THREE.Sprite(mats.glow('#ffd36a', 0.25));
  glint.scale.setScalar(0.07);
  glint.position.y = 0.006;
  const hotGlow = new THREE.Sprite(mats.glow('#ff7a2a', 0));
  hotGlow.scale.setScalar(0.09);
  group.add(holder, glint, hotGlow);

  let t = 0;
  let lift = 0;
  let hold = 0;
  const home = new THREE.Vector3();
  const there = new THREE.Vector3();
  const camPos = new THREE.Vector3();
  let homeSet = false;
  return {
    group,
    band,
    // at: a world point to be carried to (held up, or in the fire), or null to lie on the desk
    tick(dt, { hover = false, worn = false, heat = 0, held = false, camera = null, at = null } = {}) {
      t += dt;
      if (!homeSet) {
        home.copy(group.position);
        there.copy(home);
        homeSet = true;
      }
      group.visible = !worn;
      lift += ((hover && !held ? 1 : 0) - lift) * Math.min(1, dt * 6);
      hold += ((at ? 1 : 0) - hold) * Math.min(1, dt * 4);
      // (in the fire it is bigger than life, for you to read the letters)
      group.scale.setScalar(1 + (heat > 0.9 ? 1.6 : 0) * hold);
      uHeat.value += (heat - uHeat.value) * Math.min(1, dt * (heat > uHeat.value ? 1.5 : 0.6));
      // where it is: on the desk, or carried to `at` (and back from where it was)
      if (at && group.parent) {
        there.copy(at);
        group.parent.worldToLocal(there);
      }
      group.position.lerpVectors(home, there, hold);
      holder.position.y = 0.0034 + lift * 0.03;
      // lying flat on the desk; standing up to be looked at when held or lifted
      const up = Math.max(lift * 0.7, hold);
      holder.rotation.x = up * (Math.PI / 2) * 0.85;
      holder.rotation.y = t * (0.25 + up * 0.5);
      if (held && camera && hold > 0.5) {
        camera.getWorldPosition(camPos);
        group.lookAt(camPos);
      } else group.rotation.set(0, 0, 0);
      glint.material.opacity = (hover ? 0.6 : 0.22) + 0.08 * Math.sin(t * 2.2) + uHeat.value * 0.2;
      glint.position.y = holder.position.y + 0.003;
      hotGlow.material.opacity = uHeat.value * 0.7;
      hotGlow.position.copy(holder.position);
    },
    dispose() {
      for (const x of made) x.dispose();
      glint.material.dispose();
      hotGlow.material.dispose();
    },
  };
}
