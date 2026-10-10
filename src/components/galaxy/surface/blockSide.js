// The side of you a cut comes in on, and the block that meets it there. A
// stroke cuts a way ('left' and 'right' a cut from that side of the one who
// makes it: the side the game's tip was measured coming in from, on the
// root's axes, its stance's `cuts`);
// facing each other the striker's left is your right, so a side cut comes
// in mirrored, from behind as it was, and side-on from neither. A 2017 hero
// meets it with the game's blocks measured holding the blade on that side
// (the stroke table's `blocks`, by `held`), and a cut with no side, or one
// on a side it has none for, with its pack's block (BLOCK_CLIP: the table's
// `any` is mostly a stagger, held low).
// Pure, and nothing here reads a table, so the flight pages don't pay for it.
//
//   cutOf(stance, clip) → the side the stroke `clip` cuts from ('left' | 'right'), or null (a cut more up or down
//                         than across, no stroke)
//   incomingSide(cut, { from, to }) → 'left' | 'right' (of the struck) | null: from, to the striker's yaw and the
//                         struck's (facing (sin yaw, cos yaw)); either missing, facing each other
//   blockClipFor(blocks, side, has, n) → the block to lay: the side's own the figure has (`has(name)`), the n-th in
//                         turn, else null (BLOCK_CLIP then: saber.js), blocks.any only for a figure without BLOCK_CLIP
//   BLOCK_CLIP            a pack's own block, under the name the clip packs give it (walrusClips.js)
//   SIDE_ON               |cos| of the turn between the two facings under which a cut has no side

export const BLOCK_CLIP = 'sword.block';

export const SIDE_ON = 0.25;
// (a cut from the striker's left starts at its +x; a figure's left is (cos
// yaw, 0, −sin yaw), so the struck sees it at sign(way × cos(from − to)) of
// its own +x: −1 facing each other, the mirror)
const WAY = { left: 1, right: -1 };

export function cutOf(stance, clip) {
  if (!clip) return null;
  return stance?.cuts?.[clip] ?? null;
}

export function incomingSide(cut, { from = null, to = null } = {}) {
  const way = WAY[cut];
  if (!way) return null;
  const c = from == null || to == null ? -1 : Math.cos(from - to);
  if (Math.abs(c) < SIDE_ON) return null;
  return way * c > 0 ? 'left' : 'right';
}

export function blockClipFor(blocks, side, has, n = 0) {
  const own = side ? (blocks?.[side] ?? []).filter(has) : [];
  if (own.length) return own[n % own.length];
  return !has(BLOCK_CLIP) && blocks?.any && has(blocks.any) ? blocks.any : null;
}
