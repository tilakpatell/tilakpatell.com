import { describe, expect, test } from 'vitest';
import * as lib from './brainLib';

describe('the brain’s module, as the adapter takes it', () => {
  test('has the brain, the navgrid, the soldier, the difficulty and the clock the adapter calls', () => {
    for (const name of ['createBrain', 'think', 'act', 'difficultyFor', 'buildNav', 'heightAt', 'shields', 'walkable', 'newSoldier', 'aiRows', 'classOf']) expect(typeof lib[name], name).toBe('function');
    expect(lib.STEP).toBeGreaterThan(0);
    expect(lib.THINK).toBeGreaterThan(lib.STEP);
  });
  test('reads the game’s AI rows and classes from the rulebook', () => {
    const ai = lib.aiRows();
    expect(ai.templates.rifleman.tactics).toBe('Rifleman_Tactics');
    expect(lib.classOf('d-orig-assault').health).toBe(150);
  });
});
