// The packs of the game's clips beyond the hero and humanoid ones (lane A of
// docs/superpowers/specs/2026-10-10-bf2017-every-asset-design.md): each
// family its own pack, loaded with the first figure that asks for it, so the
// humanoid pack every 2017 person walks on stays small. A set maps the
// site's names onto the game's clips as walrusClips.js's do (a name lists
// its spellings, best first); `opts` tells scripts/bf2017-clips.mjs where it
// takes them from:
//
//   SET_PACKS { pack: { set, opts? } }: stance-p, stance-t, stance-l (stance.js),
//     additive (additive.js), npc (npc.js, and the soldiers' victories),
//     emotes-<hero> (emotes.js), scene-<id> (scenes.js), 1p (firstPerson.js),
//     vehicles (vehicles.js), band (band.js)
//     opts.scene      the pack is a scene's, written to scenes/<id>.glb
//     opts.additive   the pack is of the game's additive clips (deltas on
//                     a pose: anims_additive/), laid over the figure's pose
//     opts.skeletons  the skeletons' pattern (a RegExp's source), else the
//                     humanoid's and the cinematics' (the same rig)

import { ADD_SET } from './additive.js';
import { BAND_SET } from './band.js';
import { EMOTE_HEROES, EMOTE_SET, SOLDIER_VICTORY } from './emotes.js';
import { FP_SET } from './firstPerson.js';
import { NPC_SET } from './npc.js';
import { SCENES } from './scenes.js';
import { VEHICLE_SET } from './vehicles.js';
import { STANCE_SET } from './stance.js';

export const SET_PACKS = {
  'stance-p': { set: STANCE_SET('p') },
  'stance-t': { set: STANCE_SET('t') },
  'stance-l': { set: STANCE_SET('l') },
  additive: { set: ADD_SET, opts: { additive: true } },
  npc: { set: { ...NPC_SET, ...SOLDIER_VICTORY } },
  vehicles: { set: VEHICLE_SET },
  band: { set: BAND_SET },
  // (the first person's: its own skeleton, the humanoid's bones by the same names)
  '1p': { set: FP_SET, opts: { skeletons: '/Walrus_HumanMale_1p$' } },
  ...Object.fromEntries(EMOTE_HEROES.map((h) => [`emotes-${h}`, { set: EMOTE_SET(h) }])),
  // (a scene's roles, packed into scenes/<id>.glb: scenePlayer.js)
  ...Object.fromEntries(Object.entries(SCENES).map(([id, roles]) => [`scene-${id}`, { set: roles, opts: { scene: id } }])),
};
