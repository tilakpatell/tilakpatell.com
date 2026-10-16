import { projects } from '../../data/projects';
import { Waypoint } from '../ui';
import '../../styles/lazy/projects.css';

// Every technology across the projects as a periodic table (a nod to Breaking
// Bad). Where a two-letter symbol happens to be a real element, the tile says so.
const SYMBOL = {
  'C++': 'Cp',
  SDL3: 'Sd',
  CMake: 'Cm',
  Python: 'Py',
  FastAPI: 'Fa',
  React: 'Re',
  TypeScript: 'Ts',
  PostgreSQL: 'Pg',
  'Claude API': 'Cl',
  'Google Vision': 'Gv',
  PyMuPDF: 'Pm',
  Java: 'Ja',
  'Spring Boot': 'Sb',
  Docker: 'Do',
  CUDA: 'Cu',
  WebSockets: 'Ws',
  'Copilot SDK': 'Co',
  C: 'C',
  FUSE: 'Fu',
  Linux: 'Li',
  POSIX: 'Po',
  MongoDB: 'Mo',
  PyTorch: 'Pt',
  BERT: 'Be',
  MPI: 'Mp',
  NCCL: 'Nc',
};
const REAL = { Cm: 'curium', Re: 'rhenium', Ts: 'tennessine', Cl: 'chlorine', Pm: 'promethium', Sb: 'antimony', Cu: 'copper', Co: 'cobalt', C: 'carbon', Li: 'lithium', Po: 'polonium', Mo: 'molybdenum', Pt: 'platinum', Be: 'beryllium' };

const symbolFor = (name) => SYMBOL[name] ?? name.replace(/[^A-Za-z]/g, '').slice(0, 2).replace(/^(.)(.?)/, (_, a, b) => a.toUpperCase() + b.toLowerCase());

const counts = new Map();
for (const p of projects) for (const t of p.stack) counts.set(t, (counts.get(t) || 0) + 1);
 
const TECH = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([name, count], i) => ({ name, count, number: i + 1, symbol: symbolFor(name) }));

export default function PeriodicStack({ active, onPick }) {
  const using = active ? projects.filter((p) => p.stack.includes(active)).length : 0;
  return (
    <section className="shell relative z-10 pb-6 pt-10 md:pt-14" aria-labelledby="chemistry-title">
      <div className="relative flex flex-wrap items-end justify-between gap-4">
        <div>
          <Waypoint top="0.9rem" />
          <h2 id="chemistry-title" className="title" data-tour="projects-table">
            The chemistry
          </h2>
          <p className="lead mt-4 max-w-[54ch]">Every technology in these projects, as a periodic table. Pick one to see where it’s used.</p>
        </div>
        <p className="min-h-[1.5rem] text-sm text-muted" aria-live="polite">
          {active ? (
            <>
              {using} project{using === 1 ? '' : 's'} use {active}.{' '}
              <button type="button" className="link" onClick={() => onPick(null)}>
                Show all
              </button>
            </>
          ) : (
            `${TECH.length} elements`
          )}
        </p>
      </div>
      <ul className="periodic mt-8" aria-label="Technologies">
        {TECH.map((t) => {
          const real = REAL[t.symbol];
          const on = active === t.name;
          return (
            <li key={t.name}>
              <button
                type="button"
                className="ptile"
                aria-pressed={on}
                onClick={() => onPick(on ? null : t.name)}
                title={real ? `${t.symbol} is also ${real}` : undefined}
              >
                <span className="ptile-num" aria-hidden="true">
                  {t.number}
                </span>
                <span className="ptile-sym" aria-hidden="true">
                  {t.symbol}
                </span>
                <span className="ptile-name">{t.name}</span>
                <span className="ptile-count" aria-hidden="true">
                  ×{t.count}
                </span>
                {real && <span className="ptile-real" aria-hidden="true" />}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
