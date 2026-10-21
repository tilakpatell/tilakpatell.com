// The Sorting card’s screen as the kit’s Screen draws one (a game’s screen
// tree: boxes in the card’s own units, placed in per cent of it): the
// eyebrow, the Hat’s question and its four answers as the list’s buttons.
// Two shapes: wide, the answers two by two, and tall for a phone held
// upright, the answers one under another. Pure.
//
//   sortingTree(q, { tall }) → tree | null

import { QUESTIONS } from '../rules/sorting';

const WIDE = [1000, 560];
const TALL = [600, 900];

export function sortingTree(q, { tall = false } = {}) {
  const question = QUESTIONS[q];
  if (!question) return null;
  const [w, h] = tall ? TALL : WIDE;
  const pad = tall ? 36 : 48;
  const askH = tall ? 210 : 150;
  const top = pad + 44 + askH + (tall ? 16 : 12);
  const gap = tall ? 14 : 12;
  const rows = tall ? 4 : 2;
  const cols = tall ? 1 : 2;
  const cellW = (w - pad * 2 - gap * (cols - 1)) / cols;
  const cellH = (h - top - pad - gap * (rows - 1)) / rows;
  return {
    name: 'hp-sorting',
    size: [w, h],
    boxes: [
      { id: 'hp-sorting/eyebrow', type: 'text', x: pad, y: pad, w: w - pad * 2, h: 36, text: `The Sorting Hat · ${q + 1} of ${QUESTIONS.length}` },
      { id: 'hp-sorting/ask', type: 'text', wrap: true, x: pad, y: pad + 44, w: w - pad * 2, h: askH, text: question.ask },
      {
        id: 'hp-sorting/answers',
        type: 'staticList',
        x: pad,
        y: top,
        w: w - pad * 2,
        h: h - top - pad,
        children: question.answers.map((a, i) => ({ id: `hp-sorting/answers/a${i}`, type: 'cell', x: pad + (i % cols) * (cellW + gap), y: top + Math.floor(i / cols) * (cellH + gap), w: cellW, h: cellH, label: `${i + 1}. ${a.text}` })),
      },
    ],
  };
}
