import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { RiCheckLine, RiFileCopyLine, RiGitPullRequestLine, RiArrowRightUpLine } from 'react-icons/ri';
import RouteLine from '../components/RouteLine';
import { Waypoint } from '../components/ui';
import { CHANGES, KINDS, KIND_ORDER, fmtDay, isBefore, pad, prUrl, revertPhrase, tally } from '../data/changes';
import { useDocumentTitle } from '../lib/hooks';
import { AurebeshLine } from '../components/Wordmark';

// The ship's log: every change the autopilot has made to the site, newest
// first, with a picture of it and the words to say to take it out again.
// Plain and light: no 3D, every image lazy with its size set.

function Copy({ text, label = 'Copy' }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      setTimeout(() => setDone(false), 2000);
    } catch {
      /* no clipboard: the words are on the page to select */
    }
  };
  return (
    <button type="button" className="btn btn-ghost btn-sm" onClick={copy}>
      {done ? <RiCheckLine className="h-4 w-4 text-accent" aria-hidden="true" /> : <RiFileCopyLine className="h-4 w-4" aria-hidden="true" />}
      <span aria-live="polite">{done ? 'Copied' : label}</span>
    </button>
  );
}

function Entry({ c }) {
  const gone = Boolean(c.reverted);
  return (
    <article className={`card relative p-6 sm:p-8 ${gone ? 'opacity-70' : ''}`} aria-labelledby={`change-${c.id}`}>
      <Waypoint top="2rem" />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted">
        <span className="mono text-ink">#{pad(c.id)}</span>
        <time dateTime={c.date}>{fmtDay(c.date)}</time>
        <span className={`chip ${gone ? '' : 'chip-accent'}`}>{KINDS[c.kind] ?? c.kind}</span>
        {gone && <span className="chip">Reverted {fmtDay(c.reverted.date)}</span>}
      </div>
      <h2 id={`change-${c.id}`} className={`title mt-3 ${gone ? 'line-through decoration-[color:var(--muted)] decoration-2' : ''}`}>
        {c.title}
      </h2>
      <p className="mt-3 max-w-3xl leading-relaxed text-body">{c.summary}</p>
      {gone && (
        <p className="mt-3 max-w-3xl text-sm text-muted">
          <span className="font-semibold text-ink">Taken out again:</span> {c.reverted.why}
        </p>
      )}
      {c.measured?.note && <p className="mt-3 text-sm text-muted">{c.measured.note}</p>}
      {c.shots.length > 0 && (
        <div className={`mt-5 grid gap-4 ${c.shots.length > 1 ? 'sm:grid-cols-2' : 'max-w-2xl'}`}>
          {[...c.shots].sort((a, b) => Number(isBefore(b)) - Number(isBefore(a))).map((s) => (
            <figure key={s} className="overflow-hidden rounded-panel border border-line bg-deep">
              <img src={s} alt={`${c.title}: the page ${isBefore(s) ? 'before' : 'after'} the change`} width={960} height={600} loading="lazy" decoding="async" className="block aspect-[16/10] w-full object-cover" />
              {c.shots.some(isBefore) && <figcaption className="label border-t border-line px-3 py-1.5">{isBefore(s) ? 'Before' : 'After'}</figcaption>}
            </figure>
          ))}
        </div>
      )}
      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3 text-sm">
        {c.routes.map((r) => (
          <Link key={r} to={r} className="inline-flex items-center gap-1 text-ink hover:underline hover:decoration-[color:var(--accent)] hover:underline-offset-4">
            See it: <span className="mono">{r}</span>
            <RiArrowRightUpLine className="h-4 w-4 text-muted" aria-hidden="true" />
          </Link>
        ))}
        {c.pr && (
          <a href={prUrl(c.pr)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-body hover:text-ink">
            <RiGitPullRequestLine className="h-4 w-4" aria-hidden="true" /> Pull request #{c.pr}
          </a>
        )}
      </div>
      {!gone && (
        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line pt-5 text-sm">
          <span className="text-muted">Don’t like it? Tell a Claude session:</span>
          <code className="mono rounded-chip border border-line-strong bg-[var(--bg-deep)] px-2.5 py-1 text-ink">{revertPhrase(c)}</code>
          <Copy text={revertPhrase(c)} />
        </div>
      )}
    </article>
  );
}

export default function Changes() {
  useDocumentTitle('What’s changed');
  const page = useRef(null);
  const [kind, setKind] = useState('all');
  const [withGone, setWithGone] = useState(false);
  const t = useMemo(() => tally(), []);
  const list = CHANGES.filter((c) => (kind === 'all' || c.kind === kind) && (withGone || !c.reverted));
  const chip = (on) => `chip cursor-pointer ${on ? 'chip-accent' : ''}`;

  return (
    <div ref={page} className="relative">
      <RouteLine containerRef={page} />
      <header className="shell relative z-10 pb-12 pt-[calc(var(--nav-h)+40px)] md:pt-[calc(var(--nav-h)+72px)]">
        <div className="relative">
          <Waypoint top="0.6rem" />
          <p className="eyebrow">The ship’s log</p>
          <h1 className="display mt-6 text-[clamp(3rem,1.6rem+6vw,6.2rem)]">What’s changed.</h1>
          <p className="mt-3 text-sm text-muted">
            <AurebeshLine>What’s changed.</AurebeshLine>
          </p>
          <p className="lead mt-6 max-w-2xl">
            This site improves itself. On a schedule, a Claude session makes one thing better (faster, sharper, or new), checks nothing broke, merges it and logs it here with a picture. Every change
            is one pull request, so any can come out again: tell a Claude session <span className="mono text-ink">Revert change 12</span> and it does.
          </p>
          <dl className="mt-8 flex flex-wrap gap-x-10 gap-y-4 text-sm">
            <div>
              <dt className="label">Changes</dt>
              <dd className="mt-1 text-2xl font-semibold text-ink">{t.count}</dd>
            </div>
            {t.since && (
              <div>
                <dt className="label">Since</dt>
                <dd className="mt-1 text-2xl font-semibold text-ink">{fmtDay(t.since)}</dd>
              </div>
            )}
            {KIND_ORDER.filter((k) => t.kinds[k]).map((k) => (
              <div key={k}>
                <dt className="label">{KINDS[k]}</dt>
                <dd className="mt-1 text-2xl font-semibold text-ink">{t.kinds[k]}</dd>
              </div>
            ))}
            {t.reverted > 0 && (
              <div>
                <dt className="label">Reverted</dt>
                <dd className="mt-1 text-2xl font-semibold text-ink">{t.reverted}</dd>
              </div>
            )}
          </dl>
        </div>
      </header>

      <section className="shell relative z-10 pb-28" aria-label="The changes">
        <div className="relative mb-6 flex flex-wrap items-center gap-2" role="group" aria-label="Show">
          <Waypoint top="0.4rem" />
          <button type="button" className={chip(kind === 'all')} aria-pressed={kind === 'all'} onClick={() => setKind('all')}>
            All
          </button>
          {KIND_ORDER.filter((k) => t.kinds[k]).map((k) => (
            <button key={k} type="button" className={chip(kind === k)} aria-pressed={kind === k} onClick={() => setKind(k)}>
              {KINDS[k]}
            </button>
          ))}
          {t.reverted > 0 && (
            <button type="button" className={`${chip(withGone)} ml-auto`} aria-pressed={withGone} onClick={() => setWithGone((v) => !v)}>
              {withGone ? 'Hide the reverted' : 'Show the reverted'}
            </button>
          )}
        </div>
        {list.length ? (
          <div className="grid gap-5">
            {list.map((c) => (
              <Entry key={c.id} c={c} />
            ))}
          </div>
        ) : (
          <p className="card p-6 text-muted">Nothing here yet. The autopilot’s next run is the first entry.</p>
        )}
        <p className="mt-10 max-w-2xl text-sm leading-relaxed text-muted">
          How it works: the protocol is <span className="mono">.claude/skills/autopilot</span> in the site’s repository. The checks: lint, tests, the build and every page opened in a browser. Nothing merges
          red. It stops on its own when its Claude plan is most of the way used.
        </p>
      </section>
    </div>
  );
}
