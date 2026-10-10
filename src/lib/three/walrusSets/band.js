// The cantina's band from the game (BandPlaying_*, on the humanoid: the
// drop's Bith has a skeleton of its own with no clips on it, so the band
// plays on a 2017 figure on the game's humanoid rig, never on the Bith,
// whose rig would be another's: the rig rule). Packed as `band`
// (scripts/bf2017-clips.mjs band); lane E1's cantina district places the
// players (a life row's `play: 'band.1'`). Pure.
//
//   BAND_SET  { 'band.1'…'band.5': gameName }

export const BAND_SET = {
  'band.1': 'BandPlaying_01',
  'band.2': 'BandPlaying_02',
  'band.3': 'BandPlaying_03',
  'band.pipes': 'BandPlaying_BagPipe_03',
  'band.drums': 'BandPlaying_Drummer_04',
};
