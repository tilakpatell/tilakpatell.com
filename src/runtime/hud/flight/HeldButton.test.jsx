import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup as html } from 'react-dom/server';
import TouchButton from '../TouchButton';
import HeldButton from './HeldButton';

describe('HeldButton', () => {
  it('draws as the universe map’s, holds, lets go with no event', () => {
    expect(html(<HeldButton className="universe-fire" onHold={() => {}}>Fire</HeldButton>)).toBe('<button type="button" class="hud-touch-btn universe-fire">Fire</button>');
    expect(html(<HeldButton size={52} className="universe-climb" aria-label="Nose up" on={1} off={0} onHold={() => {}}>^</HeldButton>)).toBe('<button type="button" class="hud-touch-btn universe-climb" data-size="small" aria-label="Nose up">^</button>');
    const got = [];
    const el = HeldButton({ on: -1, off: 0, onHold: (x) => got.push(x) });
    const e = { preventDefault: vi.fn() };
    el.props.onPress(e);
    el.props.onRelease();
    expect([el.type === TouchButton, e.preventDefault.mock.calls.length, got]).toEqual([true, 1, [-1, 0]]);
  });
});
