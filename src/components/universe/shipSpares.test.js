import { describe, expect, it } from 'vitest';
import { createSpares } from './shipSpares';

// a build that counts its calls and lands when told
const builds = () => {
  const made = [];
  const build = (kind) => {
    let land;
    const p = new Promise((r) => (land = r));
    made.push({ kind, land, p });
    return p;
  };
  return { made, build };
};
const tick = () => new Promise((r) => setTimeout(r, 0));

describe('the ships made ahead (shipSpares)', () => {
  it('makes one ahead and hands that one over, not a second', async () => {
    const { made, build } = builds();
    const spares = createSpares({ build });
    spares.want('cruiser');
    spares.want('cruiser'); // (asked again: the same one)
    expect(made).toHaveLength(1);
    const taken = spares.take('cruiser');
    expect(made).toHaveLength(1);
    made[0].land('ship');
    expect(await taken).toBe('ship');
  });

  it('makes one there and then when none was made ahead, and keeps none of it', async () => {
    const { made, build } = builds();
    const spares = createSpares({ build });
    const taken = spares.take('falcon');
    expect(made.map((m) => m.kind)).toEqual(['falcon']);
    made[0].land('falcon model');
    expect(await taken).toBe('falcon model');
    expect(spares.has('falcon')).toBe(false);
  });

  it('makes none ahead while one taken is still on its way (the page asks after the scene took it)', async () => {
    const { made, build } = builds();
    const spares = createSpares({ build });
    spares.take('cruiser');
    spares.want('cruiser');
    expect(made).toHaveLength(1);
    made[0].land('ship');
    await tick();
    // (landed: a later ask, the next visit's, makes the next one)
    spares.want('cruiser');
    expect(made).toHaveLength(2);
  });

  it('hands over one made ahead only once', async () => {
    const { made, build } = builds();
    const spares = createSpares({ build });
    spares.want('cruiser');
    made[0].land('first');
    await tick();
    expect(await spares.take('cruiser')).toBe('first');
    const again = spares.take('cruiser');
    expect(made).toHaveLength(2);
    made[1].land('second');
    expect(await again).toBe('second');
  });

  it('forgets one that failed or came to nothing, so the next ask tries again', async () => {
    const spares = createSpares({ build: () => Promise.reject(new Error('offline')) });
    spares.want('xwing');
    await tick();
    expect(spares.has('xwing')).toBe(false);
    expect(await spares.take('xwing')).toBe(null); // (a failure is nothing, never a rejection)
    const empty = createSpares({ build: () => Promise.resolve(null) });
    empty.want('rv');
    await tick();
    expect(empty.has('rv')).toBe(false);
  });

  it('makes nothing for a kind it has no model for', async () => {
    const spares = createSpares({ build: () => null });
    spares.want('tie');
    expect(spares.has('tie')).toBe(false);
    expect(await spares.take('tie')).toBe(null);
  });

  it('keeps one ahead for each kind on its own', async () => {
    const { made, build } = builds();
    const spares = createSpares({ build });
    spares.want('cruiser');
    spares.want('falcon');
    expect(made.map((m) => m.kind)).toEqual(['cruiser', 'falcon']);
    made[1].land('falcon model');
    expect(await spares.take('falcon')).toBe('falcon model');
    expect(spares.has('cruiser')).toBe(true);
  });
});
