import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import LoadingVeil from './LoadingVeil';
import { STEP_WORDS, waitingLine } from './loadingSteps';

describe('the loading veil', () => {
  it('says what the world is doing and how far along it is', () => {
    const html = renderToStaticMarkup(<LoadingVeil shown progress={0.42} step="shaders" title="The universe" />);
    expect(html).toContain('The universe');
    expect(html).toContain(STEP_WORDS.shaders);
    expect(html).toContain('42%');
    expect(html).toContain('scaleX(0.42)');
  });
  it('keeps the bar inside its track whatever it is told', () => {
    expect(renderToStaticMarkup(<LoadingVeil shown progress={3} />)).toContain('scaleX(1)');
    expect(renderToStaticMarkup(<LoadingVeil shown progress={Number.NaN} />)).toContain('scaleX(0)');
  });
  it('shows nothing when it was never shown', () => {
    expect(renderToStaticMarkup(<LoadingVeil shown={false} />)).toBe('');
  });
  it('says why once a step has held, and offers the way in anyway', () => {
    expect(waitingLine('load', 'https://x.supabase.co/a1/models/galaxy/bf2017/crew/luke.glb?v=2')).toBe('Waiting for luke.glb');
    expect(waitingLine('pictures')).toBe('Still sending pictures to the graphics chip');
    const html = renderToStaticMarkup(<LoadingVeil shown progress={0.33} step="pictures" waiting="Waiting for luke.glb" onSkip={() => {}} />);
    expect(html).toContain('Waiting for luke.glb');
    expect(html).toContain('Go in anyway');
    expect(renderToStaticMarkup(<LoadingVeil shown progress={0.33} step="pictures" />)).not.toContain('Go in anyway');
  });
});
