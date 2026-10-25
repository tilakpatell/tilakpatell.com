// The Battle of Hoth's set pieces (The Empire Strikes Back):
// - Echo Base's ion cannon fires on Death Squadron: two great blue bolts
//   every twenty seconds or so, and the Star Destroyer they hit is disabled a
//   while (battle.js's disable: its guns quiet, its hull and objectives
//   open to it). It's the Rebellion's gun, so it fires only while the light
//   side holds Hoth; with the Empire holding it, it's quiet.
// - When it's the Empire attacking (the war's defence of Hoth), the GR-75
//   transports run from the base for the jump, one after another (Hoth's an
//   evacuation: battles.js's BATTLE_KINDS, the battle's own runners), and
//   the Empire's fighters go after them: this calls each one out, and the
//   evacuation done when enough are. (Their markers are the battle scene's,
//   as every battle's runners are.)
//
// In the battle every pilot shares (the Empire attacking: the films' plan,
// pinned, galaxy/battlePlans.js), the cannon is the first stage's objective:
// a target while that stage is open, its hp and its fall the director's
// (ctx.objective), and quiet for good once it's down.
//
// createHoth(ctx) → { update(dt, t, live, events), hit, targets, markers(live), dispose() }

import * as THREE from 'three';
import { sweptHit } from '../../../lib/combat/flight/targeting';
import { GCW, seeded } from '../gcw';
import { SIDES } from '../sides';

const REBELS = 0;
export const HOTH = {
  ionEvery: [16, 26], // seconds between the cannon's shots
  ionFor: 18, // seconds a Star Destroyer's disabled
  ionSpeed: 110,
};
const v = (x, y, z) => ({ x, y, z });
const ZERO = { x: 0, y: 0, z: 0 };

export function createHoth(ctx) {
  const { battle, sys } = ctx;
  const rand = seeded(`${ctx.on.id}-hoth`);
  const R = sys.body.r;
  const cannonPiece = sys.pieces.find((p) => p.type === 'cannon');
  const base = cannonPiece ? cannonPiece.from : [0, R, 0];
  const bl = Math.hypot(...base) || 1;
  const baseDir = v(base[0] / bl, base[1] / bl, base[2] / bl);
  const cannon = v(baseDir.x * (R + 0.6), baseDir.y * (R + 0.6), baseDir.z * (R + 0.6));

  // ── the ion cannon's bolts: two glowing slugs in flight ──
  const geo = new THREE.SphereGeometry(1, 12, 8);
  const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 2.4, 5), toneMapped: false, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const slugs = [0, 1].map(() => {
    const m = new THREE.Mesh(geo, mat);
    m.visible = false;
    m.scale.set(0.9, 0.9, 4);
    ctx.scene?.add(m);
    return { m, on: false, from: v(0, 0, 0), target: null, t: 0, dur: 1 };
  });
  let nextIon = 6 + rand() * 6;
  let ions = 0;
  // (Echo Base held by the light side: the defender's stance, or the Rebellion's team for a battle of the old shape)
  const held = ctx.on?.sides ? SIDES[ctx.on.sides[battle.defender]]?.stance === 'light' : battle.defender === REBELS;

  // (the plan's cannon, if it's the battle every pilot shares)
  const gun = () => ctx.objective?.('ion-cannon') ?? null;
  const shared = Boolean(gun());
  const gunTgt = { id: 5.4e6, at: cannon, vel: ZERO, size: 2.4, kind: 'cannon', name: 'Echo Base’s ion cannon', hp: 0, hpMax: 0, threat: 0 };

  // ── the transports (the battle's runners) ──
  let out = 0;
  let done = false;

  const shootIon = () => {
    const foes = battle.capitals.filter((c) => c.team === battle.attacker && c.alive && c.dying <= 0 && c.disabled <= 0 && !c.gone);
    if (!foes.length) return;
    const flag = foes.find((c) => c.role === 'flagship');
    const target = flag && rand() < 0.4 ? flag : foes[Math.floor(rand() * foes.length)];
    slugs.forEach((s, k) => {
      s.on = true;
      s.from = v(cannon.x, cannon.y, cannon.z);
      s.target = target;
      s.t = -k * 0.3; // (the second a moment behind the first)
      const d = Math.hypot(target.pos.x - cannon.x, target.pos.y - cannon.y, target.pos.z - cannon.z);
      s.dur = d / HOTH.ionSpeed;
    });
    ctx.draw?.flash(cannon, { size: 6, life: 0.6, color: [1, 1.8, 3.4] });
    if (ions++ % 3 === 0) ctx.event('ion');
  };

  return {
    update(dt, t, live, events) {
      for (const e of events) {
        if (e.type === 'escaped' && e.kind === 'transport' && !done) {
          out += 1;
          ctx.event('escaped');
          if (ctx.tookPart()) ctx.points(1);
        } else if (e.type === 'over' && e.why === 'runners' && e.winner === REBELS && !done) {
          done = true;
          ctx.event('gcw-evacuated');
          if (ctx.tookPart()) ctx.points(GCW.points.objective);
        }
      }
      if (battle.over) return {};
      // the cannon (Echo Base's, while it's the light side's, and standing)
      if (held && !(shared && gun()?.down)) nextIon -= dt;
      if (nextIon <= 0) {
        nextIon = HOTH.ionEvery[0] + rand() * (HOTH.ionEvery[1] - HOTH.ionEvery[0]);
        shootIon();
      }
      for (const s of slugs) {
        if (!s.on) continue;
        s.t += dt;
        if (s.t < 0) continue;
        const k = Math.min(1, s.t / s.dur);
        const tp = s.target.pos;
        s.m.visible = true;
        s.m.position.set(s.from.x + (tp.x - s.from.x) * k, s.from.y + (tp.y - s.from.y) * k, s.from.z + (tp.z - s.from.z) * k);
        s.m.lookAt(tp.x, tp.y, tp.z);
        if (k >= 1) {
          s.on = false;
          s.m.visible = false;
          battle.disable(s.target.id, HOTH.ionFor);
          ctx.draw?.flash(tp, { size: 10, life: 1.1, color: [1, 1.8, 3.4] });
        }
      }
      return {};
    },
    // your shot on the cannon, while its stage is open (shared)
    hit(from, to, damage) {
      const g = shared ? gun() : null;
      if (!g?.open || g.down || sweptHit(from, to, cannon, cannon, gunTgt.size) === null) return null;
      ctx.mine('ion-cannon', damage);
      return { id: gunTgt.id, kind: 'cannon', at: { ...cannon }, size: 1, down: Boolean(gun()?.down), sub: 'ion-cannon' };
    },
    get targets() {
      const g = shared ? gun() : null;
      if (!g?.open || g.down) return [];
      gunTgt.hp = g.hp;
      gunTgt.hpMax = g.hpMax;
      return [gunTgt];
    },
    // the cannon, while it stands (the transports are marked with every battle's runners: battleScene.js)
    markers(live) {
      const g = shared ? gun() : null;
      if (!g || g.down || !live || battle.over || Math.hypot(live.x - cannon.x, live.y - cannon.y, live.z - cannon.z) > 900) return [];
      const attack = battle.you.team === battle.attacker;
      return [{ key: 'ion-cannon', pos: cannon, title: `${attack ? 'Destroy' : 'Defend'}: Echo Base’s ion cannon`, hp: g.hp / g.hpMax, colour: attack ? '#ffb347' : '#7cc8ff' }];
    },
    get out() {
      return out;
    },
    dispose() {
      for (const s of slugs) s.m.removeFromParent();
      geo.dispose();
      mat.dispose();
    },
  };
}
