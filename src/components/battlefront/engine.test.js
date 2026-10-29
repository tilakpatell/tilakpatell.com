import { describe, expect, it } from 'vitest';
import { engineOnly, engineUrl } from './engine.js';

const play = { build: 'b1', site: 'sites/b1/', mb: 2197 };
const able = { ok: true, missing: [] };
const unable = { ok: false, missing: ['no WebGPU'] };

describe('the engine’s address', () => {
  it('names the play site’s build, with the way back, and none while no build is published', () => {
    expect(engineUrl(play)).toBe('/battlefront/engine/b1/');
    expect(engineUrl(play, { to: '/galaxy/hoth' })).toBe('/battlefront/engine/b1/?from=%2Fgalaxy%2Fhoth');
    expect(engineUrl({ build: null, site: null })).toBeNull();
  });
});

describe('Battlefront is the engine only', () => {
  it('goes to the engine where the browser can run it, with the way back', () => {
    expect(engineOnly({ level: 'hoth', play, support: able })).toEqual({ go: '/battlefront/engine/b1/' });
    expect(engineOnly({ play, support: able, back: { to: '/galaxy/hoth' } })).toEqual({ go: '/battlefront/engine/b1/?from=%2Fgalaxy%2Fhoth' });
  });

  it('waits while the GPU is being asked, then names what is missing instead of another world', () => {
    expect(engineOnly({ level: 'hoth', play, support: null })).toEqual({ wait: true });
    expect(engineOnly({ level: 'hoth', play, support: unable })).toEqual({ unavailable: ['no WebGPU'] });
    expect(engineOnly({ level: 'endor', play, support: able }).unavailable[0]).toMatch(/endor/);
    expect(engineOnly({ level: 'hoth', play: { build: null, site: null }, support: able }).unavailable).toHaveLength(1);
  });
});
