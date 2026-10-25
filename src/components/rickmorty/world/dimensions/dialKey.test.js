import { describe, expect, it } from 'vitest';
import { dialKey, dialPad } from './dialKey';

describe('C-137: the portal gun’s dial, by key', () => {
  it('moves with the arrows (or W and S), held down or not', () => {
    for (const repeat of [false, true]) {
      for (const key of ['ArrowDown', 's', 'S']) expect(dialKey({ key, repeat }), key).toBe('down');
      for (const key of ['ArrowUp', 'w', 'W']) expect(dialKey({ key, repeat }), key).toBe('up');
    }
  });

  it('picks with Enter or E, and closes with Esc, pressed', () => {
    for (const key of ['Enter', 'e', 'E']) expect(dialKey({ key }), key).toBe('pick');
    expect(dialKey({ key: 'Escape' })).toBe('close');
  });

  it('ignores Enter, E and Esc held down (from opening it), but keeps them from the page', () => {
    for (const key of ['Enter', 'e', 'E', 'Escape']) expect(dialKey({ key, repeat: true }), key).toBe('ignore');
  });

  it('leaves every other key to the page', () => {
    for (const key of ['p', 'P', 'a', 'd', 'ArrowLeft', ' ', 'Tab', 'm']) expect(dialKey({ key }), key).toBeNull();
  });

  it('turns with a controller’s d-pad or stick, sets with A and puts the gun down with B, on presses, as the keys do', () => {
    const up = { a: false, b: false, up: false, down: false, ly: 0 };
    expect(dialPad({ ...up, down: true }, up)).toEqual(['ArrowDown']);
    expect(dialPad({ ...up, up: true }, up)).toEqual(['ArrowUp']);
    expect(dialPad({ ...up, ly: 0.8 }, up)).toEqual(['ArrowDown']);
    expect(dialPad({ ...up, ly: -0.8 }, up)).toEqual(['ArrowUp']);
    expect(dialPad({ ...up, a: true }, up)).toEqual(['Enter']);
    expect(dialPad({ ...up, b: true }, up)).toEqual(['Escape']);
    // (held, or a stick still over: nothing more)
    expect(dialPad({ ...up, a: true }, { ...up, a: true })).toEqual([]);
    expect(dialPad({ ...up, ly: 0.8 }, { ...up, ly: 0.9 })).toEqual([]);
    expect(dialPad(null, up)).toEqual([]);
    for (const key of ['ArrowDown', 'ArrowUp', 'Enter', 'Escape']) expect(dialKey({ key }), key).not.toBeNull();
  });
});
