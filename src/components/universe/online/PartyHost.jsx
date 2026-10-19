import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import ErrorBoundary from '../../ErrorBoundary';
import { AWAY, UNIVERSE, cleanWhere, isFlight } from './where';

// Always up, in OnlineProvider (inside the router, online or not): opens the
// party's dialog when something asks ('tp:party', lib/palette's openParty;
// offline it offers the way online), and does what a member's party asks of
// them while it's shut. A summons from the leader (useOnline's `summon`)
// shows top centre with Go and Not now; Go goes there, and after the leader
// once the ship's in where you fly, as the roster's Go does. With Follow the
// leader on, the leader's going somewhere new is followed after a moment
// (FOLLOW_WAIT_MS), with Stay to turn it off instead. The dialog and the
// notices load from PartyDialog.jsx the first time either is wanted, with
// their stylesheet, so a page that never sees them never loads them.

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
  // somewhere you aren't already
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
    if (!following || !leadId) {
      setMoving(null);
      return;
    }
    if (was.id !== leadId || !was.at || !leadAt || was.at === leadAt) return;
    if (reachable(leadAt) && leadAt !== here) setMoving({ id: leadId, name: leadName, where: leadAt });
  }, [following, leadId, leadName, leadAt, here]);
  useEffect(() => {
    if (!moving) return undefined;
    const t = setTimeout(() => {
      setMoving(null);
      going.current(moving.where, moving.id);
    }, FOLLOW_WAIT_MS);
    return () => clearTimeout(t);
  }, [moving]);
  const stay = useCallback(() => {
    setFollowLeader(false);
    setMoving(null);
  }, [setFollowLeader]);

  // a summons to somewhere you can go, and aren't (where you fly, Go is the flight to them)
  const s = online.summon;
  const summon = s && reachable(s.where) && (s.where !== here || isFlight(here)) ? s : null;
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
      {(summon || moving) &&
        createPortal(
          <ErrorBoundary fallback={null}>
            <Suspense fallback={null}>
              <PartyCalls summon={summon} moving={moving} wait={FOLLOW_WAIT_MS} onSummon={answer} onStay={stay} />
            </Suspense>
          </ErrorBoundary>,
          document.body,
        )}
    </>
  );
}
