import { IconChip, IconClose } from '../icons';
import { CopyButton } from '../ui';
import { FLAG } from '../../lib/gpuHint';

// How to put the browser on the graphics card (lib/gpuHint says when): the
// system's own setting first, which every browser on it follows; then, in
// Chrome and Edge, the flag Chrome's own WebGPU guide gives for a laptop's
// card; then the card's control panel. Linux starts the browser on it.
export function GpuSteps({ os, browser }) {
  if (os === 'linux') {
    return (
      <ol className="world-gpu-steps">
        <li>
          Start the browser on the card: <code>prime-run</code> before its name for an NVIDIA card, <code>DRI_PRIME=1</code> for an AMD one, or Launch using Dedicated Graphics Card from GNOME’s menu.
        </li>
      </ol>
    );
  }
  const flags = browser === 'edge' ? `edge://flags/#${FLAG}` : `chrome://flags/#${FLAG}`;
  return (
    <ol className="world-gpu-steps">
      <li>In Windows Settings, open System, Display, Graphics; choose the browser (Add desktop app if it isn’t listed), set it to High performance and restart the browser.</li>
      {(browser === 'chrome' || browser === 'edge') && (
        <li>
          Or open <code>{flags}</code> in the address bar, set it to Enabled and relaunch.{' '}
          <CopyButton text={flags} label="Copy the address" className="btn btn-ghost btn-sm world-gpu-copy" />
        </li>
      )}
      <li>With an NVIDIA card, its control panel does the same: Manage 3D settings, Program settings, the browser, High-performance NVIDIA processor.</li>
    </ol>
  );
}

// Over a world, once for each chip (lib/gpuHint's HINT_KEY keeps the one
// told): the site asks for the high-performance chip, and the browser and
// the system decide; this one is drawing on the processor's own graphics.
export function GpuHint({ chip, os, browser, onClose }) {
  return (
    <aside className="world-gate world-gpu-hint" aria-labelledby="world-gpu-hint-title">
      <button type="button" className="world-gate-x" aria-label="Close the graphics hint" onClick={onClose}>
        <IconClose aria-hidden="true" />
      </button>
      <p className="world-gate-title" id="world-gpu-hint-title">
        <IconChip aria-hidden="true" /> Drawing on the built-in graphics
      </p>
      <p className="world-gate-text">
        This browser is drawing on {chip}, the processor’s own graphics. The site asks for the high-performance chip, but the browser and {os === 'linux' ? 'the system' : 'Windows'} choose which one it gets. If this computer also has an NVIDIA or AMD graphics card, the worlds run far better on it:
      </p>
      <GpuSteps os={os} browser={browser} />
      <div className="world-gate-actions">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
          Got it
        </button>
      </div>
    </aside>
  );
}
