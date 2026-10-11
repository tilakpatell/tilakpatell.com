// The Battlefront II (2017) drop's front end, for the site: its films, its
// icons, its fonts, its strings and its UI bitmaps, read from the bucket's
// `web/misc.jsonl` (one line per film, icon, font, string table and
// animation track) and `web/textures.jsonl`. Pure: scripts/bf2017-ui.mjs
// fetches, cuts and writes with what this says.
//
// filmRows(misc) → the films the site plays, one row each:
//   { slug, src, path, poster, kind: 'planet' | 'campaign' | 'tile' | 'tutorial' | 'logo' | 'fx',
//     system?, variant?, level?, act?, scene?, tile?, loop, seconds, width, height, bytes, subtitles?, transcode? }
// excludedFilms(misc) → [{ name, reason }]: the era rule's, and the effect
//   textures no browser decodes that nothing here asks for
// isSequelFilm(name), isSequelUi(name)
// iconName(file), iconFamily(file), symbolOf(name, text), spriteOf(icons)
// fontLicence(file), FONT_LICENCES, OWNER_LICENCE
// stringFamily(key), stringTables(english, keys) → { named, families }
// vttOf(ssa, say) → WebVTT text of a SubStation Alpha script's dialogue
//   (the game's scripts name a string key a line, which `say` resolves)
// bitmapWanted(name)

import { isSequel } from './bf2017-manifest.mjs';

// The films of the sequel era (the plan's Global Constraints) by the codes
// their names carry, and the whole of the Resurrection epilogue (act 3:
// thirty years on, the First Order's rise) by its folder or its prefix.
export const SEQUEL_FILMS = ['m1tak', 'm4jak', 'm5sta', 'crait', 'dqar', 'jakku', 'starkiller', 'takodana', 'resurgent', 'paintball'];
// names in the UI's files the manifest's list doesn't catch: Poe's ship, the
// First Order's TIEs and AT-ST, its officers and police, the sequel tiles
const UI_SEQUEL = ['blackone', 'tiefighterfo', 'tiefightersf', 'atst_fo', 'bermudacop', 'jumpcop', 'idenresistance', 'supremacy_sequel', 'cstile_st_', 'xwingt70', 'reylightsaber', 'bb-8', 'bb-9e'];

export const isSequelFilm = (name) => {
  const n = name.toLowerCase();
  return n.split('/').some((seg) => seg === 'a3' || seg.startsWith('a3_')) || SEQUEL_FILMS.some((s) => n.includes(s)) || isSequel(n);
};
export const isSequelUi = (name) => {
  const n = name.toLowerCase();
  return isSequel(n) || UI_SEQUEL.some((s) => n.includes(s));
};

// a loading film's planet → the galaxy's system (and which of two looks)
const PLANETS = {
  hoth: ['hoth'],
  endor: ['endor'],
  yavin4: ['yavin'],
  'mp-yavin-placeholder-intro': ['yavin', 'intro'],
  'mp-yavin-placeholder-loop': ['yavin', 'loop'],
  bespin: ['bespin'],
  naboo: ['naboo'],
  kashyyyk: ['kashyyyk'],
  kamino: ['kamino'],
  geonosis: ['geonosis'],
  scarif: ['scarif'],
  tatooine: ['tatooine'],
  deathstarii: ['deathstar'],
  felucia: ['felucia'],
  fondor: ['fondor'],
  kessel: ['kessel'],
  sullust: ['sullust'],
  'pilio-alive': ['pillio'],
  'pilio-dead': ['pillio', 'dead'],
  'vardos-alive': ['vardos'],
  'vardos-dead': ['vardos', 'dead'],
  athulla: ['athulla'],
  ryloth: ['ryloth'],
  liberty: ['liberty'],
};
// a campaign mission's code → the world it is set on
export const LEVELS = { LIB: 'endor', END: 'endor', FON: 'fondor', PIL: 'pillio', VAR: 'vardos', NAB: 'naboo', BES: 'bespin', SUL: 'sullust' };
// the effect textures the site asks for, by their short name
const FX = { MT_Volcano2: 'volcano' };

const base = (name) => name.split('/').pop();
export const slugOf = (name) =>
  base(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

function kindOf(row) {
  const n = row.name;
  if (/^FX\/MovieTextures\//.test(n)) return 'fx';
  if (/\/Cinematics\/Story\//.test(`/${n}`)) return 'campaign';
  if (/\/Video\/Tiles\//.test(n)) return 'tile';
  if (/SP_Tutorials\//.test(n)) return 'tutorial';
  if (/\/Video\/Logos\//.test(n)) return 'logo';
  if (/\/Video\/(Loading\/)?(Planet_|MP_)/.test(n)) return 'planet';
  return null;
}

const playable = (row) => row.container === 'webm' && /^V_VP[89]$/.test(row.video?.codec ?? '');

function filmRow(row) {
  const kind = kindOf(row);
  const slug = slugOf(row.name);
  const out = {
    slug,
    name: row.name,
    src: row.file,
    path: `films/bf2017/${slug}.webm`,
    poster: `films/bf2017/${slug}.webp`,
    kind,
    loop: kind !== 'campaign' && kind !== 'tutorial' && kind !== 'logo',
    seconds: row.seconds ?? row.video?.seconds ?? null,
    width: row.video?.width ?? null,
    height: row.video?.height ?? null,
    bytes: row.bytes,
  };
  // (the game draws this texture upside down)
  if (row.Flipped) out.flipped = true;
  if (kind === 'planet') {
    const key = slug.replace(/^planet-/, '').replace(/-01(v\d+)?$/, '');
    const [system, variant] = PLANETS[key] ?? [key];
    out.system = system;
    if (variant) out.variant = variant;
  } else if (kind === 'campaign') {
    const m = base(row.name).match(/^A(\d)_M\d([A-Z]{3})_DS(\d+)_S(\d+)/);
    out.act = m ? Number(m[1]) : null;
    out.level = m ? (LEVELS[m[2]] ?? m[2].toLowerCase()) : null;
    out.scene = m ? Number(m[3]) * 10000 + Number(m[4]) : 0;
    if (row.subtitles) out.subtitles = row.subtitles;
  } else if (kind === 'tile') {
    out.tile = slug.replace(/^tile-/, '');
  } else if (kind === 'fx') {
    out.fx = FX[base(row.name)];
    // (a VP6 texture: no browser decodes it, so this one is cut to VP9, the
    // one film here that is not the drop's file as it is)
    if (!playable(row)) out.transcode = true;
  }
  return out;
}

function reasonOf(row) {
  if (row.cat !== 'movies') return 'not a film';
  if (isSequelFilm(row.name)) return 'era';
  const kind = kindOf(row);
  if (!kind) return 'unknown';
  if (kind === 'fx' && !FX[base(row.name)]) return playable(row) ? 'unasked' : 'vp6: no browser decodes it, and nothing asks for it';
  if (kind !== 'fx' && !playable(row)) return 'codec';
  return null;
}

export const filmRows = (misc) =>
  misc
    .filter((r) => r.cat === 'movies' && !reasonOf(r))
    .map(filmRow)
    .sort((a, b) => (a.slug < b.slug ? -1 : 1));

export const excludedFilms = (misc) =>
  misc
    .filter((r) => r.cat === 'movies')
    .map((r) => ({ name: r.name, reason: reasonOf(r) }))
    .filter((r) => r.reason);

// ---- icons ----

// An icon's name as lane 0's ui.json keys it: its folder and its file
// ('Weapons/Icon_A280' for UI/SVG/Weapons/Icon_A280.svg).
export const iconName = (file) => file.replace(/^svg\//, '').replace(/\.svg$/i, '').split('/').slice(-2).join('/');

// The sprite an icon goes in: the folder after SVG/ (or Vectors/, Art/),
// and for Customize its next one (heroes, troopers, specials, planets).
export function iconFamily(file) {
  const parts = file.replace(/^svg\//, '').split('/');
  const at = parts.findIndex((p) => /^(SVG|Vectors|Art)$/i.test(p));
  const rest = parts.slice(at + 1, -1);
  const fam = (/^customize$/i.test(rest[0] ?? '') && rest[1] ? rest[1] : rest[0]) ?? 'misc';
  return fam.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

export const symbolId = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// One SVG file as a <symbol>: its viewBox kept, its white fills made the
// text colour (so the HUD tints it), its ids made the symbol's own.
export function symbolOf(name, text) {
  const id = symbolId(name);
  const open = text.match(/<svg\b[^>]*>/i);
  if (!open) return null;
  const vb = open[0].match(/viewBox="([^"]+)"/i)?.[1] ?? (() => {
    const w = open[0].match(/width="([\d.]+)/)?.[1];
    const h = open[0].match(/height="([\d.]+)/)?.[1];
    return w && h ? `0 0 ${w} ${h}` : null;
  })();
  const inner = text
    .slice(open.index + open[0].length, text.lastIndexOf('</svg>'))
    .replace(/<\?xml[^>]*>|<!--[\s\S]*?-->/g, '')
    .replace(/\bid="([^"]+)"/g, (_, x) => `id="${id}--${x}"`)
    .replace(/url\(#([^)]+)\)/g, (_, x) => `url(#${id}--${x})`)
    .replace(/href="#([^"]+)"/g, (_, x) => `href="#${id}--${x}"`)
    .replace(/(fill|stroke)="#(?:fff|ffffff|FFF|FFFFFF)"/g, '$1="currentColor"')
    .trim();
  return { id, svg: `<symbol id="${id}"${vb ? ` viewBox="${vb}"` : ''}>${inner}</symbol>` };
}

// icons: [{ name, family, text }] → { [family]: sprite text }, and the table
// { [name]: [family, id] } (a name two files share goes to the first; the
// second is kept under its longer name)
export function spriteOf(icons) {
  const sprites = {};
  const table = {};
  for (const ic of icons) {
    const s = symbolOf(ic.name, ic.text);
    if (!s) continue;
    (sprites[ic.family] ??= []).push(s.svg);
    table[ic.name] = [ic.family, s.id];
  }
  const files = Object.fromEntries(
    Object.entries(sprites).map(([f, syms]) => [f, `<svg xmlns="http://www.w3.org/2000/svg" style="display:none">\n${syms.join('\n')}\n</svg>\n`]),
  );
  return { sprites: files, table };
}

// ---- fonts ----

// Every face in the drop ships: the owner holds the licence for all of it,
// the fonts included (the owner, 2026-10-10). The open-licence ones keep
// the licence their own name table states, with its text beside them; the
// rest are the owner's (the game's licence).
export const FONT_LICENCES = [
  { match: /^Roboto-/, licence: 'Apache-2.0', file: 'LICENSE-Apache-2.0.txt', by: 'Google (Christian Robertson)' },
  { match: /^NotoSansCJK/, licence: 'OFL-1.1', file: 'OFL.txt', by: 'Adobe Systems Incorporated, for Google’s Noto' },
  { match: /^NotoKufiArabic/, licence: 'OFL-1.1', file: 'OFL.txt', by: 'Google (Monotype Design Team)' },
  { match: /^Cuprum-/, licence: 'OFL-1.1', file: 'OFL.txt', by: 'Jovanny Lemonad, with Reserved Font Name “Cuprum”' },
];
export const OWNER_LICENCE = { licence: 'owner', file: null, by: 'licensed to the owner with the game (2026-10-10)' };
export const fontLicence = (file) => FONT_LICENCES.find((l) => l.match.test(base(file))) ?? OWNER_LICENCE;

// ---- strings ----

// A key's family: the word after ID_ (ID_W_A280 → W, ID_HINT_… → HINT); a
// string whose key the game's data never names is filed by its hash.
export const stringFamily = (key) => key.match(/^ID_([A-Z0-9]+)/)?.[1] ?? '_hash';

// The families the galaxy's screens read synchronously (beside lane 0's
// rows): names of characters, classes, weapons, vehicles, heroes' tips, the
// loading hints, the modes, the HUD's words.
export const SITE_FAMILIES = ['CHAR', 'CHARACTER', 'C', 'W', 'V', 'H', 'HINT', 'HINTCHARACTERS', 'GM', 'BLAST', 'HVSV', 'SKIRMISH', 'DOMINATION', 'HUD', 'SPAWN', 'DEATH', 'EOR', 'SCOREBOARD', 'FANTASYBATTLES', 'FANTASYBATTLE', 'PLANETARYMISSION', 'MODE1', 'MODE3', 'MODE5', 'MODE6', 'MODE7', 'MODE8', 'MODE9', 'MODEC', 'TUTORIAL'];

// english: { strings: { [hash]: text } }; keys: { keys: { [hash]: key } }
// → { named: { [key]: text } for every named string, families: { [family]: { [key or hash]: text } } }
export function stringTables(english, keys) {
  const table = english.strings ?? english;
  const names = keys.keys ?? keys;
  const named = {};
  const families = {};
  for (const [hash, text] of Object.entries(table)) {
    const key = names[hash];
    const fam = key ? stringFamily(key) : '_hash';
    (families[fam] ??= {})[key ?? hash] = text;
    if (key) named[key] = text;
  }
  return { named, families };
}

// ---- subtitles ----

// The Dialogue lines of a SubStation Alpha script, as WebVTT cues (its
// override tags and line breaks made plain; a line that is a string key is
// the string's text, and one `say` doesn't know is left out).
const vttTime = (t) => {
  const [h, m, s] = t.trim().split(':');
  const [sec, cs = '0'] = s.split('.');
  return `${String(Number(h)).padStart(2, '0')}:${m.padStart(2, '0')}:${sec.padStart(2, '0')}.${cs.padEnd(3, '0').slice(0, 3)}`;
};
export function vttOf(ssa, say = (key) => key) {
  const cues = [];
  let fields = null;
  for (const line of ssa.split(/\r?\n/)) {
    if (/^Format:/i.test(line) && !fields && /Start/.test(line)) {
      const f = line.slice(7).split(',').map((s) => s.trim().toLowerCase());
      if (f.includes('text')) fields = f;
    }
    if (!/^Dialogue:/i.test(line)) continue;
    const f = fields ?? ['marked', 'start', 'end', 'style', 'name', 'marginl', 'marginr', 'marginv', 'effect', 'text'];
    const parts = line.slice(9).split(',');
    const raw = parts.slice(f.indexOf('text')).join(',').trim();
    const text = (/^ID_[A-Z0-9_]+$/.test(raw) ? (say(raw) ?? '') : raw)
      .replace(/\{[^}]*\}/g, '')
      .replace(/\\[Nn]/g, '\n')
      .trim();
    if (!text) continue;
    cues.push(`${vttTime(parts[f.indexOf('start')])} --> ${vttTime(parts[f.indexOf('end')])}\n${text}`);
  }
  return `WEBVTT\n\n${cues.join('\n\n')}\n`;
}

// ---- bitmaps ----

// The UI bitmaps the site's parts name: heroes' and vehicles' portraits, the
// mode and side tiles, the HUD's own art. (The front end's 692 card and menu
// bitmaps are the game's world's to ask for by name.)
const BITMAPS = /^UI\/(Bitmaps\/(Portraits|GameModeTiles|ChooseSideTiles|SupplyCrateIcons)|Art\/(HUD|LoadingScreens))\//;
export const bitmapWanted = (name) => BITMAPS.test(name) && !isSequelUi(name);
