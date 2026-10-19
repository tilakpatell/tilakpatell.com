import { describe, expect, it } from 'vitest';
import { roomEnd } from './ends';

describe('a room’s end card, in the 3D game’s words', () => {
  it('words a cleared room', () => {
    expect(roomEnd('cleared', { stars: 3, throws: 1, catches: 0, stone: false }, 0)).toEqual({ won: true, kicker: 'Room 1 clear', title: 'He could do this all day.', line: 'One throw, par 1.', stars: { got: 3, of: 3 }, stone: null, stoneText: 'The Mind Stone is yours, out of Loki’s sceptre.' });
    const last = roomEnd('cleared', { stars: 2, throws: 4, catches: 2, stone: true }, 11);
    expect([last.title, last.line, last.stone]).toEqual(['Nice throwing.', '4 throws, par 3 · caught it 2 times.', 'mind']);
    expect(roomEnd('cleared', { stars: 2, throws: 3, catches: 1, stone: false }, 6).line).toBe('3 throws, par 2 · caught it once.');
  });
  it('words a failed room: the hostage, or out of throws with the room’s tip', () => {
    expect(roomEnd('failed', { reason: 'hostage' }, 8)).toEqual({ won: false, kicker: 'Room 9', title: 'You hit the hostage.', line: 'The orange dummy is a hostage. Find a way around it.', stars: null, stone: null, stoneText: '' });
    expect(roomEnd('failed', { reason: 'throws' }, 0)).toMatchObject({ title: 'Out of throws.', line: 'Par is 1; you get 4. Aim at the bot and throw. The shield comes back if it passes you.' });
  });
});
