import { describe, expect, it } from 'vitest';
import { ARRIVE, DAY, HOUR, dayOf, daylight, hourOf, keyLight, light, moonAt, newClock, parseAt, setHour, shadeOf, step, strikes, sunAt, windowsAt } from './clock';

// ride the clock a world day at a frame a second
const ride = (c, seconds, dt = 1) => {
  let s = c;
  for (let i = 0; i < seconds / dt; i++) s = step(s, dt);
  return s;
};

describe('the world’s day', () => {
  it('is twenty-four real minutes, a world hour a real minute', () => {
    expect(DAY).toBe(1440);
    expect(HOUR).toBe(60);
    const c = ride(newClock({ hour: 6 }), HOUR);
    expect(hourOf(c)).toBeCloseTo(7, 9);
    const d = ride(newClock({ hour: 6 }), DAY);
    expect(hourOf(d)).toBeCloseTo(6, 6);
    expect(dayOf(d)).toBe(1);
  });

  it('opens at the arrival’s dusk, and stands still at rate 0', () => {
    expect(hourOf(newClock())).toBe(ARRIVE);
    const still = newClock({ rate: 0 });
    expect(step(still, 30)).toBe(still);
  });

  it('sets an hour on the same day, or the next going forward', () => {
    const c = newClock({ hour: 20, day: 2 });
    expect(hourOf(setHour(c, 8))).toBe(8);
    expect(dayOf(setHour(c, 8))).toBe(2);
    expect(dayOf(setHour(c, 8, { forward: true }))).toBe(3);
  });

  it('reads an address’s hour', () => {
    expect(parseAt('noon')).toBe(12.5);
    expect(parseAt('night')).toBe(23);
    expect(parseAt('18:30')).toBeCloseTo(18.5, 9);
    expect(parseAt('7')).toBe(7);
    expect(parseAt('dusk')).toBeGreaterThan(daylight(1).set);
    expect(parseAt('dawn')).toBeLessThan(daylight(1).rise);
    expect(parseAt('teatime')).toBeNull();
    expect(parseAt('25:00')).toBeNull();
    expect(parseAt(null)).toBeNull();
  });
});

describe('the sun and the moon', () => {
  it('crosses the horizon at the week’s rise and set, south and highest at noon', () => {
    for (const week of [1, 4, 8, 12]) {
      const { rise, set, high } = daylight(week);
      expect(sunAt(rise, week).el).toBeCloseTo(0, 6);
      expect(sunAt(set, week).el).toBeCloseTo(0, 6);
      const noon = sunAt((rise + set) / 2, week);
      expect(noon.el).toBeCloseTo(high, 6);
      expect(noon.az).toBeCloseTo(0, 6);
      expect(sunAt((rise + set) / 2 + 12, week).el).toBeLessThan(0);
    }
  });

  it('rises in the east and sets in the west', () => {
    const { rise, set } = daylight(1);
    expect(Math.sin(sunAt(rise, 1).az)).toBeGreaterThan(0.5);
    expect(Math.sin(sunAt(set, 1).az)).toBeLessThan(-0.5);
  });

  it('keeps December’s days short and low', () => {
    const sep = daylight(1);
    const dec = daylight(8);
    expect(dec.set - dec.rise).toBeLessThan(sep.set - sep.rise - 4);
    expect(dec.high).toBeLessThan(sep.high / 2);
  });

  it('a full moon up on the first night, waning after', () => {
    const first = moonAt(23, 0);
    expect(first.phase).toBeGreaterThan(0.95);
    expect(first.el).toBeGreaterThan(0.3);
    expect(moonAt(23, 14).phase).toBeLessThan(0.1);
  });
});

describe('the light', () => {
  it('is dark and starry at midnight, bright and starless at noon', () => {
    const night = light(0);
    const noon = light(12.5);
    expect(night.stars).toBeGreaterThan(0.8);
    expect(noon.stars).toBe(0);
    expect(noon.ambient).toBeGreaterThan(night.ambient * 2);
    expect(noon.fog.colour[1]).toBeGreaterThan(night.fog.colour[1] * 10);
  });

  it('warms the sun as it goes down', () => {
    const noon = light(12.5).sun.colour;
    const low = light(daylight(1).set - 0.3).sun.colour;
    expect(low[2] / low[0]).toBeLessThan(noon[2] / noon[0]);
  });

  it('casts by the moon at night and by the sun by day', () => {
    expect(keyLight(light(12.5)).moon).toBe(false);
    expect(keyLight(light(12.5)).intensity).toBeGreaterThan(2);
    const night = keyLight(light(1));
    expect(night.moon).toBe(true);
    expect(night.intensity).toBeGreaterThan(0.4);
  });

  it('greys and thickens under cloud, and hides the stars', () => {
    const clear = light(0);
    const cloudy = light(0, { weather: { cloud: 1, rain: 1 } });
    expect(cloudy.fog.density).toBeGreaterThan(clear.fog.density * 1.8);
    expect(cloudy.stars).toBe(0);
  });

  it('gives a shade that is never black and never brighter than a clear day’s', () => {
    for (let h = 0; h < 24; h += 0.5) {
      const l = light(h);
      const s = shadeOf(l);
      const lum = 0.2126 * s[0] + 0.7152 * s[1] + 0.0722 * s[2];
      expect(lum).toBeGreaterThan(0.06);
      expect(lum).toBeLessThan(0.29);
    }
  });
});

describe('the castle’s windows and the bell', () => {
  it('are dark by day, lit from dusk, fewer after midnight', () => {
    expect(windowsAt(12.5)).toBe(0);
    expect(windowsAt(ARRIVE)).toBeGreaterThan(0.4);
    expect(windowsAt(22)).toBe(1);
    expect(windowsAt(3)).toBeLessThan(0.7);
    expect(windowsAt(3)).toBeGreaterThan(0.5);
    expect(light(22).windows).toBe(1);
  });

  it('strikes the hour as the clock passes it, and nothing between', () => {
    expect(strikes(6.9, 7.01)).toBe(7);
    expect(strikes(11.9, 12.1)).toBe(12);
    expect(strikes(23.95, 24.05)).toBe(12);
    expect(strikes(13.5, 14.2)).toBe(2);
    expect(strikes(7.1, 7.9)).toBe(0);
    expect(strikes(8, 7)).toBe(0);
  });

  it('strikes twenty-four times a world day', () => {
    let c = newClock({ hour: 0.5 });
    let n = 0;
    for (let i = 0; i < DAY; i++) {
      const next = step(c, 1);
      if (strikes(c.t, next.t)) n += 1;
      c = next;
    }
    expect(n).toBe(24);
  });
});
