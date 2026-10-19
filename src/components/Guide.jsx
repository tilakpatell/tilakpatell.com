import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { IconGuide } from './icons';
import { CloseButton } from './ui';
import { guideMeta } from './guide/routes';
import { BRIEFED } from './tour/brief';
import { local } from '../lib/hooks';

// A guide to the site, and to whatever the page you're on lets you play. The
// "?" button in the corner (or the ? key, or a page's own Controls button,
// by 'tp:guide') opens it. The panel and everything it says load the first
// time it opens (or the button is pointed at). The first time you're on a
// page with controls, a note by the button says they're in here.
const loadPanel = () => import('./GuidePanel');
const GuidePanel = lazy(loadPanel);

const SEEN_KEY = 'tp-guide-seen'; // the pages whose note has been shown
const typing = (t) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

export default function Guide() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState(null); // the tab it was asked to open on, if any
  const button = useRef(null);
  const meta = guideMeta(pathname);

  // focus goes back to whatever opened the guide (a panel's own "?" where the
  // corner button is hidden), else to the corner button if it's showing
  const returnTo = useRef(null);
  const refocus = () => {
    const shown = (el) => el?.isConnected && el.getClientRects().length > 0;
    const to = shown(returnTo.current) ? returnTo.current : shown(button.current) ? button.current : null;
    to?.focus({ preventScroll: true });
  };
  const refocusRef = useRef(refocus);
  useEffect(() => {
    refocusRef.current = refocus;
  });
  const openRef = useRef(open);
  useEffect(() => {
    openRef.current = open;
    if (!open) return;
    const at = document.activeElement;
    returnTo.current = at instanceof HTMLElement && at !== document.body && !at.closest('#guide-panel') ? at : null;
  }, [open]);
  const close = () => {
    setOpen(false);
    refocus();
  };

  useEffect(() => {
    const onKey = (e) => {
      // (the tour, running, has the keys: components/tour; but a stop that
      // says "press ?" lets it through, and ends itself as it does)
      const touring = document.documentElement.dataset.touring;
      if (typing(e.target) || (touring != null && touring !== 'release')) return;
      if (e.key === '?') {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === 'Escape' && openRef.current) {
        // the guide's Escape: not the page's too (the map would back out)
        e.preventDefault();
        e.stopImmediatePropagation();
        setOpen(false);
        refocusRef.current();
      }
    };
    const onOpen = (e) => {
      if (e.detail?.toggle) return setOpen((o) => !o);
      setTab(e.detail?.tab ?? null);
      setOpen(true);
    };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('tp:guide', onOpen);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('tp:guide', onOpen);
    };
  }, []);
  useEffect(() => setOpen(false), [pathname]);
  // (asked for a tab once; the next opening is on this page's)
  useEffect(() => {
    if (!open) setTab(null);
  }, [open]);

  // The note, the first time on a page with controls: once the page is
  // uncovered and nothing's asking a question over it. It goes after a while,
  // on a press, or when the guide opens, and isn't shown on that page again.
  const [nudge, setNudge] = useState(false);
  // (not in a world with basics: they end at the button themselves)
  const nudgeKey = meta?.nudge && !BRIEFED.has(meta.key) ? meta.key : null;
  useEffect(() => {
    setNudge(false);
    if (!nudgeKey) return undefined;
    const seen = local.get(SEEN_KEY, []);
    const list = Array.isArray(seen) ? seen : [];
    if (list.includes(nudgeKey)) return undefined;
    let hide = 0;
    const show = setInterval(() => {
      const html = document.documentElement;
      if ('covered' in html.dataset || 'intro' in html.dataset || 'menu' in html.dataset || document.querySelector('[aria-modal="true"]')) return;
      clearInterval(show);
      local.set(SEEN_KEY, [...list, nudgeKey].slice(-60));
      loadPanel(); // (it's likely to be opened next)
      setNudge(true);
      hide = setTimeout(() => setNudge(false), 9000);
    }, 1800);
    return () => {
      clearInterval(show);
      clearTimeout(hide);
    };
  }, [nudgeKey]);
  useEffect(() => {
    if (open) setNudge(false);
  }, [open]);

  // On a phone the button tucks away while you scroll down the page (so it
  // never sits over a game's controls) and comes back when you scroll up.
  // (once a frame at most, and only when it changes)
  const [tucked, setTucked] = useState(false);
  useEffect(() => {
    let last = window.scrollY;
    let now = false;
    let frame = 0;
    const set = (v) => {
      if (v === now) return;
      now = v;
      setTucked(v);
    };
    const check = () => {
      frame = 0;
      const y = window.scrollY;
      if (y < 160) set(false);
      else if (y > last + 8) set(true);
      else if (y < last - 8) set(false);
      if (Math.abs(y - last) > 8) last = y;
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(check);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  return (
    <>
      <button
        ref={button}
        type="button"
        className="guide-btn"
        data-tour="guide"
        data-tucked={(tucked && !open) || undefined}
        data-nudge={nudge || undefined}
        onClick={() => setOpen((o) => !o)}
        onPointerEnter={loadPanel}
        onFocus={loadPanel}
        aria-expanded={open}
        aria-controls={open ? 'guide-panel' : undefined}
        aria-keyshortcuts="?"
        aria-label={meta ? `Guide: controls and tips for ${meta.title}` : 'Guide: how this site works'}
        data-tip="Guide (?)"
        data-tip-side="left"
      >
        <IconGuide className="h-5 w-5" aria-hidden="true" />
      </button>
      {nudge && !open && meta && (
        <div className="guide-nudge notice" role="status">
          <button type="button" className="guide-nudge-open" onClick={() => setOpen(true)}>
            <span className="guide-nudge-kicker">New here?</span>
            <span>
              The controls for {meta.title} are in the guide. Press <kbd className="kbd">?</kbd> any time.
            </span>
          </button>
          <CloseButton onClick={() => setNudge(false)} />
        </div>
      )}
      {open && (
        <Suspense fallback={null}>
          <GuidePanel key={tab ?? 'page'} pathname={pathname} initialTab={tab} close={close} onLeave={() => setOpen(false)} />
        </Suspense>
      )}
    </>
  );
}
