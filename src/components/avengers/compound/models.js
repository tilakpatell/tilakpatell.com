// The compound's models: buildings raised from the plan's footprints, the
// Quinjet, trees for the woods, and the painted things on the ground (the
// helipad, the running track, the range, the landing pad's markings, the solar
// panels, the parking bays). Metres throughout: a plan unit is four metres.

import * as THREE from 'three';
import { PartBuilder, canvasTexture, lathe, rbox } from '../hq/kit/shapes';

export const U = 4; // metres to a plan unit
// a plan point (x east, y south, z up, in units) in the world (metres; y up)
export const W = (x, y, z = 0) => new THREE.Vector3(x * U, z * U, y * U);

// ── prisms from footprints ──

// The walls of a prism standing on a footprint (plan units, either winding),
// from z0 to z1 (units), with texture coordinates in metres along and up each
// wall (over `tile`). Normals face out. `scale` is metres to a unit across
// (`s`) and up (`v`): the walkable compound draws the plan at its own scale.
export function prismWalls(foot, z0, z1, tile = 1, { s = U, v = U } = {}) {
  const pos = [];
  const nor = [];
  const uv = [];
  // outward normals need a known winding: make it clockwise seen from above
  // (x east, y south), which is counter-clockwise in the world's xz
  let area = 0;
  for (let i = 0; i < foot.length; i++) {
    const [ax, ay] = foot[i];
    const [bx, by] = foot[(i + 1) % foot.length];
    area += ax * by - bx * ay;
  }
  const f = area > 0 ? foot : [...foot].reverse();
  let run = 0;
  for (let i = 0; i < f.length; i++) {
    const a = new THREE.Vector3(f[i][0] * s, 0, f[i][1] * s);
    const b = new THREE.Vector3(f[(i + 1) % f.length][0] * s, 0, f[(i + 1) % f.length][1] * s);
    const len = a.distanceTo(b);
    // outward, for a footprint counter-clockwise in (x, y)
    const n = new THREE.Vector3(b.z - a.z, 0, -(b.x - a.x)).normalize();
    const y0 = z0 * v;
    const y1 = z1 * v;
    const quad = [
      [a.x, y0, a.z, run, y0],
      [b.x, y0, b.z, run + len, y0],
      [b.x, y1, b.z, run + len, y1],
      [a.x, y0, a.z, run, y0],
      [b.x, y1, b.z, run + len, y1],
      [a.x, y1, a.z, run, y1],
    ];
    for (const [x, y, z, u, v] of quad) {
      pos.push(x, y, z);
      nor.push(n.x, n.y, n.z);
      uv.push(u / tile, v / tile);
    }
    run += len;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  // walls wound the other way face inward: check one and flip if need be
  const p = g.attributes.position;
  const e1 = new THREE.Vector3(p.getX(1) - p.getX(0), p.getY(1) - p.getY(0), p.getZ(1) - p.getZ(0));
  const e2 = new THREE.Vector3(p.getX(2) - p.getX(0), p.getY(2) - p.getY(0), p.getZ(2) - p.getZ(0));
  const face = e1.cross(e2);
  if (face.dot(new THREE.Vector3(nor[0], nor[1], nor[2])) < 0) {
    for (let i = 0; i < p.count; i += 3) {
      const x = p.getX(i + 1);
      const y = p.getY(i + 1);
      const z = p.getZ(i + 1);
      p.setXYZ(i + 1, p.getX(i + 2), p.getY(i + 2), p.getZ(i + 2));
      p.setXYZ(i + 2, x, y, z);
      const u = g.attributes.uv;
      const uu = u.getX(i + 1);
      const vv = u.getY(i + 1);
      u.setXY(i + 1, u.getX(i + 2), u.getY(i + 2));
      u.setXY(i + 2, uu, vv);
    }
  }
  return g;
}

// A flat cap over a footprint at height z (units), uv in metres over `tile`.
export function prismTop(foot, z, tile = 1, { s = U, v = U } = {}) {
  const shape = new THREE.Shape(foot.map(([x, y]) => new THREE.Vector2(x * s, -y * s)));
  const g = new THREE.ShapeGeometry(shape);
  g.rotateX(-Math.PI / 2);
  g.translate(0, z * v, 0);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / tile, uv.getY(i) / tile);
  return g;
}

// A flat shape on the ground at height y (metres), uv in metres.
export function flatShape(foot, y = 0, tile = 1, scale) {
  const g = prismTop(foot, 0, tile, scale);
  g.translate(0, y, 0);
  return g;
}

// ── textures ──

// Cladding: a white panel grid as a normal map (seams sunk between panels),
// panels `pw` × `ph` metres; the texture covers 8 × 8 m.
export function panelNormal({ pw = 2, ph = 1 } = {}) {
  return canvasTexture(
    256,
    256,
    (x, w, h) => {
      x.fillStyle = 'rgb(128,128,255)';
      x.fillRect(0, 0, w, h);
      const sx = w / (8 / pw);
      const sy = h / (8 / ph);
      for (let i = 0; i <= 8 / pw; i++) {
        x.fillStyle = 'rgb(100,128,240)';
        x.fillRect(i * sx - 1, 0, 1, h);
        x.fillStyle = 'rgb(156,128,240)';
        x.fillRect(i * sx, 0, 1, h);
      }
      for (let j = 0; j <= 8 / ph; j++) {
        x.fillStyle = 'rgb(128,156,240)';
        x.fillRect(0, j * sy - 1, w, 1);
        x.fillStyle = 'rgb(128,100,240)';
        x.fillRect(0, j * sy, w, 1);
      }
    },
    { srgb: false, repeat: [1, 1] },
  );
}

// Curtain-wall glass: mullions and transoms over a sky-and-room gradient, the
// odd lit or blinded pane; one tile is `cols` × `rows` panes.
export function curtainTexture({ cols = 8, rows = 4, seed = 3, lit = 0.12 } = {}) {
  let s = seed;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const draw = (emissive) => (x, w, h) => {
    const cw = w / cols;
    const ch = h / rows;
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++) {
        const k = r();
        if (emissive) {
          x.fillStyle = k < lit ? 'rgba(255,236,200,0.55)' : '#000';
        } else {
          const g = x.createLinearGradient(0, j * ch, 0, (j + 1) * ch);
          const t = 0.85 + k * 0.3;
          g.addColorStop(0, `rgb(${Math.round(150 * t)},${Math.round(178 * t)},${Math.round(205 * t)})`);
          g.addColorStop(1, `rgb(${Math.round(60 * t)},${Math.round(84 * t)},${Math.round(112 * t)})`);
          x.fillStyle = k < 0.15 ? '#c9cdd0' : g; // blinds down in some
        }
        x.fillRect(i * cw, j * ch, cw, ch);
      }
    if (emissive) return;
    x.fillStyle = '#d9dee3';
    for (let i = 0; i <= cols; i++) x.fillRect(i * cw - 1.5, 0, 3, h);
    for (let j = 0; j <= rows; j++) x.fillRect(0, j * ch - 2, w, 4);
  };
  const seed0 = s;
  const map = canvasTexture(512, 256, draw(false), { repeat: [1, 1] });
  s = seed0;
  const emissiveMap = canvasTexture(512, 256, draw(true), { repeat: [1, 1] });
  for (const t of [map, emissiveMap]) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return { map, emissiveMap };
}

// Solar panels: dark blue cells in a silver frame.
export function solarTexture() {
  return canvasTexture(256, 160, (x, w, h) => {
    x.fillStyle = '#c4cad0';
    x.fillRect(0, 0, w, h);
    const cols = 10;
    const rows = 6;
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++) {
        const g = x.createLinearGradient(0, 0, w, h);
        g.addColorStop(0, '#2f4f7c');
        g.addColorStop(1, '#16294a');
        x.fillStyle = g;
        x.fillRect(4 + (i * (w - 8)) / cols + 1, 4 + (j * (h - 8)) / rows + 1, (w - 8) / cols - 2, (h - 8) / rows - 2);
      }
    x.strokeStyle = 'rgba(160,190,230,0.35)';
    x.lineWidth = 1;
    for (let i = 1; i < cols; i++) {
      x.beginPath();
      x.moveTo(4 + (i * (w - 8)) / cols, 4);
      x.lineTo(4 + (i * (w - 8)) / cols, h - 4);
      x.stroke();
    }
  });
}

// What's painted on the ground, in plan units mapped onto a canvas covering
// [x0, y0]–[x1, y1]: the helipad, the track, the range, the pad markings,
// the parking bays. Transparent elsewhere.
export function groundPaint([x0, y0, x1, y1], px = 4096) {
  const sx = px / (x1 - x0);
  const ph = Math.round((y1 - y0) * sx);
  const tex = canvasTexture(px, ph, (x) => {
    x.clearRect(0, 0, px, ph);
    x.save();
    x.scale(sx, sx);
    x.translate(-x0, -y0);
    // the helipad
    x.fillStyle = '#c9ccc5';
    x.beginPath();
    x.arc(70, 52, 8.6, 0, Math.PI * 2);
    x.fill();
    x.strokeStyle = '#a5a9a1';
    x.lineWidth = 0.4;
    x.stroke();
    x.strokeStyle = '#e0b53a';
    x.lineWidth = 0.55;
    x.beginPath();
    x.arc(70, 52, 7, 0, Math.PI * 2);
    x.stroke();
    x.strokeStyle = '#ffffff';
    x.lineWidth = 0.95;
    x.beginPath();
    x.moveTo(67.6, 48.6);
    x.lineTo(67.6, 55.4);
    x.moveTo(72.4, 48.6);
    x.lineTo(72.4, 55.4);
    x.moveTo(67.6, 52);
    x.lineTo(72.4, 52);
    x.stroke();
    // the running track: eight lanes round a green infield
    const rr = (cx, cy, w, h, rad) => {
      x.beginPath();
      x.roundRect(cx, cy, w, h, rad);
    };
    x.fillStyle = '#b9533b';
    rr(98, 46, 28, 16, 8);
    x.fill();
    x.strokeStyle = 'rgba(245,225,215,0.75)';
    x.lineWidth = 0.08;
    for (let i = 1; i < 8; i++) {
      const k = i * 0.21;
      rr(98 + k, 46 + k, 28 - 2 * k, 16 - 2 * k, 8 - k);
      x.stroke();
    }
    x.fillStyle = '#5f8a3f';
    rr(99.7, 47.7, 24.6, 12.6, 6.3);
    x.fill();
    // the infield mown in bands across, a lighter and a darker green, as a pitch is
    x.save();
    rr(99.7, 47.7, 24.6, 12.6, 6.3);
    x.clip();
    x.fillStyle = 'rgba(214, 236, 170, 0.13)';
    for (let bx = 99.7; bx < 124.3; bx += 2.4) x.fillRect(bx, 47.7, 1.2, 12.6);
    x.restore();
    x.strokeStyle = 'rgba(255,255,255,0.7)';
    x.lineWidth = 0.12;
    rr(103.5, 50.6, 17, 6.8, 0.2);
    x.stroke();
    x.beginPath();
    x.moveTo(112, 50.6);
    x.lineTo(112, 57.4);
    x.stroke();
    // the range: sand, lanes, distance lines
    x.fillStyle = '#d3c39a';
    x.fillRect(-18, 16, 12, 48);
    x.strokeStyle = 'rgba(255,255,255,0.75)';
    x.lineWidth = 0.18;
    for (const lx of [-14, -10]) {
      x.beginPath();
      x.moveTo(lx, 16);
      x.lineTo(lx, 64);
      x.stroke();
    }
    for (let d = 24; d < 64; d += 10) {
      x.beginPath();
      x.moveTo(-18, d);
      x.lineTo(-6, d);
      x.stroke();
    }
    // the parking by the gate
    x.fillStyle = '#8f938d';
    x.fillRect(50, 97, 22, 8.4);
    x.strokeStyle = '#ffffff';
    x.lineWidth = 0.15;
    for (let i = 0; i < 10; i++) {
      x.beginPath();
      x.moveTo(51 + i * 2.2, 97);
      x.lineTo(51 + i * 2.2, 100.6);
      x.moveTo(51 + i * 2.2, 101.8);
      x.lineTo(51 + i * 2.2, 105.4);
      x.stroke();
    }
    x.restore();
    grain(x, px, ph);
  });
  return { tex, size: [px, ph] };
}

// Fine grain over whatever's painted on a canvas (and nothing where it's
// clear): the turf's blades, the track's rubber, the concrete's aggregate,
// so painted ground isn't a flat sheet of colour up close.
function grain(x, w, h) {
  const n = document.createElement('canvas');
  n.width = n.height = 128;
  const g = n.getContext('2d');
  const img = g.createImageData(128, 128);
  let s = 11;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = r();
    const dark = v < 0.5;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = dark ? 0 : 255;
    img.data[i + 3] = Math.round(Math.abs(v - 0.5) * 2 * 46);
  }
  g.putImageData(img, 0, 0);
  x.save();
  x.globalCompositeOperation = 'source-atop';
  x.fillStyle = x.createPattern(n, 'repeat');
  x.fillRect(0, 0, w, h);
  // and a slower mottle over it, a few metres across
  x.globalAlpha = 0.5;
  for (let i = 0; i < 90; i++) {
    const cx = r() * w;
    const cy = r() * h;
    const rad = (0.03 + r() * 0.06) * Math.max(w, h);
    const rg = x.createRadialGradient(cx, cy, 0, cx, cy, rad);
    const c = r() < 0.5 ? '0,0,0' : '255,250,230';
    rg.addColorStop(0, `rgba(${c},0.07)`);
    rg.addColorStop(1, `rgba(${c},0)`);
    x.fillStyle = rg;
    x.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
  }
  x.restore();
}

// The landing pad's markings: two yellow circles with an H, a dashed line.
export function apronMarks([x0, y0, x1, y1], px = 1024) {
  const sx = px / (x1 - x0);
  const ph = Math.round((y1 - y0) * sx);
  return canvasTexture(px, ph, (x) => {
    x.clearRect(0, 0, px, ph);
    x.save();
    x.scale(sx, sx);
    x.translate(-x0, -y0);
    x.strokeStyle = '#e8bd3e';
    x.lineWidth = 0.42;
    for (const [cx, cy] of [
      [12, 80],
      [26, 84],
    ]) {
      x.beginPath();
      x.arc(cx, cy, 5.4, 0, Math.PI * 2);
      x.stroke();
      x.beginPath();
      x.arc(cx, cy, 4.6, 0, Math.PI * 2);
      x.setLineDash([0.6, 0.5]);
      x.stroke();
      x.setLineDash([]);
    }
    x.setLineDash([1, 0.8]);
    x.beginPath();
    x.moveTo(18, 68.5);
    x.lineTo(18, 75);
    x.stroke();
    x.setLineDash([]);
    // tyre marks and wear
    x.strokeStyle = 'rgba(20,20,20,0.18)';
    x.lineWidth = 0.6;
    for (let i = 0; i < 6; i++) {
      x.beginPath();
      x.arc(19, 82, 3 + i * 1.6, i, i + 1.6);
      x.stroke();
    }
    x.restore();
  });
}

// ── trees ──

// ── the Quinjet ──

// The Quinjet, nose along +z, about 30 m long, its wheels on y = 0. Parts:
// body, panel, glass, dark, glow (the fans and the engines, lit by flight),
// gear (the landing gear, hidden in flight). Returns { group, fans, gear,
// glowMat }.
export function buildQuinjet(mats) {
  const b = new PartBuilder();
  const gearB = new PartBuilder();
  // the fuselage: a long spindle, flattened, with a sharp nose
  const spindle = lathe(
    [
      [0.01, -15],
      [1.3, -14.6],
      [2.1, -12],
      [2.5, -6],
      [2.45, 2],
      [2.1, 7],
      [1.5, 11],
      [0.7, 14.2],
      [0.05, 16],
    ],
    20,
  );
  spindle.rotateX(Math.PI / 2);
  spindle.scale(1.05, 0.62, 1);
  b.add('body', spindle, { p: [0, 2.9, 0] });
  // the wings: a cranked delta, thin, bevelled; with panels on top
  // [out along the span, forward along the body]
  const WING = [
    [1.6, -9],
    [1.6, 5],
    [4.5, 0.5],
    [12.5, -7.2],
    [12.6, -9.6],
    [7.5, -10.4],
    [4, -12.6],
    [1.6, -12.6],
  ];
  const wingGeo = (sx) => {
    // drawn mirrored for the left wing (not scaled, which would turn it inside out);
    // the shape's -y becomes +z once it's laid flat
    const shape = new THREE.Shape(WING.map(([x, y]) => new THREE.Vector2(sx * x, -y)));
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.35, bevelEnabled: true, bevelThickness: 0.18, bevelSize: 0.22, bevelSegments: 2, curveSegments: 2 });
    g.rotateX(-Math.PI / 2);
    return g;
  };
  for (const sx of [-1, 1]) b.add('body', wingGeo(sx), { p: [0, 2.35, 0], r: [0, 0, sx * -0.04] });
  // the VTOL fans in the wings: a ring, a dark well, the glow beneath
  const fans = [];
  for (const sx of [-1, 1]) {
    b.add('panel', new THREE.TorusGeometry(1.75, 0.18, 6, 26).rotateX(Math.PI / 2), { p: [sx * 6.6, 2.95, -5.6] });
    b.add('dark', new THREE.CylinderGeometry(1.7, 1.7, 0.5, 26), { p: [sx * 6.6, 2.8, -5.6] });
    b.add('glow', new THREE.CircleGeometry(1.55, 26).rotateX(Math.PI / 2), { p: [sx * 6.6, 2.32, -5.6] });
    fans.push(new THREE.Vector3(sx * 6.6, 2.3, -5.6));
  }
  // the canopy over the cockpit
  const canopy = new THREE.SphereGeometry(1.4, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  canopy.scale(1, 0.7, 3);
  b.add('glass', canopy, { p: [0, 3.6, 8.2] });
  // twin tails, canted out
  const fin = new THREE.Shape();
  fin.moveTo(0, 0);
  fin.lineTo(4.4, 0);
  fin.lineTo(2.2, 4.2);
  fin.lineTo(0.2, 4.4);
  const finGeo = new THREE.ExtrudeGeometry(fin, { depth: 0.22, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.1, bevelSegments: 1 });
  finGeo.rotateY(-Math.PI / 2); // its x along +z: the swept edge leads, the upright one trails
  for (const sx of [-1, 1]) b.add('body', finGeo, { p: [sx * 2.2, 3.3, -10.2], r: [0, 0, sx * -0.42] });
  // tailplanes
  for (const sx of [-1, 1]) b.add('body', rbox(3.6, 0.22, 2.4, 0.08, 1), { p: [sx * 3.4, 3.1, -13.2], r: [0, sx * 0.25, 0] });
  // panels: darker, along the spine and over the wings
  b.add('panel', rbox(2.2, 0.08, 16, 0.04, 1), { p: [0, 4.4, -3] });
  for (const sx of [-1, 1]) b.add('panel', rbox(4.6, 0.06, 2.4, 0.03, 1), { p: [sx * 7.4, 2.95, -8.9], r: [0, sx * -0.6, 0] });
  // the engines at the back, their glow
  for (const sx of [-1, 1]) {
    b.add('dark', new THREE.CylinderGeometry(0.95, 1.1, 2.2, 18).rotateX(Math.PI / 2), { p: [sx * 1.25, 2.9, -14.6] });
    b.add('glow', new THREE.CircleGeometry(0.75, 18).rotateY(Math.PI), { p: [sx * 1.25, 2.9, -15.72] });
  }
  // the ramp's seam and the intakes
  for (const sx of [-1, 1]) b.add('dark', rbox(0.7, 0.9, 3.6, 0.15, 1), { p: [sx * 2.35, 2.7, 2.6] });
  b.add('dark', rbox(2.8, 0.06, 5, 0.03, 1), { p: [0, 1.62, -10.5] });
  // landing gear: a nose leg and two mains
  for (const [x, z] of [
    [0, 9],
    [-2.6, -5],
    [2.6, -5],
  ]) {
    gearB.add('dark', new THREE.CylinderGeometry(0.16, 0.16, 1.8, 8), { p: [x, 0.9, z] });
    gearB.add('dark', new THREE.CylinderGeometry(0.5, 0.5, 0.4, 14).rotateZ(Math.PI / 2), { p: [x, 0.5, z] });
  }
  const group = b.build(mats);
  const gear = gearB.build(mats);
  group.add(gear);
  group.traverse((o) => {
    if (o.isMesh && o.name === 'glow') o.castShadow = false;
  });
  return { group, fans, gear };
}
