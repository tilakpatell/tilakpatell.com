import { describe, expect, it } from 'vitest';
import { menuKey, readTab, stepTab } from './pause.js';

const IDS = ['ship', 'cargo', 'map', 'settings', 'help', 'site'];
const KEYS = { i: 'cargo', o: 'settings' };
const key = (k, o = {}) => ({ key: k, metaKey: false, ctrlKey: false, altKey: false, ...o });

describe('menuKey', () => {
  it('closes on Escape while open, and leaves a shut menu’s Escape to the page', () => {
    expect(menuKey(key('Escape'), { open: true })).toEqual({ do: 'close' });
    expect(menuKey(key('Escape'), { open: false })).toBeNull();
  });

  it('opens on its tab from a world’s key while shut, either case', () => {
    expect(menuKey(key('i'), { open: false, keys: KEYS })).toEqual({ do: 'open', tab: 'cargo' });
    expect(menuKey(key('O'), { open: false, keys: KEYS })).toEqual({ do: 'open', tab: 'settings' });
    expect(menuKey(key('p'), { open: false, keys: KEYS })).toBeNull();
  });

  it('closes again on the key of the tab it’s showing, and goes to another’s', () => {
    expect(menuKey(key('i'), { open: true, tab: 'cargo', keys: KEYS })).toEqual({ do: 'close' });
    expect(menuKey(key('o'), { open: true, tab: 'cargo', keys: KEYS })).toEqual({ do: 'tab', id: 'settings' });
  });

  it('takes the number keys for the tabs while open', () => {
    expect(menuKey(key('1'), { open: true })).toEqual({ do: 'index', index: 0 });
    expect(menuKey(key('6'), { open: true })).toEqual({ do: 'index', index: 5 });
    expect(menuKey(key('0'), { open: true })).toBeNull();
    expect(menuKey(key('3'), { open: false })).toBeNull();
  });

  it('steps along the tabs with the arrows only from the tabs themselves (a slider keeps its arrows)', () => {
    expect(menuKey(key('ArrowRight'), { open: true, onTabs: true })).toEqual({ do: 'step', by: 1 });
    expect(menuKey(key('ArrowLeft'), { open: true, onTabs: true })).toEqual({ do: 'step', by: -1 });
    expect(menuKey(key('ArrowRight'), { open: true, onTabs: false })).toBeNull();
  });

  it('hears nothing but Escape while typing, over another dialog, or with a modifier held', () => {
    expect(menuKey(key('i'), { open: false, typing: true, keys: KEYS })).toBeNull();
    expect(menuKey(key('2'), { open: true, typing: true })).toBeNull();
    expect(menuKey(key('i'), { open: false, otherDialog: true, keys: KEYS })).toBeNull();
    expect(menuKey(key('i', { metaKey: true }), { open: false, keys: KEYS })).toBeNull();
    expect(menuKey(key('Escape'), { open: true, typing: true })).toEqual({ do: 'close' });
    expect(menuKey(null, { open: true })).toBeNull();
  });
});

describe('stepTab and readTab', () => {
  it('steps round the ends', () => {
    expect(stepTab(IDS, 'ship', 1)).toBe('cargo');
    expect(stepTab(IDS, 'ship', -1)).toBe('site');
    expect(stepTab(IDS, 'site', 1)).toBe('ship');
    expect(stepTab(IDS, 'nowhere', 1)).toBe('cargo');
  });

  it('keeps a tab that is one, and gives the first for anything else', () => {
    expect(readTab('help', IDS)).toBe('help');
    expect(readTab('shipyard', IDS)).toBe('ship');
    expect(readTab(null, IDS)).toBe('ship');
  });
});
