'use client';

import { getAddonIcon, DEFAULT_ADDON_ICON, ADDON_ICON_MAP } from '@/lib/addon-icons';

/**
 * Renders an add-on's Lucide icon by its stored key, falling back to a neutral
 * default when the key is missing/unknown so the UI never breaks.
 */
export default function AddonIcon({
  iconKey,
  className = 'w-5 h-5',
}: {
  iconKey?: string | null;
  className?: string;
}) {
  const Icon = getAddonIcon(iconKey) || ADDON_ICON_MAP[DEFAULT_ADDON_ICON];
  return <Icon className={className} aria-hidden />;
}
