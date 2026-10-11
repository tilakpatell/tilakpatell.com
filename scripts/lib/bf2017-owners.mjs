// The owners table: for every object in the Battlefront II (2017) drop that
// no site file uses yet, the lane that has said it will (the fifth design,
// docs/superpowers/specs/2026-10-10-bf2017-every-asset-design.md §3 and its
// table “What the running lanes own”). It is the designs’ commitment, read
// by the coverage ledger (scripts/bf2017-coverage.mjs): a row it names is
// `owned`, a row it does not is `unowned`, and the gate fails on either an
// `unowned` row or an `owned` row whose lane has merged.
//
// OWNERS: [{ match?, part?, lane }], first match wins, so the narrow
// entries come before the wide ones (anims last). `part` alone takes the
// whole part; `match` is a string (the lowercase name or a file starts with
// it) or a RegExp (tested on the lowercase name and files), limited to
// `part` when both are given.
// An entry with `finding: true` is the fifth design's first finding: rows no
// lane's plan named, given to the lane that takes them (the ledger counts them apart).
// LANES: [{ lane, design, merged? }]: the design PR that planned the lane
// and, once it lands, the PR that merged it.

export const LANES = [
  // the fifth design (#848): this lane, the level factory, the library, space, the front end, the clips
  { lane: 'Z', design: 848 },
  { lane: 'E', design: 848 },
  { lane: 'O', design: 848 },
  { lane: 'space', design: 848 },
  { lane: 'M', design: 848 },
  { lane: 'A', design: 848 },
  // the cast left (#839): the desktop's gaps, the beasts, Yoda and Grievous, the inside's crew, the atlas, the wrecks
  { lane: 'D', design: 839 },
  { lane: 'B', design: 839 },
  { lane: 'Y', design: 839 },
  { lane: 'I', design: 839 },
  { lane: 'T', design: 839 },
  { lane: 'W', design: 839 },
  // the surfaces design (#844): materials, ground, bounce, weathering and decals, ultra textures, the picture
  ...['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6'].map((q) => ({ lane: `surfaces-${q}`, design: 844 })),
  // the fidelity design (#836): effects, scatter, upscaling, far shadow, cameras, volumetrics
  { lane: 'X', design: 836 },
  { lane: 'N', design: 836 },
  { lane: 'U', design: 836 },
  { lane: 'S', design: 836 },
  { lane: 'C', design: 836 },
  { lane: 'V', design: 836 },
  // the game design (#812): modes, bots, HUD and world
  ...['1', '2', '3', '4', '5', '6', '7'].map((lane) => ({ lane, design: 812, ...(lane === '1' ? { merged: 815 } : lane === '2' ? { merged: 832 } : {}) })),
  // the physics design (#817) and the engine decision (#819)
  { lane: 'P3', design: 817 },
  { lane: 'M-engine', design: 819 },
  // lanes already merged: what they owned is used or has passed to a lane above
  { lane: 'K', design: 810, merged: 825 },
  { lane: 'L', design: 810, merged: 831 },
  { lane: 'G', design: 810, merged: 833 },
  { lane: 'V-vehicles', design: 802, merged: 828 },
  { lane: 'F', design: 802, merged: 829 },
  { lane: 'P0', design: 817, merged: 834 },
  { lane: 'P1', design: 817, merged: 822 },
  { lane: 'P2', design: 817, merged: 820 },
  { lane: 'P4', design: 817, merged: 821 },
  { lane: 'R', design: 810, merged: 827 },
  { lane: '0', design: 812, merged: 824 },
  { lane: 'X-sabers', design: 810, merged: 816 },
  { lane: 'H', design: 839 },
  // the sixth design (#877): the colour chain
  { lane: 'colour', design: 877 },
];

const BEASTS = ['dewback', 'bantha', 'eopie', 'ronto', 'jawa', 'aiwha'];

export const OWNERS = [
  // the sixth design's lane colour: the mesh variation databases and the
  // object variations (a level pack's variations.json consumes those its
  // level names; the rest are the lane's until every pack has one)
  { match: /\/(meshvariationdatabase|objectvariation)$/, part: 'data', lane: 'colour' },
  // #839's cast left: the six beasts (and their clips), Yoda and Grievous, the walkers' wrecks
  { match: new RegExp(`^characters/npc/creatures/(${BEASTS.join('|')})`), lane: 'B' },
  { match: new RegExp(`^anims(_additive)?/(${BEASTS.join('|')})[^/]*/`), lane: 'B' },
  { match: /^characters\/hero\/(yoda|generalgrievous)\//, lane: 'Y' },
  { match: /^anims(_additive)?\/(yoda_01_ske|generalgrievous_01_ske)\//, lane: 'Y' },
  { match: /^anims(_additive)?\/atat_destruction_/, lane: 'W' },
  // #839's lane D: the sound
  { match: 'sound/', part: 'data', lane: 'D' },
  // #836: the effect spawns (lane X) and the terrain scatter (lane N)
  { part: 'maps.effects', lane: 'X' },
  { part: 'scatter', lane: 'N' },
  // #844's surfaces lanes (before the space lane and the library: a row two
  // lanes consume is the first one's): Q1 the materials' manifest and the
  // shaders' presets, detail and weathering maps; Q3 the Enlighten proxies;
  // Q4 the decals and their sheets; Q6 the colour cubes and the painted skies
  { match: 'materials.jsonl', part: 'index', lane: 'surfaces-Q1' },
  { match: /^(textures\/)?shaders\//, part: 'textures', lane: 'surfaces-Q1' },
  { match: /enlighten|staticirradiance/, lane: 'surfaces-Q3' },
  { part: 'maps.decals', lane: 'surfaces-Q4' },
  { match: /(^|\/)(fx\/decals|objects\/props\/_decals)\//, part: 'textures', lane: 'surfaces-Q4' },
  { match: /(^|\/)t_cc_[^/]*$/, part: 'textures', lane: 'surfaces-Q6' },
  { match: /(^|\/)lighting\/lut\//, part: 'textures', lane: 'surfaces-Q6' },
  { match: /(^|\/)(lighting\/textures\/space\/|levels\/space\/[^/]+\/planet\/t_space_)/, part: 'textures', lane: 'surfaces-Q6' },
  // the space lane (the fifth design's Q): the space levels, their set pieces and the asteroids' tracks
  { match: 'levels/space/', lane: 'space' },
  { match: 'cinematics/spacebattles', lane: 'space' },
  { match: 'objects/props/_battlebeyond', lane: 'space' },
  { match: /asteroid/, part: 'animtracks', lane: 'space' },
  // lane M: the films, fonts, icons, strings and the UI's bitmaps
  { part: 'movies', lane: 'M' },
  { part: 'fonts', lane: 'M' },
  { part: 'svg', lane: 'M' },
  { part: 'strings', lane: 'M' },
  { match: 'ui/', part: 'textures', lane: 'M' },
  // lane E: the maps and everything a pack carries (before O: an object's
  // collision mesh and Havok shapes are the level's solids, not the library's)
  { part: 'maps', lane: 'E' },
  { part: 'maps.lights', lane: 'E' },
  { part: 'maps.actors', lane: 'E' },
  { part: 'maps.vehicles', lane: 'E' },
  { part: 'terrain', lane: 'E' },
  { part: 'physics', lane: 'E' },
  { part: 'collision', lane: 'E' },
  { part: 'animtracks', lane: 'E' },
  // lane O: every placeable object
  { match: 'objects/', lane: 'O' },

  // The fifth design's first finding (HANDOFF-bf2017.md, "The fifth
  // design"): what no lane's plan named when the ledger was first written,
  // given to the lane that takes it.
  // the clouds and the seasons' object sets are the library's (lane O)
  { match: 'levels/clouds', lane: 'O', finding: true },
  { match: /(^|\/)objects\//, lane: 'O', finding: true },
  // the front end's stages and the UI's art are lane M's
  { match: /^(levels\/frontend|levels\/initialexperience)\//, lane: 'M', finding: true },
  { match: /(^|\/)ui\//, lane: 'M', finding: true },
  // the capital ships are the space lane's; the other vehicles the game's lane 4
  { match: /^gameplay\/vehicles\/.*(capital|cruiser|venator|mc80|cr90|lucrehulk|providence|stardestroyer|dreadnought|frigate|corvette)/, lane: 'space', finding: true },
  { match: /(^|\/)gameplay\/ntcapitalships\//, lane: 'space', finding: true },
  { match: /(^|\/)gameplay\/vehicles\//, lane: '4', finding: true },
  // the prefabs (pickups, spawners, vehicle pads) are placed by the levels (lane E)
  { match: /(^|\/)gameplay\/prefabs\//, lane: 'E', finding: true },
  // the weapons and gadgets in the cast's hands: the game's world lane 5
  // (#812), which draws the figures and their gear; the galaxy's loadout
  // takes them through the same import (lane 1, the weapons' rules, has merged)
  { match: /(^|\/)(gameplay\/equipment|gameplay\/kits|weapons)\//, lane: '5', finding: true },
  // the cast's outfits, heads and parts not yet imported: #839's lane T (the
  // outfit variations and their atlas); the cinematics' sets: the level
  // factory's districts (lane E)
  { match: /(^|\/)characters\//, lane: 'T', finding: true },
  { match: /(^|\/)cinematics\//, lane: 'E', finding: true },
  // the effects' meshes and sheets are fidelity X's, with the emitters
  { match: /(^|\/)fx\//, lane: 'X', finding: true },
  // the light and the look: probes, far shadows, the lighting meshes, the
  // VE records, the sky and post-process tables, the shaders' detail and
  // weathering maps (lane E's packs)
  { match: /(^|\/)(levels\/)?lighting\//, lane: 'E', finding: true },
  { match: /^(shaders|systems)\//, lane: 'E', finding: true },
  // every level's own meshes, maps and records: the level factory's packs (lane E)
  { match: /^(levels|a3|s\d[_\d]*|addons|battlebeyond)\//, lane: 'E', finding: true },
  // data by top folder: the rulebooks' records the game's lanes take
  { match: /^(online|persistence|telemetry|automation|win32|dataversion|defaultobjectpatch|globals)\//, part: 'data', lane: '7', finding: true },
  { match: /^(gameplay|ai)\//, part: 'data', lane: '6', finding: true },
  { match: /^(ui|media)\//, part: 'data', lane: 'M', finding: true },
  { match: /^characters\//, part: 'data', lane: 'T', finding: true },
  { match: /^(animations|cinematics)\//, part: 'data', lane: 'A', finding: true },
  { match: /^(fx|effects)\//, part: 'data', lane: 'X', finding: true },
  { match: /^(shaders|systems|lodgroups|[0-9a-f-]{36}_shaderparametervariation)\//, part: 'data', lane: 'E', finding: true },
  { match: /^(localization|media2|ui_[^/]*)\//, part: 'data', lane: 'M', finding: true },
  { match: /^gameplay_characters[^/]*\//, part: 'data', lane: 'A', finding: true },
  // the rest of data/ (prefab and logic blueprints, the reports, the
  // settings): the game's lane 6, the other maps' and modes' rulebooks
  { part: 'data', lane: '6', finding: true },
  // lane A: every clip the lanes above do not name
  { part: 'anims', lane: 'A' },
];
