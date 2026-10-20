// The fellowship: who walks with you along the Road, in what order and in
// what state (the design’s §4.1). Pure: the line is replayed from Bag End
// to s through CHANGES, so a visitor who opens on Gorgoroth finds Frodo,
// Sam and Gollum there and not Frodo alone.
//
//   walkers(stages, s) → [{ id, order, state }]   (in the line’s order)
//   clipFor(state, mode, id?) → the clip a walker plays
//
// A change: { stage, local (metres into it), add: [ids], remove: [ids],
// state: { id: state }, order: [ids] (the line rearranged) }; an added
// walker is `walking` unless `state` says otherwise.

import { STAGES } from './stages/index';

export const CAST = ['frodo', 'sam', 'merry', 'pippin', 'gandalf', 'gandalfwhite', 'aragorn', 'boromir', 'legolas', 'gimli', 'bilbo', 'arwen', 'elrond', 'galadriel', 'gollum'];
export const STATES = ['walking', 'running', 'riding', 'grieving', 'leading', 'carrying', 'carried', 'lying', 'staying', 'aboard'];
const ELVES = new Set(['legolas', 'arwen', 'elrond', 'galadriel']);
const HOBBITS = ['frodo', 'sam', 'merry', 'pippin'];
const walking = (ids) => Object.fromEntries(ids.map((id) => [id, 'walking']));

export const CHANGES = [
  { stage: 'hobbiton', local: 0, add: ['frodo'] },
  // (the field’s edge: the last 40 m of the lane)
  { stage: 'hobbiton', local: STAGES[0].length - 40, add: ['sam'] },
  // (Maggot’s crop: the two out of the corn at the mushrooms’ beat)
  { stage: 'shire-edge', local: 26, add: ['merry', 'pippin'] },
  // (Bree’s last beat: Strider leads them out the back way at dawn)
  { stage: 'bree', local: 134, add: ['aragorn'] },
  // (the Ford: Arwen out of the trees, Frodo on Asfaloth with her)
  { stage: 'ford', local: 72, add: ['arwen'], state: { frodo: 'riding', arwen: 'riding' } },
  { stage: 'rivendell', local: 0, remove: ['arwen'], state: { frodo: 'walking' } },
  // (the morning they leave: nine under the arch, the film’s order)
  {
    stage: 'rivendell',
    local: 138,
    add: ['gandalf', 'legolas', 'gimli', 'boromir'],
    order: ['gandalf', 'legolas', 'gimli', 'aragorn', 'boromir', 'merry', 'pippin', 'sam', 'frodo'],
  },
  // (the Bridge of Khazad-dûm)
  { stage: 'moria', local: 107, remove: ['gandalf'], state: { legolas: 'grieving', gimli: 'grieving', aragorn: 'grieving', boromir: 'grieving', merry: 'grieving', pippin: 'grieving', sam: 'grieving', frodo: 'grieving' } },
  { stage: 'lorien', local: 0, state: walking(['legolas', 'gimli', 'aragorn', 'boromir', ...HOBBITS]) },
  // (Amon Hen: two go east)
  { stage: 'anduin', local: 140, remove: ['legolas', 'gimli', 'aragorn', 'boromir', 'merry', 'pippin'] },
  { stage: 'marshes', local: 40, add: ['gollum'], state: { gollum: 'leading' }, order: ['gollum', 'frodo', 'sam'] },
  { stage: 'gorgoroth', local: 100, state: { sam: 'carrying', frodo: 'carried' } },
  // (the Cracks of Doom, then the two on the rock in the fire)
  { stage: 'gorgoroth', local: 136, remove: ['gollum'], state: { sam: 'walking', frodo: 'walking' } },
  { stage: 'gorgoroth', local: 156, state: { sam: 'lying', frodo: 'lying' } },
  { stage: 'minas-tirith', local: 0, add: ['merry', 'pippin', 'aragorn', 'arwen', 'gandalfwhite', 'legolas', 'gimli'], state: walking(['frodo', 'sam']), order: ['frodo', 'sam', 'merry', 'pippin', 'aragorn', 'arwen', 'gandalfwhite', 'legolas', 'gimli'] },
  {
    stage: 'havens',
    local: 0,
    add: ['bilbo', 'elrond', 'galadriel'],
    remove: ['aragorn', 'arwen', 'legolas', 'gimli'],
    state: { frodo: 'aboard', bilbo: 'aboard', gandalfwhite: 'aboard', elrond: 'aboard', galadriel: 'aboard', sam: 'staying', merry: 'staying', pippin: 'staying' },
    order: ['frodo', 'bilbo', 'gandalfwhite', 'elrond', 'galadriel', 'sam', 'merry', 'pippin'],
  },
];

// each change’s place on the whole road, in metres from Bag End
function metresOf(stages, c) {
  let before = 0;
  for (const st of stages) {
    if (st.id === c.stage) return before + c.local;
    before += st.length;
  }
  return Infinity;
}

export function walkers(stages, s) {
  const whole = stages.reduce((a, st) => a + st.length, 0);
  // (a micrometre’s grace, so an address read back through s’s rounding is past its change)
  const metres = Math.min(1, Math.max(0, s)) * whole + 1e-6;
  let line = [];
  const states = new Map();
  for (const c of CHANGES) {
    if (metresOf(stages, c) > metres) break;
    for (const id of c.remove ?? []) {
      line = line.filter((x) => x !== id);
      states.delete(id);
    }
    for (const id of c.add ?? []) {
      if (!line.includes(id)) line.push(id);
      states.set(id, 'walking');
    }
    for (const [id, st] of Object.entries(c.state ?? {})) states.set(id, st);
    if (c.order) line = [...c.order.filter((id) => line.includes(id)), ...line.filter((id) => !c.order.includes(id))];
  }
  return line.map((id, order) => ({ id, order, state: states.get(id) }));
}

export function clipFor(state, mode, id = null) {
  switch (state) {
    case 'running':
      return 'jog';
    case 'riding':
    case 'carried':
      return 'sit.ground';
    case 'grieving':
      return 'tired';
    case 'leading':
      return 'crawl';
    case 'lying':
      return 'lie.down';
    case 'staying':
    case 'aboard':
      return 'idle';
    default:
      if (mode === 'boat' || mode === 'horse') return 'sit.ground';
      return ELVES.has(id) ? 'walk.formal' : 'walk';
  }
}
