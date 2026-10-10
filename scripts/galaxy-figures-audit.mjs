// How every person and beast on the galaxy's worlds is drawn: each life
// kind across the sites' `life` and their zones' `life`, resolved in the
// order actors.js's anyFigure resolves it (a walker machine, a crew figure,
// a catalogue model, a built figure), and what the model does when it is
// one: plays its own clips, walks on legs found at run time (legRig.js),
// stands at its bind pose (rigged, no clips named), or sways (a statue).
//
//   drawnAs(kind, { CREW, SURFACE_MODELS, FIGURES, WALKERS }) → 'walker' |
//     'walrus' (a 2017 figure on the game's skeleton) | 'own-rig' (a 2017
//     droid or beast on its own, ownRig.js) | 'crew' | 'crew-still' | 'own-clips' | 'legs' | 'rig-noanim' | 'still' |
//     'built' | 'none'                                             (pure)
//   audit(SITES, tables) → [{ kind, how, worlds: [id…] }] by kind  (pure)
//   table(rows) → Markdown: the counts by how, then every kind     (pure)
//   slipped(rows, expected) → [{ kind, want, how }]                (pure)
//
// EXPECTED holds the kinds a phase has moved and where it moved them; the
// script exits 1 when one has slipped back.
//
//   node scripts/galaxy-figures-audit.mjs [--json]

export const EXPECTED = {
  // phase 1: statues whose legs part, walked by legRig.js (Chirrut's robe
  // is to his ankles, as the Jawa's and Yoda's are: he sways)
  ...Object.fromEntries(['armorer', 'baze', 'cassian', 'dindjarin', 'jyn', 'k2so', 'krennic', 'mace', 'sullustan'].map((k) => [k, 'legs'])),
  // phase 2: Mixamo rigs given UAL's core set, baked into their files (ual-bake.mjs --rig)
  ...Object.fromEntries(['ithorian'].map((k) => [k, 'own-clips'])),
  // Battlefront II (2017), phase 1: the heroes on the game's skeleton
  ...Object.fromEntries(['anakin', 'bobafett', 'dooku', 'lando', 'luke', 'obiwan', 'vader'].map((k) => [k, 'walrus'])),
  // Battlefront II (2017), phase 2: the cast on the game's skeleton, and the
  // droids and beasts on their own (docs/superpowers/evidence/bf2017-phase2/cast.md)
  ...Object.fromEntries(['c3po', 'clone', 'clonephase1', 'deathtrooper', 'hothtrooper', 'rebel', 'rebelpilot', 'rebeltech', 'sandtrooper', 'scouttrooper', 'shoretrooper', 'snowtrooper', 'stormtrooper', 'wookiee'].map((k) => [k, 'walrus'])),
  ...Object.fromEntries(['astromech', 'droid', 'ewok', 'probe', 'r5', 'superdroid', 'tauntaun'].map((k) => [k, 'own-rig'])),
  // the fifth design's lane A: the creatures, droids and aliens on their own rigs
  ...Object.fromEntries(['birdtheed', 'chicken', 'scurrier', 'tach', 'pelikki', 'runyip', 'profogg', 'gamorreanguard', 'treadwell', 'gonk'].map((k) => [k, 'own-rig'])),
};

const HOWS = ['walker', 'walrus', 'own-rig', 'crew', 'crew-still', 'own-clips', 'legs', 'rig-noanim', 'still', 'built', 'none'];

export function drawnAs(kind, { CREW = {}, SURFACE_MODELS = {}, FIGURES = [], WALKERS = {} } = {}) {
  if (WALKERS[kind]) return 'walker';
  const c = CREW[kind];
  if (c) return c.rig === 'walrus' ? 'walrus' : c.rig === 'own' ? 'own-rig' : c.still ? 'crew-still' : 'crew';
  const m = SURFACE_MODELS[kind];
  if (m) {
    if (m.anim) return 'own-clips';
    if (m.legs) return 'legs';
    if (m.rig) return 'rig-noanim';
    return 'still';
  }
  if (FIGURES.includes(kind)) return 'built';
  return 'none';
}

export function audit(SITES, tables) {
  const worlds = new Map();
  for (const [id, site] of Object.entries(SITES)) {
    const life = [...(site.life ?? []), ...(site.zones ?? []).flatMap((z) => z.life ?? [])];
    for (const { kind } of life) {
      if (!kind) continue;
      if (!worlds.has(kind)) worlds.set(kind, new Set());
      worlds.get(kind).add(id);
    }
  }
  return [...worlds.keys()].sort().map((kind) => ({ kind, how: drawnAs(kind, tables), worlds: [...worlds.get(kind)].sort() }));
}

export function table(rows) {
  const lines = ['| how it is drawn | kinds | which |', '|---|---|---|'];
  for (const how of HOWS) {
    const of = rows.filter((r) => r.how === how);
    if (of.length) lines.push(`| ${how} | ${of.length} | ${of.map((r) => r.kind).join(', ')} |`);
  }
  lines.push('', '| kind | how | worlds |', '|---|---|---|');
  for (const r of rows) lines.push(`| ${r.kind} | ${r.how} | ${r.worlds.join(', ')} |`);
  return lines.join('\n');
}

export function slipped(rows, expected = EXPECTED) {
  const by = Object.fromEntries(rows.map((r) => [r.kind, r.how]));
  return Object.entries(expected)
    .filter(([kind, want]) => by[kind] !== want)
    .map(([kind, want]) => ({ kind, want, how: by[kind] ?? 'absent' }));
}

async function main() {
  // (the tables import three.js and Vite-only paths: loaded through Vite)
  const { createServer } = await import('vite');
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
  try {
    const load = (p) => vite.ssrLoadModule(p);
    const { SITES, siteOf } = await load('/src/components/galaxy/surface/sites/index.js');
    const { SURFACE_MODELS } = await load('/src/components/galaxy/surface/catalog/index.js');
    const { CREW } = await load('/src/components/galaxy/surface/crewList.js');
    const { FIGURES } = await load('/src/components/galaxy/surface/figures.js');
    const { WALKERS } = await load('/src/components/galaxy/surface/walkers.js');
    const sites = Object.fromEntries(Object.keys(SITES).map((id) => [id, siteOf(id)]));
    const rows = audit(sites, { CREW, SURFACE_MODELS, FIGURES, WALKERS });
    console.log(process.argv.includes('--json') ? JSON.stringify(rows, null, 1) : table(rows));
    const bad = slipped(rows);
    for (const b of bad) console.error(`${b.kind}: ${b.how}, should be ${b.want}`);
    process.exitCode = bad.length ? 1 : 0;
  } finally {
    await vite.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
