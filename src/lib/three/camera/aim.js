// The aim zoom: the field of view a soldier sees through, from the game's
// rows (src/data/bf2017/cameras.json's `aim`: each weapon's zoom levels'
// `RenderFov` with their `zoomIn` and `zoomOut` speeds). Pure: no three.js;
// the state is a plain object the caller keeps between frames.
//
//   FOV_DEFAULT = 70 (degrees, vertical)
//   zoomLevel(rows, weaponId, level = 0) → { fov, zoomIn, zoomOut } | null
//   aimFov(state, rows, dt, { aiming, weaponId, level = 0 }) → fov (degrees)
//     state: {} at first; aimFov keeps { fov, from, to, t } in it
//
// A change of mind mid-zoom (aim pressed, released 0.1 s later) eases back
// from wherever the field was, at the new direction's speed, never from the
// target it was heading for: `from` is taken at the moment the target moves.

// (hand: the game's base field of view, its options' default; the rows hold
// only the weapons' zoomed fields)
export const FOV_DEFAULT = 70;
// (hand: the seconds a zoom takes at speed 1; the record's ZoomInSpeed and
// ZoomOutSpeed are multipliers on a time the export does not carry)
export const ZOOM_TIME = 0.2;

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
// (an ease in and out: no step in the field's speed at either end)
const smooth = (t) => t * t * (3 - 2 * t);

export function zoomLevel(rows, weaponId, level = 0) {
  const levels = rows?.aim?.[weaponId];
  if (!Array.isArray(levels) || !levels.length) return null;
  return levels[Math.max(0, Math.min(levels.length - 1, level | 0))];
}

export function aimFov(state, rows, dt, { aiming = false, weaponId = null, level = 0 } = {}) {
  const row = aiming ? zoomLevel(rows, weaponId, level) : null;
  const target = row?.fov > 0 ? row.fov : FOV_DEFAULT;
  if (!Number.isFinite(state.fov)) {
    state.fov = FOV_DEFAULT;
    state.from = FOV_DEFAULT;
    state.to = FOV_DEFAULT;
    state.t = 1;
  }
  if (target !== state.to) {
    // (from here, not from where the last zoom was going)
    state.from = state.fov;
    state.to = target;
    state.t = 0;
    // the speed of the way it is going now: in at the level's zoomIn, out at
    // the zoomOut of the level it is leaving
    const leaving = zoomLevel(rows, weaponId, level) ?? state.row;
    state.speed = aiming ? (row?.zoomIn ?? 1) : (leaving?.zoomOut ?? 1);
  }
  if (row) state.row = row;
  const h = Number.isFinite(dt) && dt > 0 ? dt : 0;
  state.t = clamp01(state.t + (h * (state.speed > 0 ? state.speed : 1)) / ZOOM_TIME);
  state.fov = state.from + (state.to - state.from) * smooth(state.t);
  return state.fov;
}
