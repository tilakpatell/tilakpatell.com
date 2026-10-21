import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { RiArrowRightLine, RiPauseFill, RiPlayFill } from 'react-icons/ri';
import { useAchievements } from '../Achievements';
import { audioContext } from '../../lib/audio';
import { capturePointer } from '../../lib/pointer';
import '../../styles/lazy/interests.css';

// Indian classical music: a sitar you can play (real recorded notes, retuned to
// Raga Yaman's frets), a real tanpura pluck as the drone underneath, and a
// recording to listen to. Everything shares the music room's Sa.
//
// Mouse: click a fret, or hold and drag up to pull the string (meend).
// Touch: tap a fret, or slide along the neck to glide across notes; vertical
// swipes still scroll the page. Keyboard: 1 to 8 play the notes.

const SLOTS = ['Sa', 'Re', 'Ga', 'Ma', 'Pa', 'Dha', 'Ni', 'Sa’'];
// Yaman in just intonation, with tivra Ma, from Sa to Sa'
const YAMAN = [1, 9 / 8, 5 / 4, 45 / 32, 3 / 2, 5 / 3, 15 / 8, 2];
const X0 = 18;
const SLOT = 36;
const BRIDGE = 344;
const MAIN_Y = 88;
const slotCenter = (i) => X0 + SLOT * i + SLOT / 2;
const music = () => import('../music/engine');
const CREDIT = 'https://commons.wikimedia.org/wiki/File:Sitar_clipping.ogg';

export default function MusicCard() {
  const { unlock } = useAchievements();
  const [lit, setLit] = useState(-1);
  const [bend, setBend] = useState(0);
  const [plucks, setPlucks] = useState(0);
  const [phrase, setPhrase] = useState(false);
  const [drone, setDrone] = useState(false);
  const [droneString, setDroneString] = useState(-1);
  const [firstString, setFirstString] = useState('Pa');
  const [listening, setListening] = useState(false);
  const [progress, setProgress] = useState(0);
  const [noSound, setNoSound] = useState(false);
  const svg = useRef(null);
  const press = useRef(null);
  const count = useRef(0);
  const audioEl = useRef(null);

  // Stop everything when the card unmounts (leaving the page).
  useEffect(
    () => () => {
      music().then((m) => m.stopTanpura());
      audioEl.current?.pause();
    },
    [],
  );

  const play = useCallback(
    async (i) => {
      if (!audioContext()) return setNoSound(true); // must run inside the gesture, before awaiting
      setLit(i);
      setBend(0);
      setPlucks((n) => n + 1);
      count.current += 1;
      if (count.current >= 8) unlock('raga');
      const m = await music();
      const handle = await m.pluck(YAMAN[i]);
      if (!handle) setNoSound(true);
      return handle;
    },
    [unlock],
  );

  const slotAt = (e) => {
    const r = svg.current.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 400;
    if (x < X0 || x > X0 + SLOT * SLOTS.length) return -1;
    return Math.min(SLOTS.length - 1, Math.floor((x - X0) / SLOT));
  };
  const onDown = async (e) => {
    const i = slotAt(e);
    if (i < 0) return;
    capturePointer(e);
    press.current = { id: e.pointerId, type: e.pointerType, y0: e.clientY, i, handle: null };
    const handle = await play(i);
    if (press.current && press.current.id === e.pointerId) press.current.handle = handle;
  };
  const onMove = async (e) => {
    const p = press.current;
    if (!p || p.id !== e.pointerId) return;
    const i = slotAt(e);
    if (i >= 0 && i !== p.i) {
      // gliding along the neck sounds each fret it crosses
      p.i = i;
      p.y0 = e.clientY;
      p.handle = await play(i);
      return;
    }
    if (p.type === 'mouse' || p.type === 'pen') {
      const pull = Math.max(0, Math.min(1, (p.y0 - e.clientY) / 48));
      setBend(pull);
      p.handle?.bend(pull * 2); // up to two semitones, like a real meend
    }
  };
  const onUp = (e) => {
    const p = press.current;
    if (!p || p.id !== e.pointerId) return;
    p.handle?.bend(0);
    setBend(0);
    press.current = null;
  };
  const onKey = (e) => {
    const n = Number(e.key);
    if (n >= 1 && n <= 8) {
      e.preventDefault();
      play(n - 1);
    }
  };

  const toggleDrone = async () => {
    if (!audioContext()) return setNoSound(true);
    const m = await music();
    if (m.tanpuraPlaying()) {
      m.stopTanpura();
      setDrone(false);
      setDroneString(-1);
      return;
    }
    m.startTanpura((i) => setDroneString(i));
    setFirstString(m.tanpuraStrings()[0].label);
    setDrone(true);
  };

  const playPhrase = async () => {
    if (!audioContext()) return setNoSound(true);
    const m = await music();
    const seconds = await m.playPhrase('yaman');
    if (!seconds) return setNoSound(true);
    setPhrase(true);
    setTimeout(() => setPhrase(false), seconds * 1000);
    count.current += 8;
    unlock('raga');
  };

  const toggleListen = async () => {
    let el = audioEl.current;
    if (!el) {
      const { LISTEN_URL } = await music();
      el = new Audio(LISTEN_URL);
      el.preload = 'auto';
      el.addEventListener('timeupdate', () => setProgress(el.duration ? el.currentTime / el.duration : 0));
      el.addEventListener('ended', () => {
        setListening(false);
        setProgress(0);
      });
      el.addEventListener('pause', () => setListening(false));
      el.addEventListener('play', () => setListening(true));
      audioEl.current = el;
    }
    if (el.paused) {
      el.currentTime = el.ended ? 0 : el.currentTime;
      el.play().catch(() => setNoSound(true));
    } else el.pause();
  };

  const px = lit >= 0 ? slotCenter(lit) : 0;
  const mainPath = lit >= 0 && bend > 0 ? `M8 ${MAIN_Y} L${px} ${MAIN_Y - bend * 16} L${BRIDGE} ${MAIN_Y}` : `M8 ${MAIN_Y} L${BRIDGE} ${MAIN_Y}`;

  return (
    <li className="fun-card fun-music">
      <div className="fun-visual sitar-visual">
        {/* the dark island is the svg, not the visual, whose rule under the picture is the card’s --border */}
        <svg
          ref={svg}
          viewBox="0 0 400 200"
          preserveAspectRatio="xMidYMid meet"
          className="sitar-svg dark-scope"
          role="group"
          aria-label="Sitar. Keys 1 to 8 play Sa, Re, Ga, Ma, Pa, Dha, Ni and high Sa."
          tabIndex={0}
          onKeyDown={onKey}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onPointerEnter={() => music().then((m) => m.warm())}
        >
          <defs>
            <linearGradient id="sitar-wood" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#8a5530" />
              <stop offset="0.5" stopColor="#6d3f1f" />
              <stop offset="1" stopColor="#4a2914" />
            </linearGradient>
            <radialGradient id="sitar-gourd" cx="40%" cy="35%" r="70%">
              <stop offset="0" stopColor="#a8693a" />
              <stop offset="0.6" stopColor="#6e3f1d" />
              <stop offset="1" stopColor="#3a1f0d" />
            </radialGradient>
            <linearGradient id="sitar-brass" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#f3dc9a" />
              <stop offset="1" stopColor="#b08a3e" />
            </linearGradient>
          </defs>

          <circle cx="374" cy="96" r="70" fill="url(#sitar-gourd)" />
          <circle cx="374" cy="96" r="58" fill="none" stroke="#d8b06a" strokeWidth="1.5" opacity="0.6" />
          <circle cx="374" cy="96" r="52" fill="none" stroke="#d8b06a" strokeWidth="0.8" strokeDasharray="2 4" opacity="0.5" />
          <rect x="0" y="64" width="350" height="62" rx="6" fill="url(#sitar-wood)" />
          <path d="M6 70 H344" stroke="#efe2c4" strokeWidth="1" strokeDasharray="1 7" opacity="0.7" />
          <path d="M6 120 H344" stroke="#efe2c4" strokeWidth="1" strokeDasharray="1 7" opacity="0.7" />
          {[100, 103, 106].map((y) => (
            <path key={y} d={`M8 ${y} L${BRIDGE} ${y}`} stroke="#d9cfb6" strokeWidth="0.5" opacity="0.35" />
          ))}
          {SLOTS.map((n, i) => (
            <g key={n}>
              <rect x={X0 + SLOT * i} y="64" width={SLOT} height="62" className="sitar-slot" data-lit={lit === i || undefined} />
              <path d={`M${X0 + SLOT * (i + 1) - 2} 66 Q${X0 + SLOT * (i + 1) + 5} 95 ${X0 + SLOT * (i + 1) - 2} 124`} stroke="url(#sitar-brass)" strokeWidth="2.6" fill="none" />
            </g>
          ))}
          <rect x={BRIDGE - 3} y="78" width="7" height="40" rx="2" fill="#efe6cf" />
          <path d={`M150 110 L${BRIDGE} 110`} stroke="#e6dcc2" strokeWidth="0.8" />
          <path d={`M170 114 L${BRIDGE} 114`} stroke="#e6dcc2" strokeWidth="0.8" />
          <path key={`main-${plucks}`} d={mainPath} stroke="#f4ecd6" strokeWidth="1.6" fill="none" className={lit >= 0 ? 'sitar-ring' : undefined} />
          <path d={`M8 ${MAIN_Y + 6} L${BRIDGE} ${MAIN_Y + 6}`} stroke="#e6dcc2" strokeWidth="1" />
          {SLOTS.map((n, i) => (
            <text key={n} x={slotCenter(i)} y="148" textAnchor="middle" className="sitar-label" data-lit={lit === i || undefined}>
              {n}
            </text>
          ))}
          {/* the tanpura's four strings, lighting as each is plucked */}
          <g className="tanpura-strings" data-on={drone || undefined} aria-hidden="true">
            {[firstString, 'Sa', 'Sa', 'Sa'].map((n, i) => (
              <g key={i} transform={`translate(${24 + i * 22} 22)`}>
                <line x1="0" y1="0" x2="0" y2="22" data-lit={droneString === i || undefined} />
                <text x="0" y="34" textAnchor="middle">
                  {n}
                </text>
              </g>
            ))}
          </g>
        </svg>
      </div>
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <h3 className="stretch-semi text-xl font-semibold text-ink">Indian classical music</h3>
        <p className="mt-2 text-[0.95rem] leading-relaxed text-body">
          I play sitar, and Indian classical is most of what I listen to. Start the tanpura, then play Raga Yaman on the frets.
        </p>
        {noSound && <p className="mt-2 text-sm text-muted">This browser can’t play sound here.</p>}
        <div className="mt-auto flex flex-wrap gap-2 pt-4">
          <button type="button" className="btn btn-ghost btn-sm" aria-pressed={drone} onClick={toggleDrone}>
            {drone ? <RiPauseFill className="h-4 w-4" aria-hidden="true" /> : <RiPlayFill className="h-4 w-4" aria-hidden="true" />}
            Tanpura
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={playPhrase} disabled={phrase}>
            {phrase ? 'Playing…' : 'Yaman phrase'}
          </button>
          <button type="button" className="btn btn-ghost btn-sm listen-btn" aria-pressed={listening} onClick={toggleListen} style={{ '--p': progress }}>
            {listening ? <RiPauseFill className="h-4 w-4" aria-hidden="true" /> : <RiPlayFill className="h-4 w-4" aria-hidden="true" />}
            Listen
          </button>
        </div>
        <Link to="/music" className="mt-4 inline-flex items-center gap-1.5 self-start text-sm font-semibold text-ink underline-offset-4 hover:underline">
          Open the music room: sitar, harmonium and tabla <RiArrowRightLine className="h-4 w-4" aria-hidden="true" />
        </Link>
        <p className="mt-3 text-xs text-muted">
          Sitar and tanpura: real recordings, retuned to the frets. Listen: a performance by{' '}
          <a className="underline underline-offset-2" href={CREDIT} target="_blank" rel="noopener noreferrer">
            Sanath311
          </a>
          , CC BY-SA 3.0.
        </p>
      </div>
    </li>
  );
}
