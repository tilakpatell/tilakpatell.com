// What each kitchen's host calls through the hatch, for scripts/voices to make
// in their own voices (its README, "Whose lines"): every one of a level's
// `lines`, as Rush says them, by the host's voice.
import { LEVELS } from './levels';

// a host, by the name the level gives them, to the voice they speak in
// (Strider is Aragorn, before he's king)
export const HOST_VOICE = {
  'Barliman Butterbur': 'butterbur',
  Lindir: 'lindir',
  Balin: 'balin',
  Haldir: 'haldir',
  Aragorn: 'aragorn',
  Bilbo: 'bilbo',
  Strider: 'aragorn',
  Sam: 'sam',
  Shagrat: 'shagrat',
  Gandalf: 'gandalf',
  Beregond: 'beregond',
};

// a level's lines, whichever way they're kept: a list, or lists by dish
const every = (lines) => Object.values(lines).flatMap((v) => (Array.isArray(v) ? v : Object.values(v).flat()));

export const VOICELINES = Object.values(LEVELS).flatMap((l) => every(l.lines).map((text) => ({ who: HOST_VOICE[l.host], text })));
