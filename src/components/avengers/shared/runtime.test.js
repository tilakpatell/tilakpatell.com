import { describe, expect, it } from 'vitest';
import * as runtime from './runtime';

// The HQ's face: exactly these names and nothing else, so a world that
// reads the HQ through it knows what it may lean on
describe('avengers/shared', () => {
  it('lends exactly the module wrap and the page’s hooks', () => {
    const names = ['drawOnce', 'hqModule', 'register', 'useStage', 'useStageFrame'];
    expect(Object.keys(runtime).sort()).toEqual(names);
    for (const n of names) expect(typeof runtime[n]).toBe('function');
  });
});
