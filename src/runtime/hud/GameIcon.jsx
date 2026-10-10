import { icon } from '../../lib/bf2017/icons';

// One of the 2017 game's icons (src/lib/bf2017/icons.js) by its name or the
// site's, drawn from its sprite in the text's colour; `fallback` (the site's
// own glyph) where the game has none.
export default function GameIcon({ name, fallback = null, className = '', title = '' }) {
  const ic = icon(name);
  if (!ic) return fallback;
  return (
    <svg className={`game-icon ${className}`.trim()} aria-hidden={title ? undefined : 'true'} role={title ? 'img' : undefined} aria-label={title || undefined} focusable="false">
      <use href={ic.href} />
    </svg>
  );
}
