// Which of Battlefront II's star fields each system's sky has under the
// galaxy sky.js bakes (lane Q: the game's own panoramas, cut by
// scripts/bf2017-sky.mjs --panorama): Endor its own (SB_Endor_01's
// t_space_endor01_c), the systems whose space map names one theirs (Naboo's
// blockade and Fondor: t_space_no_large_stars_01_c), and by canon region the
// rest: the Core Worlds the generic t_space_01_c, the Outer Rim the one
// without large stars. A system in neither (the Mid Rim's Kashyyyk, Kamino in
// Wild Space, whose map's sky is a storm, not space) keeps the sky it had,
// as every system does on the lowest quality level.
//
// panoramaOf(sys) → 'endor' | 'core' | 'rim' | null
// panoramaUrl(sys, level) → '/textures/galaxy/sky/space/<name>.<width>.ktx2' | null
//   (ultra 4096 wide, high 2048, mid 1024, low none; never wider than the game's)

export const PANORAMA_WIDTH = { endor: 4096, core: 4096, rim: 2048 };
const BY_SYSTEM = { endor: 'endor', naboo: 'rim', fondor: 'rim' };
const BY_REGION = { 'Core Worlds': 'core', 'Outer Rim Territories': 'rim' };
const WIDTH = { ultra: 4096, high: 2048, mid: 1024 };

export const panoramaOf = (sys) => (sys ? (BY_SYSTEM[sys.id] ?? BY_REGION[sys.region] ?? null) : null);

export function panoramaUrl(sys, level) {
  const name = panoramaOf(sys);
  const want = WIDTH[level];
  if (!name || !want) return null;
  return `/textures/galaxy/sky/space/${name}.${Math.min(want, PANORAMA_WIDTH[name])}.ktx2`;
}
