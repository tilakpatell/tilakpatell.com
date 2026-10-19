import { Fragment, lazy, Suspense, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { RiKeyboardLine, RiPlayCircleLine, RiRefreshLine, RiSmartphoneLine } from 'react-icons/ri';
import { IconTour } from './icons';
import { CloseButton } from './ui';
import { SHORTCUTS, SITE, guideFor } from './guide/pages';
import { KeyTable, Keys } from './guide/KeyTable';
import { shortcutLabel } from '../lib/palette';
import { local } from '../lib/hooks';
import { AUDIENCES, TOUR_KEY, TOUR_NAMES, TOUR_TIMES, openTour, readProgress, tourFor, unfinished } from '../lib/tour';
import * as steps from './tour/steps';
import { planOf } from './tour/plan';
import { briefKeyFor, openBrief } from './tour/brief';
import './guide/tours.css';

// (its own chunk: the catalogue is the biggest thing the guide shows)
const TodoList = lazy(() => import('./guide/TodoList'));

// The guide's panel: the page's controls (keyboard or touch) as a table of
// keys, then its tips; the site as a whole, with its tours; and the
// checklist of things to do. Loaded the first time the guide opens
// (components/Guide.jsx), not before, and mounted each time it opens, so it
// starts on this page's tab (or the one it was opened on).

const coarse = () => typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;

function Tips({ tips }) {
  return (
    <dl className="guide-list">
      {tips.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

// the page's controls and tips; keyboard or touch, whichever this device is,
// with a switch when the page has both
function PageGuide({ page, basics }) {
  const both = Boolean(page.keys && page.touch);
  const [input, setInput] = useState(() => (page.touch && (coarse() || !page.keys) ? 'touch' : 'keys'));
  const groups = input === 'touch' ? page.touch : page.keys;
  return (
    <>
      <h2 className="dialog-title">{page.title}</h2>
      {page.about && <p className="guide-about">{page.about}</p>}
      {basics && (
        <button type="button" className="btn btn-ghost btn-sm mt-3" onClick={basics}>
          <RiPlayCircleLine className="h-4 w-4" aria-hidden="true" /> Show me the basics
        </button>
      )}
      {groups && (
        <section className="mt-5" aria-label="Controls">
          <div className="flex items-center justify-between gap-3">
            <p className="label">Controls</p>
            {both && (
              <div className="guide-input switch" data-size="sm" role="group" aria-label="Controls for">
                <button type="button" aria-pressed={input === 'keys'} onClick={() => setInput('keys')}>
                  <RiKeyboardLine className="h-3.5 w-3.5" aria-hidden="true" /> Keyboard
                </button>
                <button type="button" aria-pressed={input === 'touch'} onClick={() => setInput('touch')}>
                  <RiSmartphoneLine className="h-3.5 w-3.5" aria-hidden="true" /> Touch
                </button>
              </div>
            )}
          </div>
          <div className="mt-2">
            {groups.map((g, i) => (
              <Fragment key={g.label ?? i}>
                {g.label && <p className="guide-group eyebrow">{g.label}</p>}
                <KeyTable rows={g.rows} />
              </Fragment>
            ))}
          </div>
        </section>
      )}
      {page.tips?.length > 0 && (
        <section className="mt-6" aria-label="Tips">
          {groups && <p className="label mb-3">Tips</p>}
          <Tips tips={page.tips} />
        </section>
      )}
    </>
  );
}

// The tours: the three audiences', each with its chapters to take on
// their own, and "Carry on…" when one was left part way; and the quick
// look round the view you're in. An audience whose chapters aren't written
// yet isn't offered.
function Tours({ pathname, onGo }) {
  const take = (detail) => () => {
    onGo();
    openTour(detail);
  };
  const view = tourFor(pathname);
  const kept = readProgress(local.get(TOUR_KEY, null));
  const left = unfinished(kept);
  const plan = (a) => planOf(steps, a, view, pathname);
  const shown = AUDIENCES.filter((a) => steps.TOURS[a]?.length);
  const at = left && steps.TOURS[left.audience]?.length ? plan(left.audience) : null;
  const n = at ? at.findIndex((c) => c.id === left.chapter) + 1 : 0;
  return (
    <section className="mt-3" aria-label="Tours">
      {n > 0 && (
        <button type="button" className="btn btn-primary btn-sm" onClick={take({ ...left, stop: kept.stop })}>
          <RiRefreshLine className="h-4 w-4" aria-hidden="true" /> Carry on {TOUR_NAMES[left.audience].replace(/^The/, 'the')} (chapter {n} of {at.length})
        </button>
      )}
      {shown.length > 0 && (
        <ul className="guide-tours">
          {shown.map((a) => (
            <li key={a}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={take({ audience: a })}>
                <IconTour className="h-4 w-4" aria-hidden="true" /> {TOUR_NAMES[a]}
              </button>
              <span className="guide-tour-time">{TOUR_TIMES[a]}</span>
              <details className="guide-chapters">
                <summary>Its chapters</summary>
                <ol>
                  {plan(a).map((c) => (
                    <li key={c.id}>
                      <button type="button" className="guide-chapter" onClick={take({ audience: a, chapter: c.id, only: true })}>
                        {c.title}
                      </button>
                    </li>
                  ))}
                </ol>
              </details>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="btn btn-ghost btn-sm mt-2" onClick={take()}>
        <IconTour className="h-4 w-4" aria-hidden="true" /> A quick look round
      </button>
    </section>
  );
}

function SiteGuide({ pathname, onGo }) {
  return (
    <>
      <h2 className="dialog-title">The site</h2>
      <Tours pathname={pathname} onGo={onGo} />
      <section className="mt-4" aria-label="Shortcuts">
        {/* the shortcut as the keyboard says it: one cap a key, Ctrl and K */}
        <KeyTable rows={[[shortcutLabel(), 'Search and go anywhere (the command palette)'], ...SHORTCUTS]} />
      </section>
      <section className="mt-6">
        <Tips tips={SITE} />
      </section>
    </>
  );
}

export default function GuidePanel({ pathname, initialTab, close, onLeave }) {
  const page = guideFor(pathname);
  const [tab, setTab] = useState(initialTab === 'checklist' || initialTab === 'site' ? initialTab : page ? 'page' : 'site');
  const panel = useRef(null);
  const ids = useId();
  useEffect(() => {
    requestAnimationFrame(() => panel.current?.focus({ preventScroll: true }));
  }, []);

  // tabs: arrow keys move between them, as tabs do
  const tabs = page ? ['page', 'site', 'checklist'] : ['site', 'checklist'];
  const onTabKey = (e) => {
    const at = tabs.indexOf(tab);
    const next = e.key === 'ArrowRight' ? tabs[(at + 1) % tabs.length] : e.key === 'ArrowLeft' ? tabs[(at - 1 + tabs.length) % tabs.length] : null;
    if (!next) return;
    e.preventDefault();
    setTab(next);
    requestAnimationFrame(() => document.getElementById(`${ids}-${next}`)?.focus());
  };
  const tabProps = (id, label) => ({
    id: `${ids}-${id}`,
    role: 'tab',
    type: 'button',
    'aria-selected': tab === id,
    'aria-controls': `${ids}-panel`,
    tabIndex: tab === id ? 0 : -1,
    onClick: () => setTab(id),
    onKeyDown: onTabKey,
    children: label,
  });

  return createPortal(
    <div id="guide-panel" ref={panel} className="guide-panel card dialog" role="dialog" aria-modal="false" aria-labelledby={`${ids}-name`} tabIndex={-1}>
      <div className="guide-head">
        {/* the panel says what it is, beside the tabs that say where in it you are */}
        <div className="guide-head-tabs flex min-w-0 items-center gap-3">
          <p id={`${ids}-name`} className="guide-name label">
            Guide
          </p>
          <div className="guide-tabs switch" data-size="md" role="tablist" aria-label="Guide">
            {page && <button {...tabProps('page', 'On this page')} />}
            <button {...tabProps('site', 'The site')} />
            <button {...tabProps('checklist', 'The checklist')} />
          </div>
        </div>
        <CloseButton label="Close the guide" onClick={close} />
      </div>
      <div id={`${ids}-panel`} role="tabpanel" aria-labelledby={`${ids}-${tab}`} className="guide-body">
        {tab === 'checklist' ? (
          <Suspense fallback={null}>
            <TodoList pathname={pathname} onGo={onLeave} />
          </Suspense>
        ) : tab === 'page' && page ? <PageGuide page={page} basics={
              briefKeyFor(pathname)
                ? () => {
                    onLeave();
                    openBrief();
                  }
                : null
            } /> : <SiteGuide pathname={pathname} onGo={onLeave} />}
      </div>
      <p className="guide-foot">
        <Keys keys="?" /> opens and closes the guide · <Keys keys="Esc" /> closes it
      </p>
    </div>,
    document.body,
  );
}
