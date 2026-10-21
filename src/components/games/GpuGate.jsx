import { useCallback, useEffect, useState } from 'react';
import { RiCpuLine, RiFileCopyLine, RiRefreshLine, RiRestartLine } from 'react-icons/ri';
import { reprobe, use3D } from '../../lib/gpu';
import { storage, useInView } from '../../lib/hooks';
import { STEPS, thisBrowser } from './accel';
import './games.css';

// The door to a game that only draws in WebGL. With a graphics chip the game
// plays; without one (hardware acceleration switched off, or no WebGL at
// all) the visitor gets an apology and the steps to turn it on in their own
// browser, instead of a game that crawls or a blank box. If the GPU goes
// away mid-game, the game reports it here and gets a Restart button.
//
// The game itself only mounts (and starts downloading its models and
// textures) once its frame comes within a screen and a half of the view, so
// opening a page doesn't fetch a game the visitor hasn't scrolled to; until
// then the frame holds its place, the same size.
//
// children({ soft, fail }): soft is true when the game is running on
// software WebGL because the visitor asked to play anyway; fail(reason)
// ('lost' or 'failed') hands the frame back to the gate. `extra` goes after
// each card's own buttons (a way back, for a game that fills the screen).

const ANYWAY = 'tp-gl-anyway';

function Steps({ status }) {
  const here = thisBrowser();
  const [copied, setCopied] = useState(false);
  const own = STEPS[here];
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(own.settings);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className="gate-steps">
      <p className="gate-lede">
        {status === 'software'
          ? 'Your browser is drawing without the graphics chip right now, which usually means hardware acceleration has been switched off. Turn it on and this plays in full 3D.'
          : 'This browser isn’t giving the page WebGL, the 3D graphics this game is drawn with. Usually that means hardware acceleration is off, or WebGL has been blocked.'}
      </p>
      <p className="gate-how">In {own.name}:</p>
      <ol className="gate-list">
        {own.steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      {own.settings && (
        <p className="gate-addr">
          Or paste <code>{own.settings}</code> into the address bar.
          <button type="button" className="gate-copy" onClick={copy} aria-label={`Copy ${own.settings}`}>
            <RiFileCopyLine aria-hidden="true" />
            {copied ? 'Copied' : 'Copy'}
          </button>
        </p>
      )}
      <details className="gate-more">
        <summary>Other browsers</summary>
        {Object.entries(STEPS)
          .filter(([id]) => id !== here && id !== 'other')
          .map(([id, b]) => (
            <div key={id} className="gate-other">
              <p className="gate-how">{b.name}</p>
              <p>{b.steps.join(' ')}</p>
            </div>
          ))}
      </details>
    </div>
  );
}

function Card({ title, children, actions, className = '' }) {
  return (
    <div className={`gate dark-scope ${className}`} role="group" aria-label={title}>
      <div className="gate-card">
        <span className="gate-icon" aria-hidden="true">
          <RiCpuLine />
        </span>
        <p className="gate-title">{title}</p>
        {children}
        <div className="gate-actions">{actions}</div>
      </div>
    </div>
  );
}

// The frame that holds the game's place until it comes within a screen and a
// half of the view. Its own component, so it watches from whenever it first
// shows, after one of the cards as much as at the start.
function Waiting({ className, onNear }) {
  const [frame, near] = useInView({ once: true, rootMargin: '150% 0px 150% 0px' });
  useEffect(() => {
    if (near) onNear();
  }, [near, onNear]);
  return <div ref={frame} className={`gate dark-scope ${className}`} aria-hidden="true" />;
}

export default function GpuGate({ children, className = '', extra = null }) {
  const three = use3D();
  const [anyway, setAnyway] = useState(() => storage.get(ANYWAY, false) === true);
  const [failure, setFailure] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const [note, setNote] = useState('');
  const fail = useCallback((reason) => setFailure(reason === 'lost' ? 'lost' : 'failed'), []);
  const [near, setNear] = useState(false);
  const isNear = useCallback(() => setNear(true), []);

  const status = three.status;
  const soft = status === 'software';
  const allowed = status === 'ok' || (soft && (anyway || three.mode === 'on'));

  const checkAgain = () => {
    const info = reprobe();
    setNote(info.ok ? '' : info.webgl ? 'Still drawing without the graphics chip. If you’ve just changed the setting, restart the browser first.' : 'Still no WebGL. If you’ve just changed the setting, restart the browser first.');
    if (info.ok) {
      setFailure(null);
      setAttempt((n) => n + 1);
    }
  };
  const playAnyway = () => {
    storage.set(ANYWAY, true);
    setAnyway(true);
    setFailure(null);
    setAttempt((n) => n + 1);
  };
  const restart = () => {
    setFailure(null);
    setAttempt((n) => n + 1);
  };

  // the world round the game is waiting to be asked before it downloads 3D
  // (a phone, Data Saver, short of space: components/worlds/WorldGate)
  if (three.held && three.mode !== 'off')
    return (
      <Card
        className={className}
        title="This game is drawn in 3D."
        actions={
          <>
            <button type="button" className="btn btn-primary btn-sm" onClick={three.hold.load}>
              Load the 3D{three.hold.mb ? ` (about ${three.hold.mb} MB)` : ''}
            </button>
            {extra}
          </>
        }
      >
        <p className="gate-lede">To save your data and battery, {three.hold.name ?? 'this world'} hasn’t downloaded its 3D yet. Load it to play.</p>
      </Card>
    );

  if (three.mode === 'off')
    return (
      <Card
        className={className}
        title="3D graphics are switched off on this site."
        actions={
          <>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => three.set('auto')}>
              Turn 3D back on
            </button>
            {extra}
          </>
        }
      >
        <p className="gate-lede">You turned them off under one of the games. This one only comes in 3D.</p>
      </Card>
    );

  if (!allowed)
    return (
      <Card
        className={className}
        title="Sorry, this game needs hardware acceleration on."
        actions={
          <>
            <button type="button" className="btn btn-primary btn-sm" onClick={checkAgain}>
              <RiRefreshLine aria-hidden="true" /> Check again
            </button>
            {soft && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={playAnyway}>
                Play anyway (slow)
              </button>
            )}
            {extra}
          </>
        }
      >
        <Steps status={status} />
        <p className="gate-note" role="status">
          {note}
        </p>
      </Card>
    );

  if (failure)
    return (
      <Card
        className={className}
        title={failure === 'lost' ? 'The graphics chip reset.' : 'Sorry, the 3D couldn’t start here.'}
        actions={
          <>
            <button type="button" className="btn btn-primary btn-sm" onClick={restart}>
              <RiRestartLine aria-hidden="true" /> {failure === 'lost' ? 'Restart the game' : 'Try again'}
            </button>
            {extra}
          </>
        }
      >
        {failure === 'lost' ? <p className="gate-lede">That happens after a driver update, when the computer wakes from sleep, or with a lot of tabs open.</p> : soft ? <Steps status={status} /> : <p className="gate-lede">Something in this browser stopped the 3D from starting. Reloading the page usually clears it.</p>}
      </Card>
    );

  if (!near) return <Waiting className={className} onNear={isNear} />;

  return <div key={attempt} className="contents">{children({ soft, fail })}</div>;
}
