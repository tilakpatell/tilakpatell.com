import { describe, expect, it } from 'vitest';
import { engineOnly, engineUrl, playOn } from './engine.js';

const play = { build: 'b1', site: 'sites/b1/', mb: 2197 };
const able = { ok: true, missing: [] };
const unable = { ok: false, missing: ['no WebGPU'] };

describe('where Hoth is played', () => {
  it('asks a browser that can run the engine first, with what it would download', () => {
    expect(playOn({ level: 'hoth', play, support: able })).toEqual({ ask: { url: '/battlefront/engine/b1/', mb: 2197 } });
  });

  it('goes, or stays, as the visitor said before', () => {
    expect(playOn({ level: 'hoth', play, support: able, choice: 'engine' })).toEqual({ go: '/battlefront/engine/b1/' });
    expect(playOn({ level: 'hoth', play, support: able, choice: 'site' })).toBeNull();
  });

  it('keeps the site’s world for a browser that can’t, a level bf2-web hasn’t got, or no build', () => {
    expect(playOn({ level: 'hoth', play, support: unable, choice: 'engine' })).toBeNull();
    expect(playOn({ level: 'endor', play, support: able })).toBeNull();
    expect(playOn({ level: 'hoth', play: { build: null, site: null }, support: able })).toBeNull();
    expect(engineUrl({ build: null })).toBeNull();
  });

  it('waits while the browser’s GPU is being asked, unless the answer can’t matter', () => {
    expect(playOn({ level: 'hoth', play, support: null })).toEqual({ wait: true });
    expect(playOn({ level: 'hoth', play, support: null, choice: 'site' })).toBeNull();
    expect(playOn({ level: 'hoth', play, support: null, search: '?engine=0' })).toBeNull();
    expect(playOn({ level: 'endor', play, support: null })).toBeNull();
  });

  it('carries the way back to the engine’s page', () => {
    const back = { label: 'Back to Hoth', to: '/galaxy/hoth' };
    expect(playOn({ level: 'hoth', play, support: able, choice: 'engine', back })).toEqual({ go: '/battlefront/engine/b1/?from=%2Fgalaxy%2Fhoth' });
    expect(engineUrl(play, null)).toBe('/battlefront/engine/b1/');
  });

  it('lets the address choose', () => {
    expect(playOn({ level: 'hoth', play, support: able, search: '?engine=0', choice: 'engine' })).toBeNull();
    expect(playOn({ level: 'hoth', play, support: unable, search: '?from=/galaxy/hoth&engine=1' })).toEqual({ go: '/battlefront/engine/b1/' });
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
