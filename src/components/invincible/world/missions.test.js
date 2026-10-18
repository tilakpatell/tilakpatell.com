import { describe, expect, it } from 'vitest';
import { CAST } from '../cast';
import { KINDS, PORTAL } from './foes';
import { CITY, buildWorld, near } from './map';
import { MISSIONS, PHOTO_SPOTS, RADIO, RADIO_CALLS, STORY, feedMission, keepStory, loadStory, markerOf, missionOf, newRadio, nextRadioCall, nextStory, placeOf, startMission, stepOf } from './missions';
import { RINGS } from './quests';

const W = buildWorld();
const inside = (b, p, pad = 0) => p[0] > b.x0 - pad && p[0] < b.x1 + pad && p[2] > b.z0 - pad && p[2] < b.z1 + pad && p[1] > b.y0 - pad && p[1] < b.y1 + pad;
const inCity = (p) => p[0] > CITY.x0 && p[0] < CITY.x1 && p[2] > CITY.z0 && p[2] < CITY.z1 && p[1] < 5000;

// feed a list of events, collecting what comes out
function feed(p, events) {
  const out = [];
  for (const ev of events) {
    const r = feedMission(p, ev);
    p = r.progress;
    out.push(...r.out);
  }
  return { p, out };
}
const ticks = (seconds, dt = 0.05) => Array.from({ length: Math.ceil(seconds / dt) }, () => ({ type: 'tick', dt }));
const at = (p, extra = {}) => ({ type: 'at', p, mode: 'air', speed: 0, ...extra });
const types = (out) => out.map((o) => o.type);
const caught = () => ({ type: 'caught', source: 'mission' });
// n knock-outs of a kind, each its own foe (ids from `from`)
const ko = (kind, n, from = 0) => Array.from({ length: n }, (_, i) => ({ type: 'ko', kind, id: from + i }));

describe('the season', () => {
  it('has seven episodes in order, each with its people and its villains in the cast', () => {
    expect(STORY).toEqual(['ep1', 'ep2', 'ep3', 'ep4', 'ep5', 'ep6', 'ep7']);
    for (const m of MISSIONS) {
      expect(m.giver in CAST, `${m.id}'s giver`).toBe(true);
      if (m.start?.npc) expect(m.start.npc in CAST).toBe(true);
      for (const s of m.steps) {
        if (s.npc) expect(s.npc in CAST, `${m.id}: ${s.npc}`).toBe(true);
        if (s.kind) for (const k of [s.kind].flat()) expect(k in KINDS, `${m.id}: ${k}`).toBe(true);
        for (const [k] of s.spawn ?? []) expect(k in KINDS).toBe(true);
        if (s.wave) expect(s.wave.kind in KINDS).toBe(true);
        expect(typeof s.text).toBe('string');
      }
      for (const [who] of [...m.intro, ...m.done]) expect(who in CAST, `${m.id}: ${who} speaks`).toBe(true);
    }
  });
  it('puts every marker and gate on open ground or in the air', () => {
    const points = [];
    for (const m of MISSIONS)
      for (const s of m.steps) {
        if (Array.isArray(s.marker)) points.push(s.marker);
        if (Array.isArray(s.at) && s.type !== 'protect') points.push(s.at); // (what's protected is a building)
        for (const g of s.gates ?? []) points.push(g);
        for (const [, , where] of s.spawn ?? []) if (Array.isArray(where)) points.push(where);
      }
    expect(points.length).toBeGreaterThan(20);
    for (const p of points.filter(inCity)) {
      for (const b of near(W, p[0], p[2], 6)) expect(inside(b, [p[0], p[1] == null ? 1 : Math.max(p[1], 1), p[2]]), `a marker at ${p} is inside a building`).toBe(false);
    }
    const bank = placeOf('bank');
    for (const b of near(W, bank.door[0], bank.door[2], 2)) expect(inside(b, [bank.door[0], 1, bank.door[2]])).toBe(false);
  });
  it('gives the next episode, and none once the season is done', () => {
    expect(nextStory([])).toBe('ep1');
    expect(nextStory(['ep1'])).toBe('ep2');
    expect(nextStory(['ep1', 'ep2', 'ep3', 'ep4', 'ep5', 'ep6'])).toBe('ep7');
    expect(nextStory(STORY)).toBe(null);
    expect(nextStory('garbage')).toBe('ep1');
  });
  it('loads anything as a story, keeping only real episodes and times', () => {
    expect(loadStory('garbage')).toEqual({ done: [], best: {} });
    expect(loadStory(null)).toEqual({ done: [], best: {} });
    expect(loadStory({ done: ['ep1', 'nope', 'ep1', 3], best: { ep1: 90, ep2: 'x', nope: 4, ep3: -1 } })).toEqual({ done: ['ep1'], best: { ep1: 90 } });
    expect(keepStory({ done: ['ep1'], best: { ep1: 90 } }, 'ep1', 80)).toEqual({ done: ['ep1'], best: { ep1: 80 } });
    expect(keepStory(null, 'ep2', 100)).toEqual({ done: ['ep2'], best: { ep2: 100 } });
  });
});

describe('each episode, end to end', () => {
  it('ep1: Dad’s rings in order, within the time, and the best is kept', () => {
    let p = startMission('ep1');
    expect(markerOf(p)).toEqual(RINGS[0].p);
    const r = feed(p, [...ticks(10), ...RINGS.map((_, i) => ({ type: 'ring', i })), ...ticks(1)]);
    expect(r.p.done).toBe(true);
    expect(types(r.out)).toContain('done');
    expect(r.out.at(-1).achievement).toBe('dadsrings');
    expect(r.p.best).toBeCloseTo(10, 0);
    // out of order rings don't count
    const q = feed(startMission('ep1'), [{ type: 'ring', i: 3 }]);
    expect(q.p.count).toBe(0);
  });
  it('ep1 counts the first ring as the lesson starts, from its ring or its start', () => {
    const rest = RINGS.slice(1).map((_, i) => ({ type: 'ring', i: i + 1 }));
    expect(feed(startMission('ep1'), [{ type: 'lesson-start' }, { type: 'ring', i: 0 }, ...rest]).p.done).toBe(true);
    expect(feed(startMission('ep1'), [{ type: 'lesson-start' }, ...rest]).p.done).toBe(true);
  });
  it('ep1 fails when the time runs out', () => {
    const r = feed(startMission('ep1'), [{ type: 'ring', i: 0 }, ...ticks(241)]);
    expect(r.p.fail).toBe('time');
    expect(r.p.done).toBe(false);
  });
  it('ep2: to the bank, a slam in front of the truck, and the twins down', () => {
    let p = startMission('ep2');
    expect(missionOf('ep2').title).toBe('Here Goes Nothing');
    let r = feed(p, [at([200, 60, 0]), at([50, 30, 0])]); // any height
    expect(r.p.step).toBe(1);
    expect(r.out.find((o) => o.type === 'step')?.car).toEqual({ from: placeOf('bank').door, speed: 22 });
    // the truck's where the scene says; a soft landing far from it does nothing
    r = feed(r.p, [at([100, 20, 0], { car: [300, 0, 0] }), { type: 'land', speed: 30, p: [100, 0, 0] }]);
    expect(r.p.step).toBe(1);
    expect(markerOf(r.p, { car: [310, 0, 0] })).toEqual([310, 0, 0]);
    r = feed(r.p, [at([310, 20, 0], { car: [300, 0, 0] }), { type: 'land', speed: 10, p: [310, 0, 0] }]);
    expect(r.p.step).toBe(1); // (too soft)
    r = feed(r.p, [{ type: 'land', speed: 30, p: [310, 0, 0] }]);
    expect(r.p.step).toBe(2);
    expect(r.out.find((o) => o.type === 'step')?.spawn).toEqual([['mauler', 2, { car: true }]]);
    r = feed(r.p, [{ type: 'ko', kind: 'flaxan' }, { type: 'ko', kind: 'mauler' }, { type: 'ko', kind: 'mauler' }]);
    expect(r.p.done).toBe(true);
    expect(r.out.at(-1)).toMatchObject({ type: 'done', achievement: 'maulers' });
  });
  it('ep3: the school, then four students caught and Doc Seismic down, in either order', () => {
    const p0 = startMission('ep3');
    expect(stepOf(p0)).toMatchObject({ type: 'step', i: 0, spawn: [['seismic', 1, [-2610, 0, -418]]] });
    let r = feed(p0, [at([-2610, 40, -395])]);
    expect(r.p.step).toBe(1);
    expect(r.out[0]).toMatchObject({ type: 'step', i: 1, spawn: null });
    expect(markerOf(r.p, {})).toEqual([-2610, 12, -418]);
    expect(markerOf(r.p, { faller: [-2600, 8, -418] })).toEqual([-2600, 8, -418]);
    const school = r.p;
    // the students first, then him
    r = feed(school, [caught(), caught(), caught()]);
    expect(r.p.count).toBe(3);
    r = feed(r.p, [caught()]);
    expect(r.p.step).toBe(1); // (four caught, and he's still up)
    expect(markerOf(r.p, { foes: [[-2600, 20, -400]] })).toEqual([-2600, 20, -400]);
    r = feed(r.p, [{ type: 'ko', kind: 'seismic', id: 7 }]);
    expect(r.p.done).toBe(true);
    // him first, then the students
    r = feed(school, [{ type: 'ko', kind: 'seismic', id: 7 }]);
    expect(r.p.done).toBe(false);
    r = feed(r.p, [caught(), caught(), caught(), caught()]);
    expect(r.p.done).toBe(true);
  });
  it('ep3 counts only its own students: a rescue somewhere else in the city is not one', () => {
    let r = feed(startMission('ep3'), [at([-2610, 40, -395])]);
    r = feed(r.p, [{ type: 'caught', source: 'city' }, { type: 'caught' }, caught()]);
    expect(r.p.count).toBe(1);
  });
  it('ep3 with Doc Seismic down: the roof still shakes a student off every 6 s until all four are caught', () => {
    let r = feed(startMission('ep3'), [at([-2610, 40, -395]), caught()]);
    // (while he's up, his quakes do it: the mission asks for none)
    expect(types(feed(r.p, ticks(13)).out)).not.toContain('shake');
    r = feed(r.p, [{ type: 'ko', kind: 'seismic', id: 3 }, ...ticks(13)]);
    const shakes = r.out.filter((o) => o.type === 'shake');
    expect(shakes).toHaveLength(2);
    expect(shakes[0].at).toEqual(placeOf('roof').p);
    r = feed(r.p, [caught(), caught(), caught(), ...ticks(13)]);
    expect(r.p.done).toBe(true);
    expect(types(r.out)).not.toContain('shake');
  });
  it('ep4: land on the Moon, talk to Allen, three gates home within the time', () => {
    const m = missionOf('ep4');
    let r = feed(startMission('ep4'), [{ type: 'land', speed: 2, p: [0, 0, 0] }]);
    expect(r.p.step).toBe(0); // (a landing in the city isn't the Moon)
    r = feed(r.p, [{ type: 'land', speed: 2, p: [0, 0, 0], body: 'moon' }]);
    expect(r.p.step).toBe(1);
    r = feed(r.p, [{ type: 'talk', npc: 'cecil' }, { type: 'talk', npc: 'allen' }]);
    expect(r.p.step).toBe(2);
    const gates = m.steps[2].gates;
    expect(markerOf(r.p)).toEqual(gates[0]);
    r = feed(r.p, [...ticks(20), at(gates[0]), at(gates[2]), at(gates[1])]);
    expect(r.p.count).toBe(2); // (the last one out of order didn't count)
    r = feed(r.p, [at(gates[2])]);
    expect(r.p.done).toBe(true);
    const late = feed(feed(startMission('ep4'), [{ type: 'land', body: 'moon' }, { type: 'talk', npc: 'allen' }]).p, ticks(151));
    expect(late.p.fail).toBe('time');
  });
  it('ep5: two waves of Flaxans, then through the portal faster than 120 m/s', () => {
    expect(stepOf(startMission('ep5')).spawn).toEqual([['flaxan', 12, PORTAL.p]]);
    let r = feed(startMission('ep5'), Array.from({ length: 12 }, () => ({ type: 'ko', kind: 'flaxan' })));
    expect(r.p.step).toBe(1);
    r = feed(r.p, [...Array.from({ length: 10 }, () => ({ type: 'ko', kind: 'flaxan' })), { type: 'ko', kind: 'flaxanElite' }]);
    expect(r.p.step).toBe(1);
    r = feed(r.p, [{ type: 'ko', kind: 'flaxanElite' }]);
    expect(r.p.step).toBe(2);
    r = feed(r.p, [at(PORTAL.p, { speed: 80 })]);
    expect(r.p.done).toBe(false);
    r = feed(r.p, [at([PORTAL.p[0] + 5, PORTAL.p[1], PORTAL.p[2]], { speed: 130 })]);
    expect(r.p.done).toBe(true);
    expect(r.out.at(-1).achievement).toBe('flaxans');
  });
  it('ep6: hold the hangar for ninety seconds, then every clone down; it falls when the hangar does', () => {
    let r = feed(startMission('ep6'), [{ type: 'hurt', what: 'hangar', hp: 90 }, ...ticks(60)]);
    expect(r.p.step).toBe(0);
    expect(r.p.hp).toBe(90);
    r = feed(r.p, ticks(31));
    expect(r.p.step).toBe(1);
    // (the step asks for Maulers up to six in all, so none it wants can be missing)
    expect(r.out.find((o) => o.type === 'step')?.upto).toEqual(['mauler', 6, [1560, 0, -440]]);
    r = feed(r.p, ko('mauler', 6));
    expect(r.p.done).toBe(true);
    const lost = feed(startMission('ep6'), [{ type: 'hurt', what: 'hangar', hp: 50 }, { type: 'hurt', what: 'cecil', hp: 0 }, { type: 'hurt', what: 'hangar', hp: 0 }]);
    expect(lost.p.fail).toBe('lost');
  });
  it('ep6 counts a Mauler beaten during the hold toward the six', () => {
    let r = feed(startMission('ep6'), [...ko('mauler', 1), ...ticks(91)]);
    expect(r.p.step).toBe(1);
    expect(r.p.count).toBe(1);
    r = feed(r.p, ko('mauler', 5, 10));
    expect(r.p.done).toBe(true);
    // all six down before the ninety seconds are up: done as the hold ends
    r = feed(startMission('ep6'), [...ko('mauler', 6), ...ticks(91)]);
    expect(r.p.done).toBe(true);
  });
  it('a knock-out counts once, however often it is said', () => {
    const r = feed(startMission('ep2'), [at([50, 30, 0]), at([310, 20, 0], { car: [300, 0, 0] }), { type: 'land', speed: 30, p: [310, 0, 0] }, { type: 'ko', kind: 'mauler', id: 4 }, { type: 'ko', kind: 'mauler', id: 4 }]);
    expect(r.p.step).toBe(2);
    expect(r.p.count).toBe(1);
  });
  it('a later wave counts only its own: ep5’s second wave isn’t done by the first', () => {
    const r = feed(startMission('ep5'), ko('flaxan', 12));
    expect(r.p.step).toBe(1);
    expect(r.p.count).toBe(0);
  });
  it('ep7: follow Dad over his four points, land at home, and Think, Mark!', () => {
    const m = missionOf('ep7');
    expect(m.start.after).toEqual(['ep1', 'ep2', 'ep3', 'ep4', 'ep5', 'ep6']);
    let p = startMission('ep7');
    const pts = m.steps.slice(0, 4).map((s) => s.to);
    for (const to of pts) {
      const r = feed(p, [at([to[0] + 10, to[1], to[2]], { npcs: { omni: to } }), ...ticks(1)]);
      p = r.p;
    }
    expect(p.step).toBe(4);
    let r = feed(p, [{ type: 'land', speed: 3, p: [-2050, 0, 258] }]);
    expect(r.p.step).toBe(5);
    r = feed(r.p, [{ type: 'use', id: 'photo' }, { type: 'use', id: 'thinkmark', won: false }]);
    expect(r.p.done).toBe(true);
    expect(r.out.at(-1).achievement).toBe('season');
  });
  it('ep7 fails when he leaves Dad 200 m behind for ten seconds', () => {
    let r = feed(startMission('ep7'), [at([40, 150, -60], { npcs: { omni: [40, 150, -60] } }), ...ticks(5)]);
    expect(r.p.fail).toBe(null);
    r = feed(r.p, [at([400, 150, -60]), ...ticks(9)]);
    expect(r.p.fail).toBe(null);
    r = feed(r.p, ticks(2));
    expect(r.p.fail).toBe('left');
  });
  it('abandoned: nothing more counts', () => {
    const r = feed(startMission('ep2'), [{ type: 'abandon' }, at([50, 30, 0])]);
    expect(r.p.fail).toBe('abandoned');
    expect(r.p.step).toBe(0);
    expect(markerOf(r.p)).toBe(null);
    expect(stepOf(r.p)).toBe(null);
    expect(feedMission(null, { type: 'tick', dt: 1 })).toEqual({ progress: null, out: [] });
  });
  it('takes a hidden tab as one short step', () => {
    const r = feed(startMission('ep1'), [{ type: 'tick', dt: 60 }, { type: 'tick', dt: NaN }]);
    expect(r.p.t).toBeCloseTo(0.05, 5);
    expect(r.p.fail).toBe(null);
  });
});

describe('the radio', () => {
  // the radio run for `seconds` in the given state, collecting its calls
  function run(radio, seconds, state) {
    const calls = [];
    for (let t = 0; t < seconds; t += 0.05) {
      const r = nextRadioCall(radio, 0.05, state);
      radio = r.radio;
      if (r.call) calls.push({ call: r.call, t });
    }
    return { radio, calls };
  }
  it('calls every 60–120 s in the city with nothing on, never the same call twice running', () => {
    const { calls } = run(newRadio(), 600, { mission: null, zone: 'city', done: [] });
    expect(calls.length).toBeGreaterThanOrEqual(5);
    expect(calls.length).toBeLessThanOrEqual(10);
    for (let i = 1; i < calls.length; i++) {
      expect(calls[i].t - calls[i - 1].t).toBeGreaterThanOrEqual(RADIO.every[0] - 0.1);
      expect(calls[i].t - calls[i - 1].t).toBeLessThanOrEqual(RADIO.every[1] + 0.1);
      expect(calls[i].call).not.toBe(calls[i - 1].call);
    }
    for (const c of calls) expect(Boolean(missionOf(c.call)?.side || RADIO_CALLS[c.call])).toBe(true);
  });
  it('offers Cecil’s portal call while nothing’s fighting, and never during a fight', () => {
    expect(RADIO_CALLS.portal.who).toBe('cecil');
    expect(run(newRadio(), 1200, { mission: null, zone: 'city', fight: false }).calls.some((c) => c.call === 'portal')).toBe(true);
    expect(run(newRadio(), 1200, { mission: null, zone: 'city', fight: true }).calls.some((c) => c.call === 'portal')).toBe(false);
  });
  it('says nothing while a story mission is on, or out in space, and offers Eve’s race only beside her', () => {
    expect(run(newRadio(), 300, { mission: 'ep2', zone: 'city' }).calls).toEqual([]);
    expect(run(newRadio(), 300, { mission: null, zone: 'space' }).calls).toEqual([]);
    expect(run(newRadio(), 600, { mission: null, zone: 'city' }).calls.some((c) => c.call === 'everace')).toBe(false);
    expect(run(newRadio(), 1200, { mission: null, zone: 'city', eve: true }).calls.some((c) => c.call === 'everace')).toBe(true);
  });
  it('offers the photos not yet taken first', () => {
    const { calls } = run(newRadio(), 1200, { mission: null, zone: 'city', done: ['photo1', 'photo2', 'photo3', 'photo4'] });
    const photos = calls.filter((c) => c.call.startsWith('photo'));
    expect(photos.length).toBeGreaterThan(0);
    for (const c of photos) expect(c.call).toBe('photo5');
  });
  it('a chase ends with a landing within 12 m of the car, and fails after 45 s', () => {
    let r = feed(startMission('chase'), [at([0, 20, 0], { car: [100, 0, 0] }), { type: 'land', speed: 3, p: [120, 0, 0] }]);
    expect(r.p.done).toBe(false);
    r = feed(r.p, [{ type: 'land', speed: 3, p: [108, 0, 0] }]);
    expect(r.p.done).toBe(true);
    const late = feed(startMission('chase'), ticks(46));
    expect(late.p.fail).toBe('late');
  });
  it('Eve’s race: eight gates round downtown within a minute', () => {
    const gates = missionOf('everace').steps[0].gates;
    expect(gates).toHaveLength(8);
    const r = feed(startMission('everace'), [...ticks(30), ...gates.map((g) => at(g))]);
    expect(r.p.done).toBe(true);
    expect(feed(startMission('everace'), ticks(61)).p.fail).toBe('time');
  });
  it('a photo wants him in the spot, facing within 20°, and E', () => {
    expect(PHOTO_SPOTS).toHaveLength(5);
    const q = PHOTO_SPOTS[0];
    let r = feed(startMission(q.id), [at([q.p[0] + 30, q.p[1], q.p[2]], { face: q.face }), { type: 'use', id: 'photo' }]);
    expect(r.p.done).toBe(false);
    r = feed(r.p, [at([q.p[0] + 5, q.p[1], q.p[2]], { face: q.face + 1 }), { type: 'use', id: 'photo' }]);
    expect(r.p.done).toBe(false);
    r = feed(r.p, [at([q.p[0] + 5, q.p[1], q.p[2]], { face: q.face + 0.2 }), { type: 'use', id: 'photo' }]);
    expect(r.p.done).toBe(true);
  });
});
