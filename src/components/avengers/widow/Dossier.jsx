import { LEVELS, LEVEL_COUNT } from './rules';

// Her file, a line declassified for each level cleared.
const FILE = [
  ['Name', 'Natasha Romanoff. Codename: Black Widow.'],
  ['Trained', 'In the Red Room, from childhood.'],
  ['Family', 'Yelena Belova. A sister, if not by blood.'],
  ['Recruited', 'By Clint Barton, who was sent to kill her and made a different call.'],
  ['Budapest', 'Classified. She and Barton remember it very differently.'],
  ['Cover', 'Natalie Rushman, Stark Industries, 2010.'],
  ['2014', 'Put S.H.I.E.L.D.’s secrets on the internet, and HYDRA’s with them.'],
  ['Vormir', 'Whatever it takes.'],
];

// The file: a line for each level, redacted until that level is cleared;
// each line a way into its level once it can be played.
export default function Dossier({ cleared, fresh, onPick }) {
  return (
    <div className="iw-file" role="group" aria-label="Natasha Romanoff’s file">
      <p className="iw-file-head">
        <span>S.H.I.E.L.D. · Personnel file</span>
        <span>
          {Math.min(cleared, FILE.length)}/{FILE.length} declassified
        </span>
      </p>
      <ol className="iw-file-lines">
        {FILE.map(([label, text], i) => {
          const open = i < cleared;
          const playable = i <= Math.min(cleared, LEVEL_COUNT - 1);
          return (
            <li key={label} data-open={open || undefined} data-fresh={i === fresh || undefined}>
              <button type="button" disabled={!playable} onClick={() => onPick(i)} aria-label={`Level ${i + 1}, ${LEVELS[i].name}${open ? `. ${label}: ${text}` : playable ? '. Redacted until cleared' : '. Locked'}`}>
                <span className="iw-file-n">{String(i + 1).padStart(2, '0')}</span>
                <span className="iw-file-label">{label}</span>
                <span className="iw-file-text">
                  <span className="iw-file-words">{text}</span>
                  {!open && <span className="iw-file-bar" aria-hidden="true" />}
                </span>
                <span className="iw-file-level">{LEVELS[i].name}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
