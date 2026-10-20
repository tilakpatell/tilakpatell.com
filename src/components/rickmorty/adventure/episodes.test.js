import { describe, expect, it } from 'vitest';
import { AREAS, HOTSPOTS, TASKS } from '../world/rules';
import { QUESTS } from '../citadel/story';
import { DESTINATIONS, DIAL } from '../world/dimensions/destinations';
import { EPISODES, READY, START, STEP_TYPES, WINS } from './episodes';

// every step of an episode, an `all`'s parts included
const stepsOf = (e) => e.steps.flatMap((s) => (s.type === 'all' ? [s, ...s.steps] : [s]));
const allSteps = () => EPISODES.flatMap(stepsOf);

describe('the adventure’s episodes', () => {
  it('has thirteen episodes, the first seven ready', () => {
    expect(EPISODES).toHaveLength(13);
    expect(READY).toBe(7);
    expect(new Set(EPISODES.map((e) => e.id)).size).toBe(13);
  });

  it('knows every step it waits for', () => {
    const tasks = new Set(TASKS.map((t) => t.id));
    const quests = new Set(QUESTS.map((q) => q.id));
    for (const s of allSteps()) {
      expect(STEP_TYPES).toContain(s.type);
      if (s.type === 'task') expect(tasks.has(s.id), s.id).toBe(true);
      if (s.type === 'citadel') expect(quests.has(s.id), s.id).toBe(true);
      if (s.type === 'win') expect(WINS).toContain(s.game);
      if (s.type === 'enter') expect(s.area in AREAS || s.area.startsWith('page:'), s.area).toBe(true);
      if (s.type === 'use') expect(HOTSPOTS.some((h) => h.id === s.id), s.id).toBe(true);
      if (s.type === 'all') expect(s.steps.length).toBeGreaterThan(1);
      expect(s.text.length).toBeGreaterThan(10);
      expect(s.text).not.toMatch(/!/);
    }
  });

  it('sends a step to the dial place its task is in', () => {
    const dial = new Set(DIAL.map((d) => d.id));
    for (const s of allSteps()) {
      if (s.place) expect(dial.has(s.place), s.place).toBe(true);
      const home = s.type === 'task' && DESTINATIONS.find((d) => d.tasks.some((t) => t.id === s.id));
      if (home) expect(s.place, s.id).toBe(home.id);
    }
  });

  it('opens every dial place, each once', () => {
    const opened = [...START, ...EPISODES.flatMap((e) => e.unlocks)];
    expect(START).toEqual(['customs']);
    expect(new Set(opened).size).toBe(opened.length);
    expect(new Set(opened)).toEqual(new Set(DIAL.map((d) => d.id)));
  });

  it('opens a step’s place before the step comes up', () => {
    EPISODES.forEach((e, i) => {
      const open = new Set([...START, ...EPISODES.slice(0, i).flatMap((x) => x.unlocks)]);
      for (const s of stepsOf(e)) if (s.place) expect(open.has(s.place), `${e.id}: ${s.place}`).toBe(true);
    });
  });

  it('gives each episode a title, and lines to open and close it in the site’s voice', () => {
    for (const e of EPISODES) {
      expect(e.title.length).toBeGreaterThan(2);
      for (const lines of [e.intro, e.outro]) {
        expect(lines.length, e.id).toBeGreaterThan(0);
        for (const [who, text] of lines) {
          expect(['Rick', 'Morty']).toContain(who);
          expect(text.length).toBeGreaterThan(10);
          expect(text).not.toMatch(/!|'|"/);
        }
      }
    }
  });

  it('starts with Wiped, from the street to Customs', () => {
    const [wiped] = EPISODES;
    expect(wiped.title).toBe('Wiped');
    expect(wiped.steps.map((s) => s.id)).toEqual(['diner', 'basement', 'mindblowers', 'customs']);
    expect(wiped.unlocks).toEqual(['annex', 'meeseeksgolf']);
    expect(wiped.steps[0].text).toBe('A Federation agent is in a booth at Shoney’s, up the street. Find out what the raid took.');
  });

  it('goes on with Arcade money: Roy, then a walkway cabinet’s target', () => {
    const arcade = EPISODES[1];
    expect(arcade.title).toBe('Arcade money');
    expect(arcade.steps.map((s) => s.id ?? s.game)).toEqual(['roy', 'cabinet']);
    expect(arcade.steps[1]).toMatchObject({ type: 'win', game: 'cabinet', place: 'annex' });
    expect(arcade.unlocks).toEqual(['agency', 'simulation']);
  });

  it('goes on with House guests: Total Rickall, Dr. Wong, then the sewer', () => {
    const guests = EPISODES[2];
    expect(guests.title).toBe('House guests');
    expect(guests.steps.map((s) => s.id)).toEqual(['rickall', 'wong', 'sewer']);
    expect(guests.steps[2]).toMatchObject({ type: 'task', id: 'sewer', place: 'agency' });
    expect(guests.unlocks).toEqual(['microverse', 'anatomy', 'storytrain']);
  });

  it('goes on with Small problems: the Microverse, then Anatomy Park', () => {
    const small = EPISODES[3];
    expect(small.title).toBe('Small problems');
    expect(small.steps.map((s) => s.id)).toEqual(['microverse', 'anatomy']);
    expect(small.steps[0]).toMatchObject({ type: 'task', id: 'microverse', place: 'microverse' });
    expect(small.steps[1]).toMatchObject({ type: 'task', id: 'anatomy', place: 'anatomy' });
    expect(small.unlocks).toEqual(['gromflomites', 'fortress']);
  });

  it('goes on with Heat: the cruiser’s chase, then the Gromflomite base', () => {
    const heat = EPISODES[4];
    expect(heat.title).toBe('Heat');
    expect(heat.steps.map((s) => s.id ?? s.game)).toEqual(['chase', 'gromflomites']);
    expect(heat.steps[0]).toMatchObject({ type: 'win', game: 'chase' });
    expect(heat.steps[0].place).toBe(undefined); // (the cruiser's in the street: no dial place)
    expect(heat.steps[1]).toMatchObject({ type: 'task', id: 'gromflomites', place: 'gromflomites' });
    expect(heat.unlocks).toEqual(['needful', 'vat', 'nimbus']);
  });

  it('goes on with Bad deals: Needful Things, then the vat of acid', () => {
    const deals = EPISODES[5];
    expect(deals.title).toBe('Bad deals');
    expect(deals.steps.map((s) => s.id)).toEqual(['needful', 'vat']);
    expect(deals.steps[0]).toMatchObject({ type: 'task', id: 'needful', place: 'needful' });
    expect(deals.steps[1]).toMatchObject({ type: 'task', id: 'vat', place: 'vat' });
    expect(deals.unlocks).toEqual(['jerryboree', 'gloopynoops', 'prison']);
  });

  it('goes on with The Jerry problem: the Jerryboree, then St. Gloopy Noops', () => {
    const jerry = EPISODES[6];
    expect(jerry.title).toBe('The Jerry problem');
    expect(jerry.steps.map((s) => s.id)).toEqual(['jerryboree', 'gloopynoops']);
    expect(jerry.steps[0]).toMatchObject({ type: 'task', id: 'jerryboree', place: 'jerryboree' });
    expect(jerry.steps[1]).toMatchObject({ type: 'task', id: 'gloopynoops', place: 'gloopynoops' });
    expect(jerry.unlocks).toEqual(['cablestudio', 'schwifty', 'dream']);
  });
});
