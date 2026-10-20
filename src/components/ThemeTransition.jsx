import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { THEMES } from '../theme/themes';
import { prefersReducedMotion } from '../lib/hooks';
import '@fontsource/cinzel/600.css';
import AutobotMark from './AutobotMark';
import DecepticonMark from './DecepticonMark';
import CompanyMark, { ColourWheel } from './CompanyMark';
import { roles } from '../data/roles';
import PortalSwirl from './rickmorty/PortalSwirl';
import { PORTAL_QUOTES } from './rickmorty/themeQuotes';
import { THEME_QUOTES } from '../theme/quotes';
import { sayVoiced } from '../lib/voiced';
import '../styles/lazy/themetransition.css';

// each Transformer wears their faction's insignia
const AUTOBOTS = new Set(['optimus', 'bumblebee']);

// The moment a theme is picked: a short scene in its own style, a line it's
// known for and an original sound, while the new colours land underneath.
// `clip` is a recording that plays in place of the sound (cut to its second
// element, in seconds); `line` is the quote said aloud over the sound, or,
// with no clip of it, `voice` says it (lib/voiced.js; ../theme/quotes.js).
// Click, tap or any key skips it. Reduced motion keeps the words, not the motion.

const sfx = () => import('../lib/sfx');

const SCENES = {
  jedi: { kind: 'saber', color: '#4aa3ff', quote: 'May the Force be with you.', by: 'Han Solo', sound: (s) => s.saber(undefined, undefined, 0, 'jedi'), line: 'mayTheForce' },
  sith: { kind: 'saber', color: '#ff2a36', quote: 'I find your lack of faith disturbing.', by: 'Darth Vader', sound: (s) => s.saber(undefined, undefined, 0, 'sith'), line: 'lackOfFaith' },
  stark: { kind: 'hud', color: '#7fdcff', quote: 'I am Iron Man.', by: 'Tony Stark', sound: (s) => s.repulsor(), line: 'ironMan' },
  arcade: { kind: 'pixels', color: '#d6246e', ...THEME_QUOTES.arcade, sound: (s) => s.coin() },
  heisenberg: { kind: 'tiles', color: '#5ec8f0', quote: 'I am the one who knocks.', by: 'Walter White', sound: (s) => s.knock(), line: 'oneWhoKnocks' },
  dunder: { kind: 'memo', color: '#1f4e8c', quote: 'Limitless paper in a paperless world.', by: 'Dunder Mifflin', sound: (s) => s.ding() , clip: ['officeTheme', 7] },
  tortuga: { kind: 'ripple', color: '#d9a436', quote: 'Take what you can! Give nothing back!', by: 'The pirates’ toast', clip: ['pirates', 6], line: 'takeWhatYouCan' },
  pearl: { kind: 'ripple', color: '#f2c45a', ...THEME_QUOTES.pearl, clip: ['pirates', 6] },
  dutchman: { kind: 'ripple', color: '#5df2c0', quote: 'Do you fear death?', by: 'Davy Jones', clip: ['pirates', 6], line: 'fearDeath' },
  raga: { kind: 'ripple', color: '#e8871e', quote: 'Sa. Where every raga begins and ends.', by: 'Raga', sound: null },
  shire: { kind: 'door', color: '#e8b44c', ...THEME_QUOTES.shire, clip: ['lotr', 7] },
  mordor: { kind: 'eye', color: '#ff6a1a', quote: 'One Ring to rule them all.', by: 'J.R.R. Tolkien', clip: ['lotr', 7], line: 'oneRing' },
  optimus: { kind: 'transform', color: '#c8102e', quote: 'Autobots, roll out!', by: 'Optimus Prime', sound: (s) => s.transform(), clip: ['transform'], line: 'autobotsRollOut' },
  megatron: { kind: 'transform', color: '#8b5cf6', ...THEME_QUOTES.megatron, sound: (s) => s.transform(), clip: ['transform'] },
  bumblebee: { kind: 'transform', color: '#f7c600', quote: 'Bumblebee, ready to roll.', by: 'Bumblebee', sound: (s) => s.transform(), clip: ['transform'] },
  shockwave: { kind: 'transform', color: '#a855f7', ...THEME_QUOTES.shockwave, sound: (s) => s.transform(), clip: ['transform'] },
  soundwave: { kind: 'transform', color: '#4fd8ff', quote: 'Soundwave superior. Autobots inferior.', by: 'Soundwave', sound: (s) => s.transform(), clip: ['transform'], line: 'soundwaveSuperior' },
  portal: { kind: 'portal', color: '#97ce4c', quote: 'Wubba lubba dub dub!', by: 'Rick Sanchez', cue: 'portalOpen', clip: ['wubba'] },
  morty: { kind: 'portal', color: '#f3d84b', ...PORTAL_QUOTES.morty, cue: 'portalOpen' },
  summer: { kind: 'portal', color: '#e2557f', ...PORTAL_QUOTES.summer, cue: 'portalOpen' },
  beth: { kind: 'portal', color: '#8e2b48', ...PORTAL_QUOTES.beth, cue: 'portalOpen' },
};

const LENGTH = { saber: 1700, hud: 1700, pixels: 1500, tiles: 1700, memo: 1800, ripple: 1800, transform: 1800, door: 2400, eye: 2400, portal: 1800, company: 1100, wheel: 1300, wipe: 1300 };

// A company is quiet: its own dark, its mark drawn once, its name and the
// role I had there, and no sound. The visitor's own colour: a wheel that
// settles on it, and its hex.
function sceneFor(id, custom) {
  if (SCENES[id]) return SCENES[id];
  const role = roles.find((r) => r.id === id);
  if (role) return { kind: 'company', color: THEMES[id].swatch, quote: role.company, by: role.shortTitle };
  if (id === 'custom') return { kind: 'wheel', color: custom, quote: THEMES.custom.company, by: String(custom).toUpperCase() };
  return { kind: 'wipe', color: THEMES[id]?.swatch ?? '#888888', quote: THEMES[id]?.company ?? '', by: 'Site colours' };
}

function Scene({ kind, color }) {
  if (kind === 'saber')
    return (
      <div className="tt-saber" aria-hidden="true">
        <span className="tt-hilt" />
        <span className="tt-blade" style={{ '--c': color }} />
      </div>
    );
  if (kind === 'hud')
    return (
      <div className="tt-hud" aria-hidden="true" style={{ '--c': color }}>
        {[0, 1, 2].map((i) => (
          <span key={i} className="tt-ring" style={{ '--i': i }} />
        ))}
        <span className="tt-sweep" />
        <span className="tt-core" />
      </div>
    );
  if (kind === 'pixels')
    return (
      <div className="tt-pixels" aria-hidden="true">
        {Array.from({ length: 96 }, (_, i) => (
          <span key={i} style={{ '--d': `${((i % 12) + Math.floor(i / 12)) * 22}ms`, background: i % 7 === 0 ? '#22e07a' : i % 5 === 0 ? '#ffd23f' : color }} />
        ))}
      </div>
    );
  if (kind === 'ripple')
    return (
      <div className="tt-ripple" aria-hidden="true" style={{ '--c': color }}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} style={{ '--i': i }} />
        ))}
      </div>
    );
  if (kind === 'transform')
    return (
      <div className="tt-plates" aria-hidden="true" style={{ '--c': color }}>
        {Array.from({ length: 8 }, (_, i) => (
          <span key={i} style={{ '--i': i }} />
        ))}
      </div>
    );
  if (kind === 'portal')
    return (
      <div className="tt-portal" aria-hidden="true">
        <PortalSwirl size={[0.28, 0.38]} />
      </div>
    );
  if (kind === 'tiles') return <div className="tt-haze" aria-hidden="true" />;
  if (kind === 'wipe') return <div className="tt-wipe" aria-hidden="true" style={{ '--c': color }} />;
  return null;
}

// The Shire: the round door at Bag End, seen from the hall. It swings in on its
// left hinge onto the Hill at golden hour (a lantern-lit night in the dark),
// and we walk through it: the doorway grows until the page is all there is.
// Everything is drawn on a 200-unit square about the door’s middle.
const PLANK = 200 / 9;
// the frame’s twelve timbers, jointed round the doorway
const JOINTS = Array.from({ length: 12 }, (_, i) => {
  const [c, s] = [Math.cos((i / 12) * Math.PI * 2 + 0.26), Math.sin((i / 12) * Math.PI * 2 + 0.26)];
  return `M${(88 * c).toFixed(1)} ${(88 * s).toFixed(1)} L${(100 * c).toFixed(1)} ${(100 * s).toFixed(1)}`;
}).join(' ');
const HEDGE = 'M-100 61 C-78 51 -52 49 -26 55 C0 61 30 65 60 59 C78 55 92 55 100 57';
// the pine, a tier at a time from the ground up: each whole, then its sunlit (left) half
const PINE = [
  ['M38 32 Q45 30 52 18 Q59 30 66 32 Q62 34 59 32.6 Q56 34.4 52 33 Q48 34.4 45 32.6 Q42 34 38 32 Z', 'M38 32 Q45 30 52 18 L52 33 Q48 34.4 45 32.6 Q42 34 38 32 Z'],
  ['M41 25 Q47 23 52 11 Q57 23 63 25 Q60 26.6 57 25.4 Q54.5 27 52 25.8 Q49.5 27 47 25.4 Q44 26.6 41 25 Z', 'M41 25 Q47 23 52 11 L52 25.8 Q49.5 27 47 25.4 Q44 26.6 41 25 Z'],
  ['M44 18 Q49 16 52 5 Q55 16 60 18 Q57.5 19.4 55 18.4 Q53 20 52 19 Q51 20 49 18.4 Q46.5 19.4 44 18 Z', 'M44 18 Q49 16 52 5 L52 19 Q51 20 49 18.4 Q46.5 19.4 44 18 Z'],
  ['M47 11 Q50.5 9 52 -1 Q53.5 9 57 11 Q54.5 12.4 52 11.6 Q49.5 12.4 47 11 Z', 'M47 11 Q50.5 9 52 -1 L52 11.6 Q49.5 12.4 47 11 Z'],
];

function RoundDoor() {
  return (
    <div className="tt-door" aria-hidden="true">
      <span className="tt-door-hall" />
      <span className="tt-door-spill" />
      <div className="tt-door-way">
        <svg className="tt-door-beyond" viewBox="-100 -100 200 200">
          <defs>
            <radialGradient id="tt-door-sky" cx="-28" cy="22" r="150" gradientUnits="userSpaceOnUse">
              {[0, 0.16, 0.45, 1].map((at, i) => (
                <stop key={at} offset={at} className={`tt-sky-${'abcd'[i]}`} />
              ))}
            </radialGradient>
            {/* the smoke thins as it rises */}
            <linearGradient id="tt-door-wisp" x1="0" y1="49" x2="0" y2="-20" gradientUnits="userSpaceOnUse">
              <stop offset="0" className="tt-wisp" />
              <stop offset="1" className="tt-wisp" stopOpacity="0" />
            </linearGradient>
          </defs>
          <rect x="-100" y="-100" width="200" height="200" fill="url(#tt-door-sky)" />
          <g className="tt-door-sun">
            <path d="M-28 20 L-96 -40 L-88 -48 Z M-28 20 L-50 -96 L-38 -98 Z M-28 20 L6 -96 L18 -92 Z M-28 20 L60 -60 L68 -50 Z M-28 20 L100 -8 L100 6 Z" />
            <circle cx="-28" cy="20" r="26" className="tt-door-halo" />
            <circle cx="-28" cy="20" r="11" />
          </g>
          <g className="tt-door-night">
            <path d="M40 -64 A12 12 0 1 0 52 -48 A9.5 9.5 0 1 1 40 -64 Z" />
            {[[-62, -58], [-40, -76], [-14, -62], [8, -82], [-74, -30], [70, -24], [24, -40], [-50, -14], [84, -56], [-6, -30]].map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r={i % 3 ? 0.9 : 1.3} />
            ))}
          </g>
          <path className="tt-hill tt-hill-0" style={{ '--i': 0 }} d="M-100 24 L-82 14 L-70 19 L-56 6 L-44 16 L-30 10 L-14 20 L0 12 L14 18 L30 4 L44 15 L58 9 L72 18 L86 11 L100 20 L100 100 L-100 100 Z" />
          <path className="tt-hill tt-hill-1" style={{ '--i': 1 }} d="M-100 30 C-70 22 -40 24 -18 30 C6 36 40 26 66 24 C82 23 92 26 100 28 L100 100 L-100 100 Z" />
          <g className="tt-hill tt-hill-2" style={{ '--i': 2 }}>
            <path d="M-100 46 C-74 36 -42 38 -10 44 C18 49 40 36 64 34 C82 33 94 38 100 40 L100 100 L-100 100 Z" />
            <path className="tt-door-trunk" d="M51.2 36 L51.6 24 L52.8 24 L53.2 36 Z" />
            {PINE.flatMap(([whole, lit], i) => [<path key={`w${i}`} className="tt-door-pine" d={whole} />, <path key={`l${i}`} className="tt-door-pine-lit" d={lit} />])}
            <path className="tt-door-string" d="M37 25 Q52 37 67 25" />
            {[0.1, 0.24, 0.38, 0.5, 0.62, 0.76, 0.9].map((t) => (
              <circle key={t} className="tt-door-lantern" cx={37 + 30 * t} cy={25 + 24 * t * (1 - t)} r="1.3" />
            ))}
          </g>
          <g className="tt-hill tt-hill-3" style={{ '--i': 3 }}>
            <path d="M-100 62 C-78 52 -52 50 -26 56 C0 62 30 66 60 60 C78 56 92 56 100 58 L100 100 L-100 100 Z" />
            <path className="tt-door-hedge" d={HEDGE} />
            <path className="tt-door-road" d="M-40 77 C-36 84 -22 88 -14 100" />
            <rect className="tt-door-chimney" x="-47.2" y="50" width="2.6" height="7" />
            <circle className="tt-door-glow" cx="-40" cy="70" r="13" />
            <circle className="tt-door-glow" cx="-27" cy="68.5" r="7" />
            <circle className="tt-door-stone" cx="-40" cy="70" r="8.2" />
            <circle className="tt-door-hole" cx="-40" cy="70" r="6.5" />
            <circle className="tt-door-handle" cx="-40" cy="70" r="0.9" />
            <circle className="tt-door-window" cx="-27" cy="68.5" r="3" />
            <path className="tt-door-mullion" d="M-27 65.5 V71.5 M-30 68.5 H-24" />
          </g>
          <g className="tt-hill tt-hill-4" style={{ '--i': 4 }}>
            <path d="M-100 84 C-60 78 -20 86 20 82 C50 79 80 84 100 80 L100 100 L-100 100 Z" />
            <g className="tt-door-flowers">
              {[[-62, 88], [-55, 92], [-30, 90], [-22, 95], [-8, 89], [6, 93], [14, 88], [28, 91], [40, 86], [47, 94], [60, 89], [70, 92], [-44, 96], [33, 97]].map(([x, y], i) => (
                <circle key={i} cx={x} cy={y} r={i % 3 ? 1.1 : 1.5} />
              ))}
            </g>
          </g>
          <path className="tt-door-smoke" pathLength="1" d="M-45.9 49 C-50 42 -42 36 -46 28 C-50 20 -42 14 -47 4 C-51 -4 -44 -10 -48 -20" />
        </svg>
        <div className="tt-door-leaf">
          <svg viewBox="-100 -100 200 200">
            <defs>
              <clipPath id="tt-door-round">
                <circle r="100" />
              </clipPath>
              <clipPath id="tt-door-knob">
                <circle r="8.5" />
              </clipPath>
              <linearGradient id="tt-door-sheen">
                <stop offset="0" stopColor="#000000" stopOpacity="0.22" />
                <stop offset="0.45" stopColor="#ffffff" stopOpacity="0.07" />
                <stop offset="1" stopColor="#000000" stopOpacity="0.14" />
              </linearGradient>
              <pattern id="tt-door-boards" x="-100" y="-100" width={PLANK} height="200" patternUnits="userSpaceOnUse">
                <rect width={PLANK} height="200" fill="url(#tt-door-sheen)" />
              </pattern>
              <radialGradient id="tt-door-lamp" cx="0.22" cy="0.18" r="0.8">
                <stop offset="0" stopColor="#ffd696" stopOpacity="0.2" />
                <stop offset="1" stopColor="#ffd696" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="tt-door-sunk" r="0.5">
                <stop offset="0.6" stopColor="#000000" stopOpacity="0" />
                <stop offset="1" stopColor="#000000" stopOpacity="0.55" />
              </radialGradient>
              <radialGradient id="tt-door-brass" cx="0.34" cy="0.3" r="0.75">
                <stop offset="0" stopColor="#fff4cc" />
                <stop offset="0.3" stopColor="#ecc95e" />
                <stop offset="0.72" stopColor="#b98f22" />
                <stop offset="1" stopColor="#5e4412" />
              </radialGradient>
              <linearGradient id="tt-door-sweep">
                <stop offset="0" stopColor="#fffbe9" stopOpacity="0" />
                <stop offset="0.5" stopColor="#fffbe9" stopOpacity="0.95" />
                <stop offset="1" stopColor="#fffbe9" stopOpacity="0" />
              </linearGradient>
            </defs>
            <g clipPath="url(#tt-door-round)">
              {Array.from({ length: 9 }, (_, i) => (
                <rect key={i} x={-100 + i * PLANK} y="-100" width={PLANK} height="200" fill={['#2f5a2e', '#376536', '#325f30'][i % 3]} />
              ))}
              <rect x="-100" y="-100" width="200" height="200" fill="url(#tt-door-boards)" />
              <path className="tt-door-grain" d={Array.from({ length: 9 }, (_, i) => `M${-100 + (i + 0.36) * PLANK} -100 c2 34 -2 62 0 96 s2 64 -1 104 M${-100 + (i + 0.72) * PLANK} -100 c-1.5 40 1.5 70 0 110 s-2 50 1 90`).join(' ')} />
              <path className="tt-door-seams" d={Array.from({ length: 8 }, (_, i) => `M${-100 + (i + 1) * PLANK} -100 V100`).join(' ')} />
              <rect x="-100" y="-100" width="200" height="200" fill="url(#tt-door-lamp)" />
              <circle r="100" fill="url(#tt-door-sunk)" />
              <circle r="96.5" className="tt-door-bevel" />
              <path className="tt-door-hinge" d="M-104 -54.5 L-40 -53 C-34 -53 -31 -55.5 -27 -55.5 C-23 -55.5 -21 -52.5 -21 -50 C-21 -47.5 -23 -44.5 -27 -44.5 C-31 -44.5 -34 -47 -40 -47 L-104 -45.5 Z M-104 54.5 L-40 53 C-34 53 -31 55.5 -27 55.5 C-23 55.5 -21 52.5 -21 50 C-21 47.5 -23 44.5 -27 44.5 C-31 44.5 -34 47 -40 47 L-104 45.5 Z" />
              {[-88, -66, -44, -27].flatMap((x) => [-50, 50].map((y) => <circle key={`${x}${y}`} className="tt-door-nail" cx={x} cy={y} r="1.5" />))}
            </g>
            <circle r="14" className="tt-door-plate" />
            <circle r="8.5" fill="url(#tt-door-brass)" />
            <g clipPath="url(#tt-door-knob)">
              <rect className="tt-door-glint" x="-4" y="-10" width="8" height="20" fill="url(#tt-door-sweep)" />
            </g>
            <path className="tt-door-spark" d="M-3 -12 L-1.9 -5.1 L5 -4 L-1.9 -2.9 L-3 4 L-4.1 -2.9 L-11 -4 L-4.1 -5.1 Z" />
          </svg>
          <span className="tt-door-shade" />
        </div>
      </div>
      <svg className="tt-door-frame" viewBox="-100 -100 200 200">
        <defs>
          <linearGradient id="tt-door-oak" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#5e3f22" />
            <stop offset="0.5" stopColor="#3d2815" />
            <stop offset="1" stopColor="#24170b" />
          </linearGradient>
        </defs>
        <circle r="94" className="tt-door-timber" />
        <path className="tt-door-joints" d={JOINTS} />
        <circle r="99.6" className="tt-door-edge" />
        <circle r="88.4" className="tt-door-lip" />
      </svg>
      <span className="tt-door-lit" />
      {[[-0.62, -0.12], [0.58, -0.34], [0.66, 0.22], [-0.48, -0.46], [0.36, -0.58], [-0.7, 0.24], [0.5, 0.44], [-0.4, 0.5]].map(([x, y], i) => (
        <span key={i} className="tt-door-mote" style={{ '--x': x, '--y': y, '--i': i }} />
      ))}
    </div>
  );
}

// Mordor: the Eye. A seam of fire in the dark parts into the Eye, its pupil
// narrows on you, a ring of fire-letters heats once around it (our own
// letters: not Tengwar, not the Ring’s verse), and the Eye shuts; its seam
// stands upright and opens, like the pupil, onto the page.
const ALMOND = 'M-50 0 C-28 -26 28 -26 50 0 C28 26 -28 26 -50 0 Z';
// The ring’s twelve letters, none a numeral or a Latin letter at a glance (the
// short strokes are sparks), written with a broad nib so they have a pen’s thick
// and thin: each is drawn in a space squashed along one diagonal, its points
// stretched to match, where the round stroke becomes a flat pen’s.
const FLAT = 0.38;
const NIB = `rotate(45) scale(1 ${FLAT}) rotate(-45)`;
const nib = (d) =>
  d.replace(/(-?[\d.]+) (-?[\d.]+)/g, (_, x, y) => {
    const [u, v] = [(+x + +y) * Math.SQRT1_2, ((+y - +x) * Math.SQRT1_2) / FLAT];
    return `${((u - v) * Math.SQRT1_2).toFixed(2)} ${((u + v) * Math.SQRT1_2).toFixed(2)}`;
  });
const GLYPHS = [
  'M-4 5 C-4 -1 1 -2 1 -7 C3 -3 4 1 0 6',
  'M-0.5 6 C-0.5 5.4 -0.6 3.8 -0.6 2.5 C-0.5 1.1 -0.7 -0.6 0 -2 C0.8 -3.4 3.4 -5.4 4.1 -6.1 M-3.2 -5.8 L-3.1 -5.8',
  'M-1 -7 C-5 -3 -4 3 0 3 C3 3 4 0 2 -2 M0 3 C0 5 1 6 3 7',
  'M4.1 5.8 C4 4.4 4.2 -0.9 3.5 -2.3 C2.8 -3.7 1.1 -1.7 0 -2.5 C-1.1 -3.3 -2.5 -6.2 -3.1 -6.9 M0 -5.8 L0.1 -5.8',
  'M-4 -1 C-2 -5 2 -5 4 -2 M0 -3 C0 1 -2 4 -4 6 M1 3 C2 5 3 6 4 6',
  'M3.1 -2.3 C2.5 -3.1 0.2 -6.8 -0.3 -6.7 C-0.9 -6.6 0.4 -4 -0.1 -1.9 C-0.6 0.3 -3.4 5 -3.5 6.2 C-3.5 7.4 -0.9 5.5 -0.4 5.3',
  'M4 6.4 C3.4 5.1 0.5 0.7 0.4 -1.5 C0.2 -3.7 3.3 -7.2 3.3 -6.6 C3.3 -5.9 1.5 2.3 0.4 2.3 C-0.8 2.3 -3.6 -5.1 -3.6 -6.6 C-3.6 -8.1 -0.3 -6.6 0.3 -6.6 M-3.2 5.4 L-3.1 5.4',
  'M-3 -7 C-3 -2 0 0 3 -1 M3 -1 C1 2 -1 5 -1 7 M-4 4 C-3 3 -2 3 -1 4',
  'M3.3 -2.5 C3.4 -3.1 4.3 -5.9 3.7 -5.8 C3.1 -5.7 0.9 -3.8 -0.2 -2 C-1.3 -0.2 -2.2 5.1 -2.7 5.1 C-3.3 5.2 -3.3 -0.6 -3.4 -1.7 M-2.9 -5.6 L-2.8 -5.6',
  'M-4 2 C-2 -2 2 -2 4 2 M0 -1 C0 -4 1 -6 3 -7 M-2 4 C-1 6 1 6 2 4',
  'M-3.3 5.8 C-2.7 4.5 0.3 0 0.3 -1.9 C0.3 -3.9 -2.7 -5.8 -3.4 -5.8 C-4.1 -5.9 -4.7 -1.9 -4 -2.1 C-3.4 -2.2 -0.3 -5.9 0.4 -6.7 M0 5.4 L0.1 5.4',
  'M3.8 6.5 C3.1 5 0.5 -1.4 -0.2 -2.1 C-0.8 -2.8 -0.8 2.8 0 2.1 C0.7 1.4 4.1 -4.8 4.2 -6.3 C4.3 -7.8 1.2 -6.8 0.6 -6.9 M-3.2 -5.8 L-3.1 -5.8',
].map(nib);
// A seeded scatter, so the Eye is drawn the same every time.
const seeded = (i) => {
  const x = Math.sin(i * 12.9898 + 4.1) * 43758.5453;
  return x - Math.floor(x);
};
// The iris’s fibres, spokes of uneven length out from the pupil (the almond clips them).
const FIBRES = (odd) =>
  Array.from({ length: 34 }, (_, i) => {
    const a = ((i * 2 + odd + seeded(i + odd * 50) * 0.9) / 68) * Math.PI * 2;
    const [r0, r1] = [5 + seeded(i + 90) * 8, 22 + seeded(i + 130 + odd) * 32];
    return `M${(r0 * Math.cos(a)).toFixed(1)} ${(r0 * Math.sin(a)).toFixed(1)} L${(r1 * Math.cos(a)).toFixed(1)} ${(r1 * Math.sin(a)).toFixed(1)}`;
  }).join(' ');
// Tongues of fire from the rim, each drawn pointing up from its base and
// turned outward, longer above (fire rises). Two ranks: long dark flames
// behind, short hot ones before.
const flames = (count, seed, [lo, hi], wide, reach) =>
  Array.from({ length: count }, (_, i) => {
    const r = (k) => seeded(seed + i * 7 + k);
    const a = ((i + r(1) * 0.8) / count) * Math.PI * 2;
    const [c, s] = [Math.cos(a), Math.sin(a)];
    const n = Math.hypot(c / 46, s / 17);
    const turn = (Math.atan2(c / 46 / n, 0.5 - s / 17 / n) * 180) / Math.PI;
    const len = (lo + hi * Math.abs(s)) * (s < 0 ? reach : 0.62) * (0.55 + 0.9 * r(2));
    const w = wide * (0.6 + 0.8 * r(3));
    const b = (r(4) - 0.5) * len * 0.55;
    const f = (v) => v.toFixed(1);
    return {
      at: `translate(${f(46 * c)} ${f(17 * s)}) rotate(${f(turn)})`,
      d: `M${f(-w)} 0 C${f(-w)} ${f(-len * 0.45)} ${f(b - w * 0.2)} ${f(-len * 0.6)} ${f(b)} ${f(-len)} C${f(b + w * 0.6)} ${f(-len * 0.55)} ${f(w)} ${f(-len * 0.4)} ${f(w)} 0 Z`,
    };
  });
const FLAMES = [flames(18, 3, [12, 22], 4.2, 1.5), flames(26, 41, [6, 13], 2.6, 1.35)];

function TheEye() {
  return (
    <div className="tt-eye" aria-hidden="true">
      <span className="tt-eye-dark" />
      <span className="tt-eye-glow" />
      <svg className="tt-eye-svg" viewBox="-100 -100 200 200">
        <defs>
          <radialGradient id="tt-eye-iris" cx="0" cy="0" r="52" gradientUnits="userSpaceOnUse" gradientTransform="scale(1 0.62)">
            <stop offset="0" stopColor="#fff4c8" />
            <stop offset="0.16" stopColor="#ffe9a3" />
            <stop offset="0.45" stopColor="#ff7a1a" />
            <stop offset="0.8" stopColor="#a8230e" />
            <stop offset="1" stopColor="#4e170b" />
          </radialGradient>
          <linearGradient id="tt-eye-ember" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="#ff8a1e" />
            <stop offset="0.5" stopColor="#c2381a" />
            <stop offset="1" stopColor="#7a1c0a" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="tt-eye-flame" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="#ffd27a" />
            <stop offset="0.4" stopColor="#ff8a1e" />
            <stop offset="0.85" stopColor="#d2421a" />
            <stop offset="1" stopColor="#a8230e" stopOpacity="0" />
          </linearGradient>
          <clipPath id="tt-eye-lids">
            <path d={ALMOND} />
          </clipPath>
        </defs>
        <g className="tt-eye-ring">
          <circle r="74" />
          <circle r="94" />
          <circle className="tt-eye-spark" r="84" pathLength="100" transform="rotate(-90)" />
          {GLYPHS.map((d, i) => (
            <g key={i} transform={`rotate(${i * 30}) translate(0 -84) ${NIB}`}>
              <path className="tt-glyph-heat" d={d} style={{ '--i': i }} />
              <path className="tt-glyph" d={d} style={{ '--i': i }} />
            </g>
          ))}
        </g>
        {FLAMES.map((rank, k) => (
          <g key={k} className="tt-eye-flames">
            {rank.map(({ at, d }, i) => (
              <g key={i} transform={at}>
                <path className="tt-flame" d={d} style={{ '--i': i }} />
              </g>
            ))}
          </g>
        ))}
        <g className="tt-eye-ball">
          <path className="tt-eye-iris" d={ALMOND} fill="url(#tt-eye-iris)" />
          <g clipPath="url(#tt-eye-lids)">
            <g className="tt-eye-fibres">
              <path d={FIBRES(0)} />
              <path d={FIBRES(1)} />
            </g>
          </g>
          <path className="tt-eye-pupil" d="M0 -19 C8 -8 8 8 0 19 C-8 8 -8 -8 0 -19 Z" />
        </g>
      </svg>
      <span className="tt-eye-seam" />
      {Array.from({ length: 14 }, (_, i) => (
        <span key={i} className="tt-eye-mote" style={{ '--x': ((i * 37) % 100) - 50, '--i': i }} />
      ))}
    </div>
  );
}

// A ship’s wheel: a rim and a hub, and eight spokes run out past the rim to
// their handles.
function Helm({ color }) {
  return (
    <svg viewBox="-60 -60 120 120" className="tt-helm" aria-hidden="true" style={{ '--c': color }}>
      {Array.from({ length: 8 }, (_, i) => (
        <g key={i} transform={`rotate(${i * 45})`}>
          <line x1="0" y1="-12" x2="0" y2="-46" />
          <rect x="-3.2" y="-58" width="6.4" height="12" rx="3.2" />
        </g>
      ))}
      <circle r="34" className="tt-helm-rim" />
      <circle r="12" className="tt-helm-hub" />
    </svg>
  );
}

// What sits just above the words, in the flow, so it never covers them.
function Badge({ kind, color, autobot, id }) {
  if (kind === 'tiles')
    return (
      <div className="tt-tiles" aria-hidden="true">
        {[
          ['35', 'Br', 'Bromine'],
          ['56', 'Ba', 'Barium'],
        ].map(([n, sym, name], i) => (
          <span key={sym} className="tt-tile" style={{ '--i': i }}>
            <small>{n}</small>
            <b>{sym}</b>
            <small>{name}</small>
          </span>
        ))}
      </div>
    );
  if (kind === 'memo')
    return (
      <div className="tt-memo" aria-hidden="true">
        <p className="tt-memo-head">Dunder Mifflin Paper Company · Scranton</p>
        <p className="tt-memo-line" />
        <p className="tt-memo-line short" />
        <span className="tt-stamp">Approved</span>
      </div>
    );
  // the raga’s Sa; for the Caribbean, a ship’s wheel coming about
  if (kind === 'ripple' && id === 'raga')
    return (
      <b className="tt-sa" lang="hi" aria-hidden="true" style={{ color }}>
        सा
      </b>
    );
  if (kind === 'ripple') return <Helm color={color} />;
  if (kind === 'company') return <CompanyMark id={id} />;
  if (kind === 'wheel') return <ColourWheel color={color} />;
  if (kind === 'transform') return autobot ? <AutobotMark className="tt-insignia" /> : <DecepticonMark className="tt-insignia tt-insignia-dc" />;
  // (the door and the Eye bring their own dark, centred on them, so the page can show through them at the end)
  if (kind === 'door') return <RoundDoor />;
  if (kind === 'eye') return <TheEye />;
  return null;
}

export default function ThemeTransition({ id, custom, onDone }) {
  const scene = sceneFor(id, custom);
  const reduced = prefersReducedMotion();
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    // a recorded clip where there is one (cut short with a fade), else the synthesised sound
    const made = () => {
      if (scene.sound) sfx().then((s) => scene.sound(s));
      else if (scene.cue) import('./games/gameAudio').then((m) => m[scene.cue]?.());
    };
    if (scene.clip)
      import('../lib/clips').then(async (c) => {
        const played = await c.playClip(scene.clip[0], { duration: scene.clip[1], keep: true });
        if (!played) made();
      });
    else if (scene.sound || scene.cue) made();
    if (scene.line) import('../lib/clips').then((c) => c.playClip(scene.line, { when: 0.25, keep: true }));
    else if (scene.voice) sayVoiced(scene.voice, scene.quote); // no clip of it: the speaker's voice, where it's been made
    else if (id === 'raga')
      import('./music/engine').then((m) => {
        m.pluck(1, { vel: 0.8 });
        m.pluck(3 / 2, { when: 0.14, vel: 0.75 });
        m.pluck(2, { when: 0.28, vel: 0.85 });
        m.chikari({ when: 0.46, vel: 0.55 });
      });
    const t = setTimeout(() => done.current(), reduced ? 1100 : LENGTH[scene.kind]);
    const skip = () => done.current();
    window.addEventListener('keydown', skip);
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', skip);
    };
    // play once per transition
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return createPortal(
    <div className="tt" data-kind={scene.kind} data-id={id} data-reduced={reduced || undefined} onPointerDown={() => done.current()} style={{ '--tt-len': `${reduced ? 1100 : LENGTH[scene.kind]}ms` }}>
      {!reduced && <Scene kind={scene.kind} color={scene.color} />}
      <figure className="tt-words" role="status">
        {!reduced && <Badge kind={scene.kind} color={scene.color} autobot={AUTOBOTS.has(id)} id={id} />}
        <blockquote>{scene.quote}</blockquote>
        {scene.by && <figcaption>{scene.by}</figcaption>}
      </figure>
    </div>,
    document.body,
  );
}
