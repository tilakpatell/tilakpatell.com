import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createSaves } from '../../../runtime/saves';
import { ACHIEVEMENTS } from '../../Achievements';
import { switchFor } from '../hq/gameScreen';
import { ROOMS } from '../ricochet/rules';
import { LEVEL_COUNT } from '../widow/rules';
import { LEGS } from '../tesseract/rules';
import { PACKS, PLACES, progress } from '../world/rules';
import { AVENGERS_ACHIEVEMENTS, BESTS, COUNTS, FLAT_READY, RECORD_KEYS, boardCards, readBest, readRecords } from './records';

const from = (o) => (k, f) => (k in o ? o[k] : f);
// saves.test.js:4-7’s store, seeded with raw strings
const store = (init = {}) => {
  const m = new Map(Object.entries(init));
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};
const at = (cs, id) => cs.find((c) => c.id === id);

describe('the ops board’s bests', () => {
  it('reads every game’s best from its own key and shape', () => {
    const get = from({ 'tp-hq-repulsor-best': 12345, 'tp-hq-lawn-best': 800, 'tp-hq-ricochet': { reached: 4, stars: [3, 2, 1] }, 'tp-hq-trickshot-best': 1310, 'tp-hq-widow-level': 3, 'tp-hq-smash-best': 2140, 'tp-hq-thwip-best': 9876, 'tp-hq-tesseract-best': [120, 340, 0, 0, 0, 0] });
    expect(readBest('stark', get)).toEqual({ score: 12345, text: 'Best 12,345', stars: null });
    expect(readBest('thor', get).text).toBe('Best 800');
    expect(readBest('cap', get)).toEqual({ score: 3, text: '3 of 12 rooms', stars: { have: 6, of: 36 } });
    expect(readBest('hawkeye', get).text).toBe('Best 1,310');
    expect(readBest('widow', get)).toEqual({ score: 3, text: '3 of 8 levels', stars: null });
    expect(readBest('banner', get).text).toBe('Best 2,140 m');
    expect(readBest('spidey', get).text).toBe('Best 9,876');
    expect(readBest('vault', get)).toEqual({ score: 460, text: 'Best 460 · 2 of 6 legs', stars: null });
  });
  it('is nothing for a key that is missing or holds nonsense', () => {
    for (const id of Object.keys(BESTS)) expect(readBest(id, from({})), id).toBe(null);
    expect(readBest('nowhere', from({}))).toBe(null);
    const bad = from({ 'tp-hq-repulsor-best': 'abc', 'tp-hq-lawn-best': -40, 'tp-hq-ricochet': { reached: 'x', stars: 'nope' }, 'tp-hq-trickshot-best': {}, 'tp-hq-widow-level': 99, 'tp-hq-smash-best': null, 'tp-hq-thwip-best': [1, 2], 'tp-hq-tesseract-best': 'oops' });
    expect(Object.keys(BESTS).filter((id) => readBest(id, bad) !== null)).toEqual(['widow']);
    expect(readBest('widow', bad).text).toBe('8 of 8 levels'); // clamped, as Infiltration.jsx:41 clamps
  });
  it('clamps Ricochet’s stars and Tesseract Run’s legs as the games do', () => {
    expect(readBest('cap', from({ 'tp-hq-ricochet': { stars: [9, -1, '2', null] } }))).toEqual({ score: 2, text: '2 of 12 rooms', stars: { have: 5, of: 36 } });
    expect(readBest('vault', from({ 'tp-hq-tesseract-best': [-5, 'x', 99.6, null, 1, 2, 3, 4] }))).toEqual({ score: 103, text: 'Best 103 · 3 of 6 legs', stars: null });
  });
  it('reads through the runtime’s saves without rewriting a key, and a key that won’t parse is missing', () => {
    const local = store({ 'tp-hq-repulsor-best': '{bad', 'tp-hq-swing-tour': '41.3', 'tp-hq-ricochet': '{"reached":2,"stars":[3]}' });
    const saves = createSaves({ local, session: store() });
    expect(readBest('stark', saves.get)).toBe(null);
    expect(readBest('cap', saves.get).text).toBe('1 of 12 rooms');
    expect(readRecords(saves.get, {}).tour).toBe(41.3);
    expect(local.getItem('tp-hq-swing-tour')).toBe('41.3');
    expect(local.getItem('tp-hq-ricochet')).toBe('{"reached":2,"stars":[3]}');
    expect(local.getItem('tp-hq-repulsor-best')).toBe('{bad');
  });
  it('names the very keys the games and the compound write', () => {
    expect(Object.values(BESTS).map((b) => b.key)).toEqual(['tp-hq-repulsor-best', 'tp-hq-lawn-best', 'tp-hq-ricochet', 'tp-hq-trickshot-best', 'tp-hq-widow-level', 'tp-hq-smash-best', 'tp-hq-thwip-best', 'tp-hq-tesseract-best']);
    const FILE = { stark: 'repulsor/RepulsorRange.jsx', thor: 'lawn/HoldTheLawn.jsx', cap: 'ricochet/save.js', hawkeye: 'trickshot/TrickShot.jsx', widow: 'widow/save.js', banner: 'smash/SmashRun.jsx', spidey: 'thwip/Thwip.jsx', vault: 'tesseract/TesseractRun.jsx' };
    for (const [id, f] of Object.entries(FILE)) expect(readFileSync(new URL(`../${f}`, import.meta.url), 'utf8'), f).toContain(`'${BESTS[id].key}'`);
    const world = readFileSync(new URL('../world/CompoundWorld.jsx', import.meta.url), 'utf8');
    for (const k of Object.values(RECORD_KEYS)) expect(world, k).toContain(`'${k}'`);
  });
});

describe('the records strip', () => {
  it('counts the stones, the tour, the style, the backpacks and the Avengers achievements', () => {
    const r = readRecords(from({ 'tp-hq-swing-tour': 41.3, 'tp-hq-style-best': 2450, 'tp-hq-packs': [PACKS[0].id, PACKS[1].id, PACKS[1].id, 'nonsense'] }), { stones: 3, unlocked: ['worthy', 'spidey', 'explorer', 'snap'] });
    expect(r).toEqual({ stones: { have: 3, of: 6 }, tour: 41.3, style: 2450, packs: { have: 2, of: 12 }, feats: { have: 2, of: 14 } });
  });
  it('starts clean with nothing kept, and with nonsense kept', () => {
    const clean = { stones: { have: 0, of: 6 }, tour: null, style: 0, packs: { have: 0, of: 12 }, feats: { have: 0, of: 14 } };
    expect(readRecords(from({}), {})).toEqual(clean);
    expect(readRecords(from({}))).toEqual(clean);
    expect(readRecords(from({ 'tp-hq-swing-tour': '41.3', 'tp-hq-style-best': {}, 'tp-hq-packs': 'abc' }), { stones: 9 })).toEqual({ ...clean, stones: { have: 6, of: 6 } });
  });
  it('names the fourteen Avengers achievements, and pins its counts to the games’ own rules', () => {
    const ids = Object.keys(ACHIEVEMENTS);
    expect(AVENGERS_ACHIEVEMENTS).toEqual(ids.slice(ids.indexOf('worthy'), ids.indexOf('showboat') + 1));
    expect(AVENGERS_ACHIEVEMENTS).toHaveLength(14);
    expect(AVENGERS_ACHIEVEMENTS).not.toContain('snap');
    expect(COUNTS).toEqual({ rooms: ROOMS.length, levels: LEVEL_COUNT, legs: LEGS.length });
  });
});

describe('the board’s cards', () => {
  it('has one card a building, in the tour’s order, numbered as the map’s pins, each with its link and its game', () => {
    const cards = boardCards(progress([]), { get: from({}), can3D: true });
    expect(cards.map((c) => c.id)).toEqual(PLACES.map((p) => p.id));
    expect(cards.map((c) => c.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(cards.map((c) => c.link)).toEqual(['/avengers/workshop', '/avengers/lawn', '/avengers/training', '/avengers/range', '/avengers/operations', '/avengers/lab', '/avengers/gate', '/avengers/hangar']);
    expect(cards.map((c) => c.game)).toEqual(['Repulsor Range', 'Hold the Lawn', 'Ricochet', 'Trick Shot', 'Infiltration', 'Smash Run', 'Thwip!', 'Tesseract Run']);
    expect(cards.filter((c) => c.next).map((c) => c.id)).toEqual(['stark']);
  });
  it('says what each stone is in the HUD’s own words: won, half won, to win, or won in the 3D game', () => {
    const prog = progress(['power', 'soul-clint']);
    const on = boardCards(prog, { get: from({}), can3D: true });
    expect(at(on, 'stark')).toMatchObject({ state: 'won', stoneText: 'Power Stone: won back' });
    expect(at(on, 'hawkeye')).toMatchObject({ state: 'half', stoneText: 'Clint’s half of the Soul Stone: won back' });
    expect(at(on, 'widow')).toMatchObject({ state: 'open', stoneText: 'Win Natasha’s half of the Soul Stone here' });
    expect(at(on, 'thor')).toMatchObject({ state: 'open', stoneText: 'Win the Reality Stone here', play: 'Play' });
    const off = boardCards(prog, { get: from({}), can3D: false });
    expect(off.filter((c) => c.state === 'needs3d').map((c) => c.id)).toEqual(['thor', 'cap', 'widow', 'banner', 'vault']);
    expect(at(off, 'thor').stoneText).toBe('The stone here is won in the 3D game.');
    expect(at(off, 'thor').stoneText).toBe(switchFor({ can: true, on: false, status: 'idle' }).note.text); // the game screen’s words
    expect(at(off, 'stark').state).toBe('won');
  });
  it('plays in 2D where a game has a 2D view, and counts the gate done once Thwip! is won', () => {
    const flat = boardCards(progress(['power', 'soul-clint']), { get: from({}), can3D: false, flat: ['cap'] });
    expect(at(flat, 'cap')).toMatchObject({ state: 'flat', play: 'Play in 2D', stoneText: 'Win the Mind Stone here in 2D' });
    expect(FLAT_READY).toEqual([]);
    expect(at(boardCards(progress([], ['spidey']), { get: from({ 'tp-hq-thwip-best': 9876 }), can3D: true }), 'spidey')).toMatchObject({ state: 'gate', done: true, stoneText: 'No stone here: Peter made it to school', best: { text: 'Best 9,876' } });
    expect(at(boardCards(progress([]), { get: from({}), can3D: false }), 'spidey')).toMatchObject({ state: 'gate', done: false, stoneText: 'No stone here: just Peter, and school', play: 'Play' });
  });
});
