// Where a sector is, for the market: the Core, a hand-made neighbourhood, a
// portal's mouth, a pocket universe, or a generated region of a kind, each
// with its specialties (cheap where they're made), what it wants (paid well
// for) and its rares (found only far out). The layout session's regions
// (src/lib/space/regions.js's regionOf, once it lands) say which: hand it in
// with setRegions; till then a stand-in of the same shape says the Core is
// sector 0 and every 3 × 3 × 3 block past it a region kind of its own.
// Pure (no React, DOM or three.js).
//
// AREAS: { [id]: { name, kind, specialties, wants, rares } }, keyed by the layout
//   session's ids (neighbourhoods.js's: 'heroes', 'oldroads', 'earthside', 'stage',
//   'arcade', 'rift', 'maelstrom'; the pocket 'curve'); REGION_KINDS
// distanceOf([sx, sy, sz]) → sectors from the Core (Chebyshev)
// setRegions(fn | null): fn([sx, sy, sz]) → { kind, id, name, danger, richness } | null
// areaOf(sector) → { id, kind, name, danger, richness, d } (an id AREAS knows)
// raresAt(area, d) → the rare goods found there: the area's from RARE_FROM
//   sectors out, their pure grade from PURE_FROM

import { hash64 } from '../../expanse/shared/gen'; // (the Expanse's hash, by its face: worlds are islands)

export const RARE_FROM = 10;
export const PURE_FROM = 25;
const BASICS = ['food', 'medicine', 'fuelcells'];

const area = (name, kind, specialties = [], wants = [], rares = []) => Object.freeze({ name, kind, specialties, wants, rares });
export const AREAS = Object.freeze({
  core: area('The Core', 'core', BASICS, []),
  heroes: area('Hero Reach', 'neighbourhood', ['vibranium', 'energon'], ['medicine', 'alloys']),
  oldroads: area('The Old Roads', 'neighbourhood', ['mithril', 'herbs'], ['electronics', 'luxuries']),
  earthside: area('Earthside', 'neighbourhood', ['paper', 'rum', 'pollos'], ['fuelcells', 'exotic', 'voidcrystal', 'relics', 'silk']),
  stage: area('The Stage', 'neighbourhood', ['vinyl', 'rigs'], ['electronics']),
  arcade: area('The Arcade Drift', 'neighbourhood', ['arcade'], ['electronics', 'components']),
  maelstrom: area('The Maelstrom’s mouth', 'portal', ['imperialscrap', 'spice', 'kyber', 'bacta', 'tibanna'], []),
  rift: area('The Curve Rift', 'portal', ['portalfluid', 'plumbus'], ['megaseeds']),
  starwars: area('The Star Wars galaxy', 'pocket', ['spice', 'kyber', 'bacta', 'tibanna'], []),
  curve: area('The Curve', 'pocket', ['portalfluid', 'plumbus', 'kalaxian'], ['megaseeds']),
  ice: area('The Rime', 'region', ['ice', 'cometwater'], ['food', 'machinery']),
  reef: area('Nebula reef', 'region', ['gas'], ['components'], ['silk']),
  grave: area('Ship graveyard', 'region', ['scrap', 'components'], ['fuelcells'], ['relics']),
  haven: area('Pirate haven', 'region', ['munitions', 'contraband'], ['luxuries']),
  cradle: area('Star nursery', 'region', ['stellargas', 'plasma', 'megaseeds'], ['machinery']),
  deep: area('The Quiet', 'region', [], [], ['voidcrystal', 'exotic']),
  forge: area('Dyson forge', 'region', ['alloys', 'machinery'], ['iron', 'titanium', 'exotic']),
});
export const REGION_KINDS = Object.freeze(Object.keys(AREAS).filter((id) => AREAS[id].kind === 'region'));

export const distanceOf = (sector) => (Array.isArray(sector) ? Math.max(...sector.slice(0, 3).map((v) => Math.abs(Number(v) || 0))) : 0);

// the stand-in: the Core at 0, a region kind a 3 × 3 × 3 block, danger and richness with the distance
const BLOCK = 3;
function standIn(sector) {
  const d = distanceOf(sector);
  if (d === 0) return null;
  const [bx, by, bz] = sector.map((v) => Math.floor(v / BLOCK));
  const kind = REGION_KINDS[Number(hash64('region', bx, by, bz) % BigInt(REGION_KINDS.length))];
  return { kind, id: kind, name: AREAS[kind].name, danger: Math.min(1, 0.1 + d / 30 + (kind === 'haven' ? 0.3 : 0)), richness: Math.min(1, d / 40 + (kind === 'deep' ? 0.3 : 0)) };
}
let regions = standIn;
export const setRegions = (fn) => {
  regions = typeof fn === 'function' ? fn : standIn;
};

const clamp01 = (v) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);
export function areaOf(sector) {
  const d = distanceOf(sector);
  const r = regions(sector);
  const id = r && Object.hasOwn(AREAS, r.id) ? r.id : r && Object.hasOwn(AREAS, r.kind) ? r.kind : 'core';
  return { id, kind: AREAS[id].kind, name: r?.name ?? AREAS[id].name, danger: id === 'core' ? 0 : clamp01(r?.danger), richness: id === 'core' ? 0 : clamp01(r?.richness), d };
}

export function raresAt(where, d) {
  const a = AREAS[where?.id] ?? AREAS.core;
  if (!(d >= RARE_FROM)) return [];
  return d >= PURE_FROM ? [...a.rares, ...a.rares.map((r) => `${r}-pure`)] : [...a.rares];
}
