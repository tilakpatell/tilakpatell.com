import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// the squad list's order letter and class icon take turns (SquadMemberListContent,
// research-squad.md): the letter fades in at 0–0.15 s and out at 1.0–1.15 s, the
// icon the other way round, so at every moment exactly one of them shows
const css = readFileSync(new URL('./battlefront.css', import.meta.url), 'utf8');

function keyframes(name) {
  const body = css.match(new RegExp(`@keyframes ${name} \\{([\\s\\S]*?)\\n\\}`))[1];
  const stops = [];
  for (const [, sel, decl] of body.matchAll(/([\d.%,\s]+)\{([^}]*)\}/g)) {
    const opacity = Number(decl.match(/opacity:\s*([\d.]+)/)[1]);
    for (const s of sel.split(',')) stops.push([parseFloat(s) / 100, opacity]);
  }
  return stops.sort((a, b) => a[0] - b[0]);
}

function rule(selector) {
  const at = css.indexOf(`${selector} {`);
  return css.slice(at, css.indexOf('}', at));
}

// the opacity a rule's animation gives at time t (linear, infinite)
function opacityAt(selector, t) {
  const r = rule(selector);
  const [, name, dur] = r.match(/animation:\s*([\w-]+)\s+([\d.]+)s/);
  const period = Number(dur);
  const delay = Number(r.match(/animation-delay:\s*(-?[\d.]+)s/)?.[1] ?? 0);
  const reverse = /animation:[^;]*\breverse\b/.test(r);
  let k = (((t - delay) % period) + period) % period / period;
  if (reverse) k = 1 - k;
  const stops = keyframes(name);
  for (let i = 1; i < stops.length; i++) {
    const [k0, o0] = stops[i - 1];
    const [k1, o1] = stops[i];
    if (k <= k1) return k1 === k0 ? o1 : o0 + ((o1 - o0) * (k - k0)) / (k1 - k0);
  }
  return stops.at(-1)[1];
}

describe('the squad list’s order letter', () => {
  it('fades in as the class icon fades out, and out as it comes back', () => {
    const icon = '.bf-squad-row[data-order] .bf-squad-class';
    const letter = '.bf-squad-row[data-order] .bf-squad-letter';
    expect(opacityAt(letter, 0)).toBeCloseTo(0, 6);
    expect(opacityAt(letter, 0.5)).toBeCloseTo(1, 6);
    expect(opacityAt(letter, 1.5)).toBeCloseTo(0, 6);
    for (let t = 0; t < 4; t += 0.05) expect(opacityAt(icon, t) + opacityAt(letter, t)).toBeCloseTo(1, 6);
  });
});
