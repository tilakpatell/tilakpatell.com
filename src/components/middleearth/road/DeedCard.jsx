import { TouchButton } from '../../../runtime/hud';

// What the Road waits for you to do (doing.js's 'deed' event): the deed in
// Cinzel on glass, low in the middle of the frame, the key under it, how
// far a hold or a rhythm has come, and for a word the words to choose
// from, a wrong one struck through. On touch the keys are buttons: one to
// press or hold, two for a rhythm, a button a word. `deed`: { label, verb,
// keys, choices, progress, wrong }; `api`: the world (press, pick).
export default function DeedCard({ deed, touch = false, api }) {
  if (!deed) return null;
  const { label, verb, keys, choices, progress, wrong } = deed;
  const press = (name) => ({ onPress: () => api()?.press(name, true), onRelease: () => api()?.press(name, false) });
  return (
    <section className="road-deed" aria-live="polite" data-verb={verb}>
      <h2 className="road-deed-label">{label}</h2>
      {verb === 'choose' ? (
        <ol className="road-deed-words">
          {choices.map((word, i) => (
            <li key={word}>
              <button type="button" className="road-deed-word" data-wrong={wrong === i || undefined} onClick={() => api()?.pick(i)}>
                {!touch && <kbd>{i + 1}</kbd>} {word}
              </button>
            </li>
          ))}
        </ol>
      ) : (
        <>
          {!touch && (
            <p className="road-deed-keys">
              <kbd>{keys}</kbd>
              {verb === 'rhythm' && <span> in turn</span>}
            </p>
          )}
          {(verb === 'hold' || verb === 'rhythm') && (
            <span className="road-deed-bar" aria-hidden="true">
              <span style={{ '--k': progress }} />
            </span>
          )}
          {touch && (
            <div className="road-deed-thumbs">
              {verb === 'rhythm' ? (
                <>
                  <TouchButton size={64} onPress={() => api()?.press('left', true)} aria-label="Left">
                    L
                  </TouchButton>
                  <TouchButton size={64} onPress={() => api()?.press('right', true)} aria-label="Right">
                    R
                  </TouchButton>
                </>
              ) : (
                <TouchButton size={76} {...press('act')} aria-label={label}>
                  {verb === 'hold' ? 'Hold' : 'Do it'}
                </TouchButton>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
