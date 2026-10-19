// The director: where the camera stands and looks each frame, the films’
// grammar as rigs (the design’s §4.2). Pure.
//
//   pose(ctx) → { at, lookAt, fov, roll, dof }
//     ctx: { rig, params, lead: { at, heading }, tangent, metres, look: { yaw, pitch },
//            mode, reduced, heightAt(x, z) → y, t (seconds in the rig) }
//   ease(from, to, k) → pose      (the blend between two rigs’ poses, k already eased)
//   settleLook(look, dt) → look   (a look let go goes back to the middle over 2 s)
//
// `heading` is the yaw from +z (atan2(x, z)); the right of a lead walking
// +z is −x. The visitor’s look is added on top of the rig’s framing, never
// instead, and clamped; the camera is kept 0.4 m over the ground.

export const RIGS = ['follow', 'lead', 'side', 'low', 'crane', 'wide', 'seat', 'ride'];
export const LOOK_LIMIT = { yaw: 0.96, pitch: 0.44, seat: 0.35 }; // ±55°, ±25°, ±20°
export const FOV = { walk: 50, seat: 38, eagle: 62 };
const CLEAR = 0.4; // m over the ground at least
const EYE = 1; // m: the height on a walker the rigs look at
const LOW_TILT = (20 * Math.PI) / 180;
const CRANE_TOP = 30;
const SETTLE = 2; // 1/s: e^-4 of a look is left after two seconds

const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const clamp = (v, m) => Math.min(m, Math.max(-m, v));
const smooth = (x) => {
  const k = Math.min(1, Math.max(0, x));
  return k * k * (3 - 2 * k);
};

function framing({ rig, params = {}, lead, tangent, t = 0 }) {
  const h = lead.heading;
  const f = [Math.sin(h), 0, Math.cos(h)];
  const right = [-Math.cos(h), 0, Math.sin(h)];
  const eye = add(lead.at, [0, EYE, 0]);
  const follow = () => ({ at: add(add(lead.at, f, -3.2), [0, 1.7, 0]), lookAt: add(eye, tangent, 6) });
  switch (rig) {
    case 'lead':
      return { at: add(add(lead.at, f, 4), [0, 1.5, 0]), lookAt: eye };
    case 'side':
      return { at: add(add(lead.at, right, 4), [0, 1.4, 0]), lookAt: eye };
    case 'low': {
      const at = add(add(lead.at, f, -2), [0, 0.5, 0]);
      return { at, lookAt: add(at, [f[0] * Math.cos(LOW_TILT), Math.sin(LOW_TILT), f[2] * Math.cos(LOW_TILT)], 10) };
    }
    case 'crane': {
      const from = follow();
      const k = smooth(t / (params.seconds ?? 8));
      return { at: [from.at[0], from.at[1] + (lead.at[1] + CRANE_TOP - from.at[1]) * k, from.at[2]], lookAt: from.lookAt };
    }
    case 'wide':
    case 'seat':
      return { at: [...params.at], lookAt: [...params.lookAt] };
    case 'ride': {
      const [ox, oy, oz] = params.offset ?? [0, 2, -1];
      const at = add(lead.at, [ox * Math.cos(h) + oz * Math.sin(h), oy, -ox * Math.sin(h) + oz * Math.cos(h)]);
      return { at, lookAt: add(at, f, 10) };
    }
    default:
      return follow();
  }
}

// the look on top: the rig’s direction turned by yaw about up and tilted by pitch
function looked(at, lookAt, yaw, pitch) {
  if (!yaw && !pitch) return lookAt;
  const d = [lookAt[0] - at[0], lookAt[1] - at[1], lookAt[2] - at[2]];
  const dist = Math.hypot(...d) || 1;
  const az = Math.atan2(d[0], d[2]) + yaw;
  const el = Math.min(1.5, Math.max(-1.5, Math.asin(d[1] / dist) + pitch));
  return [at[0] + Math.sin(az) * Math.cos(el) * dist, at[1] + Math.sin(el) * dist, at[2] + Math.cos(az) * Math.cos(el) * dist];
}

export function pose(ctx) {
  const { rig, mode, look = { yaw: 0, pitch: 0 }, heightAt } = ctx;
  const { at, lookAt } = framing(ctx);
  const seat = rig === 'seat';
  const yaw = clamp(look.yaw, seat ? LOOK_LIMIT.seat : LOOK_LIMIT.yaw);
  const pitch = clamp(look.pitch, seat ? LOOK_LIMIT.seat : LOOK_LIMIT.pitch);
  const floor = (heightAt?.(at[0], at[2]) ?? -Infinity) + CLEAR;
  const lifted = at[1] < floor ? floor - at[1] : 0;
  const stand = [at[0], at[1] + lifted, at[2]];
  const aim = looked(stand, [lookAt[0], lookAt[1] + lifted, lookAt[2]], yaw, pitch);
  const fov = seat ? FOV.seat : mode === 'eagle' ? FOV.eagle : FOV.walk;
  return { at: stand, lookAt: aim, fov, roll: 0, dof: seat || rig === 'low' };
}

const mix = (a, b, k) => a + (b - a) * k;
const mix3 = (a, b, k) => [mix(a[0], b[0], k), mix(a[1], b[1], k), mix(a[2], b[2], k)];

export function ease(from, to, k) {
  if (k <= 0) return from;
  if (k >= 1) return to;
  return { at: mix3(from.at, to.at, k), lookAt: mix3(from.lookAt, to.lookAt, k), fov: mix(from.fov, to.fov, k), roll: mix(from.roll, to.roll, k), dof: k < 0.5 ? from.dof : to.dof };
}

export function settleLook(look, dt) {
  const k = Math.exp(-SETTLE * dt);
  return { yaw: look.yaw * k, pitch: look.pitch * k };
}
