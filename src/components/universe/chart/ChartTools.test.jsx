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
  it('draws them in order, in a named group, with the key in the title', () => {
    const html = renderToStaticMarkup(<ChartTools className="navmap-tools" buttonClass="chip" onZoomIn={f} onZoomOut={f} onShip={f} atShip={false} onFlat={f} onFit={f} />);
    expect(html).toMatch(new RegExp(`^<div class="navmap-tools" role="group" aria-label="${W.tools}">`));
    expect([...html.matchAll(/aria-label="([^"]+)"/g)].map((m) => m[1]).slice(1)).toEqual([W.zoomIn, W.zoomOut, W.toShip, W.flat, W.fit]);
    expect(button(html, W.zoomIn)).toContain(`title="${W.zoomIn} (+)"`);
    expect(button(html, W.zoomOut)).toContain(`title="${W.zoomOut} (−)"`);
    expect(button(html, W.toShip)).toContain(`title="${W.toShip} (0)"`);
    expect(button(html, W.toShip)).not.toContain('aria-disabled');
    expect(button(html, W.flat)).toContain('aria-disabled="true"');
    expect(button(html, W.fit)).toContain('class="chip"');
  });
  it('gives show everything a key where there’s no ship tool to have it', () => {
    const mini = renderToStaticMarkup(<ChartTools buttonClass="chip" onZoomIn={f} onZoomOut={f} onFit={f} fitKey="0" />);
    expect(button(mini, W.fit)).toContain(`title="${W.fit} (0)"`);
    const nav = renderToStaticMarkup(<ChartTools buttonClass="chip" onZoomIn={f} onZoomOut={f} onShip={f} atShip={false} onFit={f} fitKey="0" />);
    expect(button(nav, W.toShip)).toContain(`title="${W.toShip} (0)"`);
    expect(button(nav, W.fit)).toContain(`title="${W.fit}"`);
  });
});
