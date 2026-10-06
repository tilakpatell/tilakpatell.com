import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('the lines made in the crews’ voices', () => {
  it('give each line from each speaker its own steady id', async () => {
    const { lineId } = await import('./voiced');
    expect(lineId('walt', 'Jesse.')).toBe(lineId('walt', 'Jesse.'));
    expect(lineId('walt', 'Jesse.')).not.toBe(lineId('jesse', 'Jesse.'));
    expect(lineId('walt', 'Jesse.')).not.toBe(lineId('walt', 'Jesse!'));
    expect(lineId('rick', 'Morty’s fine.')).toMatch(/^[0-9a-f]{8}$/);
  });
  it('find a line’s file in the manifest', async () => {
    const { lineId, voicedSrc } = await import('./voiced');
    const id = lineId('han', 'Punch it.');
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ lines: { [id]: `han/${id}.mp3` } }) })));
    await expect(voicedSrc('han', 'Punch it.')).resolves.toBe(`/audio/voiced/han/${id}.mp3`);
    await expect(voicedSrc('han', 'Chewie, we’re home.')).resolves.toBeNull();
  });
  it('leave every line to the blips when there is no manifest, or the page is not one', async () => {
    const { voicedSrc } = await import('./voiced');
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => Promise.reject(new SyntaxError('<!doctype html>')) })));
    await expect(voicedSrc('han', 'Punch it.')).resolves.toBeNull();
  });
});
