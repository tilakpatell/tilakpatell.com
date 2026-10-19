// One spread of the book in 3D: its ground (the land painted flat across
// both pages, ./scenes), its moon-letters, and its pop-up’s pieces, each a
// card hinged at its foot that stands as the spread opens (./popup.js) or
// a glow. The left page’s things and the right’s are two groups, for the
// book’s two halves (./book3d.js) to carry; both have their origin at the
// spine on the page’s face, x across (the left page negative), z toward
// the reader.
//
//   buildSpread(index, kit) → { index, page, left, right, ground, pieces, set(open),
//     tick(dt, vision), act(piece, does) → what it told, pick targets, dispose() }
//   kit: { mats, size (the tier’s scale for canvases), emit(type, data) }
//
// The acts (a toy’s `does`, ./scenes): hop, sway, swing, knock, sniff,
// creep, raise, tear, stare, thud (a shake), fly, sail, rise (a card that
// comes up from the page and goes back), light (glows on or off), show (a
// hidden card shown, for a while or for good), chain (glows lit one after
// another), shine (a card lifted toward light), burst (a firework),
// tentacle (the Watcher’s arm), speak (the page asks for the word).

import * as THREE from 'three';
import { card as cutCard, pen, rand, sheet } from './paint';
import { rise } from './popup';
import { BACK, PAGES } from './pages';
import { BACK_SCENES, SCENES } from './scenes/index';
import { canvasMap } from './mats';
import { makeCanvas } from '../../../lib/paint';
import { uniform } from 'three/tsl';

export const PW = 0.24; // a page’s width, m
export const PD = 0.33; // its depth
const LIFT = 0.0006; // the ground over the block, the letters over the ground

// a page’s plane, lying on its face, with its UVs the spread’s half
export function halfGeometry(side, { segments = 1 } = {}) {
  const g = new THREE.PlaneGeometry(PW, PD, segments, 1);
  g.rotateX(-Math.PI / 2);
  g.translate(side < 0 ? -PW / 2 : PW / 2, 0, 0);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setX(i, side < 0 ? uv.getX(i) * 0.5 : 0.5 + uv.getX(i) * 0.5);
  return g;
}

// the margins’ moon-letters: runes in the Angerthas’ manner, stems and
// branches, round the edges of both pages and a line across the foot
function moonLetters(w, h, seed) {
  const canvas = makeCanvas(w, h);
  const ctx = canvas.getContext('2d');
  const p = pen(ctx, w, h, seed);
  const r = rand(seed);
  const rune = (x, y, s) => {
    const pts = [[x, y], [x, y + s]];
    p.line(pts, { width: 0.0025, colour: '#ffffff', alpha: 1 });
    const n = 1 + Math.floor(r() * 3);
    for (let i = 0; i < n; i++) {
      const at = y + s * (0.15 + r() * 0.6);
      const dir = r() < 0.5 ? -1 : 1;
      p.line([[x, at], [x + dir * s * 0.35 * (w > h ? h / w : 1), at + (r() < 0.5 ? -1 : 1) * s * 0.3]], { width: 0.0025, colour: '#ffffff', alpha: 1 });
    }
  };
  const s = 0.03;
  for (const x0 of [0.03, 0.53]) for (let x = x0; x < x0 + 0.42; x += 0.017) rune(x, 0.93, s);
  for (const x of [0.012, 0.985]) for (let y = 0.22; y < 0.88; y += 0.05) rune(x, y, s * 0.8);
  return canvas;
}

export function buildSpread(index, { mats, size = 1 }) {
  const back = index >= PAGES.length;
  const page = back ? { ...BACK[index - PAGES.length], date: '' } : PAGES[index];
  const scene = back ? BACK_SCENES[page.id] : SCENES[page.id];
  const pieces = back ? [] : scene.pieces;
  const made = [];
  const keep = (x) => (made.push(x), x);

  // the ground: the land, the heading, the gutter
  const gw = Math.round(1024 * size);
  const gh = Math.round((gw * PD) / (PW * 2));
  const ground = sheet(gw, gh, 11 + index, { edge: 0.28 });
  scene.ground(pen(ground.getContext('2d'), gw, gh, 5 + index), page);
  const groundMap = keep(canvasMap(ground, { aniso: 8 }));
  const groundMat = mats.lit({ map: groundMap, roughness: 0.95 });
  const moonMap = back ? null : keep(canvasMap(moonLetters(Math.round(gw / 2), Math.round(gh / 2), 31 + index)));
  const moonMat = moonMap ? mats.moon(moonMap) : null;

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

  // the pieces
  const byId = new Map();
  const pickable = [];
  for (const spec of pieces) {
    const half = spec.at[0] < 0 ? left : right;
    const hinge = new THREE.Object3D();
    hinge.rotation.order = 'YXZ';
    hinge.position.set(spec.at[0], spec.y ?? 0, spec.at[1]);
    hinge.rotation.y = spec.turn ?? 0;
    const state = { spec, hinge, mesh: null, mat: null, anim: [], on: Boolean(spec.on), level: spec.on ? 1 : 0, shown: !spec.hidden, showFor: 0, shine: null, base: hinge.position.clone(), chain: [] };
    if (spec.kind === 'glow') {
      const mat = mats.glow(spec.colour, 0);
      const sprite = new THREE.Sprite(mat);
      sprite.scale.setScalar(spec.size);
      hinge.add(sprite);
      state.mesh = sprite;
      state.mat = mat;
    } else {
      const px = Math.max(64, Math.round(spec.px * size));
      const ph = Math.max(32, Math.round((px * spec.h) / spec.w));
      const canvas = cutCard(px, ph, spec.art.outline, spec.art.draw, { seed: 3 + px });
      const map = keep(canvasMap(canvas));
      state.shine = spec.does?.some((d) => d.act === 'shine') ? uniform(0) : null;
      const mat = spec.ghost ? mats.ghost(map) : mats.card(map, { soft: spec.soft, shine: state.shine });
      const geo = keep(new THREE.PlaneGeometry(spec.w, spec.h));
      geo.translate(0, spec.h / 2, 0);
      const mesh = new THREE.Mesh(geo, mat);
      if (spec.ghost) mesh.renderOrder = 3;
      // (a card that comes up from the page starts below it)
      if (spec.low) mesh.position.y = -spec.h * 0.55;
      hinge.add(mesh);
      state.mesh = mesh;
      state.mat = mat;
    }
    state.mesh.userData.piece = spec.id;
    if (spec.toy || spec.find) pickable.push(state.mesh);
    half.add(hinge);
    byId.set(spec.id, state);
  }

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
      state.mesh.getWorldPosition(at);
      sparkGroup.worldToLocal(at);
      for (let i = 0; i < 28; i++) {
        let s = sparks.find((x) => x.life <= 0);
        if (!s) {
          if (sparks.length >= 56) break;
          const sprite = new THREE.Sprite(mats.glow(d.colour ?? '#ffe08a', 0));
          sprite.scale.setScalar(0.012);
          sparkGroup.add(sprite);
          s = { sprite, v: new THREE.Vector3(), life: 0 };
          sparks.push(s);
        }
        const a = (i / 28) * Math.PI * 2;
        const up = 0.3 + Math.sin(i * 1.7) * 0.25;
        s.sprite.position.copy(at).y += 0.06;
        s.v.set(Math.cos(a) * 0.12, up, Math.sin(a) * 0.12);
        s.life = 1.6;
        s.sprite.material.color.set(i % 3 ? d.colour ?? '#ffe08a' : '#fff6d0');
      }
    }
    if (d.act === 'speak' || d.act === 'thud' || d.act === 'knock') told.push(d.act);
    return told;
  };

  const tick = (dt, v) => {
    vision = v;
    for (const m of moonMeshes) m.visible = vision > 0.01;
    for (const st of byId.values()) {
      const { spec, hinge, mesh } = st;
      // the stand: its rise with the spread’s opening
      const r = rise(open, spec.lift ?? 0.5);
      if (spec.kind === 'card') hinge.rotation.x = -(1 - r) * (Math.PI / 2);
      // shown for a while, then hidden again
      if (st.showFor > 0 && (st.showFor -= dt) <= 0) {
        st.showFor = 0;
        st.shown = false;
      }
      const ghostSeen = !spec.ghost || vision > 0.02;
      // a glow: toward on or off, flickering if it’s a flame
      if (spec.kind === 'glow') {
        for (let i = st.chain.length - 1; i >= 0; i--)
          if ((st.chain[i] -= dt) <= 0) {
            st.on = true;
            st.chain.splice(i, 1);
          }
        st.level += ((st.on ? 1 : 0) - st.level) * Math.min(1, dt * 4);
        const flicker = spec.flicker ? 0.82 + 0.18 * Math.sin(performance.now() * 0.013 + spec.at[0] * 40) * Math.sin(performance.now() * 0.007) : 1;
        st.mat.opacity = st.level * flicker * r;
        mesh.visible = st.mat.opacity > 0.01;
      } else mesh.visible = st.shown && ghostSeen && r > 0.02;
      // the toys’ acts
      hinge.position.copy(st.base);
      mesh.rotation.z = 0;
      mesh.scale.set(1, 1, 1);
      let shine = 0;
      for (let i = st.anim.length - 1; i >= 0; i--) {
        const a = st.anim[i];
        a.t += dt;
        const k = a.t;
        const done = (len) => k >= len && st.anim.splice(i, 1);
        if (a.act === 'hop') {
          hinge.position.y += Math.sin(Math.min(1, k / 0.45) * Math.PI) * 0.02;
          done(0.45);
        } else if (a.act === 'sway' || a.act === 'swing' || a.act === 'knock' || a.act === 'thud') {
          const amp = a.act === 'swing' ? 0.35 : a.act === 'knock' || a.act === 'thud' ? 0.04 : 0.1;
          const len = a.act === 'knock' || a.act === 'thud' ? 0.5 : 1.4;
          mesh.rotation.z = Math.sin(k * (a.act === 'swing' ? 7 : 18)) * amp * (1 - k / len);
          done(len);
        } else if (a.act === 'sniff') {
          hinge.rotation.x += Math.sin(Math.min(1, k / 1.6) * Math.PI) * 0.25 * (1 + Math.sin(k * 20) * 0.2);
          done(1.6);
        } else if (a.act === 'creep') {
          const s = Math.sin(Math.min(1, k / 2.4) * Math.PI);
          hinge.position.x -= Math.sign(st.base.x || 1) * 0.02 * s;
          hinge.position.z -= 0.012 * s;
          done(2.4);
        } else if (a.act === 'raise' || a.act === 'stare') {
          const s = Math.sin(Math.min(1, k / 1.8) * Math.PI);
          mesh.scale.set(1 + s * 0.06, 1 + s * 0.1, 1);
          done(1.8);
        } else if (a.act === 'tear') {
          const s = k < 0.4 ? 1 - k / 0.4 : k > 3.6 ? (k - 3.6) / 0.4 : 0;
          mesh.scale.set(Math.max(0.001, s), Math.max(0.001, s), 1);
          done(4);
        } else if (a.act === 'fly') {
          const s = Math.min(1, k / 3);
          const arc = Math.sin(s * Math.PI);
          hinge.position.x += arc * 0.12 * (st.base.x < 0 ? 1 : -1);
          hinge.position.y += arc * 0.08;
          done(3);
        } else if (a.act === 'sail') {
          const s = Math.min(1, k / 5);
          const out = Math.sin(s * Math.PI);
          hinge.position.z -= out * 0.07;
          mesh.scale.setScalar(1 - out * 0.4);
          done(5);
        } else if (a.act === 'rise') {
          const s = Math.sin(Math.min(1, k / 3) * Math.PI);
          hinge.position.y += s * (spec.h * 0.55);
          done(3);
        } else if (a.act === 'shine') {
          shine = Math.max(shine, Math.sin(Math.min(1, k / 2) * Math.PI) * 1.4);
          done(2);
        }
      }
      if (st.shine) st.shine.value = shine;
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
      for (const s of sparks) s.sprite.material.dispose();
      groundMat.dispose();
      moonMat?.dispose();
      left.removeFromParent();
      right.removeFromParent();
    },
  };
}
