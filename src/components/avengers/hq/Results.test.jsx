import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Link, MemoryRouter } from 'react-router-dom';
import Results, { ResultsCard } from './Results';
import { GameScreen } from './HQGame';
import { STONES } from '../../interests/stones';

// the elements of a tree, depth first (the card has no hooks, so it can be called)
const walk = (el, out = []) => {
  if (Array.isArray(el)) el.forEach((e) => walk(e, out));
  else if (el && typeof el === 'object' && el.props) {
    out.push(el);
    walk(el.props.children, out);
  }
  return out;
};
const noop = () => {};
const r = (p) => renderToStaticMarkup(<MemoryRouter><ResultsCard onAgain={noop} onBack={noop} {...p} /></MemoryRouter>);
const byLabel = (els, t) => els.find((e) => e.type === 'button' && [e.props.children].flat().join('') === t);

describe('the results card', () => {
  it('a win: the stone in its own colour, the score against the best and the way on', () => {
    const out = r({ won: true, kicker: 'Stark Industries · test field', title: 'Ultron Prime is down.', score: 12340, best: 15200, stone: 'power', stoneText: 'The Power Stone is yours.', next: { id: 'thor', label: 'Mjolnir', to: '/avengers/lawn' } });
    expect(out).toContain('data-tone="won"');
    expect(out).toContain('12,340');
    expect(out).toContain('best 15,200');
    expect(out).toContain('--glow:#8e2de2');
    expect(out).toContain('href="/avengers/lawn"');
    expect(out).toMatch(/btn-primary[^>]*>Next: Mjolnir</);
    expect(out).toContain('Play again');
    expect(out).toContain('Back to the compound');
  });
  it('takes each whole stone’s colour from the gauntlet’s table', () => {
    for (const s of STONES) expect(r({ won: true, title: 'x', stone: s.id })).toContain(`--glow:${s.color}`);
  });
  it('a loss: Play again first, no stone and no way on when there is none', () => {
    const out = r({ won: false, title: 'Armour failed.', score: 900, best: 15200, next: null });
    expect(out).toContain('data-tone="lost"');
    expect(out).not.toContain('Next:');
    expect(out).not.toContain('hq-stone');
    expect(out).toMatch(/btn-primary[^>]*>Play again</);
    expect(r({ won: true, title: 'x', score: 16000, best: 15200, newBest: true })).toContain('a new best');
    expect(r({ won: true, title: 'x', stone: 'soul', half: 'Clint’s' })).toContain('Clint’s half of the Soul Stone is yours.');
  });
  it('stars where the game keeps them, a way on inside the game first and its own way back last', () => {
    const out = r({ won: true, title: 'Nice throwing.', stars: { got: 2, of: 3 }, onward: { label: 'Next room', onClick: noop }, more: { label: 'All rooms', onClick: noop } });
    expect(out).toContain('aria-label="2 of 3 stars"');
    expect(out.match(/data-on/g)).toHaveLength(2);
    expect(out.indexOf('Next room')).toBeLessThan(out.indexOf('Play again'));
    expect(out).toMatch(/btn-primary[^>]*>Next room</);
    expect(out.indexOf('All rooms')).toBeGreaterThan(out.indexOf('Back to the compound'));
  });
  it('says what Play again says when the game names it', () => {
    const again = vi.fn();
    const out = r({ won: false, title: 'The line broke.', onAgain: again, againLabel: 'From wave 1', onward: { label: 'Restart at the boss', onClick: noop } });
    expect(out).toContain('>From wave 1<');
    expect(out).not.toContain('Play again');
    expect(out).toMatch(/btn-primary[^>]*>Restart at the boss</);
    expect(byLabel(walk(ResultsCard({ title: 't', onAgain: again, againLabel: 'From wave 1' })), 'From wave 1').props.onClick).toBe(again);
  });
  it('hands each button its callback, and Next replaces the address', () => {
    const again = vi.fn(), back = vi.fn(), on = vi.fn(), more = vi.fn();
    const els = walk(ResultsCard({ won: true, title: 't', onAgain: again, onBack: back, onward: { label: 'Next room', onClick: on }, more: { label: 'All rooms', onClick: more }, next: { id: 'cap', label: 'The training center', to: '/avengers/training', state: { hq: true } } }));
    expect(byLabel(els, 'Play again').props.onClick).toBe(again);
    expect(byLabel(els, 'Back to the compound').props.onClick).toBe(back);
    expect(byLabel(els, 'Next room').props.onClick).toBe(on);
    expect(byLabel(els, 'All rooms').props.onClick).toBe(more);
    const link = els.find((e) => e.type === Link);
    expect([link.props.to, link.props.replace, link.props.state]).toEqual(['/avengers/training', true, { hq: true }]);
  });
  it('reads Back and Next from the game screen when the game doesn’t say', () => {
    const screen = { onBack: noop, next: () => ({ id: 'cap', label: 'The training center', to: '/avengers/training' }) };
    const out = renderToStaticMarkup(<MemoryRouter><GameScreen.Provider value={screen}><Results won title="Done." onAgain={noop} /></GameScreen.Provider></MemoryRouter>);
    expect(out).toContain('Next: The training center');
    expect(out).toContain('href="/avengers/training"');
    expect(out).toContain('Back to the compound');
    expect(renderToStaticMarkup(<MemoryRouter><Results won title="Done." onAgain={noop} /></MemoryRouter>)).not.toContain('Next:');
  });
});
