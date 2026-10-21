// What Peter says on the way to school (Thwip.jsx). The count of backpacks
// is put in as it happens.

// now and then, when he's flying well
export const QUIPS = ['Sorry! Sorry! Late for school!', 'Hey, Mr. Delmar! Can’t stop!', 'Okay, that was a cool one.', 'Karen, how late am I? Don’t answer that.', 'Ned is never going to let me hear the end of this.', 'Whoa. Okay. Big gap. Big gap.'];

// and when something happens
export const SAYS = {
  start: 'Okay. Two kilometres. The bell goes in a hundred seconds. No problem.',
  pack: 'My backpack! I’ve been looking for that.',
  street: 'Sorry! Sorry! Get up, get up.',
};

// the ones that are the same every time, and so can be said in his own voice (lib/voiced.js)
export const SPOKEN = [...QUIPS, ...Object.values(SAYS)];
