// The X-wing and the Millennium Falcon on the universe map, modelled in
// code: a T-65's chamfered fuselage lofted from its cross-sections, its four
// engines and wingtip cannons turned on a lathe, bevelled S-foils open in
// their X, a glass canopy with its frame, Artoo's dome and the Red Squadron
// stripes; the YT-1300's saucer turned from its profile, the mandibles, the
// cockpit out on its arm to starboard, the quad guns top and bottom, the
// dish, the docking rings, the machinery in its trenches and the wide blue
// band of its sublight engines. Their skins are painted on canvases (panel
// lines, a little grime, the panels' own relief as a normal map: hull.js's
// panelMaps), so nothing's downloaded, and they're crisp at any size. How
// fine is lib/detail's: at ultra (a strong graphics card) the skins have
// four times the texels, with screw heads and scratches they've the room
// for, every curve is turned with twice the segments and the paint wears a
// clear coat; a phone's are as designed and a weak device's half that.
//
// Each part of one material is merged into one mesh, so a ship is a handful
// of draws. Both point along −z, centred, built at shipModels.js's BUILT
// length. The hull and its panels take a paint job (livery.js); the red
// markings take its trim; glass, the dark metal and the engines' insides
// stay as they are.
//
// buildXwing(T), buildFalcon(T) → { group, glow: [{ mat, color }], stand,
//   glowMesh, glowFixed }

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { detail, seg as segments, texScale } from '../../lib/detail';
import { normalCanvas, rng } from '../../lib/texture';
import { sharpen } from '../../lib/three/textures';

// ── geometry helpers ──

// geometries placed by [geometry, position, rotation, scale], merged into one
// (normals kept: flat-shaded parts stay flat, lathed ones smooth)
export function merge(list) {
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const geos = list.map(([geo, pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1]]) => {
    m.compose(new THREE.Vector3(...pos), q.setFromEuler(new THREE.Euler(...rot)), new THREE.Vector3(...scale));
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    geo.dispose();
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    return g.applyMatrix4(m);
  });
  const merged = mergeGeometries(geos);
  for (const g of geos) g.dispose();
  return merged;
}
// a geometry whose triangles are wound the other way (for a mirrored copy)
export function flipped(g) {
  const geo = g.index ? g.toNonIndexed() : g;
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i += 3) {
    for (const name of ['position', 'normal', 'uv']) {
      const a = geo.attributes[name];
      if (!a) continue;
      for (let k = 0; k < a.itemSize; k++) {
        const t = a.array[(i + 1) * a.itemSize + k];
        a.array[(i + 1) * a.itemSize + k] = a.array[(i + 2) * a.itemSize + k];
        a.array[(i + 2) * a.itemSize + k] = t;
      }
    }
  }
  return geo;
}

// A hull lofted along z through cross-sections { z, w, h, y = 0, c = 0.3 }:
// each a rectangle w × h with its corners chamfered by c of the half-size,
// joined face to face (flat facets, so the chamfers catch the light as hard
// edges), capped at either end. uv: round the section, and along z.
export function loft(sections, { top = 1, bottom = 1, uvAlong = 1 } = {}) {
  const ring = ({ w, h, y = 0, c = 0.3 }) => {
    const hw = w / 2;
    const hh = h / 2;
    const cw = hw * c;
    const ch = hh * c;
    // (round from the top right, anticlockwise seen from the front, −z)
    return [
      [hw - cw, y + hh * top],
      [-hw + cw, y + hh * top],
      [-hw, y + hh - ch],
      [-hw, y - hh + ch],
      [-hw + cw, y - hh * bottom],
      [hw - cw, y - hh * bottom],
      [hw, y - hh + ch],
      [hw, y + hh - ch],
    ];
  };
  const rings = sections.map((s) => ({ z: s.z, pts: ring(s) }));
  const pos = [];
  const uv = [];
  const z0 = sections[0].z;
  const span = sections[sections.length - 1].z - z0 || 1;
  const around = (pts) => {
    const d = [0];
    for (let i = 1; i <= pts.length; i++) d.push(d[i - 1] + Math.hypot(pts[i % pts.length][0] - pts[i - 1][0], pts[i % pts.length][1] - pts[i - 1][1]));
    return d.map((v) => v / d[d.length - 1]);
  };
  for (let r = 0; r < rings.length - 1; r++) {
    const a = rings[r];
    const b = rings[r + 1];
    const ua = around(a.pts);
    const va = ((a.z - z0) / span) * uvAlong;
    const vb = ((b.z - z0) / span) * uvAlong;
    for (let i = 0; i < 8; i++) {
      const j = (i + 1) % 8;
      const p = [
        [...a.pts[i], a.z],
        [...a.pts[j], a.z],
        [...b.pts[j], b.z],
        [...b.pts[i], b.z],
      ];
      const t = [
        [ua[i], va],
        [ua[i + 1], va],
        [ua[i + 1], vb],
        [ua[i], vb],
      ];
      for (const k of [0, 1, 2, 0, 2, 3]) {
        pos.push(...p[k]);
        uv.push(...t[k]);
      }
    }
  }
  // the caps: a fan from the middle of each end section
  for (const [r, flip] of [
    [rings[0], true],
    [rings[rings.length - 1], false],
  ]) {
    const cx = r.pts.reduce((n, p) => n + p[0], 0) / 8;
    const cy = r.pts.reduce((n, p) => n + p[1], 0) / 8;
    for (let i = 0; i < 8; i++) {
      const j = (i + 1) % 8;
      const tri = flip
        ? [
            [cx, cy, r.z],
            [...r.pts[i], r.z],
            [...r.pts[j], r.z],
          ]
        : [
            [cx, cy, r.z],
            [...r.pts[j], r.z],
            [...r.pts[i], r.z],
          ];
      for (const p of tri) {
        pos.push(...p);
        uv.push(0.5 + p[0] * 4, 0.5 + p[1] * 4);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

// Turned on a lathe about z (the profile [r, z], front first), smooth, `seg`
// round on a desktop (lib/detail: twice that at ultra, so no facet shows
// along an engine's curve; fewer on a phone)
export function turned(profile, seg = 32, { start = 0, length = Math.PI * 2 } = {}) {
  // LatheGeometry turns about y: lay it along z after (y → z)
  const g = new THREE.LatheGeometry(
    profile.map(([r, z]) => new THREE.Vector2(r, z)),
    segments(seg),
    start,
    length,
  );
  g.rotateX(Math.PI / 2);
  return g;
}

// a plate from a 2D outline ([x, z]: across, and along the ship), `t` thick,
// its edges bevelled (rounder at ultra, so the bevel's highlight runs smooth)
export function plate(points, t, bevel = t * 0.45, uvScale = 6) {
  const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: Math.max(1e-4, t - bevel * 2), bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: Math.max(1, Math.round(2 * detail().seg)), curveSegments: 4 });
  g.translate(0, 0, -(t - bevel * 2) / 2);
  g.rotateX(Math.PI / 2); // (the outline's second coordinate along z, the thickness up and down)
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.array.length; i++) uv.array[i] *= uvScale;
  return g;
}

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const LAY = [Math.PI / 2, 0, 0]; // (a cylinder along z)

// a tube from a to b, radius r0 at a and r1 at b: [geometry, position, rotation]
export function strut(a, b, r0, r1, seg = 20) {
  const A = new THREE.Vector3(...a);
  const B = new THREE.Vector3(...b);
  const d = B.clone().sub(A);
  const g = new THREE.CylinderGeometry(r1, r0, d.length(), segments(seg)); // (its top toward b)
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
  const e = new THREE.Euler().setFromQuaternion(q);
  return [g, A.add(B).multiplyScalar(0.5).toArray(), [e.x, e.y, e.z]];
}

// ── skins ──

// Canvases for a skin designed at S texels, painted at `up` times that (lib/
// detail's texScale for this device: four times the texels at ultra, a
// quarter on a weak device), each context scaled so the painting below is
// the same strokes in the same places at any size, only crisper.
function skinCanvases(S, up, n) {
  const list = [];
  for (let i = 0; i < n; i++) {
    const c = document.createElement('canvas');
    c.width = c.height = Math.round(S * up);
    const ctx = c.getContext('2d');
    ctx.scale(up, up);
    list.push([c, ctx]);
  }
  return list;
}

// The finest marks, for a skin painted at ultra's size where they have the
// texels to show (screw heads, scratches, specks); a lower level hasn't the
// room, and gets the skin as it always was. From a random source of their
// own, so the panels themselves are laid out the same at every level.
function fineMarks(seed, S, { cx, rx }) {
  const r = rng(seed * 7 + 101);
  for (let i = 0; i < 520; i++) {
    const x = r() * S;
    const y = r() * S;
    const a = r() * Math.PI * 2;
    const len = 2 + r() * 9;
    cx.strokeStyle = r() < 0.5 ? `rgba(255,255,255,${0.05 + r() * 0.07})` : `rgba(20,18,16,${0.05 + r() * 0.08})`;
    cx.lineWidth = 0.3 + r() * 0.25;
    cx.beginPath();
    cx.moveTo(x, y);
    cx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    cx.stroke();
    // a scratch is polished: smoother where it runs
    rx.strokeStyle = 'rgba(0,0,0,0.12)';
    rx.lineWidth = cx.lineWidth;
    rx.stroke();
  }
  for (let i = 0; i < 900; i++) {
    const v = r() < 0.5 ? 255 : 0;
    cx.fillStyle = `rgba(${v},${v},${v},${0.03 + r() * 0.05})`;
    cx.fillRect(r() * S, r() * S, 0.5 + r() * 0.6, 0.5 + r() * 0.6);
  }
}

// A screw head in each corner of a plate, at ultra: a raised dot with a slot.
function screws(x, y, w, h, { cx, hx }) {
  if (w < 10 || h < 10) return;
  for (const [sx, sy] of [
    [x + 2.6, y + 2.6],
    [x + w - 2.6, y + 2.6],
    [x + 2.6, y + h - 2.6],
    [x + w - 2.6, y + h - 2.6],
  ]) {
    hx.fillStyle = '#a2a2a2';
    hx.beginPath();
    hx.arc(sx, sy, 0.9, 0, Math.PI * 2);
    hx.fill();
    cx.strokeStyle = 'rgba(24,24,26,0.45)';
    cx.lineWidth = 0.28;
    cx.beginPath();
    cx.arc(sx, sy, 0.9, 0, Math.PI * 2);
    cx.moveTo(sx - 0.6, sy);
    cx.lineTo(sx + 0.6, sy);
    cx.stroke();
  }
}

// Panel lines, a few panels a shade off, rivets and a little grime, on a
// canvas, with the lines as grooves in a normal map and the grime rougher:
// { map, normalMap, roughnessMap }, shared by every ship of a kind (painted
// once for each detail level it's asked at).
const skins = new Map();
export function panelMaps(kind, { base, seed, cols, rows, grime = 0.25, accent = null }) {
  const S = 512;
  const up = texScale(S);
  const key = `${kind}@${up}`;
  if (skins.has(key)) return skins.get(key);
  const r = rng(seed);
  const [[colour, cx], [height, hx], [rough, rx]] = skinCanvases(S, up, 3);
  const fine = up >= 2;
  cx.fillStyle = base;
  cx.fillRect(0, 0, S, S);
  hx.fillStyle = '#808080';
  hx.fillRect(0, 0, S, S);
  rx.fillStyle = '#8c8c8c';
  rx.fillRect(0, 0, S, S);
  // panels: rows of plates of random widths, each its own shade
  const rowH = S / rows;
  for (let y = 0; y < rows; y++) {
    let x = -r() * (S / cols);
    while (x < S) {
      const w = (S / cols) * (0.6 + r() * 1.1);
      const shade = (r() - 0.5) * 0.11;
      cx.fillStyle = shade > 0 ? `rgba(255,255,255,${shade})` : `rgba(0,0,0,${-shade * 1.4})`;
      cx.fillRect(x, y * rowH, w, rowH);
      if (accent && r() < 0.02) {
        cx.fillStyle = accent;
        cx.fillRect(x + 2, y * rowH + 2, w - 4, rowH - 4);
      }
      rx.fillStyle = `rgba(${shade > 0 ? 255 : 0},${shade > 0 ? 255 : 0},${shade > 0 ? 255 : 0},${Math.abs(shade) * 1.2})`;
      rx.fillRect(x, y * rowH, w, rowH);
      // the seams: a dark line round each plate, a groove in the relief
      for (const [ctx, style, width] of [
        [cx, 'rgba(20,22,26,0.32)', 1.2],
        [hx, '#4a4a4a', 2],
      ]) {
        ctx.strokeStyle = style;
        ctx.lineWidth = width;
        ctx.strokeRect(x + 0.5, y * rowH + 0.5, w, rowH);
      }
      if (fine) screws(x, y * rowH, w, rowH, { cx, hx });
      // a few rivets along a seam (round: at ultra's size a square one shows)
      if (r() < 0.45) {
        cx.fillStyle = 'rgba(30,32,36,0.5)';
        hx.fillStyle = '#9a9a9a';
        for (let k = 4; k < w - 3; k += 7) {
          for (const ctx of [cx, hx]) {
            ctx.beginPath();
            ctx.arc(x + k + 0.8, y * rowH + 3.8, 0.8, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      // now and then a hatch or a vent: a raised square, or slats
      if (r() < 0.12) {
        const hw = Math.min(w, rowH) * 0.5;
        const px = x + (w - hw) / 2;
        const py = y * rowH + (rowH - hw) / 2;
        hx.fillStyle = '#a4a4a4';
        hx.fillRect(px, py, hw, hw);
        cx.strokeStyle = 'rgba(20,22,26,0.5)';
        cx.lineWidth = 1;
        cx.strokeRect(px, py, hw, hw);
      } else if (r() < 0.1) {
        cx.fillStyle = 'rgba(20,22,26,0.45)';
        hx.fillStyle = '#505050';
        for (let k = 0; k < 5; k++) {
          for (const ctx of [cx, hx]) ctx.fillRect(x + 4, y * rowH + 4 + k * (rowH / 6), Math.max(4, w * 0.4), 1.5);
        }
      }
      x += w;
    }
  }
  // grime: soft dark streaks running back (+v), heavier near seams
  for (let i = 0; i < 260 * grime * 4; i++) {
    const x = r() * S;
    const y = r() * S;
    const len = 6 + r() * 40;
    const g = cx.createLinearGradient(x, y, x, y + len);
    g.addColorStop(0, `rgba(40,34,28,${0.05 + r() * 0.12})`);
    g.addColorStop(1, 'rgba(40,34,28,0)');
    cx.fillStyle = g;
    cx.fillRect(x, y, 1 + r() * 3, len);
    rx.fillStyle = 'rgba(255,255,255,0.18)';
    rx.fillRect(x, y, 1 + r() * 3, len * 0.6);
  }
  if (fine) fineMarks(seed, S, { cx, rx });
  const tex = (canvas, colourSpace) => {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = colourSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    sharpen(t);
    t.generateMipmaps = true;
    return t;
  };
  // (the relief is steeper per texel the finer it's painted: the normals'
  // strength grows with it, a little, so a groove reads the same from the
  // chase camera and crisper close up)
  const maps = { map: tex(colour, THREE.SRGBColorSpace), normalMap: tex(normalCanvas(height, 2.2 * Math.sqrt(up)), THREE.NoColorSpace), roughnessMap: tex(rough, THREE.NoColorSpace) };
  skins.set(key, maps);
  return maps;
}

// A painted surface's material: at ultra (lib/detail), the paint under a
// thin clear coat, a soft second highlight over the panel lines that shows
// the shape of the hull as it turns; a standard material everywhere else.
export function paintMaterial(o, { coat = 0.22, coatRoughness = 0.42 } = {}) {
  const cc = detail().clearcoat;
  return cc > 0 ? new THREE.MeshPhysicalMaterial({ ...o, clearcoat: coat * cc, clearcoatRoughness: coatRoughness }) : new THREE.MeshStandardMaterial(o);
}
// Glass: at ultra a clear coat over it too, so a canopy holds a crisp
// reflection of its own
export function glassMaterial(o) {
  const cc = detail().clearcoat;
  return cc > 0 ? new THREE.MeshPhysicalMaterial({ ...o, clearcoat: cc, clearcoatRoughness: 0.04 }) : new THREE.MeshStandardMaterial(o);
}

// The materials a ship's built from (its own copies: the paint goes on per ship)
export function materials(maps) {
  const hull = paintMaterial({ color: '#ffffff', map: maps.map, normalMap: maps.normalMap, normalScale: new THREE.Vector2(0.6, 0.6), roughnessMap: maps.roughnessMap, roughness: 0.62, metalness: 0.18 });
  const panel = hull.clone();
  panel.color.set('#9c9ea3'); // (the darker plates: shaded, and a paint's shade darker)
  const trim = paintMaterial({ color: '#b3261e', map: maps.map, roughness: 0.55, metalness: 0.15 }); // (red: takes a paint's trim)
  const dark = new THREE.MeshStandardMaterial({ color: '#1d2025', roughness: 0.45, metalness: 0.6 });
  const metal = new THREE.MeshStandardMaterial({ color: '#3a3e45', roughness: 0.38, metalness: 0.75 });
  const glass = glassMaterial({ color: '#0d1620', roughness: 0.08, metalness: 0.9, envMapIntensity: 1.6 });
  for (const m of [metal, glass, dark]) m.userData.keep = true;
  return { hull, panel, trim, dark, metal, glass };
}
export const glowMat = (color) => new THREE.MeshBasicMaterial({ color, toneMapped: false, side: THREE.DoubleSide });
const mesh = (geo, mat, name) => {
  const m = new THREE.Mesh(geo, mat);
  if (name) m.name = name;
  if (mat.userData.keep) m.userData.noPaint = true;
  return m;
};

// ── the X-wing ──

const XW = {
  engine: [0.044, 0.0225], // x, y of an engine's middle (each quarter: where the Sketchfab model's are)
  engineR: 0.0165,
  engineZ: [0.035, 0.166], // intake to nozzle
  span: 0.172, // a wingtip's x
  dihedral: 0.2, // each S-foil's angle off level, radians
};
export const XWING_ENGINES = [-1, 1].flatMap((sy) => [-1, 1].map((sx) => [sx * XW.engine[0], sy * XW.engine[1], XW.engineZ[1] + 0.002]));

export function buildXwing() {
  const maps = panelMaps('xwing', { base: '#d9d6cf', seed: 11, cols: 6, rows: 10, grime: 0.3 });
  const M = materials(maps);
  const hullParts = [];
  const panelParts = [];
  const trimParts = [];
  const darkParts = [];
  const metalParts = [];
  const glassParts = [];
  const glows = [];

  // the fuselage: a long chamfered nose, the cockpit, the body where the
  // S-foils meet it, tapering a touch at the tail
  hullParts.push([
    loft(
      [
        { z: -0.19, w: 0.008, h: 0.007, y: -0.002, c: 0.4 },
        { z: -0.178, w: 0.016, h: 0.013, y: -0.002, c: 0.35 },
        { z: -0.11, w: 0.026, h: 0.022, y: 0.0, c: 0.3 },
        { z: -0.05, w: 0.036, h: 0.03, y: 0.002, c: 0.3 },
        { z: 0.0, w: 0.044, h: 0.036, y: 0.002, c: 0.3 },
        { z: 0.045, w: 0.05, h: 0.042, y: 0.0, c: 0.28 },
        { z: 0.145, w: 0.052, h: 0.044, y: 0.0, c: 0.28 },
        { z: 0.162, w: 0.044, h: 0.036, y: 0.0, c: 0.3 },
      ],
      { uvAlong: 3 },
    ),
  ]);
  // the nose's red band and the sensor tip
  trimParts.push([loft([{ z: -0.15, w: 0.0212, h: 0.0182, c: 0.32 }, { z: -0.138, w: 0.0232, h: 0.0198, c: 0.32 }])]);
  darkParts.push([turned([[0, -0.2], [0.0025, -0.195], [0.0032, -0.188]], 12)]);
  // the canopy: faceted glass from the nose back over the cockpit, framed
  glassParts.push([
    loft(
      [
        { z: -0.052, w: 0.006, h: 0.004, y: 0.016, c: 0.4 },
        { z: -0.03, w: 0.026, h: 0.014, y: 0.019, c: 0.5 },
        { z: 0.0, w: 0.034, h: 0.022, y: 0.021, c: 0.55 },
        { z: 0.024, w: 0.032, h: 0.02, y: 0.022, c: 0.55 },
        { z: 0.034, w: 0.024, h: 0.01, y: 0.024, c: 0.5 },
      ],
      { bottom: 0.2 },
    ),
  ]);
  metalParts.push(
    [box(0.0024, 0.0024, 0.09), [0, 0.033, -0.01], [0.21, 0, 0]], // the frame's spine
    [box(0.036, 0.0022, 0.0024), [0, 0.03, -0.012], [0, 0, 0]],
    [box(0.034, 0.0022, 0.0024), [0, 0.031, 0.012], [0, 0, 0]],
  );
  // Artoo, in his socket behind the cockpit: a dome, a blue band, his eye
  const dome = new THREE.SphereGeometry(0.0115, segments(24), segments(12), 0, Math.PI * 2, 0, Math.PI / 2);
  const r2 = new THREE.MeshStandardMaterial({ color: '#dfe3e8', roughness: 0.3, metalness: 0.7 });
  const r2blue = new THREE.MeshStandardMaterial({ color: '#2a5bd7', roughness: 0.4, metalness: 0.3 });
  r2.userData.keep = r2blue.userData.keep = true;
  const artoo = [mesh(merge([[dome, [0, 0.022, 0.05]]]), r2), mesh(merge([[new THREE.CylinderGeometry(0.01182, 0.01182, 0.003, segments(24), 1, true), [0, 0.0262, 0.05]], [box(0.004, 0.0035, 0.002), [0, 0.0295, 0.0393]]]), r2blue)];
  darkParts.push([new THREE.CylinderGeometry(0.0128, 0.0128, 0.004, segments(24)), [0, 0.0215, 0.05]]); // (his socket's rim)
  // the body's top: vents and a few boxes, behind Artoo
  darkParts.push([box(0.014, 0.003, 0.03), [0, 0.022, 0.1]], [box(0.006, 0.004, 0.012), [0.014, 0.022, 0.125]], [box(0.006, 0.004, 0.012), [-0.014, 0.022, 0.125]]);
  panelParts.push([box(0.03, 0.002, 0.05), [0, -0.022, 0.07]]); // (a belly plate)

  // the S-foils, engines and cannons, one quarter at a time
  for (const sy of [1, -1]) {
    for (const sx of [1, -1]) {
      const tilt = sx * sy * XW.dihedral;
      const root = 0.022;
      const rootY = sy * 0.011;
      // a wing from the body out to the cannon: its leading edge swept back
      const L = (XW.span - root) / Math.cos(XW.dihedral); // (along the tilted wing)
      const lead = (f) => 0.05 + 0.036 * f;
      const trail = (f) => 0.152 - 0.014 * f;
      const wing = plate(
        [
          [0, lead(0)],
          [L, lead(1)],
          [L, trail(1)],
          [0, trail(0)],
        ],
        0.0055,
      );
      const wingAt = (f) => [sx * (root + L * f * Math.cos(XW.dihedral)), rootY + sy * L * f * Math.sin(XW.dihedral)];
      const place = [[sx > 0 ? wing : flipped(mirrorX(wing)), [sx * root, rootY, 0], [0, 0, tilt]]];
      hullParts.push(...place);
      // the stripes: a red band across the wing's outer half, and a thin one
      for (const [f, wdt] of [
        [0.62, 0.024],
        [0.78, 0.008],
      ]) {
        const [x, y] = wingAt(f);
        trimParts.push([box(wdt, 0.0062, (trail(f) - lead(f)) * 0.98), [x, y, (lead(f) + trail(f)) / 2], [0, 0, tilt]]);
      }
      // the engine on the wing's root: a nacelle turned smooth, a ring of
      // grooves, the dark intake in front and the nozzle behind
      const [ex, ey] = [sx * XW.engine[0], sy * XW.engine[1]];
      const [z0, z1] = XW.engineZ;
      const R = XW.engineR;
      hullParts.push([
        turned(
          [
            [R * 0.78, z0 + 0.004],
            [R * 0.97, z0],
            [R, z0 + 0.008],
            [R, z1 - 0.03],
            [R * 0.94, z1 - 0.022],
            [R * 0.94, z1 - 0.008],
            [R * 0.86, z1],
          ],
          28,
        ),
        [ex, ey, 0],
      ]);
      darkParts.push([new THREE.CircleGeometry(R * 0.8, segments(24)), [ex, ey, z0 + 0.003], [0, Math.PI, 0]]); // (the intake, facing forward)
      metalParts.push(
        ...[0.018, 0.024, 0.03].map((dz) => [new THREE.TorusGeometry(R * 1.005, 0.0009, 6, segments(28)), [ex, ey, z0 + dz]]),
        [turned([[R * 0.84, z1 - 0.002], [R * 0.9, z1 + 0.004], [R * 0.72, z1 + 0.004], [R * 0.62, z1 - 0.004]], 24), [ex, ey, 0]], // the nozzle's lip
      );
      glows.push([new THREE.CircleGeometry(R * 0.66, segments(24)), [ex, ey, z1 - 0.001]]);
      // the cannon at the wingtip: a housing on the wing, the long barrel,
      // the flash suppressor at its end
      const [cx, cy] = wingAt(1);
      metalParts.push(
        [
          turned(
            [
              [0.0, -0.162],
              [0.0028, -0.16],
              [0.0028, -0.142],
              [0.0042, -0.14],
              [0.0042, -0.133],
              [0.0026, -0.131],
              [0.0026, -0.02],
              [0.0048, -0.016],
              [0.0062, 0.0],
              [0.0062, 0.08],
              [0.0054, 0.11],
              [0.0, 0.112],
            ],
            14,
          ),
          [cx + sx * 0.004, cy, 0.028], // (its housing along the wingtip, the barrel out ahead)
        ],
      );
    }
  }
  const group = new THREE.Group();
  const stand = new THREE.Group();
  stand.add(
    mesh(merge(hullParts), M.hull, 'hull'),
    mesh(merge(panelParts), M.panel, 'panels'),
    mesh(merge(trimParts), M.trim, 'stripes'),
    mesh(merge(darkParts), M.dark, 'intakes'),
    mesh(merge(metalParts), M.metal, 'cannons'),
    mesh(merge(glassParts), M.glass, 'canopy'),
    ...artoo,
  );
  const glowM = glowMat('#ff7a4a');
  const glow = mesh(merge(glows), glowM, 'exhaust');
  group.add(stand, glow);
  return { group, glow: [{ mat: glowM, color: new THREE.Color('#ff7a4a') }], stand, glowMesh: glow, glowFixed: true }; // (its glow is at its engines, the model's too)
}
// a geometry mirrored across x (for the port wings; flipped() puts its winding back)
function mirrorX(g) {
  const c = g.clone();
  c.scale(-1, 1, 1);
  return c;
}

// ── the Millennium Falcon ──

const FAL = {
  R: 0.13, // the saucer's radius
  engineArc: 1.2, // radians of the rear rim the sublight band covers
  map: 1.7, // the hull map covers ±map × R across and along (the mandibles and the cockpit too)
};
export const FALCON_ENGINES = [-0.42, 0, 0.42].map((a) => [Math.sin(a) * (FAL.R + 0.004), 0, Math.cos(a) * (FAL.R + 0.004)]);
// the four trenches of machinery in the top hull: [from, to] radians round
// from the nose (clockwise seen from above, to starboard), [inner, outer] of R
const TRENCHES = [
  [0.45, 0.95, 0.36, 0.92],
  [-0.95, -0.45, 0.36, 0.92],
  [2.15, 2.7, 0.4, 0.92],
  [-2.7, -2.15, 0.4, 0.92],
];

// The Falcon's hull seen from above, painted as a map laid straight down on
// it (so the plating runs the way it does on the ship): rings of plates
// round the middle split by radial seams, the four trenches dark and full of
// machinery, the mandibles' plating, the old red patches, grime blown back
// from the leading edge, and slats round the rim; with the seams as grooves
// and the trenches sunk in its relief.
function falconMaps() {
  const S = 1024;
  const up = texScale(S); // (2048 texels across at ultra: lib/detail)
  const key = `falcon-top@${up}`;
  if (skins.has(key)) return skins.get(key);
  const C = S / 2;
  const k = S / 2 / FAL.map; // px per R
  const r = rng(41);
  const [[colour, cx], [height, hx], [rough, rx]] = skinCanvases(S, up, 3);
  // (map x is the ship's x, map y is its z: the nose is up the page)
  const P = (rad, a) => [C + Math.sin(a) * rad * k, C - Math.cos(a) * rad * k];
  cx.fillStyle = '#cbc8bf';
  cx.fillRect(0, 0, S, S);
  hx.fillStyle = '#808080';
  hx.fillRect(0, 0, S, S);
  rx.fillStyle = '#8a8a8a';
  rx.fillRect(0, 0, S, S);
  const sector = (ctx, r0, r1, a0, a1) => {
    ctx.beginPath();
    ctx.arc(C, C, r1 * k, a0 - Math.PI / 2, a1 - Math.PI / 2);
    ctx.arc(C, C, r0 * k, a1 - Math.PI / 2, a0 - Math.PI / 2, true);
    ctx.closePath();
  };
  // the plates: rings, each cut into plates of its own widths, each its own shade
  const rings = [0.12, 0.24, 0.36, 0.5, 0.64, 0.78, 0.9, 1.0];
  for (let i = 0; i < rings.length - 1; i++) {
    let a = r() * 0.3;
    const step = 0.2 + (i < 2 ? 0.25 : 0);
    while (a < Math.PI * 2 + 0.3) {
      const w = step * (0.6 + r() * 0.9);
      const shade = (r() - 0.5) * 0.12;
      sector(cx, rings[i], rings[i + 1], a, a + w);
      cx.fillStyle = shade > 0 ? `rgba(255,255,255,${shade})` : `rgba(20,16,12,${-shade * 1.3})`;
      cx.fill();
      if (r() < 0.022 && i > 2) {
        sector(cx, rings[i] + 0.012, rings[i + 1] - 0.012, a + 0.02, a + w - 0.02);
        cx.fillStyle = 'rgba(132,66,48,0.5)'; // (the old red patches)
        cx.fill();
      }
      for (const [ctx, style, lw] of [
        [cx, 'rgba(28,26,24,0.28)', 1.1],
        [hx, '#565656', 1.6],
      ]) {
        sector(ctx, rings[i], rings[i + 1], a, a + w);
        ctx.strokeStyle = style;
        ctx.lineWidth = lw;
        ctx.stroke();
      }
      a += w;
    }
  }
  // the long radial seams the hull's plating runs between
  for (let n = 0; n < 24; n++) {
    const a = (n / 24) * Math.PI * 2 + 0.07;
    for (const [ctx, style, lw] of [
      [cx, 'rgba(28,26,24,0.5)', 1.6],
      [hx, '#404040', 2.4],
    ]) {
      ctx.beginPath();
      ctx.moveTo(...P(0.24, a));
      ctx.lineTo(...P(1.0, a));
      ctx.strokeStyle = style;
      ctx.lineWidth = lw;
      ctx.stroke();
    }
  }
  // the trenches: sunk, dark, crowded with machinery
  for (const [a0, a1, r0, r1] of TRENCHES) {
    sector(cx, r0, r1, a0, a1);
    cx.fillStyle = '#4b4a47';
    cx.fill();
    sector(hx, r0, r1, a0, a1);
    hx.fillStyle = '#383838';
    hx.fill();
    for (let n = 0; n < 220; n++) {
      const a = a0 + (a1 - a0) * (0.04 + r() * 0.92);
      const d = r0 + (r1 - r0) * (0.04 + r() * 0.92);
      const [x, y] = P(d, a);
      const w = 2 + r() * 9;
      const h = 2 + r() * 6;
      const v = 40 + r() * 110;
      cx.fillStyle = `rgb(${v},${v - 4},${v - 8})`;
      cx.save();
      cx.translate(x, y);
      cx.rotate(a + (r() < 0.5 ? 0 : Math.PI / 2));
      cx.fillRect(-w / 2, -h / 2, w, h);
      cx.restore();
      hx.fillStyle = `rgb(${60 + r() * 120},${60},${60})`;
      hx.fillRect(x - w / 2, y - h / 2, w, h);
    }
    // its pipes, running round
    cx.strokeStyle = 'rgba(150,146,138,0.8)';
    cx.lineWidth = 2;
    for (let n = 0; n < 3; n++) {
      cx.beginPath();
      cx.arc(C, C, (r0 + (r1 - r0) * (0.25 + n * 0.25)) * k, a0 - Math.PI / 2 + 0.03, a1 - Math.PI / 2 - 0.03);
      cx.stroke();
    }
  }
  // the radial ribs either side of each trench, and the seam round the middle
  for (const [a0, a1, r0, r1] of TRENCHES) {
    for (const a of [a0, a1]) {
      for (const [ctx, style, lw] of [
        [cx, 'rgba(235,232,224,0.9)', 3],
        [hx, '#b4b4b4', 4],
      ]) {
        ctx.beginPath();
        ctx.moveTo(...P(r0 - 0.02, a));
        ctx.lineTo(...P(r1 + 0.02, a));
        ctx.strokeStyle = style;
        ctx.lineWidth = lw;
        ctx.stroke();
      }
    }
  }
  // the mandibles' plating, out front of the disc: long plates down their length
  for (const sx of [-1, 1]) {
    const x0 = C + sx * 0.31 * k - 0.18 * k;
    for (let z = 0.5; z < 1.66; z += 0.09 + r() * 0.08) {
      const shade = (r() - 0.5) * 0.12;
      cx.fillStyle = shade > 0 ? `rgba(255,255,255,${shade})` : `rgba(20,16,12,${-shade * 1.3})`;
      cx.fillRect(x0, C - (z + 0.12) * k, 0.36 * k, 0.12 * k);
      cx.strokeStyle = 'rgba(28,26,24,0.4)';
      cx.strokeRect(x0, C - (z + 0.12) * k, 0.36 * k, 0.12 * k);
      hx.strokeStyle = '#4a4a4a';
      hx.strokeRect(x0, C - (z + 0.12) * k, 0.36 * k, 0.12 * k);
    }
    // the red stripes near their tips
    cx.fillStyle = 'rgba(150,58,40,0.75)';
    cx.fillRect(x0 + 0.04 * k, C - 1.5 * k, 0.1 * k, 0.24 * k);
  }
  // the slats round the rim (the rim takes the map's outermost ring)
  for (let n = 0; n < 220; n++) {
    const a = (n / 220) * Math.PI * 2;
    cx.beginPath();
    cx.moveTo(...P(0.975, a));
    cx.lineTo(...P(1.03, a));
    cx.strokeStyle = n % 3 ? 'rgba(40,38,36,0.55)' : 'rgba(240,238,230,0.5)';
    cx.lineWidth = 2;
    cx.stroke();
  }
  // grime, blown back from the leading edge, and soot behind the engines
  for (let n = 0; n < 900; n++) {
    const a = r() * Math.PI * 2;
    const d = 0.15 + r() * 0.85;
    const [x, y] = P(d, a);
    const [x2, y2] = P(d + 0.04 + r() * 0.12, a);
    const g = cx.createLinearGradient(x, y, x2, y2);
    g.addColorStop(0, `rgba(52,44,36,${0.04 + r() * 0.1})`);
    g.addColorStop(1, 'rgba(52,44,36,0)');
    cx.strokeStyle = g;
    cx.lineWidth = 1 + r() * 2.5;
    cx.beginPath();
    cx.moveTo(x, y);
    cx.lineTo(x2, y2);
    cx.stroke();
    rx.fillStyle = 'rgba(255,255,255,0.15)';
    rx.fillRect(x, y, 2, 2);
  }
  const tex = (canvas, colourSpace) => {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = colourSpace;
    sharpen(t);
    return t;
  };
  if (up >= 2) fineMarks(43, S, { cx, rx });
  const maps = { map: tex(colour, THREE.SRGBColorSpace), normalMap: tex(normalCanvas(height, 2.6 * Math.sqrt(up)), THREE.NoColorSpace), roughnessMap: tex(rough, THREE.NoColorSpace) };
  skins.set(key, maps);
  return maps;
}
// the hull map laid straight down on a geometry (from above, as the map's painted)
function planar(g) {
  const pos = g.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  const span = 2 * FAL.map * FAL.R;
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = pos.getX(i) / span + 0.5;
    uv[i * 2 + 1] = 0.5 - pos.getZ(i) / span; // (the map's up the page is the nose, −z)
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

export function buildFalcon() {
  const top = falconMaps();
  const generic = panelMaps('falcon', { base: '#cbc8bf', seed: 23, cols: 10, rows: 12, grime: 0.4 });
  const M = materials(generic);
  // the hull itself wears the map from above
  M.hull = paintMaterial({ color: '#ffffff', map: top.map, normalMap: top.normalMap, normalScale: new THREE.Vector2(0.7, 0.7), roughnessMap: top.roughnessMap, roughness: 0.66, metalness: 0.16 }, { coat: 0.12, coatRoughness: 0.6 }); // (an old freighter: its coat worn dull)
  M.pod = paintMaterial({ color: '#f0eee8', map: generic.map, normalMap: generic.normalMap, normalScale: new THREE.Vector2(0.5, 0.5), roughnessMap: generic.roughnessMap, roughness: 0.64, metalness: 0.16 }, { coat: 0.12, coatRoughness: 0.6 });
  M.dish = new THREE.MeshStandardMaterial({ color: '#c9c6be', roughness: 0.5, metalness: 0.3 });
  const { R } = FAL;
  const hullParts = [];
  const darkParts = [];
  const metalParts = [];
  const glassParts = [];
  const podParts = []; // (the cockpit and its corridor: their own plating, round them)
  const dishParts = [];

  // the saucer, turned from its profile: a raised middle, the long gentle
  // slope to the rim, the rim itself, and the same underneath
  const profile = [
    [0.0, -0.027],
    [0.03, -0.027],
    [0.034, -0.024],
    [0.06, -0.022],
    [0.095, -0.016],
    [0.118, -0.0105],
    [R - 0.002, -0.0062],
    [R, -0.0058],
    [R + 0.0015, -0.003],
    [R + 0.0015, 0.003],
    [R, 0.0058],
    [R - 0.002, 0.0062],
    [0.118, 0.011],
    [0.095, 0.0175],
    [0.06, 0.0235],
    [0.034, 0.0255],
    [0.03, 0.0285],
    [0.0, 0.0285],
  ];
  hullParts.push([new THREE.LatheGeometry(profile.map(([x, y]) => new THREE.Vector2(x, y)), segments(96))]);

  // the mandibles: two prongs out front with the slot between, chamfered,
  // sloping down to blunt ends, a groove down each inner face
  for (const sx of [-1, 1]) {
    const x = sx * 0.04;
    hullParts.push([
      loft([
        { z: -0.065, w: 0.046, h: 0.03, y: 0.0, c: 0.22 },
        { z: -0.17, w: 0.045, h: 0.025, y: -0.0005, c: 0.24 },
        { z: -0.206, w: 0.042, h: 0.02, y: -0.001, c: 0.3 },
        { z: -0.214, w: 0.034, h: 0.013, y: -0.001, c: 0.42 },
      ]),
      [x, 0, 0],
    ]);
    darkParts.push([box(0.0016, 0.007, 0.12), [x - sx * 0.0229, 0, -0.15]]);
    // a row of little boxes down the outer face
    for (let z = -0.19; z < -0.09; z += 0.016) darkParts.push([box(0.0015, 0.0045, 0.008), [x + sx * 0.0229, -0.002, z]]);
  }
  // the slot's back wall: machinery
  darkParts.push([box(0.034, 0.018, 0.004), [0, 0, -0.084]]);
  for (let i = 0; i < 5; i++) metalParts.push([box(0.004, 0.012, 0.004), [-0.012 + i * 0.006, 0, -0.086]]);

  // the cockpit, out to starboard ahead of the disc on its short corridor:
  // the corridor ribbed, the cockpit's cylinder, its nose a cone of framed windows
  const cockpit = [0.122, 0.002, -0.112];
  podParts.push(strut([0.098, 0.001, -0.04], [cockpit[0], cockpit[1], cockpit[2] + 0.028], 0.0115, 0.0102));
  for (let t = 0.25; t < 0.9; t += 0.22) {
    const p = [0.098 + (cockpit[0] - 0.098) * t, 0.001, -0.04 + (cockpit[2] + 0.028 + 0.04) * t];
    const [g, , rot] = strut([0.098, 0.001, -0.04], [cockpit[0], cockpit[1], cockpit[2] + 0.028], 0.0124, 0.0124, 20);
    g.dispose();
    metalParts.push([new THREE.CylinderGeometry(0.0123, 0.0123, 0.0025, segments(20)), p, rot]);
  }
  podParts.push([
    turned(
      [
        [0.0, -0.033],
        [0.0042, -0.032],
        [0.0128, -0.017],
        [0.0152, -0.008],
        [0.0152, 0.026],
        [0.0128, 0.031],
        [0.0, 0.032],
      ],
      32,
    ),
    cockpit,
  ]);
  glassParts.push([
    turned(
      [
        [0.0044, -0.0322],
        [0.013, -0.0172],
        [0.0154, -0.0085],
      ],
      32,
    ),
    cockpit,
  ]);
  // the windows' frames: rings across the cone and struts along it
  metalParts.push([new THREE.TorusGeometry(0.0092, 0.0008, 6, segments(32)), [cockpit[0], cockpit[1], cockpit[2] - 0.0245]], [new THREE.TorusGeometry(0.0138, 0.0008, 6, segments(32)), [cockpit[0], cockpit[1], cockpit[2] - 0.0128]]);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    metalParts.push([box(0.0012, 0.0012, 0.022), [cockpit[0] + Math.cos(a) * 0.0095, cockpit[1] + Math.sin(a) * 0.0095, cockpit[2] - 0.02], [Math.sin(a) * -0.5, Math.cos(a) * 0.5, 0]]);
  }

  // the quad guns, top and bottom: a ring, a dome and its two pairs of barrels
  for (const sy of [1, -1]) {
    const y = sy * 0.0285;
    metalParts.push([new THREE.TorusGeometry(0.019, 0.0016, segments(8), segments(40)), [0, y, 0], [Math.PI / 2, 0, 0]]);
    metalParts.push([new THREE.SphereGeometry(0.0145, segments(32), segments(12), 0, Math.PI * 2, 0, Math.PI / 2), [0, y, 0], [sy > 0 ? 0 : Math.PI, 0, 0], [1, 0.62, 1]]);
    for (const bx of [-0.0055, 0.0055]) {
      for (const by of [-0.0022, 0.0022]) metalParts.push([new THREE.CylinderGeometry(0.0012, 0.0012, 0.026, segments(8)), [bx, y + sy * 0.0055 + by, -0.02], LAY]);
    }
  }
  // the dish, up front to port, on its stalk, tipped forward
  metalParts.push([new THREE.CylinderGeometry(0.0018, 0.0026, 0.012, segments(10)), [-0.052, 0.027, -0.06]]);
  const bowl = new THREE.SphereGeometry(0.03, segments(40), 6, 0, Math.PI * 2, Math.PI - 0.5, 0.5).translate(0, 0.03, 0);
  for (const g of [bowl, flipped(bowl.clone())]) dishParts.push([g, [-0.052, 0.033, -0.06], [-0.75, 0.35, 0]]);
  dishParts.push([new THREE.CylinderGeometry(0.0016, 0.0016, 0.012, segments(8)), [-0.052, 0.041, -0.066], [-0.75, 0.35, 0]]); // (its feed)
  // the docking rings, port and starboard, and their hatches
  for (const sx of [-1, 1]) {
    metalParts.push([new THREE.CylinderGeometry(0.0078, 0.0086, 0.008, segments(28)), [sx * (R + 0.0005), 0, 0.012], [0, 0, Math.PI / 2]]);
    darkParts.push([new THREE.CircleGeometry(0.0058, segments(28)), [sx * (R + 0.0047), 0, 0.012], [0, (sx * Math.PI) / 2, 0]]);
  }
  // the machinery in the trenches: little boxes and a pipe or two, sunk in
  const rr = rng(5);
  const topY = (d) => {
    // (the top hull's height at d from the middle, from the profile above)
    const up = profile.slice(10);
    for (let i = up.length - 1; i > 0; i--) {
      const [ra, ya] = up[i];
      const [rb, yb] = up[i - 1];
      if (d >= ra && d <= rb) return ya + ((yb - ya) * (d - ra)) / (rb - ra);
    }
    return 0.02;
  };
  for (const [a0, a1, r0, r1] of TRENCHES) {
    for (let i = 0; i < 34; i++) {
      const a = a0 + (a1 - a0) * (0.06 + rr() * 0.88);
      const d = R * (r0 + (r1 - r0) * (0.06 + rr() * 0.88));
      const s = 0.0018 + rr() * 0.0034;
      (rr() < 0.6 ? darkParts : metalParts).push([box(s, 0.001 + rr() * 0.0016, s * (0.6 + rr())), [Math.sin(a) * d, topY(d) + 0.0004, -Math.cos(a) * d], [0, -a + rr() * 0.3, 0]]);
    }
  }

  // the sublight engines: a wide band across the back of the rim, its
  // housing above and below, and slats across the glow
  const [a0, len] = [-FAL.engineArc / 2, FAL.engineArc];
  const band = new THREE.CylinderGeometry(R + 0.0028, R + 0.0028, 0.0078, segments(64), 1, true, a0, len);
  metalParts.push(
    [new THREE.CylinderGeometry(R + 0.0045, R + 0.0045, 0.0022, segments(64), 1, false, a0, len), [0, 0.005, 0]],
    [new THREE.CylinderGeometry(R + 0.0045, R + 0.0045, 0.0022, segments(64), 1, false, a0, len), [0, -0.005, 0]],
  );
  for (let i = 0; i <= 26; i++) {
    const a = a0 + (len * i) / 26;
    darkParts.push([box(0.0009, 0.0078, 0.0036), [Math.sin(a) * (R + 0.0034), 0, Math.cos(a) * (R + 0.0034)], [0, a, 0]]);
  }

  const group = new THREE.Group();
  const stand = new THREE.Group();
  stand.add(
    mesh(planar(merge(hullParts)), M.hull, 'hull'),
    mesh(merge(podParts), M.pod, 'cockpit'),
    mesh(merge(dishParts), M.dish, 'dish'),
    mesh(merge(darkParts), M.dark, 'machinery'),
    mesh(merge(metalParts), M.metal, 'guns'),
    mesh(merge(glassParts), M.glass, 'windows'),
  );
  const glowM = glowMat('#8fd8ff');
  const glow = mesh(merge([[band]]), glowM, 'sublight');
  group.add(stand, glow);
  return { group, glow: [{ mat: glowM, color: new THREE.Color('#8fd8ff') }], stand, glowMesh: glow, glowFixed: true }; // (its glow is at its engines, the model's too)
}
