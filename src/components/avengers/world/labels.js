import { STONES } from '../../interests/stones';

// The words and numbers the compound's HUD and its cards share.

// seconds as 0:41.3
export const clock = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;
// either half of the Soul Stone is the Soul Stone, and whose half it is
export const STONE_OF = { 'soul-clint': 'soul', 'soul-natasha': 'soul' };
export const HALF_OF = { 'soul-clint': 'Clint’s', 'soul-natasha': 'Natasha’s' };
// a stone's row in the gauntlet's table (a half's is the whole stone's), or null
export const stoneById = (id) => STONES.find((s) => s.id === (STONE_OF[id] ?? id)) ?? null;
export const stoneFor = (p) => (p.stone ? stoneById(p.stone) : null);
// what a door's card and the lists say about its stone
export const stoneLine = (p) => {
  const st = stoneFor(p);
  if (!st) return p.done ? 'No stone here: Peter made it to school' : 'No stone here: just Peter, and school';
  const half = HALF_OF[p.stone];
  if (p.done) return half ? `${half} half of the ${st.name}: won back` : `${st.name}: won back`;
  return half ? `Win it for ${half} half of the ${st.name}` : `Win it for the ${st.name}`;
};
