import { useEffect, useRef, useSyncExternalStore } from 'react';
import { mapState, onMapState } from '../../lib/mapReady';

// The launch's hooks (components/launch): the map's readiness as React reads
// it, and what makes a full-page screen a modal over the app.

// the map's readiness (lib/mapReady), kept current
export const useMapState = () => useSyncExternalStore(onMapState, mapState, mapState);

// A full-page screen portalled outside #root: the app behind it takes no
// focus, clicks or reading while it's up, the page doesn't scroll under it,
// the first-visit cover (index.html) goes as it comes, `focus` has the focus,
// and Esc calls `onEscape`.
export function useFullPage({ focus, onEscape }) {
  const esc = useRef(onEscape);
  esc.current = onEscape;
  useEffect(() => {
    delete document.documentElement.dataset.intro;
    focus?.current?.focus({ preventScroll: true });
    const onKey = (e) => {
      if (e.key !== 'Escape' || !esc.current) return;
      e.preventDefault();
      esc.current();
    };
    window.addEventListener('keydown', onKey);
    const html = document.documentElement;
    const overflow = html.style.overflow;
    html.style.overflow = 'hidden';
    const root = document.getElementById('root');
    const was = root?.inert;
    if (root) root.inert = true;
    return () => {
      window.removeEventListener('keydown', onKey);
      html.style.overflow = overflow;
      if (root) root.inert = Boolean(was);
    };
  }, [focus]);
}
