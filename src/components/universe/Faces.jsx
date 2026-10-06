import { MeeseeksFace, MortyFace, RickFace } from '../rickmorty/Faces';
import Mouth from '../Mouth';

// The crews' little heads for the comms box, in the same flat style as the
// Rick and Morty ones (which come from there): flat colour, a dark line, dot
// eyes.

const INK = '#1b1424';

function LukeFace({ className }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <path d="M18 100 Q20 76 50 74 Q80 76 82 100 Z" fill="#ff8a2e" stroke={INK} strokeWidth="2" />
      <path d="M30 42 Q50 30 70 42 L68 70 Q50 86 32 70 Z" fill="#f4d2b4" stroke={INK} strokeWidth="2" />
      <path d="M26 46 Q24 18 50 16 Q78 18 74 46 Q66 30 50 32 Q36 32 26 46 Z" fill="#e2b866" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
      <circle cx="41" cy="50" r="2.4" fill={INK} />
      <circle cx="59" cy="50" r="2.4" fill={INK} />
      <Mouth d="M43 64 Q50 68 57 64" cx={50} cy={65.5} />
    </svg>
  );
}

function R2Face({ className }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <path d="M20 58 Q20 20 50 20 Q80 20 80 58 Z" fill="#e9edf2" stroke={INK} strokeWidth="2" />
      <rect x="20" y="58" width="60" height="34" fill="#e9edf2" stroke={INK} strokeWidth="2" />
      <path d="M24 46 H76" stroke="#3d6fd1" strokeWidth="5" />
      <circle cx="50" cy="36" r="6.5" fill={INK} />
      <circle className="face-light" cx="51.5" cy="34.5" r="2" fill="#ff5a5a" />
      <rect x="30" y="66" width="16" height="10" fill="#3d6fd1" />
      <rect x="54" y="66" width="16" height="10" fill="#3d6fd1" />
      <rect x="40" y="80" width="20" height="6" fill="#9aa4b2" />
    </svg>
  );
}

function HanFace({ className }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <path d="M18 100 Q20 76 50 74 Q80 76 82 100 Z" fill="#f2efe6" stroke={INK} strokeWidth="2" />
      <path d="M20 100 L30 76 L40 100 Z M80 100 L70 76 L60 100 Z" fill="#2b2b33" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
      <path d="M30 42 Q50 30 70 42 L68 70 Q50 86 32 70 Z" fill="#efc9a8" stroke={INK} strokeWidth="2" />
      <path d="M26 48 Q22 16 52 16 Q80 18 74 46 Q70 34 56 30 Q40 30 26 48 Z" fill="#6b4a2f" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
      <circle cx="41" cy="50" r="2.4" fill={INK} />
      <circle cx="59" cy="50" r="2.4" fill={INK} />
      <Mouth d="M42 64 Q52 68 59 61" cx={51} cy={64.5} />
    </svg>
  );
}

function ChewieFace({ className }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <path d="M16 100 Q14 60 22 34 Q30 10 50 10 Q70 10 78 34 Q86 60 84 100 Z" fill="#9a6a3c" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
      <path d="M32 40 Q50 30 68 40 L66 72 Q50 84 34 72 Z" fill="#7a5130" />
      <path d="M22 100 L74 62 L80 70 L32 100 Z" fill="#4a3a2a" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
      <circle cx="42" cy="48" r="3" fill={INK} />
      <circle cx="58" cy="48" r="3" fill={INK} />
      <path d="M44 58 Q50 54 56 58 Q50 62 44 58 Z" fill={INK} />
      <Mouth d="M42 68 Q50 72 58 68" cx={50} cy={69.5} rx={7.5} />
    </svg>
  );
}

// Walt as Heisenberg: the black pork-pie hat, thin glasses and the goatee
function WaltFace({ className }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <path d="M18 100 Q20 76 50 74 Q80 76 82 100 Z" fill="#7f8c5a" stroke={INK} strokeWidth="2" />
      <path d="M38 75 L50 88 L62 75" fill="#a7b27c" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
      <path d="M30 40 Q50 30 70 40 L68 70 Q50 86 32 70 Z" fill="#f3dcc8" stroke={INK} strokeWidth="2" />
      <path d="M39 62 Q50 57 61 62 L60 73 Q50 84 40 73 Z" fill="#8b7d6e" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
      <Mouth d="M44 68 Q50 66.5 56 68" cx={50} cy={68} rx={5.5} />
      <g fill="none" stroke={INK} strokeWidth="2">
        <rect x="34" y="45" width="13" height="9" rx="2" />
        <rect x="53" y="45" width="13" height="9" rx="2" />
        <path d="M47 48 H53" />
      </g>
      <circle cx="41" cy="50" r="2.2" fill={INK} />
      <circle cx="59" cy="50" r="2.2" fill={INK} />
      <path d="M33 37 L35 21 Q50 17 65 21 L67 37 Z" fill="#26252c" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
      <path d="M39 23 Q50 21 61 23" fill="none" stroke="#45444e" strokeWidth="2" strokeLinecap="round" />
      <path d="M34 32 H66" stroke="#55545f" strokeWidth="5" />
      <path d="M17 39 Q50 30 83 39 Q50 44 17 39 Z" fill="#26252c" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

// Jesse: the knit beanie, a little stubble and the orange hoodie
function JesseFace({ className }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <path d="M14 100 Q16 72 50 70 Q84 72 86 100 Z" fill="#e0662f" stroke={INK} strokeWidth="2" />
      <path d="M30 72 Q50 90 70 72" fill="#b84b1d" stroke={INK} strokeWidth="2" />
      <path d="M43 82 V96 M57 82 V96" stroke="#f6e3c8" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M30 42 Q50 30 70 42 L68 70 Q50 86 32 70 Z" fill="#f4d2b4" stroke={INK} strokeWidth="2" />
      <path d="M33 62 Q34 72 50 78 Q66 72 67 62 Q66 76 50 81 Q34 76 33 62 Z" fill="#b99a80" />
      <circle cx="41" cy="51" r="2.4" fill={INK} />
      <circle cx="59" cy="51" r="2.4" fill={INK} />
      <Mouth d="M43 64 Q51 69 58 62" cx={50.5} cy={65} />
      <path d="M27 44 Q25 12 50 12 Q75 12 73 44 Z" fill="#4d5058" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
      <path d="M26 36 Q50 30 74 36 L74 45 Q50 39 26 45 Z" fill="#5c6069" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
      <path d="M34 34 V42 M42 32.5 V40.5 M50 32 V40 M58 32.5 V40.5 M66 34 V42" stroke="#3b3e45" strokeWidth="1.6" />
    </svg>
  );
}

// Hank: bald and broad, a blond goatee, the DEA's olive shirt
function HankFace({ className }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <path d="M12 100 Q14 72 50 70 Q86 72 88 100 Z" fill="#6f7a4a" stroke={INK} strokeWidth="2" />
      <path d="M40 71 L50 82 L60 71" fill="#59633a" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
      <path d="M26 44 Q26 18 50 18 Q74 18 74 44 L72 66 Q50 84 28 66 Z" fill="#efc7a4" stroke={INK} strokeWidth="2" />
      <path d="M40 63 Q50 58 60 63 L59 72 Q50 81 41 72 Z" fill="#c9a26a" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
      <Mouth d="M44 68 Q50 66 56 68" cx={50} cy={67.5} rx={5.5} />
      <path d="M35 42 L46 44 M65 42 L54 44" stroke={INK} strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="41" cy="50" r="2.4" fill={INK} />
      <circle cx="59" cy="50" r="2.4" fill={INK} />
      <path d="M47 56 Q50 59 53 56" fill="none" stroke={INK} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

const FACES = { rick: RickFace, morty: MortyFace, meeseeks: MeeseeksFace, luke: LukeFace, r2: R2Face, han: HanFace, chewie: ChewieFace, walt: WaltFace, jesse: JesseFace, hank: HankFace };

export default function Face({ who, className }) {
  const F = FACES[who];
  return F ? <F className={className} /> : null;
}
