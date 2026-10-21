// What the four common rooms and the kitchens share (the design’s §4.4):
// a round room or a long one built into the room kit, the squashy chairs and
// the sofas, a rug painted in the house’s colours, the notice board with the
// week’s notices pinned to it (a prop: Lane F’s quests write it), the Floo
// in the fireplace that says where the fire will go next, the bed that moves
// the term on, the house ghost drifting through, and the room put together
// with its doors, its light and its count. Each house’s file says what is
// its own.
//
//   NOTICES: the board’s pins until the term’s lane writes them: [{ title, text }]
//   roundWalls(kit, { r, h, mat, gaps, segs }) → the wall as runs of ashlar, gaps (angles) left for doors and windows
//   armchair(kit, { at, ry, cloth })   sofa(kit, { at, ry, cloth, len })   lowTable(kit, { at, r })
//   paintRug(colours, { size }) / paintBoard(notices, { w, h }) → canvas (in a browser)
//   flat(canvas, { renderer, w, h, at, ry, rx }) → a plane with the canvas on it (a rug, a board, a tapestry)
//   commonRoom(spec) → { id, name, build(rt, ctx) }: spec { id, name, house, make(kit, ctx) → parts,
//     bounds, colliders, spawn, doors, poses, light: { hemi: [sky, ground, k], points: [[x, y, z, colour, k]] } }

import * as THREE from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { canvasTexture } from '../../../../lib/three/canvasTexture';
import { countOf, createRoomKit } from '../kit';
import { createFire } from '../parts/fire';
import { roomEnv, wearEnv } from '../parts/env';
import { createGhost, GHOSTS } from '../../cast/ghosts';

export const NOTICES = [
  { title: 'Flying lessons', text: 'First years, Thursday, on the lawn. Madam Hooch will not be lending anyone her own broom.' },
  { title: 'Lost', text: 'One toad. Answers to nothing. Please return to the fifth-year dormitory.' },
  { title: 'Hogsmeade', text: 'Third years and up, the first weekend of next month. Slips to your Head of House by Friday.' },
  { title: 'Gobstones club', text: 'Wednesdays in the trophy room. Bring a cloth for your face.' },
  { title: 'Exploding Snap', text: 'The common room tournament starts Saturday. Bring your own eyebrows.' },
];

// the Floo says where the fire will go next (the design’s §2: Diagon Alley is a later phase)
export const FLOO = 'The fire says its next stop is Diagon Alley. It isn’t going there yet.';

export function roundWalls(kit, { r, h, mat = 'stone', gaps = [], segs = 28, thick = 0.6 }) {
  const run = (Math.PI * 2) / segs;
  for (let i = 0; i < segs; i++) {
    const a = (i + 0.5) * run;
    if (gaps.some(([g0, g1]) => angleIn(a, g0, g1))) continue;
    const len = 2 * (r + thick / 2) * Math.tan(run / 2) + 0.05;
    kit.box(mat, Math.sin(a) * (r + thick / 2), 0, Math.cos(a) * (r + thick / 2), len, h, thick, { ry: a });
  }
}
const angleIn = (a, g0, g1) => {
  const n = (x) => ((x % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const [x, s, e] = [n(a), n(g0), n(g1)];
  return s <= e ? x >= s && x <= e : x >= s || x <= e;
};

// a squashy armchair: a deep seat, a high rolled back, fat arms, short feet
export function armchair(kit, { at, ry = 0, cloth = '#7a1c22' }) {
  const c = Math.cos(ry);
  const s = Math.sin(ry);
  const put = (m, x, y, z, w, h, d) => kit.box(m, at[0] + x * c + z * s, at[1] + y, at[2] - x * s + z * c, w, h, d, { ry });
  const fab = kit.paint(cloth, { rough: 0.95, scan: 'adobe', metres: 0.6, strength: 0.25 });
  put(fab, 0, 0.12, 0, 0.9, 0.36, 0.86);
  put(fab, 0, 0.48, -0.33, 0.9, 0.62, 0.22);
  put(fab, -0.42, 0.42, 0.02, 0.18, 0.3, 0.84);
  put(fab, 0.42, 0.42, 0.02, 0.18, 0.3, 0.84);
  kit.cyl(fab, at[0] - 0.33 * s, at[1] + 1.02, at[2] - 0.33 * c, 0.12, 0.12, 0.9, { rz: Math.PI / 2, ry, seg: 8 });
  for (const [x, z] of [[-0.36, -0.34], [0.36, -0.34], [-0.36, 0.34], [0.36, 0.34]]) put('darkoak', x, 0, z, 0.08, 0.12, 0.08);
}

export function sofa(kit, { at, ry = 0, cloth = '#2a4a32', len = 2.1 }) {
  const c = Math.cos(ry);
  const s = Math.sin(ry);
  const put = (m, x, y, z, w, h, d) => kit.box(m, at[0] + x * c + z * s, at[1] + y, at[2] - x * s + z * c, w, h, d, { ry });
  const fab = kit.paint(cloth, { rough: 0.8, scan: 'adobe', metres: 0.6, strength: 0.25 });
  put(fab, 0, 0.12, 0, len, 0.34, 0.9);
  put(fab, 0, 0.46, -0.36, len, 0.56, 0.2);
  put(fab, -len / 2 + 0.1, 0.4, 0, 0.2, 0.3, 0.9);
  put(fab, len / 2 - 0.1, 0.4, 0, 0.2, 0.3, 0.9);
  for (const x of [-len / 2 + 0.15, len / 2 - 0.15]) for (const z of [-0.35, 0.35]) put('darkoak', x, 0, z, 0.08, 0.12, 0.08);
}

export function lowTable(kit, { at, r = 0.6, mat = 'darkoak' }) {
  kit.cyl(mat, at[0], at[1] + 0.42, at[2], r, r, 0.06, { seg: 16 });
  kit.cyl(mat, at[0], at[1], at[2], 0.08, 0.12, 0.42, { seg: 8 });
}

const ctx2d = (w, h) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return { c, g: c.getContext('2d') };
};

// a round rug: rings of the house’s two colours, a border of knots, worn in the middle
export function paintRug([a, b, ground = '#3a2a1e'], { size = 512 } = {}) {
  const { c, g } = ctx2d(size, size);
  const m = size / 2;
  const rings = [[1, ground], [0.94, a], [0.86, b], [0.8, a], [0.55, ground], [0.5, b], [0.32, a]];
  for (const [k, col] of rings) {
    g.beginPath();
    g.arc(m, m, m * k, 0, Math.PI * 2);
    g.fillStyle = col;
    g.fill();
  }
  // knots round the border, and the wear: lighter where feet go, in specks
  g.fillStyle = b;
  for (let i = 0; i < 64; i++) {
    const t = (i / 64) * Math.PI * 2;
    g.beginPath();
    g.arc(m + Math.cos(t) * m * 0.97, m + Math.sin(t) * m * 0.97, size * 0.008, 0, Math.PI * 2);
    g.fill();
  }
  for (let i = 0; i < 2200; i++) {
    const r = Math.sqrt(Math.random()) * m * 0.9;
    const t = Math.random() * Math.PI * 2;
    g.fillStyle = `rgba(255,240,220,${0.03 + Math.random() * 0.05})`;
    g.fillRect(m + Math.cos(t) * r, m + Math.sin(t) * r, 2, 2);
  }
  return c;
}

// the notice board: cork, and the notices pinned at a slant, each a title and its words
export function paintBoard(notices = NOTICES, { w = 640, h = 420 } = {}) {
  const { c, g } = ctx2d(w, h);
  g.fillStyle = '#8a6a44';
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 3000; i++) {
    g.fillStyle = `rgba(${60 + Math.random() * 60},${40 + Math.random() * 40},20,0.35)`;
    g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
  }
  g.strokeStyle = '#3a2614';
  g.lineWidth = 14;
  g.strokeRect(7, 7, w - 14, h - 14);
  const cols = 3;
  notices.slice(0, 6).forEach((n, i) => {
    const nw = w / cols - 24;
    const nh = h / 2 - 34;
    const x = 18 + (i % cols) * (w / cols) + (i % 2) * 4;
    const y = 22 + Math.floor(i / cols) * (h / 2 - 6);
    g.save();
    g.translate(x + nw / 2, y + nh / 2);
    g.rotate(((i * 37) % 9) / 100 - 0.04);
    g.fillStyle = i % 3 === 1 ? '#e8dcc0' : '#f2e8d0';
    g.fillRect(-nw / 2, -nh / 2, nw, nh);
    g.fillStyle = '#b02a2a';
    g.beginPath();
    g.arc(0, -nh / 2 + 8, 5, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#2a1d12';
    g.font = 'bold 17px Georgia, serif';
    g.textAlign = 'center';
    g.fillText(n.title, 0, -nh / 2 + 32);
    g.font = '13px Georgia, serif';
    const words = n.text.split(' ');
    let line = '';
    let ly = -nh / 2 + 52;
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (g.measureText(test).width > nw - 18) {
        g.fillText(line, 0, ly);
        line = word;
        ly += 16;
      } else line = test;
    }
    if (line) g.fillText(line, 0, ly);
    g.restore();
  });
  return c;
}

export function flat(canvas, { renderer = null, w, h, at, ry = 0, rx = 0, rough = 0.9 }) {
  const tex = canvas ? canvasTexture(canvas, renderer, { wrap: false }) : null;
  if (tex) tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new MeshStandardNodeMaterial({ map: tex, roughness: rough, metalness: 0, color: tex ? 0xffffff : 0x8a6a44 });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  mesh.position.set(...at);
  mesh.rotation.set(rx, ry, 0, 'YXZ');
  mesh.receiveShadow = true;
  return {
    mesh,
    dispose() {
      mesh.geometry.dispose();
      mat.dispose();
      tex?.dispose();
    },
  };
}

const browser = () => typeof document !== 'undefined';

// a common room put together: the house’s own parts made into the kit, the
// shared ones round them, the doors (the Floo, the bed, the board), the ghost
export function commonRoom(spec) {
  function build(rt, ctx = {}) {
    const tier = ctx.tier ?? rt?.quality?.tier ?? 'high';
    const house = ctx.house ?? null;
    const renderer = ctx.renderer ?? rt?.gfx?.renderer ?? null;
    const props = ctx.props ?? {};
    const tell = ctx.tell ?? (() => {});
    const toast = (text) => tell('toast', { text });
    const group = new THREE.Group();
    group.name = `room:${spec.id}`;
    const kit = createRoomKit({ house, tier });
    const parts = spec.make(kit, { tier, renderer, props, group, rt }) ?? {};
    const statics = kit.build(group);
    const live = [...(parts.live ?? [])];
    const fires = (parts.fires ?? []).map((f) => createFire({ tier, ...f }));
    for (const f of fires) group.add(f.group);
    const flats = [];
    let notices = props.notices ?? NOTICES;
    let board = null;
    if (browser() && parts.board) {
      board = flat(paintBoard(notices), { renderer, ...parts.board });
      flats.push(board);
      group.add(board.mesh);
    }
    if (browser() && parts.rug) {
      const r = flat(paintRug(parts.rug.colours), { renderer, w: parts.rug.r * 2, h: parts.rug.r * 2, at: parts.rug.at, rx: -Math.PI / 2 });
      flats.push(r);
      group.add(r.mesh);
    }
    for (const f of parts.flats ?? []) {
      flats.push(f);
      group.add(f.mesh);
    }
    const [sky, ground, k] = spec.light?.hemi ?? [0xffe0c0, 0x30281e, 0.9];
    group.add(new THREE.HemisphereLight(sky, ground, k));
    const points = { low: 0, mid: 2, high: 4, ultra: 6 }[tier] ?? 3;
    for (const [x, y, z, colour, power] of (spec.light?.points ?? []).slice(0, points)) {
      const l = new THREE.PointLight(colour, power, 14, 1.6);
      l.position.set(x, y, z);
      group.add(l);
    }
    // the house ghost on its loop
    const ghostName = spec.ghost ?? GHOSTS[spec.house];
    const ghost = ghostName && spec.ghostPath ? createGhost(ghostName, { rt, path: spec.ghostPath, seed: 3 }) : null;
    if (ghost) group.add(ghost.group);
    house?.adopt?.(group);
    let gone = false;
    let env = null;
    roomEnv(renderer)
      .then((tex) => {
        if (gone) return tex?.dispose();
        env = tex;
        const mats = new Set();
        group.traverse((o) => o.material && [o.material].flat().forEach((m) => mats.add(m)));
        wearEnv([...mats].filter((m) => m.metalness > 0.3), env, 1);
      })
      .catch(() => {});

    let slept = false;
    const doors = [
      ...(spec.floo ? [{ id: 'floo', at: spec.floo, r: 1.4, verb: 'Look into', name: 'The Floo', act: () => toast(FLOO) }] : []),
      ...(spec.bed ? [{ id: 'bed', at: spec.bed, r: 1.4, verb: 'Sleep', name: spec.bedName ?? 'Your four-poster', act: () => {
        // (the term’s lane moves the week on; until then the night passes and says so)
        tell('sleep', { house: spec.house ?? null });
        toast(slept ? 'You sleep again. Nobody wakes you this time either.' : 'You sleep. The castle creaks, the fire burns down, and the morning comes.');
        slept = true;
      } }] : []),
      ...(spec.boardAt ? [{ id: 'board', at: spec.boardAt, r: 1.6, verb: 'Read', name: 'The notice board', act: () => {
        // (the newest notice read out; the rest are there on the board to read)
        toast(`${notices[0].title}: ${notices[0].text}`);
      } }] : []),
      ...(parts.doors ?? []),
    ];
    const room = {
      id: spec.id,
      name: spec.name,
      group,
      statics,
      spawn: spec.spawn,
      colliders: spec.colliders ?? [],
      bounds: spec.bounds,
      floorAt: spec.floorAt ?? (() => 0),
      doors,
      places: spec.places ?? [],
      poses: spec.poses ?? {},
      step(dt, c = {}) {
        for (const f of fires) f.step(dt);
        for (const l of live) l.step?.(dt, c);
        const said = ghost?.step(dt, c.at);
        if (said) tell('line', said);
      },
      // (a new week’s notices, from the term’s lane: the board painted again)
      set(p = {}) {
        if (!p.notices?.length || p.notices === notices) return;
        notices = p.notices;
        if (!board || !browser()) return;
        const tex = canvasTexture(paintBoard(notices), renderer, { wrap: false });
        tex.colorSpace = THREE.SRGBColorSpace;
        board.mesh.material.map?.dispose();
        board.mesh.material.map = tex;
        board.mesh.material.needsUpdate = true;
      },
      info: () => ({ ...countOf(group) }),
      dispose() {
        gone = true;
        env?.dispose();
        for (const f of fires) f.dispose();
        for (const f of flats) f.dispose();
        for (const l of live) l.dispose?.();
        ghost?.dispose();
        kit.dispose();
        group.removeFromParent();
      },
    };
    return room;
  }
  return { id: spec.id, name: spec.name, build };
}
