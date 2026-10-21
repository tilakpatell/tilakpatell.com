import { describe, expect, it } from 'vitest';
import { BOW, buckbeakBot, newBow, newRide, result, rideAt, ridePath, stepBow } from './buckbeak';

const DT = 1 / 60;
function bow(b, input, t) {
  const whats = [];
  for (let s = 0; s < t - 1e-9; s += DT) {
    const r = stepBow(b, typeof input === 'function' ? input(b) : input, DT);
    b = r.bow;
    if (r.what) whats.push(r.what);
  }
  return { b, whats };
}
const close = { dist: 3, closing: 0 };

describe('the bow', () => {
  it('held until he answers, he bows back', () => {
    const { b, whats } = bow(newBow(), { ...close, bowing: true }, BOW.hold + BOW.think[1] + 0.1);
    expect(b.phase).toBe('bowed');
    expect(whats).toEqual(['bowing', 'bowed']);
  });
  it('a bob down and up again makes him rear, and he calms after a while', () => {
    let b = bow(newBow(), { ...close, bowing: true }, 0.3).b;
    const r = stepBow(b, { ...close, bowing: false }, DT);
    expect(r.what).toBe('rear');
    b = bow(r.bow, close, BOW.rear + 0.1).b;
    expect(b.phase).toBe('wary');
  });
  it('standing up before he has decided leaves him wary, not angry', () => {
    const b = bow(newBow(), { ...close, bowing: true }, BOW.hold - 0.2).b;
    const r = stepBow(b, { ...close, bowing: false }, DT);
    expect(r.what).toBe('wary');
    expect(r.bow.phase).toBe('wary');
  });
  it('coming in at a run makes him rear before you can bow', () => {
    const r = stepBow(newBow(), { dist: 6, closing: 5, bowing: false }, DT);
    expect(r.what).toBe('rear');
    // walking up is fine
    expect(stepBow(newBow(), { dist: 6, closing: 1.5 }, DT).what).toBe(null);
  });
  it('a bow from too far off doesn’t count', () => {
    expect(bow(newBow(), { dist: 8, closing: 0, bowing: true }, 5).b.phase).toBe('wary');
  });
  it('the bot bows when close and gets its answer', () => {
    const { b } = bow(newBow(), (s) => ({ ...close, bowing: buckbeakBot(s, close.dist) }), 6);
    expect(b.phase).toBe('bowed');
  });
});

describe('the ride', () => {
  const places = { paddock: [320, 4, 140], lake: [-60, -1, 360], castle: [0, 40, 0] };
  const ride = newRide(ridePath(places));
  it('starts and ends on his back in the paddock', () => {
    const start = rideAt(ride, 0);
    const end = rideAt(ride, ride.duration + 1);
    for (const p of [start.p, end.p]) {
      expect(Math.hypot(p[0] - 320, p[2] - 140)).toBeLessThan(0.01);
      expect(p[1]).toBeCloseTo(4 + 1.6);
    }
    expect(end.done).toBe(true);
    expect(start.done).toBe(false);
  });
  it('takes about a minute, and flows: no jump between frames', () => {
    expect(ride.duration).toBeGreaterThan(45);
    expect(ride.duration).toBeLessThan(150);
    let last = rideAt(ride, 0).p;
    let most = 0;
    for (let t = DT; t <= ride.duration; t += DT) {
      const p = rideAt(ride, t).p;
      most = Math.max(most, Math.hypot(p[0] - last[0], p[1] - last[1], p[2] - last[2]) / DT);
      last = p;
    }
    expect(most).toBeLessThan(ride.speed * 1.6);
  });
  it('goes low over the lake and up round the castle’s towers', () => {
    let lowOverLake = Infinity;
    let highNearCastle = 0;
    for (let t = 0; t <= ride.duration; t += 0.25) {
      const { p } = rideAt(ride, t);
      if (Math.hypot(p[0] + 60, p[2] - 360) < 50) lowOverLake = Math.min(lowOverLake, p[1]);
      if (Math.hypot(p[0], p[2]) < 200) highNearCastle = Math.max(highNearCastle, p[1]);
    }
    expect(lowOverLake).toBeLessThan(-1 + 7);
    expect(lowOverLake).toBeGreaterThan(-1 + 1.5);
    expect(highNearCastle).toBeGreaterThan(40 + 50);
  });
  it('faces the way it flies and leans into the turns', () => {
    const a = rideAt(ride, 20);
    const b = rideAt(ride, 20.1);
    const yaw = Math.atan2(b.p[0] - a.p[0], b.p[2] - a.p[2]);
    expect(Math.abs(Math.atan2(Math.sin(yaw - a.yaw), Math.cos(yaw - a.yaw)))).toBeLessThan(0.2);
    let banked = 0;
    for (let t = 0; t < ride.duration; t += 0.5) banked = Math.max(banked, Math.abs(rideAt(ride, t).bank));
    expect(banked).toBeGreaterThan(0.1);
  });
  it('is ten points for the lesson', () => {
    expect(result()).toEqual({ type: 'lesson', id: 'buckbeak', done: true, points: 10 });
  });
});
