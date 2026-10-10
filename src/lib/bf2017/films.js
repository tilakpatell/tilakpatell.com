// The 2017 game's films, by what the site asks for them by: a system's
// loading film (its card and its landing veil), a world's campaign
// cinematics (its briefing), a menu tile, the tutorials, the logo and the
// effect textures (Mustafar's lava). The table is src/data/bf2017/films.json
// (scripts/bf2017-ui.mjs): only films that are published (site-assets, by
// scripts/assets-publish.mjs) are in its rows, so every one asked for here
// is there to fetch; a film's poster and captions are the site's own files.
//
// filmFor({ system } | { mission } | { tile } | { fx }, { variant }) → film | null
//   film: { slug, url, poster, captions?, loop, seconds, width, height, kind }
// briefingFor(system) → [film] in scene order (empty for a world the
//   campaign never went to)
// tilesFor(mode) → [film]: the menu's tiles for a mode of play
// tutorials() → [film]; logo() → film | null
// mayPlay({ reduced, saveData }) → whether a film may play at all (never
//   with reduced motion, never on a saver connection)

import TABLE from '../../data/bf2017/films.json';
import { assetUrl } from '../assetBase';

export const FILMS = TABLE.rows;

// the modes the site has → the game's menu tiles for them
export const MODE_TILES = {
  assault: ['multiplayer'],
  heroes: ['vs', 'light', 'dark'],
  skirmish: ['skirmish'],
  supremacy: ['supremacy'],
  campaign: ['sp-campaign', 'campaign-startnew', 'campaign-selectmission'],
  coop: ['co-op'],
  arcade: ['solo', 'scenario', 'custom'],
  tutorials: ['tutorials'],
};

const site = (path) => `/${path}`;
export function filmOf(row) {
  if (!row) return null;
  return {
    slug: row.slug,
    kind: row.kind,
    url: assetUrl(site(row.path)),
    poster: site(row.poster),
    captions: row.captions ? site(row.captions) : null,
    loop: Boolean(row.loop),
    seconds: row.seconds,
    width: row.width,
    height: row.height,
    flipped: Boolean(row.flipped),
  };
}

export function briefingFor(system, films = FILMS) {
  return films
    .filter((f) => f.kind === 'campaign' && f.level === system)
    .sort((a, b) => a.act - b.act || a.scene - b.scene)
    .map(filmOf);
}

export function filmFor(ask = {}, { variant = null, films = FILMS } = {}) {
  if (ask.mission) return briefingFor(ask.mission, films)[0] ?? null;
  if (ask.tile) return filmOf(films.find((f) => f.kind === 'tile' && f.tile === ask.tile));
  if (ask.fx) return filmOf(films.find((f) => f.kind === 'fx' && f.fx === ask.fx));
  if (ask.system) {
    const all = films.filter((f) => f.kind === 'planet' && f.system === ask.system);
    // (one look a planet: its own, or the one asked for; Yavin's intro is
    // the placeholder's, the loop the one to sit on)
    return filmOf(all.find((f) => (f.variant ?? null) === variant) ?? all.find((f) => f.variant === 'loop') ?? all[0]);
  }
  return null;
}

export const tilesFor = (mode, films = FILMS) => (MODE_TILES[mode] ?? []).map((t) => filmFor({ tile: t }, { films })).filter(Boolean);
export const tutorials = (films = FILMS) => films.filter((f) => f.kind === 'tutorial').map(filmOf);
export const logo = (films = FILMS) => filmOf(films.find((f) => f.kind === 'logo'));

export const mayPlay = ({ reduced = false, saveData = false } = {}) => !reduced && !saveData;
