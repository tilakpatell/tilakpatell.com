// The Citadel’s look (components/worlds/looks.js): painted, as C-137 is: the
// show’s flat colours on a two-step toon ramp, a line round the cast only
// and no film grade but the alarm's (alarmGrade), the palette its rooms’ and
// concourse’s own (./rooms.js: the factory’s blue-grey walls, its steel, the
// dark ceiling, the neon). The house tone (Neutral, through houseOn, its
// exposure kept). Its bloom is under white: the Citadel is a city at night
// in space, and its signs, its lifts and its neon strips are the light.

export const LOOK = {
  art: 'painted',
  palette: ['#b8c4d6', '#3a4254', '#8a96aa', '#5b6f8f', '#d8dee8', '#6ff3ff', '#fff0cc', '#34296a'],
  tone: 'house',
  bloom: { strength: 0.5, radius: 0.42, threshold: 0.9 },
  why: {
    art: 'Rick’s and Mortytown’s people are the shared cast (../portal/meshyCast.js), dressed from the wardrobe',
    bloom: 'a city at night: the neon, the signs and the lifts glow, and its walls are dark enough to stay under the threshold',
  },
};

// The line round the Citadel's live figures, as C-137's (its camera's field
// of view much the same): metres
export const CAST_INK = 0.01;

// The one grade the Citadel keeps: red alert closes the picture in and pulses
// it red, and a chase closes it in more. Written into `out` (a frame's
// grade, made once) and handed back; on an ordinary day it changes nothing.
export function alarmGrade(red, pulse, chased, out = { vignette: 0, high: [0, 0, 0], shadow: [0, 0, 0] }) {
  out.vignette = red * 0.18 + (chased ? 0.12 : 0);
  out.high[0] = pulse * 0.05;
  out.high[1] = 0;
  out.high[2] = 0;
  out.shadow[0] = pulse * 0.025;
  out.shadow[1] = 0;
  out.shadow[2] = 0;
  return out;
}
