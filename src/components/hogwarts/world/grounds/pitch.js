// The Quidditch pitch (the design’s §4.3, §4.6): the oval of mown grass on
// the lawn east of the castle, its lines, three gold hoops on their poles at
// each end at the book’s heights (rules/quidditch.js’s PITCH), and six tall
// stands round it in the houses’ colours: timber towers of tiers under
// pointed canvas roofs, drapes round their feet, a pennant on every point
// and a long banner down every back, the cloth stirring in the wind. Under
// the far stand, the changing rooms, and by them the broom rack; on the
// first long stand, the commentator’s box. The match (Lane E’s play/snitch.js)
// is played in this frame and its crowd (play/stands.js) sits on these
// stands’ tiers (`seats`).
//
// The pitch’s frame is the match’s: x along the long axis (the hoops at
// ±PITCH.hoopX), z across, y up, its middle on the grass; on the grounds
// its long axis runs north and south, so `yaw` turns +x to +z.
//
// Draws: the turf (one), the timber (one), the cloth (one), the banners and
// pennants (one), the hoops (one): five.
//
//   PITCH_AT: { at: [x, y, z], yaw } where the pitch stands on the grounds
//   STANDS: the six stands, as play/stands.js lays them (an angle round the oval, a house)
//   createPitch({ house, materials, ground, tier }) → { group, pitch: { at, yaw, seats, built, box }, colliders, step(dt), dispose() }
//   seatsOf() → [{ from, to, house }] each stand’s tiers in the pitch’s frame (pure)

import * as THREE from 'three';
import { MeshLambertNodeMaterial } from 'three/webgpu';
import { abs, attribute, float, fract, mix, positionLocal, sin, smoothstep, uniform, vec3 } from 'three/tsl';
import { createMesh } from '../castle/mesh';
import { onColor } from '../../../../lib/three/hookNodes';
import { TONES } from '../castle/materials';
import { PITCH } from '../../rules/quidditch';
import { placeById } from '../../rules/places';

const AT = placeById('pitch').at;
export const PITCH_AT = { at: [AT[0], 8, AT[1]], yaw: -Math.PI / 2 };
// (play/stands.js’s six, so the crowd and the commentator’s box land where these stand)
export const STANDS = [
  { a: Math.PI * 0.5 - 0.42, house: 'gryffindor', box: true },
  { a: Math.PI * 0.5 + 0.42, house: 'staff' },
  { a: -Math.PI * 0.5 - 0.42, house: 'slytherin' },
  { a: -Math.PI * 0.5 + 0.42, house: 'ravenclaw' },
  { a: 0.05, house: 'hufflepuff', changing: true },
  { a: Math.PI + 0.05, house: 'gryffindor', changing: true },
];
const RX = PITCH.length / 2 + 16;
const RZ = PITCH.width / 2 + 13;
const WIDE = 22;
const TIERS = 4;
const LOW = 10; // m up the tower the first tier stands (the films’ stands are tall towers, the crowd high over the grass)
const TALL = LOW + 9;
// the houses’ cloth, sRGB: the robe colour and its trim
const CLOTH = {
  gryffindor: [0x7f0909, 0xd3a625],
  slytherin: [0x1a472a, 0xaaaaaa],
  ravenclaw: [0x0e1a40, 0x946b2d],
  hufflepuff: [0xecb939, 0x372e29],
  staff: [0x3a2f48, 0xc8b88a],
};
const lin = (hex) => new THREE.Color(hex).toArray();

const standAt = (a) => {
  const x = Math.cos(a) * RX;
  const z = Math.sin(a) * RZ;
  return { x, z, yaw: Math.atan2(-x, -z) };
};

export function seatsOf() {
  const rows = [];
  for (const s of STANDS) {
    const { x, z, yaw } = standAt(s.a);
    const fwd = [Math.sin(yaw), Math.cos(yaw)];
    const side = [Math.cos(yaw), -Math.sin(yaw)];
    for (let i = 0; i < TIERS; i++) {
      const mx = x - fwd[0] * (i * 2.2 + 0.4);
      const mz = z - fwd[1] * (i * 2.2 + 0.4);
      const y = LOW + 0.4 + i * 2.6;
      rows.push({ from: [mx - side[0] * (WIDE / 2 - 0.8), y, mz - side[1] * (WIDE / 2 - 0.8)], to: [mx + side[0] * (WIDE / 2 - 0.8), y, mz + side[1] * (WIDE / 2 - 0.8)], house: s.house });
    }
  }
  return rows;
}

// the grass: an oval mown in stripes across the long axis, its boundary,
// the centre circle and the three scoring areas’ lines a chalky white
function turfMaterial(house) {
  const m = house ? house.material({ color: 0xffffff }) : new MeshLambertNodeMaterial({ color: 0xffffff });
  const p = positionLocal;
  const stripe = smoothstep(0.45, 0.55, abs(fract(p.x.div(8)).sub(0.5)).mul(2));
  const oval = p.x.div(PITCH.length / 2).pow(2).add(p.z.div(PITCH.width / 2).pow(2)).sqrt();
  const line = (d, w) => smoothstep(w, w * 0.4, abs(d));
  const lines = line(oval.sub(1).mul(PITCH.width / 2), 0.28)
    .max(line(p.x.pow(2).add(p.z.pow(2)).sqrt().sub(9), 0.22))
    .max(line(abs(p.x).sub(PITCH.hoopX - 11), 0.22).mul(smoothstep(PITCH.width / 2 - 2, PITCH.width / 2 - 6, abs(p.z))));
  const green = mix(vec3(0.16, 0.27, 0.09), vec3(0.21, 0.33, 0.12), stripe);
  m.colorNode = mix(green, vec3(0.78, 0.8, 0.72), lines.mul(0.85));
  return m;
}

// the cloth that moves: banners and pennants, swung by the wind from where they hang
function bannerMaterial(house, uTime) {
  const m = house ? house.material({ vertexColors: true, side: THREE.DoubleSide }) : new MeshLambertNodeMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const free = attribute('aFree', 'float'); // 0 where it hangs from, 1 at its free end
  const seed = attribute('aSeed', 'float');
  const wave = sin(uTime.mul(2.3).add(positionLocal.y.mul(0.9)).add(positionLocal.x.mul(0.6)).add(seed.mul(17)));
  m.positionNode = positionLocal.add(attribute('aSway', 'vec3').mul(wave.mul(free).mul(free).mul(float(0.55))));
  return m;
}

export function createPitch({ house = null, materials, ground, tier = 'high' } = {}) {
  const group = new THREE.Group();
  group.name = 'grounds:pitch';
  // (on the levelled lawn: the terrain’s flat for it, read where it stands)
  const at = [PITCH_AT.at[0], ground(PITCH_AT.at[0], PITCH_AT.at[2]), PITCH_AT.at[2]];
  group.position.set(...at);
  group.rotation.y = PITCH_AT.yaw;
  const uTime = uniform(0);

  // the turf: an oval of grass laid on the levelled lawn, a hair above it
  const turfGeo = new THREE.CircleGeometry(1, 72).rotateX(-Math.PI / 2).scale(PITCH.length / 2 + 9, 1, PITCH.width / 2 + 7).translate(0, 0.04, 0);
  const turfMat = turfMaterial(house);
  const turf = new THREE.Mesh(turfGeo, turfMat);
  turf.receiveShadow = true;
  turf.name = 'pitch:turf';
  group.add(turf);

  const m = createMesh();
  const cloth = createMesh();
  const banners = createMesh();
  const sway = [];
  const free = [];
  const seeds = [];
  // (a banner’s vertices carry how free each is and which way it swings)
  const hang = (n, dir, seed, fromTop = true, height = 1) => {
    for (let i = 0; i < n; i++) {
      sway.push(...dir);
      seeds.push(seed);
    }
    return { fromTop, height };
  };

  for (const [k, s] of STANDS.entries()) {
    const { x, z, yaw } = standAt(s.a);
    const [robe, trim] = CLOTH[s.house];
    const c = Math.cos(yaw);
    const sn = Math.sin(yaw);
    // (the stand’s own frame: u across it, v toward the pitch)
    const P = (u, y, v) => [x + u * c + v * sn, y, z - u * sn + v * c];
    // the timber tower: legs, braces, the tiers stepping back, the back wall
    m.tone(TONES.timber);
    for (const u of [-WIDE / 2, -WIDE / 6, WIDE / 6, WIDE / 2])
      for (const v of [0, -TIERS * 2.2]) {
        m.box('timber', { at: P(u, 0, v), size: [0.45, TALL + 2, 0.45], turn: yaw });
        if (v < 0) m.beam('timber', P(u, 1, v), P(u, TALL - 1, 0), 0.18);
      }
    for (let i = 0; i < TIERS; i++) {
      const y = LOW + i * 2.6;
      m.tone(TONES.oak);
      m.box('timber', { at: P(0, y, -i * 2.2), size: [WIDE, 0.35, 2.4], turn: yaw });
      m.box('timber', { at: P(0, y + 0.35, -i * 2.2 - 1.1), size: [WIDE, 2.3, 0.18], turn: yaw });
    }
    m.tone(TONES.timber);
    m.box('timber', { at: P(0, 0, -TIERS * 2.2 - 0.3), size: [WIDE, TALL + 2, 0.3], turn: yaw });
    // the drape round its foot in the house’s colour, its trim along the top
    cloth.tone(lin(robe));
    cloth.box('cloth', { at: P(0, 0, 1.15), size: [WIDE + 0.4, LOW - 0.1, 0.12], turn: yaw });
    for (const side of [-1, 1]) cloth.box('cloth', { at: P(side * (WIDE / 2 + 0.2), 0, -TIERS * 1.1 + 0.6), size: [0.12, LOW - 0.1, TIERS * 2.2 + 1.4], turn: yaw });
    cloth.tone(lin(trim));
    cloth.box('cloth', { at: P(0, LOW - 0.4, 1.2), size: [WIDE + 0.45, 0.4, 0.14], turn: yaw });
    cloth.box('cloth', { at: P(0, LOW * 0.45, 1.2), size: [WIDE + 0.45, 0.3, 0.14], turn: yaw });
    // the roof: a tall spire of canvas over the top tier in the colour, the trim round its eave
    cloth.tone(lin(robe));
    const ry = TALL + 2;
    const rd = TIERS * 2.2 + 1.4;
    const apex = P(0, ry + 9.5, -rd / 2 + 0.7);
    const eaves = [P(-WIDE / 2 - 0.6, ry, 0.9), P(WIDE / 2 + 0.6, ry, 0.9), P(WIDE / 2 + 0.6, ry, -rd + 0.5), P(-WIDE / 2 - 0.6, ry, -rd + 0.5)];
    for (let e = 0; e < 4; e++) cloth.tri('cloth', eaves[e], eaves[(e + 1) % 4], apex);
    cloth.tone(lin(trim));
    for (let e = 0; e < 4; e++) cloth.beam('cloth', eaves[e], eaves[(e + 1) % 4], 0.35, 0.3);
    // the skirt round the tower’s legs on the other three sides, so it stands as a tower and not a frame
    cloth.tone(lin(robe));
    cloth.box('cloth', { at: P(0, 0, -TIERS * 2.2 - 0.5), size: [WIDE + 0.4, LOW + 0.4, 0.12], turn: yaw });
    // the pennant on the spire’s point, free to stir
    {
      const top = apex;
      m.tone(TONES.iron);
      m.beam('iron', top, [top[0], top[1] + 3, top[2]], 0.08);
      const before = banners.count('banner') * 3;
      banners.tone(lin(trim));
      const wind = [Math.cos(yaw), 0, -Math.sin(yaw)];
      const a = [top[0], top[1] + 2.9, top[2]];
      const b = [top[0], top[1] + 2.0, top[2]];
      const tip = [top[0] + wind[0] * 2.8, top[1] + 2.5, top[2] + wind[2] * 2.8];
      banners.tri('banner', b, tip, a);
      const after = banners.count('banner') * 3;
      hang(after - before, [0, 0.6, 0], k);
      free.push(0, 1, 0);
    }
    {
      const before = banners.count('banner') * 3;
      banners.tone(lin(robe));
      const bw = WIDE * 0.32;
      const top = TALL + 0.6;
      const v = -TIERS * 2.2 - 0.62;
      banners.quad('banner', P(bw / 2, LOW + 0.2, v), P(-bw / 2, LOW + 0.2, v), P(-bw / 2, top, v), P(bw / 2, top, v), { u: bw, v: top - LOW - 0.2 });
      banners.tone(lin(trim));
      banners.quad('banner', P(bw / 2 + 0.1, LOW - 0.3, v - 0.02), P(-bw / 2 - 0.1, LOW - 0.3, v - 0.02), P(-bw / 2 - 0.1, LOW + 0.3, v - 0.02), P(bw / 2 + 0.1, LOW + 0.3, v - 0.02));
      const after = banners.count('banner') * 3;
      const back = [-Math.sin(yaw) * 0.8, 0, -Math.cos(yaw) * 0.8];
      hang(after - before, back, k + 9);
      // (free toward its foot: the first quad’s corners, then the trim’s, all hanging from the top)
      free.push(1, 1, 0, 1, 0, 0, 1, 1, 1, 1, 1, 1);
    }
    // the commentator’s box: a box with its rail, under its own little roof
    if (s.box) {
      m.tone(TONES.oak);
      m.box('timber', { at: P(0, TALL + 2, 1.4), size: [4.2, 1.2, 2.4], turn: yaw });
      cloth.tone(lin(trim));
      cloth.box('cloth', { at: P(0, TALL + 4.6, 1.2), size: [4.6, 0.25, 2.8], turn: yaw });
      m.tone(TONES.timber);
      for (const u of [-2, 2]) m.box('timber', { at: P(u, TALL + 3.2, 2.5), size: [0.15, 1.5, 0.15], turn: yaw });
    }
    // the changing rooms behind the end stands, outside the oval, the broom rack by their door
    if (s.changing) {
      const back = -TIERS * 2.2 - 0.6;
      m.tone(TONES.oak);
      m.box('timber', { at: P(0, 0, back - 3.2), size: [12, 3.4, 5.5], turn: yaw });
      cloth.tone(lin(robe));
      cloth.box('cloth', { at: P(0, 3.4, back - 3.2), size: [12.6, 0.5, 6], turn: yaw });
      m.tone(TONES.iron);
      m.box('timber', { at: P(-2.5, 0, back - 6), size: [1.3, 2.4, 0.1], turn: yaw });
      // the rack: two posts, a rail, six brooms leaning on it
      m.tone(TONES.timber);
      for (const u of [1.5, 4.5]) m.box('timber', { at: P(u, 0, back - 7), size: [0.15, 1.3, 0.15], turn: yaw });
      m.box('timber', { at: P(3, 1.2, back - 7), size: [3.2, 0.12, 0.12], turn: yaw });
      for (let b = 0; b < 6; b++) {
        const u = 1.8 + b * 0.5;
        m.tone(TONES.oak);
        m.beam('timber', P(u, 0.25, back - 7.6), P(u + 0.05, 1.9, back - 7.05), 0.05);
        m.tone([0.55, 0.45, 0.25]);
        m.beam('timber', P(u - 0.02, 0.0, back - 7.7), P(u, 0.55, back - 7.55), 0.16, 0.1);
      }
    }
  }
  // the hoops: three at each end on their poles, gold rings at the book’s heights
  const hoops = createMesh();
  hoops.tone([1, 1, 1]);
  for (const end of [-1, 1])
    for (const h of PITCH.hoops) {
      const x = end * PITCH.hoopX;
      hoops.ring('hoop', { at: [x, 0, h.z], r: 0.16, r2: 0.11, h: h.y - h.r, sides: 8 });
      // (the ring: a torus laid round its own axis across the pitch, as beams round a circle)
      const n = 20;
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * Math.PI * 2;
        const a1 = ((i + 1) / n) * Math.PI * 2;
        hoops.beam('hoop', [x, h.y + Math.cos(a0) * h.r, h.z + Math.sin(a0) * h.r], [x, h.y + Math.cos(a1) * h.r, h.z + Math.sin(a1) * h.r], 0.16);
      }
    }

  const clothMat = house ? house.material({ vertexColors: true, side: THREE.DoubleSide }) : new MeshLambertNodeMaterial({ vertexColors: true, side: THREE.DoubleSide });
  // (the canvas hangs in folds, and is darker toward the grass where the weather has had it)
  onColor(
    clothMat,
    (d) => {
      const p = positionLocal;
      const folds = sin(p.x.add(p.z).mul(2.3)).mul(0.5).add(0.5);
      return d.rgb.mul(mix(float(0.78), float(1.05), folds)).mul(smoothstep(-0.5, 6, p.y).mul(0.25).add(0.75));
    },
    'pitch:cloth',
  );
  const mats = { ...materials, cloth: clothMat, hoop: house ? house.material({ color: 0xd6a83a }) : new MeshLambertNodeMaterial({ color: 0xd6a83a }) };
  const own = [mats.cloth, mats.hoop];
  const geos = [];
  const add = (built, name) => {
    for (const [mat, g] of Object.entries(built.geometries())) {
      const mesh = new THREE.Mesh(g, mats[mat]);
      mesh.castShadow = tier !== 'low';
      mesh.receiveShadow = true;
      mesh.name = `pitch:${name}:${mat}`;
      group.add(mesh);
      geos.push(g);
    }
  };
  add(m, 'frame');
  add(cloth, 'cloth');
  add(hoops, 'hoops');
  // the banners: their own material, which sways them from where they hang
  const bannerGeo = banners.geometries().banner;
  bannerGeo.setAttribute('aSway', new THREE.Float32BufferAttribute(sway, 3));
  bannerGeo.setAttribute('aFree', new THREE.Float32BufferAttribute(free, 1));
  bannerGeo.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 1));
  const bannerMat = bannerMaterial(house, uTime);
  own.push(bannerMat);
  const bannerMesh = new THREE.Mesh(bannerGeo, bannerMat);
  bannerMesh.name = 'pitch:banners';
  bannerMesh.castShadow = false;
  group.add(bannerMesh);
  geos.push(bannerGeo);

  // what the walk goes round: each stand as a box, the changing rooms
  const colliders = [];
  const yaw0 = PITCH_AT.yaw;
  const toWorld = (x, z) => [PITCH_AT.at[0] + x * Math.cos(yaw0) + z * Math.sin(yaw0), PITCH_AT.at[2] - x * Math.sin(yaw0) + z * Math.cos(yaw0)];
  for (const s of STANDS) {
    const { x, z, yaw } = standAt(s.a);
    const back = -TIERS * 1.1;
    colliders.push({ id: 'stand', kind: 'box', at: toWorld(x + Math.sin(yaw) * back, z + Math.cos(yaw) * back), w: WIDE + 1, d: TIERS * 2.2 + 2.4, turn: yaw + yaw0 });
    if (s.changing) {
      const cb = -TIERS * 2.2 - 3.8;
      colliders.push({ id: 'changing-rooms', kind: 'box', at: toWorld(x + Math.sin(yaw) * cb, z + Math.cos(yaw) * cb), w: 12.4, d: 5.9, turn: yaw + yaw0 });
    }
  }
  const box = (() => {
    const s = STANDS.find((t) => t.box);
    const { x, z, yaw } = standAt(s.a);
    return [x + Math.sin(yaw), TALL + 3, z + Math.cos(yaw)];
  })();

  return {
    group,
    pitch: { at, yaw: PITCH_AT.yaw, seats: seatsOf(), built: true, box },
    colliders,
    step(dt) {
      uTime.value += dt;
    },
    dispose() {
      turfGeo.dispose();
      turfMat.dispose();
      for (const g of geos) g.dispose();
      for (const o of own) o.dispose();
    },
  };
}
