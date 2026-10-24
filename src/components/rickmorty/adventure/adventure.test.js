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
    expect(a.dialOpen('agency')).toBe(true);
    expect(a.dialOpen('microverse')).toBe(false); // (episode 3 is built too)
    expect(a.dialOpen('vat')).toBe(false);
    a.jump(3);
    expect(a.dialOpen('microverse')).toBe(true);
    expect(a.dialOpen('gromflomites')).toBe(false); // (episode 4 is built too)
    expect(a.dialOpen('vat')).toBe(false);
    a.jump(4);
    expect(a.dialOpen('gromflomites')).toBe(true);
    expect(a.dialOpen('needful')).toBe(false); // (episode 5 is built too)
    expect(a.dialOpen('vat')).toBe(false);
    a.jump(5);
    expect(a.dialOpen('needful')).toBe(true);
    expect(a.dialOpen('vat')).toBe(true);
    expect(a.dialOpen('jerryboree')).toBe(false); // (episode 6 is built too)
    a.jump(6);
    expect(a.dialOpen('jerryboree')).toBe(true);
    expect(a.dialOpen('gloopynoops')).toBe(true);
    expect(a.dialOpen('cablestudio')).toBe(false); // (episode 7 is built too)
    a.jump(7);
    expect(a.dialOpen('cablestudio')).toBe(true);
    expect(a.dialOpen('schwifty')).toBe(true);
    expect(a.dialOpen('fantasy')).toBe(false); // (episode 8 is built too)
    a.jump(8);
    expect(a.dialOpen('fantasy')).toBe(true);
    expect(a.dialOpen('froopyland')).toBe(true);
    expect(a.dialOpen('citadel')).toBe(false); // (episode 9 is built too)
    a.jump(9);
    expect(a.dialOpen('citadel')).toBe(true);
    expect(a.dialOpen('frundles')).toBe(true);
    expect(a.dialOpen('birdworld')).toBe(false); // (episode 10 is built too)
    a.jump(10);
    expect(a.dialOpen('birdworld')).toBe(true); // (past the last ready episode)
    a.jump(99);
    expect(a.get().episode).toBe(10);
    a.reset();
    expect(a.get()).toEqual(fresh());
  });

  it('keeps what a page left before it could say it, for the next to say once', () => {
    // (the Citadel left mid-toast, its episode's closing line still to say: C-137 says it)
    const a = createAdventure({ saves, read: none });
    expect(a.takeUnsaid()).toEqual([]);
    a.keepUnsaid([{ type: 'done', episode: 9 }]);
    a.keepUnsaid([]);
    a.keepUnsaid([{ type: 'episode', episode: 10 }]);
    expect(a.takeUnsaid()).toEqual([
      { type: 'done', episode: 9 },
      { type: 'episode', episode: 10 },
    ]);
    expect(a.takeUnsaid()).toEqual([]);
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
    at({ episode: 10, step: 0 });
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

  it('opens episode 3 for a visitor who finished episode 2 before it was built', () => {
    const at = (data) => store.setItem(STORY_KEY, JSON.stringify({ v: 1, data: { ...fresh(), ...data } }));
    const knowing = (tasks) => ({ tasks: () => tasks, citadel: () => [] });
    at({ episode: 2, step: 0 });
    expect(createAdventure({ saves, read: none }).intro()).toBe(2);
    // Total Rickall played already: caught up to Dr. Wong, still episode 3's card
    at({ episode: 2, step: 0 });
    const caught = createAdventure({ saves, read: knowing(['rickall']) });
    expect(caught.get()).toMatchObject({ episode: 2, step: 1 });
    expect(caught.intro()).toBe(2);
    // all three done already: episode 3 finishes as the visit loads, with no card (said nowhere: the hand-off names it)
    at({ episode: 2, step: 0 });
    const all = createAdventure({ saves, read: knowing(['rickall', 'wong', 'sewer']) });
    expect(all.get()).toMatchObject({ episode: 3, step: 0 });
    expect(all.intro()).toBe(3); // (episode 4's card: it's built now)
  });

  it('opens episode 4 for a visitor who finished episode 3 before it was built', () => {
    const at = (data) => store.setItem(STORY_KEY, JSON.stringify({ v: 1, data: { ...fresh(), ...data } }));
    const knowing = (tasks) => ({ tasks: () => tasks, citadel: () => [] });
    at({ episode: 3, step: 0 });
    expect(createAdventure({ saves, read: none }).intro()).toBe(3);
    at({ episode: 3, step: 0 });
    const caught = createAdventure({ saves, read: knowing(['microverse']) });
    expect(caught.get()).toMatchObject({ episode: 3, step: 1 });
    expect(caught.intro()).toBe(3);
    at({ episode: 3, step: 0 });
    const both = createAdventure({ saves, read: knowing(['microverse', 'anatomy']) });
    expect(both.get()).toMatchObject({ episode: 4, step: 0 });
    expect(both.intro()).toBe(4); // (episode 5's card: it's built now)
  });

  it('opens episode 5 for a visitor who finished episode 4 before it was built', () => {
    const at = (data) => store.setItem(STORY_KEY, JSON.stringify({ v: 1, data: { ...fresh(), ...data } }));
    const knowing = (tasks) => ({ tasks: () => tasks, citadel: () => [] });
    at({ episode: 4, step: 0 });
    expect(createAdventure({ saves, read: none }).intro()).toBe(4);
    // the Gromflomite base done already, the chase not won: it waits at the chase, with episode 5's card
    at({ episode: 4, step: 0 });
    const based = createAdventure({ saves, read: knowing(['gromflomites']) });
    expect(based.get()).toMatchObject({ episode: 4, step: 0 });
    expect(based.intro()).toBe(4);
    // the chase won already (a win before its step is kept): caught up to the base, still episode 5's card
    at({ episode: 4, step: 0, wins: ['chase'] });
    const chased = createAdventure({ saves, read: none });
    expect(chased.get()).toMatchObject({ episode: 4, step: 1 });
    expect(chased.intro()).toBe(4);
    // both: episode 5 finishes as the visit loads
    at({ episode: 4, step: 0, wins: ['chase'] });
    const both = createAdventure({ saves, read: knowing(['gromflomites']) });
    expect(both.get()).toMatchObject({ episode: 5, step: 0 });
    expect(both.intro()).toBe(5); // (episode 6's card: it's built now)
  });

  it('opens episode 6 for a visitor who finished episode 5 before it was built', () => {
    const at = (data) => store.setItem(STORY_KEY, JSON.stringify({ v: 1, data: { ...fresh(), ...data } }));
    const knowing = (tasks) => ({ tasks: () => tasks, citadel: () => [] });
    at({ episode: 5, step: 0 });
    expect(createAdventure({ saves, read: none }).intro()).toBe(5);
    // Needful Things done already: caught up to the vat, still episode 6's card
    at({ episode: 5, step: 0 });
    const dealt = createAdventure({ saves, read: knowing(['needful']) });
    expect(dealt.get()).toMatchObject({ episode: 5, step: 1 });
    expect(dealt.intro()).toBe(5);
    // the vat done already, Needful Things not: it waits at Needful Things, with episode 6's card
    at({ episode: 5, step: 0 });
    const dipped = createAdventure({ saves, read: knowing(['vat']) });
    expect(dipped.get()).toMatchObject({ episode: 5, step: 0 });
    expect(dipped.intro()).toBe(5);
    // both: episode 6 finishes as the visit loads
    at({ episode: 5, step: 0 });
    const both = createAdventure({ saves, read: knowing(['needful', 'vat']) });
    expect(both.get()).toMatchObject({ episode: 6, step: 0 });
    expect(both.intro()).toBe(6); // (episode 7's card: it's built now)
  });

  it('opens episode 7 for a visitor who finished episode 6 before it was built', () => {
    const at = (data) => store.setItem(STORY_KEY, JSON.stringify({ v: 1, data: { ...fresh(), ...data } }));
    const knowing = (tasks) => ({ tasks: () => tasks, citadel: () => [] });
    at({ episode: 6, step: 0 });
    expect(createAdventure({ saves, read: none }).intro()).toBe(6);
    // the Jerryboree done already: caught up to St. Gloopy Noops, still episode 7's card
    at({ episode: 6, step: 0 });
    const picked = createAdventure({ saves, read: knowing(['jerryboree']) });
    expect(picked.get()).toMatchObject({ episode: 6, step: 1 });
    expect(picked.intro()).toBe(6);
    // St. Gloopy Noops done already, the Jerryboree not: it waits at the Jerryboree, with episode 7's card
    at({ episode: 6, step: 0 });
    const visited = createAdventure({ saves, read: knowing(['gloopynoops']) });
    expect(visited.get()).toMatchObject({ episode: 6, step: 0 });
    expect(visited.intro()).toBe(6);
    // both: episode 7 finishes as the visit loads
    at({ episode: 6, step: 0 });
    const both = createAdventure({ saves, read: knowing(['jerryboree', 'gloopynoops']) });
    expect(both.get()).toMatchObject({ episode: 7, step: 0 });
    expect(both.intro()).toBe(7); // (episode 8's card: it's built now)
  });

  it('opens episode 8 for a visitor who finished episode 7 before it was built', () => {
    const at = (data) => store.setItem(STORY_KEY, JSON.stringify({ v: 1, data: { ...fresh(), ...data } }));
    const knowing = (tasks) => ({ tasks: () => tasks, citadel: () => [] });
    at({ episode: 7, step: 0 });
    expect(createAdventure({ saves, read: none }).intro()).toBe(7);
    // the cable studio done already: caught up to Get Schwifty, still episode 8's card
    at({ episode: 7, step: 0 });
    const aired = createAdventure({ saves, read: knowing(['cablestudio']) });
    expect(aired.get()).toMatchObject({ episode: 7, step: 1 });
    expect(aired.intro()).toBe(7);
    // Get Schwifty done already, the cable studio not: it waits at the cable studio, with episode 8's card
    at({ episode: 7, step: 0 });
    const sung = createAdventure({ saves, read: knowing(['schwifty']) });
    expect(sung.get()).toMatchObject({ episode: 7, step: 0 });
    expect(sung.intro()).toBe(7);
    // both: episode 8 finishes as the visit loads
    at({ episode: 7, step: 0 });
    const both = createAdventure({ saves, read: knowing(['cablestudio', 'schwifty']) });
    expect(both.get()).toMatchObject({ episode: 8, step: 0 });
    expect(both.intro()).toBe(8); // (episode 9's card: it's built now)
  });

  it('opens episode 9 for a visitor who finished episode 8 before it was built', () => {
    const at = (data) => store.setItem(STORY_KEY, JSON.stringify({ v: 1, data: { ...fresh(), ...data } }));
    const knowing = (tasks) => ({ tasks: () => tasks, citadel: () => [] });
    at({ episode: 8, step: 0 });
    expect(createAdventure({ saves, read: none }).intro()).toBe(8);
    // Fantasy World done already: caught up to Froopyland, still episode 9's card
    at({ episode: 8, step: 0 });
    const climbed = createAdventure({ saves, read: knowing(['fantasy']) });
    expect(climbed.get()).toMatchObject({ episode: 8, step: 1 });
    expect(climbed.intro()).toBe(8);
    // Froopyland done already, Fantasy World not: it waits at Fantasy World, with episode 9's card
    at({ episode: 8, step: 0 });
    const found = createAdventure({ saves, read: knowing(['froopyland']) });
    expect(found.get()).toMatchObject({ episode: 8, step: 0 });
    expect(found.intro()).toBe(8);
    // both: episode 9 finishes as the visit loads
    at({ episode: 8, step: 0 });
    const both = createAdventure({ saves, read: knowing(['fantasy', 'froopyland']) });
    expect(both.get()).toMatchObject({ episode: 9, step: 0 });
    expect(both.intro()).toBe(9); // (episode 10's card: it's built now)
  });

  it('opens episode 10 for a visitor who finished episode 9 before it was built', () => {
    const at = (data) => store.setItem(STORY_KEY, JSON.stringify({ v: 1, data: { ...fresh(), ...data } }));
    at({ episode: 9, step: 0 });
    expect(createAdventure({ saves, read: none }).intro()).toBe(9);
    // the Citadel's escape made already: still at its door (walking in is never caught up), with episode 10's card
    at({ episode: 9, step: 0 });
    const out = createAdventure({ saves, read: { tasks: () => [], citadel: () => ['daycare', 'wafers', 'council', 'votemorty', 'citadelout'] } });
    expect(out.get()).toMatchObject({ episode: 9, step: 0 });
    expect(out.intro()).toBe(9);
  });
});
