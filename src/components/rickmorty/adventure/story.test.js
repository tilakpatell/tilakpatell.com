import { describe, expect, it } from 'vitest';
import { EPISODES } from './episodes';
import { coordinates, current, dialOpen, feed, fresh, lockNote, objective, valid } from './story';
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

  it('opens episode 3’s places after episode 2, and every place once episode 3, the last built, is done', () => {
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
    expect(out).toEqual([{ type: 'done', episode: 2 }]); // (no card: episode 4 isn't built)
    for (const id of ['annex', 'agency', 'microverse', 'vat', 'citadel', 'squanch', 'evilrick']) expect(dialOpen(s, id), id).toBe(true);
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
    expect(newsOf(three.out)).toEqual({ say: [{ kind: 'say', who: EPISODES[2].outro[0][0], text: EPISODES[2].outro[0][1] }], card: null });
  });
});
