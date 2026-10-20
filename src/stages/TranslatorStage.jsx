import { useState } from 'react';
import { PhaseBar, StageWindow, useStagePlayer } from './StageKit';

// One page through the translator: scan → OCR boxes → layout labels →
// translation → glossary → headings → structure → export.
const PHASES = [
  { id: 'rasterise', ms: 900, label: 'Rasterise: the scanned leaf becomes an image' },
  { id: 'ocr', ms: 1300, label: 'OCR: Google Vision finds every line, with its geometry' },
  { id: 'layout', ms: 1300, label: 'Layout: prose, verse, heading and footnote, from the page geometry' },
  { id: 'translate', ms: 2000, label: 'Translate: page image and OCR go to Claude together' },
  { id: 'harmonise', ms: 1300, label: 'Harmonise: locked glossary terms, consistent across the book' },
  { id: 'structure', ms: 1100, label: 'Headings & structure: running heads, contents, page numbers' },
  { id: 'export', ms: 1900, label: 'Export: typeset PDF, EPUB, DOCX, HTML and Markdown' },
];
const ORDER = PHASES.map((p) => p.id);
const STAGES = ['Rasterise', 'OCR', 'Layout', 'Translate', 'Harmonise', 'Structure', 'Export'];

const SOURCE = [
  { kind: 'heading', text: 'પ્રકરણ ૧' },
  { kind: 'prose', text: 'શ્રીજી મહારાજ ગઢડામાં દાદાખાચરના દરબારમાં બિરાજમાન હતા.' },
  { kind: 'prose', text: 'સભામાં ઘણા સાધુ તથા હરિભક્તો બેઠા હતા.' },
  { kind: 'verse', text: 'અક્ષરધામના ધામી,' },
  { kind: 'verse', text: 'સહજાનંદ સ્વામી.' },
  { kind: 'footnote', text: '૧. ગઢડા - સૌરાષ્ટ્ર' },
];
const TAG = { heading: 'heading', prose: 'prose', verse: 'verse', footnote: 'footnote' };

// [text, glossary?] runs
const TARGET = [
  { kind: 'heading', runs: [['Chapter 1']] },
  { kind: 'prose', runs: [['Shriji Maharaj', true], [' was seated in the '], ['darbar', true], [' of Dada Khachar in Gadhada.']] },
  { kind: 'prose', runs: [['Many '], ['sadhus', true], [' and devotees were seated in the assembly.']] },
  { kind: 'verse', runs: [['Lord of '], ['Akshardham', true], [',']] },
  { kind: 'verse', runs: [['Sahajanand Swami.']] },
  { kind: 'footnote', runs: [['1. Gadhada, in Saurashtra.']] },
];

export default function TranslatorStage() {
  const player = useStagePlayer(PHASES);
  const at = ORDER.indexOf(player.phase.id);
  const past = (id) => at >= ORDER.indexOf(id);
  const [hover, setHover] = useState(-1);
  const pair = (i) => ({ onMouseEnter: () => setHover(i), onMouseLeave: () => setHover(-1), onFocus: () => setHover(i), onBlur: () => setHover(-1), tabIndex: 0 });
  // The two pages are paper in every mode, so their inks, rules, highlighter
  // and OCR boxes stay printed colours: the window’s accent is set for its
  // dark ground (white in Bose, a pale lime in Empowerreg) and would vanish on them.
  const lit = (i) => (hover === i ? { background: 'rgba(217,119,87,0.22)', borderRadius: 3 } : undefined);

  return (
    <div ref={player.ref}>
      <StageWindow title="swaminarayan-translator · facing-page workbench" right={<span>page 12</span>}>
        <ol className="flex flex-wrap gap-1.5 border-b border-line px-4 py-3" aria-label="Pipeline stages">
          {STAGES.map((s, i) => (
            <li
              key={s}
              className="mono rounded px-2 py-1 text-[0.7rem] transition-colors duration-200"
              style={{
                background: i === at ? 'var(--accent)' : i < at ? 'color-mix(in srgb, var(--accent) 18%, transparent)' : 'var(--surface-2)',
                color: i === at ? 'var(--btn-ink)' : i < at ? 'var(--text)' : 'var(--muted)',
              }}
            >
              {s}
            </li>
          ))}
        </ol>
        <div className="grid gap-4 p-4 sm:p-5 md:grid-cols-2">
          {/* scanned source */}
          <div
            className="relative min-h-[17rem] rounded-sm p-5 shadow-inner transition-opacity duration-300"
            style={{ background: '#f1e7d0', color: '#2b2118', opacity: past('rasterise') ? 1 : 0.25 }}
            lang="gu"
          >
            {SOURCE.map((l, i) => (
              <div
                key={i}
                {...pair(i)}
                style={lit(i)}
                className={`relative mb-2 cursor-default outline-none ${l.kind === 'heading' ? 'text-center text-lg font-bold' : ''} ${l.kind === 'verse' ? 'text-center' : ''} ${l.kind === 'footnote' ? 'mt-5 border-t border-[#2b211833] pt-2 text-xs' : 'text-[0.95rem]'}`}
              >
                <span
                  className="relative inline-block px-1 transition-[box-shadow] duration-200"
                  style={{
                    boxShadow: past('ocr') ? '0 0 0 1.5px #ff9900' : 'none',
                    transitionDelay: past('ocr') && at === 1 ? `${i * 140}ms` : '0ms',
                  }}
                >
                  {l.text}
                </span>
                {past('layout') && (
                  <span
                    className="mono absolute -top-2 right-0 rounded px-1 text-[0.6rem] uppercase tracking-wider"
                    style={{ background: 'var(--surface-2)', color: 'var(--text)' }}
                    lang="en"
                  >
                    {TAG[l.kind]}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* typeset English */}
          <div
            className="relative min-h-[17rem] rounded-sm bg-white p-5"
            style={{ color: '#151515', fontFamily: "'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif" }}
          >
            {past('structure') && (
              <p className="mb-3 flex justify-between text-[0.65rem] uppercase tracking-[0.2em] text-[#6b6b6b]">
                <span>Chapter 1</span>
                <span>12</span>
              </p>
            )}
            {TARGET.map((l, i) => {
              const shown = past('translate') && (at > 3 || i <= Math.floor((player.index === 3 ? 6 : 0) * 1));
              return (
                <p
                  key={i}
                  {...pair(i)}
                  className={`mb-2 cursor-default outline-none transition-opacity duration-300 ${l.kind === 'heading' ? 'text-center text-xl' : ''} ${l.kind === 'verse' ? 'text-center italic' : ''} ${l.kind === 'footnote' ? 'mt-5 border-t border-[#0000001f] pt-2 text-xs' : 'text-[0.95rem] leading-relaxed'}`}
                  style={{ ...lit(i), opacity: shown ? 1 : 0, transitionDelay: at === 3 ? `${i * 220}ms` : '0ms', fontVariant: l.kind === 'heading' && past('structure') ? 'small-caps' : 'normal' }}
                >
                  {l.runs.map(([t, gloss], k) => (
                    <span
                      key={k}
                      className="transition-colors duration-300"
                      style={gloss && past('harmonise') ? { fontStyle: 'italic', background: 'rgba(255,153,0,0.22)', borderRadius: 2 } : undefined}
                    >
                      {t}
                    </span>
                  ))}
                </p>
              );
            })}
            {past('export') && (
              <div className="absolute inset-x-4 bottom-4 flex flex-wrap gap-1.5">
                {['PDF', 'EPUB', 'DOCX', 'HTML', 'MD'].map((f, i) => (
                  <span
                    key={f}
                    className="stage-fade mono rounded bg-[var(--surface-2)] px-2 py-1 text-[0.7rem] text-ink"
                    data-on="true"
                    style={{ transitionDelay: `${i * 90}ms` }}
                  >
                    ↓ {f}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </StageWindow>
      <p className="mt-3 text-sm text-muted">Hover a line on either page to see its counterpart.</p>
      <PhaseBar phases={PHASES} player={player} />
    </div>
  );
}
