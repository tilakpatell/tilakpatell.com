// How a decal's texture is drawn (lane Q4). The drop's decal maps named
// `_RGB` are not colour: each channel is a mask, read from the maps
// themselves on 2026-10-10 (decoded from the bucket's KTX2):
// - T_BlasterHole_RGB_01: red the scorch, green its glowing rim (the
//   shader's T_BlackBodyRamps_01_M colours it), blue a grunge breakup;
//   alpha full;
// - T_BlasterStreak_RGB_01: one grey sheet in all three, a 2 × 2 atlas of
//   three-streak bursts (the records' atlasTile picks one);
// - T_Burnt_01_RGB: red and green a normal, blue the burn.
// The site draws such a decal as a scorch over what it lies on, its
// coverage the channel MASKS names (red where unread). A map with a colour
// suffix (`_C`, `_CS`, `_D`, `_RGBA`) is its own colour, its alpha the
// coverage. The rims' glow and the burnt map's normal are not drawn.
//
// lookOf(textureName) → { mask: 'r' | 'g' | 'b' | 'a', color: [r, g, b] | null } (pure)
// decalNodes(map, look, uv, opacity, tsl) → { colorNode, opacityNode, texel }

// a blaster's burn, near black (linear)
export const SCORCH = [0.02, 0.018, 0.016];
// the coverage channel of each packed map read
export const MASKS = {
  'FX/Decals/EnvDecals/T_BlasterHole_RGB_01': 'r',
  'FX/Decals/EnvDecals/T_BlasterStreak_RGB_01': 'r',
  'FX/Decals/VolumeDecals/Textures/T_Burnt_01_RGB': 'b',
};
const PACKED = /_RGB(_\d+)?$/i;

export function lookOf(name) {
  if (PACKED.test(String(name ?? ''))) return { mask: MASKS[name] ?? 'r', color: SCORCH };
  return { mask: 'a', color: null };
}

export function decalNodes(map, look, uvNode, opacity, tsl) {
  const texel = tsl.texture(map, uvNode);
  return {
    texel,
    colorNode: look.color ? tsl.vec3(...look.color) : texel.rgb,
    opacityNode: tsl.mul(texel[look.mask], tsl.float(opacity)),
  };
}
