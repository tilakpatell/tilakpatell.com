import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import PauseMenu from './PauseMenu.jsx';

const TABS = [
  { id: 'ship', label: 'Ship' },
  { id: 'cargo', label: 'Cargo', mark: 'Ca' },
  { id: 'help', label: 'Help' },
];
const html = (props, body = null) => renderToStaticMarkup(<PauseMenu tabs={TABS} tab="ship" {...props}>{body}</PauseMenu>);

describe('PauseMenu', () => {
  it('is a chip in the corner while shut, its key first', () => {
    const out = html({ open: false, dress: 'falcon' });
    expect(out).toMatch(/^<button[^>]*class="hud-pause-chip"[^>]*data-dress="falcon"/);
    expect(out.replace(/<[^>]+>/g, '')).toBe('EscMenu');
    // (and a touch screen's three lines in place of the key, hidden by the sheet where there's a keyboard)
    expect(out).toContain('class="hud-pause-chip-icon"');
    expect(out).toContain('aria-haspopup="dialog"');
  });

  it('draws nothing while shut with no chip asked for', () => {
    expect(html({ open: false, chip: false })).toBe('');
  });

  it('opens as a dialog with its tabs, the one asked for picked, and only that tab’s body', () => {
    const out = html({ open: true, tab: 'cargo', head: <p>Han and Chewie</p> }, <p>Credits</p>);
    expect(out).toContain('role="dialog"');
    expect(out).toContain('aria-modal="true"');
    expect(out.match(/role="tab"/g)).toHaveLength(3);
    expect(out).toMatch(/data-tab="cargo"[^>]*aria-selected="true"/);
    expect(out).toMatch(/data-tab="ship"[^>]*aria-selected="false"[^>]*tabindex="-1"/);
    expect(out).toContain('Han and Chewie');
    expect(out).toMatch(/role="tabpanel"[^>]*data-tab="cargo"/);
    expect(out).toContain('<p>Credits</p>');
    // (a dress's own mark for a tab, the number key beside every tab)
    expect(out).toContain('<span class="hud-pause-tab-mark" aria-hidden="true">Ca</span>');
    expect(out).toContain('<span class="hud-pause-tab-n" aria-hidden="true">3</span>');
  });

  it('falls back to the first tab for one it doesn’t have', () => {
    expect(html({ open: true, tab: 'nowhere' })).toMatch(/data-tab="ship"[^>]*aria-selected="true"/);
  });

  it('says the way back, its key first', () => {
    const out = html({ open: true, resume: 'Back to the walk' });
    expect(out).toMatch(/class="hud-pause-resume"[^>]*><kbd class="hud-cap hud-pause-resume-key">Esc<\/kbd> Back to the walk<\/button>/);
  });
});
