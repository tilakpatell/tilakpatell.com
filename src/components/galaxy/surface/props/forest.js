// The forest worlds' props, built in code (props/index.js has what a builder
// returns): Endor's redwoods, ferns and Ewok village, its bunker, shield
// generator and walkers; Kashyyyk's wroshyr trees, karst spires and Kachirho;
// Dagobah's gnarltrees, Yoda's hut and the X-wing in the bog; Yavin 4's
// jungle and the Great Temple of Massassi. A kind with a model
// (catalog/forest.js) is drawn as the model; these are what's drawn without.

import * as THREE from 'three';
import { between, box, cyl, dome, part, ring, rockGeometry, rod, upright } from '../kitCore';
import { loft, trap8 } from '../../../universe/trafficKit';
import { rng } from '../noise';
import { insignia, scorch } from '../decals';
import { buildGalaxyShip } from '../../fleet';
import { liftNormals, spherifyNormals } from '../../../../lib/three/foliageNormals';

const { PI, cos, sin, max, min } = Math;
const TAU = PI * 2;

// ── Helpers ──

// parts → instancing parts (one geometry per material)
function instanced(k, parts) {
  const by = {};
  for (const p of parts) (by[p.to ?? 'paint'] ??= []).push(p);
  return Object.entries(by).map(([to, list]) => ({ geometry: k.geometry(list), material: k.mats[to] ?? k.mats.paint }));
}

// a lumpy ball, about 1 across (foliage, mud, moss)
function blob(seed = 1, { detail = 1, lump = 0.28, flat = 1 } = {}) {
  const g = new THREE.IcosahedronGeometry(0.5, detail);
  const r = rng(seed);
  const bumps = Array.from({ length: 6 }, () => [new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize(), (r() - 0.35) * lump]);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = v.clone().normalize();
    let s = 1;
    for (const [d, a] of bumps) s += a * max(0, n.dot(d)) ** 2;
    v.multiplyScalar(s);
    if (v.y < 0) v.y *= flat;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

// a trunk: a lathe of [radius, y] with furrows down its bark and a lean
function trunkGeometry(profile, { seg = 12, furrow = 0.08, ridges = 9, lean = [0, 0], seed = 1 } = {}) {
  const g = upright(profile, seg);
  const p = g.attributes.position;
  const top = profile.at(-1)[1] || 1;
  const r = rng(seed);
  const ph = r() * TAU;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const a = Math.atan2(z, x);
    const k = 1 + furrow * (sin(a * ridges + ph + y * 0.05) * 0.7 + sin(a * (ridges + 4) - ph) * 0.3);
    const t = (y / top) ** 2;
    p.setXYZ(i, x * k + lean[0] * t, y, z * k + lean[1] * t);
  }
  g.computeVertexNormals();
  return g;
}

// a trunk's radius at height y (from its profile)
function radiusAt(profile, y) {
  for (let i = 1; i < profile.length; i++) {
    const [r1, y1] = profile[i];
    const [r0, y0] = profile[i - 1];
    if (y <= y1) return r0 + ((r1 - r0) * (y - y0)) / Math.max(1e-6, y1 - y0);
  }
  return profile.at(-1)[0];
}

const smooth = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// A conifer's cards lit as one cone: every normal out from the trunk and a
// little up, `keep` of the card's own left in (in place)
function coneNormals(g, { lift = 0.6, keep = 0.15 } = {}) {
  const pos = g.attributes.position;
  const nrm = g.attributes.normal;
  const n = new THREE.Vector3();
  const o = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const d = Math.hypot(x, z);
    o.set(x, lift * d + 0.3, z).normalize();
    n.fromBufferAttribute(nrm, i).multiplyScalar(keep).addScaledVector(o, 1 - keep).normalize();
    nrm.setXYZ(i, n.x, n.y, n.z);
  }
  return g;
}

// A two-sided card's normals, whichever face they were on, turned to the
// sky's side and then lifted (kept `keep` of their own): a frond lit as the
// ground it grows from is (in place)
function upNormals(g, { keep = 0.4 } = {}) {
  const nrm = g.attributes.normal;
  for (let i = 0; i < nrm.count; i++) if (nrm.getY(i) < 0) nrm.setXYZ(i, -nrm.getX(i), -nrm.getY(i), -nrm.getZ(i));
  return liftNormals(g, { keep });
}

// a frond, arching out and down from its base (for ferns, palms, plants);
// `taper` narrows it to a leaf's shape (off for a card whose texture has
// its own)
function frond(len, wide, { arch = 0.6, seg = 4, tilt = 0, taper: shaped = true } = {}) {
  const g = new THREE.PlaneGeometry(wide, len, 1, seg).translate(0, len / 2, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    const t = y / len;
    const taper = shaped ? sin(min(1, t * 1.15 + 0.05) * PI) * 0.9 + 0.1 : 1;
    p.setX(i, p.getX(i) * taper);
    // bend: out along z, down at the tip
    const bend = arch * t * t * len;
    p.setXYZ(i, p.getX(i), y * (1 - 0.35 * t * arch), bend + p.getX(i) * p.getX(i) * -0.4);
  }
  g.rotateX(tilt);
  g.computeVertexNormals();
  return g;
}

// a walker's leg: a hip that swings, a knee that bends, an ankle that keeps
// the foot flat. thigh: [dy, dz] from hip to knee; shin: knee to ankle.
function walkerLeg(k, { at, thigh, shin, parts: { upper, lower, foot }, name }) {
  const hip = new THREE.Group();
  hip.position.set(...at);
  hip.add(k.build(upper, { name: `${name}-thigh` }));
  const knee = new THREE.Group();
  knee.position.set(0, thigh[0], thigh[1]);
  knee.add(k.build(lower, { name: `${name}-shin` }));
  const ankle = new THREE.Group();
  ankle.position.set(0, shin[0], shin[1]);
  ankle.add(k.build(foot, { name: `${name}-foot` }));
  knee.add(ankle);
  hip.add(knee);
  return { hip, knee, ankle };
}

// two legs walking: each swings forward, its knee folding as it's lifted
function gait(legs, body, { rate = 0.55, swing = 0.32, fold = 0.55, bob = 0.18, baseY = 0 }) {
  let cycle = 0;
  return (t, dt, move = 0) => {
    cycle += (dt ?? 0) * rate * Math.max(move, 0);
    legs.forEach((l, i) => {
      const a = (cycle + i * 0.5) * TAU;
      const lift = Math.max(0, sin(a + 0.4)) * move;
      l.hip.rotation.x = -sin(a) * swing * move - lift * 0.25;
      l.knee.rotation.x = lift * fold;
      l.ankle.rotation.x = -(l.hip.rotation.x + l.knee.rotation.x);
    });
    body.position.y = baseY + Math.abs(sin(cycle * TAU)) * bob * move - bob * 0.5 * move;
    body.rotation.z = sin(cycle * TAU) * 0.03 * move;
    // standing: a slow look round
    body.rotation.y = (1 - Math.min(1, move * 4)) * sin(t * 0.3) * 0.25;
  };
}

// ── The trees and plants (drawn instanced; also placed one at a time) ──

// an Endor redwood: a vast furrowed trunk on its buttress roots, its
// branches and foliage high overhead
// a spray of needles (kit.mats.needles), len long and w wide, its twig's foot
// at `at`, reaching out along the ground's angle a and drooping by d
// (radians), its card turned on its own axis by twist
// a spray of needles on a twig (kit.mats.needles), from `at` out along
// heading a, drooping d; lit with the whole tree's cone (coneNormals) and
// `shade`d as the tree asks (darker at the trunk, lighter at the tips)
function spray(len, w, at, a, d, twist = 0, color = '#2a4224', shade = null) {
  const g = new THREE.PlaneGeometry(w, len, 1, 2)
    .translate(0, len / 2, 0)
    .rotateY(twist)
    .rotateX(PI / 2 + d)
    .rotateY(a)
    .translate(at[0], at[1], at[2]);
  return part(coneNormals(g), { color, to: 'needles', uv: true, shade });
}

// a canopy clump of broad leaves s across and s × flat high round `at`, as
// Bruno Simon builds his bushes: many small cards of leaves (kit.mats
// .foliage), most near the clump's skin and turned out from it, on a smooth
// solid core (kit.mats.crown); every normal pointing out of the clump's
// ellipsoid, so the whole lights as one soft volume, not as cards; each
// vertex darker the deeper in and the lower it is. A card is at most 3 m:
// a bigger clump has more of them, never bigger leaves. `density` thins them
// (the far trees, behind the fog); `to` is the cards' material (a conifer's
// pads are needles).
export function canopy(at, s, { flat = 0.5, color = '#3e5a2a', seed = 1, density = 1, to = 'foliage' } = {}) {
  const rand = rng(seed);
  const R = s / 2;
  const Ry = R * flat;
  const c = new THREE.Vector3(...at);
  const radii = new THREE.Vector3(R, Ry, R);
  const base = new THREE.Color(color);
  const shade = (x, y, z) => {
    const dx = (x - at[0]) / R;
    const dy = (y - at[1]) / Ry;
    const dz = (z - at[2]) / R;
    return (0.5 + 0.5 * smooth(0.3, 1.1, Math.sqrt(dx * dx + dy * dy + dz * dz))) * (0.75 + 0.25 * smooth(-1, 0.8, dy));
  };
  const core = spherifyNormals(blob(seed, { lump: 0.3, detail: 0 }), { centre: new THREE.Vector3(), radii: new THREE.Vector3(0.5, 0.5, 0.5), keep: 0.1 });
  const out = [part(core, { at, scale: [s * 0.62, s * flat * 0.62, s * 0.62], color: base.clone().multiplyScalar(0.85), to: 'crown', shade })];
  const cs = Math.min(3, Math.max(1, s * 0.34));
  const n = Math.max(8, Math.min(90, Math.round(((2.2 * PI * R * R) / (cs * cs * 0.5)) * density)));
  const out3 = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const u = rand() * TAU;
    const v = Math.acos(1 - rand() * 1.7); // (more of them up top than under)
    const rr = 0.62 + 0.38 * (1 - rand() ** 3);
    out3.set(Math.sin(v) * Math.cos(u), Math.cos(v), Math.sin(v) * Math.sin(u));
    const p = [at[0] + out3.x * R * rr, at[1] + out3.y * Ry * rr, at[2] + out3.z * R * rr];
    const size = cs * (0.8 + rand() * 0.4);
    // (turned roughly out of the clump, so from outside a card is seen face on)
    const face = out3.clone().add(new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).multiplyScalar(1.1)).normalize();
    const g = new THREE.PlaneGeometry(size, size).rotateZ(rand() * TAU);
    g.lookAt(face);
    g.translate(...p);
    spherifyNormals(g, { centre: c, radii, keep: 0.12 });
    out.push(part(g, { color: base.clone().offsetHSL((rand() - 0.5) * 0.02, 0, (rand() - 0.5) * 0.06), to, uv: true, shade }));
  }
  return out;
}

function redwoodParts({ h = 68, r = 2.6, seed = 1, bark = '#6a3826', leaf = '#2a4224', lo = false } = {}) {
  const rand = rng(seed);
  const prof = [
    [r * 1.55, 0],
    [r * 1.15, 1.4],
    [r * 0.96, 4],
    [r * 0.82, h * 0.25],
    [r * 0.66, h * 0.5],
    [r * 0.46, h * 0.75],
    [r * 0.2, h * 0.94],
    [0.05, h],
  ];
  const parts = [part(trunkGeometry(prof, { seg: lo ? 7 : 12, furrow: 0.1, ridges: 7, seed, lean: [(rand() - 0.5) * 2, (rand() - 0.5) * 2] }), { color: bark, to: 'bark' })];
  // the buttress roots, flaring into the ground
  const nRoots = lo ? 3 : 6;
  for (let i = 0; i < nRoots; i++) {
    const a = (i / nRoots) * TAU + rand() * 0.5;
    const out = r * (1.55 + rand() * 0.45);
    parts.push(rod([cos(a) * r * 0.6, 2.6 + rand() * 1.6, sin(a) * r * 0.6], [cos(a) * out, -0.3, sin(a) * out], r * 0.36, r * 0.1, { color: bark, to: 'bark' }, 6));
  }
  // dead branch stubs low down
  for (let i = 0; i < (lo ? 0 : 3); i++) {
    const a = rand() * TAU;
    const y = h * (0.2 + rand() * 0.25);
    const rr = radiusAt(prof, y);
    parts.push(rod([cos(a) * rr * 0.8, y, sin(a) * rr * 0.8], [cos(a) * (rr + 2.5), y + 1.2, sin(a) * (rr + 2.5)], 0.28, 0.08, { color: bark, to: 'bark' }, 5));
  }
  // the crown: a tall, narrow column of foliage in clumps hugging the
  // trunk on short limbs, from halfway up to the top (darker in at the
  // trunk and low in the crown, lighter at the tips and the top)
  const shade = (x, y, z) => (0.55 + 0.45 * smooth(radiusAt(prof, y) * 0.8, radiusAt(prof, y) + 5, Math.hypot(x, z))) * (0.8 + 0.2 * smooth(h * 0.5, h, y));
  const clumps = lo ? 5 : 7;
  for (let i = 0; i < clumps; i++) {
    const f = i / (clumps - 1);
    const y = h * (0.5 + 0.44 * f);
    const a = i * 2.4 + rand() * 0.8;
    const rr = radiusAt(prof, y);
    const len = (1 - f) * 3.5 + 1.5 + rand() * 1.5;
    const end = [cos(a) * (rr + len), y + 1.2 + rand(), sin(a) * (rr + len)];
    if (!lo) parts.push(rod([cos(a) * rr * 0.7, y - 0.8, sin(a) * rr * 0.7], end, 0.4, 0.15, { color: bark, to: 'bark' }, 5));
    const s = (1 - f) * 3 + 3.6 + rand() * 1.4;
    // (the clump: needle sprays round the limb's end, drooping, and a few
    // standing up through them for body)
    const green = new THREE.Color(leaf).offsetHSL(0, 0, (rand() - 0.5) * 0.07);
    const n = lo ? 3 : 6;
    for (let j = 0; j < n; j++) parts.push(spray(s * (0.75 + rand() * 0.3), s * 0.62, [end[0] * 0.85, end[1] - 0.4, end[2] * 0.85], a + (j / n) * TAU + rand() * 0.5, 0.25 + rand() * 0.35, rand() * 0.6, green, shade));
    if (!lo) for (let j = 0; j < 2; j++) parts.push(spray(s * 0.7, s * 0.55, [end[0] * 0.85, end[1] - 1.2, end[2] * 0.85], a + j * PI, -1.15, PI / 2, green, shade));
  }
  // (the top: sprays reaching up round the leader)
  for (let j = 0; j < (lo ? 2 : 4); j++) parts.push(spray(6, 2.6, [0, h * 0.9, 0], j * 1.6 + rand(), -1.0, 0, leaf, shade));
  return { parts, prof };
}

// a younger Endor tree: a slim trunk, a cone of dark needles
function spruceParts({ h = 22, seed = 2, bark = '#5a3a28', leaf = '#2a4224' } = {}) {
  const rand = rng(seed);
  const prof = [
    [0.55, 0],
    [0.42, 1],
    [0.3, h * 0.5],
    [0.05, h],
  ];
  const parts = [part(trunkGeometry(prof, { seg: 8, furrow: 0.06, ridges: 5, seed }), { color: bark, to: 'bark' })];
  // whorls of branches, each a spray of needles reaching out and drooping,
  // shorter going up; a spike of them at the top
  const layers = 12;
  // (darker in at the trunk and down the tree)
  const shade = (x, y, z) => (0.55 + 0.45 * smooth(0, (1 - (y / h - 0.24) / 0.7) * 4 + 0.9, Math.hypot(x, z))) * (0.78 + 0.22 * smooth(0, h, y));
  for (let i = 0; i < layers; i++) {
    const f = i / (layers - 1);
    const y = h * (0.24 + 0.7 * f);
    const w = (1 - f) * 4.2 + 0.9;
    const green = new THREE.Color(leaf).offsetHSL(0, 0, (rand() - 0.5) * 0.06);
    const n = 9;
    const turn = rand() * TAU;
    for (let j = 0; j < n; j++) parts.push(spray(w, w * 0.5 + 0.4, [0, y, 0], turn + (j / n) * TAU, 0.3 + f * 0.2 + rand() * 0.15, (rand() - 0.5) * 0.5, green, shade));
  }
  for (let j = 0; j < 3; j++) parts.push(spray(h * 0.12, 1.1, [0, h * 0.9, 0], j * 2.1, -PI / 2 + 0.15, 0, leaf, shade));
  // (a dark cone inside the sprays, as a fir's crown is solid from a little
  // way off: so far off it stays a full dark spire, not a pole with wisps)
  // (slimmer than the sprays reach and many-sided, so it's the dark heart
  // of the crown, not a flat-faced cone seen between the sprays)
  const core = new THREE.ConeGeometry(1.9, h * 0.72, 14, 1, true).translate(0, h * 0.24 + h * 0.36, 0);
  coneNormals(core, { lift: 0.5, keep: 0.1 });
  parts.push(part(core, { color: new THREE.Color(leaf).multiplyScalar(0.8), to: 'crown', shade: (x, y) => 0.7 + 0.3 * smooth(h * 0.24, h, y) }));
  return { parts };
}

// a fern: fronds of leaflets (kit.mats.fronds) arching out of a clump, lit
// as the ground under them is (normals lifted up), darker at the heart
function fernParts({ seed = 3, color = '#4a7430', n = 9, len = 1.3 } = {}) {
  const rand = rng(seed);
  const parts = [];
  const shade = (x, y, z) => 0.5 + 0.5 * smooth(0, len * 0.85, Math.hypot(x, z));
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + rand() * 0.4;
    const l = len * (0.7 + rand() * 0.5);
    const g = upNormals(frond(l, l * 0.42, { arch: 0.7 + rand() * 0.3, tilt: 0.25 + rand() * 0.35 }), { keep: 0.4 });
    parts.push(part(g, { rot: [0, a, 0], color: new THREE.Color(color).offsetHSL((rand() - 0.5) * 0.03, 0, (rand() - 0.5) * 0.08), to: 'fronds', uv: true, shade }));
  }
  return { parts };
}

// Moss hanging from a limb at `at`, `len` long: two cards crossed, the
// strand texture on them (kit.mats.strands), lit as the tree is round it
function hanging(at, len, { w = 1.2, color = '#6e735a', turn = 0 } = {}) {
  const out = [];
  for (const a of [0, PI / 2]) {
    const g = new THREE.PlaneGeometry(w, len, 1, 3).translate(0, -len / 2, 0).rotateY(turn + a).translate(...at);
    out.push(part(upNormals(g, { keep: 0.5 }), { color, to: 'strands', uv: true, shade: (x, y) => 0.65 + 0.35 * smooth(at[1] - len, at[1], y) }));
  }
  return out;
}

// a Dagobah gnarltree, as the film's are (ESB's swamp set): no leafy crown,
// a trunk of strands braided round each other, rising from a tangle of
// roots arching out of the water, its limbs writhing out and down, draped
// in long curtains of grey-green moss; pale where the roots' tops catch
// the light. `lo`: fewer limbs and curtains (far off, in the fog).
function gnarlParts({ seed = 4, bark = '#4c463a', moss = '#6e735a', h = 14, roots = 8, lo = false } = {}) {
  const rand = rng(seed);
  const parts = [];
  const B = { color: bark, to: 'bark' };
  const pale = { color: new THREE.Color(bark).lerp(new THREE.Color('#a2a6a8'), 0.35), to: 'bark' };
  // the roots, arching up out of the water to the trunk, a little sinuous
  const base = 2.4 + rand() * 0.8;
  for (let i = 0; i < roots; i++) {
    const a = (i / roots) * TAU + rand() * 0.5;
    const out = 3.5 + rand() * 2.5;
    const wob = (rand() - 0.5) * 0.5;
    const pts = [
      [cos(a) * 0.45, base + 0.4, sin(a) * 0.45],
      [cos(a + wob) * out * 0.35, base + 0.7, sin(a + wob) * out * 0.35],
      [cos(a - wob) * out * 0.65, base * 0.75, sin(a - wob) * out * 0.65],
      [cos(a + wob * 0.5) * out * 0.88, base * 0.3, sin(a + wob * 0.5) * out * 0.88],
      [cos(a) * out, -0.5, sin(a) * out],
    ];
    for (let j = 0; j < 4; j++) parts.push(rod(pts[j], pts[j + 1], 0.32 - j * 0.05, 0.26 - j * 0.05, j < 2 ? pale : B, 6));
  }
  // the trunk: three strands twisting round each other up to where it splits
  const split = h * 0.62;
  const steps = 6;
  const twist = 1.6 + rand() * 1.2;
  let top = [0, split, 0];
  for (let k = 0; k < 3; k++) {
    let p = null;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const a = (k / 3) * TAU + twist * t * TAU * 0.5;
      const rr = 0.42 * (1 - t * 0.35);
      const lean = [(rand() - 0.5) * 0.25, (rand() - 0.5) * 0.25];
      const q = [cos(a) * rr + lean[0] * t, base - 0.2 + (split - base + 0.2) * t, sin(a) * rr + lean[1] * t];
      if (p) parts.push(rod(p, q, 0.36 - t * 0.08, 0.34 - t * 0.08, B, 6));
      p = q;
    }
    top = p;
  }
  top = [top[0] * 0.3, split, top[2] * 0.3];
  // the limbs, writhing out and drooping, moss hanging all along them
  const limbs = lo ? 3 : 5 + Math.floor(rand() * 2);
  for (let i = 0; i < limbs; i++) {
    const a = (i / limbs) * TAU + rand() * 0.8;
    let p = [top[0], top[1] + (rand() - 0.3) * h * 0.25, top[2]];
    const reach = 4 + rand() * 4;
    for (let j = 0; j < 3; j++) {
      const q = [p[0] + cos(a + (rand() - 0.5) * 0.9) * reach * 0.38, p[1] + (j === 0 ? 1.4 + rand() : rand() * 1.2 - 0.6), p[2] + sin(a + (rand() - 0.5) * 0.9) * reach * 0.38];
      parts.push(rod(p, q, 0.3 - j * 0.07, 0.22 - j * 0.06, B, 5));
      // (the curtains: long, two or three to a stretch of limb)
      const n = lo ? 1 : 2 + Math.floor(rand() * 2);
      for (let m = 0; m < n; m++) {
        const f = (m + 0.5) / n;
        const at = [p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f, p[2] + (q[2] - p[2]) * f];
        parts.push(...hanging(at, 2 + rand() * 4.5, { w: 0.9 + rand() * 0.8, color: new THREE.Color(moss).offsetHSL(0, 0, (rand() - 0.5) * 0.1), turn: rand() * PI }));
      }
      p = q;
    }
  }
  return { parts };
}

// reeds and swamp grass: a clump of blades (kit.mats.blades), each a
// tapering strip leaning out and bending over, dark at the water and
// paler at the tip
function reedParts({ seed = 5, color = '#6a7444', n = 14, h = 1.6 } = {}) {
  const rand = rng(seed);
  const parts = [];
  for (let i = 0; i < n; i++) {
    const a = rand() * TAU;
    const d = rand() * 0.45;
    const l = h * (0.5 + rand() * 0.7);
    const w = 0.05 + rand() * 0.04;
    const g = new THREE.PlaneGeometry(w, l, 1, 3).translate(0, l / 2, 0);
    const p = g.attributes.position;
    const bend = 0.15 + rand() * 0.35;
    for (let k = 0; k < p.count; k++) {
      const t = p.getY(k) / l;
      p.setX(k, p.getX(k) * (1 - t * 0.85));
      p.setZ(k, bend * l * t * t);
    }
    g.computeVertexNormals();
    parts.push(part(upNormals(g, { keep: 0.5 }), { at: [cos(a) * d, 0, sin(a) * d], rot: [(rand() - 0.5) * 0.3, rand() * TAU, 0], color: new THREE.Color(color).offsetHSL(0, 0, (rand() - 0.5) * 0.12), to: 'blades', shade: (x, y) => 0.55 + 0.45 * smooth(0, h, y) }));
  }
  return { parts };
}

// a Kashyyyk wroshyr, as Revenge of the Sith's are: a giant bonsai. A
// vast fluted trunk flaring onto buttress roots splits a third to halfway
// up into a few great limbs that rise and then run out level, each
// carrying broad flat cloud-pads of needles (the wroshyr is a conifer),
// aerial roots and moss hanging from under them; a smaller pad on the
// leader. `lo`: thinner pads and no hangings (far off, in the haze).
function wroshyrParts({ h = 74, r = 3.2, seed = 6, bark = '#7a6a54', leaf = '#4a6a2c', moss = '#56604a', lo = false } = {}) {
  const rand = rng(seed);
  const split = h * (0.36 + rand() * 0.16);
  const prof = [
    [r * 1.9, 0],
    [r * 1.3, 2.5],
    [r, 8],
    [r * 0.92, split],
    [r * 0.55, h * 0.8],
    [r * 0.25, h],
  ];
  const lean = [(rand() - 0.5) * 3, (rand() - 0.5) * 3];
  const parts = [part(trunkGeometry(prof, { seg: lo ? 10 : 16, furrow: 0.16, ridges: 7, seed, lean }), { color: bark, to: 'bark' })];
  // the buttress roots, flaring out into the ground
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + rand() * 0.4;
    const out = r * (2.2 + rand() * 0.9);
    parts.push(rod([cos(a) * r * 0.5, 7 + rand() * 4, sin(a) * r * 0.5], [cos(a) * out, -0.4, sin(a) * out], r * 0.5, r * 0.16, { color: bark, to: 'bark' }, 5));
  }
  const pad = (at, s, i) => {
    parts.push(...canopy(at, s, { flat: 0.24, color: new THREE.Color(leaf).offsetHSL((rand() - 0.5) * 0.02, 0, (rand() - 0.5) * 0.08), seed: seed * 19 + i, density: lo ? 0.2 : 0.42, to: 'needles' }));
    // (aerial roots and moss hanging from under it)
    if (!lo) for (let m = 0; m < 3; m++) parts.push(...hanging([at[0] + (rand() - 0.5) * s * 0.5, at[1] - s * 0.08, at[2] + (rand() - 0.5) * s * 0.5], 4 + rand() * 9, { w: 1.4, color: moss, turn: rand() * PI }));
  };
  // the great limbs: up out of the split, then level
  const limbs = 3 + Math.floor(rand() * 3);
  const rs = radiusAt(prof, split);
  for (let i = 0; i < limbs; i++) {
    const a = (i / limbs) * TAU + rand() * 0.6;
    const rise = 0.6 + rand() * 0.35;
    const l1 = h * (0.2 + rand() * 0.08);
    const l2 = h * (0.16 + rand() * 0.1);
    const p0 = [cos(a) * rs * 0.3 + lean[0] * 0.3, split - 2, sin(a) * rs * 0.3 + lean[1] * 0.3];
    const p1 = [p0[0] + cos(a) * l1 * Math.cos(rise), p0[1] + l1 * Math.sin(rise), p0[2] + sin(a) * l1 * Math.cos(rise)];
    const p2 = [p1[0] + cos(a + 0.3) * l2, p1[1] + l2 * 0.12, p1[2] + sin(a + 0.3) * l2];
    parts.push(rod(p0, p1, rs * 0.42, rs * 0.3, { color: bark, to: 'bark' }, 7));
    parts.push(rod(p1, p2, rs * 0.3, rs * 0.14, { color: bark, to: 'bark' }, 6));
    pad([p2[0], p2[1] + 1.5, p2[2]], h * (0.28 + rand() * 0.1), i * 3);
    pad([p1[0], p1[1] + 1, p1[2]], h * (0.18 + rand() * 0.06), i * 3 + 1);
  }
  pad([lean[0], h * 0.97, lean[1]], h * 0.2, 99);
  return { parts, prof };
}

// a karst pinnacle: a column of pale limestone, fluted and lumpy, scrub on
// its top and ledges (1 across, about 6 tall: scaled and stretched)
function karstParts({ seed = 7, color = '#a8a493', leaf = '#4e6a32' } = {}) {
  const rand = rng(seed);
  const prof = [
    [0.62, -0.2],
    [0.55, 0.5],
    [0.5, 1.6],
    [0.44, 3],
    [0.4, 4.4],
    [0.36, 5.4],
    [0.22, 6.0],
    [0.02, 6.2],
  ];
  const g = trunkGeometry(prof, { seg: 10, furrow: 0.18, ridges: 5, seed, lean: [(rand() - 0.5) * 0.8, (rand() - 0.5) * 0.8] });
  // lumps: bulge it here and there
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    const s = 1 + 0.18 * sin(y * 2.3 + seed) * sin(Math.atan2(p.getZ(i), p.getX(i)) * 3 + y);
    p.setX(i, p.getX(i) * s);
    p.setZ(i, p.getZ(i) * s);
  }
  g.computeVertexNormals();
  const parts = [part(g, { color, to: 'stone' })];
  parts.push(part(blob(seed * 3, { lump: 0.5 }), { at: [0, 6.0, 0], scale: [0.9, 0.5, 0.9], color: leaf, to: 'leaf' }));
  for (let i = 0; i < 3; i++) {
    const a = rand() * TAU;
    const y = 2 + rand() * 3;
    parts.push(part(blob(seed * 5 + i, { lump: 0.5 }), { at: [cos(a) * 0.45, y, sin(a) * 0.45], scale: [0.5, 0.35, 0.5], color: leaf, to: 'leaf' }));
  }
  return { parts };
}

// a Yavin 4 jungle tree: a tall pale trunk on plank buttresses, a broad
// crown high up, lianas hanging
function jungleParts({ h = 36, r = 1.5, seed = 8, bark = '#8a8470', leaf = '#355a26', lo = false, creepers = !lo } = {}) {
  const rand = rng(seed);
  const prof = [
    [r * 1.4, 0],
    [r * 1.0, 2],
    [r * 0.8, h * 0.4],
    [r * 0.6, h * 0.8],
    [r * 0.3, h],
  ];
  const parts = [part(trunkGeometry(prof, { seg: 9, furrow: 0.05, ridges: 4, seed, lean: [(rand() - 0.5) * 2, (rand() - 0.5) * 2] }), { color: bark, to: 'bark' })];
  // plank buttresses: thin fins out from the foot
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + rand() * 0.5;
    parts.push(part(new THREE.ExtrudeGeometry(new THREE.Shape([new THREE.Vector2(r * 0.4, 0), new THREE.Vector2(r * 3.2, 0), new THREE.Vector2(r * 0.4, r * 4.5)]), { depth: 0.25, bevelEnabled: false }).translate(0, 0, -0.125), { rot: [0, a, 0], color: bark, to: 'bark' }));
  }
  // the crown: limbs out to broad, flattish clumps, an umbrella over the
  // top third (from below a roof of leaves, as Yavin's jungle is in the
  // film, not poles with tufts; from the temple's top, the broccoli sea)
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + rand() * 0.6;
    const len = 6 + rand() * 6;
    const y = h * (0.66 + (i % 3) * 0.08 + rand() * 0.05);
    const end = [cos(a) * len, y + 2 + rand() * 2, sin(a) * len];
    parts.push(rod([0, y - 3, 0], end, 0.6, 0.22, { color: bark, to: 'bark' }, 5));
    const s = 8 + rand() * 4.5;
    parts.push(...canopy(end, s, { flat: 0.36, color: new THREE.Color(leaf).offsetHSL((rand() - 0.5) * 0.02, 0, (rand() - 0.5) * 0.08), seed: seed * 23 + i, density: lo ? 0.25 : 0.75 }));
    // a liana down from it, and creepers hanging off the limb
    if (i % 3 === 0) parts.push(rod(end, [end[0] * 0.8, 2 + rand() * 6, end[2] * 0.8], 0.07, 0.05, { color: '#3c4a26', to: 'bark' }, 4));
    if (creepers && i % 2 === 0) parts.push(...hanging([end[0] * 0.6, y + 0.5, end[2] * 0.6], 3 + rand() * 5, { w: 1.1, color: '#4c5a32', turn: a }));
  }
  parts.push(...canopy([0, h + 1.5, 0], 9, { flat: 0.4, color: leaf, seed: seed * 29, density: lo ? 0.25 : 0.75 }));
  return { parts };
}

// broad-leaved undergrowth (Yavin 4, Kashyyyk): big leaves on stalks
function plantParts({ seed = 9, color = '#3f6a2a', n = 7, len = 1.8 } = {}) {
  const rand = rng(seed);
  const parts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + rand() * 0.5;
    const l = len * (0.6 + rand() * 0.6);
    const g = upNormals(frond(l, l * 0.62, { arch: 0.5 + rand() * 0.4, seg: 3, tilt: 0.35 + rand() * 0.4, taper: false }), { keep: 0.45 });
    parts.push(part(g, { rot: [0, a, 0], color: new THREE.Color(color).offsetHSL(0, 0, (rand() - 0.5) * 0.1), to: 'broadleaf', uv: true, shade: (x, y, z) => 0.55 + 0.45 * smooth(0, len, Math.hypot(x, z)) }));
  }
  return { parts };
}

// a bush, as Bruno Simon's are: one clump of leaf cards on a smooth core,
// sat on the ground, `s` across (the scrub back from Scarif's beaches)
function bushParts({ s = 2, seed = 12, color = '#46582e' } = {}) {
  return { parts: canopy([0, s * 0.3, 0], s, { flat: 0.62, color, seed }) };
}

// toadstools and shelf fungus, pale in the gloom
function fungusParts({ seed = 10, color = '#c8c0a0', cap = '#a8885a' } = {}) {
  const rand = rng(seed);
  const parts = [];
  for (let i = 0; i < 5; i++) {
    const a = rand() * TAU;
    const d = rand() * 0.5;
    const h = 0.15 + rand() * 0.35;
    parts.push(part(new THREE.CylinderGeometry(0.03, 0.04, h, 5, 1, true).translate(0, h / 2, 0), { at: [cos(a) * d, 0, sin(a) * d], color, to: 'leaf' }));
    parts.push(part(new THREE.SphereGeometry(0.08 + h * 0.4, 7, 2, 0, TAU, 0, PI / 2), { at: [cos(a) * d, h, sin(a) * d], scale: [1, 0.6, 1], color: cap, to: 'leaf' }));
  }
  return { parts };
}

// a fallen log, mossy, along x
function logParts({ seed = 11, len = 9, r = 0.7, bark = '#5a3e2a', moss = '#4f6a2e' } = {}) {
  const rand = rng(seed);
  const parts = [part(new THREE.CylinderGeometry(r * 0.85, r, len, 9), { at: [0, r * 0.75, 0], rot: [0, 0, PI / 2], color: bark, to: 'bark' })];
  parts.push(part(new THREE.CylinderGeometry(r * 0.7, r * 0.7, 0.05, 9), { at: [len / 2 + 0.02, r * 0.75, 0], rot: [0, 0, PI / 2], color: '#8a6a48', to: 'bark' }));
  for (let i = 0; i < 4; i++) parts.push(part(blob(seed * 7 + i, { lump: 0.5 }), { at: [(rand() - 0.5) * len * 0.8, r * 1.35, (rand() - 0.5) * r * 0.6], scale: [1.4 + rand(), 0.4, r * 1.6], color: moss, to: 'leaf' }));
  return { parts };
}

export const SCATTER = {
  redwood: (k, o = {}) => ({ parts: instanced(k, redwoodParts(o).parts), radius: (o.r ?? 2.6) * 1.05 }),
  spruce: (k, o = {}) => ({ parts: instanced(k, spruceParts(o).parts), radius: 0.5 }),
  fern: (k, o = {}) => ({ parts: instanced(k, fernParts(o).parts), radius: null }),
  gnarltree: (k, o = {}) => ({ parts: instanced(k, gnarlParts(o).parts), radius: 1.0 }),
  reeds: (k, o = {}) => ({ parts: instanced(k, reedParts(o).parts), radius: null }),
  wroshyr: (k, o = {}) => ({ parts: instanced(k, wroshyrParts(o).parts), radius: (o.r ?? 3.2) * 1.05 }),
  karst: (k, o = {}) => ({ parts: instanced(k, karstParts(o).parts), radius: 0.5 }),
  jungletree: (k, o = {}) => ({ parts: instanced(k, jungleParts(o).parts), radius: (o.r ?? 1.1) * 1.1 }),
  plant: (k, o = {}) => ({ parts: instanced(k, plantParts(o).parts), radius: null }),
  bush: (k, o = {}) => ({ parts: instanced(k, bushParts(o).parts), radius: null }),
  fungus: (k, o = {}) => ({ parts: instanced(k, fungusParts(o).parts), radius: null }),
  log: (k, o = {}) => ({ parts: instanced(k, logParts(o).parts), radius: null }),
};

// ── Trees, one at a time (a village's own tree, a landmark) ──

const TREES = {
  redwood(k, o = {}) {
    return { object: k.build(redwoodParts(o).parts, { name: 'redwood' }), solids: [{ circle: [0, 0, (o.r ?? 2.6) * 1.1] }] };
  },
  gnarltree(k, o = {}) {
    return { object: k.build(gnarlParts(o).parts, { name: 'gnarltree' }), solids: [{ circle: [0, 0, 1.1] }] };
  },
  wroshyr(k, o = {}) {
    return { object: k.build(wroshyrParts(o).parts, { name: 'wroshyr' }), solids: [{ circle: [0, 0, (o.r ?? 3.2) * 1.1] }] };
  },
  karst(k, o = {}) {
    const object = k.build(karstParts(o).parts, { name: 'karst' });
    object.scale.set(o.w ?? 12, o.h ?? 12, o.w ?? 12);
    const holder = new THREE.Group();
    holder.add(object);
    return { object: holder, solids: [{ circle: [0, 0, (o.w ?? 12) * 0.5] }] };
  },
  jungletree(k, o = {}) {
    return { object: k.build(jungleParts(o).parts, { name: 'jungletree' }), solids: [{ circle: [0, 0, (o.r ?? 1.1) * 1.2] }] };
  },
  log(k, o = {}) {
    const len = o.len ?? 9;
    const r = o.r ?? 0.7;
    return { object: k.build(logParts(o).parts, { name: 'log' }), solids: [{ box: [0, 0, len / 2, r, 0], top: r * 1.5 }] };
  },
  fern(k, o = {}) {
    return { object: k.build(fernParts(o).parts, { name: 'fern' }) };
  },
};

// ── Endor ──

const WOOD = '#7c5a3a';
const WOOD_DARK = '#4e3624';
const THATCH = '#8a7048';
const IMPERIAL = '#7a7d78';

// light, slanting down through the canopy: soft columns along the sun's
// rays, brightest low down, fading out far off and close up
function shaftMaterial(k, color, strength) {
  return k.own(k.looks.shaft(color, strength));
}

// a shaft geometry: cylinders from the ground up toward the sun
function shaftGeometry({ n, spread, az, el, len, r, seed }) {
  const rand = rng(seed);
  const d = new THREE.Vector3(sin(az) * cos(el), sin(el), cos(az) * cos(el)).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
  const geos = [];
  for (let i = 0; i < n; i++) {
    const a = rand() * TAU;
    const dd = Math.sqrt(rand()) * spread;
    const l = len * (0.7 + rand() * 0.5);
    const rr = r * (0.5 + rand() * 0.9);
    const g = new THREE.CylinderGeometry(rr, rr * 1.3, l, 10, 1, true);
    g.applyQuaternion(q);
    const base = new THREE.Vector3(cos(a) * dd, 0, sin(a) * dd);
    g.translate(...base.addScaledVector(d, l / 2).toArray());
    geos.push(g);
  }
  // (merged by hand: positions, normals, uvs)
  const count = geos.reduce((s, g) => s + g.index.count, 0);
  const pos = new Float32Array(count * 3);
  const nor = new Float32Array(count * 3);
  const uv = new Float32Array(count * 2);
  let o = 0;
  for (const g of geos) {
    const ng = g.toNonIndexed();
    pos.set(ng.attributes.position.array, o * 3);
    nor.set(ng.attributes.normal.array, o * 3);
    uv.set(ng.attributes.uv.array, o * 2);
    o += ng.attributes.position.count;
    g.dispose();
    ng.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.computeBoundingSphere();
  return out;
}

const ENDOR = {
  // sunbeams through the canopy (az, el: the sun's, as in the site's sky)
  lightshafts(k, { n = 9, spread = 34, az = 0.8, el = 1.0, len = 80, r = 1.8, color = '#fff0c8', strength = 0.12, seed = 3 } = {}) {
    const mesh = new THREE.Mesh(k.own(shaftGeometry({ n, spread, az, el, len, r, seed })), shaftMaterial(k, color, strength));
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.renderOrder = 4;
    const object = new THREE.Group();
    object.add(mesh);
    return { object };
  },

  // an Ewok hut: a drum of upright logs under a steep thatched cone, a low
  // door, a pole out of its peak; about 4 m tall
  ewokhut(k, { r = 2.0 } = {}) {
    const rand = k.rand;
    const wall = 2.0;
    const logs = trunkGeometry(
      [
        [r, 0],
        [r * 0.98, wall],
      ],
      { seg: 22, furrow: 0.05, ridges: 22, seed: 3 },
    );
    const thatch = new THREE.Color(THATCH).offsetHSL(0, 0, (rand() - 0.5) * 0.08);
    const parts = [
      part(logs, { color: WOOD, to: 'bark' }),
      // the thatch: two layers, the lower one flared out over the wall
      part(new THREE.ConeGeometry(r * 1.42, 1.5, 18, 1, true), { at: [0, wall + 0.55, 0], color: thatch, to: 'leaf' }),
      part(new THREE.ConeGeometry(r * 1.05, 2.0, 16), { at: [0, wall + 1.25, 0], color: thatch.clone().offsetHSL(0, 0, -0.05), to: 'leaf' }),
      // bindings round the wall and the roof
      part(ring(r * 1.0, 0.06, 24), { at: [0, wall * 0.5, 0], color: '#3a2a1a', to: 'bark' }),
      part(ring(r * 1.02, 0.07, 24), { at: [0, wall, 0], color: '#3a2a1a', to: 'bark' }),
      // the door, a frame of poles round it, a window
      part(box(0.85, 1.35, 0.3), { at: [0, 0, r - 0.08], color: '#1a120c', to: 'dark' }),
      part(new THREE.CircleGeometry(0.28, 10), { at: [r * 0.71, 1.25, r * 0.71], rot: [0, PI / 4, 0], color: '#1a120c', to: 'dark' }),
    ];
    for (const x of [-0.5, 0.5]) parts.push(rod([x, -0.05, r + 0.05], [x * 0.8, 1.7, r + 0.15], 0.06, 0.05, { color: WOOD_DARK, to: 'bark' }, 5));
    parts.push(rod([-0.55, 1.5, r + 0.12], [0.55, 1.5, r + 0.12], 0.05, 0.05, { color: WOOD_DARK, to: 'bark' }, 5));
    // the pole from the peak, with its trophy horns
    parts.push(rod([0, wall + 1.8, 0], [0, wall + 2.8, 0], 0.06, 0.04, { color: WOOD_DARK, to: 'bark' }, 5));
    for (const s of [-1, 1]) parts.push(rod([0, wall + 2.6, 0], [s * 0.35, wall + 2.95, 0.1], 0.04, 0.015, { color: '#d8ccb0', to: 'bark' }, 4));
    return { object: k.build(parts, { name: 'ewokhut' }), solids: [{ circle: [0, 0, r * 1.02] }] };
  },

  // a tree of the Ewok village: a redwood with a deck of planks round it
  // (h up), braced from the trunk, a rail round its edge; a second deck
  // above (h2, smaller) for some; a straight stair down to the forest floor
  // (stair: its bearing, radians, or null). What you can stand on is in
  // its floors.
  ewoktree(k, o = {}) {
    const { h = 9, h2 = null, deck = 7, stair = null, r = 2.4, H = 66, seed = 5, gaps = [] } = o;
    const tree = redwoodParts({ h: H, r, seed });
    const parts = [...tree.parts];
    const floors = [];
    const D = { color: WOOD_DARK, to: 'bark' };
    const deckAt = (y, R, rails = true) => {
      parts.push(part(new THREE.CylinderGeometry(R, R, 0.4, 28), { at: [0, y - 0.2, 0], color: WOOD, to: 'bark' }));
      parts.push(part(ring(R, 0.14, 32), { at: [0, y - 0.25, 0], color: WOOD_DARK, to: 'bark' }));
      // the joists and braces under it
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU + 0.2;
        const rr = radiusAt(tree.prof, y);
        parts.push(rod([cos(a) * rr * 0.9, y - 4.2, sin(a) * rr * 0.9], [cos(a) * R * 0.85, y - 0.45, sin(a) * R * 0.85], 0.12, 0.1, D, 5));
        parts.push(rod([cos(a) * rr, y - 0.5, sin(a) * rr], [cos(a) * R, y - 0.5, sin(a) * R], 0.13, 0.13, D, 5));
      }
      // the rail: posts round the edge, poles between (leaving gaps for the
      // bridges and the stair)
      if (rails) {
        const posts = Math.round(R * 2.2);
        for (let i = 0; i < posts; i++) {
          const a = (i / posts) * TAU;
          const b = ((i + 1) / posts) * TAU;
          const gap = (x) => [...gaps, ...(stair != null ? [stair] : [])].some((g) => Math.abs(Math.atan2(sin(x - g), cos(x - g))) < 0.32);
          // (bearings: sin along x, cos along z, as a yaw)
          const P = (x, rr, y) => [sin(x) * rr, y, cos(x) * rr];
          if (gap(a)) continue;
          parts.push(rod(P(a, R - 0.15, y), P(a, R - 0.15, y + 1.05), 0.07, 0.06, D, 5));
          if (!gap(b) && !gap((a + b) / 2)) parts.push(rod(P(a, R - 0.15, y + 0.95), P(b, R - 0.15, y + 0.95), 0.045, 0.045, { color: '#8a7a5a', to: 'bark' }, 4));
        }
      }
      floors.push({ x: 0, z: 0, r: R, y });
    };
    deckAt(h, deck);
    if (h2) deckAt(h2, deck * 0.68);
    // the stair: straight down and out from the deck's edge
    if (stair != null) {
      const rise = 0.45;
      const tread = 0.78;
      const n = Math.ceil(h / rise) - 1;
      const u = [sin(stair), cos(stair)];
      for (let i = 0; i < n; i++) {
        const d = deck + 0.4 + i * tread;
        const y = h - (i + 1) * rise;
        parts.push(part(box(1.5, 0.14, tread + 0.08), { at: [u[0] * d, y - 0.14, u[1] * d], rot: [0, stair, 0], color: WOOD, to: 'bark' }));
        floors.push({ x: u[0] * d, z: u[1] * d, hw: 0.8, hd: tread / 2 + 0.06, yaw: stair, y });
      }
      // its stringers and rope rails
      const s = [cos(stair), -sin(stair)];
      const d0 = deck + 0.1;
      const d1 = deck + 0.4 + n * tread;
      for (const side of [-0.78, 0.78]) {
        parts.push(rod([u[0] * d0 + s[0] * side, h - 0.2, u[1] * d0 + s[1] * side], [u[0] * d1 + s[0] * side, -0.1, u[1] * d1 + s[1] * side], 0.09, 0.09, D, 5));
        parts.push(rod([u[0] * d0 + s[0] * side, h + 1.0, u[1] * d0 + s[1] * side], [u[0] * d1 + s[0] * side, 1.0, u[1] * d1 + s[1] * side], 0.03, 0.03, { color: '#8a7a5a', to: 'bark' }, 4));
        for (let i = 0; i <= n; i += 4) {
          const d = deck + 0.4 + i * tread;
          const y = h - (i + 1) * rise;
          parts.push(rod([u[0] * d + s[0] * side, y - 0.1, u[1] * d + s[1] * side], [u[0] * d + s[0] * side, y + 1.05, u[1] * d + s[1] * side], 0.05, 0.05, D, 4));
        }
      }
    }
    // torches on the deck
    const object = k.build(parts, { name: 'ewoktree' });
    return { object, floors, solids: [{ circle: [0, 0, radiusAt(tree.prof, 1) + 0.2] }] };
  },

  // a rope bridge, along z, `len` long, from h0 (at -z) to h1 (at +z), sagging
  ropebridge(k, { len = 10, h0 = 9, h1 = 9, sag = 0.5, wide = 1.3 } = {}) {
    const n = Math.max(3, Math.round(len / 0.85));
    const step = len / n;
    const yAt = (t) => h0 + (h1 - h0) * t - sag * 4 * t * (1 - t);
    const parts = [];
    const floors = [];
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const z = -len / 2 + (i + 0.5) * step;
      const y = yAt(t);
      parts.push(part(new THREE.BoxGeometry(wide, 0.09, step * 0.82), { at: [0, y - 0.05, z], rot: [Math.atan2(yAt(t - 0.5 / n) - yAt(t + 0.5 / n), step), 0, (k.rand() - 0.5) * 0.06], color: new THREE.Color(WOOD).offsetHSL(0, 0, (k.rand() - 0.5) * 0.1), to: 'bark' }));
      floors.push({ x: 0, z, hw: wide / 2 + 0.15, hd: step / 2 + 0.05, yaw: 0, y });
    }
    // the ropes: underneath, and the hand ropes, sagging more
    for (const x of [-wide / 2, wide / 2]) {
      for (let i = 0; i < n; i++) {
        const t0 = i / n;
        const t1 = (i + 1) / n;
        const z0 = -len / 2 + i * step;
        const z1 = z0 + step;
        parts.push(rod([x, yAt(t0) - 0.1, z0], [x, yAt(t1) - 0.1, z1], 0.035, 0.035, { color: '#8a7a5a', to: 'bark' }, 4));
        const hand = (t) => yAt(t) + 1.05 + sag * 0.6 * 4 * t * (1 - t) * -0.5;
        parts.push(rod([x * 1.1, hand(t0), z0], [x * 1.1, hand(t1), z1], 0.03, 0.03, { color: '#8a7a5a', to: 'bark' }, 4));
        if (i % 2 === 0) parts.push(rod([x, yAt(t0) - 0.1, z0], [x * 1.1, hand(t0), z0], 0.02, 0.02, { color: '#8a7a5a', to: 'bark' }, 3));
      }
    }
    return { object: k.build(parts, { name: 'ropebridge', shadows: true }), floors };
  },

  // the Ewoks' drums: hollow logs with skins stretched over
  drums(k) {
    const parts = [];
    for (const [x, z, h, r] of [
      [0, 0, 1.1, 0.42],
      [0.9, 0.3, 0.8, 0.34],
      [-0.7, 0.6, 0.65, 0.3],
    ]) {
      parts.push(part(cyl(r, r * 0.9, h, 12), { at: [x, 0, z], color: WOOD, to: 'bark' }));
      parts.push(part(cyl(r * 0.92, r * 0.92, 0.04, 12), { at: [x, h, z], color: '#c8b088', to: 'cloth' }));
      parts.push(part(ring(r * 0.95, 0.04, 12), { at: [x, h * 0.75, z], color: '#3a2a1a', to: 'bark' }));
    }
    return { object: k.build(parts, { name: 'drums' }), solids: [{ circle: [0, 0.3, 1.2], top: 1.1 }] };
  },

  // an AT-ST: the boxy head with its chin guns and side weapons, on two
  // long legs with forward knees; 8.6 m tall; it walks (update's move, 0…1)
  atst(k, { color = '#8e8f8a' } = {}) {
    const dark = '#4a4b48';
    const object = new THREE.Group();
    const body = new THREE.Group();
    object.add(body);
    const P = { color, to: 'paint' };
    const M = { color: dark, to: 'metal' };
    const head = loft([
      { z: -1.75, pts: trap8(1.9, 1.6, 1.6, 0.25, 7.35) },
      { z: -0.5, pts: trap8(2.5, 2.1, 2.2, 0.3, 7.4) },
      { z: 1.0, pts: trap8(2.5, 2.0, 2.05, 0.3, 7.35) },
      { z: 2.05, pts: trap8(1.95, 1.2, 1.25, 0.2, 7.0) },
    ]);
    const parts = [part(head, P)];
    // the brow over the viewports, the viewports
    parts.push(part(new THREE.BoxGeometry(2.0, 0.22, 0.9), { at: [0, 8.05, 1.5], rot: [0.5, 0, 0], color, to: 'paint' }));
    for (const x of [-0.42, 0.42]) parts.push(part(new THREE.BoxGeometry(0.55, 0.13, 0.06), { at: [x, 7.62, 1.98], rot: [0.62, 0, 0], color: '#0c0c0c', to: 'dark' }));
    // the top hatch, the chin, the chin guns
    parts.push(part(cyl(0.48, 0.44, 0.18, 14), { at: [0, 8.45, -0.4], color: dark, to: 'metal' }));
    parts.push(part(new THREE.BoxGeometry(1.1, 0.5, 0.9), { at: [0, 6.45, 1.6], color: dark, to: 'metal' }));
    for (const x of [-0.28, 0.28]) parts.push(rod([x, 6.4, 1.8], [x, 6.4, 3.0], 0.07, 0.06, M, 6));
    // side weapons: the twin blaster on the right, the launcher on the left
    parts.push(part(new THREE.BoxGeometry(0.4, 0.55, 1.1), { at: [1.38, 7.25, 0.7], color, to: 'paint' }));
    for (const y of [7.15, 7.38]) parts.push(rod([1.38, y, 1.2], [1.38, y, 2.2], 0.05, 0.05, M, 6));
    parts.push(part(new THREE.BoxGeometry(0.42, 0.6, 1.2), { at: [-1.38, 7.25, 0.6], color, to: 'paint' }));
    parts.push(rod([-1.38, 7.25, 1.1], [-1.38, 7.25, 1.6], 0.16, 0.16, M, 8));
    // the neck, the hip block, the hip actuators
    parts.push(part(cyl(0.5, 0.42, 1.1, 12), { at: [0, 5.55, -0.1], color: dark, to: 'metal' }));
    parts.push(part(new THREE.BoxGeometry(1.7, 0.75, 1.2), { at: [0, 5.65, -0.1], color, to: 'paint' }));
    for (const x of [-1, 1]) parts.push(part(new THREE.CylinderGeometry(0.46, 0.46, 0.45, 14), { at: [x * 1.0, 5.65, -0.1], rot: [0, 0, PI / 2], color: dark, to: 'metal' }));
    body.add(k.build(parts, { name: 'atst-head' }));
    const legs = [];
    for (const x of [-1.32, 1.32]) {
      const leg = walkerLeg(k, {
        name: 'atst',
        at: [x, 5.65, -0.1],
        thigh: [-2.2, 0.95],
        shin: [-2.75, -1.25],
        parts: {
          upper: [
            part(new THREE.CylinderGeometry(0.38, 0.38, 0.35, 12), { rot: [0, 0, PI / 2], color: dark, to: 'metal' }),
            between(new THREE.BoxGeometry(0.5, 1, 0.75), [0, 0, 0], [0, -2.2, 0.95], P),
            part(new THREE.BoxGeometry(0.12, 1.9, 1.0), { at: [Math.sign(x) * 0.3, -1.05, 0.4], rot: [-0.4, 0, 0], color, to: 'paint' }),
          ],
          lower: [
            part(new THREE.CylinderGeometry(0.32, 0.32, 0.6, 12), { rot: [0, 0, PI / 2], color: dark, to: 'metal' }),
            between(new THREE.BoxGeometry(0.42, 1, 0.55), [0, 0, 0], [0, -2.75, -1.25], P),
            rod([0, -0.3, 0.25], [0, -2.5, -0.85], 0.07, 0.07, M, 6),
          ],
          foot: [
            part(new THREE.CylinderGeometry(0.26, 0.26, 0.5, 10), { rot: [0, 0, PI / 2], color: dark, to: 'metal' }),
            part(new THREE.BoxGeometry(1.0, 0.32, 1.5), { at: [0, -0.5, 0.25], color, to: 'paint' }),
            part(new THREE.BoxGeometry(0.3, 0.22, 0.7), { at: [-0.32, -0.56, 1.2], rot: [0, -0.25, 0], color: dark, to: 'metal' }),
            part(new THREE.BoxGeometry(0.3, 0.22, 0.7), { at: [0.32, -0.56, 1.2], rot: [0, 0.25, 0], color: dark, to: 'metal' }),
            part(new THREE.BoxGeometry(0.3, 0.22, 0.6), { at: [0, -0.56, -0.7], color: dark, to: 'metal' }),
            rod([0, -0.1, 0], [0, -0.45, 0.1], 0.2, 0.25, M, 8),
          ],
        },
      });
      object.add(leg.hip);
      legs.push(leg);
    }
    // (the legs hang from the body's hips, so they bob with it)
    return { object, solids: [{ circle: [0, 0, 1.6] }], update: gait(legs, body, { rate: 0.5, swing: 0.3, fold: 0.6, bob: 0.2 }) };
  },

  // the back door: the shield generator's bunker, an armoured entrance cut
  // into a mound of earth, its blast doors shut; 12 m across
  bunker(k) {
    const parts = [];
    const P = { color: IMPERIAL, to: 'paint' };
    const M = { color: '#5c5e5a', to: 'metal' };
    // the mound it's dug into, mossy
    parts.push(part(blob(41, { lump: 0.3, flat: 0.2 }), { at: [0, -2.5, -11], scale: [38, 22, 30], color: '#4a5530', to: 'adobe' }));
    parts.push(part(blob(42, { lump: 0.4, flat: 0.2 }), { at: [-12, -2, -4], scale: [16, 11, 14], color: '#46502c', to: 'adobe' }), part(blob(43, { lump: 0.4, flat: 0.2 }), { at: [12, -2, -4], scale: [16, 10, 14], color: '#4a5430', to: 'adobe' }));
    // the entrance block: sloped sides, a flat roof
    parts.push(
      part(
        loft([
          { z: -4, pts: trap8(12.5, 10, 6, 0.5, 3) },
          { z: 2.6, pts: trap8(12.5, 10, 6, 0.5, 3) },
        ]),
        P,
      ),
    );
    // the overhang over the doors, its lip
    parts.push(part(new THREE.BoxGeometry(11, 0.7, 2.6), { at: [0, 5.55, 3.4], rot: [0.12, 0, 0], color: IMPERIAL, to: 'paint' }));
    parts.push(part(new THREE.BoxGeometry(11.2, 0.3, 0.3), { at: [0, 5.1, 4.6], color: '#5c5e5a', to: 'metal' }));
    // the doors in their frame
    parts.push(part(box(6.2, 4.8, 0.5), { at: [0, 0, 2.65], color: '#5c5e5a', to: 'metal' }));
    parts.push(part(box(5.0, 4.1, 0.3), { at: [0, 0, 2.85], color: '#1a1b1a', to: 'dark' }));
    for (const x of [-1.24, 1.24]) parts.push(part(box(2.42, 4.0, 0.25), { at: [x, 0, 2.95], color: '#8c8e88', to: 'metal' }));
    for (let i = 1; i < 5; i++) parts.push(part(box(4.9, 0.06, 0.05), { at: [0, i * 0.8, 3.08], color: '#5a5c58', to: 'metal' }));
    // the flanking walls, angled out
    for (const s of [-1, 1]) {
      parts.push(part(box(0.8, 4.4, 3.6), { at: [s * 5.6, 0, 3.6], rot: [0, s * 0.35, 0], color: IMPERIAL, to: 'paint' }));
      parts.push(part(box(0.6, 0.4, 0.4), { at: [s * 3.4, 3.9, 3.05], color: new THREE.Color('#ffd27a').multiplyScalar(2.2), to: 'glow' }));
    }
    // a control panel, vents and an antenna on top
    parts.push(part(box(0.7, 1.2, 0.3), { at: [3.6, 0.6, 3.05], color: '#3a3c3a', to: 'metal' }));
    parts.push(part(box(0.4, 0.25, 0.05), { at: [3.6, 1.4, 3.22], color: new THREE.Color('#ff5040').multiplyScalar(2), to: 'glow' }));
    for (const x of [-3, 0, 3]) parts.push(part(box(1.4, 0.6, 1.4), { at: [x, 6, -1.5], ...M }));
    parts.push(rod([2.5, 6, -2.5], [2.5, 11, -2.5], 0.08, 0.05, M, 6));
    parts.push(part(dome(0.9, 0.4, 12), { at: [-3.5, 6.5, -2.8], rot: [0.6, 0, 0], ...M }));
    // ferns on its mound
    for (let i = 0; i < 6; i++) {
      const f = fernParts({ seed: 70 + i, len: 1.6 }).parts;
      const a = (i / 6) * PI + 0.2;
      for (const fp of f) parts.push({ ...fp, at: [cos(a) * 10, 6.5 + sin(i) * 1.5, -10 - sin(a) * 7] });
    }
    return { object: k.build(parts, { name: 'bunker' }), solids: [{ box: [0, -8, 14, 12, 0] }, { box: [-5.6, 3.6, 0.5, 1.8, -0.35] }, { box: [5.6, 3.6, 0.5, 1.8, 0.35] }] };
  },

  // the earth bank the bunker's model is dug into: the mound and its two
  // shoulders, ferns on top (its front 2.5 m behind the model's doors)
  bunkerbank(k) {
    const parts = [];
    parts.push(part(blob(41, { lump: 0.3, flat: 0.2 }), { at: [0, -2.5, -11], scale: [38, 22, 30], color: '#4a5530', to: 'adobe' }));
    parts.push(part(blob(42, { lump: 0.4, flat: 0.2 }), { at: [-12, -2, -4], scale: [16, 11, 14], color: '#46502c', to: 'adobe' }), part(blob(43, { lump: 0.4, flat: 0.2 }), { at: [12, -2, -4], scale: [16, 10, 14], color: '#4a5430', to: 'adobe' }));
    for (let i = 0; i < 6; i++) {
      const f = fernParts({ seed: 70 + i, len: 1.6 }).parts;
      const a = (i / 6) * PI + 0.2;
      for (const fp of f) parts.push({ ...fp, at: [cos(a) * 10, 6.5 + sin(i) * 1.5, -10 - sin(a) * 7] });
    }
    return { object: k.build(parts, { name: 'bunkerbank' }), solids: [{ box: [0, -11, 16, 12, 0] }, { circle: [-12, -4, 6] }, { circle: [12, -4, 6] }] };
  },

  // the shield generator, as the film's matte has it: a wide concrete
  // apron with a blast wall round it, the control block (panelled, lit
  // strips, the Empire's crest over its door, vents and masts on top), and
  // over it the great dish on its lattice tower, ribbed, its rim lit,
  // turned to the sky where the station hangs; 70 m tall
  shieldgen(k) {
    const parts = [];
    const P = { color: IMPERIAL, to: 'paint' };
    const M = { color: '#5c5e5a', to: 'metal' };
    const C = { color: '#7c7e78', to: 'concrete' };
    const warm = new THREE.Color('#ffd27a').multiplyScalar(1.8);
    // the apron, stepped, and the blast wall round it with its gaps
    parts.push(part(box(56, 2.2, 56), C));
    parts.push(part(box(50, 1.8, 50), { at: [0, 2.2, 0], ...C }));
    for (const s of [-1, 1]) {
      for (const [x, z, w, d] of [[s * 27, 0, 1.6, 18], [0, s * 27, 18, 1.6]]) {
        parts.push(part(box(w, 3.6, d), { at: [x, 2.2, z], color: '#8a8c86', to: 'concrete' }));
        parts.push(part(box(w + 0.3, 0.5, d + 0.3), { at: [x, 5.8, z], ...M }));
      }
    }
    // the control block: two storeys, panelled, a lit strip round each
    parts.push(part(loft([{ z: -15, pts: trap8(32, 30, 9, 0.6, 8.5) }, { z: 15, pts: trap8(32, 30, 9, 0.6, 8.5) }]), P));
    parts.push(part(box(22, 5, 22), { at: [0, 13, 0], color: '#878a84', to: 'paint' }));
    for (let i = 0; i < 14; i++) for (const s of [-1, 1]) parts.push(part(box(0.12, 8, 0.6), { at: [-13 + i * 2, 4.5, s * 15.1], color: '#5a5c58', to: 'metal' }));
    for (const s of [-1, 1]) {
      parts.push(part(new THREE.BoxGeometry(26, 0.3, 0.2), { at: [0, 11.6, s * 15.15], color: warm, to: 'glow' }));
      parts.push(part(new THREE.BoxGeometry(0.2, 0.3, 26), { at: [s * 15.15, 11.6, 0], color: warm, to: 'glow' }));
      parts.push(part(new THREE.BoxGeometry(18, 0.25, 0.2), { at: [0, 17.2, s * 11.05], color: warm, to: 'glow' }));
    }
    // the door, the crest over it, lamps either side, a ramp down to the apron
    parts.push(part(box(5, 5.5, 0.5), { at: [0, 4, 15.2], color: '#1a1b1a', to: 'dark' }));
    parts.push(part(insignia('imperial', 2.6), { at: [0, 8.9, 15.35], color: '#e8e8e4', to: 'paint' }));
    for (const s of [-1, 1]) parts.push(part(box(0.5, 0.5, 0.3), { at: [s * 3.4, 7.6, 15.3], color: warm, to: 'glow' }));
    parts.push(part(box(7, 0.4, 7), { at: [0, 3.8, 18.5], rot: [0.08, 0, 0], ...M }));
    // vents, a cooling stack and two masts on the roof
    for (const x of [-8, -3, 2, 7]) parts.push(part(box(2.2, 1, 2.2), { at: [x, 18, -8], ...M }));
    parts.push(part(cyl(1.6, 1.2, 6, 12), { at: [8, 18, 6], ...M }));
    parts.push(rod([-9, 18, 8], [-9, 30, 8], 0.14, 0.06, M, 6));
    parts.push(part(new THREE.SphereGeometry(0.28, 8, 6), { at: [-9, 30.2, 8], color: new THREE.Color('#ff5040').multiplyScalar(2.4), to: 'glow' }));
    parts.push(part(dome(1.3, 0.6, 12), { at: [-4, 18, 7], rot: [0.5, 0, 0], ...M }));
    // the tower: four legs leaning in, braced twice over, a platform at the top
    const legs = [
      [-13, -13],
      [13, -13],
      [13, 13],
      [-13, 13],
    ];
    for (const [x, z] of legs) {
      parts.push(rod([x, 4, z], [x * 0.32, 46, z * 0.32], 1.3, 0.8, M, 8));
      parts.push(part(cyl(2.2, 1.8, 1.2, 10), { at: [x, 4, z], ...M }));
    }
    for (let i = 0; i < 4; i++) {
      const [x0, z0] = legs[i];
      const [x1, z1] = legs[(i + 1) % 4];
      for (const [y0, y1, s0, s1] of [
        [8, 22, 0.94, 0.71],
        [22, 8, 0.71, 0.94],
        [22, 36, 0.71, 0.48],
        [36, 22, 0.48, 0.71],
        [36, 46, 0.48, 0.32],
        [46, 36, 0.32, 0.48],
        [22, 22, 0.71, 0.71],
        [36, 36, 0.48, 0.48],
      ])
        parts.push(rod([x0 * s0, y0, z0 * s0], [x1 * s1, y1, z1 * s1], 0.32, 0.32, M, 6));
    }
    parts.push(part(cyl(4.5, 3.6, 34, 16), { at: [0, 12, 0], ...P }));
    for (let i = 1; i < 5; i++) parts.push(part(ring(4.4 - i * 0.2, 0.18, 24), { at: [0, 12 + i * 7, 0], ...M }));
    parts.push(part(box(12, 1, 12), { at: [0, 46, 0], ...M }));
    parts.push(part(cyl(5, 3, 4, 16), { at: [0, 47, 0], ...M }));
    // the dish, tilted to the sky: a mesh of ribs round a ribbed bowl, its
    // rim lit, the feed on its spike
    const tilt = [-0.45, 0, 0];
    const at = [0, 51, 0];
    // (a point in the dish's own frame, tilted with it and set where it stands)
    const T = ([x, y, z]) => [at[0] + x, at[1] + y * cos(tilt[0]) - z * sin(tilt[0]), at[2] + y * sin(tilt[0]) + z * cos(tilt[0])];
    const bowl = upright(
      Array.from({ length: 11 }, (_, i) => {
        const r = (i / 10) * 27;
        return [r, (r * r) / 85];
      }),
      48,
    );
    parts.push(part(bowl, { at, rot: tilt, color: '#9a9c96', to: 'cloth' }));
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * TAU;
      const rr = 27;
      parts.push(rod(T([0, 0.2, 0]), T([sin(a) * rr, (rr * rr) / 85 + 0.2, cos(a) * rr]), 0.22, 0.14, M, 5));
    }
    for (const [r, tube] of [[27, 0.7], [18, 0.3], [9, 0.25]]) parts.push(part(ring(r, tube, 48), { at: T([0, (r * r) / 85, 0]), rot: tilt, color: '#5c5e5a', to: 'metal' }));
    parts.push(part(ring(27.4, 0.18, 48), { at: T([0, 8.6, 0]), rot: tilt, color: new THREE.Color('#9ad8ff').multiplyScalar(2.2), to: 'glow' }));
    parts.push(part(new THREE.ConeGeometry(1.2, 18, 10).translate(0, 9, 0), { at, rot: tilt, color: '#6a6c68', to: 'metal' }));
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * TAU;
      parts.push(rod(T([sin(a) * 12, 1.7, cos(a) * 12]), T([0, 17, 0]), 0.12, 0.08, M, 5));
    }
    parts.push(part(new THREE.SphereGeometry(1.1, 10, 8), { at: T([0, 18, 0]), color: new THREE.Color('#ff6a50').multiplyScalar(2.5), to: 'glow' }));
    return { object: k.build(parts, { name: 'shieldgen', shadows: false }), solids: [{ box: [0, 0, 16, 15, 0] }, { box: [27, 0, 0.8, 9, 0] }, { box: [-27, 0, 0.8, 9, 0] }, { box: [0, 27, 9, 0.8, 0] }, { box: [0, -27, 9, 0.8, 0] }], floors: [{ x: 0, z: 0, hw: 28, hd: 28, yaw: 0, y: 2.2 }, { x: 0, z: 0, hw: 25, hd: 25, yaw: 0, y: 4 }] };
  },

  // the Tydirium: a Lambda-class shuttle set down, wings folded up, its
  // ramp down; 20 m tall
  lambda(k, { color = '#d6d6d0' } = {}) {
    const P = { color, to: 'paint' };
    const M = { color: '#6a6c68', to: 'metal' };
    const hull = loft([
      { z: -6.2, pts: trap8(3.2, 2.8, 2.6, 0.3, 3.4) },
      { z: -4.6, pts: trap8(4.2, 3.8, 3.4, 0.35, 3.5) },
      { z: 2.8, pts: trap8(4.2, 3.6, 3.2, 0.35, 3.5) },
      { z: 5.4, pts: trap8(3.0, 2.2, 2.4, 0.3, 3.3) },
      { z: 7.6, pts: trap8(1.6, 0.8, 1.1, 0.15, 3.0) },
    ]);
    const parts = [part(hull, P)];
    // the cockpit's windows
    parts.push(part(new THREE.BoxGeometry(1.9, 0.5, 0.06), { at: [0, 4.15, 6.15], rot: [-0.95, 0, 0], color: '#1a2228', to: 'glass' }));
    // the fin, the wings folded up
    const fin = new THREE.Shape([new THREE.Vector2(-4.6, 0), new THREE.Vector2(2.2, 0), new THREE.Vector2(-1.6, 14.6), new THREE.Vector2(-3.8, 14.6)]);
    parts.push(part(new THREE.ExtrudeGeometry(fin, { depth: 0.4, bevelEnabled: false }).translate(0, 0, -0.2).rotateY(PI / 2), { at: [0, 5, 0], color, to: 'paint' }));
    const wing = new THREE.Shape([new THREE.Vector2(-4.4, 0), new THREE.Vector2(2.6, 0), new THREE.Vector2(0.6, 10.2), new THREE.Vector2(-3.6, 10.2)]);
    for (const s of [-1, 1]) {
      const g = new THREE.ExtrudeGeometry(wing, { depth: 0.32, bevelEnabled: false }).translate(0, 0, -0.16).rotateY(PI / 2);
      parts.push(part(g, { at: [s * 2.25, 3.9, 0], rot: [0, 0, -s * 0.2], color, to: 'paint' }));
      // the cannons at the wing roots, the hinge
      parts.push(rod([s * 2.3, 3.6, 1.5], [s * 2.3, 3.6, 4.0], 0.12, 0.1, M, 6));
      parts.push(part(new THREE.CylinderGeometry(0.3, 0.3, 7.2, 10), { at: [s * 2.2, 3.9, -1.0], rot: [PI / 2, 0, 0], color: '#8a8c88', to: 'metal' }));
    }
    // engines at the back
    for (const x of [-0.95, 0.95]) parts.push(part(new THREE.BoxGeometry(1.3, 0.8, 0.2), { at: [x, 3.5, -6.3], color: new THREE.Color('#9ac8ff').multiplyScalar(1.6), to: 'glow' }));
    // landing gear and the ramp
    for (const [x, z] of [
      [0, 4.2],
      [-1.5, -3.5],
      [1.5, -3.5],
    ]) {
      parts.push(rod([x, 2.0, z], [x, 0.15, z], 0.16, 0.16, M, 8));
      parts.push(part(cyl(0.45, 0.5, 0.15, 10), { at: [x, 0, z], ...M }));
    }
    parts.push(part(new THREE.BoxGeometry(2.0, 0.2, 4.2), { at: [0, 1.0, 5.8], rot: [0.42, 0, 0], color: '#a8a8a2', to: 'metal' }));
    return { object: k.build(parts, { name: 'lambda' }), solids: [{ box: [0, -0.5, 2.3, 6.6, 0] }] };
  },

  // Vader's pyre: logs stacked crosswise, the armour laid on top, burning
  pyre(k) {
    const parts = [];
    const B = { color: '#5a3e2a', to: 'bark' };
    for (let i = 0; i < 5; i++) {
      const y = 0.3 + i * 0.42;
      const a = i % 2 ? 0 : PI / 2;
      for (const s of [-0.85, 0, 0.85]) {
        const off = [cos(a) * s, sin(a) * s];
        parts.push(part(new THREE.CylinderGeometry(0.2, 0.22, 2.8, 7), { at: [off[1], y, off[0]], rot: [0, a, PI / 2], ...B }));
      }
    }
    // the armour: the helmet, the chest, the cape
    const top = 0.3 + 5 * 0.42;
    parts.push(part(new THREE.SphereGeometry(0.26, 14, 10, 0, TAU, 0, PI * 0.55), { at: [0, top + 0.18, 0.7], rot: [-1.3, 0, 0], color: '#0c0c0e', to: 'dark' }));
    parts.push(part(new THREE.CylinderGeometry(0.2, 0.33, 0.3, 14, 1, true), { at: [0, top + 0.14, 0.85], rot: [-1.3, 0, 0], color: '#0c0c0e', to: 'dark' }));
    parts.push(part(box(0.55, 0.22, 0.9), { at: [0, top, -0.1], color: '#141416', to: 'dark' }));
    parts.push(part(new THREE.BoxGeometry(0.22, 0.04, 0.16), { at: [0, top + 0.23, 0.05], color: new THREE.Color('#ff3020').multiplyScalar(1.6), to: 'glow' }));
    parts.push(part(new THREE.PlaneGeometry(1.4, 1.9), { at: [0, top + 0.02, -0.4], rot: [-PI / 2, 0, 0], color: '#0a0a0c', to: 'cloth' }));
    const object = k.build(parts, { name: 'pyre' });
    // the flames, licking up round it
    const mat = k.own(new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff8a30').multiplyScalar(2.6), toneMapped: false, transparent: true, opacity: 0.75, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    const flames = [];
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * TAU;
      const f = new THREE.Mesh(k.own(new THREE.ConeGeometry(0.4, 1.8, 8, 1, true).translate(0, 0.9, 0)), mat);
      f.position.set(cos(a) * 0.9, 0.4 + (i % 3) * 0.5, sin(a) * 0.9);
      object.add(f);
      flames.push(f);
    }
    const light = new THREE.PointLight('#ff9a4a', 12, 22, 2);
    light.position.y = 2;
    object.add(light);
    return {
      object,
      solids: [{ circle: [0, 0, 1.6] }],
      update(t) {
        flames.forEach((f, i) => f.scale.set(1, 1 + 0.3 * sin(t * 11 + i * 1.7) + 0.15 * sin(t * 23 + i), 1));
        light.intensity = 11 + 2 * sin(t * 13);
      },
    };
  },

  // the net trap: bait on a stake under a redwood's limb, the net hanging
  // from it, sprung (something still in it)
  nettrap(k) {
    const tree = redwoodParts({ h: 58, r: 2.1, seed: 33 });
    const parts = [...tree.parts];
    const B = { color: '#5a3e2a', to: 'bark' };
    // the limb out over the clearing
    parts.push(rod([1.2, 13, 0], [10, 14.5, 1], 0.5, 0.3, B, 6));
    // the rope, the net bulging with whatever it caught
    parts.push(rod([8.5, 14.3, 0.9], [8.5, 9.6, 0.9], 0.04, 0.04, { color: '#8a7a5a', to: 'bark' }, 4));
    parts.push(part(blob(91, { lump: 0.35 }), { at: [8.5, 8.4, 0.9], scale: [2.4, 2.6, 2.2], color: '#3e3424', to: 'cloth' }));
    for (let i = 0; i < 6; i++) parts.push(part(ring(1.0 - Math.abs(i - 2.5) * 0.18, 0.025, 12), { at: [8.5, 7.4 + i * 0.4, 0.9], color: '#8a7a5a', to: 'bark' }));
    // the stake, and the bait on it
    parts.push(rod([8.5, 0, -3], [8.5, 1.7, -3], 0.07, 0.05, B, 5));
    parts.push(part(blob(92, { lump: 0.4 }), { at: [8.5, 1.25, -2.88], scale: [0.4, 0.75, 0.32], color: '#7a3a2a', to: 'cloth' }));
    return { object: k.build(parts, { name: 'nettrap' }), solids: [{ circle: [0, 0, 2.4] }, { circle: [8.5, -3, 0.2] }] };
  },

  // the Ewoks' log trap: two great logs swung on ropes from the trees,
  // fallen now, crossed, ropes trailing up to the canopy
  logtrap(k) {
    const parts = [];
    const B = { color: '#5c3e2a', to: 'bark' };
    for (const [x, z, a, y] of [
      [-1.5, 0, 0.35, 0.9],
      [1.5, 0.5, -0.4, 0.95],
    ]) {
      parts.push(part(new THREE.CylinderGeometry(0.85, 0.95, 11, 10), { at: [x, y, z], rot: [PI / 2, 0, a], ...B }));
      for (const s of [-4, 4]) parts.push(rod([x + sin(a) * s, y + 0.8, z + cos(a) * s], [x + sin(a) * s * 1.6, 26, z + cos(a) * s * 1.2], 0.05, 0.05, { color: '#8a7a5a', to: 'bark' }, 4));
    }
    return { object: k.build(parts, { name: 'logtrap' }), solids: [{ box: [-1.5, 0, 0.9, 5.5, 0.35], top: 1.8 }, { box: [1.5, 0.5, 0.9, 5.5, -0.4], top: 1.8 }] };
  },
};

// ── Kashyyyk ──

const WOOKIEE_WOOD = '#8a6842';
const WOOKIEE_DARK = '#4e3a26';
const REPUBLIC = '#c4c2b8';
const REPUBLIC_RED = '#8e3424';

// a Wookiee pod-house: walls of curved slats swelling up to a peak, a big
// round doorway; `y` up (on a deck)
function podParts({ r = 3.6, h = 6.4, y = 0, seed = 1, front = 0 } = {}) {
  const prof = [
    [r * 0.92, 0],
    [r, h * 0.2],
    [r * 0.95, h * 0.45],
    [r * 0.72, h * 0.7],
    [r * 0.36, h * 0.88],
    [0.08, h],
  ];
  const parts = [part(trunkGeometry(prof, { seg: 18, furrow: 0.05, ridges: 18, seed }), { at: [0, y, 0], color: WOOKIEE_WOOD, to: 'bark' })];
  // a roof of leaf shingles over the top half, its finial
  parts.push(part(upright(prof.slice(2).map(([rr, yy]) => [rr * 1.04 + 0.1, yy + 0.05]), 18), { at: [0, y, 0], color: '#5a6a34', to: 'leaf' }));
  parts.push(rod([0, y + h - 0.2, 0], [0, y + h + 1.4, 0], 0.12, 0.03, { color: WOOKIEE_DARK, to: 'bark' }, 5));
  // the round doorway, its frame, a window
  const dx = sin(front);
  const dz = cos(front);
  parts.push(part(new THREE.CircleGeometry(r * 0.38, 16), { at: [dx * (r * 0.99), y + r * 0.45, dz * (r * 0.99)], rot: [0, front, 0], color: '#140e08', to: 'dark' }));
  parts.push(part(new THREE.TorusGeometry(r * 0.4, 0.12, 6, 18), { at: [dx * (r * 1.0), y + r * 0.45, dz * (r * 1.0)], rot: [0, front, 0], color: WOOKIEE_DARK, to: 'bark' }));
  parts.push(part(new THREE.CircleGeometry(r * 0.16, 10), { at: [sin(front + 1.2) * r * 0.93, y + h * 0.48, cos(front + 1.2) * r * 0.93], rot: [0, front + 1.2, 0], color: new THREE.Color('#ffb860').multiplyScalar(1.6), to: 'glow' }));
  return parts;
}

const KASHYYYK = {
  // a Wookiee house: a pod of curved slats on a deck on stilts, a ramp up
  // to it; 10 m tall
  wookieehouse(k) {
    const parts = [];
    const D = { color: WOOKIEE_DARK, to: 'bark' };
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + 0.3;
      parts.push(rod([cos(a) * 4.2, -0.3, sin(a) * 4.2], [cos(a) * 4.2, 3.0, sin(a) * 4.2], 0.32, 0.28, D, 7));
      parts.push(rod([cos(a) * 4.2, 0.6, sin(a) * 4.2], [cos(a) * 1.0, 3.0, sin(a) * 1.0], 0.14, 0.12, D, 5));
    }
    parts.push(part(new THREE.CylinderGeometry(5.4, 5.2, 0.5, 24), { at: [0, 3.0, 0], color: WOOKIEE_WOOD, to: 'bark' }));
    parts.push(part(ring(5.35, 0.14, 28), { at: [0, 3.25, 0], color: WOOKIEE_DARK, to: 'bark' }));
    parts.push(...podParts({ r: 3.4, h: 6.6, y: 3.25, seed: 9 }));
    // the ramp, the lanterns either side of it
    parts.push(part(new THREE.BoxGeometry(1.8, 0.2, 5.4), { at: [0, 1.6, 7.4], rot: [-0.62, 0, 0], color: WOOKIEE_WOOD, to: 'bark' }));
    for (const x of [-1.6, 1.6]) {
      parts.push(rod([x, 3.2, 5.0], [x, 4.6, 5.0], 0.06, 0.06, D, 5));
      parts.push(part(new THREE.SphereGeometry(0.18, 8, 6), { at: [x, 4.7, 5.0], color: new THREE.Color('#ffb860').multiplyScalar(2.4), to: 'glow' }));
    }
    return { object: k.build(parts, { name: 'wookieehouse' }), solids: [{ circle: [0, 0, 5.3] }] };
  },

  // Kachirho: the great wroshyr tree on the shore, a city round its foot
  // and up its trunk, a deck you can climb onto at the bottom
  kachirho(k, { H = 230 } = {}) {
    const prof = [
      [24, 0],
      [17, 8],
      [14.5, 30],
      [12.5, 80],
      [10.5, 140],
      [8, 185],
      [4, H],
    ];
    const rand = rng(77);
    const parts = [part(trunkGeometry(prof, { seg: 24, furrow: 0.08, ridges: 9, seed: 77 }), { color: '#7d6c56', to: 'bark' })];
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * TAU + rand() * 0.3;
      parts.push(rod([cos(a) * 9, 26 + rand() * 10, sin(a) * 9], [cos(a) * (34 + rand() * 8), -1, sin(a) * (34 + rand() * 8)], 6.5, 2.2, { color: '#7d6c56', to: 'bark' }, 7));
    }
    // the city: rings of decks up the trunk, pod-houses on them, lights
    const floors = [];
    for (const [y, R, pods] of [
      [7, 34, 0],
      [34, 24, 5],
      [62, 21, 4],
      [96, 18, 3],
    ]) {
      parts.push(part(new THREE.CylinderGeometry(R, R * 0.96, 1.2, 40), { at: [0, y - 0.6, 0], color: WOOKIEE_WOOD, to: 'bark' }));
      parts.push(part(ring(R, 0.4, 44), { at: [0, y - 0.5, 0], color: WOOKIEE_DARK, to: 'bark' }));
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * TAU;
        const rr = radiusAt(prof, y - 8);
        parts.push(rod([cos(a) * rr, y - 9, sin(a) * rr], [cos(a) * R * 0.9, y - 1, sin(a) * R * 0.9], 0.8, 0.6, { color: WOOKIEE_DARK, to: 'bark' }, 6));
      }
      for (let i = 0; i < pods; i++) {
        const a = (i / pods) * TAU + y;
        const d = R - 5;
        for (const p of podParts({ r: 3.2, h: 6, y, seed: i + y, front: a })) parts.push({ ...p, at: [cos(a) * d + (p.at?.[0] ?? 0), p.at?.[1] ?? y, sin(a) * d + (p.at?.[2] ?? 0)] });
      }
      if (y === 7) floors.push({ x: 0, z: 0, r: R, y });
    }
    // round the bottom deck, pod-houses on the beach side, a broad stair
    for (const a of [0.6, 1.3, -0.6, -1.3, 2.4, -2.4]) {
      const d = 26;
      for (const p of podParts({ r: 3.4, h: 6.2, y: 7, seed: a * 10, front: a })) parts.push({ ...p, at: [sin(a) * d + (p.at?.[0] ?? 0), p.at?.[1] ?? 7, cos(a) * d + (p.at?.[2] ?? 0)] });
    }
    const n = 15;
    for (let i = 0; i < n; i++) {
      const z = 34.4 + i * 0.8;
      const y = 7 - (i + 1) * 0.45;
      parts.push(part(box(7, 0.25, 0.86), { at: [0, y - 0.25, z], color: WOOKIEE_WOOD, to: 'bark' }));
      floors.push({ x: 0, z, hw: 3.6, hd: 0.44, yaw: 0, y });
    }
    for (const x of [-3.6, 3.6]) parts.push(rod([x, 7.6, 34], [x, 0.4, 34.4 + n * 0.8], 0.15, 0.15, { color: WOOKIEE_DARK, to: 'bark' }, 5));
    // the crown, vast, far overhead
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * TAU + rand();
      const y = H * (0.62 + rand() * 0.32);
      const len = 30 + rand() * 30;
      const rr = radiusAt(prof, y);
      const end = [cos(a) * (rr + len), y + 10, sin(a) * (rr + len)];
      parts.push(rod([cos(a) * rr * 0.6, y - 6, sin(a) * rr * 0.6], end, 3.2, 1.2, { color: '#7d6c56', to: 'bark' }, 7));
      const s = 34 + rand() * 18;
      parts.push(...canopy(end, s, { flat: 0.38, color: new THREE.Color('#4a6a2c').offsetHSL(0, 0, (rand() - 0.5) * 0.08), seed: 400 + i }));
    }
    parts.push(...canopy([0, H, 0], 50, { flat: 0.44, color: '#47662a', seed: 499 }));
    // lights in its windows, up the trunk
    for (let i = 0; i < 24; i++) {
      const y = 12 + rand() * 120;
      const a = rand() * TAU;
      const rr = radiusAt(prof, y);
      parts.push(part(new THREE.CircleGeometry(0.9, 8), { at: [cos(a) * rr * 1.01, y, sin(a) * rr * 1.01], rot: [0, PI / 2 - a, 0], color: new THREE.Color('#ffb860').multiplyScalar(1.8), to: 'glow' }));
    }
    return { object: k.build(parts, { name: 'kachirho', shadows: false }), floors, solids: [{ circle: [0, 0, 18] }] };
  },

  // a Wookiee catamaran: two slender hulls, a gunner's seat with twin
  // cannons between them, great curved fins sweeping up at the back;
  // riding the lagoon (bobbing)
  catamaran(k) {
    const W = { color: WOOKIEE_WOOD, to: 'bark' };
    const D = { color: WOOKIEE_DARK, to: 'bark' };
    const parts = [];
    for (const x of [-1.7, 1.7]) {
      parts.push(part(new THREE.CapsuleGeometry(0.42, 7.4, 4, 10), { at: [x, 0.5, 0], rot: [PI / 2, 0, 0], scale: [1, 1, 0.8], ...W }));
      parts.push(part(new THREE.ConeGeometry(0.42, 1.6, 10), { at: [x, 0.55, 4.7], rot: [PI / 2, 0, 0], ...W }));
      // the fin, sweeping up and back
      const fin = new THREE.Shape([new THREE.Vector2(-3.8, 0), new THREE.Vector2(-1.4, 0), new THREE.Vector2(-3.2, 2.4), new THREE.Vector2(-5.6, 4.6), new THREE.Vector2(-5.2, 2.2)]);
      parts.push(part(new THREE.ExtrudeGeometry(fin, { depth: 0.12, bevelEnabled: false }).translate(0, 0, -0.06).rotateY(-PI / 2), { at: [x, 0.8, 0], rot: [0, 0, -Math.sign(x) * 0.22], color: '#a07a4a', to: 'bark' }));
    }
    for (const z of [-2.4, 0.4, 2.6]) parts.push(rod([-1.7, 0.9, z], [1.7, 0.9, z], 0.12, 0.12, D, 6));
    parts.push(part(new THREE.SphereGeometry(0.7, 12, 8), { at: [0, 1.1, 1.0], scale: [1, 0.6, 1.4], ...W }));
    parts.push(part(box(0.7, 0.6, 0.15), { at: [0, 1.2, 0.2], color: WOOKIEE_DARK, to: 'cloth' }));
    for (const x of [-0.22, 0.22]) parts.push(rod([x, 1.5, 1.4], [x, 1.55, 3.4], 0.07, 0.06, { color: '#5a5a54', to: 'metal' }, 6));
    const object = k.build(parts, { name: 'catamaran' });
    const holder = new THREE.Group();
    holder.add(object);
    const ph = k.rand() * 10;
    return {
      object: holder,
      solids: [{ box: [0, 0, 2.2, 4.4, 0] }],
      update(t) {
        object.position.y = sin(t * 1.1 + ph) * 0.18;
        object.rotation.z = sin(t * 0.8 + ph) * 0.04;
        object.rotation.x = sin(t * 0.6 + ph * 2) * 0.025;
      },
    };
  },

  // the pod Yoda left Kashyyyk in: a squat rounded capsule on short legs,
  // its hatch open
  yodapod(k) {
    const P = { color: '#b8b6ac', to: 'paint' };
    const parts = [
      part(new THREE.SphereGeometry(1.5, 18, 12), { at: [0, 1.75, 0], scale: [1, 0.9, 1.25], ...P }),
      part(ring(1.5, 0.12, 24), { at: [0, 1.75, 0], color: '#6a6a64', to: 'metal' }),
      part(new THREE.CircleGeometry(0.75, 16), { at: [0, 1.9, 1.86], color: new THREE.Color('#ffd8a0').multiplyScalar(1.2), to: 'glow' }),
      part(new THREE.CylinderGeometry(0.8, 0.8, 0.12, 16), { at: [0.4, 0.95, 2.1], rot: [1.1, 0, 0], ...P }),
      part(cyl(0.5, 0.6, 0.6, 12), { at: [0, 3.0, -0.2], color: '#6a6a64', to: 'metal' }),
    ];
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * TAU + 0.5;
      parts.push(rod([cos(a) * 0.9, 1.0, sin(a) * 0.9], [cos(a) * 1.5, 0, sin(a) * 1.5], 0.09, 0.07, { color: '#6a6a64', to: 'metal' }, 6));
    }
    return { object: k.build(parts, { name: 'yodapod' }), solids: [{ circle: [0, 0, 1.6] }] };
  },

  // a Wookiee barricade: crossed, sharpened logs along the beach, `len` long;
  // chest-high to shoot over (its top: a soldier standing sees over it, one
  // kneeling is hidden behind it)
  barricade(k, { len = 10 } = {}) {
    const parts = [];
    const B = { color: '#6a4e34', to: 'bark' };
    const n = Math.max(2, Math.round(len / 2.2));
    for (let i = 0; i < n; i++) {
      const x = -len / 2 + (i + 0.5) * (len / n);
      for (const s of [-1, 1]) parts.push(rod([x - s * 1.0, -0.2, -0.6], [x + s * 1.0, 2.4, 0.9], 0.18, 0.06, B, 6));
    }
    parts.push(rod([-len / 2, 1.1, 0.1], [len / 2, 1.1, 0.1], 0.2, 0.2, B, 6));
    return { object: k.build(parts, { name: 'barricade' }), solids: [{ box: [0, 0, len / 2, 0.8, 0], top: 1.25 }] };
  },

  // an AT-RT: a clone trooper in an open cockpit on two legs, a repeating
  // blaster under its chin; 3.2 m tall; it walks
  atrt(k) {
    const object = new THREE.Group();
    const body = new THREE.Group();
    object.add(body);
    const P = { color: REPUBLIC, to: 'paint' };
    const M = { color: '#5a5a56', to: 'metal' };
    const parts = [
      // the seat and its frame, the side armour
      part(new THREE.BoxGeometry(0.9, 0.25, 0.9), { at: [0, 2.35, 0], ...P }),
      part(new THREE.BoxGeometry(0.8, 0.9, 0.18), { at: [0, 2.85, -0.42], rot: [-0.15, 0, 0], ...P }),
      part(new THREE.BoxGeometry(0.15, 0.55, 1.2), { at: [-0.55, 2.55, 0.1], ...P }),
      part(new THREE.BoxGeometry(0.15, 0.55, 1.2), { at: [0.55, 2.55, 0.1], ...P }),
      part(new THREE.BoxGeometry(0.6, 0.25, 0.5), { at: [0, 2.3, 0.7], rot: [0.3, 0, 0], color: REPUBLIC_RED, to: 'paint' }),
      // the gun under its chin, the hip block
      rod([0, 2.05, 0.55], [0, 2.05, 1.9], 0.07, 0.06, M, 6),
      part(new THREE.BoxGeometry(0.35, 0.3, 0.5), { at: [0, 2.05, 0.5], ...M }),
      part(new THREE.BoxGeometry(0.8, 0.35, 0.5), { at: [0, 2.12, -0.05], ...M }),
      // the clone at the controls
      part(new THREE.BoxGeometry(0.42, 0.55, 0.28), { at: [0, 2.78, -0.15], color: '#eeeeea', to: 'paint' }),
      part(new THREE.SphereGeometry(0.15, 12, 10), { at: [0, 3.18, -0.12], color: '#eeeeea', to: 'paint' }),
      part(new THREE.BoxGeometry(0.17, 0.04, 0.05), { at: [0, 3.2, 0.02], color: '#101010', to: 'dark' }),
      part(new THREE.BoxGeometry(0.04, 0.09, 0.05), { at: [0, 3.14, 0.025], color: '#101010', to: 'dark' }),
    ];
    for (const x of [-0.26, 0.26]) parts.push(rod([x, 2.95, -0.1], [x * 0.8, 2.6, 0.35], 0.05, 0.05, { color: '#eeeeea', to: 'paint' }, 5));
    body.add(k.build(parts, { name: 'atrt-body' }));
    const legs = [];
    for (const x of [-0.5, 0.5]) {
      const leg = walkerLeg(k, {
        name: 'atrt',
        at: [x, 2.1, -0.05],
        thigh: [-0.95, 0.42],
        shin: [-1.0, -0.48],
        parts: {
          upper: [part(new THREE.CylinderGeometry(0.14, 0.14, 0.2, 10), { rot: [0, 0, PI / 2], ...M }), between(new THREE.BoxGeometry(0.2, 1, 0.32), [0, 0, 0], [0, -0.95, 0.42], P)],
          lower: [part(new THREE.CylinderGeometry(0.12, 0.12, 0.26, 10), { rot: [0, 0, PI / 2], ...M }), between(new THREE.BoxGeometry(0.16, 1, 0.22), [0, 0, 0], [0, -1.0, -0.48], P)],
          foot: [part(new THREE.BoxGeometry(0.42, 0.12, 0.7), { at: [0, -0.1, 0.1], ...P }), part(new THREE.BoxGeometry(0.14, 0.1, 0.3), { at: [0, -0.12, 0.55], ...M })],
        },
      });
      object.add(leg.hip);
      legs.push(leg);
    }
    return { object, solids: [{ circle: [0, 0, 0.7] }], update: gait(legs, body, { rate: 0.9, swing: 0.34, fold: 0.6, bob: 0.08 }) };
  },

  // an AT-AP: a long armoured body on two legs, a heavy cannon over its
  // nose, its third leg folded under; 10 m tall; it walks
  atap(k) {
    const object = new THREE.Group();
    const body = new THREE.Group();
    object.add(body);
    const P = { color: '#a29f94', to: 'paint' };
    const M = { color: '#55554f', to: 'metal' };
    const hull = loft([
      { z: -3.2, pts: trap8(2.8, 2.4, 2.4, 0.3, 7.6) },
      { z: 1.8, pts: trap8(3.2, 2.8, 2.8, 0.3, 7.7) },
      { z: 3.6, pts: trap8(2.4, 1.6, 1.8, 0.25, 7.5) },
    ]);
    const parts = [part(hull, P)];
    parts.push(part(new THREE.BoxGeometry(2.6, 0.35, 0.1), { at: [0, 7.9, 3.45], rot: [0.55, 0, 0], color: '#101418', to: 'dark' }));
    parts.push(part(new THREE.BoxGeometry(3.3, 0.4, 2.2), { at: [0, 9.15, -0.6], color: REPUBLIC_RED, to: 'paint' }));
    // the heavy cannon on top, the chin guns
    parts.push(part(new THREE.BoxGeometry(1.1, 0.8, 2.2), { at: [0, 9.6, 0.6], ...P }));
    parts.push(rod([0, 9.7, 1.6], [0, 9.9, 6.2], 0.24, 0.18, M, 8));
    for (const x of [-0.5, 0.5]) parts.push(rod([x, 6.6, 3.0], [x, 6.6, 4.6], 0.08, 0.07, M, 6));
    // the third leg, folded under the back
    parts.push(rod([0, 6.4, -2.2], [0, 4.6, -3.8], 0.3, 0.26, P, 6));
    parts.push(rod([0, 4.6, -3.8], [0, 5.6, -5.2], 0.24, 0.22, P, 6));
    parts.push(part(new THREE.BoxGeometry(1.0, 0.25, 1.2), { at: [0, 5.6, -5.4], ...M }));
    // the hip block
    parts.push(part(new THREE.BoxGeometry(3.6, 1.0, 1.6), { at: [0, 6.4, -0.4], ...M }));
    body.add(k.build(parts, { name: 'atap-body' }));
    const legs = [];
    for (const x of [-2.0, 2.0]) {
      const leg = walkerLeg(k, {
        name: 'atap',
        at: [x, 6.4, -0.4],
        thigh: [-2.7, 1.2],
        shin: [-3.1, -1.1],
        parts: {
          upper: [part(new THREE.CylinderGeometry(0.55, 0.55, 0.5, 12), { rot: [0, 0, PI / 2], ...M }), between(new THREE.BoxGeometry(0.6, 1, 0.9), [0, 0, 0], [0, -2.7, 1.2], P)],
          lower: [part(new THREE.CylinderGeometry(0.45, 0.45, 0.7, 12), { rot: [0, 0, PI / 2], ...M }), between(new THREE.BoxGeometry(0.5, 1, 0.7), [0, 0, 0], [0, -3.1, -1.1], P)],
          foot: [part(new THREE.CylinderGeometry(0.9, 1.1, 0.5, 12), { at: [0, -0.45, 0.1], ...P }), part(new THREE.BoxGeometry(0.3, 0.2, 1.2), { at: [0, -0.6, 0.9], ...M })],
        },
      });
      object.add(leg.hip);
      legs.push(leg);
    }
    return { object, solids: [{ circle: [0, 0, 2.6] }], update: gait(legs, body, { rate: 0.4, swing: 0.28, fold: 0.5, bob: 0.2 }) };
  },
};

// ── Dagobah ──

const MUD = '#6a5a40';

const DAGOBAH = {
  // Yoda's hut: a lumpy dome of mud and stone under a gnarltree's roots,
  // a smaller one beside it, round windows glowing; 5 m
  yodahut(k) {
    const parts = [];
    const lump = (seed, at, s) => {
      const g = blob(seed, { lump: 0.18, flat: 0 });
      parts.push(part(g, { at, scale: s, color: MUD, to: 'adobe' }));
    };
    lump(61, [0, 0, 0], [5.2, 5.0, 5.0]);
    lump(62, [2.6, 0, -1.4], [3.0, 3.2, 3.0]);
    lump(63, [-2.2, 0, -1.6], [2.4, 2.4, 2.4]);
    // stones in the walls
    for (let i = 0; i < 10; i++) {
      const a = i * 0.7;
      parts.push(part(blob(70 + i, { lump: 0.3, detail: 0 }), { at: [cos(a) * 2.5, 0.4 + (i % 3) * 0.6, sin(a) * 2.5], scale: [0.5, 0.35, 0.4], color: '#7a7464', to: 'stone' }));
    }
    // the door, round, and the windows, glowing
    parts.push(part(new THREE.CircleGeometry(0.6, 16), { at: [0.2, 0.75, 2.52], rot: [-0.25, 0.1, 0], color: '#120c08', to: 'dark' }));
    parts.push(part(new THREE.TorusGeometry(0.62, 0.08, 6, 16), { at: [0.2, 0.75, 2.52], rot: [-0.25, 0.1, 0], color: '#5a4a34', to: 'adobe' }));
    parts.push(part(new THREE.CircleGeometry(0.32, 12), { at: [-1.4, 1.75, 1.95], rot: [-0.4, -0.6, 0], color: new THREE.Color('#ffb050').multiplyScalar(2.2), to: 'glow' }));
    parts.push(part(new THREE.CircleGeometry(0.26, 12), { at: [2.85, 1.3, 0.05], rot: [-0.3, 1.0, 0], color: new THREE.Color('#ffb050').multiplyScalar(2.2), to: 'glow' }));
    // the chimney pipe, and the roots over it all
    parts.push(rod([-0.6, 2.2, -0.8], [-0.7, 3.3, -0.9], 0.18, 0.14, { color: '#5a5446', to: 'metal' }, 8));
    const B = { color: '#4c463a', to: 'bark' };
    for (const [a, h] of [
      [0.4, 4.6],
      [1.6, 4.2],
      [2.9, 4.8],
      [4.3, 4.0],
    ]) {
      parts.push(rod([cos(a) * 4.2, -0.2, sin(a) * 4.2], [cos(a) * 2.6, h * 0.7, sin(a) * 2.6], 0.4, 0.34, B, 6));
      parts.push(rod([cos(a) * 2.6, h * 0.7, sin(a) * 2.6], [cos(a + 0.6) * 0.6, h, sin(a + 0.6) * 0.6], 0.34, 0.3, B, 6));
    }
    parts.push(part(blob(69, { lump: 0.4 }), { at: [0, 4.4, 0], scale: [3.6, 1.6, 3.2], color: '#5a6a3a', to: 'leaf' }));
    const object = k.build(parts, { name: 'yodahut' });
    const light = new THREE.PointLight('#ffb060', 5, 9, 2);
    light.position.set(0, 1.4, 2.8);
    object.add(light);
    return { object, solids: [{ circle: [0, 0, 2.5] }, { circle: [2.6, -1.4, 1.5] }, { circle: [-2.2, -1.6, 1.2] }] };
  },

  // Yoda: 0.66 m, his robe, his ears, his stick
  yoda(k) {
    const skin = '#8b9a5c';
    const parts = [
      part(new THREE.ConeGeometry(0.17, 0.42, 12).translate(0, 0.21, 0), { color: '#b0a07c', to: 'cloth' }),
      part(new THREE.CylinderGeometry(0.11, 0.16, 0.2, 12), { at: [0, 0.4, 0], color: '#8a7a5c', to: 'cloth' }),
      part(new THREE.SphereGeometry(0.115, 14, 10), { at: [0, 0.56, 0.01], scale: [1.1, 0.95, 1], color: skin, to: 'paint' }),
      part(new THREE.SphereGeometry(0.03, 8, 6), { at: [-0.045, 0.57, 0.1], color: '#2a2418', to: 'dark' }),
      part(new THREE.SphereGeometry(0.03, 8, 6), { at: [0.045, 0.57, 0.1], color: '#2a2418', to: 'dark' }),
      // hands, and the gimer stick
      part(new THREE.SphereGeometry(0.03, 8, 6), { at: [0.12, 0.34, 0.08], color: skin, to: 'paint' }),
      rod([0.14, 0.02, 0.14], [0.11, 0.48, 0.08], 0.012, 0.01, { color: '#6a5a3a', to: 'bark' }, 5),
    ];
    const object = new THREE.Group();
    const body = k.build(parts, { name: 'yoda' });
    object.add(body);
    // the ears (they droop, and twitch)
    const ears = [];
    for (const s of [-1, 1]) {
      const ear = new THREE.Group();
      ear.position.set(s * 0.1, 0.58, 0);
      ear.add(k.build([part(new THREE.ConeGeometry(0.045, 0.2, 8).translate(0, 0.1, 0), { rot: [0, 0, -s * 1.35], scale: [1, 1, 0.45], color: skin, to: 'paint' })], { name: 'yoda-ear' }));
      object.add(ear);
      ears.push({ ear, s });
    }
    return {
      object,
      solids: [{ circle: [0, 0, 0.2] }],
      update(t, dt, move = 0) {
        body.position.y = Math.abs(sin(t * 6)) * 0.02 * move;
        body.rotation.z = sin(t * 6) * 0.06 * move;
        for (const { ear, s } of ears) ear.rotation.z = s * (sin(t * 0.7 + s) * 0.08 + (sin(t * 3.1) > 0.97 ? 0.15 : 0));
      },
    };
  },

  // Obi-Wan, more powerful than you can possibly imagine: a figure of blue
  // light in his robe, flickering
  ghostben(k) {
    const parts = [
      part(new THREE.ConeGeometry(0.38, 1.1, 14, 1, true).translate(0, 0.55, 0), { color: '#9ccaff', to: 'glow' }),
      part(new THREE.CylinderGeometry(0.18, 0.24, 0.6, 12), { at: [0, 1.3, 0], color: '#9ccaff', to: 'glow' }),
      part(new THREE.SphereGeometry(0.12, 12, 10), { at: [0, 1.7, 0.02], color: '#c8e2ff', to: 'glow' }),
      part(new THREE.ConeGeometry(0.09, 0.2, 8), { at: [0, 1.58, 0.08], rot: [PI, 0, 0], color: '#d8ecff', to: 'glow' }),
      rod([-0.22, 1.5, 0], [-0.18, 1.0, 0.18], 0.07, 0.06, { color: '#9ccaff', to: 'glow' }, 6),
      rod([0.22, 1.5, 0], [0.18, 1.0, 0.18], 0.07, 0.06, { color: '#9ccaff', to: 'glow' }, 6),
    ];
    const mat = k.own(new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.42, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    const mesh = new THREE.Mesh(k.geometry(parts), mat);
    const object = new THREE.Group();
    object.add(mesh);
    return {
      object,
      update(t) {
        mat.opacity = 0.36 + 0.06 * sin(t * 2.3) + 0.03 * sin(t * 17);
        mesh.position.y = 0.05 + sin(t * 0.9) * 0.04;
      },
    };
  },

  // Luke's X-wing, sinking in the bog, its nose up out of the water
  xwingbog(k, { pitch = -0.32, roll = 0.18, sink = 1.4 } = {}) {
    const m = buildGalaxyShip('xwing');
    k.own({ dispose: () => m.dispose() });
    m.group.scale.setScalar(12.5);
    m.group.rotation.set(pitch, 0, roll, 'YXZ');
    m.group.position.y = -sink;
    const object = new THREE.Group();
    object.add(m.group);
    // weed and slime hanging off its wings
    const weed = [];
    for (let i = 0; i < 5; i++) weed.push(part(new THREE.ConeGeometry(0.15, 0.9, 4), { at: [-4 + i * 2, 0.6 + (i % 2) * 0.5, -1 + i * 0.4], rot: [PI, 0, 0], color: '#4a5a30', to: 'leaf' }));
    object.add(k.build(weed, { name: 'weed' }));
    // raised (a quest's `raise` signal; off puts it back): up out of the
    // bog over four seconds, levelling as it comes, then hanging there just
    // over the water, rocking a little
    let rise = 0;
    let to = 0;
    return {
      object,
      solids: [{ box: [0, 0, 4.5, 5.5, 0] }],
      signal(name, on) {
        if (name === 'raise') to = on ? 1 : 0;
      },
      update(t, dt = 0) {
        m.update?.(t);
        rise = to ? Math.min(1, rise + dt / 4) : 0;
        const e = rise * rise * (3 - 2 * rise);
        const sway = e * Math.sin(t * 1.3) * 0.03;
        m.group.rotation.set(pitch * (1 - e) + sway, 0, roll * (1 - e) - sway, 'YXZ');
        m.group.position.y = -sink + e * (sink + 1.6) + Math.sin(rise * Math.PI) * 1.5;
      },
    };
  },

  // the cave: a vast black tree, dead, its roots arching over a hole down
  // into the dark side
  cavetree(k) {
    const g = gnarlParts({ seed: 66, bark: '#2a2622', moss: '#3a3e2c', leaf: '#2e3424', h: 14, roots: 7 });
    const parts = g.parts.map((p) => ({ ...p, scale: 1 }));
    const object = new THREE.Group();
    const tree = k.build(parts, { name: 'cavetree' });
    tree.scale.setScalar(1.9);
    object.add(tree);
    // the mouth: a black hollow under the roots, at the front
    const mouth = k.build(
      [
        part(new THREE.SphereGeometry(2.2, 16, 10, 0, TAU, 0, PI / 2), { at: [0, -0.6, 4.5], scale: [1.3, 1.0, 1.0], color: '#050505', to: 'dark' }),
        part(blob(67, { lump: 0.3, flat: 0 }), { at: [0, -0.3, 1.5], scale: [8, 4, 6], color: '#2c2a22', to: 'adobe' }),
      ],
      { name: 'cavemouth' },
    );
    object.add(mouth);
    return { object, solids: [{ circle: [0, 0, 4.2] }, { circle: [-3.5, 2.5, 1.5] }, { circle: [3.5, 2.5, 1.5] }] };
  },

  // the rocks Luke lifted, still hanging in the air, turning slowly
  floatrocks(k) {
    const object = new THREE.Group();
    const rocks = [];
    for (let i = 0; i < 4; i++) {
      const r = k.build([part(rockGeometry(80 + i, { sharp: 0.4 }), { scale: 0.5 + i * 0.2, color: '#6e6a5a', to: 'rock' })], { name: 'floatrock' });
      r.position.set(cos(i * 1.7) * 1.6, 1.2 + i * 0.5, sin(i * 1.7) * 1.6);
      object.add(r);
      rocks.push(r);
    }
    return {
      object,
      update(t) {
        rocks.forEach((r, i) => {
          r.position.y = 1.2 + i * 0.5 + sin(t * 0.8 + i * 1.3) * 0.25;
          r.rotation.y = t * 0.15 * (i % 2 ? 1 : -1);
          r.rotation.x = sin(t * 0.4 + i) * 0.2;
        });
      },
    };
  },

  // a dragonsnake, its coils breaking the black water as it circles; now and
  // then its head rears up out of it (a cone, till its model is here: the
  // Meshy head and neck, worn by `wear`, rising higher)
  dragonsnake(k, { r = 7 } = {}) {
    const mat = k.own(new THREE.MeshStandardMaterial({ color: '#3a4430', roughness: 0.4 }));
    const hump = k.own(new THREE.TorusGeometry(0.9, 0.32, 8, 12, PI));
    const object = new THREE.Group();
    const humps = [];
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(hump, mat);
      m.scale.setScalar(1 - i * 0.1);
      object.add(m);
      humps.push(m);
    }
    const head = new THREE.Group();
    const cone = new THREE.Mesh(k.own(new THREE.ConeGeometry(0.35, 1.4, 8).rotateX(PI / 2)), mat);
    head.add(cone);
    object.add(head);
    let neck = null;
    return {
      object,
      // (its 4.5 m model, shrunk to the coils: 3.6 m, of which 2.6 m clears
      // the water at the top of a rear and none at the bottom)
      wear: {
        url: '/models/galaxy/surface/dragonsnake.glb',
        on(o) {
          o.scale.setScalar(0.8);
          head.add(o);
          cone.visible = false;
          neck = o;
        },
      },
      update(t) {
        const s = t * 0.18;
        humps.forEach((m, i) => {
          const a = s - i * 0.28;
          m.position.set(cos(a) * r, -0.35 + sin(t * 1.4 + i) * 0.12, sin(a) * r);
          m.rotation.set(0, -a, 0);
        });
        const up = Math.max(0, sin(t * 0.35)) ** 3;
        const a = s + 0.3;
        if (neck) {
          head.position.set(cos(a) * r, -3.7 + up * 2.7, sin(a) * r);
          head.rotation.set(0, -a + PI, 0);
        } else {
          head.position.set(cos(a) * r, -0.6 + up * 1.4, sin(a) * r);
          head.rotation.set(-up * 0.6, -a + PI, 0);
        }
      },
    };
  },

  // a bogwing: a little flapping swamp-flier
  bogwing(k, { color = '#5a5040' } = {}) {
    const body = k.build([part(new THREE.SphereGeometry(0.1, 8, 6), { scale: [1, 0.8, 2.2], color, to: 'leaf' }), part(new THREE.ConeGeometry(0.04, 0.3, 5), { at: [0, 0, -0.3], rot: [-PI / 2, 0, 0], color, to: 'leaf' })], { name: 'bogwing' });
    const object = new THREE.Group();
    object.add(body);
    const wings = [];
    for (const s of [-1, 1]) {
      const w = new THREE.Group();
      w.add(k.build([part(new THREE.PlaneGeometry(0.42, 0.26).translate(s * 0.22, 0, 0), { rot: [-PI / 2, 0, 0], color: '#7a6a50', to: 'leaf' })], { name: 'wing' }));
      object.add(w);
      wings.push({ w, s });
    }
    return {
      object,
      update(t) {
        for (const { w, s } of wings) w.rotation.z = s * sin(t * 16) * 0.8;
      },
    };
  },
};

// ── Yavin 4 ──

const MASSASSI = '#8c8472';
const MASSASSI_DARK = '#6a6354';
const VINE = '#3c5a26';

// a straight flight of steps along z, from (x, z0) at y0 rising by `rise`
// per step to y1, `dir` ±1 along z: its parts and its floors, with a
// landing at the top that reaches across to the wall it climbs beside (at
// x = wall)
function flight(x, z0, y0, y1, dir, wall, { wide = 3, rise = 0.45, tread = 0.8, color = MASSASSI } = {}) {
  const parts = [];
  const floors = [];
  // (the rise spread evenly, so the last step up to the landing is no taller)
  const n = Math.ceil((y1 - y0) / rise) - 1;
  const r = (y1 - y0) / (n + 1);
  for (let i = 0; i < n; i++) {
    const y = y0 + (i + 1) * r;
    const z = z0 + dir * (i + 0.5) * tread;
    parts.push(part(box(wide, 0.5, tread + 0.04), { at: [x, y - 0.5, z], color, to: 'stone' }));
    floors.push({ x, z, hw: wide / 2, hd: tread / 2 + 0.04, yaw: 0, y });
  }
  const zl = z0 + dir * (n + 0.75) * tread;
  // the landing, from the stair's outer edge to just over the wall's top
  const outer = x + Math.sign(x - wall) * (wide / 2);
  const inner = wall - Math.sign(x - wall) * 0.8;
  parts.push(part(box(Math.abs(outer - inner), 0.5, tread * 1.5), { at: [(outer + inner) / 2, y1 - 0.5, zl], color, to: 'stone' }));
  floors.push({ x: (outer + inner) / 2, z: zl, hw: Math.abs(outer - inner) / 2, hd: tread * 0.75 + 0.05, yaw: 0, y: y1 });
  // a sloped plinth under the steps
  const len = n * tread;
  parts.push(part(new THREE.BoxGeometry(wide * 0.9, 0.5, Math.hypot(len, y1 - y0)), { at: [x, (y0 + y1) / 2 - 0.6, z0 + (dir * len) / 2], rot: [dir * Math.atan2(y1 - y0, len), 0, 0], color: MASSASSI_DARK, to: 'stone' }));
  return { parts, floors, end: zl };
}

// a stepped block of tiers (x, z half-sizes and heights), each with its
// cornice and a vine or two over its lip
function tiers(list, { seed = 1, zo = 0 } = {}) {
  const rand = rng(seed);
  const parts = [];
  let y = 0;
  for (const [hw, hd, h] of list) {
    parts.push(part(box(hw * 2, h, hd * 2), { at: [0, y, zo], color: MASSASSI, to: 'stone' }));
    parts.push(part(box(hw * 2 + 1.2, 0.9, hd * 2 + 1.2), { at: [0, y + h - 0.9, zo], color: MASSASSI_DARK, to: 'stone' }));
    // courses: a dark band halfway up
    parts.push(part(box(hw * 2 + 0.3, 0.35, hd * 2 + 0.3), { at: [0, y + h * 0.45, zo], color: MASSASSI_DARK, to: 'stone' }));
    // vines and moss down its faces
    for (let i = 0; i < 6; i++) {
      const side = Math.floor(rand() * 4);
      const along = (rand() - 0.5) * 1.7;
      const [x, z, ry] = side === 0 ? [along * hw, hd + 0.3, 0] : side === 1 ? [along * hw, -hd - 0.3, 0] : side === 2 ? [hw + 0.3, along * hd, PI / 2] : [-hw - 0.3, along * hd, PI / 2];
      const l = h * (0.4 + rand() * 0.55);
      parts.push(part(new THREE.BoxGeometry(1.5 + rand() * 3, l, 0.3), { at: [x, y + h - l / 2, z + zo], rot: [0, ry, 0], color: new THREE.Color(VINE).offsetHSL(0, 0, (rand() - 0.5) * 0.08), to: 'leaf' }));
    }
    y += h;
  }
  return { parts, top: y };
}

// the Great Temple's model (massassi.glb at 96 m), measured off a height
// map of it: its terraces, square round its middle, as [half-width, top];
// the hangar a tunnel x ±10.4 under a roof at 10.8, open from the front
// (+z) back to z 11.5, where hangarfloor's back wall closes it off from the
// tunnel crossing it; and the stair up the middle of its east face, as
// [distance out, height] (17 m wide)
const TERRACES = [
  [46, 1.6],
  [40, 11.3],
  [32.5, 19.9],
  [27.9, 28.9],
  [19.5, 36],
  [12.5, 49.4],
  [8.5, 52.4],
];
const HANGAR = { hw: 10.4, roof: 10.8, back: 11.5, front: 46 };
const EAST_STAIR = [
  [42, 12.6],
  [39.5, 13],
  [38.5, 14.1],
  [37.5, 16.3],
  [36.5, 17.3],
  [35.5, 19.3],
  [34.5, 20.3],
  [33.5, 22.6],
  [32.5, 23.7],
  [31.5, 24.8],
  [30.5, 27],
  [29.5, 28.2],
  [28.5, 29],
  [26.5, 29],
  [25.5, 30.9],
  [24.5, 32.3],
  [23.5, 34.5],
  [22.5, 35.7],
  [21.5, 36.9],
  [20.5, 39.3],
  [19.5, 40.4],
  [18.5, 42.6],
  [17.5, 43.7],
  [16.5, 44.9],
  [15.5, 47.1],
  [14.5, 48.2],
  [13, 49.4],
];
// (its height at r, between the measured points)
const eastStairAt = (r) => {
  for (let i = 1; i < EAST_STAIR.length; i++) {
    const [r0, y0] = EAST_STAIR[i - 1];
    const [r1, y1] = EAST_STAIR[i];
    if (r <= r0 && r >= r1) return y0 + ((r0 - r) / (r0 - r1)) * (y1 - y0);
  }
  return r > EAST_STAIR[0][0] ? EAST_STAIR[0][1] : EAST_STAIR.at(-1)[1];
};

const YAVIN = {
  // the floor of the Great Temple's hangar, laid over the temple's own:
  // dark weathered concrete, its panel seams, two muted bays for the X-wings
  // one behind the other, the taxi line out of the mouth and the scorches of
  // a squadron's engines (Red and Gold squadrons flew from here); the dark
  // back wall that closes the temple's tunnel, with the war room's and the
  // inner stair's doors in it
  hangarfloor(k, { w = 20, d = 36.5 } = {}) {
    const zc = d / 2 - 10.5; // (from the back wall at -10.5 to the mouth)
    const parts = [part(box(w, 0.04, d), { at: [0, 0, zc], color: '#56544c', to: 'stone' })];
    for (let i = 1; i < 7; i++) parts.push(part(box(w, 0.012, 0.06), { at: [0, 0.04, zc - d / 2 + (i * d) / 7], color: '#3e3c36', to: 'stone' }));
    for (const x of [-w / 4, w / 4]) parts.push(part(box(0.06, 0.012, d), { at: [x, 0.04, zc], color: '#3e3c36', to: 'stone' }));
    for (const [x, z] of [
      [4.8, -1],
      [4.8, 13],
    ]) {
      parts.push(part(new THREE.RingGeometry(4.4, 4.8, 40).rotateX(-PI / 2), { at: [x, 0.05, z], color: '#b0923e', to: 'paint' }));
      parts.push(part(scorch(4.2, x + z * 3).rotateX(-PI / 2), { at: [x, 0.045, z - 4.5], color: '#3a3833', to: 'stone' }));
      parts.push(part(scorch(2.4, x + z * 3 + 1).rotateX(-PI / 2), { at: [x, 0.048, z - 4.8], color: '#22201c', to: 'dark' }));
    }
    // the taxi line out of the mouth, and the edge marks down both sides
    parts.push(part(box(0.5, 0.02, d - 2), { at: [-1.2, 0.04, zc], color: '#c4c2b8', to: 'paint' }));
    for (const x of [-w / 2 + 0.8, w / 2 - 0.8]) for (let i = 0; i < 8; i++) parts.push(part(box(0.5, 0.02, 1.6), { at: [x, 0.04, -8 + i * 4.4], color: i % 2 ? '#2a2a2a' : '#c4c2b8', to: 'paint' }));
    // the back wall and its two doors
    parts.push(part(box(w + 1, 11.2, 0.6), { at: [0, -0.6, -10.5], color: '#24221e', to: 'stone' }));
    for (const x of [-4, 4]) {
      parts.push(part(box(3, 4, 0.2), { at: [x, 0, -10.12], color: '#0e0d0b', to: 'dark' }));
      parts.push(part(box(3.4, 0.15, 0.1), { at: [x, 4.1, -10.12], color: new THREE.Color('#ffe8c0').multiplyScalar(2.2), to: 'glow' }));
    }
    return { object: k.build(parts, { name: 'hangarfloor' }) };
  },

  // the Great Temple of Massassi: a steep stepped pyramid of six terraces
  // round a slotted tower, 96 m across, a stair up the middle of each face,
  // the Rebel hangar a tunnel through its foot (+z); built by the Massassi for
  // the Sith thousands of years ago. Drawn only if its model doesn't load;
  // its walls and floors are the model's, measured (TERRACES)
  massassi(k) {
    const parts = [];
    const floors = [];
    const solids = [];
    const S = { color: MASSASSI, to: 'stone' };
    const D = { color: MASSASSI_DARK, to: 'stone' };
    const { hw: HW, roof: ROOF, back: BACK, front: FRONT } = HANGAR;
    const [[A, ya], [T1, y1]] = TERRACES;
    // the plinth and the base up to the first terrace, round the hangar:
    // left, right, behind; and the roof over it
    for (const s of [-1, 1]) {
      parts.push(part(box(A - HW, ya, A * 2), { at: [(s * (A + HW)) / 2, 0, 0], ...D }), part(box(T1 - HW, y1, T1 * 2), { at: [(s * (T1 + HW)) / 2, 0, 0], ...S }));
      solids.push({ box: [(s * (A + HW)) / 2, 0, (A - HW) / 2, A, 0], top: ya }, { box: [(s * (T1 + HW)) / 2, 0, (T1 - HW) / 2, T1, 0], top: y1 });
    }
    parts.push(part(box(HW * 2, ya, A + BACK), { at: [0, 0, (BACK - A) / 2], ...D }), part(box(HW * 2, y1, T1 + BACK), { at: [0, 0, (BACK - T1) / 2], ...S }));
    solids.push({ box: [0, (BACK - A) / 2, HW, (A + BACK) / 2, 0], top: ya }, { box: [0, (BACK - T1) / 2, HW, (T1 + BACK) / 2, 0], top: y1 });
    parts.push(part(box(HW * 2, y1 - ROOF, T1 - BACK), { at: [0, ROOF, (T1 + BACK) / 2], ...S }));
    // the hangar's floor (a step up off the ground), lights in its roof
    floors.push({ x: 0, z: (BACK + FRONT) / 2, hw: HW, hd: (FRONT - BACK) / 2, yaw: 0, y: 0.55 });
    parts.push(part(box(HW * 2, 0.55, FRONT - BACK), { at: [0, 0, (BACK + FRONT) / 2], color: '#5a574e', to: 'stone' }));
    for (let i = 0; i < 4; i++) for (const x of [-6, 0, 6]) parts.push(part(box(3, 0.15, 0.6), { at: [x, ROOF - 0.2, BACK + 4 + i * 8], color: new THREE.Color('#ffe8c0').multiplyScalar(2.2), to: 'glow' }));
    // the terraces, each walled to its top, from the hangar's roof up (so
    // the hangar stays open under them)
    for (const [hw, y] of TERRACES.slice(1)) {
      if (hw < T1) parts.push(part(box(hw * 2, y - ROOF, hw * 2), { at: [0, ROOF, 0], ...S }));
      parts.push(part(box(hw * 2 + 0.8, 0.6, hw * 2 + 0.8), { at: [0, y - 0.6, 0], ...D }));
      solids.push({ box: [0, 0, hw, hw, 0], top: y, base: ROOF });
      floors.push({ x: 0, z: 0, hw, hd: hw, yaw: 0, y });
    }
    // the slotted tower on top, to 77
    const top = TERRACES.at(-1)[1];
    parts.push(part(box(13, 77 - top, 13), { at: [0, top, 0], ...S }));
    for (const a of [0, PI / 2, PI, -PI / 2]) parts.push(part(box(2, 12, 0.3), { at: [sin(a) * 6.6, top + 8, cos(a) * 6.6], rot: [0, a, 0], color: '#1a1814', to: 'dark' }));
    solids.push({ box: [0, 0, 6.5, 6.5, 0] });
    // the stairs up the middle of each face (the east one walked: a strip
    // of floor every 20 cm, each no more than a step over the last, and its
    // sides walled to its height, so it's not walked into off a terrace)
    const [r0, s0] = EAST_STAIR[0];
    const [r1, s1] = EAST_STAIR.at(-1);
    const run = r0 - r1;
    const flightGeo = () =>
      new THREE.BoxGeometry(Math.hypot(run, s1 - s0), 0.8, 17)
        .rotateZ(-Math.atan2(s1 - s0, run))
        .translate((r0 + r1) / 2, (s0 + s1) / 2 - 0.4, 0);
    for (const a of [0, PI / 2, PI, -PI / 2]) parts.push(part(flightGeo().rotateY(a), D));
    for (let i = 0; r0 - i * 0.2 >= r1 - 0.6; i++) {
      const r = r0 - i * 0.2;
      const y = eastStairAt(r);
      for (const z of [-8.5, 8.5]) solids.push({ box: [r, z, 0.1, 0.1, 0], top: y, base: ROOF });
      floors.push({ x: r, z: 0, hw: 0.1, hd: 8.5, yaw: 0, y });
    }
    // vines down its faces
    const rand = rng(12);
    for (let i = 0; i < 16; i++) {
      const a = Math.floor(rand() * 4) * (PI / 2);
      const along = (rand() - 0.5) * 70;
      if (Math.abs(along) < 12) continue;
      const l = 4 + rand() * 6;
      parts.push(part(new THREE.BoxGeometry(2 + rand() * 3, l, 0.3), { at: [sin(a) * (T1 + 0.2) + cos(a) * along, y1 - l, cos(a) * (T1 + 0.2) - sin(a) * along], rot: [0, a, 0], color: VINE, to: 'leaf' }));
    }
    return { object: k.build(parts, { name: 'massassi' }), solids, floors };
  },

  // what's drawn with the Great Temple's model: dark plugs a metre inside
  // its back and side tunnel mouths (its hangar is one tunnel front to back,
  // crossed by a second), so they read as doorways and not a see-through
  // cross; and a stone stair up its east side, from the ground to the foot
  // of the east face's own stair
  massassiplugs(k) {
    const P = { color: '#1a1814', to: 'dark' };
    const parts = [part(box(21, 11, 0.6), { at: [0, 0, -44.5], ...P })];
    for (const s of [-1, 1]) parts.push(part(box(0.6, 11, 24), { at: [s * 44.5, 0, -0.5], ...P }));
    const top = EAST_STAIR[0][1];
    const f = flight(47.6, 22.5, 0, top, -1, 41, { wide: 3.6 });
    parts.push(...f.parts);
    // (its landing widened, out over the plinth to the stair's foot)
    parts.push(part(box(9.2, 0.5, 4), { at: [44.8, top - 0.5, -0.5], color: MASSASSI, to: 'stone' }));
    return { object: k.build(parts, { name: 'massassiplugs' }), floors: [...f.floors, { x: 44.8, z: -0.5, hw: 4.6, hd: 2, yaw: 0, y: top }] };
  },

  // a lesser temple, swallowed by the jungle: three worn tiers, a dark
  // doorway, a tree growing out of its top, blocks fallen round it. With
  // `core`, only what goes with the Great Temple's model drawn small: two
  // dark boxes plugging its crossed tunnels, and the fallen blocks
  ruin(k, { seed = 21, core = false } = {}) {
    const rand = rng(seed);
    const fallen = [];
    for (let i = 0; i < 7; i++) {
      const a = rand() * TAU;
      const d = 17 + rand() * 5;
      fallen.push(part(box(1.5 + rand() * 1.5, 0.8 + rand(), 1.2 + rand()), { at: [cos(a) * d, -0.2, sin(a) * d], rot: [(rand() - 0.5) * 0.4, rand() * PI, (rand() - 0.5) * 0.3], color: MASSASSI, to: 'stone' }));
    }
    if (core) {
      const P = { color: '#1a1814', to: 'dark' };
      return { object: k.build([part(box(7.2, 3.8, 30), P), part(box(30, 3.8, 7.2), P), ...fallen], { name: 'ruincore' }) };
    }
    const t = tiers(
      [
        [15, 15, 6],
        [11, 11, 5],
        [7, 7, 4.5],
      ],
      { seed },
    );
    const parts = [...t.parts, ...fallen];
    parts.push(part(box(4, 4, 0.4), { at: [0, 0, 15.1], color: '#1a1814', to: 'dark' }));
    parts.push(part(box(5.4, 0.8, 1), { at: [0, 4, 15.2], color: MASSASSI_DARK, to: 'stone' }));
    for (const p of jungleParts({ h: 22, r: 0.8, seed: seed + 3 }).parts) parts.push({ ...p, at: [(p.at?.[0] ?? 0) + 2, (p.at?.[1] ?? 0) + t.top - 1, (p.at?.[2] ?? 0) - 1] });
    return { object: k.build(parts, { name: 'ruin' }), solids: [{ box: [0, 0, 15, 15, 0] }] };
  },

  // the lookout: a steel tower up through the canopy, a platform on top
  // with a sentry's rail, a ladder up one leg; 34 m
  lookout(k, { h = 34 } = {}) {
    const parts = [];
    const M = { color: '#6a6a62', to: 'metal' };
    const legs = [
      [-2.4, -2.4],
      [2.4, -2.4],
      [2.4, 2.4],
      [-2.4, 2.4],
    ];
    for (const [x, z] of legs) parts.push(rod([x * 1.6, 0, z * 1.6], [x * 0.7, h, z * 0.7], 0.22, 0.16, M, 6));
    for (let i = 0; i < 4; i++) {
      const [x0, z0] = legs[i];
      const [x1, z1] = legs[(i + 1) % 4];
      for (let j = 0; j < 4; j++) {
        const f0 = j / 4;
        const f1 = (j + 1) / 4;
        const s0 = 1.6 - 0.9 * f0;
        const s1 = 1.6 - 0.9 * f1;
        parts.push(rod([x0 * s0, h * f0, z0 * s0], [x1 * s1, h * f1, z1 * s1], 0.07, 0.07, M, 4));
        parts.push(rod([x1 * s0, h * f0, z1 * s0], [x0 * s1, h * f1, z0 * s1], 0.07, 0.07, M, 4));
      }
    }
    parts.push(part(box(5.4, 0.3, 5.4), { at: [0, h, 0], color: '#7a786e', to: 'metal' }));
    for (const [x, z, w, d] of [
      [0, 2.6, 5.4, 0.08],
      [0, -2.6, 5.4, 0.08],
      [2.6, 0, 0.08, 5.4],
      [-2.6, 0, 0.08, 5.4],
    ])
      parts.push(part(box(w, 0.08, d), { at: [x, h + 1.1, z], ...M }));
    for (const [x, z] of legs) parts.push(rod([x * 1.08, h, z * 1.08], [x * 1.08, h + 1.15, z * 1.08], 0.05, 0.05, M, 4));
    parts.push(part(cyl(0.6, 0.6, 0.6, 10), { at: [-1.6, h + 0.3, -1.6], color: '#4a4a44', to: 'metal' }));
    parts.push(rod([1.8, h + 0.3, -1.8], [1.8, h + 4, -1.8], 0.04, 0.03, M, 4));
    parts.push(part(new THREE.SphereGeometry(0.12, 6, 4), { at: [1.8, h + 4.05, -1.8], color: new THREE.Color('#ff5040').multiplyScalar(2.4), to: 'glow' }));
    return { object: k.build(parts, { name: 'lookout' }), solids: [{ box: [0, 0, 3.6, 3.6, 0] }], floors: [{ x: 0, z: 0, hw: 2.7, hd: 2.7, yaw: 0, y: h + 0.15 }] };
  },

  // a starfighter set down (one of the galaxy's: an X-wing, a Y-wing, a
  // U-wing…), on its landing struts
  parked(k, { kind = 'xwing', metres = 12.5, lift = 1.1 } = {}) {
    const m = buildGalaxyShip(kind);
    k.own({ dispose: () => m.dispose() });
    m.group.scale.setScalar(metres);
    const size = m.size.clone().multiplyScalar(metres);
    m.group.position.y = lift + size.y / 2;
    const object = new THREE.Group();
    object.add(m.group);
    const M = { color: '#4a4a46', to: 'metal' };
    const gear = [];
    for (const [x, z] of [
      [0, size.z * 0.3],
      [-size.x * 0.12, -size.z * 0.22],
      [size.x * 0.12, -size.z * 0.22],
    ]) {
      gear.push(rod([x, lift + size.y * 0.3, z], [x, 0.1, z], 0.08, 0.08, M, 6));
      gear.push(part(cyl(0.22, 0.25, 0.12, 8), { at: [x, 0, z], ...M }));
    }
    object.add(k.build(gear, { name: 'gear' }));
    return { object, solids: [{ box: [0, 0, Math.max(1, size.x * 0.3), size.z * 0.42, 0] }], update: (t) => m.update?.(t) };
  },
};

// (the crowns the ground map shades under, groundPaint.js: a kind's crown
// radius in metres at scale 1)
for (const [kind, crown] of [
  ['jungletree', 10],
  ['redwood', 7],
  ['wroshyr', 10],
  ['gnarltree', 6],
])
  SCATTER[kind].canopy = crown;

export const PROPS = { ...TREES, ...ENDOR, ...KASHYYYK, ...DAGOBAH, ...YAVIN };
// Lothal's old Imperial tower: the audit lane's model where it loads, this
// lattice where it won't
PROPS.lothtower = PROPS.lookout;
