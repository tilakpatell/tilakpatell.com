// On foot, drawn and run: the ship comes down on a planet, its crew step out
// (Rick and Morty, Walt and Jesse, Chewie and Han, Luke and Artoo), and you
// walk them about on the ground, shoot it out with the Federation's squads
// that come over the horizon, and get back in and take off again. foot.js
// has the rules; this has the people, the ground under them and the camera
// behind them, all in the map's space.
//
// The people: Rick, Morty and the Federation's troops are the Portal panic
// cast (rickmorty/portal/meshyCast.js), with their own clips; Walt, Jesse,
// Chewie, Han and Luke are the site's Meshy figures (Albuquerque's, the
// cockpits', the galaxy's: scripts/meshy-galaxy.mjs), walking and running on
// Rick's clips (one skeleton for every Meshy figure); Artoo, who has no
// figure here, is built from shapes (and anyone whose model won't load). Each
// holds the gun they'd carry (gunplay.js: built in code, set in the hand,
// brought up and aimed with the arms, chest and head, kicking when fired).
//
// The ground: the planets are drawn as spheres with a map, which up close is
// a blur. Round where you are, a patch of ground takes over: the same map,
// with the planet's turn held while you're down, and fine detail over it
// (grit, stones, rocks to walk round), and the air of the planet in its
// colour along the horizon, by day. A station (the Death Star: `plated` in
// universes.js) is hull plating instead, panels and seams and vents and the
// odd lit window, with blocks and towers standing on it for rocks, and no
// air; and where it has a trench round its middle, the ship comes down by
// it (foot.js byTrench), the ground stops at its rim, and its walls go down
// to where the trench run's own (trench.js) take over. Down there the
// station's own model, which has its trench painted on rather than cut
// into it, isn't drawn: the patch reaches past the horizon.
//
// Other pilots' crews down on the same planet (multiplayer: the scene hands
// them in each frame, guests()) walk about with yours, a tag over each with
// who they are and whose crew; and where two of a person meet (your Rick
// and theirs, or two pilots' Walts) the other one is that person from
// another dimension: their dimension's code on the tag (dimensionOf, from
// their pilot) and a tint of its own. crew() is yours, for sending.
//
// Each planet's own ground, sky and things round where you come down are
// its landing's (landings/: the Shire on Middle-earth's, the desert and the
// RV on Breaking Bad's, the Smiths' street on C-137's), and the place's name
// comes up as you land (an 'arrive' event).
//
// The landing's loose things (a barrel, a hay bale, tumbleweed, stones:
// landings/bodies.js) are rigid bodies, but not on a phone or with Data
// Saver on (the engine is 1.7 MB; `small` here is any device short of
// the high tier, which is most laptops, so it isn't what decides): landings/
// physics.js has them, the planet pulling them to its middle; the engine
// loads as the ship comes down (only for a landing with something loose
// on it), and until it's there (or if it won't load) they stand as solid
// as ever. You and your mate and the troops shove what you walk into,
// shots knock what they hit, what's knocked stops at the landing's fixed
// things and the parked ship, and a hard knock is heard where it was, puffs
// dust and nudges the camera (lib/three/impacts.js; a shot's own knock is
// still 'impact').
//
// The leaves: a landing with trees has its fallen leaves round you
// (landings/litter.js, Bruno's: kicked along as you walk through them,
// blown in the gusts, thrown by a bolt into the ground, a jump, the ship
// setting down and lifting off, shaken from a crown a bolt goes through),
// and its crowns move in the same wind (landings/canopy.js), opening round
// you where one's between you and the camera. None of it moves with
// motion turned down.
//
// createFoot({ map, emit, reduced, small, planetOf, renderer, prepare }) → { phase, prefetch(id, kind),
//   prefetchAt(id, { light, near, entry }), begin(...),
//   update(dt, t, input), view(dt) → camera, fire(), cycle(), swap(),
//   board(), look(dx, dy) (px), turn(dx, dy) (radians), first(), aimPoint(), info(), crew(),
//   guests(list), end(), dispose() }

import * as THREE from 'three';
import { gltfLoader } from '../../lib/three/gltf';
import { sharpen } from '../../lib/three/textures';
import { MESHY, createMeshyCast } from '../rickmorty/portal/meshyCast';
import { NO_CALLS, animatorCalls, seedOf } from '../../lib/three/figureCalls';
import { preload } from '../../lib/three/clipLibrary';
import { createAnimator } from '../../lib/three/animator';
import { cutsToLoad, loadWalrusBody, packUrls, richClips, swapBody } from '../../lib/three/walrus';
import { createCutter, cutUrl } from '../../lib/three/walrusCuts';
import { withStance } from '../../lib/three/walrusStance';
import { createAdditiveLayer } from '../../lib/three/additiveLayer';
import { loadOwnRigBody } from '../../lib/three/ownRig';
import { OWN_RIGS } from '../../lib/three/walrusClips';
import { cloneScene, loadGLTF } from '../../lib/three/gltfCache';
import { detailLevel } from '../../lib/detail';
import { breathe, createGait, sway } from '../../lib/three/gait';
import { seeded } from '../../lib/seeded';
import { createBolts } from '../../lib/combat/bolt';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { RICK_HIPS, borrowClips, faceForward, heading as headingOf, retarget } from '../rickmorty/portal/clips';
import { EVERYONE, LOOK_KEY, defaultLook, readLooks, writeLook } from '../rickmorty/wardrobe/looks';
import { bodyAsset, bodyKind, dress, withWardrobe } from '../rickmorty/wardrobe/wear';
import { local } from '../../lib/hooks';
import { smoothNormals } from '../cockpit/crew';
import { GUNS, buildGun, createGunplay } from './gunplay';
import { createGunFx } from './gunfx';
import { fallTurn } from './locomotion';
import { followMove, mateDown, mateHit, mateStand, readWalkerExtras, walkerExtras } from './footLife';
import { applyEmote, createEmoteWheel, heardEmote, keepEmote, readEmote, readEmoteWire } from '../../lib/emote';
import { createPortalFx, meshyJoints } from '../../lib/three/portalFx';
import { createGadgetFx } from '../../lib/three/gadgetFx';
import { frameFrom, spring } from '../../lib/three/ik';
import { createDust } from '../../lib/three/dust';
import { createKnocks } from './landings/knocks';
import { createSquash } from './squash';
import { impactGroups } from '../../lib/impact';
import { pressGroups } from '../../lib/press';
import { springGroups } from '../../lib/spring';
import { SIDES, sideFor, squadKinds } from './sides';
import { ASSIST, friction } from '../../lib/combat/aim';
import { footAim } from './footAim';
import { BOLT, FOOT, METRE, PARKED, TROOPS, aimAt, apart, at, bearing, byTrench, createJump, facingAlong, flat, footBodies, footSolids, inTrench, landingSpot, march, offset, person, rightOf, squad, turnToward, vec, walk } from './foot';
import { TRENCH_MODEL, trenchOf } from './deep';
import { POSITIONS } from './layout';
import { byId } from './universes';
import { landingOf, seedOf as landingSeed } from './landings/landings';
import { fromLatLon, landOn, readableMap, sampleMap, viewOf } from './landings/biomes';
import { styleOf } from './landings/ground';
import { createSky } from './landings/sky';
import { furnish, furnished, prefetch as prefetchLanding, within } from './landings/furnish';
import { LAMPS, createLamps } from './landings/lamps';
import { createLandingPhysics } from './landings/physics';
import { aimCanopy, canopy, lookCanopy, seeCanopy, sunCanopy, tickCanopy, windCanopy } from './landings/canopy';
import { createLitter, leafLevel } from './landings/litter';
import { weatherWind } from '../../lib/three/leafSim';
import { bodyOf } from './landings/bodies';
import { preload as preloadPhysics } from '../../lib/physics/world';
import { device } from '../../lib/device';
import { AIR, ENTRY, entryPath, entrySpot, fxAt } from './entry';
import { createReentry } from './reentry';

const V = THREE.Vector3;
const arr = (v) => [v.x, v.y, v.z];
const smooth = (a, b, x) => {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
};
const ease = (k) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);

// who steps out of each ship: the one you play first, and who comes along
// (tall in metres; src: a Portal panic figure, a model of the site's, or
// one built here; the gun they carry (gunplay.js's GUNS), and the colour of
// its bolts)
export const PARTY = {
  cruiser: [
    { id: 'rick', name: 'Rick', tall: 1.88, src: { meshy: 'rick' }, gun: 'portal', bolt: '#8dff5a' },
    { id: 'morty', name: 'Morty', tall: 1.6, src: { meshy: 'morty' }, gun: 'laser', bolt: '#8dff5a' },
  ],
  rv: [
    { id: 'walt', name: 'Walt', tall: 1.79, src: { url: '/models/albuquerque/walt.glb' }, gun: 'revolver', bolt: '#ffd36b' },
    { id: 'jesse', name: 'Jesse', tall: 1.73, src: { url: '/models/albuquerque/jesse.glb' }, gun: 'pistol', bolt: '#ffd36b' },
  ],
  falcon: [
    { id: 'chewie', name: 'Chewie', tall: 2.28, src: { url: '/models/cockpit/chewie.glb' }, gun: 'bowcaster', bolt: '#ff4a3d' },
    { id: 'han', name: 'Han', tall: 1.85, src: { url: '/models/galaxy/crew/han.glb' }, gun: 'blaster', bolt: '#ff4a3d' },
  ],
  xwing: [
    { id: 'luke', name: 'Luke', tall: 1.72, src: { url: '/models/galaxy/crew/luke.glb' }, gun: 'blaster', bolt: '#ff3b30' },
    { id: 'artoo', name: 'Artoo', tall: 1.09, src: { built: 'artoo' }, gun: null, bolt: null },
  ],
};
const TROOP_BOLT = '#62c8ff';
// Rick's gadgets: B on foot goes round them, the one carrying the portal gun
export const GADGETS = ['portal', 'freeze', 'shrink'];
const GADGET_NAMES = { portal: 'Portal gun', freeze: 'Freeze ray', shrink: 'Shrink ray' };
const SPEC = Object.fromEntries(Object.values(PARTY).flat().map((s) => [s.id, s])); // everyone, by id
const GUEST_FAR = 90; // metres: no tag on someone further off than this

// the dimension a pilot's crew come from: a code of its own, made from the
// pilot's id (the same for everyone who meets them), and a hue to go with it
const GREEK = 'αβγδεζηθκλμξπστφχψω';
export function dimensionOf(id) {
  let h = 2166136261;
  for (const ch of String(id)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  h >>>= 0;
  const code = `${String.fromCharCode(65 + (h % 26))}-${10 + ((h >>> 5) % 290)}${GREEK[(h >>> 14) % GREEK.length]}${(h >>> 19) % 10}`;
  return { code, hue: ((h >>> 9) % 360) / 360 };
}
const LAND = { down: 3.4, out: 1.3, board: 0.8, lift: 2.4, fall: 2.6, ready: 6, party: 2.5 }; // seconds
const CAM = { dist: 3.4, up: 0.55, pitch: [-0.25, 0.75], look: 1.6 }; // metres, radians

// ── Loading the people ──

const getLoader = () => gltfLoader();

// (Rick’s clips, for every Meshy figure without its own, are borrowed as
// the wardrobe’s cast borrows them: rickmorty/portal/clips.js)

// each figure's seed: its name and which of that name it is, so two of a
// kind (a squad's troopers, two pilots' Walts) never breathe or step together
const seeds = new Map(); // name → how many
const seedFor = (name) => {
  const n = seeds.get(name) ?? 0;
  seeds.set(name, n + 1);
  return seedOf(name, n);
};

// a rigged figure: { model (feet on y = 0, facing +z, `tall` metres in map
// units), bones, update(dt, move, motion?), after(dt, motion, frame), loco,
// mixer, act, anim, play, stop, base, look, react, dispose }, on an animator
// of its own (lib/three/animator.js). With `motion` (locomotion.js: how fast
// it's going which way, turning, in the air, hit, going down) its clips are
// paced to the ground and posed on top by `after`, once it's placed;
// without, they play at the old pace (the galaxy's worlds, until they hand
// it over too). play, base, look and react are the animator's
// (lib/three/figureCalls.js's animatorCalls: the clip library's clips, on
// the Meshy skeleton these all stand on). `key`: the figure's template (its file, for
// the library's copies), `seed`: its clocks; `up` (in the space its hips
// turn in) and `hipsY`, for the library's clips made for it.
function rigged(model, clips, tall, owned, { seed = seedFor('rigged'), key = null, up = null, hipsY = null, library = true } = {}) {
  const bones = {};
  model.traverse((o) => {
    if (o.isBone) bones[o.name] = o;
  });
  // how tall it stands, from its skeleton at rest: the top of the head to the toes
  model.updateMatrixWorld(true);
  const y = (n) => bones[n]?.getWorldPosition(new V()).y;
  // (the game's rig ends its head in HeadEnd, Meshy's in head_end)
  const top = y('head_end') ?? y('HeadEnd') ?? y('Head');
  const toes = Math.min(y('LeftToeBase') ?? 0, y('RightToeBase') ?? 0);
  const box = new THREE.Box3().setFromObject(model);
  const height = top != null ? top - toes : box.getSize(new V()).y;
  const k = (tall * METRE) / Math.max(height, 1e-6);
  model.scale.multiplyScalar(k);
  model.position.y -= (top != null ? toes : box.min.y) * k;
  // (the game's additive clips are laid over the pose, never played as one: lib/three/additiveLayer.js)
  const own = Object.fromEntries(Object.entries(clips).filter(([, clip]) => clip && !clip.userData?.additive));
  const adds = Object.fromEntries(Object.entries(clips).filter(([, clip]) => clip?.userData?.additive));
  const anim = createAnimator(model, { clips: own, bones, hipsY, up, unit: METRE, seed, key: key == null ? null : `${key}:${tall}`, library });
  const additive = Object.keys(adds).length ? createAdditiveLayer(model, adds) : null;
  if (additive) anim.post((step) => additive.apply(step));
  const act = Object.fromEntries(['idle', 'walk', 'run'].filter((n) => anim.actions[n]).map((n) => [n, anim.actions[n]]));
  // (library: false, and the calls too play only the figure's own: a 2017
  // figure never takes a library clip, nor reacts with one)
  const calls = animatorCalls(anim, { model, seed, own: Object.keys(own), act, library });
  return {
    model,
    bones,
    loco: anim.loco,
    mixer: anim.mixer,
    act,
    anim,
    update(dt, move, motion) {
      calls.tick(dt, motion ? Math.hypot(motion.speed ?? 0, motion.side ?? 0) > 0.05 * METRE : move > 0.05);
      anim.locomote(motion ? { move, ...motion } : { move });
      anim.update(dt);
    },
    after: (dt, motion, frame) => anim.after(dt, motion, frame),
    play: calls.play,
    stop: calls.stop,
    base: calls.base,
    look: calls.look,
    // (a hit with the side it came in from: the game's additive flinch on top
    // of whatever it's doing, where it has one; else the reaction as ever)
    react: (event, ctx = {}) => (event === 'hit' && ctx.side && additive?.hit(ctx.side, ctx.kind) ? { event, clip: `add.hit.${ctx.side}`, layer: 'additive' } : calls.react(event, ctx)),
    // the chest aimed by pitch and yaw through the game's additive aims (the
    // stance's own, `prefix` 'p.' or 'l.', where it has them); false when it has none
    aimAt: (pitch, yaw = 0, prefix = '') => {
      if (!additive?.has('add.aim.up')) return false;
      additive.aim(pitch, yaw, prefix);
      return true;
    },
    dispose() {
      anim.dispose();
      for (const o of owned) o?.dispose?.();
    },
  };
}

// the wardrobe’s look for the cruiser’s Rick or Morty, the RV’s Walt or
// Jesse (as kept, or as given: a pilot’s from the wire may have one cast’s
// and not the other’s, which are then as the show has them)
const WEARS = new Set(EVERYONE);
const lookFor = (who, looks) => (WEARS.has(who) ? readLooks(looks ?? local.get(LOOK_KEY))[who] : null);
const HAND_GUNS = { portalgun: 'portal', laserpistol: 'laser' }; // the wardrobe's hand gear that's a gun on foot
const SCARED = new Set(['morty', 'jesse']); // the ones who jump at a squad, or at a double of themselves
// (`templates`: a model of the site's as a copy of the one figure of it
// kept there, loadSharedFigure's, rather than fetched and made afresh:
// footScene's own, the map's alone)
async function loadModel(spec, cast, looks = null, { templates = null } = {}) {
  if (spec.src.meshy) {
    const look = lookFor(spec.src.meshy, looks);
    // (the cast's figure reads its motion in metres: it's told how tall it stands)
    const opts = { tall: spec.tall, seed: seedFor(spec.id ?? spec.src.meshy) };
    let c = null;
    if (look) {
      const asset = bodyAsset(look);
      if (asset !== spec.src.meshy) await cast.load(null, [asset]).catch(() => {});
      c = cast.make(bodyKind(look), 0, opts);
    }
    c ??= cast.make(spec.src.meshy, 0, opts);
    if (!c) return null;
    // (on foot they carry a gun of their own, gunplay.js's: the look's
    // portal gun or laser pistol is that gun, held and fired; anything else
    // in the hand stays in the wardrobe)
    const gun = HAND_GUNS[look?.gear?.hand] ?? null;
    const undress = look ? dress(c, spec.gun ? { ...look, gear: { ...look.gear, hand: 'none' } } : look) : () => {};
    // the cast stands c.height tall in its own units: to metres, in map units
    c.group.scale.setScalar((spec.tall * METRE) / c.height);
    const k = c.group.scale.x; // (the cast's units, in the map's)
    const bones = {};
    c.group.traverse((o) => {
      if (o.isBone) bones[o.name] = o;
    });
    // The cast's own animator (one a figure: never a second over its
    // mixer), its motion's speeds in the cast's units and its crouch's drop
    // back in the map's.
    const anim = c.anim ?? null;
    const inCast = (m) => m && { ...m, speed: (m.speed ?? 0) / k, side: (m.side ?? 0) / k };
    return {
      model: c.group,
      bones,
      loco: anim && {
        get drop() {
          return anim.loco.drop * k;
        },
        rig: anim.loco.rig,
        strides: anim.loco.strides,
      },
      mixer: c.mixer ?? null,
      act: c.act ?? null,
      anim,
      update(dt, move, motion) {
        c.update(0, move, 0, { dt, motion: inCast(motion), after: false });
      },
      after: (dt, motion, frame) => c.after(dt, motion, frame),
      play: c.play,
      stop: c.stop,
      base: c.base,
      look: c.look,
      react: c.react,
      gun,
      // (its look off, and what the cast made for this one figure alone: the
      // cast itself lasts the page)
      dispose: () => {
        undress();
        c.release?.();
      },
    };
  }
  if (spec.rig === 'walrus' && spec.src.url) return walrusFigure(spec);
  if (spec.rig === 'own' && spec.src.url) return ownRigFigure(spec);
  if (spec.src.url && templates) return loadSharedFigure(spec.src.url, spec.tall, { seed: seedFor(spec.id ?? spec.src.url), from: templates });
  if (spec.src.url) {
    const [gltf, clips] = await Promise.all([getLoader().loadAsync(spec.src.url), borrowClips()]);
    return rigScene(gltf.scene, clips, spec.tall, { seed: seedFor(spec.id ?? spec.src.url), key: spec.src.url });
  }
  return built(spec);
}

// A figure from Star Wars Battlefront II (2017), on the game's whole
// skeleton and moved by the game's own clips (lib/three/walrus.js: the
// humanoid pack and, for a hero, theirs over it; never the library's, which
// are made for Meshy's rig): the same figure every loader here returns,
// with its sockets (Wep_Root, where its saber or blaster sits) and its clips
// (the saber's strokes come from these). Its materials are the copy's own.
async function walrusFigure(spec) {
  // (its light cut first, then the one lib/detail's level wants, put on the
  // figure as it lands: a hero's full cut is 10 to 45 MB of the game's own
  // maps, and nobody waits that long to see Luke; on a saver connection the
  // light one only; and the full one when the light one isn't there: a
  // figure is never lost for want of a cut)
  // (past its own, the soldiers', the additive layer's and the stances'
  // packs only where the device's level can spend them: walrus.js's richClips)
  const rich = richClips(detailLevel());
  const packs = spec.packs ?? packUrls(spec.pack, { extras: rich });
  // (and the stance of the weapon it takes up: lib/three/walrusStance.js)
  return withStance(await gameFigure(spec, (url) => loadWalrusBody(url, { packs })), { enabled: rich });
}

// A 2017 droid or beast on a skeleton of its own (lib/three/ownRig.js: the
// B1, the B2, the droideka, the Ewok, the astromech, the probe, the
// tauntaun), moved by its rig's pack of the game's clips, with no sockets:
// otherwise as walrusFigure's.
async function ownRigFigure(spec) {
  const fig = await gameFigure(spec, (url) => loadOwnRigBody(url, { rig: spec.ownRig, packs: spec.packs, bones: spec.bones ?? {} }).then((b) => ({ ...b, sockets: null })));
  // (its skeleton's name, for its own set of the game's hit capsules: boltPlay.js)
  return Object.assign(fig, { rig: 'own', skeleton: OWN_RIGS[spec.ownRig]?.skeleton ?? null });
}

// A 2017 figure from its body loader. A hero (three files by the level,
// walrus.js's cutsToLoad): its light cut, then the level's swapped on as it
// lands. A kind at full fidelity (`cuts.full`, phase 2's cast): its light
// cut, then the cut its distance wants, through cutAt (lib/three/
// walrusCuts.js: the full one near, within a page's share of the GPU's
// texture memory, the far one past the level's mid). Either way the cut
// goes onto the same bones (walrus.js's swapBody), so the animator, the
// sockets and the saber keep theirs; its small parts cast no shadow.
async function gameFigure(spec, loadBody) {
  const cuts = spec.cuts?.full ? spec.cuts : null;
  const level = detailLevel();
  const lowData = Boolean(device().saveData);
  const [first, next] = cuts ? [cutUrl(spec.src.url, cuts.lod ? 'lod1' : 'plain'), null] : cutsToLoad(spec.src.url, level, { lowData });
  const { model, clips, sockets } = await loadBody(first).catch((e) => (first === spec.src.url ? Promise.reject(e) : loadBody(spec.src.url)));
  // (each mesh's materials, the copy's own, returned for the figure to free)
  const dress = (root) => {
    const mats = [];
    const meshes = [];
    root.traverse((o) => {
      if (!o.isMesh) return;
      o.frustumCulled = false; // a skinned mesh's bounds don't follow its pose
      mats.push(...[].concat(o.material));
      meshes.push(o);
    });
    // (its small parts, the eyes, the teeth and the hair's cut-out cards,
    // cast no shadow: each part is a draw of its own, twice with one, and a
    // 2017 hero has up to thirteen; the body, the clothes and the cape do.
    // The cast, a crowd of five to nine parts a figure, casts its body's
    // alone: a world of thirty soldiers is otherwise a hundred draws more)
    const trisOf = (o) => (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3;
    const body = cuts ? meshes.reduce((a, b) => (trisOf(b) > trisOf(a) ? b : a), meshes[0]) : null;
    for (const o of meshes) {
      o.userData.noShadow = cuts ? o !== body : trisOf(o) < 1500 || o.material?.alphaTest > 0;
      if (o.isSkinnedMesh) o.castShadow = !o.userData.noShadow;
    }
    return mats;
  };
  const owned = dress(model);
  const hips = model.getObjectByName('Hips');
  const fig = rigged(model, clips, spec.tall, owned, { seed: seedFor(spec.id ?? spec.src.url), key: spec.src.url, library: false });
  let gone = false;
  const own = fig.dispose;
  fig.dispose = () => {
    gone = true;
    own();
  };
  // (a cut onto the figure: the old one's materials freed and forgotten, the new one's kept to free)
  const swap = (gltf) => {
    if (gone || !gltf) return;
    const full = cloneScene(gltf);
    const mats = dress(full);
    const old = swapBody(model, full);
    if (!old.length) return mats.forEach((m) => m.dispose());
    for (const o of old)
      for (const m of [].concat(o.material)) {
        m.dispose();
        const i = owned.indexOf(m);
        if (i >= 0) owned.splice(i, 1);
      }
    owned.push(...mats);
  };
  if (next)
    loadGLTF(next)
      .then(swap)
      .catch(() => {}); // (the light cut stays: it was already a whole figure)
  const cutter = cuts ? createCutter({ url: spec.src.url, cuts, level, lowData, load: (u) => loadGLTF(u), swap }) : null;
  return Object.assign(fig, { rig: 'walrus', sockets, clips, hipsY: hips?.position.y ?? null, cutAt: cutter ? (d) => cutter.at(d) : null });
}

// A loaded Meshy figure (its scene, or a copy of one: `shared`, whose
// geometry and materials are the original's to free) rigged with Rick's
// clips, turned to walk the way it faces; `seed` and `key` as rigged's
function rigScene(model, clips, tall, { shared = false, seed, key = null } = {}) {
  {
    const owned = [];
    model.traverse((o) => {
      if (!o.isMesh) return;
      o.frustumCulled = false; // a skinned mesh's bounds don't follow its pose
      if (shared) return;
      const m = o.material;
      if (m) {
        // Meshy's colours carry their own shading: keep them matte
        m.roughness = 0.85;
        m.metalness = 0;
        owned.push(m, m.map);
      }
      smoothNormals(o.geometry);
      owned.push(o.geometry);
    });
    const hips = model.getObjectByName('Hips');
    const hipsY = hips?.position.y ?? RICK_HIPS;
    const own = { idle: retarget(clips.idle, hipsY), walk: retarget(clips.walk, hipsY), run: retarget(clips.run, hipsY) };
    // (up, in the space the hips turn in: the library's clips are turned about it to face ahead too)
    const up = hips?.parent ? new V(0, 1, 0).applyQuaternion(hips.parent.getWorldQuaternion(new THREE.Quaternion()).invert()) : null;
    if (up && own.walk) {
      const ahead = headingOf(own.walk, up);
      if (ahead != null) for (const n of ['idle', 'run']) if (own[n]) faceForward(own[n], up, ahead);
    }
    // (the hips' height at rest goes with it, for the library's clips scaled to it)
    return Object.assign(rigged(model, own, tall, owned, { seed, key, up, hipsY: hips ? hipsY : null }), { hipsY: hips ? hipsY : null });
  }
}

// One figure per file, the rest copies of it: a battle's dozen troopers
// share one stormtrooper's geometry and maps (and the library's clips made
// for it), as the landings' troops share theirs. The first is rigged to
// keep the materials and smooth the normals; it's never drawn, and stays
// for the next world that wants one. (galaxy/surface/crew.js)
// (`from`: another such set of originals, url → Promise<{ scene, clips } |
// null>: a world whose copies are to take its own look, which goes onto the
// materials they share, keeps its own, as the map does its crews')
const sharedModels = new Map(); // url → Promise<{ scene, clips } | null>
// (the original, fetched and rigged the first time it's asked for)
export const templateIn = (models, url) => {
  if (!models.has(url))
    models.set(
      url,
      Promise.all([getLoader().loadAsync(url), borrowClips()]).then(
        ([gltf, clips]) => {
          rigScene(gltf.scene, clips, 1);
          return { scene: gltf.scene, clips };
        },
        () => {
          models.delete(url); // (a failed fetch is tried again next time)
          return null;
        },
      ),
    );
  return models.get(url);
};
export async function loadSharedFigure(url, tall, { seed, from = sharedModels } = {}) {
  const tpl = await templateIn(from, url);
  return tpl ? rigScene(cloneSkinned(tpl.scene), tpl.clips, tall, { shared: true, seed, key: url }) : null;
}

// Walt and Jesse: the site’s own figures, loaded as anyone’s is (above),
// in the body their look has (Mr. White and Heisenberg are Walt’s one
// figure, Jesse in the lab’s suit his own) and dressed in it. They keep
// their own guns, as the cruiser’s two do: a bag of blue in the hand stays
// in the wardrobe. Anyone else is loaded as they were.
async function loadParty(spec, cast, looks = null, { templates = null } = {}) {
  const look = spec.src.url ? lookFor(spec.id, looks) : null;
  if (!look) return loadModel(spec, cast, looks, { templates });
  const fig = await loadModel({ ...spec, src: { url: bodyAsset(look) } }, cast, looks, { templates });
  // (as the show has them, there’s nothing to put on)
  if (!fig?.model || JSON.stringify(writeLook(look)) === JSON.stringify(writeLook(defaultLook(spec.id)))) return fig;
  const undress = dress({ group: fig.model }, spec.gun ? { ...look, gear: { ...look.gear, hand: 'none' } } : look);
  const own = fig.dispose;
  fig.gun = HAND_GUNS[look.gear.hand] ?? null;
  fig.dispose = () => {
    undress();
    own?.();
  };
  return fig;
}

// the model a party member's figure is, where it's one of the site's (their
// look's body: Heisenberg's is Walt's own figure, the lab suit Jesse's)
const partyUrl = (spec, looks = null) => {
  if (!spec.src.url) return null;
  const look = lookFor(spec.id, looks);
  return look ? bodyAsset(look) : spec.src.url;
};

// ── People built from shapes (no figure of their own) ──

// what a troop of `kind` is drawn as (sides.js's troop row's `figure`): a
// Meshy cast kind ({ meshy }), a model of its own ({ url }: Albuquerque's),
// or built here ({ built }); a kind with none is the cast's own kind
export const troopLook = (kind) => Object.values(SIDES).find((s) => s.troops[kind]?.figure)?.troops[kind].figure ?? { meshy: kind };

// A troop going down, in its own frame (react.js's `down`: +z ahead, +x its
// left): the way the shot that dropped it was going (back, as pushOf has
// it, when none did: your going down), and how hard. A bowcaster's bolt,
// twice a blaster's, throws it back off its feet (die.blown); a blaster's
// drops it forward or back by the way it went (die.fwd, die.back).
export function troopFall(tr, damage = 1) {
  const d = tr.knock ?? vec.scale(tr.f, -1);
  return { dir: { x: -vec.dot(d, rightOf(tr)), z: vec.dot(d, tr.f) }, force: Math.min(1, Math.max(0, damage) / 2) };
}
// where a bolt at `p` (the planet's space) took a standing troop: its head
// (the top fifth of it) or its chest
export const troopHitWhere = (tr, p, R) => (vec.dot(vec.add(p, at(tr, R), -1), tr.n) > TROOPS[tr.kind].tall * 0.8 ? 'head' : 'chest');
// the clips a troop's body reacts with, fetched as the walk begins so the
// first hit and the first fall aren't late
const TROOP_CLIPS = ['hit.chest', 'hit.head', 'die.fwd', 'die.back', 'die.blown'];

// how each built person is dressed: Luke in his flight suit, Han in his
// shirt and vest, the Empire's troopers in white armour over black (a
// scout's mostly black), Jack's crew in flannel and jeans and a cap.
// harness: the vest cut short (a chest plate); closed: a helmet down over
// the face; gloves: the hands' colour
const LOOKS = {
  luke: { suit: '#e8742a', top: '#e8742a', legs: '#e8742a', boots: '#2a2622', skin: '#f0c7a5', hair: '#e9edf2', helmet: true, vest: '#f2f2ee', harness: true },
  han: { suit: '#f3f1ea', top: '#f3f1ea', legs: '#1d2a44', boots: '#2b1d14', skin: '#e9be98', hair: '#5a3a22', helmet: false, vest: '#151515' },
  stormtrooper: { suit: '#e9ebec', top: '#1c1d20', legs: '#e9ebec', boots: '#f1f2f3', skin: '#f1f2f3', gloves: '#1c1d20', hair: '#f4f5f6', helmet: true, closed: true, visor: '#101114', vest: '#f1f2f3', harness: true },
  scout: { suit: '#1c1d20', top: '#1c1d20', legs: '#1c1d20', boots: '#e9ebec', skin: '#f1f2f3', gloves: '#1c1d20', hair: '#f4f5f6', helmet: true, closed: true, visor: '#101114', vest: '#eceeef', harness: true },
  jackscrew: { suit: '#7a2a22', top: '#7a2a22', legs: '#3b4a63', boots: '#3a2b1c', skin: '#e2b48e', hair: '#3a2a1c', helmet: false, vest: '#5a1f1a', cap: '#2c2f33' },
};

const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0, ...extra });
// (a built figure has no clips to play or head to turn: its calls do nothing)
const UNPLAYED = { anim: null, play: NO_CALLS.play, stop: NO_CALLS.stop, base: NO_CALLS.base, look: NO_CALLS.look, react: NO_CALLS.react };
// how fast a built figure's going over the ground, in metres a second: its
// motion's (map units), else what `move` says of a run; + ahead, − back
const metresOf = (move, motion) => (motion ? Math.hypot(motion.speed ?? 0, motion.side ?? 0) * ((motion.speed ?? 0) < 0 ? -1 : 1) : move * FOOT.run) / METRE;

// Built from shapes, walking by the ground it covers (gait.js: the legs,
// Artoo's rock, never on the clock, so none marches on the spot or skates),
// breathing while it stands, each in its own time (its seed: its name and
// which it is)
function built(spec) {
  const owned = [];
  const seed = seedFor(spec.id ?? spec.src.built);
  const r = seeded(seed);
  const mat = (c, extra) => {
    const m = std(c, extra);
    owned.push(m);
    return m;
  };
  const geo = (g) => {
    owned.push(g);
    return g;
  };
  const model = new THREE.Group();
  const s = spec.tall * METRE; // everything below in shares of their height
  if (spec.src.built === 'probe') {
    // an Imperial probe droid: a black ball with a red eye, hanging over the
    // ground on its repulsors, a skirt of thin legs dangling under it
    const black = mat('#18191c', { roughness: 0.45, metalness: 0.4 });
    const grey = mat('#5b5f66', { roughness: 0.5, metalness: 0.5 });
    const body = new THREE.Group();
    const ball = new THREE.Mesh(geo(new THREE.SphereGeometry(0.17, 18, 14)), black);
    body.add(ball);
    const cap = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.06, 0.1, 0.08, 12)), grey);
    cap.position.y = 0.19;
    body.add(cap);
    for (let i = 0; i < 3; i++) {
      const eye = new THREE.Mesh(geo(new THREE.SphereGeometry(0.022, 8, 6)), mat('#111', { emissive: new THREE.Color('#ff2a1a'), emissiveIntensity: 2.5 }));
      const a = (i - 1) * 0.5;
      eye.position.set(Math.sin(a) * 0.16, 0.05, Math.cos(a) * 0.16);
      body.add(eye);
    }
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const leg = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.008, 0.012, 0.42, 5)), grey);
      leg.position.set(Math.sin(a) * 0.09, -0.32, Math.cos(a) * 0.09);
      leg.rotation.set(Math.cos(a) * 0.18, 0, -Math.sin(a) * 0.18);
      body.add(leg);
    }
    body.position.y = 0.72;
    model.add(body);
    model.scale.setScalar(s / 0.95);
    let t = r() * 20; // (each one somewhere of its own in its drift)
    return {
      model,
      bones: {},
      hand: null,
      built: true,
      ...UNPLAYED,
      update(dt) {
        t += dt;
        body.position.y = 0.72 + Math.sin(t * 1.6) * 0.03; // (hanging, never still)
        body.rotation.y = Math.sin(t * 0.5) * 0.8;
      },
      dispose() {
        for (const o of owned) o.dispose();
      },
    };
  }
  if (spec.src.built === 'artoo') {
    // a white barrel with blue panels, a silver dome, a leg each side and a third under him
    const white = mat('#e9edf2');
    const blue = mat('#2f62c9');
    const silver = mat('#c9ced6', { metalness: 0.6, roughness: 0.35 });
    const body = new THREE.Group();
    const barrel = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.2, 0.19, 0.5, 20)), white);
    barrel.position.y = 0.55;
    body.add(barrel);
    for (const [a, h] of [
      [0, 0.12],
      [0.5, 0.2],
      [-0.6, 0.16],
    ]) {
      const p = new THREE.Mesh(geo(new THREE.BoxGeometry(0.08, h, 0.02)), blue);
      p.position.set(Math.sin(a) * 0.2, 0.55 + (h - 0.15) * 0.3, Math.cos(a) * 0.2);
      p.rotation.y = a;
      body.add(p);
    }
    const dome = new THREE.Mesh(geo(new THREE.SphereGeometry(0.2, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2)), silver);
    dome.position.y = 0.8;
    body.add(dome);
    const eye = new THREE.Mesh(geo(new THREE.SphereGeometry(0.035, 10, 8)), mat('#111', { emissive: new THREE.Color('#ff3030'), emissiveIntensity: 2 }));
    eye.position.set(0, 0.9, 0.17);
    body.add(eye);
    for (const x of [-0.24, 0.24]) {
      const leg = new THREE.Mesh(geo(new THREE.BoxGeometry(0.07, 0.62, 0.12)), white);
      leg.position.set(x, 0.38, -0.02);
      leg.rotation.x = 0.12;
      model.add(leg);
      const foot = new THREE.Mesh(geo(new THREE.BoxGeometry(0.1, 0.06, 0.2)), blue);
      foot.position.set(x, 0.03, 0.02);
      model.add(foot);
    }
    model.add(body);
    model.scale.setScalar(s / 0.98);
    let t = r() * 20;
    // (a rock from foot to foot every half metre he rolls)
    const gait = createGait({ stride: 0.5, cadence: [2, 4], seed });
    return {
      model,
      bones: {},
      hand: null,
      ...UNPLAYED,
      update(dt, move, motion) {
        t += dt;
        const g = gait.step(dt, metresOf(move, motion));
        body.rotation.z = Math.sin(g.phase) * 0.05 * g.amount; // he rocks as he rolls
        dome.rotation.y = Math.sin(t * 0.7) * 0.9;
      },
      dispose() {
        for (const o of owned) o.dispose();
      },
    };
  }
  // a person: legs, a body, arms that swing, a head; the groups named as
  // Meshy's bones are (Spine, Head, RightArm, RightForeArm, RightHand…) so
  // gunplay.js poses them the same way
  const look = LOOKS[spec.src.built] ?? LOOKS.han;
  const limb = (r, l, m) => {
    const g = geo(new THREE.CapsuleGeometry(r, l, 4, 10));
    g.translate(0, -l / 2 - r * 0.5, 0); // hangs from its joint
    return new THREE.Mesh(g, m);
  };
  const legs = [];
  for (const x of [-0.075, 0.075]) {
    const hip = new THREE.Group();
    hip.position.set(x, 0.52, 0);
    const thigh = limb(0.055, 0.2, mat(look.legs));
    hip.add(thigh);
    const knee = new THREE.Group();
    knee.position.y = -0.26;
    const shin = limb(0.048, 0.2, mat(look.legs));
    knee.add(shin);
    const boot = new THREE.Mesh(geo(new THREE.BoxGeometry(0.1, 0.07, 0.17)), mat(look.boots));
    boot.position.set(0, -0.26, 0.03);
    knee.add(boot);
    hip.add(knee);
    model.add(hip);
    legs.push({ hip, knee });
  }
  // the upper body turns at the waist
  const WAIST = 0.58;
  const spine = new THREE.Group();
  spine.name = 'Spine';
  spine.position.y = WAIST;
  model.add(spine);
  const torso = new THREE.Mesh(geo(new THREE.CapsuleGeometry(0.13, 0.22, 4, 12)), mat(look.top));
  torso.position.y = 0.72 - WAIST;
  torso.scale.set(1, 1, 0.72);
  spine.add(torso);
  const vest = new THREE.Mesh(geo(new THREE.CapsuleGeometry(0.135, 0.16, 4, 12)), mat(look.vest));
  vest.position.y = 0.75 - WAIST;
  vest.scale.set(1.02, 1, 0.76);
  if (look.harness) vest.scale.set(1.03, 0.75, 0.77); // a short vest over the suit: Luke's harness, a trooper's chest plate
  spine.add(vest);
  const headG = new THREE.Group();
  headG.name = 'Head';
  headG.position.y = 0.99 - WAIST;
  spine.add(headG);
  const head = new THREE.Mesh(geo(new THREE.SphereGeometry(0.095, 16, 12)), mat(look.closed ? look.hair : look.skin));
  headG.add(head);
  const hair = new THREE.Mesh(geo(new THREE.SphereGeometry(look.helmet ? 0.112 : 0.1, 16, 10, 0, Math.PI * 2, 0, look.helmet ? Math.PI * 0.62 : Math.PI * 0.45)), mat(look.hair, look.helmet ? { roughness: 0.4 } : {}));
  hair.position.set(0, 0.01, look.helmet ? 0 : -0.012);
  headG.add(hair);
  if (look.helmet) {
    const visor = new THREE.Mesh(geo(new THREE.BoxGeometry(0.15, 0.035, 0.03)), mat(look.visor ?? '#2a3340', { roughness: 0.2, metalness: 0.5 }));
    visor.position.set(0, 0.06, 0.1);
    headG.add(visor);
    // a trooper's helmet comes down over the face, with its jaw and its vents
    if (look.closed) {
      const jaw = new THREE.Mesh(geo(new THREE.BoxGeometry(0.15, 0.07, 0.07)), mat(look.hair, { roughness: 0.4 }));
      jaw.position.set(0, -0.045, 0.07);
      headG.add(jaw);
      const grille = new THREE.Mesh(geo(new THREE.BoxGeometry(0.07, 0.025, 0.012)), mat('#1a1b1e'));
      grille.position.set(0, -0.05, 0.108);
      headG.add(grille);
    }
  }
  // a cap (Jack's crew)
  if (look.cap) {
    const cap = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.1, 0.104, 0.05, 14)), mat(look.cap));
    cap.position.set(0, 0.07, 0);
    headG.add(cap);
    const peak = new THREE.Mesh(geo(new THREE.BoxGeometry(0.15, 0.012, 0.08)), mat(look.cap));
    peak.position.set(0, 0.05, 0.1);
    headG.add(peak);
  }
  const arms = [];
  for (const [x, side] of [
    [-0.165, 'Right'], // (facing +z, the figure's right is −x)
    [0.165, 'Left'],
  ]) {
    const shoulder = new THREE.Group();
    shoulder.name = `${side}Arm`;
    shoulder.position.set(x, 0.9 - WAIST, 0);
    shoulder.add(limb(0.042, 0.17, mat(look.suit)));
    const elbow = new THREE.Group();
    elbow.name = `${side}ForeArm`;
    elbow.position.y = -0.23;
    elbow.add(limb(0.038, 0.15, mat(look.suit)));
    const wrist = new THREE.Group();
    wrist.name = `${side}Hand`;
    wrist.position.y = -0.19;
    const hand = new THREE.Mesh(geo(new THREE.SphereGeometry(0.04, 10, 8)), mat(look.gloves ?? look.skin));
    hand.position.y = -0.03;
    wrist.add(hand);
    elbow.add(wrist);
    shoulder.add(elbow);
    spine.add(shoulder);
    arms.push({ shoulder, elbow, wrist, hand });
  }
  model.scale.setScalar(s / 1.1);
  const bones = { Hips: model, Spine: spine, Head: headG, RightArm: arms[0].shoulder, RightForeArm: arms[0].elbow, RightHand: arms[0].wrist, LeftArm: arms[1].shoulder, LeftForeArm: arms[1].elbow, LeftHand: arms[1].wrist };
  // A stride of three quarters its height, its legs swung just far enough
  // that the foot that's down goes back under it as fast as it goes over
  // the ground (a leg `leg` metres long swung ±amp covers 2·leg·sin(amp) a
  // step, two steps a stride), so its feet never skate
  const leg = (0.52 / 1.1) * spec.tall;
  const stride = 0.75 * spec.tall;
  const amp = Math.asin(Math.min(0.9, stride / (4 * leg)));
  const gait = createGait({ stride, cadence: [1.4, 2.4], seed });
  let t = r() * 20;
  return {
    model,
    bones,
    built: true,
    ...UNPLAYED,
    // the right hand
    hand: arms[0].hand,
    update(dt, move, motion) {
      t += dt;
      const g = gait.step(dt, metresOf(move, motion));
      const swing = Math.sin(g.phase) * amp * g.amount;
      const bend = 0.5 + 0.4 * g.run;
      // (every turn set whole, each frame: gunplay.js and locomotion.js turn
      // these groups too, and a turn left over would add up)
      legs[0].hip.rotation.set(swing, 0, 0);
      legs[1].hip.rotation.set(-swing, 0, 0);
      legs[0].knee.rotation.set(Math.max(0, -Math.sin(g.phase + 0.6)) * bend * g.amount, 0, 0);
      legs[1].knee.rotation.set(Math.max(0, Math.sin(g.phase + 0.6)) * bend * g.amount, 0, 0);
      spine.rotation.set(0, 0, 0);
      headG.rotation.set(0, 0, 0);
      // the arms swing against the legs (gunplay.js brings the gun arm up over this)
      arms[0].shoulder.rotation.set(-swing * 0.8, 0, 0);
      arms[1].shoulder.rotation.set(swing * 0.8, 0, 0);
      arms[0].elbow.rotation.set(-0.25, 0, 0);
      arms[1].elbow.rotation.set(-0.25, 0, 0);
      arms[0].wrist.rotation.set(0, 0, 0);
      arms[1].wrist.rotation.set(0, 0, 0);
      // up over each foot as it walks; a breath as it stands
      torso.position.y = 0.72 - WAIST + sway(g.phase, g.amount).bob * 0.012 + breathe(t, seed) * 0.004 * (1 - g.amount);
    },
    dispose() {
      for (const o of owned) o.dispose();
    },
  };
}

// ── Your hands, out of your own eyes ──

// what each of the crew's forearms and hands look like from behind the gun:
// a sleeve (or bare skin, or fur) and a hand (or a glove)
const VIEW_ARMS = {
  rick: { sleeve: '#e6e9ea', cuff: '#9fd2e6', hand: '#f0d8c8' }, // the lab coat over the blue shirt
  morty: { sleeve: null, hand: '#f4d1b4' }, // bare arms under the T-shirt
  walt: { sleeve: '#d9c12a', hand: '#1a1a1c' }, // the yellow suit, black gloves
  jesse: { sleeve: '#a8331f', hand: '#e6b590' }, // the red hoodie
  chewie: { sleeve: '#7b5428', hand: '#5c3f24', fur: true },
  han: { sleeve: '#efede6', hand: '#dfae88' },
  luke: { sleeve: '#c9c3b8', hand: '#dfae88' }, // the farmboy's tunic, bare hands
};
// The forearms and hands for a gun seen out of your own eyes, built in the
// gun's frame (metres; +z its muzzle, +y its sights, −x its right) so they
// move with it: the gun hand round the grip, its forearm going back and
// down out of the view to the right; and the other hand on the foregrip of
// a long gun or cupping the gun hand on a pistol, its arm out to the left.
function viewArms(gun, spec, look, owned) {
  const mat = (c, extra = {}) => {
    const m = new THREE.MeshStandardMaterial({ color: c, roughness: look.fur ? 0.95 : 0.78, metalness: 0, ...extra });
    owned.push(m);
    return m;
  };
  const skin = mat(look.hand);
  const sleeve = look.sleeve ? mat(look.sleeve) : skin;
  const cuff = look.cuff ? mat(look.cuff) : null;
  const add = (geo, m, at, toward = null) => {
    owned.push(geo);
    const o = new THREE.Mesh(geo, m);
    o.position.set(...at);
    if (toward) o.quaternion.setFromUnitVectors(new V(0, 1, 0), new V(...toward).normalize());
    o.castShadow = false;
    o.frustumCulled = false;
    gun.add(o);
    return o;
  };
  // a hand: a fist round a grip at `at` (the knuckles to `side`, + its left)
  const fist = (at, side, wide = 1) => {
    const f = add(new THREE.SphereGeometry(0.042, 12, 10).scale(0.9 * wide, 1.25, 1.05), skin, at);
    add(new THREE.CapsuleGeometry(0.012, 0.035, 4, 8), skin, [at[0] + side * 0.028, at[1] + 0.03, at[2] + 0.02], [0, 0.4, 1]); // the thumb, along the gun
    return f;
  };
  // a forearm from the wrist at `from`, back the way `back` points, out of the view
  const forearm = (from, back) => {
    const d = new V(...back).normalize();
    const len = 0.32;
    const mid = new V(...from).addScaledVector(d, len / 2 + 0.03);
    add(new THREE.CapsuleGeometry(look.fur ? 0.05 : 0.04, len, 6, 12), sleeve, mid.toArray(), d.toArray());
    if (cuff) add(new THREE.CylinderGeometry(0.036, 0.036, 0.03, 12), cuff, new V(...from).addScaledVector(d, 0.04).toArray(), d.toArray());
    else if (!look.sleeve) add(new THREE.CapsuleGeometry(0.034, 0.05, 4, 10), skin, new V(...from).addScaledVector(d, 0.04).toArray(), d.toArray()); // a wrist
  };
  // the gun hand, round the grip (just under the gun's origin), its arm back, down and out right
  fist([0, -0.03, -0.01], 1);
  forearm([-0.005, -0.06, -0.04], [-0.35, -0.55, -1]);
  if (spec.hands === 2 && gun.getObjectByName('foregrip')) {
    const fg = gun.getObjectByName('foregrip').position;
    fist([fg.x, fg.y - 0.015, fg.z], -1, 1.05);
    forearm([fg.x + 0.01, fg.y - 0.05, fg.z - 0.03], [0.55, -0.6, -1]);
  } else if (spec.support) {
    // cupping the gun hand from below and the left
    fist([0.03, -0.06, 0.0], -1, 0.95);
    forearm([0.04, -0.09, -0.02], [0.6, -0.55, -1]);
  }
}

// ── The ground round you ──

const NOISE_N = 256;
let noiseTex = null;
function noiseTexture() {
  if (noiseTex) return noiseTex;
  // a tiling value noise, a few octaves, for grit and stones
  const N = NOISE_N;
  let seed = 9;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const grid = (p) => {
    const g = new Float32Array(p * p);
    for (let i = 0; i < g.length; i++) g[i] = rand();
    return (x, y) => {
      const x0 = Math.floor(x) % p;
      const y0 = Math.floor(y) % p;
      const x1 = (x0 + 1) % p;
      const y1 = (y0 + 1) % p;
      const fx = x - Math.floor(x);
      const fy = y - Math.floor(y);
      const sx = fx * fx * (3 - 2 * fx);
      const sy = fy * fy * (3 - 2 * fy);
      const a = g[y0 * p + x0] + (g[y0 * p + x1] - g[y0 * p + x0]) * sx;
      const b = g[y1 * p + x0] + (g[y1 * p + x1] - g[y1 * p + x0]) * sx;
      return a + (b - a) * sy;
    };
  };
  const octaves = [8, 16, 32, 64, 128].map((p) => [p, grid(p)]);
  const data = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      let v = 0;
      let amp = 0.5;
      let sum = 0;
      for (const [p, f] of octaves) {
        v += f((x / N) * p, (y / N) * p) * amp;
        sum += amp;
        amp *= 0.55;
      }
      v /= sum;
      // pebbles: dark specks where the finest octave peaks
      const fine = octaves[4][1]((x / N) * 128, (y / N) * 128);
      const speck = fine > 0.82 ? 0.55 : 1;
      const c = Math.round(Math.min(255, Math.max(0, (v * 1.25 - 0.12) * speck * 255)));
      data.set([c, c, c, 255], (y * N + x) * 4);
    }
  }
  noiseTex = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  noiseTex.wrapS = noiseTex.wrapT = THREE.RepeatWrapping;
  noiseTex.magFilter = THREE.LinearFilter;
  noiseTex.minFilter = THREE.LinearMipmapLinearFilter;
  noiseTex.generateMipmaps = true;
  sharpen(noiseTex);
  noiseTex.needsUpdate = true;
  return noiseTex;
}

// A station's hull plating, tiling: panels of a few sizes packed on a grid
// (seams between them), some with a plate inset, some vents, some greebles,
// and here and there a lit window. r: height (for the bump), g: shade, b:
// light
const PLATE_N = 512;
let plateTex = null;
function platingTexture() {
  if (plateTex) return plateTex;
  const N = PLATE_N;
  const CELLS = 16;
  const C = N / CELLS;
  let seed = 17;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const hgt = new Float32Array(N * N);
  const shade = new Float32Array(N * N);
  const glow = new Float32Array(N * N);
  const fill = (x0, y0, w, h, f) => {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) f(y * N + x, x - x0, y - y0);
  };
  const used = new Uint8Array(CELLS * CELLS);
  const sizes = [
    [1, 1],
    [2, 1],
    [1, 2],
    [2, 2],
    [3, 2],
    [2, 3],
    [4, 2],
    [4, 4],
  ];
  for (let cy = 0; cy < CELLS; cy++) {
    for (let cx = 0; cx < CELLS; cx++) {
      if (used[cy * CELLS + cx]) continue;
      // the biggest of a random pick that fits here
      let [w, h] = sizes[Math.floor(rand() ** 1.4 * sizes.length)];
      const fits = (w, h) => {
        if (cx + w > CELLS || cy + h > CELLS) return false;
        for (let y = cy; y < cy + h; y++) for (let x = cx; x < cx + w; x++) if (used[y * CELLS + x]) return false;
        return true;
      };
      while (!fits(w, h)) {
        if (w >= h && w > 1) w--;
        else h--;
      }
      for (let y = cy; y < cy + h; y++) for (let x = cx; x < cx + w; x++) used[y * CELLS + x] = 1;
      const X = cx * C;
      const Y = cy * C;
      const W = w * C;
      const H = h * C;
      const base = 0.5 + rand() * 0.18;
      const tone = rand() < 0.12 ? 0.62 + rand() * 0.1 : 0.84 + rand() * 0.24;
      fill(X, Y, W, H, (i) => {
        hgt[i] = base;
        shade[i] = tone;
      });
      const kind = rand();
      if (kind < 0.16) {
        // a plate inset, raised, with its own seam
        const m = Math.round(C * 0.18);
        fill(X + m, Y + m, W - 2 * m, H - 2 * m, (i, x, y) => {
          const edge = x < 2 || y < 2 || x >= W - 2 * m - 2 || y >= H - 2 * m - 2;
          hgt[i] = edge ? base - 0.12 : base + 0.1;
          shade[i] = edge ? tone * 0.7 : tone * 1.04;
        });
      } else if (kind < 0.3) {
        // a vent: grooves across it
        const across = W >= H;
        const m = Math.round(C * 0.22);
        fill(X + m, Y + m, W - 2 * m, H - 2 * m, (i, x, y) => {
          const k = (across ? x : y) % 6 < 2;
          hgt[i] = k ? base - 0.2 : base;
          shade[i] = tone * (k ? 0.55 : 0.92);
        });
      } else if (kind < 0.4) {
        // greebles: little boxes standing on it
        const n = 2 + Math.floor(rand() * 5);
        for (let j = 0; j < n; j++) {
          const bw = 3 + Math.floor(rand() * C * 0.4);
          const bh = 3 + Math.floor(rand() * C * 0.4);
          const bx = X + 3 + Math.floor(rand() * Math.max(1, W - bw - 6));
          const by = Y + 3 + Math.floor(rand() * Math.max(1, H - bh - 6));
          const up = base + 0.1 + rand() * 0.25;
          const t2 = tone * (0.75 + rand() * 0.35);
          fill(bx, by, bw, bh, (i) => {
            hgt[i] = up;
            shade[i] = t2;
          });
        }
      } else if (kind < 0.46) {
        // a lit window or two: a strip, dark round it
        const lw = Math.max(4, Math.round(W * (0.3 + rand() * 0.4)));
        const lh = 3 + Math.floor(rand() * 3);
        const lx = X + Math.floor((W - lw) / 2);
        const ly = Y + Math.floor(H * (0.25 + rand() * 0.5));
        fill(lx - 2, ly - 2, lw + 4, lh + 4, (i) => {
          hgt[i] = base - 0.08;
          shade[i] = 0.3;
        });
        if (rand() < 0.7) fill(lx, ly, lw, lh, (i) => (glow[i] = 1));
      }
      // the seams round it
      fill(X, Y, W, H, (i, x, y) => {
        if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1) {
          hgt[i] = 0.12;
          shade[i] = 0.45;
        } else if (x < 2 || y < 2) shade[i] *= 1.08; // (a lit edge)
      });
    }
  }
  const data = new Uint8Array(N * N * 4);
  const to8 = (v) => Math.round(Math.min(1, Math.max(0, v)) * 255);
  for (let i = 0; i < N * N; i++) data.set([to8(hgt[i]), to8(shade[i] * 0.8), to8(glow[i]), 255], i * 4);
  plateTex = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  plateTex.wrapS = plateTex.wrapT = THREE.RepeatWrapping;
  plateTex.magFilter = THREE.LinearFilter;
  plateTex.minFilter = THREE.LinearMipmapLinearFilter;
  plateTex.generateMipmaps = true;
  sharpen(plateTex);
  plateTex.needsUpdate = true;
  return plateTex;
}

// (in a shader with the plating as its bumpMap: its shade on diffuseColor,
// a second, bigger lay of it for blocks of a different grey, and its lit
// windows, brighter by night)
const PLATE_DETAIL = `
          vec4 pl = texture2D(bumpMap, vBumpMapUv);
          float blocks = texture2D(bumpMap, vBumpMapUv * 0.137 + 0.29).g;
          float detail = pl.g * 1.25 * (0.86 + 0.28 * blocks);`;
const PLATE_GLOW = `
          totalEmissiveRadiance += vec3(1.0, 0.86, 0.62) * texture2D(bumpMap, vBumpMapUv).b * 1.4;`;

// The patch reaches past the horizon (on a station, much further: its model
// isn't drawn while you're down, so there's nothing past the patch's edge)
const PATCH = { radius: 110 * METRE, rings: 46, segs: 72, lift: 0.025 * METRE, tile: 9 };
const HULL_PATCH = { ...PATCH, radius: 900 * METRE, rings: 64, segs: 96, tile: 32 };

// `trench`: the trench's rim (footScene's band: { half, home, arc }), if the
// ground stops at one; `look`: a landing's ground (landings.js: its style
// and colours), the planet's own up close
function createGround(planet, u, R, trench = null, look = null) {
  const plated = Boolean(u.plated);
  const P = plated ? HULL_PATCH : PATCH;
  const style = plated ? null : styleOf(look);
  const g = new THREE.BufferGeometry();
  const count = (P.rings + 1) * P.segs;
  const pos = new Float32Array(count * 3);
  const nor = new Float32Array(count * 3);
  const uv = new Float32Array(count * 2);
  const edge = new Float32Array(count);
  const idx = [];
  for (let i = 0; i < P.rings; i++) {
    for (let j = 0; j < P.segs; j++) {
      const a = i * P.segs + j;
      const b = i * P.segs + ((j + 1) % P.segs);
      const c = a + P.segs;
      const d = b + P.segs;
      idx.push(a, c, b, b, c, d);
    }
  }
  g.setIndex(idx);
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('aEdge', new THREE.BufferAttribute(edge, 1));
  // (a station's own grey, not its map: up close the map's a blur of its
  // painted trench and dish)
  const body = plated ? null : (planet.body?.material ?? null);
  const tint = new THREE.Color(plated ? (u.palette?.base ?? '#8d939c') : (body?.color ?? u.palette?.base ?? '#888888'));
  if (plated) tint.lerp(new THREE.Color(u.palette?.light ?? '#c9ced6'), 0.25);
  const uniforms = {
    uPlanet: { value: body?.map ?? null },
    uHasMap: { value: body?.map ? 1 : 0 },
    uToBody: { value: new THREE.Matrix3() },
    uTint: { value: tint },
    // the trench: sin of its rim's angle off the middle (0: none), and its arc
    uBand: { value: trench ? Math.sin(trench.half / R) : 0 },
    uHome: { value: trench?.home ?? 0 },
    uArc: { value: trench?.arc ?? Math.PI },
    // a landing's colours, how many metres its bump map's uv is, the time (for a glow that pulses)
    uA: { value: new THREE.Color(look?.colors?.[0] ?? '#808080') },
    uB: { value: new THREE.Color(look?.colors?.[1] ?? '#808080') },
    uC: { value: new THREE.Color(look?.colors?.[2] ?? '#808080') },
    uMetres: { value: P.tile / (style?.repeat ?? 1) },
    uTime: { value: 0 },
  };
  let bump = plated || style?.bump === 'plating' ? platingTexture() : noiseTexture();
  if (style?.repeat) {
    bump = bump.clone();
    bump.repeat.setScalar(style.repeat);
    bump.needsUpdate = true;
  }
  const mat = plated
    ? new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.62, metalness: 0.35, bumpMap: bump, bumpScale: 2.2, envMapIntensity: 0.5 })
    : new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: style?.roughness ?? 0.96, metalness: style?.metalness ?? 0, bumpMap: bump, bumpScale: style?.bumpScale ?? 1.6, envMapIntensity: 0.35 });
  mat.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, uniforms);
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aEdge;\nvarying vec3 vDir;\nvarying float vEdge;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvDir = normalize(position);\nvEdge = aEdge;');
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D uPlanet;\nuniform float uHasMap;\nuniform mat3 uToBody;\nuniform vec3 uTint;\nuniform float uBand;\nuniform float uHome;\nuniform float uArc;\nuniform vec3 uA;\nuniform vec3 uB;\nuniform vec3 uC;\nuniform float uMetres;\nuniform float uTime;\nvarying vec3 vDir;\nvarying float vEdge;')
      .replace(
        '#include <clipping_planes_fragment>',
        `#include <clipping_planes_fragment>
        // none over the trench: it stops at the rim
        if (abs(vDir.y) < uBand && (uArc >= 3.14159 || abs(mod(atan(vDir.z, vDir.x) - uHome + 3.1415927, 6.2831853) - 3.1415927) <= uArc)) discard;`,
      )
      .replace(
        '#include <map_fragment>',
        `{
          // the planet's own map, where this is on it (its turn held)
          vec3 d = normalize(uToBody * vDir);
          float lon = atan(d.z, -d.x) / 6.2831853;
          vec2 uvA = vec2(fract(lon), 1.0 - acos(clamp(d.y, -1.0, 1.0)) / 3.1415927);
          vec2 uvB = vec2(fract(lon + 0.5) - 0.5, uvA.y);
          vec2 dx = dFdx(uvA), dy = dFdy(uvA), dxB = dFdx(uvB), dyB = dFdy(uvB);
          if (dot(dxB, dxB) + dot(dyB, dyB) < dot(dx, dx) + dot(dy, dy)) { dx = dxB; dy = dyB; }
          vec3 base = uTint;
          if (uHasMap > 0.5) base *= textureGrad(uPlanet, uvA, dx, dy).rgb;
          ${
            plated
              ? `// the plating, out to the patch's edge (its far side's past the horizon)
          ${PLATE_DETAIL}
          diffuseColor.rgb *= base * detail;`
              : style
                ? `// the landing's own ground (landings/ground.js), the planet's map toward the patch's edge
          vec2 m = vBumpMapUv * uMetres;
          vec3 near = vec3(1.0);
          ${style.bump === 'plating' ? 'vec4 pl = texture2D(bumpMap, vBumpMapUv);\n          float blocks = texture2D(bumpMap, vBumpMapUv * 0.137 + 0.29).g;' : 'float n1 = texture2D(bumpMap, vBumpMapUv).r;\n          float n2 = texture2D(bumpMap, vBumpMapUv * 7.31 + 0.37).r;\n          float n3 = texture2D(bumpMap, vBumpMapUv * 0.117 + 0.71).r;'}
          ${style.glsl}
          diffuseColor.rgb *= mix(near, base, smoothstep(0.8, 1.0, vEdge));`
                : `// grit, stones and patches over it, fading out toward the patch's edge
          float n1 = texture2D(bumpMap, vBumpMapUv).r;
          float n2 = texture2D(bumpMap, vBumpMapUv * 7.31 + 0.37).r;
          float n3 = texture2D(bumpMap, vBumpMapUv * 0.117 + 0.71).r;
          float detail = (0.55 + 0.6 * n2) * (0.78 + 0.44 * n1) * (0.8 + 0.4 * n3);
          diffuseColor.rgb *= base * mix(1.0, detail, 1.0 - vEdge);`
          }
        }`,
      )
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>${plated ? PLATE_GLOW : style?.glow ? `\n{${style.glow}\n}` : ''}`);
  };
  mat.customProgramCacheKey = () => (plated ? 'foot-ground-plated' : style ? `foot-ground-${look.style}` : 'foot-ground');
  const mesh = new THREE.Mesh(g, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;
  const centre = new V();
  const t1 = new V();
  const t2 = new V();
  const g1 = new V(); // the grit's own axes: those of the first lay, kept
  const g2 = new V();
  const dir = new V();
  // laid round `n` (a unit vector out from the planet's middle)
  const lay = (n) => {
    centre.set(...n);
    const any = Math.abs(centre.y) < 0.9 ? new V(0, 1, 0) : new V(1, 0, 0);
    t1.crossVectors(any, centre).normalize();
    t2.crossVectors(centre, t1);
    if (!laidAt) {
      g1.copy(t1);
      g2.copy(t2);
    }
    let v = 0;
    for (let i = 0; i <= P.rings; i++) {
      const rho = P.radius * (i / P.rings) ** 1.7;
      const ang = rho / R;
      for (let j = 0; j < P.segs; j++, v++) {
        const th = (j / P.segs) * Math.PI * 2;
        const c = Math.cos(th);
        const s = Math.sin(th);
        dir.copy(t1).multiplyScalar(c).addScaledVector(t2, s).multiplyScalar(Math.sin(ang)).addScaledVector(centre, Math.cos(ang)).normalize();
        const r = R + P.lift * (1 - smooth(0.85, 1, i / P.rings));
        pos.set([dir.x * r, dir.y * r, dir.z * r], v * 3);
        nor.set([dir.x, dir.y, dir.z], v * 3);
        // the ground's own tiling, in metres along it (on axes that stay
        // put, so the grit doesn't slide as the patch moves on)
        uv.set([(dir.dot(g1) * R) / (P.tile * METRE), (dir.dot(g2) * R) / (P.tile * METRE)], v * 2);
        edge[v] = smooth(0.55, 1, i / P.rings);
      }
    }
    g.attributes.position.needsUpdate = true;
    g.attributes.normal.needsUpdate = true;
    g.attributes.uv.needsUpdate = true;
    g.attributes.aEdge.needsUpdate = true;
    g.computeBoundingSphere();
  };
  let laidAt = null;
  return {
    mesh,
    // round n, if it's moved far enough from where the patch was laid
    follow(n) {
      if (laidAt && vec.dot(laidAt, n) > Math.cos((P.radius * 0.3) / R)) return;
      lay(n);
      laidAt = [...n];
    },
    // the planet's turn (held), so the map lines up with the planet's own
    sync(toBody) {
      uniforms.uToBody.value.copy(toBody);
    },
    tick(t) {
      uniforms.uTime.value = t;
    },
    dispose() {
      g.dispose();
      mat.dispose();
      if (bump !== noiseTex && bump !== plateTex) bump.dispose();
    },
  };
}

// rocks about the landing spot, in the planet's colours, to walk round and
// see the ground go by
function createRocks(n0, R, u, small) {
  const N = small ? 70 : 160;
  let seed = 31;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const geo = new THREE.IcosahedronGeometry(1, 1);
  const p = geo.attributes.position;
  const v = new V();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize();
    const k = 1 + 0.18 * Math.sin(v.x * 3.1 + 1.3) * Math.cos(v.y * 2.7) + 0.14 * Math.sin(v.z * 4.3 + v.x * 2);
    v.multiplyScalar(k).multiply(new V(1, 0.6, 0.85));
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.93, metalness: 0.02, flatShading: true, envMapIntensity: 0.3 });
  const mesh = new THREE.InstancedMesh(geo, mat, N);
  const tones = [u.palette?.base, u.palette?.dark ?? u.palette?.base, u.palette?.light ?? u.palette?.base, '#6b625a', '#4f4a46'].filter(Boolean);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const sc = new V();
  const c = new THREE.Color();
  const solids = [];
  const base = person(n0, Math.abs(n0[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]);
  for (let i = 0; i < N; i++) {
    const d = (6 + rand() ** 0.8 * 95) * METRE;
    const a = rand() * Math.PI * 2;
    const spot = offset(base, Math.cos(a) * d, Math.sin(a) * d, R);
    const size = (0.15 + rand() ** 3 * 2.4) * METRE;
    const up = new V(...spot.n);
    q.setFromUnitVectors(new V(0, 1, 0), up).multiply(new THREE.Quaternion().setFromAxisAngle(new V(0, 1, 0), rand() * 6.3));
    sc.set(size, size * (0.6 + rand() * 0.6), size * (0.8 + rand() * 0.5));
    const at = up.clone().multiplyScalar(R + size * 0.12);
    mesh.setMatrixAt(i, m.compose(at, q, sc));
    mesh.setColorAt(i, c.set(tones[Math.floor(rand() * tones.length)]).multiplyScalar(0.55 + rand() * 0.35));
    if (size > 0.9 * METRE) solids.push({ n: spot.n, r: size * 0.85 });
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();
  return {
    mesh,
    solids,
    dispose() {
      geo.dispose();
      mat.dispose();
      mesh.dispose();
    },
  };
}

// a plated material of its own (the walls of the trench, the blocks on a
// station): `color` times the plating's shade, and its lit windows. Its uvs
// are in plating tiles, or (`boxes`, for instanced boxes) laid on each face
// from the box's own size, so a big one's plates are the size a small one's are
function platedMaterial(color, { lights = true, vertexColors = false, boxes = false, flatShading = false } = {}) {
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.62, metalness: boxes ? 0.12 : 0.3, bumpMap: platingTexture(), bumpScale: 2.2, envMapIntensity: 0.5, vertexColors, flatShading });
  const tile = (HULL_PATCH.tile * METRE).toFixed(5);
  mat.onBeforeCompile = (sh) => {
    if (boxes)
      sh.vertexShader = sh.vertexShader.replace(
        '#include <uv_vertex>',
        `#include <uv_vertex>
        {
          vec3 sc = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
          vec3 lp = position * sc;
          vec3 an = abs(normal);
          vec2 fuv = an.y > 0.5 ? lp.xz : an.x > 0.5 ? lp.zy : lp.xy;
          vBumpMapUv = fuv / ${tile} + vec2(instanceMatrix[3].x, instanceMatrix[3].z) * 3.1;
        }`,
      );
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <map_fragment>', `#include <map_fragment>\n{${PLATE_DETAIL}\n          diffuseColor.rgb *= detail;\n}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>${lights ? PLATE_GLOW : ''}`);
  };
  mat.customProgramCacheKey = () => `foot-plated-${lights ? 1 : 0}${boxes ? 'b' : ''}${flatShading ? 'f' : ''}`;
  return mat;
}

// The trench's walls by you, from the rim down to where the trench run's
// own walls (trench.js) are (its model's laid sunk below the surface, its
// rim some way down), both sides of it and as far along as the patch goes;
// and a row of lights along each rim. band: { half (the rim), deep (how far
// down the trench run's rim is) }
function createTrenchSides(n0, R, band) {
  const group = new THREE.Group();
  const lon0 = Math.atan2(n0[2], n0[0]);
  const L = HULL_PATCH.radius / R; // (radians along, either way)
  const ALONG = 128;
  const DOWN = 6;
  const deep = band.deep + 0.25 * band.deep + 2 * METRE; // (a little past the trench run's rim)
  const pos = [];
  const nor = [];
  const uv = [];
  const col = [];
  const idx = [];
  const tile = HULL_PATCH.tile * METRE;
  for (const side of [-1, 1]) {
    const first = pos.length / 3;
    for (let i = 0; i <= ALONG; i++) {
      const lon = lon0 - L + (2 * L * i) / ALONG;
      for (let j = 0; j <= DOWN; j++) {
        const d = (deep * j) / DOWN;
        const rho = Math.sqrt(Math.max(0, (R - d) ** 2 - band.half ** 2));
        pos.push(Math.cos(lon) * rho, side * band.half, Math.sin(lon) * rho);
        nor.push(0, -side, 0); // facing across the trench
        uv.push(((lon - lon0) * R) / tile, d / tile);
        const k = 1 - 0.55 * (j / DOWN); // darker further down
        col.push(k, k, k);
      }
    }
    for (let i = 0; i < ALONG; i++) {
      for (let j = 0; j < DOWN; j++) {
        const a = first + i * (DOWN + 1) + j;
        const b = a + DOWN + 1;
        // (wound so its face is toward the trench's middle)
        if (side > 0) idx.push(a, b, a + 1, b, b + 1, a + 1);
        else idx.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setIndex(idx);
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const mat = platedMaterial('#9aa0a8', { vertexColors: true });
  const walls = new THREE.Mesh(geo, mat);
  walls.frustumCulled = false;
  group.add(walls);
  // the lights along each rim, every few metres
  const EVERY = 9 * METRE;
  const count = Math.floor((2 * L * R) / EVERY);
  const lampGeo = new THREE.BoxGeometry(0.28 * METRE, 0.1 * METRE, 0.28 * METRE).translate(0, 0.05 * METRE, 0);
  const lampMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff0d2').multiplyScalar(1.6), toneMapped: false });
  const lamps = new THREE.InstancedMesh(lampGeo, lampMat, count * 2);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const one = new V(1, 1, 1);
  const up = new V();
  let k = 0;
  for (const side of [-1, 1]) {
    const lat = (band.half + 0.6 * METRE) / R;
    for (let i = 0; i < count; i++, k++) {
      const lon = lon0 - L + (2 * L * (i + 0.5)) / count;
      up.set(Math.cos(lon) * Math.cos(lat), side * Math.sin(lat), Math.sin(lon) * Math.cos(lat));
      q.setFromUnitVectors(new V(0, 1, 0), up);
      lamps.setMatrixAt(k, m.compose(up.clone().multiplyScalar(R), q, one));
    }
  }
  lamps.instanceMatrix.needsUpdate = true;
  lamps.computeBoundingSphere();
  group.add(lamps);
  return {
    mesh: group,
    dispose() {
      geo.dispose();
      mat.dispose();
      lampGeo.dispose();
      lampMat.dispose();
      lamps.dispose();
    },
  };
}

// On a station, for rocks: blocks of the hull standing on it, low ones and
// big ones and the odd tower, square to the plating (and none in the
// trench, or where the ship comes down: `clear` round n0)
function createHullBits(n0, R, u, small, band, clear) {
  const N = small ? 90 : 220;
  let seed = 47;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const geo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  const mat = platedMaterial('#ffffff', { boxes: true, flatShading: true });
  const mesh = new THREE.InstancedMesh(geo, mat, N);
  const tones = [u.palette?.base, u.palette?.light, u.palette?.base, '#9aa0a8', '#7a8089'].filter(Boolean);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const sc = new V();
  const c = new THREE.Color();
  const solids = [];
  // (square to the trench, as the plating is laid)
  const base = person(n0, band ? [-n0[2], 0, n0[0]] : Math.abs(n0[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]);
  let placed = 0;
  for (let tries = 0; placed < N && tries < N * 4; tries++) {
    const d = clear + (4 + rand() ** 1.3 * 560) * METRE;
    const a = rand() * Math.PI * 2;
    const spot = offset(base, Math.cos(a) * d, Math.sin(a) * d, R);
    const r = rand();
    const [w, h, l] =
      r < 0.05
        ? [3 + rand() * 4, 9 + rand() * 18, 3 + rand() * 4] // a tower
        : r < 0.2
          ? [4 + rand() * 8, 1.5 + rand() * 4, 4 + rand() * 10] // a big block
          : [0.6 + rand() * 2.6, 0.3 + rand() ** 2 * 2.2, 0.6 + rand() * 2.6];
    const half = (Math.hypot(w, l) / 2) * METRE;
    if (inTrench(spot.n, band, R, half + 2 * METRE)) continue;
    const up = new V(...spot.n);
    const along = new V(...spot.f);
    const turn = Math.floor(rand() * 4) * (Math.PI / 2);
    // y up from the ground, z along the plating, turned by a quarter now and then
    const zAxis = along.clone().applyAxisAngle(up, turn);
    const xAxis = new V().crossVectors(up, zAxis);
    q.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAxis, up, zAxis));
    sc.set(w * METRE, h * METRE, l * METRE);
    mesh.setMatrixAt(placed, m.compose(up.clone().multiplyScalar(R - 0.05 * METRE), q, sc));
    mesh.setColorAt(placed, c.set(tones[Math.floor(rand() * tones.length)]).multiplyScalar(0.8 + rand() * 0.3));
    if (Math.max(w, l) > 0.9) solids.push({ n: spot.n, r: (Math.max(w, l) / 2) * METRE });
    placed++;
  }
  mesh.count = placed;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();
  return {
    mesh,
    solids,
    dispose() {
      geo.dispose();
      mat.dispose();
      mesh.dispose();
    },
  };
}

// the planet's air along the horizon, by day: a dome round the camera,
// added over the sky (the ground's nearer, so it's left alone)
const HAZE_VERT = `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const HAZE_FRAG = `
uniform vec3 uUp;
uniform vec3 uColor;
uniform float uDay;
varying vec3 vDir;
void main() {
  float e = dot(normalize(vDir), uUp);
  float horizon = exp(-max(e, 0.0) * 7.0);
  float glow = horizon * 0.8 + 0.06 * (1.0 - smoothstep(0.0, 0.6, e));
  gl_FragColor = vec4(uColor * glow * uDay, 1.0);
  #include <colorspace_fragment>
}`;
function createHaze(color) {
  const mat = new THREE.ShaderMaterial({
    vertexShader: HAZE_VERT,
    fragmentShader: HAZE_FRAG,
    uniforms: { uUp: { value: new V(0, 1, 0) }, uColor: { value: new THREE.Color(color).multiplyScalar(0.2) }, uDay: { value: 1 } },
    side: THREE.BackSide,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(30, 32, 16), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 3;
  return { mesh, mat, dispose: () => (mesh.geometry.dispose(), mat.dispose()) };
}

// a soft dark spot on the ground under someone, so they stand on it
let blobTex = null;
function blobTexture() {
  if (blobTex) return blobTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(0,0,0,0.55)');
  g.addColorStop(0.55, 'rgba(0,0,0,0.3)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  blobTex = new THREE.CanvasTexture(c);
  return blobTex;
}
const blobGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
const blobMat = () => new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });

// ── The whole of it ──

// (`prepare(roots, alive)`: the map's way of readying a landing before it's
// shown, its look put on, its pictures sent and its shaders made, a slice at
// a time; a promise)
export function createFoot({ map, emit, reduced = false, small = false, planetOf, renderer = null, prepare = null, cone = () => ASSIST.mouse }) {
  const root = new THREE.Group(); // at the planet's middle, in the map
  root.name = 'foot';
  root.visible = false;
  map.add(root);
  let cast = null;
  let party = null; // [lead, mate] once loaded: { spec, fig, group, gun, w }
  let troopFigs = new Map(); // id → troopFig's { body, anim, group, gp, … }
  const troopModels = new Map(); // a troop's model's url → { ready: { scene, clips } once loaded } (copied for each one)
  const partyModels = new Map(); // a crew's or a guest's model's url → Promise<{ scene, clips } | null> (copied for each one: templateIn)
  // (what a loaded scene's made of, freed when the walk's over)
  const freeScene = (scene) =>
    scene.traverse((o) => {
      if (!o.isMesh) return;
      o.geometry.dispose();
      o.material?.map?.dispose();
      o.material?.dispose();
    });
  let ground = null;
  let rocks = null;
  // the landing's bodies (landings/physics.js): null while it loads, false if it won't
  let lp = null;
  let physical = false; // (this landing has them at all)
  let fed = 0; // how many of the landing's bodies it has
  let walled = 0; // how many of the landing's solids are walls in it
  let shipWalled = false;
  let settled = 0; // (when the far ones were last put to sleep)
  let haze = null;
  let sides = null; // a trench's walls by you
  const owned = [];
  const rand = Math.random;
  // the way in through the air (entry.js, reentry.js): made once and kept
  // hidden, so the map's warm-up makes its shaders before the first entry
  const reentry = createReentry({ small, reduced });
  root.add(reentry.group);
  // the fallen leaves round you (landings/litter.js), made once and kept,
  // as many as the device steps easily; and the canopy's wind noise made
  // while nothing's happening (5 to 9 ms, more on a phone), before the
  // first landing wants it
  const leaves = createLitter({ level: leafLevel({ tier: device().tier, small }), reduced });
  root.add(leaves.mesh);
  (typeof requestIdleCallback === 'function' ? requestIdleCallback : (f) => setTimeout(f, 200))(() => canopy());

  // bolts in flight: a white-hot core in a sleeve of the shot's colour,
  // its head where the bolt is and its length trailing behind (grown out
  // of the muzzle over the first of its flight, so it never pokes out of
  // the back of the gun)
  const BOLT_LEN = 0.9 * METRE;
  const boltGeo = new THREE.CylinderGeometry(0.03 * METRE, 0.03 * METRE, BOLT_LEN, 6).rotateX(Math.PI / 2).translate(0, 0, -BOLT_LEN / 2);
  const sleeveGeo = new THREE.CylinderGeometry(0.055 * METRE, 0.04 * METRE, BOLT_LEN * 1.1, 8).rotateX(Math.PI / 2).translate(0, 0, -BOLT_LEN * 0.55);
  const boltMats = new Map();
  const boltMat = (color) => {
    if (!boltMats.has(color)) {
      const c = new THREE.Color(color);
      boltMats.set(color, {
        core: new THREE.MeshBasicMaterial({ color: c.clone().lerp(new THREE.Color('#ffffff'), 0.55).multiplyScalar(4), toneMapped: false, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
        sleeve: new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(1.4), toneMapped: false, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }),
      });
    }
    return boltMats.get(color);
  };
  const boltPool = Array.from({ length: 40 }, () => {
    const mats = boltMat('#ffffff');
    const m = new THREE.Mesh(boltGeo, mats.core);
    const sleeve = new THREE.Mesh(sleeveGeo, mats.sleeve);
    sleeve.frustumCulled = false;
    m.add(sleeve);
    m.visible = false;
    m.frustumCulled = false;
    root.add(m);
    return m;
  });
  // their flight: the one step every blaster on the site flies by (lib/combat/bolt.js)
  const boltStep = createBolts({ pool: boltPool.length });
  // a mesh no bolt in the air holds; with none free, the oldest in the air gives way
  const takeMesh = () => {
    const free = boltPool.find((m) => !S.bolts.some((o) => o.mesh === m));
    if (free) return free;
    const old = S.bolts.shift();
    old.b.alive = false;
    return old.mesh;
  };
  const paintBolt = (mesh, color) => {
    const mats = boltMat(color);
    mesh.material = mats.core;
    mesh.children[0].material = mats.sleeve;
    mesh.scale.set(1, 1, 0.02);
  };

  // what a shot does round the gun and where it lands (gunfx.js), in the
  // planet's space; and a light that flares with each muzzle flash, kept in
  // the map from the start and dark between shots, so the scene's count of
  // lights never changes and nothing recompiles when it fires (not on a
  // phone, nor with motion turned down)
  const flare = small || reduced ? null : new THREE.PointLight('#ffd36b', 0, 7 * METRE, 2);
  if (flare) {
    flare.userData.peak = 2.5 * METRE * METRE; // (about the key light's brightness, a metre off)
    map.add(flare);
  }
  // and, for the same reason, the lights of a landing's things (a portal's
  // glow, music's lamps, Mordor's fires) shown through a few kept in the
  // map from the start, dark but for the ones nearest you (landings/lamps.js).
  // Every lit shader on the map pays for them, all the time: a phone keeps
  // one, the nearest
  const lamps = createLamps(map, { n: small ? 1 : LAMPS });
  const lampAt = new V();
  const groundN = new V();
  const fx = createGunFx({
    parent: root,
    unit: METRE,
    ground: (p) => {
      const l = p.length() || 1;
      return { h: l - S.R, n: groundN.copy(p).divideScalar(l) };
    },
    light: flare && { obj: flare, place: (p) => flare.position.copy(p).add(S.c) },
  });
  // the portal gun's kills (lib/three/portalFx.js): a trooper it downs is
  // pulled through a portal that opens behind them and shut in two
  const pfx = createPortalFx({ parent: root });
  // and his other two guns' (lib/three/gadgetFx.js): frozen and shattered, shrunk and popped
  const gfx = createGadgetFx({ parent: root });

  // out of your own eyes (V): your gun in your hands at the bottom right of
  // the view, swaying as you walk, lagging a little behind a turn, coming up
  // onto the target as you shoot and kicking when it fires; the shot leaves
  // its muzzle. A copy of the gun your figure holds (that's hidden then)
  let vm = null; // { gun, kind, who, owned, muzzle, eject, look, bob }
  const viewGun = (kind, who) => {
    if (vm?.kind === kind && vm.who === who) return vm;
    if (vm) {
      vm.gun.removeFromParent();
      for (const o of vm.owned) o.dispose?.();
    }
    const owned = [];
    const gun = buildGun(kind, owned);
    viewArms(gun, GUNS[kind], VIEW_ARMS[who] ?? VIEW_ARMS.han, owned);
    gun.scale.setScalar(METRE);
    gun.visible = false;
    gun.traverse((o) => {
      if (o.isMesh) o.frustumCulled = false;
    });
    root.add(gun);
    vm = { gun, kind, who, owned, muzzle: gun.getObjectByName('muzzle'), eject: gun.getObjectByName('eject'), look: null, bob: 0 };
    return vm;
  };
  // the flash of a hit
  const puffTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.3, 'rgba(255,230,180,0.6)');
    g.addColorStop(1, 'rgba(255,200,120,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c);
    sharpen(t);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const puffs = Array.from({ length: 16 }, () => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    s.visible = false;
    s.userData.age = 1;
    root.add(s);
    return s;
  });
  const puff = (p, color, size = 1) => {
    const s = puffs.find((o) => !o.visible) ?? puffs[0];
    s.position.set(...p);
    s.material.color.set(color).multiplyScalar(3);
    s.userData = { age: 0, size: size * METRE };
    s.visible = true;
  };

  const shadowMat = blobMat();
  const blobs = new Map(); // whose → mesh
  // a shadow under w (`size` metres across), on the ground whatever their jump
  const shadow = (key, w, size) => {
    let m = blobs.get(key);
    if (!m) {
      m = new THREE.Mesh(blobGeo, shadowMat);
      m.renderOrder = 1;
      root.add(m);
      blobs.set(key, m);
    }
    m.visible = true;
    stand(m, { ...w, h: 0 }, 0.01 * METRE);
    m.scale.setScalar(size * METRE * (1 - Math.min(0.5, (w.h ?? 0) / METRE) * 0.6));
    return m;
  };
  const dropShadow = (key) => {
    const m = blobs.get(key);
    if (!m) return;
    root.remove(m);
    blobs.delete(key);
  };

  const S = {
    phase: null,
    id: null,
    R: 1,
    c: new V(),
    kind: null,
    model: null,
    t: 0,
    clock: 0,
    // the ship: where it came from, where it's down
    from: null, // { p: Vector3, q: Quaternion }
    spot: null, // { n, f }
    rest: 0,
    hover: null,
    arc: null, // the way round the planet, when the spot's a long way from where the ship came in
    // flown in through the air (entry.js): { path, t, q0, dir, glide, titled, title } while it's on its way down
    entry: null,
    sky: 1, // how much of the landing's sky shows: coming up from nothing as the ship comes in through the air
    airWas: 0, // the planet's halo, as bright as it was before the ship went into it
    band: null, // a trench round its middle: { half (its rim), home, arc, deep (how far down the trench run's rim is) }
    hideBody: 0, // how low the camera's to be for the planet's own model to go (0: it stays)
    bodyShown: true,
    bodyMask: 1, // (a planet's: the layers its sphere's drawn on, put back as it goes up)
    bodyAll: false, // (a station's: all of it goes, not just its sphere)
    // the people
    lead: 0, // which of the party you play
    me: null,
    mate: null,
    troops: [],
    bolts: [], // { b (foot.js), mesh, color }
    health: FOOT.health,
    hitAt: -1e9,
    downAt: 0,
    nextSquad: 0,
    squads: 0,
    cleared: true,
    cool: 0,
    mateCool: 1,
    mateSt: {}, // the mate's health and hurt (footLife.js's mateHit: it can be hit, and goes down a while)
    mateKnock: null, // which way the last shot that hit the mate was going
    follow: {}, // the mate's pace toward you (footLife.js's followMove)
    emote: null, // { id, at }: what you're doing off the wheel (lib/emote.js)
    wheelHeld: false, // Z down
    emoteAt: null, // when the wheel last did something, for the HUD's word
    acted: false, // something you did this frame (a shot, a gadget), which cuts an emote
    aim: 0, // the gun up, 1 fading to 0 after a shot
    mateAim: 0,
    mateTarget: null, // the trooper the mate's gun is on
    knock: null, // which way the last shot that hit you was going
    lock: null, // the trooper the shot bends to, while it's in the input's cone (footAim.js)
    aimed: null, // where a shot would go now (footAim's), this frame
    landed: null, // when your last shot hit someone (S.clock), for the reticle
    cam: { pos: null, look: null, pitch: 0.18, first: false, kick: { x: 0, v: 0 } },
    done: null,
    // the leaves: the ship down on them yet (its blast), the wind's strength
    // here, and how high your jump took you (its landing's blast)
    touched: false,
    windBase: 0.45,
    airH: 0,
  };

  // stand a figure where a person is: up out from the planet, facing f
  const basis = new THREE.Matrix4();
  const stand = (group, w, extra = 0) => {
    const n = new V(...w.n);
    const f = new V(...w.f);
    basis.makeBasis(new V().crossVectors(n, f), n, f);
    group.quaternion.setFromRotationMatrix(basis);
    group.position.set(...at(w, S.R)).addScaledVector(n, extra);
  };

  const shipFrame = (n, fwd) => {
    const N = new V(...n);
    const F = new V(...fwd);
    basis.makeBasis(new V().crossVectors(F, N), N, F.clone().negate());
    return new THREE.Quaternion().setFromRotationMatrix(basis);
  };

  // the ship's resting height off the ground (its lowest point, at its parked size)
  const restOf = (model) => {
    const g = model.group;
    const keep = { p: g.position.clone(), q: g.quaternion.clone(), s: g.scale.clone(), pr: model.pivot.rotation.clone() };
    g.position.set(0, 0, 0);
    g.quaternion.identity();
    g.scale.setScalar(1);
    model.pivot.rotation.set(0, 0, 0);
    g.updateMatrixWorld(true);
    const box = new THREE.Box3();
    g.traverse((o) => {
      if (o.isMesh && o.visible && o.geometry) {
        o.geometry.computeBoundingBox?.();
        const b = o.geometry.boundingBox?.clone().applyMatrix4(o.matrixWorld);
        if (b) box.union(b);
      }
    });
    g.position.copy(keep.p);
    g.quaternion.copy(keep.q);
    g.scale.copy(keep.s);
    model.pivot.rotation.copy(keep.pr);
    g.updateMatrixWorld(true);
    return box;
  };

  // ── loading ──
  // Everyone's figures are made once for the page and copied for each
  // landing: the cast's (one cast, kept from the first landing on: its
  // models fetched, parsed and sent to the graphics chip once), the site's
  // own models (copies of originals kept here, as loadSharedFigure makes
  // them: rigged and their normals smoothed once; the map's own, not the
  // galaxy's, for the look that goes onto what they share is the map's),
  // the troops' that are models of their own. A landing's end frees only
  // its copies. (Each landing made all of them afresh, and Rick and Morty's
  // 2048 maps went up to the chip again every time.)
  // warmParty(kind): the figures a ship's party and its side's troops are
  // copies of, loaded (as soon as there's somewhere to land: prefetch)
  const warmParty = (kind) => {
    const specs = PARTY[kind] ?? PARTY.rv;
    cast ??= createMeshyCast(withWardrobe()); // (the wardrobe's bodies too, for the cruiser's two)
    // (and the side's troops, where the cast has them: the rest are built stand-ins)
    const sideTroops = Object.keys(sideFor(kind)?.troops ?? SIDES.rickmorty.troops);
    const needCast = [...new Set([...specs.filter((s) => s.src.meshy).map((s) => s.src.meshy), ...sideTroops.map((k) => troopLook(k).meshy).filter(Boolean).map((k) => MESHY[k]?.a ?? k)])]; // (the cast loads by asset: a Morty clone is Morty's)
    const castReady = cast.load(null, needCast).catch(() => {});
    preload(TROOP_CLIPS).catch(() => {});
    // (the party's own, where they're the site's models)
    for (const spec of specs) {
      const url = partyUrl(spec);
      if (url) templateIn(partyModels, url);
    }
    // (and the ones that are models of their own, Albuquerque's: loaded once, copied for each)
    for (const k of sideTroops) {
      const url = troopLook(k).url;
      if (!url || troopModels.has(url)) continue;
      const entry = { ready: null };
      troopModels.set(url, entry);
      Promise.all([getLoader().loadAsync(url), borrowClips()])
        .then(([gltf, clips]) => {
          // (gone with the foot scene while it loaded)
          if (troopModels.get(url) !== entry) return freeScene(gltf.scene);
          // (the first one rigged keeps the materials and smooths the normals, shared by the copies)
          rigScene(gltf.scene, clips, 1);
          entry.ready = { scene: gltf.scene, clips };
        })
        .catch(() => {
          // (tried again next time)
          if (troopModels.get(url) === entry) troopModels.delete(url);
        });
    }
    return castReady;
  };
  let loading = null;
  const load = (kind) => {
    const specs = PARTY[kind] ?? PARTY.rv;
    const castReady = warmParty(kind);
    loading = (async () => {
      await castReady;
      const figs = await Promise.all(specs.map((s) => loadParty(s, cast, null, { templates: partyModels }).catch(() => null)));
      return figs.map((fig, i) => {
        const spec = specs[i];
        const f = fig ?? built({ ...spec, src: { built: spec.id === 'artoo' ? 'artoo' : 'han' } });
        const group = new THREE.Group();
        group.add(f.model);
        group.visible = false;
        root.add(group);
        const gp = spec.gun ? createGunplay(f, f.gun ?? spec.gun, { unit: METRE, who: f.built ? 'built' : spec.id }) : null;
        return { spec, fig: f, group, gp };
      });
    })();
    return loading;
  };

  // the troops' guns (sides.js: the Gromflomites' carbine, the cop's and the DEA's pistol; the gazorpian has hands)
  const troopGun = (t) => sideFor(S.kind)?.troops[t.kind]?.gun ?? SIDES.rickmorty.troops[t.kind]?.gun ?? null;
  // A troop's figure, on an animator as everyone else's is: the cast's
  // (told how tall it stands, so its motion's read in metres), a copy of a
  // model of its own (rigScene's), or one built. `body` answers the calls
  // (play, react, stop, look; a built one's do nothing); `anim` is there
  // when it's rigged.
  const troopFig = (t) => {
    let got = troopFigs.get(t.id);
    if (got) return got;
    const look = troopLook(t.kind);
    const tall = TROOPS[t.kind].tall / METRE; // (metres)
    const seed = seedFor(t.kind);
    const tpl = look.url ? troopModels.get(look.url)?.ready : null;
    const c = tpl ? null : look.meshy ? (cast?.make(look.meshy, 0, { tall, seed }) ?? null) : null;
    const group = new THREE.Group();
    let fig = null;
    let b = null;
    let own = null;
    if (tpl) {
      // a copy of Albuquerque's model, sharing what it's made of (and the library's clips made for it)
      own = rigScene(cloneSkinned(tpl.scene), tpl.clips, tall, { shared: true, seed, key: look.url });
      fig = own;
      group.add(own.model);
    } else if (c) {
      c.group.scale.setScalar(TROOPS[t.kind].tall / c.height);
      fig = { model: c.group };
      group.add(c.group);
    } else {
      // built: the side's look for it (a stormtrooper, a probe), or a stand-in until its model's here
      b = built({ tall, src: { built: look.built ?? 'han' } });
      group.add(b.model);
      fig = b;
    }
    root.add(group);
    const gp = troopGun(t) ? createGunplay(fig, troopGun(t), { unit: METRE, who: b ? 'built' : null }) : null;
    // (k: the cast's units in the map's, for its motion's speeds)
    got = { c, b, own, body: c ?? own ?? b, anim: c?.anim ?? own?.anim ?? null, k: c ? c.group.scale.x : 1, group, gp, prevF: null, death: null, blow: 1 };
    troopFigs.set(t.id, got);
    return got;
  };
  // a troop's body a frame on (motion in the map's units, as yours is), and
  // once it's placed the bones over its clips
  const stepTroop = (got, dt, move, hit, motion, frame) => {
    if (got.c) got.c.update(0, move, hit, { dt, motion: { ...motion, speed: (motion.speed ?? 0) / got.k, side: (motion.side ?? 0) / got.k }, after: false });
    else if (got.own) got.own.update(dt, move, motion);
    else {
      got.b?.update(dt, move);
      return;
    }
    got.group.updateMatrixWorld(true);
    (got.c ?? got.own).after(dt, motion, frame);
  };
  const dropTroop = (id) => {
    const got = troopFigs.get(id);
    if (!got) return;
    got.swallow?.dispose();
    root.remove(got.group);
    got.gp?.dispose();
    got.b?.dispose();
    got.own?.dispose(); // (a copy's: its animator; what it's made of is the original's)
    got.c?.anim?.dispose();
    got.c?.release?.(); // (and a cast copy's own: a clone's shirt)
    troopFigs.delete(id);
  };

  // how fast someone's turning, from the way they faced last frame (rad/s, + to the left)
  const turnRate = (holder, w, dt) => {
    const was = holder.prevF;
    holder.prevF = w.f;
    if (!was || dt <= 0) return 0;
    return Math.atan2(vec.dot(vec.cross(was, w.f), w.n), vec.dot(was, w.f)) / dt;
  };
  // the way along the ground a shot pushed someone (their back, if nothing did)
  // how far down you are (0 up … 1 flat): the knees go and over onto your
  // back, then up again at the end of the down phase
  const myDown = () => (S.phase === 'down' ? Math.min(1, S.t / 0.95) * (1 - smooth(LAND.fall - 0.7, LAND.fall, S.t)) : 0);
  const pushOf = (w, knock) => {
    const d = knock ? vec.add(knock, w.n, -vec.dot(knock, w.n)) : vec.scale(w.f, -1);
    return new V(...(vec.len(d) > 1e-6 ? vec.unit(d) : vec.scale(w.f, -1)));
  };

  // ── the gun: where its muzzle is, pointed where the shot goes ──
  const tmp = new V();
  const invMap = new THREE.Matrix4();
  // (bones are in the world: back into the map's space, and the other way)
  const toMap = (v) => v.applyMatrix4(invMap);
  const dirToWorld = (v) => v.transformDirection(map.matrixWorld);
  // a planet's turn, from the map's space to its body's own (the frame its
  // colour map is laid in): rotation only, any scale normalised away
  // (the map's matrix as it is: update() brings it up to date each frame first)
  const bodyTurn = (planet, out = new THREE.Matrix3()) => {
    planet.body.updateWorldMatrix(true, false);
    const m4 = new THREE.Matrix4().copy(map.matrixWorld).invert().multiply(planet.body.matrixWorld);
    out.setFromMatrix4(m4);
    const e = out.elements;
    for (let c = 0; c < 3; c++) {
      const l = Math.hypot(e[c * 3], e[c * 3 + 1], e[c * 3 + 2]) || 1;
      e[c * 3] /= l;
      e[c * 3 + 1] /= l;
      e[c * 3 + 2] /= l;
    }
    return out.transpose();
  };
  const turned = (m3, v) => arr(new V(...v).applyMatrix3(m3));
  // the colour of a planet's own map at a uv ([r, g, b], or null): from the
  // map it was built with (planetMaps.js's far file, a webp at every level),
  // kept here before nearMaps.js can swap its near set in (on ultra the -xl
  // KTX2, which can't be read back), so a landing reads the same file
  // whether or not the near set has arrived (createFoot comes after the
  // planets are built and before the first near.update: scene.js); else
  // the map it's drawn with; else its -sm file, fetched the first time and
  // read from the next landing on
  const farMap = Object.fromEntries(Object.entries(planetOf ?? {}).map(([id, p]) => [id, readableMap(p.body?.material?.map)]));
  const spare = {};
  const lookOf = (planet, id) => {
    for (const tex of [farMap[id], readableMap(planet.body?.material?.map)]) {
      if (!tex) continue;
      const look = (uv) => sampleMap(tex.image, uv, { flip: tex.flipY === false });
      if (look([0.5, 0.5])) return look;
    }
    if (spare[id] === undefined) {
      spare[id] = null;
      fetch(`/textures/universe/${id === 'travel' ? 'earth' : id}-sm.webp`)
        .then((r) => r.blob())
        .then((b) => createImageBitmap(b))
        .then((img) => (spare[id] = (uv) => sampleMap(img, uv)))
        .catch(() => {});
    }
    return spare[id];
  };
  // (development: ?spot=lat,lon forces where a landing comes down, in
  // degrees on the planet's own map, longitude 0 its middle: landings/biomes.js)
  const forcedSpot = () => {
    if (!import.meta.env.DEV || typeof location === 'undefined') return null;
    const q = new URLSearchParams(location.search).get('spot') ?? new URLSearchParams(location.hash.split('?')[1] ?? '').get('spot');
    const ll = q?.split(',').map(Number);
    return ll?.length === 2 && ll.every(Number.isFinite) ? ll : null;
  };
  // the gun hand, in the map's space (for a figure holding nothing)
  const handAt = (p, out) => {
    const hand = p.fig.bones?.RightHand ?? p.fig.hand ?? null;
    if (hand) return toMap(hand.getWorldPosition(out));
    return out.set(...at(p.w, S.R)).add(S.c).addScaledVector(new V(...p.w.n), p.spec.tall * METRE * 0.62);
  };
  // where a shot from p goes: a trooper's chest (the lock's), or straight ahead (the planet's space)
  const shotAt = (p, target) => {
    if (target) return new V(...vec.add(at(target, S.R), target.n, TROOPS[target.kind].tall * 0.55));
    return new V(...vec.add(vec.add(at(p.w, S.R), p.w.n, p.spec.tall * METRE * 0.62), p.w.f, 40 * METRE));
  };
  // the line from p's shoulder to the mark, for aiming the gun
  const shotDir = (p, target) => {
    const from = vec.add(at(p.w, S.R), p.w.n, p.spec.tall * METRE * 0.62);
    return shotAt(p, target).sub(new V(...from)).normalize();
  };

  // where your shot goes now (footAim.js): the camera's ray through the
  // reticle, bent within the input's cone (`snap` for a tap of the fire
  // button), stopped by the first trooper or solid; with `slow`, the look's
  // friction over a trooper. Null with no camera yet.
  const aimNow = (c = cone()) => {
    if (!S.me || !S.cam.pos || !S.cam.look) return null;
    const me = meP();
    const cam = arr(S.cam.pos.clone().sub(S.c));
    const dir = arr(S.cam.look.clone().sub(S.cam.pos).normalize());
    const from = vec.add(at(S.me, S.R), S.me.n, (me?.spec.tall ?? 1.8) * METRE * 0.62);
    const targets = footBodies({ troops: S.troops, R: S.R });
    const r = footAim({ cam, dir, from, targets, solids: footSolids(obstacles(), S.R), cone: c, lock: S.lock, range: BOLT.range, min: 1.5 * METRE });
    r.slow = friction(r.ray.dir, r.ray.from, targets, c);
    return r;
  };

  // a shot by p at `target` (a trooper, or null for straight ahead): the
  // gun kicks and the bolt leaves its muzzle for the mark
  const shoot = (p, target, owner, damage, jitter = 0, mark = null) => {
    let r = p.gp?.fire();
    // out of your own eyes: from the gun you can see
    if (owner === 'me' && vm?.gun.visible && vm.muzzle) {
      vm.gun.updateWorldMatrix(true, true);
      r = { muzzle: vm.muzzle.getWorldPosition(new V()), eject: vm.eject?.getWorldPosition(new V()) ?? null, gun: vm.gun };
    }
    const from = r ? toMap(r.muzzle).sub(S.c) : handAt(p, new V()).sub(S.c).addScaledVector(shotDir(p, target), 0.35 * METRE);
    const dir = (mark ? mark.clone() : shotAt(p, target)).sub(from).normalize();
    if (jitter) dir.add(new V((rand() - 0.5) * jitter, (rand() - 0.5) * jitter, (rand() - 0.5) * jitter)).normalize();
    const b = boltStep.fire({ from: arr(from), dir: arr(dir), speed: BOLT.speed, range: BOLT.range, owner, side: 'you', damage });
    const mesh = takeMesh();
    const color = GUNS[gunOf(p)]?.bolt ?? p.spec.bolt ?? '#ffffff';
    paintBolt(mesh, color);
    mesh.visible = true;
    S.bolts = S.bolts.filter((o) => (o.b === b && o.mesh !== mesh ? (o.mesh.visible = false) : o.mesh !== mesh)); // (a slot or a mesh taken back: the old bolt's gone)
    const near = owner === 'me' && S.cam.first;
    S.bolts.push({ b, mesh, color, flown: 0, hide: near ? 1.6 * METRE : 0, gun: gunOf(p) });
    if (near) mesh.visible = false;
    // the flash at the muzzle, the smoke after a powder gun's, its brass out of the port
    if (r) {
      const gun = p.gp.spec;
      fx.flash(from, dir, gun.flash);
      const up = new V(...vec.unit(arr(from)));
      if (gun.smoke && !near) fx.smoke(from, dir, gun.smoke);
      if (gun.casing && r.eject) fx.casing(toMap(r.eject).sub(S.c), new V(-1, 0, 0).transformDirection(r.gun.matrixWorld).transformDirection(invMap).addScaledVector(dir, -0.3).normalize(), up);
    } else puff(arr(from), color, 0.5);
  };
  // what a shot of p's does: a gadget's more than a blaster's (gunplay.js's GUNS)
  const damageOf = (p) => GUNS[gunOf(p)]?.damage ?? (gunOf(p) === 'bowcaster' ? 2 : 1);

  // ── begin: down onto the planet `id` from where the ship is ──
  // where to come down beside a friend's ship already down (`near`, its { n,
  // f }): alongside it, a ship's length or so off its right, facing the same way
  // (by a trench, their right's toward it: behind them along it instead)
  const beside = (near, kind) => {
    const gap = 0.26 * 0.62 * ((PARKED[near.kind] ?? 1.5) + (PARKED[kind] ?? 1)) + 8 * METRE;
    const o = S.band ? offset(person(near.n, near.f), -gap * 1.6, 0, S.R) : offset(person(near.n, near.f), -2 * METRE, gap, S.R);
    return { n: o.n, f: S.band ? near.f : o.f };
  };
  // `entry` (entry.js's entering(), flown down into the air): where it went
  // in ({ n, h }), how fast and which way (`vel`, `speed`); the ship's flown
  // down to the ground from there instead of set down from where it was
  const begin = ({ id, ship, model, kind, light, near = null, entry = null }) => {
    const planet = planetOf[id];
    const u = byId(id);
    if (!planet || !u || u.kind === 'core' || u.portal || !model) return false; // (a station, or the gate into the galaxy: nowhere to walk)
    S.id = id;
    S.kind = kind;
    S.model = model;
    S.R = u.size;
    S.c.set(...POSITIONS[id]);
    // a trench round its middle: its rim (a little out from the trench run's
    // own walls, so the two don't fight), and how far down they start
    const tr = u.trench ? trenchOf({ at: POSITIONS[id], r: S.R, trench: u.trench }) : null;
    S.band = tr ? { half: tr.width / 2 + 0.03, home: tr.home, arc: tr.arc, deep: TRENCH_MODEL.sink * tr.scale } : null;
    const from = [ship.x, ship.y, ship.z];
    const fwd3 = [-Math.sin(ship.heading), 0, -Math.cos(ship.heading)];
    // beside a friend already down here, or wherever's below, leaning to the
    // day (by a trench: beside it, the door toward it)
    const n0 = landingSpot(from, arr(S.c), light);
    const clear = 0.62 * 0.26 * (PARKED[kind] ?? 1);
    // (flown in through the air: ahead of where it went in, on its way)
    const ahead = entry && !S.band ? entrySpot({ n: entry.n, track: entry.vel, light, speed: entry.speed, R: S.R }) : null;
    S.spot = near ? beside(near, kind) : S.band ? byTrench(n0, S.band, S.R, clear + 12 * METRE) : (ahead ?? { n: n0, f: facingAlong(n0, fwd3) });
    // the part of the planet it's come down on (landings/biomes.js), read
    // off the planet's own map under the spot (a friend's, beside them, so
    // the two of you see the same place); over the sea, on to the nearest land
    const own = u.plated ? null : landingOf(id);
    S.biome = null;
    if (own?.biomes && !S.band) {
      map.updateMatrixWorld();
      let toBody = bodyTurn(planet);
      const forced = near ? null : forcedSpot();
      if (forced) {
        // (the planet turned about its axis, before it's held, so the spot
        // comes round under the sun: in the day, to see it by)
        const want = fromLatLon(...forced);
        const was = turned(toBody, light ? vec.unit([...light]) : S.spot.n);
        planet.body.rotation.y += Math.atan2(was[0], was[2]) - Math.atan2(want[0], want[2]);
        toBody = bodyTurn(planet);
        const fn = turned(toBody.clone().transpose(), want);
        S.spot = { n: fn, f: facingAlong(fn, fwd3) };
      }
      const nb = turned(toBody, (near ?? S.spot).n);
      const down = landOn(own, nb, lookOf(planet, id), { track: turned(toBody, S.spot.f), walk: !near && !forced });
      if (down.n !== nb) {
        const mn = turned(toBody.clone().transpose(), down.n);
        S.spot = { n: mn, f: facingAlong(mn, S.spot.f) };
      }
      S.biome = down.biome;
    }
    const { n } = S.spot;
    // a long way round the planet from where the ship is: it flies round over
    // the surface to get there, rather than through the planet (an entry's
    // own path goes round over the ground already)
    const out = vec.unit(vec.add(from, arr(S.c), -1));
    const round = Math.acos(Math.min(1, Math.max(-1, vec.dot(out, n))));
    S.arc = !entry && round > 0.6 ? { n0: out, h0: vec.len(vec.add(from, arr(S.c), -1)) - S.R, a: round } : null;
    S.from = { p: model.group.position.clone(), q: model.group.quaternion.clone().multiply(new THREE.Quaternion().setFromEuler(model.pivot.rotation)) };
    model.pivot.rotation.set(0, 0, 0);
    model.group.quaternion.copy(S.from.q);
    const box = restOf(model);
    S.rest = -box.min.y * (PARKED[kind] ?? 1) + 0.04 * METRE;
    S.hover = vec.add(vec.scale(n, S.R + 14 * METRE + S.rest), [0, 0, 0]);
    // down through the air on entry.js's path, onto the spot (the land
    // phase's own last frame holds it parked there after, as before)
    S.entry = entry
      ? {
          path: entryPath({ nE: entry.n, hE: entry.h, nS: n, hH: 14 * METRE + S.rest, rest: S.rest, R: S.R, track: entry.vel }),
          t: 0,
          q0: S.from.q.clone(),
          dir: new V(...vec.unit(entry.vel)),
          up: new V(...entry.n),
          fx: null, // fxAt's numbers this frame
          rest: null, // the ship's turn parked on the spot
          glide: null, // the ship's turn as the glide ends, to settle from
          titled: false,
          title: null,
        }
      : null;
    S.sky = S.entry ? 0 : 1;
    S.phase = 'land';
    S.t = 0;
    S.health = FOOT.health;
    S.troops = [];
    S.lead = 0;
    S.done = null;
    S.cam.pitch = 0.22;
    S.cam.pos = null;
    // the planet holds still under you, and its air goes (you're in it)
    planet.hold?.(true);
    if (planet.air) {
      // (flown in, it fades as the sky comes up round the ship instead)
      S.airWas = planet.air.material.uniforms.uStrength.value;
      planet.air.visible = Boolean(S.entry);
    }
    // the ground, the rocks and the air (a station's hull, its blocks and
    // none; and a trench's walls); or the planet's own landing: its ground,
    // its sky and its things, laid out from where the first ship down here
    // came down (a friend's, if you're coming down beside them), as the
    // part of it you've come down on has them
    const landing = viewOf(own, S.biome);
    ground = createGround(planet, u, S.R, S.band, landing?.ground);
    ground.follow(n);
    root.add(ground.mesh);
    if (lp) lp.dispose();
    lp = null;
    physical = false;
    fed = walled = 0;
    shipWalled = false;
    leaves.end();
    S.touched = false;
    S.airH = 0;
    if (landing && furnished(id)) {
      const anchor = near ? { n: near.n, f: near.f } : S.spot;
      physical = bodiesHere() && looseOn(landing);
      const f = furnish({ id, landing, frame: anchor, R: S.R, small, reduced, renderer, physical });
      rocks = { mesh: f.group, solids: f.solids, spots: f.spots, lights: f.lights, bodies: f.bodies, crowns: f.crowns, put: f.put, update: f.update, dispose: f.dispose, built: f.ready, open: f.open };
      // the crowns' wind and tones, laid on the landing's frame, and its
      // fallen leaves (not by a trench: it has none)
      aimCanopy({ n: anchor.n, f: anchor.f, R: S.R });
      S.windBase = landing.wind?.strength ?? 0.45;
      windCanopy({ strength: S.windBase, angle: landing.wind?.angle ?? 0.6 * Math.PI });
      lookCanopy(landing.leaves?.crown);
      if (landing.leaves && !S.band) leaves.begin({ spec: landing.leaves, R: S.R, frame: anchor, seed: landingSeed(id), crowns: f.crowns, focus: S.spot.n });
      // (the engine on its way while the ship comes down)
      if (physical) {
        const mine = rocks;
        preloadPhysics().catch(() => {});
        // (its floor capped round where it's laid out, so what's knocked
        // there sleeps again)
        createLandingPhysics({ R: S.R, threshold: knocks.rules.values().threshold, onHit: heard, spot: anchor.n })
          .then((made) => {
            if (rocks !== mine) made.dispose();
            else lp = made;
          })
          .catch(() => {
            if (rocks === mine) lp = false;
          });
      }
    } else rocks = u.plated ? createHullBits(n, S.R, u, small, S.band, clear) : createRocks(n, S.R, u, small);
    // (out of sight till it's all been readied: below)
    rocks.ready = false;
    rocks.mesh.visible = false;
    root.add(rocks.mesh);
    // (flown in, the ground's out of sight till the clouds, stepEntry)
    if (S.entry) ground.mesh.visible = false;
    // (the sky from the planet's own air, where it has one: landings/sky.js)
    // (a biome may bring its own air along the horizon: Mordor's fumes)
    haze = u.airless ? null : landing?.sky ? createSky(landing.sky, landing.sky.haze ?? u.rim ?? u.swatch ?? '#8ab4ff', { air: u.air ?? null }) : createHaze(u.rim ?? u.swatch ?? '#8ab4ff');
    if (haze) root.add(haze.mesh);
    // (flown in, dark to start with: the entry starts in the middle of a
    // frame, before day() has had its say, and that frame's drawn too)
    if (haze && S.entry) haze.mat.uniforms.uDay.value = 0;
    // the place's name: flown in, once it's out under the clouds
    if (landing && S.entry) S.entry.title = { title: landing.title, sub: landing.sub };
    else if (landing) emit({ type: 'foot', id: 'arrive', title: landing.title, sub: landing.sub });
    if (S.entry) reentry.start({ cloud: landing?.sky?.horizon ?? '#e9eef4' });
    sides =S.band ? createTrenchSides(n, S.R, S.band) : null;
    if (sides) root.add(sides.mesh);
    // the whole landing readied at once, while the ship comes down: once
    // its things are all in, the ground, the sky, the things and the beacon
    // over the door have their pictures sent and their shaders made (the
    // map's prepare, a slice at a time), and the things are shown together,
    // their solids and doors with them, rather than each popping in as its
    // own shaders were made. (The ground and the sky show from the start,
    // as before: the frame guard draws them as soon as they're ready.) A
    // thing that's very slow to come (a model on a slow line) isn't waited
    // for past LAND.ready: what's in is shown, and it comes as it may.
    // (the ground, the sky and the trench's sides readied first, at once,
    // not after the things: flown in, the ground's hidden till the clouds
    // part, 2.8 s in, which the things may well not be in by)
    const these = rocks;
    const mine = () => rocks === these;
    const early = prepare ? Promise.resolve(prepare([ground.mesh, haze?.mesh, sides?.mesh, leaves.on && leaves.mesh].filter(Boolean), mine)).catch(() => {}) : null;
    within(these.built, LAND.ready * 1000)
      .then(() => early)
      .then(() => (mine() && prepare ? prepare([these.mesh], mine) : null))
      .catch(() => {})
      .then(() => {
        if (!mine()) return;
        these.ready = true;
        these.open?.();
        showRocks();
      });
    // (the planet's own model goes once the camera's low enough that the
    // patch reaches past the horizon: under it, it's only drawn for nothing.
    // On a planet, past it all round wherever you are on the patch, which is
    // laid again once you're 0.3 of its radius from its middle, the camera
    // a few metres behind you: 0.65 of its radius. A station's as it was.
    // On a planet only its sphere goes, by its layers, which three tests an
    // object at a time: what's put on it, the serpents round Snake Planet,
    // the gaming world's blocks, stays.)
    S.bodyShown = planet.body?.visible ?? true;
    S.bodyMask = planet.body?.layers.mask ?? 1;
    S.bodyAll = Boolean(u.plated);
    S.hideBody = u.plated ? (0.8 * HULL_PATCH.radius) ** 2 / (2 * S.R) : (0.65 * PATCH.radius) ** 2 / (2 * S.R);
    root.position.copy(S.c);
    root.visible = true;
    party = null;
    const here = () => S.id === id && Boolean(S.phase);
    load(kind).then(async (p) => {
      // (readied while the ship comes down, as the landing is, so no one
      // steps out of the door with a shader still to make; not waited for
      // past LAND.party)
      if (prepare && here()) await within(prepare(p.map((o) => o.group), here), LAND.party * 1000);
      if (!here()) {
        for (const o of p) {
          root.remove(o.group);
          o.gp?.dispose();
          o.fig.dispose?.();
        }
        return;
      }
      party = p;
    });
    return true;
  };

  // the landing's things, once they're readied (and, flown in, out under the clouds)
  const showRocks = () => {
    if (rocks) rocks.mesh.visible = rocks.ready && (!S.entry || S.entry.t >= 0.6 * ENTRY.glide);
  };

  // the ship along its way down (k 0…1): over to above the spot, and down
  // onto it, turning to sit level on the ground, growing to its parked size
  const shipAt = (k, out = new V()) => {
    if (S.arc) {
      // round over the planet: along the great circle from above where it
      // was to the spot, up over the curve and down
      const { n0, h0, a } = S.arc;
      const s0 = Math.sin(a) || 1;
      const nk = vec.add(vec.scale(n0, Math.sin((1 - k) * a) / s0), S.spot.n, Math.sin(k * a) / s0);
      const h = h0 + (S.rest - h0) * k + Math.sin(Math.PI * k) * (S.R * a * 0.25);
      return out.set(...vec.scale(nk, S.R + h)).add(S.c);
    }
    const P0 = S.from.p.clone().sub(S.c);
    const H = new V(...S.hover);
    const P1 = new V(...S.spot.n).multiplyScalar(S.R + S.rest);
    const a = 1 - k;
    return out.copy(P0).multiplyScalar(a * a).addScaledVector(H, 2 * a * k).addScaledVector(P1, k * k).add(S.c);
  };

  const placeShip = (k) => {
    const m = S.model;
    const e = ease(k);
    shipAt(e, m.group.position);
    m.group.quaternion.copy(S.from.q).slerp(shipFrame(S.spot.n, S.spot.f), smooth(0, 0.75, k));
    m.group.scale.setScalar(1 + ((PARKED[S.kind] ?? 1) - 1) * smooth(0.2, 0.9, k));
    m.pivot.rotation.set(0, 0, 0);
  };

  // ── Flown in through the air: entry.js's path, reentry.js's show ──
  // the ship's turn along the way it's going: its nose down the path, its
  // top as near the ground's up as that allows
  const pathFrame = (dir, up, out) => {
    pathUp.copy(up).addScaledVector(dir, -up.dot(dir));
    if (pathUp.lengthSq() < 1e-8) pathUp.set(...flat([0, 1, 0], arr(dir))); // (straight down: any way round)
    pathUp.normalize();
    basis.makeBasis(pathRight.crossVectors(dir, pathUp), pathUp, pathBack.copy(dir).negate());
    return out.setFromRotationMatrix(basis);
  };
  const pathUp = new V();
  const pathRight = new V();
  const pathBack = new V();
  const entryAt = new V();
  const entryNext = new V();
  const entryQ = new THREE.Quaternion();
  const entryRoll = new THREE.Quaternion();
  const NOSE_AXIS = new V(0, 0, 1);
  const stepEntry = (dt) => {
    const e = S.entry;
    const m = S.model;
    e.t = Math.min(e.path.T, e.t + dt);
    const a = e.path.at(e.t);
    entryAt.set(...a.p);
    e.up.set(...a.n);
    // which way it's going: toward where it'll be a moment on, never looking
    // past the glide's end into the settle (straight down: that would tip
    // the nose over as it comes to a stop); while it settles, it keeps the
    // way it was going
    entryNext.set(...e.path.at(Math.min(ENTRY.glide, e.t + 0.08)).p).sub(entryAt);
    if (!a.settling && entryNext.lengthSq() > 1e-10) e.dir.copy(entryNext).normalize();
    e.fx = fxAt(e.t);
    m.group.position.copy(entryAt).add(S.c);
    m.pivot.rotation.set(0, 0, 0);
    if (!a.settling) {
      pathFrame(e.dir, e.up, entryQ);
      // shaken about in the burn (not with reduced motion)
      if (!reduced && e.fx.burn > 0) entryQ.multiply(entryRoll.setFromAxisAngle(NOSE_AXIS, (Math.sin(e.t * 23) * 0.05 + Math.sin(e.t * 9.7 + 1) * 0.04) * e.fx.burn));
      // round from the way it was flying onto the path, at first
      m.group.quaternion.copy(e.q0).slerp(entryQ, smooth(0, 0.6, e.t));
      (e.glide ??= new THREE.Quaternion()).copy(m.group.quaternion);
    } else {
      // over the spot: down onto it, turning to sit level on the ground
      e.rest ??= shipFrame(S.spot.n, S.spot.f);
      m.group.quaternion.copy(e.glide ?? e.q0).slerp(e.rest, smooth(0, 0.8, (e.t - ENTRY.glide) / ENTRY.settle));
    }
    // grown to its parked size in the clouds, where it can't be seen to
    // (fxAt's white-out is thickest from 0.52 to 0.74 of the glide)
    m.group.scale.setScalar(1 + ((PARKED[S.kind] ?? 1) - 1) * smooth(0.52 * ENTRY.glide, 0.74 * ENTRY.glide, e.t));
    // the landing itself (its ground and what stands on it) only from the
    // thick of the clouds (fxAt's white-out peaks at 0.62 of the glide): from
    // higher up it's a patch on the planet's own map, and it's in the clouds
    // that the one becomes the other
    const shown = e.t >= 0.6 * ENTRY.glide;
    for (const x of [ground, sides]) if (x) x.mesh.visible = shown;
    showRocks();
    // the sky comes up round it, and the halo it flew into goes
    S.sky = e.fx.sky;
    const air = planetOf[S.id]?.air;
    if (air?.visible) air.material.uniforms.uStrength.value = S.airWas * (1 - e.fx.sky);
    // the place's name, out under the clouds
    if (!e.titled && e.fx.title) {
      e.titled = true;
      if (e.title) emit({ type: 'foot', id: 'arrive', ...e.title });
    }
    if (!a.done) return;
    // down: parked where the land phase leaves a ship, waiting on the crew
    S.entry = null;
    S.sky = 1;
    reentry.stop();
    if (air) {
      // (gone while you're down, as bright as it was for when it's back:
      // the map's hover and picking set it from here on, as before)
      air.visible = false;
      air.material.uniforms.uStrength.value = S.airWas;
    }
    S.from = { p: m.group.position.clone(), q: m.group.quaternion.clone() };
    S.t = LAND.down;
    placeShip(1);
    // (down on the leaves: they're blown out from under it)
    S.touched = true;
    leaves.blast(vec.scale(S.spot.n, S.R), 7, 12);
  };
  // the show, once the camera's where it is this frame (view())
  const entryCam = { pos: new V(), look: new V(), up: new V() };
  const entryView = { t: 0, T: 0, fx: null }; // what entry() hands the scene
  const spotN = new V();
  const spotF = new V();
  const landCam = new V();
  const showEntry = (dt) => {
    const e = S.entry;
    if (!e?.fx || !S.cam.pos) return;
    entryCam.pos.copy(S.cam.pos).sub(S.c);
    entryCam.look.copy(S.cam.look).sub(S.c);
    entryCam.up.copy(S.cam.up);
    reentry.update(dt, { ship: entryAt, dir: e.dir, up: e.up, size: 0.26 * S.model.group.scale.x, cam: entryCam, fx: e.fx, t: e.t });
  };

  // the people out of the door: beside the ship, on its right
  const doorSpot = (side = 1) => {
    const half = 0.62 * 0.26 * (PARKED[S.kind] ?? 1);
    const ship = person(S.spot.n, S.spot.f);
    const out = offset(ship, -half * 0.15, side * (half + 0.8 * METRE), S.R);
    return person(out.n, vec.add(vec.scale(rightOf(ship), side), ship.f, 0.3));
  };
  const shipObstacle = () => ({ n: S.spot.n, r: 0.62 * 0.26 * (PARKED[S.kind] ?? 1) * 0.55 });

  const startOut = () => {
    const [a, b] = party;
    S.me = { id: 'me', ...doorSpot(1) };
    S.airH = 0;
    S.mate = b ? { id: 'mate', ...offset(S.me, -0.9 * METRE, 1.1 * METRE, S.R), f: S.me.f, h: 0, vh: 0, speed: 0, side: 0 } : null;
    if (S.mate) S.mate = { ...person(S.mate.n, S.me.f), id: 'mate' };
    a.w = S.me;
    if (b) b.w = S.mate;
    for (const p of party) p.group.visible = true;
    S.phase = 'out';
    S.t = 0;
    S.nextSquad = S.clock + 12 + rand() * 8;
    S.cleared = true;
  };

  // who you're playing, and who's with you (the swap changes which is which)
  const meP = () => party?.[S.lead] ?? null;
  const gunOf = (p) => p?.gp?.kind ?? p?.spec.gun ?? null; // (what p has in hand: Rick's gadget, as B left it)
  const mateP = () => party?.[1 - S.lead] ?? null;

  // (the other pilots' ships down here too)
  // (the landing's loose things not yet bodies, the engine still loading, as solid as the rest)
  const unfed = () => (rocks?.bodies && fed < rocks.bodies.length ? rocks.bodies.slice(fed).flatMap((b) => b.solids) : []);
  const obstacles = () => [shipObstacle(), ...(rocks?.solids ?? []), ...unfed(), ...[...guests.values()].flatMap((g) => (g.ship ? [g.ship] : [])), ...(S.band ? [{ band: S.band }] : [])];

  const troopsAlive = () => S.troops.filter((t) => t.alive);
  // a turn round (dx) and up or down (dy), radians: a drag's or a locked pointer's
  const turnBy = (dx, dy) => {
    if (!S.me || S.phase !== 'walk') return;
    // (slower over a trooper with a gun in hand: aim.js's friction)
    const k = meP()?.spec.gun ? (S.aimed?.slow ?? 1) : 1;
    dx *= k;
    dy *= k;
    S.me = { ...S.me, f: vec.unit(rotateAbout(S.me.f, S.me.n, -dx)) };
    S.cam.pitch = Math.min(CAM.pitch[1], Math.max(CAM.pitch[0], S.cam.pitch + dy));
  };

  // the nearest of the landing's spots you're within reach of (a door, someone to talk to)
  const nearSpot = () => {
    if (!S.me || !rocks?.spots?.length) return null;
    let best = null;
    let bd = Infinity;
    for (const s of rocks.spots) {
      const d = apart(S.me, s, S.R);
      if (d <= s.r && d < bd) {
        bd = d;
        best = s;
      }
    }
    return best;
  };

  // ── other pilots' crews, down here too ──
  const guests = new Map(); // pilot id → { name, ally, dim, walkers: [{ who, spec, fig, group, gun, label, w, to, alt }] }
  const tagTexture = (text, colour) => {
    const c = document.createElement('canvas');
    c.width = 768;
    c.height = 96;
    const x = c.getContext('2d');
    x.font = '600 38px system-ui, -apple-system, Segoe UI, sans-serif';
    const w = Math.min(760, x.measureText(text).width + 44);
    x.fillStyle = 'rgba(8, 10, 16, 0.72)';
    x.beginPath();
    x.roundRect?.((768 - w) / 2, 14, w, 68, 34);
    if (!x.roundRect) x.rect((768 - w) / 2, 14, w, 68);
    x.fill();
    x.fillStyle = colour;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText(text, 384, 49, 740);
    const t = new THREE.CanvasTexture(c);
    sharpen(t);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const tagFor = (text, colour) => {
    const m = new THREE.SpriteMaterial({ map: tagTexture(text, colour), transparent: true, depthWrite: false, sizeAttenuation: false, toneMapped: false });
    const sprite = new THREE.Sprite(m);
    sprite.center.set(0.5, 0);
    sprite.scale.set(0.27, 0.034, 1); // (a share of the view's height, whatever the distance)
    sprite.renderOrder = 5;
    return sprite;
  };
  const dropTag = (sprite) => {
    root.remove(sprite);
    sprite.material.map.dispose();
    sprite.material.dispose();
  };
  // the same person from another dimension: everything they're made of in
  // that dimension's light
  const otherDimension = (group, hue, own) => {
    const tint = new THREE.Color().setHSL(hue, 0.5, 0.9); // (a wash of it: still themselves)
    const glow = new THREE.Color().setHSL(hue, 0.9, 0.4);
    const remake = (m) => {
      const c = m.clone();
      c.color?.multiply(tint);
      if (c.emissive) {
        c.emissive.copy(glow);
        c.emissiveIntensity = 0.12;
      }
      own.push(c);
      return c;
    };
    group.traverse((o) => {
      if (o.isMesh && o.material) o.material = Array.isArray(o.material) ? o.material.map(remake) : remake(o.material);
    });
  };
  const guestWalker = (g, who, alt) => {
    const spec = SPEC[who];
    const wk = { who, spec, fig: null, group: new THREE.Group(), gp: null, label: null, w: null, to: null, alt, own: [] };
    wk.group.visible = false;
    root.add(wk.group);
    (async () => {
      if (spec.src.meshy) await cast?.load(null, [spec.src.meshy]).catch(() => {});
      const fig = (cast && (await loadParty(spec, cast, g.looks ?? readLooks(null), { templates: partyModels }).catch(() => null))) ?? built({ ...spec, src: { built: spec.id === 'artoo' ? 'artoo' : 'han' } }); // (in their own looks: the show’s, if they’ve sent none)
      if (!guests.has(g.id) || !g.walkers.includes(wk)) return fig.dispose?.();
      wk.fig = fig;
      wk.group.add(fig.model);
      if (wk.alt) otherDimension(fig.model, g.dim.hue, wk.own);
      if (spec.gun) wk.gp = createGunplay(fig, fig.gun ?? spec.gun, { unit: METRE, who: fig.built ? 'built' : spec.id });
    })();
    return wk;
  };
  const dropWalker = (g, wk, i) => {
    root.remove(wk.group);
    wk.gp?.dispose();
    wk.fig?.dispose?.();
    if (wk.label) dropTag(wk.label);
    for (const o of wk.own) o?.dispose?.();
    dropShadow(`guest:${g.id}:${i}`);
  };
  const dropGuest = (g) => {
    g.walkers.forEach((wk, i) => wk && dropWalker(g, wk, i));
    guests.delete(g.id);
  };
  // who's here already, as people: yours, and every guest's met so far
  const here = (except) => {
    const out = new Set((party ?? []).map((p) => p.spec.id));
    for (const g of guests.values()) if (g !== except) for (const wk of g.walkers) if (wk) out.add(wk.who);
    return out;
  };
  // each frame: the pilots down on this planet now ({ id, name, ally, foot }),
  // their crews brought in, moved on, or gone
  const setGuests = (list) => {
    const want = new Map();
    for (const o of list ?? []) if (o.foot?.planet === S.id && o.foot.lead) want.set(o.id, o);
    for (const g of [...guests.values()]) if (!want.has(g.id)) dropGuest(g);
    if (!S.phase || S.phase === 'lift' || !party) return; // (yours first, to know who's a double)
    for (const o of want.values()) {
      let g = guests.get(o.id);
      if (!g) {
        g = { id: o.id, name: o.name, ally: o.ally, dim: dimensionOf(o.id), walkers: [null, null], said: false };
        guests.set(o.id, g);
      }
      g.name = o.name;
      g.ally = o.ally;
      g.looks = o.looks ?? null; // (how they dress their Rick and Morty, their Walt and Jesse)
      g.ship = { n: o.foot.ship.n, r: 0.62 * 0.26 * (PARKED[o.foot.kind] ?? 1) * 0.55 };
      [o.foot.lead, o.foot.mate].forEach((to, i) => {
        let wk = g.walkers[i];
        if (wk && (!to || to.who !== wk.who)) {
          dropWalker(g, wk, i);
          wk = g.walkers[i] = null;
        }
        if (!to || !SPEC[to.who]) return;
        if (!wk) {
          wk = g.walkers[i] = guestWalker(g, to.who, here(g).has(to.who));
          const who = `${wk.spec.name}${wk.alt ? ` of ${g.dim.code}` : ''}`;
          wk.label = tagFor(i === 0 ? `${who} · ${g.name ?? 'a pilot'}` : who, g.ally ? '#8dff9a' : wk.alt ? `hsl(${Math.round(g.dim.hue * 360)}, 90%, 72%)` : '#ffffff');
          root.add(wk.label);
        }
        // (a new word from them: when it came, for an emote timed from then)
        if (wk.to !== to) wk.toAt = S.clock;
        wk.to = to;
      });
      // your crew have something to say about who's turned up (once you're out)
      const first = g.walkers[0];
      if (!g.said && first && S.phase === 'walk') {
        g.said = true;
        const alt = g.walkers.find((wk) => wk?.alt);
        emit({ type: 'foot', id: alt ? 'alt' : 'friend', who: (alt ?? first).who, name: g.name });
        // (your mate waves them over, or starts at a double of itself)
        const m = mateP();
        if (m && S.mateSt.downAt == null) {
          if (alt && SCARED.has(m.spec.id)) m.fig.react?.('gunfire');
          else m.fig.play?.('wave', { layer: 'upper' })?.catch?.(() => {});
        }
      }
    }
  };
  const guestsFrame = (dt) => {
    const k = 1 - Math.exp(-dt * 10);
    const mix = (a, b) => a + (b - a) * k;
    for (const g of guests.values()) {
      g.walkers.forEach((wk, i) => {
        if (!wk?.to) return;
        const to = wk.to;
        // eased on toward where they last said they were (a jump, straight there)
        if (!wk.w || apart(wk.w, to, S.R) > 6 * METRE) wk.w = { ...to };
        else {
          const n = vec.unit(vec.add(wk.w.n, vec.add(to.n, wk.w.n, -1), k));
          const f0 = vec.add(wk.w.f, vec.add(to.f, wk.w.f, -1), k);
          wk.w = { n, f: vec.unit(vec.add(f0, n, -vec.dot(f0, n))), h: mix(wk.w.h, to.h), speed: mix(wk.w.speed, to.speed), side: mix(wk.w.side, to.side), aim: mix(wk.w.aim, to.aim) };
        }
        const w = wk.w;
        const show = Boolean(wk.fig);
        wk.group.visible = show;
        if (show) {
          stand(wk.group, w);
          // what their body's doing, as they said: a flinch, a fall (over the
          // way they face), an emote timed from when their word came in and
          // played once (footLife.js's readWalkerExtras, lib/emote.js)
          const x = readWalkerExtras(to);
          const n = new V(...w.n);
          if (x.down > 0) {
            wk.group.quaternion.premultiply(fallTurn(x.down, pushOf(w, null), n));
            wk.group.position.addScaledVector(n, wk.spec.tall * METRE * 0.05 * smooth(0.5, 1, x.down));
          }
          wk.emote = heardEmote(readEmoteWire(x.emote), wk.toAt ?? S.clock, wk.emote ?? null);
          wk.shown = applyEmote(wk.fig, readEmote(wk, S.clock), wk.shown ?? null);
          const frame = { forward: dirToWorld(new V(...w.f)), up: dirToWorld(n.clone()) };
          const motion = { speed: w.speed ?? 0, side: w.side ?? 0, turn: turnRate(wk, w, dt), air: (w.h ?? 0) / METRE, hurt: x.hurt, down: x.down, knock: 0.5 };
          wk.fig.update(dt, Math.min(1, Math.abs(w.speed) / FOOT.run + Math.abs(w.side) / FOOT.run), motion);
          wk.group.updateMatrixWorld(true);
          wk.fig.after?.(dt, motion, frame);
          // their gun as they said: up and along the way they face, or down
          wk.gp?.set(dt, { aim: w.aim, forward: frame.forward, up: frame.up });
        }
        shadow(`guest:${g.id}:${i}`, w, wk.spec.tall * 0.55).visible = show;
        // the tag over their head, near enough to read
        if (wk.label) {
          wk.label.position.set(...vec.add(at(w, S.R), w.n, wk.spec.tall * METRE * 1.12));
          wk.label.visible = show && Boolean(S.me) && apart(S.me, w, S.R) < GUEST_FAR * METRE;
        }
      });
    }
  };
  // (and what the body's doing, beside where it is: your emote, a flinch, a fall: footLife.js's walkerExtras)
  const walker = (w, p, aim, extras = {}) => (w && p ? { who: p.spec.id, n: w.n, f: w.f, h: w.h ?? 0, speed: w.speed ?? 0, side: w.side ?? 0, aim, ...walkerExtras(extras) } : null);


  // ── each frame ──
  // (a landing with anything loose on it: else there's nothing to load the engine for)
  const looseOn = (landing) => [...(landing.things ?? []), ...(landing.scatter ?? [])].some((t) => bodyOf(t.kind, landing.models?.[t.kind]));
  // (loose things as bodies: anywhere but a phone or Data Saver)
  const bodiesHere = () => {
    try {
      const d = device();
      return !d.phone && !d.saveData;
    } catch {
      return false;
    }
  };
  // a hard knock on a loose thing (landings/knocks.js, lib/three/impacts.js):
  // a thud where it was round your ears, a puff of dust rising off the
  // ground there, and a nudge of the camera's own kick for a near one. All
  // of it in metres in the planet's space (the dust's mesh is scaled to the
  // map), so the hit law's numbers are a barrel's.
  const knocks = createKnocks({
    dust: (() => {
      const d = createDust({ count: small ? 96 : 192 });
      d.mesh.scale.setScalar(METRE);
      root.add(d.mesh);
      return d;
    })(),
    listener: () => (S.me ? { position: at(S.me, S.R).map((a) => a / METRE), forward: S.me.f, up: S.me.n } : null),
    toWorld: (p) => p.map((a) => a / METRE),
    up: (p) => vec.unit(p),
    me: () => (S.me ? at(S.me, S.R) : null),
    metre: METRE,
    kick: (v) => (S.cam.kick.v += v),
    reduced,
  });
  const heard = knocks.heard;
  // the landing's bodies, a frame: any new ones in, the people where the
  // walk has them, a step, and what moved stood where it went
  const physicsFrame = (dt) => {
    const list = rocks?.bodies;
    if (!list) return;
    if (lp === false) {
      // (no engine: they stand solid, as they always did)
      for (; fed < list.length; fed++) rocks.solids.push(...list[fed].solids);
      return;
    }
    if (!lp) return;
    // (a few dozen a frame: a field of them arriving at once doesn't hitch)
    for (let k = 0; fed < list.length && k < 60; fed++, k++) {
      const b = list[fed];
      // (a fixed one walls the walk as well: its post stops what's knocked,
      // but nothing in the engine stops a walker; its circle a bolt passes,
      // as its own body, the pole you see, is what stops one: lp.shot)
      if (!lp.add({ position: b.position, quaternion: b.quaternion, scale: b.scale, box: b.box, body: b.body, user: b })) rocks.solids.push(...b.solids);
      else if (b.body.fixed) rocks.solids.push(...b.solids.map((o) => ({ ...o, pass: true })));
    }
    // the fixed things (their walk circles, as they arrive) and the parked
    // ship, as walls: what's knocked stops at them
    if (walled < rocks.solids.length) {
      lp.walls(rocks.solids.slice(walled).filter((o) => o.n && o.r));
      walled = rocks.solids.length;
    }
    if (!shipWalled && (S.phase === 'out' || S.phase === 'walk')) {
      shipWalled = true;
      lp.walls([shipObstacle()]);
    }
    const people = [];
    const walking = S.phase === 'out' || S.phase === 'walk' || S.phase === 'board';
    if (walking && S.me) people.push({ key: 'me', at: at(S.me, S.R), up: S.me.n });
    if (walking && S.mate) people.push({ key: 'mate', at: at(S.mate, S.R), up: S.mate.n });
    for (const tr of S.troops) if (tr.alive) people.push({ key: tr.id, at: at(tr, S.R), up: tr.n });
    lp.people(people, dt);
    lp.step(dt);
    lp.sync((entry, p, q) => rocks.put(entry.user, p, q));
    // (beyond a bolt's reach, 96 m: nothing out there is still moving)
    if (S.me && S.clock - settled > 1) {
      settled = S.clock;
      lp.settle(at(S.me, S.R), 120);
    }
  };

  // the leaves, a frame: about you once you're out (the ship till then),
  // kicked by everyone walking here, none under the parked ship
  const OUT_PHASES = ['out', 'walk', 'board', 'down'];
  const seeAt = new V();
  const sunAt = new V();
  const leafWalkers = [];
  const leavesFrame = (dt) => {
    if (!leaves.on) return;
    const out = Boolean(S.me) && OUT_PHASES.includes(S.phase);
    leafWalkers.length = 0;
    if (out) {
      // (each by who they are, not by who you play: a swap isn't a run)
      leafWalkers.push({ key: party?.[S.lead]?.spec.id ?? 'me', n: S.me.n, h: S.me.h ?? 0 });
      if (S.mate) leafWalkers.push({ key: party?.[1 - S.lead]?.spec.id ?? 'mate', n: S.mate.n, h: S.mate.h ?? 0 });
    }
    for (const t of S.troops) if (t.alive) leafWalkers.push({ key: t.id, n: t.n, h: t.h ?? 0 });
    for (const g of guests.values()) g.walkers.forEach((wk, i) => wk?.w && wk.group?.visible && leafWalkers.push({ key: `g${g.id}:${i}`, n: wk.w.n, h: wk.w.h ?? 0 }));
    leaves.update(dt, {
      focusN: out ? S.me.n : S.spot.n,
      facing: out ? S.me.f : S.spot.f,
      walkers: leafWalkers,
      hole: S.phase === 'land' || S.phase === 'lift' ? null : { n: S.spot.n, r: shipObstacle().r },
    });
    leaves.mesh.visible = Boolean(ground?.mesh.visible);
  };

  const update = (dt, t, input = {}) => {
    if (!S.phase) return false;
    S.clock += dt;
    S.t += dt;
    // (the map's own matrix and this scene's, not everything in the
    // universe: the frame's drawing brings that up to date, once, and
    // what's here that moves is brought up to date where it's moved)
    root.updateWorldMatrix(true, false);
    invMap.copy(map.matrixWorld).invert();
    // the ground's map follows the planet's held turn
    const planet = planetOf[S.id];
    if (ground && planet?.body) {
      ground.sync(bodyTurn(planet));
    }
    ground?.tick(S.clock);
    // the crowns' wind, rising and falling round the landing's (not with
    // motion turned down); and a crown between the camera and you opened
    // round your chest (not out of your own eyes)
    if (!reduced && rocks?.crowns) {
      windCanopy({ strength: weatherWind(S.clock, S.windBase) });
      tickCanopy(dt);
    }
    const chest = S.me && !S.cam.first && OUT_PHASES.includes(S.phase);
    seeCanopy(chest ? root.localToWorld(seeAt.set(...vec.add(at(S.me, S.R), S.me.n, 1.2 * METRE))) : null);
    // (the landing's things, told where your head is: the people there turn to you)
    rocks?.update?.(S.clock, dt, S.me && S.phase === 'walk' ? { me: root.localToWorld(new V(...vec.add(at(S.me, S.R), S.me.n, 1.6 * METRE))) } : null);
    // (and their lights through the map's, the nearest you first: you, or the camera till you're out)
    if (rocks?.lights) lamps.drive(rocks.lights, S.me ? root.localToWorld(lampAt.set(...at(S.me, S.R))) : S.cam.pos ? map.localToWorld(lampAt.copy(S.cam.pos)) : root.getWorldPosition(lampAt));

    if (S.phase === 'land' && S.entry) {
      stepEntry(dt);
    } else if (S.phase === 'land') {
      const k = Math.min(1, S.t / LAND.down);
      placeShip(k);
      // (down on the leaves: they're blown out from under it)
      if (k >= 1 && !S.touched) {
        S.touched = true;
        leaves.blast(vec.scale(S.spot.n, S.R), 7, 12);
      }
      if (k >= 1 && party) startOut();
      else if (k >= 1 && S.t > LAND.down + 8) {
        // they never came: take off again
        S.phase = 'lift';
        S.t = 0;
      }
    } else if (S.phase === 'out') {
      // out of the door and a few steps away
      const k = Math.min(1, S.t / LAND.out);
      S.me = walk(S.me, { move: k < 0.9 ? 0.6 : 0 }, dt, S.R, obstacles());
      if (S.mate) S.mate = walk(S.mate, { move: k < 0.8 ? 0.5 : 0 }, dt, S.R, obstacles());
      if (k >= 1) {
        S.phase = 'walk';
        S.t = 0;
        emit({ type: 'foot', id: 'out' });
      }
    } else if (S.phase === 'walk') {
      walkFrame(dt, input);
    } else if (S.phase === 'down') {
      // (nobody marches while you're down, so the fallen's clocks run here)
      for (const o of S.troops) if (!o.alive) o.dead += dt;
      if (S.t > LAND.fall) {
        // back on your feet by the ship
        S.me = { ...doorSpot(1), id: 'me' };
        S.airH = 0;
        if (S.mate) S.mate = { ...person(offset(S.me, -0.9 * METRE, 1.1 * METRE, S.R).n, S.me.f), id: 'mate' };
        S.health = FOOT.health;
        S.phase = 'walk';
        S.t = 0;
        emit({ type: 'foot', id: 'up' });
      }
    } else if (S.phase === 'board') {
      // back to the door, and in
      const door = doorSpot(1);
      for (const key of ['me', 'mate']) {
        const w = S[key];
        if (!w) continue;
        S[key] = walk(w, { move: 0.8, turn: turnToward(w, vec.add(door.n, w.n, -1), 4) }, dt, S.R);
      }
      if (S.t > LAND.board) {
        for (const p of party ?? []) p.group.visible = false;
        for (const [key, m] of blobs) if (key.startsWith('party')) m.visible = false;
        S.phase = 'lift';
        S.t = 0;
        S.from = { p: S.model.group.position.clone(), q: S.model.group.quaternion.clone() };
        // (and off them, blowing them out again)
        leaves.blast(vec.scale(S.spot.n, S.R), 7, 12);
      }
    } else if (S.phase === 'lift') {
      liftFrame();
    }
    physicsFrame(dt);
    // the figures where the people are
    if (party && S.phase !== 'land' && S.phase !== 'lift') drawPeople(dt);
    drawTroops(dt);
    guestsFrame(dt);
    moveBolts(dt);
    fx.update(dt);
    pfx.update(dt);
    gfx.update(dt);
    knocks.update(dt);
    leavesFrame(dt);
    spring(S.cam.kick, dt, 240, 22);
    for (const s of puffs) {
      if (!s.visible) continue;
      s.userData.age += dt / 0.35;
      if (s.userData.age >= 1) s.visible = false;
      s.scale.setScalar(s.userData.size * (0.6 + s.userData.age * 1.6));
      s.material.opacity = (1 - s.userData.age) ** 2;
    }
    if (S.me) ground?.follow(S.me.n);
    return true;
  };

  // ── your body: emotes and reactions ──
  // Hold Z for the wheel (lib/emote.js's: wave, cheer, dance, taunt, sit),
  // 1 to 5 picks one while it's open, let go for the last; a tap does the
  // last again. An emote lasts its clip (a wave goes on as you walk, the
  // rest stop when you move), and anything you do cuts it, as it cuts a
  // reaction of yours (a flinch, a cheer)
  const emotes = createEmoteWheel();
  let emoteShown = null;
  let emoteFig = null; // (whose figure it's on: a swap leaves it with them)
  let wheelSaid = { open: false, hover: null, last: emotes.last, on: null };
  const startEmote = (id) => {
    if (S.phase !== 'walk' || !id) return false;
    cutReaction();
    S.emote = { id, at: S.clock };
    S.emoteAt = S.clock;
    return true;
  };
  const endEmote = () => {
    S.emote = null;
    emoteShown = applyEmote(emoteFig, null, emoteShown);
  };
  const stepBody = (input) => {
    const moving = Math.abs(input.move ?? 0) > 0.1 || Math.abs(input.strafe ?? 0) > 0.1 || Boolean(input.jump);
    const acted = S.acted;
    S.acted = false;
    if (S.wheelHeld || emotes.open) emotes.tick(S.clock);
    const r = S.reacting;
    if (r && (acted || (r.layer === 'full' && moving) || S.clock > r.until)) cutReaction();
    S.emote = keepEmote(S.emote, S.clock, { moving, acted });
    const me = meP();
    if (emoteFig !== me?.fig && emoteShown) endEmote();
    emoteFig = me?.fig ?? null;
    emoteShown = applyEmote(emoteFig, S.emote ? readEmote({ emote: S.emote }, S.clock) : null, emoteShown);
    const on = S.emote?.id ?? null;
    const w = wheelSaid;
    if (w.open !== emotes.open || w.hover !== emotes.hover || w.last !== emotes.last || w.on !== on) {
      wheelSaid = { open: emotes.open, hover: emotes.hover, last: emotes.last, on };
      emit({ type: 'foot', id: 'emote', ...wheelSaid });
    }
  };

  const jumpKey = createJump();
  // a landing's squash (squash.js): yours, by how fast you came down; none with reduced motion
  const squash = createSquash();
  const walkFrame = (dt, input) => {
    const me = meP();
    stepBody(input);
    // you: walking, turning, running, jumping (the jump a press, lib/press.js's createPress through
    // foot.js's createJump: once a key-down, and a hair early still lands)
    jumpKey.hold(input.jump);
    const fell = (S.me.h ?? 0) > 0 ? -(S.me.vh ?? 0) : 0;
    S.me = walk(S.me, { move: input.move, strafe: input.strafe, turn: input.turn, run: input.run, jump: jumpKey.press }, dt, S.R, obstacles());
    if (fell > 0 && !(S.me.h > 0) && !reduced) squash.land(fell / METRE);
    // (down from a jump of any height: the leaves under you thrown out)
    if (S.me.h > 0) S.airH = Math.max(S.airH, S.me.h);
    else {
      if (S.airH > 0.3 * METRE) leaves.blast(at(S.me, S.R), 1.2, 12);
      S.airH = 0;
    }
    // the lock: the nearest trooper round the way you face (kept while it's still there)
    const alive = troopsAlive();
    if (S.lock && !alive.find((o) => o.id === S.lock)) S.lock = null;
    if (!S.lock) S.lock = aimAt(S.me, alive, S.R, { cone: 0.5 })?.id ?? null;
    // where a shot would go now: the gun in your hands points there, the reticle rings the lock if it's in the cone
    S.aimed = aimNow();
    // whoever's with you: follows a step behind, and shoots at what's close
    if (S.mate) {
      const mate = mateP();
      const near = alive.length ? alive.reduce((a, b) => (apart(S.mate, a, S.R) < apart(S.mate, b, S.R) ? a : b)) : null;
      const behind = offset(S.me, -1.4 * METRE, (S.lead ? -1 : 1) * 1.3 * METRE, S.R);
      // (sets off once you're a stride ahead, slows in to arrive, stops a
      // half metre off, so it neither overshoots and comes back nor shuffles
      // at the edge: footLife.js's followMove; down, it stays where it fell)
      const gap = apart(S.mate, behind, S.R) / METRE;
      S.mateSt = mateStand(S.mateSt, S.clock, dt);
      const down = S.mateSt.downAt != null;
      const pace = followMove(gap, S.follow);
      S.follow = pace.st;
      let turn = 0;
      let move = down ? 0 : pace.move;
      const run = !down && (pace.run || (move > 0 && Math.abs(S.me.speed) > FOOT.walk * 1.2));
      if (move > 0) {
        turn = turnToward(S.mate, vec.add(behind.n, S.mate.n, -1), 4);
        if (Math.abs(turn) >= 0.8) move = Math.min(move, 0.3);
      } else if (down) turn = 0;
      else if (near && apart(S.mate, near, S.R) < 30 * METRE) turn = turnToward(S.mate, vec.add(near.n, S.mate.n, -1), 4);
      else turn = turnToward(S.mate, S.me.f, 2);
      S.mate = walk(S.mate, { move, turn, run }, dt, S.R, obstacles());
      S.mateCool -= dt;
      // the one they're on: gun up at it while it's near enough, a shot now and then (not while down)
      S.mateTarget = !down && near && apart(S.mate, near, S.R) < 30 * METRE ? near : null;
      if (S.mateTarget && mate?.spec.gun) S.mateAim = 1;
      if (!down && near && mate?.spec.gun && S.mateCool <= 0 && apart(S.mate, near, S.R) < 26 * METRE && (mate.gp?.aim ?? 1) > 0.6) {
        S.mateCool = 0.9 + rand() * 0.9;
        shoot(mate, near, 'mate', damageOf(mate), 0.06);
        emit({ type: 'fire', soft: true, gun: gunOf(mate) });
      }
    } else S.mateTarget = null;
    // the side's troops (sides.js: the Federation's, or the DEA and the cartel): a squad now and then, once the last is dealt with
    if (S.cleared && S.clock > S.nextSquad) {
      const kinds = squadKinds(sideFor(S.kind) ?? SIDES.rickmorty, S.squads);
      const count = Math.min(5, 2 + S.squads + Math.floor(rand() * 2));
      const fresh = squad(rand, S.me, S.R, { count, kinds, band: S.band });
      S.troops = [...S.troops.filter((o) => o.alive || o.dead < 3), ...fresh];
      S.squads++;
      S.cleared = false;
      // (who most of them are, for the crew's word on it: a squad of Mortys isn't a squad of bugs)
      const most = fresh.reduce((m, t) => ((m[t.kind] = (m[t.kind] ?? 0) + 1), m), {});
      emit({ type: 'foot', id: 'squad', who: Object.keys(most).sort((a, b) => most[b] - most[a])[0] });
      // (the nervous ones jump at the sight: react.js's gunfire, a scared)
      const m = mateP();
      if (m && SCARED.has(m.spec.id) && S.mateSt.downAt == null) m.fig.react?.('gunfire', { target: at(fresh[0], S.R) });
    }
    // (with the way each faces and how fast they go, so a shot leads them)
    const mover = (id, w) => ({ id, n: w.n, h: w.h, f: w.f, speed: w.speed, side: w.side });
    const targets = [mover('me', S.me), ...(S.mate ? [mover('mate', S.mate)] : [])];
    const r = march(S.troops, targets, dt, S.R, rand, obstacles());
    S.troops = r.troops.filter((o) => o.alive || o.dead < 4);
    for (const id of [...troopFigs.keys()]) if (!S.troops.find((o) => o.id === id)) dropTroop(id);
    for (const s of r.shots) {
      // from the gun's muzzle, if the trooper's holding one (re-aimed at the same mark)
      let from = s.from;
      let dir = s.dir;
      const got = troopFigs.get(s.by);
      const f = got?.group.visible ? got.gp?.fire() : null;
      if (f) {
        from = arr(toMap(f.muzzle).sub(S.c));
        dir = vec.unit(vec.add(vec.add(s.from, s.dir, s.range), from, -1));
        fx.flash(new V(...from), new V(...dir), got.gp.spec.flash);
      }
      const b = boltStep.fire({ from, dir, speed: BOLT.speed, range: BOLT.range, owner: s.by, side: 'troop', damage: s.damage });
      const mesh = takeMesh();
      paintBolt(mesh, TROOP_BOLT);
      mesh.visible = true;
      S.bolts = S.bolts.filter((o) => (o.b === b && o.mesh !== mesh ? (o.mesh.visible = false) : o.mesh !== mesh)); // (a slot or a mesh taken back: the old bolt's gone)
      S.bolts.push({ b, mesh, color: TROOP_BOLT, flown: 0 });
      emit({ type: 'shot' });
    }
    for (const h of r.hits) {
      if (h.target === 'me') hurt(h.damage);
      else if (h.target === 'mate') hurtMate(h.damage);
    }
    // a probe droid that's had you in sight a while calls them in: a squad of the side's others
    for (const c of r.calls) {
      const kinds = squadKinds(sideFor(S.kind) ?? SIDES.rickmorty, S.squads + 1).filter((k) => !TROOPS[k].calls);
      S.troops = [...S.troops, ...squad(rand, S.me, S.R, { count: 3, kinds: kinds.length ? kinds : ['stormtrooper'], band: S.band })];
      S.cleared = false;
      emit({ type: 'foot', id: 'called', by: c.by });
    }
    if (!S.cleared && !troopsAlive().length) {
      S.cleared = true;
      S.nextSquad = S.clock + 30 + rand() * 25;
      emit({ type: 'foot', id: 'cleared' });
      // the two of you, on the last one down (react.js's win: a cheer, a
      // taunt; yours cut by whatever you do next, as an emote is)
      if (S.squads > 0) {
        reactMe('win');
        if (S.mateSt.downAt == null) mateP()?.fig.react?.('win');
      }
    }
    // health comes back once out of trouble a while
    if (S.clock - S.hitAt > 4 && S.health < FOOT.health) S.health = Math.min(FOOT.health, S.health + FOOT.heal * dt);
    S.cool -= dt;
    // the gun stays up a while after the last shot, longer with a lock still there
    S.aim = Math.max(0, S.aim - dt / (S.lock ? 6 : 2.5));
    S.mateAim = Math.max(0, S.mateAim - dt / 2.5);
    if (me && !me.spec.gun) S.aim = 0;
  };

  // A reaction of yours (react.js's table, through your figure: a flinch, a
  // cheer), noted so the next thing you do cuts it, as the galaxy's does
  const LASTS = { hit: 0.6, win: 5 }; // seconds: the longest each can be before nothing's left to cut
  const reactMe = (event, opts = {}) => {
    const me = meP();
    const r = me?.fig.react?.(event, { moving: Math.abs(S.me?.speed ?? 0) > 0.2 * METRE, ...opts }) ?? null;
    if (r) S.reacting = { who: me, clip: r.clip, layer: r.layer, until: S.clock + (LASTS[event] ?? 2) };
    return r;
  };
  const cutReaction = () => {
    const c = S.reacting;
    S.reacting = null;
    const a = c?.who.fig?.anim;
    if (!a || S.clock > c.until) return;
    if (!a.playing || a.playing(c.layer) === c.clip) c.who.fig.stop?.(0.15, c.layer);
  };
  // the mate hit: health off and a flinch (the chest or the head); out of
  // health, down a while where it is, then up again whole (footLife.js)
  const hurtMate = (damage, knock = null) => {
    if (S.phase !== 'walk' || !S.mate) return;
    const was = S.mateSt.downAt;
    S.mateSt = mateHit(S.mateSt, damage, S.clock);
    if (knock) S.mateKnock = knock;
    const m = mateP();
    if (S.mateSt.downAt != null && was == null) emit({ type: 'foot', id: 'matedown', who: m?.spec.id ?? null });
    else if (S.mateSt.downAt == null) m?.fig.react?.('hit', { where: rand() < 0.3 ? 'head' : 'chest', moving: Math.abs(S.mate.speed) > 0.2 * METRE });
  };
  const hurt = (damage, knock = null) => {
    if (S.phase !== 'walk') return;
    S.knock = knock;
    S.health = Math.max(0, S.health - damage);
    S.hitAt = S.clock;
    emit({ type: 'foot', id: 'hurt', damage });
    if (S.health > 0) reactMe('hit', { where: rand() < 0.3 ? 'head' : 'chest' });
    if (S.health <= 0) {
      S.phase = 'down';
      S.t = 0;
      // they go, their job done: down at the knees and over, as a shot one
      // goes (the down phase below runs their fall), not flat at once
      S.troops = S.troops.map((o) => (o.alive ? { ...o, alive: false, dead: 0 } : o));
      S.cleared = true;
      S.nextSquad = S.clock + 20;
      emit({ type: 'foot', id: 'down' });
    }
  };

  // the bolts on the one step: the ground, what stands on it (obstacles())
  // and the loose things as solids, the people as capsules; what each ends
  // on, when it gets there
  const moveBolts = (dt) => {
    const walking = S.phase === 'walk';
    const bodies = footBodies({ me: walking ? S.me : null, mate: walking ? S.mate : null, troops: S.troops, R: S.R });
    const ground = footSolids(obstacles(), S.R);
    // (a loose thing in its way, short of the ground, stops it and is knocked)
    // (a fixed one stops it too, unmoved; by the ground, the leaves round it thrown)
    // (asked only as far as the nearest person on the way, lib/combat/bolt.js:
    // a thing behind someone it hits isn't knocked)
    const solids = (a, b) => {
      const g = ground(a, b);
      const knocked = lp ? lp.shot(a, g?.at ?? b) : null;
      if (knocked && vec.len(knocked.at) - S.R < METRE) leaves.blast(knocked.at, 1.5, 12);
      return knocked ? { at: knocked.at, normal: null } : g;
    };
    // (through a crown: a few of its leaves shaken loose, once a bolt)
    for (const o of S.bolts) if (!o.shook && o.b.alive) o.shook = leaves.shake(o.b.pos, o.b.dir);
    const ended = new Set();
    for (const e of boltStep.step(dt, { solids, bodies, blades: [] })) {
      const o = S.bolts.find((x) => x.b === e.bolt);
      ended.add(e.bolt);
      if (!o) continue;
      o.mesh.visible = false;
      if (e.type === 'gone') continue;
      const p = e.at;
      // (the ground: the planet's own sphere, its normal straight up out of it)
      const onGround = e.type === 'solid' && e.normal && Math.abs(vec.len(p) - S.R) < 0.02 * METRE;
      const hitId = e.type === 'hit' ? e.body.id : null;
      puff(p, onGround ? '#ffcf8a' : o.color ?? '#ffffff', onGround ? 0.7 : 1.2);
      const along = tmp.set(...e.bolt.dir);
      if (onGround) {
        // on the ground: where it went in, sparks off it and a burn
        const n = new V(...vec.unit(p));
        const spot = n.clone().multiplyScalar(S.R);
        fx.sparks(spot, n.clone().addScaledVector(along, 0.6).normalize(), o.color ?? '#ffd0a0', 12);
        fx.scorch(spot, n);
        leaves.blast(spot, 3);
      } else fx.sparks(new V(...p), along.clone().negate(), o.color ?? '#ffd0a0', 9); // off whoever or whatever it hit, back the way it came
      // how near you: for the sound of it
      if (S.me) {
        const d = vec.len(vec.add(p, at(S.me, S.R), -1)) / METRE;
        if (d < 40) emit({ type: 'impact', near: Math.max(0.15, 1 - d / 40) });
      }
      if (typeof hitId === 'number') {
        const t = S.troops.find((x) => x.id === hitId);
        if (t?.alive) {
          t.hp -= e.bolt.damage;
          t.hitAt = S.clock;
          if (e.bolt.owner === 'me') S.landed = S.clock; // (the reticle's flash)
          t.knock = [...e.bolt.dir]; // which way the shot pushed them
          // (how hard, for the fall it's in: drawTroops)
          const got = troopFigs.get(t.id);
          if (got) got.blow = e.bolt.damage;
          if (t.hp <= 0) {
            t.alive = false;
            t.dead = 0;
            t.fallSide = rand() < 0.5 ? -1 : 1;
            t.how = GADGETS.includes(o.gun) ? o.gun : null; // (Rick's guns' kills: through a portal, frozen, shrunk: drawTroops)
            emit({ type: 'foot', id: 'kill', kind: t.kind, by: e.bolt.owner, how: t.how });
          } else got?.body.react('hit', { where: troopHitWhere(t, p, S.R), moving: true }); // (on their upper half: they keep coming)
        }
      } else if (hitId === 'me') hurt(e.bolt.damage, [...e.bolt.dir]);
      else if (hitId === 'mate') hurtMate(e.bolt.damage, [...e.bolt.dir]);
    }
    const keep = [];
    for (const o of S.bolts) {
      if (ended.has(o.b) || !o.b.alive) continue;
      o.mesh.position.set(...o.b.pos);
      o.mesh.quaternion.setFromUnitVectors(new V(0, 0, 1), tmp.set(...o.b.dir));
      // grown out of the muzzle to its full length
      o.flown = o.b.flown;
      o.mesh.scale.z = Math.min(1, Math.max(0.02, (o.flown - o.hide) / BOLT_LEN));
      if (o.hide && !o.mesh.visible && o.flown > o.hide) o.mesh.visible = true;
      keep.push(o);
    }
    S.bolts = keep;
  };

  const drawPeople = (dt) => {
    const show = S.phase === 'out' || S.phase === 'walk' || S.phase === 'board' || S.phase === 'down';
    party.forEach((p, i) => {
      const w = i === S.lead ? S.me : S.mate;
      if (!w) {
        p.group.visible = false;
        return;
      }
      p.w = w;
      p.group.visible = show && !(i === S.lead && S.cam.first);
      stand(p.group, w);
      if (i === S.lead) {
        // (about the feet: the figure's own origin; its scale as built, times the squash)
        const [sx, sy, sz] = squash.step(dt);
        p.built ??= p.group.scale.clone();
        p.group.scale.set(p.built.x * sx, p.built.y * sy, p.built.z * sz);
      }
      shadow(`party${i}`, w, p.spec.tall * 0.55).visible = show;
      const n = new V(...w.n);
      const frame = { forward: dirToWorld(new V(...w.f)), up: dirToWorld(n.clone()) };
      const mine = i === S.lead;
      // knocked down: the knees go and over onto their back, then up again
      // (the mate the same way, where a shot put it: footLife.js's mateDown)
      const down = mine ? myDown() : mateDown(S.mateSt, S.clock);
      if (down > 0) {
        p.group.quaternion.premultiply(fallTurn(down, pushOf(w, mine ? S.knock : S.mateKnock), n));
        p.group.position.addScaledVector(n, p.spec.tall * METRE * 0.05 * smooth(0.5, 1, down));
      }
      const move = Math.min(1, Math.abs(w.speed) / FOOT.run + Math.abs(w.side) / FOOT.run);
      const hurt = Math.max(0, 1 - (S.clock - (mine ? S.hitAt : (S.mateSt.hitAt ?? -1e9))) / 0.35);
      const motion = { speed: w.speed, side: w.side, turn: turnRate(p, w, dt), air: (w.h ?? 0) / METRE, hurt, knock: 0.5, down };
      p.fig.update(dt, move, motion);
      p.group.updateMatrixWorld(true);
      p.fig.after?.(dt, motion, frame);
      const drop = p.fig.loco?.drop ?? 0;
      if (drop > 1e-7 && !down) {
        p.group.position.addScaledVector(n, -drop);
        p.group.updateMatrixWorld(true);
      }
      // the gun: up at the lock (or the trooper the mate's after) while
      // there's shooting, the head on it before that, down otherwise
      if (p.gp) {
        const mine = i === S.lead;
        const target = mine ? S.troops.find((o) => o.id === S.lock && o.alive) : S.mateTarget;
        const aim = mine ? S.aim : S.mateAim;
        // (yours at the aim point while it's up, where the bolt will go; the lock's only if it's in the cone)
        const mark = mine && S.aimed && aim > 0.05 ? S.aimed.at : null;
        const dir = mark ? dirToWorld(new V(...mark).sub(new V(...vec.add(at(p.w, S.R), p.w.n, p.spec.tall * METRE * 0.62))).normalize()) : target && (!mine || S.aimed?.locked) ? dirToWorld(shotDir(p, target)) : null;
        p.gp.set(dt, { aim: down ? 0 : aim, look: target && !down ? Math.max(aim, 0.8) : aim, dir, forward: frame.forward, up: frame.up, move });
      }
    });
  };

  const STOOD = { speed: 0, side: 0, turn: 0 };
  const CLIP_WAIT = 0.4; // seconds a fall's clip has to begin before they go over without it
  const drawTroops = (dt) => {
    for (const key of [...blobs.keys()]) if (key.startsWith('troop') && !S.troops.find((o) => `troop${o.id}` === key)) dropShadow(key);
    for (const tr of S.troops) {
      const got = troopFig(tr);
      const n = new V(...tr.n);
      if (!tr.alive && tr.how) {
        // through the portal (the gun out of their hand first), frozen
        // and shattered, or shrunk and popped (the gun goes with them):
        // the effect owns where they are from the moment they go
        if (!got.swallow) {
          stand(got.group, tr);
          const tall = TROOPS[tr.kind].tall;
          const on = (ev) => emit({ type: 'foot', id: tr.how, ev });
          if (tr.how === 'freeze') got.swallow = gfx.freeze({ root: got.group, tall, up: n, push: pushOf(tr, tr.knock), on });
          else if (tr.how === 'shrink') got.swallow = gfx.shrink({ root: got.group, tall, up: n, on });
          else {
            got.swallow = pfx.swallow({ root: got.group, tall, up: n, push: pushOf(tr, tr.knock), joints: meshyJoints(got.group, 1, 1.8), on });
            got.dropped = true;
            const g = got.gp?.drop();
            if (g) fx.toss(g, pushOf(tr, tr.knock).multiplyScalar(-0.8 * METRE).addScaledVector(n, 1.6 * METRE));
          }
        }
        shadow(`troop${tr.id}`, tr, (TROOPS[tr.kind].tall / METRE) * 0.5).visible = false;
        continue;
      }
      stand(got.group, tr);
      shadow(`troop${tr.id}`, tr, (TROOPS[tr.kind].tall / METRE) * 0.5).visible = tr.alive || tr.dead < 2.4;
      const frame = { forward: dirToWorld(new V(...tr.f)), up: dirToWorld(n.clone()) };
      if (!tr.alive) {
        // down they go: a rigged one on its own clip, by the way the shot
        // pushed them and how hard (react.js's `down`: die.fwd, die.back,
        // die.blown); anyone else (or one whose clip never came) at the
        // knees, then over that way about their feet. The gun out of their
        // hand, and into the ground after a while.
        const k = Math.min(1, tr.dead / 0.95);
        const tall = TROOPS[tr.kind].tall;
        let d = got.death;
        if (!d) {
          d = got.death = { clip: null, tipAt: 0 };
          if (got.anim) {
            // (whatever its upper half was doing let go, its head on nothing)
            got.body.stop(0.15, 'upper');
            got.body.look(null);
            d.clip = got.body.react('down', troopFall(tr, got.blow))?.clip ?? null;
          }
        }
        if (d.clip && tr.dead > CLIP_WAIT && got.anim.playing('full') !== d.clip) {
          d.clip = null;
          d.tipAt = tr.dead;
          got.body.stop(0.1, 'full');
        }
        if (d.clip) {
          got.group.position.addScaledVector(n, -smooth(2.4, 4, tr.dead) * tall * 0.5);
          stepTroop(got, dt, 0, 0, STOOD, frame);
        } else {
          const kk = Math.min(1, (tr.dead - d.tipAt) / 0.95);
          got.group.quaternion.premultiply(fallTurn(kk, pushOf(tr, tr.knock), n));
          got.group.position.addScaledVector(n, tall * 0.05 * smooth(0.5, 1, kk) - smooth(2.4, 4, tr.dead) * tall * 0.5);
          if (got.c || got.own) stepTroop(got, dt, 0, 0, { down: kk }, frame);
        }
        if (got.gp && !got.dropped && k > 0.3) {
          got.dropped = true;
          const g = got.gp.drop();
          if (g) fx.toss(g, pushOf(tr, tr.knock).multiplyScalar(1.2 * METRE).addScaledVector(n, 1.4 * METRE));
        }
        continue;
      }
      // (against a runner's pace, as yours is: by their own top speed a
      // trooper's march read as a run)
      const move = Math.min(1, Math.abs(tr.speed) / FOOT.run + Math.abs(tr.side) / FOOT.run);
      const hit = tr.hitAt ? Math.max(0, 1 - (S.clock - tr.hitAt) / 0.35) : 0;
      const motion = { speed: tr.speed, side: tr.side, turn: turnRate(got, tr, dt), hurt: hit, knock: tr.knock ? Math.sign(vec.dot(tr.knock, rightOf(tr))) || 1 : 0.4 };
      stepTroop(got, dt, move, hit, motion, frame);
      if (got.gp) {
        // its gun up at whichever of you is nearer, as the rules say
        got.group.updateMatrixWorld(true);
        const who = S.me && (!S.mate || apart(tr, S.me, S.R) <= apart(tr, S.mate, S.R)) ? S.me : S.mate;
        const dir = who ? new V(...vec.unit(vec.add(vec.add(at(who, S.R), who.n, METRE * 1.1), vec.add(at(tr, S.R), tr.n, TROOPS[tr.kind].tall * 0.62), -1))) : null;
        got.gp.set(dt, { aim: tr.aim ?? 0, dir: dir && dirToWorld(dir), forward: frame.forward, up: frame.up, move });
      }
    }
  };

  const liftFrame = () => {
    const m = S.model;
    const k = Math.min(1, S.t / LAND.lift);
    const e = ease(k);
    const P0 = S.from.p.clone();
    // up and out of the air, and well clear of it (entry.js's ENTRY.clear)
    const up = new V(...vec.scale(S.spot.n, S.R * AIR + ENTRY.clear + 0.6)).add(S.c);
    m.group.position.copy(P0).lerp(up, e);
    // turning level as it rises (the map's level: that's how it flies),
    // nose the way it was facing, or else out away from the planet: never
    // back in toward it, where flying on level would take it straight back
    // down into the air it's just climbed out of
    const [fx, , fz] = S.spot.f;
    const [nx, , nz] = S.spot.n;
    const facing = Math.hypot(fx, fz) > 0.25 && (fx * nx + fz * nz >= 0 || Math.hypot(nx, nz) < 0.05);
    const heading = facing ? Math.atan2(-fx, -fz) : Math.atan2(-nx, -nz);
    const level = new THREE.Quaternion().setFromAxisAngle(new V(0, 1, 0), heading);
    m.group.quaternion.copy(S.from.q).slerp(level, smooth(0.3, 1, k));
    m.group.scale.setScalar((PARKED[S.kind] ?? 1) + (1 - (PARKED[S.kind] ?? 1)) * smooth(0, 0.6, k));
    if (k >= 1) S.done = { x: m.group.position.x, y: m.group.position.y, z: m.group.position.z, heading };
  };

  // the gun in your hands, out of your own eyes (in the planet's space, from the eased camera)
  const vmF = new V();
  const vmR = new V();
  const vmU = new V();
  const vmQ = new THREE.Quaternion();
  const VM_CONE = 0.3; // radians
  const placeViewGun = (dt) => {
    const me = meP();
    const on = Boolean(S.cam.first && S.phase === 'walk' && me?.spec.gun && S.cam.pos);
    if (!on) {
      if (vm) vm.gun.visible = false;
      return;
    }
    const v = viewGun(gunOf(me), me.spec.id);
    const pos = S.cam.pos.clone().sub(S.c);
    vmF.copy(S.cam.look).sub(S.cam.pos).normalize();
    vmU.copy(S.cam.up).addScaledVector(vmF, -S.cam.up.dot(vmF)).normalize();
    vmR.crossVectors(vmF, vmU).normalize();
    // what it's pointed at: where the bolt will go while there's shooting (footAim's), else a little low ahead
    const up = Math.min(1, S.aim * 1.4);
    const mark = S.aimed && up > 0.05 ? new V(...S.aimed.at) : pos.clone().addScaledVector(vmF, 20 * METRE).addScaledVector(vmU, -(1 - up) * 6 * METRE).addScaledVector(vmR, -(1 - up) * 2.5 * METRE);
    // held: lower and further right at ease, up toward the middle of the view to shoot
    const k = S.cam.kick.x;
    v.bob += dt * (2 + Math.min(1, Math.abs(S.me.speed) / FOOT.run) * 9);
    const walking = Math.min(1, Math.abs(S.me.speed) / FOOT.walk);
    const long = GUNS[gunOf(me)]?.stock;
    // (a long gun lower and further out to the side: its stock's at your
    // shoulder, its scope and a bowcaster's bow well under your eye)
    const hold = new V()
      .copy(pos)
      .addScaledVector(vmF, ((long ? 0.36 : 0.5) - up * 0.03 - k * 0.035) * METRE)
      .addScaledVector(vmR, ((long ? 0.27 : 0.25) - up * 0.05 + Math.sin(v.bob) * 0.008 * walking) * METRE)
      .addScaledVector(vmU, ((long ? -0.4 : -0.26) + up * 0.05 + Math.abs(Math.cos(v.bob)) * 0.01 * walking) * METRE);
    v.gun.position.copy(hold);
    const dir = mark.sub(hold).normalize();
    // never pointed out of the view: within a few degrees of where you're looking
    const off = dir.angleTo(vmF);
    if (off > VM_CONE) dir.lerp(vmF, 1 - VM_CONE / off).normalize();
    if (!v.look || reduced) v.look = dir.clone();
    else v.look.lerp(dir, 1 - Math.exp(-dt * 16)).normalize(); // (a moment behind a turn)
    frameFrom(v.look, vmU, vmQ);
    v.gun.quaternion.copy(vmQ);
    v.gun.rotateX(-k * 0.12); // the kick, muzzle up
    v.gun.visible = true;
  };

  // ── the camera: behind you, over your shoulder (or out of your eyes) ──
  const view = (dt) => {
    if (!S.phase) return null;
    const out = { pos: new V(), look: new V(), up: new V() };
    if (S.phase === 'land' && S.entry) {
      // flown in: behind it and a little above, down the way it's going,
      // coming round onto the landing's view (below) as it settles
      const e = S.entry;
      const p = S.model.group.position;
      const n = spotN.set(...S.spot.n);
      const k = smooth(ENTRY.glide - 0.8, ENTRY.glide + ENTRY.settle * 0.6, e.t);
      out.pos.copy(p).addScaledVector(e.dir, -1.15).addScaledVector(e.up, 0.32);
      out.look.copy(p).addScaledVector(e.dir, 0.6);
      out.pos.lerp(landCam.copy(p).addScaledVector(spotF.set(...S.spot.f), -1.1).addScaledVector(n, 0.45), k);
      out.look.lerp(p, k);
      out.up.copy(e.up).lerp(n, k).normalize();
    } else if (S.phase === 'land' || S.phase === 'lift' || (S.phase === 'board' && !S.me)) {
      // over the ship, from behind and above, as it comes down (or goes up)
      const m = S.model.group;
      const n = new V(...S.spot.n);
      const f = new V(...S.spot.f);
      const p = m.position;
      out.look.copy(p);
      out.pos.copy(p).addScaledVector(f, -1.1).addScaledVector(n, 0.45);
      out.up.copy(n);
    } else {
      const w = S.me;
      const n = new V(...w.n);
      const f = new V(...w.f);
      const me = meP();
      const tall = (me?.spec.tall ?? 1.8) * METRE;
      const head = new V(...at(w, S.R)).add(S.c).addScaledVector(n, tall * 0.92);
      if (S.phase === 'down') {
        // up and away, looking down on you
        const k = smooth(0, 1, S.t);
        out.look.copy(head);
        out.pos.copy(head).addScaledVector(f, -CAM.dist * METRE).addScaledVector(n, (1.5 + k * 3) * METRE);
      } else if (S.cam.first) {
        out.pos.copy(head).addScaledVector(f, 0.15 * METRE);
        out.look.copy(out.pos).addScaledVector(f, 6 * METRE).addScaledVector(n, -S.cam.pitch * 4 * METRE);
      } else {
        const p = S.cam.pitch;
        const right = new V().crossVectors(f, n);
        out.look.copy(head).addScaledVector(f, CAM.look * METRE).addScaledVector(n, -p * 0.8 * METRE);
        out.pos
          .copy(head)
          .addScaledVector(f, -CAM.dist * METRE * Math.cos(p))
          .addScaledVector(n, CAM.dist * METRE * Math.sin(p) + CAM.up * METRE)
          .addScaledVector(right, 0.45 * METRE); // over the right shoulder
      }
      out.up.copy(n);
    }
    // your own shot kicks the view up a touch (more out of your own eyes)
    const kick = S.cam.kick.x;
    if (Math.abs(kick) > 1e-4 && S.me) {
      const k = (S.cam.first ? 1.6 : 1) * METRE;
      out.look.addScaledVector(out.up, kick * 0.35 * k);
      out.pos.addScaledVector(out.up, kick * 0.05 * k);
    }
    // never under the ground
    const rel = out.pos.clone().sub(S.c);
    const minR = S.R + 0.35 * METRE;
    if (rel.length() < minR) out.pos.copy(S.c).addScaledVector(rel.normalize(), minR);
    // eased, so it follows rather than jolts
    if (S.cam.pos) {
      // (flown in, close behind: it's going a good deal faster than it lands)
      const k = reduced ? 1 : 1 - Math.exp(-dt * (S.phase === 'walk' ? 12 : S.entry ? 10 : 3.5));
      S.cam.pos.lerp(out.pos, k);
      S.cam.look.lerp(out.look, k);
      S.cam.up.lerp(out.up, k).normalize();
    } else S.cam = { ...S.cam, pos: out.pos.clone(), look: out.look.clone(), up: out.up.clone() };
    placeViewGun(dt);
    // the planet's own model: not while the camera's down by the ground
    const body = planetOf[S.id]?.body;
    if (body && S.hideBody) {
      const up = S.cam.pos.distanceTo(S.c) - S.R > S.hideBody;
      if (S.bodyAll) body.visible = S.bodyShown && up;
      else body.layers.mask = up ? S.bodyMask : 0;
    }
    // the air: round the camera, by day
    if (haze) {
      haze.mesh.position.copy(S.cam.pos).sub(S.c);
      haze.mat.uniforms.uUp.value.copy(S.cam.up);
    }
    if (S.entry) showEntry(dt);
    return { pos: S.cam.pos, look: S.cam.look, up: S.cam.up };
  };

  return {
    get phase() {
      return S.phase;
    },
    // (development: the numbers, for checking from a browser)
    get debug() {
      if (!import.meta.env.DEV) return null;
      S._figs = troopFigs; // (the figures too: scripts/foot-portal-check.mjs reads a swallow's state)
      return S;
    },
    // (development: the landing's doors and people, scripts/door-check.mjs)
    get spots() {
      return import.meta.env.DEV ? (rocks?.spots ?? []) : null;
    },
    // (development: the part of the planet you came down on and where,
    // [lat, lon] on its map, as ?spot= takes it: scripts/landing-check.mjs)
    get biome() {
      return import.meta.env.DEV && S.biome ? { id: S.biome.id, title: S.biome.title, at: S.biome.at } : null;
    },
    get id() {
      return S.id;
    },
    begin,
    // somewhere to come down on `id` (the ship's at it), in a `kind` of
    // ship: what landing there will want, fetched and made ready while it's
    // still flying, its landing's (landings/furnish.js: its own, the
    // fallback biome most landings are), its crew's, and the physics
    // engine where it has anything loose on it
    prefetch(id, kind) {
      const u = byId(id);
      if (!u || u.kind === 'core' || u.portal) return;
      // (not on a phone, nor saving data: there it's fetched as it lands,
      // as it always was)
      if (!bodiesHere()) return;
      const landing = u.plated ? null : landingOf(id);
      // (and its map read once, so even a first landing finds its biome:
      // the -sm file fetched now where nothing drawn can be read back)
      if (landing?.biomes && planetOf[id]) lookOf(planetOf[id], id);
      if (landing && furnished(id)) {
        prefetchLanding(id, landing, { renderer });
        if (bodiesHere() && looseOn(landing)) preloadPhysics().catch(() => {});
      }
      warmParty(kind);
    },
    // the ship's about to fly into `id`'s air, or is in it and not yet
    // taken (`entry`: entry.js's entryGuess, what entering() will say as
    // it's taken, at the speed it must be down to by then): the part of it
    // it'll come down on, foreseen as begin will find it (from `light`, or
    // beside a friend already down, `near`), and that biome's models
    // fetched (landings/furnish.js), and the physics engine where it has
    // anything loose. A guess (the planet turns a little before it's
    // there, and the ship may yet turn away): begin fetches where it does
    // come down at once, whatever was guessed
    prefetchAt(id, { light, near = null, entry }) {
      const u = byId(id);
      const planet = planetOf[id];
      if (!u || !planet || u.plated || u.trench || !furnished(id) || !bodiesHere()) return;
      const own = landingOf(id);
      if (!own) return;
      let view = own;
      if (own.biomes) {
        const spot = near ?? entrySpot({ n: entry.n, track: entry.vel, light, speed: entry.speed, R: u.size });
        map.updateMatrixWorld();
        const toBody = bodyTurn(planet);
        // (?spot= in development: where begin will put it)
        const forced = near ? null : forcedSpot();
        const nb = forced ? fromLatLon(...forced) : turned(toBody, spot.n);
        view = viewOf(own, landOn(own, nb, lookOf(planet, id), { track: turned(toBody, spot.f), walk: !near && !forced }).biome);
      }
      prefetchLanding(id, own, { renderer, view });
      if (looseOn(view)) preloadPhysics().catch(() => {});
    },
    update,
    view,
    // how much of a landing's day sky shows, and its sun's way (the map's
    // space): the scene's flare on the sun goes by them (0 with no sky)
    get sky() {
      return haze?.set && S.spot ? { day: haze.day, sun: haze.sunDir } : null;
    },
    // how far from the camera there's anything to see (the map's units), or
    // null: as far as it sees. Under a full day's sky, only as far as the
    // sky (landings/sky.js's seenTo): it hides the rest of the universe.
    far() {
      return S.phase && S.spot ? (haze?.seenTo ?? null) : null;
    },
    // the day where you are: how much the haze shows (light: the key light's direction, in the map's space)
    day(light) {
      // (the crowns' two tones by the same sun, in the world)
      sunCanopy(sunAt.copy(light).transformDirection(map.matrixWorld));
      if (!haze || !S.spot) return;
      const k = smooth(-0.25, 0.35, vec.dot(S.me?.n ?? S.spot.n, arr(light)));
      // (only down in the air: gone by the time you're well up)
      const high = S.cam.pos ? S.cam.pos.distanceTo(S.c) - S.R : 0;
      // (and flown in, coming up from nothing as the ship comes down through the air: S.sky)
      haze.mat.uniforms.uDay.value = (haze.set ? k : 0.12 + 0.88 * k) * (1 - smooth(20 * METRE, 300 * METRE, high)) * S.sky;
      haze.set?.({ sun: light });
    },
    // F: a shot where the reticle is, bent toward a trooper (the lock first)
    // within the input's cone and no further (footAim.js); `cone` for this
    // one shot (a touch tap's, which snaps). The gun it was (gunplay.js's
    // kind), or false
    fire({ cone: c = cone() } = {}) {
      if (S.phase !== 'walk' || S.cool > 0) return false;
      const me = meP();
      if (!me?.spec.gun) return false;
      S.cool = me.spec.gun === 'bowcaster' ? 0.55 : 0.28;
      const aimed = aimNow(c);
      const target = aimed?.target ? S.troops.find((o) => o.id === aimed.target.id && o.alive) ?? null : null;
      if (aimed) S.aimed = aimed;
      shoot(me, target, 'me', damageOf(me), 0, aimed ? new V(...aimed.at) : null);
      S.acted = true;
      S.aim = 1;
      if (!reduced) S.cam.kick.v += GUNS[gunOf(me)]?.kick.up ?? 1.5;
      return gunOf(me);
    },
    // B: Rick's next gadget (GADGETS), or the one named, if it's Rick you're playing; its kind, or false
    gadget(kind = null) {
      const me = meP();
      if (S.phase !== 'walk' || !me?.gp || !GADGETS.includes(me.spec.gun)) return false;
      const next = GADGETS.includes(kind) ? kind : GADGETS[(GADGETS.indexOf(gunOf(me)) + 1) % GADGETS.length];
      me.gp.dispose();
      me.gp = createGunplay(me.fig, next, { unit: METRE, who: me.fig.built ? 'built' : me.spec.id });
      S.gadgetAt = S.clock;
      S.acted = true;
      return next;
    },
    // Z: the emote wheel, down (held, it opens), up (let go: the one pointed
    // at, or a tap's last), or a pick by its number while it's open (1 to 5)
    emote(what, n = null) {
      if (S.phase !== 'walk') return false;
      if (what === 'down') {
        S.wheelHeld = true;
        emotes.down(S.clock);
      } else if (what === 'up') {
        S.wheelHeld = false;
        return startEmote(emotes.up(S.clock));
      }
      else if (what === 'pick') return startEmote(emotes.choose(typeof n === 'number' ? n - 1 : n));
      return false;
    },
    // T: the next trooper round
    cycle() {
      const alive = troopsAlive().sort((a, b) => apart(S.me, a, S.R) - apart(S.me, b, S.R));
      if (!alive.length) return;
      const i = alive.findIndex((o) => o.id === S.lock);
      S.lock = alive[(i + 1) % alive.length].id;
    },
    // a tap on a trooper: lock on to it
    lockOn(id) {
      if (S.troops.find((o) => o.id === id && o.alive)) S.lock = id;
    },
    // Q: play the other one
    swap() {
      if (S.phase !== 'walk' || !party?.[1] || !S.mate) return false;
      [S.me, S.mate] = [{ ...S.mate, id: 'me' }, { ...S.me, id: 'mate' }];
      S.lead = 1 - S.lead;
      S.airH = 0; // (the other one's feet were never off the ground)
      return party[S.lead].spec.id;
    },
    // G: back in the ship, if you're by it
    board() {
      if (S.phase !== 'walk' && S.phase !== 'out') return false;
      if (apart(S.me, S.spot, S.R) > FOOT.board + 0.26 * (PARKED[S.kind] ?? 1) * 0.6) return false;
      S.phase = 'board';
      S.t = 0;
      S.troops = S.troops.filter((o) => !o.alive);
      emit({ type: 'foot', id: 'in' });
      return true;
    },
    // a drag: turn (dx, px) and look up or down (dy, px)
    look(dx, dy) {
      turnBy(dx * 0.006, dy * 0.004);
    },
    // the same in radians (runtime/look.js's turn, from a locked pointer)
    turn: (dx, dy) => turnBy(dx, dy),
    // V on foot: out of your own eyes, or back over the shoulder
    first() {
      S.cam.first = !S.cam.first;
      return S.cam.first;
    },
    // the ?debug panel's groups (lib/debugPanel): the knocks' law, the jump's press and the landing's squash
    tune: () => [...impactGroups(knocks.rules), ...pressGroups(jumpKey.press), ...springGroups(squash.spring, 'landing squash')],
    // a door you're at (a landing's: G there goes into the planet's page): { id, label } or null
    door() {
      const s = S.phase === 'walk' ? nearSpot() : null;
      return s?.label ? { id: S.id, label: s.label } : null;
    },
    // the targeting, for the HUD: what the gun's on, where it's pointed, the
    // way back to the ship, the health; and anything here that answers you
    info() {
      if (!S.phase || !S.me) return null;
      const me = meP();
      const lock = S.troops.find((o) => o.id === S.lock && o.alive) ?? null;
      const chest = (w, tall) => new V(...vec.add(at(w, S.R), w.n, tall * 0.55)).add(S.c);
      const spot = nearSpot();
      return {
        aim: chest(S.me, (me?.spec.tall ?? 1.8) * METRE).addScaledVector(new V(...S.me.f), 14 * METRE),
        lock: lock && { id: lock.id, kind: lock.kind, at: chest(lock, TROOPS[lock.kind].tall / 1), size: TROOPS[lock.kind].tall, dist: apart(S.me, lock, S.R) / METRE },
        // the reticle (runtime/hud's): a gun in hand, the lock in the cone (where the shot would go), how long ago your last shot landed (ms)
        gun: Boolean(me?.spec.gun),
        locked: Boolean(S.aimed?.locked),
        landed: S.landed != null ? (S.clock - S.landed) * 1000 : null,
        ship: { at: new V(...S.spot.n).multiplyScalar(S.R + S.rest).add(S.c), dist: apart(S.me, S.spot, S.R) / METRE, near: apart(S.me, S.spot, S.R) <= FOOT.board + 0.26 * (PARKED[S.kind] ?? 1) * 0.6 },
        health: S.health / FOOT.health,
        hurt: Math.max(0, 1 - (S.clock - S.hitAt) / 0.4),
        who: me?.spec.name ?? null,
        mate: mateP()?.spec.name ?? null,
        troops: troopsAlive().map((o) => ({ id: o.id, at: chest(o, TROOPS[o.kind].tall) })),
        first: S.cam.first,
        near: spot && { label: spot.label, say: spot.say },
        // the emote wheel: open (its slices, the one pointed at), what you're doing, the last, and for a moment after
        emote: { open: emotes.open, hover: emotes.hover, on: S.emote?.id ?? null, last: emotes.last, fresh: S.emoteAt != null && S.clock - S.emoteAt < 2.2 },
        // Rick's gadget in hand, and its name on the HUD for a moment after B
        gadget: me && GADGETS.includes(me.spec.gun) ? { kind: gunOf(me), name: GADGET_NAMES[gunOf(me)], fresh: S.gadgetAt != null && S.clock - S.gadgetAt < 1.8 } : null,
      };
    },
    // your crew as the other pilots see them (protocol.js's writeFoot):
    // where the ship is down and where you both are; null once you're
    // lifting off (or not down at all)
    crew() {
      if (!S.phase || S.phase === 'lift' || !S.spot) return null;
      const out = S.phase !== 'land';
      return {
        planet: S.id,
        kind: S.kind,
        ship: S.spot,
        lead: out ? walker(S.me, meP(), S.aim, { emote: S.emote, t: S.clock, hitAt: S.hitAt, down: myDown() }) : null,
        mate: out ? walker(S.mate, mateP(), S.mateAim, { t: S.clock, hitAt: S.mateSt.hitAt ?? -Infinity, down: mateDown(S.mateSt, S.clock) }) : null,
      };
    },
    guests: setGuests,
    // (for checking from a browser: who's down here with you, and as who)
    guestInfo() {
      return [...guests.values()].map((g) => ({
        id: g.id,
        name: g.name,
        dim: g.dim.code,
        walkers: g.walkers.filter(Boolean).map((wk) => ({ who: wk.who, alt: wk.alt, shown: wk.group.visible, metres: wk.w && S.me ? Math.round(apart(S.me, wk.w, S.R) / METRE) : null, bearing: wk.w && S.me ? +bearing(S.me.n, S.me.f, vec.add(wk.w.n, S.me.n, -1)).toFixed(3) : null })),
      }));
    },
    // which way is up where the camera is, and where it is (the map's space): what's below the horizon
    horizon() {
      return S.cam.pos ? { at: S.cam.pos, up: S.cam.up } : null;
    },
    // on the way in through the air: how far along (seconds, of `T`) and
    // the show's numbers (entry.js's fxAt), for the camera's shake and the
    // roar; null once it's down (or if it wasn't flown in)
    entry() {
      const e = S.entry;
      if (!e) return null;
      // (one object, filled in again: the scene asks more than once a frame)
      entryView.t = e.t;
      entryView.T = e.path.T;
      entryView.fx = e.fx ?? fxAt(e.t);
      return entryView;
    },
    // the landing's loose things, for a check in a browser (scripts/
    // props-check.mjs): how many, whether the engine's in, and knock(i), a
    // shot through the i-th from a few metres off, with where it stood and
    // where it's drawn a second later
    physics() {
      const list = rocks?.bodies ?? [];
      const drawn = (b) => {
        const m = new THREE.Matrix4();
        if (b.object) m.copy(b.object.matrix);
        else b.meshes[0].getMatrixAt(b.index, m);
        return new V().setFromMatrixPosition(m).toArray();
      };
      return {
        engine: !physical ? 'off' : lp === null ? 'loading' : lp === false ? 'failed' : 'ready',
        bodies: list.length,
        simulated: lp ? lp.size : 0,
        pushers: lp ? lp.pushers : 0,
        kinds: list.map((b) => b.object?.name || b.meshes?.[0]?.parent?.name || '?'),
        // (the loose ones, lightest first, at the size each stands: what a
        // shot moves furthest)
        loose: list.flatMap((b, i) => (b.body.fixed ? [] : [i])).sort((a, b) => (list[a].body.mass ?? 0) * list[a].scale ** 3 - (list[b].body.mass ?? 0) * list[b].scale ** 3),
        drawn: (i) => (list[i] ? drawn(list[i]) : null),
        bodyAt: (i) => list[i] && { position: list[i].position, quaternion: list[i].quaternion, scale: list[i].scale, box: list[i].box, body: list[i].body },
        knock(i) {
          const b = list[i];
          if (!b || !lp) return null;
          const p = b.position;
          const n = vec.unit(p);
          const mid = vec.add(p, n, ((b.box.min[1] + b.box.max[1]) / 2) * b.scale * METRE);
          const side = vec.unit(vec.cross(n, Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]));
          return lp.shot(vec.add(mid, side, -4 * METRE), vec.add(mid, side, 4 * METRE));
        },
      };
    },
    // the fallen leaves, for a check in a browser (scripts/leaves-check.mjs):
    // how many and where they are (landings/litter.js's info, round you),
    // whether the landing's in, the crowns' shader, and blast(r), a blast
    // at your feet
    leaves() {
      if (!import.meta.env.DEV) return null;
      let key = null;
      rocks?.mesh.traverse((o) => (key ??= o.material?.name === 'Leaves_NormalTree' ? o.material.customProgramCacheKey() : null));
      return { ...leaves.info(S.me ? at(S.me, S.R) : null), ready: Boolean(rocks?.ready), canopy: key, blast: (r = 3) => (S.me ? leaves.blast(at(S.me, S.R), r) : 0) };
    },
    // the ship's numbers to fly on from, once it's up (null until then)
    takeoff() {
      return S.done;
    },
    // all gone: the ground, the people, the planet turning again
    end() {
      const planet = planetOf[S.id];
      planet?.hold?.(false);
      if (planet?.air) {
        planet.air.visible = true;
        // (ended partway in: as bright as it was before the ship flew into it)
        if (S.entry) planet.air.material.uniforms.uStrength.value = S.airWas;
      }
      S.entry = null;
      S.sky = 1;
      reentry.stop();
      if (planet?.body && S.hideBody) {
        if (S.bodyAll) planet.body.visible = S.bodyShown;
        else planet.body.layers.mask = S.bodyMask;
      }
      S.hideBody = 0;
      S.band = null;
      for (const p of party ?? []) {
        root.remove(p.group);
        p.gp?.dispose();
        p.fig.dispose?.();
      }
      party = null;
      for (const g of [...guests.values()]) dropGuest(g);
      for (const id of [...troopFigs.keys()]) dropTroop(id);
      for (const key of [...blobs.keys()]) dropShadow(key);
      for (const o of S.bolts) o.mesh.visible = false;
      S.bolts = [];
      boltStep.clear();
      fx.clear();
      if (vm) vm.gun.visible = false;
      if (lp) lp.dispose();
      lp = null;
      physical = false;
      fed = walled = 0;
      shipWalled = false;
      for (const x of [ground, rocks, haze, sides]) {
        if (!x) continue;
        root.remove(x.mesh);
        x.dispose();
      }
      ground = rocks = haze = sides = null;
      leaves.end();
      seeCanopy(null);
      lamps.clear();
      for (const o of owned) o?.dispose?.();
      owned.length = 0;
      if (S.model) S.model.group.scale.setScalar(1);
      root.visible = false;
      S.phase = null;
      S.id = null;
      S.me = S.mate = null;
      S.troops = [];
      S.done = null;
    },
    dispose() {
      this.end();
      // (the figures the landings' copies were made of: the cast's, the troops' own)
      cast?.dispose();
      cast = null;
      for (const e of troopModels.values()) if (e.ready) freeScene(e.ready.scene);
      troopModels.clear();
      for (const p of partyModels.values()) p.then((tpl) => tpl && freeScene(tpl.scene));
      partyModels.clear();
      boltGeo.dispose();
      sleeveGeo.dispose();
      fx.dispose();
      pfx.dispose();
      gfx.dispose();
      knocks.dispose();
      flare?.removeFromParent();
      lamps.dispose();
      if (vm) for (const o of vm.owned) o.dispose?.();
      shadowMat.dispose();
      for (const m of boltMats.values()) {
        m.core.dispose();
        m.sleeve.dispose();
      }
      puffTex.dispose();
      for (const s of puffs) s.material.dispose();
      reentry.dispose();
      leaves.dispose();
      map.remove(root);
    },
  };
}

const rotateAbout = (v, k, a) => {
  const c = Math.cos(a);
  const s = Math.sin(a);
  const kv = vec.cross(k, v);
  const d = vec.dot(k, v) * (1 - c);
  return [v[0] * c + kv[0] * s + k[0] * d, v[1] * c + kv[1] * s + k[1] * d, v[2] * c + kv[2] * s + k[2] * d];
};

// A crew member as a figure, for the galaxy's worlds (galaxy/surface/scene.js):
// in map units (scale by 1 / METRE for metres); `cast` is createMeshyCast()'s,
// for the cruiser’s two (Walt and Jesse, in their looks too)
export { loadParty as loadPartyFigure };
