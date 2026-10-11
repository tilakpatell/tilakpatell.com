// The game's light under the surface on the node renderer (the
// picture-everywhere design, §3.3, lane T2): what lib/three/light draws for
// the Battlefront world, put under the surface's own sun, sky and look, so
// every Star Wars world from the mid level up draws with it.
//
// - The sun: the surface's own DirectionalLight (its weather, rooms and day
//   move it) casts through lane S's cascades (sun.js's castCascades: four
//   on high and ultra, two on mid), filtered by PCSS on high and ultra and
//   PCF on mid (shadows.js), under the record's cloud shadows where the
//   record has them (clouds.js). Its old 2,048² map and its snapping are the
//   classic renderer's.
// - Contact shadows under you and your crew (contact.js).
// - The level's volumetric glows and cones (volumes.json beside the pack,
//   lane V's volumetrics.js), on high and ultra, in the chain.
// - A shadow-casting `rays` light round the camera for the god rays on
//   ultra (sun.js's rays: GodraysNode cannot march the cascades).
// - The post: ./chain.js handed the record, the rays light, the volumes and
//   the picture's grade and LUT; it builds lib/three/light/post.js's chain
//   for the level.
// - The record's picture (lane Q6, lane P passes it): `picture` is one
//   weather's { record, lut, panorama, gradient, cloudShadow } (the shape
//   applyGameLight's `picture` takes, the VE record beside it). Its LUT and
//   Gaussians go to the chain, its cloud texture to the shadow; its painted
//   sky and fog gradient are lane P's to lay over the surface's dome. None:
//   the surface's own sky, fog and grade.
//
//   surfaceEntry(site, picture, { sunDir }) → the entry lib/three/light reads
//     (pure): lane G's derived shape from the site, its sun where the scene's
//     shines from (the site's suns are the dome's, in its own angles), the
//     picture's VE record beside it
//   createSurfaceStack({ scene, renderer, camera, sun, site, tier, backend,
//     post, picture, volumes }) → Promise<null | { track(object),
//     (volumes: the pack's volumes.json, or a promise of it)
//     untrack(object), update(dt, camera), parts, dispose() }>
//     (null on the classic renderer)

import { GAME_TO_SITE } from '../../../../lib/three/gameLight';

// (low on the node renderer: no cascades, contact shadows or volumes, the
// floor's baked light instead, but its chain: the render, the bloom, the grade)
export const STACK_TIERS = ['low', 'mid', 'high', 'ultra'];
const RAYS_BOX = 80; // m: sun.js's, the god rays' shadow box round the camera
const RAYS_FAR = 400; // m

const hex = (c) => (typeof c === 'string' ? c : c?.isColor ? `#${c.getHexString()}` : c);

// The site as lane G's derived shape (entry.js reads it: the sky's colours,
// the suns, the fill, the fog), the picture's VE record beside it
const DEG = 180 / Math.PI;
// a direction toward the sun as entry.js's azimuth (from +Z toward +X) and elevation, in degrees
export const azElOf = ([x, y, z]) => ({ az: Math.atan2(x, z) * DEG, el: Math.asin(Math.max(-1, Math.min(1, y / (Math.hypot(x, y, z) || 1)))) * DEG });

export function surfaceEntry(site, picture = null, { sunDir = null } = {}) {
  const sky = site?.sky ?? {};
  const light = site?.light ?? {};
  const fog = site?.fog ?? {};
  const entry = {
    sky: {
      zenith: hex(sky.zenith),
      horizon: hex(sky.horizon),
      hazeColor: hex(sky.hazeColor),
      suns: sunDir ? [{ ...azElOf(sunDir), color: hex(sky.suns?.[0]?.color) }] : [],
    },
    light: { sun: light.sun, sky: hex(light.sky), ground: hex(light.ground), ambient: light.ambient },
    fog: { color: hex(fog.color), density: fog.density },
    // (lane G's calibrated rate for the game's lumens and nits, its _source
    // lib/three/gameLight.js: the volumes' glows, the placed lights)
    gameToSite: GAME_TO_SITE,
  };
  if (picture?.record) {
    entry.record = picture.record;
    entry.name = picture.name ?? null;
    entry.picture = picture;
  }
  return entry;
}

export async function createSurfaceStack({ scene, renderer, camera, sun, site, tier = 'high', backend = 'webgpu', post = null, picture = null, volumes = null }) {
  if (backend === 'webgl' || !STACK_TIERS.includes(tier)) return null;
  const [{ loadThree }, { castCascades }, { filterFor, pcssFilter, readPcss, vsmFallback }, { cloudShadowNode }, { createContactShadows }, { CONES_LIT, createVolumetrics }, { pictureOf }] = await Promise.all([
    import('../../../../lib/three/light/three.js'),
    import('../../../../lib/three/light/sun.js'),
    import('../../../../lib/three/light/shadows.js'),
    import('../../../../lib/three/light/clouds.js'),
    import('../../../../lib/three/light/contact.js'),
    import('../../../../lib/three/light/volumetrics.js'),
    import('../../../../lib/three/light/grade.js'),
  ]);
  const { THREE } = await loadThree();
  const toward = sun.position.clone().sub(sun.target.position).normalize();
  const entry = surfaceEntry(site, picture, { sunDir: [toward.x, toward.y, toward.z] });
  const pic = pictureOf(entry, entry.picture ?? null);
  const owned = [];

  // the picture's textures: its LUT strip and its cloud texture (a failure leaves it out)
  let lut = null;
  let cloudTex = null;
  if (pic?.lut) lut = await import('../../../../lib/three/gameLut.js').then(({ loadLut }) => loadLut(pic.lut.url, pic.lut.size)).catch(() => null);
  if (pic?.cloudShadow)
    cloudTex = await import('../../../../lib/three/gltf.js')
      .then(({ ktx2Loader }) => ktx2Loader({ renderer }))
      .then((k) => k.loadAsync(pic.cloudShadow.url))
      .then((t) => {
        t.colorSpace = THREE.NoColorSpace;
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        return t;
      })
      .catch(() => null);
  owned.push(lut, cloudTex);

  // the sun's soft shadow by tier, through its cascades, under the clouds
  const soft = filterFor(tier, readPcss(entry));
  const filter = soft.kind === 'pcss' ? await pcssFilter(soft) : null;
  const clouds = await cloudShadowNode(entry, null, cloudTex ? { texture: cloudTex, offset: pic.cloudShadow.offset, rgbm: pic.cloudShadow.rgbm } : {});
  const cascades = await castCascades(sun, entry, { tier, filter, cloud: clouds?.node ?? null });
  if (cascades && soft.kind === 'vsm') vsmFallback(renderer, sun, soft.samples);

  // the god rays' light on ultra: casts round the camera, adds no light
  let rays = null;
  if (tier === 'ultra' && cascades) {
    rays = new THREE.DirectionalLight(0xffffff, 0);
    rays.name = 'sun-rays';
    rays.castShadow = true;
    rays.shadow.mapSize.set(1024, 1024);
    Object.assign(rays.shadow.camera, { left: -RAYS_BOX, right: RAYS_BOX, top: RAYS_BOX, bottom: -RAYS_BOX, near: 1, far: RAYS_FAR });
    rays.shadow.camera.updateProjectionMatrix();
    scene.add(rays, rays.target);
  }

  const contact = await createContactShadows(scene, renderer, { tier });
  // (the volumes: the pack's volumes.json, or a promise of it; none where it has none)
  const source = await Promise.resolve(volumes).catch(() => null);
  const vols = source && CONES_LIT[tier] ? await createVolumetrics(scene, renderer, { tier, source, scale: entry.gameToSite }) : null;
  await post?.light?.({ entry, light: rays, lut, volumetrics: vols, grade: pic?.grade ?? null });

  const dir = new THREE.Vector3();
  return {
    parts: { entry, soft, clouds, cascades, rays, contact, volumetrics: vols, picture: pic ? { grade: Boolean(pic.grade), lut: Boolean(lut), cloudShadow: Boolean(cloudTex) } : null },
    track: (object) => contact.track(object),
    untrack: (object) => contact.untrack(object),
    update(dt, view = camera) {
      clouds?.update(dt);
      cascades?.follow();
      if (!view) return;
      cascades?.update(view);
      contact.update(view);
      vols?.update(view);
      if (rays) {
        dir.copy(sun.position).sub(sun.target.position).normalize();
        rays.target.position.copy(view.position);
        rays.position.copy(view.position).addScaledVector(dir, RAYS_FAR / 2);
        rays.target.updateMatrixWorld();
        rays.updateMatrixWorld();
      }
    },
    dispose() {
      contact.dispose();
      clouds?.dispose();
      cascades?.dispose();
      vols?.dispose();
      rays?.removeFromParent();
      rays?.target.removeFromParent();
      rays?.dispose();
      for (const t of owned) t?.dispose?.();
    },
  };
}
