// A clip's root travel at a moment, between its baked rows (the stroke
// tables' and the packs' `root`: [t, x, z], metres on the figure's own axes,
// +x its left and +z ahead). Pure: saber.js, scene.js's dodge and Heroes vs
// Villains' bots (missions/hvv.js) step a figure by it.
//
//   rootAt(root, t) → [x, z]

export const rootAt = (root, t) => {
  if (!root?.length) return [0, 0];
  if (t <= root[0][0]) return [root[0][1], root[0][2]];
  for (let i = 1; i < root.length; i++)
    if (root[i][0] >= t) {
      const [ta, xa, za] = root[i - 1];
      const [tb, xb, zb] = root[i];
      const k = (t - ta) / Math.max(1e-6, tb - ta);
      return [xa + (xb - xa) * k, za + (zb - za) * k];
    }
  const l = root[root.length - 1];
  return [l[1], l[2]];
};
