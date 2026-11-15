'use client';

import {
  Hash, Map, Moon, Sparkles, MessageCircle, Send, CalendarOff, Headphones, ShieldAlert, ThumbsUp, Star, Image as ImageIcon, CircleUser, UserPlus, Gift,
} from 'lucide-react';
import type { ReplyRule, RuleReply } from './types';

/*
 * Ready-made rules for the situations a travel brand's inbox actually sees.
 * One click fills the editor; nothing is saved until "Create rule".
 */

export type TemplateCategory = 'sales' | 'support' | 'away' | 'engage' | 'protect';
export const CATEGORIES: { k: TemplateCategory | 'all'; l: string }[] = [
  { k: 'all', l: 'All' }, { k: 'sales', l: 'Sales' }, { k: 'support', l: 'Support' }, { k: 'away', l: 'Away' }, { k: 'engage', l: 'Engagement' }, { k: 'protect', l: 'Protect' },
];

export interface RuleTemplate { category: TemplateCategory; name: string; desc: string; icon: React.ReactNode; rule: ReplyRule }

export const blankReply = (kind: 'dm' | 'comment', pinned = false): RuleReply => ({
  kind, format: 'text', text: '', title: null, image_url: null, buttons: [], quick_replies: [], options: {}, is_active: true, pinned,
});

export const blankRule = (channel: 'dm' | 'comment'): ReplyRule => ({
  channel, name: '', trigger: 'keywords', keywords: [], match_type: 'contains', media_ids: [], reply_mode: 'random',
  cooldown_hours: 0, send_dm: false, active_from: null, active_to: null, is_active: true, action: 'reply',
  conditions: { keyword_logic: 'any', exclude: [], audience: 'everyone', follows: 'any', min_followers: 0, days: [], delay_minutes: 0, daily_limit: 0, mute_hours: 0, skip_tags: channel === 'comment' },
  replies: [blankReply(channel === 'dm' ? 'dm' : 'comment', true)],
});

const COMPLAINT_WORDS = ['refund', 'cancel', 'cancellation', 'complaint', 'problem', 'issue', 'worst', 'fraud', 'scam', 'cheat', 'disappointed', 'not happy'];
const today = (plusDays = 0) => new Date(Date.now() + 330 * 60_000 + plusDays * 86_400_000).toISOString().slice(0, 10);

export function ruleTemplates(channel: 'dm' | 'comment', site: string, destinations: string[] = []): RuleTemplate[] {
  const trips = site ? `${site}/trips` : 'https://';
  const r = (p: Partial<ReplyRule> & { conditions?: Partial<ReplyRule['conditions']> }): ReplyRule => {
    const base = blankRule(channel);
    return { ...base, ...p, conditions: { ...base.conditions, ...(p.conditions || {}) } } as ReplyRule;
  };
  const dm = (p: Partial<RuleReply>, pinned = true): RuleReply => ({ ...blankReply('dm', pinned), ...p });
  const pub = (text: string, pinned = false): RuleReply => ({ ...blankReply('comment', pinned), text });
  const places = destinations.length ? destinations.slice(0, 15) : ['manali', 'kasol', 'spiti', 'kedarnath', 'rishikesh', 'goa', 'jibhi'];

  if (channel === 'dm') return [
    {
      category: 'sales', name: 'Price enquiry', desc: 'price, cost, kitna, package… → prices + trips button', icon: <Hash />,
      rule: r({ name: 'Price enquiry', keywords: ['price', 'cost', 'kitna', 'charges', 'fees', 'rate', 'budget', 'package'], cooldown_hours: 6,
        conditions: { exclude: ['refund'] },
        replies: [dm({ text: '{Hi|Hey} {first_name}! 🙌 Our trips start from ₹2,999 per person, all-inclusive. See every trip with dates and prices below 👇', buttons: [{ title: 'View all trips', url: trips }] })] }),
    },
    {
      category: 'sales', name: 'Upcoming trips', desc: 'trips, dates, schedule… → live trip cards', icon: <Map />,
      rule: r({ name: 'Upcoming trips', keywords: ['trips', 'upcoming', 'next trip', 'dates', 'schedule', 'plan', 'itinerary'], cooldown_hours: 6,
        replies: [dm({ format: 'trips', text: 'Here are our upcoming trips {first_name} ✨ Swipe to see them all 👉', options: { trips_limit: 5, trip_button: 'View trip' } })] }),
    },
    {
      category: 'sales', name: 'Asks about a destination', desc: `${places.slice(0, 4).join(', ')}… → only that trip’s card`, icon: <Map />,
      rule: r({ name: 'Destination questions', keywords: places, cooldown_hours: 6, conditions: { exclude: ['refund', 'cancel'] },
        replies: [dm({ format: 'trips', text: '{greeting} {first_name}! 🏔️ Here’s our {trip} — tap for dates, price and the full itinerary 👇',
          options: { trip_pick: 'match', trip_fallback: 'auto', trips_limit: 2, trip_sort: 'featured', trip_button: 'See details', trip_fields: ['price', 'old_price', 'duration'] },
        })] }),
    },
    {
      category: 'sales', name: 'How to book', desc: 'book, seat, register, join… → steps + Book button', icon: <Send />,
      rule: r({ name: 'How to book', keywords: ['book', 'booking', 'register', 'seat', 'slot', 'join', 'reserve'], cooldown_hours: 6, conditions: { exclude: ['cancel', 'refund'] },
        replies: [dm({ text: 'Booking takes 2 minutes {first_name} ✅\n1. Pick your trip\n2. Choose the date and number of people\n3. Pay a small advance to lock your seat\nTap below to start 👇', buttons: [{ title: 'Book now', url: trips }] })] }),
    },
    {
      category: 'sales', name: 'They share a post or reel', desc: 'Photo, video or shared reel → details offer', icon: <ImageIcon />,
      rule: r({ name: 'Shared a post or reel', trigger: 'media', keywords: [], cooldown_hours: 1,
        replies: [dm({ text: 'Love that you found this {first_name}! 😍 Want the details? Tap one 👇', quick_replies: ['Prices', 'Upcoming trips', 'Talk to team'] })] }),
    },
    {
      category: 'sales', name: 'Offer campaign (dated)', desc: 'offer, discount, coupon… → only for the next 14 days', icon: <Gift />,
      rule: r({ name: 'Offer campaign', keywords: ['offer', 'discount', 'coupon', 'deal', 'sale', 'code'], cooldown_hours: 24,
        conditions: { starts_on: today(), ends_on: today(14) },
        replies: [dm({ text: '🎉 Yes {first_name}! Our offer is live right now — book any trip this week and save. Tap to see the trips 👇', buttons: [{ title: 'See offers', url: trips }] })] }),
    },
    {
      category: 'support', name: 'Wants to talk to a person', desc: 'call, human, number… → reply, then bot stays quiet 24h', icon: <Headphones />,
      rule: r({ name: 'Talk to a person', keywords: ['human', 'agent', 'call', 'call me', 'talk to team', 'number', 'contact', 'whatsapp'], reply_mode: 'fixed',
        conditions: { mute_hours: 24 },
        replies: [dm({ text: 'Sure {first_name}! 🙋 Someone from our team will reply to you here personally. Feel free to share your questions meanwhile.' })] }),
    },
    {
      category: 'support', name: 'Complaint or refund', desc: 'refund, problem, cancel… → apology, hand over for 3 days', icon: <ShieldAlert />,
      rule: r({ name: 'Complaint or refund', keywords: COMPLAINT_WORDS, reply_mode: 'fixed', cooldown_hours: 24,
        conditions: { mute_hours: 72 },
        replies: [dm({ text: 'We’re really sorry to hear this {first_name} 🙏 Our team will personally look into it and reply here shortly.' })] }),
    },
    {
      category: 'away', name: 'Night-time away message', desc: '9 pm – 9 am, once a day', icon: <Moon />,
      rule: r({ name: 'Night-time away message', trigger: 'any', active_from: 21, active_to: 9, cooldown_hours: 24,
        replies: [dm({ text: 'Thanks for your message {first_name}! 🌙 Our team is offline right now and will reply first thing in the morning.', quick_replies: ['Upcoming trips', 'Prices'] })] }),
    },
    {
      category: 'away', name: 'Sunday off', desc: 'Sundays only, once a day', icon: <CalendarOff />,
      rule: r({ name: 'Sunday off', trigger: 'any', cooldown_hours: 24, conditions: { days: [0] },
        replies: [dm({ text: 'Hey {first_name}! 🌴 We’re off on Sundays — we’ll reply first thing Monday. Meanwhile, browse our trips 👇', buttons: [{ title: 'View all trips', url: trips }] })] }),
    },
    {
      category: 'engage', name: 'Welcome new people', desc: 'First message ever → welcome with quick replies', icon: <Sparkles />,
      rule: r({ name: 'Welcome new people', trigger: 'any', cooldown_hours: 720, conditions: { audience: 'new' },
        replies: [dm({ text: '{greeting} {first_name}! 👋 Welcome to Ghumakkars. What would you like to know?', quick_replies: ['Upcoming trips', 'Prices', 'Talk to team'] })] }),
    },
    {
      category: 'engage', name: 'Story reply or mention', desc: 'Replies to / tags your story → thank you', icon: <Star />,
      rule: r({ name: 'Story reply or mention', trigger: 'story', keywords: [], cooldown_hours: 24,
        replies: [dm({ text: '{Thank you so much|Thanks a ton|Aww thank you} {first_name}! ❤️ Planning your next trip? Ask us anything.' })] }),
    },
    {
      category: 'engage', name: 'Creator collab requests', desc: 'collab, barter… from accounts with 5K+ followers', icon: <CircleUser />,
      rule: r({ name: 'Creator collabs', keywords: ['collab', 'collaboration', 'barter', 'influencer', 'promotion', 'sponsor', 'partnership'], reply_mode: 'fixed',
        conditions: { min_followers: 5000, mute_hours: 72 },
        replies: [dm({ text: 'Hi {first_name}! Thanks for reaching out 🙌 Please share your media kit, past travel content and rates here — our team reviews collabs every week.' })] }),
    },
    {
      category: 'protect', name: 'Ignore “ok”, “thanks”', desc: 'Short replies → stay silent (no welcome spam)', icon: <ThumbsUp />,
      rule: r({ name: 'Ignore ok / thanks', keywords: ['ok', 'okk', 'okay', 'thanks', 'thank you', 'thankyou', 'thx', 'ty', 'done', 'cool', 'great', 'nice', 'hmm', 'sure'], match_type: 'exact', action: 'ignore', replies: [] }),
    },
  ];

  return [
    {
      category: 'engage', name: 'Comment “details” → DM', desc: 'details, info, price → public reply + DM with that post’s trip', icon: <Hash />,
      rule: r({ name: 'Comment “details” → DM', keywords: ['details', 'detail', 'info', 'price', 'dm', 'interested', 'link'], send_dm: true, cooldown_hours: 24,
        conditions: { exclude: COMPLAINT_WORDS },
        replies: [
          pub('Sent you the details in DM {username} 📩', true), pub('Check your DMs {username} ✨'), pub('DM’d you {username} 🙌'),
          // Matches the trip in the comment or in the post's caption — "details" on the Manali reel → the Manali card.
          dm({ format: 'trips', text: 'Hey {first_name}! Here are the details you asked for 👇', options: { trip_pick: 'match', trip_fallback: 'auto', trips_limit: 3, trip_button: 'View trip' } }),
        ] }),
    },
    {
      category: 'sales', name: 'Price comment → prices in DM', desc: 'price, cost, kitna → “DM’d you” + prices', icon: <Send />,
      rule: r({ name: 'Price comment → DM', keywords: ['price', 'cost', 'kitna', 'charges', 'budget', 'rate'], send_dm: true, cooldown_hours: 24,
        replies: [
          pub('Sent you the prices in DM {username} 📩', true),
          dm({ text: '{Hi|Hey} {first_name}! 🙌 Our trips start from ₹2,999 per person. Tap below for every trip with dates and prices 👇', buttons: [{ title: 'View all trips', url: trips }] }),
        ] }),
    },
    {
      category: 'engage', name: 'Keyword on one post → link in DM', desc: 'e.g. comment “TRIP” on a reel → DM the link; pick posts', icon: <Gift />,
      rule: r({ name: 'Post keyword → DM', keywords: ['trip'], match_type: 'contains', send_dm: true, cooldown_hours: 720,
        conditions: { daily_limit: 200 },
        replies: [
          pub('Check your DMs {username} 📩', true), pub('Sent {username} ✨'),
          dm({ text: 'Here you go {first_name}! 👇', buttons: [{ title: 'Open the trip', url: trips }] }),
        ] }),
    },
    {
      category: 'engage', name: 'Ask non-followers to follow', desc: 'Non-followers asking for details → “follow & comment again” (keep it above the details rule)', icon: <UserPlus />,
      rule: r({ name: 'Non-followers: follow first', keywords: ['details', 'info', 'link', 'price'], cooldown_hours: 24,
        conditions: { follows: 'non_followers' },
        replies: [pub('Follow us and comment again {username} — we’ll DM you everything ✨', true)] }),
    },
    {
      category: 'engage', name: 'Thank every comment', desc: 'Random thank-yous, once a day per person, skips tag-only', icon: <MessageCircle />,
      rule: r({ name: 'Thank every comment', trigger: 'any', cooldown_hours: 24, conditions: { skip_tags: true },
        replies: [pub('Thank you {username} ❤️', true), pub('Means a lot {username} 🙌'), pub('Glad you liked it {username} ✨')] }),
    },
    {
      category: 'protect', name: 'Complaints → leave for team', desc: 'refund, fraud, worst… → never auto-reply publicly', icon: <ShieldAlert />,
      rule: r({ name: 'Complaints: stay silent', keywords: COMPLAINT_WORDS.concat(['fake']), action: 'ignore', replies: [] }),
    },
  ];
}
