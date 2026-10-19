// On coming back to a ride past its first stage: carry on from where it
// was, or start again from Bag End. Enter is the first.
export default function ResumeCard({ stage, onCarryOn, onRestart }) {
  return (
    <section className="road-resume" role="dialog" aria-label="Carry on the Road">
      <button type="button" className="btn btn-primary" onClick={onCarryOn} autoFocus>
        Carry on from {stage}
      </button>
      <button type="button" className="btn btn-ghost" onClick={onRestart}>
        Start again
      </button>
    </section>
  );
}
