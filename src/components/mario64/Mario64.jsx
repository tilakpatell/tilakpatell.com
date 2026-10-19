import { useCallback, useEffect, useRef, useState } from 'react';
import '@fontsource/luckiest-guy/400.css';
import { useAchievements } from '../Achievements';
import { audioContext } from '../../lib/audio';
import { useMediaQuery } from '../../lib/hooks';
import { useVoiced } from '../../lib/useVoiced';
import { WorldHost, useWorld } from '../../runtime';
import { Exit, PlayersChip, Stick, TouchButton } from '../../runtime/hud';
import { useTravellers } from '../middleearth/shared/travellers';
import GuideCue from '../guide/GuideCue';
import { KeyTable } from '../guide/KeyTable';
import { TRIBUTE_KEYS, TRIBUTE_PAD, TRIBUTE_TOUCH } from '../guide/mario64';
import module from './module';
import { VOICE } from './voicelines';
import './mario64.css';

// The Mario 64 tribute, on the page or over the island: the world module
// (./module.js) in its box, and over it the HUD (the power meter, lives,
// coins, stars, red coins, air), the title, a painting's card, dialogs, the
// pause menu with the looks and the sound, "Star get!", game over, and a
// touch pad (a stick, A, B, Z, the camera) on phones.
//
// <Mario64 mode="page" | "overlay" onExit />

// the room for the others online: Bob-omb Battlefield and the grounds reach
// some 76 m from their middles, and Mario jumps (his height goes too)
const ROOM = { bound: 90, motion: true };
const LORE = { off: 'Go online, and see everyone else in the area you’re in as a pale Mario, with their name over him', on: 'Everyone else online in the area you’re in, as pale Marios: nothing passes between you but where each of you is' };

const LOOKS = [
  ['modern', 'Modern'],
  ['ultra', 'Ultra'],
  ['n64', 'N64'],
];
// The pause screen's Controls are the guide's own rows for the tribute
// (guide/mario64.js, read by the guide's /dot-matrix/64 page too), so the
// keys are written once: the keyboard's, or the touch pad's on a phone, and
// the controller's line.
const tributeRows = (touch) => (touch ? TRIBUTE_TOUCH : TRIBUTE_KEYS);
const PAD_LINE = TRIBUTE_PAD;

function Meter({ health, air }) {
  const value = air != null ? air : health;
  const full = value >= 8 && air == null;
  const color = value > 6 ? '#3b82f6' : value > 4 ? '#22c55e' : value > 2 ? '#facc15' : '#ef4444';
  const wedges = Array.from({ length: 8 }, (_, i) => {
    const a0 = (i / 8) * Math.PI * 2 - Math.PI / 2;
    const a1 = ((i + 1) / 8) * Math.PI * 2 - Math.PI / 2;
    const r = 26;
    const p = (a) => `${32 + Math.cos(a) * r} ${32 + Math.sin(a) * r}`;
    return <path key={i} d={`M32 32 L${p(a0 + 0.04)} A${r} ${r} 0 0 1 ${p(a1 - 0.04)} Z`} fill={i < Math.ceil(value) ? color : 'rgba(20,20,30,0.55)'} />;
  });
  return (
    <div className="m64-meter" data-full={full || undefined} aria-label={`Power ${Math.ceil(value)} of 8`}>
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <circle cx="32" cy="32" r="30" fill="#f5f5f5" />
        {wedges}
        <circle cx="32" cy="32" r="10" fill="#f5f5f5" />
        <text x="32" y="37" textAnchor="middle" className="m64-meter-n">
          {air != null ? 'AIR' : Math.ceil(value)}
        </text>
      </svg>
    </div>
  );
}

function StarIcon({ got = true }) {
  return (
    <svg viewBox="0 0 24 24" className="m64-star" data-got={got || undefined} aria-hidden="true">
      <path d="M12 1.6l3.1 6.9 7.5.7-5.7 5 1.7 7.4L12 17.7l-6.6 3.9 1.7-7.4-5.7-5 7.5-.7z" />
    </svg>
  );
}

export default function Mario64({ mode = 'page', onExit = null }) {
  const touch = useMediaQuery('(hover: none) and (pointer: coarse)');
  const { unlock } = useAchievements();
  const [ui, setUi] = useState({ mode: 'loading' });
  // Toad, the king and Peach's note in their own voices, where they've been made (lib/voiced.js), with the sound on
  useVoiced(VOICE[ui.dialog?.title], ui.mode === 'dialog' && ui.sound !== false ? ui.dialog?.text : null);
  const [hud, setHud] = useState(null);
  const [fade, setFade] = useState(false);
  const [help, setHelp] = useState(false);
  const [props] = useState(() => ({ small: touch }));

  const onEvent = useCallback(
    (e) => {
      if (e.type === 'ui') setUi(e);
      else if (e.type === 'hud') setHud(e);
      else if (e.type === 'fade') setFade(e.on);
      else if (e.type === 'achievement') unlock(e.id);
    },
    [unlock],
  );
  const { host, status, rt } = useWorld(module, { props, onEvent });
  const api = useCallback(() => (rt?.current?.module === module ? rt.current.world : null), [rt]);
  // the others online in the area you're in (middleearth/towns/useTravellers),
  // as pale Marios: the world sends where you are and draws them (./online.js),
  // through the link it's handed; people jump, and the grounds reach some 76 m
  const trav = useTravellers('mario64', status === 'on', ROOM);
  const travRef = trav.ref;
  useEffect(() => {
    if (status === 'on') api()?.online?.(() => travRef.current);
  }, [status, api, travRef]);

  // the first touch or key wakes the audio
  const wake = () => audioContext();

  // Esc at the title (or the button) leaves; elsewhere it pauses (the module's)
  useEffect(() => {
    const onKey = (e) => {
      if (e.code === 'Escape' && ui.mode === 'title' && onExit) onExit();
      if (ui.mode === 'title' && (e.code === 'Enter' || e.code === 'Space')) api()?.start();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ui.mode, onExit, api]);

  // the wheel zooms the camera
  const wheelAt = useRef(0);
  const onWheel = (e) => {
    const now = performance.now();
    if (now - wheelAt.current < 250 || Math.abs(e.deltaY) < 4) return;
    wheelAt.current = now;
    api()?.zoom();
  };

  // ── the touch pad: the HUD kit's stick and buttons in Mario's own sizes ──
  // (full tilt 64 px out, the ring's radius, as Mario's own stick had it)
  const onStick = (x, y) => api()?.stick(x, -y);
  const button = (name) => ({
    onPress: (e) => {
      e.preventDefault(); // (no focus, no mouse events after the touch)
      wake();
      api()?.press(name, true);
    },
    onRelease: () => api()?.press(name, false),
  });

  const playing = ui.mode === 'play';
  const paused = ui.mode === 'pause';
  const course = ui.course;

  return (
    <div className="m64" data-mode={mode} onPointerDown={wake} onKeyDown={wake}>
      <WorldHost world={{ host }} className="m64-stage" onWheel={onWheel}>
        {status !== 'on' && status !== 'failed' && status !== 'lost' && (
          <div className="m64-loading" role="status">
            <span className="m64-logo-sm">Super Mario 64</span>
            <span>Loading the castle…</span>
          </div>
        )}
        {(status === 'failed' || status === 'lost') && (
          <div className="m64-loading" role="alert">
            <span className="m64-logo-sm">Super Mario 64</span>
            <span>{status === 'lost' ? 'The graphics chip reset.' : 'The game couldn’t start its 3D here.'}</span>
            {onExit && (
              <button type="button" className="m64-btn" onClick={onExit}>
                Back
              </button>
            )}
          </div>
        )}

        {hud && (playing || paused || ui.mode === 'dialog' || ui.mode === 'starget') && (
          <div className="m64-hud" aria-hidden={paused || undefined}>
            <div className="m64-hud-left">
              <div className="m64-count">
                <span className="m64-mario-icon">M</span>
                <span className="m64-x">×</span>
                <span>{hud.lives}</span>
              </div>
              <div className="m64-count">
                <span className="m64-coin-icon" />
                <span className="m64-x">×</span>
                <span>{hud.coins}</span>
              </div>
            </div>
            {(hud.health < 8 || hud.air != null) && <Meter health={hud.health} air={hud.air} />}
            <div className="m64-hud-right">
              <div className="m64-count">
                <StarIcon />
                <span className="m64-x">×</span>
                <span>{hud.stars}</span>
              </div>
              <PlayersChip className="m64-players" count={trav.count} allies={trav.allies} on={trav.on} onJoin={trav.join} available={trav.available} noun="Marios" lore={LORE} />
              {course && hud.reds > 0 && (
                <div className="m64-reds" aria-label={`${hud.reds} of 8 red coins`}>
                  {Array.from({ length: 8 }, (_, i) => (
                    <span key={i} data-got={i < hud.reds || undefined} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {course && playing && <div className="m64-course-name">{course.name}</div>}

        {ui.mode === 'title' && (
          <div className="m64-title">
            <h1 className="m64-logo" aria-label="Super Mario 64">
              <span className="m64-logo-super">Super</span>
              <span className="m64-logo-mario">
                {'MARIO'.split('').map((c, i) => (
                  <span key={i} data-i={i}>
                    {c}
                  </span>
                ))}
              </span>
              <span className="m64-logo-64">64</span>
            </h1>
            <p className="m64-sub">A fan tribute, made for this site</p>
            <button type="button" className="m64-start" onClick={() => api()?.start()} autoFocus>
              {touch ? 'Tap to start' : 'Press Start'}
            </button>
            <div className="m64-title-row">
              {LOOKS.map(([id, label]) => (
                <button key={id} type="button" className="m64-chip" aria-pressed={ui.look === id} onClick={() => api()?.setLook(id)}>
                  {label}
                </button>
              ))}
              <button type="button" className="m64-chip" aria-pressed={ui.sound} onClick={() => api()?.setSound(!ui.sound)}>
                Sound {ui.sound ? 'on' : 'off'}
              </button>
              {/* (Esc leaves from the title, so it says so) */}
              {onExit && <Exit label="Back to the island" onLeave={onExit} touch={touch} className="m64-chip" />}
            </div>
          </div>
        )}

        {ui.mode === 'card' && ui.card && (
          <div className="m64-card" role="dialog" aria-label={ui.card.name}>
            <p className="m64-card-kicker">{ui.card.live ? 'Into the painting' : 'Coming soon'}</p>
            <h2>{ui.card.name}</h2>
            <ol className="m64-card-stars">
              {ui.card.stars.map((s, i) => (
                <li key={i} data-got={s.got || undefined}>
                  <StarIcon got={s.got} />
                  <span>{s.name}</span>
                </li>
              ))}
            </ol>
            {!ui.card.live && <p className="m64-card-soon">This world is still being painted. Bob-omb Ridge is open.</p>}
            <div className="m64-card-go">
              {ui.card.live ? (
                <>
                  <button type="button" className="m64-btn" onClick={() => api()?.advance()} autoFocus>
                    Go in (A)
                  </button>
                  <button type="button" className="m64-btn m64-btn-ghost" onClick={() => api()?.back()}>
                    Back (B)
                  </button>
                </>
              ) : (
                <button type="button" className="m64-btn" onClick={() => api()?.advance()} autoFocus>
                  OK (A)
                </button>
              )}
            </div>
          </div>
        )}

        {ui.mode === 'dialog' && ui.dialog && (
          <button type="button" className="m64-dialog" onClick={() => api()?.advance()}>
            <span className="m64-dialog-title">{ui.dialog.title}</span>
            <span className="m64-dialog-text">{ui.dialog.text}</span>
            <span className="m64-dialog-next" aria-hidden="true">
              ▼
            </span>
          </button>
        )}

        {ui.mode === 'starget' && ui.got && (
          <div className="m64-starget" role="status">
            <StarIcon />
            <p className="m64-starget-big">Star get!</p>
            <p className="m64-starget-name">{ui.got.name}</p>
          </div>
        )}

        {ui.mode === 'over' && (
          <div className="m64-over" role="status">
            <p>Game over</p>
            <button type="button" className="m64-btn" onClick={() => api()?.advance()} autoFocus>
              Continue
            </button>
          </div>
        )}

        {paused && (
          <div className="m64-pause" role="dialog" aria-modal="true" aria-label="Paused">
            <h2>Paused</h2>
            <button type="button" className="m64-btn" onClick={() => api()?.pause(false)} autoFocus>
              Continue
            </button>
            {course && (
              <button type="button" className="m64-btn m64-btn-ghost" onClick={() => api()?.exitCourse()}>
                Exit {course.name}
              </button>
            )}
            <div className="m64-pause-row" role="group" aria-label="Look">
              {LOOKS.map(([id, label]) => (
                <button key={id} type="button" className="m64-chip" aria-pressed={ui.look === id} onClick={() => api()?.setLook(id)}>
                  {label}
                </button>
              ))}
            </div>
            <div className="m64-pause-row">
              <button type="button" className="m64-chip" aria-pressed={ui.sound} onClick={() => api()?.setSound(!ui.sound)}>
                Sound {ui.sound ? 'on' : 'off'}
              </button>
              <button type="button" className="m64-chip" aria-pressed={help} onClick={() => setHelp((v) => !v)}>
                Controls
              </button>
              {onExit && (
                <button type="button" className="m64-chip" onClick={onExit}>
                  Back to the island
                </button>
              )}
            </div>
            {help && (
              <>
                <KeyTable rows={tributeRows(touch)} className="m64-controls" />
                <p className="m64-controls-pad">
                  {PAD_LINE}
                  {/* (over the island the overlay hides the "?", and its guide is the island's) */}
                  {mode === 'page' && <GuideCue touch={touch} />}
                </p>
              </>
            )}
          </div>
        )}

        <div className="m64-fade" data-on={fade || ui.loading || undefined} aria-hidden="true" />

        {touch && (playing || ui.mode === 'dialog' || ui.mode === 'card') && (
          <div className="m64-pad">
            <Stick className="m64-stick" label="Run" reach={64} onStart={wake} onMove={onStick} />
            <div className="m64-cam">
              <TouchButton className="m64-key" aria-label="Turn the camera left" {...button('camL')}>
                ⟲
              </TouchButton>
              <TouchButton className="m64-key" aria-label="Turn the camera right" {...button('camR')}>
                ⟳
              </TouchButton>
            </div>
            <div className="m64-abz">
              <TouchButton className="m64-key m64-key-z" {...button('z')}>
                Z
              </TouchButton>
              <TouchButton className="m64-key m64-key-b" {...button('b')}>
                B
              </TouchButton>
              <TouchButton className="m64-key m64-key-a" {...button('a')}>
                A
              </TouchButton>
            </div>
          </div>
        )}
        {(playing || paused) && (
          <button type="button" className="m64-pause-btn" aria-label={paused ? 'Continue' : 'Pause'} onClick={() => api()?.pause(!paused)}>
            {paused ? '▶' : '❚❚'}
          </button>
        )}
      </WorldHost>
    </div>
  );
}
