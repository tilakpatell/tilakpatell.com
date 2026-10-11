// A class weapon as a soldier holds it: its third-person mesh, its muzzle
// and flash in the weapon's own frame (Wep_Root at the origin, the barrel
// along +z), and the stance pack its animation set plays
// (src/data/bf2017/held.json, written by scripts/bf2017-held.mjs; the
// Battlefront world's figures/held.js reads it).
//
// The muzzle is the bone the game draws a bolt from (the firing records'
// `Shot.WeaponBone: GameplayBones_WeaponMuzzleBone`): the weapon
// skeleton's rest for Wep_Muzzle (WeaponSke01's LocalPose, index 41, the
// same for every weapon) plus the weapon's own offset for that bone
// (`WeaponStates[0].Mesh3pTransforms`: the entry whose index is 41). The
// flash is the muzzle-flash effect's offset in the modifier no unlock
// gates (the all-zero `UnlockAssetGuid`); it differs from the bone by a
// few centimetres on three weapons, and the game draws bolts from the bone.
//
//   restMuzzle(root) → { index, at:[x,y,z], source } | null
//   heldRow(root, blueprintName) → { id, mesh, muzzle, flash, animSet, stance, …_source, _missing }
//   STANCE_OF: an animation set → the stance pack's key (hand: the packs'
//     own names, walrusSets/stance.js's STANCE_KEYS)

import { deref, loadAsset, objectsOf } from './bf2017-ebx.mjs';
import { weaponId } from './bf2017-rulebook.mjs';

export const SKELETON = 'Characters/Rigs/Weapon/WeaponSke01';
export const MUZZLE_BONE = 'Wep_Muzzle';
export const STANCE_OF = { wabsRif: 't', wabsPstl: 'p', wabsLMG: 'l' };
const UNGATED = '00000000-0000-0000-0000-000000000000';
const vec = (v) => [v.x, v.y, v.z];
// (millimetre-and-under noise off a sum of two floats)
const round = (n) => Math.round(n * 1e6) / 1e6;

export function restMuzzle(root) {
  const ske = loadAsset(root, SKELETON);
  const sa = ske && objectsOf(ske, 'SkeletonAsset')[0];
  const index = sa?.BoneNames?.indexOf(MUZZLE_BONE) ?? -1;
  if (index < 0) return null;
  return { index, at: vec(sa.LocalPose[index].trans), source: `${SKELETON}#SkeletonAsset.LocalPose.${index}.trans` };
}

export function heldRow(root, name) {
  const missing = [];
  const row = { id: weaponId(name) };
  const asset = loadAsset(root, name);
  const data = asset && objectsOf(asset, 'SoldierWeaponData')[0];
  if (!data) {
    row._missing = [`blueprint: ${name}`];
    return row;
  }
  const at = `${asset.name}#SoldierWeaponData`;
  const state = data.WeaponStates?.[0];
  if (state?.Mesh3p?.$asset) Object.assign(row, { mesh: state.Mesh3p.$asset, mesh_source: `${at}.WeaponStates.0.Mesh3p` });
  else missing.push('mesh: WeaponStates.0.Mesh3p');

  const rest = restMuzzle(root);
  if (!rest) missing.push(`rest: ${SKELETON}`);
  const t = state?.Mesh3pTransforms;
  const k = rest ? (t?.Indices ?? []).indexOf(rest.index) : -1;
  if (rest && k >= 0) {
    const off = vec(t.Transforms[k].trans);
    row.muzzle = rest.at.map((v, i) => round(v + off[i]));
    row.muzzle_source = `derived: ${rest.source} + ${at}.WeaponStates.0.Mesh3pTransforms.Transforms.${k}.trans`;
  } else if (rest) {
    // (no offset for the bone: the weapon keeps the skeleton's rest)
    row.muzzle = rest.at.slice();
    row.muzzle_source = rest.source;
  }

  const ungated = (data.WeaponModifierData ?? []).find((m) => m.UnlockAssetGuid === UNGATED);
  const fx = (ungated?.Modifiers ?? []).map((r) => deref(asset, r)).find((m) => m?.$type === 'WeaponFiringEffectsModifier');
  const off = fx?.FireEffects3p?.[0]?.Offset;
  if (off) Object.assign(row, { flash: vec(off), flash_source: `${asset.name}#WeaponFiringEffectsModifier.FireEffects3p.0.Offset` });
  else missing.push('flash: an ungated WeaponFiringEffectsModifier');

  if (data.AnimBaseSet) {
    Object.assign(row, { animSet: data.AnimBaseSet, animSet_source: `${at}.AnimBaseSet` });
    row.stance = STANCE_OF[data.AnimBaseSet] ?? null;
    if (!row.stance) missing.push(`stance: no pack for ${data.AnimBaseSet}`);
  } else missing.push('animSet: AnimBaseSet');
  row._missing = missing;
  return row;
}
