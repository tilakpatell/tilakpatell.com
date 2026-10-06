import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, NavLink, useLocation, useNavigationType } from 'react-router-dom';
import { RiCheckLine, RiCloseLine, RiGithubFill, RiLinkedinBoxFill, RiLockLine, RiMenuLine, RiMoonClearLine, RiRestartLine, RiSearchLine, RiSunLine, RiTerminalBoxLine } from 'react-icons/ri';
import { openPalette, shortcutLabel } from '../lib/palette';
import { jumpTo } from '../lib/anchors';
import { profile } from '../data/profile';
import { useAchievements } from './Achievements';
import { useTheme } from '../theme/ThemeProvider';
import { useFun } from '../fun/FunProvider';
import { FAN_THEMES, THEMES, THEME_ORDER } from '../theme/themes';
import Wordmark from './Wordmark';
import { CUSTOM_PRESETS } from '../theme/custom';
import { DROPS, dropped, nextFit } from './navFit';
import { restartSite } from '../lib/restart';
import { isFeedMove } from './feed/feed';
import ViewSwitch, { useView } from './ViewSwitch';
import { useAmbienceSetting } from './ambience/setting';

// The universe isn't one of them: the view switch next to the name goes
// there (and back), from wherever you are.
const LINKS = [
  { to: '/experience', label: 'Experience' },
  { to: '/projects', label: 'Projects' },
  { to: '/travel', label: 'Travel' },
  { to: '/contact', label: 'Contact' },
];

// Your own colour: a few presets, or any colour at all. The text drawn in it
// and on it is kept readable (see theme/custom.js).
function CustomColor({ onPick }) {
  const { pinned, customColor, setCustomColor } = useTheme();
  const on = pinned === 'custom';
  return (
    <div className="color-pick" role="group" aria-label="Your own color">
      {CUSTOM_PRESETS.map(([hex, name]) => (
        <button
          key={hex}
          type="button"
          className="color-dot"
          style={{ background: hex }}
          aria-pressed={on && customColor === hex}
          aria-label={name}
          title={name}
          onClick={() => {
            setCustomColor(hex);
            onPick?.();
          }}
        />
      ))}
      <label className="color-input" title="Any color">
        <span className="sr-only">Pick any color</span>
        <input type="color" value={customColor} onChange={(e) => setCustomColor(e.target.value)} />
      </label>
    </div>
  );
}

// Site colours: a small "Auto" control that explains what the colours mean.
// Auto follows the page; picking a company keeps its colours everywhere.
// `compact` lays them out as chips, for the phone menu.
// The themes' backgrounds behind the portfolio pages (components/ambience), on or off.
function AmbienceToggle({ compact }) {
  const [on, set] = useAmbienceSetting();
  if (compact)
    return (
      <button type="button" className="theme-chip mt-3" aria-pressed={on} onClick={() => set(!on)}>
        Theme backgrounds: {on ? 'on' : 'off'}
      </button>
    );
  return (
    <button type="button" className="flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left text-sm hover:bg-[var(--surface-2)]" aria-pressed={on} onClick={() => set(!on)}>
      <span className="flex-1">
        <span className="text-ink">Theme backgrounds</span>
        <span className="block text-xs text-muted">Behind the portfolio pages</span>
      </span>
      <span className="text-xs font-semibold text-muted">{on ? 'On' : 'Off'}</span>
    </button>
  );
}

function ThemeOptions({ onPick, compact = false }) {
  const { active, pinned, pin } = useTheme();
  const { unlocked } = useAchievements();
  const choose = (id) => {
    pin(id);
    onPick?.();
  };
  if (compact) {
    const fans = FAN_THEMES.filter((f) => unlocked.includes(f.achievement));
    const locked = FAN_THEMES.length - fans.length;
    const chip = (id, label, color) => (
      <button key={id ?? 'auto'} type="button" className="theme-chip" aria-pressed={pinned === id || (!pinned && id === null)} onClick={() => choose(id)}>
        <span className="theme-chip-dot" style={{ background: color }} aria-hidden="true" />
        {label}
      </button>
    );
    return (
      <div>
        <div role="group" aria-label="Site colors" className="flex flex-wrap gap-2">
          {chip(null, 'Auto', THEMES[active].fill || THEMES[active].swatch)}
          {THEME_ORDER.map((id) => chip(id, THEMES[id].label, THEMES[id].fill || THEMES[id].swatch))}
          {fans.map((f) => chip(f.id, THEMES[f.id].label, THEMES[f.id].swatch))}
        </div>
        <p className="label mt-4">Your color</p>
        <CustomColor onPick={onPick} />
        <AmbienceToggle compact />
        {locked > 0 && (
          <p className="mt-3 text-xs text-muted">
            {locked} more {locked === 1 ? 'scheme unlocks' : 'schemes unlock'} through easter eggs.
          </p>
        )}
      </div>
    );
  }
  const row = 'flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left text-sm hover:bg-[var(--surface-2)]';
  return (
    <div role="group" aria-label="Site colors">
      <button type="button" className={row} aria-pressed={!pinned} onClick={() => choose(null)}>
        <span className="grid h-4 w-4 place-items-center rounded-full border border-line-strong" aria-hidden="true">
          <span className="h-2 w-2 rounded-full" style={{ background: THEMES[active].fill || THEMES[active].swatch }} />
        </span>
        <span className="flex-1">
          <span className="font-semibold text-ink">Auto</span>
          <span className="block text-xs text-muted">Follows the page you’re on</span>
        </span>
        {!pinned && <RiCheckLine className="h-4 w-4 text-accent" aria-hidden="true" />}
      </button>
      <div className="my-1 h-px bg-[var(--border)]" />
      {THEME_ORDER.map((id) => {
        const t = THEMES[id];
        const on = pinned === id;
        return (
          <button key={id} type="button" className={row} aria-pressed={on} onClick={() => choose(id)}>
            <span className="h-4 w-4 flex-none rounded-full" style={{ background: t.fill || t.swatch }} aria-hidden="true" />
            <span className="flex-1 text-ink">{t.company}</span>
            {on && <RiCheckLine className="h-4 w-4 text-accent" aria-hidden="true" />}
          </button>
        );
      })}
      <div className="my-1 h-px bg-[var(--border)]" />
      <p className="px-2.5 pb-0.5 pt-2 text-xs text-muted">Your color</p>
      <CustomColor onPick={onPick} />
      <div className="my-1 h-px bg-[var(--border)]" />
      <p className="px-2.5 pb-1 pt-2 text-xs text-muted">
        Unlocked by easter eggs: {FAN_THEMES.filter((f) => unlocked.includes(f.achievement)).length} of {FAN_THEMES.length}
      </p>
      {FAN_THEMES.map((f, i) => {
        const t = THEMES[f.id];
        const open = unlocked.includes(f.achievement);
        const on = pinned === f.id;
        // several schemes behind one easter egg show their hint once
        const sharing = FAN_THEMES.filter((g) => g.achievement === f.achievement);
        if (!open && FAN_THEMES.findIndex((g) => g.achievement === f.achievement) !== i) return null;
        return open ? (
          <button key={f.id} type="button" className={row} aria-pressed={on} onClick={() => choose(f.id)}>
            <span className="h-4 w-4 flex-none rounded-full" style={{ background: t.swatch }} aria-hidden="true" />
            <span className="flex-1 text-ink">{t.company}</span>
            {on && <RiCheckLine className="h-4 w-4 text-accent" aria-hidden="true" />}
          </button>
        ) : (
          <div key={f.id} className={`${row} cursor-default opacity-70 hover:bg-transparent`}>
            <RiLockLine className="h-4 w-4 flex-none text-muted" aria-hidden="true" />
            <span className="flex-1 text-muted">
              <span className="sr-only">{sharing.length > 1 ? `${sharing.length} locked themes` : 'Locked theme'}. Hint: </span>
              {f.hint}
              {sharing.length > 1 && <span className="text-xs"> ({sharing.length} schemes)</span>}
            </span>
          </div>
        );
      })}
      <div className="my-1 h-px bg-[var(--border)]" />
      <AmbienceToggle />
    </div>
  );
}

export function ThemePicker({ nameless = false }) {
  const { active, pinned } = useTheme();
  const [open, setOpen] = useState(false);
  const wrap = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const down = (e) => !wrap.current?.contains(e.target) && setOpen(false);
    const key = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', down);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('pointerdown', down);
      document.removeEventListener('keydown', key);
    };
  }, [open]);
  const t = THEMES[active];
  return (
    <div ref={wrap} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="theme-panel"
        className="flex h-9 items-center gap-2 whitespace-nowrap rounded-full px-2.5 text-[0.8125rem] text-muted transition-colors hover:bg-[var(--surface-2)] hover:text-ink"
        title="Site colors"
      >
        <span className="h-3 w-3 rounded-full ring-2 ring-[var(--bg)]" style={{ background: t.fill || t.swatch, boxShadow: '0 0 0 3px var(--border)' }} aria-hidden="true" />
        <span className={nameless ? 'sr-only' : 'theme-pick-label'}>
          <span className="sr-only">Site colors: </span>
          {pinned ? t.label : `Auto · ${t.label}`}
        </span>
      </button>
      {open && (
        <div id="theme-panel" className="card absolute right-0 top-[calc(100%+10px)] z-50 max-h-[calc(100dvh-110px)] w-[19rem] overflow-y-auto p-2" style={{ background: 'var(--surface)' }}>
          <p className="px-2.5 pb-2 pt-1.5 text-xs leading-relaxed text-muted">
            Every color scheme is a company I’ve worked at. On <span className="font-semibold text-ink">Auto</span>, the site follows the
            page: AWS by default, each company as you scroll Experience, and each project’s own colors on its page.
          </p>
          <ThemeOptions onPick={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}

export default function Nav() {
  const location = useLocation();
  const navType = useNavigationType();
  const { pathname } = location;
  const [open, setOpen] = useState(false);
  const [hidden, setHiddenState] = useState(false);
  // the scroll handler calls this every few pixels; it only sets state on a change
  const hiddenNow = useRef(false);
  const setHidden = useCallback((v) => {
    if (v === hiddenNow.current) return;
    hiddenNow.current = v;
    setHiddenState(v);
  }, []);
  const header = useRef(null);
  const bar = useRef(null);
  const menuButton = useRef(null);
  const { mode, toggleMode, active, pinned } = useTheme();
  const { script } = useFun();
  const { view, start } = useView();
  // the name goes to the front of the view you're in: the home page, or the
  // map (at the front door only for whoever picked it, so it doesn't ask again)
  const front = view === 'classic' ? '/home' : start === 'universe' ? '/' : '/universe';

  // The bar never lets its contents spill past its ends (the Résumé button
  // used to stick out of the right end): while they're wider than the bar it
  // lets go of one more thing (navFit.js) and measures again, before the
  // browser paints. Whatever changes the room (the window, the fonts
  // arriving, the colour's name, a script mode) starts it over from all.
  const [fit, setFit] = useState(0);
  const [round, setRound] = useState(0); // a new round measures again even when fit is already 0
  const refit = useCallback(() => {
    setFit(0);
    setRound((r) => r + 1);
  }, []);
  const gone = (item) => dropped(fit, item);
  const collapsed = gone('links');
  // the menu, wherever something in the bar isn't: below lg the bar has no
  // room for Music, Terminal or the colours, and above it the bar may still
  // have let go of Terminal or Music to fit (on a tablet, before, Music and
  // the colours could only be found by searching)
  const menu = collapsed || gone('terminal') || gone('music');
  useLayoutEffect(() => {
    const el = bar.current;
    if (!el) return;
    const next = nextFit(fit, el.scrollWidth > el.clientWidth + 1);
    if (next !== fit) {
      setFit(next);
      return;
    }
    // settled: a menu left open with its button gone (the links came back) closes
    if (open && menuButton.current && getComputedStyle(menuButton.current).display === 'none') setOpen(false);
  }, [fit, round, open]);
  useLayoutEffect(refit, [active, pinned, script, view, refit]);
  useEffect(() => {
    let frame = 0;
    const later = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(refit);
    };
    window.addEventListener('resize', later);
    document.fonts?.addEventListener?.('loadingdone', later);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', later);
      document.fonts?.removeEventListener?.('loadingdone', later);
    };
  }, [refit]);

  useEffect(() => setOpen(false), [pathname]);

  // Hide while reading (scrolling down); come back on scroll up, near the top,
  // when the pointer reaches for it, or when focus moves into it.
  useEffect(() => {
    let lastY = window.scrollY;
    let frame = 0;
    let near = false;
    const hide = setHidden;
    const update = () => {
      frame = 0;
      const y = window.scrollY;
      const dy = y - lastY;
      if (Math.abs(dy) > 6) {
        hide(y > 140 && dy > 0 && !near);
        lastY = y;
      }
      if (y < 140) hide(false);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const onMove = (e) => {
      const n = e.clientY < 90;
      if (n !== near) {
        near = n;
        if (n) hide(false);
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('pointermove', onMove);
    };
  }, [setHidden]);

  // a new page brings it back; the feed moving the address as you read does not
  useEffect(() => {
    if (!isFeedMove(location, navType)) setHidden(false);
  }, [location, navType, setHidden]);

  // The phone menu covers the page: Escape closes it, and the page under it
  // stays put. Focus goes into the menu, the page behind can't be reached
  // (inert: a keyboard or a screen reader stays in the menu and the bar),
  // and closing it puts focus back on the button that opened it.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    const html = document.documentElement;
    const overflow = html.style.overflow;
    html.style.overflow = 'hidden';
    html.dataset.menu = 'open';
    const button = menuButton.current;
    const behind = [document.getElementById('main'), ...document.querySelectorAll('footer')].filter((el) => el && !el.closest('#mobile-menu'));
    for (const el of behind) el.inert = true;
    const into = requestAnimationFrame(() => document.querySelector('#mobile-menu a, #mobile-menu button')?.focus({ preventScroll: true }));
    return () => {
      cancelAnimationFrame(into);
      document.removeEventListener('keydown', onKey);
      html.style.overflow = overflow;
      delete html.dataset.menu;
      for (const el of behind) el.inert = false;
      // (back to the button, unless something else has been picked: a link
      // that went to a new page puts focus on that page)
      const at = document.activeElement;
      if (!at || at === document.body || document.getElementById('mobile-menu')?.contains(at)) button?.focus({ preventScroll: true });
    };
  }, [open]);

  const linkClass = ({ isActive }) =>
    `nav-link whitespace-nowrap rounded-full px-2 py-1.5 text-[0.9rem] font-medium transition-colors lg:px-3.5 ${isActive ? 'is-active' : ''}`;
  const iconBtn = 'nav-icon grid h-9 w-9 place-items-center rounded-full transition-colors';

  return (
    <header
      ref={header}
      className="site-nav fixed inset-x-0 top-0 z-40"
      data-hidden={hidden && !open ? 'true' : 'false'}
      onFocusCapture={() => setHidden(false)}
    >
      <a href="#main" className="skip-link" onClick={(e) => jumpTo(e, 'main', { focus: true })}>
        Skip to content
      </a>
      <div className="nav-shell">
      <nav
        ref={bar}
        className="nav-bar flex h-[52px] items-center justify-between gap-2 rounded-full pl-5 pr-2 md:h-14 md:pl-6 lg:gap-3"
        aria-label="Main"
        data-fit={fit ? DROPS.slice(0, fit).join(' ') : undefined}
      >
        <div className="flex min-w-0 flex-none items-center gap-2 lg:gap-3">
          <Link to={front} className="wordmark flex-none rounded-md" aria-label="Tilak Patel, home">
            <Wordmark />
          </Link>
          <ViewSwitch labels={gone('viewActive') ? 'none' : gone('viewLabel') ? 'active' : 'all'} />
        </div>

        {!collapsed && (
        <div className="hidden flex-none items-center gap-0.5 md:flex">
          {LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} className={linkClass}>
              {l.label}
            </NavLink>
          ))}
          {!gone('music') && (
            <NavLink to="/music" className={({ isActive }) => `${linkClass({ isActive })} hidden lg:inline-block`}>
              Music
            </NavLink>
          )}
          {!gone('terminal') && (
            <NavLink to="/terminal" className={({ isActive }) => `${linkClass({ isActive })} hidden lg:inline-block`}>
              <span className="flex items-center gap-1.5">
                <RiTerminalBoxLine className="h-4 w-4" aria-hidden="true" />
                Terminal
              </span>
            </NavLink>
          )}
        </div>
        )}

        <div className="flex flex-none items-center gap-1">
          <button type="button" onClick={openPalette} className="nav-search hidden md:flex" aria-label={`Search and shortcuts (${shortcutLabel()})`} title={`Search and shortcuts (${shortcutLabel()})`}>
            <RiSearchLine className="h-[18px] w-[18px]" aria-hidden="true" />
            {!gone('kbd') && <kbd className="palette-kbd hidden whitespace-nowrap lg:inline-grid">{shortcutLabel()}</kbd>}
          </button>
          <div className="hidden lg:block">
            <ThemePicker nameless={gone('colorName')} />
          </div>
          {!gone('social') && (
            <>
              <a href={profile.linkedin.url} target="_blank" rel="noopener noreferrer" className={`${iconBtn} hidden xl:grid`} aria-label="LinkedIn" title="LinkedIn">
                <RiLinkedinBoxFill className="h-[18px] w-[18px]" />
              </a>
              <a href={profile.github.url} target="_blank" rel="noopener noreferrer" className={`${iconBtn} hidden xl:grid`} aria-label="GitHub" title="GitHub">
                <RiGithubFill className="h-[18px] w-[18px]" />
              </a>
            </>
          )}
          <button type="button" className={iconBtn} onClick={toggleMode} aria-label={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} title={mode === 'dark' ? 'Light mode' : 'Dark mode'}>
            {mode === 'dark' ? <RiSunLine className="h-[18px] w-[18px]" /> : <RiMoonClearLine className="h-[18px] w-[18px]" />}
          </button>
          <Link to="/resume" className="btn btn-primary btn-sm ml-1 hidden flex-none !rounded-full sm:inline-flex">
            Résumé
          </Link>
          <button
            ref={menuButton}
            type="button"
            className={`${iconBtn} ${menu ? '' : 'lg:hidden'}`}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <RiCloseLine className="h-5 w-5" /> : <RiMenuLine className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      {open &&
        createPortal(
        <div id="mobile-menu" className={`mobile-menu ${menu ? '' : 'lg:hidden'}`}>
          <p className="eyebrow">View the site as</p>
          <ViewSwitch size="menu" className="mt-3" />
          <ul className="mt-5 divide-y divide-[var(--border)]">
            {[{ to: '/home', label: 'Home' }, ...LINKS, { to: '/music', label: 'Music' }, { to: '/terminal', label: 'Terminal' }].map((l) => (
              <li key={l.to}>
                <NavLink to={l.to} end className={({ isActive }) => `stretch-semi flex items-center justify-between py-4 text-lg font-semibold ${isActive ? 'text-ink' : 'text-body'}`}>
                  {l.label}
                  <span aria-hidden="true" className="text-accent">
                    →
                  </span>
                </NavLink>
              </li>
            ))}
          </ul>
          <div className="mt-7">
            <p className="eyebrow">Site colors</p>
            <p className="mt-1 text-sm text-muted">From companies I’ve worked at. Auto follows the page.</p>
            <div className="mt-3">
              <ThemeOptions compact onPick={() => setOpen(false)} />
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/resume" className="btn btn-primary">
              Résumé
            </Link>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setOpen(false);
                openPalette();
              }}
            >
              <RiSearchLine className="h-4 w-4" aria-hidden="true" /> Search
            </button>
            <button type="button" className="btn btn-ghost" onClick={restartSite}>
              <RiRestartLine className="h-4 w-4" aria-hidden="true" /> Start over
            </button>
            <a href={profile.linkedin.url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost w-11 px-0" aria-label="LinkedIn">
              <RiLinkedinBoxFill className="h-5 w-5" />
            </a>
            <a href={profile.github.url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost w-11 px-0" aria-label="GitHub">
              <RiGithubFill className="h-5 w-5" />
            </a>
          </div>
        </div>,
          document.body,
        )}
      </div>
    </header>
  );
}
