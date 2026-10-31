import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { GAME_HULLS, GAME_MAPS, RELIEF, paintMaterial, dressGameHull, dressGameMaps, hullMaterial, inFrame, joined, sizesFor } from './capitalHull';

// a texture as the loader gives one (the sheets tile)
const map = () => new THREE.Texture();
const sheets = () => ({ atlas: map(), orm: map(), panels: map(), panelsNormal: map(), details: map(), detailsNormal: map() });
// a material as three compiles it
const compiled = (m) => {
  const shader = { uniforms: {}, vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader };
  m.onBeforeCompile(shader);
  return shader;
};
// a ship as models.js has it before it's fitted: its hull bare, a part beside it
const ship = () => {
  const root = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 4), new THREE.MeshStandardMaterial({ name: 'M_Hull_01_lods' }));
  hull.position.set(0, 0.5, 0);
  hull.scale.setScalar(0.5);
  const part = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ name: 'M_Details_lods', map: map() }));
  root.add(hull, part);
  return { root, hull, part };
};
// the pack's hull: quantized as its GLB is (whole-number positions its node's scale makes metres)
const packHull = () => {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Uint16Array([0, 0, 0, 100, 0, 0, 0, 100, 0]), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(new Int16Array([0, 0, 32767, 0, 0, 32767, 0, 0, 32767]), 3, true));
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 25, 0, 0, 25]), 2));
  g.setAttribute('uv1', new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 0, 1]), 2));
  return { geometry: g, matrix: new THREE.Matrix4().makeScale(0.02, 0.02, 0.02) };
};

describe('capitalHull', () => {
  it('names the Star Destroyer’s hull in the space level’s pack, its map and the sheets’ relief, not their colour', () => {
    const d = GAME_HULLS.destroyer;
    expect(d.material.test('M_Hull_01_lods')).toBe(true);
    expect(d.material.test('M_Hull_lods')).toBe(false);
    expect(d.parts).toHaveLength(1);
    expect(d.parts[0].mesh).toMatch(/levels\/sb_endor\/meshes\/stardestroyer_hull_01_sb_endor_mesh$/);
    expect(d.lod).toEqual({ computer: 0, phone: 0 });
    expect(d.atlas.colour).toMatch(/t_stardestroyer_hull_01_cs$/);
    // (the far Star Destroyer's painted sheets: magnified over the deck, streaks and black and white blocks)
    expect(d.panels.colour).toBeNull();
    expect(d.details.colour).toBeNull();
    expect(d.panels.normal).toMatch(/t_stardestroyerpanels_01_nw__normal$/);
    expect(d.details.normal).toMatch(/t_stardestroyerdetails_01_nw__normal$/);
  });

  it('takes the sheets whole on a computer at mid and up, smaller on a phone, and the hull’s map alone at the lowest detail', () => {
    for (const detail of ['mid', 'high', 'ultra']) expect(sizesFor(detail).colour, detail).toBe(2048);
    expect(sizesFor('mid', true)).toEqual({ atlas: 1024, orm: 512, colour: 1024, normal: 512 });
    expect(sizesFor('low')).toEqual({ atlas: 512, orm: 0, colour: 0, normal: 0 });
    expect(sizesFor('ultra').atlas).toBe(2048);
  });

  it('paints the hull’s map on UV1 and lays the sheets on UV0, their colour by their mean and the details’ relief over the panels’', () => {
    const maps = sheets();
    // (a hull whose def names the sheets' colour)
    const withColour = { ...GAME_HULLS.destroyer, panels: { ...GAME_HULLS.destroyer.panels, mean: [0.795, 0.792, 0.699] }, details: { ...GAME_HULLS.destroyer.details, mean: [0.769, 0.768, 0.7] } };
    const m = hullMaterial(maps, withColour);
    expect(m.userData.gameHull).toBe(true);
    expect(m.metalness).toBe(0);
    expect([maps.atlas.channel, maps.orm.channel, maps.panelsNormal.channel]).toEqual([1, 1, 0]);
    expect(m.normalMap).toBe(maps.panelsNormal);
    expect(m.customProgramCacheKey()).toBe('|gamehull');
    const s = compiled(m);
    expect(s.uniforms.uGhDetails.value).toBe(maps.details);
    expect(s.fragmentShader).toMatch(/diffuseColor\.rgb \*= clamp\( ghPanel \* ghDetail, 0\.0, 2\.0 \)/);
    expect(s.fragmentShader).toMatch(/texture2D\( uGhDetails, vNormalMapUv \* 4\.0000 \)/);
    expect(s.fragmentShader).toMatch(/#include <normal_fragment_maps>/); // (three's own, for any other case)
    expect(s.fragmentShader).toMatch(/mapN = normalize\( vec3\( mapN\.xy \+ ghDn\.xy/);
  });

  it('lays the sheets’ relief alone on a hull whose def names no colour of theirs, its own program', () => {
    const maps = { atlas: map(), orm: map(), panelsNormal: map(), detailsNormal: map() };
    const m = hullMaterial(maps, GAME_HULLS.destroyer);
    expect(m.normalMap).toBe(maps.panelsNormal);
    expect(m.customProgramCacheKey()).toBe('|gamehull-relief');
    const s = compiled(m);
    expect(s.fragmentShader).not.toMatch(/ghPanel/);
    expect(s.fragmentShader).toMatch(/mapN = normalize\( vec3\( mapN\.xy \+ ghDn\.xy/);
    // (the details' relief at the game hull's calmer strength, gone where a pixel spans its texels)
    expect(s.fragmentShader).toContain('textureSize( uGhDetailsN, 0 )');
    expect(s.fragmentShader).toContain(`* ${(0.35).toFixed(4)} * ghFar`);
  });

  it('draws the hull’s map alone where the sheets aren’t to be had', () => {
    const m = hullMaterial({ atlas: map(), orm: null }, GAME_HULLS.destroyer);
    expect(m.normalMap).toBeNull();
    expect(Object.hasOwn(m, 'customProgramCacheKey')).toBe(false); // (three's own program: no patch)
  });

  it('widens a quantized mesh to floats before moving it into another frame', () => {
    const { geometry, matrix } = packHull();
    const to = new THREE.Matrix4().makeScale(0.5, 0.5, 0.5);
    const g = inFrame(geometry, matrix, to);
    expect(g.attributes.position.array).toBeInstanceOf(Float32Array);
    // (100 × 0.02 = 2 metres, in a frame of halves: 4)
    expect(g.attributes.position.getX(1)).toBeCloseTo(4, 6);
    expect(g.attributes.normal.getZ(0)).toBeCloseTo(1, 4);
    expect(Array.from(g.attributes.uv1.array)).toEqual(Array.from(geometry.attributes.uv1.array));
    expect(geometry.attributes.position.array).toBeInstanceOf(Uint16Array); // (the pack's own left as it was)
  });

  it('puts the pack’s hull in the bare one’s place, in its frame, and leaves the rest of the ship alone', async () => {
    const { root, hull, part } = ship();
    const partMaterial = part.material;
    const asked = [];
    const urls = [];
    const ok = await dressGameHull(root, 'destroyer', { detail: 'high', loadMesh: async (url) => (urls.push(url), packHull()), loadTexture: async (path, size) => (asked.push([path.split('/').pop(), size]), map()) });
    expect(ok).toBe(true);
    expect(urls).toEqual([`${GAME_HULLS.destroyer.parts[0].mesh}.lod0.glb`]);
    expect(hull.material.userData.gameHull).toBe(true);
    expect(part.material).toBe(partMaterial);
    // (the pack's corner at 2 m on x, in the hull's frame of halves, 4)
    expect(hull.geometry.attributes.position.getX(1)).toBeCloseTo(4, 6);
    // (the sheets' relief at the device's size, and none of their colour)
    expect(asked).toContainEqual(['t_stardestroyerpanels_01_nw__normal', 2048]);
    expect(asked.map(([name]) => name)).not.toContain('t_stardestroyerpanels_01_cs');
  });

  it('leaves the ship as it came when the pack’s hull or its map can’t be had, and a kind it has none for', async () => {
    const { root, hull } = ship();
    const before = hull.material;
    expect(await dressGameHull(root, 'destroyer', { loadMesh: async () => null, loadTexture: async () => map() })).toBe(false);
    expect(await dressGameHull(root, 'destroyer', { loadMesh: async () => packHull(), loadTexture: async () => null })).toBe(false);
    expect(await dressGameHull(root, 'xwing')).toBe(false);
    expect(hull.material).toBe(before);
  });

  it('asks the lowest detail for the hull’s map alone', async () => {
    const { root, hull } = ship();
    const asked = [];
    await dressGameHull(root, 'destroyer', { detail: 'low', loadMesh: async () => packHull(), loadTexture: async (path) => (asked.push(path.split('/').pop()), map()) });
    expect(asked).toEqual(['t_stardestroyer_hull_01_cs']);
    expect(hull.material.normalMap).toBeNull();
  });

  it('gives a cut that wears the game’s maps the pack’s, at the device’s sizes, with their ORM, a dielectric, shared as the cut’s was', async () => {
    expect(GAME_MAPS.corvette.material.test('NEWHULL')).toBe(true);
    expect(GAME_MAPS.providence.material.test('M_ProvidenceClass_DestroyerBackdrop_01')).toBe(true);
    const root = new THREE.Group();
    const cut = new THREE.MeshStandardMaterial({ name: 'M_ProvidenceClass_DestroyerBackdrop_01', map: map(), normalMap: map(), metalness: 1 });
    cut.normalScale.set(1, -1);
    const a = new THREE.Mesh(new THREE.BoxGeometry(), cut);
    const b = new THREE.Mesh(new THREE.BoxGeometry(), cut);
    const other = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ name: 'Extras' }));
    root.add(a, b, other);
    const asked = [];
    const done = await dressGameMaps(root, 'providence', { detail: 'mid', loadTexture: async (path, size) => (asked.push(`${path.split('/').pop()}.${size}`), map()) });
    expect(done).toBe(true);
    expect(asked).toEqual(['t_providenceclassdreadnaught_01_cs.1024', 't_providenceclassdreadnaught_01_nam__normal.2048', 't_providenceclassdreadnaught_01_nam__orm_977091d1.512']);
    expect(a.material).toBe(b.material);
    expect(a.material).not.toBe(cut);
    expect(a.material.userData.gameHull).toBe(true);
    expect(a.material.map).not.toBe(cut.map);
    expect(a.material.roughnessMap).toBe(a.material.aoMap);
    expect(a.material.metalness).toBe(0);
    // (the cut's own normal convention kept)
    expect(a.material.normalScale.y).toBe(-1);
    expect(other.material.userData.gameHull).toBeUndefined();
    // (the lowest detail keeps the cut's own; a failed load or another kind leaves it be)
    const kept = new THREE.Mesh(new THREE.BoxGeometry(), cut);
    const low = new THREE.Group().add(kept);
    expect(await dressGameMaps(low, 'providence', { detail: 'low', loadTexture: async () => map() })).toBe(false);
    expect(await dressGameMaps(low, 'providence', { loadTexture: async () => null })).toBe(false);
    expect(await dressGameMaps(low, 'destroyer', { loadTexture: async () => map() })).toBe(false);
    expect(kept.material).toBe(cut);
  });

  it('names the Venator’s five parts in the space level’s pack, the towers turned as the level sets them, and its mask and sheets', () => {
    const v = GAME_HULLS.venator;
    expect(v.material.test('M_VenatorStarDestroyer_Hull_01_lods')).toBe(true);
    expect(v.material.test('red')).toBe(false);
    expect(v.parts.map((p) => p.mesh.split('/').pop())).toEqual(['venatorstardestroyer_hull_01_mesh', 'venatorstardestroyer_controltower_01_mesh', 'venatorstardestroyer_controltower_left_mesh', 'venatorstardestroyer_controltower_right_mesh', 'venatorstardestroyer_detailback_01_mesh']);
    expect(v.parts[2].own.test('M_VenatorStarDestroyer_ControlTower_01_lods')).toBe(true);
    // (the left tower: turned half round, 195 m up and 222 m aft of the hull's middle)
    const e = v.parts[2].place.elements;
    expect(e[0]).toBeCloseTo(-1, 6);
    expect(e[10]).toBeCloseTo(-1, 6);
    expect([e[12], e[13], e[14]]).toEqual([-28.71, 194.968, 222.196]);
    expect(v.combine.map).toMatch(/levels\/kamino\/tex\/t_venatorstardestroyer_hull_01_combine_rgba$/);
  });

  it('joins the parts’ geometries into one, their attributes as floats and their indices offset', () => {
    const a = packHull().geometry;
    a.setIndex([0, 1, 2]);
    const b = packHull().geometry;
    const g = joined([a, b]);
    expect(g.getAttribute('position').count).toBe(6);
    expect(g.getAttribute('position').array).toBeInstanceOf(Float32Array);
    expect(g.getAttribute('uv1').count).toBe(6);
    expect(Array.from(g.index.array)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(joined([a])).toBe(a);
  });

  it('paints the Venator’s hull grey under its mask on UV1, the occlusion read from green, and the sheets on UV0', () => {
    const maps = { combine: map(), tilingNormal: map(), breakup: map(), breakupNormal: map() };
    const m = paintMaterial(maps, GAME_HULLS.venator);
    expect(m.userData.gameHull).toBe(true);
    expect(m.aoMap).toBe(maps.combine);
    expect(maps.combine.channel).toBe(1);
    expect(m.normalMap).toBe(maps.tilingNormal);
    expect(m.metalness).toBe(0);
    const shader = compiled(m);
    expect(shader.fragmentShader).toMatch(/texture2D\( aoMap, vAoMapUv \)\.g/);
    expect(shader.fragmentShader).not.toMatch(/texture2D\( aoMap, vAoMapUv \)\.r/);
    expect(shader.fragmentShader).toMatch(/ghMask\.r \/ 0\.3330/);
    expect(shader.fragmentShader).toMatch(/uGhBreakN/);
    expect(shader.uniforms.uGhBreak.value).toBe(maps.breakup);
    // (the mask alone, the lowest detail's: no sheets in the shader)
    const bare = compiled(paintMaterial({ combine: map() }, GAME_HULLS.venator));
    expect(bare.fragmentShader).toMatch(/ghMask/);
    expect(bare.fragmentShader).not.toMatch(/ghBn/);
  });

  it('puts the Venator’s five parts in its stand-in’s place, through the cut’s turned nose, at a computer’s LOD and the mask’s sizes', async () => {
    const root = new THREE.Group();
    const nose = new THREE.Group();
    nose.name = 'nose';
    nose.rotation.y = Math.PI;
    const standIn = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ name: 'M_VenatorStarDestroyer_Hull_01_lods' }));
    const red = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ name: 'red' }));
    nose.add(standIn, red);
    root.add(nose);
    const urls = [];
    const asked = [];
    // (each part a single triangle, its first corner at its own origin in metres)
    const part = () => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), 3));
      g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]), 3));
      g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(6), 2));
      g.setAttribute('uv1', new THREE.BufferAttribute(new Float32Array(6), 2));
      return { geometry: g, matrix: new THREE.Matrix4() };
    };
    const ok = await dressGameHull(root, 'venator', { detail: 'high', loadMesh: async (url) => (urls.push(url.split('/').pop()), part()), loadTexture: async (path, size) => (asked.push([path.split('/').pop(), size]), map()) });
    expect(ok).toBe(true);
    expect(urls).toHaveLength(5);
    expect(urls.every((u) => u.endsWith('.lod1.glb'))).toBe(true);
    expect(asked).toContainEqual(['t_venatorstardestroyer_hull_01_combine_rgba', 1024]);
    expect(asked).toContainEqual(['t_venatorstardestroyer_paneltile_02_n', 1024]);
    expect(standIn.material.userData.gameHull).toBe(true);
    expect(red.material.name).toBe('red');
    const pos = standIn.geometry.getAttribute('position');
    expect(pos.count).toBe(15);
    // (the left tower's origin: in the kit's frame (-28.71, 194.968, 222.196), the nose's half turn on it in the root's, the stand-in's frame the nose's)
    const left = new THREE.Vector3().fromBufferAttribute(pos, 6);
    expect(left.x).toBeCloseTo(-28.71, 3);
    expect(left.y).toBeCloseTo(194.968, 3);
    expect(left.z).toBeCloseTo(222.196, 3);
    // (and its next corner, a metre along its own x, turned half round with it: a metre back along the kit's x)
    expect(pos.getX(7)).toBeCloseTo(-29.71, 3);
    // (on a phone, the coarser LOD; one part short, the stand-in as it came)
    const urls2 = [];
    const again = new THREE.Group().add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ name: 'M_VenatorStarDestroyer_Hull_01_lods' })));
    await dressGameHull(again, 'venator', { phone: true, loadMesh: async (url) => (urls2.push(url), url.includes('detailback') ? null : part()), loadTexture: async () => map() });
    expect(urls2.every((u) => u.endsWith('.lod2.glb'))).toBe(true);
    expect(again.children[0].material.userData.gameHull).toBeUndefined();
  });

  it('puts the MC80’s hull and its seven nodules in its stand-in, under its own mask, with the game’s breakup at a quarter of the sheet’s tiling', async () => {
    const m = GAME_HULLS.moncal;
    expect(m.material.test('MC_80_Met')).toBe(true);
    expect(m.material.test('MC_80_light_Met')).toBe(false);
    expect(m.parts).toHaveLength(8);
    const root = new THREE.Group();
    const nose = new THREE.Group();
    nose.name = 'nose';
    nose.rotation.y = Math.PI;
    const standIn = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ name: 'MC_80_Met', map: map() }));
    nose.add(standIn);
    root.add(nose);
    const urls = [];
    const asked = [];
    const ok = await dressGameHull(root, 'moncal', { detail: 'high', loadMesh: async (url) => (urls.push(url.split('/').pop()), packHull()), loadTexture: async (path, size) => (asked.push([path.split('/').pop(), size]), map()) });
    expect(ok).toBe(true);
    expect(urls).toHaveLength(8);
    expect(urls.every((u) => u.endsWith('.lod2.glb'))).toBe(true);
    // (every map at the largest size published, 1,024)
    expect(asked.sort()).toEqual([['mc80_paneltile_breakup_02_rgba', 1024], ['mc80_surfacedetail_02_n', 1024], ['t_mc80_hull_01_combine_rgba', 1024], ['t_starcruisermc80panels_01_ns', 1024]]);
    const shader = compiled(standIn.material);
    expect(shader.fragmentShader).toMatch(/ghMask\.r \/ 0\.3050/);
    // (the panel sheet's z rebuilt from its x and y; the breakup and its relief at a quarter)
    expect(shader.fragmentShader).toMatch(/mapN\.z = sqrt/);
    expect(shader.fragmentShader).toMatch(/texture2D\( uGhBreak, vNormalMapUv \* 0\.2500 \)/);
    expect(shader.fragmentShader).toMatch(/ghBn/);
  });

  it('gives the Arquitens the game’s hull with both its UV sets, the Empire’s and the Republic’s each in its own paint and mask, their sheets shared', async () => {
    const [imperial, republic] = [GAME_HULLS.lightcruiser, GAME_HULLS.jedicruiser];
    // (the war's cut and both kits name the hull alike, the Republic's too)
    for (const name of ['M_ImperialCruiser_PanelTile_01_lods', 'M_ImperialCruiser_PanelTile_01']) {
      expect(imperial.material.test(name)).toBe(true);
      expect(republic.material.test(name)).toBe(true);
    }
    expect(imperial.parts[0].mesh).toMatch(/levels\/sb_fondor\/meshes\/imperialcruiser_hull_01_mesh$/);
    expect(republic.parts[0].mesh).toMatch(/levels\/sb_kamino\/meshes\/jedicruiser_hull_01_mesh$/);
    expect(republic.combine.map).not.toBe(imperial.combine.map);
    expect(republic.paint).not.toBe(imperial.paint);
    expect(republic.tiling.normal).toBe(imperial.tiling.normal);
    expect(republic.breakup.normal).toBe(imperial.breakup.normal);
    // (the breakup at half the sheet's tiling, the game's BreakUpRGBATiling)
    expect(imperial.breakup.tiling).toBe(0.5);
    const root = new THREE.Group();
    const standIn = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ name: 'M_ImperialCruiser_PanelTile_01_lods' }));
    root.add(standIn);
    const urls = [];
    const asked = [];
    expect(await dressGameHull(root, 'lightcruiser', { detail: 'high', loadMesh: async (url) => (urls.push(url.split('/').pop()), packHull()), loadTexture: async (path, size) => (asked.push([path.split('/').pop(), size]), map()) })).toBe(true);
    expect(urls).toEqual(['imperialcruiser_hull_01_mesh.lod1.glb']);
    // (no finer than the Venator's: a computer at high, 1,024)
    expect(asked).toContainEqual(['t_imperialcruiser_hull_01_combine_rgba', 1024]);
    expect(asked.every(([, size]) => size <= 1024)).toBe(true);
    expect(standIn.material.userData.gameHull).toBe(true);
    expect(standIn.material.color.getHexString()).toBe(new THREE.Color(imperial.paint).getHexString());
  });

  it('lights the MC80’s windows by the game’s map of them: the frame its red, the light its blue, and the cut’s own relief kept', async () => {
    const normal = map();
    const cut = new THREE.MeshStandardMaterial({ name: 'MC_80_light_Met', map: map(), normalMap: normal, emissive: '#ffffff', metalness: 1 });
    const windows = new THREE.Mesh(new THREE.BoxGeometry(), cut);
    const hull = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ name: 'MC_80_Met' }));
    const root = new THREE.Group().add(windows, hull);
    const asked = [];
    expect(await dressGameMaps(root, 'moncal', { loadTexture: async (path, size, opts) => (asked.push([path.split('/').pop(), size, opts.repeat]), map()) })).toBe(true);
    expect(asked).toEqual([['t_mc80_windows_01_rgba', 1024, true]]);
    const m = windows.material;
    expect(m.userData.gameHull).toBe(true);
    expect(m.map).toBeNull();
    expect(m.emissiveMap).toBeTruthy();
    expect(m.normalMap).toBe(normal);
    expect(m.metalness).toBe(0);
    // (warm, as capitalLook.js lights its panes)
    expect(m.emissive.r).toBeGreaterThan(m.emissive.b);
    const shader = compiled(m);
    expect(shader.fragmentShader).toMatch(/totalEmissiveRadiance \*= emissiveColor\.b;/);
    expect(shader.fragmentShader).toMatch(/diffuseColor\.rgb \*= emissiveColor\.r;/);
    expect(shader.fragmentShader).not.toMatch(/emissiveColor\.rgb;/);
    expect(hull.material.userData.gameHull).toBeUndefined();
    // (on a phone, half; the lowest detail and a failed load leave the cut's for capitalLook.js's panes)
    const phone = [];
    await dressGameMaps(new THREE.Group().add(new THREE.Mesh(new THREE.BoxGeometry(), cut)), 'moncal', { phone: true, loadTexture: async (path, size) => (phone.push(size), map()) });
    expect(phone).toEqual([512]);
    const kept = new THREE.Mesh(new THREE.BoxGeometry(), cut);
    expect(await dressGameMaps(new THREE.Group().add(kept), 'moncal', { detail: 'low', loadTexture: async () => map() })).toBe(false);
    expect(await dressGameMaps(new THREE.Group().add(kept), 'moncal', { loadTexture: async () => null })).toBe(false);
    expect(kept.material).toBe(cut);
  });

  it('turns glTF’s green for a hull lit through three’s own frame (the pack’s hulls carry no tangents), and back for one whose parts carry them', async () => {
    // (and its relief calmed to RELIEF: a lit deck a calm plane, as the game's frames show it)
    expect(hullMaterial(sheets(), GAME_HULLS.destroyer).normalScale.toArray()).toEqual([RELIEF, -RELIEF]);
    expect(paintMaterial({ combine: map(), tilingNormal: map(), breakup: map(), breakupNormal: map() }, GAME_HULLS.venator).normalScale.toArray()).toEqual([RELIEF, -RELIEF]);
    expect(RELIEF).toBeLessThan(1);
    const { root, hull } = ship();
    const tangents = () => {
      const p = packHull();
      p.geometry.setAttribute('tangent', new THREE.BufferAttribute(new Float32Array([1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1]), 4));
      return p;
    };
    await dressGameHull(root, 'destroyer', { detail: 'high', loadMesh: async () => tangents(), loadTexture: async () => map() });
    expect(hull.material.normalScale.y).toBe(RELIEF);
  });

  it('keeps the parts’ tangents where every part has them, a mirrored part’s handedness turned', () => {
    const g = packHull().geometry;
    g.setAttribute('tangent', new THREE.BufferAttribute(new Float32Array([1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1]), 4));
    const mirrored = inFrame(g, new THREE.Matrix4().makeScale(-1, 1, 1), new THREE.Matrix4());
    expect(mirrored.getAttribute('tangent').getW(0)).toBe(-1);
    const both = joined([inFrame(g, new THREE.Matrix4(), new THREE.Matrix4()), mirrored]);
    expect(both.getAttribute('tangent').count).toBe(6);
    expect(both.getAttribute('tangent').getW(3)).toBe(-1);
    // (one without: none, three's own frame from the UVs)
    expect(joined([g.clone(), packHull().geometry]).getAttribute('tangent')).toBeUndefined();
  });

  it('puts a mirrored part’s triangles back the right way out', () => {
    const g = packHull().geometry;
    const flat = inFrame(g, new THREE.Matrix4(), new THREE.Matrix4());
    const mirrored = inFrame(g, new THREE.Matrix4().makeScale(-1, 1, 1), new THREE.Matrix4());
    const facing = (geo) => {
      const p = geo.getAttribute('position');
      const [a, b, c] = (geo.index ? [0, 1, 2].map((i) => geo.index.getX(i)) : [0, 1, 2]).map((i) => new THREE.Vector3().fromBufferAttribute(p, i));
      return new THREE.Vector3().crossVectors(b.sub(a), c.sub(a)).z;
    };
    // (the triangle faces +z either way: its normal's side, as the normals say)
    expect(facing(flat)).toBeGreaterThan(0);
    expect(facing(mirrored)).toBeGreaterThan(0);
    expect(mirrored.getAttribute('normal').getZ(0)).toBeGreaterThan(0);
  });

  it('gives the Lucrehulk all 25 of its plates, its ring’s six arcs and its mirrored twins, keeping the stand-in’s material for the plating', async () => {
    const l = GAME_HULLS.lucrehulk;
    expect(l.keep).toBe(true);
    expect(l.parts).toHaveLength(25);
    expect(l.parts.filter((p) => /mainhull_03/.test(p.mesh))).toHaveLength(6);
    expect(l.parts.filter((p) => p.place && p.place.determinant() < 0)).toHaveLength(3);
    expect(l.parts[0].own.test('M_LucrehulkClass_DroidBattleShip_ControlBridgeTower_01_lods1')).toBe(true);
    expect(l.parts[0].own.test('M_LucrehulkClass_DroidBattleShip_MainHull_03_detail_lods')).toBe(false);
    const root = new THREE.Group();
    const bare = new THREE.MeshStandardMaterial({ name: 'M_LucrehulkClass_DroidBattleShip_MainHull_01_lods' });
    const standIn = new THREE.Mesh(new THREE.BoxGeometry(), bare);
    root.add(standIn);
    const asked = [];
    const ok = await dressGameHull(root, 'lucrehulk', { loadMesh: async () => packHull(), loadTexture: async (path) => (asked.push(path), map()) });
    expect(ok).toBe(true);
    expect(asked).toEqual([]);
    expect(standIn.material).toBe(bare);
    expect(standIn.geometry.getAttribute('position').count).toBe(25 * 3);
  });
});
