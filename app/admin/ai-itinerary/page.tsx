import { Suspense } from 'react';
import type { Metadata } from 'next';
import StudioApp from '@/components/admin/ai-itinerary/StudioApp';
import { StudioSkeleton } from '@/components/admin/ai-itinerary/Skeletons';

export const metadata: Metadata = { title: 'AI Itinerary Studio · Admin' };

export default function AiItineraryPage() {
  return (
    <Suspense fallback={<StudioSkeleton />}>
      <StudioApp />
    </Suspense>
  );
}
