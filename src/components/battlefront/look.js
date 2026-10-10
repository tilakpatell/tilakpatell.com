// The Battlefront world's look (components/worlds/looks.js): its own, drawn
// on the node renderer under the game's own lighting records (the level's
// VisualEnvironment: sun, sky, fog, exposure, bloom, grade) through
// src/lib/three/light's stack, with the game's exposure and grade as the
// last word: no house tone mapper or house bloom over them.

export const LOOK = {
  art: 'own',
  tone: 'none',
  bloom: false,
  why: {
    art: 'the 2017 game’s own level, figures and lighting records, applied as the game applies them',
    tone: 'the record’s exposure and grading LUT through the light stack’s output pass, not the house curve',
  },
};
