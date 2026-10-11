// A starfighter on the game's handling (Star Wars Battlefront II, 2017: each
// air vehicle's `_Handling` layer, read into src/data/bf2017/air.json by
// scripts/lib/bf2017-rulebook-air.mjs). Pure: a quaternion, a velocity and
// a few rates, stepped by the stick; the mission's ships and the bots'
// commands drive it (the sixth design's lane fighters, task 2).
//
// createStarfighter(row) → { state, step(input, dt) → state }, `row` the
// rulebook's vehicle (its `handling`), `input` { throttle 0…1, boost,
// pitch, yaw, roll −1…1, zoom }:
//
// - Speed: the throttle sets a speed between the record's MinSpeed and
//   MaxSpeed, reached at EngineAccelerationRate (m/s²) and left at
//   EngineDecelerationRate; boost takes it to BoostMaxSpeed at
//   BoostEngineAccelerationRate. Never past either cap.
// - Turning: AxisTurnRates (degrees a second: x the pitch, y the yaw, z the
//   roll, as the game's vehicle frame names them; the zoomed set while
//   zoomed), each times TurnRateBySpeedCurve at the speed over MaxSpeed (the
//   X-wing turns at 0.85 of its rate at its top speed), the nose down at
//   PitchDownScale of the nose up. Each axis eases to what the stick asks
//   at its SteerRates (a second's fraction, ×dt); let go, the yaw and the
//   roll die away over YawRollDampingTime.
// - The roll: its ease is held back by RollRateByRollAngVelCurve at the
//   rate it already has (radians a second: full at rest, none at 6), and a
//   roll slower than RollAngularVelocityDeadzone with the stick let go
//   stops.
// - The fake roll: the yaw stick banks the ship for show toward
//   TargetFakeRollAngle at FakeRollAccFromYawInput (degrees a second, a
//   second), never faster than FakeRollMaxAngVel, and never past the angle.
// - The self-right: with every stick under its SelfRightTimerMinimum… input
//   for SelfRightTimerActivationDelay, the ship rolls back level toward the
//   world's up, SelfRightStrength of the way each thirtieth of a second.
//
// What the records hold that this leaves to the game's physics (the
// torques, the drift forces, the airbrake): listed in the rulebook, unused.
// A row with no handling throws.

const DEG = Math.PI / 180;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const clamp01 = (v) => clamp(v, 0, 1);

// ── the game's FloatCurve: cubic Bézier segments through its points, each
// with the point's out-tangent and the next one's in-tangent as offsets ──

function bezier(p0, p1, p2, p3, t) {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
}

export function curveAt(curve, x) {
  if (!curve?.points?.length) return 1;
  const pts = curve.points;
  if (x <= pts[0][0]) return pts[0][1];
  const last = pts[pts.length - 1];
  if (x >= last[0]) return last[1];
  const i = pts.findIndex((p, k) => k > 0 && x <= p[0]) - 1;
  const [x0, y0, , , ox, oy] = pts[i];
  const [x1, y1, ix, iy] = pts[i + 1];
  const kind = curve.kinds?.[i] ?? 'smooth';
  if (kind === 'constant') return y0;
  if (kind === 'linear') return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  // (x along the segment is monotone for the game's curves: find t by halving)
  const cx1 = clamp(x0 + ox, x0, x1);
  const cx2 = clamp(x1 + ix, x0, x1);
  let lo = 0;
  let hi = 1;
  for (let k = 0; k < 30; k++) {
    const mid = (lo + hi) / 2;
    if (bezier(x0, cx1, cx2, x1, mid) < x) lo = mid;
    else hi = mid;
  }
  return bezier(y0, y0 + oy, y1 + iy, y1, (lo + hi) / 2);
}

// ── quaternions [x, y, z, w] ──

export function rotate([x, y, z, w], [vx, vy, vz]) {
  const tx = 2 * (y * vz - z * vy);
  const ty = 2 * (z * vx - x * vz);
  const tz = 2 * (x * vy - y * vx);
  return [vx + w * tx + (y * tz - z * ty), vy + w * ty + (z * tx - x * tz), vz + w * tz + (x * ty - y * tx)];
}

function multiply([ax, ay, az, aw], [bx, by, bz, bw]) {
  return [aw * bx + ax * bw + ay * bz - az * by, aw * by - ax * bz + ay * bw + az * bx, aw * bz + ax * by - ay * bx + az * bw, aw * bw - ax * bx - ay * by - az * bz];
}

function normalise(q) {
  const l = Math.hypot(...q) || 1;
  return q.map((v) => v / l);
}

// a turn of `angle` radians about the ship's own axis `axis` (local), after `q`
function turnLocal(q, axis, angle) {
  const s = Math.sin(angle / 2);
  return multiply(q, [axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(angle / 2)]);
}

// The ship's frame: its nose +z, its top +y, and so (right-handed) its right
// wing −x. Nose up is a turn about the right wing, nose right one about the
// top the other way, roll right one about the nose.
const NOSE = [0, 0, 1];
const TOP = [0, 1, 0];
const RIGHT = [-1, 0, 0];

export const noseOf = (q) => rotate(q, NOSE);
export const topOf = (q) => rotate(q, TOP);
export const rightOf = (q) => rotate(q, RIGHT);

// the bank: how far the ship's top is rolled from the world's up about its nose (radians, right wing down +)
export function bankOf(q) {
  const top = topOf(q);
  const right = rightOf(q);
  return Math.atan2(-right[1], top[1]);
}

// ── the handling ──

export function handlingOf(row) {
  const h = row?.handling ?? row;
  if (!h?.maxSpeed) throw new Error(`${row?.id ?? 'a starfighter'}: no handling`);
  return h;
}

// how fast the stick at full turns the ship at `speed`, in degrees a second: [pitch, yaw, roll]
export function turnRatesAt(row, speed, zoom = false) {
  const h = handlingOf(row);
  const k = curveAt(h.turnRateBySpeedCurve, speed / h.maxSpeed);
  return (zoom ? h.axisTurnRatesZoomed : h.axisTurnRates).map((r) => r * k);
}

export const topSpeed = (row, boost = false) => (boost ? handlingOf(row).boostMaxSpeed : handlingOf(row).maxSpeed);

export function createStarfighter(row, { at = [0, 0, 0], quat = [0, 0, 0, 1], speed = null } = {}) {
  const h = handlingOf(row);
  const state = {
    at: [...at],
    quat: [...quat],
    speed: speed ?? h.minSpeed,
    vel: [0, 0, 0],
    rates: [0, 0, 0], // degrees a second: pitch, yaw, roll
    fakeRoll: 0, // degrees, for the model and the camera
    fakeRollRate: 0,
    still: 0, // seconds every stick has been under the self-right's minimums
    boosting: false,
  };
  state.vel = noseOf(state.quat).map((v) => v * state.speed);

  function step(input = {}, dt) {
    const throttle = clamp01(input.throttle ?? 0);
    const pitch = clamp(input.pitch ?? 0, -1, 1);
    const yaw = clamp(input.yaw ?? 0, -1, 1);
    const roll = clamp(input.roll ?? 0, -1, 1);
    const boost = Boolean(input.boost);
    const zoom = Boolean(input.zoom);

    // the speed
    const want = boost ? h.boostMaxSpeed : h.minSpeed + (h.maxSpeed - h.minSpeed) * throttle;
    const cap = boost ? h.boostMaxSpeed : h.maxSpeed;
    if (state.speed < want) state.speed = Math.min(want, state.speed + (boost ? h.boostEngineAccelerationRate : h.engineAccelerationRate) * dt);
    else state.speed = Math.max(want, state.speed - h.engineDecelerationRate * dt);
    state.speed = clamp(state.speed, 0, cap);
    state.boosting = boost;

    // the turn rates the stick asks for, at this speed
    const [rp, ry, rr] = turnRatesAt(h, state.speed, zoom);
    const target = [pitch * rp * (pitch < 0 ? h.pitchDownScale : 1), yaw * ry, roll * rr];
    const steer = zoom ? h.steerRatesZoomed : h.steerRates;
    // (the pitch eases to its rate; the yaw and the roll too while held, and die away over the damping time let go)
    state.rates[0] += (target[0] - state.rates[0]) * clamp01(steer[0] * dt);
    const damp = clamp01(dt / Math.max(1e-3, h.yawRollDampingTime));
    state.rates[1] += (target[1] - state.rates[1]) * (yaw ? clamp01(steer[1] * dt) : damp);
    const rollHold = curveAt(h.rollRateByRollAngVelCurve, Math.abs(state.rates[2] * DEG));
    const toward = roll ? clamp01(steer[2] * dt) * Math.max(rollHold, Math.sign(target[2]) !== Math.sign(state.rates[2]) ? 1 : 0) : damp;
    state.rates[2] += (target[2] - state.rates[2]) * toward;
    if (!roll && Math.abs(state.rates[2] * DEG) < h.rollAngularVelocityDeadzone) state.rates[2] = 0;
    for (let k = 0; k < 3; k++) state.rates[k] = clamp(state.rates[k], -[rp, ry, rr][k], [rp, ry, rr][k]);

    // the self-right: every stick let go for the timer's delay
    const still = Math.abs(roll) < h.selfRightTimerMinimumRollInput && Math.abs(yaw) < h.selfRightTimerMinimumYawInput && Math.abs(pitch) < h.selfRightTimerMinimumPitchInput;
    state.still = still ? state.still + dt : 0;

    let q = state.quat;
    q = turnLocal(q, RIGHT, state.rates[0] * DEG * dt);
    q = turnLocal(q, TOP, -state.rates[1] * DEG * dt);
    q = turnLocal(q, NOSE, state.rates[2] * DEG * dt);
    if (state.still >= h.selfRightTimerActivationDelay) {
      const bank = bankOf(q);
      const level = 1 - (1 - h.selfRightStrength) ** (dt * 30);
      q = turnLocal(q, NOSE, -bank * level);
    }
    state.quat = normalise(q);

    // the fake roll: banked toward the yaw stick's share of the target angle, no faster than its cap
    const bankTo = yaw * h.targetFakeRollAngle;
    const gap = bankTo - state.fakeRoll;
    state.fakeRollRate = clamp(state.fakeRollRate + Math.sign(gap) * h.fakeRollAccFromYawInput * dt, -h.fakeRollMaxAngVel, h.fakeRollMaxAngVel);
    if (Math.sign(state.fakeRollRate) !== Math.sign(gap)) state.fakeRollRate = Math.sign(gap) * Math.min(Math.abs(state.fakeRollRate), h.fakeRollMaxAngVel);
    const move = state.fakeRollRate * dt;
    state.fakeRoll = Math.abs(move) >= Math.abs(gap) ? bankTo : state.fakeRoll + move;
    if (state.fakeRoll === bankTo) state.fakeRollRate = 0;

    // flown along its nose
    state.vel = noseOf(state.quat).map((v) => v * state.speed);
    state.at = state.at.map((v, k) => v + state.vel[k] * dt);
    return state;
  }

  return { state, step };
}
