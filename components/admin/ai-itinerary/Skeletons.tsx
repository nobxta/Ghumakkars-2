import { Bone } from '@/components/ui/Skeleton';

// Phone: navbar + page header + pane tabs above, bottom nav below. Desktop: navbar + header only.
export const STUDIO_H = 'h-[calc(100dvh-19.5rem)] min-h-[400px] md:h-[calc(100dvh-15.5rem)] lg:h-[calc(100dvh-12.5rem)] lg:min-h-[540px]';

/** Mirrors the three-panel studio so content drops in without jumping. Server-safe. */
export function StudioSkeleton() {
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-4">
      <span className="sr-only">Loading AI Itinerary Studio</span>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5"><Bone className="h-8 w-8 rounded-lg" /><Bone className="h-5 w-44 rounded" /></div>
        <Bone className="hidden h-9 w-[420px] rounded-xl sm:block" />
      </div>
      <div className={`grid gap-3 lg:grid-cols-[260px_minmax(0,1fr)_minmax(0,1fr)] ${STUDIO_H}`}>
        <div className="hidden rounded-2xl border border-slate-200/80 bg-white p-3 lg:block">
          <Bone className="h-9 w-full rounded-lg" />
          <div className="mt-4 space-y-2">{Array.from({ length: 6 }).map((_, i) => <Bone key={i} className="h-12 w-full rounded-lg" tone="soft" />)}</div>
        </div>
        <div className="flex flex-col rounded-2xl border border-slate-200/80 bg-white p-4">
          <div className="space-y-4">
            <Bone className="ml-auto h-12 w-2/3 rounded-2xl" tone="soft" />
            <Bone className="h-20 w-3/4 rounded-2xl" tone="soft" />
          </div>
          <Bone className="mt-auto h-24 w-full rounded-2xl" />
        </div>
        <div className="hidden rounded-2xl border border-slate-200/80 bg-white p-4 lg:block">
          <Bone className="h-8 w-48 rounded-lg" />
          <Bone className="mt-4 h-[70%] w-full rounded-xl" tone="soft" />
        </div>
      </div>
    </div>
  );
}

export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div role="status" aria-busy="true" className="space-y-2">
      <span className="sr-only">Loading</span>
      {Array.from({ length: rows }).map((_, i) => <Bone key={i} className="h-14 w-full rounded-xl" tone="soft" />)}
    </div>
  );
}
