// A 2017 soldier turned to face the way the sim says. The game's clips are
// authored facing +X and turned to the figure's way by a constant −90° on
// AITrajectory, the root the game moves a figure by; the clip packer drops
// that node's tracks (scripts/bf2017-clips.mjs's DROP), so the committed
// packs face +X while the sim's yaw 0 is +Z (locomotion.js's dir8Of).
// facing.test.js measures it on the committed body and pack.
//
// The fix is the Battlefront figures', not the pack's: the galaxy's users
// of the same pack already turn their figures themselves
// (galaxy/surface/heroStage.js's `turn`), and would turn twice. It puts the
// game's own constant back on the body's AITrajectory, which no packed clip
// keys, so the model's own rotation stays the sim's yaw.
//
//   AITRAJECTORY_TURN   [x, y, z, w]: the clips' AITrajectory.quaternion
//                       (c_hm_rifle_walk_fwd_01, p_hm_rifle_standidle_01,
//                       l_luke_stand_unarmed_idle_01: the same in each)
//   faceAlongZ(model) → whether the body had the node to turn

export const AITRAJECTORY_TURN = [0, -Math.SQRT1_2, 0, Math.SQRT1_2];

export function faceAlongZ(model) {
  const node = model?.getObjectByName?.('AITrajectory');
  if (!node) return false;
  node.quaternion.fromArray(AITRAJECTORY_TURN);
  node.updateMatrix();
  return true;
}
