# The site tour

A first visit gets a welcome (what the site is, and its one question: the intro, the universe or the classic site), then the intro if it was asked for; the front door's choice is the welcome's answer (`docs/decisions/2026-10-18-one-question-on-arrival.md`). Then it is left on its own with a 3D map, a nav full of switches and a "?" in the corner. The guide answers "what are this page's controls?", but nothing yet shows a newcomer round the site itself: where the pages are, what the Universe and Classic switch does, that ⌘K goes anywhere, that the colours are companies, that "?" has the rest. The tour does that, once, in under a minute, and is there to take again.

## What it is

A spotlight tour of the shell: a dimmed page with one thing lit at a time, and a card beside it saying what it is. Back, Next, Skip; the arrow keys, Enter and Escape do the same. It ends on a card saying where to take it again.

There are two tours, one per view of the site:

- **The universe** (`/`, `/universe/…`): the panel, the ships, the nav map, the Universe and Classic switch, search, the colours, the guide, the résumé.
- **The classic site** (the feed's pages and the rest): the pages in the nav (one long feed), the switch, search, the colours, the terminal, the guide, the résumé.

A stop whose thing isn't on the screen is left out, so the same tour fits a phone: the nav's links, search and colours are folded into the menu there, and the menu's stop shows instead.

## How it starts

- **On a first arrival**, once nothing is covering the page (the intro, the front door's choice, the phone menu, any dialog), a small card offers it: "Take the tour" or "Not now". It is offered once (`tp-tour` in localStorage), and only on the universe and the classic pages, never over a world, which has its own first hint and guide note.
- **Any time after**: ⌘K's "Take the tour of the site", the guide's "The site" tab, and the terminal's `tour`.
- "Start over" forgets it with the rest of the visit, so a restart offers it again.

Finishing it unlocks an achievement ("Shown around").

## Where things live

- `src/lib/tour.js` (pure, tested): which tour a path gets, the offer's rules, which stops survive on this screen, and where the card goes beside its target (`placeCard`: below, above, right, left, whichever fits, kept on screen).
- `src/components/tour/steps.js` (data, tested): the two tours' stops, each naming the `data-tour` target it lights.
- `src/components/tour/TourHost.jsx`: always in the shell, small. Listens for `tp:tour`, makes the first-arrival offer, and loads the tour.
- `src/components/tour/Tour.jsx` and `tour.css`: the spotlight and the card, loaded the first time a tour starts.
- Targets are marked in place with `data-tour="name"` (a space-separated list where one element is more than one stop). Where two elements carry a name (the guide's corner button and the universe panel's "?"), the first one showing wins.

## Behaviour

- While it runs, `html[data-touring]` keeps the nav and the guide button out (the nav hides on scroll; the guide's button tucks away on a phone), and the guide's `?` key waits.
- It is a modal dialog: focus moves to it and stays in it, the page under it takes no clicks or keys (the universe doesn't fly), Escape ends it, and focus goes back where it was.
- Each stop is announced (title and text) for screen readers.
- The card follows its target as the page scrolls or resizes. A target that scrolls (the ships inside the panel) is scrolled into view first.
- Reduced motion: no glide between stops.
