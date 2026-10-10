import { describe, expect, it } from 'vitest';
import { weaponClassOf } from '../../lib/three/walrusSets/stance';
import { GUNS } from './gunplay';

describe('the guns’ classes', () => {
  it('names every gun but the saber a class the stances know', () => {
    for (const kind of Object.keys(GUNS)) expect(weaponClassOf(kind), kind).toBe(kind === 'saber' ? null : weaponClassOf(kind) ?? 'none');
  });
});
