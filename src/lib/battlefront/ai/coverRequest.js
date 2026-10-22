// When a soldier bot asks for a new cover, as the game’s AI code has it
// (`Reason/CoverStateUpdate.cpp`; the sheet in
// docs/superpowers/evidence/bf-ai-source/README.md, the rows in NOTES.md, “The
// bots’ minds against the AI source”), written again for `soldierBrain.js`.
// Pure.
//
//   coverTimes(attack, rand) → { stay, lost }      attack: the tactics row’s attack block
//   asksNewCover(k) → bool     k: { inCover, timeInCover, stay, inRange, sinceSeen, lost, tooClose }
//   inPreferredRange(preferred, cover, target) → bool     preferred: the weapon’s { Start, End }; [x, z] each
//   hideCoverTurned(slot, target, angle) → bool           a hiding bot’s cover its target has come round

// The attack’s timers, drawn when the tactic begins and at each request
// (`updateTimers`): how long in cover before it may ask for a goal cover, and
// how long its target may be out of sight in cover before it asks. From the
// row’s default block (`CoverRequestSettings`; the indoor and outdoor blocks
// are for a level that says which it is, and none here does).
export function coverTimes(attack, rand) {
  const a = attack ?? {};
  const between = (k, lo, hi) => {
    const min = a[`CoverRequestSettings.Minimum${k}`] ?? lo;
    const max = a[`CoverRequestSettings.Maximum${k}`] ?? hi;
    return min + rand() * (max - min);
  };
  return { stay: between('TimeInCoverToRequest', 1, 6), lost: between('TimeInCoverAfterTargetLost', 10, 20) };
}

// `CoverState::updateAttackCoverRequestState`: a bot in cover asks for a goal
// cover only after its drawn time there, and only when the cover is outside
// its weapon’s preferred range of the target or the target has been out of
// sight its drawn time (counted from no earlier than its arrival), and never
// with the target inside the row’s `MinimumDistanceToTarget`. Moving to a cover
// it asks for none.
export function asksNewCover({ inCover, timeInCover, stay, inRange, sinceSeen, lost, tooClose }) {
  if (!inCover || tooClose || timeInCover <= stay) return false;
  return !inRange || lost - Math.min(sinceSeen, timeInCover) <= 0;
}

// (`isInsideWeaponRange`: the target’s last known place from the cover, between the range’s start and end)
export function inPreferredRange(preferred, cover, target) {
  if (!preferred || !(preferred.End > 0)) return true;
  const d = Math.hypot(cover[0] - target[0], cover[1] - target[1]);
  return d > (preferred.Start ?? 0) && d < preferred.End;
}

// The hide’s cover is given up once its target has come round more than half
// the row’s `InvalidateCoverAngle` from the way the cover faces (the hide
// update in `CoverStateUpdate.cpp`); 180°, every row’s, is the half-plane a
// slot shields.
export function hideCoverTurned(slot, target, angle = 180) {
  const fx = -slot.normal[0];
  const fz = -slot.normal[1];
  const tx = target[0] - slot.at[0];
  const tz = target[1] - slot.at[2];
  const t = Math.hypot(tx, tz);
  if (t < 1e-6) return false;
  const c = (fx * tx + fz * tz) / (Math.hypot(fx, fz) * t);
  return Math.acos(Math.max(-1, Math.min(1, c))) > ((angle / 2) * Math.PI) / 180 + 1e-9;
}
