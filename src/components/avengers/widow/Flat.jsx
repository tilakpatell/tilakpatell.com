import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StartNote, TouchHelp } from '../hq/HQGame';
import Results from '../hq/Results';
import { register } from '../hq/useStage';
import { earnStone, hasEarned, recordTry } from '../hq/stones';
import { useAchievements } from '../../Achievements';
import { prefersReducedMotion } from '../../../lib/hooks';
import { audioContext } from '../../../lib/audio';
import { LEVEL_COUNT, act, biteTargets, newLevel, parseLevel, solveLevel } from './rules';
import { readCleared, recordWin } from './save';
import { CAUGHT, levelEnd } from './ends';
import { IDLE, actionAt, foresee, keyInput, tapInput, tileFromPoint } from './flatInput';
import GridView from './GridView';
import Dossier from './Dossier';
import './widow.css';

// Infiltration in 2D (spec 2026-10-18-avengers-hq-fix-and-hub-design, §8):
// the facility from above over the game's own rules (./flatInput.js), a turn
// a tap or a key, with the step ahead shown (red where it gets her caught) on
// hover and on a first tap, and the same save, stone and end card as the 3D
// game. Nothing animates between turns. HQGame draws it whenever this game's
// own 3D is off, unavailable or failed.

const sfx = () => import('../../../lib/sfx');
const play = (name, ...a) => sfx().then((s) => s[name]?.(...a));

export default function InfiltrationFlat({ paused = false, onLive = null }) {
  const { unlock } = useAchievements();
  const [cleared, setCleared] = useState(readCleared);
  const [index, setIndex] = useState(() => Math.min(readCleared(), LEVEL_COUNT - 1));
  const game = useRef(newLevel(index));
  const [ui, setUi] = useState({ phase: 'menu', result: null, caught: null, fresh: -1 });
  const [input, setInput] = useState(IDLE);
  const [hover, setHover] = useState(null);
  const [, setTick] = useState(0);
  const refresh = () => setTick((n) => n + 1);
  const timers = useRef([]);
  const root = useRef(null);
  const stage = useRef(null);
  const calm = useMemo(() => prefersReducedMotion(), []);
  const playing = ui.phase === 'play' || ui.phase === 'caught';

  useEffect(() => onLive?.(playing), [playing, onLive]);
  useEffect(() => () => onLive?.(false), [onLive]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const enter = useCallback((i) => {
    audioContext(); // in the click, so the first sound can be heard
    recordTry('widow');
    timers.current.forEach(clearTimeout);
    game.current = newLevel(i);
    setIndex(i);
    setInput(IDLE);
    setHover(null);
    setUi({ phase: 'play', result: null, caught: null, fresh: -1 });
    root.current?.focus({ preventScroll: true });
  }, []);

  // the 3D game's sounds on the same events
  const handle = useCallback(
    (events) => {
      const g = game.current;
      for (const e of events) {
        if (e.type === 'takedown') play('hit');
        else if (e.type === 'bite') {
          play('zip');
          play('sizzle');
        } else if (e.type === 'hack') play('beeps');
        else if (e.type === 'file') play('ding');
        else if (e.type === 'locked') play('buzz');
        else if (e.type === 'bump' && (e.why === 'charges' || e.why === 'bite')) play('knock');
        else if (e.type === 'caught') {
          play('alarm');
          setUi((u) => ({ ...u, phase: 'caught', caught: e }));
          // a beat to see what happened, then back to the start
          timers.current.push(
            setTimeout(
              () => {
                recordTry('widow');
                game.current = newLevel(g.index);
                setInput(IDLE);
                setUi((u) => ({ ...u, phase: 'play', caught: null }));
              },
              calm ? 900 : 1250,
            ),
          );
        } else if (e.type === 'won') {
          play('decode');
          const { cleared: c, fresh } = recordWin(e.index);
          setCleared(c);
          setUi((u) => ({ ...u, phase: 'cleared', fresh, result: { turns: e.turns, takedowns: g.takedowns, bites: g.bites, stone: false } }));
        } else if (e.type === 'reward') {
          unlock('widow');
          earnStone('soul-natasha');
          play('stone');
          timers.current.push(setTimeout(() => play('victory'), 600));
          setUi((u) => ({ ...u, result: { ...u.result, stone: true, both: hasEarned('soul') } }));
        }
      }
    },
    [calm, unlock],
  );

  const doAction = useCallback(
    (a) => {
      if (paused || !a || game.current.phase !== 'play') return;
      const ev = act(game.current, a);
      if (!ev.length) return;
      handle(ev);
      setInput(IDLE);
      refresh();
    },
    [paused, handle],
  );

  // ── input: a tile tapped or clicked, the keys on the view ──
  const def = game.current.def;
  const tileAt = (e) => tileFromPoint(stage.current.querySelector('svg').getBoundingClientRect(), e.clientX, e.clientY, def);
  const onPointerMove = (e) => {
    if (e.pointerType !== 'mouse' || ui.phase !== 'play' || paused) return;
    const t = tileAt(e);
    if (t?.x !== hover?.x || t?.y !== hover?.y) setHover(t);
  };
  const onPointerUp = (e) => {
    if (ui.phase !== 'play' || paused || e.target.closest('button')) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const r = tapInput(game.current, input, tileAt(e), { touch: e.pointerType !== 'mouse' });
    setInput(r.input);
    doAction(r.action);
  };
  const onKeyDown = (e) => {
    // (a focused button does what it says; Esc is taken only while the Bite is raised)
    if (e.target.closest('button') || paused) return;
    if (ui.phase === 'menu') {
      if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
        e.preventDefault();
        enter(Math.min(LEVEL_COUNT - 1, cleared));
      }
      return;
    }
    if (ui.phase !== 'play') return;
    if (e.key === 'r' || e.key === 'R') {
      e.preventDefault();
      enter(index);
      return;
    }
    const r = keyInput(game.current, input, e.key);
    if (!r.handled || e.repeat) return;
    e.preventDefault();
    if ((e.key === 'e' || e.key === 'b' || e.key === 'E' || e.key === 'B') && !biteTargets(game.current).length) play('knock');
    setInput(r.input);
    doAction(r.action);
  };
  const toggleBite = () => {
    if (!biteTargets(game.current).length) {
      play('knock');
      return;
    }
    setInput((i) => ({ ...i, armed: null, biting: !i.biting }));
  };

  // browser checks: the level, a turn, and ways to jump to a state
  useEffect(
    () =>
      register('widow-flat', {
        get state() {
          return game.current;
        },
        start: enter,
        act: doAction,
        setState(name) {
          if (name === 'menu') {
            setUi({ phase: 'menu', result: null, caught: null, fresh: -1 });
            return { state: name };
          }
          const m = /^level(\d)$/.exec(name);
          if (m) enter(Number(m[1]) - 1);
          else if (name === 'won') {
            enter(LEVEL_COUNT - 1);
            const g = game.current;
            for (const a of solveLevel(LEVEL_COUNT - 1).actions) {
              const ev = act(g, a);
              if (g.phase !== 'play') {
                handle(ev);
                break;
              }
            }
          }
          refresh();
          return { state: name, phase: game.current.phase, turns: game.current.turns };
        },
      }),
    [enter, doAction, handle],
  );

  const g = game.current;
  const tile = input.armed ?? hover;
  const action = tile && ui.phase === 'play' ? actionAt(g, input, tile) : null;
  const preview = action ? { ...tile, ...foresee(g, action) } : null;
  const nextUnlocked = Math.min(LEVEL_COUNT - 1, cleared);
  const line = input.biting ? 'Widow’s Bite: pick a guard in line (Esc to cancel).' : preview?.danger ? `This step gets you caught.${input.armed ? ' Tap again to go.' : ''}` : input.armed ? 'Tap again to go.' : def.tip;
  const objective = g.file ? 'Get to the lift' : 'Get the file';
  return (
    <div ref={root} className="hq-screen iwf" role="group" tabIndex={0} aria-label="Infiltration in 2D, the facility from above. Arrow keys or W A S D move Natasha one tile; Space waits; E or B, then a direction or a guard, uses the Widow’s Bite; R restarts the level. Click a tile next to her to step there; on a touch screen, tap it twice." onKeyDown={onKeyDown}>
      <div className="iwf-bar" aria-hidden="true">
        <span>
          {String(index + 1).padStart(2, '0')}/{String(LEVEL_COUNT).padStart(2, '0')} · {parseLevel(index).name}
        </span>
        <span>{objective}</span>
        <span>
          {g.turns} turns{def.charges ? ` · ${g.charges} ${g.charges === 1 ? 'bite' : 'bites'}` : ''}
        </span>
      </div>
      <div ref={stage} className="iwf-stage" style={{ touchAction: playing ? 'manipulation' : 'auto' }} onPointerMove={onPointerMove} onPointerLeave={() => setHover(null)} onPointerUp={onPointerUp}>
        <GridView s={g} input={input} preview={preview} />
      </div>
      <p className="iwf-line">{line}</p>
      <div className="iwf-tools">
        <button type="button" className="iw-pad-btn" onClick={() => enter(index)} aria-label="Restart the level" disabled={!playing}>
          ↺
        </button>
        <button type="button" className="iw-pad-btn" onClick={() => doAction({ type: 'wait' })} disabled={ui.phase !== 'play'}>
          Wait
        </button>
        {def.charges > 0 && (
          <button type="button" className="iw-pad-btn" aria-pressed={input.biting} disabled={!g.charges || ui.phase !== 'play'} onClick={toggleBite}>
            Bite
          </button>
        )}
        <button type="button" className="iw-pad-btn" onClick={() => setUi((u) => ({ ...u, phase: 'menu' }))} aria-label="Levels and the file">
          ☰
        </button>
      </div>
      {ui.phase === 'caught' && (
        <div className="iw-alert" role="alert">
          <p className="iw-alert-title">Spotted</p>
          <p className="iw-alert-text">{CAUGHT[ui.caught?.by] ?? ''} Back to the start.</p>
        </div>
      )}
      {playing && paused && (
        <div className="hq-overlay iw-overlay">
          <p className="hq-overlay-title">Paused</p>
          <p className="hq-overlay-text">
            Level {index + 1}, {def.name}.
          </p>
        </div>
      )}
      {ui.phase === 'menu' && (
        <div className="hq-overlay iw-overlay">
          <p className="hq-overlay-kicker">Operations · the holotable · a HYDRA facility</p>
          <p className="hq-overlay-title">Infiltration</p>
          <p className="hq-overlay-text">Plan Natasha’s way in a move at a time: every move she makes, the guards make one too. Tap a tile next to her to step there (twice on a touch screen), or use the arrow keys; Space waits.</p>
          <StartNote />
          <ul className="hq-keys">
            <li>
              <kbd>←</kbd>
              <kbd>↑</kbd>
              <kbd>↓</kbd>
              <kbd>→</kbd> move
            </li>
            <li>
              <kbd>Space</kbd> wait
            </li>
            <li>
              <kbd>E</kbd> Widow’s Bite
            </li>
            <li>
              <kbd>R</kbd> restart
            </li>
            <li>or click a tile next to her</li>
          </ul>
          <TouchHelp game="widow-flat" />
          <button type="button" className="btn btn-primary mt-4" onClick={() => enter(nextUnlocked)}>
            {cleared === 0 ? 'Go in' : cleared >= LEVEL_COUNT ? 'Play again' : `Level ${nextUnlocked + 1}`}
          </button>
          <Dossier cleared={cleared} fresh={-1} onPick={enter} />
        </div>
      )}
      {ui.phase === 'cleared' && (
        <Results
          className="iw-overlay"
          {...levelEnd(ui.result, index)}
          onAgain={() => enter(index)}
          onward={index + 1 < LEVEL_COUNT ? { label: 'Next level', onClick: () => enter(index + 1) } : null}
          more={{ label: 'All levels', onClick: () => setUi((u) => ({ ...u, phase: 'menu' })) }}
        >
          <Dossier cleared={cleared} fresh={ui.fresh} onPick={enter} />
        </Results>
      )}
      <p className="sr-only" role="status">
        {paused && playing ? 'Paused.' : ui.phase === 'play' ? `Level ${index + 1}, ${def.name}. ${objective}. ${g.turns} turns.${def.charges ? ` ${g.charges} bites left.` : ''}${preview?.danger ? ' This step gets you caught.' : ''}` : ui.phase === 'caught' ? `Spotted. ${CAUGHT[ui.caught?.by] ?? ''}` : ui.phase === 'cleared' ? `Level ${index + 1} cleared in ${ui.result?.turns} turns.` : ''}
      </p>
    </div>
  );
}
