import { useContext, useEffect, useRef } from 'react';
import HQFrame from './HQFrame';
import { GameScreen } from './screen';
import { TOUCH_HELP, switchFor, watchHidden } from './gameScreen';
import { hasEarned } from './stones';

// The game screen (spec 2026-10-18-avengers-hq-fix-and-hub-design, §5): a
// building's game over the whole window under one slim bar (the place, the
// game's own 3D switch, Pause while it's playing, and Back with Esc). It wraps
// HQFrame, which Invincible's game still uses as it is. Outside a building
// (no GameScreen) it is the bare frame.

// (the context a building hands its game, kept in ./screen.js so this file exports only components)
export { GameScreen } from './screen';

export function GameBar({ name, onBack, backRef, children }) {
  return (
    <header className="hq-bar">
      <h2 id="hq-bar-title" className="hq-bar-title">
        {name}
      </h2>
      <div className="hq-bar-acts">
        {children}
        <button ref={backRef} type="button" className="btn btn-ghost btn-sm hq-bar-back" onClick={onBack}>
          Back<span className="hq-bar-more"> to the compound</span>{' '}
          <span className="hq-bar-key">
            <kbd>Esc</kbd>
          </span>
        </button>
      </div>
    </header>
  );
}

// The place's line and its stone, in a game's start overlay (and over the toy)
export function StartNote() {
  const screen = useContext(GameScreen);
  if (!screen) return null;
  const { blurb, stone } = screen;
  const won = stone ? hasEarned(stone.id) : false;
  const lead = stone?.half ? `${stone.half} half of the ` : 'the ';
  return (
    <>
      {blurb && <p className="hq-start-blurb">{blurb}</p>}
      {stone && (
        <p className="hq-stone" style={{ '--glow': stone.color }}>
          <span className="stone-dot" aria-hidden="true" />
          {won ? `You won ${lead}${stone.name} back here.` : `Win it, and ${lead}${stone.name} comes back to the compound.`}
        </p>
      )}
    </>
  );
}

// abstract shapes only: a dot, rings, an arrow, chevrons and a rounded rectangle
const ICON = {
  tap: (
    <>
      <circle cx="12" cy="12" r="4" fill="currentColor" />
      <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </>
  ),
  hold: (
    <>
      <circle cx="12" cy="12" r="6" fill="currentColor" />
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="3" opacity="0.6" />
    </>
  ),
  drag: (
    <>
      <circle cx="6" cy="12" r="2.5" fill="currentColor" />
      <path d="M6 12H19M15 8l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  swipe: <path d="M6 7l5 5-5 5M13 7l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />,
  button: <rect x="4" y="7" width="16" height="10" rx="3" fill="none" stroke="currentColor" strokeWidth="2" />,
};

// A game's touch controls, in words and icons (shown on a touch screen, where the key list hides)
export function TouchHelp({ game }) {
  const rows = TOUCH_HELP[game];
  if (!rows?.length) return null;
  return (
    <ul className="hq-touch" aria-label="Touch controls">
      {rows.map(({ icon, text }) => (
        <li key={text}>
          <svg className="hq-touch-icon" viewBox="0 0 24 24" aria-hidden="true">
            {ICON[icon]}
          </svg>
          {text}
        </li>
      ))}
    </ul>
  );
}

export default function HQGame({ game, stage, three, fallback, flat = null, playing = false, paused = false, onPause = null, accent, className = '', children, ...frame }) {
  const screen = useContext(GameScreen);
  const backRef = useRef(null);
  const onPauseRef = useRef(onPause);
  onPauseRef.current = onPause;
  const sw = switchFor({ can: three.can, on: three.on, status: stage.status, flat: Boolean(flat), stone: Boolean(screen?.stone) });
  // (this game's own 3D, never the site's switch, which stays in Settings)
  const act = (next) => (next === 'retry' ? stage.retry() : three.set(next));
  const screenEl = () => stage.wrap?.current?.querySelector('.hq-screen') ?? null;

  // (once, as the game opens: the stage's wrap is a ref, the same each render)
  const wrap = stage.wrap;
  useEffect(() => {
    (wrap?.current?.querySelector('.hq-screen') ?? backRef.current)?.focus({ preventScroll: true });
  }, [wrap]);
  const pausable = Boolean(onPause);
  useEffect(() => {
    if (!playing || paused || !pausable) return undefined;
    return watchHidden(document, () => onPauseRef.current?.(true));
  }, [playing, paused, pausable]);

  const toy = (
    <div className="hq-toy">
      {!flat && <StartNote />}
      {sw.note && (
        <p className="hq-toy-note" role="status">
          {sw.note.text}
          {sw.note.action && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => act(sw.note.action.next)}>
              {sw.note.action.label}
            </button>
          )}
        </p>
      )}
      {flat ?? fallback}
    </div>
  );
  return (
    <div className="hq-full" data-game={game} style={{ '--hq-accent': accent ?? screen?.accent }}>
      {screen && (
        <GameBar name={screen.name} onBack={screen.onBack} backRef={backRef}>
          {sw.bar && (
            <button type="button" className="btn btn-ghost btn-sm" aria-pressed={sw.bar.pressed} onClick={() => act(sw.bar.next)}>
              {sw.bar.label}
            </button>
          )}
          {onPause && playing && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              aria-pressed={paused}
              onClick={() => {
                onPause(!paused);
                if (paused) screenEl()?.focus({ preventScroll: true });
              }}
            >
              {paused ? 'Resume' : 'Pause'}
            </button>
          )}
        </GameBar>
      )}
      <HQFrame stage={stage} three={three} fallback={toy} className={`${className} hq-game-full`.trim()} accent={accent} {...frame}>
        {children}
      </HQFrame>
    </div>
  );
}
