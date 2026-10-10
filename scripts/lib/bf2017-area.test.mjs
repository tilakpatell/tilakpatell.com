import { describe, expect, it } from 'vitest';
import { areaJson } from './bf2017-area.mjs';

const manifest = { subworlds: ['Levels/Space/X/X', 'Levels/Space/X/Art_LargeGameMode', 'Levels/Space/X/Mode7', 'Levels/Space/X/IntroTeam1_NIS'] };
const light = (sub, o = {}) => ({ type: 'sphere', sub, Color: [0.2, 0.4, 0.8], Intensity: 1e6, AttenuationRadius: 300, Enabled: true, position: [1.23, 2.34, 3.45], ...o });
const fx = (sub, effect) => ({ sub, effect: `FX/Levels/${effect}`, position: [10, 20, 30] });

describe('a space level’s weather and lamps, for its area', () => {
  const out = areaJson(
    {
      lights: [light(1), light(2), light(3), light(1, { Enabled: false }), light(0, { Color: [2, 1, 0], Intensity: 1e12, AttenuationRadius: 20 })],
      effects: [fx(1, 'FX_Spacebattles_BlinkingLights_Kamino'), fx(0, 'FX_LightningStrike_Kamino_01'), fx(2, 'FX_LightningStrike_Kamino_01'), fx(1, 'FX_Backlight_Clouds_Kamino_01'), fx(1, 'FX_ConTrail_Starfighter')],
    },
    manifest,
    { subs: ['X', 'Art_LargeGameMode'] },
  );

  it('keeps only what the pack’s sub-levels place: not the other modes’, not the cinematics’', () => {
    expect(out.glows).toHaveLength(2);
    expect(out.skipped).toBe(1);
    expect(out.strikes).toEqual([[10, 20, 30]]);
    expect(out.blinkers).toHaveLength(1);
    expect(out.clouds).toHaveLength(1);
  });

  it('a lamp’s glow: where, its hue (not its strength), and a size held to its reach', () => {
    expect(out.glows[0]).toEqual([1.2, 2.3, 3.5, 0.25, 0.5, 1, 36]);
    // (a hot lamp is its hue, scaled to its brightest channel; a short reach holds its size)
    expect(out.glows[1].slice(3, 6)).toEqual([1, 0.5, 0]);
    expect(out.glows[1][6]).toBe(20);
  });
});
