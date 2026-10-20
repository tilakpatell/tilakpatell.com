import { afterEach, describe, expect, it, vi } from 'vitest';
import { guideDetail, isPaletteKey, openParty } from './palette';

describe('the palette’s key', () => {
  it('is ⌘K or Ctrl K, whichever case', () => {
    expect(isPaletteKey({ key: 'k', metaKey: true })).toBe(true);
    expect(isPaletteKey({ key: 'K', ctrlKey: true })).toBe(true);
  });

  it('is not K alone, another letter, or with Alt', () => {
    expect(isPaletteKey({ key: 'k' })).toBe(false);
    expect(isPaletteKey({ key: 'j', metaKey: true })).toBe(false);
    expect(isPaletteKey({ key: 'k', ctrlKey: true, altKey: true })).toBe(false);
    expect(isPaletteKey(null)).toBe(false);
    expect(isPaletteKey({ key: undefined, metaKey: true })).toBe(false);
  });
});

describe('opening the guide on a tab', () => {
  it('reads a tab from a plain object', () => {
    expect(guideDetail({ tab: 'checklist' })).toEqual({ tab: 'checklist' });
  });

  it('reads a click, a word or nothing as no tab', () => {
    for (const x of [undefined, null, 'checklist', new Event('click'), { tab: 3 }]) expect(guideDetail(x), String(x)).toBeNull();
  });
});

describe('opening the party', () => {
  afterEach(() => vi.unstubAllGlobals());
  // (the page's window, as far as an event goes: Node has EventTarget and CustomEvent)
  const heard = () => {
    const win = new EventTarget();
    const got = [];
    win.addEventListener('tp:party', (e) => got.push(e.detail));
    vi.stubGlobal('window', win);
    return got;
  };

  it('asks the host for the dialog, on the tab it’s given', () => {
    const got = heard();
    openParty({ tab: 'quick' });
    openParty({ tab: 'chat' });
    expect(got).toEqual([{ tab: 'quick' }, { tab: 'chat' }]);
  });

  it('reads a click or nothing as no tab: the dialog opens where it would', () => {
    const got = heard();
    openParty();
    openParty(new Event('click'));
    expect(got).toEqual([null, null]);
  });
});
