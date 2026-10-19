import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import HQGame, { GameScreen, StartNote, TouchHelp } from './HQGame';
import { GAMES } from './gameScreen';

const SCREEN = { id: 'hawkeye', name: 'The range', blurb: 'A clearing past the hangar.', accent: '#c9a2ff', stone: { id: 'soul-clint', name: 'Soul Stone', color: '#ff8a00', half: 'Clint’s' }, onBack() {}, next: () => null };
const stage = (o) => ({ wrap: { current: null }, host: { current: null }, status: 'on', retry() {}, ...o });
const three = (o) => ({ on: true, can: true, auto: true, mode: 'auto', local: 'auto', set() {}, ...o });
const html = (el, screen = SCREEN) => renderToStaticMarkup(<GameScreen.Provider value={screen}>{el}</GameScreen.Provider>);
const barOf = (out) => out.slice(out.indexOf('<header'), out.indexOf('</header>') + 9);
const noteOf = (out) => (out.match(/<p class="hq-toy-note"[\s\S]*?<\/p>/) ?? [''])[0];
const game = (o = {}) => <HQGame game="trickshot" stage={stage(o.stage)} three={three(o.three)} fallback={<p>toy</p>} label="Trick Shot" playing={o.playing ?? true} paused={o.paused ?? false} onPause={() => {}} flat={o.flat}><i>hud</i></HQGame>;

describe('the game screen', () => {
  it('puts the game under a slim bar: the place, its 3D switch, Pause while playing and Back with Esc', () => {
    const out = html(game());
    const bar = barOf(out);
    expect(bar).toContain('class="hq-bar"');
    expect(bar).toContain('id="hq-bar-title"');
    expect(bar).toContain('The range');
    expect(bar).toMatch(/aria-pressed="true"[^>]*>3D game: on</);
    expect(bar).toMatch(/aria-pressed="false"[^>]*>Pause</);
    expect(bar).toContain('<kbd>Esc</kbd>');
    expect(out).toContain('hq-game-full');
    expect(out).toContain('class="hq-screen"');
    expect(out).toContain('<i>hud</i>');
    expect(out).not.toContain('<p>toy</p>');
    expect(barOf(html(game({ playing: false })))).not.toContain('Pause');
    expect(barOf(html(game({ paused: true })))).toMatch(/aria-pressed="true"[^>]*>Resume</);
  });
  it('shows the toy, the place’s note, one line and Try 3D when this game’s 3D is off', () => {
    const out = html(game({ stage: { status: 'idle' }, three: { on: false } }));
    expect(out).toContain('<p>toy</p>');
    expect(noteOf(out)).toContain('The stone here is won in the 3D game.');
    expect(noteOf(out)).toContain('>Try 3D<');
    expect(out).toContain('A clearing past the hangar.');
    expect(out).not.toContain('class="hq-screen"');
  });
  it('offers Try 3D again when the 3D failed', () => {
    const note = noteOf(html(game({ stage: { status: 'failed' } })));
    expect(note).toContain('3D couldn’t start here, so here is the simple version.');
    expect(note).toContain('>Try 3D again<');
  });
  it('draws a 2D view in place of the toy, keeps the failure line and leaves the start note to the view', () => {
    const off = html(game({ stage: { status: 'idle' }, three: { on: false }, flat: <i>flat</i> }));
    expect(off).toContain('<i>flat</i>');
    expect(off).not.toContain('<p>toy</p>');
    expect(barOf(off)).toContain('>Play in 3D<');
    expect(off).not.toContain('The stone here is won in the 3D game.');
    expect(off).not.toContain('A clearing past the hangar.');
    const failed = html(game({ stage: { status: 'failed' }, flat: <i>flat</i> }));
    expect(failed).toContain('<i>flat</i>');
    expect(noteOf(failed)).toContain('>Try 3D again<');
  });
  it('is the bare frame outside a game screen', () => {
    const out = renderToStaticMarkup(game());
    expect(out).not.toContain('hq-bar');
    expect(out).toContain('hq-game-full');
  });
  it('brings the place’s blurb and its stone line into the start overlay', () => {
    const out = html(<StartNote />);
    expect(out).toContain('A clearing past the hangar.');
    expect(out).toContain('Win it, and Clint’s half of the Soul Stone comes back to the compound.');
    expect(out).toContain('--glow:#ff8a00');
    expect(html(<StartNote />, { ...SCREEN, stone: { id: 'power', name: 'Power Stone', color: '#8e2de2', half: null } })).toContain('Win it, and the Power Stone comes back to the compound.');
    expect(html(<StartNote />, { ...SCREEN, stone: null })).not.toContain('hq-stone');
    expect(renderToStaticMarkup(<StartNote />)).toBe('');
  });
  it('lists a game’s touch controls in words and icons', () => {
    const out = renderToStaticMarkup(<TouchHelp game="smash" />);
    expect(out).toContain('class="hq-touch"');
    expect(out).toContain('Swipe sideways to change lanes, and up to leap');
    expect(out).toContain('Tap to smash');
    expect(out.match(/<svg/g)).toHaveLength(2);
    for (const g of GAMES) expect(renderToStaticMarkup(<TouchHelp game={g} />)).not.toMatch(/<svg[^>]*><\/svg>/);
    expect(renderToStaticMarkup(<TouchHelp game="nope" />)).toBe('');
  });
});

const FILES = { repulsor: 'repulsor/RepulsorRange.jsx', lawn: 'lawn/HoldTheLawn.jsx', ricochet: 'ricochet/Ricochet.jsx', trickshot: 'trickshot/TrickShot.jsx', widow: 'widow/Infiltration.jsx', smash: 'smash/SmashRun.jsx', thwip: 'thwip/Thwip.jsx', tesseract: 'tesseract/TesseractRun.jsx' };
const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

describe('the eight games on the game screen', () => {
  it.each(GAMES)('%s sits in HQGame with its own 3D and a Pause', (id) => {
    const s = src(FILES[id]);
    expect(s).toContain(`useGame3D('${id}')`);
    expect(s).toContain('own3D: true');
    expect(s).toContain(`game="${id}"`);
    expect(s).toMatch(/onPause=\{/);
    expect(s).not.toMatch(/\buse3D\(/);
    expect(s).not.toContain('hq/HQFrame');
  });
  it('leaves Invincible’s game on HQFrame as it was', () => {
    expect(src('../invincible/thinkmark/ThinkMark.jsx')).toContain("import HQFrame from '../../avengers/hq/HQFrame'");
  });
  it('lets Place hand the game its place, with no header of its own', () => {
    const place = src('world/Place.jsx');
    expect(place).toContain('<GameScreen.Provider');
    expect(place).toContain('aria-labelledby="hq-bar-title"');
    expect(place).not.toContain('cw-place-head');
    expect(src('world/world.css')).not.toMatch(/\.cw-place-(head|sub|title|body|intro|stone)\b/);
  });
});

describe('the start and the end of every game', () => {
  it.each(GAMES)('%s opens on its start note and touch help and ends on the results card', (id) => {
    const s = src(FILES[id]);
    expect(s).toContain('<StartNote />');
    expect(s).toContain(`<TouchHelp game="${id}" />`);
    expect(s).toMatch(/<Results\b/);
    expect(s).not.toContain('className="hq-stone"');
    expect(s).not.toMatch(/stoneById/);
  });
  it('Hold the Lawn keeps both ways back in after a loss past the checkpoint', () => {
    const s = src(FILES.lawn);
    expect(s).toMatch(/label: 'Restart at the boss', onClick: startBoss/);
    expect(s).toContain("'From wave 1'");
  });
});
