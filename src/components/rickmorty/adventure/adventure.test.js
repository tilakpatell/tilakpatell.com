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
    expect(a.lockNote('vat')).toBe('Opens after episode 5, “Heat”. Free roam, in Things to do, opens it now.');
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

  it('keeps the story in tp-rm-story, version 2', () => {
    createAdventure({ saves, read: none }).feed({ type: 'task', id: 'diner' });
    expect(JSON.parse(store.getItem('tp-rm-story'))).toMatchObject({ v: 2, data: { step: 1 } });
    // and the next visit takes it up where it was, not as a new visitor
    const again = createAdventure({ saves, read: none });
    expect(again.started).toBe(false);
    expect(again.get()).toMatchObject({ episode: 0, step: 1 });
  });

  it('puts a version-1 save on Free roam when what it played reaches past what its story has opened, once', () => {
    // (finished episode 1 when it was the last built, every place open, and played the vat)
    const played = { tasks: () => ['diner', 'basement', 'mindblowers', 'customs', 'vat'], citadel: () => [] };
    store.setItem(STORY_KEY, JSON.stringify({ v: 1, data: { ...fresh(), episode: 1, step: 0 } }));
    const a = createAdventure({ saves, read: played });
    expect(a.get()).toMatchObject({ episode: 1, step: 0, freeRoam: true });
    expect(a.dialOpen('vat')).toBe(true);
    expect(JSON.parse(store.getItem(STORY_KEY)).v).toBe(2);
    // (switched off, it stays off: the move's made once)
    a.setFreeRoam(false);
    expect(createAdventure({ saves, read: played }).get().freeRoam).toBe(false);
  });

  it('leaves a version-1 save whose places played are all ones its story has opened as it was', () => {
    store.setItem(STORY_KEY, JSON.stringify({ v: 1, data: { ...fresh(), episode: 1, step: 0 } }));
    const a = createAdventure({ saves, read: { tasks: () => ['diner', 'customs', 'meeseeksgolf', 'cable'], citadel: () => [] } });
    expect(a.get()).toMatchObject({ episode: 1, step: 0, freeRoam: false });
    expect(a.dialOpen('vat')).toBe(false);
    // (a planet the universe map lands on too, or the Citadel, isn't only the dial's: no Free roam for those)
    store.setItem(STORY_KEY, JSON.stringify({ v: 1, data: { ...fresh(), episode: 1, step: 0 } }));
    expect(createAdventure({ saves, read: { tasks: () => ['birdworld', 'squanch'], citadel: () => ['daycare'] } }).get().freeRoam).toBe(false);
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
    expect(a.dialOpen('birdworld')).toBe(true);
    expect(a.dialOpen('heistcon')).toBe(false); // (episode 11 is built too)
    a.jump(11);
    expect(a.dialOpen('heistcon')).toBe(true);
    expect(a.dialOpen('blooddome')).toBe(false); // (episode 12 is built too)
    a.jump(12);
    expect(a.dialOpen('blooddome')).toBe(true); // (episode 12 done)
    a.jump(13);
    expect(a.get().episode).toBe(13); // (the story's end)
    expect(a.dialOpen('evilrick')).toBe(true);
    a.jump(99);
    expect(a.get().episode).toBe(13);
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

  it('takeUnsaid drops an episode card the story has moved past and keeps the done lines', () => {
    // (the Citadel left episode 10's line and episode 11's card; C-137 takes them once the story's at episode 12)
    const a = createAdventure({ saves, read: none });
    a.jump(10);
    a.keepUnsaid([
      { type: 'done', episode: 9 },
      { type: 'episode', episode: 10 },
    ]);
    a.jump(11);
    expect(a.takeUnsaid()).toEqual([{ type: 'done', episode: 9 }]);
    // (a card for the episode the story's at is kept)
    a.keepUnsaid([
      { type: 'done', episode: 10 },
      { type: 'episode', episode: 11 },
    ]);
    expect(a.takeUnsaid()).toEqual([
      { type: 'done', episode: 10 },
      { type: 'episode', episode: 11 },
    ]);
  });

  it('a stored 2.0 save with rickall, wong and sewer known keeps episode 3’s closing line for takeUnsaid; a new returner with episode 1’s tasks done has nothing unsaid', () => {
    // (the catch-up at load ends episode 3: the first page to show the story says its line, and episode 4's card is the visit's)
    store.setItem(STORY_KEY, JSON.stringify({ v: 2, data: { ...fresh(), episode: 2, step: 0 } }));
    const caught = createAdventure({ saves, read: { tasks: () => ['rickall', 'wong', 'sewer'], citadel: () => [] } });
    expect(caught.get()).toMatchObject({ episode: 3, step: 0, freeRoam: false });
    expect(caught.takeUnsaid()).toEqual([
      { type: 'step', episode: 2, step: 1 },
      { type: 'step', episode: 2, step: 2 },
      { type: 'done', episode: 2 },
      { type: 'episode', episode: 3 },
    ]);
    expect(caught.takeUnsaid()).toEqual([]);
    expect(caught.intro()).toBe(3);
    // (a returner starts on Free roam, where no card shows and nothing's said of what the catch-up passed)
    store.removeItem(STORY_KEY);
    const returner = createAdventure({ saves, read: { tasks: () => ['diner', 'basement', 'mindblowers', 'customs'], citadel: () => [] } });
    expect(returner.get()).toMatchObject({ episode: 1, step: 0, freeRoam: true });
    expect(returner.takeUnsaid()).toEqual([]);
    // (nor of a stored save on Free roam)
    store.setItem(STORY_KEY, JSON.stringify({ v: 2, data: { ...fresh(), episode: 2, step: 0, freeRoam: true } }));
    expect(createAdventure({ saves, read: { tasks: () => ['rickall', 'wong', 'sewer'], citadel: () => [] } }).takeUnsaid()).toEqual([]);
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
    at({ episode: 12, step: 0 });
    expect(createAdventure({ saves, read: none, ready: 12 }).intro()).toBe(null);
    expect(createAdventure({ saves, read: none }).intro()).toBe(12); // (episode 13's card: it's built now)
    at({ episode: 13, step: 0 });
    expect(createAdventure({ saves, read: none }).intro()).toBe(null); // (the end)
    at({ episode: 1, step: 0, freeRoam: true });
    expect(createAdventure({ saves, read: none }).intro()).toBe(null);
    store.removeItem(STORY_KEY);
    expect(createAdventure({ saves, read: { tasks: () => ['cable'], citadel: () => [] } }).intro()).toBe(null);
  });

  it('a card for an episode reached under the page isn’t the visit’s card', () => {
    // (opened at episode 10's door; another tab carries the story on to episode 11, whose card it showed)
    const at = (data) => store.setItem(STORY_KEY, JSON.stringify({ v: 2, data: { ...fresh(), ...data } }));
    at({ episode: 9, step: 0 });
    const tab = createAdventure({ saves, read: none });
    const other = JSON.stringify({ v: 2, data: { ...fresh(), episode: 10, step: 0 } });
    store.setItem(STORY_KEY, other);
    fakeWin.storage({ key: STORY_KEY, newValue: other });
    expect(tab.get()).toMatchObject({ episode: 10, step: 0 });
    expect(tab.intro()).toBe(null);
    // (or the page's own news: Customs ends episode 1 there, and its card came with the closing line)
    at({ episode: 0, step: 3 });
    const done = ['diner', 'basement', 'mindblowers'];
    const own = createAdventure({ saves, read: { tasks: () => done, citadel: () => [] } });
    done.push('customs');
    expect(own.feed({ type: 'task', id: 'customs' }).map((o) => o.type)).toContain('episode');
    expect(own.get()).toMatchObject({ episode: 1, step: 0 });
    expect(own.intro()).toBe(null);
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
    // all three done already: episode 3 finishes as the visit loads (its closing line kept for the first page to say)
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

  it('opens episode 11 for a visitor who finished episode 10 before it was built', () => {
    const at = (data) => store.setItem(STORY_KEY, JSON.stringify({ v: 1, data: { ...fresh(), ...data } }));
    const knowing = (tasks) => ({ tasks: () => tasks, citadel: () => [] });
    at({ episode: 10, step: 0 });
    expect(createAdventure({ saves, read: none }).intro()).toBe(10);
    // a planet's task done already (the old knock, hello, podium or escape): its part passed at once, the card still shown
    at({ episode: 10, step: 0 });
    const one = createAdventure({ saves, read: knowing(['pluto']) });
    expect(one.get()).toMatchObject({ episode: 10, step: 0, got: [2] });
    expect(one.intro()).toBe(10);
    // all four: episode 11 finishes as the visit loads
    at({ episode: 10, step: 0 });
    const all = createAdventure({ saves, read: knowing(['birdworld', 'gearworld', 'pluto', 'squanch']) });
    expect(all.get()).toMatchObject({ episode: 11, step: 0 });
    expect(all.intro()).toBe(11); // (episode 12's card: it's built now)
  });

  it('opens episode 12 for a visitor who finished episode 11 before it was built', () => {
    const at = (data) => store.setItem(STORY_KEY, JSON.stringify({ v: 1, data: { ...fresh(), ...data } }));
    const knowing = (tasks) => ({ tasks: () => tasks, citadel: () => [] });
    at({ episode: 11, step: 0 });
    expect(createAdventure({ saves, read: none }).intro()).toBe(11);
    // Heist-Con done already (its old crew): caught up to the Vindicators, still episode 12's card
    at({ episode: 11, step: 0 });
    const crewed = createAdventure({ saves, read: knowing(['heistcon']) });
    expect(crewed.get()).toMatchObject({ episode: 11, step: 1 });
    expect(crewed.intro()).toBe(11);
    // the Vindicators done already, Heist-Con not: it waits at Heist-Con, with episode 12's card
    at({ episode: 11, step: 0 });
    const roomed = createAdventure({ saves, read: knowing(['vindicators']) });
    expect(roomed.get()).toMatchObject({ episode: 11, step: 0 });
    expect(roomed.intro()).toBe(11);
    // both: episode 12 finishes as the visit loads, with no card while episode 13 isn't built
    at({ episode: 11, step: 0 });
    const old = createAdventure({ saves, read: knowing(['heistcon', 'vindicators']), ready: 12 });
    expect(old.get()).toMatchObject({ episode: 12, step: 0 });
    expect(old.intro()).toBe(null);
    at({ episode: 11, step: 0 });
    const both = createAdventure({ saves, read: knowing(['heistcon', 'vindicators']) });
    expect(both.get()).toMatchObject({ episode: 12, step: 0 });
    expect(both.intro()).toBe(12); // (episode 13's card: it's built now)
  });

  it('opens episode 13 for a visitor who finished episode 12 before it was built', () => {
    const at = (data) => store.setItem(STORY_KEY, JSON.stringify({ v: 1, data: { ...fresh(), ...data } }));
    const knowing = (tasks) => ({ tasks: () => tasks, citadel: () => [] });
    for (const [tasks, step] of [
      [[], 0],
      [['blooddome'], 1],
      [['blooddome', 'evilrick', 'evilmorty'], 3],
      [['evilmorty'], 0],
      [['evilrick', 'evilmorty'], 0],
    ]) {
      at({ episode: 12, step: 0 });
      const a = createAdventure({ saves, read: knowing(tasks) });
      expect(a.get(), tasks.join()).toMatchObject({ episode: 12, step });
      expect(a.intro(), tasks.join()).toBe(12);
    }
    at({ episode: 12, step: 0, freeRoam: true });
    expect(createAdventure({ saves, read: none }).intro()).toBe(null);
  });
});
