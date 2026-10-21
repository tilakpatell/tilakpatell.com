import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { STONES } from '../../interests/stones';
import { HALF_OF, STONE_OF, airNote, stoneById, stoneFor, stoneLine } from './labels';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const GAMES = ['../repulsor/RepulsorRange.jsx', '../lawn/HoldTheLawn.jsx', '../ricochet/Ricochet.jsx', '../trickshot/TrickShot.jsx', '../widow/Infiltration.jsx', '../smash/SmashRun.jsx', '../tesseract/TesseractRun.jsx'];

describe('the stones’ labels', () => {
  it('reads either half of the Soul Stone as the Soul Stone, from one table', () => {
    expect(STONE_OF).toEqual({ 'soul-clint': 'soul', 'soul-natasha': 'soul' });
    expect(HALF_OF).toEqual({ 'soul-clint': 'Clint’s', 'soul-natasha': 'Natasha’s' });
    expect(stoneById('soul-clint').id).toBe('soul');
    expect(stoneById('soul').name).toBe('Soul Stone');
    expect(stoneById('power').color).toBe(STONES.find((s) => s.id === 'power').color);
    expect(stoneById('nonsense')).toBeNull();
    expect(stoneFor({ stone: 'soul-natasha' }).name).toBe('Soul Stone');
    expect(stoneFor({ id: 'spidey' })).toBeNull();
  });
  it('says whose half a half is, and that a won gate is school', () => {
    expect(stoneLine({ stone: 'soul-clint', done: true })).toBe('Clint’s half of the Soul Stone: won back');
    expect(stoneLine({ stone: 'soul-natasha', done: true })).toBe('Natasha’s half of the Soul Stone: won back');
    expect(stoneLine({ stone: 'soul-clint', done: false })).toBe('Win it for Clint’s half of the Soul Stone');
    expect(stoneLine({ stone: 'power', done: true })).toBe('Power Stone: won back');
    expect(stoneLine({ stone: 'power', done: false })).toBe('Win it for the Power Stone');
    expect(stoneLine({ id: 'spidey', done: false })).toBe('No stone here: just Peter, and school');
    expect(stoneLine({ id: 'spidey', done: true })).toBe('No stone here: Peter made it to school');
  });
  it('gives every game’s stone badge the stone’s own colour, and keeps the table in one place', () => {
    for (const f of GAMES) {
      expect(read(f), f).not.toMatch(/'--glow': '#/);
      expect(read(f), f).toMatch(/<Results\b/);
      expect(read(f), f).not.toContain('className="hq-stone"');
    }
    for (const f of ['./Place.jsx', './scene/doors.js']) expect(read(f), f).not.toMatch(/STONE_OF =/);
  });
  it('says only what is true: one figure on Titan, the Space Stone’s portal, stones won in 3D', () => {
    expect(read('../../../pages/Avengers.jsx')).not.toMatch(/army/);
    expect(read('../../tour/chapters/player.js')).toMatch(/the Space Stone opens a portal to Titan/);
    expect(read('./CompoundWorld.jsx')).not.toMatch(/wins an Infinity Stone back/);
  });
  it('says why the compound is drawn from the air, and offers only what leaves the site’s 3D setting as it is', () => {
    const failed = 'The 3D compound couldn’t start here, so here it is from the air.';
    expect(airNote({ gl: 'failed', mode: 'auto', held: false })).toEqual({ text: failed, action: { label: 'Try 3D again', run: 'retry' } });
    expect(airNote({ gl: 'lost', mode: 'auto', held: false })).toEqual({ text: 'The graphics chip reset, so here’s the compound from the air.', action: { label: 'Try 3D again', run: 'retry' } });
    expect(airNote({ gl: 'failed', mode: 'on', held: false })).toEqual({ text: failed, action: null });
    expect(airNote({ gl: 'loading', mode: 'auto', held: true })).toEqual({ text: 'The 3D compound isn’t loaded yet, so here it is from the air.', action: { label: 'Load the 3D', run: 'load' } });
    expect(airNote({ gl: 'failed', mode: 'off', held: true })).toEqual({ text: '3D is switched off in Settings, so here’s the compound from the air.', action: { label: 'Settings', run: 'settings' } });
  });
});
