import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { bodyFrom } from '../../../lib/ai/body';
import { MODE_BODY_CY } from './bodies';
import { ACTIONS } from './tactics';

// every state rules.js and tactics.js write on a Decepticon, read off their source (so a
// new one can't slip by); the rest are the actor's, an ACTIONS id
const written = () => {
  const src = readFileSync(new URL('./rules.js', import.meta.url), 'utf8') + readFileSync(new URL('./tactics.js', import.meta.url), 'utf8');
  return [...new Set([...src.matchAll(/\bstate(?: = (?:e\.actor\.current\(\) \?\? )?|: )'([a-z]+)'/g)].map((m) => m[1]))];
};

describe('the Decepticons’ bodies', () => {
  it('has a row for every action and every state the rules write', () => {
    for (const id of Object.keys(ACTIONS)) expect(MODE_BODY_CY[id], id).toBeTruthy();
    const states = written();
    expect(states).toEqual(expect.arrayContaining(['advance', 'shift', 'charge', 'dead', 'hold']));
    for (const s of states) expect(MODE_BODY_CY[s], s).toBeTruthy();
  });

  it('crouches in cover and rises to fire; looks down its aim as it advances', () => {
    const at = { x: 0, z: 0, yaw: 0 };
    expect(bodyFrom(at, { ...at, mode: 'cover' }, 0.1, { table: MODE_BODY_CY }).base).toBe('crouch');
    expect(bodyFrom(at, { ...at, mode: 'cover', fire: true }, 0.1, { table: MODE_BODY_CY }).base).toBe(null);
    const b = bodyFrom(at, { x: 0, z: 0.6, yaw: 0, mode: 'advance', aim: { x: 5, z: 20 } }, 0.1, { table: MODE_BODY_CY });
    expect(b.look).toEqual({ x: 5, z: 20 });
    expect(b.motion.speed).toBeCloseTo(6);
  });
});
