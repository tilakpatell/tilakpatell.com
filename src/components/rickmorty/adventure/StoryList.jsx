import { RiCheckLine } from 'react-icons/ri';
import { EPISODES, READY } from './episodes';

// The Story tab of Things to do (M): the episodes built so far, in order, a
// finished one ticked, the current one with its steps (those done ticked, an
// `all`'s parts listed, each ticked as it's done), a later one by its title;
// and while the story isn't all built, a line saying more's coming. Drawn
// from the story's state alone (../adventure/story.js's shape).
const Tick = ({ on }) => <span className="rm-tick" aria-hidden="true">{on && <RiCheckLine />}</span>;

function Step({ text, done }) {
  return (
    <li data-done={done || undefined}>
      <Tick on={done} />
      <p className="rm-list-name">
        {text}
        {done && <span className="sr-only"> (done)</span>}
      </p>
    </li>
  );
}

export default function StoryList({ state, episodes = EPISODES, ready = READY }) {
  const built = episodes.slice(0, Math.min(ready, episodes.length));
  return (
    <>
      <ol className="rm-story">
        {built.map((e, i) => {
          const finished = i < state.episode;
          const now = i === state.episode;
          return (
            <li key={e.id} className="rm-story-ep" data-done={finished || undefined} data-next={now || undefined}>
              <Tick on={finished} />
              <div>
                <p className="rm-story-title">
                  Episode {i + 1}: {e.title}
                  {finished && <span className="sr-only"> (done)</span>}
                </p>
                {now && (
                  <ol className="rm-story-steps">
                    {e.steps.map((s, j) =>
                      s.type === 'all' ? (
                        <li key={j} className="rm-story-all">
                          <p className="rm-list-sub">{s.text}</p>
                          <ol className="rm-story-steps">
                            {s.steps.map((p, k) => (
                              <Step key={k} text={p.text} done={j < state.step || (j === state.step && state.got.includes(k))} />
                            ))}
                          </ol>
                        </li>
                      ) : (
                        <Step key={j} text={s.text} done={j < state.step} />
                      ),
                    )}
                  </ol>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      {ready < episodes.length && <p className="rm-list-rest">More of the story soon.</p>}
    </>
  );
}
