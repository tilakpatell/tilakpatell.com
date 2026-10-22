// The site’s one cast table: every Star Wars figure kind the site draws, by
// the galaxy’s key, with its body’s file, its height, the rig its loader
// wants, and whose body it is. Plain data below the worlds, with no three.js
// and no React, so the galaxy, the universe, the Death Star and the cockpit
// can name one body for one kind, and a page or a script can read the files
// without loading a scene. The galaxy’s surface reads it as CREW
// (galaxy/surface/crewList.js), with the names and the shape it always had.
// (docs/superpowers/specs/2026-10-21-battlefront-by-default-design.md,
// decisions 1 and 2)
//
// `source` is whose body it is: 'game', the 2017 game’s own (a `rig:
// 'walrus'` or `rig: 'own'` row); 'mod:<name>', a mod’s, brought in by the
// mods pipeline; 'site', Meshy’s, Sketchfab’s, built in code or the 2005
// remaster’s. A 'site' row’s `could` names the game’s or a mod’s kind that
// would replace it and what stops it today, or is null where neither has one
// (a comment says why where there is more to say than that). The game first,
// by rank: a kind’s body is the game’s where the game has one, a mod’s where
// only a mod has one, the site’s otherwise. A swap from a site row to a game
// row is still a row change with a sheet beside the old one
// (scripts/clip-shot.mjs: compare, never assume). The number to move is the
// site rows with a `could`; scripts/cast-audit.mjs prints the table and the
// counts.
//
//   BODIES             kind → { url | name, tall, rig, pack, ownRig, lod, far, full, fullMB, fullDL, faces, still, source, could }
//   bodyOf(kind)       its row, or null
//   sourceOf(kind)     'game' | 'mod:<name>' | 'site', or null for a kind the table hasn’t
//   gameFirst(kinds)   the first of a list the game has, else the first a mod has, else the first the table has; null for none
//   fileOf, faceOf, filesOf, figureLoaderFor, cutsOf: a row’s files and how it loads (below)

// a figure's file: its own `url`, or its name's in the crew's folder
export const fileOf = (c) => c.url ?? `/models/galaxy/crew/${c.name}.glb`;
// the i-th of a kind: a kind with other `faces` takes them in turn, itself first
export const faceOf = (c, i = 0) => (c.faces ? [c, ...c.faces][i % (c.faces.length + 1)] : c);
// every file a kind may load
export const filesOf = (c) => [c, ...(c.faces ?? [])].map(fileOf);
// how crew.js loads a row: a 2017 figure on the game's skeleton
// (`rig: 'walrus'`, lib/three/walrus.js, with its `pack` of the game's clips
// over the humanoid one), a 2017 droid or beast on its own skeleton (`rig:
// 'own'`, lib/three/ownRig.js, with its `ownRig`'s pack), one of the
// wardrobe's people dressed as kept
// (`party`), or a copy of its file's one figure (`shared`)
export const figureLoaderFor = (row, dressed = false) => (row?.rig === 'walrus' ? 'walrus' : row?.rig === 'own' ? 'own' : dressed ? 'party' : 'shared');
// a full-fidelity 2017 kind's cuts (scripts/bf2017-import.mjs --full: `full`,
// with `lod`, `far`, the full cut's GPU textures `fullMB` and its download `fullDL`), for the
// walrus loader to draw by distance; null for any other row
export const cutsOf = (row) => (row?.full ? { full: true, lod: Boolean(row.lod), far: Boolean(row.far), fullMB: row.fullMB ?? 0, fullDL: row.fullDL ?? 0 } : null);

// a kind Battlefront Expanded has: the mod is no longer on this machine, so
// its bodies wait on the owner’s export (the design’s decision 8)
const EXPANDED = (who) => `Battlefront Expanded’s ${who}: the mod is not on this machine, so it waits on the owner’s export`;

// kind → { model's name or file, how tall, still (not rigged) }
export const BODIES = {
  han: { url: '/models/galaxy/bf2017/crew/han.glb', tall: 1.85, rig: 'walrus', pack: 'han', source: 'game' },
  // the heroes from Star Wars Battlefront II (2017), on the game's whole
  // skeleton with the game's own clips (scripts/bf2017-import.mjs --rig
  // --crew; their `pack`, scripts/bf2017-clips.mjs, over the humanoid one)
  luke: { url: '/models/galaxy/bf2017/crew/luke.glb', tall: 1.72, rig: 'walrus', pack: 'luke', source: 'game' },
  leia: { url: '/models/galaxy/bf2017/crew/leia.glb', tall: 1.5, rig: 'walrus', pack: 'leia', source: 'game' },
  chewie: { url: '/models/galaxy/bf2017/crew/chewie.glb', tall: 2.28, rig: 'walrus', pack: 'chewie', source: 'game' },
  greedo: { name: 'greedo', tall: 1.73, source: 'site', could: EXPANDED('Greedo') },
  gamorrean: { name: 'gamorrean', tall: 1.8, source: 'site', could: 'the game’s Gamorrean guard (`gamorreanguard`, below, on its own rig): the swap waits on its sheet beside this one' },
  bobafett: { url: '/models/galaxy/bf2017/crew/bobafett.glb', tall: 1.83, rig: 'walrus', pack: 'bobafett', source: 'game' },
  bith: { name: 'bith', tall: 1.8, source: 'site', could: 'the game’s Bith (the band’s, npc/aliens/bith/bith_01 in the local export, on its own skeleton): not imported yet' },
  ahsoka: { name: 'ahsoka', tall: 1.85, source: 'site', could: EXPANDED('Ahsoka') },
  hutt: { name: 'jabba', tall: 1.8, still: true, source: 'site', could: null },
  // the worlds' named people, from Sketchfab, rigged with Meshy onto the
  // same skeleton (scripts/meshy-galaxy.mjs): Obi-Wan on Mustafar, Jango on
  // Kamino, Shaak Ti, the Mandalorian.
  // (Anakin, Krennic, Cassian, Chirrut and Mace stand still instead,
  // catalog/library.js: their arms-down poses didn't rig)
  obiwan: { url: '/models/galaxy/bf2017/crew/obiwan.glb', tall: 1.82, rig: 'walrus', pack: 'obiwan', source: 'game' },
  // (the game has only his face, on its clones’ heads)
  jango: { url: '/models/galaxy/crew/jango.glb', tall: 1.83, source: 'site', could: EXPANDED('Jango Fett') },
  // (not `shaak`: that kind is Naboo's grazing beasts)
  shaakti: { url: '/models/galaxy/crew/shaakti.glb', tall: 1.88, source: 'site', could: null },
  mando: { url: '/models/galaxy/crew/dindjarin.glb', tall: 1.85, source: 'site', could: EXPANDED('Din Djarin') },
  // the worlds' people made with Meshy from words (scripts/meshy-galaxy.mjs),
  // in place of the built ones: Tatooine's Tuskens, Twi'leks, Bib Fortuna,
  // the Aqualish and Wuher; Bespin's Lando, Lobot and Ugnaughts; the Rebel
  // troops; Coruscant's Senate guards and Jedi; the Neimoidians; Mustafar's
  // miners
  // (the game has no Tusken: only their cycler rifle and their camp’s props)
  tusken: { url: '/models/galaxy/crew/tusken.glb', tall: 1.9, source: 'site', could: null },
  lando: { url: '/models/galaxy/bf2017/crew/lando.glb', tall: 1.78, rig: 'walrus', pack: 'lando', source: 'game' },
  // (the game has a Twi’lek head for its soldiers’ faces, heads_twilek, and no body)
  twilek: { url: '/models/galaxy/crew/twilek.glb', tall: 1.7, source: 'site', could: null },
  ugnaught: { url: '/models/galaxy/crew/ugnaught.glb', tall: 1.05, source: 'site', could: null },
  senateguard: { url: '/models/galaxy/crew/senateguard.glb', tall: 1.85, source: 'site', could: null },
  lobot: { url: '/models/galaxy/crew/lobot.glb', tall: 1.75, source: 'site', could: null },
  // (the three worlds': a Wing Guard who walks, and Dex still behind the counter that came with him)
  wingguard: { url: '/models/galaxy/crew/wingguard.glb', tall: 1.8, source: 'site', could: null },
  dex: { url: '/models/galaxy/crew/dex.glb', tall: 1.9, still: true, source: 'site', could: null },
  neimoidian: { url: '/models/galaxy/crew/neimoidian.glb', tall: 1.9, source: 'site', could: null },
  bibfortuna: { url: '/models/galaxy/crew/bibfortuna.glb', tall: 1.8, source: 'site', could: null },
  // (the game has an Aqualish head for its soldiers’ faces, heads_aqualish, and no body)
  aqualish: { url: '/models/galaxy/crew/aqualish.glb', tall: 1.8, source: 'site', could: null },
  // (the game’s Mos Eisley has its own people, none of them Wuher)
  wuher: { url: '/models/galaxy/crew/wuher.glb', tall: 1.78, source: 'site', could: null },
  mustafarian: { url: '/models/galaxy/crew/mustafarian.glb', tall: 2.0, source: 'site', could: null },
  // (the temple's knights take three faces in turn)
  // (the game’s Jedi are its heroes: it has no temple knights)
  jedi: {
    url: '/models/galaxy/crew/jedi.glb',
    tall: 1.75,
    faces: [
      { url: '/models/galaxy/crew/jedi2.glb', tall: 1.8 },
      { url: '/models/galaxy/crew/jedi3.glb', tall: 1.78 },
    ],
    source: 'site',
    could: null,
  },
  // and the galaxy's who's who, for the worlds and heroes to come
  maul: { url: '/models/galaxy/bf2017/crew/maul.glb', tall: 1.75, rig: 'walrus', pack: 'maul', source: 'game' },
  palpatine: { url: '/models/galaxy/bf2017/crew/palpatine.glb', tall: 1.73, rig: 'walrus', pack: 'palpatine', source: 'game' },
  rex: { url: '/models/galaxy/crew/rex.glb', tall: 1.83, source: 'site', could: EXPANDED('Rex') },
  bokatan: { url: '/models/galaxy/crew/bokatan.glb', tall: 1.7, source: 'site', could: EXPANDED('Bo-Katan') },
  vader: { url: '/models/galaxy/bf2017/crew/vader.glb', tall: 2.02, rig: 'walrus', pack: 'vader', source: 'game' },
  anakin: { url: '/models/galaxy/bf2017/crew/anakin.glb', tall: 1.85, rig: 'walrus', pack: 'anakin', source: 'game' },
  bossk: { url: '/models/galaxy/bf2017/crew/bossk.glb', tall: 1.9, rig: 'walrus', pack: 'bossk', source: 'game' },
  fennec: { url: '/models/galaxy/crew/fennec.glb', tall: 1.7, source: 'site', could: EXPANDED('Fennec Shand') },
  caradune: { url: '/models/galaxy/crew/caradune.glb', tall: 1.78, source: 'site', could: EXPANDED('Cara Dune') },
  greef: { url: '/models/galaxy/crew/greef.glb', tall: 1.85, source: 'site', could: EXPANDED('Greef Karga') },
  // (the game has a Rodian head for its soldiers’ faces, heads_rodian, and no body)
  rodian: { url: '/models/galaxy/crew/rodian.glb', tall: 1.7, source: 'site', could: null },
  // the Hutts' men where the galaxy's war gives a world to the Hutts: Jabba's
  // court's faces in turn (they were built in code, figures.js's `mercenary`)
  mercenary: {
    url: '/models/galaxy/crew/rodian.glb',
    tall: 1.7,
    faces: [
      { url: '/models/galaxy/crew/aqualish.glb', tall: 1.8 },
      { url: '/models/galaxy/crew/greedo.glb', tall: 1.73 },
      { url: '/models/galaxy/crew/bith.glb', tall: 1.8 },
      { url: '/models/galaxy/crew/gamorrean.glb', tall: 1.8 },
    ],
    source: 'site',
    could: 'two of its five faces: the game’s Gamorrean guard and Bith (gamorrean’s and bith’s notes); its Greedo is Battlefront Expanded’s',
  },
  inquisitor: { url: '/models/galaxy/crew/inquisitor.glb', tall: 1.85, source: 'site', could: null },
  // (the game flies its TIE pilots unseen: the export has no figure of one)
  tiepilot: { url: '/models/galaxy/crew/tiepilot.glb', tall: 1.8, source: 'site', could: null },
  hondo: { url: '/models/galaxy/crew/hondo.glb', tall: 1.78, source: 'site', could: EXPANDED('Hondo Ohnaka') },
  // (the game’s Ackbar is a briefing’s bust, talkingheads/ackbar, chest up: not a body that walks)
  ackbar: { url: '/models/galaxy/crew/ackbar.glb', tall: 1.8, source: 'site', could: null },
  dooku: { url: '/models/galaxy/bf2017/crew/dooku.glb', tall: 1.93, rig: 'walrus', pack: 'dooku', source: 'game' },
  quigon: { url: '/models/galaxy/crew/quigon.glb', tall: 1.93, source: 'site', could: EXPANDED('Qui-Gon Jinn') },
  // the 2017 heroes' other outfits (heroes.js's SKINS): each on the game's
  // skeleton, moved by its hero's own pack
  lukehoth: { url: '/models/galaxy/bf2017/crew/lukehoth.glb', tall: 1.72, rig: 'walrus', pack: 'luke', source: 'game' },
  lukefarmboy: { url: '/models/galaxy/bf2017/crew/lukefarmboy.glb', tall: 1.72, rig: 'walrus', pack: 'luke', source: 'game' },
  lukeyavin: { url: '/models/galaxy/bf2017/crew/lukeyavin.glb', tall: 1.72, rig: 'walrus', pack: 'luke', source: 'game' },
  obiwan2: { url: '/models/galaxy/bf2017/crew/obiwan2.glb', tall: 1.82, rig: 'walrus', pack: 'obiwan', source: 'game' },
  obiwan3: { url: '/models/galaxy/bf2017/crew/obiwan3.glb', tall: 1.82, rig: 'walrus', pack: 'obiwan', source: 'game' },
  anakin2: { url: '/models/galaxy/bf2017/crew/anakin2.glb', tall: 1.85, rig: 'walrus', pack: 'anakin', source: 'game' },
  anakin3: { url: '/models/galaxy/bf2017/crew/anakin3.glb', tall: 1.85, rig: 'walrus', pack: 'anakin', source: 'game' },
  maullegs: { url: '/models/galaxy/bf2017/crew/maullegs.glb', tall: 1.75, rig: 'walrus', pack: 'maul', source: 'game' },
  dooku2: { url: '/models/galaxy/bf2017/crew/dooku2.glb', tall: 1.93, rig: 'walrus', pack: 'dooku', source: 'game' },
  dooku3: { url: '/models/galaxy/bf2017/crew/dooku3.glb', tall: 1.93, rig: 'walrus', pack: 'dooku', source: 'game' },
  hanendor: { url: '/models/galaxy/bf2017/crew/hanendor.glb', tall: 1.85, rig: 'walrus', pack: 'han', source: 'game' },
  hanhoth: { url: '/models/galaxy/bf2017/crew/hanhoth.glb', tall: 1.85, rig: 'walrus', pack: 'han', source: 'game' },
  hanrotj: { url: '/models/galaxy/bf2017/crew/hanrotj.glb', tall: 1.85, rig: 'walrus', pack: 'han', source: 'game' },
  hanyavin: { url: '/models/galaxy/bf2017/crew/hanyavin.glb', tall: 1.85, rig: 'walrus', pack: 'han', source: 'game' },
  hanyoung: { url: '/models/galaxy/bf2017/crew/hanyoung.glb', tall: 1.85, rig: 'walrus', pack: 'han', source: 'game' },
  hanyoung2: { url: '/models/galaxy/bf2017/crew/hanyoung2.glb', tall: 1.85, rig: 'walrus', pack: 'han', source: 'game' },
  leiaboushh: { url: '/models/galaxy/bf2017/crew/leiaboushh.glb', tall: 1.5, rig: 'walrus', pack: 'leia', source: 'game' },
  leiaendor: { url: '/models/galaxy/bf2017/crew/leiaendor.glb', tall: 1.5, rig: 'walrus', pack: 'leia', source: 'game' },
  leiagoldvest: { url: '/models/galaxy/bf2017/crew/leiagoldvest.glb', tall: 1.5, rig: 'walrus', pack: 'leia', source: 'game' },
  leiaprincess: { url: '/models/galaxy/bf2017/crew/leiaprincess.glb', tall: 1.5, rig: 'walrus', pack: 'leia', source: 'game' },
  landorotj: { url: '/models/galaxy/bf2017/crew/landorotj.glb', tall: 1.78, rig: 'walrus', pack: 'lando', source: 'game' },
  landoskiff: { url: '/models/galaxy/bf2017/crew/landoskiff.glb', tall: 1.78, rig: 'walrus', pack: 'lando', source: 'game' },
  landoyoung: { url: '/models/galaxy/bf2017/crew/landoyoung.glb', tall: 1.78, rig: 'walrus', pack: 'lando', source: 'game' },
  landoyoung2: { url: '/models/galaxy/bf2017/crew/landoyoung2.glb', tall: 1.78, rig: 'walrus', pack: 'lando', source: 'game' },
  chewiegoggles: { url: '/models/galaxy/bf2017/crew/chewiegoggles.glb', tall: 2.28, rig: 'walrus', pack: 'chewie', source: 'game' },
  // the 2017 game's B1 on its own skeleton with its pack (walrusClips.js's
  // OWN_RIGS.b1), from the desktop's export (lane C4). It waited on a
  // markings map, but the game's default skin has none to wait on: its
  // colour map is grey, and the skin's ObjectVariation
  // (D_Assault_Preq_01_Default) gives the markings shader one colour, the
  // films' tan, which the game multiplies it by; the import sets that as the
  // material's factor (--tint, scripts/lib/bf2017-markings.mjs), the map left
  // as it is. Its sheet beside the remaster's, which this replaces
  // (troops/battledroid.glb, rigged with Meshy), is in docs/superpowers/
  // evidence/bf-default-c4/. Its full cut waits on the owner's publish.
  battledroid: { url: '/models/galaxy/bf2017/crew/battledroid.glb', tall: 1.824, rig: 'own', ownRig: 'b1', lod: true, far: true, source: 'game' },
  // phase 2, everyone the game has (docs/superpowers/evidence/bf2017-phase2/
  // cast.md): the Battlefront II (2017) cast at full fidelity
  // (scripts/bf2017-import.mjs --rig --crew --full --join, --far for the
  // kinds the assaults field). Each draws its light cut first and the cut
  // its distance wants after (lib/three/walrusCuts.js); `fullMB` and
  // `fullDL` are its full cut's GPU textures and download, for the page's
  // ledger. On the game's humanoid skeleton (`walrus`, the humanoid pack)
  // or on a rig of its own (`own`, lib/three/ownRig.js, its rig's pack).
  // A kind named here takes over the one the worlds already place.
  c3po: { url: '/models/galaxy/bf2017/crew/c3po.glb', tall: 1.71, rig: 'walrus', lod: true, full: true, fullMB: 44, fullDL: 25, source: 'game' },
  clone: { url: '/models/galaxy/bf2017/crew/clone.glb', tall: 1.83, rig: 'walrus', lod: true, far: true, full: true, fullMB: 33, fullDL: 20, source: 'game' },
  clonephase1: { url: '/models/galaxy/bf2017/crew/clonephase1.glb', tall: 1.83, rig: 'walrus', lod: true, far: true, full: true, fullMB: 39, fullDL: 23, source: 'game' },
  deathtrooper: { url: '/models/galaxy/bf2017/crew/deathtrooper.glb', tall: 1.88, rig: 'walrus', lod: true, far: true, full: true, fullMB: 21, fullDL: 13, source: 'game' },
  hothtrooper: { url: '/models/galaxy/bf2017/crew/hothtrooper.glb', tall: 1.78, rig: 'walrus', lod: true, far: true, full: true, fullMB: 50, fullDL: 27, source: 'game' },
  rebel: { url: '/models/galaxy/bf2017/crew/rebel.glb', tall: 1.78, rig: 'walrus', lod: true, far: true, full: true, fullMB: 38, fullDL: 16, source: 'game' },
  rebelpilot: { url: '/models/galaxy/bf2017/crew/rebelpilot.glb', tall: 1.78, rig: 'walrus', lod: true, full: true, fullMB: 37, fullDL: 24, source: 'game' },
  rebeltech: { url: '/models/galaxy/bf2017/crew/rebeltech.glb', tall: 1.75, rig: 'walrus', lod: true, full: true, fullMB: 19, fullDL: 13, source: 'game' },
  sandtrooper: { url: '/models/galaxy/bf2017/crew/sandtrooper.glb', tall: 1.83, rig: 'walrus', lod: true, far: true, full: true, fullMB: 29, fullDL: 17, source: 'game' },
  scouttrooper: { url: '/models/galaxy/bf2017/crew/scouttrooper.glb', tall: 1.83, rig: 'walrus', lod: true, far: true, full: true, fullMB: 48, fullDL: 26, source: 'game' },
  shoretrooper: { url: '/models/galaxy/bf2017/crew/shoretrooper.glb', tall: 1.83, rig: 'walrus', lod: true, far: true, full: true, fullMB: 21, fullDL: 13, source: 'game' },
  snowtrooper: { url: '/models/galaxy/bf2017/crew/snowtrooper.glb', tall: 1.83, rig: 'walrus', lod: true, far: true, full: true, fullMB: 26, fullDL: 18, source: 'game' },
  stormtrooper: { url: '/models/galaxy/bf2017/crew/stormtrooper.glb', tall: 1.83, rig: 'walrus', lod: true, far: true, full: true, fullMB: 48, fullDL: 25, source: 'game' },
  wookiee: { url: '/models/galaxy/bf2017/crew/wookiee.glb', tall: 2.28, rig: 'walrus', lod: true, full: true, fullMB: 34, fullDL: 19, source: 'game' },
  officer: { url: '/models/galaxy/bf2017/crew/officer.glb', tall: 1.8, rig: 'walrus', lod: true, full: true, fullMB: 56, fullDL: 27, source: 'game' },
  civcity1: { url: '/models/galaxy/bf2017/crew/civcity1.glb', tall: 1.75, rig: 'walrus', lod: true, full: true, fullMB: 81, fullDL: 42, source: 'game' },
  civcity3: { url: '/models/galaxy/bf2017/crew/civcity3.glb', tall: 1.78, rig: 'walrus', lod: true, full: true, fullMB: 80, fullDL: 45, source: 'game' },
  astromech: { url: '/models/galaxy/bf2017/crew/astromech.glb', tall: 0.977, rig: 'own', ownRig: 'astromech', lod: true, full: true, fullMB: 32, fullDL: 18, source: 'game' },
  droid: { url: '/models/galaxy/bf2017/crew/droid.glb', tall: 1.046, rig: 'own', ownRig: 'astromech', lod: true, full: true, fullMB: 2, fullDL: 2, source: 'game' },
  ewok: { url: '/models/galaxy/bf2017/crew/ewok.glb', tall: 0.999, rig: 'own', ownRig: 'ewok', lod: true, full: true, fullMB: 11, fullDL: 9, source: 'game' },
  probe: { url: '/models/galaxy/bf2017/crew/probe.glb', tall: 1.624, rig: 'own', ownRig: 'probe', lod: true, far: true, full: true, fullMB: 4, fullDL: 4, source: 'game' },
  r5: { url: '/models/galaxy/bf2017/crew/r5.glb', tall: 1.165, rig: 'own', ownRig: 'astromech', lod: true, full: true, fullMB: 2, fullDL: 2, source: 'game' },
  superdroid: { url: '/models/galaxy/bf2017/crew/superdroid.glb', tall: 1.93, rig: 'own', ownRig: 'b2', lod: true, far: true, full: true, fullMB: 36, fullDL: 19, source: 'game' },
  tauntaun: { url: '/models/galaxy/bf2017/crew/tauntaun.glb', tall: 2.67, rig: 'own', ownRig: 'tauntaun', lod: true, full: true, fullMB: 27, fullDL: 12, source: 'game' },
  // the galaxy's small creatures, droids and aliens from the game, each on
  // its own skeleton with its own clips (lib/three/walrusSets/fauna.js;
  // scripts/bf2017-fauna.mjs imports and packs them): Theed's birds, Mos
  // Eisley's chickens and scurriers, Kashyyyk's tachs, Naboo's pelikki and
  // runyips, Endor's profoggs, Jabba's Gamorrean guard, Echo Base's
  // treadwell and gonk; Pillio's and Felucia's for when those worlds come
  birdtheed: { url: '/models/galaxy/bf2017/crew/birdtheed.glb', tall: 0.339, rig: 'own', ownRig: 'birdtheed', lod: true, far: true, full: true, fullMB: 4, fullDL: 3, source: 'game' },
  chicken: { url: '/models/galaxy/bf2017/crew/chicken.glb', tall: 0.352, rig: 'own', ownRig: 'chicken', lod: true, full: true, fullMB: 1, fullDL: 1, source: 'game' },
  scurrier: { url: '/models/galaxy/bf2017/crew/scurrier.glb', tall: 0.409, rig: 'own', ownRig: 'scurrier', lod: true, far: true, full: true, fullMB: 1, fullDL: 1, source: 'game' },
  tach: { url: '/models/galaxy/bf2017/crew/tach.glb', tall: 1.191, rig: 'own', ownRig: 'tach', lod: true, far: true, full: true, fullMB: 4, fullDL: 3, source: 'game' },
  pelikki: { url: '/models/galaxy/bf2017/crew/pelikki.glb', tall: 0.941, rig: 'own', ownRig: 'pelikki', lod: true, far: true, full: true, fullMB: 1, fullDL: 1, source: 'game' },
  runyip: { url: '/models/galaxy/bf2017/crew/runyip.glb', tall: 2.107, rig: 'own', ownRig: 'runyip', lod: true, far: true, full: true, fullMB: 12, fullDL: 8, source: 'game' },
  profogg: { url: '/models/galaxy/bf2017/crew/profogg.glb', tall: 0.2, rig: 'own', ownRig: 'profogg', lod: true, far: true, full: true, fullMB: 1, fullDL: 1, source: 'game' },
  sneep: { url: '/models/galaxy/bf2017/crew/sneep.glb', tall: 0.403, rig: 'own', ownRig: 'sneep', lod: true, far: true, full: true, fullMB: 1, fullDL: 1, source: 'game' },
  stintarils: { url: '/models/galaxy/bf2017/crew/stintarils.glb', tall: 1.274, rig: 'own', ownRig: 'stintarils', lod: true, far: true, full: true, fullMB: 1, fullDL: 1, source: 'game' },
  pillioshrimp: { url: '/models/galaxy/bf2017/crew/pillioshrimp.glb', tall: 1.79, rig: 'own', ownRig: 'pillioshrimp', lod: true, far: true, full: true, fullMB: 18, fullDL: 11, source: 'game' },
  felbird: { url: '/models/galaxy/bf2017/crew/felbird.glb', tall: 0.442, rig: 'own', ownRig: 'felbird', lod: true, far: true, full: true, fullMB: 11, fullDL: 8, source: 'game' },
  felripper: { url: '/models/galaxy/bf2017/crew/felripper.glb', tall: 0.333, rig: 'own', ownRig: 'felripper', lod: true, far: true, full: true, fullMB: 16, fullDL: 9, source: 'game' },
  gamorreanguard: { url: '/models/galaxy/bf2017/crew/gamorreanguard.glb', tall: 1.822, rig: 'own', ownRig: 'gamorrean', lod: true, full: true, fullMB: 38, fullDL: 22, source: 'game' },
  treadwell: { url: '/models/galaxy/bf2017/crew/treadwell.glb', tall: 1.781, rig: 'own', ownRig: 'treadwell', lod: true, far: true, full: true, fullMB: 3, fullDL: 2, source: 'game' },
  gonk: { url: '/models/galaxy/bf2017/crew/gonk.glb', tall: 1.735, rig: 'own', ownRig: 'gonk', lod: true, far: true, full: true, fullMB: 4, fullDL: 4, source: 'game' },
  // the kinds the game has that the site had not brought in, from the
  // desktop’s export (lane C4: docs/superpowers/plans/2026-10-21-bf-default-
  // C4-kinds-from-the-export.md), each on its own rig with its pack
  // (walrusSets/fauna.js; scripts/bf2017-fauna.mjs --root). Tatooine’s
  // Jawas, dewbacks and banthas take them over from the catalogue’s
  // Sketchfab statues: their sheets beside the site’s
  // (docs/superpowers/evidence/bf-default-c4/) walk, run and flinch on the
  // game’s clips where the old ones slid. Their full cuts (the game’s LOD0
  // at its own maps) wait on the owner’s publish to the bucket, so for now
  // the plain cut is the pipeline’s committed one (the game’s mesh within
  // the rigged budget, its maps at 1024) beside the full import’s light and
  // far cuts; the publish makes them `full` (HANDOFF-battlefront.md, “The
  // cast”).
  jawa: { url: '/models/galaxy/bf2017/crew/jawa.glb', tall: 1.001, rig: 'own', ownRig: 'jawa', lod: true, far: true, source: 'game' },
  dewback: { url: '/models/galaxy/bf2017/crew/dewback.glb', tall: 2.107, rig: 'own', ownRig: 'dewback', lod: true, far: true, source: 'game' },
  bantha: { url: '/models/galaxy/bf2017/crew/bantha.glb', tall: 3.2, rig: 'own', ownRig: 'bantha', lod: true, far: true, source: 'game' },
  // Yoda and General Grievous on their own skeletons with their own packs
  // (walrusSets/ownHeroes.js), and Iden Versio in her Inferno Squad armour
  // from the campaign’s first act (the game’s humanoid rig and pack; act 3
  // is the sequel era’s and never imported), from the same export. Heroes,
  // so their plain cuts are held to the hero’s 4 MB, the game’s LOD1 (LOD2
  // for Grievous) at 1024: on the roster they are `soon` (galaxy/heroes.js:
  // the saber is one path, on the humanoid rig), but as people on the
  // worlds they stand and walk now, and Yoda takes over the catalogue’s
  // statue where Dagobah, Coruscant and Kashyyyk place him. Their full
  // cuts wait on the owner’s publish as the Jawa’s do.
  yoda: { url: '/models/galaxy/bf2017/crew/yoda.glb', tall: 0.865, rig: 'own', ownRig: 'yoda', lod: true, far: true, source: 'game' },
  grievous: { url: '/models/galaxy/bf2017/crew/grievous.glb', tall: 2.395, rig: 'own', ownRig: 'grievous', lod: true, far: true, source: 'game' },
  iden: { url: '/models/galaxy/bf2017/crew/iden.glb', tall: 1.595, rig: 'walrus', lod: true, far: true, source: 'game' },
};

// (its own kinds only: never a name off Object’s prototype)
export const bodyOf = (kind) => (Object.hasOwn(BODIES, kind) ? BODIES[kind] : null);
export const sourceOf = (kind) => bodyOf(kind)?.source ?? null;

// the game’s first, then a mod’s, then the site’s
const rank = (source) => (source === 'game' ? 0 : source?.startsWith('mod:') ? 1 : 2);
export function gameFirst(kinds = []) {
  let best = null;
  for (const kind of kinds) {
    const row = bodyOf(kind);
    if (row && (best === null || rank(row.source) < rank(bodyOf(best).source))) best = kind;
  }
  return best;
}
