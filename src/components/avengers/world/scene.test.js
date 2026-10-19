import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';

const here = (p) => new URL(p, import.meta.url);
const read = (p) => readFileSync(here(p), 'utf8');
const lines = (p) => read(p).split('\n').length;
const code = (p) => read(p).replace(/\/\/.*$/gm, ''); // (comments left out)
const PARTS = ['doors.js', 'fx.js', 'kit.js', 'terrain.js'];

describe('world/scene.js and its parts', () => {
  it('keeps scene.js under the 1,500 lines the measure counts, and each part under 800', () => {
    expect(lines('./scene.js')).toBeLessThan(1500);
    const parts = readdirSync(here('./scene/')).filter((f) => f.endsWith('.js') && !f.endsWith('.test.js')).sort();
    expect(parts).toEqual(PARTS);
    expect(parts.filter((f) => lines(`./scene/${f}`) >= 800)).toEqual([]);
  });

  it('still lends createCompoundWorld and nothing else (./module.js imports it)', () => {
    expect(read('./scene.js').match(/^export\b.*$/gm)).toEqual(['export async function createCompoundWorld(rt, { calm = false } = {}) {']);
  });

  it('has parts that never reach back into scene.js', () => {
    expect(PARTS.filter((f) => /from '\.\.\/scene'/.test(code(`./scene/${f}`)))).toEqual([]);
  });
});
