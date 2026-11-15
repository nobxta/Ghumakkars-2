/* Run: npx tsx lib/instagram-tracker/rules-core.check.ts — scenario checks for the rule matcher. */
import assert from 'node:assert/strict';
import { isTagOrEmojiOnly, keywordHit, matchRule, renderText, type RuleCore } from './rules-core';
import { chooseTrips, tripSubtitle, type TripRow } from './trip-pick';

const base = (p: Partial<RuleCore>): RuleCore => ({
  channel: 'dm', name: 'r', trigger: 'keywords', keywords: [], match_type: 'contains', media_ids: [], active_from: null, active_to: null,
  is_active: true, action: 'reply', conditions: {}, ...p,
});
// 2026-11-14 is a Saturday. 15:00 IST = 09:30 UTC.
const SAT_3PM = new Date('2026-11-14T09:30:00Z');
const SUN_11PM = new Date('2026-11-15T17:30:00Z');

const rules: RuleCore[] = [
  base({ name: 'Ignore ok', keywords: ['ok', 'thanks', 'thank you'], match_type: 'exact', action: 'ignore', position: 1 }),
  base({ name: 'Complaint', keywords: ['refund', 'cancel', 'problem'], position: 2, conditions: { mute_hours: 72 } }),
  base({ name: 'Price', keywords: ['price', 'kitna', 'cost'], position: 3, conditions: { exclude: ['refund'] } }),
  base({ name: 'Manali price', keywords: ['manali', 'price'], position: 0, conditions: { keyword_logic: 'all' } }),
  base({ name: 'Collab', keywords: ['collab'], position: 4, conditions: { min_followers: 5000 } }),
  base({ name: 'Shared', trigger: 'media', position: 5 }),
  base({ name: 'Story', trigger: 'story', position: 6 }),
  base({ name: 'Offer', keywords: ['offer'], position: 7, conditions: { starts_on: '2026-11-10', ends_on: '2026-11-14' } }),
  base({ name: 'Welcome', trigger: 'any', position: 50, conditions: { audience: 'new' } }),
  base({ name: 'Sunday', trigger: 'any', position: 40, conditions: { days: [0] } }),
  base({ name: 'Night', trigger: 'any', position: 45, active_from: 21, active_to: 9 }),
];
const m = (text: string | null, extra: any = {}) => matchRule(rules, { channel: 'dm', text, now: SAT_3PM, person: { isNew: false }, ...extra }).rule?.name ?? null;

assert.equal(m('ok'), 'Ignore ok');
assert.equal(m('Thank you!'), 'Ignore ok');
assert.equal(m('ok what is the price'), 'Price', 'exact match must not swallow longer messages');
assert.equal(m('manali trip price?'), 'Manali price', 'all-words rule wins when both words are present');
assert.equal(m('manali trip?'), null, 'all-words rule needs every word; nothing else matches on a Saturday afternoon');
assert.equal(m('I want a refund of the price'), 'Complaint', 'complaint rule is above price');
assert.equal(m('Kitna hai bhai'), 'Price', 'Hinglish keyword');
assert.equal(m('collab?', { person: { followers: 900 } }), null, 'small accounts skip collab');
assert.equal(m('collab?', { person: { followers: 12000 } }), 'Collab');
assert.equal(m('collab?', { person: {} }), null, 'unknown follower count skips the rule');
assert.equal(m(null, { kind: 'media' }), 'Shared');
assert.equal(m('😍', { kind: 'story' }), 'Story');
assert.equal(m('offer?'), 'Offer', 'inside campaign dates');
assert.equal(m('offer?', { now: new Date('2026-11-15T09:30:00Z') }), 'Sunday', 'after campaign end, falls to catch-alls');
assert.equal(m('hello', { person: { isNew: true } }), 'Welcome');
assert.equal(m('hello', { now: SUN_11PM }), 'Sunday', 'Sunday rule is above Night');
assert.equal(m('hello', { now: new Date('2026-11-16T17:30:00Z') }), 'Night', 'Monday 11pm');
assert.equal(m('hello'), null, 'returning person, Saturday afternoon: no catch-all applies');

// starts with
assert.ok(keywordHit({ keywords: ['hi'], match_type: 'starts', conditions: {} }, 'Hi there'));
assert.ok(!keywordHit({ keywords: ['hi'], match_type: 'starts', conditions: {} }, 'Oh hi'));

// comments
const c = [
  base({ channel: 'comment', name: 'Silent complaints', keywords: ['fraud', 'scam'], action: 'ignore', position: 0 }),
  base({ channel: 'comment', name: 'Details', keywords: ['details'], position: 1 }),
  base({ channel: 'comment', name: 'Thanks', trigger: 'any', position: 9, conditions: { skip_tags: true } }),
  base({ channel: 'comment', name: 'Post only', trigger: 'any', media_ids: ['111'], position: 10 }),
];
const cm = (text: string, mediaId = '999') => matchRule(c, { channel: 'comment', text, mediaId, now: SAT_3PM }).rule?.name ?? null;
assert.equal(cm('details pls'), 'Details');
assert.equal(cm('this is a scam'), 'Silent complaints');
assert.equal(cm('@riya @aman 🔥🔥'), null, 'tag-only comment skipped by Thanks');
assert.equal(cm('Looks amazing'), 'Thanks');
assert.equal(cm('Looks amazing', '111'), 'Post only', 'post-specific catch-all before general');
assert.ok(isTagOrEmojiOnly('@a.b @c_d ❤️❤️!!'));
assert.ok(!isTagOrEmojiOnly('@a wow'));

// text
const t = renderText('{greeting} {first_name}! {Hi|Hey} {username}', { username: 'riya.t', name: 'Riya Sharma', now: SAT_3PM }, () => 0.99);
assert.equal(t, 'Good afternoon Riya! Hey @riya.t');
assert.equal(renderText('Hi {first_name}!', { username: 'x' }), 'Hi @x!', 'name falls back to handle');
assert.equal(renderText('Hi {first_name}, welcome', {}), 'Hi, welcome', 'no stray space before comma');

// trips — real titles from the live site
const trip = (id: string, title: string, destination: string, p: Partial<TripRow> = {}): TripRow => ({
  id, slug: id, title, destination, price: 6500, old_price: 9999, duration: '3 Days / 2 Nights', description: null, start_date: null, image: null,
  featured: false, bookable: true, created_at: '2026-01-01', ...p,
});
const T = [
  trip('chopta', 'Chopta Tungnath Trek 2026', 'Uttarakhand, India', { bookable: false }),
  trip('mk', 'Manali Kasol Escape', 'Himachal Pradesh, India', { featured: true, price: 6500 }),
  trip('udaipur', 'Udaipur Weekend Trip', 'Udaipur, Rajasthan, IN', { price: 6000 }),
  trip('xmas', 'Christmas And New Year Special Manali Kasol Trip', 'Manali, Himanchal Pradesh, India', { featured: true, price: 8999 }),
  trip('triund', 'Mcleodganj & Triund Trek', 'Dharamshala, Himanchal Pradesh, India', { price: 6499 }),
  trip('jibhi', 'JIBHI & TIRTHAN VALLEY 2D/3N TRIP', 'Jibhi, Himanchal Pradesh, India', { price: 5999 }),
];
const pickIds = (o: any, msg: string) => chooseTrips(T, o, msg).trips.map((t) => t.id);
assert.deepEqual(pickIds({ trip_pick: 'match', trips_limit: 1 }, 'udaipur trip ka price?'), ['udaipur'], 'one card for the named trip');
assert.deepEqual(pickIds({ trip_pick: 'match', trips_limit: 5 }, 'Kasol details'), ['mk', 'xmas'], 'both Kasol trips');
assert.deepEqual(pickIds({ trip_pick: 'match', trips_limit: 5, trip_sort: 'cheapest' }, 'manali kasol'), ['mk', 'xmas'], 'equal-ish scores keep cheapest first');
assert.deepEqual(pickIds({ trip_pick: 'match', trips_limit: 1 }, 'triund trek plan'), ['triund']);
assert.deepEqual(pickIds({ trip_pick: 'match', trips_limit: 1 }, 'tirthan'), ['jibhi']);
assert.deepEqual(pickIds({ trip_pick: 'match', trips_limit: 3 }, 'chopta?'), ['mk', 'xmas', 'udaipur'], 'closed trip never auto-matched; falls back to upcoming');
assert.deepEqual(pickIds({ trip_pick: 'match', trip_fallback: 'text' }, 'hello'), [], 'no trip named → text only');
assert.deepEqual(pickIds({ trip_pick: 'match', trips_limit: 2 }, 'details\nComment for the Udaipur weekend plan! Link in bio'), ['udaipur'], 'caption names the trip');
assert.deepEqual(pickIds({ trip_pick: 'selected', trip_ids: ['triund', 'chopta'] }, ''), ['triund', 'chopta'], 'picked trips in order, even closed');
assert.deepEqual(pickIds({ trips_limit: 2, trip_sort: 'cheapest' }, ''), ['jibhi', 'udaipur']);
assert.equal(tripSubtitle(T[1], ['price', 'old_price', 'duration']), 'From ₹6,500 · was ₹9,999 · 3 Days / 2 Nights');
assert.equal(renderText('Here’s our {trip} trip!', { trip: 'Udaipur Weekend Trip' }), 'Here’s our Udaipur Weekend Trip trip!');

console.log('all rule checks passed');
