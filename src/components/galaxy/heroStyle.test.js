import { describe, expect, it } from 'vitest';
import { keepHeroStyle, readCrewStyle } from './heroStyle';

// (a stand-in for runtime/saves.js: get, set and register, the values kept as they're set)
const store = (init = {}) => {
  const kept = { ...init };
  const registered = [];
  return { kept, registered, get: (k, fallback = null) => (k in kept ? kept[k] : fallback), set: (k, v) => (kept[k] = v), register: (r) => registered.push(r.key) };
};

describe('the galaxy’s hero, in the crew’s style', () => {
  it('seeds the crew’s style from the hero picked, once, and keeps it', () => {
    const saves = store();
    const crew = readCrewStyle(saves, JSON.stringify({ id: 'han', skin: 'hanhoth', gun: 'rifle', color: 'blue', hilt: 'skywalker' }));
    expect(crew.han.gun).toBe('rifle');
    expect(saves.kept['tp-crew'].han.skin).toBe('hanhoth');
    expect(saves.registered).toContain('tp-crew');
    // (a second read with another choice in the galaxy's own key: the crew's style stands)
    expect(readCrewStyle(saves, JSON.stringify({ id: 'han', gun: 'shotgun' })).han.gun).toBe('rifle');
  });
  it('keeps a gun hero’s outfit and gun, and a Jedi’s blade', () => {
    const saves = store();
    keepHeroStyle(saves, { id: 'han', skin: 'hanendor', color: 'blue', hilt: 'skywalker', gun: 'a280' });
    expect(saves.kept['tp-crew'].han).toEqual({ skin: 'hanendor', gun: 'a280' });
    keepHeroStyle(saves, { id: 'luke', skin: 'lukehoth', color: 'green', hilt: 'luke', gun: 'saber' });
    expect(saves.kept['tp-crew'].luke).toEqual({ skin: 'lukehoth', saber: { color: 'green', hilt: 'luke' } });
    expect(saves.kept['tp-crew'].han.gun).toBe('a280');
  });
  it('keeps nothing for a hero who isn’t one of the crews', () => {
    const saves = store();
    keepHeroStyle(saves, { id: 'vader', skin: 'vader', color: 'red', hilt: 'vader' });
    expect(saves.kept['tp-crew']).toBeUndefined();
  });
});
