// A lore card (the design’s §4.8): what the book says, or where the book
// and the films part, bottom left on glass, its title and date in Cinzel
// over the words. `card`: { title, date, text }.
export default function LoreCard({ card }) {
  if (!card) return null;
  return (
    <aside className="road-lore" aria-live="polite">
      <p className="road-lore-head">
        {card.title}
        {card.date && <span> · {card.date}</span>}
      </p>
      <p className="road-lore-text">{card.text}</p>
    </aside>
  );
}
