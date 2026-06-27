'use client';

import dynamic from 'next/dynamic';

// Swiper is a heavy client-only library. The destinations carousel sits below
// the fold on the homepage, so we code-split it out of the initial bundle and
// load it after hydration. The placeholder matches the carousel's height to
// avoid any layout shift (CLS) while the chunk loads.
const DestinationsSwiper = dynamic(() => import('./DestinationsSwiper'), {
  ssr: false,
  loading: () => (
    <div className="w-full py-8 md:py-12">
      <div className="h-80 md:h-96 lg:h-[28rem] rounded-2xl bg-purple-50/60 animate-pulse mx-auto max-w-md" />
    </div>
  ),
});

export default function DestinationsSwiperLazy() {
  return <DestinationsSwiper />;
}
