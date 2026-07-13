/**
 * Curated Lucide icon registry for Trip Add-ons. Only the icon KEY (name) is
 * stored in the DB — never SVG. The customer/admin UIs map the key back to a
 * Lucide component via getAddonIcon(); PDFs ignore icons and print the name.
 */
import {
  BedDouble, Bed, Hotel, DoorOpen, Home,
  Car, Bus, Plane, Train, Bike, Fuel, Navigation,
  Waves, Tent, Compass, Footprints, Snowflake, Flame, Ticket, TreePine,
  Utensils, UtensilsCrossed, Coffee, Pizza, Soup, Wine,
  Mountain, MountainSnow, Sunrise, Sunset, Sun, CloudSnow,
  Tag, Stamp, Award,
  ShieldCheck, Shield, HeartPulse, Stethoscope, BadgeCheck,
  Camera, Image, Video, Aperture, Film,
  MapPin, Map, Milestone,
  Luggage, Briefcase, Package, ShoppingBag,
  Sparkles, Star, Gift, Zap, Heart, Wifi, Music, Users, Clock, Umbrella,
  type LucideIcon,
} from 'lucide-react';

export const ADDON_ICON_MAP: Record<string, LucideIcon> = {
  BedDouble, Bed, Hotel, DoorOpen, Home,
  Car, Bus, Plane, Train, Bike, Fuel, Navigation,
  Waves, Tent, Compass, Footprints, Snowflake, Flame, Ticket, TreePine,
  Utensils, UtensilsCrossed, Coffee, Pizza, Soup, Wine,
  Mountain, MountainSnow, Sunrise, Sunset, Sun, CloudSnow,
  Tag, Stamp, Award,
  ShieldCheck, Shield, HeartPulse, Stethoscope, BadgeCheck,
  Camera, Image, Video, Aperture, Film,
  MapPin, Map, Milestone,
  Luggage, Briefcase, Package, ShoppingBag,
  Sparkles, Star, Gift, Zap, Heart, Wifi, Music, Users, Clock, Umbrella,
};

export interface IconCategory {
  name: string;
  icons: string[];
}

/** Categories shown in the icon picker. */
export const ADDON_ICON_CATEGORIES: IconCategory[] = [
  { name: 'Rooms', icons: ['BedDouble', 'Bed', 'Hotel', 'DoorOpen', 'Home'] },
  { name: 'Transport', icons: ['Car', 'Bus', 'Plane', 'Train', 'Bike', 'Fuel', 'Navigation'] },
  { name: 'Activities', icons: ['Waves', 'Tent', 'Compass', 'Footprints', 'Snowflake', 'Flame', 'TreePine'] },
  { name: 'Food', icons: ['Utensils', 'UtensilsCrossed', 'Coffee', 'Pizza', 'Soup', 'Wine'] },
  { name: 'Mountains', icons: ['Mountain', 'MountainSnow', 'Sunrise', 'Sunset', 'Sun', 'CloudSnow'] },
  { name: 'Tickets', icons: ['Ticket', 'Tag', 'Stamp', 'Award'] },
  { name: 'Insurance', icons: ['ShieldCheck', 'Shield', 'HeartPulse', 'Stethoscope', 'BadgeCheck'] },
  { name: 'Photography', icons: ['Camera', 'Image', 'Video', 'Aperture', 'Film'] },
  { name: 'Pickup & drop', icons: ['MapPin', 'Map', 'Milestone', 'Navigation'] },
  { name: 'Luggage', icons: ['Luggage', 'Briefcase', 'Package', 'ShoppingBag'] },
  { name: 'General', icons: ['Sparkles', 'Star', 'Gift', 'Zap', 'Heart', 'Wifi', 'Music', 'Users', 'Clock', 'Umbrella'] },
];

export const DEFAULT_ADDON_ICON = 'Sparkles';

/** Suggested icon for a freshly-created add-on, keyed off its name. */
export function suggestIconForName(name: string): string {
  const n = (name || '').toLowerCase();
  const rules: Array<[RegExp, string]> = [
    [/double|twin/, 'BedDouble'],
    [/triple|quad|dorm|sharing|room/, 'Bed'],
    [/rohtang|pass|snow|glacier/, 'MountainSnow'],
    [/raft|kayak|water|river/, 'Waves'],
    [/cab|taxi|car|private vehicle/, 'Car'],
    [/bus|coach|volvo/, 'Bus'],
    [/meal|food|breakfast|dinner|lunch|thali/, 'Utensils'],
    [/insurance|cover|medical/, 'ShieldCheck'],
    [/pickup|drop|transfer/, 'MapPin'],
    [/photo|shoot|drone/, 'Camera'],
    [/ticket|entry|permit/, 'Ticket'],
    [/luggage|bag|porter/, 'Luggage'],
    [/trek|hike|camp/, 'Tent'],
  ];
  for (const [re, icon] of rules) if (re.test(n)) return icon;
  return DEFAULT_ADDON_ICON;
}

export function getAddonIcon(key?: string | null): LucideIcon | null {
  if (!key) return null;
  return ADDON_ICON_MAP[key] || null;
}

/** Every registered icon name (for the picker's search-all view). */
export const ALL_ADDON_ICON_NAMES: string[] = Object.keys(ADDON_ICON_MAP);
