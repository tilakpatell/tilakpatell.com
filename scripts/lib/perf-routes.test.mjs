import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { HEAVY } from './perf-routes.mjs';

const app = readFileSync(new URL('../../src/App.jsx', import.meta.url), 'utf8');
const probe = readFileSync(new URL('../perf-probe.mjs', import.meta.url), 'utf8');

// a <Route path> as a pattern: ':x' one segment, ':x?' one or none (the
// catch-all '*' left out: it matches anything)
const patterns = [...app.matchAll(/<Route path="(\/[^"]*)"/g)].map(([, p]) => new RegExp(`^${p.replace(/\/:[\w]+\?/g, '(?:/[^/]+)?').replace(/\/:[\w]+/g, '/[^/]+')}$`));

describe('the heavy worlds the probe measures (lane P0)', () => {
  // (the lanes’ /galaxy/hoth/surface is Battlefront’s Hoth now, measured once)
  it('are the ones the performance lanes name, in their order', () => {
    expect(HEAVY.map((h) => h.route)).toEqual(['/battlefront/hoth', '/galaxy/tatooine', '/fly/hoth', '/universe', '/middle-earth', '/c-137', '/avengers', '/deathstar', '/deathstar/inside']);
  });

  it('are each a route the site has', () => {
    for (const { route } of HEAVY) expect(patterns.some((p) => p.test(route)), route).toBe(true);
  });

  it('are each a journey the probe knows', () => {
    for (const { journey } of HEAVY) expect(new RegExp(`\\n  (async )?${journey}[:(]`).test(probe), journey).toBe(true);
  });
});
