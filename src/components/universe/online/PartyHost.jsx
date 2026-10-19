import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import ErrorBoundary from '../../ErrorBoundary';
import { AWAY, UNIVERSE, cleanWhere, isFlight } from './where';

// Always up, in OnlineProvider (inside the router, online or not): opens the
// party's dialog when something asks ('tp:party', lib/palette's openParty;
// offline it offers the way online), and does what a member's party asks of
// them while it’s shut. A summons from the leader of your party (useOnline’s
// `summon`) shows top centre with Go and Not now; Go goes there, and after
// the leader once the ship’s in where you fly, as the roster’s Go does. With
// Follow the leader on, the leader’s going somewhere new is followed after a
// moment (FOLLOW_WAIT_MS), with Stay to turn it off instead. Both wait while
// the dialog’s up: under its scrim and out of its focus trap, Go and Stay
// couldn’t be pressed. The dialog and the notices load from PartyDialog.jsx
// the first time either is wanted, with their stylesheet, so a page that
// never sees them never loads them; the live region they’re read out from
// doesn’t, as it has to be there before them.

const PartyDialog = lazy(() => import('./PartyDialog'));
const PartyCalls = lazy(() => import('./PartyDialog').then((m) => ({ default: m.PartyCalls })));
const FOLLOW_WAIT_MS = 5000; // the moment to press Stay before the party follows its leader

// a place a pilot can be followed to: one on the site's map, not “somewhere else”
const reachable = (where) => Boolean(cleanWhere(where)) && where !== AWAY;
const pathOf = (where) => (where === UNIVERSE ? '/universe' : where);

function Shut({ onClose }) {
  useEffect(() => onClose(), [onClose]);
  return null;
}

export default function PartyHost({ online }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(null); // what openParty asked ({ tab }), while the dialog's up
  const close = useCallback(() => setOpen(null), []);
  useEffect(() => {
    const onOpen = (e) => setOpen({ tab: e.detail?.tab ?? null });
    window.addEventListener('tp:party', onOpen);
    return () => window.removeEventListener('tp:party', onOpen);
  }, []);

  const { follow, setFollowLeader, answerSummon, where: here } = online;
  // to a member: the page, and after them once the ship's in, where you fly
  const goTo = useCallback(
    (where, id) => {
      if (isFlight(where)) follow(id);
      navigate(pathOf(where));
    },
    [follow, navigate],
  );
  const going = useRef(goTo); // (the latest, for a timer set before the page changed)
  going.current = goTo;

  // Follow the leader: only a move counts (the same leader, seen somewhere,
  // somewhere new now), not a new leader nor one coming online, and only to
  // somewhere you aren’t already. Each move of theirs decides afresh, so one
  // still waiting is let go when they come back to you, go on somewhere no
  // one can follow or go offline: the moment’s up only where they still are.
  const party = online.party?.party ?? null;
  const following = Boolean(online.party?.follow);
  const lead = party?.members.find((m) => m.leader && !m.you) ?? null;
  const leadId = lead?.id ?? null;
  const leadName = lead?.name ?? null;
  const leadAt = lead?.present ? (lead.where ?? null) : null;
  const seen = useRef({ id: null, at: null });
  const [moving, setMoving] = useState(null); // { id, name, where }: off after them in a moment
  useEffect(() => {
    const was = seen.current;
    seen.current = { id: leadId, at: leadAt };
    if (!following || !leadId || was.id !== leadId) {
      setMoving(null);
      return;
    }
    if (was.at === leadAt) return;
    setMoving(was.at && leadAt && reachable(leadAt) && leadAt !== here ? { id: leadId, name: leadName, where: leadAt } : null);
  }, [following, leadId, leadName, leadAt, here]);
  // (the moment to press Stay starts once the dialog’s shut and its notice shows)
  const shut = !open;
  useEffect(() => {
    if (!moving || !shut) return undefined;
    const t = setTimeout(() => {
      setMoving(null);
      going.current(moving.where, moving.id);
    }, FOLLOW_WAIT_MS);
    return () => clearTimeout(t);
  }, [moving, shut]);
  const stay = useCallback(() => {
    setFollowLeader(false);
    setMoving(null);
  }, [setFollowLeader]);

  // a summons to somewhere you can go, and aren’t (where you fly, Go is the
  // flight to them), from the leader of the party you’re in: one heard before
  // you left, or were removed, or followed someone else, isn’t yours to answer
  const s = online.summon;
  const summon = s && party?.leader === s.from && reachable(s.where) && (s.where !== here || isFlight(here)) ? s : null;
  const answer = useCallback(
    (go) => {
      const to = answerSummon(go);
      if (to) navigate(pathOf(to));
    },
    [answerSummon, navigate],
  );

  return (
    <>
      {open && (
        <ErrorBoundary fallback={<Shut onClose={close} />}>
          <Suspense fallback={null}>
            <PartyDialog online={online} request={open} onClose={close} />
          </Suspense>
        </ErrorBoundary>
      )}
      {/* (one live region, up from the start and empty: a call put into a
          region that’s already there is read out, where one born with its
          call in it isn’t) */}
      {createPortal(
        <div className="party-calls" aria-live="polite">
          {shut && (summon || moving) && (
            <ErrorBoundary fallback={null}>
              <Suspense fallback={null}>
                <PartyCalls summon={summon} moving={moving} wait={FOLLOW_WAIT_MS} onSummon={answer} onStay={stay} />
              </Suspense>
            </ErrorBoundary>
          )}
        </div>,
        document.body,
      )}
    </>
  );
}
