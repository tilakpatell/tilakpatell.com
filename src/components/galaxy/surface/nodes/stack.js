// The game's light under the surface on the node renderer (the
// picture-everywhere design, §3.3, lane T2): what lib/three/light draws for
// the Battlefront world, put under the surface's own sun, sky and look, so
// every Star Wars world from the mid level up draws with it.
//
// - The sun: the surface's own DirectionalLight (its weather, rooms and day
//   move it) casts through lane S's cascades (sun.js's castCascades: four
//   on high and ultra, two on mid), filtered by PCSS on high and ultra and
//   PCF on mid (shadows.js), under the record's cloud shadows where the
//   record has them (clouds.js), in place of its old 2,048² map and its
//   snapping.
// - Contact shadows under you and your crew (contact.js).
// - The level's volumetric glows and cones (volumes.json beside the pack,
//   lane V's volumetrics.js), on high and ultra, in the chain.
// - A shadow-casting `rays` light round the camera for the god rays on
//   ultra (sun.js's rays: GodraysNode cannot march the cascades).
// - The post: ./chain.js handed the record, the rays light, the volumes and
//   the picture's grade and LUT; it builds lib/three/light/post.js's chain
//   for the level.
// - The record's picture (lane Q6; ./picture.js, or lane P's): `picture` is
//   one weather's { record, lut, panorama, gradient, cloudShadow, lights }
//   (the shape applyGameLight's `picture` takes, the VE record beside it),
//   or a promise of it. Its tone map, LUT and Gaussians go to the chain, its
//   cloud texture to the sun's shadow, its painted panorama (light/sky.js)
//   over the surface's dome (`dome`, hidden while it shows), its fog
//   (light/fog.js, the gradient's colour) as the scene's fog node over the
//   surface's (`skyFog`'s mix to the dome set to 0), and the level's placed
//   lights clustered (light/placed.js) where the site has no pack (a pack's
//   lights.json is placed by level/index.js). None: the surface's own sky,
//   fog and grade.
//
//   surfaceEntry(site, picture, { sunDir }) → the entry lib/three/light reads
//     (pure): lane G's derived shape from the site, its sun where the scene's
//     shines from (the site's suns are the dome's, in its own angles), the
//     picture's VE record beside it
//   createSurfaceStack({ scene, renderer, camera, sun, site, tier, post,
//     picture, volumes, dome, skyFog }) → Promise<null | { track(object),
//     (volumes: the pack's volumes.json, or a promise of it)
//     untrack(object), update(dt, camera), parts, dispose() }>
//     (null at a level it does not know)

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
  };
  if (picture?.record) {
    // (the record's own rate, calibrate.js's from its tone map: Hoth's day
    // 6.2e-6, the sun 0.79 as the site has it. A rate set here would win
    // over it and light the painted sky and the lamps ten thousand times over)
    entry.record = picture.record;
    entry.name = picture.name ?? null;
    entry.picture = picture;
  } else {
    // (no record: lane G's calibrated rate for the game's lumens and nits,
    // its _source lib/three/gameLight.js: the volumes' glows)
    entry.gameToSite = GAME_TO_SITE;
  }
  return entry;
}

export async function createSurfaceStack({ scene, renderer, camera, sun, site, tier = 'high', post = null, picture: asked = null, volumes = null, dome = null, skyFog = null }) {
  if (!STACK_TIERS.includes(tier)) return null;
  const picture = await Promise.resolve(asked).catch(() => null);
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
  // (the rate from the game's lumens and nits to the site's: the volumes' glows, the lamps)
  const { readEntry } = await import('../../../../lib/three/light/entry.js');
  const rate = readEntry(entry).gameToSite;
  const owned = [];

  // the picture's textures: its LUT strip, its panorama, fog gradient and
  // cloud texture (a failure leaves that one out)
  let lut = null;
  if (pic?.lut) lut = await import('../../../../lib/three/gameLut.js').then(({ loadLut }) => loadLut(pic.lut.url, pic.lut.size)).catch(() => null);
  const ktx2 = pic?.panorama || pic?.gradient || pic?.cloudShadow ? await import('../../../../lib/three/gltf.js').then(({ ktx2Loader }) => ktx2Loader({ renderer })).catch(() => null) : null;
  const loadTex = (part, tiled) =>
    part && ktx2
      ? ktx2
          .loadAsync(part.url)
          .then((t) => {
            t.colorSpace = THREE.NoColorSpace;
            t.wrapS = THREE.RepeatWrapping;
            t.wrapT = tiled ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
            t.needsUpdate = true;
            return t;
          })
          .catch(() => null)
      : Promise.resolve(null);
  const [panoTex, gradTex, cloudTex] = await Promise.all([loadTex(pic?.panorama, false), loadTex(pic?.gradient, false), loadTex(pic?.cloudShadow, true)]);
  owned.push(lut, panoTex, gradTex, cloudTex);

  // the record's own sky and fog over the surface's, where it has a picture
  let painted = null;
  let recordFog = null;
  const was = { fogNode: scene.fogNode ?? null, dome: dome?.visible ?? null, mix: skyFog?.uniforms?.uSfMix?.value ?? null };
  if (pic && entry.record) {
    const [{ createSky }, { createFog }] = await Promise.all([import('../../../../lib/three/light/sky.js'), import('../../../../lib/three/light/fog.js')]);
    painted = await createSky(entry, { panorama: panoTex ? { ...pic.panorama, texture: panoTex } : null });
    scene.add(painted.mesh);
    if (dome) dome.visible = false;
    const gradient = gradTex ? { texture: gradTex, rotation: pic.gradient.rotation, gain: painted.uniforms.panoramaGain ?? 1 } : null;
    recordFog = await createFog(entry, { origin: [0, 0, 0], gradient });
    scene.fogNode = recordFog.node;
    if (skyFog?.uniforms?.uSfMix) skyFog.uniforms.uSfMix.value = 0;
  }
  // the level's placed lights, clustered (the record's lumens at its rate);
  // a world with a pack has them from its lights.json already (level/index.js)
  let placed = null;
  if (picture?.lights && !site?.level) {
    const { createPlacedLights } = await import('../../../../lib/three/light/placed.js');
    placed = await createPlacedLights(scene, renderer, { source: picture.lights, scale: rate }).catch(() => null);
  }

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
  const vols = source && CONES_LIT[tier] ? await createVolumetrics(scene, renderer, { tier, source, scale: rate }) : null;
  await post?.light?.({ entry, light: rays, lut, volumetrics: vols, grade: pic?.grade ?? null });

  const dir = new THREE.Vector3();
  return {
    parts: { entry, soft, clouds, cascades, rays, contact, volumetrics: vols, sky: painted, fog: recordFog, placed, picture: pic ? { grade: Boolean(pic.grade), lut: Boolean(lut), panorama: Boolean(panoTex), gradient: Boolean(gradTex), cloudShadow: Boolean(cloudTex), lights: Boolean(placed) } : null },
    track: (object) => contact.track(object),
    untrack: (object) => contact.untrack(object),
    update(dt, view = camera) {
      clouds?.update(dt);
      cascades?.follow();
      if (!view) return;
      cascades?.update(view);
      contact.update(view);
      vols?.update(view);
      painted?.update(view);
      placed?.update(view);
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
      placed?.dispose();
      painted?.dispose();
      if (recordFog) scene.fogNode = was.fogNode;
      if (dome && was.dome != null) dome.visible = was.dome;
      if (skyFog?.uniforms?.uSfMix && was.mix != null) skyFog.uniforms.uSfMix.value = was.mix;
      cascades?.dispose();
      vols?.dispose();
      rays?.removeFromParent();
      rays?.target.removeFromParent();
      rays?.dispose();
      for (const t of owned) t?.dispose?.();
    },
  };
}
