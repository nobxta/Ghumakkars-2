'use client';

import Link from 'next/link';
import { Headset } from 'lucide-react';
import { CONTACT } from '@/lib/contact';
import type { StatusConfig } from './statusConfig';

/**
 * Action cluster + tertiary link + a muted "Contact Support" line.
 * Button styling adapts to the hero surface so contrast holds on every background.
 */
export default function BookingActions({ config }: { config: StatusConfig }) {
  const { actions, tertiary, surface, accent } = config;
  const light = surface === 'light';

  return (
    <div className="bs-fade-up flex w-full max-w-[560px] flex-col items-center">
      <div className="flex w-full flex-col gap-3 sm:flex-row">
        {actions.map((a) => {
          const Icon = a.icon;
          const primary = a.variant === 'primary';

          // Primary: solid. On vibrant surfaces it's white-on-accent-text; on light it's accent-filled.
          const primaryStyle = light
            ? { background: accent, color: '#fff' }
            : { background: '#ffffff', color: '#191b23' };
          const ghostStyle = light
            ? { background: 'transparent', color: accent, border: `1.5px solid ${accent}` }
            : { background: 'rgba(255,255,255,0.12)', color: '#fff', border: '1.5px solid rgba(255,255,255,0.6)' };

          const className =
            'group flex flex-1 items-center justify-center gap-2 rounded-xl px-6 py-4 text-sm font-bold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]';

          const inner = (
            <>
              {Icon && <Icon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />}
              <span>{a.label}</span>
            </>
          );

          return a.external ? (
            <a
              key={a.label}
              href={a.href}
              target="_blank"
              rel="noopener noreferrer"
              className={className}
              style={primary ? primaryStyle : ghostStyle}
            >
              {inner}
            </a>
          ) : (
            <Link key={a.label} href={a.href} className={className} style={primary ? primaryStyle : ghostStyle}>
              {inner}
            </Link>
          );
        })}
      </div>

      {tertiary && (
        <Link
          href={tertiary.href}
          className={`mt-5 text-sm font-medium transition-opacity hover:opacity-100 ${light ? 'text-[#414754] opacity-80' : 'text-white opacity-80'}`}
        >
          ← {tertiary.label}
        </Link>
      )}

      {/* Muted contact-support line (only when not already an action button) */}
      {!actions.some((a) => a.href === CONTACT.whatsappLink) && (
        <a
          href={CONTACT.whatsappLink}
          target="_blank"
          rel="noopener noreferrer"
          className={`mt-8 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider transition-opacity hover:opacity-100 ${light ? 'text-[#414754] opacity-70' : 'text-white opacity-70'}`}
        >
          <Headset className="h-4 w-4" />
          Need help? Contact support
        </a>
      )}
    </div>
  );
}
