import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import ArcReactor from '../ArcReactor';
import Mjolnir from '../Mjolnir';
import ShieldThrow from '../ShieldThrow';
import Range from '../Range';
import Dossier from '../Dossier';
import HulkLab from '../HulkLab';
import WebShooter from '../WebShooter';
import { HALF_OF, stoneFor } from './labels';
import { audioContext } from '../../../lib/audio';
import { sayVoiced, stopVoiced } from '../../../lib/voiced';
import { hasEarned } from '../hq/stones';
import { REACTOR } from './reactor';
import { placeById } from './rules';
import '../../../styles/lazy/avengers.css';

// A building's game (or Spider-Man's, at the gate), open over the page: what the place is, the game itself
// (each keeps its own 3D, and its old toy for a browser without it), and the
// way back out to the compound. Loaded with the first door you go through,
// so walking about never fetches a game.

const RepulsorRange = lazy(() => import('../repulsor/RepulsorRange'));
const HoldTheLawn = lazy(() => import('../lawn/HoldTheLawn'));
const Ricochet = lazy(() => import('../ricochet/Ricochet'));
const TrickShot = lazy(() => import('../trickshot/TrickShot'));
const Infiltration = lazy(() => import('../widow/Infiltration'));
const SmashRun = lazy(() => import('../smash/SmashRun'));
const Thwip = lazy(() => import('../thwip/Thwip'));
const TesseractRun = lazy(() => import('../tesseract/TesseractRun'));

const sfx = () => import('../../../lib/sfx');

// Tony's workshop without 3D: the arc reactor, to power up and fire, and
// F.R.I.D.A.Y. on each setting (in her own voice where it's been made: lib/voiced.js).
function ReactorToy() {
  const [power, setPower] = useState(0);
  const [blast, setBlast] = useState(0);
  useEffect(() => stopVoiced, []);
  const powerUp = () => {
    audioContext(); // in the click, so the reactor can be heard
    sfx().then((s) => s.repulsor());
    const next = (power + 1) % 4;
    setPower(next);
    sayVoiced('friday', REACTOR[next]);
  };
  const fire = () => {
    audioContext();
    if (!power) {
      setPower(1);
      sayVoiced('friday', REACTOR[1]);
    }
    sfx().then((s) => s.repulsor());
    setBlast((n) => n + 1);
  };
  return (
    <div className="grid items-center gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <figure className="reactor-stage m-0">
        <ArcReactor power={power} blast={blast} />
      </figure>
      <div>
        <div className="flex flex-wrap gap-3">
          <button type="button" className="btn btn-primary" onClick={powerUp}>
            {power === 3 ? 'Power down' : 'Power up'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={fire}>
            Fire a repulsor
          </button>
        </div>
        <p className="mono mt-5 min-h-[1.5em] text-sm text-accent" role="status">
          F.R.I.D.A.Y.: {REACTOR[power]}
        </p>
      </div>
    </div>
  );
}

// The hangar without 3D: the Tesseract in its case, and the Space Stone's portal.
// (the portal needs the Space Stone in every mode, and it's won in the 3D game)
function TesseractToy({ onPortal, space }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <div className="roof-stage" data-portal={open || undefined}>
        <svg viewBox="0 0 600 260" className="block h-auto w-full" role="img" aria-label="The Tesseract glowing in a glass containment case">
          <defs>
            <radialGradient id="tess-glow">
              <stop offset="0" stopColor="#d6f3ff" />
              <stop offset="0.4" stopColor="#4fb8ff" stopOpacity="0.8" />
              <stop offset="1" stopColor="#1f5fd1" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="vault-wall" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#0d1420" />
              <stop offset="1" stopColor="#1b2534" />
            </linearGradient>
          </defs>
          <rect width="600" height="260" fill="url(#vault-wall)" />
          {Array.from({ length: 9 }, (_, i) => (
            <path key={i} d={`M${i * 75} 0 V200`} stroke="#22304a" strokeWidth="2" />
          ))}
          <circle className="roof-portal" cx="300" cy="120" r="60" fill="url(#tess-glow)" />
          <path d="M0 200 H600 V260 H0 Z" fill="#141c29" />
          <path d="M230 200 h140 l-16 -16 h-108 Z" fill="#2b3748" />
          <rect x="262" y="96" width="76" height="88" rx="4" fill="rgba(160, 210, 255, 0.07)" stroke="#9fd4ff" strokeOpacity="0.5" strokeWidth="2" />
          <path d="M268 100 l10 0 l-10 18 Z" fill="#ffffff" opacity="0.15" />
          <g className="tesseract">
            <circle cx="300" cy="140" r="34" fill="url(#tess-glow)" />
            <rect x="286" y="126" width="28" height="28" rx="3" fill="#7fd6ff" stroke="#e6f8ff" strokeWidth="2" transform="rotate(12 300 140)" />
          </g>
          <text x="300" y="222" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="10" letterSpacing="2" fill="#7f9ab8">
            S.H.I.E.L.D. · CONTAINMENT
          </text>
        </svg>
      </div>
      <button
        type="button"
        className="btn btn-primary mt-6"
        disabled={open || !space}
        onClick={() => {
          setOpen(true);
          onPortal?.();
        }}
      >
        Space
      </button>
      <p className="mt-3 text-sm text-muted">{space ? 'The Space Stone opens a portal. Thanos is on the other side.' : 'The Space Stone opens a portal, and it’s won in the 3D game. Thanos is on the other side.'}</p>
    </div>
  );
}

function Game({ id, onPortal }) {
  switch (id) {
    case 'stark':
      return <RepulsorRange fallback={<ReactorToy />} />;
    case 'thor':
      return <HoldTheLawn fallback={<Mjolnir />} />;
    case 'cap':
      return <Ricochet fallback={<ShieldThrow />} />;
    case 'hawkeye':
      return <TrickShot fallback={<Range />} />;
    case 'widow':
      return <Infiltration fallback={<Dossier />} />;
    case 'banner':
      return <SmashRun fallback={<HulkLab />} />;
    case 'spidey':
      return <Thwip fallback={<WebShooter />} />;
    case 'vault':
      return <TesseractRun onPortal={onPortal} fallback={<TesseractToy onPortal={onPortal} space={hasEarned('space')} />} />;
    default:
      return null;
  }
}


export default function Place({ id, onLeave, onPortal }) {
  const p = placeById(id);
  const back = useRef(null);
  const leaveRef = useRef(onLeave);
  leaveRef.current = onLeave;
  useEffect(() => {
    const before = document.activeElement;
    back.current?.focus({ preventScroll: true });
    const html = document.documentElement;
    const was = html.style.overflow;
    html.style.overflow = 'hidden';
    // Escape leaves, unless the game used it (a game pauses on Escape while it's playing)
    const esc = (e) => e.key === 'Escape' && !e.defaultPrevented && leaveRef.current();
    window.addEventListener('keydown', esc);
    return () => {
      html.style.overflow = was;
      window.removeEventListener('keydown', esc);
      if (before instanceof HTMLElement) before.focus({ preventScroll: true });
    };
  }, []);
  if (!p) return null;
  const stone = stoneFor(p);
  const won = p.stone ? hasEarned(p.stone) : false;
  const half = HALF_OF[p.stone] ? `${HALF_OF[p.stone]} half of the ` : 'the ';
  // on the body, so nothing on the page (the nav, a transition) sits over it
  return createPortal(
    <div className="cw-place" role="dialog" aria-modal="true" aria-labelledby="cw-place-title" style={{ '--cw-accent': p.accent }}>
      <header className="cw-place-head">
        <div>
          <p className="cw-place-sub">{p.where}</p>
          <h2 id="cw-place-title" className="cw-place-title">
            {p.name}
          </h2>
        </div>
        <button ref={back} type="button" className="btn btn-ghost" onClick={onLeave}>
          Back to the compound <kbd>Esc</kbd>
        </button>
      </header>
      <div className="cw-place-body">
        <div className="shell py-6 md:py-8">
          <div className="cw-place-intro">
            <p className="lead max-w-[62ch]">{p.blurb}</p>
            {stone && (
              <p className="cw-place-stone" data-won={won || undefined} style={{ '--glow': stone.color }}>
                <i className="stone-dot" aria-hidden="true" />
                {won ? `You won ${half}${stone.name} back here.` : `Win it, and ${half}${stone.name} comes back to the compound.`}
              </p>
            )}
          </div>
          <div className="mt-6">
            <Suspense fallback={<p className="text-muted">Opening the door…</p>}>
              <Game id={id} onPortal={onPortal} />
            </Suspense>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
