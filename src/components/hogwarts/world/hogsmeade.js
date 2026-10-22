// Hogsmeade (the design’s §4.9): the only all-wizard village in Britain, at
// the head of the lake’s arm past the station, as an outdoor set the rooms’
// host stands far below the grounds (rooms/host.js: its own sky, light and
// fog while you’re in it). One High Street of a dozen real houses (stone
// below, oak and plaster above, crooked slate roofs and smoking chimneys,
// shop windows full of goods and lit from inside at night, each with its
// sign), the lane to the Hog’s Head, the arch at the station’s end and the
// Shrieking Shack on its hill behind its fence; snow on it all from the
// term’s eighth week whatever the lawn is doing (rules/hogsmeade.js’s
// snowAt). Built in the Map’s own frame round the street’s middle
// (./hogsmeade/layout.js), so the Marauder’s Map’s footprints are where
// you are.
//
//   createHogsmeade(rt, ctx) → Promise<room> (rooms/host.js’s shape): doors into Honeydukes,
//     the Three Broomsticks and the Hog’s Head and the road back; every other front a spot
//     whose line the door says; out to the grounds; poses street, up, honeydukes, broomsticks,
//     hogshead, shack; set({ hour, snow, week }) as the world’s clock and the term move.
//   ctx: the host’s (house, tier, renderer, props: { week, hour, snow }, say)

import * as THREE from 'three';
import { loadCore } from '../../../lib/three/coreNodes';
import { snowAt } from '../rules/hogsmeade';
import { countOf } from '../rooms/kit';
import { SITES, bounds, colliders, doorsOf, floorAt, poses, spawn, spotsOf, walls } from './hogsmeade/layout';
import { TONES, planHouse } from './hogsmeade/plan';
import { createBuckets } from './hogsmeade/buckets';
import { buildHouse } from './hogsmeade/house';
import { buildStreet } from './hogsmeade/street';
import { createVillageMaterials } from './hogsmeade/materials';
import { fasciaAtlas, goodsAtlas, signAtlas } from './hogsmeade/lettering';
import { createSky } from './hogsmeade/sky';
import { createSmoke } from './hogsmeade/smoke';
import { skyAt } from './hogsmeade/light';
import { pinesOf } from './hogsmeade/trees';
import { loadKit } from '../../../lib/three/kitNodes';
import { createKitScatter } from '../../../lib/three/kitScatter';

const SCANS = ['stone', 'adobe', 'wood', 'metal', 'grass', 'rock'];
// (a scan or a font that hasn’t come in time is gone without: the village stands anyway)
const within = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(() => r(null), ms))]).catch(() => null);

export async function createHogsmeade(rt, ctx = {}) {
  const tier = ctx.tier ?? rt?.quality?.tier ?? 'high';
  const renderer = ctx.renderer ?? rt?.gfx?.renderer ?? null;
  const house = ctx.house ?? null;
  const props = ctx.props ?? {};
  const browser = typeof document !== 'undefined';

  // the scans and the lettering’s face, before anything is painted or worn
  const scans = {};
  if (tier !== 'low') {
    const got = await Promise.all(SCANS.map((r) => within(loadCore(r), 8000)));
    SCANS.forEach((r, i) => got[i] && (scans[r] = got[i]));
  }
  if (browser) await within(document.fonts?.load?.('700 72px Cinzel') ?? Promise.resolve(), 3000);
  const signed = [...SITES.filter((s) => s.sign).map((s) => ({ id: s.id, sign: s.sign, paint: (TONES[s.tone] ?? TONES.old).paint })), { id: 'arch', sign: 'Hogsmeade', paint: '#2b3a30' }];
  const atlases = browser ? { signs: signAtlas(signed), fascia: fasciaAtlas(signed), goods: goodsAtlas() } : {};
  const mv = createVillageMaterials({ tier, renderer, scans, atlases });
  const M = mv.mats;

  const group = new THREE.Group();
  group.name = 'room:hogsmeade';
  const bk = createBuckets();
  const tops = [];
  for (const site of SITES) {
    const built = buildHouse(bk, M, site, planHouse(site));
    tops.push(...built.smoke);
  }
  const street = buildStreet(bk, M, { tier });
  const stats = bk.build(group, { shadows: tier !== 'low' });

  const sky = createSky();
  group.add(sky.mesh);
  // (a few puffs on low, from the nearest chimneys only)
  const smoke = createSmoke({ tops: tier === 'low' ? tops.slice(0, 5) : tops, per: tier === 'low' ? 4 : 14 });
  group.add(smoke.mesh);
  // the pines up the valley’s sides: the nature kit’s, as the shore has them
  const kit = loadKit('naturemega', { house });
  const pines = createKitScatter({ kitFor: () => kit, tier, name: 'hogsmeade:pines' });
  pines.set('pines', pinesOf({ count: tier === 'low' ? 60 : 170 }));
  group.add(pines.group);

  // the light: the sun or the moon, the sky’s own, and the fog in the valley
  const key = new THREE.DirectionalLight(0xffffff, 1);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x333333, 1);
  key.target.position.set(0, 0, 0);
  if (tier === 'high' || tier === 'ultra') {
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    const c = key.shadow.camera;
    c.left = -90;
    c.right = 90;
    c.top = 90;
    c.bottom = -90;
    c.near = 1;
    c.far = 420;
    key.shadow.bias = -0.0006;
    key.shadow.normalBias = 0.04;
  }
  group.add(key, key.target, hemi);
  const fog = new THREE.FogExp2(0x1b2236, 0.006);

  const exposureWas = renderer?.toneMappingExposure ?? null;
  const shade = new THREE.Color();
  const sunDir = new THREE.Vector3();
  const halo = new THREE.Color();
  const zenith = new THREE.Color();
  let now = { hour: props.hour ?? 21, snow: props.snow ?? snowAt(props.week ?? 1) };
  const relight = () => {
    const L = skyAt(now.hour, { snow: now.snow });
    sky.set(L);
    key.position.set(...L.key.dir).multiplyScalar(220);
    key.color.setRGB(...L.key.colour, THREE.SRGBColorSpace);
    key.intensity = L.key.intensity;
    hemi.color.setRGB(...L.hemi.sky, THREE.SRGBColorSpace);
    hemi.groundColor.setRGB(...L.hemi.ground, THREE.SRGBColorSpace);
    hemi.intensity = L.hemi.intensity;
    fog.color.setRGB(...L.fog.colour, THREE.SRGBColorSpace);
    fog.density = L.fog.density;
    mv.set({ snow: now.snow, windows: L.windows, lamps: L.lamps });
    smoke.set({ colour: L.smoke });
    // (the house look measures shade by this light and takes its fog from this sky)
    house?.light?.({ sun: key, hemi });
    house?.sky?.({ low: fog.color, high: zenith.setRGB(...L.zenith, THREE.SRGBColorSpace), sunDir: sunDir.set(...L.sun.dir), halo: halo.setRGB(...L.glow, THREE.SRGBColorSpace).multiplyScalar(L.dusk * 0.5) });
    house?.set?.({ shadow: shade.setRGB(...L.hemi.sky, THREE.SRGBColorSpace).lerp(fog.color, 0.35).multiplyScalar(0.9) });
    if (renderer) renderer.toneMappingExposure = L.exposure;
    return L;
  };
  relight();

  const spots = spotsOf();
  const lines = new Map(spots.map((s) => [s.id, s.line]));
  let gone = false;
  const room = {
    id: 'hogsmeade',
    name: 'Hogsmeade',
    group,
    fog,
    spawn,
    // (the walk goes round every house, lamp and pier, and stays inside the street’s yards)
    colliders: [...colliders(), ...walls()],
    bounds,
    floorAt,
    doors: doorsOf(),
    spots: spots.map((s) => ({ id: s.id, at: s.at, r: s.r, faces: s.faces, verb: s.verb, label: s.label })),
    use(id) {
      const line = lines.get(id);
      if (line) ctx.say?.(line);
    },
    out: { to: 'out' },
    places: Object.fromEntries(SITES.map((s) => [s.id, { at: s.door, faces: s.yaw }])),
    poses,
    lamps: street.lamps,
    step(dt, c = {}) {
      if (gone) return;
      smoke.step(dt, c.camera ?? null);
      if (c.camera) pines.update(c.camera, dt);
    },
    set(p = {}) {
      if (p.hour != null) now = { ...now, hour: p.hour };
      if (p.snow != null) now = { ...now, snow: p.snow };
      else if (p.week != null) now = { ...now, snow: snowAt(p.week) };
      relight();
    },
    info: () => ({ ...countOf(group), merged: stats, houses: SITES.length, lamps: street.lamps.length, puffs: smoke.mesh.count, hour: now.hour, snow: now.snow, scans: Object.keys(scans).length }),
    dispose() {
      gone = true;
      if (renderer && exposureWas != null) renderer.toneMappingExposure = exposureWas;
      bk.dispose();
      mv.dispose();
      sky.dispose();
      smoke.dispose();
      pines.dispose();
      kit.dispose();
      key.dispose?.();
      key.shadow?.map?.dispose?.();
      group.removeFromParent();
    },
  };
  return room;
}
