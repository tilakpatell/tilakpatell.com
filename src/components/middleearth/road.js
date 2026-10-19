// The road the Ring took, stop by stop, placed on the 800×560 map where
// Tolkien’s geography puts each (./sheet.js projects ./geography.js).
import { placeAt } from './sheet';

const xy = (id) => {
  const [x, y] = placeAt(id);
  return { x, y };
};

export const STOPS = [
  { id: 'hobbiton', name: 'Hobbiton', ...xy('hobbiton'), text: 'Bilbo’s birthday party ends with a vanishing act, and Frodo is left with the Ring.' },
  { id: 'bree', name: 'Bree', ...xy('bree'), text: 'The Prancing Pony, where a ranger called Strider has been watching for them.' },
  { id: 'weathertop', name: 'Weathertop', ...xy('weathertop'), text: 'The Nazgûl catch up on the hilltop at night, and Frodo is stabbed with a Morgul blade.' },
  { id: 'rivendell', name: 'Rivendell', ...xy('rivendell'), text: 'Elrond’s council. Nine walkers set out: four hobbits, two men, an elf, a dwarf and a wizard.' },
  { id: 'moria', name: 'Moria', ...xy('moria'), text: 'Under the mountains, through the Doors of Durin, to the bridge of Khazad-dûm.' },
  { id: 'lorien', name: 'Lothlórien', ...xy('lorien'), text: 'Galadriel’s wood, a mirror that shows too much, and boats for the river.' },
  { id: 'amon-hen', name: 'Amon Hen', ...xy('amon-hen'), text: 'The Fellowship breaks. Frodo and Sam go east alone.' },
  { id: 'dead-marshes', name: 'The Dead Marshes', ...xy('dead-marshes'), text: 'Gollum leads them through, past the faces in the water.' },
  { id: 'black-gate', name: 'The Black Gate', ...xy('black-gate'), text: 'Shut, and watched. There is another way in.' },
  { id: 'cirith-ungol', name: 'Cirith Ungol', ...xy('cirith-ungol'), text: 'The stairs, the pass, and Shelob’s lair at the top.' },
  { id: 'mount-doom', name: 'Mount Doom', ...xy('mount-doom'), text: 'Across the plain of Gorgoroth to the fire where the Ring was made.' },
];
