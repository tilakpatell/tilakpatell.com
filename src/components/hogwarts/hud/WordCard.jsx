import { useEffect, useRef, useState } from 'react';
import './cards.css';

// A word said to a door (the design’s §4.4): the Fat Lady’s password, the
// bare wall’s in the dungeons, the answer to the Ravenclaw knocker’s riddle.
// A card on parchment with what’s asked and a line to type into; Enter says
// it, Esc (or the cross) walks away. The world says whether it was right
// (its lines come as the arrival’s do, under the speaker’s name). `ask`:
// { title, prompt, placeholder }; `onSay(text)`, `onClose()`.
export default function WordCard({ ask, onSay, onClose }) {
  const [text, setText] = useState('');
  const field = useRef(null);
  useEffect(() => {
    setText('');
    const t = setTimeout(() => field.current?.focus({ preventScroll: true }), 30);
    return () => clearTimeout(t);
  }, [ask]);
  if (!ask) return null;
  return (
    <form
      className="hp-card hp-word"
      role="dialog"
      aria-label={ask.title}
      onSubmit={(e) => {
        e.preventDefault();
        if (text.trim()) onSay?.(text.trim());
        setText('');
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          onClose?.();
        }
      }}
    >
      <p className="hp-card-eyebrow">{ask.title}</p>
      {ask.prompt && <p className="hp-word-prompt">{ask.prompt}</p>}
      <div className="hp-word-row">
        <input ref={field} className="hp-word-input" value={text} onChange={(e) => setText(e.target.value)} placeholder={ask.placeholder ?? ''} aria-label={ask.placeholder ?? ask.title} autoComplete="off" spellCheck="false" maxLength={60} />
        <button type="submit" className="hp-word-say">
          Say it
        </button>
        <button type="button" className="hp-word-close" aria-label="Walk away" onClick={() => onClose?.()}>
          ×
        </button>
      </div>
    </form>
  );
}
