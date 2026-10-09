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

describe('the worlds’ conversations, said in their speakers’ voices', () => {
  it('know each speaker’s voice, and that a narrator has none', async () => {
    const { voiceOf } = await import('./voiced');
    expect(voiceOf('gandalf')).toBe('gandalf');
    expect(voiceOf('strider')).toBe('aragorn');
    expect(voiceOf('councilb')).toBe('rick');
    expect(voiceOf('evilmorty')).toBe('morty');
    expect(voiceOf('narrator')).toBeNull();
    expect(voiceOf('caller')).toBeNull();
    expect(voiceOf(undefined)).toBeNull();
  });
  it('say aloud only what’s in quotes when a line mixes them with narration', async () => {
    const { spoken } = await import('./voiced');
    expect(spoken('Footsteps on the stair. Aragorn. “Frodo?” You back away. “It has taken Boromir.”')).toBe('Frodo? It has taken Boromir.');
    expect(spoken('“Why do you shrink from me? I am no thief.”')).toBe('Why do you shrink from me? I am no thief.');
    expect(spoken('Thank you thank you thank you. Just put them through.')).toBe('Thank you thank you thank you. Just put them through.');
  });
  it('play a line in its speaker’s voice, one at a time, and stop it when asked', async () => {
    const { lineId } = await import('./voiced');
    const say = 'Footsteps. “It has taken Boromir.”';
    const id = lineId('aragorn', say);
    const later = lineId('aragorn', 'Not now.');
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ lines: { [id]: `aragorn/${id}.mp3`, [later]: `aragorn/${later}.mp3` } }) })));
    const played = speaking();
    const { sayVoiced, stopVoiced } = await import('./voiced');
    const h = await sayVoiced('strider', say);
    expect(h.src).toBe(`/audio/voiced/aragorn/${id}.mp3`);
    expect(h.opts).toMatchObject({ voice: true, tag: 'voiced' });
    // a line that comes by itself waits its turn rather than talk over this one
    const next = sayVoiced('aragorn', 'Not now.');
    await new Promise((r) => setTimeout(r, 0));
    expect(h.stopped).toBe(false);
    expect(await sayVoiced('narrator', say)).toBeNull();
    stopVoiced();
    expect(h.stopped).toBe(true);
    await expect(next).resolves.toBeNull();
    expect(played).toHaveLength(1);
  });
  it('stop the line being said for one the visitor asked for, made or not', async () => {
    const { lineId } = await import('./voiced');
    const say = 'Footsteps. “It has taken Boromir.”';
    const id = lineId('aragorn', say);
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ lines: { [id]: `aragorn/${id}.mp3` } }) })));
    speaking();
    const { sayVoiced } = await import('./voiced');
    const h = await sayVoiced('strider', say);
    await sayVoiced('strider', 'Not made yet.', { mode: 'cut' });
    expect(h.stopped).toBe(true);
  });
  it('never start a line taken back before it was found', async () => {
    const { lineId } = await import('./voiced');
    const id = lineId('aragorn', 'Not now.');
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ lines: { [id]: `aragorn/${id}.mp3` } }) })));
    const played = speaking();
    const { sayVoiced } = await import('./voiced');
    const said = sayVoiced('aragorn', 'Not now.');
    said.stop();
    await expect(said).resolves.toBeNull();
    expect(played).toHaveLength(0);
  });
  it('say nothing, and fetch nothing, with the voices off', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    vi.stubGlobal('window', { localStorage: { getItem: (k) => (k === 'tp-voices' ? 'off' : null) }, addEventListener() {} });
    const played = speaking();
    const { sayVoiced } = await import('./voiced');
    await expect(sayVoiced('aragorn', 'Not now.')).resolves.toBeNull();
    expect(fetch).not.toHaveBeenCalled();
    expect(played).toHaveLength(0);
  });
  it('look for the lines again after a manifest that didn’t come', async () => {
    vi.useFakeTimers();
    const { lineId, voicedSrc } = await import('./voiced');
    const id = lineId('han', 'Punch it.');
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('offline'))));
    await expect(voicedSrc('han', 'Punch it.')).resolves.toBeNull();
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ lines: { [id]: `han/${id}.mp3` } }) })));
    await expect(voicedSrc('han', 'Punch it.')).resolves.toBeNull(); // not straight away
    await vi.advanceTimersByTimeAsync(10_001);
    await expect(voicedSrc('han', 'Punch it.')).resolves.toBe(`/audio/voiced/han/${id}.mp3`);
    vi.useRealTimers();
  });
});

// lib/clips' playFile as far as the floor (lib/speech.js), with lines that
// play until they're stopped
function speaking() {
  const played = [];
  vi.doMock('./clips', async () => {
    const { speech } = await import('./speech');
    return {
      playFile: (src, opts) =>
        speech.say(
          src,
          async (alive) => {
            if (!alive()) return null;
            let end;
            const h = { src, opts, stopped: false, ended: new Promise((r) => (end = r)), stop() { h.stopped = true; end(); } };
            played.push(h);
            return h;
          },
          opts,
        ),
    };
  });
  return played;
}

describe('lines that are only an aside', () => {
  it('say nothing of what’s in brackets (the beeps, the gestures)', async () => {
    const { spoken, voiceOf } = await import('./voiced');
    expect(spoken('(A run of beeps and whirs: he says the kids are at school.)')).toBe('');
    expect(spoken('Hulk smash! (He grins.)')).toBe('Hulk smash!');
    expect(voiceOf('bot')).toBeNull();
    expect(voiceOf('bee')).toBeNull();
  });
});
