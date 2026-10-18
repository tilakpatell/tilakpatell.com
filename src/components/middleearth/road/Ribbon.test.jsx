import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import Ribbon from './Ribbon';
import { markAt, sOf } from './line';
import { STAGES } from './stages/index';

const html = (props) => renderToStaticMarkup(<Ribbon stages={STAGES} s={sOf(STAGES, 'moria', 10)} names="all" onJump={() => {}} {...props} />);

describe('the ribbon: the sixteen stages along the foot', () => {
  it('is a nav of sixteen buttons, each named with its date', () => {
    const out = html();
    expect(out).toMatch(/^<nav[^>]*aria-label="The Road’s stages"/);
    expect(out.match(/<button/g)).toHaveLength(16);
    expect(out).toContain('aria-label="Hobbiton · 22 September 3018"');
    expect(out).toContain('aria-label="The Grey Havens · 29 September 3021"');
  });

  it('marks the stage the walkers are in as the current step', () => {
    const out = html();
    expect(out.match(/aria-current="step"/g)).toHaveLength(1);
    expect(out).toMatch(/aria-current="step"[^>]*aria-label="Moria · 13 January 3019"|aria-label="Moria · 13 January 3019"[^>]*aria-current="step"/);
  });

  it('on a phone shows one name, the current', () => {
    const one = html({ names: 'current' }).replace(/<[^>]+>/g, '|').split('|').filter(Boolean);
    expect(one.filter((t) => STAGES.some((st) => st.name === t))).toEqual(['Moria']);
    const all = html().replace(/<[^>]+>/g, '|').split('|').filter(Boolean);
    expect(all.filter((t) => STAGES.some((st) => st.name === t))).toHaveLength(16);
  });

  it('puts the walker’s mark between the dots by how far into the stage they are', () => {
    expect(markAt(STAGES, 0)).toBe(0);
    expect(markAt(STAGES, 1)).toBe(1);
    expect(markAt(STAGES, sOf(STAGES, 'moria', 0))).toBeCloseTo(7 / 15, 9);
    expect(markAt(STAGES, sOf(STAGES, 'moria', STAGES[7].length / 2))).toBeCloseTo(7.5 / 15, 9);
  });
});
