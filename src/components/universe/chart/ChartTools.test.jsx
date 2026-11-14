import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ChartTools from './ChartTools';
import { CHART_WORDS as W } from '../words';

const f = () => {};
const button = (html, label) => html.match(new RegExp(`<button[^>]*aria-label="${label}"[^>]*>`))?.[0] ?? null;

describe('the chart’s tools', () => {
  it('says each in the glossary’s words, marking the ones with nothing to do', () => {
    const html = renderToStaticMarkup(<ChartTools buttonClass="navmap-tool" onZoomIn={f} onZoomOut={f} onShip={f} atShip onFlat={f} flat={false} />);
    for (const w of [W.zoomIn, W.zoomOut, W.toShip, W.flat]) expect(button(html, w), w).not.toBeNull();
    expect(button(html, W.toShip)).toContain('aria-disabled="true"');
    expect(button(html, W.flat)).not.toContain('aria-disabled');
    expect(button(html, W.fit)).toBeNull();
  });
});
