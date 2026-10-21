import { describe, expect, it } from 'vitest';
import { CURE_FOR_BOILS, HEATS, INGREDIENTS, SNAPE, colourOf, move, newBrew, next, potionsBot, result } from './potions';

const brew = (moves, b = newBrew()) => {
  let points = 0;
  let last = null;
  for (const m of moves) {
    last = move(b, m);
    b = last.brew;
    points += last.points;
  }
  return { b, points, last };
};
const byBoard = () => {
  const out = [];
  let b = newBrew();
  for (let m = potionsBot(b); m; m = potionsBot(b)) {
    out.push(m);
    b = move(b, m).brew;
  }
  return out;
};

describe('the board', () => {
  it('is a heat, five ingredients in order, a count of stirs, and the fire off before the quills', () => {
    const board = CURE_FOR_BOILS.board;
    const adds = board.filter((s) => s.do === 'add').map((s) => s.what);
    expect(adds).toEqual(['nettles', 'fangs', 'slugs', 'mucus', 'quills']);
    for (const a of adds) expect(INGREDIENTS[a]).toBeTruthy();
    expect(board.find((s) => s.do === 'stir').times).toBe(4);
    expect(HEATS).toContain(board[0].to);
    const off = board.findIndex((s) => s.do === 'heat' && s.to === 'off');
    expect(off).toBe(board.findIndex((s) => s.what === 'quills') - 1);
    for (const s of board) expect(s.colour).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe('brewing', () => {
  it('the board followed brews it, for ten points', () => {
    const moves = byBoard();
    expect(moves.filter((m) => m.do === 'stir')).toHaveLength(4);
    const { b, points, last } = brew(moves);
    expect(b.done).toBe(true);
    expect(points).toBe(10);
    expect(last.says).toBe(SNAPE.done);
    expect(result(b)).toEqual({ type: 'lesson', id: 'potions', done: true, points: 10 });
    expect(colourOf(b)).toBe(CURE_FOR_BOILS.board.at(-1).colour);
  });
  it('an ingredient out of order melts the cauldron and costs five', () => {
    const { b, points, last } = brew([{ do: 'heat', to: 'medium' }, { do: 'add', what: 'fangs' }]);
    expect(b.melted).toBe(true);
    expect(points).toBe(-5);
    expect(last.says).toBe(SNAPE.melted);
    expect(next(b)).toBe(null);
    expect(colourOf(b)).toBe('#1a2a12');
    // and a melted cauldron takes no more moves
    expect(move(b, { do: 'add', what: 'nettles' }).points).toBe(0);
  });
  it('the quills on the fire melt it, as they always have', () => {
    const moves = byBoard();
    const onFire = moves.filter((m) => !(m.do === 'heat' && m.to === 'off'));
    const { b, points } = brew(onFire);
    expect(b.melted).toBe(true);
    expect(points).toBe(-5);
  });
  it('a fifth stir, or one the wrong way, is a wrong move', () => {
    const upTo = byBoard().slice(0, 7); // heat, nettles, fangs, four stirs
    expect(brew([...upTo, { do: 'stir', dir: 'cw' }]).b.melted).toBe(true);
    const three = byBoard().slice(0, 5);
    expect(brew([...three, { do: 'stir', dir: 'ccw' }]).b.melted).toBe(true);
  });
  it('the wrong heat is a wrong move', () => {
    expect(brew([{ do: 'heat', to: 'high' }]).b.melted).toBe(true);
  });
  it('a fresh cauldron starts again from the top', () => {
    expect(next(newBrew())).toBe(CURE_FOR_BOILS.board[0]);
  });
});
