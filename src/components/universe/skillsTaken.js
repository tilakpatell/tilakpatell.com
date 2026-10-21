// The skill tree's nodes taken, as its provider reads them (hangar/skills's
// SkillsProvider, mounted below the wallet's, tells it as it reads them):
// the wallet's skill locks ask here (EconomyProvider.jsx's skillOf), so the
// wallet needn't wait on the tree, nor the tree on the wallet.

let taken = [];
export const tellSkills = (nodes) => {
  taken = Array.isArray(nodes) ? nodes : [];
};
export const skillTaken = (id) => taken.includes(id);
