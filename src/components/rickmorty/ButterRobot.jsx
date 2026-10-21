import { useEffect, useRef, useState } from 'react';
import { audioContext } from '../../lib/audio';
import { prefersReducedMotion } from '../../lib/hooks';
import { useVoiced } from '../../lib/useVoiced';
import { BUTTER as SCENES } from './toys';

// The butter robot: switch it on, ask for the butter, and it rolls down the
// table, fetches it and brings it back. Then it asks what its purpose is,
// and you tell it.

const INK = '#1b1424';
const cue = (name) => import('../games/gameAudio').then((m) => m[name]?.());
// it asks in its own voice
const ask = () => import('../../lib/clips').then((m) => m.playClip('purpose', { when: 0.3 }));

// `onUsed`: called once, the first time the butter's passed (C-137 ticks its task then)
export default function ButterRobot({ onUsed }) {
  const [scene, setScene] = useState('off');
  const [butter, setButter] = useState('dish'); // dish, held, plate
  const timers = useRef([]);
  const used = useRef(false);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const later = (fn, ms) => timers.current.push(setTimeout(fn, ms));
  const s = SCENES[scene];
  useVoiced(s.who, s.line); // the rest of the scene, in its speaker's voice where it's been made (lib/voiced.js)

  const wake = () => {
    audioContext();
    cue('zap');
    ask();
    setScene('awake');
  };
  // off down the table and back, the butter in its claw on the way back
  const pass = () => {
    const quick = prefersReducedMotion();
    const trip = quick ? 50 : 1300;
    setScene('fetch');
    later(() => {
      setButter('held');
      setScene('bring');
    }, trip + (quick ? 0 : 250));
    later(() => {
      setButter('plate');
      setScene('served');
      cue('portalHop');
      ask();
      if (!used.current) {
        used.current = true;
        onUsed?.();
      }
    }, trip * 2 + (quick ? 0 : 500));
  };
  const tell = () => setScene('told');
  const again = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setButter('dish');
    setScene('awake');
    ask();
  };

  const [label, act] = {
    off: ['Switch it on', wake],
    awake: ['Pass the butter', pass],
    fetch: ['Passing the butter…', null],
    bring: ['Passing the butter…', null],
    served: ['“You pass butter.”', tell],
    told: ['More butter', again],
    club: ['More butter', again],
  }[scene];
  return (
    <div className="rm-butter card" data-scene={scene}>
      <figure className="rm-butter-stage" aria-hidden="true">
        <svg viewBox="0 70 400 130" className="rm-butter-art">
          {/* the table */}
          <path d="M10 168 H390" stroke={INK} strokeWidth="3" strokeLinecap="round" />
          <path d="M10 168 V196 M390 168 V196" stroke={INK} strokeWidth="3" />
          {/* the plate, and the butter on it once it's been passed */}
          <ellipse cx="34" cy="164" rx="28" ry="6" fill="#fff" stroke={INK} strokeWidth="2.5" />
          {butter === 'plate' && <rect x="22" y="148" width="24" height="13" rx="2" fill="#ffe27a" stroke={INK} strokeWidth="2.5" />}
          {/* the dish, with the butter on it until it's fetched */}
          <path d="M346 166 h44 l-4 -8 h-36 Z" fill="#dfe6ec" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
          {butter === 'dish' && <rect x="356" y="143" width="24" height="15" rx="2" fill="#ffe27a" stroke={INK} strokeWidth="2.5" />}
        </svg>
        {/* the robot, rolling along on top */}
        <div className="rm-butter-bot" style={{ '--x': s.x }}>
          <svg viewBox="-40 -64 80 76" className="rm-butter-bot-art">
            {/* its arms: up and working, or hanging */}
            <g className="rm-butter-arm rm-butter-arm-l">
              <path d="M-18 -22 L-30 -34 L-34 -30" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </g>
            <g className="rm-butter-arm rm-butter-arm-r">
              <path d="M18 -22 L32 -30 L34 -24" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              {s.carry && <rect x="26" y="-44" width="18" height="11" rx="2" fill="#ffe27a" stroke={INK} strokeWidth="2.5" />}
            </g>
            {/* the treads */}
            <rect x="-24" y="-6" width="48" height="14" rx="7" fill="#5c6670" stroke={INK} strokeWidth="3" />
            <circle cx="-14" cy="1" r="3" fill="#aab4bb" />
            <circle cx="0" cy="1" r="3" fill="#aab4bb" />
            <circle cx="14" cy="1" r="3" fill="#aab4bb" />
            {/* the body and its eye */}
            <g className="rm-butter-head">
              <rect x="-20" y="-42" width="40" height="36" rx="9" fill="#c8ccd2" stroke={INK} strokeWidth="3" />
              <circle cx="0" cy="-24" r="11" fill="#2a2f45" stroke={INK} strokeWidth="2.5" />
              <circle className="rm-butter-eye" cx="0" cy="-24" r="4.5" fill={scene === 'off' ? '#55606a' : '#8dff7a'} />
              <path className="rm-butter-lid" d="M-11 -24 A11 11 0 0 1 11 -24 Z" fill="#9aa2aa" stroke={INK} strokeWidth="2" />
              <path d="M0 -42 V-52" stroke={INK} strokeWidth="2.5" />
              <circle cx="0" cy="-54" r="3.5" fill={scene === 'off' ? '#aab4bb' : '#ff6a5a'} stroke={INK} strokeWidth="2" />
            </g>
          </svg>
        </div>
      </figure>
      <div>
        <p className="rm-box-line" role="status" aria-live="polite">
          {s.who === 'rick' ? (
            <>
              <span className="rm-butter-who">Rick:</span> {s.line}
            </>
          ) : (
            s.line
          )}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {/* one button that keeps the focus through the whole scene */}
          <button type="button" className="btn btn-primary btn-sm" aria-disabled={!act || undefined} onClick={() => act?.()}>
            {label}
          </button>
          {scene === 'told' && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setScene('club')}>
              Say something
            </button>
          )}
        </div>
        <p className="mt-4 text-xs text-muted">Built in a couple of minutes from what was lying around the garage. It’s very good at its one job.</p>
      </div>
    </div>
  );
}
