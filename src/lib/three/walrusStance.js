// A 2017 figure takes up a weapon's stance (walrusSets/stance.js): the
// stance's pack (clips-stance-<key>.glb) fetched the first time any figure
// asks for it, its clips bound to this body by bone name as every pack's
// are (walrus.js's clipsFor), and laid over the figure's own by the names
// they stand in for through its animator's restance. A pack that isn't
// there leaves the figure as it was (the humanoid set: never a missing
// clip); 'humanoid' puts back what the figure came with.
//
//   withStance(fig, { model, clips, loader, enabled }) → fig, with (not
//   enabled, a phone's levels: always the humanoid's, nothing fetched)
//     stance(key) → Promise<key it now stands in>
//     takePack(name) → Promise<[name…]>: a pack's clips (clips-<name>.glb, the
//       first person's 1p…) added to the figure's own, to play on its animator

import { PACK_DIR, clipsFor, loadWalrusPacks } from './walrus';
import { STANCE_KEYS, stanceClips } from './walrusSets/stance';

export const stancePackUrl = (key) => `${PACK_DIR}/clips-stance-${key}.glb`;

export function withStance(fig, { model = fig.model, clips = fig.clips ?? {}, loader, enabled = true } = {}) {
  let now = 'humanoid';
  let laid = []; // the names the stance took over
  let ask = 0;
  const own = (names) => Object.fromEntries(names.filter((n) => clips[n]).map((n) => [n, clips[n]]));
  fig.stance = async (key) => {
    const token = ++ask;
    if (key === now) return now;
    if (!STANCE_KEYS.includes(key) || !enabled) {
      fig.anim?.restance(own(laid));
      laid = [];
      now = 'humanoid';
      return now;
    }
    const got = await loadWalrusPacks([stancePackUrl(key)], { loader }).catch(() => new Map());
    if (token !== ask) return now;
    const over = stanceClips(clipsFor(model, got), key);
    const names = Object.keys(over);
    if (!names.length) return now;
    for (const [name, clip] of Object.entries(over)) {
      const c = clip.clone();
      c.name = name;
      c.userData = { ...clip.userData, stance: key };
      over[name] = c;
    }
    fig.anim?.restance({ ...own(laid.filter((n) => !over[n])), ...over });
    laid = names;
    now = key;
    // (the figure's own handles on its locomotion's actions)
    if (fig.act && fig.anim) for (const n of ['idle', 'walk', 'run']) if (fig.anim.actions[n]) fig.act[n] = fig.anim.actions[n];
    return now;
  };
  const taken = new Map(); // pack → Promise<[name…]>
  fig.takePack = (pack) => {
    if (!taken.has(pack))
      taken.set(
        pack,
        loadWalrusPacks([`${PACK_DIR}/clips-${pack}.glb`], { loader })
          .catch(() => new Map())
          .then((got) => {
            const own = clipsFor(model, got);
            for (const [name, clip] of Object.entries(own)) if (!clips[name] && fig.anim?.add(name, clip)) clips[name] = clip;
            return Object.keys(own);
          }),
      );
    return taken.get(pack);
  };
  return fig;
}
