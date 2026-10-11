import { describe, expect, it } from 'vitest';
import * as fall from './fall.js';
import * as ragdolls from './ragdolls.js';
import * as libFall from '../../../lib/combat/fall.js';
import * as libRagdolls from '../../../lib/three/ragdolls2017.js';

// (the fallen's rules and drawing are lib's now: the names here are kept, the same things)
describe('the Battlefront world’s fallen, from lib', () => {
  it('keeps every name, each lib’s own', () => {
    for (const k of Object.keys(libFall)) expect(fall[k]).toBe(libFall[k]);
    for (const k of Object.keys(libRagdolls)) expect(ragdolls[k]).toBe(libRagdolls[k]);
  });
});
