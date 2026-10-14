// What the figures spare the main thread (the performance lanes' P4).
// Battlefront's graph at play was 5,617 objects, 4,539 of them the
// soldiers', 4,261 of those bones (P0's census, the RTX 5090 at High), and
// three walked it all three or four times a frame (the view and each shadow
// cascade: Renderer._projectObject) and recomposed every matrix in it once
// (updateMatrixWorld): most of the frame's 6.7 ms of JavaScript against the
// chip's 1.2.
//
// quietBones(root, keep) → how many bones it left out of the walk: a bone
//   with nothing drawn under it and no socket on its chain is `visible =
//   false`, which three's walk skips with all under it; a bone's world matrix
//   is made whatever its visibility, so the skin moves as before. Worked out
//   afresh each call: a bone a mesh has come under is walked again.
// animEvery(distance) → frames between a soldier's animation updates: every
//   frame near, every second further out, every fourth far off (ANIM_BANDS),
//   as a game's animation level of detail does; animDue(frame, every, slot)
//   spreads the soldiers of one band over its frames by their slot.

// [up to this many metres, animated every this many frames]
export const ANIM_BANDS = [
  [30, 1],
  [70, 2],
  [Infinity, 4],
];

export function animEvery(distance) {
  if (!Number.isFinite(distance)) return 1;
  for (const [far, every] of ANIM_BANDS) if (distance <= far) return every;
  return ANIM_BANDS[ANIM_BANDS.length - 1][1];
}

export const animDue = (frame, every, slot = 0) => every <= 1 || (frame + slot) % every === 0;

const drawn = (o) => o.isMesh || o.isLine || o.isPoints || o.isSprite;

export function quietBones(root, keep = []) {
  // (a socket's chain, up to the root: what is put on it later is drawn)
  const chain = new Set();
  for (const s of keep) for (let o = s; o; o = o.parent) chain.add(o);
  let hidden = 0;
  // (true when something under `o` is drawn: its bones stay in the walk)
  const visit = (o) => {
    let below = false;
    for (const c of o.children) if (visit(c)) below = true;
    if (o.isBone) {
      o.visible = below || chain.has(o);
      if (!o.visible) hidden++;
    }
    return below || drawn(o);
  };
  visit(root);
  return hidden;
}
