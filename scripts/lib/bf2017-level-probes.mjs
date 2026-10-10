// A level's reflection volumes and its far shadow cache (lane E0), from the
// level's lighting layers in data/ (Levels/MP/<Map>/*_Lighting*: each
// PbrBoxReflectionVolumeEntityData a box, its baked cube the bucket's
// web/textures/<level>/reflectionvolumetexture/<layer>/<guid>-tex_<face>.hdr;
// the DistantShadowCacheVolumeEntityData the far shadow, a 16-bit depth PNG).
// One weather's layers: those named for it, else every one that is not
// night, fog or an interior. In the pack's frame. Pure; the CLI cuts the
// faces to 64² (probes/<id>.<face>.hdr) and copies the cache
// (shadow/far.png).
//
//   probesJson(layers, pack, { textures, weather, variant }) → { probes: [{ id,
//     variant, centre, axes: [right, up, forward], faces, from }],
//     shadowCache: { png, from, size, resolution, tiles, centre, right, up,
//     forward, variant } | null, skipped }

const v3 = (v) => [v.x, v.y, v.z];
const r2 = (v) => Math.round(v * 100) / 100;
const OTHER = /night|fog|sunset|dusk|dawn|interior|indoor|cinematic|eor|lobby|outro/i;
const layerOf = (asset) => String(asset).split('/').slice(-2, -1)[0] ?? '';

export function probesJson(layers, pack, { textures, weather, variant = null }) {
  const [ox, oy, oz] = pack.origin;
  const yaw = pack.yaw ?? 0;
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const turn = ([x, y, z]) => [r2(x * c + z * s), r2(y), r2(-x * s + z * c)];
  const toPack = ([x, y, z]) => turn([x - ox, y - oy, z - oz]);
  const objects = layers.flatMap((l) => (l.objects ?? []).filter(Boolean));
  const names = [...new Set(objects.filter((o) => o.BakedTexture?.$asset).map((o) => layerOf(o.BakedTexture.$asset)))];
  // (the light record's own variant where lane G named one: Hoth's day is Cloudy_VFX)
  const named = variant && names.includes(variant) ? [variant] : names.filter((n) => n.toLowerCase().includes(String(weather).toLowerCase()));
  const want = new Set(named.length ? named : names.filter((n) => !OTHER.test(n)));
  const probes = [];
  const skipped = {};
  const skip = (why) => (skipped[why] = (skipped[why] ?? 0) + 1);
  let shadowCache = null;
  for (const o of objects) {
    if (o.$type === 'DistantShadowCacheVolumeEntityData') {
      const variant = layerOf(o.BakedTexture?.$asset);
      const t = textures.get(String(o.BakedTexture?.$asset).toLowerCase());
      if (!want.has(variant) || !t || shadowCache) continue;
      shadowCache = { png: 'shadow/far.png', from: t.file, size: [t.width, t.height], resolution: o.Resolution, tiles: o.TilesPerSide, centre: toPack(v3(o.Transform.trans)), right: turn(v3(o.Transform.right)), up: turn(v3(o.Transform.up)), forward: turn(v3(o.Transform.forward)), variant };
      continue;
    }
    if (o.$type !== 'PbrBoxReflectionVolumeEntityData') continue;
    const variant = layerOf(o.BakedTexture?.$asset);
    if (!want.has(variant)) {
      skip('another weather');
      continue;
    }
    if (o.Enabled === false) {
      skip('switched off');
      continue;
    }
    const t = textures.get(String(o.BakedTexture.$asset).toLowerCase());
    if (!t?.files?.length) {
      skip('not in the bucket');
      continue;
    }
    const id = String(o.$guid).slice(0, 8);
    probes.push({ id, variant, centre: toPack(v3(o.Transform.trans)), axes: [turn(v3(o.Transform.right)), turn(v3(o.Transform.up)), turn(v3(o.Transform.forward))], faces: `probes/${id}`, from: t.files });
  }
  return { probes, shadowCache, skipped };
}
