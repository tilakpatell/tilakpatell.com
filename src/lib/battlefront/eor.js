// The end of a round (spec catalogue 6): who won and why, how long it ran,
// each team's kills, deaths, captures, arms and Battle Points earned, the
// best players by points and the most valuable one. Pure.
//
//   endCard(sim, ga) → { winner, why, stage, duration, teams: { 1: {...}, 2: {...} }, best: [{ id, team, kills, points, cls }], mvp }

import { earnedBy } from './battlePoints.js';

// How many make the best players' list, by hand (the game shows three a team on its scoreboard's top).
export const BEST = 3;

export function endCard(sim, ga = sim.ga) {
  const teams = { 1: { kills: 0, deaths: 0, captures: 0, arms: 0, points: 0 }, 2: { kills: 0, deaths: 0, captures: 0, arms: 0, points: 0 } };
  const rows = [];
  for (const st of sim.stats.values()) {
    const points = sim.bp ? Math.round(earnedBy(sim.bp, st.id)) : 0;
    const t = teams[st.team];
    t.kills += st.kills;
    t.deaths += st.deaths;
    t.captures += st.captures;
    t.arms += st.arms;
    t.points += points;
    rows.push({ id: st.id, team: st.team, kills: st.kills, deaths: st.deaths, points, cls: st.cls });
  }
  const order = (a, b) => b.points - a.points || b.kills - a.kills || (a.id < b.id ? -1 : 1);
  const best = [1, 2].flatMap((team) => rows.filter((r) => r.team === team).sort(order).slice(0, BEST)).sort(order);
  return {
    winner: ga?.result?.winner ?? null,
    why: ga?.result?.why ?? null,
    stage: ga?.result?.stage ?? ga?.stage ?? 0,
    duration: sim.time,
    teams,
    best,
    mvp: best[0] ?? null,
  };
}
