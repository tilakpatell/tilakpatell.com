// One meter for a place's game, whichever kind it runs (./power.js,
// ./deal.js, ./freeze.js, ./find.js, ./sequence.js, ./climb.js): the stage (../dimensions/stage.js) answers its
// `meter` action with the running kind's readout, RmWorld writes it into
// one HUD cluster through refs, and RmHud names that cluster by the place's
// kind. A place runs one kind at most. Pure and import-free.
//
//   KINDS          the kinds a place may run, by their place() key
//   kindOf(d)      the kind a destination runs, or null
//   METER          each kind's cluster: its title (the cluster's label) and its word for the bar
//                  (and the street's stone, `skip`)
//   METER_OFF      the readout when no game runs

export const KINDS = ['power', 'deal', 'freeze', 'find', 'sequence', 'climb'];

export const kindOf = (d) => KINDS.find((k) => d?.[k]) ?? null;

export const METER = Object.freeze({
  power: { title: 'The world’s charge', label: 'Charge' },
  deal: { title: 'The deal', label: 'Looks' },
  freeze: { title: 'Who’s looking', label: 'Eyes' },
  find: { title: 'Pick-up time', label: 'Time' },
  sequence: { title: 'Going live', label: 'Time' },
  climb: { title: 'Up the beanstalk', label: 'Height' },
  // (not a place's: the street's stone at the park's pond, ../town/skip.js)
  skip: { title: 'The throw', label: 'Power' },
});

export const METER_OFF = Object.freeze({ on: false, vitals: null, line: '' });
