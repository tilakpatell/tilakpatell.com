// Ithilien and the Morgul Vale (the plan’s Task 28, on Hobbiton’s recipe):
// green woods and a stream, the Haradrim on their road below with two
// mûmakil walking in the column, Faramir and his rangers up out of the
// ferns, Henneth Annûn seen from behind its fall, the king at the Cross-
// roads, then the Vale: Minas Morgul’s walls brightening green, the beam
// going up from its tower, the Witch-king rising on his fell beast over the
// walls and the host marching out, as the Dawnless Day comes down; and far
// off west the beacons, lit one by one. This file only draws, each beat’s
// scene a function of where the walker is (`local`) and how long since the
// beat began (`since[id]`), so walking back puts it back.
//
//   build(ctx) → { group, update(local, dt, { since }), pose(id, at), dispose }
//   ctx: { road, heightAt, rt, tier }

import * as THREE from 'three';
import { walker } from '../../cast';
import { createTownKit } from '../../townKit';
import { addCirith } from '../../cirithKit';
import { createGollum } from '../../creatures/gollum';
import { createMumak } from '../../creatures/mumak';
import { PACE } from '../../creatures/mumak.rules';
import { lit } from '../../beacons';
import { witchKing } from '../../../towns/cirithungol/props';
import { marchColumn } from '../columns';
import { HARAD, HOST, buildProps } from './props';
import { BEATS } from './beats';

const MARKS = Object.fromEntries(BEATS.map((b) => [b.id, b]));
const RANGERS = [[2.6, 55], [-2.4, 56], [3.4, 51], [-3.2, 52]]; // [x, z]: Faramir first, out of the ferns round the three
const BEAM = [2, 7]; // s into the Vale’s beat: the beam from the tower’s top to the cloud
const RISE = [7, 15]; // s: the Witch-king up out of the city and over its walls
const STRIDE = 0.9; // the Haradrim’s marching pace, m/s

const smooth = (x) => {
  const k = Math.min(1, Math.max(0, x));
  return k * k * (3 - 2 * k);
};
const live = (t) => t != null && Number.isFinite(t);

export function build({ road, heightAt, rt, tier = 'high' }) {
  const group = new THREE.Group();
  group.name = 'stage:ithilien';
  const renderer = rt?.gfx?.renderer ?? null;
  const town = createTownKit(road, renderer, { wild: true });
  const cirith = addCirith(town, road, renderer);
  const props = buildProps({ K: town.K, road, heightAt, tier });
  group.add(props.group);

  const gollum = createGollum(road, renderer);
  group.add(gollum.group);
  // two mûmakil in the Haradrim’s column (on low, one)
  const mumakil = Array.from({ length: tier === 'low' ? 1 : 2 }, () => {
    const m = createMumak(road, { scale: 1 });
    group.add(m.group);
    return m;
  });
  // Faramir and his rangers, shown from their beat
  const rangers = RANGERS.slice(0, tier === 'low' ? 2 : 4).map(([x, z], i) => {
    // (Faramir’s men in his green: his figure again, not the Citadel’s winged guard)
    const w = walker('faramir', { rt, seed: 120 + i });
    w.group.visible = false;
    w.group.position.set(x, heightAt(x, z), z);
    // (facing the three on the path)
    w.group.rotation.y = Math.atan2(-x, 53 - z);
    group.add(w.group);
    return w;
  });
  // the Witch-king on his fell beast, over the city once the beam is up
  const wk = witchKing(town.K);
  wk.group.visible = false;
  wk.group.scale.setScalar(0.7);
  wk.group.traverse((o) => o.isMesh && (o.frustumCulled = false));
  group.add(wk.group);
  group.updateMatrixWorld(true);
  const top = props.morgul.group.localToWorld(props.morgul.top.clone());
  group.worldToLocal(top);

  let clock = 0;
  const seen = { since: {}, local: 0 };

  return {
    group,
    update(local, dt, { since = {} } = {}) {
      seen.since = since;
      seen.local = local;
      clock += dt;
      cirith.tick(clock);
      props.fall.tick(clock);

      // the Haradrim and their beasts on the road below, early in the stage
      const below = local < MARKS.henneth.at + 10;
      props.harad.visible = below;
      if (below) marchColumn(props.harad, { ...HARAD, speed: STRIDE }, heightAt, clock, { scale: 0.8 });
      mumakil.forEach((m, i) => {
        m.group.visible = below;
        if (!below) return;
        const z = HARAD.from[1] + ((clock * PACE + 30 + i * 34) % (HARAD.to[1] - HARAD.from[1]));
        m.group.position.set(HARAD.from[0] + (i ? 3 : -3), heightAt(HARAD.from[0], z), z);
        m.update(clock, PACE);
      });

      // the rangers up out of the ferns from their beat, gone past Henneth Annûn
      const r = since.rangers;
      const up = (live(r) || r === Infinity) && local < MARKS.henneth.at - 4;
      for (const w of rangers) {
        w.group.visible = up;
        if (!up) continue;
        w.set({ base: null, speed: 0 });
        w.tick(dt);
      }

      // the Vale: the walls brighten, the beam goes up, the Witch-king rises, the host comes out
      const v = since.vale;
      const t = v == null ? -1 : v === Infinity ? RISE[1] + 4 : v;
      const near = smooth((local - 96) / 14);
      const beam = smooth((t - BEAM[0]) / (BEAM[1] - BEAM[0])) * (local < MARKS.beacons.at + 4 ? 1 : 0);
      props.morgul.update(clock, { beam, glow: 0.4 + 0.6 * near });
      const k = smooth((t - RISE[0]) / (RISE[1] - RISE[0]));
      wk.group.visible = k > 0.01;
      if (wk.group.visible) {
        wk.group.position.set(top.x - k * 40, top.y - 6 + k * 14, top.z - k * 14);
        wk.group.rotation.y = Math.PI * 0.85;
        wk.animate(clock, { flap: 1, turn: Math.sin(clock * 0.4) * 0.4 });
      }
      props.host.visible = t > RISE[0] - 2;
      if (props.host.visible) marchColumn(props.host, { ...HOST, speed: 1.6 }, heightAt, Math.max(0, t), { scale: 0.8 });

      // the beacons, one by one
      const b = since.beacons;
      const n = lit(b == null ? null : b === Infinity ? 99 : b);
      props.beacons.forEach((f, i) => {
        f.visible = i < n;
        if (f.visible) f.scale.setScalar(6.5 + Math.sin(clock * 7 + i) * 0.6);
      });
    },
    // Gollum on the module’s place for him (the cast has no figure for him)
    pose(id, at) {
      if (id !== 'gollum') return null;
      gollum.at(at.x, at.y, at.z, clock, { pose: 'crawl' });
      return { hide: true };
    },
    dispose() {
      gollum.dispose();
      for (const m of mumakil) m.dispose();
      for (const w of rangers) w.dispose();
      wk.group.removeFromParent();
      wk.group.traverse((o) => o.geometry?.dispose());
      props.dispose();
      cirith.dispose();
      town.dispose();
      group.removeFromParent();
    },
  };
}

