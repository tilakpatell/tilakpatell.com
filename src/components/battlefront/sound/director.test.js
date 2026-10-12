import { describe, expect, it } from 'vitest';
import { KILL_PITCH, MAX_SHOTS, VO_GAP, createDirector } from './director.js';
import { LAND_DROP, STRIDE } from './mix.js';
import { loadRulebook } from '../../../lib/battlefront/rulebook.js';
import { hothFlatNav } from '../../../lib/battlefront/fixtures/hothFlat.js';
import { PLAYER_ID, STEP, addPlayer, createBattle, deploy, step, view as battleView } from '../battle.js';

// a player that remembers every call
function fakePlayer() {
  const calls = [];
  const p = {
    calls,
    duckKind: 'none',
    musicName: null,
    play: (name, opts = {}) => {
      calls.push({ name, ...opts });
      return { stop: () => calls.push({ stop: name }) };
    },
    music: (name, opts = {}) => {
      p.musicName = name;
      calls.push({ music: name, ...opts });
      return { stop: () => {} };
    },
    stopMusic: () => {
      p.musicName = null;
      calls.push({ music: null });
    },
    duck: (kind) => {
      p.duckKind = kind;
    },
  };
  return p;
}
const names = (p) => p.calls.filter((c) => c.name).map((c) => c.name);
const soldier = (id, at, more = {}) => ({ id, kind: 'soldier', team: 1, at, yaw: 0, vel: [0, 0], stance: 'stand', weapon: 'a280', ...more });
const view = (over = {}) => ({
  time: 10,
  entities: [soldier('me', [0, 0, 0], { team: 2, weapon: 'e11' })],
  player: { id: 'me', state: 'alive', at: [0, 0, 0], yaw: 0, heat: 0, overheated: false, warning: 0.75, hitAt: null, killAt: null },
  deploy: { open: false },
  mode: { objectives: [{ meter: 0 }], tickets: 90, result: null },
  ...over,
});
const make = () => {
  const player = fakePlayer();
  const d = createDirector({ player, me: 'me', team: 2, rng: () => 0.5 });
  return { player, d };
};

describe('the blaster’s layers', () => {
  it('plays the player’s own shot close, with the HiFi transient and the field’s tail, in the middle', () => {
    const { player, d } = make();
    d.update(view(), [{ type: 'shot', by: 'me' }]);
    const shot = player.calls.filter((c) => c.name?.startsWith('blaster.'));
    expect(shot.map((c) => c.name)).toEqual(['blaster.e11.close', 'blaster.hifi', 'blaster.noise.close']);
    for (const c of shot) expect(c.pan).toBe(0);
    expect(shot[0].gain).toBeCloseTo(1);
  });

  it('crosses a bot’s shot to its weapon’s distant take by its distance, on its side', () => {
    const { player, d } = make();
    const v = view({ entities: [soldier('me', [0, 0, 0], { team: 2 }), soldier('b', [14, 0, 0])] });
    d.update(v, [{ type: 'shot', by: 'b' }]);
    const n = names(player);
    expect(n).toContain('blaster.a280.close');
    expect(n).toContain('blaster.a280.distant');
    expect(player.calls.find((c) => c.name === 'blaster.a280.distant').pan).toBeCloseTo(1);
    expect(n).not.toContain('blaster.noise.distant');
  });

  it('a shot half a kilometre off is the far tail, the distant take faint under it, nothing close', () => {
    const { player, d } = make();
    const v = view({ entities: [soldier('me', [0, 0, 0], { team: 2 }), soldier('b', [0, 0, 500])] });
    d.update(v, [{ type: 'shot', by: 'b' }]);
    const n = names(player).filter((x) => x.startsWith('blaster.'));
    expect(n).toContain('blaster.noise.distant');
    expect(n).not.toContain('blaster.a280.close');
    expect(n).not.toContain('blaster.hifi');
    expect(player.calls.find((c) => c.name === 'blaster.a280.distant')?.gain ?? 0).toBeLessThan(0.1);
  });

  it('plays the nearest few shots of a step, the player’s own always', () => {
    const { player, d } = make();
    const bots = Array.from({ length: 20 }, (_, i) => soldier(`b${i}`, [10 + i * 5, 0, 0]));
    const v = view({ entities: [soldier('me', [0, 0, 0], { team: 2, weapon: 'e11' }), ...bots] });
    d.update(v, [...bots.map((b) => ({ type: 'shot', by: b.id })), { type: 'shot', by: 'me' }]);
    const close = player.calls.filter((c) => c.name?.endsWith('.close') && c.name !== 'blaster.noise.close');
    expect(close.length).toBeLessThanOrEqual(MAX_SHOTS);
    expect(names(player)).toContain('blaster.e11.close');
  });
});

describe('the feet', () => {
  it('plant the walk set every stride while the body walks, and nothing standing', () => {
    const { player, d } = make();
    const walking = () => view({ entities: [soldier('me', [0, 0, 0], { team: 2, vel: [1.9, 0] })] });
    const steps = Math.ceil(STRIDE.walk / 1.9 / 0.05);
    for (let i = 0; i < steps; i++) d.update(walking(), [], 0.05);
    expect(names(player).filter((n) => n.startsWith('step.'))).toEqual(['step.walk']);
    const step = player.calls.find((c) => c.name === 'step.walk');
    expect(step.gain).toBeGreaterThanOrEqual(0.15);
    expect(step.gain).toBeLessThan(0.5);
    for (let i = 0; i < steps; i++) d.update(view(), [], 0.05);
    expect(names(player).filter((n) => n.startsWith('step.'))).toHaveLength(1);
  });

  it('sprint under fire, and the window drops them', () => {
    const { player, d } = make();
    const running = (t) => view({ time: t, entities: [soldier('me', [0, 0, 0], { team: 2, vel: [5.9, 0] })] });
    d.update(running(10), [{ type: 'shot', by: 'me' }], 0.05);
    for (let i = 1; i <= 10; i++) d.update(running(10 + i * 0.05), [], 0.05);
    expect(names(player).filter((n) => n.startsWith('step.'))).toEqual([]);
    for (let i = 1; i <= 60; i++) d.update(running(10.5 + i * 0.05), [], 0.05);
    expect(names(player).filter((n) => n.startsWith('step.'))).toContain('step.sprint');
  });

  it('land when the body drops off a ledge, louder the further, and not on a slope run down', () => {
    const { player, d } = make();
    const at = (y, t) => view({ time: t, entities: [soldier('me', [0, y, 0], { team: 2 })] });
    d.update(at(10, 10), [], 0.05);
    d.update(at(10 - LAND_DROP / 2, 10.05), [], 0.05);
    expect(names(player).filter((n) => n === 'step.land')).toEqual([]);
    d.update(at(8, 10.1), [], 0.05);
    expect(names(player).filter((n) => n === 'step.land' || n === 'cloth.land')).toEqual(['step.land', 'cloth.land']);
    const soft = player.calls.find((c) => c.name === 'step.land').gain;
    d.update(at(2, 10.15), [], 0.05);
    const hard = player.calls.filter((c) => c.name === 'step.land')[1].gain;
    expect(soft).toBeGreaterThanOrEqual(0.5);
    expect(hard).toBe(1);
    // (a new life starts where it is put: no landing for the spawn's height)
    d.update(view({ time: 11, player: { ...view().player, state: 'deploying' }, entities: [] }), [], 0.05);
    d.update(at(300, 12), [], 0.05);
    d.update(at(300, 12.05), [], 0.05);
    expect(names(player).filter((n) => n === 'step.land')).toHaveLength(2);
  });

  it('the jump’s and the landing’s sets on the sim’s events for the player, once it has them', () => {
    const { player, d } = make();
    d.update(view(), [{ type: 'jump', by: 'me' }, { type: 'jump', by: 'b' }]);
    expect(names(player).filter((n) => /jump|land/.test(n))).toEqual(['step.jump', 'cloth.jump']);
    d.update(view(), [{ type: 'land', by: 'me' }]);
    expect(names(player).filter((n) => /land/.test(n))).toEqual(['step.land', 'cloth.land']);
  });

  it('the armour’s cloth on a crouch and on standing again', () => {
    const { player, d } = make();
    d.update(view({ entities: [soldier('me', [0, 0, 0], { team: 2, stance: 'crouch' })] }), []);
    d.update(view(), []);
    expect(names(player).filter((n) => n.startsWith('cloth.'))).toEqual(['cloth.crouchDown', 'cloth.crouchUp']);
  });
});

describe('the cues', () => {
  it('a landed hit is the FirstHit cue once a life, then the hit; a kill the confirmation over the Killed cue', () => {
    const { player, d } = make();
    d.update(view(), [{ type: 'hit', by: 'me', target: 'b' }]);
    d.update(view(), [{ type: 'hit', by: 'me', target: 'b' }]);
    d.update(view(), [{ type: 'kill', by: 'me', target: 'b' }]);
    expect(names(player).filter((n) => n.startsWith('hit.'))).toEqual(['hit.first', 'hit.hit', 'hit.killed', 'hit.kill']);
    expect(player.calls.find((c) => c.name === 'hit.kill').pitch).toBe(KILL_PITCH);
    // (a bot's kill of a bot is neither)
    d.update(view(), [{ type: 'kill', by: 'b', target: 'c' }]);
    expect(names(player).filter((n) => n.startsWith('hit.'))).toHaveLength(4);
    for (const c of player.calls.filter((n) => n.name?.startsWith('hit.'))) expect(c.ux).toBe(true);
  });

  it('the player’s death: the scream, the body’s fall, the landing, the world ducked', () => {
    const { player, d } = make();
    d.update(view(), [{ type: 'kill', by: 'b', target: 'me' }]);
    const n = names(player);
    expect(n).toContain('death.scream');
    expect(n).toContain('death.fall');
    expect(n).toContain('step.land');
    expect(n).not.toContain('hit.killed');
    d.update(view({ player: { ...view().player, state: 'down' } }), []);
    expect(player.duckKind).toBe('death');
    expect(n.filter((x) => x === 'death.scream')).toHaveLength(1);
  });

  it('the overheat set from the gun’s bar', () => {
    const { player, d } = make();
    const gun = (heat, overheated = false) => view({ player: { ...view().player, heat, overheated } });
    d.update(gun(0.5), []);
    d.update(gun(0.8), []);
    d.update(gun(1, true), []);
    d.update(gun(0.2, false), []);
    expect(names(player).filter((n) => n.startsWith('overheat.'))).toEqual(['overheat.warning', 'overheat.overheated', 'overheat.reset']);
  });

  it('the player’s thermal detonator, and not a bot’s far off', () => {
    const { player, d } = make();
    const v = view({ entities: [soldier('me', [0, 0, 0], { team: 2 }), soldier('b', [200, 0, 0])] });
    d.update(v, [
      { type: 'ability', by: 'me', id: 'DefaultAbility_Assault_ThermalDetonator', phase: 'start' },
      { type: 'ability', by: 'b', id: 'DefaultAbility_Assault_ThermalDetonator', phase: 'start' },
    ]);
    expect(names(player).filter((n) => n.startsWith('ability.'))).toEqual(['ability.thermal.click', 'ability.thermal.beeps']);
  });
});

describe('the bed and the music', () => {
  it('starts the bed loop once, the medium stem in play, the tension as a stage closes with its duck, the end of round', () => {
    const { player, d } = make();
    d.update(view(), []);
    d.update(view(), []);
    expect(names(player).filter((n) => n === 'ambience.bed')).toHaveLength(1);
    expect(player.calls.find((c) => c.name === 'ambience.bed').loop).toBe(true);
    expect(player.musicName).toBe('music.medium');
    expect(player.duckKind).toBe('none');
    d.update(view({ mode: { objectives: [{ meter: 0.9 }], tickets: 90, result: null } }), []);
    expect(player.musicName).toBe('music.tension.intro');
    expect(player.calls.find((c) => c.music === 'music.tension.intro').then).toBe('music.tension.loop');
    expect(player.duckKind).toBe('tension');
    d.update(view({ mode: { objectives: [], tickets: 90, result: { winner: 2 } } }), []);
    expect(player.musicName).toBe('music.eor.win');
    expect(player.duckKind).toBe('none');
  });

  it('ducks the game under the spawn screen', () => {
    const { player, d } = make();
    d.update(view({ deploy: { open: true }, player: { ...view().player, state: 'deploying' } }), []);
    expect(player.duckKind).toBe('spawn');
  });

  it('the one-shots come on their timers, placed round the listener', () => {
    const { player, d } = make();
    for (let t = 0; t < 400; t += 1) d.update(view({ time: t }), [], 1);
    const winds = player.calls.filter((c) => c.name?.startsWith('ambience.wind.'));
    expect(winds.length).toBeGreaterThan(5);
    expect(winds[0].gain).toBeGreaterThan(0);
  });
});

describe('behind the waiting screen', () => {
  it('plays nothing: no bed, no stem, no shot, no step; then the battle from the first step out of it', () => {
    const { player, d } = make();
    const running = (t) => view({ time: t, entities: [soldier('me', [0, 0, 0], { team: 2, vel: [5.9, 0] }), soldier('b', [10, 0, 0])] });
    for (let i = 0; i < 40; i++) d.update(running(i * 0.05), [{ type: 'shot', by: 'b' }], 0.05, { waiting: true });
    expect(player.calls).toEqual([]);
    expect(player.musicName).toBeNull();
    d.update(running(2), [{ type: 'shot', by: 'b' }], 0.05);
    const n = names(player);
    expect(n).toContain('ambience.bed');
    expect(n).toContain('blaster.a280.close');
    expect(player.musicName).toBe('music.medium');
  });

  it('the bed’s one-shots count from the way out, not all at once after a long wait', () => {
    const { player, d } = make();
    for (let t = 0; t < 300; t += 1) d.update(view({ time: t }), [], 1, { waiting: true });
    d.update(view({ time: 300 }), [], 0.05);
    expect(player.calls.filter((c) => c.name?.startsWith('ambience.') && c.name !== 'ambience.bed')).toEqual([]);
    for (let t = 301; t < 420; t += 1) d.update(view({ time: t }), [], 1);
    expect(player.calls.filter((c) => c.name?.startsWith('ambience.wind.')).length).toBeGreaterThan(3);
  });
});

describe('the commanders', () => {
  it('answer the uplink on the player’s side, once in a while', () => {
    const { player, d } = make();
    d.update(view({ time: 10 }), [{ type: 'uplink', name: 'A' }]);
    d.update(view({ time: 11 }), [{ type: 'uplink', name: 'B' }]);
    d.update(view({ time: 11 + VO_GAP }), [{ type: 'walkerDown' }]);
    expect(names(player).filter((n) => n.startsWith('vo.'))).toEqual(['vo.imperial.uplinkActivate', 'vo.imperial.walkerDown']);
  });
});

// (the wiring module.js makes: the sim names the player's soldier PLAYER_ID
// in its entities and its events, never the input's 'player' that addPlayer
// hands back; a director given the latter finds no body and plants no foot)
describe('on the battle’s own view', () => {
  const rb = loadRulebook();
  const battle = () => {
    const b = createBattle({ rulebook: rb, level: 'hoth', mode: 'galacticAssault', nav: hothFlatNav(rb), bots: { 1: 0, 2: 0 } });
    const input = addPlayer(b, { team: 2 });
    deploy(b, input, { classId: 'd-orig-assault' });
    return { b, input };
  };
  const walk = (b, input, d, over = {}, steps = 60) => {
    for (let i = 0; i < steps; i++) d.update(battleView(b), step(b, [{ id: input, move: [0, 1], yaw: 0, ...over }]), STEP);
  };

  it('the feet plant as the player’s soldier walks, a stride apart, and faster on the sprint', () => {
    const { b, input } = battle();
    const player = fakePlayer();
    const d = createDirector({ player, me: PLAYER_ID, team: 2, rng: () => 0.5 });
    const from = battleView(b).player.at.slice();
    walk(b, input, d);
    const to = battleView(b).player.at;
    const moved = Math.hypot(to[0] - from[0], to[2] - from[2]);
    const jog = names(player).filter((n) => n.startsWith('step.'));
    expect(moved).toBeGreaterThan(5);
    expect(new Set(jog)).toEqual(new Set(['step.jog']));
    expect(jog.length).toBeGreaterThanOrEqual(Math.floor(moved / STRIDE.jog) - 1);
    expect(jog.length).toBeLessThanOrEqual(Math.ceil(moved / STRIDE.jog) + 1);
    walk(b, input, d, { sprint: true });
    expect(names(player)).toContain('step.sprint');
    expect(d.state.suppressed).toBe(0);
  });

  it('and none for a director told the input’s name', () => {
    const { b, input } = battle();
    const player = fakePlayer();
    const d = createDirector({ player, me: input, team: 2, rng: () => 0.5 });
    walk(b, input, d);
    expect(input).not.toBe(PLAYER_ID);
    expect(names(player).filter((n) => n.startsWith('step.'))).toEqual([]);
  });

  it('the player’s own shot is the close layer at the ear, and the feet wait for the window', () => {
    const { b, input } = battle();
    const player = fakePlayer();
    const d = createDirector({ player, me: PLAYER_ID, team: 2, rng: () => 0.5 });
    walk(b, input, d, { fire: true }, 20);
    const n = names(player);
    expect(n).toContain('blaster.e11.close');
    expect(n.filter((x) => x.startsWith('step.'))).toEqual([]);
    expect(d.state.suppressed).toBeGreaterThan(0);
  });
});
