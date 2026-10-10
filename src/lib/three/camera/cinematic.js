// The cinematic lens and the post's data: a camera's focal length, aperture
// and focus distance (CameraEntityData) as a field of view and a depth of
// field, and the weather's motion blur (MotionBlurComponentData), as plain
// data for the light stack's `passesFor` (lane V's `dof` and `motionBlur`
// kinds). Pure: no three.js.
//
//   lensToFov(focalLength, frame = 36) → degrees: 2 atan(frame / 2 / focalLength)
//   lensToDof(row) → { focus, aperture, maxblur, focalLength }
//   motionBlurFor(weather, tier) → { kind: 'motionBlur', scale, centered } | null
//   dofFor(pose) → { kind: 'dof', focus, aperture, maxblur } | null
//   postFor({ weather, tier, pose }) → the passes' data, in order
//
// The depth of field is on only where a cinematic pose asks (the deploy and
// end cards' overview cameras carry `dof`), never in play. The motion blur
// is the camera's only (the record's `MotionBlurCentered false`, never per
// object), on ultra and high where the record enables it.

// (hand: the deploy cameras' focus when a row has none: the fidelity
// design's reading of the records, focus 1,000 m)
export const FOCUS_DEFAULT = 1000;
// (hand: the most blur a pixel takes, three's BokehPass default; the record
// has no such bound)
export const MAXBLUR = 0.01;
// (hand: the tiers the game's option turns the blur on at)
export const BLUR_TIERS = ['ultra', 'high'];

const RAD = Math.PI / 180;

export function lensToFov(focalLength, frame = 36) {
  if (!(focalLength > 0)) return null;
  return (2 * Math.atan(frame / 2 / focalLength)) / RAD;
}

export function lensToDof(row) {
  const focalLength = row?.focalLength > 0 ? row.focalLength : null;
  const fNumber = row?.aperture > 0 ? row.aperture : null;
  return {
    focus: row?.focus > 0 ? row.focus : FOCUS_DEFAULT,
    // (the entrance pupil, metres: the focal length over the f-number)
    aperture: focalLength && fNumber ? focalLength / 1000 / fNumber : 0,
    maxblur: MAXBLUR,
    focalLength,
  };
}

export function motionBlurFor(weather, tier = 'high') {
  const mb = weather?.motionBlur;
  if (!mb || !BLUR_TIERS.includes(tier)) return null;
  // (MotionBlurEnable is the component's own; an exported component with no
  // flag is an enabled one, as Hoth's both are)
  if (mb.MotionBlurEnable === false) return null;
  const scale = Number.isFinite(mb.MotionBlurScale) ? mb.MotionBlurScale : 1;
  if (!(scale > 0)) return null;
  return { kind: 'motionBlur', scale, centered: mb.MotionBlurCentered === true };
}

export function dofFor(pose) {
  if (!pose?.dof) return null;
  const { focus, aperture, maxblur } = pose.dof;
  return { kind: 'dof', focus, aperture, maxblur };
}

export function postFor({ weather = null, tier = 'high', pose = null } = {}) {
  return [dofFor(pose), motionBlurFor(weather, tier)].filter(Boolean);
}
