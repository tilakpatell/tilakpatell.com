// The trail check's scene and its arithmetic (GPU-first lane N2): every
// kind of thing that moves crosses a still background, so a temporal pass
// (TRAA, TAAU) that reprojects one of them by the wrong velocity leaves its
// colour behind it, where the check finds it.
//
// The movers, one a lane across the screen, each its own flat colour (unlit,
// so the colour behind it is unmistakable), moving right at SPEED a frame:
// - crate: a plain mesh, moved by its matrix;
// - figure: a skinned mesh, moved by its bone (the mesh stays: three's
//   skinning velocity);
// - row: an InstancedMesh of three, moved by their instance matrices;
// - card: an alpha-tested plane (a foliage card's cut-out), moved by its matrix;
// - banner: a still plane whose texture pans (a scrolling sign): it has no
//   band, being still; it is there to be seen not to smear.
//
// createTrails(scene, camera, THREE) → { movers, step(), screen({ width, height }) }
//   screen(): each geometric mover's box on the screen now and its travel
//   a frame, in pixels (y down, as a shot's rows)
// trailBand(rect, step, size) → the strip behind the mover, past one frame's
//   travel, as long as the mover, clipped to the picture
// trailShare({ data, info }, band, rgb, tol) → the band's share of pixels
//   within `tol` (0…255, each channel) of the mover's colour

// the gate, the spec's §4 “N2”: no trail longer than one frame after 30
export const TRAIL = { frames: 30, most: 0.02, tol: 40, _source: 'the GPU-first spec §4 “N2” (no trail longer than one frame); the 2 % and the tolerance are this fixture’s, for SwiftShader’s noise' };
const SPEED = 0.06; // m a frame
const START = -3.6; // m
const SIZE = 0.6; // m, each mover's side

export const MOVERS = [
  { name: 'crate', y: 3.6, color: [1, 0.1, 0.1] },
  { name: 'figure', y: 2.6, color: [0.1, 1, 0.15] },
  { name: 'row', y: 1.6, color: [0.15, 0.3, 1] },
  { name: 'card', y: 0.6, color: [1, 0.9, 0.1] },
  { name: 'banner', y: -0.5, color: [1, 0.2, 1] },
];

export function trailBand(rect, { dx }, { width, height }) {
  const dir = Math.sign(dx) || 1;
  const gap = Math.abs(dx);
  const x0 = dir > 0 ? rect.x - gap - rect.w : rect.x + rect.w + gap;
  const lo = Math.max(0, Math.round(x0));
  const hi = Math.min(width, Math.round(x0 + rect.w));
  const y0 = Math.max(0, Math.round(rect.y));
  const y1 = Math.min(height, Math.round(rect.y + rect.h));
  return { x: lo, y: y0, w: Math.max(0, hi - lo), h: Math.max(0, y1 - y0) };
}

export function trailShare({ data, info }, band, rgb, tol = TRAIL.tol) {
  if (!(band.w > 0 && band.h > 0)) return 0;
  let hit = 0;
  for (let y = band.y; y < band.y + band.h; y++) {
    for (let x = band.x; x < band.x + band.w; x++) {
      const i = (y * info.width + x) * info.channels;
      if (Math.abs(data[i] - rgb[0]) <= tol && Math.abs(data[i + 1] - rgb[1]) <= tol && Math.abs(data[i + 2] - rgb[2]) <= tol) hit++;
    }
  }
  return hit / (band.w * band.h);
}

const flat = (THREE, [r, g, b], extra = {}) => new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b), ...extra });

// a pattern texture: `alpha` holes for the card, stripes for the banner
function pattern(THREE, { alpha = false } = {}) {
  const n = 16;
  const data = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const i = (y * n + x) * 4;
      const on = alpha ? (x >> 2) % 2 === 0 || (y >> 2) % 2 === 0 : (x >> 2) % 2 === 0;
      data.set(alpha ? [255, 255, 255, on ? 255 : 0] : on ? [255, 255, 255, 255] : [40, 40, 40, 255], i);
    }
  }
  const t = new THREE.DataTexture(data, n, n);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
}

export function createTrails(scene, camera, THREE) {
  const box = () => new THREE.BoxGeometry(SIZE, SIZE, SIZE);
  const movers = [];
  const add = (name, object, centre, size, move) => {
    scene.add(object);
    movers.push({ name, object, centre, size, move });
  };
  const lane = (name) => MOVERS.find((m) => m.name === name);

  const crate = new THREE.Mesh(box(), flat(THREE, lane('crate').color));
  crate.position.set(START, lane('crate').y, 0);
  add('crate', crate, () => crate.position.clone(), [SIZE, SIZE], () => (crate.position.x += SPEED));

  const geo = box();
  const count = geo.attributes.position.count;
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Uint16Array(count * 4), 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(new Float32Array(count * 4).map((_, i) => (i % 4 === 0 ? 1 : 0)), 4));
  const figure = new THREE.SkinnedMesh(geo, flat(THREE, lane('figure').color));
  const bone = new THREE.Bone();
  bone.position.set(START, lane('figure').y, 0);
  figure.add(bone);
  figure.bind(new THREE.Skeleton([bone]));
  figure.frustumCulled = false;
  add('figure', figure, () => bone.getWorldPosition(new THREE.Vector3()), [SIZE, SIZE], () => (bone.position.x += SPEED));

  const row = new THREE.InstancedMesh(new THREE.BoxGeometry(SIZE / 3, SIZE, SIZE / 3), flat(THREE, lane('row').color), 3);
  row.frustumCulled = false;
  let rowX = START;
  const placeRow = () => {
    const m = new THREE.Matrix4();
    for (let i = 0; i < 3; i++) row.setMatrixAt(i, m.makeTranslation(rowX + (i - 1) * (SIZE / 3), lane('row').y, 0));
    row.instanceMatrix.needsUpdate = true;
  };
  placeRow();
  add('row', row, () => new THREE.Vector3(rowX, lane('row').y, 0), [SIZE, SIZE], () => ((rowX += SPEED), placeRow()));

  const card = new THREE.Mesh(new THREE.PlaneGeometry(SIZE, SIZE), flat(THREE, lane('card').color, { map: pattern(THREE, { alpha: true }), alphaTest: 0.5, side: THREE.DoubleSide }));
  card.position.set(START, lane('card').y, 0);
  add('card', card, () => card.position.clone(), [SIZE, SIZE], () => (card.position.x += SPEED));

  const banner = new THREE.Mesh(new THREE.PlaneGeometry(SIZE * 4, SIZE), flat(THREE, lane('banner').color, { map: pattern(THREE) }));
  banner.position.set(0, lane('banner').y, 0);
  add('banner', banner, () => banner.position.clone(), null, () => (banner.material.map.offset.x += 0.02));

  const project = (v, { width, height }) => {
    const p = v.clone().project(camera);
    return [(p.x * 0.5 + 0.5) * width, (-p.y * 0.5 + 0.5) * height];
  };
  return {
    movers,
    step() {
      for (const m of movers) m.move();
    },
    screen(size) {
      return movers
        .filter((m) => m.size)
        .map((m) => {
          const c = m.centre();
          const [x0, y0] = project(c.clone().add(new THREE.Vector3(-m.size[0] / 2, m.size[1] / 2, 0)), size);
          const [x1, y1] = project(c.clone().add(new THREE.Vector3(m.size[0] / 2, -m.size[1] / 2, 0)), size);
          const [nx] = project(c.clone().add(new THREE.Vector3(SPEED, 0, 0)), size);
          const [cx] = project(c, size);
          return { name: m.name, rect: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }, step: { dx: nx - cx, dy: 0 }, centre: project(c, size) };
        });
    },
  };
}
