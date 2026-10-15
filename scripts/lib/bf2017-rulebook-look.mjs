// The look, the cameras and the HUD, from the game's records:
//
//   lightingRow → maps/<level>.lighting.json: each weather's visual
//     environment (`VE_*`, a VisualEnvironmentBlueprint of components: sun,
//     sky, fog, tonemap, grading, AO, wind, Enlighten…) and the level's placed
//     lights (`PbrSphereLightEntityData`, `PbrSpotLightEntityData`),
//     volumetrics, light probes and lighting prefabs, from its `*Lighting*`
//     and `Hangar_*_Architecture` layers. The weathers are the `VE_*` the
//     map manifest's `sky` lists under `Levels/Lighting/<World>/<Weather>/`.
//   camerasRow → cameras.json: the soldier's third-person camera
//     (SoldierThirdPersonCameraData, SoldierCameraComponentData), the weapons'
//     zoom levels, and each vehicle's seat cameras (its `<blueprint>_Camera`
//     layer: ThirdPersonCameraTransformerEntityData in seat order,
//     VelocityRedirectCameraTransformerEntityData).
//   uiRow → ui.json: the named widgets' element trees (UIWidgetBlueprint →
//     UIElementLayerEntityData → elements, a widget reference resolved into the
//     widget it names), their string ids, the colour palette, the icons and
//     fonts the web build holds; copyUiAssets copies the in-game icons under
//     public/battlefront/ (the fonts are scripts/bf2017-ui.mjs's).

import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { deref, follow, isSequel, numbersOf, objectsOf, readWebJson, rootOf, shortName, transformOf, webFile } from './bf2017-ebx.mjs';
import { indexOf } from './bf2017-rulebook.mjs';
import { levelName } from './bf2017-rulebook-map.mjs';

const where = (asset, obj, path = '') => `${asset.name}#${obj.$type}${path ? `.${path}` : ''}`;
const v3 = (p) => (p ? [p.x, p.y, p.z] : null);
const r4 = (v) => Math.round(v * 10000) / 10000;
const len = (p) => r4(Math.hypot(p.x, p.y, p.z));

// ── lighting ─────────────────────────────────────────────────────────────

function weatherOf(asset) {
  const c = (type) => objectsOf(asset, type)[0];
  const group = (o) => (o ? { ...Object.fromEntries(numbersOf(o)), _source: where(asset, o) } : undefined);
  const sun = c('OutdoorLightComponentData');
  const sky = c('SkyComponentData');
  const fog = c('FogComponentData');
  const tone = c('TonemapComponentData');
  const cc = c('ColorCorrectionComponentData');
  const ao = c('DynamicAOComponentData');
  const wind = c('WindComponentData');
  const en = c('EnlightenComponentData');
  const w = {};
  if (sun) w.sun = { colour: v3(sun.SunColor), angularRadius: sun.SunAngularRadius, _source: where(asset, sun), raw: group(sun) };
  if (sky) w.sky = { rayleigh: v3(sky.RayleighScatteringCoefficient), cloudColours: [v3(sky.CloudLayer1Color), v3(sky.CloudLayer2Color)], light1: v3(sky.Light1Color), light2: v3(sky.Light2Color), _source: where(asset, sky), raw: group(sky) };
  if (fog) w.fog = { curve: [fog.Curve.x, fog.Curve.y, fog.Curve.z, fog.Curve.w], colour: v3(fog.FogColor), _source: where(asset, fog), raw: group(fog) };
  if (tone) {
    w.exposure = { ev: tone.EV, compensation: tone.ExposureCompensation, clampEv: tone.ClampEV, minEv: tone.MinEV, maxEv: tone.MaxEV, _source: where(asset, tone) };
    w.bloom = { scale: tone.BloomScale?.x, gaussians: [1, 2, 3, 4, 5].map((i) => v3(tone[`Gaussian${i}Color`])).filter(Boolean), _source: where(asset, tone), raw: group(tone) };
  }
  if (cc) w.grading = { brightness: v3(cc.Brightness), contrast: v3(cc.Contrast), saturation: v3(cc.Saturation), hue: cc.Hue ?? null, maxHdr: cc.ColorGradingMaxHdrValue, lut: cc.HdrColorGradingLut?.$asset ? shortName(cc.HdrColorGradingLut.$asset) : null, _source: where(asset, cc) };
  if (ao) w.ao = { hbao: { radius: ao.HbaoRadius, angleBias: ao.HbaoAngleBias, attenuation: ao.HbaoAttenuation, contrast: ao.HbaoContrast, powerExponent: ao.HbaoPowerExponent }, _source: where(asset, ao), raw: group(ao) };
  if (wind) w.wind = { strength: wind.WindStrength, _source: where(asset, wind), raw: group(wind) };
  if (en) w.enlighten = { skyColour: v3(en.SkyBoxSkyColor), groundColour: v3(en.SkyBoxGroundColor), terrainColour: v3(en.TerrainColor), _source: where(asset, en), raw: group(en) };
  for (const [type, key] of [['ShadowsComponentData', 'shadows'], ['SunFlareComponentData', 'flare'], ['MotionBlurComponentData', 'motionBlur'], ['SubSurfaceScatteringComponentData', 'sss'], ['CameraParamsComponentData', 'camera']]) {
    const g = group(c(type));
    if (g) w[key] = g;
  }
  return w;
}

// A visual environment as the patch it is: per component, only the fields
// its PropertyOverrides name, at their values (a VE sets those and leaves
// the rest to the VEs under it: findings 22 §1), with the blueprint's own
// Priority and ExplicitPriorityEnable.
const valueOf = (v) => (v && typeof v === 'object' ? (v.$asset ? v.$asset : 'x' in v ? ['x', 'y', 'z', 'w'].filter((k) => k in v).map((k) => r4(v[k])) : null) : typeof v === 'number' ? r4(v) : v);
export function patchOf(asset) {
  const ve = objectsOf(asset, 'VisualEnvironmentEntityData')[0];
  const out = { ve: asset.name, priority: ve?.Priority ?? 0, explicit: ve?.ExplicitPriorityEnable === true, components: {}, _source: ve ? where(asset, ve) : asset.name };
  for (const o of asset.objects) {
    if (!o || !Array.isArray(o.PropertyOverrides) || !/ComponentData$/.test(o.$type)) continue;
    const fields = {};
    for (const f of o.PropertyOverrides) if (f in o && valueOf(o[f]) !== null) fields[f] = valueOf(o[f]);
    if (Object.keys(fields).length) out.components[o.$type.replace(/ComponentData$/, '')] = { ...fields, _source: where(asset, o) };
  }
  return out;
}

// The proximity blends: each AreaProximityEntityData of the lighting layers
// whose Out (0x0b87df4b) drives a VE reference's Visibility (0x65d22203),
// and the shapes its Areas link (0x31fb3b9f) names. The connections sit in
// whatever holds the layers (Hoth's in the LevelData). The runtime's
// visibility is the record's: max(0, 1 − d / ProximityDistance), d the
// view's distance to the nearest shape, 0 inside one (the per-entity update
// FUN_140b75090 and the shape distance FUN_146a198a0 in the live image).
// An area measures from its LocalPlayerId's view: the camera manager's
// transform by player (PTR_PTR_143ef81f8's slot 0x18, FUN_140a7bfe0) walks
// the cameras for one whose player is that id, exactly, and failing one
// (FUN_1465bbea0 returns none) hands back the identity, the world's origin.
// So only LocalPlayerId_0's areas follow the one player the site has:
// LocalPlayerId_1's copies are the split screen's, and the ice caves' areas
// (pf_icecave_01/02, LocalPlayerId_Invalid, 255: no camera's) measure from
// the origin, 1,200 m off, and never bring their VE in; both are left out.
const FOLLOWS = 'LocalPlayerId_0';
const OUT = '0x0b87df4b';
const VISIBILITY = '0x65d22203';
const AREAS = '0x31fb3b9f';
export function areasOf(layers, holders) {
  const byKey = new Map();
  for (const { name, asset } of layers) for (const o of asset.objects) if (o?.$guid) byKey.set(`${name.toLowerCase()}|${o.$guid}`, { o, asset });
  // (an end is an object of a layer, `$asset` and `$class`, or within a prefab its `$ref`)
  const end = (p, holder) => (typeof p?.$ref === 'number' ? (holder.objects[p.$ref] ? { o: holder.objects[p.$ref], asset: holder } : null) : byKey.get(`${String(p?.$asset).toLowerCase()}|${p?.$class}`) ?? null);
  const props = new Map();
  const links = new Map();
  for (const h of holders) {
    for (const o of h.objects) {
      for (const c of o?.PropertyConnections ?? []) {
        if (c.SourceField !== OUT || c.TargetField !== VISIBILITY) continue;
        const s = end(c.Source, h)?.o;
        const t = end(c.Target, h);
        if (s && t) props.set(s, [...(props.get(s) ?? []), t]);
      }
      for (const c of o?.LinkConnections ?? []) {
        if (c.SourceField !== AREAS) continue;
        const s = end(c.Source, h)?.o;
        const t = end(c.Target, h);
        if (s && t) links.set(s, [...(links.get(s) ?? []), t]);
      }
    }
  }
  const uniq = (list) => [...new Set(list)];
  const out = [];
  for (const { name, asset } of layers) {
    asset.objects.forEach((o, i) => {
      if (o?.$type !== 'AreaProximityEntityData' || o.LocalPlayerId !== FOLLOWS) return;
      const ves = uniq(props.get(o) ?? [])
        .filter((t) => t.o.$type === 'VisualEnvironmentReferenceObjectData' && t.o.Blueprint?.$asset)
        .map((t) => ({ ve: t.o.Blueprint.$asset, priority: t.o.Priority ?? 0, _source: where(t.asset, t.o) }));
      const shapes = uniq(links.get(o) ?? [])
        .map(({ o: s, asset: a }) =>
          s.$type === 'OBBData' && s.Transform
            ? { kind: 'box', at: v3(s.Transform.trans).map(r4), basis: [s.Transform.right, s.Transform.up, s.Transform.forward].map((v) => v3(v).map(r4)), half: v3(s.HalfExtents).map(r4), _source: where(a, s) }
            : s.$type === 'SphereData'
              ? { kind: 'sphere', at: v3(s.Position).map(r4), r: s.Radius, _source: where(a, s) }
              : null,
        )
        .filter(Boolean);
      if (ves.length && shapes.length) out.push({ id: `${shortName(name)}:${i}`, proximity: o.ProximityDistance, ves, shapes, _source: where(asset, o) });
    });
  }
  return out;
}

// A prefab's areas in the frame it is placed in (its 3×4 transform)
export function placeAreas(areas, t, id) {
  const [r, u, f, p] = [t.right, t.up, t.forward, t.trans].map(v3);
  const apply = (v) => [0, 1, 2].map((k) => r[k] * v[0] + u[k] * v[1] + f[k] * v[2]);
  return areas.map((a) => ({
    ...a,
    id: `${id}/${a.id}`,
    shapes: a.shapes.map((s) => ({ ...s, at: apply(s.at).map((v, k) => r4(v + p[k])), ...(s.basis ? { basis: s.basis.map((b) => apply(b).map(r4)) } : {}) })),
  }));
}

// A light, in the frame it is placed in.
function lightOf(asset, o, layer, id) {
  const t = transformOf(o);
  const spot = o.$type === 'PbrSpotLightEntityData';
  return {
    id,
    kind: spot ? 'spot' : 'sphere',
    at: t.at.map(r4),
    yaw: r4(t.yaw),
    pitch: r4(Math.asin(Math.max(-1, Math.min(1, o.Transform.forward.y)))),
    colour: (v3(o.Color) ?? [1, 1, 1]).map(r4),
    intensity: o.Intensity,
    // (the record's switches: a light that is off, or lights neither the
    // diffuse nor the specular, is the bounce's only, Enlighten's
    // AffectRadiosity, and the frame never draws it; its Dimmer and
    // ExposureCompensation scale the lumens)
    enabled: o.Enabled !== false,
    affect: { diffuse: o.AffectDiffuse !== false, specular: o.AffectSpecular !== false, radiosity: o.AffectRadiosity !== false },
    dimmer: o.Dimmer ?? 1,
    ec: o.ExposureCompensation ?? 0,
    radius: o.AttenuationRadius,
    ...(spot ? { inner: o.InnerAngle, outer: o.OuterAngle } : {}),
    shadow: { near: o.ShadowNearRadius, far: o.ShadowFarRadius, dimmer: o.ShadowDimmer },
    cull: { screenArea: o.CullScreenArea, fadeArea: o.FadeScreenArea, distance: o.CullDistance },
    layer,
    _source: where(asset, o),
  };
}

// 3×4 transforms: a child's placement inside its parent's frame.
const matOf = (t) => [t.right, t.up, t.forward, t.trans].map(v3);
function compose(parent, child) {
  const [r, u, f, p] = matOf(parent);
  const apply = (v) => [0, 1, 2].map((k) => r[k] * v[0] + u[k] * v[1] + f[k] * v[2]);
  const [cr, cu, cf, cp] = matOf(child);
  const at = apply(cp).map((v, k) => v + p[k]);
  const toV = (a) => ({ x: a[0], y: a[1], z: a[2] });
  return { right: toV(apply(cr)), up: toV(apply(cu)), forward: toV(apply(cf)), trans: toV(at) };
}

// The lights inside a prefab, following nested prefab references, each in
// the prefab's own frame.
function prefabLights(root, name, frame = null, depth = 4, out = []) {
  const asset = follow(root, name);
  if (!asset || depth < 0) return out;
  for (const o of asset.objects) {
    if (!o) continue;
    const t = o.Transform ?? o.BlueprintTransform;
    const placed = frame && t ? compose(frame, t) : t;
    if ((o.$type === 'PbrSphereLightEntityData' || o.$type === 'PbrSpotLightEntityData') && placed?.trans) out.push(lightOf(asset, { ...o, Transform: placed }, shortName(name), `${shortName(name)}:${asset.objects.indexOf(o)}`));
    else if (o.$type === 'SpatialPrefabReferenceObjectData' && o.Blueprint?.$asset) prefabLights(root, o.Blueprint.$asset, placed, depth - 1, out);
  }
  return out;
}

export function lightingRow(root, level) {
  const name = levelName(root, level);
  if (!name) return { level: null, weathers: {}, default: null, lights: [], volumetrics: [], probes: [], prefabs: [], prefabLights: {}, areas: [], patches: {}, _missing: [`level: ${level}`] };
  const dir = name.slice(0, name.lastIndexOf('/') + 1);
  const row = { level: name, weathers: {}, default: null, lights: [], volumetrics: [], probes: [], prefabs: [], prefabLights: {}, _missing: [] };
  const manifest = readWebJson(root, `maps/${name.toLowerCase()}.json`);
  for (const ve of (manifest?.sky ?? []).filter((n) => /^Levels\/Lighting\/(?!Global\/)[^/]+\/[^/]+\/VE_/.test(n))) {
    const asset = follow(root, ve);
    const key = ve.split('/')[3].replace(/_\d+$/, '').toLowerCase();
    if (!asset) row._missing.push(`weather: ${ve}`);
    else row.weathers[key] = { ve, ...weatherOf(asset) };
    row.default ??= asset ? key : null;
  }
  const layers = [...indexOf(root).keys()].filter((n) => n.startsWith(dir) && !n.slice(dir.length).includes('/') && /(Lighting(?!_Schematic)|^Hangar_\d+_Architecture$)/.test(shortName(n)));
  // (the lamp prefabs any of the level's layers place: Hoth's 413 in Default_Lighting and
  // one more, a pf_lightwall_s_01 between the gate hall and the fuel rooms, in Hangar_01_Props_04)
  const lampLayers = [...indexOf(root).entries()].filter(([n, v]) => n.startsWith(dir) && !n.slice(dir.length).includes('/') && v?.type === 'LayerData' && !layers.includes(n)).map(([n]) => n);
  const seen = new Set();
  for (const ln of [...layers, ...lampLayers]) {
    const asset = follow(root, ln);
    if (!asset) continue;
    const lay = shortName(ln);
    const lampsOnly = !layers.includes(ln);
    asset.objects.forEach((o, i) => {
      if (!o) return;
      if (lampsOnly && !(o.$type === 'SpatialPrefabReferenceObjectData' && /\/pf_light/i.test(o.Blueprint?.$asset ?? ''))) return;
      const id = `${lay}:${i}`;
      if (/^(PbrSphereLight|PbrSpotLight|SimpleVolumetrics)EntityData$|^LightProbeVolumeData$|^SpatialPrefabReferenceObjectData$/.test(o.$type) && !transformOf(o)) {
        row._missing.push(`transform: ${id}`);
        return;
      }
      if (o.$type === 'PbrSphereLightEntityData' || o.$type === 'PbrSpotLightEntityData') row.lights.push(lightOf(asset, o, lay, id));
      else if (o.$type === 'SimpleVolumetricsEntityData') {
        const t = transformOf(o);
        row.volumetrics.push({ id, at: t.at.map(r4), yaw: r4(t.yaw), size: [o.Transform.right, o.Transform.up, o.Transform.forward].map(len), emission: v3(o.Emission).map(r4), exponent: o.Exponent, scale: o.EmissionScale ?? null, fade: [o.FadeOutStartRadius, o.FadeOutEndRadius], layer: lay, _source: where(asset, o) });
      } else if (o.$type === 'LightProbeVolumeData') {
        const t = transformOf(o);
        row.probes.push({ id, at: t.at.map(r4), yaw: r4(t.yaw), size: [o.Transform.right, o.Transform.up, o.Transform.forward].map(len), res: [o.Xres, o.Yres, o.Zres], blend: o.BlendDistance, priority: o.Priority, layer: lay, _source: where(asset, o) });
      } else if (o.$type === 'SpatialPrefabReferenceObjectData' && /\/pf_light/i.test(o.Blueprint?.$asset ?? '')) {
        const t = transformOf(o);
        const bp = o.Blueprint.$asset;
        // (the whole turn, not the yaw alone: 120 of Hoth's 416 lamps are tilted on their walls and ceilings)
        const m = o.BlueprintTransform ?? o.Transform;
        row.prefabs.push({ id, name: shortName(bp), at: t.at.map(r4), yaw: r4(t.yaw), basis: [m.right, m.up, m.forward].map((v) => v3(v).map(r4)), layer: lay, _source: where(asset, o) });
        if (!seen.has(bp)) {
          seen.add(bp);
          row.prefabLights[shortName(bp)] = prefabLights(root, bp);
        }
      }
    });
  }
  // (the interiors' VEs, blended in by the view's place: their areas and patches)
  const index = indexOf(root);
  const loaded = layers.map((n) => ({ name: n, asset: follow(root, n) })).filter((l) => l.asset);
  const holders = [name, ...[...index.keys()].filter((n) => n.startsWith(dir) && !n.slice(dir.length).includes('/') && /^(SubWorldData|LevelData)$/.test(index.get(n)?.type ?? ''))].map((n) => follow(root, n)).filter(Boolean);
  row.areas = areasOf(loaded, [...holders, ...loaded.map((l) => l.asset)]);
  // (and those inside the prefabs the layers place: Hoth's two ice caves, pf_icecave_01/02, each its own interior VE)
  for (const { name: ln, asset } of loaded) {
    asset.objects.forEach((o, i) => {
      if (o?.$type !== 'SpatialPrefabReferenceObjectData' || /\/pf_light/i.test(o.Blueprint?.$asset ?? '')) return;
      const bp = follow(root, o.Blueprint);
      if (!bp?.objects.some((x) => x?.$type === 'AreaProximityEntityData')) return;
      const t = o.BlueprintTransform ?? o.Transform;
      row.areas.push(...placeAreas(areasOf([{ name: bp.name, asset: bp }], [bp]), t, `${shortName(ln)}:${i}`));
    });
  }
  row.patches = {};
  for (const a of row.areas) {
    for (const { ve } of a.ves) {
      if (row.patches[ve]) continue;
      const asset = follow(root, ve);
      if (asset) row.patches[ve] = patchOf(asset);
      else row._missing.push(`patch: ${ve}`);
    }
  }
  return row;
}

// ── cameras ──────────────────────────────────────────────────────────────

export function camerasRow(root, { soldier = 'Gameplay/Characters/StormTrooperShared', weapons = [], vehicles = [] } = {}) {
  const row = { soldier: null, aim: {}, vehicles: {}, _missing: [] };
  const bp = follow(root, soldier);
  const tp = bp && objectsOf(bp, 'SoldierThirdPersonCameraData')[0];
  const cc = bp && objectsOf(bp, 'SoldierCameraComponentData')[0];
  if (tp && cc) {
    row.soldier = {
      arm: cc.ThirdPersonCameraArmLength,
      arm_source: where(bp, cc, 'ThirdPersonCameraArmLength'),
      maxPitch: tp.MaxPitch,
      maxPitch_source: where(bp, tp, 'MaxPitch'),
      reducedArm: { length: tp.MaxReducedArmLength, minPitch: tp.ReduceMinPitch, maxPitch: tp.ReduceMaxPitch, _source: where(bp, tp) },
      collision: { padding: tp.CollisionWidthPadding, blendIn: tp.CollisionBlendIn, blendOut: tp.CollisionBlendOut, _source: where(bp, tp) },
      cull: { stand: cc.StandCameraCullYDistance, crouch: cc.CrouchCameraCullYDistance, prone: cc.ProneCameraCullYDistance, dead: cc.DeadCameraCullYDistance, _source: where(bp, cc) },
      listener: { radius: tp.SoundListenerRadius, fov: tp.SoundListenerFov, _source: where(bp, tp) },
      shake: tp.ShakeFactor,
      shake_source: where(bp, tp, 'ShakeFactor'),
    };
  } else row._missing.push(`soldier camera: ${soldier}`);
  for (const w of weapons) if (w?.zoom?.length) row.aim[w.id] = w.zoom;
  for (const v of vehicles) {
    const cam = follow(root, `${v}_Camera`);
    if (!cam) {
      row._missing.push(`vehicle camera: ${v}_Camera`);
      continue;
    }
    row.vehicles[shortName(v).toLowerCase()] = {
      seats: objectsOf(cam, 'ThirdPersonCameraTransformerEntityData').map((t) => ({
        pitch: [t.PitchMinAngle, t.PitchMaxAngle],
        yaw: [t.YawMinAngle, t.YawMaxAngle],
        inertia: { input: t.PitchAccInertia?.InputInertia, none: t.PitchAccInertia?.NoInputInertia },
        _source: where(cam, t),
      })),
      redirect: objectsOf(cam, 'VelocityRedirectCameraTransformerEntityData').map((r) => (r.RedirectData ?? []).map((d, i) => ({ inertia: d.Inertia, rate: d.ConversionRate, _source: where(cam, r, `RedirectData.${i}`) }))),
    };
  }
  return row;
}

// ── the HUD ──────────────────────────────────────────────────────────────

export const ELEMENT_TYPES = { TextElementData: 'text', RectangleElementData: 'rectangle', VectorShapeElementData: 'vectorShape', FillElementData: 'fill', BitmapElementData: 'bitmap', UIElementWidgetReferenceEntityData: 'widget', StackingContainerData: 'stack', ScanlineRegularPolygonElementData: 'polygon' };
export const typeOf = (t) => ELEMENT_TYPES[t] ?? (/Container/.test(t) ? 'container' : t.replace(/(Element)?(Entity)?Data$/, '').replace(/^./, (c) => c.toLowerCase()));
const hex = (n) => (n >>> 0).toString(16).toUpperCase().padStart(8, '0');
const xy = (p, a = 'X', b = 'Y') => (p ? [p[a], p[b]] : null);

function elementOf(root, asset, o, depth, missing) {
  // (a node's numbers are covered by its widget's `_source`; a widget
  // reference names the record its subtree comes from)
  const node = { type: typeOf(o.$type), name: o.InstanceName || undefined, anchor: xy(o.Anchor), size: xy(o.Size, 'x', 'y'), offset: xy(o.Offset), position: xy(o.Position), colour: v3(o.Color), alpha: o.Alpha ?? 1 };
  if (typeof o.PaletteIndex === 'number') node.palette = o.PaletteIndex;
  if (o.$type === 'TextElementData') Object.assign(node, { stringHash: o.StaticStringIdHash ? hex(o.StaticStringIdHash) : null, font: o.FontStyle?.$asset ? shortName(o.FontStyle.$asset) : null, minSize: o.MinimumFontSize, align: [o.HorizontalAlignment, o.VerticalAlignment].map((s) => String(s ?? '').replace(/^UIText(Horizontal|Vertical)Alignment_/, '').toLowerCase()) });
  if (o.$type === 'UIElementWidgetReferenceEntityData' && o.Blueprint?.$asset) {
    node.widget = shortName(o.Blueprint.$asset);
    node._source = `${o.Blueprint.$asset}#UIWidgetBlueprint`;
    if (depth > 0) {
      const sub = widgetOf(root, o.Blueprint.$asset, depth - 1, missing);
      if (sub) node.children = sub.children;
    }
  }
  if (Array.isArray(o.Elements)) node.children = o.Elements.map((r) => deref(asset, r)).filter(Boolean).map((e) => elementOf(root, asset, e, depth, missing));
  return node;
}

function widgetOf(root, name, depth, missing) {
  const asset = follow(root, name);
  if (!asset) {
    missing.push(`widget: ${name}`);
    return null;
  }
  const children = objectsOf(asset, 'UIElementLayerEntityData').flatMap((l) => (l.Elements ?? []).map((r) => deref(asset, r)).filter(Boolean).map((e) => elementOf(root, asset, e, depth, missing)));
  const texts = [...new Set(objectsOf(asset, 'CheckedLocalizedStringEntityData').map((s) => s.Sid).filter(Boolean))];
  return { asset: name, children, texts, _source: `${name}#UIWidgetBlueprint` };
}

// The icons the game draws in play (class, hero, weapon, objective, pickup…).
const IN_GAME = /^UI\/(SVG\/(Classes|HUD|Factions|InGame|Weapons|WeaponMods|Pickups|StationaryWeapons|Speeders|Reticle|Gadgets|Customize\/Heroes)\/|SVG\/Shared\/battle_points\.svg$|Art\/HUD\/)/;
export const HUD_FONTS = ['LinotypeUnivers-520CnMedium', 'LinotypeUnivers-620CnBold', 'RaxusPrimeNumericalMonospace_Regular', 'RaxusPrimeNumericalMonospace_Bold'];

export function uiRow(root, widgetNames, { files = [], depth = 3 } = {}) {
  const missing = [];
  const widgets = {};
  for (const n of widgetNames) {
    const w = widgetOf(root, n, depth, missing);
    if (w) widgets[shortName(n)] = w;
  }
  const svgs = files.filter((f) => f.startsWith('svg/') && f.endsWith('.svg')).map((f) => f.slice(4)).filter((f) => !isSequel(f));
  const icons = Object.fromEntries(svgs.map((p) => [p.replace(/\.svg$/, '').split('/').slice(-2).join('/'), p]));
  const fonts = files
    .filter((f) => f.startsWith('fonts/') && /\.(ttf|otf)$/i.test(f))
    .map((f) => {
      const file = f.split('/').pop();
      const [family, style = 'Regular'] = file.replace(/\.(ttf|otf)$/i, '').split(/[-_](?=[^-_]*$)/);
      return { file: f.slice(6), family, style, hud: HUD_FONTS.includes(file.replace(/\.(ttf|otf)$/i, '')) };
    });
  const pal = follow(root, 'UI/Styles/Colors/UIColorPalette');
  const p = pal && rootOf(pal);
  return {
    widgets,
    palette: (p?.Colors?.[0]?.Colors ?? []).map(v3),
    palette_source: p ? where(pal, p, 'Colors.0.Colors') : undefined,
    icons,
    inGame: svgs.filter((s) => IN_GAME.test(s)),
    fonts,
    _missing: missing,
  };
}

// The in-game icons the web build has, under `out` (the fonts are
// scripts/bf2017-ui.mjs's).
export function copyUiAssets(root, out, ui) {
  const copied = { icons: 0, fonts: 0, missing: [] };
  const copy = (rel, to) => {
    const from = webFile(root, rel);
    if (!from) return copied.missing.push(rel) && false;
    mkdirSync(dirname(to), { recursive: true });
    copyFileSync(from, to);
    return true;
  };
  for (const s of ui.inGame) if (copy(`svg/${s}`, join(out, 'icons', s))) copied.icons++;
  // (the HUD's faces ship once, with every other face of the game's, under
  // public/fonts/bf2017/: scripts/bf2017-ui.mjs fonts, src/lib/bf2017/fonts.css)
  return copied;
}
