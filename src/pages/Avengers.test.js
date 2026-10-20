import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const page = readFileSync(new URL('./Avengers.jsx', import.meta.url), 'utf8');

describe('the Avengers page', () => {
  it('orders the page: the compound and its board, the worlds, Titan, a closed Archive, then the credits', () => {
    const at = ['<CompoundWorld', '<WorldSwitcher', 'id="thanos"', '<details className="hq-archive', '<ClipBoard', '<Scenes', '<WorldPhotos', '</details>', '<ModelCredits'].map((s) => page.indexOf(s));
    expect(at.every((i) => i > -1), String(at)).toBe(true);
    expect(at).toEqual([...at].sort((a, b) => a - b));
    expect(page).not.toMatch(/<details className="hq-archive[^>]*\sopen/);
    expect(page.lastIndexOf('<section')).toBe(page.indexOf('<section id="av-credits"'));
  });
  it('has no second intro: the board is the first thing under the compound', () => {
    expect(page).not.toContain('About the compound');
    expect(page).not.toContain('playIntro');
    const next = page.indexOf('<section', page.indexOf('<CompoundWorld'));
    expect(page.slice(next, page.indexOf('</section>', next))).toContain('<WorldSwitcher');
  });
  it('earns the snap: nothing set by hand, and Next keeps the page behind its game', () => {
    const page = readFileSync(new URL('./Avengers.jsx', import.meta.url), 'utf8');
    const titan = readFileSync(new URL('../components/avengers/titan/Titan.jsx', import.meta.url), 'utf8');
    expect(page).toMatch(/<Link\s+to=\{gate\.next\.to\}\s+state=\{hqState\}/);
    expect(page).toMatch(/disabled=\{!gate\.ready\}/);
    for (const gone of ['toggleStone', 'setHave', 'onSet=', 'Take them out', 'useFun', 'playClip(heist']) expect(page).not.toContain(gone);
    expect(titan).not.toMatch(/onSet|titan-socket|<button/);
  });
  it('plays the snap where it can be seen, and ends it at once where nothing would play it', () => {
    const titan = readFileSync(new URL('../components/avengers/titan/Titan.jsx', import.meta.url), 'utf8');
    // the stage, below the fold on a phone, comes into view before the snap
    // (its frames only run while it's on screen)
    const snap = page.slice(page.indexOf('const doSnap'), page.indexOf('titan.current?.snap('));
    expect(snap).toMatch(/if \(box && \(box\.top < 0 \|\| box\.bottom > window\.innerHeight\)\) stageEl\.current\.scrollIntoView\(\{ block: 'center', behavior: prefersReducedMotion\(\) \? 'auto' : 'smooth' \}\)/);
    expect(page).toMatch(/<div ref=\{stageEl\} className="stones-panel gauntlet-stage"/);
    // with reduced motion there's no loop to play it: the page does it itself
    expect(titan).toMatch(/if \(status !== 'on' \|\| !v \|\| calm\.current\) return false;/);
  });
});
