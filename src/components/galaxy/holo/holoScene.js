// The holotable (docs/superpowers/specs/2026-10-19-galaxy-holotable-design.md): the galaxy map in 3D, drawn by
// the galaxy world in the flight's place while the map is open (../scene.js, through the post chain's view()),
// its own scene and camera in the map's units with the core at the origin (./holoCamera.js). On the plane: the
// galaxy itself (its two arms' glow and a tight bright core under the disc's stars, the stars on the 2D map's arms,
// sharp points over the sectors, and a far field of them under the whole table), the sectors (./sectors.js) as tiles
// in their holders' colours, each brighter in toward its edge, hatched where they only reach, faint where they're
// yours, the contested ones beating, their borders drawn a pixel wide at every zoom (a ring's bolder than a cut
// between two sectors) and a bezel ticked round the rim (no hyperlanes: the flat map has them), the regions' names in
// a column down the south and each side's along the rim (./holoText.js). As Helldivers 2 has it, the whole galaxy is
// its sectors alone (and where you are, a pulse and its YOU tag); the systems, the war's marks on them (./holoMarks.js)
// and their names come in only in the sector opened (link.state.sector: brighter, edged and swept by the projector's
// light, the rest dimmed), the one the pointer's over edged too. The labels are the page's buttons (HoloStage.jsx),
// put here each frame where their systems are and named where labelPlace.js finds room.
//
//   createHoloScene({ small, reduced }) → { scene, camera, frame(dt, now, link, size, ratio) → busy, dispose }
//     (ratio: the device pixels to a CSS one the frame's drawn at, which the stars' sizes follow)

import * as THREE from 'three';
import { HIDDEN, estimateWidth, hangOf, placeLabels, sideOf } from '../labelPlace';
import { SIDES } from '../sides';
import { CORE, RIM, SYSTEMS, edgeAt, systemById } from '../systems';
import { opsOf } from '../warMap';
import { FAR, FOV, ease, eye, lensOf, settled } from './holoCamera';
import { arcText, flatText } from './holoText';
import { createMarks, worldOf } from './holoMarks';
import { RINGS, SECTORS, holders, outline, rimNames, sectorById, sectorOf, systemsIn } from './sectors';

const TAU = Math.PI * 2;
// (how far off the camera is when each kind of name comes in, grid squares)
const LABEL_H = 18;
const EDGE = RINGS.at(-1).r1; // (the disc's rim, before its bulge: Wild Space's outer edge)

// (a star a crisp point with a soft edge, at least a pixel and a fifth across: one the camera's too far off to draw
// that big is drawn that big and dimmer, its light kept and not its size, so the far field doesn't shimmer)
const STAR_VERT = /* glsl */ `
attribute float aSize;
attribute vec3 aColor;
uniform float uScale;
uniform float uRatio;
varying vec3 vColor;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float px = aSize * uScale / -mv.z;
  vColor = aColor * min(1.0, px / 1.2);
  gl_PointSize = clamp(px, 1.2, 6.0) * uRatio;
  gl_Position = projectionMatrix * mv;
}`;
const STAR_FRAG = /* glsl */ `
varying vec3 vColor;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = exp(-d * d * 5.0) * (1.0 - smoothstep(0.8, 1.0, d));
  gl_FragColor = vec4(vColor * a, 1.0);
}`;
// (the galaxy's own light under the sectors: a small hot core, the bulge round it, and the two arms the disc's stars
// are thrown along, as stars() throws them, faint, so a sector's fill reads over it and the galaxy through it)
const GLOW_VERT = /* glsl */ `
varying vec2 vAt;
void main() {
  vAt = (modelMatrix * vec4(position, 1.0)).xz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const GLOW_FRAG = /* glsl */ `
uniform float uRim;
varying vec2 vAt;
void main() {
  float r = length(vAt);
  float t = r / uRim;
  if (t > 1.08) discard;
  float ph = atan(vAt.y, vAt.x) - log(r + 0.6) * 2.6 - 0.6;
  float off = abs(mod(ph + 1.5707963, 3.1415927) - 1.5707963) * r;
  float w = 0.45 + t * 1.1;
  float arm = exp(-off * off / (w * w)) * smoothstep(0.04, 0.22, t) * (1.0 - smoothstep(0.72, 1.0, t));
  float core = exp(-r * r * 30.0);
  float bulge = exp(-r * r * 0.9);
  float haze = exp(-r * 0.5) * (1.0 - smoothstep(0.8, 1.05, t));
  vec3 col = vec3(1.0, 0.86, 0.66) * core * 1.8 + vec3(1.0, 0.76, 0.5) * bulge * 0.15 + vec3(0.34, 0.48, 1.0) * arm * 0.085 + vec3(0.3, 0.42, 0.9) * haze * 0.02;
  gl_FragColor = vec4(col, 1.0);
}`;
const SECTOR_VERT = /* glsl */ `
attribute vec4 aFill;
attribute vec4 aMode;
attribute vec4 aEdge;
varying vec4 vFill;
varying vec4 vMode;
varying vec4 vEdge;
varying vec2 vAt;
void main() {
  vFill = aFill;
  vMode = aMode;
  vEdge = aEdge;
  vAt = position.xz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
// (aEdge: how far, in grid squares, the point is from its sector's inner and outer edge and its two cuts; aMode: hatched,
// contested, its lines' alpha, open)
const SECTOR_FRAG = /* glsl */ `
uniform float uTime;
varying vec4 vFill;
varying vec4 vMode;
varying vec4 vEdge;
varying vec2 vAt;
void main() {
  float dr = min(vEdge.x, vEdge.y);
  float da = min(vEdge.z, vEdge.w);
  float d = min(dr, da);
  // (the borders a pixel or so wide at any zoom, half on either side of an edge so two sectors' halves make one line; a
  // ring's bolder than a cut between two sectors in it)
  float px = max(fwidth(d), 1e-5);
  float ring = 1.0 - smoothstep(0.5 * px, 1.3 * px, dr);
  float cut = 1.0 - smoothstep(0.3 * px, 1.05 * px, da);
  float line = clamp(max(ring, cut * 0.75) * vMode.z, 0.0, 1.0);
  // (the fill flat and brighter in toward its edge, as a holo's tile is; one only in reach hatched with stripes run across
  // the map in its own units, so they keep their pitch on every sector, their edges a pixel soft)
  float rim = exp(-d / 0.12) * 1.4 + exp(-d / 0.5) * 0.3;
  float u = (vAt.x - vAt.y) * 3.0;
  float aa = fwidth(u);
  float stripe = 1.0 - smoothstep(0.16 - aa, 0.16 + aa, abs(fract(u) - 0.5));
  float body = vMode.x > 0.5 ? 0.18 + 0.82 * stripe : 1.0;
  // (the open sector swept by the projector's light, out from the core; a contested one beating)
  float scan = 0.5 + 0.5 * sin(length(vAt) * 9.0 - uTime * 2.4);
  body *= 1.0 + vMode.w * (scan * 0.4 - 0.12);
  float beat = vMode.y > 0.5 ? 0.72 + 0.28 * sin(uTime * 3.2) : 1.0;
  float a = clamp(vFill.a * (body + rim) * beat, 0.0, 1.0);
  float oa = a + line * (1.0 - a);
  if (oa < 0.002) discard;
  gl_FragColor = vec4((vFill.rgb * a * (1.0 - line) + vec3(0.8, 0.94, 1.0) * line) / oa, oa);
}`;

function seeded(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

// points drawn as stars: positions, colours and sizes (grid squares) → { points, geo, mat }
function starPoints(pos, col, size, renderOrder) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  const mat = new THREE.ShaderMaterial({ vertexShader: STAR_VERT, fragmentShader: STAR_FRAG, uniforms: { uScale: { value: 900 }, uRatio: { value: 1 } }, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const points = new THREE.Points(geo, mat);
  points.renderOrder = renderOrder;
  return { points, geo, mat };
}

// the disc's stars, on the 2D map's arms (HoloMap.jsx paintGalaxy), a little thickness to the disc; fewer and dimmer
// toward the core, which the glow draws, so they don't pile into a white blot there
function stars(small) {
  const rand = seeded(12345);
  const n = small ? 6000 : 13000;
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const size = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let x;
    let z;
    let t;
    if (i % 5 === 4) {
      // (a scatter everywhere, thinner further out)
      const r = Math.sqrt(rand()) * RIM * 1.05;
      const a = rand() * TAU;
      x = Math.cos(a) * r;
      z = Math.sin(a) * r;
      t = r / RIM;
    } else {
      const arm = i % 2;
      t = rand() ** 0.8;
      const r = 0.6 + t * RIM;
      const a = arm * Math.PI + Math.log(r + 0.6) * 2.6 + (rand() - 0.5) * (0.9 - t * 0.4) + 0.6;
      const spread = (rand() - 0.5) * (0.6 + t * 1.3);
      x = Math.cos(a) * r + Math.cos(a + Math.PI / 2) * spread;
      z = Math.sin(a) * r + Math.sin(a + Math.PI / 2) * spread;
    }
    const y = (rand() - 0.5) * 0.35 * (1 - t * 0.7) - 0.06;
    pos.set([x, y, z], i * 3);
    // (none past the rim's bezel, where the arms' spread would throw a few: the table ends there)
    const past = Math.hypot(x, z) > edgeAt(EDGE, Math.atan2(z, x));
    // (warm in the bulge, blue-white along the arms, now and then a pink knot where stars are being born)
    const warm = t < 0.22 ? 1 : 0.25;
    const pink = t > 0.25 && rand() < 0.04;
    const b = past ? 0 : (0.3 + rand() * 0.7) * (1 - t * 0.4) * Math.min(1, 0.35 + t * 2.4);
    col.set(pink ? [1 * b, 0.55 * b, 0.75 * b] : [((170 + 85 * warm) / 255) * b, ((190 + 40 * warm) / 255) * b, b], i * 3);
    size[i] = 0.02 + rand() ** 6 * 0.08;
  }
  return starPoints(pos, col, size, 2);
}

// the far field: stars well under and round the table, so the space it hangs in isn't flat black and moves as it turns
function farStars(small) {
  const rand = seeded(777);
  const n = small ? 900 : 2000;
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const size = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    // (a shell, mostly under the plane, where a camera looking down sees it)
    const u = rand() * TAU;
    const v = -1 + rand() * 1.35;
    const r = 70 + rand() * 30;
    const h = Math.sqrt(1 - v * v);
    pos.set([Math.cos(u) * h * r, v * r, Math.sin(u) * h * r], i * 3);
    const b = 0.18 + rand() ** 3 * 0.6;
    const tint = rand();
    col.set([b * (tint > 0.8 ? 1 : 0.8), b * 0.88, b * (tint < 0.3 ? 0.8 : 1)], i * 3);
    size[i] = 0.14 + rand() ** 4 * 0.3;
  }
  return starPoints(pos, col, size, 0);
}

// a ring's edge at a bearing, on the plane (the regions' bulge)
const at = (r, a, y = 0) => [Math.cos(a) * edgeAt(r, a), y, Math.sin(a) * edgeAt(r, a)];

// the sectors: one mesh, a strip of quads a sector, its colour and its mode (hatched, contested, its lines, open) per
// vertex, and how far each vertex is from the sector's edges, so the fill can brighten toward them and draw them
function sectorMesh() {
  const strips = SECTORS.map((s) => ({ s, n: Math.max(2, Math.ceil((s.a1 - s.a0) / 0.04)) }));
  const verts = strips.reduce((k, x) => k + (x.n + 1) * 2, 0);
  const pos = new Float32Array(verts * 3);
  const fill = new Float32Array(verts * 4);
  const mode = new Float32Array(verts * 4);
  const edge = new Float32Array(verts * 4);
  const owner = new Int32Array(verts); // (the sector each vertex is on)
  const idx = [];
  let v = 0;
  const FAR_OFF = 99; // (no edge there: the Deep Core's round has no cut and no inner edge)
  strips.forEach(({ s, n }, si) => {
    const base = v;
    const whole = s.a1 - s.a0 >= TAU - 1e-6;
    for (let i = 0; i <= n; i++) {
      const a = s.a0 + ((s.a1 - s.a0) * i) / n;
      const ro = edgeAt(s.r1, a);
      const ri = s.r0 > 0 ? edgeAt(s.r0, a) : 0;
      const w = ro - ri;
      // (along the arc to each cut, at the vertex's own radius: across a thin strip that's near enough linear)
      const cuts = (r) => (whole ? [FAR_OFF, FAR_OFF] : [(a - s.a0) * r, (s.a1 - a) * r]);
      pos.set([Math.cos(a) * ro, -0.004, Math.sin(a) * ro], v * 3);
      edge.set([s.r0 > 0 ? w : FAR_OFF, 0, ...cuts(ro)], v * 4);
      owner[v++] = si;
      pos.set([Math.cos(a) * ri, -0.004, Math.sin(a) * ri], v * 3);
      edge.set([s.r0 > 0 ? 0 : FAR_OFF, w, ...cuts(ri)], v * 4);
      owner[v++] = si;
    }
    for (let i = 0; i < n; i++) {
      const o = base + i * 2;
      idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2);
    }
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aFill', new THREE.BufferAttribute(fill, 4));
  geo.setAttribute('aMode', new THREE.BufferAttribute(mode, 4));
  geo.setAttribute('aEdge', new THREE.BufferAttribute(edge, 4));
  geo.setIndex(idx);
  const mat = new THREE.ShaderMaterial({ vertexShader: SECTOR_VERT, fragmentShader: SECTOR_FRAG, uniforms: { uTime: { value: 0 } }, transparent: true, depthWrite: false, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 1;
  const c = new THREE.Color();
  return {
    mesh,
    geo,
    mat,
    // each sector's colour from who holds it: the side's own systems' full, only its reach hatched, yours faint (as
    // Super Earth's are, dark under the others'), nobody's a faint blue of the table's own with its borders alone
    // (and with one open, it brighter and the rest dimmed; the one the pointer's over brighter)
    paint(holds, mine, { open = null, hover = null } = {}) {
      const per = SECTORS.map((s) => {
        const h = holds[s.id];
        const opened = s.id === open;
        const over = s.id === hover && !opened;
        const k = open && !opened ? 0.3 : 1;
        const lift = opened ? 1.25 : over ? 1.6 : 1;
        const line = (opened || over ? 1 : h?.side ? 0.55 : 0.26) * k;
        const lit = opened ? 1 : 0;
        if (s.unknown && !h?.held) return { rgb: [0.012, 0.025, 0.06], a: 0.6 * k, hatch: 0, fight: 0, line: line * 0.6, lit };
        if (!h?.side) return { rgb: [0.35, 0.65, 1], a: (over ? 0.08 : opened ? 0.05 : 0.022) * k, hatch: 0, fight: 0, line, lit };
        c.set(SIDES[h.side].colour);
        const yours = h.side === mine;
        return { rgb: [c.r, c.g, c.b], a: Math.min(0.7, (yours ? 0.1 : 0.22) * (h.held ? 1 : 0.95) * k * lift), hatch: h.held ? 0 : 1, fight: h.contested ? 1 : 0, line, lit };
      });
      for (let i = 0; i < owner.length; i++) {
        const p = per[owner[i]];
        fill.set([...p.rgb, p.a], i * 4);
        mode.set([p.hatch, p.fight, p.line, p.lit], i * 4);
      }
      geo.attributes.aFill.needsUpdate = true;
      geo.attributes.aMode.needsUpdate = true;
    },
  };
}

// a sector's edge as a ribbon on the plane, `w` grid squares wide, a little over the sectors: the open one's, the one the
// pointer's over and yours
function ribbon(id, w) {
  const pts = outline(sectorById(id), 16).map(([x, z]) => [x - CORE[0], z - CORE[1]]);
  const pos = [];
  for (let i = 0; i < pts.length; i++) {
    const [ax, az] = pts[i];
    const [bx, bz] = pts[(i + 1) % pts.length];
    const len = Math.hypot(bx - ax, bz - az) || 1;
    const [nx, nz] = [(-(bz - az) / len) * (w / 2), ((bx - ax) / len) * (w / 2)];
    const q = [[ax + nx, az + nz], [ax - nx, az - nz], [bx + nx, bz + nz], [bx - nx, bz - nz]].map(([x, z]) => [x, 0.014, z]);
    pos.push(...q[0], ...q[1], ...q[2], ...q[1], ...q[3], ...q[2]);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return geo;
}

// the table's bezel: a fine line just past the rim, ticked every 2.5° out from it and every 15° further, as a
// navicomputer's dial is
function bezel() {
  const pos = [];
  const quad = (a, r0, r1, w) => {
    const [x0, , z0] = at(r0, a);
    const [x1, , z1] = at(r1, a);
    const len = Math.hypot(x1 - x0, z1 - z0) || 1;
    const [nx, nz] = [(-(z1 - z0) / len) * (w / 2), ((x1 - x0) / len) * (w / 2)];
    const q = [[x0 + nx, z0 + nz], [x0 - nx, z0 - nz], [x1 + nx, z1 + nz], [x1 - nx, z1 - nz]].map(([x, z]) => [x, 0.003, z]);
    pos.push(...q[0], ...q[1], ...q[2], ...q[1], ...q[3], ...q[2]);
  };
  const R = EDGE + 0.14;
  const steps = 288;
  for (let i = 0; i < steps; i++) {
    // (the ring as short quads along it, each from one step to the next)
    const a0 = (i / steps) * TAU;
    const a1 = ((i + 1) / steps) * TAU;
    const [x0, , z0] = at(R, a0);
    const [x1, , z1] = at(R, a1);
    const [ix0, , iz0] = at(R - 0.022, a0);
    const [ix1, , iz1] = at(R - 0.022, a1);
    pos.push(x0, 0.003, z0, ix0, 0.003, iz0, x1, 0.003, z1, ix0, 0.003, iz0, ix1, 0.003, iz1, x1, 0.003, z1);
  }
  for (let i = 0; i < 144; i++) {
    const long = i % 6 === 0;
    quad((i / 144) * TAU, R, R + (long ? 0.34 : 0.13), long ? 0.04 : 0.026);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.62, 0.86, 1), transparent: true, opacity: 0.42, depthWrite: false, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 2;
  return { mesh, geo, mat };
}

export function createHoloScene({ small = false, reduced = false } = {}) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#01040b');
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.05, FAR * 3);
  const made = [];

  // (the systems' globes are lit from the upper left, as the flat map's are, a cool fill round the rest)
  const sun = new THREE.DirectionalLight('#ffffff', 1.5);
  sun.position.set(-4, 10, 5);
  scene.add(sun, new THREE.AmbientLight('#b9d6ff', 0.55));

  const far = farStars(small);
  const sky = stars(small);
  scene.add(far.points, sky.points);
  made.push(far.geo, far.mat, sky.geo, sky.mat);
  const glowGeo = new THREE.PlaneGeometry(RIM * 2.3, RIM * 2.3).rotateX(-Math.PI / 2);
  const glowMat = new THREE.ShaderMaterial({ vertexShader: GLOW_VERT, fragmentShader: GLOW_FRAG, uniforms: { uRim: { value: RIM } }, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const glow = new THREE.Mesh(glowGeo, glowMat);
  glow.position.y = -0.08;
  scene.add(glow);
  made.push(glowGeo, glowMat);

  const sectors = sectorMesh();
  scene.add(sectors.mesh);
  made.push(sectors.geo, sectors.mat);
  const dial = bezel();
  scene.add(dial.mesh);
  made.push(dial.geo, dial.mat);
  const marks = createMarks({ small });
  // (the systems' pins and rings over the sectors' fill and the names, not tinted under them)
  marks.group.renderOrder = 5;
  scene.add(marks.group);

  // the regions' names, each in its ring's band, in a column down the south of the disc, where the curve has them the
  // right way up from the table's edge and no war's mark is (the systems come in with their sector)
  const words = [];
  const font = typeof document !== 'undefined' ? getComputedStyle(document.documentElement).getPropertyValue('--font-mono').trim() || 'ui-monospace, monospace' : 'monospace';
  for (const ring of RINGS) {
    if (ring.id === 'deep' || ring.id === 'wild') continue;
    const r = (ring.r0 + ring.r1) / 2;
    const size = Math.min(0.4, (ring.r1 - ring.r0) * 0.52);
    words.push(arcText(ring.name, { r, a: Math.PI / 2, size, alpha: 0.5, font, weight: 500, spacing: 0.3 }));
  }
  // (the Unknown Regions straight across their dark, read with the north up)
  words.push(flatText('Unknown Regions', { x: -8.3, z: -0.4, size: 0.42, alpha: 0.42, font, weight: 500, spacing: 0.3 }));
  for (const w of words) scene.add(w.mesh);
  // each side's name along the rim, made again when who holds the rim changes
  let rim = [];
  let rimKey = '';
  let wordsK = 1; // (the names' share of their alpha: dimmed while a sector's open)
  const putRim = (holds) => {
    const names = rimNames(holds, { least: 0.9 });
    const key = names.map((n) => `${n.side}:${n.a.toFixed(2)}`).join(',');
    if (key === rimKey) return;
    rimKey = key;
    for (const w of rim) (scene.remove(w.mesh), w.dispose());
    rim = names.slice(0, 3).map((n) => arcText(SIDES[n.side].name, { r: RINGS.at(-1).r0 + 0.45, a: n.a, size: 0.6, colour: SIDES[n.side].colour, alpha: 0.85, font, weight: 700, spacing: 0.24 }));
    for (const w of rim) (w.setAlpha(wordsK), scene.add(w.mesh));
  };

  // the edges of the open sector, the one the pointer's over and yours, each made when it changes
  // (their colours under the bloom's threshold, so an edge stays a line and doesn't bloom into a band)
  const EDGES = { open: { w: 0.03, colour: new THREE.Color(0.9, 1.06, 1.22), opacity: 0.95 }, hover: { w: 0.024, colour: new THREE.Color(0.55, 0.9, 1.15), opacity: 0.85 }, you: { w: 0.02, colour: new THREE.Color(0.95, 0.95, 0.95), opacity: 0.55 } };
  const edges = {};
  const edge = (kind, id) => {
    const e = edges[kind];
    if ((e?.id ?? null) === (id ?? null)) return;
    if (e) (scene.remove(e.mesh), e.geo.dispose(), e.mat.dispose());
    delete edges[kind];
    if (!id) return;
    const { w, colour, opacity } = EDGES[kind];
    const geo = ribbon(id, w);
    const mat = new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = 3;
    scene.add(mesh);
    edges[kind] = { id, mesh, geo, mat };
  };

  // what the map shows, taken when it changes
  const widths = new Map(); // (each name's, measured as it's first placed, and again once the fonts are in: below)
  let version = -1;
  let warKey = null;
  let holds = {};
  let paintedAt = null;
  let open = null;
  let only = new Set();
  let here = null;
  let prio = {};
  const take = (link) => {
    if (link.version === version) return;
    version = link.version;
    widths.clear(); // (a name's marks change with what's shown: measured again)
    const { war, current, pick, lit } = link.state;
    if (!war) return;
    const mine = link.state.mine ?? null;
    // (the sector open, if any, and the one the pointer's over: its systems drawn and named, none on the whole galaxy)
    open = link.state.sector ?? null;
    const hover = link.state.hoverSector ?? null;
    only = new Set(open ? systemsIn(open).map((s) => s.id) : []);
    here = current;
    wordsK = open ? 0.3 : 1;
    for (const w of [...words, ...rim]) w.setAlpha(wordsK);
    dial.mat.opacity = open ? 0.2 : 0.42;
    const key = `${war.war}:${war.campaign}:${war.systems.map((r) => `${r.id}${r.owner}${r.attack ? 'a' : ''}${r.front ? 'f' : ''}${r.battle ? 'b' : ''}`).join('')}:${mine}`;
    if (key !== warKey) {
      warKey = key;
      holds = holders(war);
      putRim(holds);
      paintedAt = null;
    }
    if (paintedAt !== `${open}:${hover}`) {
      paintedAt = `${open}:${hover}`;
      sectors.paint(holds, mine, { open, hover });
    }
    const you = current ? systemById(current) : null;
    edge('open', open);
    edge('hover', hover !== open ? hover : null);
    edge('you', you && !open ? sectorOf(you.pos) : null);
    marks.set({ war, ops: opsOf(war), pick, current, lit, mine, only });
    // each system's name in the open sector: who must be named, who may be
    prio = {};
    for (const s of SYSTEMS) {
      const row = war.byId?.[s.id];
      prio[s.id] = s.id === current ? 100 : s.id === pick ? 90 : s.id === link.state.hover ? 80 : row?.battle?.fighting ? 50 : row?.major ? 40 : row ? 30 : s.charted ? -1 : 20;
    }
  };

  // each system's label: where its system is on the screen, and whether it's named there
  const v = new THREE.Vector3();
  let placed = {};
  let placedAt = null;
  globalThis.document?.fonts?.ready.then(() => (widths.clear(), (placedAt = null)));
  const label = (link, size, force) => {
    const items = [];
    for (const s of SYSTEMS) {
      v.set(...worldOf(s)).project(camera);
      const x = ((v.x + 1) / 2) * size.w;
      const y = ((1 - v.y) / 2) * size.h;
      // (drawn: the open sector's systems; on the whole galaxy, where you are alone, its tag)
      const drawn = only.has(s.id) || (!open && s.id === here);
      const on = drawn && v.z < 1 && x > -40 && x < size.w + 40 && y > -40 && y < size.h + 40;
      link.place(s.id, x, y, on);
      const p = prio[s.id] ?? 0;
      // (named only with its dot on the free part of the stage: one past its edge, under the header and the crumb or under the
      // side panel has its dot alone)
      const inside = x >= 0 && y >= (link.inset?.top ?? 0) && x <= size.w - (link.inset?.right ?? 0) && y <= size.h - (link.inset?.bottom ?? 0);
      if (!on || !inside) continue;
      const el = link.labels.get(s.id);
      let w = widths.get(s.id);
      // (the name's width, not its button's: the button is the dot's)
      if (!w && el) (w = (el.querySelector('.holo-name')?.offsetWidth ?? 0) + 2), w > 2 && widths.set(s.id, w);
      items.push({ id: s.id, x, y, w: w || estimateWidth(open ? s.name : 'YOU', 12.5), h: LABEL_H, prio: p, ...(p < 0 && { optional: true }), ...(s.charted && { dot: 4 }) });
    }
    // (the names placed again only when the view's moved a pixel or two, or what's shown has changed)
    const { right = 0, bottom = 0 } = link.inset ?? {};
    const key = `${link.pose.x.toFixed(3)}:${link.pose.z.toFixed(3)}:${link.pose.yaw.toFixed(3)}:${link.pose.pitch.toFixed(3)}:${link.pose.dist.toFixed(3)}:${size.w}x${size.h}:${right}:${bottom}:${link.blocks?.length}:${version}`;
    if (force || key !== placedAt) {
      placedAt = key;
      // (inside the stage less the side panel, clear of the page's controls over it, a dot under one unnamed)
      placed = placeLabels(items, { bounds: { x0: 0, y0: 0, x1: size.w - right, y1: size.h - bottom }, blocks: link.blocks ?? [], hideUnder: true });
    }
    const shown = new Set(items.map((i) => i.id));
    for (const s of SYSTEMS) {
      const el = link.labels.get(s.id);
      if (!el) continue;
      const p = link.screen.get(s.id);
      el.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0)`;
      const place = placed[s.id];
      const dot = p.on;
      if (!dot) el.setAttribute('data-off', '');
      else el.removeAttribute('data-off');
      const quiet = !shown.has(s.id) || !place || place === HIDDEN;
      // (on the whole galaxy, where you are has its YOU tag and no name)
      el.toggleAttribute('data-tag', !open && s.id === here);
      if (quiet) el.setAttribute('data-quiet', '');
      else el.removeAttribute('data-quiet');
      el.dataset.place = quiet ? 'r' : sideOf(place) ?? 'r';
      const hang = quiet ? null : hangOf(place);
      if (hang) el.dataset.hang = hang;
      else delete el.dataset.hang;
    }
  };

  let lastNow = null;
  return {
    scene,
    camera,
    frame(dt, now, link, size, ratio = 1) {
      take(link);
      const was = link.pose;
      link.pose = reduced ? link.target : ease(link.pose, link.target, Math.min(dt, 0.1));
      const moving = !settled(was, link.pose);
      const { at: eyeAt, look } = eye(link.pose);
      // (the lens shifted so the disc's middle is the middle of the part the panels leave: link.js's inset)
      const lens = lensOf(size, link.inset);
      camera.aspect = lens.aspect;
      if (lens.x || lens.y || lens.W !== size.w || lens.H !== size.h) camera.setViewOffset(lens.W, lens.H, lens.x, lens.y, size.w, size.h);
      else camera.clearViewOffset();
      camera.position.set(...eyeAt);
      camera.lookAt(...look);
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();
      // (a star's size is in the page's pixels: the device's follow the ratio drawn at)
      sky.mat.uniforms.uRatio.value = ratio;
      far.mat.uniforms.uRatio.value = ratio;
      // (the grid squares a pixel covers where it looks, for the marks' size on the screen)
      marks.fit((2 * Math.tan((FOV * Math.PI) / 360) * link.pose.dist) / Math.max(1, lens.H));
      const t = reduced ? 0 : now / 1000;
      sectors.mat.uniforms.uTime.value = t;
      marks.animate(t);
      const force = lastNow === null;
      lastNow = now;
      label(link, size, force);
      return !reduced || moving;
    },
    dispose() {
      for (const kind of Object.keys(edges)) edge(kind, null);
      marks.dispose();
      for (const w of [...words, ...rim]) w.dispose();
      for (const x of made) x.dispose?.();
    },
  };
}
