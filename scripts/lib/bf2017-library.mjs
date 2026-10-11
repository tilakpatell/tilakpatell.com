// The drop's object library (the fifth design, lane O: docs/superpowers/
// specs/2026-10-10-bf2017-every-asset-design.md, section 3): every
// placeable object in the Battlefront II (2017) manifest, one row a model,
// so a world can ask for any of them by name (catalog/bf2017-library.js's
// `game:<name>`). What counts as placeable: the architecture, the props'
// object sets, landmarks, cinematics, decals and set pieces, the nature
// sets, the living world, the seasons' objects (s2 Bespin, s3 Kessel, s5_1
// Geonosis, a3 Vardos; and the later seasons' sets: s6_2 Geonosis's second
// map, s7_2 Naboo's third, s8 Felucia), Cloud City's level meshes (`levels/clouds`, which
// is the level, not the sky) and the front end's stage. A level pack places
// the same objects through its own map; this makes them placeable by hand.
//
// The era rule: a sequel-era name (isSequel) is not in the index, nor any
// object in a sequel set by its set's name (`ERA`), nor the uploader's
// scaffolding (`SCAFFOLD`).
//
//   indexRows(manifest, { tags }) → [{ name, set, biome, kind, size, tris,
//     lods, rig, tags }] sorted by name
//     kind  architecture | prop | landmark | nature | life | cloud | frontend
//     size  the manifest box's longest side: small < 1 m, medium < 4,
//           large < 16, else huge
//     rig   a skeleton (a living-world creature's): the placer draws still
//           things, so a rigged row waits on lane A's clips
//     tags  the name's words (and a blueprint's tags, where `tags` has the
//           name: { [name]: [word] })
//   setOf(name), biomeOf(name), kindOf(name), tagsOf(name, blueprintTags)
//   countRows(rows) → { kind: { [kind]: n }, set: { [set]: n } }

import { isSequel } from './bf2017-manifest.mjs';

// the sequel's sets, by the folder name the drop files them under (`jak`
// is Jakku's short folder, `paintball` the season's Resistance and First
// Order art)
export const ERA = ['takodana', 'jakku', 'jak', 'starkiller', 'crait', 'firstorder', 'resistance', 'paintball'];
// the uploader's scaffolding, never content
const SCAFFOLD = /(^|\/)(test|testranges|placeholders?|tobedeleted[^/]*|_?temp|planets)(\/|$)|donotuse/i;
// the seasons' object folders and the levels whose meshes are a library's
const SEASONS = ['s2/objects/', 's3/objects/', 's5_1/objects/', 'a3/objects/', 's6_2/geonosis_02/objects/', 's7_2/naboo_03/objects/', 's8/felucia/objects/'];
const PLACEABLE = ['objects/architecture/', 'objects/props/', 'objects/nature/', 'objects/livingworld/', 'levels/clouds/', 'levels/frontend/objects/', ...SEASONS];

// the world a set is of, for its biome where the folder doesn't say one
const WORLD_BIOME = {
  hoth: 'arctic',
  tatooine: 'desert',
  jabbaspalace: 'desert',
  vardos: 'badlands',
  endor: 'forest',
  yavin: 'yavin',
  yavin4: 'yavin',
  kashyyyk: 'kashyyyk',
  naboo: 'naboo',
  kamino: 'ocean',
  scarif: 'beach',
  bespin: 'clouds',
  cloudcity: 'clouds',
  sullust: 'volcanic',
  pillio: 'pillio',
  geonosis: 'desert',
  kessel: 'mines',
  felucia: 'jungle',
};

const SIZES = [
  [1, 'small'],
  [4, 'medium'],
  [16, 'large'],
];

// (a season's world, for its loose props: s2 is Bespin's, s3 Kessel's,
// s5_1 Geonosis's, a3 Vardos's)
const SEASON_WORLD = {
  's2/objects/': 'bespin',
  's3/objects/': 'kessel',
  's5_1/objects/': 'geonosis',
  'a3/objects/': 'vardos',
  's6_2/geonosis_02/objects/': 'geonosis',
  's7_2/naboo_03/objects/': 'naboo',
  's8/felucia/objects/': 'felucia',
};
// (the sides' sets keep the drop's underscore, as the props' object sets do)
const FACTIONS = ['_galacticempire', '_galacticrepublic', '_rebelalliance', '_separatists', '_generic'];
const KINDS = ['architecture', 'nature', 'props', 'livingworld'];
const seasonOf = (name) => SEASONS.find((p) => name.startsWith(p)) ?? null;
// a season's name as the main folders file one: `s2/objects/props/x` is
// `objects/props/x`; a season filed world first (`s3/objects/kessel/
// architecture/x`) is `objects/architecture/kessel/x`
const strip = (name) => {
  const season = seasonOf(name);
  if (!season) return name;
  const p = name.slice(season.length).split('/');
  if (KINDS.includes(p[0])) return `objects/${p.join('/')}`;
  const kind =
    {
      architecture: 'architecture',
      backdrop: 'architecture',
      nature: 'nature',
      meshscattering: 'nature',
    }[p[1]] ?? 'props';
  return `objects/${kind}/${p[0]}/${p.slice(2).join('/')}`;
};

// the set a name is of: the world folder under architecture, the props'
// object sets and landmarks, the nature biome; a few named sets for the rest
export function setOf(name) {
  const set = setOfRaw(name);
  return set === 'vardos02' ? 'vardos_02' : set;
}
function setOfRaw(name) {
  const n = strip(name);
  const p = n.split('/');
  if (n.startsWith('levels/clouds/')) return 'cloudcity';
  if (n.startsWith('levels/frontend/')) return 'frontend';
  if (p[1] === 'livingworld') return p[2] === '_droids' ? 'droids' : 'livingworld';
  if (p[1] === 'props') {
    if (p[2] === 'objectsets' || p[2] === 'landmarks') return p[3] ?? p[2];
    if (FACTIONS.includes(p[2])) return p[2];
    if (p[2].startsWith('_') || ['cinematics', 'lighting'].includes(p[2])) return p[2].replace(/^_/, '');
    // (a loose prop: its season's world, or the main folders' misc)
    if (p.length <= 4 && !strip(name).startsWith('objects/props/_')) return SEASON_WORLD[seasonOf(name)] ?? 'misc';
    return p[2];
  }
  // (a model filed in its own folder straight under architecture is misc)
  if (p[1] === 'architecture' || p[1] === 'nature') return p.length > 4 || (p.length === 4 && p[3] !== `${p[2]}_mesh`) ? p[2] : 'misc';
  return p[1] ?? 'misc';
}

export function biomeOf(name) {
  const n = strip(name);
  const p = n.split('/');
  if (p[1] === 'nature') return p[2];
  const set = setOf(name);
  return WORLD_BIOME[set] ?? null;
}

export function kindOf(name) {
  const n = strip(name);
  const p = n.split('/');
  if (/backdropcloud/.test(n)) return 'cloud';
  if (n.startsWith('levels/frontend/')) return 'frontend';
  if (n.startsWith('levels/clouds/') || p[1] === 'architecture') return 'architecture';
  if (p[1] === 'nature') return 'nature';
  if (p[1] === 'livingworld') return 'life';
  if (p[1] === 'props' && p[2] === 'landmarks') return 'landmark';
  return 'prop';
}

// the name's words: its last two segments split at the separators and the
// digits, without the drop's own words for a file ('mesh', 'lod')
const NOISE = new Set(['mesh', 'lod', 'a', 'b', 'c', 'd', 'e', 'f', 's', 'm', 'l', 'xl', 'xs', 'x']);
export function tagsOf(name, blueprintTags = {}) {
  const words = name
    .split('/')
    .slice(-2)
    .join('_')
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((w) => w.length > 1 && !NOISE.has(w));
  return [...new Set([...words, ...(blueprintTags[name] ?? []).map((t) => t.toLowerCase())])];
}

export const sizeOf = (entry) => {
  const side = Math.max(...entry.max.map((v, i) => v - entry.min[i]));
  return SIZES.find(([m]) => side < m)?.[1] ?? 'huge';
};

export const inEra = (name) =>
  !isSequel(name) &&
  !name
    .toLowerCase()
    .split('/')
    .some((seg) => ERA.includes(seg.replace(/^_/, '')));

export const isPlaceable = (name) => PLACEABLE.some((p) => name.startsWith(p)) && !SCAFFOLD.test(name) && inEra(name);

export function indexRows(manifest, { tags = {} } = {}) {
  const rows = [];
  for (const [name, e] of manifest) {
    if (!isPlaceable(name) || !e.min || !e.max) continue;
    rows.push({
      name,
      set: setOf(name),
      biome: biomeOf(name),
      kind: kindOf(name),
      size: sizeOf(e),
      tris: e.triangles,
      lods: e.lods?.length ?? 1,
      rig: Boolean(e.skeleton || e.joints),
      tags: tagsOf(name, tags),
    });
  }
  return rows.sort((a, b) => (a.name < b.name ? -1 : 1));
}

export function countRows(rows) {
  const kind = {};
  const set = {};
  for (const r of rows) {
    kind[r.kind] = (kind[r.kind] ?? 0) + 1;
    set[r.set] = (set[r.set] ?? 0) + 1;
  }
  return { kind, set };
}
