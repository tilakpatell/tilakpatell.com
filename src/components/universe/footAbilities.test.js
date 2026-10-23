import { describe, expect, it } from 'vitest';
import { ARTOO, BLAST, KNOCK_FOR, PLAYED, blastOn, cardOf, hopTo, inReach, kindOf, knockOf, lift, newAbilities, overcharged, pairOf, shoveOf, sprintOf, throwOf, throwStep, spend, tilesOf } from './footAbilities';
import { ABILITIES, JET } from '../galaxy/shared/fight';
import { METRE, apart, march, offset, person } from './foot';
import { PARTY } from './footFigures';

const R = 18;
const me = person([0, 1, 0], [0, 0, 1]);
const ahead = (m, side = 0) => ({ ...person(offset(me, m * METRE, side * METRE, R).n, [0, 0, 1]) });

describe('the crew’s abilities on the universe’s planets', () => {
  it('gives every crew member a pair the planets play, the galaxy’s own where they’re one of its heroes', () => {
    for (const crew of Object.values(PARTY))
      for (const p of crew) {
        const pair = pairOf(p.id);
        for (const slot of ['power', 'second']) {
          expect(cardOf(pair[slot]), `${p.id} ${slot}`).toBeTruthy();
          expect(PLAYED, `${p.id} ${slot}`).toContain(kindOf(pair[slot]));
        }
      }
    expect(pairOf('rick')).toEqual({ power: 'hop', second: 'overcharge' });
    expect(pairOf('han')).toEqual({ power: 'hanDetonator', second: 'hanSharpshooter' });
    expect(pairOf('luke')).toEqual({ power: 'lukePush', second: 'lukeRepulse' });
    expect(pairOf('artoo')).toEqual({ power: 'artooRockets', second: 'artooPatch' });
    expect(kindOf('artooRockets')).toBe('jetpack');
    expect(pairOf('nobody')).toEqual({ power: 'detonator', second: 'overcharge' });
  });

  it('starts a card’s cooldown on a press, and refuses it till it’s back', () => {
    const st = newAbilities();
    const a = spend(st, 'power', 'detonator', 10);
    expect(a).toMatchObject({ ok: true, kind: 'detonator' });
    expect(spend(st, 'power', 'detonator', 11)).toMatchObject({ ok: false, why: 'cooling' });
    expect(spend(st, 'power', 'detonator', 10 + ABILITIES.detonator.cool)).toMatchObject({ ok: true });
    expect(spend(st, 'second', 'nope', 0)).toMatchObject({ ok: false, why: 'none' });
    expect(spend(st, 'power', 'artooRockets', 0)).toMatchObject({ ok: false, why: 'held' });
  });

  it('keeps an overcharge and a sprint on for their time', () => {
    const st = newAbilities();
    spend(st, 'second', 'overcharge', 0);
    expect(overcharged(st, ABILITIES.overcharge.dur - 0.1)).toBe(true);
    expect(overcharged(st, ABILITIES.overcharge.dur + 0.1)).toBe(false);
    spend(st, 'power', 'sprint', 0);
    expect(sprintOf(st, 1)).toBe(ABILITIES.sprint.speed);
    expect(sprintOf(st, ABILITIES.sprint.dur + 0.1)).toBe(1);
  });

  it('lifts on the jetpack held while there’s fuel, and refills it on the ground', () => {
    const st = newAbilities();
    let w = { ...me };
    for (let i = 0; i < 10; i++) w = lift(st, w, true, 0.05, METRE);
    expect(w.vh).toBeGreaterThan(0);
    expect(st.jet.fuel).toBeLessThan(JET.tank);
    for (let i = 0; i < 200; i++) w = lift(st, { ...w, vh: 0 }, true, 0.05, METRE);
    expect(st.jet.on).toBe(false); // (the tank's dry)
    lift(st, { ...me, h: 0 }, false, JET.refill + 0.1, METRE);
    expect(st.jet.fuel).toBeCloseTo(JET.tank);
  });

  it('writes each tile’s key, name, cooldown and whether it’s on', () => {
    const st = newAbilities();
    spend(st, 'second', 'overcharge', 0);
    const [g, v] = tilesOf(st, { power: 'hop', second: 'overcharge' }, 1);
    expect(g).toMatchObject({ key: 'G', name: ABILITIES.hop.name, left: 0, on: false });
    expect(v).toMatchObject({ key: 'V', name: ABILITIES.overcharge.name, full: ABILITIES.overcharge.cool, on: true });
    expect(v.left).toBeCloseTo(ABILITIES.overcharge.cool - 1);
    expect(tilesOf(newAbilities(), pairOf('artoo'), 0)[0]).toMatchObject({ name: ARTOO.artooRockets.name, held: true, left: 0 });
  });

  it('reaches who’s in front for a push, everyone round for a repulse', () => {
    const push = knockOf(ABILITIES.lukePush);
    const round = knockOf(ABILITIES.lukeRepulse);
    expect(round.cone).toBe(Math.PI);
    const front = ahead(3);
    const behind = ahead(-3);
    expect(inReach(me, front, R, push, METRE).hit).toBe(true);
    expect(inReach(me, behind, R, push, METRE).hit).toBe(false);
    expect(inReach(me, behind, R, round, METRE).hit).toBe(true);
    expect(inReach(me, ahead(push.range + 2), R, push, METRE).hit).toBe(false);
    expect(inReach(me, ahead(1), R, push, METRE).k).toBeGreaterThan(inReach(me, ahead(push.range - 0.5), R, push, METRE).k);
  });

  it('shoves a trooper away along the ground, off its feet, firing at no one till it’s down', () => {
    const t = { id: 1, kind: 'stormtrooper', ...ahead(3), hp: 2, cool: 0, hold: 10, alive: true, dead: 0, swing: 0, aim: 0, vh: 4 * METRE, h: 0.001 };
    const shove = shoveOf(me, t, 8 * METRE);
    expect(shove.left).toBe(KNOCK_FOR);
    let troops = [{ ...t, shove }];
    let shots = 0;
    for (let i = 0; i < 33; i++) {
      const r = march(troops, [{ id: 'me', ...me }], 1 / 30, R, () => 0.5);
      troops = r.troops;
      shots += r.shots.length;
    }
    expect(apart(troops[0], me, R)).toBeGreaterThan(apart(t, me, R) + 2 * METRE);
    expect(troops[0].shove).toBeNull();
    expect(troops[0].h).toBe(0);
    expect(shots).toBe(0);
  });

  it('throws a charge in an arc that goes off on landing or at its fuse', () => {
    const card = ABILITIES.detonator;
    let g = throwOf(me, card, R, METRE);
    expect(g.v[1]).toBeGreaterThan(0); // (up as well as on)
    let steps = 0;
    while (!g.boom && steps < 600) {
      g = throwStep(g, 1 / 60, R, METRE);
      steps++;
    }
    expect(g.boom).toBe(true);
    expect(g.age).toBeLessThanOrEqual(card.fuse + 1e-9);
    const out = apart({ n: g.p.map((x) => x / Math.hypot(...g.p)) }, me, R);
    expect(out).toBeGreaterThan(2 * METRE);
  });

  it('hurts hardest at the middle of the blast, and not past its radius', () => {
    const card = ABILITIES.fulminate;
    const mid = blastOn(0, card, METRE);
    const edge = blastOn(card.radius * METRE * 0.95, card, METRE);
    expect(mid.damage).toBe(card.damage);
    expect(edge.damage).toBeGreaterThanOrEqual(1);
    expect(edge.damage).toBeLessThan(mid.damage);
    expect(blastOn(card.radius * METRE * 1.1, card, METRE).hit).toBe(false);
    expect(BLAST.you).toBeGreaterThan(0);
  });

  it('hops a portal’s reach on, shorter where the far end is blocked, nowhere when it all is', () => {
    const card = ABILITIES.hop;
    const far = hopTo(me, card, R, () => true, METRE);
    expect(apart(far, me, R)).toBeCloseTo(card.reach * METRE);
    const short = hopTo(me, card, R, (to) => apart(to, me, R) < card.reach * METRE * 0.8, METRE);
    expect(apart(short, me, R)).toBeCloseTo(card.reach * METRE * 0.75);
    expect(hopTo(me, card, R, () => false, METRE)).toBeNull();
  });
});
