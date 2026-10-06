// Little heads in the show's style, for picking who to play and for the
// family roster: flat colour, a dark line, big eyes with dot pupils. Rick's,
// Morty's and Mr. Meeseeks's mouths can talk (Mouth.jsx).

import Mouth from '../Mouth';

const INK = '#1b1424';

function Eyes({ y = 46, gap = 11, r = 7, pupil = 1.6, patch = false }) {
  return (
    <g stroke={INK} strokeWidth="2">
      <circle cx={50 - gap} cy={y} r={r} fill="#fff" />
      {patch ? <ellipse cx={50 + gap} cy={y} rx={r + 1} ry={r} fill={INK} /> : <circle cx={50 + gap} cy={y} r={r} fill="#fff" />}
      <circle cx={50 - gap} cy={y} r={pupil} fill={INK} stroke="none" />
      {!patch && <circle cx={50 + gap} cy={y} r={pupil} fill={INK} stroke="none" />}
    </g>
  );
}

export function RickFace({ className }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <path d="M22 44 L10 26 L28 30 L24 10 L40 22 L50 4 L60 22 L76 10 L72 30 L90 26 L78 44 Z" fill="#a9d7e8" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
      <path d="M28 40 Q50 30 72 40 L70 74 Q50 92 30 74 Z" fill="#f2d3b8" stroke={INK} strokeWidth="2" />
      <path d="M33 38 Q50 33 67 38" fill="none" stroke="#7d98a6" strokeWidth="4" strokeLinecap="round" />
      <Eyes y={47} gap={10} r={7} pupil={1.4} />
      <path d="M44 60 Q50 64 56 60" fill="none" stroke={INK} strokeWidth="2" />
      <Mouth d="M40 72 Q50 69 60 72" cx={50} cy={71.5} rx={7} linecap={null} />
      <path d="M57 73 q2 6 0 9" fill="none" stroke="#9fd8ff" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function MortyFace({ className, shirt = '#f3d84b', patch = false }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <path d="M20 92 Q50 80 80 92 L80 100 L20 100 Z" fill={shirt} stroke={INK} strokeWidth="2" />
      <circle cx="50" cy="50" r="31" fill="#f2d3b8" stroke={INK} strokeWidth="2" />
      <path d="M20 46 Q22 18 50 17 Q78 18 80 46 Q66 34 50 35 Q34 34 20 46 Z" fill="#6a3d1f" stroke={INK} strokeWidth="2" />
      <Eyes y={52} gap={12} r={8} pupil={1.2} patch={patch} />
      {patch && <path d="M30 44 L78 58" stroke={INK} strokeWidth="2" />}
      <Mouth d="M45 68 Q50 66 55 68" cx={50} cy={67.5} rx={5.5} linecap={null} />
    </svg>
  );
}

export function PickleFace({ className }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <rect x="28" y="6" width="44" height="88" rx="22" fill="#83b84a" stroke={INK} strokeWidth="2" />
      {[
        [36, 24],
        [62, 30],
        [40, 78],
        [60, 70],
        [34, 58],
        [64, 50],
      ].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="2.6" fill="#6c9c3a" />
      ))}
      <path d="M38 34 Q50 30 62 34" fill="none" stroke="#3e5e22" strokeWidth="3.5" strokeLinecap="round" />
      <Eyes y={42} gap={8} r={6} pupil={1.3} />
      <path d="M42 58 Q50 64 58 56" fill="none" stroke={INK} strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export function SummerFace({ className }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <path d="M16 70 Q14 18 50 14 Q86 18 84 70 Z" fill="#e2733a" stroke={INK} strokeWidth="2" />
      <path d="M27 42 Q50 30 73 42 L71 72 Q50 88 29 72 Z" fill="#f2d3b8" stroke={INK} strokeWidth="2" />
      <path d="M30 40 Q50 22 70 40 Q60 30 50 30 Q40 30 30 40 Z" fill="#e2733a" />
      <Eyes y={52} gap={11} r={7} pupil={1.4} />
      <path d="M43 68 Q50 72 57 68" fill="none" stroke="#c0485a" strokeWidth="2.4" />
      <circle cx="50" cy="16" r="5" fill="#ff8fb1" stroke={INK} strokeWidth="1.5" />
    </svg>
  );
}

export function BethFace({ className }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <path d="M18 74 Q16 16 50 14 Q84 16 82 74 Q66 58 50 60 Q34 58 18 74 Z" fill="#f1cf6a" stroke={INK} strokeWidth="2" />
      <path d="M28 40 Q50 30 72 40 L70 72 Q50 88 30 72 Z" fill="#f2d3b8" stroke={INK} strokeWidth="2" />
      <Eyes y={50} gap={11} r={7} pupil={1.4} />
      <path d="M42 67 Q50 71 58 67" fill="none" stroke="#b5485a" strokeWidth="2.4" />
    </svg>
  );
}

export function JerryFace({ className }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <path d="M26 36 Q30 14 52 14 Q74 16 76 38 Q66 26 52 26 Q38 26 26 36 Z" fill="#8a5a33" stroke={INK} strokeWidth="2" />
      <path d="M27 36 Q50 26 73 36 L71 72 Q50 90 29 72 Z" fill="#f2d3b8" stroke={INK} strokeWidth="2" />
      <Eyes y={50} gap={11} r={6.5} pupil={1.3} />
      <path d="M41 68 Q50 64 59 68" fill="none" stroke={INK} strokeWidth="2" />
    </svg>
  );
}

export function MeeseeksFace({ className }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <ellipse cx="50" cy="52" rx="30" ry="36" fill="#6fc6ea" stroke={INK} strokeWidth="2" />
      <Eyes y={44} gap={10} r={8} pupil={3.4} />
      <ellipse className="face-mouth-stretch" cx="50" cy="68" rx="10" ry="7" fill="#2a1a2a" stroke={INK} strokeWidth="2" />
    </svg>
  );
}
