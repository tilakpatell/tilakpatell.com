// A stage’s title card (the design’s §4.2): its name in Cinzel and its
// date in the Tale of Years, on glass at the bottom left, for a few
// seconds as the stage opens, and the tale so far (stages/tales.js) under
// them. The first stage opens with the Road’s own card and how to walk it.
export default function TitleCard({ name, date, tale = null, first = false }) {
  return (
    <section className="road-title" aria-live="polite" data-first={first || undefined}>
      {first ? (
        <>
          <h2 className="road-title-name">The Road</h2>
          <p className="road-title-date">Bag End to the fire</p>
          {tale && <p className="road-title-tale">{tale}</p>}
          <p className="road-title-hint">Hold W to walk · E when the road asks something of you · T to talk · drag to look · Space for the road to walk itself</p>
        </>
      ) : (
        <>
          <h2 className="road-title-name">{name}</h2>
          <p className="road-title-date">{date}</p>
          {tale && <p className="road-title-tale">{tale}</p>}
        </>
      )}
    </section>
  );
}
