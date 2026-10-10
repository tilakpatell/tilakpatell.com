import { afterEach, describe, expect, it } from 'vitest';
import { FILMS, videoLook } from './capitalFilm';

const stand = () => ({ play: () => Promise.resolve(), pause() {}, removeAttribute() {}, addEventListener() {}, requestVideoFrameCallback() {}, cancelVideoFrameCallback() {} });

describe('the game’s films of a capital’s death and the Death Star’s end', () => {
  const was = { ...FILMS['capital.death'] };
  afterEach(() => Object.assign(FILMS['capital.death'], was));

  it('answers null until the film is published: the blast is the site’s own flash', () => {
    expect(videoLook('capital.death')).toBe(null);
    expect(videoLook('deathstar.end')).toBe(null);
    expect(videoLook('nothing')).toBe(null);
  });

  it('once published, a video texture on high and ultra, never on mid or low', () => {
    FILMS['capital.death'].published = true;
    let asked = null;
    const make = (url) => ((asked = url), stand());
    expect(videoLook('capital.death', { detail: 'mid', make })).toBe(null);
    const look = videoLook('capital.death', { detail: 'ultra', make });
    expect(look.texture.isVideoTexture).toBe(true);
    expect(asked).toMatch(/capital-death\.webm$/);
    look.dispose();
  });
});
