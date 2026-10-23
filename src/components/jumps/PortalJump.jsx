import { useEffect, useMemo } from 'react';
import { T } from '../hyperspace3d/timeline';
import { SWIRL_GLSL } from '../rickmorty/swirl';
import JumpCanvas from './JumpCanvas';
import { portalAt } from './timing';

// Rick's way across the map: a portal, not a jump to lightspeed. On the jump
// to lightspeed's timeline (hyperspace3d/timeline.js), so the universe map
// has the cruiser out at the place under its flash, as it does for the others:
//
//   0.00–0.45s  the portal gun fires: a green portal swirls open ahead, space
//               darkening round it
//   0.45–1.15s  the cruiser flies into it, faster and faster, until the goo
//               fills the view
//   1.15–1.30s  a lime-white flash going through; `onPeak` fires here
//   1.30–1.95s  between dimensions: a green vortex, light streaming past, the
//               next portal's eye glowing at the far end
//   1.95–2.45s  out the other side: the portal closes behind, shrinking to a
//               point over the new place
//
// The swirl is the show's, from rickmorty/swirl.js (the same goo as the
// hero's portal and the one the cruiser comes out of on the map), with the
// vortex drawn in its palette. Where WebGL won't start, a plain green portal
// on a 2D canvas does the same moves. `sound` plays the portal gun (only
// from something the visitor clicked or pressed: browsers block audio before).
// `from` (ms) starts it partway: the universe map's ship flown into a portal
// it drew in 3D goes in where the goo fills the view, the gun's shot softer
// (it was fired already).

const FRAG = `
precision highp float;
uniform vec2 res;
uniform float t, clock, flash, dark, grow, open, inside, seed;
${SWIRL_GLSL}

// Between dimensions: looking down a green vortex. Depth is 1/r, so the far
// end is at the middle; the walls wind round and rush past, streaks of
// light with them, and the far end glows like the eye of a portal.
vec3 vortex(vec2 uv, float time) {
  float r = length(uv) + 1e-4;
  float a = atan(uv.y, uv.x);
  float depth = 0.32 / r;
  float twist = a + depth * 0.5 + time * 1.3;
  vec2 p = vec2(cos(twist), sin(twist)) * 1.6 + vec2(0.0, depth * 0.8 - time * 2.4);
  float n1 = sw_fbm(p + seed);
  float n2 = sw_fbm(p * 2.2 + vec2(5.0, -time * 1.1) - seed);
  float s = n1 * 0.7 + n2 * 0.3;
  vec3 arm = vec3(0.07, 0.30, 0.05);
  vec3 body = vec3(0.36, 0.74, 0.14);
  vec3 lime = vec3(0.64, 0.92, 0.24);
  vec3 c = mix(arm, body, smoothstep(0.40, 0.48, s));
  c = mix(c, lime, smoothstep(0.60, 0.67, s) * 0.85);
  // streaks of light rushing down the walls (cells round the tunnel, wrapped so there's no seam)
  float K = 9.0;
  vec2 g = vec2((a / 3.14159265 + 1.0) * K + time * 0.4, depth * 1.6 - time * 7.0);
  vec2 id = vec2(mod(floor(g.x), 2.0 * K), floor(g.y));
  vec2 f = fract(g) - 0.5;
  float streak = smoothstep(0.09, 0.02, abs(f.x)) * smoothstep(0.5, 0.15, abs(f.y)) * step(0.72, sw_hash(id + seed));
  c = mix(c, vec3(0.95, 1.0, 0.8), streak * 0.9);
  // the far end: darker arms, then the next portal's eye glowing through
  float fog = exp(-depth * 0.28);
  c = mix(vec3(0.03, 0.12, 0.03), c, fog);
  vec3 core = vec3(0.90, 0.95, 0.36);
  c += core * smoothstep(0.11, 0.0, r) * 0.9;
  c += vec3(0.45, 0.95, 0.25) * smoothstep(0.3, 0.05, r) * 0.25;
  return c;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * res) / res.y;
  // space darkening round the portal as the cruiser rushes in (premultiplied black)
  vec4 col = vec4(0.0, 0.0, 0.0, dark * 0.6);
  if (grow > 0.0) {
    // the portal: a tall oval of the show's goo, its rim near |o| = 1
    vec2 o = uv / (grow * vec2(0.82, 1.0));
    vec4 p = portal(o, clock * 1.15, open, seed);
    if (inside > 0.0) {
      // through it: the vortex in the middle, the goo's lip still framing it
      float d = length(o);
      float hole = smoothstep(0.90, 0.76, d) * inside;
      vec3 v = vortex(uv, clock);
      p = mix(p, vec4(v, 1.0) * p.a, hole);
    }
    col = col * (1.0 - p.a) + p;
  }
  // the flash going through: lime-white
  vec3 fc = vec3(0.93, 1.0, 0.76);
  col = col * (1.0 - flash) + vec4(fc, 1.0) * flash;
  gl_FragColor = col;
}`;

// The 2D version: the same oval in flat greens where there's no WebGL
function fallback(ctx, t, clock, { W, H }, u) {
  const cx = W / 2;
  const cy = H / 2;
  ctx.fillStyle = `rgba(0,0,0,${0.6 * u.dark})`;
  ctx.fillRect(0, 0, W, H);
  const r = u.grow * u.open * H;
  if (r > 0.5) {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    if (u.inside > 0) {
      g.addColorStop(0, 'rgb(230,242,92)');
      g.addColorStop(0.08, 'rgb(28,76,22)');
      g.addColorStop(0.55, 'rgb(92,188,36)');
    } else {
      g.addColorStop(0, 'rgb(230,242,92)');
      g.addColorStop(0.3, 'rgb(107,199,41)');
      g.addColorStop(0.7, 'rgb(72,160,30)');
    }
    g.addColorStop(0.9, 'rgb(163,235,61)');
    g.addColorStop(1, 'rgb(219,255,117)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cx, cy, r * 0.82, r, 0, 0, Math.PI * 2);
    ctx.fill();
    // a few arms of the swirl, turning
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy, r * 0.82, r, 0, 0, Math.PI * 2);
    ctx.clip();
    ctx.strokeStyle = 'rgba(28,96,22,0.55)';
    ctx.lineWidth = Math.max(2, r * 0.06);
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      for (let k = 0; k <= 40; k++) {
        const q = k / 40;
        const a = clock * 1.6 + i * 2.1 + q * 5.5;
        const d = q * r * 0.95;
        const x = cx + Math.cos(a) * d * 0.82;
        const y = cy + Math.sin(a) * d;
        if (k) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }
  if (u.flash > 0) {
    ctx.fillStyle = `rgba(237,255,194,${u.flash})`;
    ctx.fillRect(0, 0, W, H);
  }
}

export default function PortalJump({ onPeak, onDone, sound = false, from = 0 }) {
  const seed = useMemo(() => Math.random() * 10, []);
  const uniforms = useMemo(() => (t, clock, view) => ({ ...portalAt(t, view), seed }), [seed]);

  useEffect(() => {
    if (!sound) return undefined;
    // the portal gun firing, and again, softer, as the portal closes behind
    let alive = true;
    const shots = [];
    const fire = (gain) =>
      import('../../lib/clips').then(async ({ playClip }) => {
        const c = await playClip('portalGun', { gain, keep: true });
        if (!alive) c?.stop();
        else if (c) shots.push(c);
      });
    fire(from > 0 ? 0.7 : 1);
    const again = setTimeout(() => fire(0.45), Math.max(0, T.tunnel - from));
    return () => {
      alive = false;
      clearTimeout(again);
      // (as the jump to lightspeed does: a shot still going is let finish unless the sound's held back)
      import('../../lib/audio').then(({ audioContext }) => {
        if (audioContext()?.state !== 'running') shots.forEach((c) => c.stop());
      });
    };
  }, [sound, from]);

  return <JumpCanvas frag={FRAG} uniforms={uniforms} fallback={fallback} onPeak={onPeak} onDone={onDone} from={from} />;
}
