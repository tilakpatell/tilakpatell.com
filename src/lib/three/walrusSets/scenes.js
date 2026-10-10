// The game's cinematic scenes the site plays (lib/three/scenePlayer.js), each
// a few roles and the game's clip for each, packed a scene at a time
// (scripts/bf2017-clips.mjs --scene <id>) into scenes/<id>.glb:
//
//   intro-<hero>   the hero's own entrance, the game's Heroes versus
//                  Villains line-up (CIN_<Hero>_HvsV_Intro_*) or its
//                  battle's hero intro (Battle_Hero_Intro_*), played as a
//                  duellist squares up to you on the surface (high and ultra)
//   hoth-outro     the Rebels' four at Echo Base when the Battle of Hoth is
//                  held (CIN_PB_Hoth_Outro_Reb_E1 to E4), on the winners
//
// (The Death Star's inside stands its people on Meshy's rig, so none of the
// game's throne-room or corridor clips can play there: the rig rule.) Pure.
//
//   SCENES                { id: { role: gameName | [gameName…] } }
//   introScene(kind)      → 'intro-<kind>' where there is one, else null
//   OUTROS                { mission system: { scene, side } } the side whose win plays it

const INTRO = {
  luke: ['Battle_Hero_Intro_Luke_MP', 'CIN_Luke_HvsV_Intro_Slot1'],
  vader: ['Battle_Hero_Intro_Vader_MP', 'CIN_Vader_HvsV_Intro_Slot1'],
  leia: ['Battle_Hero_Intro_Leia_MP', 'CIN_Leia_HvsV_Intro_Slot1'],
  han: ['Battle_Hero_Intro_Han_MP', 'CIN_Han_HvsV_Intro_Slot1'],
  palpatine: ['Battle_Hero_Intro_Palpatine_MP', 'CIN_Palpatine_HvsV_Intro_Slot1'],
  obiwan: 'CIN_ObiWan_HvsV_Intro_Slot_01',
  anakin: 'CIN_Anakin_HvsV_Intro_01',
  maul: 'CIN_Maul_HvsV_Intro_Slot1',
  dooku: 'CIN_Dooku_HvsV_Intro_01',
  chewie: 'CIN_Chewbacca_HvsV_Intro_Slot1',
  bobafett: 'CIN_Boba_HvsV_Intro_Slot1',
  bossk: 'CIN_Bossk_HvsV_Intro_Slot1',
  lando: 'CIN_Lando_HvsV_Intro_Slot1',
};

export const SCENES = {
  ...Object.fromEntries(Object.entries(INTRO).map(([hero, clip]) => [`intro-${hero}`, { [hero]: clip }])),
  'hoth-outro': { e1: 'CIN_PB_Hoth_Outro_Reb_E1', e2: 'CIN_PB_Hoth_Outro_Reb_E2', e3: 'CIN_PB_Hoth_Outro_Reb_E3', e4: 'CIN_PB_Hoth_Outro_Reb_E4' },
};

export const introScene = (kind) => (SCENES[`intro-${kind}`] ? `intro-${kind}` : null);

export const OUTROS = { hoth: { scene: 'hoth-outro', side: 'defend' } };
