// What the people down on the universe map's planets say when you come up to
// them (landings.js's say: { name, line }; ../scene.js shows it and says it),
// in their own voices (scripts/voices, README's "Whose lines"): who they
// are by the name they go by here, and their lines. Not Bumblebee (his radio
// does his talking), a Gazorpian's roar, nor what's only done ([looks at the
// camera], (a hum of servos)).

import { LANDINGS } from './landings';
import { spoken } from '../../../lib/voiced';

// a figure's name -> the voice their line is made in
const FIGURE_VOICES = {
  Gandalf: 'gandalf',
  Sam: 'sam',
  Saul: 'saul',
  Mike: 'mike',
  Gus: 'gus',
  Jesse: 'jesse',
  Jerry: 'jerry',
  Summer: 'summer',
  'The President': 'uspresident',
  Thor: 'thor',
  Hulk: 'hulk',
  Michael: 'michael',
  Dwight: 'dwight',
  Jim: 'jim',
  Mario: 'mario',
  Jack: 'jack',
  Mark: 'mark',
  'Mar-Sha': 'marsha',
  'Morty Jr.': 'mortyjr',
  Squanchy: 'squanchy',
  Birdperson: 'birdperson',
  Phoenixperson: 'birdperson',
  Unity: 'unity',
  Gearhead: 'gearhead',
  'King Flippy Nips': 'flippynips',
  'Scroopy Noopers': 'scroopy',
  'Glexo Slim Slom': 'glexo',
  'Risotto Groupon': 'risotto',
};

// The voice someone's line (a say: { name, line }) is said in, or null:
// nobody to sound like, or nothing said aloud.
export function figureVoice(say) {
  const voice = say && FIGURE_VOICES[say.name];
  return voice && spoken(say.line.replace(/\[[^\]]*\]/g, ' ')) ? voice : null;
}

// every landing's figures: the landing's own, and each of its biomes'
// (biomes.js: where on the planet you come down)
export const VOICELINES = Object.values(LANDINGS).flatMap((l) =>
  [...(l.things ?? []), ...(l.biomes ?? []).flatMap((b) => b.things ?? [])]
    .filter((t) => figureVoice(t.say))
    .map((t) => ({ who: figureVoice(t.say), text: t.say.line })),
);
