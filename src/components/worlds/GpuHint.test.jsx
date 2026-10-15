import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { GpuHint, GpuSteps } from './GpuHint';

const hint = (props) => renderToStaticMarkup(<GpuHint chip="AMD Radeon 740M Graphics" os="windows" browser="chrome" onClose={() => {}} {...props} />);

describe('the graphics hint', () => {
  it('names the chip drawing and says who chooses it', () => {
    const html = hint();
    expect(html).toContain('AMD Radeon 740M Graphics');
    expect(html).toContain('the browser and Windows choose');
    expect(html).toContain('If this computer also has an NVIDIA or AMD graphics card');
    expect(html).toContain('Got it');
  });

  it('gives Windows’ setting everywhere, and the flag in Chrome and Edge only', () => {
    expect(hint()).toContain('chrome://flags/#force-high-performance-gpu');
    expect(hint({ browser: 'edge' })).toContain('edge://flags/#force-high-performance-gpu');
    const firefox = hint({ browser: 'firefox' });
    expect(firefox).toContain('Display, Graphics');
    expect(firefox).not.toContain('flags/#');
  });

  it('starts the browser on the card on Linux', () => {
    const html = renderToStaticMarkup(<GpuSteps os="linux" browser="firefox" />);
    expect(html).toContain('prime-run');
    expect(html).toContain('DRI_PRIME=1');
    expect(html).not.toContain('Windows Settings');
  });
});
