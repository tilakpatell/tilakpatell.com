import { useEffect, useId, useRef } from 'react';
import { focusBack, wrapFocus } from '../../lib/focus';
import { menuKey, stepTab } from './pause.js';

// The pause menu: one place for everything that isn't flying (a world's
// tabs: the ship, the cargo, the map, the settings, help and the site), over
// the world, which the world freezes or not as it likes. While it's shut,
// a faint chip in the top corner says it's there (`chip`); `Escape` is the
// page's to open it with (it backs out of what it has first), and a world's
// own keys open it on a tab (`keys`: { i: 'cargo' }). Open, it's a dialog:
// focus goes in on its tab, Tab stays inside, Escape or Back to flying shuts
// it and gives the focus back; the number keys and, from the tabs, the
// arrows change tab (pause.js's rules). Plain values in, as the kit's parts
// take: `tabs` [{ id, label, mark? }] (`mark`: a dress's own word for the
// tab, drawn beside it: the RV's element symbol), `head` and `foot` (the
// world's lines over and under the body), `dress` (the world's skin, on
// data-dress), and the open tab's body as children.
//
//   <PauseMenu open tab tabs onTab onOpen onClose dress head foot keys enabled chip label resume ownEscape>{body}</PauseMenu>
//     onOpen(tab?): open it (on a tab); onClose(): shut it; enabled: its keys are heard (not under a world's own dialog);
//     ownEscape: a selector for what inside it answers Escape itself while it's there (a record over a tab's body)

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

const typingIn = (el) => el instanceof HTMLElement && (el.isContentEditable || (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) && el.type !== 'range' && el.type !== 'checkbox'));

export default function PauseMenu({ open = false, tab, tabs, onTab, onOpen, onClose, dress = 'house', head = null, foot = null, keys = {}, enabled = true, chip = true, label = 'Menu', resume = 'Back to flying', ownEscape = null, className = '', children = null }) {
  const id = useId();
  const root = useRef(null);
  const ids = tabs.map((t) => t.id);
  // (read inside the listener as they are now: it's made once a change of `open`)
  const now = useRef({});
  now.current = { tab, ids, keys, onTab, onOpen, onClose, ownEscape };

  useEffect(() => {
    if (!enabled && !open) return undefined;
    const onKey = (e) => {
      const { tab: at, ids: list, keys: k, onTab: toTab, onOpen: opening, onClose: closing, ownEscape: own } = now.current;
      if (open && e.key === 'Escape' && own && root.current?.querySelector(own)) return; // (it's that one's Escape)
      const other = document.querySelector('[aria-modal="true"]');
      const act = menuKey(e, {
        open,
        tab: at,
        typing: typingIn(e.target),
        otherDialog: Boolean(other && !root.current?.contains(other)),
        onTabs: Boolean(e.target instanceof Element && e.target.closest?.('[role="tab"]') && root.current?.contains(e.target)),
        keys: k,
      });
      if (!act) {
        if (open && e.key === 'Tab' && root.current) {
          const to = wrapFocus([...root.current.querySelectorAll(FOCUSABLE)], document.activeElement, e.shiftKey);
          if (to) {
            e.preventDefault();
            to.focus();
          }
        }
        return;
      }
      e.preventDefault();
      e.stopImmediatePropagation(); // (the page's own Escape and keys stand down: this one's the menu's)
      if (act.do === 'close') closing?.();
      else if (act.do === 'open') opening?.(act.tab);
      else {
        const to = act.do === 'tab' ? act.id : act.do === 'index' ? list[act.index] : stepTab(list, at, act.by);
        if (!to) return;
        toTab?.(to);
        root.current?.querySelector(`[data-tab="${to}"]`)?.focus({ preventScroll: true });
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [enabled, open]);

  // focus in on its tab as it opens, and back where it was after (or the chip)
  useEffect(() => {
    if (!open) return undefined;
    const was = document.activeElement === document.body ? null : document.activeElement;
    root.current?.querySelector('[role="tab"][aria-selected="true"]')?.focus({ preventScroll: true });
    return () => focusBack(was, () => document.querySelector('.hud-pause-chip'));
  }, [open]);

  if (!open) {
    if (!chip) return null;
    return (
      <button type="button" className={`hud-pause-chip ${className}`.trim()} data-dress={dress} onClick={() => onOpen?.()} aria-haspopup="dialog" aria-keyshortcuts="Escape">
        <kbd className="hud-cap hud-pause-chip-key">Esc</kbd>
        {/* (a touch screen has no Esc: three lines instead) */}
        <svg className="hud-pause-chip-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <span>{label}</span>
      </button>
    );
  }
  const shown = tabs.find((t) => t.id === tab) ?? tabs[0];
  return (
    <div ref={root} className={`hud-pause ${className}`.trim()} data-dress={dress} role="dialog" aria-modal="true" aria-label={label} onPointerDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="hud-pause-tabs" role="tablist" aria-label={label}>
        {tabs.map((t, i) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`${id}-tab-${t.id}`}
            data-tab={t.id}
            aria-selected={t.id === shown.id}
            aria-controls={`${id}-panel`}
            tabIndex={t.id === shown.id ? 0 : -1}
            className="hud-pause-tab"
            style={{ '--i': i }}
            onClick={() => onTab?.(t.id)}
          >
            <span className="hud-pause-tab-n" aria-hidden="true">
              {i + 1}
            </span>
            {t.mark && (
              <span className="hud-pause-tab-mark" aria-hidden="true">
                {t.mark}
              </span>
            )}
            <span className="hud-pause-tab-word">{t.label}</span>
          </button>
        ))}
      </div>
      <div className="hud-pause-panel">
        {head && <div className="hud-pause-head">{head}</div>}
        <div className="hud-pause-body" role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-tab-${shown.id}`} data-tab={shown.id}>
          {children}
        </div>
        <div className="hud-pause-foot">
          <button type="button" className="hud-pause-resume" onClick={() => onClose?.()}>
            <kbd className="hud-cap hud-pause-resume-key">Esc</kbd> {resume}
          </button>
          {foot}
        </div>
      </div>
    </div>
  );
}
