// One spread of the book in 3D: its ground (the page itself, painted, with
// the land at the reader’s edge, ./scenes), its moon-letters, and its
// pop-up: the painted flats that stand across both pages like a toy
// theatre’s scenery, back to front (`kind: 'flat'`, split at the gutter so
// each half folds with its page), the figures and things cut out to stand
// among them (`card`), and the lights (`glow`). Each stands on a hinge at its
// foot as the spread opens (./popup.js), with a soft shadow on the page
// behind it. The left page’s things and the right’s are two groups, for the
// book’s halves (./book3d.js) to carry; both have their origin at the spine
// on the page’s face, x across (the left page negative), z toward the reader.
//
//   buildSpread(index, kit) → { index, page, left, right, pickable, set(open),
//     tick(dt, vision), act(piece, does) → what it told, pieceOf(id), dispose() }
//   kit: { mats, size (the tier’s scale for canvases) }
//
// A piece: { id, kind, at: [x, z], h (metres), w (else h × its art’s
// aspect), y (its foot over the page), turn, lift (0 rises first, 1 last),
// fold ('in' toward the reader, else back), art ({ outline, draw, aspect }:
// ../figures.js, ../props.js), toy, does, ghost, find, soft, low, hidden,
// shadow (false for none) }.
//
// The acts (a toy’s `does`, ./scenes): hop, sway, swing, knock, sniff,
// creep, raise, tear, stare, thud (a shake), fly, sail, rise (a card that
// comes up from the page and goes back), light (glows on or off), show (a
// hidden card shown, for a while or for good), chain (glows lit one after
// another), shine (a card lifted toward light), burst (a firework),
// tentacle (the Watcher’s arm), speak (the page asks for the word).

import * as THREE from 'three';
import { brush, cutout, rand } from './brush';
import { rise } from './popup';
import { BACK, PAGES } from './pages';
import { BACK_SCENES, SCENES } from './scenes/index';
import { canvasMap } from './mats';
import { makeCanvas } from '../../../lib/paint';
import { uniform } from 'three/tsl';

export const PW = 0.24; // a page’s width, m
export const PD = 0.33; // its depth
const LIFT = 0.0006; // the ground over the block, the letters over the ground
const DENSE = 4200; // a cut-out’s pixels a metre: crisp at the book’s distance
const WIDE = 2300; // a flat’s, which is seen whole and from further
const CAP = { flat: 1024, card: 512 };

// a page’s plane, lying on its face, with its UVs the spread’s half
export function halfGeometry(side, { segments = 1 } = {}) {
  const g = new THREE.PlaneGeometry(PW, PD, segments, 1);
  g.rotateX(-Math.PI / 2);
  g.translate(side < 0 ? -PW / 2 : PW / 2, 0, 0);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setX(i, side < 0 ? uv.getX(i) * 0.5 : 0.5 + uv.getX(i) * 0.5);
  return g;
}

// the size a piece’s canvas is painted at, for the tier
export function canvasSize(kind, w, h, size = 1) {
  const d = (kind === 'flat' ? WIDE : DENSE) * size;
  const cap = Math.round((CAP[kind] ?? 512) * Math.max(0.5, size));
  const k = Math.min(1, cap / Math.max(w * d, h * d));
  return [Math.max(32, Math.round(w * d * k)), Math.max(32, Math.round(h * d * k))];
}

// the margins’ moon-letters: runes in the Angerthas’ manner, stems and
// branches, round the edges of both pages and a line across the foot
function moonLetters(w, h, seed) {
  const canvas = makeCanvas(w, h);
  const ctx = canvas.getContext('2d');
  const r = rand(seed);
  ctx.strokeStyle = '#ffffff';
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(1, w * 0.0025);
  const rune = (x, y, s) => {
    ctx.beginPath();
    ctx.moveTo(x * w, y * h);
    ctx.lineTo(x * w, (y + s) * h);
    const n = 1 + Math.floor(r() * 3);
    for (let i = 0; i < n; i++) {
      const at = y + s * (0.15 + r() * 0.6);
      const dir = r() < 0.5 ? -1 : 1;
      ctx.moveTo(x * w, at * h);
      ctx.lineTo((x + dir * s * 0.35 * (h / w)) * w, (at + (r() < 0.5 ? -1 : 1) * s * 0.3) * h);
    }
    ctx.stroke();
  };
  const s = 0.03;
  for (const x0 of [0.03, 0.53]) for (let x = x0; x < x0 + 0.42; x += 0.017) rune(x, 0.94, s);
  for (const x of [0.012, 0.985]) for (let y = 0.22; y < 0.88; y += 0.05) rune(x, y, s * 0.8);
  return canvas;
}

// the soft shadow a standing card lays on the page behind it
function shadowCanvas() {
  const c = makeCanvas(64, 32);
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 32);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(0.75, 'rgba(0,0,0,0.55)');
  g.addColorStop(1, 'rgba(0,0,0,0.9)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 32);
  // (soft at its ends too)
  const e = ctx.createLinearGradient(0, 0, 64, 0);
  e.addColorStop(0, 'rgba(0,0,0,1)');
  e.addColorStop(0.18, 'rgba(0,0,0,0)');
  e.addColorStop(0.82, 'rgba(0,0,0,0)');
  e.addColorStop(1, 'rgba(0,0,0,1)');
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = e;
  ctx.fillRect(0, 0, 64, 32);
  return c;
}

export function buildSpread(index, { mats, size = 1 }) {
  const back = index >= PAGES.length;
  const page = back ? { ...BACK[index - PAGES.length], date: '' } : PAGES[index];
  const scene = back ? BACK_SCENES[page.id] : SCENES[page.id];
  const pieces = back ? [] : scene.pieces;
  const made = [];
  const keep = (x) => (made.push(x), x);

  // the ground: the page, its border, the land at its foot
  const gw = Math.round(1024 * size);
  const gh = Math.round((gw * PD) / (PW * 2));
  const ground = makeCanvas(gw, gh);
  scene.ground(brush(ground.getContext('2d'), gw, gh, { seed: 5 + index, ppm: gw / (PW * 2) }), page);
  const groundMap = keep(canvasMap(ground, { aniso: 8 }));
  const groundMat = mats.lit({ map: groundMap, roughness: 0.95 });
  const moonMap = back ? null : keep(canvasMap(moonLetters(Math.round(gw / 2), Math.round(gh / 2), 31 + index)));
  const moonMat = moonMap ? mats.moon(moonMap) : null;
  const shadowMap = keep(canvasMap(shadowCanvas()));

  const left = new THREE.Group();
  const right = new THREE.Group();
  const halves = { left, right };
  const sideGeo = { left: keep(halfGeometry(-1)), right: keep(halfGeometry(1)) };
  const moonMeshes = [];
  for (const [name, half] of Object.entries(halves)) {
    const g = new THREE.Mesh(sideGeo[name], groundMat);
    g.position.y = LIFT;
    g.userData.ground = name;
    half.add(g);
    if (moonMat) {
      const m = new THREE.Mesh(sideGeo[name], moonMat);
      m.position.y = LIFT * 2;
      m.visible = false;
      m.renderOrder = 2;
      half.add(m);
      moonMeshes.push(m);
    }
  }

  // the pieces: one part for a card, two for a flat across the gutter
  const byId = new Map();
  const pickable = [];
  const shadows = [];
  pieces.forEach((spec, order) => {
    const flat = spec.kind === 'flat';
    const h = spec.h ?? spec.size ?? 0.05;
    const w = spec.w ?? (spec.art?.aspect ? h * spec.art.aspect : h);
    const state = { spec, w, h, parts: [], mat: null, anim: [], on: Boolean(spec.on), level: spec.on ? 1 : 0, shown: !spec.hidden, showFor: 0, shine: null, chain: [] };
    if (spec.kind === 'glow') {
      const mat = mats.glow(spec.colour, 0);
      const sprite = new THREE.Sprite(mat);
      sprite.scale.setScalar(spec.size);
      const hinge = new THREE.Object3D();
      hinge.position.set(spec.at[0], spec.y ?? 0, spec.at[1]);
      hinge.add(sprite);
      (spec.at[0] < 0 ? left : right).add(hinge);
      state.parts.push({ hinge, mesh: sprite, base: hinge.position.clone() });
      state.mat = mat;
    } else {
      const [px, ph] = canvasSize(flat ? 'flat' : 'card', w, h, size);
      const canvas = cutout(px, ph, spec.art, { ppm: px / w, seed: 3 + order, margin: flat ? 0.0015 : 0.0011 });
      const map = keep(canvasMap(canvas, { aniso: flat ? 8 : 4 }));
      state.shine = spec.does?.some((d) => d.act === 'shine') ? uniform(0) : null;
      const mat = spec.ghost ? mats.ghost(map) : mats.card(map, { soft: spec.soft, shine: state.shine });
      state.mat = mat;
      const x0 = spec.at[0] - w / 2;
      const x1 = spec.at[0] + w / 2;
      const spans = flat && x0 < 0 && x1 > 0 ? [[x0, 0], [0, x1]] : [[x0, x1]];
      for (const [a, z] of spans) {
        const geo = keep(new THREE.PlaneGeometry(z - a, h));
        geo.translate(flat ? (a + z) / 2 : 0, h / 2, 0);
        const uv = geo.attributes.uv;
        for (let i = 0; i < uv.count; i++) uv.setX(i, (a - x0) / w + uv.getX(i) * ((z - a) / w));
        const hinge = new THREE.Object3D();
        hinge.rotation.order = 'YXZ';
        hinge.position.set(flat ? 0 : spec.at[0], spec.y ?? 0, spec.at[1]);
        hinge.rotation.y = spec.turn ?? 0;
        const mesh = new THREE.Mesh(geo, mat);
        // (the flats behind first, so the soft and the see-through blend over them)
        mesh.renderOrder = spec.ghost ? 3 : spec.soft ? 1 : 0;
        // (a card that comes up from the page starts below it)
        if (spec.low) mesh.position.y = -h * 0.55;
        mesh.userData.piece = spec.id;
        hinge.add(mesh);
        const half = (flat ? (a + z) / 2 : spec.at[0]) < 0 ? left : right;
        half.add(hinge);
        state.parts.push({ hinge, mesh, base: hinge.position.clone() });
        if (spec.toy || spec.find) pickable.push(mesh);
        // its shadow on the page, behind its foot
        if (!spec.ghost && !spec.soft && spec.shadow !== false && !spec.y) {
          const sw = (z - a) * 1.08;
          const sd = Math.min(0.05, h * 0.42);
          const sgeo = keep(new THREE.PlaneGeometry(sw, sd));
          sgeo.rotateX(-Math.PI / 2);
          const sm = mats.shade(shadowMap);
          const s = new THREE.Mesh(sgeo, sm);
          const sx = flat ? (a + z) / 2 : spec.at[0];
          s.position.set(sx, LIFT * 3, spec.at[1] - sd / 2);
          s.rotation.y = spec.turn ?? 0;
          s.renderOrder = 1;
          half.add(s);
          shadows.push({ state, mesh: s, mat: sm });
        }
      }
    }
    byId.set(spec.id, state);
  });

  // fireworks: a few sparks, kept and reused
  const sparks = [];
  const sparkGroup = new THREE.Group();
  right.add(sparkGroup);

  let open = 0;
  let vision = 0;
  const set = (o) => {
    open = o;
  };

  const act = (state, d) => {
    const told = [];
    if (['hop', 'sway', 'swing', 'knock', 'sniff', 'creep', 'raise', 'tear', 'stare', 'thud', 'fly', 'sail', 'rise'].includes(d.act)) state.anim.push({ act: d.act, t: 0 });
    if (d.act === 'light' || d.act === 'show' || d.act === 'chain')
      (d.target ?? []).forEach((id, i) => {
        const x = byId.get(id);
        if (!x) return;
        if (d.act === 'light') x.on = !x.on;
        else if (d.act === 'chain') x.chain.push(i * 0.45);
        else {
          x.shown = true;
          x.showFor = d.for ?? 0;
        }
      });
    if (d.act === 'shine') state.anim.push({ act: 'shine', t: 0 });
    if (d.act === 'tentacle') {
      const x = byId.get('tentacle');
      if (x) {
        x.shown = true;
        x.showFor = 3;
        x.anim.push({ act: 'rise', t: 0 });
      }
    }
    if (d.act === 'burst') {
      const at = new THREE.Vector3();
      state.parts[0].mesh.getWorldPosition(at);
      sparkGroup.worldToLocal(at);
      for (let i = 0; i < 36; i++) {
        let s = sparks.find((x) => x.life <= 0);
        if (!s) {
          if (sparks.length >= 72) break;
          const sprite = new THREE.Sprite(mats.glow(d.colour ?? '#ffe08a', 0));
          sprite.scale.setScalar(0.01);
          sparkGroup.add(sprite);
          s = { sprite, v: new THREE.Vector3(), life: 0 };
          sparks.push(s);
        }
        const a = (i / 36) * Math.PI * 2;
        const up = 0.3 + Math.sin(i * 1.7) * 0.25;
        s.sprite.position.copy(at).y += 0.06;
        s.v.set(Math.cos(a) * 0.14, up, Math.sin(a) * 0.1);
        s.life = 1.8;
        s.sprite.material.color.set(i % 3 ? (d.colour ?? '#ffe08a') : '#fff6d0');
      }
    }
    if (d.act === 'speak' || d.act === 'thud' || d.act === 'knock') told.push(d.act);
    return told;
  };

  const tick = (dt, v) => {
    vision = v;
    for (const m of moonMeshes) m.visible = vision > 0.01;
    for (const st of byId.values()) {
      const { spec } = st;
      // the stand: its rise with the spread’s opening
      const r = rise(open, spec.lift ?? 0.5);
      st.r = r;
      // shown for a while, then hidden again
      if (st.showFor > 0 && (st.showFor -= dt) <= 0) {
        st.showFor = 0;
        st.shown = false;
      }
      const ghostSeen = !spec.ghost || vision > 0.02;
      if (spec.kind === 'glow') {
        // a glow: toward on or off, flickering if it’s a flame
        for (let i = st.chain.length - 1; i >= 0; i--)
          if ((st.chain[i] -= dt) <= 0) {
            st.on = true;
            st.chain.splice(i, 1);
          }
        st.level += ((st.on ? 1 : 0) - st.level) * Math.min(1, dt * 4);
        const flicker = spec.flicker ? 0.82 + 0.18 * Math.sin(performance.now() * 0.013 + spec.at[0] * 40) * Math.sin(performance.now() * 0.007) : 1;
        st.mat.opacity = st.level * flicker * r;
        st.parts[0].mesh.visible = st.mat.opacity > 0.01;
      }
      const into = spec.fold === 'in' ? 1 : -1;
      let shine = 0;
      // the toys’ acts, worked out once, worn by every part
      let dx = 0;
      let dy = 0;
      let dz = 0;
      let rz = 0;
      let rx = 0;
      let sx = 1;
      let sy = 1;
      for (let i = st.anim.length - 1; i >= 0; i--) {
        const a = st.anim[i];
        a.t += dt;
        const k = a.t;
        const done = (len) => k >= len && st.anim.splice(i, 1);
        if (a.act === 'hop') {
          dy += Math.sin(Math.min(1, k / 0.45) * Math.PI) * 0.02;
          done(0.45);
        } else if (a.act === 'sway' || a.act === 'swing' || a.act === 'knock' || a.act === 'thud') {
          const amp = a.act === 'swing' ? 0.35 : a.act === 'knock' || a.act === 'thud' ? 0.04 : 0.1;
          const len = a.act === 'knock' || a.act === 'thud' ? 0.5 : 1.4;
          rz = Math.sin(k * (a.act === 'swing' ? 7 : 18)) * amp * (1 - k / len);
          done(len);
        } else if (a.act === 'sniff') {
          rx += Math.sin(Math.min(1, k / 1.6) * Math.PI) * 0.25 * (1 + Math.sin(k * 20) * 0.2);
          done(1.6);
        } else if (a.act === 'creep') {
          const s = Math.sin(Math.min(1, k / 2.4) * Math.PI);
          dx -= Math.sign(spec.at[0] || 1) * 0.02 * s;
          dz -= 0.012 * s;
          done(2.4);
        } else if (a.act === 'raise' || a.act === 'stare') {
          const s = Math.sin(Math.min(1, k / 1.8) * Math.PI);
          sx = 1 + s * 0.06;
          sy = 1 + s * 0.1;
          done(1.8);
        } else if (a.act === 'tear') {
          const s = k < 0.4 ? 1 - k / 0.4 : k > 3.6 ? (k - 3.6) / 0.4 : 0;
          sx = Math.max(0.001, s);
          sy = Math.max(0.001, s);
          done(4);
        } else if (a.act === 'fly') {
          const s = Math.min(1, k / 3);
          const arc = Math.sin(s * Math.PI);
          dx += arc * 0.12 * (spec.at[0] < 0 ? 1 : -1);
          dy += arc * 0.08;
          done(3);
        } else if (a.act === 'sail') {
          const s = Math.min(1, k / 5);
          const out = Math.sin(s * Math.PI);
          dz -= out * 0.07;
          sx = sy = 1 - out * 0.4;
          done(5);
        } else if (a.act === 'rise') {
          dy += Math.sin(Math.min(1, k / 3) * Math.PI) * (st.h * 0.55);
          done(3);
        } else if (a.act === 'shine') {
          shine = Math.max(shine, Math.sin(Math.min(1, k / 2) * Math.PI) * 1.4);
          done(2);
        }
      }
      if (st.shine) st.shine.value = shine;
      if (spec.kind === 'glow') {
        const p = st.parts[0];
        p.hinge.position.set(p.base.x + dx, p.base.y + dy, p.base.z + dz);
        continue;
      }
      for (const p of st.parts) {
        p.hinge.position.set(p.base.x + dx, p.base.y + dy, p.base.z + dz);
        p.hinge.rotation.x = into * (1 - r) * (Math.PI / 2) + rx;
        p.mesh.rotation.z = rz;
        p.mesh.scale.set(sx, sy, 1);
        p.mesh.visible = st.shown && ghostSeen && r > 0.02;
      }
    }
    for (const s of shadows) {
      s.mat.opacity = (s.state.r ?? 0) ** 2 * 0.5 * (s.state.shown ? 1 : 0);
      s.mesh.visible = s.mat.opacity > 0.01;
    }
    for (const s of sparks) {
      if (s.life <= 0) continue;
      s.life -= dt;
      s.v.y -= 0.35 * dt;
      s.sprite.position.addScaledVector(s.v, dt * 0.5);
      s.sprite.material.opacity = Math.max(0, Math.min(1, s.life));
      s.sprite.visible = s.life > 0;
    }
  };

  return {
    index,
    page,
    left,
    right,
    pickable,
    groundMat,
    set,
    tick,
    pieceOf: (id) => byId.get(id) ?? null,
    act(id, does = []) {
      const st = byId.get(id);
      if (!st) return [];
      return does.flatMap((d) => act(st, d));
    },
    // the spread’s things, for the module’s info and the tests
    get count() {
      return byId.size;
    },
    dispose() {
      for (const x of made) x.dispose();
      for (const st of byId.values()) st.mat?.dispose?.();
      for (const s of shadows) s.mat.dispose();
      for (const s of sparks) s.sprite.material.dispose();
      groundMat.dispose();
      moonMat?.dispose();
      left.removeFromParent();
      right.removeFromParent();
    },
  };
}
