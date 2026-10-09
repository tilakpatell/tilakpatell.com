// Everyone else flying the universe map, drawn: each pilot's ship (the one
// they picked, the same models as your own, in the paint job and with the
// parts they fitted in the hangar: outfit.js), moved smoothly between the
// poses that come in (protocol.js's sample), with their callsign over it
// (a DOM tag, like the planets' names, set as text only) and their shields
// under it once they've taken a hit; and their shots, as bolts. Your own
// bolts are tested against them here (hit), and the ones who aren't your
// allies are there for the guns to lock on to (targets). A pilot whose crew
// are out walking on a planet (peer.foot) has their ship sat on the ground
// where they came down, the way footScene.js parks yours (and out of the
// guns' way: there's no one in it). One just back from being shot down
// (safe, a few seconds) can't be hit or locked on to either, and says so on
// its tag; one whose shots have been landing on you counts as a threat, for
// the lock and the arrows at the edge of the screen.
//
// Out on the universe map, spread wide, only those within DRAW of you are
// ships (pilotsRules.js): further off they're left to the chart
// (NavMap.jsx's blips, from `chart`).
//
// The hunters after each of them are here too (given a `fleet` to make them
// from and the `kinds` they are): drawn where their pilot says they are,
// flown on between tellings, there for your guns to lock on to and to hit.
// A hit is told to their pilot, whose they are (client.js's hunterHit); one
// that should have finished a hunter takes it off the sky at once, without
// waiting to hear (it's back if its pilot says otherwise).
//
// createPilots(parent, { T, colors, here, fleet, kinds }) → { update(dt, now, client, view),
//   hit(from, to, damage) → { id, at, size } (a pilot) or { id, hunter, kind,
//   at, size, down } (one of the hunters after pilot `id`), targets, mates
//   (your allies in view: { id, name, at }, for the HUD's markers at the
//   edge), count, chart, at(id), pose(id), dispose(), bodies (shipHits.js's:
//   the pilots flying, and the hunters after them) }
// view: { project(x, y, z, out) (to the canvas: out.x, out.y in px and
// out.z, the depth), tags (the element the tags go in), locked (the pilot
// the guns are locked on, whose name the lock shows instead; footOn, the
// planet you're down on, if you are: the crews there have tags of their own),
// me (your ship, for how far off they are; the camera's depth without it),
// factions (yours: client.js's, for whose side each of them is on),
// from (where your ship is, { x, y, z }, or null: on the universe map,
// given at all, it's what DRAW is measured from; left out, as the galaxy
// does, everyone's a ship as before) }
//
// A tag (tagRules.js says what it shows at each distance) is the callsign
// (set as text only: it's theirs), the distance, their level and their
// rank, coloured by how they stand to you (relations.js: data-relation),
// kept inside the tags box; a click on one is a `tp:pilot` window event
// with their id, for the roster (Online.jsx) to open on them.

import { writeBuild } from '../shipyard/build';
import * as THREE from 'three';
import { disposeTree } from '../../../lib/three/renderer';
import { SHIP_MODELS, buildShip } from '../shipModels';
import { paintById } from '../paint';
import { PARTS_SLOTS, STOCK, STOCK_LOADOUT, partById } from '../outfit';
import { SHIP } from '../ship';
import { sweptHit } from '../targeting';
import { hitRadius } from '../hunterRules';
import { PARKED } from '../foot';
import { WEAPONS, arsenalOf, byCode, fan } from '../weapons';
import { POSITIONS } from '../layout';
import { byId } from '../universes';
import { STALE_MS, sample } from './protocol';
import { UNIVERSE } from './where';
import { howToDraw } from './pilotsRules';
import { distText, fontPx, keepIn, tagMode } from './tagRules';
import { relation } from './relations';
import { RANKS } from '../../galaxy/ranks';
import { gltfLoader } from '../../../lib/three/gltf';

const MODELS = { ...SHIP_MODELS, cruiser: '/games/meshy/saucer.glb' }; // (the cruiser the C-137 planet flies; your own is the page's, crew aboard)
export const SIZE = 0.3; // across, for the guns, for hits and for a ram (contact.js's size)
const HIT_R = 0.22; // how close a bolt must pass to hit
const BOLTS = 24;
const BOLT_LIFE = 1.1;
const THREAT_MS = 8000; // a pilot whose shot hit you this lately is a threat
const PACK_STALE = 1500; // ms: hunters not heard of for this long are gone
const PACK_AHEAD = 0.4; // seconds, at most, a hunter's flown on from where it was last said to be
const GONE_MS = 2500; // a hunter your shot should have finished stays off the sky this long, unless its pilot says it's down

const loader = gltfLoader();

// how far a ship's lowest point is below its middle, flying size (it sits
// that much off the ground, parked, scaled up by PARKED)
const box = new THREE.Box3();
const part = new THREE.Box3();
function underside(model) {
  const g = model.group;
  const keep = { p: g.position.clone(), q: g.quaternion.clone(), s: g.scale.clone(), r: model.pivot.rotation.clone() };
  g.position.set(0, 0, 0);
  g.quaternion.identity();
  g.scale.setScalar(1);
  model.pivot.rotation.set(0, 0, 0);
  g.updateMatrixWorld(true);
  box.makeEmpty();
  const shown = (o) => {
    for (let q = o; q && q !== g; q = q.parent) if (!q.visible) return false;
    return true;
  };
  g.traverse((o) => {
    if (!o.isMesh || !o.geometry || !shown(o)) return; // (not the stand-in, once the model's in)
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    box.union(part.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld));
  });
  g.position.copy(keep.p);
  g.quaternion.copy(keep.q);
  g.scale.copy(keep.s);
  model.pivot.rotation.copy(keep.r);
  return box.isEmpty() ? 0.05 : -box.min.y;
}
const frame = new THREE.Matrix4();
const N = new THREE.Vector3();
const F = new THREE.Vector3();
const R = new THREE.Vector3();

// `here` is the place they're drawn in: the universe map, unless it's one
// of the galaxy's systems (a function, read each frame: the galaxy's page
// stays up from one system to the next)
export function createPilots(parent, { T = {}, colors = {}, here = UNIVERSE, fleet = null, kinds = {} } = {}) {
  const place = typeof here === 'function' ? here : () => here;
  const ships = new Map(); // peer id → { kind, loadout, model, tag, at, vel, shown, ally }
  // the hunters after the others: `${peer id}:${hunter id}` → { owner, hunter,
  // kind, type, model, at, prev, vel, hp, hurt, hitAt, goneUntil, seen, target }
  const ghosts = new Map();
  const spare = {}; // kind → hunter models not in use
  let tick = 0; // which update this is (a hunter not told of in it has gone)
  let clock = 0; // `now`, as of the last update
  const aim = new THREE.Vector3();
  const takeModel = (kind) => {
    const drawn = kinds[kind]?.model ?? kind; // (drawn as another kind, as hunters.js's are)
    // a built stand-in waiting here gives way once the model is in (as hunters.js's do)
    if (fleet.loaded(drawn) && spare[kind]?.length && !spare[kind][spare[kind].length - 1].model) for (const m of spare[kind].splice(0)) m.dispose();
    const model = spare[kind]?.pop() ?? fleet.make(drawn);
    model.fit ??= 1 / Math.max(model.size?.x ?? 1, model.size?.y ?? 1, model.size?.z ?? 1);
    parent.add(model.group);
    return model;
  };
  const dropGhost = (key, g) => {
    g.model.group.removeFromParent();
    (spare[g.kind] ??= []).push(g.model);
    ghosts.delete(key);
  };
  const cache = new Map(); // url → Promise<scene | null>
  let disposed = false;

  const modelFor = (url) => {
    if (!cache.has(url)) cache.set(url, loader.loadAsync(url).then((g) => g.scene).catch(() => null));
    return cache.get(url);
  };

  // a ship's own parts go with it; the models it shares with the others stay
  const drop = (sh) => {
    sh.model.group.removeFromParent();
    sh.model.dispose();
    const shared = [];
    sh.model.group.traverse((o) => o.userData.shared && shared.push(o));
    for (const o of shared) o.removeFromParent();
    disposeTree(sh.model.group);
    sh.tag?.remove();
  };

  // (hull: their garage build, or null for their stock ship)
  const hullKey = (b) => (b ? writeBuild(b).join() : '');
  const build = (id, kind, tags, hull = null) => {
    const model = buildShip(kind, T, { build: hull });
    model.group.visible = false;
    parent.add(model.group);
    const url = hull ? null : MODELS[kind]; // (a garage build is whole as it is)
    if (url) {
      modelFor(url).then((scene) => {
        const sh = ships.get(id);
        if (!scene || disposed || sh?.model !== model) return;
        const copy = scene.clone(true);
        copy.traverse((o) => (o.userData.shared = true));
        model.dress(copy, { clone: true }); // (its own materials, for its own paint)
        if (!model.mount(copy)) copy.removeFromParent();
        else sh.under = null; // (sits differently now: measured again)
      });
    }
    let tag = null;
    let bits = null;
    if (tags) {
      tag = document.createElement('span');
      tag.className = 'universe-tag';
      const line = document.createElement('span');
      line.className = 'universe-tag-line';
      bits = { name: document.createElement('b'), dist: document.createElement('small'), level: document.createElement('em'), rank: document.createElement('span') };
      bits.rank.className = 'universe-tag-rank';
      line.append(bits.name, bits.dist, bits.level);
      tag.append(line, bits.rank, document.createElement('i'));
      tag.title = 'Show in the roster';
      tag.addEventListener('click', () => window.dispatchEvent(new CustomEvent('tp:pilot', { detail: { id } })));
      tags.append(tag);
    }
    // (what the tag last showed, so it's written only on a change; its size
    // measured at the start of the next update, before anything's written)
    return { kind, hull: hullKey(hull), loadout: STOCK_LOADOUT, model, tag, bits, name: '', at: new THREE.Vector3(), prev: new THREE.Vector3(), vel: new THREE.Vector3(), shown: false, pose: null, mode: null, seen: { x: 0, z: 0 }, parked: false, under: null, ally: false, safe: false, threat: 0, tagOn: null, tagName: null, tagShown: {}, tagW: 90, tagH: 22, measure: true };
  };

  // bolts from the others' guns: only drawn (a hit is the shooter's to call)
  const boltGeo = new THREE.CylinderGeometry(0.007, 0.007, 0.28, 6).rotateX(Math.PI / 2);
  const boltMats = new Map(); // by colour: the ship's own, or its paint job's
  const matFor = (color) => {
    if (!boltMats.has(color)) boltMats.set(color, new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(4), toneMapped: false, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    return boltMats.get(color);
  };
  const boltColor = (kind, paint) => paintById(paint).bolt ?? colors[kind] ?? '#ff4a3d';
  const bolts = Array.from({ length: BOLTS }, () => {
    const m = new THREE.Mesh(boltGeo, matFor(boltColor(null, STOCK)));
    m.visible = false;
    m.rotation.order = 'YXZ';
    m.userData = { life: 0, v: new THREE.Vector3() };
    parent.add(m);
    return m;
  });
  // their shot as it came in, as it is: a blaster bolt, a spread's fan of
  // five, or a heavy round (big, slow, glowing in its ship's colour)
  const one = (s, v, k, life, color) => {
    const b = bolts.find((m) => !m.visible) ?? bolts[0];
    b.material = matFor(color);
    b.scale.set(k, k, 1 + (k - 1) * 0.4);
    b.position.set(...s.p);
    b.userData.v.set(...v);
    b.userData.life = life;
    const [vx, vy, vz] = v;
    b.rotation.set(Math.atan2(vy, Math.hypot(vx, vz)), Math.atan2(-vx, -vz), 0);
    b.visible = true;
  };
  const fireBolt = (s) => {
    const k = partById('guns', s.guns)?.bolt ?? 1; // (a fusion cannon's are bigger)
    const color = boltColor(s.kind, s.paint);
    // (drawn by what the weapon is, not which: a code this build has never
    // heard of is the blaster)
    const w = WEAPONS[byCode(s.w)];
    if (w.heavy) {
      one(s, s.v, 4, BOLT_LIFE * w.life, arsenalOf(s.kind).heavy);
      return;
    }
    if (w.count > 1) {
      const speed = Math.hypot(...s.v) || 1;
      for (const d of fan(s.v.map((x) => x / speed), w.count, w.cone)) one(s, [d[0] * speed, d[1] * speed, d[2] * speed], k * w.scale, BOLT_LIFE * w.life, color);
      return;
    }
    one(s, s.v, k, BOLT_LIFE, color);
  };

  const spot = { x: 0, y: 0, z: 0 };
  let live = 0;
  // one of the hunters after another pilot hit, worth `damage`: the hit, for
  // the scene to tell its pilot (one that should be down is off the sky)
  const hurtGhost = (ghost, damage) => {
    ghost.hurt += damage;
    ghost.hitAt = clock;
    const down = ghost.told - ghost.hurt <= 0;
    if (down) {
      ghost.goneUntil = clock + GONE_MS;
      ghost.model.group.visible = false;
    }
    return { id: ghost.owner, hunter: ghost.hunter, kind: ghost.kind, at: ghost.at.clone(), size: ghost.type.size, down };
  };

  return {
    // where everyone is now; their tags; their shots on their way
    update(dt, now, client, view) {
      let busy = false;
      live = 0;
      tick += 1;
      clock = now;
      const peers = client?.peers ?? new Map();
      const at = place();
      // (every read before any write: a read after one makes the browser lay the page out again)
      const boxW = view?.tags?.clientWidth ?? 0;
      const boxH = view?.tags?.clientHeight ?? 0;
      for (const sh of ships.values()) {
        if (!sh.measure || !sh.tagOn) continue;
        sh.measure = false;
        sh.tagW = sh.tag.offsetWidth;
        sh.tagH = sh.tag.offsetHeight;
      }
      const away = (p) => (p.where ?? UNIVERSE) !== at; // (somewhere else: gone off into a world, or another system)
      // (spread out, on the universe map, once the scene says where you are)
      const spread = at === UNIVERSE && Boolean(view) && 'from' in view;
      for (const [id, sh] of ships) {
        const p = peers.get(id);
        if (!p || p.blocked || !p.kind || away(p)) {
          drop(sh);
          ships.delete(id);
        }
      }
      for (const p of peers.values()) {
        if (p.blocked || !p.kind || !p.name || away(p)) continue;
        let sh = ships.get(p.id);
        if (sh && (sh.kind !== p.kind || sh.hull !== hullKey(p.build))) {
          drop(sh);
          sh = null;
        }
        if (!sh) {
          sh = build(p.id, p.kind, view?.tags ?? null, p.build ?? null);
          ships.set(p.id, sh);
        }
        if (sh.loadout !== p.loadout) {
          // (what they fitted: a new loadout's a new object, so only then)
          const was = sh.loadout;
          sh.loadout = p.loadout;
          if (was.paint !== p.loadout.paint) sh.model.paint(paintById(p.loadout.paint));
          if (PARTS_SLOTS.some((slot) => was[slot] !== p.loadout[slot])) sh.model.outfit(p.loadout); // (in the paint it wears)
        }
        const s = sample(p.snaps, now);
        // down on a planet, their crew out: parked where they came down
        const down = p.foot && now - p.foot.at < STALE_MS && POSITIONS[p.foot.planet] ? p.foot : null;
        const flying = Boolean(s && !s.hidden) && !down;
        // a ship near you; far off, a blip on the chart (by where they last
        // said they were, not the guess ahead)
        const last = p.pose ?? s;
        sh.mode = !flying ? null : spread ? howToDraw(last, view.from) : 'ship';
        const on = sh.mode === 'ship';
        const was = sh.shown;
        sh.shown = on;
        // (for flying to them: where they are now, while they're flying here, near or far)
        sh.pose = flying ? { x: s.x, y: s.y, z: s.z, heading: s.heading, name: p.name } : null;
        if (flying) {
          sh.seen.x = s.x;
          sh.seen.z = s.z;
        }
        sh.name = p.name; // (for the lock's bracket, whether or not their tag's showing)
        sh.ally = p.ally === 'ally';
        sh.safe = on && Boolean(s.safe);
        sh.threat = on && !sh.ally && now - p.hitAt < THREAT_MS ? 1 : 0;
        const g = sh.model.group;
        g.visible = on || Boolean(down);
        if (down && !sh.parked) sh.model.park?.(true);
        if (!down && sh.parked) sh.model.park?.(false);
        sh.parked = Boolean(down);
        if (down) {
          busy = true;
          sh.under ??= underside(sh.model);
          const k = PARKED[sh.kind] ?? 1;
          const [cx, cy, cz] = POSITIONS[down.planet];
          const lift = byId(down.planet).size + sh.under * k + 0.001;
          N.set(...down.ship.n);
          F.set(...down.ship.f);
          g.position.set(cx + N.x * lift, cy + N.y * lift, cz + N.z * lift);
          frame.makeBasis(R.crossVectors(F, N), N, F.negate());
          g.quaternion.setFromRotationMatrix(frame);
          g.scale.setScalar(k);
          sh.model.pivot.rotation.set(0, 0, 0);
          sh.model.setThrottle(0);
          sh.model.update(now / 1000);
        } else if (on) {
          live += 1;
          busy = true;
          g.scale.setScalar(1);
          g.position.set(s.x, s.y, s.z);
          g.rotation.set(s.pitch, s.heading, -s.bank, 'YXZ'); // (any way round: loops, rolls, upside down)
          sh.model.setThrottle(Math.min(1, Math.abs(s.speed) / SHIP.cruise) * (s.boost ? 1 : 0.7));
          sh.model.update(now / 1000);
          sh.model.drive(dt, { throttle: Math.min(1, Math.abs(s.speed) / SHIP.cruise), boost: s.boost });
          // where it was last frame too (just come into view, it hasn't come from anywhere)
          if (was) sh.prev.copy(sh.at);
          else sh.prev.set(s.x, s.y, s.z);
          sh.at.set(s.x, s.y, s.z);
          sh.vel.set(-Math.sin(s.heading) * Math.cos(s.pitch) * s.speed, s.vy, -Math.cos(s.heading) * Math.cos(s.pitch) * s.speed);
        }
        // the tag over them
        const tag = sh.tag;
        if (!tag) continue;
        // (parked, over the ship, unless you're down there with them: their crew have tags then)
        let show = (on && view.locked !== p.id) || (down && view.footOn !== down.planet);
        let mode = null;
        let pos = null;
        let dist = 0;
        if (show) {
          const x = down ? g.position.x : s.x;
          const y = down ? g.position.y : s.y + 0.16;
          const z = down ? g.position.z : s.z;
          view.project(x, y, z, spot);
          const me = view.me;
          dist = me ? Math.hypot(x - me.x, y - me.y, z - me.z) : spot.z;
          mode = tagMode(dist, { ally: sh.ally });
          pos = spot.z > 0.3 && mode.mode ? keepIn(spot.x, spot.y, sh.tagW, sh.tagH, boxW, boxH) : null;
          show = Boolean(pos);
        }
        if (show !== sh.tagOn) {
          sh.tagOn = show;
          tag.toggleAttribute('data-on', show);
          sh.measure ||= show;
        }
        if (!show) continue;
        const told = sh.tagShown;
        const d = mode.showDist ? distText(dist) : '';
        const rank = RANKS[p.factions?.oath]?.find((r) => r.id === p.factions?.rank)?.name ?? '';
        const rel = relation({ ally: sh.ally, factions: view.factions ?? null }, p);
        if (sh.tagName !== p.name) {
          sh.tagName = p.name;
          sh.bits.name.textContent = p.name;
          sh.measure = true;
        }
        if (told.dist !== d) {
          if (told.dist?.length !== d.length) sh.measure = true;
          sh.bits.dist.textContent = d;
        }
        if (told.level !== p.level) {
          sh.bits.level.textContent = `Lv ${p.level ?? 1}`;
          tag.dataset.level = String(p.level ?? 1);
          sh.measure = true;
        }
        if (told.rank !== rank) {
          sh.bits.rank.textContent = rank;
          sh.measure = true;
        }
        if (told.mode !== mode.mode) {
          tag.dataset.mode = mode.mode;
          sh.measure = true;
        }
        if (told.rel !== rel) tag.dataset.relation = rel;
        told.dist = d;
        told.level = p.level;
        told.rank = rank;
        told.mode = mode.mode;
        told.rel = rel;
        tag.toggleAttribute('data-ally', sh.ally);
        tag.toggleAttribute('data-safe', sh.safe);
        tag.toggleAttribute('data-hurt', !down && s.shield < 99.5);
        tag.style.setProperty('--shield', ((down ? 100 : s.shield) / 100).toFixed(2));
        tag.style.setProperty('--fade', mode.fade.toFixed(2));
        tag.style.setProperty('--font', `${fontPx(mode.scale)}px`);
        tag.style.transform = `translate3d(${pos.x.toFixed(1)}px, ${pos.y.toFixed(1)}px, 0) scale(${Math.ceil(mode.scale * 1000) / 1000})`;
      }
      // the hunters after them: where each pilot last said, flown on from there
      if (fleet) {
        for (const p of peers.values()) {
          const pack = p.hunters;
          if (!pack || p.blocked || !p.kind || !p.name || away(p) || now - pack.at > PACK_STALE) continue;
          const ahead = Math.min(PACK_AHEAD, (now - pack.at) / 1000);
          for (const e of pack.list) {
            const type = kinds[e.kind];
            if (!type) continue; // (not one this place has)
            const key = `${p.id}:${e.id}`;
            let g = ghosts.get(key);
            aim.set(e.x + e.vx * ahead, e.y + e.vy * ahead, e.z + e.vz * ahead);
            if (!g) {
              g = { owner: p.id, hunter: e.id, kind: e.kind, type, model: takeModel(e.kind), at: aim.clone(), prev: aim.clone(), vel: new THREE.Vector3(), hp: e.hp, told: e.hp, hurt: 0, hitAt: -Infinity, goneUntil: -Infinity, seen: tick, target: null };
              g.target = { id: `h:${key}`, owner: p.id, hunter: e.id, at: g.at, vel: g.vel, size: type.size, kind: e.kind, hp: e.hp, hpMax: Math.max(type.hp, e.hp), threat: 0 };
              ghosts.set(key, g);
            } else {
              // on along its way, and eased onto where it's said to be
              g.prev.copy(g.at);
              g.at.addScaledVector(g.vel, dt).lerp(aim, 1 - Math.exp(-dt * 8));
            }
            g.seen = tick;
            g.vel.set(e.vx, e.vy, e.vz);
            // (a hit of yours its pilot has taken off it is no longer owed)
            if (e.hp < g.told) g.hurt = Math.max(0, g.hurt - (g.told - e.hp));
            g.told = e.hp;
            if (now - g.hitAt > 1200) g.hurt = 0;
            g.hp = Math.max(0, e.hp - g.hurt);
            g.target.hp = g.hp;
            const mg = g.model.group;
            mg.visible = now >= g.goneUntil;
            if (!mg.visible) continue;
            busy = true;
            mg.position.copy(g.at);
            if (g.vel.lengthSq() > 1e-6) {
              parent.updateWorldMatrix(true, false); // (lookAt is in the world, and the map turns: the map's point is carried into it)
              mg.lookAt(parent.localToWorld(aim.copy(g.at).add(g.vel)));
            }
            mg.scale.setScalar(type.size * g.model.fit);
            g.model.update(now / 1000);
          }
        }
        for (const [key, g] of ghosts) if (g.seen !== tick) dropGhost(key, g);
      }
      // their shots
      for (const s of client?.takeShots() ?? []) fireBolt(s);
      for (const b of bolts) {
        if (!b.visible) continue;
        const d = b.userData;
        d.life -= dt;
        if (d.life <= 0) {
          b.visible = false;
          continue;
        }
        busy = true;
        b.position.addScaledVector(d.v, dt);
      }
      return busy;
    },

    // a bolt of yours from `from` to `to` this frame, worth `damage` on a
    // hunter: the pilot it hit (not an ally, nor one just back), if any: {
    // id, at, size }; or the hunter after one of them: { id (its pilot),
    // hunter, kind, at, size, down (that should have finished it) }. Tested
    // against the whole way each went in its last frame, as it was drawn (one
    // crossing the bolt's path between two frames is still hit), the nearest
    // along the bolt first
    hit(from, to, damage = 1) {
      let hit = null;
      let ghost = null;
      let first = Infinity;
      for (const [id, sh] of ships) {
        if (!sh.shown || sh.ally || sh.safe) continue;
        const k = sweptHit(from, to, sh.prev, sh.at, HIT_R);
        if (k !== null && k < first) {
          first = k;
          hit = { id, at: sh.at.clone(), size: SIZE };
        }
      }
      for (const g of ghosts.values()) {
        if (clock < g.goneUntil) continue;
        const k = sweptHit(from, to, g.prev, g.at, hitRadius(g.type));
        if (k !== null && k < first) {
          first = k;
          ghost = g;
        }
      }
      if (!ghost) return hit;
      return hurtGhost(ghost, damage);
    },

    // everyone here as shipHits.js's bodies: the pilots flying (not parked,
    // their crew out; a ram on one is told to them, client.js's ram, and
    // they take it off their own shields) and the hunters after them (a ram
    // on one is a shot's hit)
    get bodies() {
      const out = [];
      for (const [id, sh] of ships) {
        if (!sh.shown || sh.parked) continue;
        out.push({ key: `p:${id}`, id, kind: sh.kind, at: sh.at, prev: sh.prev, vel: sh.vel, size: SIZE, side: sh.ally ? 'friend' : 'pilot', hit: () => null });
      }
      for (const g of ghosts.values()) {
        if (clock < g.goneUntil) continue;
        out.push({ key: `g:${g.owner}:${g.hunter}`, id: g.hunter, kind: g.kind, at: g.at, prev: g.prev, vel: g.vel, size: g.type.size, side: 'foe', hit: (punch) => hurtGhost(g, punch) });
      }
      return out;
    },

    // what the guns can lock on to: everyone in view who isn't an ally (or
    // just back), and the hunters after any of them
    get targets() {
      const out = [];
      for (const [id, sh] of ships) if (sh.shown && !sh.ally && !sh.safe) out.push({ id: `p:${id}`, peer: id, at: sh.at, vel: sh.vel, size: SIZE, kind: sh.kind, loadout: sh.loadout, name: sh.name, threat: sh.threat });
      for (const g of ghosts.values()) if (clock >= g.goneUntil) out.push(g.target);
      return out;
    },
    // your allies flying here (wherever they are on screen: the HUD puts
    // the ones off it at the edge)
    get mates() {
      const out = [];
      for (const [id, sh] of ships) if (sh.shown && sh.ally) out.push({ id, name: sh.name, at: sh.at });
      return out;
    },
    // how many there are about: the pilots flying near (as ships), and the
    // hunters after them
    get count() {
      return live + ghosts.size;
    },
    // everyone flying here, near or far, for the chart: [{ id, name, x, z,
    // mode ('ship' | 'blip'), ally }], allies too
    get chart() {
      const out = [];
      for (const [id, sh] of ships) if (sh.mode) out.push({ id, name: sh.name, x: sh.seen.x, z: sh.seen.z, mode: sh.mode, ally: sh.ally });
      return out;
    },
    // where a pilot was last drawn (for the pop as they go down)
    at(id) {
      const sh = ships.get(id);
      return sh?.shown ? sh.at.clone() : null;
    },
    // where a pilot is as of the last update, { x, y, z, heading, name }, or
    // null for one who isn't flying here in sight (gone, hidden, stale, down
    // on a planet, blocked): the autopilot's goal when you fly to them
    // (pilotGoal.js). Only ever a pilot already in the room
    pose(id) {
      const sh = ships.get(id);
      return sh?.pose ?? null;
    },

    dispose() {
      disposed = true;
      for (const sh of ships.values()) drop(sh);
      ships.clear();
      for (const [key, g] of ghosts) dropGhost(key, g);
      for (const list of Object.values(spare)) for (const m of list.splice(0)) m.dispose();
      for (const p of cache.values()) p.then((scene) => scene && disposeTree(scene));
      cache.clear();
      for (const b of bolts) b.removeFromParent();
      boltGeo.dispose();
      for (const m of boltMats.values()) m.dispose();
    },
  };
}
