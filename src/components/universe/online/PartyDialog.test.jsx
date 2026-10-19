import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { ChatTab, PartyCalls, PartySheet, PartyTab, QuickTab } from './PartyDialog';
import { QUIPS } from './quips';
import { CHAT_MAX, PARTY_MAX } from './partyWire';

const ALPHA = 'a'.repeat(64);
const BRAVO = 'b'.repeat(64);
const CHARLIE = 'c'.repeat(64);
const DELTA = 'd'.repeat(64);
const ECHO = 'e'.repeat(64);
const PARTY = '0123456789abcdef';

const member = (id, name, rest = {}) => ({ id, name, since: 1, present: true, where: '/projects', leader: false, you: false, ...rest });
// your party as the link's snapshot has it: you (Alpha) lead, Bravo is in Bree, Charlie's offline
const led = { id: PARTY, leader: ALPHA, epoch: 3, members: [member(ALPHA, 'Alpha', { leader: true, you: true }), member(BRAVO, 'Bravo', { where: '/middle-earth/bree' }), member(CHARLIE, 'Charlie', { present: false, where: null })] };
// …and as a member of Bravo's
const theirs = { id: PARTY, leader: BRAVO, epoch: 4, members: [member(BRAVO, 'Bravo', { leader: true, where: '/middle-earth/bree' }), member(ALPHA, 'Alpha', { you: true })] };
const peers = [
  { id: BRAVO, name: 'Bravo', ally: 'none', blocked: false, where: '/middle-earth/bree' },
  { id: DELTA, name: 'Delta', ally: 'ally', blocked: false, where: '/projects' },
  { id: ECHO, name: '', ally: 'none', blocked: true, where: null },
];

// the online state as useOnline.js hands it over, online on /projects
const online = (over = {}) => ({
  on: true,
  name: 'Alpha',
  where: '/projects',
  room: { status: 'online', self: { name: 'Alpha' }, peers, away: [] },
  party: { party: null, invites: [], follow: false },
  chat: [],
  unread: 0,
  markRead() {},
  say: async () => true,
  quip() {},
  partyDo() {},
  followLeader: false,
  setFollowLeader() {},
  suggest: () => 'Alpha',
  goOnline() {},
  retry() {},
  follow() {},
  ...over,
});
const html = (el) => renderToStaticMarkup(<MemoryRouter>{el}</MemoryRouter>);
const words = (el) =>
  html(el)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
// a member's row, by their name
const row = (markup, name) => markup.split('<li').find((li) => li.includes(`<b>${name}</b>`)) ?? '';

describe('the party dialog', () => {
  it('is a modal dialog named by its title', () => {
    const out = html(<PartySheet online={online()} request={{ tab: null }} onClose={() => {}} />);
    expect(out).toMatch(/role="dialog"/);
    expect(out).toMatch(/aria-modal="true"/);
    const named = out.match(/aria-labelledby="([^"]+)"/)[1];
    expect(out).toMatch(new RegExp(`<h2 id="${named}" class="dialog-title"[^>]*>Party</h2>`));
    expect(out).toContain('aria-label="Close"'); // (not “Close the party”: that reads as ending it)
  });

  it('has three tabs in the house switch, the party’s first', () => {
    const out = html(<PartySheet online={online()} request={{ tab: null }} onClose={() => {}} />);
    expect(out).toMatch(/class="party-tabs switch" data-size="md" role="tablist"/);
    const tabs = [...out.matchAll(/role="tab"[^>]*aria-selected="(true|false)"[^>]*>([^<]+)/g)].map((m) => [m[2], m[1]]);
    expect(tabs).toEqual([
      ['Party', 'true'],
      ['Chat', 'false'],
      ['Quick chat', 'false'],
    ]);
    expect(out).toMatch(/role="tabpanel"/);
  });

  it('opens on the tab it was asked for, and on the party’s for one it doesn’t have', () => {
    const quick = html(<PartySheet online={online()} request={{ tab: 'quick' }} onClose={() => {}} />);
    expect(quick).toMatch(/aria-selected="true"[^>]*>Quick chat/);
    expect(quick).toContain('On my way');
    const odd = html(<PartySheet online={online()} request={{ tab: 'settings' }} onClose={() => {}} />);
    expect(odd).toMatch(/aria-selected="true"[^>]*>Party/);
  });

  it('marks the Chat tab while a line waits unread', () => {
    const party = { party: led, invites: [], follow: false };
    expect(html(<PartySheet online={online({ party, unread: 2 })} request={{ tab: 'party' }} onClose={() => {}} />)).toMatch(/>Chat<span class="party-dot"/);
    expect(html(<PartySheet online={online({ party, unread: 0 })} request={{ tab: 'party' }} onClose={() => {}} />)).not.toContain('party-dot');
  });
});

describe('the Party tab', () => {
  it('offline, is the corner’s way online', () => {
    const out = html(<PartyTab online={online({ on: false, party: null, room: { status: 'off', peers: [] } })} />);
    expect(out).toContain('Your callsign');
    expect(out).toContain('value="Alpha"');
    expect(out).toMatch(/<button type="submit" class="btn btn-primary btn-sm">Go online<\/button>/);
    expect(out).toContain('public Nostr relays');
  });

  it('says so while it looks for the others, and offers another go when it can’t', () => {
    expect(words(<PartyTab online={online({ party: null, room: { status: 'connecting', peers: [] } })} />)).toContain('Looking for other pilots…');
    expect(words(<PartyTab online={online({ party: null, room: { status: 'failed', peers: [] } })} />)).toContain('Couldn’t reach the other pilots. Try again');
  });

  it('out of a party, offers to start one, and shows the invites waiting', () => {
    const invite = { from: BRAVO, name: 'Bravo', party: 'fedcba9876543210', leader: BRAVO, at: 1 };
    const out = html(<PartyTab online={online({ party: { party: null, invites: [invite], follow: false } })} />);
    expect(out).toMatch(/<button type="button" class="btn btn-primary btn-sm">Start a party<\/button>/);
    expect(words(<PartyTab online={online({ party: { party: null, invites: [invite], follow: false } })} />)).toContain('Bravo asks you to their party');
    expect(out).toContain('aria-label="Join Bravo’s party"');
    expect(out).toContain('aria-label="Turn down Bravo’s invite"');
  });

  it('lists the members: the leader, you, and where each is or that they’re offline', () => {
    const out = html(<PartyTab online={online({ party: { party: led, invites: [], follow: false } })} />);
    expect(row(out, 'Alpha')).toMatch(/leader/);
    expect(row(out, 'Alpha')).toMatch(/you/);
    expect(row(out, 'Bravo')).toContain('Bree');
    expect(row(out, 'Charlie')).toContain('not online');
    expect(row(out, 'Charlie')).toContain('data-away');
    expect(words(<PartyTab online={online({ party: { party: led, invites: [], follow: false } })} />)).toContain(`3 of ${PARTY_MAX}`);
  });

  it('gives the leader Remove, Make leader and Summon', () => {
    const out = html(<PartyTab online={online({ party: { party: led, invites: [], follow: false } })} />);
    expect(out).toContain('aria-label="Make Bravo leader"');
    expect(out).toContain('aria-label="Remove Bravo from the party"');
    expect(out).toContain('aria-label="Remove Charlie from the party"');
    expect(out).not.toContain('aria-label="Make Charlie leader"'); // (offline: they'd hold the party up)
    expect(out).not.toContain('aria-label="Remove Alpha');
    expect(out).toMatch(/>Summon</);
    expect(out).not.toContain('Follow the leader');
  });

  it('invites only those online, not in it already and not blocked, your allies first', () => {
    const foxtrot = { id: 'f'.repeat(64), name: 'Foxtrot', ally: 'none', blocked: false, where: '/universe' };
    const out = html(<PartyTab online={online({ party: { party: led, invites: [], follow: false }, room: { status: 'online', peers: [foxtrot, ...peers] } })} />);
    expect(out.indexOf('Invite Delta')).toBeLessThan(out.indexOf('Invite Foxtrot'));
    expect(out).toContain('aria-label="Invite Delta to your party"');
    expect(out).not.toContain('aria-label="Invite Bravo');
    expect(out).not.toContain('Blocked');
    expect(out).toMatch(/>Leave the party</);
  });

  it('gives a member Leave and Follow the leader, and none of the leader’s', () => {
    const out = html(<PartyTab online={online({ party: { party: theirs, invites: [], follow: true }, followLeader: true })} />);
    expect(out).not.toContain('Make Bravo leader');
    expect(out).not.toContain('Remove Bravo');
    expect(out).not.toMatch(/>Summon</);
    expect(out).toContain('Follow the leader');
    expect(out).toMatch(/<button type="button" aria-pressed="true"[^>]*>On<\/button>/);
    expect(out).toMatch(/>Leave the party</);
    // (Bravo, elsewhere and online: a way to go to them)
    expect(out).toContain('aria-label="Go to Bree, where Bravo is"');
  });

  it('says when the party’s full, and offers no invites', () => {
    const many = { ...led, members: [...led.members, ...'45678'.split('').map((d) => member(d.repeat(64), `Pilot ${d}`))] };
    expect(many.members).toHaveLength(PARTY_MAX);
    const out = html(<PartyTab online={online({ party: { party: many, invites: [], follow: false } })} />);
    expect(out).toContain('Your party is full');
    expect(out).not.toContain('aria-label="Invite');
  });
});

describe('the Chat tab', () => {
  it('outside a party, says how to get one', () => {
    expect(words(<ChatTab online={online()} />)).toContain('Start or join a party to chat');
  });

  it('shows each line with who said it and when', () => {
    const chat = [
      { key: 1, from: BRAVO, name: 'Bravo', text: 'Meet at the Prancing Pony', seen: Date.UTC(2026, 9, 19, 18, 5), mine: false },
      { key: 2, from: ALPHA, name: 'Alpha', text: 'On my way', seen: Date.UTC(2026, 9, 19, 18, 6), mine: true },
    ];
    const out = html(<ChatTab online={online({ party: { party: led, invites: [], follow: false }, chat })} />);
    expect(row(out, 'Bravo')).toContain('Meet at the Prancing Pony');
    expect(row(out, 'Bravo')).toContain('<time dateTime="2026-10-19T18:05:00.000Z"');
    expect(row(out, 'Alpha')).toContain('data-mine');
    expect(out).toMatch(/aria-live="polite"/);
  });

  it('has a field held to CHAT_MAX with its count, Send, and says the lines are sealed', () => {
    const out = html(<ChatTab online={online({ party: { party: led, invites: [], follow: false } })} />);
    expect(out).toMatch(/<input[^>]*class="party-input"/);
    expect(words(<ChatTab online={online({ party: { party: led, invites: [], follow: false } })} />)).toContain(`0/${CHAT_MAX}`);
    expect(out).toMatch(/<button type="submit"[^>]*>Send<\/button>/);
    expect(out).toMatch(/only your party/i);
    expect(out).toMatch(/sealed/);
  });

  it('can’t send while no one else in the party is online', () => {
    const alone = { ...led, members: [led.members[0], led.members[2]] };
    const out = html(<ChatTab online={online({ party: { party: alone, invites: [], follow: false } })} />);
    expect(out).toMatch(/<button type="submit"[^>]*disabled=""[^>]*>Send/);
    expect(out).toContain('No one else in your party is online');
  });
});

describe('the Quick chat tab', () => {
  it('is every quip as a button, and says who sees them', () => {
    const out = html(<QuickTab online={online()} />);
    for (const q of QUIPS) expect(out).toContain(`>${q}</button>`);
    expect(out.match(/<button/g)).toHaveLength(QUIPS.length);
    expect(out).toMatch(/everyone near/i);
  });

  it('offline, is the way online', () => {
    expect(html(<QuickTab online={online({ on: false, party: null, room: { status: 'off', peers: [] } })} />)).toContain('Go online');
  });
});

describe('the party’s calls', () => {
  it('asks a summoned member to Go or not', () => {
    const out = html(<PartyCalls summon={{ from: BRAVO, name: 'Bravo', where: '/middle-earth/bree' }} onSummon={() => {}} />);
    expect(out.replace(/<[^>]+>/g, '')).toContain('Bravo summons the party to Bree');
    expect(out).toMatch(/>Go<\/button>/);
    expect(out).toMatch(/>Not now<\/button>/);
  });

  it('says it’s following the leader, with Stay', () => {
    const out = html(<PartyCalls moving={{ id: BRAVO, name: 'Bravo', where: '/middle-earth/bree' }} onStay={() => {}} />);
    expect(out.replace(/<[^>]+>/g, '')).toContain('Following Bravo to Bree');
    expect(out).toMatch(/>Stay<\/button>/);
  });

  it('is nothing with nothing to say', () => {
    expect(html(<PartyCalls />)).toBe('');
  });
});
