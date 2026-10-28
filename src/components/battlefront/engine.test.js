import { describe, expect, it } from 'vitest';
import { engineUrl, playOn } from './engine.js';

const play = { build: 'b1', site: 'sites/b1/' };
const able = { ok: true, missing: [] };
const unable = { ok: false, missing: ['no WebGPU'] };

describe('where Hoth is played', () => {
  it('opens bf2-web’s play site for a browser that can run it', () => {
    expect(playOn({ level: 'hoth', play, support: able })).toBe('/battlefront/engine/b1/');
  });

  it('keeps the site’s world for a browser that can’t, a level bf2-web hasn’t got, or no build', () => {
    expect(playOn({ level: 'hoth', play, support: unable })).toBeNull();
    expect(playOn({ level: 'endor', play, support: able })).toBeNull();
    expect(playOn({ level: 'hoth', play: { build: null, site: null }, support: able })).toBeNull();
    expect(engineUrl({ build: null })).toBeNull();
  });

  it('lets the address choose', () => {
    expect(playOn({ level: 'hoth', play, support: able, search: '?engine=0' })).toBeNull();
    expect(playOn({ level: 'hoth', play, support: unable, search: '?from=/galaxy/hoth&engine=1' })).toBe('/battlefront/engine/b1/');
  });
});
