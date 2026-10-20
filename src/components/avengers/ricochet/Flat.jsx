import { useCallback, useEffect, useRef, useState } from 'react';
import { StartNote, TouchHelp } from '../hq/HQGame';
import Results from '../hq/Results';
import { register } from '../hq/useStage';
import { earnStone, hasEarned, recordTry } from '../hq/stones';
import { useAchievements } from '../../Achievements';
import { audioContext } from '../../../lib/audio';
import { capturePointer } from '../../../lib/pointer';
import { shownLoop } from '../../../lib/shownLoop';
import { ROOMS, STEP, botAt, botsLeft, limitFor } from './rules';
import { clearReward, loadSave, saveClear } from './save';
import { roomEnd } from './ends';
import { aimFromDrag, aimWords, assistFor, createFlat, discAt, pointsOf, previewPath, thrownAt, toWorld } from './flatInput';
import RoomView from './RoomView';
import Rooms from './Rooms';
import './ricochet.css';

// Ricochet in 2D (spec 2026-10-18-avengers-hq-fix-and-hub-design, §8): the
// room from above over the game's own rules (./flatInput.js), stepped at the
// rules' fixed step in lib/shownLoop's frame, with the same save, stone and
// end card as the 3D game. Per-frame values go straight to the SVG's
// attributes, so no state changes a frame. HQGame draws it whenever this
// game's own 3D is off, unavailable or failed.

const sfx = () => import('../../../lib/sfx');
const play = (name, ...a) => sfx().then((s) => s[name]?.(...a));

export default function RicochetFlat({ paused = false, onLive = null }) {
  const { unlock } = useAchievements();
  const [save, setSave] = useState(loadSave);
  const [index, setIndex] = useState(() => Math.min(loadSave().reached, ROOMS.length) - 1);
  const [ctl] = useState(() => createFlat(index));
  const [ui, setUi] = useState({ phase: 'menu', throws: 0, left: botsLeft(ctl.room), result: null });
  const [angleShown, setAngleShown] = useState(0);
  const root = useRef(null);
  const svg = useRef(null);
  const deg = useRef(null); // the bar's angle, kept up each frame (a mouse aims as it moves)
  const live = ui.phase === 'aim' || ui.phase === 'flying';

  useEffect(() => onLive?.(live), [live, onLive]);
  useEffect(() => () => onLive?.(false), [onLive]);

  const sync = useCallback((extra = {}) => {
    const r = ctl.room;
    setUi((u) => ({ ...u, phase: r.phase === 'aim' || r.phase === 'flying' ? r.phase : u.phase, throws: r.throws, left: botsLeft(r), ...extra }));
  }, [ctl]);

  const enter = useCallback(
    (i) => {
      audioContext(); // in the click, so the clangs can be heard
      recordTry('cap');
      ctl.enter(i);
      setIndex(i);
      setAngleShown(0);
      setUi({ phase: 'aim', throws: 0, left: botsLeft(ctl.room), result: null });
      root.current?.focus({ preventScroll: true });
    },
    [ctl],
  );

  // the 3D game's sounds on the same events
  const handle = useCallback(
    (events) => {
      for (const e of events) {
        if (e.type === 'bounce' || e.type === 'armor' || e.type === 'catch') play('clang');
        else if (e.type === 'down' || e.type === 'mat') play('knock');
        else if (e.type === 'glass') play('shatter');
        else if (e.type === 'switch') play('beeps');
        else if (e.type === 'open') play('transform');
        else if (e.type === 'hostage') play('buzz');
        else if (e.type === 'cleared') {
          play('ding');
          const i = ctl.room.index;
          setSave((s) => saveClear(s, i, e.stars));
          let stone = false;
          const reward = clearReward(i);
          if (reward) {
            unlock(reward.achievement);
            stone = earnStone(reward.stone) || hasEarned(reward.stone);
            play('victory');
          }
          sync({ phase: 'cleared', result: { stars: e.stars, throws: e.throws, catches: e.catches, stone } });
          return;
        } else if (e.type === 'failed') {
          sync({ phase: 'failed', result: { reason: e.reason } });
          return;
        }
      }
      if (events.length) sync();
    },
    [ctl, sync, unlock],
  );

  const doThrow = useCallback(() => {
    const f = ctl.throw();
    if (f) {
      play('zip');
      sync();
    }
    return f;
  }, [ctl, sync]);

  // the frame: the room stepped, and its moving parts written to the SVG
  useEffect(() => {
    const el = svg.current?.closest('.rf-stage');
    if (!live || paused || !el) return undefined;
    let last = 0;
    const loop = shownLoop(el, (now) => {
      const dt = last ? (now - last) / 1000 : 0;
      last = now;
      const ev = ctl.tick(dt);
      const s = svg.current?.querySelector('svg');
      if (s) {
        const r = ctl.room;
        const disc = discAt(r.flight);
        const d = s.querySelector('[data-disc]');
        if (d) {
          if (disc) {
            d.setAttribute('cx', disc[0]);
            d.setAttribute('cy', disc[1]);
            d.removeAttribute('visibility');
          } else d.setAttribute('visibility', 'hidden');
        }
        for (const g of s.querySelectorAll('[data-patrol]')) {
          const [x, z] = botAt(r.bots[Number(g.dataset.patrol)], r.t);
          g.setAttribute('transform', `translate(${x} ${z})`);
        }
        s.querySelector('[data-thrower]')?.setAttribute('transform', thrownAt(r.def.cap, ctl.angle));
        s.querySelector('[data-preview]')?.setAttribute('points', pointsOf(previewPath(r, ctl.angle, assistFor(r.index))));
      }
      if (deg.current) deg.current.textContent = `${((ctl.angle * 180) / Math.PI).toFixed(1)}°`;
      if (ev.length) handle(ev);
    });
    return () => loop.stop();
  }, [live, paused, ctl, handle]);

  // ── input: the pointer in the room, the keys on the view ──
  const at = (e) => toWorld(svg.current.querySelector('svg').getBoundingClientRect(), e.clientX, e.clientY);
  const onPointerDown = (e) => {
    if (!live || paused || e.target.closest('button')) return;
    capturePointer(e);
    ctl.press(at(e));
  };
  // (a mouse aims as it moves, as in the 3D game; a finger while it's down)
  const onPointerMove = (e) => {
    if (!live || paused) return;
    if (ctl.dragging) ctl.move(at(e));
    else if (e.pointerType === 'mouse') {
      const a = aimFromDrag(ctl.room.def.cap, at(e));
      if (a != null) ctl.aim(a);
    }
  };
  const onPointerUp = (e) => {
    if (!ctl.dragging) return;
    const f = paused ? (ctl.cancel(), null) : ctl.release(at(e));
    setAngleShown(ctl.angle);
    if (f) {
      play('zip');
      sync();
    }
  };
  const onKeyDown = (e) => {
    // (a focused button does what it says; Esc is never taken, so the frame's Back works)
    if (e.target.closest('button') || !live || paused) return;
    if (e.key === 'r' || e.key === 'R') {
      e.preventDefault();
      enter(index);
      return;
    }
    const r = ctl.key(e.key, { shift: e.shiftKey });
    if (!r.handled) return;
    e.preventDefault();
    if (r.flight) {
      play('zip');
      sync();
    } else setAngleShown(ctl.angle);
  };

  // browser checks: the room, the aim, and a throw flown to its end
  useEffect(
    () =>
      register('ricochet-flat', {
        get state() {
          return ctl.room;
        },
        get angle() {
          return ctl.angle;
        },
        enter,
        aim: (a) => ctl.aim(a),
        throw: doThrow,
        land() {
          while (ctl.room.phase === 'flying') handle(ctl.tick(STEP));
        },
      }),
    [ctl, enter, doThrow, handle],
  );

  const def = ROOMS[index];
  const ended = ui.phase === 'cleared' || ui.phase === 'failed';
  return (
    <div ref={root} className="hq-screen rf" role="group" tabIndex={0} aria-label="Ricochet in 2D, the room from above. Drag from Cap and let go to throw the shield, or aim with the left and right arrow keys (Shift for fine aim) and throw with Space. R restarts the room." onKeyDown={onKeyDown}>
      <div className="rf-bar" aria-hidden="true">
        <span>
          Room {index + 1}/{ROOMS.length} · {def.name}
        </span>
        <span>
          {ui.throws} throws · par {def.par} · max {limitFor(def)}
        </span>
        <span>{ui.left === 1 ? '1 bot left' : `${ui.left} bots left`}</span>
        <span ref={deg}>{((angleShown * 180) / Math.PI).toFixed(1)}°</span>
      </div>
      <div ref={svg} className="rf-stage" style={{ touchAction: live ? 'none' : 'auto' }} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={() => ctl.cancel()} onLostPointerCapture={() => ctl.cancel()}>
        <RoomView room={ctl.room} angle={ctl.angle} assist={assistFor(index)} />
      </div>
      <p className="rf-tip">{def.tip}</p>
      <div className="rf-tools">
        <button type="button" className="cap-touch-btn" onClick={() => enter(index)} aria-label="Restart the room" disabled={!live}>
          ↺
        </button>
      </div>
      {ui.phase === 'menu' && (
        <div className="hq-overlay cap-overlay">
          <p className="hq-overlay-kicker">Training center · shield work</p>
          <p className="hq-overlay-title">Ricochet</p>
          <p className="hq-overlay-text">Twelve rooms, from above. Drag from Cap and let go to throw, or aim with ← → and throw with Space. Steel bounces the shield, mats stop it, glass breaks and switches open doors.</p>
          <StartNote />
          <ul className="hq-keys">
            <li>
              <kbd>←</kbd>
              <kbd>→</kbd> aim
            </li>
            <li>
              <kbd>Shift</kbd> fine aim
            </li>
            <li>
              <kbd>Space</kbd> throw
            </li>
            <li>
              <kbd>R</kbd> restart
            </li>
            <li>or drag and let go</li>
          </ul>
          <TouchHelp game="ricochet-flat" />
          <Rooms save={save} onPick={enter} />
        </div>
      )}
      {live && paused && (
        <div className="hq-overlay cap-overlay">
          <p className="hq-overlay-title">Paused</p>
          <p className="hq-overlay-text">
            Room {index + 1} of {ROOMS.length}, {def.name}.
          </p>
        </div>
      )}
      {ended && (
        <Results
          className="cap-overlay"
          {...roomEnd(ui.phase, ui.result, index)}
          onAgain={() => enter(index)}
          onward={ui.phase === 'cleared' && index < ROOMS.length - 1 ? { label: 'Next room', onClick: () => enter(index + 1) } : null}
          more={ui.phase === 'cleared' ? { label: 'All rooms', onClick: () => setUi((u) => ({ ...u, phase: 'menu' })) } : null}
        />
      )}
      <p className="sr-only" role="status">
        {live && paused ? 'Paused.' : live ? `Room ${index + 1}, ${def.name}. ${ui.left === 1 ? '1 bot left' : `${ui.left} bots left`}. ${ui.throws} throws. Aim ${aimWords(angleShown)}.` : ''}
      </p>
    </div>
  );
}
