import { describe, expect, it } from 'vitest';
import { GCW, warTable } from './gcw';
import { WAR_IDS } from './sides';
import { afterLine, ago, areaLines, battleLine, campaignLine, endCard, eventLine, feedOf, heldColour, newsLine, nextLine, nextOpLine, oathOf, objectiveBars, orderLine, partLine, phaseLine, progressOf, recordLine, resultLine, resultTitle, soon, stageLine, standing, strengthLine, systemLabel, whose, whyLine, yoursLine } from './warText';

const NOW = 1_000_000;
const row = (o) => ({ id: 'hoth', owner: 'empire', control: 0.75, front: false, attack: null, rate: null, ...o });

describe('a system’s place in a war, in words', () => {
  it('a front is the liberator’s progress: how much of the holder’s hold is gone, and whose it is', () => {
    // (it named no holder: the map's ring says whose, but its button's words didn't)
    expect(progressOf(row({ front: true }))).toBeCloseTo(0.25, 5);
    expect(standing(row({ front: true, rate: 4 }), NOW, 'gcw')).toBe('Held by the Empire · 25% liberated · +4.0%/h');
    expect(standing(row({ owner: 'hutt', front: true, rate: 4 }), NOW, 'gcw')).toBe('Hutt space · 25% liberated · +4.0%/h');
  });
  it('a front’s rate is the one that applies (its supply, areas and defence in it), when it’s known', () => {
    expect(standing(row({ front: true, rate: 4, effRate: 2.35 }), NOW, 'gcw')).toBe('Held by the Empire · 25% liberated · +2.4%/h');
    expect(standing(row({ front: true, rate: 4, effRate: -0.5 }), NOW, 'gcw')).toBe('Held by the Empire · 25% liberated · −0.5%/h');
  });
  it('a system cut off from supply says so: it holds less well, and doesn’t mend', () => {
    expect(standing(row({ owner: 'separatists', cut: true }), NOW, 'clone')).toBe('Held by the Separatists, cut off from supply');
    expect(standing(row({ front: true, rate: 4, cut: true }), NOW, 'gcw')).toBe('Held by the Empire, cut off from supply · 25% liberated · +4.0%/h');
  });
  it('under attack it’s the holder’s hold, and the time left to hold out', () => {
    const r = row({ owner: 'rebel', attack: { by: 'empire', until: NOW + 90e3 }, control: 0.6 });
    expect(progressOf(r)).toBeCloseTo(0.6, 5);
    expect(standing(r, NOW, 'gcw')).toBe('The Empire attacks: 60% held, 1:30 to hold out');
  });
  it('the Separatists, being many, attack', () => {
    expect(standing(row({ owner: 'republic', attack: { by: 'separatists', until: NOW + 90e3 }, control: 0.6 }), NOW, 'clone')).toBe('The Separatists attack: 60% held, 1:30 to hold out');
  });
  it('a Hutt raid says so', () => {
    expect(standing(row({ owner: 'empire', attack: { by: 'hutt', until: NOW + 60e3 }, control: 0.5 }), NOW, 'gcw')).toBe('The Hutts raid: 50% held, 1:00 to hold out');
  });
  it('a quiet system names its holder, the Hutts’ as Hutt space', () => {
    expect(standing(row({ owner: 'separatists' }), NOW, 'clone')).toBe('Held by the Separatists');
    expect(standing(row({ owner: 'hutt' }), NOW, 'gcw')).toBe('Hutt space');
  });
  it('a system’s button says all the map shows of it: the major order, the decisive battle, a battle on, your part', () => {
    const r = row({ name: 'Hoth', front: true, rate: 4, major: true });
    expect(systemLabel(r, NOW, false)).toBe('Hoth: Held by the Empire · 25% liberated · +4.0%/h, the major order');
    const fought = { ...r, major: false, decisive: true, battle: { fighting: true } };
    expect(systemLabel(fought, NOW, true)).toBe('Hoth: Held by the Empire · 25% liberated · +4.0%/h, the decisive battle, a battle on, you fought here');
    expect(systemLabel(row({ name: 'Hoth', owner: 'hutt' }), NOW, false)).toBe('Hoth: Hutt space');
  });
  it('colours a system its holder’s', () => {
    expect(heldColour('rebel')).toMatch(/^#/);
    expect(heldColour('hutt')).not.toBe(heldColour('rebel'));
    expect(heldColour(undefined)).toBeUndefined();
  });
});

describe('the war card', () => {
  it('lists the areas, who holds each whole, and how many of yours there are', () => {
    const areas = { core: { total: 2, rebel: 2, holder: 'rebel' }, anoat: { total: 4, empire: 3, rebel: 1, holder: null } };
    const lines = areaLines(areas, 'rebel');
    expect(lines).toEqual([
      { id: 'core', name: 'The Core and Kashyyyk', text: 'The Rebellion’s, all 2', yours: true },
      { id: 'anoat', name: 'Anoat and Atravis', text: '1 of 4 the Rebellion’s', yours: false },
    ]);
    expect(areaLines({ anoat: { total: 4, hutt: 4, holder: 'hutt' } }, null)[0].text).toBe('Hutt space, all 4');
    // (the Separatists’, not the Separatists’s)
    const clone = { core: { total: 2, separatists: 2, holder: 'separatists' }, anoat: { total: 4, republic: 3, separatists: 1, holder: null } };
    expect(areaLines(clone, 'separatists').map((a) => a.text)).toEqual(['The Separatists’, all 2', '1 of 4 the Separatists’']);
  });
  it('whose: a side’s, the many’s with the ’ alone', () => {
    expect(whose('rebel')).toBe('The Rebellion’s');
    expect(whose('separatists')).toBe('The Separatists’');
    expect(whose('hutt', 'the')).toBe('the Hutts’');
    expect(whose('newrepublic', 'the')).toBe('the New Republic’s');
  });
  it('a record line: your rank, your points, your battles', () => {
    expect(recordLine('rebel', { points: 16.2, wins: 2, battles: 3 })).toBe('Flight Leader · 16 points · 2 won of 3 battles');
    expect(recordLine('empire', { points: 0, wins: 0, battles: 0 })).toBe('Ensign · no battles yet');
    expect(recordLine(null, { points: 5, wins: 0, battles: 1 })).toBeNull();
  });
  it('the oath card: the war’s two sides, the one sworn and the one suggested', () => {
    expect(oathOf('gcw', { side: 'empire' }, 'rebel')).toEqual({
      war: 'gcw',
      sides: [
        { id: 'rebel', name: 'Rebel Alliance', colour: expect.any(String), sworn: false, suggested: true },
        { id: 'empire', name: 'Galactic Empire', colour: expect.any(String), sworn: true, suggested: false },
      ],
    });
  });
  it('a system’s battle in a line: its kind for your part in it, its clock', () => {
    const row = { id: 'hoth', kind: 'evacuation', battle: { fighting: true, fightEnd: NOW + 125e3, end: NOW + 245e3, attacker: 'empire', defender: 'rebel' } };
    expect(battleLine(row, NOW, 'rebel')).toBe('Hold the evacuation · 2:05 left');
    expect(battleLine(row, NOW, 'empire')).toBe('Stop the evacuation · 2:05 left');
    expect(battleLine(row, NOW, 'republic')).toBe('Evacuation · 2:05 left');
    expect(battleLine(row, NOW, null)).toBe('Evacuation · 2:05 left');
    expect(battleLine({ ...row, battle: { ...row.battle, fighting: false } }, NOW, 'rebel')).toBe('Evacuation: regrouping, the next in 4:05');
    expect(battleLine({ ...row, battle: null }, NOW, 'rebel')).toBeNull();
  });
});

describe('the war’s news', () => {
  const H = 3600e3;
  it('says how long ago', () => {
    expect(ago(20e3)).toBe('just now');
    expect(ago(12 * 60e3)).toBe('12m ago');
    expect(ago(2 * H + 5 * 60e3)).toBe('2h ago');
    expect(ago(50 * H)).toBe('2d ago');
  });
  it('tells of each thing that happened, and when', () => {
    const at = NOW - 2 * H;
    expect(eventLine({ type: 'captured', sys: 'hoth', by: 'empire', from: 'rebel', at }, NOW)).toBe('Hoth fell to the Empire · 2h ago');
    expect(eventLine({ type: 'captured', sys: 'naboo', by: 'hutt', from: 'republic', at }, NOW)).toBe('Naboo fell to the Hutts · 2h ago');
    expect(eventLine({ type: 'capital', sys: 'coruscant', by: 'rebel', from: 'empire', at }, NOW)).toBe('Coruscant, the Empire’s capital, fell to the Rebellion · 2h ago');
    expect(eventLine({ type: 'attack', sys: 'hoth', by: 'empire', holder: 'rebel', origin: 'bespin', at }, NOW)).toBe('The Empire attacks Hoth from Bespin · 2h ago');
    expect(eventLine({ type: 'attack', sys: 'hoth', by: 'empire', holder: 'rebel', origin: 'bespin', counter: true, at }, NOW)).toBe('The Empire strikes back at Hoth from Bespin · 2h ago');
    expect(eventLine({ type: 'raid', sys: 'naboo', by: 'hutt', holder: 'republic', origin: 'tatooine', at }, NOW)).toBe('The Hutts raid Naboo from Tatooine · 2h ago');
    expect(eventLine({ type: 'repelled', sys: 'yavin', by: 'empire', holder: 'rebel', at }, NOW)).toBe('The Rebellion held Yavin 4 · 2h ago');
    expect(eventLine({ type: 'area', area: 'north', by: 'rebel', from: null, at }, NOW)).toBe('The Rebellion holds all of the Northern Rim · 2h ago');
    // (and the many, the Separatists and the Hutts, as many)
    expect(newsLine({ type: 'attack', sys: 'kashyyyk', by: 'separatists', holder: 'republic', origin: 'coruscant', at })).toBe('The Separatists attack Kashyyyk from Coruscant');
    expect(newsLine({ type: 'attack', sys: 'kashyyyk', by: 'separatists', holder: 'republic', counter: true, at })).toBe('The Separatists strike back at Kashyyyk');
    expect(newsLine({ type: 'area', area: 'north', by: 'separatists', at })).toBe('The Separatists hold all of the Northern Rim');
    expect(newsLine({ type: 'area', area: 'north', by: 'hutt', at })).toBe('The Hutts hold all of the Northern Rim');
    expect(eventLine({ type: 'lastStand', sys: 'geonosis', by: 'separatists', at }, NOW)).toBe('The Separatists’ last stand, at Geonosis · 2h ago');
    expect(eventLine({ type: 'phase', phase: 'Escalation', sys: null, at }, NOW)).toBe('The war escalates · 2h ago');
    expect(eventLine({ type: 'phase', phase: 'Climax', sys: 'coruscant', at }, NOW)).toBe('The climax: the decisive battle, at Coruscant · 2h ago');
  });
  it('has words for everything a real campaign tells of', () => {
    const types = new Set();
    for (const war of WAR_IDS)
      for (const n of [0, 1]) {
        const end = GCW.start + (n + 1) * GCW.campaign - 1;
        const t = warTable(war, end, () => 0);
        for (const e of t.events) {
          types.add(e.type);
          const line = eventLine(e, end);
          expect(line, JSON.stringify(e)).not.toMatch(/undefined|null|NaN/);
          expect(line.startsWith(e.type)).toBe(false);
        }
        // (the campaign's last moment: its last step's still on, so it's who leads)
        expect(resultLine(t)).toMatch(/^The .+ leads? campaign \d+ · /);
        expect(phaseLine(t, end)).toMatch(/^Climax · /);
        for (const side of Object.keys(t.strength)) expect(strengthLine(t, side)).toMatch(/system/);
      }
    for (const type of ['captured', 'attack', 'raid', 'repelled', 'phase']) expect(types, type).toContain(type);
  });
  it('each side’s strength: its systems, its share of the galaxy’s worth, and which way it’s gone in six hours', () => {
    const table = { strength: { rebel: { systems: 9, worth: 9, share: 0.413, trend6h: 2 }, empire: { systems: 1, worth: 1, share: 0.043, trend6h: -1 }, hutt: { systems: 2, worth: 2, share: 0.087, trend6h: 0 } } };
    expect(strengthLine(table, 'rebel')).toBe('9 systems · 41% of the galaxy’s worth · ▲2 in 6h');
    expect(strengthLine(table, 'empire')).toBe('1 system · 4% of the galaxy’s worth · ▼1 in 6h');
    expect(strengthLine(table, 'hutt')).toBe('2 systems · 9% of the galaxy’s worth');
    expect(strengthLine(table, 'republic')).toBeNull();
  });
  it('the campaign’s phase, and how long till the next (or the end)', () => {
    expect(phaseLine({ phase: { name: 'Escalation', until: NOW + 30 * H + 6 * 60e3, next: 'Decisive' } }, NOW)).toBe('Escalation · the decisive phase in 30h 6m');
    expect(phaseLine({ phase: { name: 'Opening', until: NOW + 61 * 60e3, next: 'Escalation' } }, NOW)).toBe('Opening · escalation in 1h 1m');
    expect(phaseLine({ phase: { name: 'Climax', until: NOW + 2 * H, next: null } }, NOW)).toBe('Climax · 2h 0m to the end');
  });
  it('a side’s order, and the time left on it', () => {
    expect(orderLine({ sys: 'hoth', verb: 'liberate', until: NOW + 4 * H + 12 * 60e3 }, NOW)).toBe('Liberate Hoth · 4h 12m left');
    expect(orderLine({ sys: 'coruscant', verb: 'hold', until: NOW + 90e3 }, NOW)).toBe('Hold Coruscant · 1:30 left');
    expect(orderLine({ sys: 'naboo', verb: 'take', until: NOW + 90e3 }, NOW)).toBe('Take Naboo · 1:30 left');
    expect(orderLine(null, NOW)).toBeNull();
  });
  it('the campaign’s result: who won on victory points, by how much, and where it was decided', () => {
    // (a result's final once the campaign's over; in its last step it's who leads)
    expect(resultLine({ campaign: 6, result: { winner: 'empire', vp: { rebel: 8, empire: 12, hutt: 3 }, decisive: 'coruscant', over: null, final: true } })).toBe('The Empire won campaign 7 · 12–8 on victory points · decisive at Coruscant');
    expect(resultLine({ campaign: 6, result: { winner: 'empire', vp: { rebel: 8, empire: 12, hutt: 3 }, decisive: 'coruscant', over: null, final: false } })).toBe('The Empire leads campaign 7 · 12–8 on victory points · decisive at Coruscant');
    expect(resultLine({ campaign: 6, result: { winner: 'separatists', vp: { republic: 8, separatists: 12, hutt: 3 }, decisive: null, over: null, final: false } })).toBe('The Separatists lead campaign 7 · 12–8 on victory points');
    expect(resultLine({ campaign: 2, result: { winner: 'republic', vp: { republic: 23, separatists: 0, hutt: 0 }, decisive: 'geonosis', over: 'republic', final: true } })).toBe('The Republic won campaign 3 outright: every system theirs · decisive at Geonosis');
    expect(resultLine({ campaign: 2, result: null })).toBeNull();
    // and the campaign before's, kept in this browser for the start of the next (warState.js)
    expect(resultLine({ campaign: 3, result: null, previous: { n: 2, winner: 'rebel', vp: { rebel: 13, empire: 6, hutt: 4 }, decisive: 'coruscant', over: null, final: true } })).toBe('The Rebellion won campaign 3 · 13–6 on victory points · decisive at Coruscant');
  });
});

describe('the war on the holotable', () => {
  const H = 3600e3;
  const M = 60e3;
  it('tells of a thing that happened without when, for the feed to put the time beside it', () => {
    const e = { type: 'captured', sys: 'hoth', by: 'empire', from: 'rebel', at: NOW - 2 * H };
    expect(newsLine(e)).toBe('Hoth fell to the Empire');
    expect(eventLine(e, NOW)).toBe(`${newsLine(e)} · 2h ago`);
  });
  it('the feed: the newest first, a few of them, a capital’s fall told once', () => {
    const events = [
      { k: 1, at: 1, type: 'attack', sys: 'yavin', by: 'empire' },
      { k: 4, at: 4, type: 'captured', sys: 'yavin', by: 'empire', from: 'rebel' },
      { k: 4, at: 4, type: 'capital', sys: 'yavin', by: 'empire', from: 'rebel' },
      { k: 5, at: 5, type: 'raid', sys: 'naboo', by: 'hutt' },
      { k: 5, at: 5, type: 'captured', sys: 'naboo', by: 'hutt', from: 'empire' },
    ];
    expect(feedOf(events).map((e) => `${e.type}:${e.sys}`)).toEqual(['captured:naboo', 'raid:naboo', 'capital:yavin', 'attack:yavin']);
    expect(feedOf(events, 2)).toHaveLength(2);
    expect(feedOf([])).toEqual([]);
    expect(feedOf(undefined)).toEqual([]);
  });
  it('how soon, to the minute', () => {
    expect(soon(20e3)).toBe('under a minute');
    expect(soon(47 * M)).toBe('47m');
    expect(soon(46 * M + 10e3)).toBe('47m');
    expect(soon(72 * M)).toBe('1h 12m');
    expect(soon(51 * H)).toBe('2d 3h');
  });
  it('the campaign’s phase and its end, in a line (in the Climax, the end is the next thing)', () => {
    const table = { ends: NOW + 51 * H, phase: { name: 'Escalation', until: NOW + 18 * H, next: 'Decisive' } };
    expect(campaignLine(table, NOW)).toBe('Escalation · the decisive phase in 18h 0m · campaign ends in 2d 3h');
    const climax = { ends: NOW + 2 * H, phase: { name: 'Climax', until: NOW + 2 * H, next: null } };
    expect(campaignLine(climax, NOW)).toBe('Climax · 2h 0m to the end');
  });
  it('when the next offensive is due, and whose', () => {
    expect(nextOpLine({ nextOp: { by: 'empire', at: NOW + 47 * M } }, NOW)).toBe('Next Imperial offensive in 47m');
    expect(nextOpLine({ nextOp: { by: 'separatists', at: NOW + 2 * H } }, NOW)).toBe('Next Separatist offensive in 2h 0m');
    expect(nextOpLine({ nextOp: { by: 'remnant', at: NOW + 5 * M } }, NOW)).toBe('Next Remnant offensive in 5m');
    expect(nextOpLine({ nextOp: { by: 'hutt', at: NOW + 3 * H + 4 * M } }, NOW)).toBe('Next Hutt raid in 3h 4m');
    expect(nextOpLine({ nextOp: { by: 'empire', at: NOW - 1 } }, NOW)).toBe('Next Imperial offensive any moment');
    expect(nextOpLine({ nextOp: null }, NOW)).toBeNull();
  });
  it('your part: the system you moved most this campaign, and how many in all', () => {
    expect(partLine({ systems: [{ id: 'hoth', wins: 1, losses: 0, moved: 0.142 }] })).toBe('You moved Hoth 14% this campaign');
    expect(partLine({ systems: [{ id: 'bespin', moved: 0.05 }, { id: 'yavin', moved: 0.31 }, { id: 'endor', moved: 0 }] })).toBe('You moved Yavin 4 31% this campaign · 2 systems in all');
    expect(partLine({ systems: [{ id: 'hoth', moved: 0.001 }] })).toBeNull();
    expect(partLine({ systems: [] })).toBeNull();
    expect(partLine(null)).toBeNull();
  });
});

// the battle you're in, as warfront.js's info has it (its stage, its
// objectives' shared hp, what's next and how it ended)
const fight = (o = {}) => ({
  sys: 'hoth',
  team: 1,
  side: 'empire',
  on: { id: 'c0.gcw.hoth.3', sides: ['rebel', 'empire'], attackerTeam: 1, end: NOW + 245e3, fightEnd: NOW + 125e3 },
  laid: { attacker: 1, kind: 'evacuation' },
  stage: { index: 0, count: 3, open: true, opensIn: 0, need: 2 },
  objectives: [
    { id: 'gen-port', name: 'Shield generator', type: 'group', hp: 70, hpMax: 140, down: false },
    { id: 'gen-star', name: 'Shield generator', type: 'group', hp: 0, hpMax: 140, down: true },
  ],
  next: { type: 'wave', at: 180, in: 40, name: 'the bomber wave' },
  result: null,
  ...o,
});

describe('the battle you’re in, in words (WarHud, BattleEnd)', () => {
  it('a stage line: which stage of how many, and your side’s part in it', () => {
    expect(stageLine(fight())).toBe('Stage 1 of 3 · Destroy: Shield generator ×2');
    expect(stageLine(fight({ team: 0, side: 'rebel' }))).toBe('Stage 1 of 3 · Defend: Shield generator ×2');
    // (a stage with the game's own words: a Starfighter Assault's, named so)
    expect(battleLine({ kind: 'starfighter', battle: { ...fight().on, attacker: 'empire', defender: 'rebel', fighting: true } }, NOW, 'empire')).toBe('Starfighter Assault: attack · 2:05 left');
    expect(stageLine(fight({ stage: { index: 0, count: 5, open: true, opensIn: 0, need: 2, title: 'Destroy the corvettes' } }))).toBe('Stage 1 of 5 · Destroy the corvettes · 1 of 2 left');
    expect(stageLine(fight({ stage: { index: 1, count: 3, open: false, opensIn: 70, need: 1 }, objectives: [{ id: 'bridge', name: 'Bridge', type: 'destroy', hp: 300, hpMax: 300, down: false }] }))).toBe('Stage 2 of 3 · Bridge opens in 1:10');
    // (three of four to take, a zone to hold, and the plan's own words for a boarding)
    const sats = [0, 1, 2, 3].map((n) => ({ id: `sat-${n}`, name: 'Shield projector', type: 'group', hp: 93, hpMax: 93, down: false }));
    expect(stageLine(fight({ stage: { index: 0, count: 3, open: true, opensIn: 0, need: 3 }, objectives: sats }))).toBe('Stage 1 of 3 · Destroy: 3 of 4 Shield projectors');
    expect(stageLine(fight({ objectives: [{ id: 'relay', name: 'the comms relay', type: 'zone', hp: 300, hpMax: 300, down: false }], stage: { index: 1, count: 3, open: true, opensIn: 0, need: 1 } }))).toBe('Stage 2 of 3 · Hold: the comms relay');
    expect(stageLine(fight({ objectives: [{ id: 'engines', name: 'the Tantive IV’s engines', type: 'destroy', verbs: ['Disable', 'Defend'], hp: 1, hpMax: 2, down: false }], stage: { index: 0, count: 3, open: true, opensIn: 0, need: 2 } }))).toBe('Stage 1 of 3 · Disable: the Tantive IV’s engines');
    expect(stageLine(fight({ team: null, side: null }))).toBe('Stage 1 of 3 · Shield generator ×2');
    expect(stageLine(fight({ stage: null }))).toBeNull();
  });
  it('up to three objective bars, each its share of hp left', () => {
    expect(objectiveBars(fight())).toEqual([
      { id: 'gen-port', name: 'Shield generator', k: 0.5, down: false },
      { id: 'gen-star', name: 'Shield generator', k: 0, down: true },
    ]);
    const many = Array.from({ length: 5 }, (_, n) => ({ id: `p${n}`, name: 'Orbital defence platform', type: 'group', hp: 10, hpMax: 40, down: false }));
    expect(objectiveBars(fight({ objectives: many }))).toHaveLength(3);
  });
  it('says what’s coming next on the battle’s clock', () => {
    expect(nextLine({ type: 'wave', in: 40, name: 'the bomber wave' })).toBe('Bomber wave in 0:40');
    expect(nextLine({ type: 'push', in: 130, name: 'the final push' })).toBe('Final push in 2:10');
    expect(nextLine({ type: 'ace', in: 5, name: 'Darth Vader' })).toBe('Darth Vader in 0:05');
    expect(nextLine(null)).toBeNull();
  });
  it('says why it ended in words', () => {
    expect(whyLine({ winner: 1, why: 'flagship' })).toBe('The reactor went');
    expect(whyLine({ winner: 1, why: 'interdictor' })).toBe('The Interdictor went down');
    expect(whyLine({ winner: 0, why: 'deathstar' })).toBe('The Death Star’s reactor went');
    expect(whyLine({ winner: 0, why: 'gate' })).toBe('The Shield Gate fell');
    expect(whyLine({ winner: 0, why: 'clock' })).toBe('Held out to the end');
    expect(whyLine({ winner: 0, why: 'runners', runners: { kind: 'transport', team: 0, out: 6, down: 1 } })).toBe('Six transports got away');
    expect(whyLine({ winner: 1, why: 'runners', runners: { kind: 'transport', team: 0, out: 2, down: 4 } })).toBe('Four transports were stopped');
    expect(whyLine({ winner: 0, why: 'forced' })).toBe('Called off');
  });
  it('victory or defeat by your side, and what you did in it', () => {
    expect(resultTitle({ winner: 1 }, 1)).toBe('Victory');
    expect(resultTitle({ winner: 0 }, 1)).toBe('Defeat');
    expect(resultTitle({ winner: 0 }, null)).toBe('Battle over');
    expect(yoursLine({ kills: 3, objectives: 1, intercepts: 0, points: 13.3 })).toBe('3 kills · 1 objective');
    expect(yoursLine({ kills: 1, objectives: 0, intercepts: 2, points: 2.1 })).toBe('1 kill · 2 intercepts');
    // (nothing down, whether you were in among it or not: the points say if you were there for a win)
    expect(yoursLine({ kills: 0, objectives: 0, intercepts: 0, points: 10 })).toBe('Nothing of theirs down this time');
  });
  it('after an early end, the line over the galaxy: who won here, and when the next one’s on', () => {
    const ended = fight({ result: { winner: 1, why: 'flagship', at: 400, ago: 2, yours: { kills: 0, objectives: 0, intercepts: 0, points: 0 } } });
    expect(afterLine(ended, 'Hoth', NOW)).toBe('Victory at Hoth · next battle in 4:05');
    expect(afterLine({ ...ended, team: 0, side: 'rebel' }, 'Hoth', NOW)).toBe('Defeat at Hoth · next battle in 4:05');
    expect(afterLine({ ...ended, team: null, side: null }, 'Hoth', NOW)).toBe('The Empire won at Hoth · next battle in 4:05');
  });
  it('the end card: its title, why in words, what you did and your points', () => {
    const ended = fight({ result: { winner: 1, why: 'flagship', at: 400, ago: 2, yours: { kills: 4, objectives: 2, intercepts: 0, points: 16.4 } } });
    expect(endCard(ended)).toEqual({ title: 'Victory', tone: 'won', why: 'The reactor went', yours: '4 kills · 2 objectives', points: '+16 points' });
    expect(endCard({ ...ended, team: 0 })).toMatchObject({ title: 'Defeat', tone: 'lost' });
    expect(endCard(fight())).toBeNull();
  });
});
