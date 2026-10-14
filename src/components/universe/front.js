// The front: where the crew's war is being fought, on the map (the design:
// docs/superpowers/specs/2026-10-06-fleet-war-design.md). It sits at the
// war's contested sector (war.js) out in deep space, a glow and a name seen
// from far off. Come within sight of it and the battle's there to watch
// (battle.js fights it, battleScene.js draws it); fly into it and you're in
// it, on your crew's side (the war's first side is the crews': no side to
// pick, no game to start; the crew calls it out). Leave and the battle waits
// for you, paused, till you come back. When it's over the war moves on (the
// attacker takes the sector if it won), the visit's save remembers it, and a
// while later the next battle's at the new front. (The Star Wars crews' war
// is fought in the galaxy, galaxy/gcw.js, not here; Rick and Morty's and
// Breaking Bad's are here.)
//
// Since the spread (scale.js's SPREAD) a war's front can sit at a waypoint
// instead (waypoints.js, once the hyperlanes' nodes) (the design:
// docs/superpowers/specs/2026-10-07-universe-scale-hyperlanes-design.md,
// decision 9): the beacon nearest the middle of the war's own places, its
// first sector and its last (frontAt), so the war is somewhere to go,
// seen from afar as a far fight, not met by accident. Given `beacons`,
// createFront fights every battle there; the sectors are still what's fought
// over, by name, and still move on as they're won.
//
// zoneOf(dist, was) → 'in' | 'near' | 'out' and frontAt(war, beacons) →
// beacon | null are pure (tested).
// createFront(map, { side, war, beacons, models, small, tier, reduced,
//   storage, emit, makeBattle, makeScene }) → null (the side has no war, or
//   it isn't ready; `war` in place of the side's own, for the tests)
//   or { update(dt, t, camera, camLocal, live) → { busy, hurt }, join(team),
//   hit(from, to, damage), bodies (shipHits.js's), targets, inZone, holdAt(x, y, z, f), near, joined, info, where(),
//   goal(), win(team), dispose() }
// Points are in `map`'s space.

import * as THREE from 'three';
import { createBattle, perSide } from './battle';
import { createBattleScene } from './battleScene';
import { contested, loadWar, newWar, owner, resolve, saveWar } from './war';
import { warFor } from './wars';
import { DEEP, easeOpen, gapAlong } from './deep';
import { NODES } from './waypoints';
import { sharpen } from '../../lib/three/textures';

export const ZONE = {
  near: 900, // within sight: the battle's drawn and fought
  in: 260, // in it: you're in the fight on your crew's side, and the pulse drive's held down
  out: 600, // and you're out of it again past here
  rest: 20, // seconds after a battle's over before the next one's at the front
};

export function zoneOf(dist, was) {
  if (dist < ZONE.in || (was === 'in' && dist < ZONE.out)) return 'in';
  return dist < ZONE.near ? 'near' : 'out';
}

// the waypoints' beacons, where a war's front can be (waypoints.js)
export const BEACONS = NODES.filter((n) => n.kind === 'beacon');

// the beacon nearest the middle of the war's own places: the first side's
// home end of its line of sectors and the second's
export function frontAt(war, beacons = BEACONS) {
  const a = war.sectors[0].at;
  const b = war.sectors[war.sectors.length - 1].at;
  const mid = [0, 1, 2].map((i) => (a[i] + b[i]) / 2);
  let best = null;
  let near = Infinity;
  for (const o of beacons) {
    const d = Math.hypot(o.at[0] - mid[0], o.at[1] - mid[1], o.at[2] - mid[2]);
    if (d < near) {
      near = d;
      best = o;
    }
  }
  return best;
}

// the front's name card, seen from far off (the wonders' names are in deep
// space's own atlas; this one's a canvas of its own)
function nameCard(title, sub) {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 96;
  const g = c.getContext('2d');
  g.textAlign = 'center';
  g.fillStyle = '#ffd9a8';
  g.font = '600 30px "JetBrains Mono", ui-monospace, monospace';
  g.fillText(title.toUpperCase().split('').join(' '), 256, 38);
  g.fillStyle = 'rgba(255,217,168,0.6)';
  g.fillRect(156, 50, 200, 1.5);
  g.fillStyle = 'rgba(235,240,255,0.85)';
  g.font = '500 22px "JetBrains Mono", ui-monospace, monospace';
  g.fillText(sub, 256, 80);
  const t = new THREE.CanvasTexture(c);
  sharpen(t);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createFront(map, { side, war: given = null, beacons = null, models, small = false, tier = 'high', reduced = false, storage = null, emit = () => {}, makeBattle = createBattle, makeScene = createBattleScene }) {
  const war = given ?? warFor(side?.id);
  if (!war || !war.ready) return null;
  let state = loadWar(storage, war);
  const draw = makeScene(map, { models, small, reduced });
  let battle = null;
  let zone = 'out';
  let joined = null;
  let rest = 0; // seconds till the next battle, once one's over
  let shown = false;
  let battleAt = null; // where the battle on now is (the front may have moved on since)

  // the corridor's way (from the first side's home to the second's)
  const first = war.sectors[0].at;
  const last = war.sectors[war.sectors.length - 1].at;
  const axis = (() => {
    const dx = last[0] - first[0];
    const dz = last[2] - first[2];
    const l = Math.hypot(dx, dz) || 1;
    return [dx / l, dz / l];
  })();
  const sector = () => war.sectors[Math.max(0, Math.min(war.sectors.length - 1, contested(state)))];
  // where the battles are: the war's beacon, given the waypoints' (it doesn't
  // move), else the sector fought over
  const post = beacons ? frontAt(war, beacons) : null;
  const spot = () => post?.at ?? sector().at;

  // the glow and the name, seen from far off
  const beacon = new THREE.Group();
  map.add(beacon);
  const glowTex = (() => {
    if (typeof document === 'undefined') return null;
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, 'rgba(255,255,255,1)');
    r.addColorStop(0.3, 'rgba(255,255,255,0.35)');
    r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: new THREE.Color(2.4, 1.4, 0.7), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false }));
  glow.scale.setScalar(70);
  beacon.add(glow);
  const label = new THREE.Sprite(new THREE.SpriteMaterial({ depthTest: false, depthWrite: false, transparent: true, sizeAttenuation: false, toneMapped: false }));
  // (drawn over everything, so never cut by the far plane: on foot it's at
  // the landing's sky, footScene's far(), which the front is well past)
  label.material.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <logdepthbuf_vertex>', '#include <logdepthbuf_vertex>\n\tgl_Position.z = min( gl_Position.z, gl_Position.w * 0.999999 );');
  };
  label.material.customProgramCacheKey = () => 'front-label';
  label.center.set(0.5, -0.4);
  label.scale.set(0.3, 0.056, 1);
  label.renderOrder = 9;
  beacon.add(label);
  let labelFor = '';
  const placeBeacon = () => {
    const s = sector();
    beacon.position.set(...spot());
    const name = war.battleName(s);
    if (name !== labelFor) {
      labelFor = name;
      label.material.map?.dispose();
      label.material.map = nameCard('The front', name);
      label.material.needsUpdate = true;
    }
  };
  placeBeacon();

  const say = (sub) => emit({ type: 'event', id: 'battle', sub });

  // a battle at the front as it is now
  const start = () => {
    if (state.won !== null) {
      state = newWar(war); // (the war was won: it starts again from the middle)
      saveWar(storage, war, state);
      placeBeacon();
    }
    battleAt = spot();
    // (each ship on its hull, where its loader has one: galaxy/models.js's hulls)
    battle = makeBattle({ war, attacker: state.attacker, at: battleAt, axis, perSide: perSide(tier), hulls: models?.hulls ?? null, reduced });
    joined = null;
    shown = false;
  };

  // the end of a battle: the war moves on, saved, and the card says so
  const ended = (over) => {
    const s = sector();
    const before = state;
    state = resolve(state, war, over.winner);
    saveWar(storage, war, state);
    const winner = war.sides[over.winner];
    const took = over.winner === before.attacker;
    let text = took ? `${winner.name} takes ${s.name}.` : `${winner.name} holds ${s.name}.`;
    if (state.won !== null) text += ` ${winner.name} has won ${war.name.replace(/^The /, 'the ')}. It starts again from the middle.`;
    else text += ` The front is at ${sector().name} now.`;
    emit({ type: 'battle', what: 'over', over: { winner: over.winner, text, sectors: war.sectors.map((sec, i) => ({ name: sec.name, owner: owner(state, i), front: i === contested(state) })) } });
    if (joined !== null) say(state.won !== null ? (state.won === joined ? 'warWon' : 'warLost') : over.winner === joined ? 'won' : 'lost');
    rest = ZONE.rest;
    placeBeacon();
  };

  const front = {
    update(dt, t, camera, camLocal, live) {
      const at = battle ? battleAt : spot();
      const p = live ?? camLocal;
      const dist = Math.hypot(p.x - at[0], p.y - at[1], p.z - at[2]);
      const was = zone;
      zone = zoneOf(dist, was);
      let hurt = 0;
      // the beacon, from far off (not from inside the fight)
      beacon.visible = zone !== 'in';
      // (the name only out of the home system, as the wonders' are, and not on top of the fight)
      label.visible = dist > 160 && Math.hypot(p.x, p.z) > DEEP.system;
      glow.material.opacity = reduced ? 0.6 : 0.45 + 0.35 * Math.abs(Math.sin(t * 3.1) * Math.sin(t * 1.7));
      if (zone === 'out') {
        if (shown) {
          draw.hide();
          shown = false;
        }
        return { busy: false, hurt: 0 };
      }
      // a battle's over and its rest is up: the next one, at the new front
      if (battle?.over && rest > 0) {
        rest -= dt;
        if (rest <= 0) {
          draw.hide();
          battle = null;
          shown = false;
        }
      }
      if (!battle) {
        start();
        models?.want?.([...new Set(war.sides.flatMap((s) => [...s.capitals.map((c) => c.kind), ...s.fighters.map((f) => f.kind)]))]);
      }
      if (!shown) {
        draw.show(battle, war);
        shown = true;
      }
      // arriving in it: you're in, on your crew's side (the war's first)
      if (zone === 'in' && was !== 'in' && !battle.over && joined === null) {
        say('front');
        front.join(0);
      }
      const events = battle.update(dt, live ? { x: live.x, y: live.y, z: live.z, alive: true } : null);
      for (const e of events) {
        if (e.type === 'hurt') hurt += e.damage;
        else if (e.type === 'shield' && joined !== null) say('gens');
        else if (e.type === 'sub' && e.kind === 'bridge' && joined !== null) say('bridge');
        else if (e.type === 'sub' && e.kind === 'reactor' && joined !== null) say('reactor');
        else if (e.type === 'over') ended(e);
      }
      draw.update(dt, t, camera, camLocal, events, joined);
      return { busy: true, hurt };
    },

    // fly for a side (0 or 1)
    join(team) {
      if (!battle || battle.over || (team !== 0 && team !== 1)) return;
      joined = team;
      battle.setYou(team);
      emit({ type: 'battle', what: 'joined', team });
      say('join');
    },

    hit: (from, to, damage) => (battle && joined !== null && !battle.over ? battle.hit(from, to, damage) : null),
    // the other side's fighters, once you're in it, as shipHits.js's bodies
    // (a ram on one the battle's strike; the capital ships are solids)
    get bodies() {
      if (!battle || joined === null || battle.over) return [];
      const out = [];
      for (const f of battle.fighters) {
        if (!f.alive || f.team === joined) continue;
        out.push({ key: `f:${f.id}`, id: f.id, kind: f.kind, at: f.seen, vel: f.vel, size: f.size, side: 'foe', hit: (punch) => battle?.strike(f.id, punch) ?? null });
      }
      return out;
    },
    get targets() {
      return battle && joined !== null && zone !== 'out' ? battle.targets : [];
    },
    // in the fight (the director waits)
    get inZone() {
      return zone === 'in';
    },
    // how far the pulse drive's held down at (x, y, z), going the way `f`
    // points: all the way in the fight, and coming in to it eased down from
    // where it's in sight (as the drive eases down coming up on a place, so
    // the fight's edge isn't a wall), but not for a ship going past it or away
    holdAt(x, y, z, f) {
      const at = battle ? battleAt : spot();
      return 1 - easeOpen(gapAlong(x, y, z, f, at, ZONE.in), ZONE.near - ZONE.in);
    },
    // within sight of it
    get near() {
      return zone !== 'out';
    },
    get joined() {
      return joined;
    },
    get battle() {
      return battle;
    },
    get info() {
      return { war: war.id, state: { ...state }, zone, joined, battle: battle?.info ?? null };
    },
    // the war, for the nav map and the holotable
    where() {
      const s = sector();
      return { war: war.name, name: war.battleName(s), sector: s.name, at: spot(), beacon: post?.id ?? null, contested: contested(state), sectors: war.sectors.map((sec, i) => ({ id: sec.id, name: sec.name, at: sec.at, owner: owner(state, i) })), colours: war.sides.map((o) => o.colour), sides: war.sides.map((o) => o.short) };
    },
    // where the autopilot takes you: just short of the fight, on your side of it
    goal() {
      return { id: 'front', at: spot(), r: 30, reach: ZONE.in * 0.8 };
    },
    // (a dev hook: end the battle now, `team` the winner)
    win(team) {
      battle?.end?.(team);
    },
    dispose() {
      draw.dispose();
      beacon.removeFromParent();
      glow.material.dispose();
      glowTex?.dispose();
      label.material.map?.dispose();
      label.material.dispose();
    },
  };
  return front;
}
