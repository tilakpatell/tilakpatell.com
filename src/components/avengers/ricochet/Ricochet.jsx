import { useCallback, useEffect, useRef, useState } from 'react';
import HQGame, { StartNote, TouchHelp } from '../hq/HQGame';
import Results from '../hq/Results';
import { register, useStage, useStageFrame } from '../hq/useStage';
import gameModule from './module';
import { earnStone, hasEarned, recordTry } from '../hq/stones';
import { useAchievements } from '../../Achievements';
import { useGame3D } from '../hq/useGame3D';
import { audioContext } from '../../../lib/audio';
import { capturePointer } from '../../../lib/pointer';
import { ROOMS, STEP, botsLeft, limitFor, newRoom, stepRoom, throwShield } from './rules';
import { clearReward, loadSave, saveClear } from './save';
import { roomEnd } from './ends';
import './ricochet.css';
import '../../../styles/lazy/avengers.css';

const sfx = () => import('../../../lib/sfx');
const play = (name, ...a) => sfx().then((s) => s[name]?.(...a));
const buzz = (ms) => {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* no vibration */
  }
};
const deg = (r) => (r * 180) / Math.PI;

export default function Ricochet({ fallback }) {
  const three = useGame3D('ricochet');
  const stage = useStage(gameModule, { enabled: three.on, id: 'ricochet', forced: three.mode === 'on', own3D: true });
  const { unlock } = useAchievements();
  const [save, setSave] = useState(loadSave);
  const [index, setIndex] = useState(() => Math.min(loadSave().reached, ROOMS.length) - 1);
  const room = useRef(newRoom(index));
  const aim = useRef({ angle: 0, pointer: false });
  const acc = useRef(0);
  const [ui, setUi] = useState({ phase: 'menu', throws: 0, left: botsLeft(room.current), result: null });
  const [angleShown, setAngleShown] = useState(0);
  const [paused, setPaused] = useState(false);

  const sync = useCallback((extra = {}) => {
    const r = room.current;
    setUi((u) => ({ ...u, phase: r.phase === 'aim' || r.phase === 'flying' ? r.phase : u.phase, throws: r.throws, left: botsLeft(r), ...extra }));
  }, []);

  const enter = useCallback(
    (i) => {
      audioContext(); // in the click, so the clangs can be heard
      recordTry('cap');
      room.current = newRoom(i);
      setIndex(i);
      aim.current.angle = 0;
      acc.current = 0;
      setPaused(false);
      setUi({ phase: 'aim', throws: 0, left: botsLeft(room.current), result: null });
      stage.wrap.current?.querySelector('.hq-screen')?.focus({ preventScroll: true });
    },
    [stage.wrap],
  );

  const doThrow = useCallback(() => {
    const r = room.current;
    if (r.phase !== 'aim' || paused) return;
    audioContext();
    if (throwShield(r, aim.current.angle)) {
      stage.view.current?.startThrow();
      play('zip');
      sync();
    }
  }, [paused, stage.view, sync]);

  useEffect(
    () =>
      register('ricochet', {
        get state() {
          return room.current;
        },
        get view() {
          return stage.view.current;
        },
        enter,
        aim(a) {
          aim.current.angle = a;
        },
        throw: doThrow,
        setState(name) {
          const n = Number(name.replace('room', ''));
          if (n >= 1 && n <= ROOMS.length) enter(n - 1);
          return { state: name };
        },
      }),
    [enter, doThrow, stage.view],
  );

  const handle = useCallback(
    (events) => {
      for (const e of events) {
        switch (e.type) {
          case 'bounce':
            play('clang');
            break;
          case 'down':
            play('knock');
            buzz(20);
            break;
          case 'armor':
            play('clang');
            buzz(30);
            break;
          case 'glass':
            play('shatter');
            break;
          case 'mat':
            play('knock');
            break;
          case 'switch':
            play('beeps');
            break;
          case 'open':
            play('transform');
            break;
          case 'catch':
            play('clang');
            break;
          case 'hostage':
            play('buzz');
            buzz(120);
            break;
          case 'cleared': {
            play('ding');
            const i = room.current.index;
            setSave((s) => saveClear(s, i, e.stars));
            let stone = false;
            const reward = clearReward(i);
            if (reward) {
              unlock(reward.achievement);
              stone = earnStone(reward.stone) || hasEarned(reward.stone);
              play('victory');
            }
            sync({ phase: 'cleared', result: { stars: e.stars, throws: e.throws, catches: e.catches, stone } });
            break;
          }
          case 'failed':
            sync({ phase: 'failed', result: { reason: e.reason } });
            break;
          default:
        }
      }
    },
    [sync, unlock],
  );

  const tick = useCallback(
    (dtMs) => {
      const view = stage.view.current;
      if (!view) return;
      const r = room.current;
      const dt = Math.min(0.05, dtMs / 1000);
      const live = (ui.phase === 'aim' || ui.phase === 'flying') && !paused;
      if (live) {
        acc.current += dt * view.timeScale(dt);
        const events = [];
        while (acc.current >= STEP) {
          acc.current -= STEP;
          events.push(...stepRoom(r, STEP));
        }
        if (events.length) {
          view.fx(events, r);
          handle(events);
          if (r.phase === 'aim' || r.phase === 'flying') sync();
        }
      }
      view.render(r, dt, { angle: live && r.phase === 'aim' ? aim.current.angle : null, assist: index < 3 });
    },
    [handle, index, paused, stage.view, sync, ui.phase],
  );
  useStageFrame(stage, tick, stage.status === 'on' && stage.visible);

  // ── input ──
  const setFromPointer = (e) => {
    const view = stage.view.current;
    if (!view) return;
    const r = e.currentTarget.getBoundingClientRect();
    const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
    const ny = -(((e.clientY - r.top) / r.height) * 2 - 1);
    const a = view.angleAt(nx, ny, room.current);
    if (a != null) {
      aim.current.angle = a;
      setAngleShown(a);
    }
  };
  const live = ui.phase === 'aim' || ui.phase === 'flying';
  const onPointerMove = (e) => {
    if (!live || paused) return;
    if (e.pointerType === 'mouse' || aim.current.pointer) setFromPointer(e);
  };
  const onPointerDown = (e) => {
    if (!live || paused || e.target.closest('button')) return;
    capturePointer(e);
    aim.current.pointer = true;
    setFromPointer(e);
  };
  const onPointerUp = (e) => {
    if (!aim.current.pointer) return;
    aim.current.pointer = false;
    // a click throws; on a touch screen, lifting the finger aims and the button throws
    if (e.pointerType === 'mouse') doThrow();
  };
  const onKeyDown = (e) => {
    const k = e.key.toLowerCase();
    if (!live || paused) return;
    const step = e.shiftKey ? 0.002 : 0.012;
    if (k === 'arrowleft' || k === 'a') {
      e.preventDefault();
      aim.current.angle = Math.max(-1.55, aim.current.angle - step);
      setAngleShown(aim.current.angle);
    } else if (k === 'arrowright' || k === 'd') {
      e.preventDefault();
      aim.current.angle = Math.min(1.55, aim.current.angle + step);
      setAngleShown(aim.current.angle);
    } else if (k === ' ' || k === 'enter') {
      e.preventDefault();
      doThrow();
    } else if (k === 'r') {
      e.preventDefault();
      enter(index);
    }
  };

  const def = ROOMS[index];
  const totalStars = save.stars.reduce((a, b) => a + (b || 0), 0);
  // the bar's Pause, and a hidden tab: as Esc does
  const pause = (p) => {
    aim.current.pointer = false;
    setPaused(p);
  };
  return (
    <HQGame
      game="ricochet"
      playing={live}
      paused={paused}
      onPause={pause}
      stage={stage}
      three={three}
      fallback={fallback}
      className="cap-game"
      label="Ricochet. Move the mouse to aim the shield and click to throw; or use the left and right arrow keys (Shift for fine aim) and Space. On a touch screen, drag to aim and press Throw. R restarts the room."
      screenProps={{ onPointerMove, onPointerDown, onPointerUp, onPointerCancel: () => (aim.current.pointer = false), onKeyDown, style: { touchAction: live ? 'none' : 'auto' } }}
    >
      {live && (
        <div className="cap-hud" aria-hidden="true">
          <div className="cap-room">
            <span className="cap-room-n">
              Room {index + 1}
              <small>/{ROOMS.length}</small>
            </span>
            <span className="cap-room-name">{def.name}</span>
          </div>
          <div className="cap-throws">
            <span className="cap-throws-n">{ui.throws}</span>
            <span className="cap-throws-par">
              throws · par {def.par} · max {limitFor(def)}
            </span>
            <span className="cap-left">{ui.left === 1 ? '1 bot left' : `${ui.left} bots left`}</span>
          </div>
          <p className="cap-tip">{def.tip}</p>
          <span className="cap-angle">{deg(angleShown).toFixed(1)}°</span>
        </div>
      )}
      {live && !paused && (
        <div className="cap-touch" onPointerDown={(e) => e.stopPropagation()}>
          <button type="button" className="cap-touch-btn" onClick={() => enter(index)} aria-label="Restart the room">
            ↺
          </button>
          <button type="button" className="cap-touch-btn cap-touch-throw" onClick={doThrow} disabled={ui.phase !== 'aim'}>
            Throw
          </button>
        </div>
      )}
      {(!live || paused) &&
        (!paused && ui.phase === 'cleared' ? (
          <Results
            className="cap-overlay"
            {...roomEnd('cleared', ui.result, index)}
            onAgain={() => enter(index)}
            onward={index < ROOMS.length - 1 ? { label: 'Next room', onClick: () => enter(index + 1) } : null}
            more={{ label: 'All rooms', onClick: () => setUi((u) => ({ ...u, phase: 'menu' })) }}
          />
        ) : !paused && ui.phase === 'failed' ? (
          <Results
            className="cap-overlay"
            {...roomEnd('failed', ui.result, index)}
            onAgain={() => enter(index)}
          />
        ) : (
          <div className="hq-overlay cap-overlay">
            {paused ? (
              <>
                <p className="hq-overlay-title">Paused</p>
                <p className="hq-overlay-text">
                  Room {index + 1} of {ROOMS.length}, {def.name}.
                </p>
                <button
                  type="button"
                  className="btn btn-primary mt-4"
                  onClick={() => {
                    setPaused(false);
                    stage.wrap.current?.querySelector('.hq-screen')?.focus({ preventScroll: true });
                  }}
                >
                  Resume
                </button>
              </>
            ) : (
              <>
                <p className="hq-overlay-kicker">Training center · shield work</p>
                <p className="hq-overlay-title">Ricochet</p>
                <p className="hq-overlay-text">Twelve rooms. Throw the shield, bounce it off the steel, and put every training bot down in as few throws as you can. Blue mats stop it, glass breaks, switches open doors. If it comes back past you, you catch it.</p>
                <StartNote />
                <TouchHelp game="ricochet" />
                <div className="cap-rooms" role="group" aria-label="Rooms">
                  {ROOMS.map((r, i) => (
                    <button key={r.name} type="button" className="cap-room-btn" disabled={i >= save.reached} onClick={() => enter(i)} aria-label={`Room ${i + 1}, ${r.name}${save.stars[i] ? `, ${save.stars[i]} stars` : ''}`}>
                      <span>{i + 1}</span>
                      <small>{save.stars[i] ? '★'.repeat(save.stars[i]) : i < save.reached ? r.name : '—'}</small>
                    </button>
                  ))}
                </div>
                <p className="hq-overlay-best">
                  {totalStars} of {ROOMS.length * 3} stars
                </p>
              </>
            )}
          </div>
        ))}
      <p className="sr-only" role="status">
        {live ? `Room ${index + 1}, ${def.name}. ${ui.left} bots left. ${ui.throws} throws.` : ''}
      </p>
    </HQGame>
  );
}
