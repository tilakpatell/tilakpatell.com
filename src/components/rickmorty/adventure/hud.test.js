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
    expect(objectiveLine(null, rest, { planet: true }).to).toBe(null);
  });

  it('raises an episode’s closing line as a toast, and the next built episode’s card', () => {
    expect(newsOf([{ type: 'step', episode: 0, step: 1 }])).toEqual({ say: [], card: null });
    const [who, text] = EPISODES[0].outro[0];
    expect(newsOf([{ type: 'done', episode: 0 }, { type: 'episode', episode: 1 }])).toEqual({ say: [{ kind: 'say', who, text }], card: 1 });
    expect(newsOf([{ type: 'done', episode: 12 }, { type: 'end' }]).say[0].text).toBe(EPISODES[12].outro[0][1]);
    expect(newsOf([])).toEqual({ say: [], card: null });
  });

  it('points the map’s marker at the story’s task, else the checklist’s next', () => {
    const next = progress([]).next;
    expect(markedTask(fresh(), next)).toEqual({ id: 'diner' });
    expect(markedTask({ ...fresh(), step: 3 }, next)).toEqual({ id: 'customs' });
    // past the last ready episode: the checklist's
    expect(markedTask({ ...fresh(), episode: 1 }, next)).toBe(next);
    // a step that isn't a task: nothing to point at
    expect(markedTask({ ...fresh(), episode: 1 }, next, { ready: 2 })).toEqual({ id: 'roy' });
    expect(markedTask({ ...fresh(), episode: 1, step: 1 }, next, { ready: 2 })).toBe(null);
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
    expect(dialItems(DIAL, { ...fresh(), episode: 1 }).every((d) => d.locked === null)).toBe(true);
  });

  it('counts the coordinates home on the dial', () => {
    expect(dialLead(fresh(), DIAL.length)).toBe('Coordinates home: 1 of 32');
    expect(dialLead({ ...fresh(), episode: 1 }, DIAL.length)).toBe('Coordinates home: 32 of 32');
    // (free roam opens the dial, but brings no coordinates home)
    expect(dialLead({ ...fresh(), freeRoam: true }, DIAL.length)).toBe('Coordinates home: 1 of 32');
  });
});
