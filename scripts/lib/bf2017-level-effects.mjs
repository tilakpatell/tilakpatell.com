// A level's effect spawns (lane E0): the map extras' `effects[]` (52,027
// across the maps: an EffectBlueprint by name and where it stands) as
// effects.json beside the pack, in the pack's frame and by cell, the
// playable map's sub-levels only (bf2017-lights.mjs's keepSub, less the
// fog's set). Fidelity X's createEffects reads it; until X merges nothing
// draws it. Pure.
//
//   effectsJson(extras, pack, { subworlds }) → [{ name, position, quaternion, cell, auto }]

import { keepSub } from './bf2017-lights.mjs';

const r2 = (v) => Math.round(v * 100) / 100;
const r4 = (v) => Math.round(v * 1e4) / 1e4;

export function effectsJson(extras, pack, { subworlds }) {
  const [ox, oy, oz] = pack.origin;
  const yaw = pack.yaw ?? 0;
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const hy = Math.sin(yaw / 2);
  const hw = Math.cos(yaw / 2);
  const cell = pack.cell ?? 128;
  const arena = pack.arena ?? Infinity;
  const out = [];
  for (const e of extras.effects ?? []) {
    const sub = subworlds[e.sub];
    if (!keepSub(sub?.name ?? sub) || /fog/i.test(String(sub?.name ?? sub).split('/').pop())) continue;
    const x = e.position[0] - ox;
    const z = e.position[2] - oz;
    const position = [r2(x * c + z * s), r2(e.position[1] - oy), r2(-x * s + z * c)];
    if (Math.abs(position[0]) > arena || Math.abs(position[2]) > arena) continue;
    const [qx, qy, qz, qw] = e.quaternion ?? [0, 0, 0, 1];
    const quaternion = [hw * qx + hy * qz, hw * qy + hy * qw, hw * qz - hy * qx, hw * qw - hy * qy].map(r4);
    out.push({ name: e.effect, position, quaternion, cell: `${Math.floor(position[0] / cell)},${Math.floor(position[2] / cell)}`, auto: e.autoStart !== false });
  }
  return out;
}
