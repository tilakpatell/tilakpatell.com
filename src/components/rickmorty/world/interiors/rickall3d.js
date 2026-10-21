// Total Rickall in the Smiths' living room, drawn: whoever ./rickall.js puts
// in the room, on their spots, from the game the component hands the house
// each frame (state.rickall: { game, aim }). The rigged ones are the Meshy
// cast's (portal/meshyCast.js) with their idles; the props are the cast's
// too, fitted to their heights: the Reverse Giraffe, the Photography Raptor
// with his camera, Tinkles, Mrs. Refrigerator, Baby Wizard floating, and the
// Ghost in a Jar, whose jar is made here (Meshy couldn't make clear glass):
// a glass jar with rounded shoulders and a shiny gold screw lid on a little
// side table, the ghost in it glowing pale mint and squashed to the show's
// squat bell. A parasite shot shrinks away to nothing; a real person is hit
// and goes down (the `shot` clip, kept down; a prop without one tips over),
// and whoever's stood near flinches back from it (`scared`). Each breathes
// in their own time, their head on Morty while he's close. A ring on the
// floor marks who's in the sights.
//
// Loaded the first time the egg hatches (./house.js asks for it), so the
// world's first download doesn't carry it, and each figure is fetched then
// too. One that won't load is left out (the component leaves them out of the
// game), and is asked for again the next game, in case its file has come.

import * as THREE from 'three';
import { toon } from '../../portal/toon';
import { lathe } from './shell';
import { FAMILY, PARASITES } from './rickall';

const HEIGHT = new Map([...PARASITES, ...FAMILY].map((p) => [p.id, p.h]));
const CLIPS = ['idle', 'walk']; // (the walk stays: the cast turns each idle to face the way it does)
// how far off the floor each floats (Baby Wizard, to his feet)
const LIFT = { babywizard: 0.4 };
// the Ghost in a Jar: the table's top, the jar on it, and him in it
const TABLE = 0.46;
const JAR = 1.25; // (its measurements below, a quarter bigger, to read beside a person)
const GHOST = { h: 0.4, squat: 0.7, y: 0.025 };
const MINT = 0xc8ffe6;
const SHRINK = 0.45; // how long a parasite takes to go, once shot (s)
const FALL = 0.7; // and a real person to fall
const NEAR = 2.6; // how near a shot someone stands to flinch from it (m)

const ease = (k) => 1 - (1 - Math.min(1, Math.max(0, k))) ** 3;

// R: the house's room (./shell.js's makeRoom, built); kit: the world's;
// flat: a group of the house's that the ink leaves alone, for what lies on
// the floor or shines (the sights' ring, the glass's highlights)
export function createCrowd(R, kit, flat) {
  const group = new THREE.Group();
  group.name = 'rickall';
  group.visible = false;
  R.group.add(group);
  const owned = [];
  const own = (x) => {
    owned.push(x);
    return x;
  };
  const made = new Map(); // id → { holder, tilt, c, lift }
  const tried = new Set();

  // ── the jar ──
  const jarGeo = own(
    lathe(
      [
        [0.17, 0],
        [0.188, 0.012],
        [0.195, 0.045],
        [0.195, 0.3],
        [0.186, 0.338],
        [0.163, 0.368],
        [0.142, 0.384],
        [0.136, 0.4],
        [0.136, 0.428],
      ],
      40,
    ),
  );
  // see-through face on, thicker towards its edges, as the show draws glass
  // (and the cruiser's dome is drawn)
  const glass = own(toon(0xe8fbff, { transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  glass.onBeforeCompile = (s) => {
    s.fragmentShader = s.fragmentShader.replace(
      '#include <opaque_fragment>',
      `{
        float rim = 1.0 - abs(dot(normal, normalize(vViewPosition)));
        diffuseColor.a = 0.08 + 0.62 * rim * rim;
      }
      #include <opaque_fragment>`,
    );
  };
  glass.customProgramCacheKey = () => 'rickall-glass';
  const gold = own(toon(0xe2ac2c, { emissive: 0x4a3200, emissiveIntensity: 1 }));
  const shine = own(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }));
  const goldShine = own(new THREE.MeshBasicMaterial({ color: 0xfff1b8 }));
  const lidGeo = own(new THREE.CylinderGeometry(0.148, 0.148, 0.06, 32));
  const ridgeGeo = own(new THREE.TorusGeometry(0.149, 0.006, 6, 32).rotateX(Math.PI / 2));
  // (a shallow dome over the whole lid: a cap of a sphere 0.913 m round, 0.148 m across its rim, 12 mm high)
  const capGeo = own(new THREE.SphereGeometry(0.913, 32, 4, 0, Math.PI * 2, 0, 0.162));
  const streakGeo = own(new THREE.CylinderGeometry(0.199, 0.199, 0.22, 8, 1, true, -0.25, 0.16));
  const dotGeo = own(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 6, 1, true, -0.1, 0.07));
  const lidGlint = own(new THREE.CylinderGeometry(0.151, 0.151, 0.045, 6, 1, true, -0.35, 0.22));
  const wood = kit.mats.toon(0x7a4a2a);
  const legGeo = own(new THREE.CylinderGeometry(0.035, 0.045, TABLE - 0.06, 10));
  const topGeo = own(new THREE.CylinderGeometry(0.25, 0.24, 0.035, 28));
  const footGeo = own(new THREE.CylinderGeometry(0.15, 0.17, 0.03, 20));
  // the jar's thick glass bottom, pale, so he isn't stood in the table's brown
  const bottomGeo = own(new THREE.CylinderGeometry(0.186, 0.17, 0.024, 32));
  const bottom = own(toon(0xd6efe9));
  const mesh = (geo, mat, x, y, z) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  };
  // the ghost (a figure from the cast) on his table, in his jar, lit pale mint
  function jarred(c) {
    const out = new THREE.Group();
    out.add(mesh(footGeo, wood, 0, 0.015, 0), mesh(legGeo, wood, 0, 0.03 + (TABLE - 0.06) / 2, 0), mesh(topGeo, wood, 0, TABLE - 0.0175, 0));
    const jar = new THREE.Group();
    jar.position.y = TABLE;
    jar.scale.setScalar(JAR);
    out.add(jar);
    const k = GHOST.h / c.height;
    c.group.scale.set(k, k * GHOST.squat, k);
    c.group.position.y = GHOST.y;
    c.group.traverse((o) => {
      if (!o.isMesh) return;
      // (a ghost in a jar has no line)
      if (o.userData.ink) {
        o.visible = false;
        return;
      }
      // (lit by his own texture, so his eyes and mouth stay dark as the rest of him glows)
      const map = o.material.map ?? null;
      o.material = own(toon(0xffffff, { map, emissive: map ? 0xffffff : MINT, emissiveMap: map, emissiveIntensity: 0.75 }));
      o.castShadow = false;
    });
    jar.add(c.group);
    const body = mesh(jarGeo, glass, 0, 0, 0);
    body.castShadow = false;
    body.renderOrder = 2;
    jar.add(body, mesh(bottomGeo, bottom, 0, 0.012, 0));
    // the lid: a gold screw cap, ridged, with a glint
    jar.add(mesh(lidGeo, gold, 0, 0.445, 0), mesh(capGeo, gold, 0, 0.475 - 0.913 * Math.cos(0.162), 0));
    for (const y of [0.425, 0.44, 0.455]) jar.add(mesh(ridgeGeo, gold, 0, y, 0));
    // highlights the ink leaves alone, kept in the house's un-inked layer where the jar stands
    const glints = new THREE.Group();
    glints.add(new THREE.Mesh(streakGeo, shine), new THREE.Mesh(dotGeo, shine), new THREE.Mesh(lidGlint, goldShine));
    glints.children[0].position.y = 0.19;
    glints.children[1].position.y = 0.3;
    glints.children[2].position.y = 0.445;
    for (const g of glints.children) g.renderOrder = 3;
    glints.scale.setScalar(JAR);
    flat.add(glints);
    return { out, glints, jar };
  }

  // someone for the room, if their model's loaded: their holder (where they
  // stand, which way they face), the tilt they fall over by, and the figure
  function makeOne(id) {
    const c = kit.cast.make(id);
    if (!c) return null;
    const holder = new THREE.Group();
    const tilt = new THREE.Group();
    holder.add(tilt);
    const lift = LIFT[id] ?? 0;
    let jar = null;
    if (id === 'ghostinajar') {
      jar = jarred(c);
      tilt.add(jar.out);
    } else {
      c.group.scale.setScalar((HEIGHT.get(id) - lift) / c.height);
      tilt.add(c.group);
    }
    holder.visible = false;
    group.add(holder);
    return { holder, tilt, c, lift, jar, shotAt: null, seed: Math.random() * 10, down: false, flinched: null, looking: false };
  }

  // Load everyone in `ids` (a game's room), and say which can be drawn. One
  // asked for before and missed is asked for again, straight from the cast
  // (the world's need() keeps its first answer).
  async function load(ids) {
    const want = ids.filter((id) => !made.has(id));
    const first = want.filter((id) => !tried.has(id));
    const again = want.filter((id) => tried.has(id));
    for (const id of first) tried.add(id);
    await Promise.all([first.length ? kit.need(first, { clips: CLIPS }) : null, ...again.map((id) => kit.track(kit.cast.load(null, [id], { clips: CLIPS })))]).catch(() => {});
    for (const id of want) {
      const f = makeOne(id);
      if (f) made.set(id, f);
    }
    return ids.filter((id) => made.has(id));
  }

  // the sights' ring, under whoever's in them
  const ring = new THREE.Mesh(own(new THREE.RingGeometry(0.42, 0.5, 40).rotateX(-Math.PI / 2)), own(new THREE.MeshBasicMaterial({ color: new THREE.Color(0x9dff5a).multiplyScalar(1.6), transparent: true, opacity: 0.7, depthWrite: false })));
  ring.visible = false;
  flat.add(ring);

  const M = new THREE.Matrix4();
  const EYE = new THREE.Vector3();
  // up again from the last game: no longer down, no flinch, its head ahead
  const reset = (f) => {
    if (f.down) f.c.stop?.(0);
    f.down = false;
    f.flinched = null;
    if (f.looking) f.c.look?.(null);
    f.looking = false;
  };
  function update(t, dt, state) {
    const r = state?.rickall;
    const g = r?.game ?? null;
    group.visible = Boolean(g);
    ring.visible = false;
    if (!g) {
      for (const f of made.values()) {
        if (f.jar) f.jar.glints.visible = false;
        if (f.down || f.looking) reset(f);
      }
      return;
    }
    // someone shot this frame: whoever's stood near them flinches from it
    const m = state?.morty;
    for (const [id, f] of made) {
      if (!g.shot.includes(id) || f.shotAt != null) continue;
      const p = g.people.find((o) => o.id === id);
      for (const [other, o] of made) {
        const q = other !== id && !g.shot.includes(other) && g.people.find((x) => x.id === other);
        if (!q || o.flinched === id || Math.hypot(q.x - p.x, q.z - p.z) > NEAR) continue;
        o.flinched = id;
        o.c.react?.('gunfire', { target: { x: p.x, z: p.z } });
      }
    }
    for (const [id, f] of made) {
      const p = g.people.find((o) => o.id === id);
      // (right at his shoulder, where the camera can't see past them: out of the picture)
      f.holder.visible = Boolean(p) && !r.hide?.includes(id);
      if (f.jar) f.jar.glints.visible = false;
      if (!f.holder.visible) continue;
      f.holder.position.set(p.x, f.lift, p.z);
      f.holder.rotation.y = p.face + Math.PI / 2;
      // shot: a parasite shrinks away spinning; a real person goes down on
      // the `shot` clip and stays there (one who can't play it tips over)
      const shot = g.shot.includes(id);
      if (shot) f.shotAt ??= t;
      else {
        if (f.shotAt != null) reset(f);
        f.shotAt = null;
      }
      const k = shot ? (t - f.shotAt) / (p.parasite ? SHRINK : FALL) : 0;
      if (p.parasite) {
        const s = 1 - ease(k);
        f.tilt.scale.setScalar(Math.max(0.001, s));
        f.tilt.rotation.set(0, k * 6, 0);
        f.holder.visible = k < 1;
      } else {
        if (shot && !f.down) {
          f.down = true;
          f.fell = !f.c.anim; // (no clip to go down on: tipped over, as ever)
          f.c.play?.('shot', { hold: Infinity }).then((ok) => {
            if (!ok) f.fell = true;
          });
        }
        f.tilt.scale.setScalar(1);
        f.tilt.rotation.set(f.fell ? -ease(k) * Math.PI * 0.48 : 0, 0, 0);
      }
      // Baby Wizard bobs as he floats; the ghost bobs in his jar
      if (f.lift) f.holder.position.y = f.lift + Math.sin(t * 1.5 + f.seed) * 0.05;
      // (the glints go where the jar is, as big and as turned: shot, they shrink and spin away with it)
      if (f.jar) {
        f.c.group.position.y = GHOST.y + (Math.sin(t * 1.9 + f.seed) + 1) * 0.008;
        f.jar.glints.visible = f.holder.visible;
        f.jar.jar.updateWorldMatrix(true, false);
        flat.updateWorldMatrix(true, false);
        M.copy(flat.matrixWorld).invert().multiply(f.jar.jar.matrixWorld).decompose(f.jar.glints.position, f.jar.glints.quaternion, f.jar.glints.scale);
      }
      // (still standing, or going down: the idle plays, or the shot; the
      // living's heads on Morty while he's close)
      if (f.c.mixer && (!shot || !p.parasite)) {
        f.c.update(t, 0, 0, { dt });
        const look = m && !shot && Math.hypot(m.x - p.x, m.z - p.z) < 3.2 ? EYE.set(m.x, 1.45, m.z) : null;
        if (look || f.looking) {
          f.c.look?.(look);
          f.looking = Boolean(look);
        }
      }
      if (id === r.aim && !shot) {
        ring.visible = true;
        ring.position.set(p.x, 0.02, p.z);
        ring.scale.setScalar(Math.max(0.75, Math.min(1.1, p.r / 0.4)) * (1 + Math.sin(t * 6) * 0.04));
      }
    }
  }

  function dispose() {
    for (const f of made.values()) {
      f.c.mixer?.stopAllAction();
      f.jar?.glints.removeFromParent();
    }
    ring.removeFromParent();
    group.removeFromParent();
    for (const o of owned) o.dispose?.();
    owned.length = 0;
    made.clear();
  }

  return { load, update, dispose };
}
