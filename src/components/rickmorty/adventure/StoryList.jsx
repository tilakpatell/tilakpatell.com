import { RiCheckLine } from 'react-icons/ri';
import { EPISODES, READY } from './episodes';

// The Story tab of Things to do (M): the episodes built so far, in order, a
// finished one ticked, the current one with its steps (those done ticked, an
// `all`'s parts listed, each ticked as it's done), a later one by its title;
// and while the story isn't all built, a line saying more's coming, or once
// it's all done, one pointing to the Checklist. Drawn
// from the story's state (../adventure/story.js's shape) and, to tick a step
// done before it comes up, C-137's tasks done (`tasks`) and the Citadel's
// scenes (`citadel`).
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

export default function StoryList({ state, tasks = [], citadel = [], episodes = EPISODES, ready = READY }) {
  const built = episodes.slice(0, Math.min(ready, episodes.length));
  // (a game won, a task done or a Citadel scene made before its step comes up counts already: story.js catches up on all three;
  // the scenes are the Citadel's save as it's read, so anything but a list is none)
  const made = Array.isArray(citadel) ? citadel : [];
  const ahead = (s) => (s.type === 'win' && state.wins.includes(s.game)) || (s.type === 'task' && tasks.includes(s.id)) || (s.type === 'citadel' && made.includes(s.id));
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
                              <Step key={k} text={p.text} done={j < state.step || (j === state.step && state.got.includes(k)) || ahead(p)} />
                            ))}
                          </ol>
                        </li>
                      ) : (
                        <Step key={j} text={s.text} done={j < state.step || ahead(s)} />
                      ),
                    )}
                  </ol>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      {ready < episodes.length ? <p className="rm-list-rest">More of the story soon.</p> : state.episode >= episodes.length && <p className="rm-list-rest">That’s the whole story: the Checklist tab has the rest.</p>}
    </>
  );
}
