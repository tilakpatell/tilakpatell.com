// A level's placed effects, from the game's map extras to the site's
// effects.json beside lane L's pack: the pure half of
// scripts/bf2017-effects.mjs (fidelity lane X), the lights' twin
// (./bf2017-lights.mjs).
//
// The input is `web/maps/<level>/<name>.extras.json`'s `effects[]`: the
// spawn's transform (`position`, `quaternion` x, y, z, w, `scale`), the
// `EffectBlueprint`'s name (`blueprint`, or `name`), `sub` (the manifest's
// subworld) and, where the export says, `autoStart`.
//
// The output, per cell of the pack's frame:
//   { format: 1, cell, count, kinds: { <Effect>: n }, skipped, unread: [name],
//     cells: { "cx,cz": [{ name, pos, quat, scale?, autoStart? }] } }
// `name` is the blueprint's last part, the file under src/data/bf2017/fx/;
// `unread` the effects the level spawns that have no table there yet (the
// emitters CLI's next run).
//
// readEffect(raw) → effect | { skip } ; rebaseEffect(effect, origin, yaw)
// effectsJson(extras, pack, { subworlds, known }) → json

import { cellOf, keepSub } from './bf2017-lights.mjs';

const r2 = (v) => Math.round(v * 100) / 100;
const r4 = (v) => Math.round(v * 1e4) / 1e4;

export function readEffect(raw) {
  const full = raw?.blueprint ?? raw?.Blueprint ?? raw?.name ?? raw?.effect;
  if (!full) return { skip: 'unnamed' };
  if (raw.Enabled === false || raw.enabled === false) return { skip: 'off' };
  if (!Array.isArray(raw.position)) return { skip: 'unplaced' };
  const out = { name: String(full).split('/').pop(), pos: raw.position.map(Number), quat: (raw.quaternion ?? [0, 0, 0, 1]).map(Number) };
  const s = Array.isArray(raw.scale) ? Math.max(...raw.scale.map(Number)) : Number(raw.scale ?? 1);
  if (s !== 1 && s > 0) out.scale = s;
  if (typeof raw.autoStart === 'boolean') out.autoStart = raw.autoStart;
  return out;
}

// the game's frame to the pack's: the origin taken away, then turned by yaw
// about +Y (as the lights and lane L's instances), the quaternion with it
export function rebaseEffect(e, origin = [0, 0, 0], yaw = 0) {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const [x, y, z] = e.pos.map((v, i) => v - origin[i]);
  const hy = Math.sin(yaw / 2);
  const hw = Math.cos(yaw / 2);
  const [qx, qy, qz, qw] = e.quat;
  // (the yaw's quaternion [0, hy, 0, hw] times the effect's)
  const quat = [hw * qx + hy * qz, hw * qy + hy * qw, hw * qz - hy * qx, hw * qw - hy * qy];
  return { ...e, pos: [x * c + z * s, y, -x * s + z * c], quat };
}

export function effectsJson(extras, pack = {}, { subworlds = null, known = null } = {}) {
  const cell = pack.cell ?? 128;
  const reach = pack.arena ? pack.arena + cell : Infinity;
  const skipped = {};
  const kinds = {};
  const cells = {};
  const unread = new Set();
  let count = 0;
  for (const raw of extras?.effects ?? []) {
    if (subworlds && !keepSub(subworlds[raw.sub])) {
      skipped.sub = (skipped.sub ?? 0) + 1;
      continue;
    }
    const e = readEffect(raw);
    if (e.skip) {
      skipped[e.skip] = (skipped[e.skip] ?? 0) + 1;
      continue;
    }
    const at = rebaseEffect(e, pack.origin, pack.yaw);
    if (Math.abs(at.pos[0]) > reach || Math.abs(at.pos[2]) > reach) {
      skipped.outside = (skipped.outside ?? 0) + 1;
      continue;
    }
    const out = { name: at.name, pos: at.pos.map(r2), quat: at.quat.map(r4) };
    if (at.scale) out.scale = r4(at.scale);
    if (at.autoStart !== undefined) out.autoStart = at.autoStart;
    (cells[cellOf(at.pos, cell)] ??= []).push(out);
    kinds[at.name] = (kinds[at.name] ?? 0) + 1;
    if (known && !known.has(at.name)) unread.add(at.name);
    count++;
  }
  return { format: 1, cell, count, kinds, skipped, unread: [...unread].sort(), cells };
}
