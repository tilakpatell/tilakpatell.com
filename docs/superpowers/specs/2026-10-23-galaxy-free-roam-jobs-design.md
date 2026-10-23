# Free roam with something to do: jobs

The owner, 2026-10-23: “star wars worlds will change as we incorporate
battlefront; for now make it so free roam we can do stuff”.

A galaxy world’s free roam had its quests (each paid once and done for
good), its places to find, and on a war world the ground war’s raids and
posts. Once the quests were done there was nothing to take on, and on a
world off the war map nobody came at you at all.

## Jobs

A board of three jobs, always there in free roam on a world’s ground
(`surface/jobs.js`’s `jobsOn`: no mission, not Cloud City’s clouds), taken
one at a time and paid every time. Each job is a quest in `quests.js`’s
shape, so the scene runs it as it runs the world’s own: the beam, the
compass, the step’s text, the spawns and their heads. Nothing new draws a
job; only the board is new.

- **Bounty**: three to five of the world’s foes at a place, all brought down.
- **Salvage**: four crates at a place, sometimes with two foes on them, and
  back to the ship.
- **Courier**: a parcel from by the ship to a place, in a time the run
  allows with some to spare.
- **Speeder run**: on one of the world’s own speeders (the landspeeder, the
  speeder bike), a loop of seven gates in time.
- **Patrol**: out to a place, an ambush there that comes for you, and back.

The world gives each job its parts:

- its **places** within 70 to 380 m of you first, else open ground there
  that is dry, in the world’s reach, clear of what is built and not steep
  (the scene’s `jobOk`);
- its **foes**: the gunmen its own quests send at you, tuned as they are
  there (no bosses: no blade, no shield, nothing over 4 hp), never your own
  side’s (sworn to the Empire, no bounties on stormtroopers), the war’s
  holder where it is your enemy, in the world’s uniform; hired guns where
  there is nobody else;
- its **speeders**, where it has them.

A board is made the first frame you are on your feet outdoors
(`jobPlay.js`’s `ready`) and again from wherever you are once a job is
done, with new ids, so the next three are near where you ended up.

## The page

The quest box shows **J Jobs · 3** beside **Q Things to do**; J and Q
both open the list, which has the board under the world’s quests (each
with what it pays). A job done pays the wallet’s `jobDone` (120 credits
and 30 xp) times the job’s `pay` (1 or 2), every time, and goes in no list
of what is done. The guide’s keys say J.

## Free roam from a mission

The battle picker’s Free roam only shut the picker, so choosing it from a
mission kept the mission on. From a mission it now goes to the world in
free roam (`?mode=free`).

## Checks

`jobs.test.js` makes a board on every world you walk on and holds each job
to the quest rules and its spawns to dry ground; `jobPlay.test.js` holds
the board’s keeping. A probe in a browser lands on Tatooine in free roam,
reads the board, takes a job, finishes it and reads the next board.
