// What the Battlefront world sounds like, step by step: the sim's events
// (battle.js's `step`) and its view into the player's calls, by mix.js's
// numbers. A shot by anyone plays the blaster's layers by its distance from
// the listener (the player's body) and its side; the player's own feet
// plant by the body's speed, suppressed under fire by the HDR window; the
// hit, kill and death cues, the overheat set and the abilities from the
// events; the bed loops with its one-shots on their timers; the music by
// the mode's state, with the tension's duck, the spawn screen's and the
// death's; a commander line on an objective event. Pure but for the player
// it is given, so director.test.js runs it on a fake.
//
//   createDirector({ player, me, team, rng, maxShots }) → { update(view, events, dt), dispose(), state }
//   (me: the player's soldier id; team: their team; the view is battle.js's,
//   the events the step's; dt in seconds)

import { LOUDNESS, admits, blasterLayers, createWindow, dueOneShots, footstep, hear, lifeCues, loudnessOf, musicFor, oneShots, overheatCues, panOf, rolloff } from './mix.js';
import { abilityCues, gunGains, gunOf } from './sounds.js';

export const MAX_SHOTS = 6; // shot sounds a step at most, the nearest first (forty bots fire at 300 rpm)
export const VO_GAP = 6; // s between commander lines
export const WALKER_VO_GAP = 45; // s between the walker-damaged lines
export const ABILITY_EARSHOT = 40; // m: another soldier's ability is heard this near
export const PRELOAD = ['blaster.hifi', 'blaster.noise.close', 'blaster.noise.distant', 'blaster.reflection', 'blaster.passby', 'step.walk', 'step.jog', 'step.sprint', 'step.land', 'cloth.crouchDown', 'cloth.crouchUp', 'cloth.land', 'death.scream', 'death.fall', 'hit.hit', 'hit.first', 'hit.killed', 'hit.kill', 'overheat.warning', 'overheat.overheated', 'overheat.reset', 'overheat.manual', 'ambience.bed'];

const SIDE = { 1: 'rebellion', 2: 'imperial' };

export function createDirector({ player, me, team = 2, rng = Math.random, maxShots = MAX_SHOTS } = {}) {
  const state = {
    now: 0,
    window: createWindow(),
    sinceStep: 0,
    suppressed: 0, // the plants the window dropped
    crouch: false,
    gun: null,
    life: null,
    firstHit: true,
    shots: oneShots(rng, 0),
    bed: null,
    music: null,
    vo: -Infinity,
    walkerVo: -Infinity,
    listener: { at: [0, 0, 0], yaw: 0 },
  };
  const at = (e) => e?.at ?? null;
  const positional = (name, from, gain, { pitch = 1 } = {}) => {
    const d = Math.hypot(from[0] - state.listener.at[0], from[2] - state.listener.at[2]);
    return player.play(name, { gain, pitch, pan: panOf(state.listener.at, from, state.listener.yaw) * Math.min(1, d / 4) });
  };

  const shot = (e, entity) => {
    const from = at(entity) ?? state.listener.at;
    const own = e.by === me;
    const d = own ? 0 : Math.hypot(from[0] - state.listener.at[0], from[2] - state.listener.at[2]);
    const gun = gunOf(entity?.weapon ?? null, entity?.team ?? team);
    const g = gunGains(gun);
    const l = blasterLayers(d, g);
    const pan = own ? 0 : panOf(state.listener.at, from, state.listener.yaw);
    if (l.close > 0) player.play(`blaster.${gun}.close`, { gain: l.close / g[0], pan });
    if (l.distant > 0) player.play(`blaster.${gun}.distant`, { gain: l.distant / g[1], pan });
    if (l.hifi > 0) player.play('blaster.hifi', { gain: l.hifi / g[2], pan });
    if (l.far > 0) player.play('blaster.noise.distant', { gain: l.far, pan });
    // (the field's own tail under a near shot)
    if (l.close > 0) player.play('blaster.noise.close', { gain: l.close / g[0], pan });
    hear(state.window, loudnessOf(LOUDNESS.blaster, l.close + l.distant + l.hifi + l.far), state.now, 0.7);
  };

  const death = () => {
    const pitch = 0.9 + rng() * 0.2;
    player.play('death.scream', { gain: 1, pitch });
    player.play('death.fall', { gain: 1, pitch });
    player.play('step.land', { gain: 0.8, pitch });
    player.play('hit.killed', { ux: true });
    hear(state.window, LOUDNESS.death, state.now, 1.5);
  };

  const say = (name) => {
    if (state.now - state.vo < VO_GAP) return;
    if (player.play(name, { ux: true })) state.vo = state.now;
  };

  const onEvents = (events, byId) => {
    const shots = [];
    for (const e of events) {
      switch (e.type) {
        case 'shot':
          shots.push(e);
          break;
        case 'hit':
          if (e.by === me && e.target !== me) {
            player.play(state.firstHit ? 'hit.first' : 'hit.hit', { ux: true });
            state.firstHit = false;
          }
          if (byId.get(e.target)?.kind === 'walker' && state.now - state.walkerVo > WALKER_VO_GAP) {
            state.walkerVo = state.now;
            say(`vo.${SIDE[team]}.walkerDamaged`);
          }
          break;
        case 'kill':
          if (e.by === me && e.target !== me) player.play('hit.kill', { ux: true });
          if (e.target === me) death();
          else if (at(e) && byId.get(e.target)?.kind === 'soldier') {
            const d = Math.hypot(e.at[0] - state.listener.at[0], e.at[2] - state.listener.at[2]);
            if (d < 60 && admits(state.window, loudnessOf(LOUDNESS.death, rolloff(d)), state.now)) positional('death.scream', e.at, rolloff(d), { pitch: 0.9 + rng() * 0.2 });
          }
          break;
        case 'ability': {
          const who = byId.get(e.by);
          const from = at(who);
          const d = e.by === me || !from ? 0 : Math.hypot(from[0] - state.listener.at[0], from[2] - state.listener.at[2]);
          if (d > ABILITY_EARSHOT) break;
          for (const name of abilityCues(e.id, e.phase)) {
            if (e.by === me) player.play(name, { gain: 1 });
            else positional(name, from, rolloff(d));
          }
          break;
        }
        case 'uplink':
          say(`vo.${SIDE[team]}.uplinkActivate`);
          break;
        case 'objective':
          if (e.kind === 'capture') say(`vo.${SIDE[team]}.captured`);
          break;
        case 'walkerDown':
          say(`vo.${SIDE[team]}.walkerDown`);
          break;
        default:
          break;
      }
    }
    // (the nearest shots first, the player's own always)
    const byDist = (e) => (e.by === me ? -1 : (() => {
      const from = at(byId.get(e.by));
      return from ? Math.hypot(from[0] - state.listener.at[0], from[2] - state.listener.at[2]) : Infinity;
    })());
    shots.sort((a, b) => byDist(a) - byDist(b));
    for (const e of shots.slice(0, maxShots)) shot(e, byId.get(e.by));
  };

  const feet = (p, body, dt) => {
    if (!p || p.state !== 'alive' || !body) {
      state.sinceStep = 0;
      return;
    }
    const crouch = body.stance === 'crouch';
    if (crouch !== state.crouch) {
      state.crouch = crouch;
      if (admits(state.window, LOUDNESS.cloth, state.now)) player.play(crouch ? 'cloth.crouchDown' : 'cloth.crouchUp', { gain: 1 });
    }
    const speed = Math.hypot(body.vel?.[0] ?? 0, body.vel?.[1] ?? 0);
    const f = footstep(speed, { crouch });
    if (!f) {
      state.sinceStep = 0;
      return;
    }
    state.sinceStep += dt;
    if (state.sinceStep < f.interval) return;
    state.sinceStep = 0;
    // (the patch's loudness, at the ear: the speed's gain is inside the patch)
    if (!admits(state.window, LOUDNESS.step, state.now)) {
      state.suppressed += 1;
      return;
    }
    player.play(`step.${f.set}`, { gain: f.gain, pitch: f.pitch });
  };

  const ambience = (dt) => {
    if (!state.bed) state.bed = player.play('ambience.bed', { gain: 1, loop: true });
    for (const s of dueOneShots(state.shots, state.now, rng)) {
      if (!admits(state.window, LOUDNESS.ambience, state.now)) continue;
      player.play(s.name, { gain: rolloff(s.dist) * 2, pan: Math.sin(s.angle) });
    }
    return dt;
  };

  const music = (view) => {
    const p = view.player;
    const want = musicFor(view.mode, team);
    if (want !== state.music) {
      state.music = want;
      if (!want) player.stopMusic();
      else if (want === 'tension') player.music('music.tension.intro', { then: 'music.tension.loop' });
      else if (want.startsWith('eor.')) player.music(`music.${want}`, { loop: false });
      else player.music(`music.${want}`, { loop: true });
    }
    const duck = p?.state === 'down' ? 'death' : view.deploy?.open ? 'spawn' : want === 'tension' ? 'tension' : 'none';
    player.duck(duck);
  };

  return {
    state,
    update(view, events = [], dt = 0.05) {
      state.now = view.time ?? state.now + dt;
      const p = view.player;
      const byId = new Map();
      let body = null;
      for (const e of view.entities ?? []) {
        byId.set(e.id, e);
        if (e.id === me) body = e;
      }
      if (p?.state === 'alive') state.listener = { at: p.at, yaw: p.yaw ?? 0 };
      // (a new life: the first hit of it is the FirstHit cue again)
      if (state.life?.state !== 'alive' && p?.state === 'alive') state.firstHit = true;
      for (const cue of lifeCues(state.life, p)) if (cue === 'death' && !events.some((e) => e.type === 'kill' && e.target === me)) death();
      state.life = p ? { state: p.state, hitAt: p.hitAt, killAt: p.killAt } : null;
      onEvents(events, byId);
      feet(p, body, dt);
      if (p?.state === 'alive') {
        const gun = { heat: p.heat ?? 0, overheated: Boolean(p.overheated), warning: p.warning ?? 0.75 };
        for (const cue of overheatCues(state.gun, gun)) player.play(cue, { gain: 1 });
        state.gun = gun;
      } else state.gun = null;
      ambience(dt);
      music(view);
    },
    dispose() {
      state.bed?.stop(300);
      state.bed = null;
      player.stopMusic(300);
    },
  };
}
