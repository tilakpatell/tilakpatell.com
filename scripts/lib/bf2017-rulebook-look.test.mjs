import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isSequel } from './bf2017-ebx.mjs';
import { areasOf, camerasRow, copyUiAssets, lightingRow, patchOf, placeAreas, uiRow } from './bf2017-rulebook-look.mjs';
import { checkSources } from './bf2017-rulebook.mjs';

const ROOT = join(import.meta.dirname, '..', 'fixtures', 'bf2017', 'data');
const FILES = readFileSync(join(ROOT, 'web', 'files.txt'), 'utf8').split('\n').filter(Boolean);

describe('the lighting row', () => {
  const l = lightingRow(ROOT, 'hoth_01');

  it('reads the sunny weather from its visual environment', () => {
    expect(l.default).toBe('sunny');
    const w = l.weathers.sunny;
    expect(w.sun.colour[0]).toBeCloseTo(1, 4);
    expect(w.sun.colour[1]).toBeCloseTo(0.9559, 4);
    expect(w.sun.colour[2]).toBeCloseTo(0.9176, 4);
    expect(w.exposure.ev).toBe(10);
    expect(w.bloom.scale).toBeCloseTo(0.1, 6);
    expect(w.bloom.gaussians).toHaveLength(5);
    expect(w.ao.hbao.radius).toBe(1.5);
    expect(w.wind.strength).toBe(5);
    [2.2311, -4.5655, 2.9244, -0.0088].forEach((v, i) => expect(w.fog.curve[i]).toBeCloseTo(v, 4));
    expect(w.grading.lut).toBe('T_CC_Hoth_Sunny_01');
  });

  it('reads the placed lights, volumetrics and probes', () => {
    expect(l.lights).toHaveLength(5);
    expect(l.lights[0]).toMatchObject({ kind: 'sphere', intensity: 55000, radius: 30 });
    [22.26, 34.9, 48.0].forEach((v, i) => expect(l.lights[0].colour[i]).toBeCloseTo(v, 2));
    expect(l.lights.find((x) => x.kind === 'spot')).toMatchObject({ inner: 70, outer: 90 });
    expect(l.volumetrics[0].exponent).toBe(2);
    expect(l.probes[0].res).toEqual([5, 5, 5]);
  });

  it('reads the lighting prefabs and the lights inside them', () => {
    expect(l.prefabs).toHaveLength(2);
    const name = l.prefabs[0].name;
    expect(l.prefabLights[name].length).toBeGreaterThan(0);
    expect(l.prefabLights[name][0].intensity).toBeGreaterThan(0);
  });

  it('names every number’s source', () => {
    expect(checkSources(l)).toEqual([]);
  });
});

describe('the cameras row', () => {
  const c = camerasRow(ROOT, { soldier: 'Gameplay/Characters/StormTrooperShared', weapons: [{ id: 'a280c', zoom: [{ fov: 55, zoomIn: 1, zoomOut: 1, _source: 'Gameplay/W#WeaponZoomLevelData.RenderFov' }] }], vehicles: ['Gameplay/Vehicles/Ground/AT-AT_MP/Vehicle_Ground_AT-AT_MP'] });

  it('reads the soldier’s third-person camera', () => {
    expect(c.soldier).toMatchObject({ arm: 1.2, maxPitch: 55, reducedArm: { length: 0.5, minPitch: 5, maxPitch: 70 } });
    expect(c.soldier.cull).toMatchObject({ stand: 1.8, crouch: 1.5, prone: 0.32, dead: 0.2 });
    expect(c.aim.a280c[0].fov).toBe(55);
  });

  it('reads a vehicle’s seat cameras', () => {
    const v = c.vehicles['vehicle_ground_at-at_mp'];
    expect(v.seats[0].pitch).toEqual([-35, 24]);
    expect(v.seats[0].inertia).toEqual({ input: 0.8, none: 0.5 });
    expect(v.seats).toHaveLength(3);
    expect(v.redirect[0][0]).toMatchObject({ rate: 6 });
    expect(checkSources(c)).toEqual([]);
  });
});

describe('the UI row', () => {
  const u = uiRow(ROOT, ['UI/InGame/Hud/Weapons/Widgets/WeaponHeat/WeaponHeatBar', 'UI/Customize/Screens/SpawnOverlayScreen'], { files: FILES });

  it('flattens a widget into its element tree, through its widget references', () => {
    const bar = u.widgets.WeaponHeatBar;
    const all = [];
    const walk = (n) => (all.push(n), (n.children ?? []).forEach(walk));
    bar.children.forEach(walk);
    expect(all.some((n) => ['text', 'vectorShape', 'rectangle', 'fill'].includes(n.type))).toBe(true);
    expect(all.some((n) => n.widget === 'WeaponHeatProgress')).toBe(true);
  });

  it('lists the deploy screen’s strings', () => {
    expect(u.widgets.SpawnOverlayScreen.texts.length).toBeGreaterThan(0);
    expect(u.widgets.SpawnOverlayScreen.texts[0]).toMatch(/^ID_/);
  });

  it('lists the icons, sequel refused, and every font', () => {
    expect(Object.keys(u.icons).length).toBeGreaterThan(10);
    expect(Object.values(u.icons).some((p) => isSequel(p))).toBe(false);
    expect(u.fonts).toHaveLength(23);
    expect(u.palette.length).toBeGreaterThan(10);
    expect(checkSources(u)).toEqual([]);
  });

  it('copies the icons it has and the HUD fonts it has', () => {
    const out = mkdtempSync(join(tmpdir(), 'bf2017-ui-'));
    const copied = copyUiAssets(ROOT, out, u);
    expect(copied.icons).toBe(2);
    expect(existsSync(join(out, 'icons', 'UI/SVG/Classes/Class_Troopers_Assault_01.svg'))).toBe(true);
  });
});

describe('the interiors’ proximity blends', () => {
  // (Hoth's wiring cut down: the layer's area and VE reference, the level's connections, a box in another layer)
  const T = (at) => ({ right: { x: 1, y: 0, z: 0 }, up: { x: 0, y: 1, z: 0 }, forward: { x: 0, y: 0, z: 1 }, trans: at });
  const lighting = { name: 'Levels/MP/Hoth_01/Lighting', objects: [{ $type: 'LayerData' }, { $type: 'AreaProximityEntityData', $guid: 'a', ProximityDistance: 20, LocalPlayerId: 'LocalPlayerId_0' }, { $type: 'VisualEnvironmentReferenceObjectData', $guid: 'v', Priority: 0, Blueprint: { $asset: 'Levels/Lighting/Hoth/Interior_01/VE_PV_Hoth_Interior_01' } }, { $type: 'AreaProximityEntityData', $guid: 'b', ProximityDistance: 20, LocalPlayerId: 'LocalPlayerId_1' }] };
  const shapes = { name: 'Levels/MP/Hoth_01/Default_Lighting', objects: [{ $type: 'OBBData', $guid: 'o', Transform: T({ x: 217.6719, y: 374.9233, z: -1770.4879 }), HalfExtents: { x: 58.8856, y: 15.9026, z: 97.0492 } }] };
  const at = (asset, guid) => ({ $asset: asset.name, $class: guid });
  const level = { name: 'Levels/MP/Hoth_01/Hoth_01', objects: [{ $type: 'LevelData', PropertyConnections: [{ Source: at(lighting, 'a'), Target: at(lighting, 'v'), SourceField: '0x0b87df4b', TargetField: '0x65d22203' }], LinkConnections: [{ Source: at(lighting, 'a'), Target: at(shapes, 'o'), SourceField: '0x31fb3b9f', TargetField: '0x00000000' }, { Source: at(lighting, 'b'), Target: at(shapes, 'o'), SourceField: '0x31fb3b9f', TargetField: '0x00000000' }] }] };

  it('reads the VE an area drives and the boxes it measures from, the split screen’s left out', () => {
    const areas = areasOf([{ name: lighting.name, asset: lighting }, { name: shapes.name, asset: shapes }], [level]);
    expect(areas).toHaveLength(1);
    expect(areas[0]).toMatchObject({ proximity: 20, ves: [{ ve: 'Levels/Lighting/Hoth/Interior_01/VE_PV_Hoth_Interior_01', priority: 0 }] });
    expect(areas[0].shapes[0]).toMatchObject({ kind: 'box', at: [217.6719, 374.9233, -1770.4879], half: [58.8856, 15.9026, 97.0492] });
  });

  it('places a prefab’s areas by its transform, the $ref ends resolved inside it', () => {
    const pf = { name: 'levels/mp/hoth_01/prefabs/pf_icecave_02', objects: [{ $type: 'SpatialPrefabBlueprint', PropertyConnections: [{ Source: { $ref: 1 }, Target: { $ref: 2 }, SourceField: '0x0b87df4b', TargetField: '0x65d22203' }], LinkConnections: [{ Source: { $ref: 1 }, Target: { $ref: 3 }, SourceField: '0x31fb3b9f' }] }, { $type: 'AreaProximityEntityData', ProximityDistance: 3, LocalPlayerId: 'LocalPlayerId_Invalid' }, { $type: 'VisualEnvironmentReferenceObjectData', Priority: 0, Blueprint: { $asset: 'Levels/Lighting/Hoth/Interior_01/VE_PV_Hoth_Interior_01' } }, { $type: 'OBBData', Transform: T({ x: 1, y: 2, z: 3 }), HalfExtents: { x: 1, y: 1, z: 1 } }] };
    const turned = { right: { x: 0, y: 0, z: -1 }, up: { x: 0, y: 1, z: 0 }, forward: { x: 1, y: 0, z: 0 }, trans: { x: 10, y: 300, z: -1000 } };
    const [a] = placeAreas(areasOf([{ name: pf.name, asset: pf }], [pf]), turned, 'Default_Lighting:377');
    expect(a.proximity).toBe(3);
    expect(a.shapes[0].at).toEqual([13, 302, -1001]);
    expect(a.shapes[0].basis[0]).toEqual([0, 0, -1]);
  });

  it('keeps a VE’s overridden fields only, at their values', () => {
    const ve = { name: 'Lighting/VE/VE_No_Sun', objects: [{ $type: 'VisualEnvironmentEntityData', Priority: 1000, ExplicitPriorityEnable: false }, { $type: 'OutdoorLightComponentData', PropertyOverrides: ['CloudShadowEnable', 'SunColor', 'SunIntensity'], CloudShadowEnable: false, SunColor: { x: 0, y: 0, z: 0 }, SunIntensity: 0.001, SunRotationY: 45 }] };
    const p = patchOf(ve);
    expect(p).toMatchObject({ priority: 1000, explicit: false, components: { OutdoorLight: { CloudShadowEnable: false, SunColor: [0, 0, 0], SunIntensity: 0.001 } } });
    expect(p.components.OutdoorLight.SunRotationY).toBeUndefined();
  });
});
