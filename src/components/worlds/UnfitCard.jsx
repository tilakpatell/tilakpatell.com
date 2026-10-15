import { IconChip } from '../icons';
import { UNFIT_WHY } from './unfitWords';
import { GpuSteps } from './GpuHint';

// What a device the Star Wars worlds cannot run on is shown in their place
// (lib/fit's starWarsFit, WorldGate): the owner's word (2026-10-13) is that
// those worlds need a real GPU, and that for now a device without one is
// told so. The way back, and a small Try anyway for the curious (kept for
// the visit, lib/fit's tp-software). A weak chip that is a processor's own
// graphics gets the way onto a card too, where the computer has one
// (`steps`: the system and the browser, lib/gpuHint).
export default function UnfitCard({ name, why, way, onTry, steps = null }) {
  return (
    <section className="world-unfit">
      <div className="notice world-unfit-card" role="alert">
        <p className="dialog-title world-unfit-title">
          <IconChip aria-hidden="true" /> {name} needs a graphics chip
        </p>
        <p className="world-unfit-text">{UNFIT_WHY[why] ?? UNFIT_WHY.weak} Most laptops from the last few years can play it, at its lowest settings.</p>
        {steps && (
          <>
            <p className="world-unfit-text">If this computer also has an NVIDIA or AMD graphics card, the browser isn’t using it:</p>
            <GpuSteps os={steps.os} browser={steps.browser} />
          </>
        )}
        <div className="world-unfit-actions">
          <a className="btn btn-primary" href={`#${way.to}`}>
            {way.label}
          </a>
          <button type="button" className="btn btn-ghost" onClick={onTry}>
            Try anyway
          </button>
        </div>
      </div>
    </section>
  );
}
