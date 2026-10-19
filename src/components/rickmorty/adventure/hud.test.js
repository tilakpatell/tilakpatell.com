import { describe, expect, it } from 'vitest';
import { progress } from '../world/rules';
import { EPISODES } from './episodes';
import { fresh } from './story';
import { DIAL } from '../world/dimensions/destinations';
import { dialItems, dialLead, markedTask, newsOf, objectiveLine } from './hud';

describe('what the HUD shows of the story', () => {
  it('reads the story’s step first, then the checklist’s next', () => {
    const prog = progress([]);
    expect(objectiveLine({ text: 'Find the hatch.', to: null }, prog)).toEqual({ text: 'Find the hatch.', to: null });
    expect(objectiveLine({ text: 'Dial the Citadel.', to: '/c-137/citadel' }, prog)).toEqual({ text: 'Dial the Citadel.', to: '/c-137/citadel' });
    expect(objectiveLine(null, prog)).toEqual({ text: prog.next.hint, to: null });
  });

  it('links the checklist’s closing line to the map, in C-137 only', () => {
    const rest = { next: null, count: 50, total: 54, objective: 'Everything here’s done. The rest are on the planets in the Rick and Morty sector of the universe map.' };
    expect(objectiveLine(null, rest)).toEqual({ text: rest.objective, to: '/universe' });
    const all = { next: null, count: 54, total: 54, objective: 'Everything’s done. Wubba lubba dub dub.' };
    expect(objectiveLine(null, all).to).toBe('/universe');
    // (on a planet the line is its own, with its portal home)
    expect(objectiveLine(null, rest, { planet: { id: 'birdworld' } }).to).toBe(null);
  });

  it('reads the story’s step on a planet only when the step is there', () => {
    const own = { next: { id: 'birdworld' }, count: 0, total: 54, objective: 'Knock at Birdperson’s door.' };
    const wiped = { text: EPISODES[0].steps[0].text, to: null };
    // episode 1's first step is in C-137: on Bird World the line is Bird World's own
    expect(objectiveLine(wiped, own, { planet: { id: 'birdworld' }, state: fresh() })).toEqual({ text: 'Knock at Birdperson’s door.', to: null });
    // in C-137 it's the story's
    expect(objectiveLine(wiped, own, { state: fresh() })).toEqual(wiped);
    // the sector's `all`: on a planet whose part is still to do, the story's line; once that part's done, the planet's own
    const sector = EPISODES.findIndex((e) => e.id === 'sector');
    const at = { ...fresh(), episode: sector, got: [] };
    const line = { text: EPISODES[sector].steps[0].text, to: null };
    expect(objectiveLine(line, own, { planet: { id: 'birdworld' }, state: at, ready: 13 })).toEqual(line);
    expect(objectiveLine(line, own, { planet: { id: 'birdworld' }, state: { ...at, got: [0] }, ready: 13 }).text).toBe('Knock at Birdperson’s door.');
  });

  it('raises an episode’s closing line as a toast, and the next built episode’s card', () => {
    expect(newsOf([{ type: 'step', episode: 0, step: 1 }])).toEqual({ say: [], card: null });
    const [who, text] = EPISODES[0].outro[0];
    expect(newsOf([{ type: 'done', episode: 0 }, { type: 'episode', episode: 1 }])).toEqual({ say: [{ kind: 'say', who, text }], card: 1 });
    expect(newsOf([{ type: 'done', episode: 12 }, { type: 'end' }]).say[0].text).toBe(EPISODES[12].outro[0][1]);
    expect(newsOf([])).toEqual({ say: [], card: null });
  });

  it('says only the last closing line, and shows no card for an episode already over', () => {
    const out = [{ type: 'done', episode: 0 }, { type: 'episode', episode: 1 }, { type: 'step', episode: 1, step: 1 }, { type: 'done', episode: 1 }];
    const [who, text] = EPISODES[1].outro[0];
    expect(newsOf(out)).toEqual({ say: [{ kind: 'say', who, text }], card: null });
  });

  it('points the map’s marker at the story’s task, else the checklist’s next', () => {
    const next = progress([]).next;
    expect(markedTask(fresh(), next)).toEqual({ id: 'diner' });
    expect(markedTask({ ...fresh(), step: 3 }, next)).toEqual({ id: 'customs' });
    // past the last ready episode: the checklist's
    expect(markedTask({ ...fresh(), episode: 4 }, next)).toBe(next);
    ['microverse', 'anatomy'].forEach((id, step) => expect(markedTask({ ...fresh(), episode: 3, step }, next)).toEqual({ id }));
    expect(markedTask({ ...fresh(), episode: 1 }, next)).toEqual({ id: 'roy' });
    ['rickall', 'wong', 'sewer'].forEach((id, step) => expect(markedTask({ ...fresh(), episode: 2, step }, next)).toEqual({ id }));
    // a game to win: the game
    expect(markedTask({ ...fresh(), episode: 1, step: 1 }, next)).toEqual({ id: 'cabinet' });
    // a step that's neither (the Citadel's page): nothing to point at
    const citadel = EPISODES.findIndex((e) => e.id === 'citadel');
    expect(markedTask({ ...fresh(), episode: citadel }, next, { ready: 13 })).toBe(null);
    // an `all`: its first part not done yet
    const sector = EPISODES.findIndex((e) => e.id === 'sector');
    expect(markedTask({ ...fresh(), episode: sector, got: [0] }, next, { ready: 13 })).toEqual({ id: 'gearworld' });
  });

  it('marks the dial’s locked places with the episode that opens them', () => {
    const items = dialItems(DIAL, fresh());
    expect(items).toHaveLength(DIAL.length);
    expect(items.find((d) => d.id === 'customs')).toEqual({ ...DIAL.find((d) => d.id === 'customs'), locked: null });
    expect(items.find((d) => d.id === 'vat').locked).toBe('Opens after episode 5, “Heat”.');
    expect(items.filter((d) => !d.locked).map((d) => d.id)).toEqual(['customs']);
    // free roam, or past the last built episode: nothing locked
    expect(dialItems(DIAL, { ...fresh(), freeRoam: true }).every((d) => d.locked === null)).toBe(true);
    expect(dialItems(DIAL, { ...fresh(), episode: 4 }).every((d) => d.locked === null)).toBe(true);
    // after episode 1, its places, and the next episode's still shut
    const one = dialItems(DIAL, { ...fresh(), episode: 1 });
    expect(one.filter((d) => !d.locked).map((d) => d.id)).toEqual(['annex', 'customs', 'meeseeksgolf']);
    expect(one.find((d) => d.id === 'agency').locked).toBe('Opens after episode 2, “Arcade money”.');
    // after episode 2, likewise
    const two = dialItems(DIAL, { ...fresh(), episode: 2 });
    expect(two.filter((d) => !d.locked).map((d) => d.id)).toEqual(['annex', 'customs', 'simulation', 'agency', 'meeseeksgolf']);
    expect(two.find((d) => d.id === 'microverse').locked).toBe('Opens after episode 3, “House guests”.');
    // after episode 3, likewise
    const three = dialItems(DIAL, { ...fresh(), episode: 3 });
    expect(three.filter((d) => !d.locked).map((d) => d.id)).toEqual(['annex', 'customs', 'microverse', 'anatomy', 'simulation', 'storytrain', 'agency', 'meeseeksgolf']);
    for (const id of ['gromflomites', 'fortress']) expect(three.find((d) => d.id === id).locked).toBe('Opens after episode 4, “Small problems”.');
  });

  it('counts the coordinates home on the dial', () => {
    expect(dialLead(fresh(), DIAL.length)).toBe('Coordinates home: 1 of 32');
    expect(dialLead({ ...fresh(), episode: 1 }, DIAL.length)).toBe('Coordinates home: 3 of 32');
    expect(dialLead({ ...fresh(), episode: 2 }, DIAL.length)).toBe('Coordinates home: 5 of 32');
    expect(dialLead({ ...fresh(), episode: 3 }, DIAL.length)).toBe('Coordinates home: 8 of 32');
    expect(dialLead({ ...fresh(), episode: 4 }, DIAL.length)).toBe('Coordinates home: 32 of 32');
    // (free roam opens the dial, but brings no coordinates home)
    expect(dialLead({ ...fresh(), freeRoam: true }, DIAL.length)).toBe('Coordinates home: 1 of 32');
  });
});
