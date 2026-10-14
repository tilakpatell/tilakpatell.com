// The level's light beyond its weather, as applyGameLight takes it: the
// lamps (the lighting layers' own and the lamps inside the lighting
// prefabs: Hoth's 414 placements, 413 in Default_Lighting and one in Hangar_01_Props_04), the interiors' visual environments
// (inside.js: Echo Base's VE_PV_Hoth_Interior_01 and VE_No_Sun by the view's
// place, with the interior grade's LUT from the picture manifest), the
// reflection volumes of the level's interior pack (its baked cubes, the
// game's own captures of the light in the hangars and corridors), and the
// volumetrics (volumes.json: the glows and the light cones), each in the
// export's frame.
//
//   levelLightOf({ lighting, pictures, level, tier, off, deps }) → Promise<{ lights, inside, volumes, loadCube, volumetrics }>
//     (off: 'lamps,inside,probes', any of them, left out: a check's measure of each; volumes: the
//      volumetrics marched, off unless asked: on this world their glows blow out at either exposure,
//      lane V's gains being the galaxy's, not yet measured here)
//     (lighting: the rulebook's; pictures: the level's picture manifest; level: map/level.js's,
//      ready; world: its pack name; deps: { loadHdr(bytes) → DataTexture-like } for the tests)
//   lutFor(pictures, inside) → { url, size } | null   (pure: the picture whose grade the patch names)

import { insideOf } from '../../lib/three/light/inside.js';
import { lampRows, lightsJsonOf, probeVolumesOf, volumesToWorld } from './weather.js';

const FACES = ['px', 'nx', 'py', 'ny', 'pz', 'nz'];

export function lutFor(pictures, inside) {
  const want = Object.values(inside?.patches ?? {}).map((p) => p.components?.ColorCorrection?.HdrColorGradingLut).find(Boolean);
  if (!want) return null;
  for (const w of Object.values(pictures?.weathers ?? {})) if (w?.lut?.name === want && w.lut.url) return { url: w.lut.url, size: w.lut.size };
  return null;
}

const json = (bytes) => JSON.parse(new TextDecoder().decode(bytes));

async function hdrLoader() {
  const THREE = await import('three');
  const { HDRLoader } = await import('three/examples/jsm/loaders/HDRLoader.js');
  const loader = new HDRLoader().setDataType(THREE.HalfFloatType);
  return { THREE, parse: (bytes) => loader.parse(bytes) };
}

export async function levelLightOf({ lighting, pictures = null, level = null, tier = 'high', off = null, volumes: marched = false, deps = {} }) {
  const no = new Set(String(off ?? '').split(','));
  const lights = lightsJsonOf(no.has('lamps') ? lighting?.lights ?? [] : lampRows(lighting));
  const found = no.has('inside') ? null : insideOf(lighting);
  const inside = found ? { ...found, lut: lutFor(pictures, found) } : null;
  // (the interior pack's reflection volumes where there is one, else the outside's)
  const packed = level?.inner ?? (level?.pack ? { pack: level.pack, loadBin: level.loadBin } : null);
  let volumes = null;
  let loadCube = null;
  if (packed?.loadBin && !no.has('probes')) {
    const probes = await packed
      .loadBin('probes.json')
      .then(json)
      .catch(() => null);
    volumes = probes ? probeVolumesOf(probes, packed.pack) : null;
    if (volumes?.length) {
      const hdr = deps.loadHdr ? null : await hdrLoader();
      loadCube = async (v) => {
        const stem = tier === 'ultra' && v.ultra ? v.ultra : v.faces;
        const faces = await Promise.all(FACES.map((f) => packed.loadBin(`${stem}.${f}.hdr`)));
        if (deps.loadHdr) return deps.loadHdr(faces);
        const { THREE } = hdr;
        const cube = new THREE.CubeTexture();
        cube.type = THREE.HalfFloatType;
        cube.colorSpace = THREE.LinearSRGBColorSpace;
        cube.minFilter = cube.magFilter = THREE.LinearFilter;
        cube.generateMipmaps = false;
        faces.forEach((bytes, i) => {
          const d = hdr.parse(bytes);
          const t = new THREE.DataTexture(d.data, d.width, d.height);
          Object.assign(t, { type: cube.type, colorSpace: cube.colorSpace, minFilter: cube.minFilter, magFilter: cube.magFilter, generateMipmaps: false });
          cube.images[i] = t;
        });
        cube.needsUpdate = true;
        return cube;
      };
    }
  }
  const raw = level?.loadBin && marched
    ? await level
        .loadBin('volumes.json')
        .then(json)
        .catch(() => null)
    : null;
  const volumetrics = raw && level?.pack ? volumesToWorld(raw, level.pack) : null;
  return { lights, inside, volumes: volumes?.length ? volumes : null, loadCube, volumetrics };
}
