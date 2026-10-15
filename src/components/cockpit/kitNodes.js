// kit.js on the node renderer: the same kit, every export with its
// signature, its materials node materials with the same settings and flags.
// The helpers are kit.js’s, copied, not imported: kit.js holds the blinkers’
// and the glass’s onBeforeCompile, and importing it would bring their GLSL
// into a node world. So this file keeps its own list of what it made, and
// its freeKit frees that (kit.js’s frees kit.js’s).
//
// What differs on the node renderer, and why:
// - The blinkers’ chunk swap (each light’s on or off from its phase and the
//   time) is the material’s colourNode, line for line; uTime is a uniform
//   node on `material.uniforms` (the GLSL’s reached it through
//   userData.shader once compiled), and tick() writes it as before.
// - The glass’s swap (the dirt mixing in the light, the alpha thickening at
//   grazing angles) is its colourNode and opacityNode; uDirt and uLight are
//   on `material.uniforms`, and userData.setLight writes uLight as before.
//
// What the cockpits are built from: seeded randomness, textures painted on
// canvases at load (panel plates and their seams, consoles of buttons and
// labels, wear), the shared materials, glass that reads as glass from the
// inside, little screens that redraw themselves, and status lights that
// blink. Nothing here is downloaded: a cockpit’s surfaces are drawn by its
// own code, so they stay sharp up close and cost no bandwidth.

import * as THREE from 'three';
import { MeshBasicNodeMaterial, MeshStandardNodeMaterial, SpriteNodeMaterial } from 'three/webgpu';
import { abs, attribute, dot, float, fract, materialColor, mix, positionViewDirection, pow, step, texture, transformNormalToView, normalLocal, uniform, uv } from 'three/tsl';
import { sharpen } from '../../lib/three/textures';

// A seeded random number source (mulberry32), so a cockpit is the same
// every time.
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const owned = new Set();
// Everything a cockpit made here, freed in one go when it's let go.
export function freeKit() {
  for (const t of owned) t.dispose();
  owned.clear();
}

// A texture painted by `draw(ctx, w, h)` on a canvas. `aniso` left out
// takes the device tier's (lib/device: 16 on a desktop, 4 on a phone).
export function painted(w, h, draw, { srgb = true, repeat = null, aniso = null, mips = true } = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const x = c.getContext('2d');
  draw(x, w, h);
  const t = new THREE.CanvasTexture(c);
  sharpen(t);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  sharpen(t, { aniso });
  t.generateMipmaps = mips;
  if (!mips) t.minFilter = THREE.LinearFilter;
  owned.add(t);
  return t;
}

const hex = (c) => `#${new THREE.Color(c).getHexString()}`;
// a colour `k` of the way to black (k < 0) or white (k > 0)
export function shade(c, k) {
  const col = new THREE.Color(c);
  return hex(k < 0 ? col.lerp(new THREE.Color(0, 0, 0), -k) : col.lerp(new THREE.Color(1, 1, 1), k));
}

// Hull plating: plates of slightly different tones, dark seams between them,
// rivets along the edges, grime collecting low on each plate and scuffs.
// Returns { map, bump, rough } to share between materials.
export function platingMaps({ base = '#8b8a84', size = 512, cols = 4, rows = 3, seam = 0.55, rivets = true, grime = 0.35, scuffs = 40, seed = 3 } = {}) {
  const r = rng(seed);
  const plates = [];
  for (let j = 0; j < rows; j++) {
    // a ragged grid: each row splits its width its own way
    let x = 0;
    for (let i = 0; i < cols; i++) {
      const w = i === cols - 1 ? 1 - x : (1 / cols) * (0.7 + r() * 0.6);
      plates.push({ x, y: j / rows, w, h: 1 / rows, tone: (r() - 0.5) * 0.12, grime: r() });
      x += w;
    }
  }
  const scuff = Array.from({ length: scuffs }, () => [r(), r(), (r() - 0.5) * 0.08, r() * 0.06 + 0.01, r()]);
  const map = painted(size, size, (g, W, H) => {
    g.fillStyle = base;
    g.fillRect(0, 0, W, H);
    for (const p of plates) {
      g.fillStyle = shade(base, p.tone);
      g.fillRect(p.x * W, p.y * H, p.w * W, p.h * H);
      // grime gathers along a plate's lower edge
      const gr = g.createLinearGradient(0, (p.y + p.h * 0.45) * H, 0, (p.y + p.h) * H);
      gr.addColorStop(0, 'rgba(30,24,18,0)');
      gr.addColorStop(1, `rgba(30,24,18,${grime * (0.4 + p.grime * 0.6)})`);
      g.fillStyle = gr;
      g.fillRect(p.x * W, p.y * H, p.w * W, p.h * H);
    }
    g.lineWidth = 2;
    g.strokeStyle = `rgba(14,12,10,${seam})`;
    for (const p of plates) g.strokeRect(p.x * W + 1, p.y * H + 1, p.w * W - 2, p.h * H - 2);
    if (rivets) {
      g.fillStyle = 'rgba(20,18,16,0.55)';
      for (const p of plates) {
        const n = Math.max(2, Math.round(p.w * 10));
        for (let k = 0; k <= n; k++) {
          const px = (p.x + 0.012 + (p.w - 0.024) * (k / n)) * W;
          for (const py of [p.y + 0.02, p.y + p.h - 0.02]) {
            g.beginPath();
            g.arc(px, py * H, 1.6, 0, Math.PI * 2);
            g.fill();
          }
        }
      }
    }
    // scuffs and scratches, lighter where the paint is worn
    for (const [sx, sy, a, len, k] of scuff) {
      g.strokeStyle = k > 0.5 ? 'rgba(255,250,240,0.10)' : 'rgba(20,16,12,0.16)';
      g.lineWidth = 0.6 + k;
      g.beginPath();
      g.moveTo(sx * W, sy * H);
      g.lineTo((sx + Math.cos(a) * len) * W, (sy + Math.sin(a) * len) * H);
      g.stroke();
    }
  });
  const bump = painted(
    size,
    size,
    (g, W, H) => {
      g.fillStyle = '#808080';
      g.fillRect(0, 0, W, H);
      g.lineWidth = 3;
      g.strokeStyle = '#2a2a2a';
      for (const p of plates) g.strokeRect(p.x * W + 1.5, p.y * H + 1.5, p.w * W - 3, p.h * H - 3);
      if (rivets) {
        g.fillStyle = '#d0d0d0';
        for (const p of plates) {
          const n = Math.max(2, Math.round(p.w * 10));
          for (let k = 0; k <= n; k++) {
            const px = (p.x + 0.012 + (p.w - 0.024) * (k / n)) * W;
            for (const py of [p.y + 0.02, p.y + p.h - 0.02]) {
              g.beginPath();
              g.arc(px, py * H, 1.8, 0, Math.PI * 2);
              g.fill();
            }
          }
        }
      }
    },
    { srgb: false },
  );
  const rough = painted(
    size,
    size,
    (g, W, H) => {
      g.fillStyle = '#b4b4b4';
      g.fillRect(0, 0, W, H);
      for (const p of plates) {
        const v = Math.round(160 + p.tone * 300 + p.grime * 40);
        g.fillStyle = `rgb(${v},${v},${v})`;
        g.fillRect(p.x * W, p.y * H, p.w * W, p.h * H);
      }
      for (const [sx, sy, a, len] of scuff) {
        g.strokeStyle = '#6a6a6a';
        g.lineWidth = 1.2;
        g.beginPath();
        g.moveTo(sx * W, sy * H);
        g.lineTo((sx + Math.cos(a) * len) * W, (sy + Math.sin(a) * len) * H);
        g.stroke();
      }
    },
    { srgb: false },
  );
  return { map, bump, rough };
}

// A plated material from platingMaps, repeated `rx` × `ry` times.
export function plated(maps, { rx = 1, ry = 1, color = 0xffffff, metalness = 0.35, bump = 0.6, ...extra } = {}) {
  const rep = (t) => {
    if (!t) return null;
    const c = t.clone();
    c.wrapS = c.wrapT = THREE.RepeatWrapping;
    c.repeat.set(rx, ry);
    c.needsUpdate = true;
    owned.add(c);
    return c;
  };
  return new MeshStandardNodeMaterial({ color, map: rep(maps.map), bumpMap: rep(maps.bump), bumpScale: bump, roughnessMap: rep(maps.rough), roughness: 1, metalness, ...extra });
}

// A console's face: rows of square buttons and round knobs, small labels,
// little grilles and the odd slot, drawn on a dark panel; and its glow (the
// lit buttons, for the emissive map). `lit` is how many of the buttons are
// lit. Returns { map, glow, bump }.
const GLYPHS = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ';
export function consoleMaps({ w = 512, h = 256, base = '#2a2b2e', seed = 11, lit = 0.35, palette = ['#ff4a3d', '#ffb02e', '#58e07a', '#5cc8ff', '#f4f1e8'], labels = true, grilles = 2 } = {}) {
  const r = rng(seed);
  // the layout first, so the face, its glow and its bump agree
  const items = [];
  const rows = 3 + Math.floor(r() * 3);
  for (let j = 0; j < rows; j++) {
    const y = 0.1 + (j / rows) * 0.82;
    const kind = r();
    let x = 0.05;
    while (x < 0.92) {
      const block = 2 + Math.floor(r() * 6);
      const s = 0.028 + r() * 0.018;
      for (let k = 0; k < block && x < 0.95; k++) {
        const color = palette[Math.floor(r() * palette.length)];
        items.push({ type: kind < 0.6 ? 'btn' : kind < 0.85 ? 'knob' : 'tog', x, y, s, color, lit: r() < lit });
        x += s * 1.55;
      }
      x += 0.03 + r() * 0.05;
    }
  }
  const grill = Array.from({ length: grilles }, () => ({ x: 0.05 + r() * 0.7, y: 0.05 + r() * 0.7, w: 0.12 + r() * 0.12, h: 0.06 + r() * 0.08 }));
  const text = Array.from({ length: labels ? 14 : 0 }, () => ({ x: 0.04 + r() * 0.85, y: 0.06 + r() * 0.9, t: Array.from({ length: 2 + Math.floor(r() * 5) }, () => GLYPHS[Math.floor(r() * GLYPHS.length)]).join('') }));

  const map = painted(w, h, (g, W, H) => {
    g.fillStyle = base;
    g.fillRect(0, 0, W, H);
    // panel insets
    g.strokeStyle = 'rgba(0,0,0,0.6)';
    g.lineWidth = 2;
    g.strokeRect(4, 4, W - 8, H - 8);
    g.strokeStyle = 'rgba(255,255,255,0.06)';
    g.strokeRect(6, 6, W - 12, H - 12);
    for (const q of grill) {
      g.fillStyle = 'rgba(0,0,0,0.5)';
      g.fillRect(q.x * W, q.y * H, q.w * W, q.h * H);
      g.strokeStyle = 'rgba(255,255,255,0.08)';
      for (let k = 0; k < q.h * H; k += 3) {
        g.beginPath();
        g.moveTo(q.x * W, q.y * H + k);
        g.lineTo((q.x + q.w) * W, q.y * H + k);
        g.stroke();
      }
    }
    for (const it of items) {
      const px = it.x * W;
      const py = it.y * H;
      const s = it.s * W;
      if (it.type === 'btn') {
        g.fillStyle = 'rgba(0,0,0,0.65)';
        g.fillRect(px - 1, py - 1, s + 2, s + 2);
        g.fillStyle = it.lit ? it.color : shade(it.color, -0.62);
        g.fillRect(px, py, s, s);
        g.fillStyle = 'rgba(255,255,255,0.18)';
        g.fillRect(px, py, s, s * 0.25);
      } else if (it.type === 'knob') {
        g.fillStyle = '#111';
        g.beginPath();
        g.arc(px + s / 2, py + s / 2, s * 0.55, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = '#5b5c60';
        g.beginPath();
        g.arc(px + s / 2, py + s / 2, s * 0.4, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = it.lit ? it.color : '#d8d4c8';
        g.lineWidth = 1.5;
        g.beginPath();
        g.moveTo(px + s / 2, py + s / 2);
        g.lineTo(px + s / 2, py + s * 0.12);
        g.stroke();
      } else {
        g.fillStyle = '#121212';
        g.fillRect(px, py, s * 0.7, s * 1.2);
        g.fillStyle = '#c9c6bd';
        g.fillRect(px + s * 0.2, py - s * 0.15, s * 0.3, s * 0.7);
      }
    }
    g.fillStyle = 'rgba(236,230,214,0.55)';
    g.font = `${Math.round(H * 0.045)}px serif`;
    for (const q of text) g.fillText(q.t, q.x * W, q.y * H);
  });
  const glow = painted(w, h, (g, W, H) => {
    g.fillStyle = '#000';
    g.fillRect(0, 0, W, H);
    for (const it of items) {
      if (!it.lit) continue;
      const px = it.x * W;
      const py = it.y * H;
      const s = it.s * W;
      g.fillStyle = it.color;
      if (it.type === 'btn') g.fillRect(px, py, s, s);
      else if (it.type === 'knob') {
        g.beginPath();
        g.arc(px + s / 2, py + s * 0.15, s * 0.1, 0, Math.PI * 2);
        g.fill();
      }
    }
  });
  const bump = painted(
    w,
    h,
    (g, W, H) => {
      g.fillStyle = '#7a7a7a';
      g.fillRect(0, 0, W, H);
      for (const it of items) {
        const px = it.x * W;
        const py = it.y * H;
        const s = it.s * W;
        g.fillStyle = '#202020';
        g.fillRect(px - 1.5, py - 1.5, s + 3, s + 3);
        g.fillStyle = it.type === 'knob' ? '#e0e0e0' : '#b0b0b0';
        g.fillRect(px, py, s, s);
      }
      g.fillStyle = '#404040';
      for (const q of grill) g.fillRect(q.x * W, q.y * H, q.w * W, q.h * H);
    },
    { srgb: false },
  );
  return { map, glow, bump };
}

// A console's material from consoleMaps; `glow` scales its lit buttons.
export function consoleMat(maps, { glow = 1.6, roughness = 0.62, metalness = 0.25, color = 0xffffff } = {}) {
  return new MeshStandardNodeMaterial({ color, map: maps.map, emissiveMap: maps.glow, emissive: new THREE.Color(1, 1, 1), emissiveIntensity: glow, bumpMap: maps.bump, bumpScale: 1.2, roughness, metalness });
}

// A small screen that redraws itself: `draw(ctx, w, h, t)` about `fps` times a
// second while its cockpit is shown. Emissive, so it lights up the dark.
export function screen(w, h, draw, { px = 256, fps = 12, glow = 1.4 } = {}) {
  const ch = Math.round((px * h) / w);
  const c = document.createElement('canvas');
  c.width = px;
  c.height = ch;
  const g = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  sharpen(tex);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  owned.add(tex);
  draw(g, px, ch, 0);
  const mat = new MeshBasicNodeMaterial({ map: tex, toneMapped: false, color: new THREE.Color(glow, glow, glow) });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  let last = -1;
  return {
    mesh,
    tick(t) {
      const f = Math.floor(t * fps);
      if (f === last) return;
      last = f;
      draw(g, px, ch, t);
      tex.needsUpdate = true;
    },
  };
}

// Status lights: small emissive dots that blink each at its own pace, all
// one draw. `spots` are [x, y, z] in the parent's space; `colors` cycle.
export function blinkers(spots, { size = 0.006, colors = ['#ff4a3d', '#58e07a', '#ffb02e', '#5cc8ff'], seed = 5, normal = [0, 0, 1] } = {}) {
  const r = rng(seed);
  const geo = new THREE.CircleGeometry(size, 10);
  geo.lookAt(new THREE.Vector3(...normal));
  const mat = new MeshBasicNodeMaterial({ toneMapped: false });
  const phase = new Float32Array(spots.length * 2);
  const uTime = uniform(0);
  mat.uniforms = { uTime };
  // (begin_vertex's line: on or off, worked out a vertex, as the GLSL did)
  const aBlink = attribute('aBlink', 'vec2');
  const vOn = step(aBlink.y, fract(uTime.mul(aBlink.x.mul(1.4).add(0.25)).add(aBlink.x.mul(9.1)))).toVarying('vOn');
  // (color_fragment's: the instance's colour, lit or dimmed)
  mat.colorNode = materialColor.mul(mix(0.08, 2.4, vOn));
  const mesh = new THREE.InstancedMesh(geo, mat, spots.length);
  const m = new THREE.Matrix4();
  const col = new THREE.Color();
  spots.forEach((p, i) => {
    m.makeTranslation(p[0], p[1], p[2]);
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, col.set(colors[i % colors.length]));
    phase[i * 2] = r();
    phase[i * 2 + 1] = 0.25 + r() * 0.6; // how much of the cycle it's dark
  });
  geo.setAttribute('aBlink', new THREE.InstancedBufferAttribute(phase, 2));
  mesh.frustumCulled = false;
  return {
    mesh,
    tick(t) {
      uTime.value = t;
    },
  };
}

// Glass seen from inside: nearly clear face on, a faint tint and reflection
// thickening towards grazing angles, smudges and fine scratches that catch
// the light. Cheap (no transmission pass). Draw it last.
export function glassMat({ tint = '#cfe3ef', opacity = 0.07, rim = 0.32, smudge = 0.5, seed = 9 } = {}) {
  const r = rng(seed);
  const dirt = painted(
    256,
    256,
    (g, W, H) => {
      g.fillStyle = '#000';
      g.fillRect(0, 0, W, H);
      for (let i = 0; i < 26; i++) {
        const x = r() * W;
        const y = r() * H;
        const rad = 8 + r() * 40;
        const gr = g.createRadialGradient(x, y, 0, x, y, rad);
        gr.addColorStop(0, `rgba(255,255,255,${0.12 + r() * 0.2})`);
        gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr;
        g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
      }
      g.strokeStyle = 'rgba(255,255,255,0.35)';
      for (let i = 0; i < 60; i++) {
        const x = r() * W;
        const y = r() * H;
        const a = r() * Math.PI;
        const l = 4 + r() * 22;
        g.lineWidth = 0.5;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
        g.stroke();
      }
    },
    { srgb: false },
  );
  const mat = new MeshBasicNodeMaterial({ color: tint, transparent: true, opacity: 1, depthWrite: false, side: THREE.DoubleSide, toneMapped: true });
  const uDirt = texture(dirt);
  const uLight = uniform(new THREE.Color(1, 1, 1));
  mat.uniforms = { uDirt, uLight };
  // (the GLSL's vGN: the geometry's normal in view space, unflipped on the back face; abs() makes it either way)
  const vGN = transformNormalToView(normalLocal).toVarying('vGN');
  const facing = abs(dot(vGN.normalize(), positionViewDirection));
  const fres = pow(float(1).sub(facing), 3);
  const d = uDirt.sample(uv().mul(2)).r;
  mat.colorNode = mix(materialColor.rgb, uLight, d.mul(0.6));
  // (to three places, as the GLSL wrote them in)
  const fixed = (x) => Number(x.toFixed(3));
  mat.opacityNode = float(fixed(opacity)).add(fres.mul(fixed(rim))).add(d.mul(fixed(smudge * 0.12)));
  // how the light outside catches the smudges (the tunnel's blue, the portal's green)
  mat.userData.setLight = (c) => uLight.value.copy(c);
  return mat;
}

// A soft round glow, for lamps, flares and engine light.
let glowTex = null;
export function glowTexture() {
  if (glowTex) return glowTex;
  glowTex = painted(
    128,
    128,
    (g, W) => {
      const gr = g.createRadialGradient(W / 2, W / 2, 0, W / 2, W / 2, W / 2);
      gr.addColorStop(0, 'rgba(255,255,255,1)');
      gr.addColorStop(0.18, 'rgba(255,255,255,0.55)');
      gr.addColorStop(0.5, 'rgba(255,255,255,0.12)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, W, W);
    },
    { mips: true },
  );
  owned.delete(glowTex); // kept for the whole visit
  return glowTex;
}

export function glowSprite(color, size, opacity = 1) {
  const s = new THREE.Sprite(new SpriteNodeMaterial({ map: glowTexture(), color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  s.scale.setScalar(size);
  return s;
}

// A tube along points (a Catmull-Rom curve through them).
export function tubeAlong(points, radius, { segs = 32, radial = 8, closed = false } = {}) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), closed);
  return new THREE.TubeGeometry(curve, segs, radius, radial, closed);
}

// A rounded box (a box with its edges bevelled), for consoles and seats.
export function roundedBox(w, h, d, r = 0.02, seg = 3) {
  const shape = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  shape.moveTo(x + r, y);
  shape.lineTo(x + w - r, y);
  shape.quadraticCurveTo(x + w, y, x + w, y + r);
  shape.lineTo(x + w, y + h - r);
  shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  shape.lineTo(x + r, y + h);
  shape.quadraticCurveTo(x, y + h, x, y + h - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: d - r * 2, bevelEnabled: true, bevelThickness: r, bevelSize: r * 0.9, bevelSegments: seg, curveSegments: seg * 2 });
  geo.translate(0, 0, -(d - r * 2) / 2);
  return geo;
}

// Planar UVs for a geometry, from its own x/y (or another pair of axes),
// scaled so one unit of texture covers `size` units of model.
export function planarUV(geo, { axes = ['x', 'y'], size = 1 } = {}) {
  const pos = geo.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  const a = axes.map((k) => ({ x: 0, y: 1, z: 2 })[k]);
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = pos.array[i * 3 + a[0]] / size;
    uv[i * 2 + 1] = pos.array[i * 3 + a[1]] / size;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}
