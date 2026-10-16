// A rig of Meshy's shape, made by hand for the guests' tests: 24 joints in
// centimetres under a root scaled 0.01, the back's three joints named as
// asked (Meshy's own names do not say their order), arms 45° under level and
// flat, legs straight down, every rotation the identity.
const row = (name, parent, translation) => ({ name, parent, translation, rotation: [0, 0, 0, 1], scale: [1, 1, 1] });

export function meshyRig(back = ['B', 'A', 'C']) {
  const limbs = ['Left', 'Right'].flatMap((s, i) => {
    const x = i ? -1 : 1;
    return [
      row(`${s}Shoulder`, back[2], [3 * x, 2, 0]),
      row(`${s}Arm`, `${s}Shoulder`, [10 * x, 0, 0]),
      row(`${s}ForeArm`, `${s}Arm`, [18 * x, -18, 0]),
      row(`${s}Hand`, `${s}ForeArm`, [18 * x, -18, 0]),
      row(`${s}UpLeg`, 'Hips', [6 * x, -8, 0]),
      row(`${s}Leg`, `${s}UpLeg`, [0, -36, 0]),
      row(`${s}Foot`, `${s}Leg`, [0, -36, 0]),
      row(`${s}ToeBase`, `${s}Foot`, [0, -8, 10]),
    ];
  });
  return [
    { ...row('Armature', null, [0, 0, 0]), scale: [0.01, 0.01, 0.01] },
    row('Hips', 'Armature', [0, 90, 0]),
    row(back[0], 'Hips', [0, 10, 0]),
    row(back[1], back[0], [0, 10, 0]),
    row(back[2], back[1], [0, 10, 0]),
    row('neck', back[2], [0, 5, 0]),
    row('Head', 'neck', [0, 8, 0]),
    row('head_end', 'Head', [0, 25, 0]),
    row('headfront', 'Head', [0, 2, 12]),
    ...limbs,
  ];
}
