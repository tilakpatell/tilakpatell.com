import { describe, expect, it } from 'vitest';
import { apply, createStack, remove, resolve, tick } from './affectors.js';

describe('the affector stack', () => {
  it('multiplies then adds, and a set wins', () => {
    const s = createStack();
    apply(s, { id: 'card', property: 'health', op: 'mul', value: 1.2 });
    apply(s, { id: 'perk', property: 'health', op: 'add', value: 10 });
    expect(resolve(s, 'health', 150)).toBe(190);
    expect(resolve(s, 'speed', 4)).toBe(4);
    apply(s, { id: 'armour', property: 'health', op: 'set', value: 800 });
    expect(resolve(s, 'health', 150)).toBe(800);
    remove(s, 'armour');
    expect(resolve(s, 'health', 150)).toBe(190);
  });

  it('replaces an entry by id and drops one whose time is up', () => {
    const s = createStack();
    apply(s, { id: 'boost', property: 'speed', op: 'mul', value: 2, until: 5 });
    apply(s, { id: 'boost', property: 'speed', op: 'mul', value: 1.5, until: 5 });
    expect(resolve(s, 'speed', 4)).toBe(6);
    tick(s, 4.9);
    expect(resolve(s, 'speed', 4)).toBe(6);
    tick(s, 5);
    expect(resolve(s, 'speed', 4)).toBe(4);
  });
});
