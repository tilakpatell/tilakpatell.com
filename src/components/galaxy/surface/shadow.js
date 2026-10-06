// The sun's shadow follows you about, but a shadow camera that slides by less
// than a texel each frame redraws every edge a little differently: the
// shadows crawl and shimmer as you walk. Snapped to whole texels of the
// shadow map, it moves in steps the map can't see.
//
//   snapToTexel(x, z, extent, mapSize) → [x, z], each rounded to a multiple of
//     one texel, (2 · extent) / mapSize, for a shadow camera `extent` either
//     side of its middle. Pure. The scene hands it the focus in the sun's own
//     frame (along its shadow camera's right and up), where the texels are.

export function snapToTexel(x, z, extent, mapSize) {
  const t = (2 * extent) / mapSize;
  return [Math.round(x / t) * t, Math.round(z / t) * t];
}
