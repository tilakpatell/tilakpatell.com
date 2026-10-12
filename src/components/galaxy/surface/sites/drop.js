// The 2017 game's own worlds, from the ground (the fifth design's lane E5):
// Felucia, Kessel, Sullust, Pillio, Vardos and Fondor, each drawn from its
// game map (`level`: the pack scripts/bf2017-level.mjs wrote under
// public/models/galaxy/bf2017/levels/<world>/, its binaries published by
// hash), a place to land rather than a front. Their people, things and quests
// wait on lanes A and O (`life: []`); the places are the map's own spots, in
// the pack's frame (the spot the pack was built at is the site's 0, 0).
// (sites/index.js has what a site is.)

import { sky, palette } from './outerKit';

export const SITES = {

  kessel: {
    // the pack /models/galaxy/bf2017/levels/kessel/level.json:
    // Kessel_01 (Extraction's and Blast's), `node scripts/bf2017-level.mjs
    // s3/levels/kessel_01 --world kessel --spot 0 -53 --subs Kessel_01,Art
    // --ultra`: the spot is Blast's first spawn on the mine floor, its ground
    // 578 m in the game (TeamDeathmatch_Global:6); the mine keeps its
    // pieces in the `Art` sub-level
    level: 'kessel',
    place: 'The spice mines of Kessel',
    line: 'White salt, black rock, and the mine’s corridors cut into it, under a sky the colour of dust.',
    sky: sky('#7a8aa0', '#e8e4d8', '#fff4e4', { hazeColor: '#ece6d8', clouds: { cover: 0.6, color: '#e8e4dc', shade: '#9a948c', scale: 0.7, speed: 0.004 } }),
    fog: { color: '#dcd8cc', density: 0.0016 },
    light: { sun: 2.4, sky: '#c4c8cc', ground: '#c8c0b0', ambient: 0.85 },
    dust: '#f0ece2',
    edge: 'Salt flats and the Maw’s pull past them. Nothing out there to land on. Better turn back.',
    ground: {
      detail: 'gravel',
      detailLook: { color: 0.6, normal: 0.7 },
      seed: 62,
      wind: 0.7,
      // the game's own ground: Kessel_01's heightmap, 0 on the mine floor
      layers: [{ type: 'image', pack: 'kessel' }],
      palette: palette('#e2ded2', '#f2f0ea', '#5a544c', '#b8b0a0', { deep: '#8a847a', mark: '#6a6058' }),
    },
    weather: [{ kind: 'sand', count: 500 }],
    land: { at: [0, 0], yaw: 0 },
    places: [
      { id: 'mine', name: 'The mine', at: [0, 0], r: 50, about: 'The corridors where the spice comes out, and where the Empire’s guard stands over every door.' },
      // (the extraction’s payload, V_KesselPayload, 157 m north of the landing)
      { id: 'payload', name: 'The payload’s run', at: [-31, 157], r: 40, about: 'The track the stolen coaxium is pushed along to the Millennium Falcon, and the corridors that overlook it.' },
      // (Heroes vs Villains’ first spawn, HeroesVsVillains_Logic:10, by the quarry pools)
      { id: 'quarry', name: 'The quarry pools', at: [-47, -75], r: 40, about: 'Pools of still water in the salt where the quarry was dug out, and the heroes’ ground in the game.' },
    ],
    life: [],
    quests: [],
  },

};
