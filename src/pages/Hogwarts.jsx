import { useDocumentTitle } from '../lib/hooks';
import HogwartsWorld from '../components/hogwarts/HogwartsWorld';
import ModelCredits from '../components/ModelCredits';

// Hogwarts (/hogwarts): the Harry Potter world on the world runtime. For now
// the shore of the Black Lake the night the first-years come, the castle lit
// across the water (components/hogwarts/; the design is
// docs/superpowers/specs/2026-10-21-hogwarts-world-design.md). Under it,
// who made the models that aren't the site's own (the castle among them).
export default function Hogwarts() {
  useDocumentTitle('Hogwarts');
  return (
    <div className="pt-[var(--nav-h)]">
      <HogwartsWorld />
      <ModelCredits where="hogwarts" line className="block px-4 py-3 text-xs text-muted" />
    </div>
  );
}
