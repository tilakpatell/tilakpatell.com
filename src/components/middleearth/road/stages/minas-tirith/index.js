// The White City (the plan’s Task 31): Minas Tirith is the Minas Tirith
// chapter’s own city (towns/minastirith/props.js’s kit: its seven walls,
// its houses and lanterns, the prow, the Citadel, the Tower of Ecthelion)
// on its knee of Mindolluin, turned to face down the road (place.js); the
// company walks the Pelennor and the causeway up to the Great Gate and in,
// and then the Court of the Fountain: the King before the White Tree in
// flower, the company with him, the four before him. They bow (the deed),
// and are stopped: he and all the court bow to them. This file only draws,
// each beat’s scene a function of where the walker is (`local`) and how
// long since the beat began (`since[id]`), so walking back puts it back.
//
// The city stands well past the stage’s end, over the next stage’s land:
// it is shown only while this stage is current (leave() hides it).
//
//   build(ctx) → { group, update(local, dt, { since }), floor(x, z), pose(id, at), leave(), dispose }
//   ctx: { rt, tier, weather }

import * as THREE from 'three';
import { createMinasKit } from '../../../towns/minastirith/props';
import { dress, rolesFor } from '../../../../../lib/three/coreNodes';
import { COURT_Y, TREE } from '../../../towns/minastirith/layout';
import { BEATS } from './beats';
import { CITY, COURT, floorAt } from './place';

const MARKS = Object.fromEntries(BEATS.map((b) => [b.id, b]));
const BOWED = MARKS.court.deed.at + 1.4; // s into the Court: the line said, the court bows to the four
const KING = ['aragorn', 'arwen', 'gandalfwhite', 'legolas', 'gimli'];
// the chapter's stone lit by the Road's light reads grey, not white: lifted
const WHITE = { wall: 1.3, trim: 1.25, paving: 1.25, court: 1.2, road: 1.15, house: 1.2, houseRoof: 1.1, slate: 1.1, rock: 1.25 };
const BLOOM = 0.55; // the Tree in flower as they come; full once the court bows
const SOFT = /water|fall|banner|lamp|glass|pane|fountain/i;

const live = (t) => t != null && Number.isFinite(t);
const smooth = (x) => {
  const k = Math.min(1, Math.max(0, x));
  return k * k * (3 - 2 * k);
};

export function build({ rt, tier = 'high', weather = null }) {
  const group = new THREE.Group();
  group.name = 'stage:minas-tirith';
  const renderer = rt?.gfx?.renderer ?? null;
  const kit = createMinasKit(renderer, { tier });
  for (const [k, lift] of Object.entries(WHITE)) kit.mats[k]?.color?.multiplyScalar(lift);
  // (its stone, paving, wood and iron in the site's photo scans, as the chapter dresses them:
  // undressed, the White City was plain colour, wall and street alike)
  dress(kit.mats ?? {}, rolesFor(kit.mats ?? {}), { strength: 0.3, normal: 0.6, keep: true, tier }).catch(() => {});

  // the city, turned to face down the road, and the Tree in its Court
  const city = kit.city();
  city.group.position.set(...CITY.at);
  city.group.rotation.y = CITY.turn;
  const tree = kit.tree();
  tree.group.position.set(TREE.x, COURT_Y, TREE.z);
  tree.set(BLOOM);
  city.group.add(tree.group);
  // (its stone stands solid: the walkers keep to the gate, the camera out of the walls;
  // and it casts no shadow into the Road's cascades: its houses' node material reads
  // the material's own colour, which the cascades' depth pass hasn't, and the frame
  // fails. It is mostly past the cascades' 60 m anyway; it still takes the shadow)
  city.group.traverse((o) => {
    o.castShadow = false;
    if (o.isMesh && !SOFT.test(o.name) && !SOFT.test(o.material?.name ?? '')) o.userData.solid = true;
  });
  group.add(city.group);

  let clock = 0;
  let petals = null;
  const seen = { since: {}, local: 0 };
  const at = (id) => (KING.includes(id) ? (id === 'aragorn' ? COURT.aragorn : COURT.company[id]) : COURT.hobbits[id]);
  // (in the Court: from its cut to the stage's end)
  const inCourt = () => live(seen.since.court) && seen.local >= MARKS.court.at - 0.5;

  const stopPetals = () => {
    petals?.stop?.();
    petals = null;
  };

  return {
    group,
    update(local, dt, { since = {} } = {}) {
      seen.since = since;
      seen.local = local;
      clock += dt;
      city.group.visible = true;
      kit.tick(clock);
      // the Tree comes into flower as the court bows
      const c = since.court;
      tree.set(c == null ? BLOOM : c === Infinity ? 1 : BLOOM + (1 - BLOOM) * smooth((c - BOWED) / 4));
      // petals from it over the Court once it does
      const falling = live(c) && c > BOWED && inCourt();
      if (falling && !petals) {
        petals = weather?.kind?.('motes', { count: tier === 'low' ? 60 : 160, box: [10, 6, 10], scale: 1 }) ?? null;
        petals?.at?.(COURT.tree[0], COURT.y + 4, COURT.tree[2] - 2);
      } else if (!falling && petals) stopPetals();
    },
    // up the causeway and in through the gate on the city's own road
    floor: (x, z) => floorAt(x, z),
    // in the Court: each where the crowning has them, the King's side bowed once the four have
    pose(id) {
      const place = at(id);
      if (!place || !inCourt()) return null;
      const t = seen.since.court;
      const bowed = t === Infinity || t > BOWED;
      const king = KING.includes(id);
      return { x: place[0], y: COURT.y, z: place[1], yaw: king ? Math.PI : 0, base: king && bowed ? 'kneel.fix' : 'idle', speed: 0 };
    },
    leave() {
      city.group.visible = false;
      stopPetals();
    },
    dispose() {
      stopPetals();
      const done = new Set();
      group.traverse((o) => {
        o.geometry?.dispose();
        for (const m of [o.material].flat()) {
          if (!m || done.has(m)) continue;
          done.add(m);
          m.dispose();
        }
      });
      for (const t of Object.values(kit.tex)) t?.dispose?.();
      group.removeFromParent();
    },
  };
}
