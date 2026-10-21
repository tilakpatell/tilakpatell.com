import './earn.css';

// What a deed in Rick and Morty just earned (useRmEarn.js's note): a
// moment's "+200 ¢" in the show's ink, or a level reached with its title.
// Always there, empty between notes, so a screen reader hears each one.
export default function RmEarnNote({ note }) {
  return (
    <p className="rm-earn" role="status" data-on={note ? '' : undefined} data-level={note?.level ? '' : undefined}>
      {note && <span key={note.n}>{note.text}</span>}
    </p>
  );
}
