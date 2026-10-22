// The Owlery (the design’s §4.4): the round stone room at the top of the west
// tower, its windows open to the wind and glassless, the sky going by
// outside; ledges all the way up the walls with an owl on every stretch of
// them, each turning its head to keep you in sight (on the GPU, a snap at a
// time, as an owl’s head goes); Hedwig, white, on her own perch by the
// window; and the floor as the book has it, straw and droppings and the
// little grey pellets of mouse bones. At the table by the window, the post:
// write a line, an owl takes it, and a reply is on your common room’s board
// the morning after you’ve slept (rules/post.js, in the world’s save).
//
// TODO(hogwarts cast): the owls are a stand-in drawn here until Lane B’s owl
// (its props, B5) is in public/models/hogwarts; the head-turning stays.

import * as THREE from 'three';
import { MeshBasicNodeMaterial, MeshStandardNodeMaterial } from 'three/webgpu';
import { atan, attribute, cameraPosition, clamp, cos, floor, mix, mx_fractal_noise_float, normalGeometry, positionGeometry, sin, smoothstep, time, transformNormalToView, uv, vec3 } from 'three/tsl';
import { SAVE } from '../rules/save';
import { send, waiting } from '../rules/post';
import { commonRoom } from './common/shared';
import { table } from './parts/furniture';
import { instanced } from './kit';

const R = 5.6;
const H = 11;
const LEDGES = [2.4, 4.2, 6.0, 7.8];
const WINDOWS = [0.5, 2.2, 3.9, 5.5]; // the openings’ angles round the wall
const SILL = 1.1;
const TOP = 3.2; // the openings’ lintel over the floor
const HEDWIG = { t: 0.95, y: 1.9 };
const TAU = Math.PI * 2;
const OWL_COLOURS = ['#8a6a4a', '#6a5038', '#a08060', '#7a7066', '#b89a74', '#5a4a3a', '#9a8a7a', '#c8b090'];

const near = (t, list, w) => list.some((a) => Math.abs(((t - a + Math.PI * 3) % TAU) - Math.PI) < w);

// where the owls sit: along each ledge, clear of the window openings, facing the room
export function perches(tier = 'high') {
  const each = { low: 7, mid: 11, high: 15, ultra: 18 }[tier] ?? 14;
  const out = [];
  LEDGES.forEach((y, k) =>
    Array.from({ length: each }, (_, i) => {
      const t = ((i + (k % 2) * 0.5) / each) * TAU;
      // (the lowest ledge stands clear of the openings; above them the wall is whole)
      if (y < TOP + 0.4 && near(t, WINDOWS, 0.36)) return;
      const r = R - 0.32;
      out.push({ at: [Math.sin(t) * r, y + 0.12, Math.cos(t) * r], yaw: t + Math.PI, colour: OWL_COLOURS[(i * 3 + k * 5) % OWL_COLOURS.length] });
    }),
  );
  return out;
}

// an owl’s head (and its face) turned toward the camera about its own up, a snap at a time
function yawOf() {
  const o = attribute('aOwl', 'vec4');
  const to = cameraPosition.sub(vec3(o.x, o.y, o.z));
  let d = atan(to.x, to.z).sub(o.w);
  d = d.sub(floor(d.div(TAU).add(0.5)).mul(TAU));
  const snap = floor(clamp(d, -1.9, 1.9).div(0.32).add(0.5)).mul(0.32);
  return o.w.add(snap);
}
const spin = (p, yaw) => vec3(p.x.mul(cos(yaw)).add(p.z.mul(sin(yaw))), p.y, p.z.mul(cos(yaw)).sub(p.x.mul(sin(yaw))));
function turned() {
  const o = attribute('aOwl', 'vec4');
  return spin(positionGeometry, yawOf()).add(vec3(o.x, o.y, o.z));
}
// (its normals turned with it: left as they were, the side facing you shaded as its back)
const turnedNormal = () => transformNormalToView(spin(normalGeometry, yawOf()));

function owls(list, { hedwig }) {
  const group = new THREE.Group();
  const all = [...list, { ...hedwig, colour: '#f4f2ee', white: true }];
  const own = new Float32Array(all.length * 4);
  all.forEach((o, i) => own.set([o.at[0], o.at[1] + 0.4 * (o.s ?? 1), o.at[2], o.yaw], i * 4));
  const aOwl = new THREE.InstancedBufferAttribute(own, 4);
  // the body: an egg, folded wings either side, a short tail
  const parts = [new THREE.SphereGeometry(0.13, 10, 8).scale(1, 1.45, 0.95).translate(0, 0.17, 0)];
  for (const s of [-1, 1]) parts.push(new THREE.SphereGeometry(0.1, 8, 6).scale(0.35, 1.3, 0.95).translate(s * 0.11, 0.16, -0.02));
  parts.push(new THREE.ConeGeometry(0.06, 0.12, 6).rotateX(Math.PI).translate(0, 0.02, -0.08));
  const bodyGeo = mergeAll(parts);
  const bodyMat = new MeshStandardNodeMaterial({ color: 0xffffff, roughness: 0.95 });
  const bodies = instanced(bodyGeo, bodyMat, all.map((o) => ({ at: o.at, ry: o.yaw, s: o.s ?? 1 })), { colours: all.map((o) => o.colour) });
  // the head: round, a little flat-faced, the ear tufts on the tawny ones
  const headGeo = new THREE.SphereGeometry(0.095, 10, 8).scale(1.05, 0.95, 0.9);
  headGeo.setAttribute('aOwl', aOwl);
  const headMat = new MeshStandardNodeMaterial({ color: 0xffffff, roughness: 0.95 });
  headMat.positionNode = turned();
  headMat.normalNode = turnedNormal();
  const heads = instanced(headGeo, headMat, all.map(() => ({ at: [0, 0, 0] })), { colours: all.map((o) => o.colour) });
  heads.frustumCulled = false;
  // the face: two eyes and the beak, on the head’s front (dark; Hedwig’s amber)
  const face = mergeAll([
    new THREE.SphereGeometry(0.024, 8, 6).translate(-0.04, 0.012, 0.075),
    new THREE.SphereGeometry(0.024, 8, 6).translate(0.04, 0.012, 0.075),
    new THREE.ConeGeometry(0.014, 0.04, 5).rotateX(Math.PI / 2 + 0.5).translate(0, -0.02, 0.088),
  ]);
  face.setAttribute('aOwl', aOwl);
  const faceMat = new MeshBasicNodeMaterial({ color: 0xffffff });
  faceMat.positionNode = turned();
  const faces = instanced(face, faceMat, all.map(() => ({ at: [0, 0, 0] })), { colours: all.map((o) => (o.white ? '#e8b030' : '#140e08')) });
  faces.frustumCulled = false;
  group.add(bodies, heads, faces);
  return {
    group,
    count: all.length,
    dispose() {
      for (const g of [bodyGeo, headGeo, face]) g.dispose();
      for (const m of [bodyMat, headMat, faceMat]) m.dispose();
    },
  };
}

function mergeAll(geos) {
  const out = new THREE.BufferGeometry();
  const pos = [];
  const nor = [];
  for (const g of geos) {
    const n = g.index ? g.toNonIndexed() : g;
    pos.push(...n.attributes.position.array);
    nor.push(...n.attributes.normal.array);
    if (n !== g) n.dispose();
    g.dispose();
  }
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return out;
}

// the sky through the openings: night’s blue going up into stars, cloud moving across
function skyMaterial() {
  const m = new MeshBasicNodeMaterial({ side: THREE.BackSide, fog: false });
  m.userData.noHouse = true;
  const y = uv().y;
  const cloud = smoothstep(0.55, 0.8, mx_fractal_noise_float(vec3(uv().x.mul(9).add(time.mul(0.01)), y.mul(4), 2), 4).mul(0.5).add(0.5));
  const stars = smoothstep(0.985, 1.0, mx_fractal_noise_float(vec3(uv().mul(260), 1), 1).mul(0.5).add(0.5)).mul(smoothstep(0.5, 0.75, y));
  m.colorNode = mix(vec3(0.16, 0.2, 0.32), vec3(0.03, 0.04, 0.1), smoothstep(0.45, 0.85, y)).mul(cloud.mul(0.6).add(0.7)).add(stars.mul(1.4));
  return m;
}

export default commonRoom({
  id: 'owlery',
  name: 'The Owlery',
  bounds: { x0: -R + 0.7, x1: R - 0.7, z0: -R + 0.7, z1: R - 0.7 },
  colliders: [
    { kind: 'circle', at: [Math.sin(WINDOWS[1]) * (R - 1.2), Math.cos(WINDOWS[1]) * (R - 1.2)], r: 0.8 },
    { kind: 'circle', at: [Math.sin(HEDWIG.t) * (R - 0.9), Math.cos(HEDWIG.t) * (R - 0.9)], r: 0.45 },
  ],
  spawn: { at: [-1.6, 0, -1.6], yaw: Math.PI - 0.7 },
  places: [{ id: 'owlery', name: 'The Owlery', at: [0, 0], r: 6 }],
  light: { hemi: [0xc8d4ec, 0x3a342a, 1.55], points: [[0, 4, 0, 0xe8e0d0, 6], [Math.sin(WINDOWS[1]) * 3, 2, Math.cos(WINDOWS[1]) * 3, 0xffc890, 4]] },
  poses: {
    owls: { at: [0, 1.6, 0], look: [Math.sin(0.4) * R, 5.2, Math.cos(0.4) * R] },
    hedwig: { at: [Math.sin(HEDWIG.t) * 2.4, 1.7, Math.cos(HEDWIG.t) * 2.4], look: [Math.sin(HEDWIG.t) * R, 2.2, Math.cos(HEDWIG.t) * R] },
    up: { at: [0, 1.4, -2.2], look: [0, H, 0.6] },
  },
  make(kit, { group, rt, tell, toast }) {
    const tier = rt?.quality?.tier ?? 'high';
    // the tower’s wall, open at the windows from the sill to the lintel
    const segs = 32;
    const run = TAU / segs;
    const len = 2 * (R + 0.35) * Math.tan(run / 2) + 0.05;
    for (let i = 0; i < segs; i++) {
      const a = (i + 0.5) * run;
      const [x, z] = [Math.sin(a) * (R + 0.35), Math.cos(a) * (R + 0.35)];
      if (near(a, WINDOWS, 0.2)) {
        kit.box('stone', x, 0, z, len, SILL, 0.7, { ry: a });
        kit.box('stone', x, TOP, z, len, H - TOP, 0.7, { ry: a });
      } else kit.box('stone', x, 0, z, len, H, 0.7, { ry: a });
    }
    kit.cyl('flags', 0, -0.3, 0, R + 0.7, R + 0.7, 0.3, { seg: 32 });
    // the conical roof’s timbers, open to the dark above
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      kit.box('darkoak', Math.sin(a) * (R / 2), H + 1.6, Math.cos(a) * (R / 2), 0.25, 0.25, R + 0.6, { ry: a, rx: 0.55 });
    }
    kit.cyl('slate', 0, H, 0, R + 0.8, 0.3, 4.2, { seg: 24, open: true });
    // the ledges, all the way up, and a crossed perch or two
    // (each a ring of blocks standing out from the wall: a solid disc would be a ceiling over the room)
    for (const y of LEDGES)
      for (let i = 0; i < segs; i++) {
        const a = (i + 0.5) * run;
        if (y < TOP && near(a, WINDOWS, 0.2)) continue;
        kit.box('stonedark', Math.sin(a) * (R - 0.2), y - 0.1, Math.cos(a) * (R - 0.2), 2 * (R - 0.2) * Math.tan(run / 2) + 0.03, 0.12, 0.42, { ry: a });
      }
    for (const [a, y] of [[0.3, 5.1], [2.0, 6.9]]) kit.box('darkoak', 0, y, 0, 0.1, 0.1, R * 2 - 0.2, { ry: a });
    // Hedwig’s own perch by the window, a post and a crossbar
    const hx = Math.sin(HEDWIG.t) * (R - 0.9);
    const hz = Math.cos(HEDWIG.t) * (R - 0.9);
    kit.cyl('darkoak', hx, 0, hz, 0.05, 0.07, HEDWIG.y, { seg: 8 });
    kit.box('darkoak', hx, HEDWIG.y, hz, 0.6, 0.06, 0.06, { ry: HEDWIG.t });
    // the post table by the window: parchment, ink, a quill
    const ta = WINDOWS[1];
    const tx = Math.sin(ta) * (R - 1.2);
    const tz = Math.cos(ta) * (R - 1.2);
    table(kit, { at: [tx, 0, tz], ry: ta, len: 1.2, w: 0.7, top: 0.78, mat: 'oak' });
    kit.box(kit.paint('#e8dcc0', { rough: 0.9 }), tx, 0.8, tz, 0.4, 0.01, 0.3, { ry: ta + 0.2 });
    kit.cyl(kit.paint('#101418', { rough: 0.2 }), tx + 0.25, 0.8, tz - 0.1, 0.04, 0.04, 0.07, { seg: 8 });
    // the floor: straw, droppings, and the pellets of bones
    const rnd = (() => {
      let s = 77;
      return () => ((s = (s * 16807) % 2147483647) / 2147483647);
    })();
    const strewn = (n, f) => Array.from({ length: n }, () => {
      const r = Math.sqrt(rnd()) * (R - 0.4);
      const t = rnd() * TAU;
      return f(Math.sin(t) * r, Math.cos(t) * r);
    });
    const straw = strewn(tier === 'low' ? 200 : 700, (x, z) => ({ at: [x, 0.01, z], ry: rnd() * TAU, rz: Math.PI / 2, s: [1, 0.12 + rnd() * 0.2, 1] }));
    const strawGeo = new THREE.CylinderGeometry(0.004, 0.004, 1, 3);
    const strawMat = new MeshStandardNodeMaterial({ color: new THREE.Color('#c8a860'), roughness: 1 });
    const drops = strewn(140, (x, z) => ({ at: [x, 0.004, z], ry: rnd() * TAU, s: [0.03 + rnd() * 0.03, 0.006, 0.03 + rnd() * 0.02] }));
    const pellets = strewn(40, (x, z) => ({ at: [x, 0.012, z], ry: rnd() * TAU, s: [0.025, 0.018, 0.045] }));
    const blob = new THREE.SphereGeometry(1, 6, 4);
    const dropMat = new MeshStandardNodeMaterial({ color: new THREE.Color('#e8e4da'), roughness: 0.9 });
    const pelletMat = new MeshStandardNodeMaterial({ color: new THREE.Color('#5a5650'), roughness: 1 });
    group.add(instanced(strawGeo, strawMat, straw), instanced(blob, dropMat, drops), instanced(blob, pelletMat, pellets));
    // the owls
    const flock = owls(perches(tier), { hedwig: { at: [hx, HEDWIG.y + 0.03, hz], yaw: HEDWIG.t + Math.PI, s: 1.25 } });
    group.add(flock.group);
    // the sky outside the openings
    const skyGeo = new THREE.SphereGeometry(60, 24, 12);
    const skyMat = skyMaterial();
    group.add(new THREE.Mesh(skyGeo, skyMat));
    let asked = false;
    const rtSave = () => rt?.saves?.get?.(SAVE.key, null) ?? null;
    return {
      word(text) {
        if (!asked) return;
        asked = false;
        const save = rtSave();
        const next = send(save, text, Date.now());
        if (next === save) return toast('A blank page. The owl looks at you as owls do.');
        rt?.saves?.set?.(SAVE.key, next);
        tell('word', null);
        tell('post', { text: next.post.text });
        toast('A tawny owl takes it in her beak, shakes out her wings, and is gone through the window.');
      },
      doors: [
        {
          id: 'post',
          at: [Math.sin(ta) * (R - 2.2), Math.cos(ta) * (R - 2.2)],
          r: 1.0,
          verb: 'Write',
          name: 'A letter',
          act: () => {
            if (waiting(rtSave())) return toast('Your owl isn’t back yet. Owls take the night, and sometimes the next one.');
            asked = true;
            tell('word', { title: 'A letter', prompt: 'One line, to whoever you like', placeholder: 'Dear…' });
          },
        },
        { id: 'hedwig', at: [Math.sin(HEDWIG.t) * (R - 1.9), Math.cos(HEDWIG.t) * (R - 1.9)], r: 0.9, verb: 'Hold out a hand to', name: 'The white owl', act: () => toast('She nips your finger, not hard. She is somebody else’s owl, and she knows it.') },
      ],
      live: [
        {
          dispose() {
            flock.dispose();
            strawGeo.dispose();
            strawMat.dispose();
            blob.dispose();
            dropMat.dispose();
            pelletMat.dispose();
            skyGeo.dispose();
            skyMat.dispose();
          },
        },
      ],
    };
  },
});
