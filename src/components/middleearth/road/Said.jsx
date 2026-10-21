// What the company says, as a film's subtitles: the speaker's name in
// Cinzel and the words, on glass, low in the middle over the ribbon, one
// line at a time (the page queues them: talk.js's saidFor is how long each stays).
// Voiced or not, every line is read here (ambience.js speaks it).
// `line`: { name, text }.
export default function Said({ line }) {
  if (!line) return null;
  return (
    <p className="road-said" aria-live="polite">
      <b>{line.name}</b> <span>{line.text}</span>
    </p>
  );
}
