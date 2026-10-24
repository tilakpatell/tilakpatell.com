import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { EPISODES } from '../adventure/episodes';
import { fresh } from '../adventure/story';
import { ENTER, asksCard, atDoor, storyLead } from './storyline';

const at = (episode, step, more = {}) => ({ ...fresh(), episode, step, ...more });

describe('what the Citadel tells of the story', () => {
  it('knows the story’s at the Citadel’s door', () => {
    expect(ENTER).toEqual({ type: 'enter', area: EPISODES[9].steps[0].area });
    expect(atDoor(at(9, 0))).toBe(true);
    for (const s of [at(9, 1), fresh(), at(10, 0)]) expect(atDoor(s)).toBe(false);
    // (an episode that isn't built isn't waiting anywhere)
    expect(atDoor(at(9, 0), { ready: 9 })).toBe(false);
  });

  it('asks for the visit’s card only in an episode with a step here', () => {
    // (asking takes it: a new visitor's first card waits for C-137)
    for (const s of [fresh(), at(8, 0), at(8, 1), at(10, 0)]) expect(asksCard(s)).toBe(false);
    expect(asksCard(at(9, 0))).toBe(true);
    expect(asksCard(at(9, 1))).toBe(true);
    expect(asksCard(at(9, 0), { ready: 9 })).toBe(false);
  });

  it('puts the story’s step over the Citadel’s line only while it’s played here', () => {
    expect(storyLead(at(9, 1))).toBe(EPISODES[9].steps[1].text);
    // Mortytown's the Locos': its own line alone
    expect(storyLead(at(9, 1), { town: true })).toBe(null);
    // the door (being here passes it), another episode's step, none
    for (const s of [at(9, 0), at(8, 1), fresh(), at(10, 0)]) expect(storyLead(s)).toBe(null);
    // free roam doesn't change the line, as in C-137
    expect(storyLead(at(9, 1, { freeRoam: true }))).toBe(EPISODES[9].steps[1].text);
  });
});

// the lead's colour as citadel.css gives it, on red alert and off it (its
// rule, or the Citadel's accent it falls back on), and its contrast with the
// line's glass over the lit concourse floor, sampled from shots of it
// (/c-137/citadel at 1280: the lightest glass the lead stands on, each mood)
describe('the story’s step over the Citadel’s line', () => {
  const css = readFileSync(new URL('./citadel.css', import.meta.url), 'utf8');
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const lum = (rgb) => {
    const [r, g, b] = rgb.map((c) => c / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
  const colourOf = (selector) => css.match(new RegExp(`${selector.replace(/[.[\]'()*]/g, (c) => `\\${c}`)}\\s*\\{[^}]*?color:\\s*(#[0-9a-f]{6})`, 'i'))?.[1] ?? null;
  const accent = (mood) => css.match(mood === 'red' ? /\[data-mood='red'\]\s*\{[^}]*--shire-gold:\s*(#[0-9a-f]{6})/i : /\.citadel-world\s*\{[^}]*--shire-gold:\s*(#[0-9a-f]{6})/i)[1];
  const GLASS = { day: [69, 69, 71], red: [87, 54, 49] };

  it('reads at 4.5:1 or more on the line’s glass, on an ordinary day and on red alert', () => {
    const day = colourOf('.citadel-objective-story') ?? accent('day');
    const red = colourOf(".citadel-stage[data-mood='red'] .citadel-objective-story") ?? accent('red');
    expect(ratio(hex(day), GLASS.day)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(hex(red), GLASS.red)).toBeGreaterThanOrEqual(4.5);
  });
});
