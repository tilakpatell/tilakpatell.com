import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO } from './lib.mjs';
import { horizonArgs, packs, spec } from './bf2017-horizon.mjs';

// a checkout with three packs: a surface, an interior and a space level
function checkout() {
  const root = mkdtempSync(join(tmpdir(), 'bf2017-horizon-'));
  const put = (path, json) => {
    mkdirSync(join(root, 'public/models/galaxy/bf2017/levels', path), { recursive: true });
    writeFileSync(join(root, 'public/models/galaxy/bf2017/levels', path, 'level.json'), JSON.stringify(json));
  };
  const hoth = JSON.parse(readFileSync(join(REPO, 'public/models/galaxy/bf2017/levels/hoth/level.json'), 'utf8'));
  put('hoth', hoth);
  put('hoth/base', { ...hoth, inside: true });
  put('sb_endor', { ...hoth, terrain: null });
  return root;
}

describe('the horizon job (lane N4’s coarse grid at full quality)', () => {
  it('takes the surface packs, not the interiors or the space levels', () => {
    const list = packs(checkout());
    expect(list.map((p) => p.name)).toEqual(['hoth']);
    // (the arena's 16 cells: the horizon's are placed in the run, from horizon.bin)
    expect(list[0].cells).toBe(16);
    expect(list[0].impostors).toBeGreaterThan(0);
  });

  it('bakes on the graphics chip, through the desktop’s Chrome', () => {
    const { env } = horizonArgs('hoth', { chrome: 'C:/Chrome/chrome.exe' }, { PATH: 'x' });
    expect(env).toMatchObject({ ANGLE: 'd3d11', CHROMIUM: 'C:/Chrome/chrome.exe', PATH: 'x' });
    expect(horizonArgs('endor', { chrome: 'c' }, {}).argv).toEqual(['scripts/bf2017-horizon.mjs', 'endor']);
  });

  it('needs the bucket’s keys and Chrome, and names what it changes', () => {
    const needs = spec.needs({ chrome: 'chrome' });
    expect(needs.some((n) => n.keys)).toBe(true);
    expect(needs.some((n) => /Chrome/.test(n.name))).toBe(true);
    expect(spec.job).toBe('horizon');
  });

  it('is offered by the workflow, outside `all` (a bake is long)', () => {
    const yml = readFileSync(join(REPO, '.github/workflows/bf2017-desktop.yml'), 'utf8');
    expect(yml).toMatch(/options: \[[^\]]*\bhorizon\b[^\]]*\]/);
    expect(yml).toMatch(/@\('panoramas', 'atlases', 'textures', 'uastc', 'depots', 'gate'\)/);
  });
});
