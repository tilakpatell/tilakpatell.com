// A starfighter bot's mind: one of the game's squadron behaviour trees
// (`SquadronAIBehaviourBlueprint`, ai.squadron.json, the extractor's typed
// nodes and their children in the record's order) evaluated a tick at a
// time, for the fighters lane's flight model to fly. The node kinds:
//
//   Selector      the first child that does not fail, re-asked every tick
//   Sequence      its children in turn (ExitIfChildFails: one failing fails it; Loop: round again)
//   Random        a child drawn by its Weights, run to its end
//   Timed         its child for TimeToRun seconds
//   Loop, Turn, SideToSide   a manoeuvre for its Duration: Throttle and Pitch, Throttle and Yaw,
//                 a weave of OscillationFrequency
//   DogfightingAttack   the nearest enemy between MinDistanceForAttack and MaxDistanceForAttack
//                 (100 to 500 m), steered at its lead for ProjectileSpeed; fails otherwise
//   DogfightingEvade    an enemy within MaxTargeterDistance (125 m) with this fighter inside
//                 MaxTargeterAngle (75°) of its nose, on its tail if OnlyConsiderAttackersOnTail:
//                 its child (the weave and the random manoeuvres) runs; fails otherwise
//   DogfightingFlyForward  on ahead, AimAheadDistance in front: never fails
//   FollowWaypoints     the path's points in turn (LookAheadTime, MinLookAheadDistance); fails with none
//   ProximateAreas, EscapeAreas   back into the area it must keep to, out of one it must leave; fail otherwise
//
// Any other kind (formation flying, proximate waypoints, the scripted
// single-player nodes) fails and is counted once in `unreadNodes`. The
// tree's weapon rules fire while it attacks: the cannon (`CannonWeaponRule`)
// in bursts of MaxContinuousFireTime (2 s) at least MinTimeBetweenContinuousFire
// (1.5 s) apart, when its lead is inside FIRE_CONE; the missile
// (`MissileWeaponRule`) once its lock has been held LockOnDelayTime (3 s) at
// MinTargetDistance (50 m) or more. Pure: the world's queries are functions.
//
//   createSquadronMind(tree, { rand }) → mind
//   mind.tick(dt, world) → { throttle, pitch, yaw, roll, fire, missile, root }   (sticks in −1…1, throttle 0…1;
//     yaw > 0 turns toward cross(up, fwd), pitch > 0 toward up); mind.active: the leaf flown, mind.rootActive: the root's child
//   world: { self: { at, fwd, up, speed }, nearestEnemy() → { at, vel, fwd } | null, attackers() → [{ at, fwd }],
//            areas() → { keepIn?: { centre, radius }, avoid?: [{ centre, radius }] } | null, waypoints() → [[x, y, z]] | null }
//   DOGFIGHT: the tree a fighter flies by default        unreadNodes: Set of node kinds met and not flown

export const DOGFIGHT = 'PF_DogfightBehaviour';
// The cone the cannon fires inside and the missile locks inside, degrees, by hand.
export const FIRE_CONE = 10;
export const unreadNodes = new Set();

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const clamp = (v) => Math.max(-1, Math.min(1, v));
const DEG = 180 / Math.PI;
const angleTo = (self, p) => {
  const v = sub(p, self.at);
  const L = len(v);
  return L < 1e-6 ? 0 : Math.acos(Math.max(-1, Math.min(1, dot(v, self.fwd) / (L * (len(self.fwd) || 1))))) * DEG;
};

// the sticks that turn the fighter toward a point
function steer(self, p, throttle = 1) {
  const v = sub(p, self.at);
  const up = self.up ?? [0, 1, 0];
  const side = cross(up, self.fwd);
  const ahead = dot(v, self.fwd);
  return { throttle, yaw: clamp(Math.atan2(dot(v, side), ahead) / (Math.PI / 4)), pitch: clamp(Math.atan2(dot(v, up), Math.abs(ahead) + 1e-6) / (Math.PI / 4)), roll: 0 };
}

const lead = (self, t, speed) => {
  const d = len(sub(t.at, self.at));
  const k = speed > 0 ? d / speed : 0;
  const v = t.vel ?? [0, 0, 0];
  return [t.at[0] + v[0] * k, t.at[1] + v[1] * k, t.at[2] + v[2] * k];
};

const ok = (status, cmd = null, leaf = null) => ({ status, cmd, leaf });

export function createSquadronMind(tree, { rand = Math.random } = {}) {
  const state = new Map();
  const st = (id) => (state.has(id) ? state.get(id) : state.set(id, {}).get(id));
  const reset = (id) => {
    state.delete(id);
    for (const c of tree.nodes[id]?.children ?? []) reset(c);
  };
  let attacking = null;

  function run(id, dt, w) {
    const n = tree.nodes[id];
    const s = st(id);
    const self = w.self;
    switch (n.kind) {
      case 'Selector': {
        for (const c of n.children) {
          const r = run(c, dt, w);
          if (r.status === 'failure') continue;
          if (s.on != null && s.on !== c) reset(s.on);
          s.on = c;
          return r;
        }
        return ok('failure');
      }
      case 'Sequence': {
        s.i ??= 0;
        for (let guard = 0; guard <= n.children.length; guard++) {
          if (s.i >= n.children.length) {
            if (!n.loop) {
              reset(id);
              return ok('success');
            }
            s.i = 0;
          }
          const r = run(n.children[s.i], dt, w);
          if (r.status === 'running') return r;
          if (r.status === 'failure' && n.exitIfChildFails) {
            reset(id);
            return r;
          }
          s.i++;
        }
        return ok('running');
      }
      case 'Random': {
        if (s.pick == null) {
          const ws = n.children.map((_, i) => n.weights?.[i] ?? 1);
          let x = rand() * ws.reduce((a, b) => a + b, 0);
          s.pick = n.children.length - 1;
          for (let i = 0; i < ws.length; i++) if ((x -= ws[i]) < 0) {
            s.pick = i;
            break;
          }
        }
        const r = run(n.children[s.pick], dt, w);
        if (r.status !== 'running') reset(id);
        return r;
      }
      case 'Timed': {
        s.t = (s.t ?? 0) + dt;
        const r = n.children.length ? run(n.children[0], dt, w) : ok('running');
        if (s.t >= n.timeToRun) {
          reset(id);
          return ok('success', r.cmd, r.leaf);
        }
        if (r.status !== 'running') reset(id);
        return r;
      }
      case 'Loop':
      case 'Turn':
      case 'SideToSide': {
        s.t = (s.t ?? 0) + dt;
        const cmd = { throttle: n.throttle ?? 1, pitch: n.kind === 'Loop' ? n.pitch : 0, yaw: n.kind === 'Turn' ? n.yaw : n.kind === 'SideToSide' ? Math.sin(2 * Math.PI * (n.oscillationFrequency ?? 0.2) * s.t) : 0, roll: 0 };
        if (s.t >= n.duration) {
          reset(id);
          return ok('success', cmd, n.kind);
        }
        return ok('running', cmd, n.kind);
      }
      case 'DogfightingFlyForward': {
        const ahead = n.aimAheadDistance ?? 30;
        return ok('running', steer(self, [self.at[0] + self.fwd[0] * ahead, self.at[1] + self.fwd[1] * ahead, self.at[2] + self.fwd[2] * ahead]), n.kind);
      }
      case 'DogfightingAttack': {
        const t = w.nearestEnemy?.() ?? null;
        const d = t ? len(sub(t.at, self.at)) : Infinity;
        if (!t || d < n.minDistanceForAttack || d > n.maxDistanceForAttack) return ok('failure');
        const p = lead(self, t, n.projectileSpeed);
        attacking = { target: t, point: p, d };
        return ok('running', steer(self, p), n.kind);
      }
      case 'DogfightingEvade': {
        const threat = (w.attackers?.() ?? []).some((a) => {
          const v = sub(self.at, a.at);
          const d = len(v);
          if (d > n.maxTargeterDistance || d < 1e-6) return false;
          const inCone = Math.acos(Math.max(-1, Math.min(1, dot(v, a.fwd) / (d * (len(a.fwd) || 1))))) * DEG <= n.maxTargeterAngle;
          const onTail = !n.onlyConsiderAttackersOnTail || dot(sub(a.at, self.at), self.fwd) < 0;
          return inCone && onTail;
        });
        if (!threat && !(s.busy && n.allowChildToComplete)) {
          reset(id);
          return ok('failure');
        }
        s.busy = true;
        const r = n.children.length ? run(n.children[0], dt, w) : ok('running', steer(self, [self.at[0] + self.fwd[0], self.at[1], self.at[2] + self.fwd[2]]), n.kind);
        if (r.status !== 'running') s.busy = false;
        return ok('running', r.cmd, r.leaf);
      }
      case 'FollowWaypoints': {
        const pts = w.waypoints?.();
        if (!pts?.length) return ok('failure');
        s.i ??= 0;
        const reach = Math.max(n.minLookAheadDistance ?? 1, (self.speed ?? 0) * (n.lookAheadTime ?? 1));
        while (s.i < pts.length - 1 && len(sub(pts[s.i], self.at)) <= reach) s.i++;
        return ok('running', steer(self, pts[s.i]), n.kind);
      }
      case 'ProximateAreas': {
        const a = w.areas?.()?.keepIn;
        if (!a || len(sub(self.at, a.centre)) <= a.radius) return ok('failure');
        return ok('running', steer(self, a.centre), n.kind);
      }
      case 'EscapeAreas': {
        const a = (w.areas?.()?.avoid ?? []).find((z) => len(sub(self.at, z.centre)) < z.radius);
        if (!a) return ok('failure');
        const out = sub(self.at, a.centre);
        return ok('running', steer(self, [self.at[0] + out[0], self.at[1] + out[1], self.at[2] + out[2]]), n.kind);
      }
      default:
        unreadNodes.add(n.kind);
        return ok('failure');
    }
  }

  const cannonRule = tree.rules?.find((r) => r.kind === 'CannonWeaponRule') ?? null;
  const missileRule = tree.rules?.find((r) => r.kind === 'MissileWeaponRule') ?? null;
  const gun = { firing: 0, rest: 0, lock: 0 };

  const mind = {
    active: null,
    rootActive: null,
    tick(dt, w) {
      attacking = null;
      const r = run(tree.root, dt, w);
      const root = tree.nodes[tree.root];
      const on = root.kind === 'Selector' ? st(tree.root).on : tree.root;
      mind.rootActive = on != null ? tree.nodes[on].kind : null;
      mind.active = r.leaf;
      const cmd = { throttle: 1, pitch: 0, yaw: 0, roll: 0, ...(r.cmd ?? {}), fire: false, missile: false, root: mind.rootActive };
      // the weapon rules, while the tree attacks
      const aimed = attacking && angleTo(w.self, attacking.point) <= FIRE_CONE;
      if (gun.rest > 1e-9) gun.rest -= dt;
      else if (cannonRule && aimed) {
        cmd.fire = true;
        gun.firing += dt;
        if (gun.firing >= cannonRule.maxContinuousFireTime - 1e-9) {
          gun.firing = 0;
          gun.rest = cannonRule.minTimeBetweenContinuousFire;
        }
      } else if (gun.firing > 0 && !aimed) {
        gun.firing = 0;
        gun.rest = cannonRule?.minTimeBetweenContinuousFire ?? 0;
      }
      const lockable = aimed && (!missileRule?.useMinTargetDistance || attacking.d >= missileRule.minTargetDistance);
      if (missileRule && lockable) {
        if (gun.lock >= missileRule.lockOnDelayTime - 1e-9) {
          cmd.missile = true;
          gun.lock = 0;
        } else gun.lock += dt;
      } else gun.lock = 0;
      return cmd;
    },
  };
  return mind;
}
