import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAchievements } from '../Achievements';
import { useFun } from '../../fun/FunProvider';
import { audioContext } from '../../lib/audio';
import { ellipseLength } from '../../lib/ellipse';
import { use3D } from '../../lib/gpu';
import { useReducedMotion } from '../../lib/hooks';
import Scene3D from './Scene3D';
import '../../styles/lazy/middleearth.css';

const sfx = () => import('../../lib/sfx');
const loadScene = () => import('./Ring3D').then((m) => m.createRing3D);

// The Eye, wreathed in flame, looking for whoever has the Ring on.
function Eye() {
  const pupil = useRef(null);
  const box = useRef(null);
  useEffect(() => {
    let raf = 0;
    const onMove = (e) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = box.current?.getBoundingClientRect();
        if (!r || !pupil.current) return;
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        const d = Math.hypot(dx, dy) || 1;
        const k = Math.min(1, d / 400);
        pupil.current.style.transform = `translate(${((dx / d) * 22 * k).toFixed(1)}px, ${((dy / d) * 8 * k).toFixed(1)}px)`;
      });
    };
    window.addEventListener('pointermove', onMove);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
    };
  }, []);
  return (
    <svg ref={box} viewBox="-120 -60 240 120" className="sauron-eye" aria-hidden="true">
      <defs>
        <radialGradient id="eye-fire" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#fff2b0" />
          <stop offset="0.35" stopColor="#ffb02e" />
          <stop offset="0.7" stopColor="#e2470b" />
          <stop offset="1" stopColor="#5a0d02" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse className="eye-flame" cx="0" cy="0" rx="118" ry="44" fill="url(#eye-fire)" />
      <ellipse cx="0" cy="0" rx="74" ry="28" fill="#ff8a1f" />
      <ellipse cx="0" cy="0" rx="60" ry="22" fill="#ffd166" opacity="0.8" />
      <g ref={pupil} className="eye-pupil">
        <ellipse cx="0" cy="0" rx="6" ry="24" fill="#120403" />
      </g>
    </svg>
  );
}

// While the Ring is on: the world goes grey, the wind whispers, the Eye looks
// for you. Escape or the button takes it off.
function Worn({ onRemove }) {
  const btn = useRef(null);
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('ring-worn');
    btn.current?.focus({ preventScroll: true });
    let stop = () => {};
    sfx().then((s) => {
      stop = s.wraith();
    });
    const onKey = (e) => e.key === 'Escape' && onRemove();
    window.addEventListener('keydown', onKey);
    return () => {
      root.classList.remove('ring-worn');
      window.removeEventListener('keydown', onKey);
      stop();
    };
  }, [onRemove]);
  return createPortal(
    <div className="ring-veil" role="dialog" aria-modal="false" aria-label="Wearing the One Ring">
      <Eye />
      <button ref={btn} type="button" className="btn btn-primary ring-off" onClick={onRemove}>
        Take it off
      </button>
    </div>,
    document.body,
  );
}

const INSCRIPTION = 'Ash nazg durbatulûk · ash nazg gimbatul · ash nazg thrakatulûk · agh burzum-ishi krimpatul ·';
// The inscription runs once round the band, from the ring's left back to it:
// told the band's length (less its start, which is nought) it fits the whole
// line, where at its own width the last words fell off the end.
const BAND = [112, 50];
const BAND_PATH = `M ${-BAND[0]} 0 A ${BAND[0]} ${BAND[1]} 0 1 1 ${BAND[0]} 0 A ${BAND[0]} ${BAND[1]} 0 1 1 ${-BAND[0]} 0`;
const BAND_LENGTH = ellipseLength(...BAND).toFixed(1);

export default function Ring() {
  const { unlock } = useAchievements();
  const { gollum } = useFun();
  const reduced = useReducedMotion();
  const [heat, setHeat] = useState(false);
  const [worn, setWorn] = useState(false);
  const [fate, setFate] = useState(null); // null, 'falling', 'gone'
  const [say, setSay] = useState('');
  const timers = useRef([]);
  const cooling = useRef(0);
  const three = use3D();
  const [gl, setGl] = useState('waiting');
  const want3D = three.on && gl !== 'failed' && gl !== 'lost';
  const later = (fn, ms) => timers.current.push(setTimeout(fn, ms));
  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
      clearTimeout(cooling.current);
    },
    [],
  );

  const holdToFire = () => {
    audioContext();
    setHeat(true);
    setSay('Fire brings out the letters. They are in the Black Speech of Mordor.');
    clearTimeout(cooling.current);
    cooling.current = setTimeout(() => setHeat(false), 7000);
  };
  const putOn = () => {
    audioContext();
    setWorn(true);
    setHeat(false);
    setSay('You vanish. Something, far away, has noticed.');
  };
  // stable, so taking it off doesn't restart the whispers on every render
  const takeOff = useCallback(() => {
    setWorn(false);
    setSay('You are back. It is still out there, looking.');
  }, []);
  const cast = () => {
    audioContext();
    clearTimeout(cooling.current);
    setHeat(true);
    setFate('falling');
    setSay('');
    sfx().then((s) => s.sizzle());
    later(
      () => {
        setFate('gone');
        setHeat(false);
        setSay('It is done. The Ring is unmade, and the Eye goes out.');
        unlock('ringbearer');
        import('../../lib/clips').then((c) => c.playClip('kingsArrival', { when: 0.4 }));
      },
      reduced ? 300 : 1500,
    );
  };
  const findAgain = () => {
    setFate(null);
    setSay('');
    gollum();
  };

  return (
    <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
      <div className="ring-stage me-stage" data-heat={heat || undefined} data-fate={fate || undefined} data-3d={want3D || undefined} data-gl={(want3D && gl === 'on') || undefined}>
        <svg viewBox="-180 -130 360 260" className="block h-auto w-full" role="img" aria-label={fate === 'gone' ? 'The fire, and no Ring' : heat ? 'The One Ring, its inscription burning' : 'The One Ring, plain gold'}>
          <defs>
            <linearGradient id="ring-gold" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#fff1b8" />
              <stop offset="0.35" stopColor="#e8b44c" />
              <stop offset="0.7" stopColor="#a8741f" />
              <stop offset="1" stopColor="#f6d27a" />
            </linearGradient>
            <radialGradient id="ring-lava" cx="50%" cy="100%" r="80%">
              <stop offset="0" stopColor="#ffd166" />
              <stop offset="0.35" stopColor="#ff6a1a" />
              <stop offset="0.75" stopColor="#8c1d04" />
              <stop offset="1" stopColor="#1a0503" stopOpacity="0" />
            </radialGradient>
            <path id="ring-text-path" d={BAND_PATH} />
            <filter id="ring-burn" x="-20%" y="-40%" width="140%" height="180%">
              <feGaussianBlur stdDeviation="2.4" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <ellipse className="ring-lava" cx="0" cy="150" rx="220" ry="110" fill="url(#ring-lava)" />
          <g className="ring-body">
            <ellipse cx="0" cy="6" rx="124" ry="58" fill="none" stroke="#000" strokeOpacity="0.25" strokeWidth="18" />
            <ellipse cx="0" cy="0" rx="124" ry="58" fill="none" stroke="url(#ring-gold)" strokeWidth="18" />
            <ellipse cx="0" cy="-4" rx="118" ry="52" fill="none" stroke="#fff6d6" strokeWidth="1.4" opacity="0.6" />
            <text className="ring-letters" filter="url(#ring-burn)">
              <textPath href="#ring-text-path" startOffset="0" textLength={BAND_LENGTH} lengthAdjust="spacingAndGlyphs">
                {INSCRIPTION}
              </textPath>
            </text>
          </g>
        </svg>
        {want3D && <Scene3D name="ring" load={loadScene} read={() => ({ heat, fate })} soft={three.info.software} onState={setGl} />}
      </div>
      <div>
        <h2 id="ring-title" className="title">
          The One Ring
        </h2>
        <p className="lead mt-4 max-w-[52ch]">Plain gold, until it meets the fire. Hold it to the flames to read it. Put it on if you have to. Or take it to Mount Doom.</p>
        <div className="mt-7 flex flex-wrap gap-3">
          {fate === 'gone' ? (
            <button type="button" className="btn btn-ghost" onClick={findAgain}>
              Precious?
            </button>
          ) : (
            <>
              <button type="button" className="btn btn-ghost" onClick={holdToFire} disabled={Boolean(fate)}>
                Hold it to the fire
              </button>
              <button type="button" className="btn btn-ghost" onClick={putOn} disabled={Boolean(fate)}>
                Put it on
              </button>
              <button type="button" className="btn btn-primary" onClick={cast} disabled={Boolean(fate)}>
                Cast it into the fire
              </button>
            </>
          )}
        </div>
        <p className="mt-5 min-h-[1.5em] text-sm text-muted" role="status">
          {say}
        </p>
      </div>
      {worn && <Worn onRemove={takeOff} />}
    </div>
  );
}
