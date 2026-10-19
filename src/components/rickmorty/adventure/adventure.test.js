import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSaves } from '../../../runtime/saves';
import { fresh } from './story';
import { STORY_KEY, createAdventure } from './adventure';

const memoryStore = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};
// a window whose storage event the test fires itself, as another tab's write would
const fakeWindow = () => {
  let handler = null;
  return {
    addEventListener: (type, fn) => type === 'storage' && (handler = fn),
    removeEventListener: () => (handler = null),
    storage: (e) => handler?.(e),
  };
};
const none = { tasks: () => [], citadel: () => [] };

let store;
let fakeWin;
let saves;
beforeEach(() => {
  store = memoryStore();
  fakeWin = fakeWindow();
  saves = createSaves({ local: store, session: memoryStore(), win: fakeWin });
});

describe('the adventure’s store', () => {
  it('keeps the story under tp-rm-story', () => expect(STORY_KEY).toBe('tp-rm-story'));

  it('starts a new visitor at episode 1 with the dial shut', () => {
    const a = createAdventure({ saves, read: none });
    expect(a.started).toBe(true);
    expect(a.get()).toMatchObject({ episode: 0, step: 0, freeRoam: false });
    expect(a.dialOpen('customs')).toBe(true);
    expect(a.dialOpen('vat')).toBe(false);
    expect(a.objective().text).toMatch(/^A Federation agent is in a booth at Shoney’s/);
    expect(a.lockNote('vat')).toBe('Opens after episode 5, “Heat”.');
    expect([...a.coordinates()]).toEqual(['customs']);
  });

  it('starts a returner on free roam, caught up', () => {
    const a = createAdventure({ saves, read: { tasks: () => ['diner', 'basement'], citadel: () => [] } });
    expect(a.get()).toMatchObject({ episode: 0, step: 2, freeRoam: true });
    expect(a.started).toBe(false);
    expect(a.dialOpen('vat')).toBe(true);
    // the Citadel's progress makes a returner too
    store.removeItem(STORY_KEY);
    expect(createAdventure({ saves, read: { tasks: () => [], citadel: () => ['daycare'] } }).get().freeRoam).toBe(true);
  });

  it('keeps the story in tp-rm-story, version 1', () => {
    createAdventure({ saves, read: none }).feed({ type: 'task', id: 'diner' });
    expect(JSON.parse(store.getItem('tp-rm-story'))).toMatchObject({ v: 1, data: { step: 1 } });
    // and the next visit takes it up where it was, not as a new visitor
    const again = createAdventure({ saves, read: none });
    expect(again.started).toBe(false);
    expect(again.get()).toMatchObject({ episode: 0, step: 1 });
  });

  it('starts again on a broken save', () => {
    store.setItem('tp-rm-story', '{"v":1,"data":{"episode":"x"}}');
    expect(createAdventure({ saves, read: none }).get().episode).toBe(0);
    // an old shape, unversioned, goes the same way, and a returner keeps free roam
    store.setItem('tp-rm-story', '{"episode":3}');
    const a = createAdventure({ saves, read: { tasks: () => ['cable'], citadel: () => [] } });
    expect(a.get()).toMatchObject({ episode: 0, freeRoam: true });
  });

  it('hears another tab', () => {
    const a = createAdventure({ saves, read: none });
    const heard = vi.fn();
    a.on(heard);
    const other = JSON.stringify({ v: 1, data: { ...fresh(), step: 2 } });
    store.setItem('tp-rm-story', other);
    fakeWin.storage({ key: 'tp-rm-story', newValue: other });
    expect(heard).toHaveBeenCalled();
    expect(a.get().step).toBe(2);
  });

  it('turns away a broken write from another tab', () => {
    const a = createAdventure({ saves, read: none });
    const heard = vi.fn();
    a.on(heard);
    for (const bad of ['{"v":1,"data":{"episode":-4}}', null]) fakeWin.storage({ key: 'tp-rm-story', newValue: bad });
    expect(heard).not.toHaveBeenCalled();
    expect(a.get()).toEqual(fresh());
  });

  it('tells its listeners once a change, and keeps the same state when nothing moves', () => {
    const a = createAdventure({ saves, read: none });
    const heard = vi.fn();
    const off = a.on(heard);
    const before = a.get();
    expect(a.feed({ type: 'task', id: 'basement' })).toEqual([]);
    expect(a.get()).toBe(before);
    expect(heard).not.toHaveBeenCalled();
    expect(a.feed({ type: 'task', id: 'diner' })).toEqual([{ type: 'step', episode: 0, step: 1 }]);
    expect(heard).toHaveBeenCalledTimes(1);
    off();
    a.feed({ type: 'task', id: 'basement' });
    expect(heard).toHaveBeenCalledTimes(1);
  });

  it('reads what’s done at the moment it’s fed', () => {
    const done = [];
    const a = createAdventure({ saves, read: { tasks: () => done, citadel: () => [] } });
    done.push('diner', 'basement');
    expect(a.feed({ type: 'task', id: 'basement' }).map((x) => x.type)).toEqual(['step', 'step']);
    expect(a.get()).toMatchObject({ episode: 0, step: 2 });
  });

  it('switches free roam, and jumps for the checks', () => {
    const a = createAdventure({ saves, read: none });
    a.setFreeRoam(true);
    expect(a.dialOpen('vat')).toBe(true);
    expect(JSON.parse(store.getItem('tp-rm-story')).data.freeRoam).toBe(true);
    a.setFreeRoam(false);
    expect(a.dialOpen('vat')).toBe(false);
    a.jump(1);
    expect(a.get()).toMatchObject({ episode: 1, step: 0, got: [] });
    expect(a.dialOpen('annex')).toBe(true);
    expect(a.dialOpen('vat')).toBe(false); // (episode 2 is built: the lock still bites)
    a.jump(2);
    expect(a.dialOpen('vat')).toBe(true); // (past the last ready episode)
    a.jump(99);
    expect(a.get().episode).toBe(2);
    a.reset();
    expect(a.get()).toEqual(fresh());
  });

  it('opens a visit with the card of the episode it starts on, once', () => {
    const a = createAdventure({ saves, read: none });
    expect(a.intro()).toBe(0);
    expect(a.intro()).toBe(null);
    // the next visit, still at the start of episode 1: its card again
    expect(createAdventure({ saves, read: none }).intro()).toBe(0);
    // at the start of episode 2 (a visitor who finished episode 1 before it was built): episode 2's
    const at = (data) => store.setItem(STORY_KEY, JSON.stringify({ v: 1, data: { ...fresh(), ...data } }));
    at({ episode: 1, step: 0 });
    expect(createAdventure({ saves, read: none }).intro()).toBe(1);
    // part-way through one, past the built ones, or on free roam: none
    at({ episode: 1, step: 1 });
    expect(createAdventure({ saves, read: none }).intro()).toBe(null);
    at({ episode: 2, step: 0 });
    expect(createAdventure({ saves, read: none }).intro()).toBe(null);
    at({ episode: 1, step: 0, freeRoam: true });
    expect(createAdventure({ saves, read: none }).intro()).toBe(null);
    store.removeItem(STORY_KEY);
    expect(createAdventure({ saves, read: { tasks: () => ['cable'], citadel: () => [] } }).intro()).toBe(null);
  });

  it('shows the card of an episode the visit catches up into, though a step of it was done before', () => {
    // finished episode 1 before episode 2 was built, and played Roy then: the
    // catch-up moves them on to the cabinet, and they've never seen its card
    store.setItem(STORY_KEY, JSON.stringify({ v: 1, data: { ...fresh(), episode: 1, step: 0 } }));
    const a = createAdventure({ saves, read: { tasks: () => ['roy'], citadel: () => [] } });
    expect(a.get()).toMatchObject({ episode: 1, step: 1 });
    expect(a.intro()).toBe(1);
  });
});
