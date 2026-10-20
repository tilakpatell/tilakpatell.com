// Opens the command palette from anywhere (the nav button, the terminal).
export const openPalette = () => window.dispatchEvent(new Event('tp:palette'));

// Opens the guide (the ? button's panel) from anywhere: a page's own Controls
// button, or on a tab ({ tab: 'checklist' }: ⌘K's "Open the checklist"). A
// button's click isn't a tab: openGuide is handed straight to onClick.
export const guideDetail = (opts) => (opts && Object.getPrototypeOf(opts) === Object.prototype && typeof opts.tab === 'string' ? { tab: opts.tab } : null);
export const openGuide = (opts) => {
  const detail = guideDetail(opts);
  window.dispatchEvent(new CustomEvent('tp:guide', detail ? { detail } : undefined));
};
// …or shuts it if it's open: a world's own key for it (Invincible's H), as ? does.
export const toggleGuide = () => window.dispatchEvent(new CustomEvent('tp:guide', { detail: { toggle: true } }));

// ⌘K on a Mac, Ctrl K elsewhere (either works anywhere): the palette's key,
// for its host (App.jsx) and the tour, which lets it through where a stop
// asks you to try it.
export const isPaletteKey = (e) => Boolean(e && (e.metaKey || e.ctrlKey) && !e.altKey && typeof e.key === 'string' && e.key.toLowerCase() === 'k');

export const shortcutLabel = () =>
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? '⌘K' : 'Ctrl K';

// Opens the settings panel (components/settings) from anywhere: the gear in
// the nav, ⌘K's "Settings", a world's own panel.
export const openSettings = () => window.dispatchEvent(new Event('tp:settings'));

// Opens the party dialog (universe/online/PartyHost.jsx, always up inside
// OnlineProvider) from anywhere: the online corner's Party, a world's players
// chip, ⌘K's "Party", or on a tab ({ tab: 'quick' }: ⌘K's "Quick chat"). A
// tab is read as the guide's is, so a click handed straight to onClick isn't one.
export const openParty = (opts) => {
  const detail = guideDetail(opts);
  window.dispatchEvent(new CustomEvent('tp:party', detail ? { detail } : undefined));
};
