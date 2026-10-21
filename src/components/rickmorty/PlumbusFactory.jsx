import { useRef, useState } from 'react';
import { audioContext } from '../../lib/audio';

// How they do it: a plumbus made a step at a time, the drawing gaining a
// part with each one. The steps are the show's made-up words put to work in
// our own; nobody knows what any of them mean, which is the point.

const STEPS = [
  { part: 'dinglebop', title: 'Start with a dinglebop', text: 'Every plumbus begins as a dinglebop. Work a good coat of schleem all over it until it’s smooth.' },
  { part: 'schleem', title: 'Save the schleem', text: 'Wipe the spare schleem off and keep it. It goes back in for the next batch; nothing’s wasted at the factory.' },
  { part: 'grumbo', title: 'Through the grumbo', text: 'Push the dinglebop through the grumbo. The fleeb gets a rub against it on the way, so it comes out with a fleeb on top.' },
  { part: 'shlami', title: 'A Shlami comes over', text: 'A Shlami wanders in and gives it a once-over and a spit shine. This step has never been explained to anyone.' },
  { part: 'hizzards', title: 'Mind the hizzards', text: 'Cut the fleeb free. A few hizzards are always in the way; shove them out to the sides.' },
  { part: 'chumbles', title: 'Blamfs and chumbles', text: 'Work the blamfs over the chumbles. Keep at it until the stalk has its rings.' },
  { part: 'ploobis', title: 'Trim the ploobis', text: 'Trim the ploobis back and tidy what’s left of the grumbo. Out comes a plumbus.' },
];

const INK = '#1b1424';

// `onUsed`: called once, the first time a plumbus comes off the end of the line (C-137 ticks its task then)
export default function PlumbusFactory({ onUsed }) {
  const [at, setAt] = useState(0); // how many steps are done
  const used = useRef(false);
  const done = at >= STEPS.length;
  const has = (part) => STEPS.findIndex((s) => s.part === part) < at;
  const go = (n) => {
    setAt(n);
    if (n === STEPS.length) {
      audioContext();
      import('../games/gameAudio').then((m) => m.plumbus?.());
      if (!used.current) {
        used.current = true;
        onUsed?.();
      }
    }
  };
  const now = STEPS[Math.min(at, STEPS.length - 1)];

  return (
    <div className="rm-plumbus-factory card">
      <figure className="rm-pf-stage" aria-hidden="true">
        <svg viewBox="0 0 220 260" className="rm-pf-art">
          {/* the bench */}
          <path d="M14 238 H206" stroke={INK} strokeWidth="3" strokeLinecap="round" />
          {/* the ploobis: fuzz until it's shaved */}
          {has('chumbles') && !has('ploobis') && (
            <g className="rm-pf-part" stroke={INK} strokeWidth="2" strokeLinecap="round">
              <path d="M88 150 l-8 -4 M86 166 l-9 0 M88 182 l-8 4 M132 150 l8 -4 M134 166 l9 0 M132 182 l8 4" />
            </g>
          )}
          {/* the grumbo: the stalk and its foot */}
          {has('grumbo') && (
            <g className="rm-pf-part">
              <path d="M98 138 C96 170 94 200 84 226 H136 C126 200 124 170 122 138 Z" fill="#e88a98" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
              <ellipse cx="110" cy="230" rx="34" ry="9" fill="#d97a8a" stroke={INK} strokeWidth="3" />
            </g>
          )}
          {/* the chumbles: rings round the stalk */}
          {has('chumbles') && (
            <g className="rm-pf-part" fill="none" stroke={INK} strokeWidth="2.5" strokeLinecap="round">
              <path d="M97 160 Q110 166 123 160" />
              <path d="M95 180 Q110 187 125 180" />
              <path d="M92 200 Q110 208 128 200" />
            </g>
          )}
          {/* the hizzards, moved round to the sides */}
          {has('hizzards') && (
            <g className="rm-pf-part" fill="#f0b5bf" stroke={INK} strokeWidth="3" strokeLinejoin="round">
              <path d="M66 96 C46 88 34 100 40 114 C46 126 62 122 70 112 Z" />
              <path d="M154 104 C176 98 188 112 180 126 C172 138 156 132 150 120 Z" />
            </g>
          )}
          {/* the dinglebop: the body */}
          {has('dinglebop') && (
            <g className="rm-pf-part">
              <path d="M110 46 C150 46 166 82 160 108 C154 132 134 146 110 146 C86 146 66 132 60 108 C54 82 70 46 110 46 Z" fill="#f5a3b0" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
              <path d="M84 70 C78 82 76 96 80 108" fill="none" stroke="#fff" strokeOpacity="0.55" strokeWidth="5" strokeLinecap="round" />
            </g>
          )}
          {/* the schleem: a coat on it, and the bucket of what's saved */}
          {has('schleem') && (
            <g className="rm-pf-part">
              <path d="M128 56 C146 66 154 86 150 104" fill="none" stroke="#9fd8f2" strokeWidth="6" strokeLinecap="round" opacity="0.85" />
              <path d="M170 238 L174 206 H202 L206 238 Z" fill="#c9d3dc" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
              <path d="M176 210 C182 204 194 204 200 210" fill="#9fd8f2" stroke={INK} strokeWidth="2" />
            </g>
          )}
          {/* the fleeb, on top */}
          {has('grumbo') && (
            <g className="rm-pf-part">
              <path d="M110 46 C104 34 100 26 104 18 C108 12 116 12 118 20 C120 28 116 36 110 46 Z" fill="#d97a8a" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
              <circle cx="111" cy="20" r="8" fill="#f5a3b0" stroke={INK} strokeWidth="3" />
            </g>
          )}
          {/* the Shlami's spit */}
          {has('shlami') && (
            <g className="rm-pf-part" fill="#e8f6ff" stroke={INK} strokeWidth="2">
              <path d="M124 92 c3 -6 7 -6 8 0 c1 5 -9 5 -8 0 Z" />
              <circle cx="138" cy="112" r="3" />
              <circle cx="96" cy="120" r="2.5" />
            </g>
          )}
          {/* done */}
          {has('ploobis') && (
            <g className="rm-pf-part rm-pf-shine" fill="#ffe27a" stroke={INK} strokeWidth="2" strokeLinejoin="round">
              <path d="M40 40 l4 10 l10 4 l-10 4 l-4 10 l-4 -10 l-10 -4 l10 -4 Z" />
              <path d="M184 60 l3 7 l7 3 l-7 3 l-3 7 l-3 -7 l-7 -3 l7 -3 Z" />
            </g>
          )}
          {!at && (
            <text x="110" y="130" textAnchor="middle" className="rm-pf-empty">
              (nothing yet)
            </text>
          )}
        </svg>
      </figure>
      <div>
        <p className="rm-box-line" role="status" aria-live="polite">
          {done ? 'One plumbus, ready.' : at ? `${now.title}.` : 'Ready to make a plumbus?'}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-body">{done ? 'Everybody has one at home, and nobody can tell you what it does.' : now.text}</p>
        <ol className="rm-pf-steps mt-5">
          {STEPS.map((s, i) => (
            <li key={s.part}>
              <button type="button" className="rm-pf-step" data-done={i < at || undefined} data-now={i === at || undefined} aria-current={i === at ? 'step' : undefined} onClick={() => go(i + 1)}>
                <span className="rm-pf-num">{i + 1}</span>
                {s.title}
              </button>
            </li>
          ))}
        </ol>
        <div className="mt-5 flex flex-wrap gap-2">
          {done ? (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => go(0)}>
              Make another
            </button>
          ) : (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => go(at + 1)}>
              {at ? 'Next step' : 'Start the line'}
            </button>
          )}
          {at > 0 && !done && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => go(0)}>
              Start over
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
