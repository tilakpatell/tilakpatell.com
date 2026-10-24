import { describe, expect, it } from 'vitest';
import { EPISODES } from './episodes';
import { CITADEL_PAGE, coordinates, current, dialOpen, feed, fresh, lockNote, objective, stepPage, valid } from './story';
import { newsOf } from './hud';

// a small book: two episodes, the first `task a` then `all [task b, win w]`
const BOOK = [
  {
    id: 'one',
    title: 'One',
    intro: [['Rick', 'The first one.']],
    steps: [
      { type: 'task', id: 'a', text: 'Do the first thing.' },
      {
        type: 'all',
        text: 'Do both of the others.',
        steps: [
          { type: 'task', id: 'b', text: 'The other thing.' },
          { type: 'win', game: 'w', text: 'Win the game.' },
        ],
      },
    ],
    outro: [['Morty', 'That was the first one.']],
    unlocks: ['p2'],
  },
  {
    id: 'two',
    title: 'Two',
    intro: [['Rick', 'The second one.']],
    steps: [{ type: 'task', id: 'c', place: 'p2', text: 'Do the third thing.' }],
    outro: [['Morty', 'That was the second one.']],
    unlocks: ['p3'],
  },
];
const o = { episodes: BOOK, ready: 2, start: ['p1'] };
const play = (s, events, opts = o) => events.reduce((acc, e) => {
  const r = feed(acc.state, e, opts);
  return { state: r.state, out: [...acc.out, ...r.out] };
}, { state: s, out: [] });

describe('the adventure’s story', () => {
  it('moves on when the step’s event comes', () => {
    const { state, out } = feed(fresh(), { type: 'task', id: 'a' }, o);
    expect(state).toMatchObject({ episode: 0, step: 1 });
    expect(out).toEqual([{ type: 'step', episode: 0, step: 1 }]);
  });

  it('ignores what the step isn’t waiting for, and the same event twice', () => {
    let s = feed(fresh(), { type: 'task', id: 'x' }, o).state;
    expect(s.step).toBe(0);
    s = feed(s, { type: 'task', id: 'a' }, o).state;
    s = feed(s, { type: 'task', id: 'a' }, o).state;
    expect(s.step).toBe(1);
    const twice = play(s, [{ type: 'task', id: 'b' }, { type: 'task', id: 'b' }]).state;
    expect(twice).toMatchObject({ episode: 0, step: 1, got: [0] });
  });

  it('finishes an `all` step in any order', () => {
    const s = feed(fresh(), { type: 'task', id: 'a' }, o).state;
    const won = feed(s, { type: 'win', game: 'w' }, o);
    expect(won.state).toMatchObject({ episode: 0, step: 1, got: [1] });
    expect(won.out).toEqual([]);
    const { state, out } = feed(won.state, { type: 'task', id: 'b' }, o);
    expect(state).toMatchObject({ episode: 1, step: 0, got: [] });
    expect(out).toEqual([{ type: 'done', episode: 0 }, { type: 'episode', episode: 1 }]);
  });

  it('counts a task done before its step came up', () => {
    const s = feed(fresh(), { type: 'task', id: 'a' }, { ...o, known: { tasks: ['b', 'c'], citadel: [] } }).state;
    expect(s).toMatchObject({ episode: 0, step: 1, got: [0] }); // b counted; w still to win
  });

  it('keeps a win for later', () => {
    const first = feed(fresh(), { type: 'win', game: 'w' }, o).state;
    expect(first).toMatchObject({ episode: 0, step: 0, wins: ['w'] });
    expect(feed(first, { type: 'win', game: 'w' }, o).state.wins).toEqual(['w']);
    const { state, out } = play(first, [{ type: 'task', id: 'a' }, { type: 'task', id: 'b' }]);
    expect(state).toMatchObject({ episode: 1, step: 0 });
    expect(out.map((x) => x.type)).toEqual(['step', 'done', 'episode']);
  });

  it('catches up on what was done before the story existed', () => {
    const s = feed(fresh(), { type: 'none' }, { ...o, known: { tasks: ['a', 'b'], citadel: [] } }).state;
    expect(s).toMatchObject({ episode: 0, step: 1, got: [0] });
  });

  it('ends the story when the last episode’s done', () => {
    const { state, out } = play(fresh(), [{ type: 'task', id: 'a' }, { type: 'task', id: 'b' }, { type: 'win', game: 'w' }, { type: 'task', id: 'c' }]);
    expect(state).toMatchObject({ episode: 2, step: 0 });
    expect(out.slice(-2)).toEqual([{ type: 'done', episode: 1 }, { type: 'end' }]);
    expect(current(state, o)).toBe(null);
    expect(objective(state, o)).toBe(null);
    // and nothing after the end moves it
    expect(feed(state, { type: 'task', id: 'c' }, o)).toEqual({ state, out: [] });
  });

  it('opens the start, then each finished episode’s unlocks', () => {
    expect([...coordinates(fresh(), o)]).toEqual(['p1']);
    expect(coordinates({ ...fresh(), episode: 1 }, o).has('p2')).toBe(true);
    expect(coordinates({ ...fresh(), episode: 1 }, o).has('p3')).toBe(false);
    expect(dialOpen(fresh(), 'p1', o)).toBe(true);
    expect(dialOpen(fresh(), 'p2', o)).toBe(false);
  });

  it('opens every place once the last ready episode is done', () => {
    const s = { ...fresh(), episode: 1 }; // ready: 1, episode 1 not built
    expect(dialOpen(s, 'p3', { episodes: BOOK, ready: 1, start: ['p1'] })).toBe(true);
    expect(objective(s, { episodes: BOOK, ready: 1 })).toBe(null);
    expect(current(s, { episodes: BOOK, ready: 1 })).toBe(null);
    expect(feed(s, { type: 'task', id: 'c' }, { episodes: BOOK, ready: 1 }).state.episode).toBe(1);
    // (and a win there is still kept for when it's built)
    expect(feed(s, { type: 'win', game: 'w' }, { episodes: BOOK, ready: 1 }).state.wins).toEqual(['w']);
  });

  it('says nothing of an episode that isn’t built when the last ready one ends', () => {
    const { state, out } = play(fresh(), [{ type: 'task', id: 'a' }, { type: 'task', id: 'b' }, { type: 'win', game: 'w' }], { ...o, ready: 1 });
    expect(state).toMatchObject({ episode: 1, step: 0 });
    expect(out.slice(-1)).toEqual([{ type: 'done', episode: 0 }]);
  });

  it('opens everything on free roam, and starts a returner on it', () => {
    expect(fresh().freeRoam).toBe(false);
    expect(fresh({ returner: true }).freeRoam).toBe(true);
    expect(dialOpen({ ...fresh(), freeRoam: true }, 'p3', o)).toBe(true);
    // free roam doesn't move the story
    expect(objective({ ...fresh(), freeRoam: true }, o)).toEqual({ text: 'Do the first thing.', to: null });
  });

  it('says the current step', () => {
    expect(current(fresh(), o)).toEqual({ episode: BOOK[0], index: 0, step: BOOK[0].steps[0] });
    expect(objective({ ...fresh(), step: 1 }, o)).toEqual({ text: 'Do both of the others.', to: null });
  });

  it('points an enter-a-page step at the page', () => {
    const book = [{ ...BOOK[0], steps: [{ type: 'enter', area: 'page:/c-137/citadel', text: 'Go to the Citadel.' }] }];
    expect(objective(fresh(), { episodes: book, ready: 1 })).toEqual({ text: 'Go to the Citadel.', to: '/c-137/citadel' });
    const entered = feed(fresh(), { type: 'enter', area: 'page:/c-137/citadel' }, { episodes: book, ready: 1 });
    expect(entered.out).toEqual([{ type: 'done', episode: 0 }, { type: 'end' }]);
    // an area of C-137's isn't a page
    const room = [{ ...BOOK[0], steps: [{ type: 'enter', area: 'garage', text: 'Go to the garage.' }] }];
    expect(objective(fresh(), { episodes: room, ready: 1 }).to).toBe(null);
  });

  it('points the Citadel’s steps at its page', () => {
    const book = [{ ...BOOK[0], steps: [{ type: 'citadel', id: 'out', text: 'Get out of the Citadel.' }] }];
    expect(objective(fresh(), { episodes: book, ready: 1 })).toEqual({ text: 'Get out of the Citadel.', to: '/c-137/citadel' });
    expect(CITADEL_PAGE).toBe('/c-137/citadel');
    expect(CITADEL_PAGE).toBe(EPISODES[9].steps[0].area.slice('page:'.length));
    expect(stepPage({ type: 'citadel', id: 'out' })).toBe(CITADEL_PAGE);
    expect(stepPage({ type: 'enter', area: 'page:/x' })).toBe('/x');
    // C-137's own: an area, a task, an `all`
    expect(stepPage({ type: 'enter', area: 'garage' })).toBe(null);
    expect(stepPage({ type: 'task', id: 'diner' })).toBe(null);
    expect(stepPage({ type: 'all', steps: [{ type: 'citadel', id: 'out' }] })).toBe(null);
  });

  it('hears talks, uses and the Citadel’s steps, and catches up on the Citadel', () => {
    const book = [{ ...BOOK[0], steps: [{ type: 'talk', who: 'rick', text: 'Talk to Rick.' }, { type: 'use', id: 'dial', text: 'Use the dial.' }, { type: 'citadel', id: 'out', text: 'Get out of the Citadel.' }] }];
    const opts = { episodes: book, ready: 1 };
    let s = feed(fresh(), { type: 'talk', who: 'morty' }, opts).state;
    expect(s.step).toBe(0);
    s = feed(s, { type: 'talk', who: 'rick' }, opts).state;
    s = feed(s, { type: 'use', id: 'dial' }, opts).state;
    expect(s.step).toBe(2);
    expect(feed(s, { type: 'citadel', id: 'out' }, opts).state.episode).toBe(1);
    expect(feed(s, { type: 'none' }, { ...opts, known: { tasks: [], citadel: ['out'] } }).state.episode).toBe(1);
  });

  it('never changes the state it’s given', () => {
    const s = Object.freeze({ ...fresh(), got: Object.freeze([]), wins: Object.freeze([]) });
    expect(() => feed(s, { type: 'task', id: 'a' }, o)).not.toThrow();
    expect(() => feed(s, { type: 'win', game: 'w' }, o)).not.toThrow();
    expect(s).toEqual(fresh());
  });

  it('says which episode opens a place', () => {
    expect(lockNote('vat')).toBe('Opens after episode 5, “Heat”.');
    expect(lockNote('jerryboree')).toBe('Opens after episode 6, “Bad deals”.');
    expect(lockNote('cablestudio')).toBe('Opens after episode 7, “The Jerry problem”.');
    expect(lockNote('fantasy')).toBe('Opens after episode 8, “Prime time”.');
    expect(lockNote('citadel')).toBe('Opens after episode 9, “Fairy tales”.');
    for (const id of ['birdworld', 'gearworld', 'pluto', 'squanch']) expect(lockNote(id), id).toBe('Opens after episode 10, “The Citadel”.');
    for (const id of ['heistcon', 'vindicators']) expect(lockNote(id), id).toBe('Opens after episode 11, “The sector”.');
    for (const id of ['blooddome', 'evilrick']) expect(lockNote(id), id).toBe('Opens after episode 12, “Big score”.');
    expect(lockNote('annex')).toBe('Opens after episode 1, “Wiped”.');
    expect(lockNote('customs')).toBe(null);
    expect(lockNote('nope')).toBe(null);
  });

  it('turns away a broken save', () => {
    expect(valid(fresh())).toBe(true);
    expect(valid({ ...fresh(), episode: 13 })).toBe(true);
    expect(valid({ episode: -1 })).toBe(false);
    for (const bad of [null, 'x', [], { ...fresh(), episode: 'x' }, { ...fresh(), episode: 14 }, { ...fresh(), step: 4 }, { ...fresh(), step: -1 }, { ...fresh(), got: 'x' }, { ...fresh(), got: [0] }, { ...fresh(), wins: [1] }, { ...fresh(), freeRoam: 'yes' }, { ...fresh(), episode: 13, step: 1 }])
      expect(valid(bad), JSON.stringify(bad)).toBe(false);
    // an `all` step's parts are counted by index
    const sector = EPISODES.findIndex((e) => e.steps.some((s) => s.type === 'all'));
    expect(valid({ ...fresh(), episode: sector, got: [0, 3] })).toBe(true);
    expect(valid({ ...fresh(), episode: sector, got: [4] })).toBe(false);
  });
});

describe('the real story', () => {
  const eventOf = (s) => ({ task: { type: 'task', id: s.id }, win: { type: 'win', game: s.game }, enter: { type: 'enter', area: s.area }, talk: { type: 'talk', who: s.who }, use: { type: 'use', id: s.id }, citadel: { type: 'citadel', id: s.id } })[s.type];

  it('starts a new visitor at the Federation agent in Shoney’s, with Customs open', () => {
    expect(objective(fresh())).toEqual({ text: EPISODES[0].steps[0].text, to: null });
    expect(dialOpen(fresh(), 'customs')).toBe(true);
    expect(dialOpen(fresh(), 'annex')).toBe(false);
    expect(dialOpen(fresh(), 'citadel')).toBe(false);
  });

  it('can be finished from a fresh save, every episode built', () => {
    let s = fresh();
    const out = [];
    for (const e of EPISODES)
      for (const step of e.steps)
        for (const part of step.type === 'all' ? step.steps : [step]) {
          const r = feed(s, eventOf(part), { ready: EPISODES.length });
          s = r.state;
          out.push(...r.out);
        }
    expect(s).toMatchObject({ episode: EPISODES.length, step: 0 });
    expect(out.filter((x) => x.type === 'done')).toHaveLength(EPISODES.length);
    expect(out.at(-1)).toEqual({ type: 'end' });
  });

  it('opens episode 3’s places after episode 2, episode 4’s after episode 3, episode 5’s after episode 4, episode 6’s after episode 5, episode 7’s after episode 6, episode 8’s after episode 7, episode 9’s after episode 8, episode 10’s after episode 9, episode 11’s after episode 10, episode 12’s after episode 11, and every place once episode 12, the last built, is done', () => {
    let s = fresh();
    let out = [];
    for (const id of ['diner', 'basement', 'mindblowers', 'customs']) ({ state: s, out } = feed(s, { type: 'task', id }));
    expect(s).toMatchObject({ episode: 1, step: 0 });
    expect(out.slice(-2)).toEqual([{ type: 'done', episode: 0 }, { type: 'episode', episode: 1 }]);
    for (const id of ['annex', 'meeseeksgolf']) expect(dialOpen(s, id), id).toBe(true);
    for (const id of ['agency', 'vat', 'citadel', 'squanch', 'evilrick']) expect(dialOpen(s, id), id).toBe(false);
    expect(objective(s)).toEqual({ text: EPISODES[1].steps[0].text, to: null });
    s = feed(s, { type: 'task', id: 'roy' }).state;
    expect(objective(s)).toEqual({ text: EPISODES[1].steps[1].text, to: null });
    ({ state: s, out } = feed(s, { type: 'win', game: 'cabinet' }));
    expect(out).toEqual([{ type: 'done', episode: 1 }, { type: 'episode', episode: 2 }]);
    for (const id of ['annex', 'meeseeksgolf', 'agency', 'simulation']) expect(dialOpen(s, id), id).toBe(true);
    for (const id of ['microverse', 'anatomy', 'storytrain', 'vat', 'citadel', 'squanch', 'evilrick']) expect(dialOpen(s, id), id).toBe(false);
    expect(objective(s)).toEqual({ text: EPISODES[2].steps[0].text, to: null });
    s = feed(s, { type: 'task', id: 'rickall' }).state;
    expect(objective(s)).toEqual({ text: EPISODES[2].steps[1].text, to: null });
    s = feed(s, { type: 'task', id: 'wong' }).state;
    expect(objective(s)).toEqual({ text: EPISODES[2].steps[2].text, to: null });
    ({ state: s, out } = feed(s, { type: 'task', id: 'sewer' }));
    expect(out).toEqual([{ type: 'done', episode: 2 }, { type: 'episode', episode: 3 }]);
    for (const id of ['annex', 'agency', 'microverse', 'anatomy', 'storytrain']) expect(dialOpen(s, id), id).toBe(true);
    for (const id of ['gromflomites', 'fortress', 'vat', 'citadel', 'squanch', 'evilrick']) expect(dialOpen(s, id), id).toBe(false);
    expect(objective(s)).toEqual({ text: EPISODES[3].steps[0].text, to: null });
    ({ state: s, out } = feed(s, { type: 'task', id: 'microverse' }));
    expect(out).toEqual([{ type: 'step', episode: 3, step: 1 }]);
    expect(objective(s)).toEqual({ text: EPISODES[3].steps[1].text, to: null });
    ({ state: s, out } = feed(s, { type: 'task', id: 'anatomy' }));
    expect(out).toEqual([{ type: 'done', episode: 3 }, { type: 'episode', episode: 4 }]);
    for (const id of ['gromflomites', 'fortress']) expect(dialOpen(s, id), id).toBe(true);
    for (const id of ['needful', 'vat', 'nimbus', 'citadel', 'squanch', 'evilrick']) expect(dialOpen(s, id), id).toBe(false);
    expect(objective(s)).toEqual({ text: EPISODES[4].steps[0].text, to: null });
    ({ state: s, out } = feed(s, { type: 'win', game: 'chase' }));
    expect(out).toEqual([{ type: 'step', episode: 4, step: 1 }]);
    expect(objective(s)).toEqual({ text: EPISODES[4].steps[1].text, to: null });
    ({ state: s, out } = feed(s, { type: 'task', id: 'gromflomites' }));
    expect(out).toEqual([{ type: 'done', episode: 4 }, { type: 'episode', episode: 5 }]);
    for (const id of ['needful', 'vat', 'nimbus']) expect(dialOpen(s, id), id).toBe(true);
    for (const id of ['jerryboree', 'gloopynoops', 'prison', 'citadel', 'squanch', 'evilrick']) expect(dialOpen(s, id), id).toBe(false);
    expect(objective(s)).toEqual({ text: EPISODES[5].steps[0].text, to: null });
    ({ state: s, out } = feed(s, { type: 'task', id: 'needful' }));
    expect(out).toEqual([{ type: 'step', episode: 5, step: 1 }]);
    expect(objective(s)).toEqual({ text: EPISODES[5].steps[1].text, to: null });
    ({ state: s, out } = feed(s, { type: 'task', id: 'vat' }));
    expect(out).toEqual([{ type: 'done', episode: 5 }, { type: 'episode', episode: 6 }]);
    for (const id of ['jerryboree', 'gloopynoops', 'prison']) expect(dialOpen(s, id), id).toBe(true);
    for (const id of ['cablestudio', 'schwifty', 'dream', 'citadel', 'squanch', 'evilrick']) expect(dialOpen(s, id), id).toBe(false);
    expect(objective(s)).toEqual({ text: EPISODES[6].steps[0].text, to: null });
    ({ state: s, out } = feed(s, { type: 'task', id: 'jerryboree' }));
    expect(out).toEqual([{ type: 'step', episode: 6, step: 1 }]);
    expect(objective(s)).toEqual({ text: EPISODES[6].steps[1].text, to: null });
    ({ state: s, out } = feed(s, { type: 'task', id: 'gloopynoops' }));
    expect(out).toEqual([{ type: 'done', episode: 6 }, { type: 'episode', episode: 7 }]);
    for (const id of ['cablestudio', 'schwifty', 'dream']) expect(dialOpen(s, id), id).toBe(true);
    for (const id of ['fantasy', 'froopyland', 'dim35c', 'citadel', 'squanch', 'evilrick']) expect(dialOpen(s, id), id).toBe(false);
    expect(objective(s)).toEqual({ text: EPISODES[7].steps[0].text, to: null });
    ({ state: s, out } = feed(s, { type: 'task', id: 'cablestudio' }));
    expect(out).toEqual([{ type: 'step', episode: 7, step: 1 }]);
    expect(objective(s)).toEqual({ text: EPISODES[7].steps[1].text, to: null });
    ({ state: s, out } = feed(s, { type: 'task', id: 'schwifty' }));
    expect(out).toEqual([{ type: 'done', episode: 7 }, { type: 'episode', episode: 8 }]);
    for (const id of ['fantasy', 'froopyland', 'dim35c']) expect(dialOpen(s, id), id).toBe(true);
    for (const id of ['citadel', 'frundles', 'squanch', 'evilrick']) expect(dialOpen(s, id), id).toBe(false);
    expect(objective(s)).toEqual({ text: EPISODES[8].steps[0].text, to: null });
    ({ state: s, out } = feed(s, { type: 'task', id: 'fantasy' }));
    expect(out).toEqual([{ type: 'step', episode: 8, step: 1 }]);
    expect(objective(s)).toEqual({ text: EPISODES[8].steps[1].text, to: null });
    ({ state: s, out } = feed(s, { type: 'task', id: 'froopyland' }));
    expect(out).toEqual([{ type: 'done', episode: 8 }, { type: 'episode', episode: 9 }]);
    for (const id of ['citadel', 'frundles']) expect(dialOpen(s, id), id).toBe(true);
    for (const id of ['birdworld', 'gearworld', 'pluto', 'squanch', 'evilrick']) expect(dialOpen(s, id), id).toBe(false);
    // (both of episode 10's steps are the Citadel's page: the line links there from C-137)
    expect(objective(s)).toEqual({ text: EPISODES[9].steps[0].text, to: '/c-137/citadel' });
    ({ state: s, out } = feed(s, { type: 'enter', area: 'page:/c-137/citadel' }));
    expect(out).toEqual([{ type: 'step', episode: 9, step: 1 }]);
    expect(objective(s)).toEqual({ text: EPISODES[9].steps[1].text, to: '/c-137/citadel' });
    ({ state: s, out } = feed(s, { type: 'citadel', id: 'citadelout' }));
    expect(out).toEqual([{ type: 'done', episode: 9 }, { type: 'episode', episode: 10 }]);
    for (const id of ['birdworld', 'gearworld', 'pluto', 'squanch']) expect(dialOpen(s, id), id).toBe(true);
    for (const id of ['heistcon', 'vindicators', 'evilrick']) expect(dialOpen(s, id), id).toBe(false);
    expect(objective(s)).toEqual({ text: EPISODES[10].steps[0].text, to: null });
    // (the sector's four in any order: nothing to say till the last, which ends episode 11)
    for (const id of ['pluto', 'squanch', 'birdworld']) {
      ({ state: s, out } = feed(s, { type: 'task', id }));
      expect(out, id).toEqual([]);
      expect(objective(s), id).toEqual({ text: EPISODES[10].steps[0].text, to: null });
    }
    ({ state: s, out } = feed(s, { type: 'task', id: 'gearworld' }));
    expect(out).toEqual([{ type: 'done', episode: 10 }, { type: 'episode', episode: 11 }]);
    for (const id of ['heistcon', 'vindicators']) expect(dialOpen(s, id), id).toBe(true);
    for (const id of ['blooddome', 'evilrick']) expect(dialOpen(s, id), id).toBe(false);
    expect(objective(s)).toEqual({ text: EPISODES[11].steps[0].text, to: null });
    ({ state: s, out } = feed(s, { type: 'task', id: 'heistcon' }));
    expect(out).toEqual([{ type: 'step', episode: 11, step: 1 }]);
    expect(objective(s)).toEqual({ text: EPISODES[11].steps[1].text, to: null });
    ({ state: s, out } = feed(s, { type: 'task', id: 'vindicators' }));
    expect(out).toEqual([{ type: 'done', episode: 11 }]); // (no card: episode 13 isn't built)
    for (const id of ['blooddome', 'evilrick']) expect(dialOpen(s, id), id).toBe(true);
    expect(objective(s)).toBe(null);
  });

  it('keeps a cabinet won early', () => {
    const s = { ...fresh(), step: 3, wins: ['cabinet'] };
    const { state, out } = feed(s, { type: 'task', id: 'customs' }, { known: { tasks: ['roy'], citadel: [] } });
    expect(state).toMatchObject({ episode: 2, step: 0 });
    expect(out.map((o) => o.type)).toEqual(['done', 'episode', 'step', 'done', 'episode']);
    expect(out.at(-1)).toEqual({ type: 'episode', episode: 2 });
  });

  it('crosses into episode 3 past the tasks already done', () => {
    const s = { ...fresh(), episode: 1, step: 1 };
    const win = { type: 'win', game: 'cabinet' };
    const two = feed(s, win, { known: { tasks: ['roy', 'rickall', 'wong'], citadel: [] } });
    expect(two.state).toMatchObject({ episode: 2, step: 2 });
    expect(newsOf(two.out)).toEqual({ say: [{ kind: 'say', who: EPISODES[1].outro[0][0], text: EPISODES[1].outro[0][1] }], card: 2 });
    const three = feed(s, win, { known: { tasks: ['roy', 'rickall', 'wong', 'sewer'], citadel: [] } });
    expect(three.state).toMatchObject({ episode: 3, step: 0 });
    expect(newsOf(three.out)).toEqual({ say: [{ kind: 'say', who: EPISODES[2].outro[0][0], text: EPISODES[2].outro[0][1] }], card: 3 });
    const four = feed(s, win, { known: { tasks: ['roy', 'rickall', 'wong', 'sewer', 'microverse', 'anatomy'], citadel: [] } });
    expect(four.state).toMatchObject({ episode: 4, step: 0 });
    expect(newsOf(four.out)).toEqual({ say: [{ kind: 'say', who: EPISODES[3].outro[0][0], text: EPISODES[3].outro[0][1] }], card: 4 });
    // the Gromflomite base known too, the chase not won: it waits at the chase
    expect(feed(s, win, { known: { tasks: ['roy', 'rickall', 'wong', 'sewer', 'microverse', 'anatomy', 'gromflomites'], citadel: [] } }).state).toMatchObject({ episode: 4, step: 0 });
    // and with the chase won already, through episode 5: Rick's line, and episode 6's card
    const five = feed({ ...s, wins: ['chase'] }, win, { known: { tasks: ['roy', 'rickall', 'wong', 'sewer', 'microverse', 'anatomy', 'gromflomites'], citadel: [] } });
    expect(five.state).toMatchObject({ episode: 5, step: 0 });
    expect(newsOf(five.out)).toEqual({ say: [{ kind: 'say', who: EPISODES[4].outro[0][0], text: EPISODES[4].outro[0][1] }], card: 5 });
    // the vat known too, Needful Things not: it waits at Needful Things
    expect(feed({ ...s, wins: ['chase'] }, win, { known: { tasks: ['roy', 'rickall', 'wong', 'sewer', 'microverse', 'anatomy', 'gromflomites', 'vat'], citadel: [] } }).state).toMatchObject({ episode: 5, step: 0 });
    // and both known, through episode 6: Morty's line, and episode 7's card
    const six = feed({ ...s, wins: ['chase'] }, win, { known: { tasks: ['roy', 'rickall', 'wong', 'sewer', 'microverse', 'anatomy', 'gromflomites', 'needful', 'vat'], citadel: [] } });
    expect(six.state).toMatchObject({ episode: 6, step: 0 });
    expect(newsOf(six.out)).toEqual({ say: [{ kind: 'say', who: EPISODES[5].outro[0][0], text: EPISODES[5].outro[0][1] }], card: 6 });
    // St. Gloopy Noops known too, the Jerryboree not: it waits at the Jerryboree
    expect(feed({ ...s, wins: ['chase'] }, win, { known: { tasks: ['roy', 'rickall', 'wong', 'sewer', 'microverse', 'anatomy', 'gromflomites', 'needful', 'vat', 'gloopynoops'], citadel: [] } }).state).toMatchObject({ episode: 6, step: 0 });
    // and both known, through episode 7: Rick's line, and episode 8's card
    const seven = feed({ ...s, wins: ['chase'] }, win, { known: { tasks: ['roy', 'rickall', 'wong', 'sewer', 'microverse', 'anatomy', 'gromflomites', 'needful', 'vat', 'jerryboree', 'gloopynoops'], citadel: [] } });
    expect(seven.state).toMatchObject({ episode: 7, step: 0 });
    expect(newsOf(seven.out)).toEqual({ say: [{ kind: 'say', who: EPISODES[6].outro[0][0], text: EPISODES[6].outro[0][1] }], card: 7 });
    // Get Schwifty known too, the cable studio not: it waits at the cable studio
    expect(feed({ ...s, wins: ['chase'] }, win, { known: { tasks: ['roy', 'rickall', 'wong', 'sewer', 'microverse', 'anatomy', 'gromflomites', 'needful', 'vat', 'jerryboree', 'gloopynoops', 'schwifty'], citadel: [] } }).state).toMatchObject({ episode: 7, step: 0 });
    // and both known, through episode 8: Morty's line, and episode 9's card
    const eight = feed({ ...s, wins: ['chase'] }, win, { known: { tasks: ['roy', 'rickall', 'wong', 'sewer', 'microverse', 'anatomy', 'gromflomites', 'needful', 'vat', 'jerryboree', 'gloopynoops', 'cablestudio', 'schwifty'], citadel: [] } });
    expect(eight.state).toMatchObject({ episode: 8, step: 0 });
    expect(newsOf(eight.out)).toEqual({ say: [{ kind: 'say', who: EPISODES[7].outro[0][0], text: EPISODES[7].outro[0][1] }], card: 8 });
    // Froopyland known too, Fantasy World not: it waits at Fantasy World
    expect(feed({ ...s, wins: ['chase'] }, win, { known: { tasks: ['roy', 'rickall', 'wong', 'sewer', 'microverse', 'anatomy', 'gromflomites', 'needful', 'vat', 'jerryboree', 'gloopynoops', 'cablestudio', 'schwifty', 'froopyland'], citadel: [] } }).state).toMatchObject({ episode: 8, step: 0 });
    // and both known, through episode 9: Rick's line, and episode 10's card
    const nine = feed({ ...s, wins: ['chase'] }, win, { known: { tasks: ['roy', 'rickall', 'wong', 'sewer', 'microverse', 'anatomy', 'gromflomites', 'needful', 'vat', 'jerryboree', 'gloopynoops', 'cablestudio', 'schwifty', 'fantasy', 'froopyland'], citadel: [] } });
    expect(nine.state).toMatchObject({ episode: 9, step: 0 });
    expect(newsOf(nine.out)).toEqual({ say: [{ kind: 'say', who: EPISODES[8].outro[0][0], text: EPISODES[8].outro[0][1] }], card: 9 });
    // the Citadel's escape known too: it still waits at the Citadel's door (walking in is never caught up)
    expect(feed({ ...s, wins: ['chase'] }, win, { known: { tasks: ['roy', 'rickall', 'wong', 'sewer', 'microverse', 'anatomy', 'gromflomites', 'needful', 'vat', 'jerryboree', 'gloopynoops', 'cablestudio', 'schwifty', 'fantasy', 'froopyland'], citadel: ['daycare', 'wafers', 'council', 'votemorty', 'citadelout'] } }).state).toMatchObject({ episode: 9, step: 0 });
  });

  it('keeps a chase won early, and opens episode 5 at the Gromflomite base', () => {
    const won = feed({ ...fresh(), episode: 3, step: 1 }, { type: 'win', game: 'chase' });
    expect(won.state).toMatchObject({ episode: 3, step: 1, wins: ['chase'] });
    expect(won.out).toEqual([]);
    const { state, out } = feed(won.state, { type: 'task', id: 'anatomy' });
    expect(state).toMatchObject({ episode: 4, step: 1 });
    expect(out).toEqual([{ type: 'done', episode: 3 }, { type: 'episode', episode: 4 }, { type: 'step', episode: 4, step: 1 }]);
    // (episode 5 begun and not over in the same out: its card)
    expect(newsOf(out).card).toBe(4);
  });

  it('counts Needful Things done early, and opens episode 6 at the vat', () => {
    // (done on Free roam, before episode 6 came up: it's in tp-c137-done)
    const s = { ...fresh(), episode: 4, step: 1, wins: ['chase'] };
    const { state, out } = feed(s, { type: 'task', id: 'gromflomites' }, { known: { tasks: ['needful'], citadel: [] } });
    expect(state).toMatchObject({ episode: 5, step: 1 });
    expect(out).toEqual([{ type: 'done', episode: 4 }, { type: 'episode', episode: 5 }, { type: 'step', episode: 5, step: 1 }]);
    // (episode 6 begun and not over in the same out: its card)
    expect(newsOf(out).card).toBe(5);
    // the vat done early too: episode 6 over in the same out, Morty's line and episode 7's card
    const both = feed(s, { type: 'task', id: 'gromflomites' }, { known: { tasks: ['needful', 'vat'], citadel: [] } });
    expect(both.state).toMatchObject({ episode: 6, step: 0 });
    expect(both.out.map((o) => o.type)).toEqual(['done', 'episode', 'step', 'done', 'episode']);
    expect(newsOf(both.out)).toEqual({ say: [{ kind: 'say', who: EPISODES[5].outro[0][0], text: EPISODES[5].outro[0][1] }], card: 6 });
  });

  it('counts the Jerryboree done early, and opens episode 7 at St. Gloopy Noops', () => {
    // (done on Free roam, or by a talk before its game was built: it's in tp-c137-done)
    const s = { ...fresh(), episode: 5, step: 1 };
    const { state, out } = feed(s, { type: 'task', id: 'vat' }, { known: { tasks: ['jerryboree'], citadel: [] } });
    expect(state).toMatchObject({ episode: 6, step: 1 });
    expect(out).toEqual([{ type: 'done', episode: 5 }, { type: 'episode', episode: 6 }, { type: 'step', episode: 6, step: 1 }]);
    // (episode 7 begun and not over in the same out: its card)
    expect(newsOf(out).card).toBe(6);
    // St. Gloopy Noops done early too: episode 7 over in the same out, Rick's line and episode 8's card
    const both = feed(s, { type: 'task', id: 'vat' }, { known: { tasks: ['jerryboree', 'gloopynoops'], citadel: [] } });
    expect(both.state).toMatchObject({ episode: 7, step: 0 });
    expect(both.out.map((o) => o.type)).toEqual(['done', 'episode', 'step', 'done', 'episode']);
    expect(newsOf(both.out)).toEqual({ say: [{ kind: 'say', who: EPISODES[6].outro[0][0], text: EPISODES[6].outro[0][1] }], card: 7 });
  });

  it('counts the cable studio done early, and opens episode 8 at Get Schwifty', () => {
    // (done on Free roam, or by watching before its game was built: it's in tp-c137-done)
    const s = { ...fresh(), episode: 6, step: 1 };
    const { state, out } = feed(s, { type: 'task', id: 'gloopynoops' }, { known: { tasks: ['cablestudio'], citadel: [] } });
    expect(state).toMatchObject({ episode: 7, step: 1 });
    expect(out).toEqual([{ type: 'done', episode: 6 }, { type: 'episode', episode: 7 }, { type: 'step', episode: 7, step: 1 }]);
    // (episode 8 begun and not over in the same out: its card)
    expect(newsOf(out).card).toBe(7);
    // Get Schwifty done early too: episode 8 over in the same out, Morty's line and episode 9's card
    const both = feed(s, { type: 'task', id: 'gloopynoops' }, { known: { tasks: ['cablestudio', 'schwifty'], citadel: [] } });
    expect(both.state).toMatchObject({ episode: 8, step: 0 });
    expect(both.out.map((o) => o.type)).toEqual(['done', 'episode', 'step', 'done', 'episode']);
    expect(newsOf(both.out)).toEqual({ say: [{ kind: 'say', who: EPISODES[7].outro[0][0], text: EPISODES[7].outro[0][1] }], card: 8 });
  });

  it('counts Fantasy World done early, and opens episode 9 at Froopyland', () => {
    // (done on Free roam, or by the Meeseeks before its game was built: it's in tp-c137-done)
    const s = { ...fresh(), episode: 7, step: 1 };
    const { state, out } = feed(s, { type: 'task', id: 'schwifty' }, { known: { tasks: ['fantasy'], citadel: [] } });
    expect(state).toMatchObject({ episode: 8, step: 1 });
    expect(out).toEqual([{ type: 'done', episode: 7 }, { type: 'episode', episode: 8 }, { type: 'step', episode: 8, step: 1 }]);
    // (episode 9 begun and not over in the same out: its card)
    expect(newsOf(out).card).toBe(8);
    // Froopyland done early too: episode 9 over in the same out, Rick's line and episode 10's card
    const both = feed(s, { type: 'task', id: 'schwifty' }, { known: { tasks: ['fantasy', 'froopyland'], citadel: [] } });
    expect(both.state).toMatchObject({ episode: 9, step: 0 });
    expect(both.out.map((o) => o.type)).toEqual(['done', 'episode', 'step', 'done', 'episode']);
    expect(newsOf(both.out)).toEqual({ say: [{ kind: 'say', who: EPISODES[8].outro[0][0], text: EPISODES[8].outro[0][1] }], card: 9 });
  });

  it('counts the Citadel’s escape done early, and ends episode 10 as Rick walks in', () => {
    // (made on a visit to the Citadel before the story sent him: it's in tp-citadel-done)
    const s = { ...fresh(), episode: 9, step: 0 };
    const known = { tasks: [], citadel: ['daycare', 'wafers', 'council', 'votemorty', 'citadelout'] };
    // the door is never caught up: nothing moves till he's there
    expect(feed(s, { type: 'none' }, { known }).state).toMatchObject({ episode: 9, step: 0 });
    const { state, out } = feed(s, { type: 'enter', area: 'page:/c-137/citadel' }, { known });
    expect(state).toMatchObject({ episode: 10, step: 0 });
    expect(out).toEqual([{ type: 'step', episode: 9, step: 1 }, { type: 'done', episode: 9 }, { type: 'episode', episode: 10 }]);
    // Morty's line, and episode 11's card
    expect(newsOf(out)).toEqual({ say: [{ kind: 'say', who: EPISODES[9].outro[0][0], text: EPISODES[9].outro[0][1] }], card: 10 });
  });

  it('counts Heist-Con done early, and opens episode 12 at the Vindicators', () => {
    // (its old crew assembled before episode 12 came up: it's in tp-c137-done)
    const s = { ...fresh(), episode: 10, step: 0, got: [0, 1, 2] };
    const { state, out } = feed(s, { type: 'task', id: 'squanch' }, { known: { tasks: ['heistcon'], citadel: [] } });
    expect(state).toMatchObject({ episode: 11, step: 1 });
    expect(out).toEqual([{ type: 'done', episode: 10 }, { type: 'episode', episode: 11 }, { type: 'step', episode: 11, step: 1 }]);
    // (episode 12 begun and not over in the same out: Morty's line, and its card)
    expect(newsOf(out)).toEqual({ say: [{ kind: 'say', who: EPISODES[10].outro[0][0], text: EPISODES[10].outro[0][1] }], card: 11 });
    // the Vindicators known, Heist-Con not: it waits at Heist-Con
    expect(feed(s, { type: 'task', id: 'squanch' }, { known: { tasks: ['vindicators'], citadel: [] } }).state).toMatchObject({ episode: 11, step: 0 });
    // both: episode 12 over in the same out, Rick's line and no card (episode 13 isn't built)
    const both = feed(s, { type: 'task', id: 'squanch' }, { known: { tasks: ['heistcon', 'vindicators'], citadel: [] } });
    expect(both.state).toMatchObject({ episode: 12, step: 0 });
    expect(both.out.map((o) => o.type)).toEqual(['done', 'episode', 'step', 'done']);
    expect(newsOf(both.out)).toEqual({ say: [{ kind: 'say', who: EPISODES[11].outro[0][0], text: EPISODES[11].outro[0][1] }], card: null });
  });
});
