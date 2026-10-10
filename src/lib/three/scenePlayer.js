// The game's cinematic clips played on the site's cast, a scene at a time:
// a scene is a few tracks, each one person's part in it (the game's CIN_*
// and the cinematics skeleton's own, the humanoid's rig), packed by scene
// under its roles (scripts/bf2017-clips.mjs --scene <id>: walrusSets/
// scenes.js names them) and played whole-body on whoever the caller casts
// in each role. A role nobody plays is skipped, as is a cast member on
// another skeleton (no bone of its track's), and the rest play on (Review
// Focus 3). Nothing is retargeted: a track binds by bone name, as every
// pack's clips do (walrus.js's clipsFor).
//
//   scenePath(id) → its file
//   loadScene(id, { loader }) → Promise<{ id, tracks: { role: AnimationClip } } | null>
//   playScene(scene, cast: { role: fig }, { onEnd, hold }) → { roles (the
//     ones playing), done (Promise, once each has played through), stop() }
//     fig: a figure on the game's rig (`rig: 'walrus'`) with `model` and
//     `anim` (animator.js's add, play, stop)

import { loadGLTF } from './gltfCache';
import { PACK_DIR, clipsFor } from './walrus';

export const scenePath = (id) => `${PACK_DIR}/scenes/${id}.glb`;

export async function loadScene(id, { loader } = {}) {
  const g = await loadGLTF(scenePath(id), { loader }).catch(() => null);
  if (!g?.animations?.length) return null;
  return { id, tracks: Object.fromEntries(g.animations.map((c) => [c.name, c])) };
}

export function playScene(scene, cast = {}, { onEnd = null, hold = false } = {}) {
  const roles = [];
  const plays = [];
  const on = [];
  for (const [role, clip] of Object.entries(scene?.tracks ?? {})) {
    const fig = cast[role];
    // (only a figure on the game's humanoid rig: Meshy's shares the hips' and the limbs' names, not the skeleton)
    if (!fig?.model || !fig.anim?.play || fig.rig !== 'walrus') continue;
    const name = `scene.${scene.id}.${role}`;
    const own = clipsFor(fig.model, new Map([[name, clip]]))[name];
    // (another skeleton's figure: none of the track's bones)
    if (!own) continue;
    fig.anim.add?.(name, own);
    plays.push(Promise.resolve(fig.anim.play(name, { layer: 'full', hold })).catch(() => 'cut'));
    roles.push(role);
    on.push(fig);
  }
  const done = Promise.all(plays).then(() => onEnd?.());
  return {
    roles,
    done,
    stop() {
      for (const fig of on) fig.anim.stop?.('full');
    },
  };
}
