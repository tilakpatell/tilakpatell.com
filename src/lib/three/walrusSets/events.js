// The worlds' set pieces from the game, each a rig of its own whose clips
// play it through (packed whole by scripts/bf2017-rigclips.mjs --pack
// <rig>, as lane V's walkers are, the skeleton from the first clip): the
// Kamino assault ship's flights over the platforms (the Trident, its
// event 23 to 26), the platform's own collapse (event 24), and Theed's MTT
// coming apart in the street (event 19). The level factory's tracks
// (lane E0's tracks.json) say when each plays; their meshes come with the
// maps' parts. Pure.
//
//   EVENT_RIGS { rig: { skeleton (the drop's whole path), set: { 'event.<name>': gameName } } }

export const EVENT_RIGS = {
  trident: {
    skeleton: 'Characters/NPC/Vehicles/Trident/Trident_01/Trident_01_Ske',
    set: {
      'event.23a.start': 'Trident_01_Event023a_Start_Anim',
      'event.23a': 'Trident_01_Event023a_Loop_Anim',
      'event.23a.end': 'Trident_01_Event023a_End_Anim',
      'event.23b.start': 'Trident_01_Event023b_Start_Anim',
      'event.23b': 'Trident_01_Event023b_Loop_Anim',
      'event.23b.end': 'Trident_01_Event023b_End_Anim',
      'event.24': 'Kamino_01_Event024_Trident_Anim',
      'event.25': 'Trident_01_Event025_Anim',
      'event.26': 'Trident_01_Event026_Anim',
    },
  },
  kaminoevent24: {
    skeleton: 'FX/Destruction/Kamino_01/Kamino_01_Event024/Kamino_01_Event024_skeleton',
    set: { 'event.24': 'Kamino_01_Event024' },
  },
  theedevent19: {
    skeleton: 'FX/Destruction/Theed/event019/Theed_event019a_skeleton',
    set: { 'event.19': 'Theed_event019a' },
  },
};
