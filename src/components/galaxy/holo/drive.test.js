import { describe, expect, it, vi } from 'vitest';
import { createHoloDriver } from './drive';

// (the scene stood in for: what the driver hands it, and what it hands the post)
const framed = [];
vi.mock('./holoScene', () => ({
  createHoloScene: () => ({
    scene: 'holo-scene',
    camera: 'holo-camera',
    frame: (dt, now, link, size, ratio) => (framed.push({ dt, size, ratio }), true),
    dispose: () => {},
  }),
}));

// a post chain's calls, as the galaxy's (../../universe/post.js): its sharpness, the ratio that follows it, its moment's effects
function fakePost(full = 1.5) {
  const post = {
    sharpness: 0.6,
    drawnAt: [],
    calls: [],
    get ratio() {
      return Math.max(0.6, full * this.sharpness);
    },
    view: (s, c) => post.calls.push(['view', s, c]),
    overlay: (s) => post.calls.push(['overlay', s]),
    rush: (k) => post.calls.push(['rush', k]),
    hit: (k) => post.calls.push(['hit', k]),
    flare: (k) => post.calls.push(['flare', k]),
    render: () => post.drawnAt.push(post.sharpness),
  };
  return post;
}

describe('the holotable’s driver', () => {
  it('draws the map at the whole sharpness, whatever the flight’s pace softened it to, and gives the flight back its own', async () => {
    const post = fakePost();
    let woken = 0;
    const holo = createHoloDriver({ post, invalidate: () => woken++ });
    const link = { open: true };
    // (the first frame loads the scene, and the flight draws meanwhile)
    expect(holo.frame(16, 0, link, { w: 800, h: 600 })).toBeNull();
    await vi.waitFor(() => expect(woken).toBeGreaterThan(0));
    expect(holo.frame(16, 16, link, { w: 800, h: 600 })).toBe(true);
    expect(post.drawnAt).toEqual([1]);
    expect(framed.at(-1).ratio).toBe(1.5);
    expect(post.sharpness).toBe(0.6);
    // (none of the flight's moment on the map: its boost's rush, a hit's red edge, a flare)
    expect(post.calls).toEqual(expect.arrayContaining([['view', 'holo-scene', 'holo-camera'], ['rush', 0], ['hit', 0], ['flare', 1]]));
    // shut, the flight's drawn again in its own place
    expect(holo.frame(16, 32, { open: false }, { w: 800, h: 600 })).toBeNull();
    expect(post.calls.at(-1)).toEqual(['view', null, undefined]);
  });
});
