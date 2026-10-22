import { afterEach, describe, expect, it, vi } from 'vitest';
import { SLOW_RATE, WAIT_MS, assetUrl, forgetDown, hereUrl, isDown, markDown, waitFor, withFallback } from './assetBase';

const BASE = 'https://x.supabase.co/storage/v1/object/public/assets';
const manifest = { 'kit/crate.glb': { hash: 'aaaaaaaaaaaa', bytes: 70000 }, 'hq/tex/rock.jpg': { hash: 'bbbbbbbbbbbb', bytes: 90000 } };
const opts = { base: BASE, manifest };

afterEach(() => forgetDown());

describe('the asset base', () => {
  it('sends a path the bucket holds to the bucket, by its hash', () => {
    expect(assetUrl('/kit/crate.glb', opts)).toBe(`${BASE}/aaaaaaaaaaaa/kit/crate.glb`);
    expect(assetUrl('hq/tex/rock.jpg', { ...opts, base: `${BASE}/` })).toBe(`${BASE}/bbbbbbbbbbbb/hq/tex/rock.jpg`);
  });

  it('leaves every other path as it was, byte for byte', () => {
    expect(assetUrl('/kit/other.glb', opts)).toBe('/kit/other.glb');
    expect(assetUrl('/kit/crate.glb?v=2', opts)).toBe('/kit/crate.glb?v=2');
    expect(assetUrl('https://elsewhere.test/kit/crate.glb', opts)).toBe('https://elsewhere.test/kit/crate.glb');
    expect(assetUrl('/kit/crate.glb', { ...opts, base: '' })).toBe('/kit/crate.glb');
    expect(assetUrl('/kit/crate.glb', { ...opts, base: undefined })).toBe('/kit/crate.glb');
  });

  it('with no base in the build, asks nothing remote', () => {
    vi.stubEnv('VITE_ASSET_BASE', '');
    expect(assetUrl('/kit/crate.glb', { manifest })).toBe('/kit/crate.glb');
    vi.unstubAllEnvs();
  });

  it('after one failure, sends every path local for the rest of the visit', () => {
    expect(isDown()).toBe(false);
    markDown();
    expect(isDown()).toBe(true);
    expect(assetUrl('/kit/crate.glb', opts)).toBe('/kit/crate.glb');
  });

  it('falls back to the local file once when the bucket fails, and remembers', async () => {
    const asked = [];
    const load = withFallback((url) => {
      asked.push(url);
      return url.startsWith('https:') ? Promise.reject(new Error('blocked')) : Promise.resolve(`bytes of ${url}`);
    }, opts);
    await expect(load('/kit/crate.glb')).resolves.toBe('bytes of /kit/crate.glb');
    expect(asked).toEqual([`${BASE}/aaaaaaaaaaaa/kit/crate.glb`, '/kit/crate.glb']);
    expect(isDown()).toBe(true);
    await load('/hq/tex/rock.jpg');
    expect(asked.slice(2)).toEqual(['/hq/tex/rock.jpg']);
  });

  it('asks the local file alone for a path the bucket lacks, and a local failure stays a failure', async () => {
    const fail = vi.fn(() => Promise.reject(new Error('404')));
    await expect(withFallback(fail, opts)('/kit/other.glb')).rejects.toThrow('404');
    expect(fail).toHaveBeenCalledTimes(1);
    expect(isDown()).toBe(false);
  });

  it('a bucket that works is used again', async () => {
    const load = withFallback((url) => Promise.resolve(url), opts);
    await load('/kit/crate.glb');
    expect(await load('/hq/tex/rock.jpg')).toBe(`${BASE}/bbbbbbbbbbbb/hq/tex/rock.jpg`);
    expect(isDown()).toBe(false);
  });

  it('gives up on a bucket that never answers, before it has answered once, and goes local', async () => {
    const asked = [];
    const load = withFallback((url) => {
      asked.push(url);
      return url.startsWith('https:') ? new Promise(() => {}) : Promise.resolve(`bytes of ${url}`);
    }, { ...opts, wait: 20 });
    await expect(load('/kit/crate.glb')).resolves.toBe('bytes of /kit/crate.glb');
    expect(isDown()).toBe(true);
  });

  it('once the bucket has answered, waits for a big file as long as it takes', async () => {
    const slow = (url) => new Promise((r) => setTimeout(() => r(url), url.includes('rock') ? 60 : 0));
    const load = withFallback(slow, { ...opts, wait: 20 });
    await load('/kit/crate.glb');
    expect(await load('/hq/tex/rock.jpg')).toBe(`${BASE}/bbbbbbbbbbbb/hq/tex/rock.jpg`);
    expect(isDown()).toBe(false);
  });

  it('sends a file the bucket lacks (a 404) to the site, and keeps the bucket for the rest', async () => {
    const asked = [];
    const load = withFallback((url) => {
      asked.push(url);
      return url.includes('crate') && url.startsWith('https:') ? Promise.reject(Object.assign(new Error('404'), { status: 404, missing: true })) : Promise.resolve(url);
    }, opts);
    expect(await load('/kit/crate.glb')).toBe('/kit/crate.glb');
    expect(isDown()).toBe(false);
    expect(await load('/hq/tex/rock.jpg')).toBe(`${BASE}/bbbbbbbbbbbb/hq/tex/rock.jpg`);
  });

  // (Kamino's pack, 2026-10-21: one 429 among a level's first ninety files
  // marked the bucket down, and every cell after was asked of a site that
  // has no copy: no platforms, and Luke through the sea)
  it('asks a busy bucket (a 429) again after a wait, and keeps it', async () => {
    const asked = [];
    let busy = 2;
    const load = withFallback((url) => {
      asked.push(url);
      return url.startsWith('https:') && busy-- > 0 ? Promise.reject(Object.assign(new Error('429'), { status: 429 })) : Promise.resolve(url);
    }, { ...opts, waits: [0, 0, 0] });
    expect(await load('/kit/crate.glb')).toBe(`${BASE}/aaaaaaaaaaaa/kit/crate.glb`);
    expect(asked).toEqual(Array(3).fill(`${BASE}/aaaaaaaaaaaa/kit/crate.glb`));
    expect(isDown()).toBe(false);
  });

  it('sends one file busy past its asks to the site alone, the bucket kept for the rest', async () => {
    const asked = [];
    const load = withFallback((url) => {
      asked.push(url);
      // (three's loaders reject with the response: an HttpError's `response.status`)
      return url.startsWith('https:') && url.includes('crate') ? Promise.reject(Object.assign(new Error('busy'), { response: { status: 503 } })) : Promise.resolve(url);
    }, { ...opts, waits: [0, 0] });
    expect(await load('/kit/crate.glb')).toBe('/kit/crate.glb');
    expect(asked.filter((u) => u.startsWith('https:'))).toHaveLength(3);
    expect(isDown()).toBe(false);
    expect(await load('/hq/tex/rock.jpg')).toBe(`${BASE}/bbbbbbbbbbbb/hq/tex/rock.jpg`);
  });

  it('passes an abort on, asking nothing local and marking nothing down', async () => {
    const asked = [];
    const load = withFallback((url) => {
      asked.push(url);
      return Promise.reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
    }, opts);
    await expect(load('/kit/crate.glb')).rejects.toMatchObject({ name: 'AbortError' });
    expect(asked).toEqual([`${BASE}/aaaaaaaaaaaa/kit/crate.glb`]);
    expect(isDown()).toBe(false);
  });
});

// (lane S1: the Star Destroyer's 21.6 MB ultra cut asked first took longer
// than 12 s in a cloud container, and a healthy bucket was marked down)
describe('the wait for the bucket’s first answer', () => {
  it('is 12 s for a small file, and a slow link’s time for a big one', () => {
    expect(waitFor(null)).toBe(WAIT_MS);
    expect(waitFor(1e6)).toBe(WAIT_MS);
    expect(SLOW_RATE).toBe(0.5e6);
    expect(waitFor(21.6e6)).toBeCloseTo(43200, 0);
  });
});


describe('the site’s own copies under their hash (scripts/site-hashes.mjs)', () => {
  const site = { 'textures/universe/earth.webp': 'cccccccccccc', 'kit/crate.glb': 'dddddddddddd' };

  it('names the hashed path of a picture the site holds so, and nothing for anything else', () => {
    expect(hereUrl('/textures/universe/earth.webp', { site })).toBe('/h/cccccccccccc/textures/universe/earth.webp');
    expect(hereUrl('textures/universe/earth.webp', { site })).toBe('/h/cccccccccccc/textures/universe/earth.webp');
    expect(hereUrl('/textures/universe/moon.webp', { site })).toBeNull();
    expect(hereUrl('/textures/universe/earth.webp?v=2', { site })).toBeNull();
    expect(hereUrl('https://elsewhere.test/textures/universe/earth.webp', { site })).toBeNull();
    expect(hereUrl('/textures/universe/earth.webp')).toBeNull(); // (the committed hashes are none: the build fills them)
  });

  it('asks the hashed path first, the bucket before it for what the bucket holds', async () => {
    const asked = [];
    const load = withFallback((url) => (asked.push(url), Promise.resolve(url)), { ...opts, site });
    expect(await load('/textures/universe/earth.webp')).toBe('/h/cccccccccccc/textures/universe/earth.webp');
    expect(await load('/kit/crate.glb')).toBe(`${BASE}/aaaaaaaaaaaa/kit/crate.glb`);
    expect(asked).toEqual(['/h/cccccccccccc/textures/universe/earth.webp', `${BASE}/aaaaaaaaaaaa/kit/crate.glb`]);
  });

  it('falls back to the picture’s own path once its hashed one fails, and the bucket stays up', async () => {
    const asked = [];
    const load = withFallback((url) => (asked.push(url), url.startsWith('/h/') ? Promise.reject(new Error('404')) : Promise.resolve(`bytes of ${url}`)), { ...opts, site });
    await expect(load('/textures/universe/earth.webp')).resolves.toBe('bytes of /textures/universe/earth.webp');
    expect(asked).toEqual(['/h/cccccccccccc/textures/universe/earth.webp', '/textures/universe/earth.webp']);
    expect(isDown()).toBe(false);
  });

  it('stops for a world left mid-load, with no second ask', async () => {
    const abort = Object.assign(new Error('left'), { name: 'AbortError' });
    const load = vi.fn(() => Promise.reject(abort));
    await expect(withFallback(load, { ...opts, site })('/textures/universe/earth.webp')).rejects.toBe(abort);
    expect(load).toHaveBeenCalledTimes(1);
  });
});
