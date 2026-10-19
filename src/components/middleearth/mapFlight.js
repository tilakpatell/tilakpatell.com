// The opening’s flight: the camera starts low over Hobbiton and follows the
// road east, as the films begin in the Shire and end at the Mountain, then
// pulls back to frame the whole map for the hub. Each key is over a stop of
// the road (./road.js) where the sheet has it; the hub’s framing and zoom
// are the ones the stops’ bounds give (./mapFraming.js). `t` is in seconds.
import { framing } from './mapFraming';
import { STOPS } from './road';

const over = (id) => {
  const s = STOPS.find((x) => x.id === id);
  return [s.x, s.y];
};

export const FLIGHT = [
  { t: 0, at: over('hobbiton'), zoom: 1.1 },
  { t: 1.0, at: over('bree'), zoom: 1.25 },
  { t: 1.8, at: over('rivendell'), zoom: 1.45 },
  { t: 2.6, at: over('moria'), zoom: 1.6 },
  { t: 3.3, at: over('lorien'), zoom: 1.6 },
  { t: 4.0, at: over('amon-hen'), zoom: 1.5 },
  { t: 4.7, at: over('mount-doom'), zoom: 1.3 },
  { t: 5.5, ...framing() }, // the hub
];

export const FLIGHT_MS = FLIGHT.at(-1).t * 1000;

// when the title fades in over the flight, and when it fades out
export const TITLE = { inMs: 1500, outMs: 4500 };

const smoothstep = (u) => u * u * (3 - 2 * u);
const lerp = (a, b, u) => a + (b - a) * u;

// Where the camera is `ms` into the flight. Each leg eases in and out, so
// the camera settles over every stop before it moves on.
export function flightAt(ms) {
  const t = Math.max(0, ms / 1000);
  const last = FLIGHT.at(-1);
  if (t >= last.t) return { at: [...last.at], zoom: last.zoom, done: true };
  const i = FLIGHT.findIndex((k) => k.t > t) - 1;
  const a = FLIGHT[i];
  const b = FLIGHT[i + 1];
  const u = smoothstep((t - a.t) / (b.t - a.t));
  return { at: [lerp(a.at[0], b.at[0], u), lerp(a.at[1], b.at[1], u)], zoom: lerp(a.zoom, b.zoom, u), done: false };
}
