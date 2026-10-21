import { describe, expect, it } from 'vitest';
import { SNOW_FROM, SPRING_FROM, WEEKS, seasonOf, spellOf, weatherAt } from './weather';
import { daylight } from './clock';

// every hour of `days` days of a week
const sample = (week, days = 40) => {
  const out = [];
  for (let day = 0; day < days; day++) for (let hour = 0; hour < 24; hour += 0.5) out.push(weatherAt({ week, day, hour }));
  return out;
};
const share = (rows, pick) => rows.filter(pick).length / rows.length;

describe('the seasons', () => {
  it('run autumn, winter from the eighth week, spring at the end', () => {
    expect(WEEKS).toBe(12);
    expect(seasonOf(1)).toBe('autumn');
    expect(seasonOf(SNOW_FROM - 1)).toBe('autumn');
    expect(seasonOf(SNOW_FROM)).toBe('winter');
    expect(seasonOf(SPRING_FROM)).toBe('spring');
    expect(seasonOf(WEEKS)).toBe('spring');
  });
});

describe('the weather', () => {
  it('is the same day and hour every time it is asked', () => {
    expect(weatherAt({ week: 3, day: 9, hour: 14.5 })).toEqual(weatherAt({ week: 3, day: 9, hour: 14.5 }));
    expect(spellOf(4, 'autumn')).toEqual(spellOf(4, 'autumn'));
  });

  it('keeps every amount between nought and one', () => {
    for (const w of [...sample(2, 10), ...sample(9, 10), ...sample(12, 10)])
      for (const k of ['rain', 'snow', 'mist', 'cloud', 'wind', 'lying']) {
        expect(w[k]).toBeGreaterThanOrEqual(0);
        expect(w[k]).toBeLessThanOrEqual(1);
      }
  });

  it('rains often in the autumn and never snows', () => {
    const autumn = sample(3);
    expect(share(autumn, (w) => w.rain > 0.2)).toBeGreaterThan(0.08);
    expect(share(autumn, (w) => w.snow > 0)).toBe(0);
    expect(share(autumn, (w) => w.lying > 0)).toBe(0);
  });

  it('snows from the eighth week and the snow lies', () => {
    const winter = sample(SNOW_FROM);
    expect(share(winter, (w) => w.snow > 0.2)).toBeGreaterThan(0.05);
    expect(share(winter, (w) => w.rain > 0)).toBe(0);
    expect(winter.every((w) => w.lying > 0.5)).toBe(true);
    expect(weatherAt({ week: 10 }).lying).toBeGreaterThan(weatherAt({ week: 8 }).lying);
  });

  it('is mostly clear in the spring', () => {
    const spring = sample(SPRING_FROM);
    expect(share(spring, (w) => w.kind === 'clear')).toBeGreaterThan(0.6);
    expect(share(spring, (w) => w.rain > 0.5)).toBe(0);
  });

  it('lays mist on the lake at dawn and none at noon', () => {
    const { rise } = daylight(2);
    const days = Array.from({ length: 30 }, (_, day) => day);
    const dawn = days.map((day) => weatherAt({ week: 2, day, hour: rise + 0.4 }).mist);
    const noon = days.map((day) => weatherAt({ week: 2, day, hour: 13 }).mist);
    expect(Math.max(...dawn)).toBeGreaterThan(0.7);
    expect(Math.max(...noon)).toBe(0);
  });

  it('brings the cloud in before the rain', () => {
    const rows = sample(4, 60).filter((w) => w.rain > 0.3);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((w) => w.cloud > 0.5)).toBe(true);
  });

  it('names what a person would call it', () => {
    const kinds = new Set([...sample(2), ...sample(9)].map((w) => w.kind));
    for (const k of ['clear', 'rain', 'snow', 'mist']) expect(kinds.has(k)).toBe(true);
  });
});
