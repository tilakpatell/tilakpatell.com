import { useEffect, useState } from 'react';
import './night.css';

// The night on the page (the design’s §4.8): an eye at the top when someone
// has half a look at you after curfew (open as far as they are to catching
// you, with who it is under it), the cloak’s shimmer round the edge of the
// view while you’re under it (and a chip that says so, with its key), the
// frost creeping in from the edges as the dementors close, and the black of
// being walked back to bed. Overlays on the world, never over the kit’s
// parts: pointer events pass through all of them.
//
// And a butterbeer’s warmth: an amber glow at the edge of the view for a
// minute, fading as it goes down.
//
//   <Night watched={{ k, by } | null} cloaked cold={0…1} cut={n (bumped for each cut)} warm={n (bumped for each butterbeer)} reduced />

const WHO = { filch: 'Filch’s lantern', cat: 'Mrs Norris', prefect: 'A prefect', snape: 'Professor Snape', bump: 'Filch' };
const CUT_FOR = 1600; // ms the black lasts
const WARM_FOR = 60000; // ms a butterbeer keeps you warm

export default function Night({ watched = null, cloaked = false, cold = 0, cut = 0, warm = 0, reduced = false }) {
  const [black, setBlack] = useState(false);
  const [glow, setGlow] = useState(0);
  useEffect(() => {
    if (!warm) return undefined;
    setGlow(warm);
    const t = setTimeout(() => setGlow(0), WARM_FOR);
    return () => clearTimeout(t);
  }, [warm]);
  useEffect(() => {
    if (!cut) return undefined;
    setBlack(true);
    const t = setTimeout(() => setBlack(false), CUT_FOR);
    return () => clearTimeout(t);
  }, [cut]);
  return (
    <>
      {cold > 0.02 && <div className="hogwarts-cold" style={{ '--cold': cold }} aria-hidden="true" />}
      {glow > 0 && <div key={glow} className="hogwarts-warm" data-still={reduced || undefined} aria-hidden="true" />}
      {cloaked && <div className="hogwarts-cloaked" data-still={reduced || undefined} aria-hidden="true" />}
      {cloaked && (
        <p className="hogwarts-cloak-chip">
          <span>Under the cloak</span> <span className="hogwarts-key">I</span>
        </p>
      )}
      {watched && (
        <div className="hogwarts-eye" role="status" aria-label={`${WHO[watched.by] ?? 'Someone'} has seen something`} style={{ '--open': watched.k }}>
          <svg viewBox="0 0 48 24" width="44" height="22" aria-hidden="true" focusable="false">
            <path className="hogwarts-eye-lid" d="M2 12 C12 1 36 1 46 12 C36 23 12 23 2 12 Z" />
            <circle className="hogwarts-eye-ball" cx="24" cy="12" r="6.5" />
          </svg>
          <span>{WHO[watched.by] ?? 'Someone'}</span>
        </div>
      )}
      {black && <div className="hogwarts-cut" data-still={reduced || undefined} aria-hidden="true" />}
    </>
  );
}
