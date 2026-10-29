// The living world's creatures and civilians on their game settings
// (`Gameplay/Characters/LivingWorld/CreatureLocoSettings/*`, ai.creatures.json;
// an actor entity names the settings it wears): their speeds, their path,
// and their reactions to the world, of which the one a page has is the
// player (`ExternalInfluence_HumanPlayer`). With nobody near, a creature
// follows the prefab's waypoints at its slow speed (`CreatureFollowWaypoints`),
// or with none wanders round its home, pausing. A player inside the
// reaction's `ConsiderationRange`, rolled against its `ProbabilityOfAction`
// (once a `TimeWindow` while it fails), sets it off: `StopAndAct` stops it
// for its `StopDelay` turned as its `ActionAlignment` says (towards, away),
// `Act` startles it into a run away from the player, out of that range, at
// its medium speed. Either way it reacts no more until its `CooldownTime`
// is out, and then goes back to its waypoints. Pure.
//
// By hand (NOTES.md): `Act`'s run away, its speed (the medium band's top),
// the wander's reach (`ROAM`) and pauses (`PAUSE`).
//
//   settingsFor(name) → a settings row (an actor entity's name, or the settings' own) | null
//   createCreatureMind(settings, actor) → { step(dt, { player, waypoints, rand }) → { to, speed, state, face? } }
//     actor: { at: [x, z], home? }; player: [x, z] | null; waypoints: [[x, z]] | null; state: follow | wander | react | stop

import CREATURES from '../../../data/bf2017/ai.creatures.json';

export const ROAM = 6;
export const PAUSE = [2, 6];
const THERE = 0.5;

export function settingsFor(name) {
  const rows = CREATURES.rows;
  return rows.settings[name] ?? rows.settings[rows.actors[name]?.settings] ?? null;
}

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

export function createCreatureMind(settings, actor) {
  const ev = settings?.events?.HumanPlayer ?? null;
  const slow = settings?.speeds?.slow?.max ?? 1.2;
  const run = settings?.speeds?.medium?.max ?? slow * 2;
  const home = actor.home ?? [...actor.at];
  const m = { t: 0, state: 'follow', until: 0, cool: -Infinity, roll: -Infinity, leg: 0, to: null, wait: 0, face: null };

  function react(player) {
    m.cool = m.t + (ev.cooldown ?? 0);
    if (ev.action === 'StopAndAct') {
      m.state = 'stop';
      m.until = m.t + (ev.stopDelay ?? 0);
      const toward = Math.atan2(player[0] - actor.at[0], player[1] - actor.at[1]);
      m.face = ev.alignment === 'Towards' ? toward : ev.alignment === 'Away' ? toward + Math.PI : null;
      m.to = null;
    } else {
      m.state = 'react';
      m.until = Math.max(m.cool, m.t + 0.5);
      const ax = actor.at[0] - player[0];
      const az = actor.at[1] - player[1];
      const L = Math.hypot(ax, az) || 1;
      const by = (ev.range ?? 4) * 2;
      m.to = [player[0] + (ax / L) * by, player[1] + (az / L) * by];
      m.face = null;
    }
  }

  return {
    get state() {
      return m.state;
    },
    step(dt, { player = null, waypoints = null, rand = Math.random } = {}) {
      m.t += dt;
      const calm = m.state !== 'react' && m.state !== 'stop';
      if (ev && player && calm && m.t >= m.cool && m.t >= m.roll && dist(actor.at, player) <= ev.range) {
        if (rand() < ev.probability) react(player);
        else m.roll = m.t + (ev.window ?? 1);
      }
      if (m.state === 'stop') {
        if (m.t < m.until) return { to: null, speed: 0, state: 'stop', face: m.face };
        m.state = 'follow';
      }
      if (m.state === 'react') {
        if (m.t < m.until) return { to: m.to, speed: run, state: 'react' };
        m.state = 'follow';
        m.to = null;
      }
      if (waypoints?.length) {
        m.state = 'follow';
        let p = waypoints[m.leg % waypoints.length];
        if (dist(actor.at, p) < THERE) p = waypoints[++m.leg % waypoints.length];
        return { to: p, speed: slow, state: 'follow' };
      }
      // no path: round its home, a pause at each spot
      m.state = 'wander';
      if (m.to && dist(actor.at, m.to) < THERE) {
        m.to = null;
        m.wait = PAUSE[0] + rand() * (PAUSE[1] - PAUSE[0]);
      }
      if (!m.to) {
        m.wait -= dt;
        if (m.wait > 0) return { to: null, speed: 0, state: 'wander' };
        const a = rand() * Math.PI * 2;
        const r = (0.3 + 0.7 * rand()) * ROAM;
        m.to = [home[0] + Math.cos(a) * r, home[1] + Math.sin(a) * r];
      }
      return { to: m.to, speed: slow, state: 'wander' };
    },
  };
}
