// What a soldier bot sees, as the game’s AI code measures it
// (`Gather/VisionInfo.cpp`, `isWithinViewFrustum`): out to `SensingConeRange`
// and inside `SensingConeAngle` either side of where it faces, or, once its
// side is alerted, out to `SensingConeRangeWhenAlerted` inside
// `SensingConeAngleWhenAlerted`. A side is alerted together
// (`Reason/CombatReasoning.cpp`, `updateCombatGroupAlertState`: a combat
// group, by default every soldier of a side, is alerted the moment any of them
// sees its target, and stays so). The numbers are the difficulty rows’
// (ai.json `difficulties[…].common`; the multiplayer default row where a sim
// sets no difficulty: 60 m and 60°, 250 m and 90° alerted). By hand: the
// limits above and below the eye that the source keeps while not alerted
// (15° and 55° on the default row) are not modelled, the senses’ cone being
// one cone. Pure.
//
//   sensingOf(row) → { range, angle, alertedRange, alertedAngle }    row: a difficulty row (its `common`)
//   sightOf(sensing, alerted) → { range, cone }                      cone: the cosine of the half angle

const DEG = Math.PI / 180;

// (a row without them: the source's own defaults, `Shared/GlobalGameTweakData.ddf`'s `GameTweakCommon`)
export function sensingOf(row) {
  const c = row?.common ?? {};
  return {
    range: c.sensingConeRange ?? 40,
    angle: c.sensingConeAngle ?? 60,
    alertedRange: c.sensingConeRangeWhenAlerted ?? 60,
    alertedAngle: c.sensingConeAngleWhenAlerted ?? 60,
  };
}

export const sightOf = (sensing, alerted) => ({
  range: alerted ? sensing.alertedRange : sensing.range,
  cone: Math.cos((alerted ? sensing.alertedAngle : sensing.angle) * DEG),
});
