import { describe, expect, it } from 'vitest';
import { drawList, navigables } from '../../../lib/bf2017/ui/layout';
import { screen } from '../../../lib/bf2017/ui/screens';
import { FOOTER_DROP, footerValues } from './footer';

describe('the foot, as the PC’s game draws it', () => {
  const tree = screen('PlayScreen', { drop: FOOTER_DROP });
  const values = footerValues('BACK', tree);
  const items = drawList([tree], { values }).filter((i) => i.id.includes('/FooterBar/'));
  it('is one button, BACK, its outline round its word (the capture: 97 to 201)', () => {
    const word = items.find((i) => i.type === 'text');
    expect(word).toMatchObject({ text: 'BACK', x: 97, w: 104, align: ['center', 'center'] });
    expect(items.filter((i) => i.type === 'text')).toHaveLength(1);
    expect(items.find((i) => i.id.endsWith('/PCOutline')).w).toBe(104);
    expect(items.find((i) => i.id.endsWith('/RightLine')).x).toBe(97 + 104 - 2);
  });
  it('is the one cell to press there, named for its word', () => {
    const navs = navigables([tree], { values }).filter((n) => n.id.includes('/FooterBar/'));
    expect(navs.map((n) => [n.id.split('/').pop(), n.label, n.w])).toEqual([['Back', 'BACK', 104]]);
  });
});
