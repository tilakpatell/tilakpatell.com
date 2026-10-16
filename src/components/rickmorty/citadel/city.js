// The Citadel's city round the terrace, as the show draws it: towers in
// pale greens, yellow-greens and teals with rows of lit windows and cyan
// light up their edges, rising out of the lower city into a golden haze;
// a teal glass dome among them; an arched viaduct with a monorail going
// round; and over everything the great dome's lattice against a warm sky,
// with the Central Finite Curve arcing across it.
// Nothing here is walked on, so none of it is in ./layout.js; it starts
// past the terrace's edge (radius 41) and keeps out of the doors' way.

import * as THREE from 'three';
import { toon } from '../portal/toon';
import { bake } from '../../middleearth/towns/bake';
import { makeCanvas } from '../../../lib/paint';
import { hot } from '../stage';

const LOW = -14; // the lower city's floor, under the terrace
const RAIL = { r: 47.5, y: 7.2 }; // the monorail's track
const FACADES = ['#a9d6b4', '#c5e09f', '#8ccdbf', '#d9e3a6', '#9fd0c8', '#b8d8a0', '#cfe6c4', '#7fc4b4'];

export function rng(seed) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// the windows: bands of them, big panes, most dark, some lit warm or cool,
// in the tower's own colour between; one sheet for every tower (its
// colour comes from the tower)
const PANES = (() => {
  const r = rng(7);
  return Array.from({ length: 24 }, () => r());
})();
export function paintWindows() {
  const c = makeCanvas(256, 256);
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 6; y++) {
    // a sill line under each row
    g.fillStyle = 'rgba(40, 80, 70, 0.22)';
    g.fillRect(0, y * 42 + 34, 256, 5);
    for (let x = 0; x < 4; x++) {
      const lit = PANES[y * 4 + x];
      g.fillStyle = lit > 0.74 ? '#fff0c4' : lit > 0.64 ? '#d2fff6' : '#86aaa0';
      g.fillRect(x * 64 + 8, y * 42 + 7, 48, 25);
    }
  }
  return c;
}
// what of that glows: just the lit panes
export function paintWindowGlow() {
  const c = makeCanvas(256, 256);
  const g = c.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 6; y++) {
    for (let x = 0; x < 4; x++) {
      const lit = PANES[y * 4 + x];
      if (lit <= 0.64) continue;
      g.fillStyle = lit > 0.74 ? '#ffe2a0' : '#a0fff0';
      g.fillRect(x * 64 + 8, y * 42 + 7, 48, 25);
    }
  }
  return c;
}

// the sky: a warm haze, brighter low down, and the great dome's lattice
// against it, its ribs olive and its joints lit
export const SKY_FRAG = `
varying vec3 vDir;
uniform float uRed;
void main() {
  vec3 d = normalize(vDir);
  float h = clamp(d.y, -0.2, 1.0);
  vec3 low = vec3(0.96, 0.72, 0.4), high = vec3(0.78, 0.5, 0.24), top = vec3(0.52, 0.36, 0.2);
  vec3 c = mix(low, high, smoothstep(0.0, 0.45, h));
  c = mix(c, top, smoothstep(0.45, 1.0, h));
  // the lattice: meridians and rings of the dome
  float az = atan(d.z, d.x);
  float el = asin(clamp(d.y, -1.0, 1.0));
  float m = abs(fract(az * 16.0 / 6.28318) - 0.5);
  float r = abs(fract(el * 10.0 / 1.5708) - 0.5);
  float w = fwidth(az * 16.0 / 6.28318) * 1.5 + 0.004;
  float wr = fwidth(el * 10.0 / 1.5708) * 1.5 + 0.004;
  float rib = max(1.0 - smoothstep(0.0, w * 1.6, m - 0.0), 1.0 - smoothstep(0.0, wr * 1.6, r));
  rib *= smoothstep(0.08, 0.3, h);
  c = mix(c, vec3(0.42, 0.4, 0.2), rib * 0.55);
  // and the haze a little red on red alert
  c = mix(c, c * vec3(1.15, 0.6, 0.55), uRed * 0.6);
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`;

export function buildCity(renderer, { tier = 'high', gaps = [] }) {
  const group = new THREE.Group();
  group.name = 'city';
  const statics = new THREE.Group();
  group.add(statics);
  const hide = [];
  const r = rng(42);
  const aniso = Math.min(tier === 'high' ? 8 : 2, renderer.capabilities.getMaxAnisotropy());
  const tex = (canvas) => {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = aniso;
    return t;
  };
  const winMap = tex(paintWindows());
  const winGlow = tex(paintWindowGlow());
  // every tower in one material: the windows' sheet, coloured by the tower
  const towerMat = toon(0xffffff, { map: winMap, emissiveMap: winGlow, emissive: hot(0xffffff, 0.4), vertexColors: true });
  const plainMat = toon(0xffffff, { vertexColors: true });
  const glow = new THREE.MeshBasicMaterial({ color: hot(0x6ff3ff, 2.0), fog: false });
  const glowWarm = new THREE.MeshBasicMaterial({ color: hot(0xffe08a, 1.8), fog: false });

  // a piece of a tower: its geometry, coloured, its windows sized to it
  const colour = new THREE.Color();
  const paint = (geo, hex, { win = true, scale = 11 } = {}) => {
    const pos = geo.attributes.position;
    colour.set(hex);
    const cols = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) cols.set([colour.r, colour.g, colour.b], i * 3);
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    if (win && geo.attributes.uv) {
      // windows a set size whatever the tower's: scale the uvs by its size
      geo.computeBoundingBox();
      const s = geo.boundingBox.getSize(new THREE.Vector3());
      const uv = geo.attributes.uv;
      const around = Math.max(s.x, s.z) * (geo.userData.round ? Math.PI : 1);
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * around) / scale, (uv.getY(i) * s.y) / scale);
    }
    return geo;
  };
  const place = (geo, mat, x, y, z, turn = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.y = turn;
    statics.add(m);
    return m;
  };
  // is the angle a clear of the doors?
  const clearOf = (a, by) => gaps.every((g) => Math.abs(Math.atan2(Math.sin(a - g), Math.cos(a - g))) > by);

  // ── a tower, of one of the show's shapes ──
  const tower = (x, z, h, w, kind) => {
    const hex = FACADES[Math.floor(r() * FACADES.length)];
    const turn = r() * Math.PI;
    const base = LOW;
    if (kind === 'round') {
      const g = new THREE.CylinderGeometry(w / 2, w / 2, h, 24, 1, true);
      g.userData.round = true;
      place(paint(g, hex), towerMat, x, base + h / 2, z);
      // a domed top
      place(paint(new THREE.SphereGeometry(w / 2, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), hex, { win: false }), plainMat, x, base + h, z);
      place(new THREE.TorusGeometry(w / 2 + 0.05, 0.12, 6, 32).rotateX(Math.PI / 2), glow, x, base + h - 0.3, z);
    } else if (kind === 'stepped') {
      let y = base;
      let ww = w;
      for (let i = 0; i < 3; i++) {
        const hh = h * [0.5, 0.3, 0.2][i];
        place(paint(new THREE.BoxGeometry(ww, hh, ww * 0.8), hex), towerMat, x, y + hh / 2, z, turn);
        place(paint(new THREE.BoxGeometry(ww + 0.3, 0.3, ww * 0.8 + 0.3), '#e6f2dc', { win: false }), plainMat, x, y + hh, z, turn);
        y += hh;
        ww *= 0.72;
      }
    } else if (kind === 'blade') {
      // a tall slab, its edges lit
      place(paint(new THREE.BoxGeometry(w, h, w * 0.45), hex), towerMat, x, base + h / 2, z, turn);
      for (const s of [-1, 1]) {
        const strip = place(new THREE.BoxGeometry(0.3, h * 0.92, 0.3), glow, x, base + h * 0.47, z, turn);
        strip.position.x += Math.cos(turn) * s * (w / 2 + 0.05);
        strip.position.z -= Math.sin(turn) * s * (w / 2 + 0.05);
      }
    } else if (kind === 'crown') {
      // a round tower that flares out at the top, as the show's do
      const g = new THREE.CylinderGeometry(w * 0.42, w * 0.5, h * 0.82, 20, 1, true);
      g.userData.round = true;
      place(paint(g, hex), towerMat, x, base + (h * 0.82) / 2, z);
      place(paint(new THREE.CylinderGeometry(w * 0.75, w * 0.42, h * 0.12, 20), '#e6f2dc', { win: false }), plainMat, x, base + h * 0.88, z);
      place(paint(new THREE.CylinderGeometry(w * 0.7, w * 0.75, h * 0.06, 20), hex, { win: false }), plainMat, x, base + h * 0.97, z);
      place(new THREE.TorusGeometry(w * 0.74, 0.14, 6, 32).rotateX(Math.PI / 2), glow, x, base + h * 0.94, z);
    } else {
      // a plain block with a lit band near its top
      place(paint(new THREE.BoxGeometry(w, h, w * (0.6 + r() * 0.4)), hex), towerMat, x, base + h / 2, z, turn);
      place(new THREE.BoxGeometry(w + 0.1, 0.35, w * 0.9), glowWarm, x, base + h - 1.2, z, turn);
    }
    // an aerial now and then
    if (r() < 0.3) place(paint(new THREE.CylinderGeometry(0.08, 0.14, 4 + r() * 6, 5), '#5e7f7a', { win: false }), plainMat, x, base + h + 3, z);
  };
  const KINDS = ['round', 'stepped', 'blade', 'crown', 'block'];
  // the near ring, round the terrace, kept out of the doors' way
  const n1 = tier === 'low' ? 18 : 28;
  for (let i = 0; i < n1; i++) {
    const a = (i / n1) * Math.PI * 2 + r() * 0.1;
    if (!clearOf(a, 0.16)) continue;
    const d = 54 + r() * 14;
    tower(Math.cos(a) * d, Math.sin(a) * d, 30 + r() * 46, 8 + r() * 7, KINDS[Math.floor(r() * KINDS.length)]);
  }
  // further out, taller, into the haze
  const n2 = tier === 'low' ? 22 : 40;
  for (let i = 0; i < n2; i++) {
    const a = (i / n2) * Math.PI * 2 + r() * 0.12;
    const d = 85 + r() * 90;
    tower(Math.cos(a) * d, Math.sin(a) * d, 60 + r() * 110, 10 + r() * 12, KINDS[Math.floor(r() * KINDS.length)]);
  }
  // a teal glass dome among them, as on the poster
  {
    const a = 2.62;
    const d = 64;
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    const dome = place(new THREE.SphereGeometry(16, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x5fd0c8, transparent: true, opacity: 0.38, depthWrite: false }), x, LOW + 18, z);
    statics.remove(dome);
    group.add(dome);
    hide.push(dome);
    place(paint(new THREE.CylinderGeometry(16.4, 17, 18, 40, 1, true), '#9fd0c8'), towerMat, x, LOW + 9, z);
    for (let i = 0; i < 10; i++) {
      const b = (i / 10) * Math.PI * 2;
      const pts = [];
      for (let j = 0; j <= 10; j++) {
        const th = (j / 10) * (Math.PI / 2) * 0.96;
        pts.push(new THREE.Vector3(x + Math.cos(b) * 16.1 * Math.cos(th), LOW + 18 + 16.1 * Math.sin(th), z + Math.sin(b) * 16.1 * Math.cos(th)));
      }
      place(paint(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, 0.25, 5), '#2f8f86', { win: false }), plainMat, 0, 0, 0);
    }
  }
  // the lower city's floor, and its streets' lights
  const ground = place(paint(new THREE.CircleGeometry(320, 64), '#5f8a78', { win: false }), plainMat, 0, LOW, 0);
  ground.rotation.x = -Math.PI / 2;
  for (const rr of [72, 110, 150]) {
    const ring = place(new THREE.TorusGeometry(rr, 0.35, 4, 96).rotateX(Math.PI / 2), glowWarm, 0, LOW + 0.2, 0);
    void ring;
  }

  // ── the viaduct, and the monorail on it ──
  {
    const segs = 96;
    for (let i = 0; i < segs; i++) {
      const a = ((i + 0.5) / segs) * Math.PI * 2;
      const len = ((Math.PI * 2 * RAIL.r) / segs) * 1.02;
      // (a turn whose +x runs along the ring)
      const turn = Math.atan2(-Math.cos(a), -Math.sin(a));
      place(paint(new THREE.BoxGeometry(len, 0.8, 2.6), '#6f9a92', { win: false }), plainMat, Math.cos(a) * RAIL.r, RAIL.y - 0.4, Math.sin(a) * RAIL.r, turn);
      place(new THREE.BoxGeometry(len, 0.12, 0.12), glow, Math.cos(a) * (RAIL.r - 1.32), RAIL.y - 0.7, Math.sin(a) * (RAIL.r - 1.32), turn);
    }
    // piers, and arches between them, as the show's viaducts have
    // (none behind the buildings at the edge: the hangar's bay opens
    // through there, and the cruiser flies out of it)
    const piers = 32;
    const stands = (i) => clearOf((i / piers) * Math.PI * 2, 0.1);
    for (let i = 0; i < piers; i++) {
      const a = (i / piers) * Math.PI * 2;
      const x = Math.cos(a) * RAIL.r;
      const z = Math.sin(a) * RAIL.r;
      const turn = Math.atan2(-Math.cos(a), -Math.sin(a));
      if (stands(i)) place(paint(new THREE.BoxGeometry(1.6, RAIL.y - LOW, 2.2), '#4f8a80', { win: false }), plainMat, x, (RAIL.y + LOW) / 2 - 0.4, z, turn);
      if (!stands(i) || !stands((i + 1) % piers)) continue;
      const next = ((i + 0.5) / piers) * Math.PI * 2;
      const span = (Math.PI * 2 * RAIL.r) / piers;
      const arch = place(paint(new THREE.TorusGeometry(span / 2 - 0.8, 0.45, 6, 16, Math.PI), '#4f8a80', { win: false }), plainMat, Math.cos(next) * RAIL.r, RAIL.y - 0.8 - (span / 2 - 0.8), Math.sin(next) * RAIL.r, 0);
      arch.rotation.y = Math.atan2(-Math.cos(next), -Math.sin(next));
      const archGlow = place(new THREE.TorusGeometry(span / 2 - 0.35, 0.07, 4, 16, Math.PI), glow, Math.cos(next) * (RAIL.r - 1.2), RAIL.y - 0.8 - (span / 2 - 0.8), Math.sin(next) * (RAIL.r - 1.2), 0);
      archGlow.rotation.y = arch.rotation.y;
    }
  }
  const train = new THREE.Group();
  group.add(train);
  const cars = [];
  {
    const body = toon(0xeef4f0);
    const band = toon(0x2f8f86);
    const win = new THREE.MeshBasicMaterial({ color: 0x24443f });
    for (let i = 0; i < 3; i++) {
      const car = new THREE.Group();
      const shell = new THREE.Mesh(new THREE.CapsuleGeometry(1.25, 7, 6, 16).rotateZ(Math.PI / 2), body);
      shell.scale.set(1, 1.05, 0.95);
      car.add(shell);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.3, 2.42), band);
      stripe.position.y = -0.55;
      car.add(stripe);
      const windows = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.8, 2.44), win);
      windows.position.y = 0.3;
      car.add(windows);
      const lit = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.08, 2.46), glow);
      lit.position.y = -0.85;
      car.add(lit);
      train.add(car);
      cars.push(car);
    }
  }

  // ── the sky, and the dome's lattice ──
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(470, 48, 24),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: { uRed: { value: 0 } },
      vertexShader: 'varying vec3 vDir; void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: SKY_FRAG,
    }),
  );
  sky.renderOrder = -10;
  group.add(sky);
  hide.push(sky);

  // the Central Finite Curve: a vast arc of light over the city, from one
  // horizon to the other, white-gold at its heart and rainbow at its edges
  const curveMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
    toneMapped: false,
    uniforms: { uTime: { value: 0 }, uRed: { value: 0 } },
    vertexShader: 'varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main() { vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalMatrix * normal; vV = -mv.xyz; gl_Position = projectionMatrix * mv; }',
    fragmentShader: `
      uniform float uTime, uRed;
      varying vec2 vUv;
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        // across the tube as you see it: its heart down the middle, where
        // the tube faces you, and a rainbow fringe at its edges
        float across = 1.0 - abs(dot(normalize(vN), normalize(vV)));
        float core = exp(-across * across * 14.0);
        float edge = exp(-pow(across - 0.6, 2.0) * 40.0);
        vec3 bow = 0.5 + 0.5 * cos(6.28318 * (vec3(0.0, 0.33, 0.67) + vUv.x * 6.0 + uTime * 0.05));
        float shimmer = 0.8 + 0.2 * sin(vUv.x * 300.0 + uTime * 1.5);
        // breaking on red alert: it stutters
        float flick = mix(1.0, step(0.3, fract(sin(floor(uTime * 8.0 + vUv.x * 20.0) * 12.9898) * 43758.5453)), uRed);
        vec3 c = (vec3(1.0, 0.95, 0.78) * core * 1.3 + bow * edge * 0.7) * shimmer * flick;
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const curve = new THREE.Mesh(new THREE.TorusGeometry(400, 9, 12, 160, Math.PI), curveMat);
  curve.rotation.set(-0.45, 0.6, 0);
  curve.position.y = -40;
  curve.renderOrder = -5;
  group.add(curve);
  hide.push(curve);

  const baked = bake(statics);
  statics.add(baked);

  let red = 0;
  const setMood = (m) => {
    red = m === 'red' ? 1 : 0;
    sky.material.uniforms.uRed.value = red;
    curveMat.uniforms.uRed.value = red;
    glow.color.copy(red ? hot(0xff4050, 2.2) : hot(0x6ff3ff, 2.0));
  };
  // the train, round and round (anticlockwise seen from above)
  const update = (t) => {
    curveMat.uniforms.uTime.value = t;
    const speed = 9 / RAIL.r;
    cars.forEach((car, i) => {
      const a = t * speed - i * (9.2 / RAIL.r);
      car.position.set(Math.cos(a) * RAIL.r, RAIL.y + 1.15, Math.sin(a) * RAIL.r);
      car.rotation.y = Math.atan2(-Math.cos(a), -Math.sin(a));
    });
  };
  const dispose = () => {
    group.traverse((o) => {
      o.geometry?.dispose?.();
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of mats) m.dispose?.();
    });
    winMap.dispose();
    winGlow.dispose();
  };
  return { group, hide, setMood, update, dispose };
}
