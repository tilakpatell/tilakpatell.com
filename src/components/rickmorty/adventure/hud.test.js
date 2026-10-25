import { describe, expect, it } from 'vitest';
import { progress } from '../world/rules';
import { EPISODES } from './episodes';
import { fresh } from './story';
import { DIAL } from '../world/dimensions/destinations';
import { createToastSlot, readMs } from '../world/toastSlot';
import { SAID_MS, STORY_DONE, caughtNote, dialItems, dialLead, leaveHold, listNext, listTab, markedTask, newsOf, objectiveLine, passesCard, showNews } from './hud';
import { listOf } from '../world/planetMode';

describe('what the HUD shows of the story', () => {
  it('reads the story’s step first, then the checklist’s next', () => {
    const prog = progress([]);
    expect(objectiveLine({ text: 'Find the hatch.', to: null }, prog)).toEqual({ text: 'Find the hatch.', to: null });
    expect(objectiveLine({ text: 'Dial the Citadel.', to: '/c-137/citadel' }, prog)).toEqual({ text: 'Dial the Citadel.', to: '/c-137/citadel' });
    expect(objectiveLine(null, prog)).toEqual({ text: prog.next.hint, to: null });
  });

  it('holds the story’s own last word while its end card is up, then the checklist’s next', () => {
    const prog = progress([]);
    expect(STORY_DONE).toBe('That’s the whole story: the Checklist tab has the rest.');
    expect(objectiveLine(null, prog, { ended: true })).toEqual({ text: STORY_DONE, to: null });
    expect(objectiveLine(null, prog, {})).toEqual({ text: prog.objective, to: null });
  });

  it('lights the story’s task in the Checklist, else the checklist’s next', () => {
    const { rows } = listOf(null, []);
    const next = progress([]).next;
    expect(next.id).toBe('cable');
    expect(listNext(fresh(), next, rows)).toEqual({ id: 'diner' });
    // (a step that's a game won isn't a row: the checklist's own next)
    expect(listNext({ ...fresh(), episode: 1, step: 1 }, next, rows)).toBe(next);
    expect(listNext({ ...fresh(), episode: 13 }, next, rows)).toBe(next);
  });

  it('opens Things to do on the Checklist once the story’s over, on the Story tab till then', () => {
    expect(listTab(fresh())).toBe('story');
    expect(listTab({ ...fresh(), episode: 12, step: 3 })).toBe('story');
    expect(listTab({ ...fresh(), episode: 13 })).toBe('checklist');
  });

  it('links the checklist’s closing line to the map, in C-137 only', () => {
    const rest = { next: null, count: 50, total: 54, objective: 'Everything here’s done. The rest are on the planets in the Rick and Morty sector of the universe map (Bird World, Gear World, Pluto and Planet Squanch are on the portal gun too).' };
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
    expect(newsOf([{ type: 'step', episode: 0, step: 1 }])).toEqual({ say: [], card: null, caught: [] });
    const [who, text] = EPISODES[0].outro[0];
    expect(newsOf([{ type: 'done', episode: 0 }, { type: 'episode', episode: 1 }])).toEqual({ say: [{ kind: 'say', who, text }], card: 1, caught: [] });
    expect(newsOf([{ type: 'done', episode: 12 }, { type: 'end' }])).toEqual({ say: [{ kind: 'say', who: EPISODES[12].outro[0][0], text: EPISODES[12].outro[0][1] }], card: EPISODES.length, caught: [] });
    expect(newsOf([])).toEqual({ say: [], card: null, caught: [] });
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
    expect(newsOf(out)).toEqual({ say: [{ kind: 'say', who, text }], card: null, caught: [0] });
  });

  it('names the episodes an out ended before its last one: caught up, from before', () => {
    // (a returner beats the cabinet with Wong, the sewer, the Microverse and Anatomy Park done: episodes 2, 3 and 4 end)
    const out = [1, 2, 3].flatMap((e) => [{ type: 'done', episode: e }, { type: 'episode', episode: e + 1 }]);
    const news = newsOf(out);
    expect(news.caught).toEqual([1, 2]);
    expect(news.say.map((t) => t.text)).toEqual([EPISODES[3].outro[0][1]]);
    expect(news.card).toBe(4);
    expect(caughtNote([1, 2])).toBe('Episodes 2 and 3 done already, from what you’d played before.');
    expect(caughtNote([3])).toBe('Episode 4 done already, from what you’d played before.');
    expect(caughtNote([1, 2, 3])).toBe('Episodes 2, 3 and 4 done already, from what you’d played before.');
    expect(caughtNote([])).toBe(null);
  });

  it('says what an out caught up on ahead of its closing line, and the line once that’s been read', () => {
    let now = 0;
    const timers = [];
    const shown = [];
    const slot = createToastSlot({ show: (t) => shown.push([t.kind, t.text, now]), now: () => now, later: (fn, ms) => timers.push({ at: now + ms, fn }), cancel: () => {} });
    const run = (t) => {
      for (let due; (due = timers.sort((a, b) => a.at - b.at)[0]) && due.at <= t; ) {
        timers.shift();
        now = due.at;
        due.fn();
      }
      now = t;
    };
    const cards = [];
    const out = [1, 2, 3].flatMap((e) => [{ type: 'done', episode: e }, { type: 'episode', episode: e + 1 }]);
    showNews(newsOf(out), slot.put, (n) => cards.push([n, now]));
    const note = caughtNote([1, 2]);
    expect(shown).toEqual([['say', note, 0]]);
    expect(cards).toEqual([]);
    run(readMs(note) + 8000);
    expect(shown).toEqual([
      ['say', note, 0],
      ['say', EPISODES[3].outro[0][1], readMs(note)],
    ]);
    expect(cards).toEqual([[4, readMs(note)]]);
  });

  it('opens an episode’s card as the closing line it comes with goes up, not before it', () => {
    // a clock and its timers, run by hand, and C-137's toast slot on it
    let now = 0;
    const timers = [];
    const slot = createToastSlot({ show: (t) => shown.push([t.text, now]), now: () => now, later: (fn, ms) => timers.push({ at: now + ms, fn }), cancel: () => {} });
    const run = (t) => {
      for (let due; (due = timers.sort((a, b) => a.at - b.at)[0]) && due.at <= t; ) {
        timers.shift();
        now = due.at;
        due.fn();
      }
      now = t;
    };
    const shown = [];
    const cards = [];
    const open = (n) => cards.push([n, now]);
    // (Rick's rooms: the won line's up as the episode ends)
    const WON = 'A recording of Rick, very drunk: “If you’re hearing this, the Vindicators got me. Go to the bench, Morty.” Rick looks at the floor.';
    slot.put({ kind: 'say', who: 'Rick', text: WON });
    run(500);
    showNews(newsOf([{ type: 'done', episode: 11 }, { type: 'episode', episode: 12 }]), slot.put, open);
    expect(cards).toEqual([]);
    run(readMs(WON) - 1);
    expect(cards).toEqual([]);
    run(readMs(WON) + 8000);
    expect(shown.at(-1)).toEqual([EPISODES[11].outro[0][1], readMs(WON)]);
    expect(cards).toEqual([[12, readMs(WON)]]);
    // (no closing line: the card at once; no card: the line alone)
    showNews(newsOf([{ type: 'episode', episode: 1 }]), slot.put, open);
    expect(cards.at(-1)).toEqual([1, now]);
    // (the story's end: its card, the one after the last episode, with Rick's last line)
    showNews(newsOf([{ type: 'done', episode: 12 }, { type: 'end' }]), slot.put, open);
    expect(cards.at(-1)).toEqual([EPISODES.length, now]);
    expect(shown.at(-1)[0]).toBe(EPISODES[12].outro[0][1]);
  });

  it('marks a hotspot to use, never a talk or a walk in', () => {
    const next = { id: 'cable' };
    const episodes = [{ id: 'x', title: 'X', intro: [], outro: [], unlocks: [], steps: [{ type: 'use', id: 'dial', text: 'Put it back.' }, { type: 'talk', who: 'rick', text: 'Talk.' }, { type: 'enter', area: 'garage', text: 'Go in.' }] }];
    expect([0, 1, 2].map((step) => markedTask({ ...fresh(), step }, next, { episodes, ready: 1 }))).toEqual([{ id: 'dial' }, null, null]);
    // (episode 13's last step: the gun back on Rick's bench, every coordinate home already)
    expect(markedTask({ ...fresh(), episode: 12, step: 3 }, next, { ready: 13 })).toEqual({ id: 'dial' });
    expect(dialLead({ ...fresh(), episode: 13 }, DIAL.length)).toBe('Coordinates on the gun: 32 of 32');
    expect(dialItems(DIAL, { ...fresh(), episode: 13 }).every((d) => d.locked === null)).toBe(true);
  });

  it('points the map’s marker at the story’s task, else the checklist’s next', () => {
    const next = progress([]).next;
    expect(markedTask(fresh(), next)).toEqual({ id: 'diner' });
    expect(markedTask({ ...fresh(), step: 3 }, next)).toEqual({ id: 'customs' });
    // past the last ready episode: the checklist's (episode 12 done, with 13 not built; the story's end)
    expect(markedTask({ ...fresh(), episode: 12 }, next, { ready: 12 })).toBe(next);
    expect(markedTask({ ...fresh(), episode: 13 }, next)).toBe(next);
    // episode 13: the Blood Dome, Evil Rick, the Morty with the eyepatch, then Rick's bench
    ['blooddome', 'evilrick', 'evilmorty', 'dial'].forEach((id, step) => expect(markedTask({ ...fresh(), episode: 12, step }, next)).toEqual({ id }));
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
    expect(items.find((d) => d.id === 'vat').locked).toBe('Opens after episode 5, “Heat”. Free roam, in Things to do, opens it now.');
    expect(items.filter((d) => !d.locked).map((d) => d.id)).toEqual(['customs']);
    // free roam, or episode 12 done: nothing locked
    expect(dialItems(DIAL, { ...fresh(), freeRoam: true }).every((d) => d.locked === null)).toBe(true);
    expect(dialItems(DIAL, { ...fresh(), episode: 12 }).every((d) => d.locked === null)).toBe(true);
    // after episode 1, its places, and the next episode's still shut
    const one = dialItems(DIAL, { ...fresh(), episode: 1 });
    expect(one.filter((d) => !d.locked).map((d) => d.id)).toEqual(['annex', 'customs', 'meeseeksgolf']);
    expect(one.find((d) => d.id === 'agency').locked).toBe('Opens after episode 2, “Arcade money”. Free roam, in Things to do, opens it now.');
    // after episode 2, likewise
    const two = dialItems(DIAL, { ...fresh(), episode: 2 });
    expect(two.filter((d) => !d.locked).map((d) => d.id)).toEqual(['annex', 'customs', 'simulation', 'agency', 'meeseeksgolf']);
    expect(two.find((d) => d.id === 'microverse').locked).toBe('Opens after episode 3, “House guests”. Free roam, in Things to do, opens it now.');
    // after episode 3, likewise
    const three = dialItems(DIAL, { ...fresh(), episode: 3 });
    expect(three.filter((d) => !d.locked).map((d) => d.id)).toEqual(['annex', 'customs', 'microverse', 'anatomy', 'simulation', 'storytrain', 'agency', 'meeseeksgolf']);
    for (const id of ['gromflomites', 'fortress']) expect(three.find((d) => d.id === id).locked).toBe('Opens after episode 4, “Small problems”. Free roam, in Things to do, opens it now.');
    // after episode 4, likewise
    const four = dialItems(DIAL, { ...fresh(), episode: 4 });
    expect(four.filter((d) => !d.locked).map((d) => d.id)).toEqual(['annex', 'customs', 'microverse', 'anatomy', 'simulation', 'storytrain', 'fortress', 'gromflomites', 'agency', 'meeseeksgolf']);
    for (const id of ['needful', 'vat', 'nimbus']) expect(four.find((d) => d.id === id).locked).toBe('Opens after episode 5, “Heat”. Free roam, in Things to do, opens it now.');
    // after episode 5, likewise
    const five = dialItems(DIAL, { ...fresh(), episode: 5 });
    expect(five.filter((d) => !d.locked).map((d) => d.id)).toEqual(['annex', 'customs', 'microverse', 'anatomy', 'needful', 'simulation', 'storytrain', 'fortress', 'nimbus', 'gromflomites', 'agency', 'meeseeksgolf', 'vat']);
    for (const id of ['jerryboree', 'gloopynoops', 'prison']) expect(five.find((d) => d.id === id).locked).toBe('Opens after episode 6, “Bad deals”. Free roam, in Things to do, opens it now.');
    // after episode 6, likewise
    const six = dialItems(DIAL, { ...fresh(), episode: 6 });
    expect(six.filter((d) => !d.locked).map((d) => d.id)).toEqual(['annex', 'customs', 'microverse', 'anatomy', 'needful', 'jerryboree', 'simulation', 'storytrain', 'fortress', 'nimbus', 'gromflomites', 'gloopynoops', 'prison', 'agency', 'meeseeksgolf', 'vat']);
    for (const id of ['cablestudio', 'schwifty', 'dream']) expect(six.find((d) => d.id === id).locked).toBe('Opens after episode 7, “The Jerry problem”. Free roam, in Things to do, opens it now.');
    // after episode 7, likewise
    const seven = dialItems(DIAL, { ...fresh(), episode: 7 });
    expect(seven.filter((d) => !d.locked).map((d) => d.id)).toEqual(['annex', 'customs', 'microverse', 'anatomy', 'needful', 'jerryboree', 'simulation', 'storytrain', 'fortress', 'nimbus', 'gromflomites', 'gloopynoops', 'schwifty', 'prison', 'cablestudio', 'dream', 'agency', 'meeseeksgolf', 'vat']);
    for (const id of ['fantasy', 'froopyland', 'dim35c']) expect(seven.find((d) => d.id === id).locked).toBe('Opens after episode 8, “Prime time”. Free roam, in Things to do, opens it now.');
    // after episode 8, likewise
    const eight = dialItems(DIAL, { ...fresh(), episode: 8 });
    expect(eight.filter((d) => !d.locked).map((d) => d.id)).toEqual(['annex', 'customs', 'fantasy', 'microverse', 'anatomy', 'needful', 'jerryboree', 'simulation', 'storytrain', 'fortress', 'froopyland', 'nimbus', 'gromflomites', 'gloopynoops', 'schwifty', 'prison', 'cablestudio', 'dream', 'agency', 'meeseeksgolf', 'vat', 'dim35c']);
    for (const id of ['citadel', 'frundles']) expect(eight.find((d) => d.id === id).locked).toBe('Opens after episode 9, “Fairy tales”. Free roam, in Things to do, opens it now.');
    // after episode 9: those, the Citadel and Frundles; the sector's four wait on episode 10
    const nine = dialItems(DIAL, { ...fresh(), episode: 9 });
    const opened = new Set([...eight.filter((d) => !d.locked).map((d) => d.id), 'citadel', 'frundles']);
    expect(opened.size).toBe(24);
    expect(nine.filter((d) => !d.locked).map((d) => d.id)).toEqual(DIAL.map((d) => d.id).filter((id) => opened.has(id)));
    for (const id of ['birdworld', 'gearworld', 'pluto', 'squanch']) expect(nine.find((d) => d.id === id).locked).toBe('Opens after episode 10, “The Citadel”. Free roam, in Things to do, opens it now.');
    // after episode 10: those and the sector's four; Heist-Con and the Vindicators wait on episode 11, the last two on episode 12
    const ten = dialItems(DIAL, { ...fresh(), episode: 10 });
    const sector = new Set([...opened, 'birdworld', 'gearworld', 'pluto', 'squanch']);
    expect(sector.size).toBe(28);
    expect(ten.filter((d) => !d.locked).map((d) => d.id)).toEqual(DIAL.map((d) => d.id).filter((id) => sector.has(id)));
    for (const id of ['heistcon', 'vindicators']) expect(ten.find((d) => d.id === id).locked).toBe('Opens after episode 11, “The sector”. Free roam, in Things to do, opens it now.');
    for (const id of ['blooddome', 'evilrick']) expect(ten.find((d) => d.id === id).locked).toBe('Opens after episode 12, “Big score”. Free roam, in Things to do, opens it now.');
    // after episode 11: those, Heist-Con and the Vindicators; the last two still wait on episode 12
    const eleven = dialItems(DIAL, { ...fresh(), episode: 11 });
    const big = new Set([...sector, 'heistcon', 'vindicators']);
    expect(big.size).toBe(30);
    expect(eleven.filter((d) => !d.locked).map((d) => d.id)).toEqual(DIAL.map((d) => d.id).filter((id) => big.has(id)));
    for (const id of ['blooddome', 'evilrick']) expect(eleven.find((d) => d.id === id).locked).toBe('Opens after episode 12, “Big score”. Free roam, in Things to do, opens it now.');
  });

  it('counts the coordinates home on the dial', () => {
    expect(dialLead(fresh(), DIAL.length)).toBe('Coordinates on the gun: 1 of 32');
    expect(dialLead({ ...fresh(), episode: 1 }, DIAL.length)).toBe('Coordinates on the gun: 3 of 32');
    expect(dialLead({ ...fresh(), episode: 2 }, DIAL.length)).toBe('Coordinates on the gun: 5 of 32');
    expect(dialLead({ ...fresh(), episode: 3 }, DIAL.length)).toBe('Coordinates on the gun: 8 of 32');
    expect(dialLead({ ...fresh(), episode: 4 }, DIAL.length)).toBe('Coordinates on the gun: 10 of 32');
    expect(dialLead({ ...fresh(), episode: 5 }, DIAL.length)).toBe('Coordinates on the gun: 13 of 32');
    expect(dialLead({ ...fresh(), episode: 6 }, DIAL.length)).toBe('Coordinates on the gun: 16 of 32');
    expect(dialLead({ ...fresh(), episode: 7 }, DIAL.length)).toBe('Coordinates on the gun: 19 of 32');
    expect(dialLead({ ...fresh(), episode: 8 }, DIAL.length)).toBe('Coordinates on the gun: 22 of 32');
    expect(dialLead({ ...fresh(), episode: 9 }, DIAL.length)).toBe('Coordinates on the gun: 24 of 32');
    expect(dialLead({ ...fresh(), episode: 10 }, DIAL.length)).toBe('Coordinates on the gun: 28 of 32');
    expect(dialLead({ ...fresh(), episode: 11 }, DIAL.length)).toBe('Coordinates on the gun: 30 of 32');
    expect(dialLead({ ...fresh(), episode: 12 }, DIAL.length)).toBe('Coordinates on the gun: 32 of 32');
    // (free roam opens the dial, but brings no coordinates home)
    expect(dialLead({ ...fresh(), freeRoam: true }, DIAL.length)).toBe('Coordinates on the gun: 1 of 32');
  });
});

describe('an episode’s card, passed', () => {
  it('goes at a key pressed, not at a key held down from before it showed (its auto-repeat)', () => {
    expect(passesCard({ key: 'w', repeat: false })).toBe(true);
    expect(passesCard({ key: 'w', repeat: true })).toBe(false);
    expect(passesCard({ type: 'pointerdown' })).toBe(true);
  });
});
