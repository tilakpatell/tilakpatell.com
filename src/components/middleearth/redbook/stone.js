// The Palantír, pure (the design’s §5, and the owner’s note: look into it
// and it shows the Eye): taken up, it is smoke for a moment, then the Eye
// of Sauron opens in it (`eye`, 0…1, over OPEN seconds). Held on, the Eye
// grows aware of whoever holds it (`seen`, 0…1 from SEEN to DROP), and at
// DROP it has seen them: the stone falls from their hands (`dropped` true on
// that step alone) and can’t be taken up again for REST seconds.
//
//   newStone() → { held, gaze, eye, seen, dropped, rest }
//   stepStone(stone, dt, { held }) → the next

export const OPEN = 1.6; // s from smoke to the Eye wide open
export const SEEN = 8; // s held before the Eye begins to know you
export const DROP = 14; // s held before it has seen you
const SMOKE = 0.4; // s of smoke before the lids part
const REST = 3; // s after a fall before the stone can be held again

const clamp = (v) => Math.min(1, Math.max(0, v));

export const newStone = () => ({ held: false, gaze: 0, eye: 0, seen: 0, dropped: false, rest: 0 });

export function stepStone(s, dt, { held = false } = {}) {
  const rest = Math.max(0, s.rest - dt);
  if (!held || rest > 0) return { held: false, gaze: 0, eye: 0, seen: 0, dropped: false, rest };
  const gaze = s.gaze + dt;
  if (gaze >= DROP) return { held: false, gaze: 0, eye: 0, seen: 0, dropped: true, rest: REST };
  return { held: true, gaze, eye: clamp((gaze - SMOKE) / (OPEN - SMOKE)), seen: clamp((gaze - SEEN) / (DROP - SEEN)), dropped: false, rest };
}
