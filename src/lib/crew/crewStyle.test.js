import { describe, expect, it } from 'vitest';
import { CREW_KEY, CREW_VERSION, CREW_WHO, readCrew, registerCrew, seedFromHero, setStyle, styleOf } from './crewStyle';

describe('the crew’s style', () => {
  it('reads only the crew it knows, in shape', () => {
    const raw = { han: { skin: 'hanhoth', gun: 'rifle', x: 1 }, vader: { skin: 'vader' }, luke: { saber: { color: 'green', hilt: 'luke' } }, rick: 'junk' };
    const want = { han: { skin: 'hanhoth', gun: 'rifle' }, luke: { saber: { color: 'green', hilt: 'luke' } } };
    expect(readCrew(raw)).toEqual(want);
    expect(readCrew(JSON.stringify(raw))).toEqual(want);
    expect(readCrew('{not json')).toEqual({});
    expect(readCrew(null)).toEqual({});
    expect(readCrew([1, 2])).toEqual({});
  });
  it('drops a value that isn’t a short id', () => {
    expect(readCrew({ han: { skin: '', gun: 'x'.repeat(41) }, luke: { saber: { color: 'green' } } })).toEqual({});
    expect(readCrew({ chewie: { gun: 3, skin: 'chewiegoggles' } })).toEqual({ chewie: { skin: 'chewiegoggles' } });
  });
  it('sets and clears a field without touching the rest', () => {
    const was = { han: { skin: 'hanhoth', gun: 'rifle' } };
    expect(setStyle(was, 'han', { gun: null })).toEqual({ han: { skin: 'hanhoth' } });
    expect(was).toEqual({ han: { skin: 'hanhoth', gun: 'rifle' } });
    expect(setStyle({}, 'luke', { saber: { color: 'blue', hilt: 'skywalker' } })).toEqual({ luke: { saber: { color: 'blue', hilt: 'skywalker' } } });
    expect(setStyle(was, 'vader', { skin: 'vader' })).toEqual(was);
  });
  it('gives a crew member’s entry, or nothing', () => {
    expect(styleOf({ han: { skin: 'hanhoth' } }, 'han')).toEqual({ skin: 'hanhoth' });
    expect(styleOf({}, 'luke')).toEqual({});
  });
  it('seeds the picked hero from the galaxy’s choice, once', () => {
    const seeded = seedFromHero({}, { id: 'han', skin: 'hanhoth', gun: 'rifle', color: 'blue', hilt: 'skywalker' });
    expect(seeded).toEqual({ han: { skin: 'hanhoth', gun: 'rifle', saber: { color: 'blue', hilt: 'skywalker' } } });
    const kept = { han: { skin: 'han' } };
    expect(seedFromHero(kept, { id: 'han', skin: 'hanhoth' })).toBe(kept);
    expect(seedFromHero({}, { id: 'vader', skin: 'vader' })).toEqual({});
    expect(seedFromHero({}, null)).toEqual({});
  });
  it('registers its key, versioned', () => {
    const seen = [];
    registerCrew({ register: (r) => seen.push(r) });
    expect(seen).toHaveLength(1);
    expect(seen[0].key).toBe(CREW_KEY);
    expect(seen[0].version).toBe(CREW_VERSION);
    expect(CREW_KEY).toBe('tp-crew');
    expect(CREW_WHO).toEqual(['luke', 'artoo', 'han', 'chewie', 'rick', 'morty', 'walt', 'jesse']);
  });
});
