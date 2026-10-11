import { budget } from '../../../../lib/budgets';
import { MODELS as audit } from './audit';
import { MODELS as battlefront } from './battlefront';
import { MODELS as bf2017 } from './bf2017';
import { MODELS as bf2017vehicles } from './bf2017-vehicles';
import { MODELS as library2017 } from './bf2017-library';
import { MODELS as common } from './common';
import { MODELS as clonewars } from './clonewars';
import { MODELS as core } from './core';
import { MODELS as desert } from './desert';
import { MODELS as edge } from './edge';
import { MODELS as fill } from './fill';
import { MODELS as forest } from './forest';
import { MODELS as ice } from './ice';
import { MODELS as library } from './library';
import { MODELS as made } from './made';
import { MODELS as outer } from './outer';
import { MODELS as people } from './people';
import { MODELS as quaternius } from './quaternius';
import { MODELS as rebels } from './rebels';
import { MODELS as three } from './three';

// Every surface model there is, by kind, with the group it came in with
// (each group's catalogue is brought in by scripts/sketchfab-surface.mjs on
// its own). A world asks for a kind; one that isn't here (yet) it builds in
// code, or goes without.
// (battlefront near the end: a kind there takes over from the same kind's
// Sketchfab model; bf2017 and lane V's bf2017vehicles last, so a 2017 kind
// takes over from both; the drop's object library after them, its kinds
// `game:<name>` and so never the same as another's: catalog/bf2017-library.js)
export const GROUPS = { common, desert, ice, forest, core, clonewars, edge, people, outer, rebels, three, quaternius, made, fill, library, audit, battlefront, bf2017, bf2017vehicles, library2017 };
export const SURFACE_MODELS = Object.fromEntries(Object.entries(GROUPS).flatMap(([group, models]) => Object.entries(models).map(([kind, m]) => [kind, { ...m, group }])));
export const surfaceUrl = (kind) => `/models/galaxy/surface/${kind}.glb`;
export const surfaceLodUrl = (kind) => `/models/galaxy/surface/${kind}.lod1.glb`;
// A kind's ultra cut (its entry's optional `ultra: { tris, tex }`; the entry's
// own `tris` stays the high cut): loaded at ultra, the plain file otherwise.
export const surfaceUltraUrl = (kind) => `/models/galaxy/surface/${kind}.ultra.glb`;
// A kind's far cut (its entry's `far`: a 2017 vehicle's last LOD, unskinned,
// 256 maps), for the fleets and the horizon.
export const surfaceFarUrl = (kind) => `/models/galaxy/surface/${kind}.far.glb`;
// An entry with its own `url` (a book of models kept outside this folder:
// the Rick and Morty planets') loads that, and its ultra and light cuts only
// where it names them (`ultraUrl`, `lodUrl`): no file is guessed at.
// (a native kind, the game's own maps, has a plain cut of up to 16 MB: at
// low and mid, the phone's levels, it draws its light cut alone, the
// library's `game:` rows by their own `lodUrl`)
const PHONE = new Set(['low', 'mid']);
export const modelUrlFor = (kind, level, models = SURFACE_MODELS) => {
  const m = models[kind];
  if (m?.url) return (m.native && m.lodUrl && PHONE.has(level) && m.lodUrl) || (level === 'ultra' && m.ultraUrl) || m.url;
  if (m?.native && m.lod && PHONE.has(level)) return surfaceLodUrl(kind);
  return level === 'ultra' && m?.ultra ? surfaceUltraUrl(kind) : surfaceUrl(kind);
};
export const lodUrlFor = (kind, models = SURFACE_MODELS) => {
  const m = models[kind];
  return m?.url ? (m.lodUrl ?? m.url) : surfaceLodUrl(kind);
};
// Whether a kind swaps to its light model far off: it has one (`lod`, or
// its own `lodUrl`), and the level's budget swaps (lib/budgets' lod1; ultra
// keeps the full model at every distance).
export const wantsLod = (kind, level, models = SURFACE_MODELS) => Boolean(models[kind]?.url ? models[kind].lodUrl : models[kind]?.lod) && budget(level).lod1;
// the made kinds public/cc0/README.md lists (its
// `models/galaxy/surface/{a,b,…}.glb` lines, one a lane): each made model
// has to be there
export function madeKinds(readme) {
  const lists = [...readme.matchAll(/models\/galaxy\/surface\/\{([^}]*)\}\.glb/g)].map((m) => m[1]);
  return new Set(lists.flatMap((list) => list.split(',').map((k) => k.trim())).filter(Boolean));
}
