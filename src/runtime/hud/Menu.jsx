import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { onVoicesChange, setVoicesOn, voicesOn } from '../../lib/audio';
import { openGuide } from '../../lib/palette';
import PlayersChip from './PlayersChip';

// A world's one Menu, top right: the world's own settings first (as
// children: <MenuItem>s), then the voices switch (`voices`), Things to do, Controls (the site's guide, so
// the keys are written once, in guide/pages.js), the other players and the
// way out of the world. All plain values (the kit imports nothing from a
// world or the shell): `todo`: { onOpen, done, total, label } (a world's
// canon name for its list, Passport or Cartridges, as its label; "Things to
// do" otherwise); `players`: PlayersChip's { count, on, onJoin, available };
// `way`: { label, to }, the way out for the view the visitor is in
// ("Universe map" or "Classic site": components/worlds wayOut). Closes on a click anywhere else, on Esc (that
// Esc is the menu's: the world doesn't also back out of something), or on
// picking something; the focus goes back to its button. A disclosure, not
// an ARIA menu: its entries are plain buttons and links, Tab between them.
export default function Menu({ label = 'Menu', todo = null, voices = true, controls = true, players = null, noun = 'players', lore = null, way = null, className = '', children = null }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const button = useRef(null);
  const id = useId();
  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const esc = (e) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopImmediatePropagation();
      setOpen(false);
      button.current?.focus();
    };
    window.addEventListener('pointerdown', away);
    window.addEventListener('keydown', esc, true);
    return () => {
      window.removeEventListener('pointerdown', away);
      window.removeEventListener('keydown', esc, true);
    };
  }, [open]);
  const close = () => {
    // (back to the button if the focus was in the list, so a keyboard isn't dropped on the page)
    const inside = ref.current?.contains(document.activeElement);
    setOpen(false);
    if (inside) button.current?.focus();
  };

  return (
    <div className={`hud-menu ${className}`.trim()} ref={ref}>
      <button ref={button} type="button" className="hud-btn" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-controls={id}>
        {label}
      </button>
      {open && (
        // (a click on an item closes the menu after the item has done its thing)
        <div className="hud-menu-list" id={id} onClick={(e) => e.target.closest('[data-keep]') || close()}>
          {children}
          {voices && <VoicesItem />}
          {todo && (
            <button type="button" onClick={todo.onOpen}>
              {todo.label ?? 'Things to do'}
              {todo.total ? ` · ${todo.done ?? 0}/${todo.total}` : ''}
            </button>
          )}
          {controls && (
            <button type="button" onClick={openGuide} aria-keyshortcuts="?">
              Controls
            </button>
          )}
          {players && <PlayersChip {...players} noun={noun} lore={lore} item />}
          {way && <Link to={way.to}>{way.label}</Link>}
        </div>
      )}
    </div>
  );
}

// One of a world's own entries in the Menu. `keep`: the menu stays open
// after it (a setting that cycles, read off the item itself).
export function MenuItem({ onClick, keep = false, children, ...rest }) {
  return (
    <button type="button" onClick={onClick} data-keep={keep || undefined} {...rest}>
      {children}
    </button>
  );
}

// The voices on or off, the site's own switch (lib/audio's voicesOn, which
// the settings panel and ⌘K switch too): what's said still shows.
export function VoicesItem() {
  const [on, setOn] = useState(voicesOn);
  useEffect(() => {
    const stop = onVoicesChange(setOn);
    return () => {
      stop();
    };
  }, []);
  return (
    <button type="button" data-keep aria-pressed={on} onClick={() => setVoicesOn(!on)}>
      Voices {on ? 'on' : 'off'}
    </button>
  );
}
