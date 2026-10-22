// What makes a soldier bot flee, and when its flee ends, as the game’s AI code
// has it (BattleAI, an earlier build than the 2017 game’s; the sheet in
// docs/superpowers/evidence/bf-ai-source/README.md, the rows in NOTES.md, “The
// bots’ minds against the AI source”). A bot flees when it panics
// (`Mindcraft/SoldierBehaviorInterface.h`, `isFleeValid`), and it panics
// (`Gather/AIPlayerInfo.cpp`) at an enemy grenade come to ground inside its
// blast radius times `PanicBlastRadiusPercentage`, or after its own suppression
// has stayed over its row’s `SuppressionValue` for `ContinuousSuppressionTime`;
// the panic begins after a drawn `PrePanicTime` and is over `TotalPanicTime`
// after it was set. The difficulty row says which causes count: every
// multiplayer row panics at grenades alone, for 2 s (the cooperative rows at
// suppression and vehicles too, for 5). A bot once fleeing keeps at it until it
// has been in its flee cover over 2 s, when hiding takes over. Pure.
//
//   panicRow(row) → { pre, total, blast, grenade, weapon }      row: a difficulty row
//   panicStep(state, { at, team, grenades, suppressed, tactics, dt, now, row, rand }) → panic | null
//     state: the brain’s { panic, over }, kept between thinks
//     grenades: [{ at, team, collided, dead, row: { radius } }]; tactics: the row’s `suppression`
//   panicking(panic, now) → bool
//   FLEE_DONE                         s in the flee cover after which a flee is done

// (a row without them: the source’s own defaults, `Shared/GlobalGameTweakData.ddf`’s `GameTweakPanicBehavior`)
export function panicRow(row) {
  const p = row?.panic ?? {};
  return {
    pre: [p.prePanicTimeMin ?? 0.7, p.prePanicTimeMax ?? p.prePanicTimeMin ?? 0.7],
    total: p.totalPanicTime ?? 5,
    blast: p.panicBlastRadiusPercentage ?? 0.7,
    grenade: p.panicOnGrenade ?? true,
    weapon: p.panicOnWeaponSuppression ?? true,
  };
}

const apart = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

// The panic a bot carries this think, kept in `state` ({ panic, over }): begun
// at a cause, its place moved to the latest grenade that lands near (the
// source’s grenade handler), over once its total time is up
// (`AIPlayerInfo::updateAll`). → state.panic
export function panicStep(state, { at, team, grenades = [], suppressed = 0, tactics = null, dt = 0, now, row, rand }) {
  const P = panicRow(row);
  if (state.panic && now - state.panic.start > P.total) state.panic = null;
  const start = (from) => {
    state.panic = { from: [...from], start: now, pre: P.pre[0] + rand() * (P.pre[1] - P.pre[0]) };
  };
  if (P.grenade) {
    for (const g of grenades) {
      if (!g?.collided || g.dead || g.team === team) continue;
      if (apart(g.at, at) >= (g.row?.radius ?? 0) * P.blast) continue;
      if (!state.panic) start(g.at);
      else state.panic.from = [...g.at];
    }
  }
  // (`updateWeaponSuppression`: the time over the level counts up while it lasts and is gone when it drops;
  // past the row's time it panics where it stands, and the count begins again)
  if (P.weapon && tactics) {
    state.over = suppressed > tactics.value ? (state.over ?? 0) + dt : 0;
    if (state.over > tactics.time) {
      if (!state.panic) start(at);
      state.over = 0;
    }
  }
  return state.panic;
}

export const panicking = (panic, now) => !!panic && now - panic.start > panic.pre;

// `isFleeValid`: in its flee cover over this long, a flee is done.
export const FLEE_DONE = 2;
