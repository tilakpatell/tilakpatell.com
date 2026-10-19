// The universe's face for the wallet, light enough for any page: the hook
// that reads it (EconomyProvider.jsx's, mounted in App.jsx) and its levels
// and their titles, and earning into it (useEarn, the pay-once ledger and
// what each deed pays) for a world that pays in. (The Hangar's own face,
// hangar.js, brings the shipyard.)

export { useEconomy } from '../EconomyProvider';
export { EARN, LEVELS, TITLES } from '../economy';
export { useEarn } from '../useEarn';
export { createPayLedger } from '../earnRules';
