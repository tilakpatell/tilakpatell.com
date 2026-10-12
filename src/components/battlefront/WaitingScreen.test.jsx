import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import WaitingScreen, { Wipe } from './WaitingScreen.jsx';

const html = (el) => renderToStaticMarkup(<MemoryRouter>{el}</MemoryRouter>);
const OFFERS = [
  { kind: 'class', id: 'd-orig-assault', cls: 'assault', cost: 0 },
  { kind: 'class', id: 'd-orig-heavy', cls: 'heavy', cost: 0 },
  { kind: 'hero', id: 'vader', cost: 6000 },
];

describe('the waiting screen', () => {
  it('offers the level, the day by the game’s coin or by name, and the classes, with Deploy held until ready', () => {
    const h = html(<WaitingScreen level="hoth" mode="galacticAssault" offers={OFFERS} points={200} name={(o) => o.id} progress={{ value: 0.42, ready: false, line: 'Bringing the level in' }} variant="coin" rolled="sunset" machine="your machine: ultra tier" recommendation="recommended: measuring the chip’s frame…" onApply={() => {}} back={{ label: 'Back to Hoth', to: '/galaxy/hoth' }} />);
    expect(h).toMatch(/role="dialog"/);
    expect(h).toContain('GALACTIC ASSAULT');
    expect(h).toContain('OUTPOST DELTA');
    expect(h).toContain('data-day="coin"');
    expect(h).toContain('data-day="sunset"');
    expect(h).toContain('data-day="sunny"');
    expect(h).toContain('The sunset');
    expect(h).toContain('The clear day');
    expect(h).toContain('the coin said the sunset');
    expect(h).toContain('70 in 100');
    expect(h).toContain('d-orig-assault');
    expect(h).toContain('6,000');
    expect(h).toMatch(/aria-valuenow="42"/);
    expect(h).toContain('42 per cent');
    expect(h).toMatch(/data-deploy=""[^>]*disabled=""/);
    expect(h).toContain('>Loading</button>');
    expect(h).toContain('your machine: ultra tier');
    expect(h).toContain('measuring');
    expect(h).toContain('Back to Hoth');
    expect(h).toContain('href="/galaxy/hoth"');
    expect(h).toContain('href="/battlefront"');
  });

  it('lets Deploy take once ready, and says Applied once the recommendation is', () => {
    const h = html(<WaitingScreen offers={OFFERS} progress={{ value: 1, ready: true, line: 'Ready' }} machine="m" recommendation="recommended: ultra at 77 %" canApply applied onApply={() => {}} />);
    expect(h).toMatch(/data-ready="true"/);
    expect(h).not.toMatch(/data-deploy=""[^>]*disabled/);
    expect(h).toContain('>Deploy</button>');
    expect(h).toContain('>Applied</button>');
    expect(h).toContain('Ready · 100 per cent');
  });

  it('draws the wipe only in a phase, at the top depth', () => {
    expect(renderToStaticMarkup(<Wipe phase={null} />)).toBe('');
    expect(renderToStaticMarkup(<Wipe phase="down" />)).toContain('data-wipe="down"');
    expect(renderToStaticMarkup(<Wipe phase="up" />)).toContain('data-wipe="up"');
  });
});
