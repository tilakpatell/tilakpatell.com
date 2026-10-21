// Who you can meet on the map: where they stand (on the 800×560 sheet), how
// they're dressed (./mapFigures.js), and what they say when Frodo comes by
// or you tap them. Their lines go round in turn.
import { placeAt } from './sheet';

// each stands by a place of the sheet (./sheet.js), as far off it as on the hand-drawn one
const beside = (id, dx, dy) => {
  const [x, y] = placeAt(id);
  return [x + dx, y + dy];
};

export const CAST = [
  {
    id: 'bilbo',
    name: 'Bilbo Baggins',
    at: beside('hobbiton', 18, 18),
    look: { hair: 0xc9c2b8, coat: 0xb5432e, feet: 'hairy', seed: 3 },
    lines: ['It’s a dangerous business, Frodo, going out your door.', 'I’m going on an adventure!', 'Happy birthday to me!'],
  },
  {
    id: 'gandalf',
    name: 'Gandalf the Grey',
    at: beside('bree', -26, 14),
    look: { tall: 1.55, robe: 0x7c7f88, hat: 'wizard', hairStyle: 'long', hair: 0xd8d4cc, beard: { color: 0xe4e0d8, len: 0.42 }, item: 'staff', feet: 'boots', seed: 5 },
    lines: ['A wizard is never late, nor is he early. He arrives precisely when he means to.', 'All we have to decide is what to do with the time that is given us.', 'Fly, you fools!'],
  },
  {
    id: 'strider',
    name: 'Strider',
    at: beside('weathertop', 12, 16),
    look: { tall: 1.5, coat: 0x3e3a34, shirt: 0x5a5246, cloak: 0x2e3328, hairStyle: 'long', hair: 0x2a1e16, beard: { color: 0x2a1e16, len: 0.12 }, item: 'sword', feet: 'boots', seed: 7 },
    lines: ['Are you frightened? Not nearly frightened enough.', 'I know what hunts you.', 'Gentlemen, we do not stop till nightfall.'],
  },
  {
    id: 'elrond',
    name: 'Elrond',
    at: beside('rivendell', 16, 20),
    look: { tall: 1.55, robe: 0x5a2a4a, hat: 'crown', hairStyle: 'long', hair: 0x1e1a18, feet: 'boots', seed: 9 },
    lines: ['Nine companions. So be it. You shall be the Fellowship of the Ring.', 'This quest may be attempted by the weak with as much hope as the strong.'],
  },
  {
    id: 'gimli',
    name: 'Gimli',
    at: beside('moria', -18, 22),
    look: { tall: 0.95, wide: 1.35, coat: 0x6a3a22, shirt: 0x8a8f98, hat: 'helm', hairStyle: 'none', hair: 0x9a3a1a, beard: { color: 0xa8441c, len: 0.5 }, item: 'axe', feet: 'boots', seed: 11 },
    lines: ['Nobody tosses a dwarf!', 'Let them come! There is one dwarf yet in Moria who still draws breath.', 'Certainty of death, small chance of success… what are we waiting for?'],
  },
  {
    id: 'galadriel',
    name: 'Galadriel',
    at: beside('lorien', -12, 18),
    look: { tall: 1.6, robe: 0xf4f2ea, hat: 'crown', hairStyle: 'long', hair: 0xf0d896, feet: 'boots', aura: 0xdfe8ff, seed: 13 },
    lines: ['Even the smallest person can change the course of the future.', 'The world is changed. I feel it in the water.'],
  },
  {
    id: 'legolas',
    name: 'Legolas',
    at: beside('lorien', 20, 18),
    look: { tall: 1.5, coat: 0x5a6a3a, shirt: 0x7a7a5a, hairStyle: 'long', hair: 0xf2e4b0, item: 'bow', feet: 'boots', seed: 15 },
    lines: ['They’re taking the hobbits to Isengard!', 'A red sun rises. Blood has been spilled this night.', 'That still only counts as one!'],
  },
  {
    id: 'treebeard',
    name: 'Treebeard',
    at: beside('fangorn', 10, 0),
    kind: 'ent',
    lines: ['Don’t be hasty.', 'Hoom, hom. I am on nobody’s side, because nobody is altogether on my side.'],
  },
  {
    id: 'saruman',
    name: 'Saruman',
    at: beside('isengard', 18, 16),
    look: { tall: 1.55, robe: 0xeeece4, hat: null, hairStyle: 'long', hair: 0xf2f0ea, beard: { color: 0xf4f2ec, len: 0.5 }, item: 'white-staff', feet: 'boots', seed: 17 },
    lines: ['The hour is later than you think.', 'You did not seriously think a hobbit could contend with the will of Saruman?'],
  },
  {
    id: 'boromir',
    name: 'Boromir',
    at: beside('amon-hen', 14, 16),
    look: { tall: 1.55, coat: 0x6a2a22, shirt: 0x5a4a3a, cloak: 0x3a2a24, hairStyle: 'long', hair: 0x5a3a22, beard: { color: 0x5a3a22, len: 0.1 }, item: 'horn', feet: 'boots', seed: 19 },
    lines: ['One does not simply walk into Mordor.', 'It is a strange fate that we should suffer so much fear and doubt over so small a thing.'],
  },
  {
    id: 'gollum',
    name: 'Gollum',
    at: beside('dead-marshes', -14, -14),
    kind: 'gollum',
    lines: ['My precious…', 'Sneaky little hobbitses. Wicked, tricksy, false!', 'Po-tay-toes!'],
  },
];

// what Frodo and Sam say when you tap them
export const HOBBIT_LINES = {
  frodo: ['I will take the Ring, though I do not know the way.', 'I wish the Ring had never come to me.', 'It’s gone. It’s done.'],
  sam: ['I can’t carry it for you, but I can carry you!', 'There’s some good in this world, Mr. Frodo, and it’s worth fighting for.', 'Po-tay-toes! Boil ’em, mash ’em, stick ’em in a stew.'],
};
// the lines the site has the films' own recordings of (lib/clips); the rest
// are said in the speaker's made voice, where it's been made (./voicelines.js)
export const SPOKEN = { 'Fly, you fools!': 'flyYouFools', 'I can’t carry it for you, but I can carry you!': 'carryYou', 'My precious…': 'myPrecious' };
export const NAMES = { frodo: 'Frodo Baggins', sam: 'Samwise Gamgee', ...Object.fromEntries(CAST.map((c) => [c.id, c.name])) };
