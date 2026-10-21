import { describe, expect, it } from 'vitest';
import { DIRS, LEVELS, act, newLevel, parseLevel } from './rules';
import { IDLE, dirTo, foresee, keyInput, laserLine, laserState, tapInput, tileFromPoint, viewBoxOf } from './flatInput';

const BITE_ROOM = { name: 't', tip: '', charges: 1, map: ['#######', '#S.G.F#', '#....E#', '#######'], guards: [{ dir: 'W', route: 'w' }] };
const PATROL = 'NwNNWNNSSEEENNNE'; // level 1’s 16-turn solution, solveLevel(0)

describe('Infiltration from above', () => {
  it('lays the grid out a tile to a unit, centred on whole numbers', () => {
    const def = parseLevel(0);
    expect(viewBoxOf(def)).toBe('-0.5 -0.5 9 7');
    const rect = { left: 0, top: 0, width: 900, height: 700 };
    expect(tileFromPoint(rect, 350, 650, def)).toEqual({ x: 3, y: 6 });
    expect(tileFromPoint(rect, 899, 0, def)).toEqual({ x: 8, y: 0 });
    const tall = { left: 0, top: 0, width: 900, height: 900 };
    expect(tileFromPoint(tall, 350, 750, def)).toEqual({ x: 3, y: 6 });
    expect(tileFromPoint(tall, 350, 50, def)).toBeNull(); // the letterbox
  });
  it('knows her four neighbours and nothing else', () => {
    const s = newLevel(0);
    expect([dirTo(s, 3, 5), dirTo(s, 2, 6), dirTo(s, 4, 5), dirTo(s, 3, 6), dirTo(s, 3, 4)]).toEqual(['N', 'W', null, null, null]);
  });
  it('foresees the step that gets her caught, on the real rules, without taking it', () => {
    const s = newLevel(0);
    act(s, { type: 'move', dir: 'N' });
    expect(foresee(s, { type: 'move', dir: 'N' })).toEqual({ danger: true, bump: false, won: false });
    expect(foresee(s, { type: 'wait' }).danger).toBe(false);
    expect([s.px, s.py, s.turns, s.phase]).toEqual([3, 5, 1, 'play']);
  });
  it('with a mouse a click steps at once; on touch the first tap previews and the second commits', () => {
    const s = newLevel(0);
    expect(tapInput(s, IDLE, { x: 3, y: 5 }).action).toEqual({ type: 'move', dir: 'N' });
    const a = tapInput(s, IDLE, { x: 3, y: 5 }, { touch: true });
    expect([a.action, a.input.armed]).toEqual([null, { x: 3, y: 5 }]);
    const moved = tapInput(s, a.input, { x: 2, y: 6 }, { touch: true });
    expect([moved.action, moved.input.armed]).toEqual([null, { x: 2, y: 6 }]);
    expect(tapInput(s, a.input, { x: 3, y: 5 }, { touch: true })).toEqual({ input: IDLE, action: { type: 'move', dir: 'N' } });
    expect(tapInput(s, IDLE, { x: 3, y: 6 }).action).toEqual({ type: 'wait' });
    expect(tapInput(s, a.input, { x: 5, y: 4 }, { touch: true })).toEqual({ input: { ...a.input, armed: null }, action: null });
    expect(tapInput(s, a.input, null, { touch: true }).input.armed).toBeNull();
  });
  it('the Widow’s Bite is a button, then a tile or an arrow', () => {
    LEVELS[200] = BITE_ROOM;
    const s = newLevel(200);
    const armed = keyInput(s, IDLE, 'b');
    expect([armed.input.biting, armed.action]).toEqual([true, null]);
    expect(tapInput(s, armed.input, { x: 3, y: 1 })).toEqual({ input: IDLE, action: { type: 'bite', dir: 'E' } });
    expect(keyInput(s, armed.input, 'ArrowRight').action).toEqual({ type: 'bite', dir: 'E' });
    expect(keyInput(s, armed.input, 'Escape')).toMatchObject({ handled: true, input: { biting: false } });
    expect(keyInput(s, IDLE, 'Escape').handled).toBe(false);
    expect(keyInput(newLevel(0), IDLE, 'e').input.biting).toBe(false);
  });
  it('a scripted player wins level 1 from the keyboard, the step ahead caught at turn 1', () => {
    const KEY = { N: 'ArrowUp', E: 'ArrowRight', S: 'ArrowDown', W: 'ArrowLeft', w: ' ' };
    const s = newLevel(0);
    let input = IDLE;
    const ev = [];
    for (const c of PATROL) {
      if (s.turns === 1) expect(foresee(s, { type: 'move', dir: 'N' }).danger).toBe(true);
      const r = keyInput(s, input, KEY[c]);
      input = r.input;
      ev.push(...act(s, r.action));
    }
    expect([s.phase, s.turns]).toEqual(['won', 16]);
    expect(ev).toContainEqual({ type: 'won', index: 0, turns: 16 });
  });
  it('a scripted player wins level 1 by tapping, each tile twice on touch', () => {
    const s = newLevel(0);
    let input = IDLE;
    for (const c of PATROL) {
      const tile = c === 'w' ? { x: s.px, y: s.py } : { x: s.px + DIRS[c][0], y: s.py + DIRS[c][1] };
      const first = tapInput(s, input, tile, { touch: true });
      expect(first.action).toBeNull();
      const second = tapInput(s, first.input, tile, { touch: true });
      input = second.input;
      act(s, second.action);
    }
    expect([s.phase, s.file]).toEqual(['won', true]);
  });
  it('draws each laser across its tile, on, warning or off by the facility’s turn', () => {
    const d4 = parseLevel(3);
    expect([laserState(d4, 0, 0), laserState(d4, 0, 2), laserState(d4, 0, 3)]).toEqual(['on', 'off', 'warn']);
    expect(laserLine(d4, d4.lasers[0])).toEqual([[3, 0.5], [3, 1.5]]);
    const d8 = parseLevel(7);
    expect(laserLine(d8, d8.lasers[0])).toEqual([[1.5, 6], [2.5, 6]]);
  });
});
