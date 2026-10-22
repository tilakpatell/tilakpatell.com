import { describe, expect, it } from 'vitest';
import { LIMITS, THREE_G, WIFI, asks, failures, lowerCuts } from './stream-check.mjs';

const good = { firstFigureMs: 5000, walkableMB: 3.2, mostAsks: 1, mostAsked: '/a', errors: [], lower: [] };

describe('the stream check’s numbers', () => {
  it('holds a laptop on wifi to fidelity, and a phone on 3G to the plan’s numbers', () => {
    expect(LIMITS.laptop).toMatchObject({ mostAsks: 1, errors: 0, fidelity: true });
    expect(LIMITS.phone).toMatchObject({ firstFigureMs: 8000, walkableMB: 4, mostAsks: 3 });
    expect(WIFI).toMatchObject({ latency: 20, downloadThroughput: 6250000 });
    expect(THREE_G).toMatchObject({ latency: 150, downloadThroughput: 200000 });
  });

  it('finds a model fetched below its best: the plain where an ultra cut exists, or any lod1, the bucket’s by their site path', () => {
    const ultra = new Set(['/models/galaxy/surface/atat.ultra.glb']);
    const urls = [
      'http://s/models/galaxy/surface/atat.glb',
      'http://s/models/galaxy/surface/atat.ultra.glb',
      'http://s/models/galaxy/surface/crate.glb',
      'https://p.supabase.co/storage/v1/object/public/site-assets/abcdef123456/models/galaxy/crew/luke.lod1.glb',
      'https://assets.tilakpatell.com/abcdef123456/models/galaxy/crew/rebel.lod1.glb',
    ];
    expect(lowerCuts(urls, ultra)).toEqual(['/models/galaxy/crew/luke.lod1.glb', '/models/galaxy/crew/rebel.lod1.glb', '/models/galaxy/surface/atat.glb']);
    expect(failures({ ...good, lower: ['/models/galaxy/surface/atat.glb'] })[0]).toMatch(/lower cut/);
    // (a phone may take the small cut)
    expect(failures({ ...good, lower: ['/x.lod1.glb'] }, LIMITS.phone)).toEqual([]);
  });

  it('passes a run within them, and names each number past them', () => {
    expect(failures(good)).toEqual([]);
    expect(failures({ ...good, firstFigureMs: 9100 })).toEqual(['the first figure took 9.1 s (at most 8)']);
    expect(failures({ ...good, firstFigureMs: null })).toEqual(['no figure was drawn']);
    expect(failures({ ...good, walkableMB: 4.5 }, LIMITS.phone)[0]).toMatch(/4\.50 MB/);
    expect(failures({ ...good, mostAsks: 2, mostAsked: '/x.glb' })[0]).toMatch(/\/x\.glb was asked 2 times \(at most 1\)/);
    expect(failures({ ...good, errors: ['console: boom'] })[0]).toMatch(/boom/);
  });

  it('counts the asks per URL, the page’s own blobs and data aside', () => {
    const a = asks(['/a', '/b', '/a', 'blob:x', 'blob:x', 'blob:x', 'blob:x', 'data:,', '/a']);
    expect(a.most).toBe(3);
    expect(a.which).toBe('/a');
  });
});
