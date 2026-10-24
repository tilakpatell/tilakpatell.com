import { describe, expect, it } from 'vitest';
import { progress } from '../world/rules';
import { EPISODES } from './episodes';
import { fresh } from './story';
import { DIAL } from '../world/dimensions/destinations';
import { SAID_MS, dialItems, dialLead, leaveHold, markedTask, newsOf, objectiveLine } from './hud';

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
    // the sector's `all`: on a planet whose part is still to do, that part's line; once that part's done, the planet's own
    const sector = EPISODES.findIndex((e) => e.id === 'sector');
    const at = { ...fresh(), episode: sector, got: [] };
    const line = { text: EPISODES[sector].steps[0].text, to: null };
    expect(objectiveLine(line, own, { planet: { id: 'birdworld' }, state: at, ready: 13 })).toEqual({ text: EPISODES[sector].steps[0].steps[0].text, to: null });
    expect(objectiveLine(line, own, { planet: { id: 'birdworld' }, state: { ...at, got: [0] }, ready: 13 }).text).toBe('Knock at Birdperson’s door.');
  });

  it('reads the sector part of the planet Morty’s on, dialled or landed on, and the episode’s line elsewhere', () => {
    const sector = EPISODES.findIndex((e) => e.id === 'sector');
    const own = { next: null, count: 0, total: 54, objective: 'Everything here’s done.' };
    const at = { ...fresh(), episode: sector, got: [] };
    const line = { text: 'Four sets are out on the sector’s planets. Dial each one.', to: null };
    expect(EPISODES[sector].steps[0].text).toBe(line.text);
    // (dialled from C-137: where he is says which)
    expect(objectiveLine(line, own, { here: 'garage', state: at, ready: 13 })).toEqual(line);
    expect(['birdworld', 'gearworld', 'pluto', 'squanch'].map((here) => objectiveLine(line, own, { here, state: at, ready: 13 }))).toEqual([
      { text: 'Bird World: pick up the crystals in the grass and on the clay towers’ tops.', to: null },
      { text: 'Gear World: wind the city’s cogs in order while the gear police hunt you.', to: null },
      { text: 'Pluto: tell the king what he wants to hear, and only the true parts.', to: null },
      { text: 'Planet Squanch: raise a glass at the wedding, then get back to the portal in time.', to: null },
    ]);
    // (a dialled planet whose part is done: the episode's line again)
    expect(objectiveLine(line, own, { here: 'pluto', state: { ...at, got: [2] }, ready: 13 })).toEqual(line);
    // (landed on from the map: the planet's page says which, wherever `here` is)
    expect(objectiveLine(line, own, { planet: { id: 'squanch' }, here: 'squanch', state: at, ready: 13 }).text).toBe('Planet Squanch: raise a glass at the wedding, then get back to the portal in time.');
    // (with no story, the checklist's line, as ever)
    expect(objectiveLine(null, own, { here: 'pluto', state: at, ready: 13 })).toEqual({ text: own.objective, to: '/universe' });
  });

  it('points the marker at the sector part of the planet Morty’s on, else the first part still to do', () => {
    const sector = EPISODES.findIndex((e) => e.id === 'sector');
    const at = { ...fresh(), episode: sector, got: [] };
    const next = progress([]).next;
    expect(markedTask(at, next, { ready: 13 })).toEqual({ id: 'birdworld' });
    expect(markedTask(at, next, { here: 'garage', ready: 13 })).toEqual({ id: 'birdworld' });
    expect(markedTask(at, next, { here: 'pluto', ready: 13 })).toEqual({ id: 'pluto' });
    expect(markedTask({ ...at, got: [0] }, next, { here: 'squanch', ready: 13 })).toEqual({ id: 'squanch' });
    // (its part done: the first still to do, whose way from here is the planet's portal)
    expect(markedTask({ ...at, got: [2] }, next, { here: 'pluto', ready: 13 })).toEqual({ id: 'birdworld' });
    expect(markedTask({ ...at, got: [0, 2] }, next, { here: 'pluto', ready: 13 })).toEqual({ id: 'gearworld' });
  });

  it('raises an episode’s closing line as a toast, and the next built episode’s card', () => {
    expect(newsOf([{ type: 'step', episode: 0, step: 1 }])).toEqual({ say: [], card: null });
    const [who, text] = EPISODES[0].outro[0];
    expect(newsOf([{ type: 'done', episode: 0 }, { type: 'episode', episode: 1 }])).toEqual({ say: [{ kind: 'say', who, text }], card: 1 });
    expect(newsOf([{ type: 'done', episode: 12 }, { type: 'end' }]).say[0].text).toBe(EPISODES[12].outro[0][1]);
    expect(newsOf([])).toEqual({ say: [], card: null });
  });

  it('holds a page that’s leaving long enough for an episode’s closing line, and no longer for anything else', () => {
    expect(SAID_MS).toBe(4000);
    expect(leaveHold([{ type: 'step', episode: 10, step: 0 }, { type: 'done', episode: 10 }, { type: 'episode', episode: 11 }])).toBe(4000);
    expect(leaveHold([{ type: 'step', episode: 10, step: 0 }])).toBe(0);
    expect(leaveHold([{ type: 'episode', episode: 11 }])).toBe(0);
    expect(leaveHold([])).toBe(0);
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
    expect(markedTask({ ...fresh(), episode: 12 }, next)).toBe(next);
    // episode 12: Heist-Con, then the Vindicators
    ['heistcon', 'vindicators'].forEach((id, step) => expect(markedTask({ ...fresh(), episode: 11, step }, next)).toEqual({ id }));
    // episode 11: the sector's first planet still to do
    expect(markedTask({ ...fresh(), episode: 10 }, next)).toEqual({ id: 'birdworld' });
    // episode 10: both steps the Citadel's page (the line's a link there): nothing to point at
    [0, 1].forEach((step) => expect(markedTask({ ...fresh(), episode: 9, step }, next)).toBe(null));
    // episode 9: Fantasy World, then Froopyland
    ['fantasy', 'froopyland'].forEach((id, step) => expect(markedTask({ ...fresh(), episode: 8, step }, next)).toEqual({ id }));
    // episode 8: the cable studio, then Get Schwifty
    ['cablestudio', 'schwifty'].forEach((id, step) => expect(markedTask({ ...fresh(), episode: 7, step }, next)).toEqual({ id }));
    // episode 7: the Jerryboree, then St. Gloopy Noops
    ['jerryboree', 'gloopynoops'].forEach((id, step) => expect(markedTask({ ...fresh(), episode: 6, step }, next)).toEqual({ id }));
    // episode 6: Needful Things, then the vat
    ['needful', 'vat'].forEach((id, step) => expect(markedTask({ ...fresh(), episode: 5, step }, next)).toEqual({ id }));
    // episode 5: the chase to win (RmWorld's GOAL has it at the cruiser), then the Gromflomite base
    expect(markedTask({ ...fresh(), episode: 4 }, next)).toEqual({ id: 'chase' });
    expect(markedTask({ ...fresh(), episode: 4, step: 1 }, next)).toEqual({ id: 'gromflomites' });
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
    expect(dialItems(DIAL, { ...fresh(), episode: 12 }).every((d) => d.locked === null)).toBe(true);
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
    // after episode 4, likewise
    const four = dialItems(DIAL, { ...fresh(), episode: 4 });
    expect(four.filter((d) => !d.locked).map((d) => d.id)).toEqual(['annex', 'customs', 'microverse', 'anatomy', 'simulation', 'storytrain', 'fortress', 'gromflomites', 'agency', 'meeseeksgolf']);
    for (const id of ['needful', 'vat', 'nimbus']) expect(four.find((d) => d.id === id).locked).toBe('Opens after episode 5, “Heat”.');
    // after episode 5, likewise
    const five = dialItems(DIAL, { ...fresh(), episode: 5 });
    expect(five.filter((d) => !d.locked).map((d) => d.id)).toEqual(['annex', 'customs', 'microverse', 'anatomy', 'needful', 'simulation', 'storytrain', 'fortress', 'nimbus', 'gromflomites', 'agency', 'meeseeksgolf', 'vat']);
    for (const id of ['jerryboree', 'gloopynoops', 'prison']) expect(five.find((d) => d.id === id).locked).toBe('Opens after episode 6, “Bad deals”.');
    // after episode 6, likewise
    const six = dialItems(DIAL, { ...fresh(), episode: 6 });
    expect(six.filter((d) => !d.locked).map((d) => d.id)).toEqual(['annex', 'customs', 'microverse', 'anatomy', 'needful', 'jerryboree', 'simulation', 'storytrain', 'fortress', 'nimbus', 'gromflomites', 'gloopynoops', 'prison', 'agency', 'meeseeksgolf', 'vat']);
    for (const id of ['cablestudio', 'schwifty', 'dream']) expect(six.find((d) => d.id === id).locked).toBe('Opens after episode 7, “The Jerry problem”.');
    // after episode 7, likewise
    const seven = dialItems(DIAL, { ...fresh(), episode: 7 });
    expect(seven.filter((d) => !d.locked).map((d) => d.id)).toEqual(['annex', 'customs', 'microverse', 'anatomy', 'needful', 'jerryboree', 'simulation', 'storytrain', 'fortress', 'nimbus', 'gromflomites', 'gloopynoops', 'schwifty', 'prison', 'cablestudio', 'dream', 'agency', 'meeseeksgolf', 'vat']);
    for (const id of ['fantasy', 'froopyland', 'dim35c']) expect(seven.find((d) => d.id === id).locked).toBe('Opens after episode 8, “Prime time”.');
    // after episode 8, likewise
    const eight = dialItems(DIAL, { ...fresh(), episode: 8 });
    expect(eight.filter((d) => !d.locked).map((d) => d.id)).toEqual(['annex', 'customs', 'fantasy', 'microverse', 'anatomy', 'needful', 'jerryboree', 'simulation', 'storytrain', 'fortress', 'froopyland', 'nimbus', 'gromflomites', 'gloopynoops', 'schwifty', 'prison', 'cablestudio', 'dream', 'agency', 'meeseeksgolf', 'vat', 'dim35c']);
    for (const id of ['citadel', 'frundles']) expect(eight.find((d) => d.id === id).locked).toBe('Opens after episode 9, “Fairy tales”.');
    // after episode 9: those, the Citadel and Frundles; the sector's four wait on episode 10
    const nine = dialItems(DIAL, { ...fresh(), episode: 9 });
    const opened = new Set([...eight.filter((d) => !d.locked).map((d) => d.id), 'citadel', 'frundles']);
    expect(opened.size).toBe(24);
    expect(nine.filter((d) => !d.locked).map((d) => d.id)).toEqual(DIAL.map((d) => d.id).filter((id) => opened.has(id)));
    for (const id of ['birdworld', 'gearworld', 'pluto', 'squanch']) expect(nine.find((d) => d.id === id).locked).toBe('Opens after episode 10, “The Citadel”.');
    // after episode 10: those and the sector's four; Heist-Con and the Vindicators wait on episode 11, the last two on episode 12
    const ten = dialItems(DIAL, { ...fresh(), episode: 10 });
    const sector = new Set([...opened, 'birdworld', 'gearworld', 'pluto', 'squanch']);
    expect(sector.size).toBe(28);
    expect(ten.filter((d) => !d.locked).map((d) => d.id)).toEqual(DIAL.map((d) => d.id).filter((id) => sector.has(id)));
    for (const id of ['heistcon', 'vindicators']) expect(ten.find((d) => d.id === id).locked).toBe('Opens after episode 11, “The sector”.');
    for (const id of ['blooddome', 'evilrick']) expect(ten.find((d) => d.id === id).locked).toBe('Opens after episode 12, “Big score”.');
    // after episode 11: those, Heist-Con and the Vindicators; the last two still wait on episode 12
    const eleven = dialItems(DIAL, { ...fresh(), episode: 11 });
    const big = new Set([...sector, 'heistcon', 'vindicators']);
    expect(big.size).toBe(30);
    expect(eleven.filter((d) => !d.locked).map((d) => d.id)).toEqual(DIAL.map((d) => d.id).filter((id) => big.has(id)));
    for (const id of ['blooddome', 'evilrick']) expect(eleven.find((d) => d.id === id).locked).toBe('Opens after episode 12, “Big score”.');
  });

  it('counts the coordinates home on the dial', () => {
    expect(dialLead(fresh(), DIAL.length)).toBe('Coordinates home: 1 of 32');
    expect(dialLead({ ...fresh(), episode: 1 }, DIAL.length)).toBe('Coordinates home: 3 of 32');
    expect(dialLead({ ...fresh(), episode: 2 }, DIAL.length)).toBe('Coordinates home: 5 of 32');
    expect(dialLead({ ...fresh(), episode: 3 }, DIAL.length)).toBe('Coordinates home: 8 of 32');
    expect(dialLead({ ...fresh(), episode: 4 }, DIAL.length)).toBe('Coordinates home: 10 of 32');
    expect(dialLead({ ...fresh(), episode: 5 }, DIAL.length)).toBe('Coordinates home: 13 of 32');
    expect(dialLead({ ...fresh(), episode: 6 }, DIAL.length)).toBe('Coordinates home: 16 of 32');
    expect(dialLead({ ...fresh(), episode: 7 }, DIAL.length)).toBe('Coordinates home: 19 of 32');
    expect(dialLead({ ...fresh(), episode: 8 }, DIAL.length)).toBe('Coordinates home: 22 of 32');
    expect(dialLead({ ...fresh(), episode: 9 }, DIAL.length)).toBe('Coordinates home: 24 of 32');
    expect(dialLead({ ...fresh(), episode: 10 }, DIAL.length)).toBe('Coordinates home: 28 of 32');
    expect(dialLead({ ...fresh(), episode: 11 }, DIAL.length)).toBe('Coordinates home: 30 of 32');
    expect(dialLead({ ...fresh(), episode: 12 }, DIAL.length)).toBe('Coordinates home: 32 of 32');
    // (free roam opens the dial, but brings no coordinates home)
    expect(dialLead({ ...fresh(), freeRoam: true }, DIAL.length)).toBe('Coordinates home: 1 of 32');
  });
});
