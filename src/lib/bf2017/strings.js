// The 2017 game's English text, by its string keys: lane 0's rows and the
// families the galaxy reads (src/data/bf2017/strings.json, scripts/
// bf2017-ui.mjs); the whole table, a file a family, under
// /ui/bf2017/strings/ for the game's own world.
//
// text(key, args?) → the string, its placeholders filled ({0}, {0:d},
//   {1:s}, {0:f.2}, %s, %d in turn); a key the table lacks → the key itself
// nameOf(row) → a rulebook row's game name (its `name` is a string key, as
//   lane 0 resolved it), else its id
// gameName(site, fallback) → the game's name for one of the site's things
//   ('hero:luke', 'weapon:rifle'), else the fallback
// loadingTips() → the game's loading-screen hints that read on their own
//   (no button prompts, none of the sequel era)
// loadFamily(family, fetch?) → that family's whole table (a promise)

import TABLE from '../../data/bf2017/strings.json';

export const STRINGS = TABLE.rows;

export const NAME_FOR = {
  'hero:luke': 'ID_CHAR_LUKE',
  'hero:leia': 'ID_CHAR_LEIA',
  'hero:han': 'ID_CHAR_HAN_SOLO',
  'hero:chewie': 'ID_CHAR_CHEWBACCA',
  'hero:bobafett': 'ID_CHAR_BOBA_FETT',
  'hero:vader': 'ID_CHAR_DARTHVADER',
  'hero:palpatine': 'ID_CHAR_EMPEROR',
  'hero:maul': 'ID_CHAR_MAUL',
  'hero:dooku': 'ID_CHAR_DOOKU',
  'hero:lando': 'ID_CHAR_LANDO',
  'hero:bossk': 'ID_CHAR_BOSSK',
  'hero:yoda': 'ID_CHAR_YODA',
  'hero:iden': 'ID_CHAR_IDEN',
  'weapon:rifle': 'ID_W_E11',
  'weapon:a280': 'ID_W_A280',
  'weapon:dlt19': 'ID_W_DLT19',
  'weapon:dc15': 'ID_W_DC15',
};

const fill = (s, args) => {
  let i = 0;
  return s
    .replace(/\{(\d+)(?::([a-z])(?:\.(\d+))?)?\}/g, (m, n, kind, places) => {
      const v = args[Number(n)];
      if (v === undefined) return m;
      return kind === 'f' && places ? Number(v).toFixed(Number(places)) : kind === 'd' ? String(Math.round(Number(v))) : String(v);
    })
    .replace(/%[sd]/g, (m) => {
      const v = args[i++];
      return v === undefined ? m : m === '%d' ? String(Math.round(Number(v))) : String(v);
    });
};

export function text(key, args = [], { strings = STRINGS } = {}) {
  const s = strings[key];
  if (typeof s !== 'string') return String(key);
  return args.length ? fill(s, args) : s;
}

export const nameOf = (row, opts) => (row?.name && (opts?.strings ?? STRINGS)[row.name] !== undefined ? text(row.name, [], opts) : (row?.id ?? ''));

export function gameName(site, fallback, { strings = STRINGS } = {}) {
  const key = NAME_FOR[site];
  return key && strings[key] ? strings[key] : fallback;
}

const SEQUEL = /\b(first order|resistance|kylo|rey|finn|phasma|bb-8|bb-9e|starkiller|jakku|crait|takodana|poe)\b/i;
export function loadingTips({ strings = STRINGS } = {}) {
  return Object.keys(strings)
    .filter((k) => k.startsWith('ID_HINT_'))
    .sort()
    .map((k) => strings[k].trim())
    .filter((s) => s.length > 20 && !/%%|\{\d/.test(s) && !SEQUEL.test(s));
}

export async function loadFamily(family, fetcher = globalThis.fetch) {
  const res = await fetcher(`/ui/bf2017/strings/${String(family).toLowerCase()}.json`);
  if (!res.ok) throw new Error(`strings ${family}: HTTP ${res.status}`);
  return res.json();
}
