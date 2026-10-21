import { useEffect, useMemo, useRef } from 'react';
import { Screen } from '../../../runtime/hud';
import { HOUSES, QUESTIONS, entryFor } from '../rules/sorting';
import { sortingTree } from './sortingTree';
import './cards.css';

// The Sorting on the HUD (the design’s §4.2, beat four): the Hat’s question
// on the kit’s Screen, its four answers as the Screen’s own buttons (arrows
// along them, Enter to choose, or the digits 1 to 4 straight), and once the
// three are in, the house said in its colours with how its common room is
// got into. The Hat’s voice is the world’s subtitles; this is what you read
// and choose. `q`: the question put (0…2), or null; `result`: sort()’s, once
// sorted; `onAnswer(i)`.
// (The Screen draws a tree of boxes, ./sortingTree.js: a wide one, and a
// tall one for a phone held upright.)

export default function SortingCard({ q = null, result = null, onAnswer = null, tall = false }) {
  const ref = useRef(null);
  const tree = useMemo(() => (q == null ? null : sortingTree(q, { tall })), [q, tall]);
  // the first answer focused as each question comes, so the keys work at once
  useEffect(() => {
    if (q == null) return undefined;
    const t = setTimeout(() => ref.current?.querySelector('.hud-screen-cell')?.focus({ preventScroll: true }), 30);
    return () => clearTimeout(t);
  }, [q]);
  // the digits straight to an answer
  useEffect(() => {
    if (q == null || !onAnswer) return undefined;
    const onKey = (e) => {
      const n = Number(e.key);
      if (Number.isInteger(n) && n >= 1 && n <= 4 && !e.repeat) {
        e.preventDefault();
        onAnswer(n - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [q, onAnswer]);

  if (result) {
    const h = HOUSES[result.house];
    return (
      <section className="hp-card hp-sorted" data-house={result.house} aria-live="polite">
        <p className="hp-card-eyebrow">The Sorting Hat has spoken</p>
        <h2 className="hp-sorted-house">{h.name}</h2>
        <p className="hp-sorted-line">
          {h.founder}’s house. Head of house: {h.head}. House ghost: {h.ghost}.
        </p>
        <p className="hp-sorted-entry">{entryFor(result.house, result.password)}</p>
      </section>
    );
  }
  if (!tree) return null;
  return (
    <div ref={ref} className="hp-card hp-sorting" data-tall={tall || undefined}>
      <Screen tree={tree} label={`The Sorting Hat asks: ${QUESTIONS[q].ask}`} modal onAction={(id) => onAnswer?.(Number(String(id).slice(1)))} className="hp-sorting-screen" />
    </div>
  );
}
