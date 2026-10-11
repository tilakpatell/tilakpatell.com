// What the worlds' own props are built from (props.js and the worlds'
// builders): parts put together as the galaxy's code-built ships are
// (universe/trafficKit.js: a geometry, where it goes, its colour, the
// material it's drawn with), baked into one mesh per material, each part's
// colour in its vertices. A handful of shared materials: painted metal
// with panel lines, bare metal, dressed stone, rock, adobe, planks,
// concrete, cloth, bark, leaves, glass and glow (hot enough to bloom). All
// in metres. The plants' cards (needles, leaves, fronds, broad leaves) light
// as Bruno Simon's foliage does: each card's normal is its clump's, both of
// its faces lit by it, the sun wrapping past the edge and through from
// behind, and they move in one wind (kit.tick).
//
// The solid ones wear photo-scanned surfaces (public/cc0/galaxy/, made by
// scripts/galaxy-textures.mjs from Poly Haven's CC0 scans): a detail map
// under the part's own colour (the grain of the plaster, the seams of the
// plates, the joints of the blocks), a normal map, and ambient occlusion,
// roughness and metalness, laid on at their real size (a block a block's
// size, whatever the wall). Till they're loaded (kit.ready) a part wears a
// painted-in-code stand-in.
//
// GLSL-free: the plants' light, their wind, the scans' wear and the scans
// themselves are handed in (createKitWith(looks, opts)), kit.js's on the
// classic renderer and nodes/kit.js's on the node renderer.

import * as THREE from 'three';
import { bake, canvasTexture, panelTexture, part, place, rod, between, compose, mirror, ball, upright } from '../../universe/trafficKit';
import { rng } from './noise';
import { coverageTexture } from '../../../lib/three/textures';

export { part, place, rod, between, compose, mirror, ball, upright };

const { PI } = Math;

// a grey speckled texture: grime on metal, the grain of stone and adobe
function grimeTexture(seed = 7) {
  const r = rng(seed);
  return canvasTexture(256, (c, n) => {
    c.fillStyle = '#e4e4e4';
    c.fillRect(0, 0, n, n);
    for (let i = 0; i < 2600; i++) {
      const v = 150 + r() * 105;
      c.fillStyle = `rgba(${v},${v},${v},${0.18 + r() * 0.3})`;
      const s = 1 + r() * r() * 9;
      c.fillRect(r() * n, r() * n, s, s);
    }
    // streaks, down (rain and dust down a wall)
    for (let i = 0; i < 70; i++) {
      const v = 120 + r() * 70;
      c.fillStyle = `rgba(${v},${v},${v},0.12)`;
      c.fillRect(r() * n, r() * n, 1 + r() * 3, 10 + r() * 60);
    }
  });
}

// a spray of conifer needles on its twigs, alpha-cut (the foliage cards of
// the forest worlds' trees: a twig up the middle, side twigs off it, short
// needles all along them), pale, so a part's colour gives it its green
function needleTexture(seed = 5) {
  const r = rng(seed);
  const t = canvasTexture(256, (c, n) => {
    c.clearRect(0, 0, n, n);
    c.lineCap = 'round';
    const shade = () => {
      const v = 190 + r() * 60;
      return `rgb(${v * 0.92},${v},${v * 0.86})`;
    };
    const twig = (x0, y0, x1, y1, needle, w) => {
      c.strokeStyle = '#9a8c78';
      c.lineWidth = w;
      c.beginPath();
      c.moveTo(x0, y0);
      c.lineTo(x1, y1);
      c.stroke();
      const len = Math.hypot(x1 - x0, y1 - y0);
      const [dx, dy] = [(x1 - x0) / len, (y1 - y0) / len];
      for (let d = 0; d < len; d += 2.2) {
        const px = x0 + dx * d;
        const py = y0 + dy * d;
        const l = needle * (0.7 + r() * 0.5) * (1 - (d / len) * 0.45);
        for (const side of [-1, 1]) {
          const a = Math.atan2(dy, dx) + side * (0.75 + r() * 0.35);
          c.strokeStyle = shade();
          c.lineWidth = 1.6 + r() * 0.8;
          c.beginPath();
          c.moveTo(px, py);
          c.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l);
          c.stroke();
        }
      }
    };
    // the main twig, bottom middle to near the top, and its side twigs
    const bend = (r() - 0.5) * 20;
    twig(n / 2, n * 0.99, n / 2 + bend, n * 0.06, 15, 3);
    for (let i = 0; i < 7; i++) {
      const f = 0.15 + i * 0.11;
      const y = n * (0.99 - f * 0.93);
      const x = n / 2 + bend * f;
      for (const side of [-1, 1]) {
        const reach = n * (0.36 - f * 0.28) * (0.8 + r() * 0.4);
        twig(x, y, x + side * reach, y - reach * (0.55 + r() * 0.3), 11, 2);
      }
    }
  });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return keepCoverage(t);
}

// a clump of small leaves, alpha-cut (the broadleaf crowns: the jungle's,
// the wroshyrs', Naboo's groves): Bruno Simon's foliage card, forty-odd
// pointed leaves filling a disc, each turned out from its middle, the ones
// at the back dimmer, so a card reads as a handful of leaves, not as one
// big one; pale, for the part's green to tint
function leafTexture(seed = 6) {
  const r = rng(seed);
  const t = canvasTexture(256, (c, n) => {
    c.clearRect(0, 0, n, n);
    const leaves = 46;
    for (let i = 0; i < leaves; i++) {
      // (out from the middle, more of them toward the rim; kept inside the
      // card, so a turned card never cuts one off)
      const a = r() * PI * 2;
      const d = n * 0.34 * Math.sqrt(0.08 + r() * 0.92);
      const x = n / 2 + Math.cos(a) * d;
      const y = n / 2 + Math.sin(a) * d;
      const l = n * (0.1 + r() * 0.06);
      const v = 150 + (i / leaves) * 85 + r() * 20;
      c.save();
      c.translate(x, y);
      c.rotate(a + PI / 2 + (r() - 0.5) * 0.9);
      c.fillStyle = `rgb(${Math.min(255, v * 0.93)},${Math.min(255, v)},${Math.min(255, v * 0.8)})`;
      c.beginPath();
      c.moveTo(0, l * 0.5);
      c.quadraticCurveTo(l * 0.24, 0, 0, -l * 0.5);
      c.quadraticCurveTo(-l * 0.24, 0, 0, l * 0.5);
      c.fill();
      c.strokeStyle = 'rgba(110,120,90,0.45)';
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(0, l * 0.45);
      c.lineTo(0, -l * 0.4);
      c.stroke();
      c.restore();
    }
  });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return keepCoverage(t);
}

// a fern's frond, alpha-cut, base at the bottom: a stalk up the middle and
// pairs of narrow leaflets off it, longest a third of the way up, angled
// toward the tip (Endor's sword ferns, the jungles' ferns, palm fronds)
function frondTexture(seed = 8) {
  const r = rng(seed);
  const t = canvasTexture(256, (c, n) => {
    c.clearRect(0, 0, n, n);
    c.strokeStyle = '#a49a7a';
    c.lineWidth = 3;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(n / 2, n);
    c.lineTo(n / 2, n * 0.03);
    c.stroke();
    const pairs = 22;
    for (let i = 0; i < pairs; i++) {
      const f = (i + 0.6) / pairs;
      const y = n * (0.97 - f * 0.93);
      const l = n * 0.47 * Math.sin(PI * (0.1 + 0.9 * f)) ** 0.7 * (1 - f * 0.25);
      for (const side of [-1, 1]) {
        const a = -PI / 2 + side * (1.05 - f * 0.25 + (r() - 0.5) * 0.12);
        const v = 175 + r() * 70;
        c.save();
        c.translate(n / 2, y);
        c.rotate(a);
        c.fillStyle = `rgb(${v * 0.92},${v},${v * 0.82})`;
        const w = l * 0.13;
        c.beginPath();
        c.moveTo(0, 0);
        c.quadraticCurveTo(l * 0.5, -w, l, 0);
        c.quadraticCurveTo(l * 0.5, w, 0, 0);
        c.fill();
        c.restore();
      }
    }
  });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return keepCoverage(t);
}

// one big leaf, alpha-cut, its stalk at the bottom: a broad pointed oval
// with a midrib and the veins off it, now and then split between them
// (the jungles' undergrowth, Dagobah's bog leaves)
function broadLeafTexture(seed = 9) {
  const r = rng(seed);
  const t = canvasTexture(256, (c, n) => {
    c.clearRect(0, 0, n, n);
    const cx = n / 2;
    c.fillStyle = 'rgb(214,226,190)';
    c.beginPath();
    c.moveTo(cx, n * 0.97);
    c.bezierCurveTo(cx + n * 0.5, n * 0.78, cx + n * 0.4, n * 0.2, cx, n * 0.02);
    c.bezierCurveTo(cx - n * 0.4, n * 0.2, cx - n * 0.5, n * 0.78, cx, n * 0.97);
    c.fill();
    // (a split or two, as a big leaf tears)
    c.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 2; i++) {
      const y = n * (0.3 + r() * 0.4);
      const side = r() < 0.5 ? -1 : 1;
      c.beginPath();
      c.moveTo(cx + side * n * 0.5, y - n * 0.1);
      c.lineTo(cx + side * n * 0.04, y + n * 0.02);
      c.lineTo(cx + side * n * 0.5, y - n * 0.06);
      c.fill();
    }
    c.globalCompositeOperation = 'source-over';
    c.strokeStyle = 'rgba(150,160,120,0.9)';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(cx, n * 0.97);
    c.lineTo(cx, n * 0.06);
    c.stroke();
    c.lineWidth = 1.5;
    c.strokeStyle = 'rgba(160,170,130,0.7)';
    for (let i = 0; i < 7; i++) {
      const y = n * (0.85 - i * 0.11);
      for (const side of [-1, 1]) {
        c.beginPath();
        c.moveTo(cx, y);
        c.quadraticCurveTo(cx + side * n * 0.18, y - n * 0.04, cx + side * n * 0.34, y - n * 0.14);
        c.stroke();
      }
    }
  });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return keepCoverage(t);
}

// moss and vines hanging, alpha-cut, from the top edge down: a dozen wavy
// strands of different lengths, ragged at their ends (Dagobah's trees,
// draped; the creepers on the temples)
function strandTexture(seed = 10) {
  const r = rng(seed);
  const t = canvasTexture(256, (c, n) => {
    c.clearRect(0, 0, n, n);
    c.lineCap = 'round';
    for (let i = 0; i < 14; i++) {
      const x0 = n * (0.08 + r() * 0.84);
      const len = n * (0.35 + r() * 0.62);
      const w = 3 + r() * 5;
      const v = 170 + r() * 70;
      c.strokeStyle = `rgb(${v * 0.92},${v},${v * 0.86})`;
      c.lineWidth = w;
      c.beginPath();
      c.moveTo(x0, 0);
      for (let y = 0; y < len; y += 8) {
        const k = y / len;
        c.lineTo(x0 + Math.sin(y * 0.045 + i) * 6 * k, y);
        c.lineWidth = w * (1 - k * 0.6);
      }
      c.stroke();
      // (wisps off it, toward the end)
      for (let j = 0; j < 5; j++) {
        const y = len * (0.4 + r() * 0.55);
        c.lineWidth = 1.5;
        c.beginPath();
        c.moveTo(x0, y);
        c.lineTo(x0 + (r() - 0.5) * 14, y + 8 + r() * 14);
        c.stroke();
      }
    }
  });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return keepCoverage(t);
}

// A cut-out texture's mip levels made by hand, each level's alpha scaled so
// as much of it is over the cut as at full size: far-off foliage stays as
// thick as near (left to the graphics chip, averaging thins it away). The
// site's one way of doing it, lib/three/textures' coverageTexture.
function keepCoverage(t, cut = 0.3) {
  return coverageTexture(t, { cut });
}

// The scanned surfaces, each loaded once for the page: the site's one core
// kit (lib/three/core), which every world shares.

// The kit's solid materials on the core kit's roles (lib/three/core): each
// wears its role's scan in the world, triplanar, at the scan's own size, so a
// wall of any size shows the same grain (sand, snow and mud are for a
// model's `wear`, placer.js).
export const KIT_ROLES = {
  paint: 'paint',
  metal: 'metal',
  stone: 'stone',
  rock: 'rock',
  adobe: 'adobe',
  bark: 'bark',
  wood: 'wood',
  concrete: 'concrete',
  tiles: 'tiles',
  deck: 'deck',
  sand: 'sand',
  snow: 'snow',
  mud: 'mud',
};

// How each solid role wears its scan: how strongly its colour shows and its
// relief; and for the twins dressed by their UVs (moving things, where a
// scan in the world would slide over them), how rough each is over the
// scan's own roughness, and whether its metalness comes from the scan (bare
// metal) or is the role's own (painted plates, which aren't).
export const LOOKS = {
  paint: { roughness: 0.9, metalness: 0.15, normal: 0.9 },
  metal: { roughness: 1, metalness: 0.75, scanMetal: true, normal: 1 },
  stone: { roughness: 1, metalness: 0, normal: 1.1 },
  rock: { roughness: 1, metalness: 0, normal: 1.3 },
  adobe: { roughness: 1, metalness: 0, normal: 0.8 },
  bark: { roughness: 1, metalness: 0, normal: 1.4 },
  wood: { roughness: 1, metalness: 0, normal: 1 },
  concrete: { roughness: 1, metalness: 0, normal: 0.7 },
  // (the bases' floors: Theed's polished slabs, a tread plate)
  tiles: { roughness: 0.6, metalness: 0, normal: 0.8 },
  // (for a model's `wear` only: no kit material is these)
  sand: { roughness: 1, metalness: 0, normal: 0.8 },
  snow: { roughness: 1, metalness: 0, normal: 0.6 },
  mud: { roughness: 1, metalness: 0, normal: 1 },
  deck: { roughness: 0.8, metalness: 0.6, scanMetal: true, normal: 1 },
  // (the worlds' own rock: Geonosis's red, eroded stone; Endor's mossy boulders)
  redrock: { roughness: 1, metalness: 0, normal: 1.2 },
  mossrock: { roughness: 1, metalness: 0, normal: 1.2 },
};
// a role's repeats a metre (the scan's real size; the stand-in's own where
// there's no scan)
// a role's scan's size in metres, and the brightness its detail map is centred on

// The kit's own pictures, painted once a seed for the page: the canvases
// and their mip levels made by hand (keepCoverage) were a few hundred
// milliseconds of every landing, the same each time. Each kit has its own
// copies of them, on the same paint (and in three the same picture on the
// graphics chip), so what one does to its own is its own and its dispose
// frees only those. `draws`: how many of the seed's numbers the plates
// took, dealt out again for a kit made from the paint, so its builders get
// the numbers they always did. The last few seeds asked for are kept.
const PAINTED = new Map(); // seed → { pictures, draws }
const PAINTED_KEPT = 4;
function paintedFor(seed, r) {
  let got = PAINTED.get(seed);
  if (got) {
    PAINTED.delete(seed);
    for (let i = 0; i < got.draws; i++) r();
  } else {
    let draws = 0;
    const counted = () => {
      draws += 1;
      return r();
    };
    const grime = grimeTexture(seed);
    grime.wrapS = grime.wrapT = THREE.RepeatWrapping;
    grime.colorSpace = THREE.SRGBColorSpace;
    const plates = panelTexture(counted, { min: 10, base: 222, spread: 16, seam: 0.55, detail: 0.35 });
    plates.wrapS = plates.wrapT = THREE.RepeatWrapping;
    plates.colorSpace = THREE.SRGBColorSpace;
    const pictures = { grime, plates, needles: needleTexture(seed), foliage: leafTexture(seed + 1), fronds: frondTexture(seed + 2), broadleaf: broadLeafTexture(seed + 3), strands: strandTexture(seed + 4) };
    got = { pictures, draws };
  }
  PAINTED.set(seed, got);
  if (PAINTED.size > PAINTED_KEPT) PAINTED.delete(PAINTED.keys().next().value);
  return Object.fromEntries(Object.entries(got.pictures).map(([k, t]) => [k, t.clone()]));
}

export function createKitWith(looks, { seed = 11, scans = true, wind: blow = null, load = looks.loadScan } = {}) {
  const { faceless, wind, wrapLighting, wear, scanOf } = looks;
  // (made as the looks' renderer draws them: a node renderer's hooks then
  // change them where they are, as the GLSL's patches do)
  const made = looks.material ?? ((m) => m);
  const densityOf = (role, fallback) => (scanOf(role)?.metres ? 1 / scanOf(role).metres : fallback);
  const owned = [];
  const own = (x) => {
    owned.push(x);
    return x;
  };
  const r = rng(seed);
  const pic = paintedFor(seed, r);
  const grime = own(pic.grime);
  const plates = own(pic.plates);
  const std = (o, density, role = null) => {
    const m = own(made(new THREE.MeshStandardMaterial({ vertexColors: true, ...o })));
    m.userData.density = role ? densityOf(role, density) : density;
    if (role) m.userData.role = role;
    return m;
  };
  const mats = {
    paint: std({ roughness: 0.72, metalness: 0.15, map: plates }, 0.35, 'paint'),
    metal: std({ roughness: 0.42, metalness: 0.55, map: grime }, 0.5, 'metal'),
    stone: std({ roughness: 0.96, map: grime }, 0.18, 'stone'),
    rock: std({ roughness: 0.96, map: grime }, 0.3, 'rock'),
    redrock: std({ roughness: 0.96, map: grime }, 0.7, 'redrock'),
    mossrock: std({ roughness: 0.96, map: grime }, 0.33, 'mossrock'),
    adobe: std({ roughness: 0.98, map: grime }, 0.12, 'adobe'),
    wood: std({ roughness: 0.9, map: grime }, 0.5, 'wood'),
    concrete: std({ roughness: 0.9, map: grime }, 0.3, 'concrete'),
    tiles: std({ roughness: 0.6, map: grime }, 0.33, 'tiles'),
    deck: std({ roughness: 0.5, metalness: 0.55, map: grime }, 2, 'deck'),
    cloth: std({ roughness: 1, side: THREE.DoubleSide }, 0.5),
    bark: std({ roughness: 0.95, map: grime }, 0.6, 'bark'),
    leaf: std({ roughness: 0.82, side: THREE.DoubleSide }, 0.5),
    // (foliage cards: needles on twigs, cut out of the light behind them)
    // (cut out by alpha to coverage, where the frame is multisampled: soft
    // edges, and leaves that don't thin away in the smaller mip levels)
    needles: std({ roughness: 0.85, side: THREE.DoubleSide, map: own(pic.needles), alphaTest: 0.3, alphaToCoverage: true }, 1),
    foliage: std({ roughness: 0.75, side: THREE.DoubleSide, map: own(pic.foliage), alphaTest: 0.3, alphaToCoverage: true }, 1),
    // (ferns' and palms' fronds, and the jungles' big leaves, on cards)
    fronds: std({ roughness: 0.8, side: THREE.DoubleSide, map: own(pic.fronds), alphaTest: 0.3, alphaToCoverage: true }, 1),
    broadleaf: std({ roughness: 0.7, side: THREE.DoubleSide, map: own(pic.broadleaf), alphaTest: 0.3, alphaToCoverage: true }, 1),
    // (the smooth solid middle of a crown the leaf cards sit on, so the
    // light doesn't pour through it)
    crown: std({ roughness: 0.85 }, 1),
    // (moss and vines hanging; a reed's or a grass's blades, two-sided)
    strands: std({ roughness: 0.9, side: THREE.DoubleSide, map: own(pic.strands), alphaTest: 0.3, alphaToCoverage: true }, 1),
    blades: std({ roughness: 0.85, side: THREE.DoubleSide }, 1),
    dark: std({ roughness: 0.55, metalness: 0.2 }, 1),
    glass: own(made(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.08, metalness: 0.3, transparent: true, opacity: 0.55 }))),
    glow: own(made(new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }))),
  };
  for (const m of [mats.glass, mats.glow]) m.userData.density = 1;
  // the plants lit as foliage and moving in the wind, all by one clock (the
  // shared leaf material is the creatures' skin too: it stays as it is)
  const windTime = { value: 0 };
  // (the way it blows: the world's own, so the grass in lib/three/wind and
  // the kit's plants and cloth lean the same way)
  const windDir = blow?.angle != null ? new THREE.Vector2(Math.cos(blow.angle), Math.sin(blow.angle)) : undefined;
  for (const [name, kind] of [
    ['needles', 'tree'],
    ['foliage', 'tree'],
    ['crown', 'tree'],
    ['fronds', 'shrub'],
    ['broadleaf', 'shrub'],
    ['strands', 'shrub'],
    ['blades', 'shrub'],
    ['cloth', 'shrub'],
  ]) {
    // (cloth, banners and awnings, only stirs: it isn't lit as a leaf)
    if (name !== 'cloth') {
      wrapLighting(mats[name], { wrap: 0.45, backScatter: 0.35 });
      if (mats[name].side === THREE.DoubleSide) faceless(mats[name]);
    }
    const strength = kind === 'tree' ? { strength: 0.12 } : name === 'cloth' ? { strength: 0.08 } : {};
    wind(mats[name], { kind, time: windTime, ...(windDir ? { dir: windDir } : {}), ...strength });
  }

  // each solid role's twin for things that move (a ride, a figure built of
  // props, what you carry): dressed by its UVs, the grain going with it
  const twins = {};
  for (const m of Object.values(mats)) if (m.userData.role && !twins[m.userData.role]) twins[m.userData.role] = own(Object.assign(m.clone(), { userData: { ...m.userData, twin: true } }));

  // the scans on every material that wears one: the role's own, and the
  // copies the builders made of them (a clone keeps its role in userData).
  // In the world, triplanar at the scan's size (its own roughness and
  // metalness kept: no picture of them goes on); on a moving thing's twin,
  // by its UVs with the scan's roughness and metal.
  let dead = false;
  let kept = false; // (keep(): the stand-ins stay, whatever comes)
  const wearOn = (m, scan) => {
    const look = LOOKS[m.userData.role];
    const size = scanOf(m.userData.role);
    if (!look || !scan?.map || !size) return;
    m.map = null;
    wear(m, scan, { metres: size.metres ?? 2, strength: look.strength ?? 0.55, normal: look.normal, mean: size.mean ?? 0.8 });
  };
  const dress = (m, scan) => {
    const look = LOOKS[m.userData.role];
    if (!look || !scan) return;
    m.map = scan.map;
    m.normalMap = scan.normalMap;
    m.normalScale.setScalar(look.normal);
    if (scan.arm) {
      m.aoMap = scan.arm; // (its red)
      m.aoMapIntensity = 0.85;
      m.roughnessMap = scan.arm; // (its green)
      if (look.scanMetal) m.metalnessMap = scan.arm; // (its blue)
    }
    m.roughness = look.roughness;
    m.metalness = look.metalness;
    m.needsUpdate = true;
  };
  const roles = Object.keys(LOOKS).filter((role) => scanOf(role));
  const ready = scans
    ? Promise.all(roles.map((role) => load(role).then((scan) => [role, scan]))).then((list) => {
        if (dead || kept) return;
        const by = Object.fromEntries(list);
        for (const m of owned) if (m.isMeshStandardMaterial && m.userData.role) (m.userData.twin ? dress : wearOn)(m, by[m.userData.role]);
      })
    : Promise.resolve();

  // one geometry of the parts drawn with one material (for instancing)
  const geometry = (parts) => own(bake(parts, mats[parts[0]?.to ?? 'paint']?.userData.density ?? 0.5));

  return {
    mats,
    own,
    // (the renderer's looks it was made with: the props and the placer take
    // their windows, shield, shafts, scans and kit models' loader from here)
    looks,
    rand: r,
    geometry,
    // the scans on (or failed: the stand-ins stay): wait for it before the
    // shaders are made, or they're made twice
    ready,
    // the wind's clock, shared with whatever else moves in it (the grass)
    wind: windTime,
    // a thing that moves onto the twins (its scans by its UVs, going with
    // it); how many meshes changed
    moving(root) {
      let n = 0;
      root?.traverse?.((o) => {
        if (!o.isMesh) return;
        const swap = (m) => (m?.userData.role && !m.userData.twin && twins[m.userData.role] ? twins[m.userData.role] : m);
        const before = o.material;
        o.material = Array.isArray(before) ? before.map(swap) : swap(before);
        if (Array.isArray(before) ? before.some((m, i) => m !== o.material[i]) : before !== o.material) n += 1;
      });
      return n;
    },
    // the wind's clock on (held still for reduced motion: not called)
    tick(dt) {
      windTime.value += dt;
    },
    // parts → a group of meshes, one per material; shadows cast unless
    // they glow or see through
    build(parts, { shadows = true, name = 'prop' } = {}) {
      const group = new THREE.Group();
      group.name = name;
      const by = {};
      for (const p of parts) (by[p.to ?? 'paint'] ??= []).push(p);
      for (const [to, list] of Object.entries(by)) {
        const mat = mats[to] ?? mats.paint;
        const mesh = new THREE.Mesh(own(bake(list, mat.userData.density ?? 0.5)), mat);
        mesh.name = to;
        mesh.castShadow = shadows && to !== 'glow' && to !== 'glass';
        mesh.receiveShadow = to !== 'glow';
        group.add(mesh);
      }
      return group;
    },
    // the stand-ins kept: scans that come from now on aren't worn (on a
    // world already shown, every material in it would go into another
    // shader at once; the next kit has them from the page's)
    keep() {
      kept = true;
    },
    dispose() {
      dead = true;
      // (the scans are the page's, shared by every world: not freed here)
      for (const o of owned) o.dispose();
      owned.length = 0;
    },
  };
}

// ── Shapes ──

// a lumpy rock, about 1 across, its base flat-ish at y = 0
export function rockGeometry(seed = 1, { sharp = 0.35, detail = 1, flat = 0.55 } = {}) {
  const g = new THREE.IcosahedronGeometry(0.5, detail);
  const r = rng(seed);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  const bumps = Array.from({ length: 5 }, () => [new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize(), (r() - 0.4) * sharp]);
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = v.clone().normalize();
    let k = 1;
    for (const [d, a] of bumps) k += a * Math.max(0, n.dot(d)) ** 3;
    v.multiplyScalar(k);
    v.y = v.y < 0 ? v.y * 0.25 : v.y * flat * 1.6; // sat in the ground, a little squat
    p.setXYZ(i, v.x, v.y + 0.12, v.z);
  }
  g.computeVertexNormals();
  return g;
}

// a cone of cloth (a tent), a dome, a ring
export const dome = (r, h = r, seg = 20) => upright(Array.from({ length: 9 }, (_, i) => [r * Math.cos((i / 8) * (PI / 2)), h * Math.sin((i / 8) * (PI / 2))]), seg);
export const ring = (r, tube, seg = 24) => new THREE.TorusGeometry(r, tube, 8, seg).rotateX(PI / 2);
export const cyl = (r1, r2, h, seg = 16) => new THREE.CylinderGeometry(r2, r1, h, seg).translate(0, h / 2, 0); // (standing on y = 0)
export const box = (w, h, d) => new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0); // (standing on y = 0)
