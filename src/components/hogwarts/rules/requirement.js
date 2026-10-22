// The Room of Requirement’s door (the design’s §4.4): on the seventh floor,
// opposite the tapestry of Barnabas the Barmy, a bare stretch of wall. Think
// of what you need, walk past it three times, and a door is there that was
// not. Pure.
//
//   NEEDS: [{ id, ask, room, said }]  (the three things it can be asked for)
//   WALL: { from, to, near }  the bare stretch along the corridor (x from, to) and how close is passing it
//   newWall() → { need: null, passes: 0, side: 0, open: false }
//   think(state, needId) → state: what you’re thinking of (and the count starts again)
//   pass(state, { x, d }) → { state, passed, opened }: where you are along the
//     corridor (x) and how far from the wall (d); crossing the wall’s middle
//     while close by, thinking of something, is a pass; three and it opens.
//     Walking away to either end of the corridor starts the count again.

export const NEEDS = [
  { id: 'practise', ask: 'A place to practise', room: 'A room for practising in', said: 'A wide room with cushions on the floor, targets on the walls and the books you wanted on the shelves.' },
  { id: 'hide', ask: 'A place to hide something', room: 'The room of hidden things', said: 'A hall as big as a church, full to the roof with everything anyone ever hid in this castle.' },
  { id: 'quiet', ask: 'A quiet place to think', room: 'A quiet room', said: 'A small warm room with a fire, one good chair and a window onto the lake.' },
];

export const WALL = { from: -3, to: 3, near: 2.6, away: 9 };
export const PASSES = 3;

export const newWall = () => ({ need: null, passes: 0, side: 0, open: false });

export function think(state, needId) {
  if (!NEEDS.some((n) => n.id === needId)) return state;
  return { ...state, need: needId, passes: 0, side: 0, open: false };
}

export function pass(state, { x, d }) {
  if (state.open) return { state, passed: false, opened: false };
  // (gone off to an end of the corridor: the wall forgets you)
  if (Math.abs(x) > WALL.away) return { state: state.passes || state.side ? { ...state, passes: 0, side: 0 } : state, passed: false, opened: false };
  const mid = (WALL.from + WALL.to) / 2;
  const side = x < mid ? -1 : 1;
  if (!state.need || d > WALL.near) return { state: { ...state, side: d > WALL.near ? 0 : side }, passed: false, opened: false };
  // (a pass: from one side of its middle to the other, close to it)
  if (state.side && side !== state.side) {
    const passes = state.passes + 1;
    const open = passes >= PASSES;
    return { state: { ...state, passes, side, open }, passed: true, opened: open };
  }
  return { state: { ...state, side }, passed: false, opened: false };
}
