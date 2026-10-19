// The holotable (docs/superpowers/specs/2026-10-19-galaxy-holotable-design.md): the galaxy map in 3D, drawn by
// the galaxy world in the flight's place while the map is open (../scene.js, through the post chain's view()),
// its own scene and camera in the map's units with the core at the origin (./holoCamera.js). On the plane: the
// disc's stars on the 2D map's two arms, the core's glow, the sectors (./sectors.js) in their holders' colours,
// clouded where they hold, hatched where they only reach, faint where they're yours, the contested ones beating,
// their borders thin and the regions' brighter (no hyperlanes: the flat map has them), the regions' names and each
// side's along the rim (./holoText.js). As Helldivers 2 has it, the whole galaxy is its sectors alone (and where you
// are, a pulse and its YOU tag); the systems, the war's marks on them (./holoMarks.js) and their names come in only in
// the sector opened (link.state.sector: brighter and edged, the rest dimmed), the one the pointer's over edged too. The
// labels are the page's buttons (HoloStage.jsx), put here each frame where their systems are and named where
// labelPlace.js finds room.
//
//   createHoloScene({ small, reduced }) → { scene, camera, frame(dt, now, link, size) → busy, dispose }

import * as THREE from 'three';
import { HIDDEN, estimateWidth, hangOf, placeLabels, sideOf } from '../labelPlace';
import { SIDES } from '../sides';
import { CORE, RIM, SYSTEMS, edgeAt, systemById } from '../systems';
import { opsOf } from '../warMap';
import { FAR, FOV, ease, eye, lensOf, settled } from './holoCamera';
import { arcText } from './holoText';
import { createMarks, worldOf } from './holoMarks';
import { RINGS, SECTORS, holders, outline, rimNames, sectorById, sectorOf, systemsIn } from './sectors';

const TAU = Math.PI * 2;
// (how far off the camera is when each kind of name comes in, grid squares)
const LABEL_H = 18;

const STAR_VERT = /* glsl */ `
attribute float aSize;
attribute vec3 aColor;
uniform float uScale;
varying vec3 vColor;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = clamp(aSize * uScale / -mv.z, 1.0, 9.0);
  vColor = aColor;
  gl_Position = projectionMatrix * mv;
}`;
const STAR_FRAG = /* glsl */ `
varying vec3 vColor;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d);
  gl_FragColor = vec4(vColor * a * a, 1.0);
}`;
const GLOW_FRAG = /* glsl */ `
varying vec2 vUv;
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  if (r > 1.0) discard;
  float core = exp(-r * r * 90.0);
  float bulge = exp(-r * r * 12.0);
  float haze = exp(-r * 2.6);
  vec3 col = vec3(1.0, 0.82, 0.55) * core * 1.1 + vec3(1.0, 0.78, 0.5) * bulge * 0.12 + vec3(0.4, 0.55, 1.0) * haze * 0.06;
  gl_FragColor = vec4(col * smoothstep(1.0, 0.85, r), 1.0);
}`;
const FLAT_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const SECTOR_VERT = /* glsl */ `
attribute vec4 aFill;
attribute vec2 aMode;
varying vec4 vFill;
varying vec2 vMode;
varying vec2 vAt;
void main() {
  vFill = aFill;
  vMode = aMode;
  vAt = position.xz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const SECTOR_FRAG = /* glsl */ `
uniform float uTime;
varying vec4 vFill;
varying vec2 vMode;
varying vec2 vAt;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
void main() {
  // (a held sector's fill clouded, as Helldivers 2's are; one only in reach hatched with fine lines, run across the
  // map in its own units so they keep their pitch on every sector)
  float cloud = noise(vAt * 0.8) * 0.6 + noise(vAt * 2.1 + 7.0) * 0.4;
  float line = smoothstep(0.7, 0.86, abs(fract((vAt.x - vAt.y) * 3.2) - 0.5) * 2.0);
  float a = vFill.a * (vMode.x > 0.5 ? 0.3 + 0.7 * line : 0.62 + 0.6 * cloud);
  a *= vMode.y > 0.5 ? 0.78 + 0.3 * sin(uTime * 3.2) : 1.0;
  gl_FragColor = vec4(vFill.rgb, a);
}`;

function seeded(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

// the disc's stars, on the 2D map's arms (HoloMap.jsx paintGalaxy), a little thickness to the disc
function stars(small) {
  const rand = seeded(12345);
  const n = small ? 4200 : 9000;
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
      t = rand() ** 0.7;
      const r = 0.4 + t * RIM;
      const a = arm * Math.PI + Math.log(r + 0.6) * 2.6 + (rand() - 0.5) * (0.9 - t * 0.4) + 0.6;
      const spread = (rand() - 0.5) * (0.6 + t * 1.3);
      x = Math.cos(a) * r + Math.cos(a + Math.PI / 2) * spread;
      z = Math.sin(a) * r + Math.sin(a + Math.PI / 2) * spread;
    }
    const y = (rand() - 0.5) * 0.35 * (1 - t * 0.7) - 0.06;
    pos.set([x, y, z], i * 3);
    const warm = t < 0.25 ? 1 : 0.3;
    const b = (0.35 + rand() * 0.75) * (1 - t * 0.45);
    col.set([((170 + 85 * warm) / 255) * b, ((190 + 40 * warm) / 255) * b, b], i * 3);
    size[i] = 0.022 + rand() ** 5 * 0.07;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  const mat = new THREE.ShaderMaterial({ vertexShader: STAR_VERT, fragmentShader: STAR_FRAG, uniforms: { uScale: { value: 900 } }, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  return { points: new THREE.Points(geo, mat), geo, mat };
}

// a ring's edge at a bearing, on the plane (the regions' bulge)
const at = (r, a, y = 0) => [Math.cos(a) * edgeAt(r, a), y, Math.sin(a) * edgeAt(r, a)];

// the sectors: one mesh, a strip of quads a sector, its colour and its mode (hatched, contested) per vertex
function sectorMesh() {
  const strips = SECTORS.map((s) => ({ s, n: Math.max(2, Math.ceil((s.a1 - s.a0) / 0.05)) }));
  const verts = strips.reduce((k, x) => k + (x.n + 1) * 2, 0);
  const pos = new Float32Array(verts * 3);
  const fill = new Float32Array(verts * 4);
  const mode = new Float32Array(verts * 2);
  const owner = new Int32Array(verts); // (the sector each vertex is on)
  const idx = [];
  let v = 0;
  strips.forEach(({ s, n }, si) => {
    const base = v;
    for (let i = 0; i <= n; i++) {
      const a = s.a0 + ((s.a1 - s.a0) * i) / n;
      pos.set(at(s.r1, a, -0.004), v * 3);
      owner[v++] = si;
      pos.set(s.r0 > 0 ? at(s.r0, a, -0.004) : [0, -0.004, 0], v * 3);
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
  geo.setAttribute('aMode', new THREE.BufferAttribute(mode, 2));
  geo.setIndex(idx);
  const mat = new THREE.ShaderMaterial({ vertexShader: SECTOR_VERT, fragmentShader: SECTOR_FRAG, uniforms: { uTime: { value: 0 } }, transparent: true, depthWrite: false, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 1;
  const c = new THREE.Color();
  return {
    mesh,
    geo,
    mat,
    // each sector's colour from who holds it: the side's own systems' clouded, only its reach hatched, yours faint
    // (as Super Earth's are, dark under the others'), nobody's dark
    // (and with one open, it brighter and the rest dimmed; the one the pointer's over brighter, a dark one tinted)
    paint(holds, mine, { open = null, hover = null } = {}) {
      const per = SECTORS.map((s) => {
        const h = holds[s.id];
        const k = (open && s.id !== open ? 0.3 : 1) * (s.id === open ? 1.15 : 1) * (s.id === hover && s.id !== open ? 1.6 : 1);
        if (s.unknown && !h?.held) return { rgb: [0.02, 0.04, 0.09], a: 0.55 * Math.min(1, k), hatch: 0, fight: 0 };
        if (!h?.side) return s.id === hover ? { rgb: [0.5, 0.8, 1], a: 0.07, hatch: 0, fight: 0 } : { rgb: [0, 0, 0], a: 0, hatch: 0, fight: 0 };
        c.set(SIDES[h.side].colour);
        const yours = h.side === mine;
        return { rgb: [c.r, c.g, c.b], a: Math.min(0.75, (yours ? 0.12 : 0.34) * (h.held ? 1 : 0.7) * k), hatch: h.held ? 0 : 1, fight: h.contested ? 1 : 0 };
      });
      for (let i = 0; i < owner.length; i++) {
        const p = per[owner[i]];
        fill.set([...p.rgb, p.a], i * 4);
        mode.set([p.hatch, p.fight], i * 2);
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

// the sectors' borders (thin) and the regions' edges (brighter), as line segments on the plane
function borders() {
  const fine = [];
  const bold = [];
  for (const ring of RINGS) {
    // the ring's outer edge all the way round
    const steps = 160;
    for (let i = 0; i < steps; i++) {
      const a0 = (i / steps) * TAU;
      const a1 = ((i + 1) / steps) * TAU;
      bold.push(...at(ring.r1, a0, 0.002), ...at(ring.r1, a1, 0.002));
    }
  }
  for (const s of SECTORS) if (s.r0 > 0) fine.push(...at(s.r0, s.a0, 0.002), ...at(s.r1, s.a0, 0.002));
  const make = (arr, opacity) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(arr), 3));
    const mat = new THREE.LineBasicMaterial({ color: 0xd9f3ff, transparent: true, opacity, depthWrite: false });
    const lines = new THREE.LineSegments(geo, mat);
    lines.renderOrder = 2;
    return { lines, geo, mat };
  };
  return [make(fine, 0.14), make(bold, 0.32)];
}

export function createHoloScene({ small = false, reduced = false } = {}) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#01040b');
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.05, FAR * 3);
  const made = [];

  const sky = stars(small);
  scene.add(sky.points);
  made.push(sky.geo, sky.mat);
  const glowGeo = new THREE.PlaneGeometry(RIM * 2.3, RIM * 2.3).rotateX(-Math.PI / 2);
  const glowMat = new THREE.ShaderMaterial({ vertexShader: FLAT_VERT, fragmentShader: GLOW_FRAG, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const glow = new THREE.Mesh(glowGeo, glowMat);
  glow.position.y = -0.08;
  scene.add(glow);
  made.push(glowGeo, glowMat);

  const sectors = sectorMesh();
  scene.add(sectors.mesh);
  made.push(sectors.geo, sectors.mat);
  for (const b of borders()) {
    scene.add(b.lines);
    made.push(b.geo, b.mat);
  }
  const marks = createMarks({ small });
  scene.add(marks.group);

  // the regions' names, each in its ring's band, at a bearing clear of the war's busiest part (the north east)
  const words = [];
  const font = typeof document !== 'undefined' ? getComputedStyle(document.documentElement).getPropertyValue('--font-mono').trim() || 'ui-monospace, monospace' : 'monospace';
  const REGION_AT = { core: 2.1, colonies: 2.55, inner: 1.2, expansion: 2.9, mid: 2.3, outer: 2.75, wild: 0 };
  for (const ring of RINGS) {
    if (ring.id === 'deep' || ring.id === 'wild') continue;
    const r = (ring.r0 + ring.r1) / 2;
    const size = Math.min(0.42, (ring.r1 - ring.r0) * 0.55);
    words.push(arcText(ring.name, { r, a: REGION_AT[ring.id], size, alpha: 0.42, font, weight: 500, spacing: 0.3 }));
  }
  words.push(arcText('Unknown Regions', { r: 8.4, a: Math.PI, size: 0.5, alpha: 0.36, font, weight: 500, spacing: 0.3 }));
  for (const w of words) scene.add(w.mesh);
  // each side's name along the rim, made again when who holds the rim changes
  let rim = [];
  let rimKey = '';
  const putRim = (holds) => {
    const names = rimNames(holds, { least: 0.9 });
    const key = names.map((n) => `${n.side}:${n.a.toFixed(2)}`).join(',');
    if (key === rimKey) return;
    rimKey = key;
    for (const w of rim) (scene.remove(w.mesh), w.dispose());
    rim = names.slice(0, 3).map((n) => arcText(SIDES[n.side].name, { r: RINGS.at(-1).r0 + 0.45, a: n.a, size: 0.62, colour: SIDES[n.side].colour, alpha: 0.75, font, weight: 700, spacing: 0.24 }));
    for (const w of rim) scene.add(w.mesh);
  };

  // the edges of the open sector, the one the pointer's over and yours, each made when it changes
  // (their colours under the bloom's threshold, so an edge stays a line and doesn't bloom into a band)
  const EDGES = { open: { w: 0.032, colour: new THREE.Color(0.86, 1.04, 1.2), opacity: 0.95 }, hover: { w: 0.026, colour: new THREE.Color(0.55, 0.9, 1.15), opacity: 0.85 }, you: { w: 0.02, colour: new THREE.Color(0.95, 0.95, 0.95), opacity: 0.5 } };
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
    frame(dt, now, link, size) {
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

