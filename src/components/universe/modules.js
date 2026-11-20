// The parts fitted in the hangar (outfit.js), bolted on to a ship: turned
// and bevelled shapes, smooth at the size the chase camera sees them, a
// handful of draws, at hardpoints on each ship (its flanks for boosters,
// its corners for thrusters, its belly for guns, its back for a shield, its
// tail for fins), in the ship's own frame (BUILT units, nose −z:
// shipModels.js puts them in with the ship). The painted parts are a plain
// grey that takes the ship's paint job (livery.js) with a band that takes
// its trim; chrome stays chrome, glass stays glass and Cap's shield stays
// Cap's. A part just fitted swings into place, and its lights come up and
// die down smoothly.
//
// buildModules(kind, loadout, engines, { fresh }) → { group, nozzles (where
//   the boosters' exhaust leaves from, for scene.js's plumes), boosterColor,
//   flame (how much longer the main exhaust burns, boosting), muzzles
//   (where the shots leave from, in turn), fire(), update(dt, { throttle,
//   boost, turn, climb }), dispose() }
// fresh: the slots just fitted, which ease in. mounts: a garage build's
// hardpoints (shipyard/parts.js), in place of the ship's own. tiers: the
// ship's core systems (ships/), the ones that show: cargo pods under its
// flanks from the hold's Mk III and a turning scanner dish on its starboard
// side from the scanner's (ships/looks.js's SHOWS_FROM), bigger at Mk V;
// nothing at Mk I, so a ship as it comes draws as it always did.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { turned } from './hulls';
import { STOCK, partById } from './outfit';
import { SHOWS_FROM, partScale } from './ships/looks';

// Each ship's hardpoints (one side's, +x; the other is its mirror): pod
// (a booster's middle, its length and radius), corner (the thruster blocks,
// fore and aft), pipe (where a racing exhaust leaves the hull, and where
// its end sits), gun (a twin barrel's root), belly (the fusion cannon's),
// plate (armour's middle and length, on a flat side) or belt (a round
// ship's armour: the radius, height and the arc it covers either side),
// emitter (a shield node), badge (Cap's shield: where, how big, how far it
// tips back), fin (a fin's root), and ring (an afterburner collar's radius
// round each engine).
const MOUNTS = {
  xwing: {
    pod: [0.076, -0.05, 0.075, 0.12, 0.012],
    corner: [
      [0.012, 0.017, -0.095],
      [0.021, 0.026, 0.118],
    ],
    pipe: [
      [0.016, -0.02, 0.1],
      [0.022, -0.028, 0.17],
    ],
    gun: [0.02, -0.021, -0.06],
    belly: [0, -0.036, 0.0],
    plate: [0.0265, 0.0, 0.09, 0.09],
    emitter: [0.016, 0.022, 0.082],
    badge: [0, 0.0228, 0.122, 0.016, 0.12],
    fin: [0.017, 0.021, 0.138],
    ring: 0.019,
  },
  falcon: {
    pod: [0.146, -0.012, 0.03, 0.13, 0.015],
    corner: [
      [0.09, 0.0215, -0.04],
      [0.09, 0.019, 0.062],
    ],
    pipe: [
      [0.038, -0.012, 0.1],
      [0.046, -0.016, 0.142],
    ],
    gun: [0.04, -0.019, -0.13],
    belly: [0, -0.046, -0.055],
    belt: [0.1315, 0, 0.014, Math.PI / 2, 0.42],
    emitter: [0.06, 0.023, 0.045],
    badge: [0, 0.0236, 0.075, 0.028, 0.08],
    fin: [0.05, 0.0135, 0.1],
    ring: 0.012,
  },
  rv: {
    pod: [0.165, -0.022, -0.05, 0.11, 0.013],
    corner: [
      [0.045, 0.072, -0.085],
      [0.045, 0.072, 0.1],
    ],
    pipe: [
      [0.03, -0.05, 0.09],
      [0.036, -0.058, 0.135],
    ],
    gun: [0.036, -0.06, -0.09],
    belly: [0, -0.078, -0.01],
    plate: [0.056, 0.005, 0.03, 0.13],
    emitter: [0.03, 0.074, 0.04],
    badge: [0, 0.0715, -0.02, 0.03, 0],
    fin: [0.042, 0.07, 0.105],
    ring: 0.014,
  },
  cruiser: {
    pod: [0.17, -0.04, 0.04, 0.13, 0.016],
    corner: [
      [0.13, -0.01, -0.08],
      [0.13, -0.01, 0.08],
    ],
    pipe: [
      [0.05, -0.07, 0.1],
      [0.056, -0.075, 0.15],
    ],
    gun: [0.05, -0.07, -0.12],
    belly: [0, -0.115, -0.02],
    belt: [0.168, -0.03, 0.016, Math.PI / 2, 0.5],
    emitter: [0.13, 0.01, 0.06],
    badge: [0, 0.03, 0.14, 0.032, 1.1],
    fin: [0.08, 0.02, 0.13],
    ring: 0.03,
  },
};
// the colours the boosters' exhaust burns
const BOOSTER_COLOR = { srb: '#ffb15c', repulsor: '#a8eeff', portal: '#7dff5c' };
const EASE_IN = 0.45; // seconds a part takes to swing into place

// geometries placed by [geometry, position, rotation, scale], merged into one
function merge(list) {
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
// both sides of a part given for +x (each side's own geometry, so the
// mirrored side isn't wound inside out)
const both = (list) => [...list, ...list.map(([g, [x, y, z] = [0, 0, 0], [rx, ry, rz] = [0, 0, 0], s]) => [g.clone(), [-x, y, z], [rx, -ry, -rz], s])];
const rounded = (w, h, d, r = Math.min(w, h, d) * 0.3) => new RoundedBoxGeometry(w, h, d, 3, r);
const tube = (r, len, seg = 32) => new THREE.CylinderGeometry(r, r, len, seg); // (stood on y)
const LAY = [Math.PI / 2, 0, 0]; // (a CylinderGeometry laid along z, its top toward +z)

export function buildModules(kind, loadout = {}, engines = [], { fresh = [], mounts = null, tiers = null } = {}) {
  // a part with no model of its own is drawn as the one it borrows the look of (outfit.js's `look`)
  const looks = (slot) => partById(slot, loadout[slot])?.look ?? loadout[slot];
  const at = mounts ?? MOUNTS[kind] ?? MOUNTS.falcon; // (a garage build brings its hull's own)
  const group = new THREE.Group();
  group.name = 'modules';
  const made = []; // materials and geometries to dispose
  const glows = []; // { mat, color, idle, hot, by, now }: brighter as it boosts (or fires)
  const vanes = [];
  const nozzles = [];
  const muzzles = [];
  const easing = []; // { holder, age }: the parts just fitted, swinging into place
  const spinners = []; // (the scanner's dish, turning)
  let flame = 1;
  let slot = null; // the slot whose part is being built (its meshes go in its own holder)
  const holders = {};

  const mat = (m) => (made.push(m), m);
  const metal = mat(new THREE.MeshStandardMaterial({ color: '#b9bdc3', roughness: 0.42, metalness: 0.35 })); // (takes the paint)
  const band = mat(new THREE.MeshStandardMaterial({ color: '#c0392b', roughness: 0.48, metalness: 0.25 })); // (takes the trim)
  const dark = mat(new THREE.MeshStandardMaterial({ color: '#202329', roughness: 0.5, metalness: 0.6 }));
  const chrome = mat(new THREE.MeshStandardMaterial({ color: '#f4f4f4', roughness: 0.12, metalness: 1 }));
  const glass = mat(new THREE.MeshStandardMaterial({ color: '#bfffd0', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.32, depthWrite: false }));
  const add = (geo, material, { noPaint = false } = {}) => {
    const mesh = new THREE.Mesh(geo, material);
    if (noPaint) mesh.userData.noPaint = true;
    made.push(geo);
    holders[slot].add(mesh);
    return mesh;
  };
  const glow = (geo, color, { idle = 0.4, hot = 3, by = 'boost', additive = true } = {}) => {
    const m = mat(new THREE.MeshBasicMaterial({ color, toneMapped: false, transparent: additive, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: !additive, side: THREE.DoubleSide }));
    glows.push({ mat: m, color: new THREE.Color(color), idle, hot, by, now: idle });
    return add(geo, m);
  };
  const begin = (s) => {
    slot = s;
    holders[s] = new THREE.Group();
    holders[s].name = s;
  };

  const [px, py, pz, plen, pr] = at.pod;
  const tail = pz + plen / 2;

  // Boosters
  begin('booster');
  const booster = looks('booster');
  if (booster === 'srb') {
    // a white rocket either side: an ogive nose, the body, a skirt, the bell
    const L = plen;
    const body = turned(
      [
        [0, -L / 2],
        [pr * 0.35, -L / 2 + L * 0.03],
        [pr * 0.7, -L / 2 + L * 0.08],
        [pr * 0.92, -L / 2 + L * 0.14],
        [pr, -L / 2 + L * 0.21],
        [pr, L / 2 - L * 0.12],
        [pr * 1.08, L / 2 - L * 0.06],
        [pr * 1.08, L / 2 - L * 0.03],
        [pr * 0.86, L / 2 - L * 0.02],
      ],
      32,
    );
    add(merge(both([[body, [px, py, pz]]])), metal);
    add(merge(both([[tube(pr * 1.02, L * 0.1), [px, py, pz - L * 0.12], LAY], [tube(pr * 1.02, L * 0.04), [px, py, pz + L * 0.22], LAY]])), band);
    const bell = turned(
      [
        [pr * 0.5, 0],
        [pr * 0.62, L * 0.04],
        [pr * 0.82, L * 0.09],
        [pr * 0.78, L * 0.095],
        [pr * 0.58, L * 0.05],
        [pr * 0.42, L * 0.01],
      ],
      28,
    );
    add(merge(both([[bell, [px, py, tail - L * 0.02]]])), dark);
    // the strut that holds it to the ship
    const sx = Math.sign(px) || 1;
    add(merge(both([[rounded(Math.max(0.008, Math.abs(px) * 0.3), 0.005, L * 0.34, 0.002), [px - sx * Math.max(0.006, Math.abs(px) * 0.16), py + pr * 0.7, pz]]])), dark);
    glow(merge(both([[new THREE.CircleGeometry(pr * 0.6, 24), [px, py, tail + L * 0.06]]])), BOOSTER_COLOR.srb, { idle: 0, hot: 3 });
    nozzles.push([px, py, tail + L * 0.08], [-px, py, tail + L * 0.08]);
  } else if (booster === 'repulsor') {
    // a disc under either flank, rounded, its face lit down and back in rings
    const r = pr * 1.9;
    const disc = turned(
      [
        [0, -pr * 0.5],
        [r * 0.9, -pr * 0.5],
        [r, -pr * 0.3],
        [r * 1.02, 0],
        [r, pr * 0.3],
        [r * 0.9, pr * 0.42],
        [0, pr * 0.42],
      ],
      40,
    );
    add(merge(both([[disc, [px, py, pz], [-Math.PI / 2, 0, 0]]])), metal);
    add(merge(both([[new THREE.TorusGeometry(r * 0.8, pr * 0.1, 10, 48), [px, py - pr * 0.45, pz], [Math.PI / 2, 0, 0]]])), dark);
    glow(merge(both([[new THREE.RingGeometry(r * 0.25, r * 0.7, 40), [px, py - pr * 0.44, pz], [Math.PI / 2, 0, 0]]])), BOOSTER_COLOR.repulsor, { idle: 0.6, hot: 3.4 });
    glow(merge(both([[new THREE.CircleGeometry(r * 0.16, 24), [px, py - pr * 0.43, pz], [Math.PI / 2, 0, 0]]])), '#ffffff', { idle: 0.8, hot: 2.4 });
    nozzles.push([px, py - pr * 0.1, pz + r * 0.95], [-px, py - pr * 0.1, pz + r * 0.95]);
  } else if (booster === 'portal') {
    // a glass tank of the green stuff either side, its core glowing,
    // chrome caps turned round its ends, strapped on
    const r = pr * 1.15;
    const L = plen * 0.62;
    add(merge(both([[new THREE.CapsuleGeometry(r, L - r * 2, 8, 32), [px, py, pz], LAY]])), glass, { noPaint: true });
    glow(merge(both([[new THREE.CapsuleGeometry(r * 0.72, L - r * 2, 6, 24), [px, py, pz], LAY]])), BOOSTER_COLOR.portal, { idle: 0.6, hot: 2.2, additive: false });
    const cap = (dir) =>
      turned(
        dir < 0
          ? [
              [0, -r * 0.6],
              [r * 0.7, -r * 0.5],
              [r * 1.08, -r * 0.1],
              [r * 1.08, r * 0.3],
              [r * 0.95, r * 0.4],
            ]
          : [
              [r * 0.95, -r * 0.4],
              [r * 1.08, -r * 0.3],
              [r * 1.08, r * 0.2],
              [r * 0.8, r * 0.7],
              [r * 0.55, r * 0.95],
            ],
        32,
      );
    add(merge(both([[cap(-1), [px, py, pz - L / 2]], [cap(1), [px, py, pz + L / 2]]])), chrome, { noPaint: true });
    add(merge(both([[new THREE.TorusGeometry(r * 1.03, r * 0.1, 10, 40), [px, py, pz - L * 0.16]], [new THREE.TorusGeometry(r * 1.03, r * 0.1, 10, 40), [px, py, pz + L * 0.16]]])), dark);
    glow(merge(both([[new THREE.CircleGeometry(r * 0.5, 24), [px, py, pz + L / 2 + r * 0.96]]])), BOOSTER_COLOR.portal, { idle: 0.2, hot: 3.2 });
    nozzles.push([px, py, pz + L / 2 + r], [-px, py, pz + L / 2 + r]);
  } else if (booster === 'afterburner') {
    // a turned collar round each engine, lit inside, and the exhaust burning long out of it
    flame = 1.7;
    const R = at.ring;
    const collar = turned(
      [
        [R * 0.98, -R * 0.35],
        [R * 1.12, -R * 0.2],
        [R * 1.16, R * 0.3],
        [R * 1.04, R * 0.42],
        [R * 0.92, R * 0.1],
      ],
      36,
    );
    if (engines.length) {
      add(merge(engines.map(([x, y, z]) => [collar.clone(), [x, y, z]])), dark);
      glow(merge(engines.map(([x, y, z]) => [new THREE.TorusGeometry(R * 0.96, R * 0.06, 8, 40), [x, y, z + R * 0.3]])), '#ffd9a8', { idle: 0, hot: 3 });
    }
    collar.dispose();
  }

  // Thrusters
  begin('thrusters');
  const thrusters = looks('thrusters');
  if (thrusters === 'rcs') {
    // a rounded block at each corner, a little bell out of each face
    const blocks = [];
    const bells = [];
    const bell = () =>
      turned(
        [
          [0.0022, 0],
          [0.0034, 0.0045],
          [0.0042, 0.006],
        ],
        16,
      );
    for (const [x, y, z] of at.corner) {
      blocks.push([rounded(0.016, 0.012, 0.016, 0.003), [x, y, z]]);
      bells.push([bell(), [x + 0.008, y, z], [0, Math.PI / 2, 0]], [bell(), [x, y + 0.006, z], [-Math.PI / 2, 0, 0]], [bell(), [x, y, z + (z < 0 ? -0.008 : 0.008)], [0, z < 0 ? Math.PI : 0, 0]]);
    }
    add(merge(both(blocks)), metal);
    add(merge(both(bells)), dark);
  } else if (thrusters === 'racing') {
    // chrome pipes, hot-rod style: out of the hull, sweeping back, flared at the end
    const [[x0, y0, z0], [x1, y1, z1]] = at.pipe;
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(x0 * 0.7, y0 + 0.004, z0 - 0.03), new THREE.Vector3(x0, y0, z0), new THREE.Vector3((x0 + x1) / 2, (y0 + y1) / 2 - 0.002, (z0 + z1) / 2), new THREE.Vector3(x1, y1, z1)]);
    const pipe = new THREE.TubeGeometry(curve, 32, 0.0068, 16, false);
    const flare = turned(
      [
        [0.0068, -0.004],
        [0.0078, 0.0],
        [0.0098, 0.006],
        [0.0084, 0.0065],
        [0.0062, 0.002],
      ],
      20,
    );
    add(merge(both([[pipe], [flare, [x1, y1, z1]]])), chrome, { noPaint: true });
    glow(merge(both([[new THREE.CircleGeometry(0.0062, 20), [x1, y1, z1 + 0.0035]]])), '#ff8a3c', { idle: 0.5, hot: 3 });
    nozzles.push([x1, y1, z1 + 0.006], [-x1, y1, z1 + 0.006]);
  } else if (thrusters === 'vector') {
    // a pair of rounded vanes behind each engine, steering the blast (they swing with the stick)
    for (const [x, y, z] of engines) {
      for (const side of [-1, 1]) {
        const vane = add(rounded(at.ring * 1.7, 0.0035, 0.022, 0.0012), dark);
        vane.position.set(x, y + side * at.ring * 0.95, z + 0.013);
        vane.userData.side = side;
        vanes.push(vane);
      }
    }
  }

  // Guns, and the secondary and ordnance lines drawn as guns are (their
  // parts borrow a gun's look: a pair of barrels, or a slung cannon), each
  // set a little out from the primary's so a ship with all three shows all three
  const twinAt = ([x, y, z], muzzle) => {
  // a barrel either side under the nose: a rounded breech, the barrel, a slotted muzzle
  const barrel = turned(
    [
      [0.0, -0.105],
      [0.0042, -0.104],
      [0.0042, -0.09],
      [0.0034, -0.088],
      [0.0034, -0.02],
      [0.0046, -0.016],
      [0.0046, 0.0],
      [0.0, 0.001],
    ],
    20,
  );
  add(merge(both([[barrel, [x, y, z]]])), dark);
  add(merge(both([[rounded(0.013, 0.011, 0.032, 0.003), [x, y + 0.002, z + 0.012]], [tube(0.0049, 0.004, 20), [x, y, z - 0.096], LAY]])), metal);
  if (muzzle) muzzles.push([x, y, z - 0.108], [-x, y, z - 0.108]);
  };
  const fusionAt = ([x, y, z], muzzle) => {
  // Megatron's: a fat barrel slung under the belly, tapering to its muzzle, its coils lit purple
  const body = turned(
    [
      [0.0, -0.082],
      [0.0105, -0.081],
      [0.0125, -0.074],
      [0.0145, -0.05],
      [0.017, 0.02],
      [0.0165, 0.06],
      [0.012, 0.072],
      [0.0, 0.074],
    ],
    36,
  );
  add(merge([[body, [x, y, z]], [rounded(0.022, 0.016, 0.06, 0.004), [x, y + 0.012, z + 0.02]]]), metal);
  add(merge([[tube(0.0098, 0.006, 32), [x, y, z - 0.081], LAY]]), dark);
  glow(merge([-0.045, -0.025, -0.005].map((dz, i) => [new THREE.TorusGeometry(0.0152 + i * 0.0006, 0.0024, 12, 48), [x, y, z + dz]])), '#b07cff', { idle: 1.2, hot: 1.2, by: 'fire' });
  glow(new THREE.CircleGeometry(0.0085, 28).rotateX(Math.PI).translate(x, y, z - 0.0845), '#c9a6ff', { idle: 1.5, hot: 1.5, by: 'fire' });
  if (muzzle) muzzles.push([x, y, z - 0.088]);
  };
  const gunAt = (look, pos, muzzle = false) => (look === 'twin' ? twinAt(pos, muzzle) : look === 'fusion' ? fusionAt(pos, muzzle) : null);
  begin('guns');
  gunAt(looks('guns'), looks('guns') === 'fusion' ? at.belly : at.gun, true);
  begin('secondary');
  if (loadout.secondary && loadout.secondary !== STOCK) gunAt(looks('secondary'), [at.gun[0] * 1.6, at.gun[1] - 0.012, at.gun[2] + 0.03]);
  begin('ordnance');
  if (loadout.ordnance && loadout.ordnance !== STOCK) gunAt(looks('ordnance'), [at.belly[0], at.belly[1] - 0.026, at.belly[2] + 0.05]); // (centred, slung below where a fusion primary hangs)

  // Shields
  begin('shields');
  const shields = looks('shields');
  if (shields === 'reinforced') {
    if (at.belt) {
      // a round ship's: an armour belt round its rim either side, in plates, with the trim's band along it
      const [R, y, h, mid, half] = at.belt;
      for (const sx of [1, -1]) {
        const a0 = sx > 0 ? mid - half : -mid - half;
        add(new THREE.CylinderGeometry(R, R, h, 40, 1, true, a0, half * 2).translate(0, y, 0), dark);
        add(new THREE.CylinderGeometry(R + 0.0006, R + 0.0006, h * 0.22, 40, 1, true, a0 + 0.02, half * 2 - 0.04).translate(0, y - h * 0.18, 0), band);
        for (let i = 0; i <= 6; i++) {
          const a = a0 + (half * 2 * i) / 6;
          add(rounded(0.002, h * 1.04, 0.004, 0.0008).translate(0, 0, 0).applyMatrix4(new THREE.Matrix4().makeRotationY(a)).translate(Math.sin(a) * (R + 0.001), y, Math.cos(a) * (R + 0.001)), dark);
        }
      }
    } else {
      const [x, y, z, len] = at.plate;
      add(merge(both([[rounded(0.006, 0.03, len, 0.0022), [x + 0.002, y, z], [0, 0, 0.12]], [rounded(0.0068, 0.006, len * 0.92, 0.002), [x + 0.004, y + 0.017, z], [0, 0, 0.12]]])), dark);
      add(merge(both([[rounded(0.0064, 0.004, len * 0.94, 0.0014), [x + 0.0035, y - 0.007, z], [0, 0, 0.12]]])), band);
    }
  } else if (shields === 'fastcharge') {
    // a pair of emitter nodes on turned masts, glowing
    const [x, y, z] = at.emitter;
    const mast = turned(
      [
        [0.0, 0.0],
        [0.0075, 0.0],
        [0.0075, 0.002],
        [0.0032, 0.004],
        [0.0022, 0.018],
        [0.0, 0.019],
      ],
      20,
    );
    add(merge(both([[mast, [x, y, z], [-Math.PI / 2, 0, 0]]])), dark);
    glow(merge(both([[new THREE.SphereGeometry(0.0072, 24, 16), [x, y + 0.023, z]]])), '#6fd3ff', { idle: 1.2, hot: 1.2 });
    add(merge(both([[new THREE.TorusGeometry(0.0095, 0.0009, 8, 32), [x, y + 0.023, z], [Math.PI / 2, 0, 0]]])), chrome, { noPaint: true });
  } else if (shields === 'vibranium') {
    // Cap's shield, lying on its back: dished, red, white, red, a blue middle and the star
    const [x, y, z, r, tip] = at.badge;
    const holder = new THREE.Group();
    holder.position.set(x, y, z);
    holder.rotation.x = -Math.PI / 2 + tip;
    holders[slot].add(holder);
    const dish = 0.35; // (how far the shield's face curves)
    const ring = (outer, inner, color) => {
      // a band of a shallow sphere: the shield's dish, its face out
      const R = r / Math.sin(dish);
      const geo = new THREE.SphereGeometry(R, 64, 4, 0, Math.PI * 2, Math.asin(Math.min(1, (inner * r) / R)), Math.asin(Math.min(1, (outer * r) / R)) - Math.asin(Math.min(1, (inner * r) / R)));
      geo.rotateX(Math.PI / 2).translate(0, 0, -R * Math.cos(dish) - 0.0006);
      const m = mat(new THREE.MeshStandardMaterial({ color, roughness: 0.32, metalness: 0.55, side: THREE.DoubleSide }));
      const mesh = new THREE.Mesh(geo, m);
      mesh.userData.noPaint = true;
      made.push(geo);
      holder.add(mesh);
    };
    ring(1, 0.8, '#b3191f');
    ring(0.8, 0.6, '#f1f1ee');
    ring(0.6, 0.4, '#b3191f');
    ring(0.4, 0, '#1f3e8f');
    const star = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const a = Math.PI / 2 + (i * Math.PI) / 5;
      const k = (i % 2 ? 0.15 : 0.37) * r;
      if (i === 0) star.moveTo(Math.cos(a) * k, Math.sin(a) * k);
      else star.lineTo(Math.cos(a) * k, Math.sin(a) * k);
    }
    const starGeo = new THREE.ExtrudeGeometry(star, { depth: r * 0.02, bevelEnabled: true, bevelThickness: r * 0.015, bevelSize: r * 0.012, bevelSegments: 2 });
    const starMesh = new THREE.Mesh(starGeo, mat(new THREE.MeshStandardMaterial({ color: '#f4f4f2', roughness: 0.3, metalness: 0.5 })));
    starMesh.position.z = r * 0.05;
    starMesh.userData.noPaint = true;
    made.push(starGeo);
    holder.add(starMesh);
    const rimGeo = new THREE.TorusGeometry(r, r * 0.05, 10, 64);
    const rim = new THREE.Mesh(rimGeo, chrome);
    rim.userData.noPaint = true;
    made.push(rimGeo);
    holder.add(rim);
  }

  // Fins
  begin('fins');
  if (looks('fins') === 'fins') {
    // a swept fin either side of the tail, its leading edge curved, its edges bevelled, canted out
    const [x, y, z] = at.fin;
    const shape = new THREE.Shape();
    shape.moveTo(-0.026, 0);
    shape.lineTo(0.022, 0);
    shape.quadraticCurveTo(0.03, 0.03, 0.032, 0.044);
    shape.lineTo(0.022, 0.046);
    shape.quadraticCurveTo(0.004, 0.02, -0.026, 0);
    const fin = new THREE.ExtrudeGeometry(shape, { depth: 0.0016, bevelEnabled: true, bevelThickness: 0.0009, bevelSize: 0.0009, bevelSegments: 3, curveSegments: 16 }).translate(0, 0, -0.0008).rotateY(Math.PI / 2);
    add(merge(both([[fin, [x, y, z], [0, 0, -0.3]]])), metal);
    add(merge(both([[rounded(0.0036, 0.008, 0.026, 0.0012), [x + 0.004, y + 0.028, z + 0.016], [0, 0, -0.3]]])), band);
  }

  // the tiers that show: cargo pods slung under the boosters' line, banded in the trim
  begin('cargo');
  if ((tiers?.hold ?? 1) >= SHOWS_FROM.hold && at.pod) {
    const k = partScale(tiers.hold);
    const [x, y, z, len, r] = at.pod;
    const [w, h, l] = [r * 1.6 * k, r * 1.3 * k, len * 0.55 * k];
    const cy = y - r * 2.4;
    add(merge(both([[rounded(w, h, l), [x, cy, z]]])), metal);
    add(merge(both([[rounded(w * 1.05, h * 1.05, l * 0.1), [x, cy, z - l * 0.32]], [rounded(w * 1.05, h * 1.05, l * 0.1), [x, cy, z + l * 0.32]]])), band);
  }
  // and a scanner dish on a short mast, starboard, turning as it flies
  begin('scanner');
  if ((tiers?.scanner ?? 1) >= SHOWS_FROM.scanner && at.emitter) {
    const k = partScale(tiers.scanner);
    const [x, y, z] = at.emitter;
    const R = 0.011 * k;
    const mast = 0.008 * k;
    add(merge([[tube(R * 0.12, mast), [x, y + mast / 2, z]]]), dark);
    const bowl = turned([[0, 0], [R * 0.5, R * 0.08], [R, R * 0.32], [R * 0.96, R * 0.36]], 32);
    const dish = add(merge([[bowl, [0, 0, 0], [-0.9, 0, 0]]]), metal);
    dish.position.set(x, y + mast, z);
    dish.userData.spin = 0.9;
    spinners.push(dish);
  }
  slot = null;

  // each part in its own holder about its own middle, so it can swing in from there
  const box3 = new THREE.Box3();
  const mid = new THREE.Vector3();
  for (const [s, holder] of Object.entries(holders)) {
    if (!holder.children.length) continue;
    box3.setFromObject(holder);
    box3.getCenter(mid);
    for (const c of holder.children) c.position.sub(mid);
    holder.position.copy(mid);
    group.add(holder);
    if (fresh.includes(s)) {
      holder.scale.setScalar(0.001);
      easing.push({ holder, age: 0 });
    }
  }

  let fired = 0;
  const back = (t) => {
    const c = 1.7;
    return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; // (eases out, a touch past, and settles)
  };
  return {
    group,
    nozzles,
    muzzles,
    flame,
    boosterColor: BOOSTER_COLOR[booster] ?? (thrusters === 'racing' ? '#ff8a3c' : null),
    // a shot's gone: the cannon's coils flare
    fire() {
      fired = 1;
    },
    // whether a part's still swinging in (so the page keeps drawing)
    get easing() {
      return easing.length > 0;
    },
    update(dt, { throttle = 0, boost = false, turn = 0, climb = 0 } = {}) {
      fired = Math.max(0, fired - dt * 4);
      const k = boost ? 1 : throttle * 0.35;
      const settle = 1 - Math.exp(-dt * 8); // (lights come up and die down, rather than snap)
      for (const g of glows) {
        const want = g.by === 'fire' ? g.idle * (1 + 2.2 * fired) : g.idle + (g.hot - g.idle) * k;
        g.now += (want - g.now) * (g.by === 'fire' ? 1 : settle);
        g.mat.color.copy(g.color).multiplyScalar(g.now);
        g.mat.visible = g.now > 0.01;
      }
      for (const sp of spinners) sp.rotation.y += dt * sp.userData.spin;
      for (const v of vanes) {
        v.rotation.x += (climb * 0.35 * v.userData.side - v.rotation.x) * settle;
        v.rotation.z += (-turn * 0.4 - v.rotation.z) * settle;
      }
      for (let i = easing.length - 1; i >= 0; i--) {
        const e = easing[i];
        e.age = Math.min(EASE_IN, e.age + dt);
        e.holder.scale.setScalar(Math.max(0.001, back(e.age / EASE_IN)));
        if (e.age >= EASE_IN) easing.splice(i, 1);
      }
    },
    dispose() {
      for (const m of made) m.dispose();
    },
  };
}
