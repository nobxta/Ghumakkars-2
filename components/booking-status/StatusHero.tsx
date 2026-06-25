'use client';

import type { StatusConfig } from './statusConfig';

/**
 * Status Hero — the focal icon, status badge, headline and description.
 * Adapts text colour to the surface (white on vibrant gradients, dark on light tints).
 */
export default function StatusHero({ config }: { config: StatusConfig }) {
  const { Icon, badge, title, description, accent, surface } = config;
  const light = surface === 'light';

  return (
    <div className="w-full max-w-[560px] flex flex-col items-center text-center">
      {/* Glass icon vessel */}
      <div
        className="bs-pop relative mb-6 flex h-20 w-20 items-center justify-center rounded-full border md:h-24 md:w-24"
        style={
          light
            ? { background: '#fff', borderColor: 'rgba(0,0,0,0.06)', boxShadow: '0 12px 30px -8px rgba(186,26,26,0.25)' }
            : { background: 'rgba(255,255,255,0.18)', borderColor: 'rgba(255,255,255,0.35)', backdropFilter: 'blur(10px)', boxShadow: '0 12px 30px -8px rgba(0,0,0,0.25)' }
        }
      >
        <Icon
          className="bs-icon-pop h-9 w-9 md:h-11 md:w-11"
          strokeWidth={2.25}
          style={{ color: light ? accent : '#fff' }}
        />
      </div>

      {/* Status badge */}
      <span
        className="bs-fade mb-4 inline-block rounded-full px-4 py-1 text-[11px] font-bold uppercase tracking-[0.14em]"
        style={
          light
            ? { background: accent, color: '#fff' }
            : { background: 'rgba(255,255,255,0.2)', color: '#fff', border: '1px solid rgba(255,255,255,0.35)', backdropFilter: 'blur(6px)' }
        }
      >
        {badge}
      </span>

      {/* Headline */}
      <h1
        className={`bs-fade bs-display mb-3 text-[32px] leading-[40px] font-extrabold tracking-[-0.02em] md:text-[44px] md:leading-[52px] ${light ? 'text-[#191b23]' : 'text-white'}`}
      >
        {title}
      </h1>

      {/* Description */}
      <p
        className={`bs-fade mb-10 max-w-md text-base leading-relaxed md:text-lg ${light ? 'text-[#414754]' : 'text-white/90'}`}
      >
        {description}
      </p>
    </div>
  );
}
