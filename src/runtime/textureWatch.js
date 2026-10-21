// A texture moved along its surface, seen by the node renderer. three's
// NodeMaterialObserver takes a draw whose object and material are as they
// were for unchanging, and sends its uniforms again only when they aren't;
// a texture's place on the surface (its offset, repeat, rotation, centre:
// what its matrix is made from) is neither, so a texture a world slides
// each frame (a molten channel's, a waterfall's, the rain on a window) stays
// where it was first drawn. watchTextures(Observer) teaches the observer's
// `equals` to look at those too, once, for every renderer made after.
//
// watchTextures(Observer) → Observer (its prototype's equals wrapped; once)
// placeOf(material) → a string of every texture's place, or '' (none)

const PLACE = Symbol('texture places');

export function placeOf(material) {
  let out = '';
  for (const key in material) {
    const t = material[key];
    if (!t || t.isTexture !== true || t.matrixAutoUpdate === false) continue;
    out += `${key}:${t.offset.x},${t.offset.y},${t.repeat.x},${t.repeat.y},${t.rotation},${t.center.x},${t.center.y};`;
  }
  return out;
}

export function watchTextures(Observer) {
  const proto = Observer?.prototype;
  if (!proto?.equals || proto.equals[PLACE]) return Observer;
  const equals = proto.equals;
  const seen = new WeakMap(); // a render object → its material's textures' places when last sent
  const watched = function (renderObject, ...rest) {
    const same = equals.call(this, renderObject, ...rest);
    const place = placeOf(renderObject.material);
    const moved = seen.get(renderObject) !== place;
    seen.set(renderObject, place);
    return same && !moved;
  };
  watched[PLACE] = true;
  proto.equals = watched;
  return Observer;
}
