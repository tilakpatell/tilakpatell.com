// The places on the universe map: the fandoms as planets, and (built by
// stations.js) the site's own pages as stations round the sun. The planets
// wear maps baked for their worlds (scripts/build-fandom-planets.mjs, from
// code; Earth's from Solar System Scope's maps and ambientCG's materials,
// scripts/build-universe-textures.py), or are painted here (the Game Boy
// world in pixels); each has air round it in its colour and
// the things that make it that place, in orbit or on it: the sitar's strings,
// the One Ring, Cybertron's energon seams, the Infinity Stones, the crystals
// and element tiles, the mug, the portal, the travel routes. Star Wars isn't
// a planet but the way into a galaxy far, far away: the galaxy in miniature
// behind a hyperspace gate (galaxy/gateway.js), Star Destroyers on guard.
// The models (the site owner's, from Meshy: the sitar, Optimus Prime and
// Megatron, the gauntlet, the motorhome, the Game Boy, Mario and a Piranha
// Plant, a Republic attack cruiser; plus Rick's cruiser from the C-137 page
// and the Black Pearl) load after the map is up and are parked on orbits or
// stood on the ground (a model can take the painted sphere's place, `skin`);
// a planet whose model never arrives simply goes without. The sun is sun.js's.
//
// loadTextures({ small }) → the textures (any that fail are just missing)
// mapFile(name, level) → the file for a planet map at lib/detail's level
// mapsOf(id), nearSet(id, level) → a planet's maps, and the finer ones it wears near (nearMaps.js)
// buildPlanet(u, T, { sun, tier, key }) → { id, radius, group, sun, air, setAir, update(t, camera), setState, mount, swapMaps(T2 | null), nearSet(level), nearGeometry(on, level) }

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { cloneScene, loadGLTF } from '../../lib/three/gltfCache';
import { gltfLoader } from '../../lib/three/gltf';
import { SWIRL_GLSL } from '../../lib/three/swirl';
import { globeData } from '../travel/globe3d/data';
import { facing, fit, glowMat, orbit, paint, rng, rounded } from './kit';
import { STATIONS } from './stations';
import { RM_WORLDS } from './rmWorlds';
import { buildGateway } from '../galaxy/gateway';
import { SIDES, cybertronSkin } from '../cybertron/skin';
import { createAtmosphere, stepsFor } from '../../lib/three/atmosphere';
import { createWar, warZones } from '../cybertron/war';
import { ringGeometry } from '../middleearth/ringShape';
import { bossMug, elementTile, glowingGems, shardCluster } from './props';
import { keyHook } from '../../lib/three/keySun';
import { mapSwapper, mapsOf, nearSet } from './planetMaps';
import { LIGHT, RIM, airGlow, celShade, ditherShade, groundHooks, halo, styleFor } from './planetShading';
import { potter } from './planetSkins';

// (the planets' shading, moved out to keep this file under the size the
// health check allows: planetShading.js; its exports are this file's as before)
export { celShade, ditherShade, styleFor, variants } from './planetShading';


// ── Textures ── (planetMaps.js: the maps, their files, and what a planet wears near)

export { MAP_NAMES, loadTextures, mapFile, mapsOf, nearSet } from './planetMaps';

// ── Shared pieces ──

// A station's big sign: its name in its colour and a line under it, on a
// dark glass panel with a lit edge, always facing you. A click on it opens
// the page (the scene does the picking).
function bigSign(u) {
  const [title, line] = u.sign;
  const W2 = 768;
  const H2 = 216;
  const tex = paint(
    (g, w, h) => {
      g.clearRect(0, 0, w, h);
      rounded(g, 14, 14, w - 28, h - 28, 26);
      g.fillStyle = 'rgba(6, 10, 20, 0.84)';
      g.fill();
      g.shadowColor = u.swatch;
      g.shadowBlur = 22;
      g.lineWidth = 5;
      g.strokeStyle = u.swatch;
      g.stroke();
      g.shadowBlur = 0;
      rounded(g, 26, 26, w - 52, h - 52, 18);
      g.lineWidth = 1.5;
      g.strokeStyle = 'rgba(255,255,255,0.18)';
      g.stroke();
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillStyle = u.swatch;
      g.shadowColor = u.swatch;
      g.shadowBlur = 18;
      g.font = '800 92px ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';
      if ('letterSpacing' in g) g.letterSpacing = '6px';
      g.fillText(title, w / 2, h * 0.43);
      g.shadowBlur = 0;
      if ('letterSpacing' in g) g.letterSpacing = '0px';
      g.fillStyle = 'rgba(255,255,255,0.86)';
      g.font = '500 30px ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';
      g.fillText(`${line}  →`, w / 2, h * 0.76);
    },
    W2,
    H2,
  );
  const w = u.size * 2.9;
  const h = (w * H2) / W2;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, depthWrite: false, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  mesh.position.y = u.size * 1.45 + h / 2;
  mesh.renderOrder = 5;
  mesh.userData.size = [w, h];
  return mesh;
}

// A line of letters in the Elvish hand, as the Ring's inscription is
// written: a run of tengwar, stems with bows (some rising above the line,
// some falling below), the looped lambe and the curved silmë, the hooked
// rómen and óre, with the vowels as marks over them (dots, accents,
// curls), in words with gaps between: white on black, painted into the
// band of v [b0, b1] (the texture is flipped: v = 1 is the top row).
function tengwar(g, w, h, b0, b1, rand) {
  g.fillStyle = '#000';
  g.fillRect(0, 0, w, h);
  const mid = (1 - b1) * h + ((b1 - b0) * h) / 2;
  const x = (b1 - b0) * h * 0.19; // the letters' body
  g.strokeStyle = '#fff';
  g.fillStyle = '#fff';
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.lineWidth = x * 0.13;
  g.shadowColor = '#fff';
  g.shadowBlur = x * 0.3;
  const base = mid + x * 0.5;
  const top = base - x;
  const path = (fn) => {
    g.beginPath();
    fn();
    g.stroke();
  };
  // each letter draws at `at` and says how wide it was
  const LETTERS = [
    // tinco, parma, calma, quesse: a stem and one bow, the stem up or down
    (at, k) => {
      const up = k < 0.5 ? x * 0.95 : 0;
      const down = k >= 0.5 ? x * 0.95 : 0;
      path(() => {
        g.moveTo(at, top - up);
        g.lineTo(at, base + down);
      });
      path(() => {
        g.moveTo(at, top + x * 0.05);
        g.bezierCurveTo(at + x * 0.75, top - x * 0.1, at + x * 0.75, base + x * 0.1, at + x * 0.05, base);
      });
      return x * 0.75;
    },
    // ando, umbar: two bows
    (at, k) => {
      path(() => {
        g.moveTo(at, top - (k < 0.4 ? x * 0.95 : 0));
        g.lineTo(at, base + (k >= 0.4 ? x * 0.95 : 0));
      });
      for (const dx of [0, x * 0.45]) {
        path(() => {
          g.moveTo(at + dx, top + x * 0.05);
          g.bezierCurveTo(at + dx + x * 0.62, top - x * 0.1, at + dx + x * 0.62, base + x * 0.1, at + dx + x * 0.05, base);
        });
      }
      return x * 1.15;
    },
    // lambe: a loop open below, its tail curling up
    (at) => {
      path(() => {
        g.moveTo(at, base);
        g.bezierCurveTo(at - x * 0.05, top - x * 0.2, at + x * 0.85, top - x * 0.2, at + x * 0.75, base - x * 0.15);
        g.quadraticCurveTo(at + x * 0.7, base + x * 0.1, at + x * 0.95, base - x * 0.05);
      });
      return x * 0.95;
    },
    // silmë: an s-curve
    (at) => {
      path(() => {
        g.moveTo(at + x * 0.6, top + x * 0.1);
        g.bezierCurveTo(at - x * 0.1, top - x * 0.1, at - x * 0.1, mid, at + x * 0.3, mid + x * 0.05);
        g.bezierCurveTo(at + x * 0.75, mid + x * 0.1, at + x * 0.7, base + x * 0.2, at, base - x * 0.05);
      });
      return x * 0.7;
    },
    // rómen and óre: a hook
    (at, k) => {
      path(() => {
        if (k < 0.5) {
          g.moveTo(at, base);
          g.lineTo(at, top + x * 0.25);
          g.bezierCurveTo(at, top - x * 0.15, at + x * 0.55, top - x * 0.15, at + x * 0.55, top + x * 0.3);
        } else {
          g.moveTo(at, top);
          g.bezierCurveTo(at + x * 0.7, top, at + x * 0.7, base, at + x * 0.2, base);
          g.lineTo(at + x * 0.1, base + x * 0.35);
        }
      });
      return x * 0.62;
    },
  ];
  const WEIGHTS = [0.36, 0.14, 0.2, 0.14, 0.16];
  const pick = () => {
    let k = rand();
    for (let i = 0; i < WEIGHTS.length; i++) if ((k -= WEIGHTS[i]) <= 0) return i;
    return 0;
  };
  let at = x * 0.6;
  let inWord = 0;
  while (at < w - x * 1.8) {
    const width = LETTERS[pick()](at, rand());
    // a vowel's mark above: a dot (or three), an accent or a curl
    const t = rand();
    const tx = at + width * 0.45;
    const ty = top - x * 0.45;
    if (t < 0.2) {
      g.beginPath();
      g.arc(tx, ty, x * 0.08, 0, Math.PI * 2);
      g.fill();
    } else if (t < 0.3) {
      for (const [dx, dy] of [[-0.15, 0.05], [0.15, 0.05], [0, -0.15]]) {
        g.beginPath();
        g.arc(tx + dx * x, ty + dy * x, x * 0.065, 0, Math.PI * 2);
        g.fill();
      }
    } else if (t < 0.48) {
      path(() => {
        g.moveTo(tx - x * 0.08, ty + x * 0.12);
        g.lineTo(tx + x * 0.14, ty - x * 0.14);
      });
    } else if (t < 0.62) {
      path(() => {
        g.moveTo(tx - x * 0.28, ty + x * 0.05);
        g.bezierCurveTo(tx - x * 0.1, ty - x * 0.22, tx + x * 0.05, ty + x * 0.22, tx + x * 0.28, ty - x * 0.05);
      });
    }
    at += width + x * 0.3;
    inWord++;
    if (inWord > 2 + rand() * 5) {
      at += x * 0.85;
      inWord = 0;
    }
  }
}

// ── The fandoms ──

const BUILDERS = {
  potter, // (planetSkins.js)
  starwars(p, { u, T }) {
    const r = u.size;
    // not a planet: the way into a galaxy far, far away (galaxy/gateway.js),
    // the galaxy itself in miniature behind a hyperspace gate; the painted
    // sphere stays, unseen, for what a place needs one for
    p.body.material.visible = false;
    const gate = buildGateway(r, { small: T.small });
    p.group.add(gate.group);
    p.tick.push((t, camera) => gate.update(t, camera));

    // a Republic attack cruiser further out (the site owner's Meshy model,
    // when it comes; its nose is −x, so a quarter turn points it the way the
    // orbit goes). Slave I is about too, as traffic (traffic.js)
    const far = orbit(p.group, { radius: r * 1.38, tilt: 0.12, yaw: 0.8, speed: 0.14, phase: 4.1 });
    p.orbits.push(far);
    // and two Star Destroyers on station round it (the site owner's model;
    // its nose is −z, the way an orbit's holder travels)
    const guard = [orbit(p.group, { radius: r * 1.3, tilt: -0.1, yaw: 2.4, speed: 0.1, phase: 0.6 }), orbit(p.group, { radius: r * 1.34, tilt: 0.2, yaw: 4.0, speed: 0.09, phase: 3.3 })];
    p.orbits.push(...guard);
    p.slots = {
      cruiser: { holder: far.holder, size: r * 0.14, turn: [0, -Math.PI / 2, -0.1], sway: 0.08 },
      escort1: { holder: guard[0].holder, size: r * 0.26, turn: [0, 0, 0.05], sway: 0.04 },
      escort2: { holder: guard[1].holder, size: r * 0.24, turn: [0, 0, -0.06], sway: 0.04 },
    };
  },

  music(p, { u, T }) {
    const r = u.size;
    p.body.material = new THREE.MeshStandardMaterial({ map: T.music ?? null, color: T.music ? '#ffffff' : u.palette.base, roughness: 1 });
    // the rings are a sitar's strings: thin brass lines, plucked when it's
    // picked, over a banded disc of saffron and brass dust (its texture runs
    // out from the planet: the ring geometry's own uvs are remapped to radius)
    const strings = new THREE.Group();
    strings.rotation.set(Math.PI / 2 - 0.42, 0, 0.22);
    p.group.add(strings);
    const IN = r * 1.28;
    const OUT = r * 1.95;
    const bands = paint(
      (g, w, h) => {
        const ring = rng('music-ring');
        g.clearRect(0, 0, w, h);
        for (let x = 0; x < w; x++) {
          const k = x / w;
          // dense in the middle, thin toward the edges, with gaps
          const body = Math.sin(k * Math.PI) ** 0.6 * (0.55 + 0.45 * Math.sin(k * 41 + Math.sin(k * 13) * 2)) * (k > 0.62 && k < 0.66 ? 0.1 : 1);
          const a = Math.max(0, Math.min(1, body * (0.7 + ring() * 0.3)));
          const tone = 150 + Math.sin(k * 23) * 50 + ring() * 30;
          g.fillStyle = `rgba(${Math.min(255, tone + 70)}, ${tone * 0.72}, ${tone * 0.32}, ${a.toFixed(3)})`;
          g.fillRect(x, 0, 1, h);
        }
      },
      512,
      4,
    );
    const disc = new THREE.RingGeometry(IN, OUT, 128, 1);
    const pos = disc.attributes.position;
    const uv = disc.attributes.uv;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, (Math.hypot(pos.getX(i), pos.getY(i)) - IN) / (OUT - IN), 0.5);
    const ringDisc = new THREE.Mesh(disc, new THREE.MeshStandardMaterial({ map: bands, transparent: true, depthWrite: false, side: THREE.DoubleSide, roughness: 0.8, metalness: 0.2, emissive: '#3a2008', emissiveIntensity: 0.4 }));
    strings.add(ringDisc);
    const brass = new THREE.MeshStandardMaterial({ color: '#e9c27c', metalness: 0.8, roughness: 0.35, emissive: '#6b4a14', emissiveIntensity: 0.6 });
    const lines = [];
    for (let i = 0; i < 6; i++) {
      const line = new THREE.Mesh(new THREE.TorusGeometry(r * (1.36 + i * 0.105), r * (0.005 + (i === 0 ? 0.003 : 0)), 5, 200), brass);
      strings.add(line);
      lines.push(line);
    }
    let pluckAt = -1;
    p.onSelect = (t) => (pluckAt = t);
    p.tick.push((t) => {
      const age = pluckAt < 0 ? 99 : t - pluckAt;
      lines.forEach((line, i) => {
        const a = age < 3 ? 0.06 * Math.exp(-age * 2.2) * Math.sin(age * 28 + i * 1.3) : 0;
        line.rotation.x = a;
        line.rotation.y = a * 0.6;
      });
    });
    const o = orbit(p.group, { radius: r * 1.2, tilt: -0.55, speed: 0.2, phase: 0.6 });
    p.orbits.push(o);
    p.slot = { holder: o.holder, size: r * 0.78, turn: [0, Math.PI / 2, 0.35] };
  },

  middleearth(p, { u, T }) {
    const r = u.size;
    // Tolkien's map from orbit (scripts/planets/middleearth.mjs): Lindon and
    // the Gulf of Lhûn, the Misty and White Mountains, Mirkwood, Rohan's
    // grass, the Anduin to the Bay of Belfalas, Mordor's black walls round
    // Gorgoroth with Orodruin alight, the Sea of Rhûn, Harad's sands; the
    // sea catches the sun, the cities light the night side, and Mordor's
    // smoke hangs over the Black Land
    p.body.material = new THREE.MeshStandardMaterial({
      map: T.middleearth ?? null,
      color: T.middleearth ? '#ffffff' : u.palette.base,
      normalMap: T['middleearth-normal'] ?? null,
      normalScale: new THREE.Vector2(1, 1),
      roughnessMap: T['middleearth-rough'] ?? null,
      roughness: 1,
      metalness: 0,
      emissive: '#ffffff',
      emissiveMap: T['middleearth-glow'] ?? null,
      emissiveIntensity: T['middleearth-glow'] ? 2.2 : 0,
    });
    p.night = T['middleearth-night'] ?? null;
    if (T['middleearth-clouds']) {
      // on the body, so the pall stays over Mordor; it sways a little, as weather
      const sky = new THREE.Mesh(
        new THREE.SphereGeometry(r * 1.01, T.small ? 44 : 72, T.small ? 28 : 48),
        new THREE.MeshStandardMaterial({ map: T['middleearth-clouds'], transparent: true, depthWrite: false, roughness: 1, metalness: 0 }),
      );
      p.body.add(sky);
      p.tick.push((t) => (sky.rotation.y = Math.sin(t * 0.021) * 0.035));
    }
    // the One Ring: the plain band the Ring page turns (middleearth/ringShape.js),
    // with its inscription burning round the outside in one line of
    // Elvish letters, as it shows in the fire
    const { geo: band, band: [b0, b1] } = ringGeometry(160);
    const words = paint((g, w, h) => tengwar(g, w, h, b0, b1, rng('ring')), 2048, 256);
    const ringMat = new THREE.MeshStandardMaterial({ color: '#e6a53e', metalness: 1, roughness: 0.2, emissive: '#ff5a12', emissiveMap: words, emissiveIntensity: 1.1 });
    const ring = new THREE.Mesh(band, ringMat);
    ring.scale.setScalar(r * 0.24);
    const o = orbit(p.group, { radius: r * 1.55, tilt: 0.42, speed: 0.22, phase: 4 });
    o.holder.add(ring);
    p.orbits.push(o);
    p.tick.push((t) => {
      ring.rotation.set(0.9 + Math.sin(t * 0.5) * 0.3, t * 0.6, 0.3);
      ringMat.emissiveIntensity = 0.75 + 0.35 * Math.sin(t * 1.7) ** 2;
    });
  },

  transformers(p, { u, T }) {
    const r = u.size;
    // built over from pole to pole (scripts/build-cybertron-planet.mjs):
    // tiers of plating, chasms with energon running in them, the city-states'
    // discs, the Sea of Rust, the war's fires; cybertron/skin.js colours the
    // energon, lights the cities on the night side and carries the plating
    // on in the shader up close, where the maps run out
    const mat = new THREE.MeshStandardMaterial({
      map: T.transformers ?? null,
      color: T.transformers ? '#ffffff' : u.palette.base,
      normalMap: T['transformers-normal'] ?? null,
      normalScale: new THREE.Vector2(1.1, 1.1),
      roughness: 0.55,
      metalness: 0.45,
    });
    p.body.material = mat;
    if (T.transformers && T['transformers-glow-sm']) {
      // (from orbit the long shots show a world of steel, its cities' lights
      // blue-white, the war's fires here and there: not a world on fire, as
      // the page's own close shots of the fronts are)
      const skin = cybertronSkin(mat, { glow: T['transformers-glow-sm'], sun: p.sun, city: 0xcfe6ff });
      skin.uLevels.value.set(1.8, 0.85, 2, 1);
      // (its seams glow a little in the colour of the light it's in: the scene's key)
      p.keyColour = skin.uKeyColour.value;
      // the energon breathes, and turns from the Autobots' blue to the
      // Decepticons' violet and back as the war goes one way and the other
      const blue = SIDES.autobot.energon;
      const violet = SIDES.decepticon.energon;
      p.tick.push((t) => {
        skin.uTime.value = t;
        skin.uEnergon.value.copy(blue).lerp(violet, 0.5 + 0.5 * Math.sin(t * 0.05));
      });
      // and the war, a few fireballs at a time out of the burning fronts
      // (cybertron/war.js: one draw, turning with the planet)
      const battle = createWar({ radius: r, zones: warZones(T['transformers-glow-sm']), count: T.small ? 3 : 5, flares: 1, small: true, light: false });
      p.body.add(battle.group);
      p.tick.push((t, camera) => battle.update(t, camera, 0.85));
    }
    // Optimus Prime and Megatron on one orbit, a little apart, facing off as
    // they go round
    const R = r * 1.55;
    const o = orbit(p.group, { radius: R, tilt: 0.3, speed: 0.12, phase: 1.2 });
    p.orbits.push(o);
    const apart = 0.55; // radians between them on the orbit
    const rival = new THREE.Group();
    rival.position.set(Math.cos(apart) * R, 0, -Math.sin(apart) * R);
    o.pivot.add(rival);
    // each turned to look at the other (a model's face is its +z)
    const dx = rival.position.x - R;
    const dz = rival.position.z;
    p.slot = { holder: o.holder, size: r * 0.55, turn: [0, Math.atan2(dx, dz), 0], sway: 0.12 };
    p.slots = { rival: { holder: rival, size: r * 0.58, turn: [0, Math.atan2(-dx, -dz), 0], sway: 0.12 } };
  },

  marvel(p, { u, T }) {
    const r = u.size;
    // Earth-616 as the comics draw it (scripts/planets/marvel.mjs): the real
    // coasts inked, flat fills laid in Ben-Day dots, the Savage Land and
    // Wakanda where they are, its inked puffs of cloud painted on, lit in flat
    // bands as a page is (celShade), the night side's cities and Avengers Tower lit
    p.body.material = new THREE.MeshStandardMaterial({
      map: T.marvel ?? null,
      color: T.marvel ? '#ffffff' : u.palette.base,
      // (the sea glossy, so it catches the sun)
      roughnessMap: T['marvel-rough'] ?? null,
      roughness: T['marvel-rough'] ? 1 : 0.9,
      metalness: 0,
    });
    celShade(p.body.material);
    p.night = T['marvel-night'] ?? null;
    // the six Stones in a ring round it, cut as they're set in the
    // gauntlet and lit from within: Space, Mind, Reality, Power, Time, Soul
    const STONES = ['#3d7bff', '#ffd23d', '#ff2e2e', '#a34dff', '#3dff8a', '#ff8a3d'];
    const stones = glowingGems(STONES, r * 0.13);
    const ring = new THREE.Group();
    ring.rotation.set(0.3, 0, -0.18);
    ring.add(stones);
    p.group.add(ring);
    // and each one's glow round it
    const halo = paint(
      (g, w, h) => {
        const k = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
        k.addColorStop(0, 'rgba(255,255,255,0.9)');
        k.addColorStop(0.25, 'rgba(255,255,255,0.35)');
        k.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = k;
        g.fillRect(0, 0, w, h);
      },
      64,
      64,
    );
    const glows = STONES.map((hex) => {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo, color: hex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
      sp.scale.setScalar(r * 0.3);
      ring.add(sp);
      return sp;
    });
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const s = new THREE.Vector3(1, 1, 1);
    const at = new THREE.Vector3();
    p.tick.push((t) => {
      for (let i = 0; i < 6; i++) {
        const a = t * 0.3 + (i / 6) * Math.PI * 2;
        at.set(Math.cos(a) * r * 1.3, 0, Math.sin(a) * r * 1.3);
        q.setFromEuler(e.set(t * 0.8 + i, t * 0.5, 0));
        stones.setMatrixAt(i, m.compose(at, q, s));
        glows[i].position.copy(at);
      }
      stones.instanceMatrix.needsUpdate = true;
    });
    const o = orbit(p.group, { radius: r * 1.55, tilt: -0.4, speed: 0.16, phase: 3 });
    p.orbits.push(o);
    p.slot = { holder: o.holder, size: r * 0.62, turn: [0, Math.PI / 2, 0] };
  },

  breakingbad(p, { u, T }) {
    const r = u.size;
    // New Mexico's high desert (scripts/planets/breakingbad.mjs): ranges
    // north to south, mesas in the Chinle's bands, malpais, White Sands, and
    // the Rio Grande down the near face past Albuquerque, whose grid and
    // interstates light up at night; thunderheads over the mountains
    p.body.material = new THREE.MeshStandardMaterial({
      map: T.breakingbad ?? null,
      color: T.breakingbad ? '#ffffff' : u.palette.base,
      normalMap: T['breakingbad-normal'] ?? null,
      normalScale: new THREE.Vector2(1.3, 1.3),
      roughnessMap: T['breakingbad-rough'] ?? null,
      roughness: 1,
      metalness: 0,
    });
    p.night = T['breakingbad-night'] ?? null;
    if (T['breakingbad-clouds']) {
      const sky = new THREE.Mesh(
        new THREE.SphereGeometry(r * 1.008, T.small ? 44 : 64, T.small ? 28 : 40),
        new THREE.MeshStandardMaterial({ color: '#ffffff', alphaMap: T['breakingbad-clouds'], transparent: true, depthWrite: false, roughness: 1 }),
      );
      p.group.add(sky);
      p.tick.push((t) => (sky.rotation.y = t * 0.06));
    }
    // Blue Sky, in clusters of glassy shards, going round
    const crystals = new THREE.InstancedMesh(
      shardCluster('blue-sky').scale(r * 0.16, r * 0.16, r * 0.16),
      new THREE.MeshStandardMaterial({ color: '#8fdcff', emissive: '#1d79b0', emissiveIntensity: 0.75, metalness: 0.05, roughness: 0.08, flatShading: true }),
      5,
    );
    const belt = new THREE.Group();
    belt.rotation.set(0.5, 0, 0.1);
    belt.add(crystals);
    p.group.add(belt);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const at = new THREE.Vector3();
    const sz = [1, 0.8, 1.2, 0.7, 1].map((k) => new THREE.Vector3(k, k, k));
    p.tick.push((t) => {
      for (let i = 0; i < 5; i++) {
        const a = t * 0.26 + (i / 5) * Math.PI * 2 + (i % 2) * 0.3;
        at.set(Math.cos(a) * r * 1.32, (i % 2 ? 1 : -1) * r * 0.06, Math.sin(a) * r * 1.32);
        q.setFromEuler(e.set(0.4, t * 0.7 + i, 0.3));
        crystals.setMatrixAt(i, m.compose(at, q, sz[i]));
      }
      crystals.instanceMatrix.needsUpdate = true;
    });
    // element tiles, as the show's titles have them
    const tiles = new THREE.Group();
    tiles.rotation.set(-0.22, 0, 0.12);
    p.group.add(tiles);
    // (each with its atomic number, oxidation states and weight, as the titles have them)
    [
      { sym: 'Br', n: 35, mass: '79.904', states: ['+1', '+5', '−1'] },
      { sym: 'Ba', n: 56, mass: '137.327', states: ['+2'] },
      { sym: 'C', n: 6, mass: '12.011', states: ['+2', '+4', '−4'] },
      { sym: 'N', n: 7, mass: '14.007', states: ['+2', '+3', '+4', '+5', '−3'] },
    ].forEach((el, i) => {
      const tile = elementTile(el);
      tile.scale.setScalar(r * 0.22);
      tile.userData.a = (i / 4) * Math.PI * 2;
      tiles.add(tile);
    });
    const tq = new THREE.Quaternion();
    p.tick.push((t, camera) => {
      for (const [i, tile] of tiles.children.entries()) {
        const a = tile.userData.a - t * 0.14;
        tile.position.set(Math.cos(a) * r * 1.68, 0, Math.sin(a) * r * 1.68);
        if (!camera) continue;
        // face the camera, swaying a little so the slab's edge catches the light
        tile.parent.getWorldQuaternion(tq);
        tile.quaternion.copy(tq.invert()).multiply(camera.quaternion);
        tile.rotateY(Math.sin(t * 0.7 + i * 1.7) * 0.45);
        tile.rotateX(Math.sin(t * 0.5 + i) * 0.12);
      }
    });
    const o = orbit(p.group, { radius: r * 1.5, tilt: 1.0, speed: 0.2, phase: 0.4 });
    p.orbits.push(o);
    p.slot = { holder: o.holder, size: r * 0.6, turn: [0, Math.PI / 2, 0] };
  },

  office(p, { u, T }) {
    const r = u.size;
    // Scranton's country, north-east Pennsylvania (scripts/planets/office.mjs):
    // the ridge and valley's folds, the rivers through their gaps, the
    // Poconos, the coast from Delmarva to Long Island, the woods in their
    // autumn colours, fair-weather cumulus over them (in the map); the cities
    // light the night side, Dunder Mifflin's branches among them
    p.body.material = new THREE.MeshStandardMaterial({
      map: T.office ?? null,
      color: T.office ? '#ffffff' : u.palette.base,
      normalMap: T['office-normal'] ?? null,
      normalScale: new THREE.Vector2(1.2, 1.2),
      // (the sea and the lakes glossy, the woods matte)
      roughnessMap: T['office-rough'] ?? null,
      roughness: T['office-rough'] ? 1 : 0.9,
      metalness: 0,
    });
    p.night = T['office-night'] ?? null;
    // Michael's mug (props.js)
    const mug = bossMug();
    mug.scale.setScalar(r * 0.27);
    const o = orbit(p.group, { radius: r * 1.5, tilt: 0.32, speed: 0.28, phase: 5 });
    o.holder.add(mug);
    p.orbits.push(o);
    p.tick.push((t) => mug.rotation.set(0.25 + Math.sin(t * 0.6) * 0.2, t * 0.5, 0.15));
  },

  rickmorty(p, { u, T }) {
    const r = u.size;
    // the Smiths' Earth as the show draws it from orbit
    // (scripts/planets/rickmorty.mjs): the real coasts inked, flat colour in
    // cel steps, the show's blue sea and its cyan shallows, the land green
    // and tan by climate, the show's puffs of cloud going over, and the
    // cities lit on the night side
    p.body.material = new THREE.MeshStandardMaterial({
      map: T.rickmorty ?? null,
      color: T.rickmorty ? '#ffffff' : u.palette.base,
      // (the seas glossy, so they catch the sun: scripts/planets/rickmorty.mjs)
      roughnessMap: T['rickmorty-rough'] ?? null,
      roughness: T['rickmorty-rough'] ? 1 : 0.85,
      metalness: 0,
    });
    // lit as the show lights it: in flat bands, its limb inked (celShade)
    celShade(p.body.material);
    p.night = T['rickmorty-night'] ?? null;
    if (T['rickmorty-clouds']) {
      const sky = new THREE.Mesh(
        new THREE.SphereGeometry(r * 1.012, T.small ? 44 : 64, T.small ? 28 : 40),
        celShade(new THREE.MeshStandardMaterial({ map: T['rickmorty-clouds'], transparent: true, depthWrite: false, roughness: 1, metalness: 0 }), { ink: 0 }),
      );
      p.group.add(sky);
      p.tick.push((t) => (sky.rotation.y = t * 0.05));
    }
    // a portal hangs on the cruiser's orbit, so it flies through it
    const o = orbit(p.group, { radius: r * 1.55, tilt: 0.36, speed: 0.24, phase: 1 });
    const portalMat = new THREE.ShaderMaterial({
      transparent: true,
      premultipliedAlpha: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: { t: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `
        uniform float t;
        varying vec2 vUv;
        ${SWIRL_GLSL}
        void main() {
          vec4 c = portal((vUv * 2.0 - 1.0) * 1.22, t, 1.0, 3.0);
          if (c.a < 0.004) discard;
          gl_FragColor = c;
        }`,
    });
    const portal = new THREE.Mesh(new THREE.PlaneGeometry(r * 0.8, r * 0.8), portalMat);
    portal.position.set(Math.cos(2.4) * r * 1.55, 0, -Math.sin(2.4) * r * 1.55);
    portal.renderOrder = 3;
    o.plane.add(portal);
    const q = new THREE.Quaternion();
    p.tick.push((t, camera) => {
      portalMat.uniforms.t.value = t;
      if (!camera) return;
      // always face the camera: undo the turns above it, then take the camera's
      portal.parent.getWorldQuaternion(q);
      portal.quaternion.copy(q.invert()).multiply(camera.quaternion);
    });
    p.orbits.push(o);
    p.slot = { holder: o.holder, size: r * 0.58, turn: [0.15, Math.PI, 0] }; // its nose (the headlights) is +z: turned along the orbit
  },

  gaming(p, { u }) {
    const r = u.size;
    const P = u.palette;
    const rand = rng('gaming');
    // A Game Boy world, in its four greens: pixel-art continents on a dark
    // sea, drawn small and shown with no smoothing so every pixel is crisp,
    // with pixel clouds drifting over it and blocky mountains standing up
    // off the land where it's highest.
    const W = 256;
    const H = 128;
    // wrapped value noise over the map, a few octaves
    const grid = (n) => Array.from({ length: n * (n / 2 + 1) }, () => rand());
    const octaves = [8, 16, 32, 64].map((n) => ({ n, g: grid(n) }));
    const smooth = (t) => t * t * (3 - 2 * t);
    const height = (x, y) => {
      let v = 0;
      let amp = 0.55;
      for (const { n, g } of octaves) {
        const fx = (x / W) * n;
        const fy = (y / H) * (n / 2);
        const x0 = Math.floor(fx);
        const y0 = Math.floor(fy);
        const tx = smooth(fx - x0);
        const ty = smooth(fy - y0);
        const at = (i, j) => g[(((j % (n / 2 + 1)) + n / 2 + 1) % (n / 2 + 1)) * n + (((i % n) + n) % n)];
        const top = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * tx;
        const bottom = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * tx;
        v += (top + (bottom - top) * ty) * amp;
        amp *= 0.5;
      }
      // the poles a little colder: more sea at the top and bottom
      return v - Math.abs(y / H - 0.5) * 0.35;
    };
    const SEA = 0.46;
    const GREENS = [P.dark, P.glow, P.base, P.light];
    const map = paint(
      (g) => {
        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) {
            const h = height(x, y);
            let c;
            if (h < SEA - 0.1) c = P.dark; // the deep
            else if (h < SEA) c = rand() < 0.04 ? P.dark : P.glow; // the sea, with the odd wave
            else if (h < SEA + 0.015) c = P.light; // a beach
            else if (h < SEA + 0.12) c = P.base;
            else c = P.light;
            g.fillStyle = c;
            g.fillRect(x, y, 1, 1);
            // trees: a dark pixel here and there on the land
            if (h >= SEA + 0.02 && h < SEA + 0.12 && (x * 7 + y * 13) % 17 === 0) {
              g.fillStyle = P.glow;
              g.fillRect(x, y, 1, 1);
            }
          }
        }
      },
      W,
      H,
    );
    map.magFilter = THREE.NearestFilter;
    map.minFilter = THREE.NearestMipmapLinearFilter;
    map.anisotropy = 1;
    p.body.material = new THREE.MeshStandardMaterial({ map, roughness: 0.85, metalness: 0 });
    // lit as a Game Boy would light it: the four greens, dithered (ditherShade),
    // the ground, its clouds and its mountains alike, sized by one ratio
    p.dpr = { value: 1 };
    ditherShade(p.body.material, { palette: GREENS, dpr: p.dpr, outline: true });
    // pixel clouds, drifting a little faster than the ground
    const clouds = paint(
      (g) => {
        g.clearRect(0, 0, W, H);
        g.fillStyle = GREENS[3];
        for (let i = 0; i < 34; i++) {
          const cx = Math.floor(rand() * W);
          const cy = Math.floor(H * (0.15 + rand() * 0.7));
          const len = 4 + Math.floor(rand() * 12);
          for (let k = 0; k < len; k++) {
            const x = (cx + k) % W;
            g.fillRect(x, cy, 1, 1);
            if (k > 1 && k < len - 2) g.fillRect(x, cy - 1, 1, 1);
            if (k > 3 && k < len - 4 && rand() < 0.6) g.fillRect(x, cy - 2, 1, 1);
          }
        }
      },
      W,
      H,
    );
    clouds.magFilter = THREE.NearestFilter;
    const cloudShell = new THREE.Mesh(new THREE.SphereGeometry(r * 1.025, 64, 40), new THREE.MeshStandardMaterial({ map: clouds, transparent: true, depthWrite: false, roughness: 1, alphaTest: 0.5 }));
    ditherShade(cloudShell.material, { palette: GREENS, dpr: p.dpr });
    p.group.add(cloudShell);
    p.tick.push((t) => (cloudShell.rotation.y = t * 0.09));
    // blocky mountains: a few voxels standing up where the land is highest
    const peaks = [];
    for (let n = 0; n < 4000 && peaks.length < 70; n++) {
      const x = rand() * W;
      const y = rand() * H;
      const h = height(x, y);
      if (h > SEA + 0.17) peaks.push([x, y, h]);
    }
    const c = r * 0.05;
    const blocks = new THREE.InstancedMesh(new THREE.BoxGeometry(c, c, c), new THREE.MeshStandardMaterial({ roughness: 0.75 }), peaks.length * 2);
    ditherShade(blocks.material, { palette: GREENS, dpr: p.dpr });
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const out = new THREE.Vector3();
    const col = new THREE.Color();
    let i = 0;
    for (const [x, y, h] of peaks) {
      // the point on the sphere under that pixel (as SphereGeometry maps it)
      const phi = (x / W) * Math.PI * 2;
      const theta = (y / H) * Math.PI;
      out.set(-Math.cos(phi) * Math.sin(theta), Math.cos(theta), Math.sin(phi) * Math.sin(theta));
      q.setFromUnitVectors(up, out);
      const tall = h > SEA + 0.23 ? 2 : 1;
      for (let k = 0; k < tall; k++) {
        m.compose(out.clone().multiplyScalar(r + c * (0.35 + k)), q, new THREE.Vector3(1, 1, 1));
        blocks.setMatrixAt(i, m);
        blocks.setColorAt(i, col.set(k ? GREENS[3] : GREENS[2]));
        i++;
      }
    }
    blocks.count = i;
    p.body.add(blocks);
    // Mario stands on top of it, like the Little Prince on his asteroid (on
    // the pole, so the world turns under him and he stays facing you), and a
    // Piranha Plant pokes out of its pipe on the land, going round with it
    const hero = new THREE.Group();
    hero.position.y = r + r * 0.16;
    p.group.add(hero);
    const plantAt = new THREE.Vector3(0.55, 0.62, 0.56).normalize();
    const plant = new THREE.Group();
    plant.position.copy(plantAt).multiplyScalar(r + r * 0.12);
    plant.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), plantAt);
    p.body.add(plant);
    p.slots = {
      mario: { holder: hero, size: r * 0.34, turn: [0, 0, 0], sway: 0.35, hop: true },
      plant: { holder: plant, size: r * 0.26, turn: [0, 0.6, 0], sway: 0.5, chomp: true },
    };
    const o = orbit(p.group, { radius: r * 1.55, tilt: -0.3, speed: 0.22, phase: 2.6 });
    p.orbits.push(o);
    p.slot = { holder: o.holder, size: r * 0.6, turn: [0, Math.PI, 0.2] };

  },

  caribbean(p, { u, T }) {
    const r = u.size;
    const P = u.palette;
    const rand = rng('caribbean');
    if (T.caribbean) {
      // a world of warm sea (scripts/planets/caribbean.mjs): the deep, the
      // banks' turquoise shallows with surf on their edges, island arcs,
      // jungle islands ringed with white sand, Tortuga shaped as its name,
      // Davy Jones's maelstrom; the sea catches the sun, the ports' lanterns
      // light the night, and the trade-wind cloud and a hurricane go over
      p.body.material = new THREE.MeshStandardMaterial({
        map: T.caribbean,
        normalMap: T['caribbean-normal'] ?? null,
        normalScale: new THREE.Vector2(1.2, 1.2),
        roughnessMap: T['caribbean-rough'] ?? null,
        roughness: 1,
        metalness: 0,
      });
      p.night = T['caribbean-night'] ?? null;
      if (T['caribbean-clouds']) {
        const sky = new THREE.Mesh(
          new THREE.SphereGeometry(r * 1.01, T.small ? 44 : 64, T.small ? 28 : 40),
          new THREE.MeshStandardMaterial({ color: '#ffffff', alphaMap: T['caribbean-clouds'], transparent: true, depthWrite: false, roughness: 1 }),
        );
        p.group.add(sky);
        p.tick.push((t) => (sky.rotation.y = t * 0.07));
      }
    }
    // (without the maps: painted here, a world that is nearly all sea: deep
    // water, turquoise shallows round small islands of sand and green)
    const map = T.caribbean ? null : paint(
      (g, w, h) => {
        const sea = g.createLinearGradient(0, 0, 0, h);
        sea.addColorStop(0, '#0a4a55');
        sea.addColorStop(0.5, P.base);
        sea.addColorStop(1, P.dark);
        g.fillStyle = sea;
        g.fillRect(0, 0, w, h);
        const blob = (x, y, s, fill) => {
          // drawn twice across the seam, so the map wraps
          for (const dx of [0, -w, w]) {
            g.beginPath();
            g.ellipse(x + dx, y, s * 1.5, s, 0, 0, Math.PI * 2);
            g.fillStyle = fill;
            g.fill();
          }
        };
        // island chains: each a few lumps run together, so no two are the
        // same shape; the shallows first, then the sand, then the green
        const isles = [];
        for (let i = 0; i < 64; i++) {
          const x = rand() * w;
          const y = h * (0.16 + rand() * 0.68);
          const s = 3 + rand() * rand() * 15;
          const run = rand() * Math.PI;
          for (let k = 0, n = 2 + Math.floor(rand() * 5); k < n; k++) isles.push([x + Math.cos(run) * k * s * 1.3 + (rand() - 0.5) * s, y + Math.sin(run) * k * s * 0.7 + (rand() - 0.5) * s, s * (0.55 + rand() * 0.6)]);
        }
        for (const [x, y, s] of isles) blob(x, y, s * 2.4, 'rgba(64, 220, 200, 0.14)');
        for (const [x, y, s] of isles) blob(x, y, s * 1.6, 'rgba(64, 220, 200, 0.3)');
        for (const [x, y, s] of isles) blob(x, y, s * 1.08, P.light);
        for (const [x, y, s] of isles) blob(x, y, s * 0.78, '#3f7a3a');
        for (let i = 0; i < 60; i++) blob(rand() * w, rand() * h, 6 + rand() * 30, `rgba(255, 255, 255, ${(0.03 + rand() * 0.08).toFixed(3)})`);
      },
      1024,
      512,
    );
    if (map) p.body.material = new THREE.MeshStandardMaterial({ map, roughness: 0.6 });
    // the black galleon sails round it
    const o = orbit(p.group, { radius: r * 1.5, tilt: 0.22, speed: 0.2, phase: 0.7 });
    p.orbits.push(o);
    p.slot = { holder: o.holder, size: r * 0.9, turn: [0.1, -Math.PI / 2, 0] }; // her bow is −x: along the orbit
  },

  invincible(p, { u, T }) {
    const r = u.size;
    const P = u.palette;
    const rand = rng('invincible');
    if (T.invincible) {
      // a war-worn world (scripts/build-invincible-planet.mjs): rust plateaus
      // over dark old sea beds, ridges, craters thrown wide, and long rifts
      // still molten along their floors; cities light its night side, and
      // high dust streams round it in bands
      const mat = new THREE.MeshStandardMaterial({
        map: T.invincible,
        normalMap: T['invincible-normal'] ?? null,
        normalScale: new THREE.Vector2(1.35, 1.35),
        emissive: '#ffffff',
        emissiveMap: T['invincible-glow'] ?? null,
        emissiveIntensity: T['invincible-glow'] ? 1.6 : 0,
        // (the old sea beds glossy: scripts/build-invincible-planet.mjs)
        roughnessMap: T['invincible-rough'] ?? null,
        roughness: T['invincible-rough'] ? 1 : 0.92,
      });
      p.body.material = mat;
      p.night = T['invincible-night'] ?? null;
      // the rifts breathe, slowly (embers along their floors, not a world
      // alight: the planet is one thing, not a pile of effects)
      if (T['invincible-glow']) p.tick.push((t) => (mat.emissiveIntensity = 1.4 + 0.7 * (0.5 + 0.5 * Math.sin(t * 1.1)) ** 2));
      if (T['invincible-clouds']) {
        const dust = new THREE.Mesh(
          new THREE.SphereGeometry(r * 1.016, T.small ? 44 : 64, T.small ? 28 : 40),
          new THREE.MeshStandardMaterial({ color: '#f3d4b4', alphaMap: T['invincible-clouds'], transparent: true, opacity: 0.7, depthWrite: false, roughness: 1 }),
        );
        p.group.add(dust);
        p.tick.push((t) => (dust.rotation.y = t * 0.065));
      }
    } else {
      // (without the maps: painted here, rust and ochre, dark old sea beds, bands of high cloud)
      const map = paint(
        (g, w, h) => {
          const ground = g.createLinearGradient(0, 0, 0, h);
          ground.addColorStop(0, P.dark);
          ground.addColorStop(0.3, P.base);
          ground.addColorStop(0.7, P.base);
          ground.addColorStop(1, P.dark);
          g.fillStyle = ground;
          g.fillRect(0, 0, w, h);
          const blob = (x, y, rx, ry, fill) => {
            for (const dx of [0, -w, w]) {
              g.beginPath();
              g.ellipse(x + dx, y, rx, ry, 0, 0, Math.PI * 2);
              g.fillStyle = fill;
              g.fill();
            }
          };
          for (let i = 0; i < 90; i++) blob(rand() * w, h * (0.12 + rand() * 0.76), 10 + rand() * 60, 6 + rand() * 26, `rgba(40, 10, 6, ${(0.12 + rand() * 0.25).toFixed(3)})`);
          for (let i = 0; i < 120; i++) blob(rand() * w, h * (0.1 + rand() * 0.8), 4 + rand() * 30, 3 + rand() * 12, `rgba(230, 160, 90, ${(0.08 + rand() * 0.2).toFixed(3)})`);
        },
        1024,
        512,
      );
      p.body.material = new THREE.MeshStandardMaterial({ map, roughness: 0.85 });
    }

    // a soft glow, for the flyers' heads and the shockwaves
    const soft = paint(
      (g, w, h) => {
        const k = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
        k.addColorStop(0, 'rgba(255,255,255,1)');
        k.addColorStop(0.2, 'rgba(255,255,255,0.6)');
        k.addColorStop(0.55, 'rgba(255,255,255,0.12)');
        k.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = k;
        g.fillRect(0, 0, w, h);
      },
      128,
      128,
    );
    // a trail's fade, bright at the head
    const fade = paint(
      (g, w, h) => {
        const k = g.createLinearGradient(0, 0, w, 0);
        k.addColorStop(0, '#ffffff');
        k.addColorStop(0.25, '#9a9a9a');
        k.addColorStop(1, '#000000');
        g.fillStyle = k;
        g.fillRect(0, 0, w, h);
      },
      256,
      4,
    );

    // ── a debris belt: what's left of something that was hit very hard ──
    {
      const rock = new THREE.DodecahedronGeometry(1, 0);
      const pos = rock.attributes.position;
      for (let i = 0; i < pos.count; i++) pos.setXYZ(i, pos.getX(i) * (0.75 + 0.5 * Math.abs(Math.sin(i * 1.7))), pos.getY(i) * (0.6 + 0.3 * Math.abs(Math.cos(i * 2.3))), pos.getZ(i) * (0.8 + 0.4 * Math.abs(Math.sin(i * 0.9))));
      rock.computeVertexNormals();
      const N = T.small ? 60 : 110;
      const rocks = new THREE.InstancedMesh(rock, new THREE.MeshStandardMaterial({ color: '#8a5a44', roughness: 0.95, flatShading: true }), N);
      const belt = new THREE.Group();
      belt.rotation.set(0.42, 0, -0.16);
      belt.add(rocks);
      p.group.add(belt);
      const bits = Array.from({ length: N }, () => {
        const a = rand() * Math.PI * 2;
        const rad = r * (1.48 + rand() * 0.34 + (rand() < 0.15 ? rand() * 0.2 : 0));
        return { a, rad, y: (rand() - 0.5) * r * 0.05, s: r * (0.006 + rand() ** 3 * 0.03), spin: (rand() - 0.5) * 2, ax: rand() * 6, w: 0.05 + rand() * 0.04 };
      });
      const c = new THREE.Color();
      bits.forEach((b, i) => rocks.setColorAt(i, c.set(rand() < 0.2 ? '#5a3a30' : rand() < 0.5 ? '#9a6a50' : '#7a4a38')));
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const e = new THREE.Euler();
      const at = new THREE.Vector3();
      const sc = new THREE.Vector3();
      const place = (t) => {
        bits.forEach((b, i) => {
          const a = b.a + t * b.w;
          at.set(Math.cos(a) * b.rad, b.y, Math.sin(a) * b.rad);
          q.setFromEuler(e.set(b.ax + t * b.spin, b.ax * 2 + t * b.spin * 0.7, 0));
          rocks.setMatrixAt(i, m.compose(at, q, sc.setScalar(b.s)));
        });
        rocks.instanceMatrix.needsUpdate = true;
      };
      place(0);
      p.tick.push(place);
      // and the dust it's grinding into, a faint band
      const IN = r * 1.42;
      const OUT = r * 1.9;
      const bands = paint(
        (g, w, h) => {
          g.clearRect(0, 0, w, h);
          for (let x = 0; x < w; x++) {
            const k = x / w;
            const a = Math.sin(k * Math.PI) ** 1.4 * (0.45 + 0.55 * Math.abs(Math.sin(k * 23 + Math.sin(k * 7) * 2)));
            g.fillStyle = `rgba(220, 150, 110, ${(a * 0.55).toFixed(3)})`;
            g.fillRect(x, 0, 1, h);
          }
        },
        512,
        4,
      );
      const disc = new THREE.RingGeometry(IN, OUT, 128, 1);
      const dp = disc.attributes.position;
      const uv = disc.attributes.uv;
      for (let i = 0; i < dp.count; i++) uv.setXY(i, (Math.hypot(dp.getX(i), dp.getY(i)) - IN) / (OUT - IN), 0.5);
      const dust = new THREE.Mesh(disc, new THREE.MeshBasicMaterial({ map: bands, transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide }));
      dust.rotation.x = -Math.PI / 2;
      belt.add(dust);
    }

    // ── a moon, broken: cracks of light through it, and pieces drifting off its side ──
    {
      const o = orbit(p.group, { radius: r * 2.15, tilt: -0.22, yaw: 0.9, speed: 0.07, phase: 1.3 });
      p.orbits.push(o);
      const mr = r * 0.17;
      const geo = new THREE.IcosahedronGeometry(mr, T.small ? 3 : 4);
      const gp = geo.attributes.position;
      const v = new THREE.Vector3();
      for (let i = 0; i < gp.count; i++) {
        v.fromBufferAttribute(gp, i).normalize();
        // pocked, and flattened where the piece came off (+x)
        const pock = 1 + 0.035 * Math.sin(v.x * 17 + v.y * 9) * Math.sin(v.z * 13 - v.y * 7) - 0.05 * Math.max(0, Math.sin(v.x * 29) * Math.sin(v.y * 31) * Math.sin(v.z * 23));
        const cut = v.x > 0.55 ? 1 - (v.x - 0.55) * 0.9 : 1;
        v.multiplyScalar(mr * pock * cut);
        gp.setXYZ(i, v.x, v.y, v.z);
      }
      geo.computeVertexNormals();
      const cracks = paint(
        (g, w, h) => {
          g.fillStyle = '#000';
          g.fillRect(0, 0, w, h);
          g.lineCap = 'round';
          // from the broken side (u ≈ 0.5 faces +x), jagged lines running out round it
          for (let i = 0; i < 16; i++) {
            let x = w * (0.5 + (rand() - 0.5) * 0.08);
            let y = h * (0.3 + rand() * 0.4);
            g.strokeStyle = `rgba(255, ${100 + rand() * 80}, 40, ${(0.5 + rand() * 0.5).toFixed(2)})`;
            g.lineWidth = 1 + rand() * 2.5;
            g.beginPath();
            g.moveTo(x, y);
            const dir = rand() < 0.5 ? -1 : 1;
            for (let k = 0; k < 9; k++) {
              x += dir * (8 + rand() * 22);
              y += (rand() - 0.5) * 26;
              g.lineTo(x, y);
            }
            g.stroke();
          }
        },
        512,
        256,
      );
      const moon = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#8f7f74', roughness: 1, emissive: '#ffffff', emissiveMap: cracks, emissiveIntensity: 1.6 }));
      o.holder.add(moon);
      const chunks = [];
      const shard = new THREE.DodecahedronGeometry(1, 0);
      const chunkMat = new THREE.MeshStandardMaterial({ color: '#7f6f64', roughness: 1, flatShading: true });
      for (let i = 0; i < 6; i++) {
        const c = new THREE.Mesh(shard, chunkMat);
        const s = mr * (0.12 + rand() * 0.22);
        c.scale.set(s, s * (0.6 + rand() * 0.5), s * (0.8 + rand() * 0.4));
        o.holder.add(c);
        chunks.push({ c, dir: new THREE.Vector3(1, (rand() - 0.5) * 1.2, (rand() - 0.5) * 1.2).normalize(), d: mr * (1.15 + rand() * 0.9), ph: rand() * 6, spin: (rand() - 0.5) * 0.8 });
      }
      p.tick.push((t) => {
        moon.rotation.y = t * 0.05;
        for (const k of chunks) {
          // out, and back a little, as if still coming apart
          k.c.position.copy(k.dir).multiplyScalar(k.d * (1 + 0.08 * Math.sin(t * 0.3 + k.ph)));
          k.c.rotation.set(k.ph + t * k.spin, k.ph * 2 + t * k.spin * 0.6, 0);
        }
      });
    }

    // ── two flyers round it, each trailing light, now and then breaking the
    // sound barrier in a ring: one in yellow and blue, one in white and red ──
    const q = new THREE.Quaternion();
    const flyer = (head, tail, { radius, tilt, yaw, speed, phase, boom }) => {
      const o = orbit(p.group, { radius, tilt, yaw, speed, phase });
      p.orbits.push(o);
      const core = new THREE.Mesh(new THREE.SphereGeometry(r * 0.022, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(head).multiplyScalar(2.6), toneMapped: false }));
      o.holder.add(core);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: soft, color: new THREE.Color(head).multiplyScalar(1.6), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
      halo.scale.setScalar(r * 0.2);
      o.holder.add(halo);
      // the trail: a tube along the orbit just behind, tapering and fading
      const ARC = 1.7;
      const pts = Array.from({ length: 41 }, (_, i) => {
        const b = -(i / 40) * ARC;
        return new THREE.Vector3(Math.cos(b) * radius, 0, -Math.sin(b) * radius);
      });
      const path = new THREE.CatmullRomCurve3(pts);
      const tube = (width) => {
        const g = new THREE.TubeGeometry(path, 80, width, 8, false);
        // (each ring of the tube drawn in toward its centre, more the further back)
        const tp = g.attributes.position;
        const at = new THREE.Vector3();
        for (let i = 0; i <= 80; i++) {
          const k = i / 80;
          path.getPointAt(k, at);
          const taper = (1 - k) ** 1.3;
          for (let j = 0; j <= 8; j++) {
            const n = i * 9 + j;
            tp.setXYZ(n, at.x + (tp.getX(n) - at.x) * taper, at.y + (tp.getY(n) - at.y) * taper, at.z + (tp.getZ(n) - at.z) * taper);
          }
        }
        return g;
      };
      const trailMat = (c, k) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k), alphaMap: fade, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
      o.pivot.add(new THREE.Mesh(tube(r * 0.024), trailMat(tail, 1.2)), new THREE.Mesh(tube(r * 0.008), trailMat(head, 2)));
      // the shockwave: a ring that bursts out from the head and fades
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.82, 1, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(head).lerp(new THREE.Color('#ffffff'), 0.5).multiplyScalar(1.8), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false }));
      o.holder.add(ring);
      p.tick.push((t, camera) => {
        halo.material.opacity = 0.75 + 0.25 * Math.sin(t * 9 + phase);
        const k = ((t + boom) % 6.5) / 0.9; // every six and a half seconds, for nine tenths of one
        const on = k < 1;
        ring.visible = on;
        if (!on) return;
        ring.scale.setScalar(r * (0.03 + 0.4 * (1 - (1 - k) ** 2)));
        ring.material.opacity = (1 - k) ** 1.5 * 0.9;
        if (camera) {
          ring.parent.getWorldQuaternion(q);
          ring.quaternion.copy(q.invert()).multiply(camera.quaternion);
        }
      });
    };
    flyer('#ffd23a', '#3aa0ff', { radius: r * 1.3, tilt: 0.35, yaw: 0.4, speed: 0.55, phase: 0, boom: 0 });
    flyer('#ffffff', '#ff3a2a', { radius: r * 1.4, tilt: -0.25, yaw: 1.9, speed: 0.48, phase: 2.1, boom: 3.2 });
  },

  travel(p, { u, T }) {
    const r = u.size;
    // the oceans catch the sun (a roughness map), the cities light the night side (in airGlow)
    p.body.material = new THREE.MeshStandardMaterial({
      map: T.earth ?? null,
      color: T.earth ? '#ffffff' : u.palette.base,
      roughnessMap: T['earth-rough'] ?? null,
      roughness: T['earth-rough'] ? 1 : 0.85,
      metalness: 0,
    });
    p.night = T['earth-night'] ?? null;
    // the clouds, drifting a little faster than the ground
    if (T['earth-clouds']) {
      const clouds = new THREE.Mesh(
        new THREE.SphereGeometry(r * 1.012, 64, 40),
        new THREE.MeshStandardMaterial({ color: '#ffffff', alphaMap: T['earth-clouds'], transparent: true, depthWrite: false, roughness: 1 }),
      );
      p.group.add(clouds);
      p.tick.push((t) => (clouds.rotation.y = t * 0.075));
    }
    // a few routes from home, lifted off the surface (the travel globe's own)
    const data = globeData();
    const routes = data.arcs.filter(Boolean);
    const pick = [0, 0.2, 0.4, 0.6, 0.8].map((k) => routes[Math.floor(k * routes.length)]).filter(Boolean);
    const tubes = pick.map((pts) => {
      const steps = pts.length / 3 - 1;
      const curve = new THREE.CatmullRomCurve3(
        Array.from({ length: 25 }, (_, i) => {
          const k = Math.round((i / 24) * steps) * 3;
          return new THREE.Vector3(pts[k] * r * 1.01, pts[k + 1] * r * 1.01, pts[k + 2] * r * 1.01);
        }),
      );
      return new THREE.TubeGeometry(curve, 48, r * 0.01, 5, false);
    });
    if (tubes.length) {
      const arcs = new THREE.Mesh(mergeGeometries(tubes), glowMat(u.swatch));
      for (const t of tubes) t.dispose();
      p.body.add(arcs);
    }
  },
  ...STATIONS,
  // the Central Finite Curve's worlds, alive (rmWorlds.js)
  ...RM_WORLDS,
};

// The sphere's segments near (nearMaps.js swaps it in with the near maps):
// parked 2.4 radii out the limb is about 1,900 pixels round, and at 64 a
// chord is 30 of them, a polygon against the air; at 160, 12. Mid gets
// fewer; low none.
export const NEAR_SEG = { high: [160, 100], ultra: [320, 200], mid: [96, 60] };
export const nearSegments = (level) => NEAR_SEG[level] ?? null;

export function buildPlanet(u, T = {}, { sun = null, tier = 'high', key = null } = {}) {
  const core = u.kind === 'core';
  // the way to the star that lights it, in the world's axes (lighting.js's
  // sunFor, turned with the map by the scene each frame): one vector its
  // air, its rim and its night side all read; the old fixed key without one
  const sunW = sun ? (sun.isVector3 ? sun : new THREE.Vector3(...sun)) : LIGHT;
  const seg = T.small ? [44, 28] : [64, 40]; // a phone's screen needs fewer
  const group = new THREE.Group();
  const spinner = new THREE.Group(); // what turns about the planet's axis
  group.add(spinner);
  const body = new THREE.Mesh(new THREE.SphereGeometry(u.size, seg[0], seg[1]), new THREE.MeshStandardMaterial({ color: u.palette.base, roughness: 1 }));
  spinner.add(body);
  // a planet has air round it in its colour; a station's sign does that job
  // a planet has air round it in its colour: the old halo, and where it says
  // what its air is (universes.js), a real one on high and mid, marched
  // through (lib/three/atmosphere.js: 16 steps on ultra, 8 on high, 5 on mid, its sun the
  // planet's own vector); the halo kept for low and for the pace's last
  // steps (setAir), only one of them shown
  const haloMesh = core || u.airless ? null : halo(u.size, u.rim ?? u.swatch, seg, sunW); // (a station has no air round it)
  const shell =
    haloMesh && u.air && tier !== 'low'
      ? createAtmosphere({ radius: u.size, top: u.air.top, colour: u.air.colour, density: u.air.density, sunset: u.air.sunset, segments: T.small ? [64, 40] : [96, 64], steps: stepsFor(tier, 8), inner: Math.cos(Math.PI / seg[1]), flat: Boolean(u.air.flat), uniforms: { uSunDir: { value: [sunW, new THREE.Vector3(0, 1, 0)] } } })
      : null;
  if (shell) shell.mesh.renderOrder = 2;
  let air = shell ? shell.mesh : haloMesh;
  if (haloMesh) group.add(haloMesh);
  // (the air's march is about the planet's middle where it is as it's drawn:
  // the map is moved round the camera for the draw alone, relative.js)
  const centre = new THREE.Vector3();
  if (shell) {
    group.add(shell.mesh);
    haloMesh.visible = false;
    shell.mesh.onBeforeRender = () => shell.update(centre.setFromMatrixPosition(group.matrixWorld));
  }
  const p = { group, body, orbits: [], tick: [], focus: [], slot: null, onSelect: null, sun: sunW };
  const sphere = body.geometry;
  BUILDERS[u.id]?.(p, { u, T });

  if (!core && p.body.material?.isMeshStandardMaterial) airGlow(p.body.material, u.rim ?? u.swatch, { night: p.night, sun: sunW });
  // the clouds' shadows, the ground's detail and a sea's glint (groundHooks),
  // the cloud layer found by its texture, wherever its builder put it
  const style = styleFor(u, T, { tier });
  let cloudMesh = null;
  if (style.clouds) group.traverse((o) => (cloudMesh ??= o.isMesh && (o.material?.map === style.clouds || o.material?.alphaMap === style.clouds) ? o : null));
  // its sphere, and its cloud layer's, finer near: the limb a curve, not
  // chords (at ultra, 320 × 200: a limb as smooth as the 8192 maps on it; a builder that made its own shape keeps it; each finer one
  // made once, the first time it's near)
  const fine = new Map();
  const finer = (mesh, far, on, level) => {
    const s = on && nearSegments(level);
    if (s && !fine.has(mesh)) fine.set(mesh, new THREE.SphereGeometry(far.parameters.radius, s[0], s[1]));
    mesh.geometry = s ? fine.get(mesh) : far;
  };
  const cloudSphere = cloudMesh?.geometry?.type === 'SphereGeometry' ? cloudMesh.geometry : null;
  const nearGeometry =
    core || body.geometry !== sphere
      ? undefined
      : (on, level = 'high') => {
          finer(body, sphere, on, level);
          if (cloudSphere) finer(cloudMesh, cloudSphere, on, level);
        };
  const ground = !core && p.body.material?.isMeshStandardMaterial ? groundHooks(p.body.material, { ...style, clouds: cloudMesh ? style.clouds : null }) : null;
  if (key && !core && p.body.material?.isMeshStandardMaterial) keyHook(p.body.material, key, sunW);
  // (with real air round it, the air draws the limb: the rim in its ground goes)
  const rimGlow = () => p.body.material?.userData?.air;
  if (shell && rimGlow()) rimGlow().uRimStrength.value = 0;
  // a station's big sign, over it
  const sign = u.sign ? bigSign(u) : null;
  if (sign) {
    group.add(sign);
    p.tick.push(facing(sign));
  }
  // its near maps (nearMaps.js) in place of its own (planetMaps.js)
  const swapMaps = mapSwapper(group, T, mapsOf(u.id));
  const spin = core ? 0 : 0.05 + rng(`${u.id}-spin`)() * 0.05;
  let turn0 = body.rotation.y;
  let held = null; // the turn it's held at, while someone stands on it
  let level = 0; // the pace's step
  let selected = false;
  let t0 = 0;

  return {
    id: u.id,
    radius: u.size,
    group,
    sign,
    // what a crash lays its shockwave on (a station's is hidden: none)
    surface: core ? null : body,
    body,
    swapMaps,
    nearSet: (level) => (core ? [] : nearSet(u.id, level)),
    nearGeometry,
    get air() {
      return air;
    },
    // how far off the camera is, in the planet's radii (the scene, for the
    // nearest two: the ground's detail comes up from three)
    near(d) {
      if (ground) ground.uCamDist.value = level >= 2 ? 1e9 : d;
    },
    // the pace's step (lib/three/pace), as the spec's effects table has it:
    // the ground's detail goes at 2, the clouds' shadows and the real air
    // (for the halo) at 3, all back as it comes down again
    setLevel(l) {
      level = l;
      if (ground) {
        ground.uCloudOn.value = l >= 3 ? 0 : 1;
        if (l >= 2) ground.uCamDist.value = 1e9;
      }
      this.setAir(l >= 3 ? 'halo' : 'shell');
    },
    // each frame, the scene's key light's colour and the ratio the frame is
    // drawn at: Cybertron's seams glow in the one (normalised: a tint, not a
    // dimming), Dot Matrix's dither is sized by the other
    light(colour, ratio) {
      if (p.dpr) p.dpr.value = ratio;
      if (p.keyColour) p.keyColour.copy(colour).multiplyScalar(1 / Math.max(colour.r, colour.g, colour.b, 1e-3));
    },
    // the real air or the old halo (the pace's last steps): 'shell' | 'halo'
    setAir(which) {
      if (!shell) return;
      const on = which === 'shell';
      shell.mesh.visible = on;
      haloMesh.visible = !on;
      air = on ? shell.mesh : haloMesh;
      const g = rimGlow();
      if (g) g.uRimStrength.value = on ? 0 : RIM.idle * 0.8;
    },
    sun: sunW,
    // held still (true) while the crew walk about on it, and turning on
    // from there once they're gone
    hold(on) {
      if (on && held === null) held = body.rotation.y;
      else if (!on && held !== null) {
        turn0 = held - t0 * spin;
        held = null;
      }
    },
    // the sign brightens and grows a little under the pointer
    setSignHover(on) {
      if (!sign) return;
      sign.scale.setScalar(on ? 1.08 : 1);
      sign.material.color.setScalar(on ? 1.35 : 1);
    },
    // (`live`: it's in view and big enough to see, so its own motion, which
    // can be a lot, is worth working out; all of it goes by `t`, so it's
    // where it should be the moment it's back in view)
    update(t, camera, live = true) {
      t0 = t;
      body.rotation.y = held ?? turn0 + t * spin;
      // (where the clouds have turned to over the ground: on the ground, or turning on their own)
      if (ground && cloudMesh) ground.uCloudTurn.value = (cloudMesh.rotation.y - (cloudMesh.parent === body ? 0 : body.rotation.y)) / (Math.PI * 2);
      for (const o of p.orbits) o.set(t);
      if (live) for (const fn of p.tick) fn(t, camera);
    },
    // `dim`: somewhere else is picked, so this station's sign steps back
    setState({ hover, selected: sel, dim = false }) {
      const k = hover ? RIM.hover : sel ? RIM.selected : RIM.idle;
      if (haloMesh) haloMesh.material.uniforms.uStrength.value = k;
      // (the real air brightens a little less: it's the whole limb)
      shell?.set({ strength: 1 + (k - RIM.idle) * 0.6 });
      const glow = body.material?.userData?.air;
      if (glow) glow.uRimStrength.value = shell && air === shell.mesh ? 0 : k * 0.8;
      if (sel && !selected) p.onSelect?.(t0);
      if (sel !== selected) for (const fn of p.focus) fn(sel);
      selected = sel;
      if (sign) sign.material.opacity = dim && !hover ? 0.28 : 1;
    },
    // a loaded model, parked on its orbit or its spot: the planet's own, or
    // the one named (most planets have just their own; a few have more:
    // Cybertron's 'rival', the Game Boy world's 'mario' and 'plant', the Death
    // Star's 'cruiser'). True when this planet takes it
    mount(model, name) {
      const s = name ? p.slots?.[name] : p.slot;
      if (!s || !model) return false;
      const holder = fit(model, s.size);
      holder.rotation.set(...s.turn);
      s.holder.add(holder);
      // a model that's the planet itself: the painted sphere stops drawing
      // (it stays, for what's laid over it: a crash's shockwave)
      if (s.skin) {
        p.body.material.visible = false;
        model.traverse((o) => {
          if (o.isMesh && o.material?.emissiveMap) o.material.emissiveIntensity = 1.6; // its lit windows
        });
      }
      const sway = s.sway ?? 0.25;
      p.tick.push((t) => {
        holder.rotation.y = s.turn[1] + Math.sin(t * 0.4) * sway;
        // Mario's hop, now and then, the way he does
        if (s.hop) holder.position.y = Math.max(0, Math.sin(t * 1.7)) ** 3 * s.size * 0.35;
        // the Piranha Plant's chomp
        if (s.chomp) holder.scale.y = holder.scale.x * (1 + Math.max(0, Math.sin(t * 3.1)) ** 4 * 0.12);
      });
      return true;
    },
  };
}

// One model, or null if it doesn't load: a copy of the page's one parse of it
// (gltfCache.js), its materials its own, its geometry and textures shared.
export function loadModel(url) {
  return loadGLTF(url).then((g) => g && cloneScene(g));
}

// [planet, model, and which of its spots, if not its own]. The sitar is
// Amagi_Arts's model, from Sketchfab (scripts/sketchfab-batch.mjs, credited
// in data/modelCredits.json)
const MODELS = [
  ['music', '/models/sketchfab/sitar.glb'],
  ['transformers', '/models/cybertron/optimus-orbit.glb'], // War for Cybertron's, as Cybertron's own world has him
  ['transformers', '/models/cybertron/megatron-orbit.glb', 'rival'], // and Fall of Cybertron's
  ['marvel', '/models/universe/marvel.glb'],
  ['breakingbad', '/models/universe/breakingbad.glb'],
  ['rickmorty', '/games/meshy/saucer.glb'], // the classic cruiser, as on the C-137 page
  ['gaming', '/models/universe/gaming.glb'],
  ['gaming', '/models/universe/mario.glb', 'mario'],
  ['gaming', '/models/universe/piranha.glb', 'plant'],
  ['caribbean', '/games/caribbean/pearl-far.glb'],
  ['starwars', '/models/universe/venator.glb', 'cruiser'],
  ['starwars', '/models/universe/star-destroyer.glb', 'escort1'],
  ['starwars', '/models/universe/star-destroyer.glb', 'escort2'],
];

// the planets that have models of their own
export const MODEL_PLANETS = [...new Set(MODELS.map(([id]) => id))];

// Load a planet's models (`ids`: the planets'; every one's without),
// handing each over as it arrives; a model that fails is skipped. The
// scene asks for a planet's as it comes near (nearby.js)
export function loadModels(onModel, ids = null) {
  const loader = gltfLoader();
  return Promise.all(
    MODELS.filter(([id]) => !ids || ids.includes(id)).map(([id, url, spot]) =>
      loader
        .loadAsync(url)
        .then((g) => onModel(id, g.scene, spot))
        .catch(() => {}),
    ),
  );
}
