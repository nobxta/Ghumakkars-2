/**
 * Skeleton placeholders shown while a page's data loads.
 *
 * Each page skeleton mirrors the real page's outer layout (same container
 * width, padding, background and card shapes) so content drops in without
 * the page jumping. Used both by route `loading.tsx` files (shown instantly
 * on navigation) and by client pages while their first fetch is in flight.
 *
 * Server-safe: no hooks, no 'use client'.
 */

type BoneProps = {
  className?: string;
  tone?: 'default' | 'soft' | 'purple' | 'dark';
  style?: React.CSSProperties;
};

export function Bone({ className = '', tone = 'default', style }: BoneProps) {
  const toneClass =
    tone === 'soft' ? 'sk-soft' : tone === 'purple' ? 'sk-purple' : tone === 'dark' ? 'sk-on-dark' : '';
  return <div aria-hidden="true" className={`sk ${toneClass} ${className}`} style={style} />;
}

/** Wrapper that announces loading to screen readers once. */
function Busy({ className, label, children }: { className: string; label: string; children: React.ReactNode }) {
  return (
    <div className={className} role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

const repeat = (n: number) => Array.from({ length: n }, (_, i) => i);

/* ═══════════════════════════ Customer pages ═══════════════════════════ */

/** /bookings — header, filter chips, booking cards. */
export function BookingsListSkeleton() {
  return (
    <Busy
      label="Loading your bookings"
      className="min-h-screen pt-14 sm:pt-16 pb-20 sm:pb-8 bg-gradient-to-b from-purple-50/50 via-white to-purple-50/30"
    >
      <div className="max-w-3xl mx-auto px-3 sm:px-6 py-4 sm:py-8">
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <div>
            <Bone className="h-3 w-16 mb-2" tone="purple" />
            <Bone className="h-7 w-40" />
          </div>
          <Bone className="h-8 sm:h-9 w-28 rounded-lg" tone="purple" />
        </div>
        <div className="flex gap-2 mb-4 sm:mb-6 overflow-hidden">
          {[14, 20, 22, 18, 20].map((w, i) => (
            <Bone key={i} className="h-8 rounded-full flex-shrink-0" style={{ width: `${w * 4}px` }} tone="soft" />
          ))}
        </div>
        <div className="space-y-3 sm:space-y-4">
          {repeat(4).map((i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden flex">
              <Bone className="w-24 sm:w-32 h-28 sm:h-32 rounded-none flex-shrink-0" />
              <div className="flex-1 p-3 sm:p-4 space-y-2">
                <div className="flex justify-between gap-2">
                  <Bone className="h-4 w-2/3" />
                  <Bone className="h-5 w-20 rounded-full" tone="soft" />
                </div>
                <Bone className="h-3 w-1/3" tone="soft" />
                <Bone className="h-3 w-1/2" tone="soft" />
                <div className="flex justify-between pt-2">
                  <Bone className="h-4 w-20" />
                  <Bone className="h-4 w-16" tone="purple" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Busy>
  );
}

/** /bookings/[id] — hero image, status card, two-column details + summary. */
export function BookingDetailSkeleton() {
  return (
    <Busy label="Loading booking details" className="min-h-screen bg-gray-50 pt-16 pb-32 lg:pb-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        <Bone className="h-4 w-28 mb-4" tone="purple" />
        <Bone className="h-44 sm:h-56 w-full rounded-2xl mb-5" />
        <div className="grid lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-5">
            <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
              <div className="flex items-center gap-3">
                <Bone className="h-10 w-10 rounded-full" tone="purple" />
                <div className="flex-1 space-y-2">
                  <Bone className="h-4 w-1/2" />
                  <Bone className="h-3 w-1/3" tone="soft" />
                </div>
              </div>
              <Bone className="h-2 w-full rounded-full" tone="soft" />
            </div>
            {repeat(2).map((i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
                <Bone className="h-5 w-40" />
                {repeat(4).map((j) => (
                  <div key={j} className="flex justify-between">
                    <Bone className="h-3.5 w-1/3" tone="soft" />
                    <Bone className="h-3.5 w-1/4" />
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3 h-fit">
            <Bone className="h-5 w-32" />
            {repeat(5).map((j) => (
              <div key={j} className="flex justify-between">
                <Bone className="h-3.5 w-1/3" tone="soft" />
                <Bone className="h-3.5 w-16" />
              </div>
            ))}
            <Bone className="h-11 w-full rounded-xl mt-2" tone="purple" />
          </div>
        </div>
      </div>
    </Busy>
  );
}

/** /profile — profile card + menu grid. */
export function ProfileSkeleton() {
  return (
    <Busy
      label="Loading your profile"
      className="min-h-screen pt-16 md:pt-20 pb-16 md:pb-0 bg-gradient-to-b from-purple-50/50 via-white to-purple-50/30"
    >
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <div className="bg-white rounded-2xl shadow-lg border-2 border-purple-100 p-6 md:p-8 mb-6 md:mb-8">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-4 md:gap-6">
            <Bone className="w-24 h-24 md:w-32 md:h-32 rounded-full flex-shrink-0" tone="purple" />
            <div className="flex-1 w-full flex flex-col items-center md:items-start space-y-3">
              <Bone className="h-8 w-48" />
              <Bone className="h-4 w-56" tone="soft" />
              <Bone className="h-4 w-40" tone="soft" />
              <Bone className="h-9 w-32 rounded-lg mt-2" tone="purple" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
          {repeat(4).map((i) => (
            <div key={i} className="bg-white rounded-xl border-2 border-purple-100 p-5 flex items-center gap-4">
              <Bone className="h-12 w-12 rounded-xl flex-shrink-0" tone="purple" />
              <div className="flex-1 space-y-2">
                <Bone className="h-4 w-1/2" />
                <Bone className="h-3 w-3/4" tone="soft" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </Busy>
  );
}

/** /profile/edit — gradient header card + form fields. */
export function ProfileEditSkeleton() {
  return (
    <Busy
      label="Loading your profile"
      className="min-h-screen pt-16 md:pt-20 pb-16 md:pb-0 bg-gradient-to-b from-purple-50/50 via-white to-purple-50/30"
    >
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <Bone className="h-4 w-28 mb-6" tone="purple" />
        <div className="bg-white rounded-2xl shadow-lg border-2 border-purple-100 overflow-hidden">
          <div className="bg-gradient-to-r from-purple-600 to-purple-700 px-6 md:px-8 py-6 space-y-2">
            <Bone className="h-8 w-48" tone="dark" />
            <Bone className="h-4 w-64 max-w-full" tone="dark" />
          </div>
          <div className="p-6 md:p-8 space-y-6">
            <div className="flex items-center gap-4">
              <Bone className="h-20 w-20 rounded-full" tone="purple" />
              <Bone className="h-9 w-32 rounded-lg" tone="soft" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {repeat(8).map((i) => (
                <div key={i} className="space-y-2">
                  <Bone className="h-3.5 w-24" />
                  <Bone className="h-11 w-full rounded-lg" tone="soft" />
                </div>
              ))}
            </div>
            <Bone className="h-11 w-40 rounded-lg" tone="purple" />
          </div>
        </div>
      </div>
    </Busy>
  );
}

/** /wallet — balance card + transaction list. */
export function WalletSkeleton() {
  return (
    <Busy
      label="Loading your wallet"
      className="min-h-screen pt-16 md:pt-20 pb-16 md:pb-0 bg-gradient-to-b from-purple-50/50 via-white to-purple-50/30"
    >
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <Bone className="h-4 w-28 mb-6 md:mb-8" tone="purple" />
        <div className="bg-gradient-to-br from-purple-600 via-purple-700 to-purple-800 rounded-2xl shadow-xl p-6 md:p-8 mb-6">
          <div className="flex items-center justify-between mb-6">
            <Bone className="h-7 w-32" tone="dark" />
            <Bone className="h-9 w-9 rounded-full" tone="dark" />
          </div>
          <Bone className="h-4 w-28 mb-3" tone="dark" />
          <Bone className="h-12 w-44" tone="dark" />
        </div>
        <div className="bg-white rounded-2xl shadow-lg border-2 border-purple-100 p-6 md:p-8">
          <Bone className="h-6 w-48 mb-5" />
          <div className="space-y-4">
            {repeat(5).map((i) => (
              <div key={i} className="flex items-center gap-4">
                <Bone className="h-10 w-10 rounded-full flex-shrink-0" tone="purple" />
                <div className="flex-1 space-y-2">
                  <Bone className="h-4 w-1/2" />
                  <Bone className="h-3 w-1/4" tone="soft" />
                </div>
                <Bone className="h-5 w-16" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </Busy>
  );
}

/** /referral — hero card, stats, list. */
export function ReferralSkeleton() {
  return (
    <Busy
      label="Loading referrals"
      className="min-h-screen pt-16 pb-16 bg-gradient-to-br from-purple-50 via-indigo-50/30 to-purple-50"
    >
      <div className="max-w-6xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6 md:py-8">
        <Bone className="h-4 w-28 mb-4 sm:mb-6" tone="purple" />
        <div className="bg-gradient-to-br from-purple-600 via-purple-700 to-indigo-700 rounded-2xl sm:rounded-3xl shadow-2xl p-4 sm:p-6 md:p-8 lg:p-12 mb-4 sm:mb-6 md:mb-8">
          <div className="flex items-center gap-3 sm:gap-4 mb-6">
            <Bone className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl flex-shrink-0" tone="dark" />
            <div className="flex-1 space-y-2">
              <Bone className="h-7 w-56 max-w-full" tone="dark" />
              <Bone className="h-4 w-72 max-w-full" tone="dark" />
            </div>
          </div>
          <Bone className="h-14 w-full rounded-xl" tone="dark" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
          {repeat(4).map((i) => (
            <div key={i} className="bg-white rounded-xl sm:rounded-2xl border-2 border-purple-100 p-4 space-y-2">
              <Bone className="h-9 w-9 rounded-lg" tone="purple" />
              <Bone className="h-6 w-16" />
              <Bone className="h-3 w-24" tone="soft" />
            </div>
          ))}
        </div>
        <div className="bg-white rounded-2xl border-2 border-purple-100 p-4 sm:p-6 space-y-4">
          <Bone className="h-6 w-40" />
          {repeat(3).map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Bone className="h-10 w-10 rounded-full" tone="purple" />
              <div className="flex-1 space-y-2">
                <Bone className="h-4 w-1/3" />
                <Bone className="h-3 w-1/4" tone="soft" />
              </div>
              <Bone className="h-6 w-16 rounded-full" tone="soft" />
            </div>
          ))}
        </div>
      </div>
    </Busy>
  );
}

/** /trips/[id]/book — stepper + form + price summary. */
export function BookTripSkeleton() {
  return (
    <Busy label="Loading booking form" className="min-h-screen pt-16 md:pt-20 pb-24 bg-[#f8f7fc]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        <Bone className="h-4 w-24 mb-4" tone="purple" />
        <Bone className="h-8 w-64 max-w-full mb-2" />
        <Bone className="h-4 w-40 mb-6" tone="soft" />
        <div className="flex items-center gap-2 mb-6">
          {repeat(3).map((i) => (
            <div key={i} className="flex items-center gap-2 flex-1">
              <Bone className="h-8 w-8 rounded-full flex-shrink-0" tone={i === 0 ? 'purple' : 'soft'} />
              <Bone className="h-1.5 flex-1 rounded-full" tone="soft" />
            </div>
          ))}
        </div>
        <div className="grid lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-5 sm:p-6 space-y-5">
            <Bone className="h-6 w-48" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {repeat(6).map((i) => (
                <div key={i} className="space-y-2">
                  <Bone className="h-3.5 w-24" />
                  <Bone className="h-11 w-full rounded-xl" tone="soft" />
                </div>
              ))}
            </div>
            <Bone className="h-12 w-full sm:w-48 rounded-xl" tone="purple" />
          </div>
          <div className="hidden lg:block bg-white rounded-2xl border border-gray-100 p-5 space-y-3 h-fit">
            <Bone className="h-32 w-full rounded-xl" />
            <Bone className="h-5 w-3/4" />
            {repeat(4).map((j) => (
              <div key={j} className="flex justify-between">
                <Bone className="h-3.5 w-1/3" tone="soft" />
                <Bone className="h-3.5 w-16" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </Busy>
  );
}

/** /booking-success/[id] — centered confirmation card. */
export function BookingSuccessSkeleton() {
  return (
    <Busy label="Loading your booking" className="fixed inset-0 z-50 overflow-auto bg-[#f9f9ff]">
      <div className="max-w-2xl mx-auto px-4 py-10 sm:py-16">
        <div className="flex flex-col items-center text-center mb-8 space-y-3">
          <Bone className="h-20 w-20 rounded-full" tone="purple" />
          <Bone className="h-8 w-64 max-w-full" />
          <Bone className="h-4 w-80 max-w-full" tone="soft" />
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6 space-y-4 mb-5">
          <div className="flex gap-4">
            <Bone className="h-20 w-24 rounded-xl flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Bone className="h-5 w-3/4" />
              <Bone className="h-3.5 w-1/2" tone="soft" />
              <Bone className="h-3.5 w-1/3" tone="soft" />
            </div>
          </div>
          {repeat(4).map((j) => (
            <div key={j} className="flex justify-between">
              <Bone className="h-3.5 w-1/3" tone="soft" />
              <Bone className="h-3.5 w-20" />
            </div>
          ))}
        </div>
        <div className="flex gap-3">
          <Bone className="h-12 flex-1 rounded-xl" tone="purple" />
          <Bone className="h-12 flex-1 rounded-xl" tone="soft" />
        </div>
      </div>
    </Busy>
  );
}

/* ═══════════════════════════ Admin pages ═══════════════════════════ */

/**
 * Generic admin list page: title row, KPI cards, filter bar, table.
 * Renders inside AdminPanelLayout's content area, so no outer chrome.
 */
export function AdminListSkeleton({
  stats = 4,
  rows = 8,
  label = 'Loading',
}: { stats?: number; rows?: number; label?: string }) {
  return (
    <Busy label={label} className="mx-auto w-full max-w-[1400px] space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-2">
          <Bone className="h-7 w-48" />
          <Bone className="h-4 w-72 max-w-full" tone="soft" />
        </div>
        <div className="flex gap-2">
          <Bone className="h-9 w-24 rounded-lg" tone="soft" />
          <Bone className="h-9 w-32 rounded-lg" tone="purple" />
        </div>
      </div>
      {stats > 0 && (
        <div className={`grid grid-cols-2 gap-3 sm:gap-4 ${stats >= 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
          {repeat(stats).map((i) => (
            <div key={i} className="rounded-2xl border border-slate-200/80 bg-white p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Bone className="h-3.5 w-20" tone="soft" />
                <Bone className="h-8 w-8 rounded-lg" tone="purple" />
              </div>
              <Bone className="h-7 w-24" />
              <Bone className="h-3 w-16" tone="soft" />
            </div>
          ))}
        </div>
      )}
      <div className="flex flex-col sm:flex-row gap-2">
        <Bone className="h-10 flex-1 rounded-xl" tone="soft" />
        <Bone className="h-10 sm:w-36 rounded-xl" tone="soft" />
        <Bone className="h-10 sm:w-36 rounded-xl" tone="soft" />
      </div>
      <div className="rounded-2xl border border-slate-200/80 bg-white overflow-hidden">
        <div className="hidden md:flex gap-4 px-4 py-3 border-b border-slate-100 bg-slate-50/60">
          {[30, 18, 16, 14, 12].map((w, i) => (
            <Bone key={i} className="h-3" style={{ width: `${w}%` }} tone="soft" />
          ))}
        </div>
        <div className="divide-y divide-slate-100">
          {repeat(rows).map((i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3.5">
              <Bone className="h-9 w-9 rounded-full flex-shrink-0" tone="purple" />
              <div className="flex-1 min-w-0 space-y-2">
                <Bone className="h-3.5 w-2/5" />
                <Bone className="h-3 w-1/4" tone="soft" />
              </div>
              <Bone className="hidden sm:block h-3.5 w-20" tone="soft" />
              <Bone className="hidden md:block h-3.5 w-16" />
              <Bone className="h-6 w-20 rounded-full" tone="soft" />
            </div>
          ))}
        </div>
      </div>
    </Busy>
  );
}

/** Admin record detail (booking / trip / user): header, tabs, main + side cards. */
export function AdminDetailSkeleton({ label = 'Loading details' }: { label?: string }) {
  return (
    <Busy label={label} className="mx-auto w-full max-w-[1320px] space-y-5">
      <Bone className="h-4 w-28" tone="purple" />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Bone className="h-14 w-14 rounded-2xl" tone="purple" />
          <div className="space-y-2">
            <Bone className="h-7 w-56 max-w-full" />
            <Bone className="h-4 w-40" tone="soft" />
          </div>
        </div>
        <div className="flex gap-2">
          <Bone className="h-9 w-24 rounded-lg" tone="soft" />
          <Bone className="h-9 w-28 rounded-lg" tone="purple" />
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {repeat(4).map((i) => (
          <div key={i} className="rounded-2xl border border-slate-200/80 bg-white p-4 space-y-2">
            <Bone className="h-3 w-20" tone="soft" />
            <Bone className="h-6 w-24" />
          </div>
        ))}
      </div>
      <div className="flex gap-2 overflow-hidden border-b border-slate-200 pb-2">
        {[20, 24, 18, 22, 16].map((w, i) => (
          <Bone key={i} className="h-8 rounded-lg flex-shrink-0" style={{ width: `${w * 4}px` }} tone={i === 0 ? 'purple' : 'soft'} />
        ))}
      </div>
      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          {repeat(2).map((i) => (
            <div key={i} className="rounded-2xl border border-slate-200/80 bg-white p-5 space-y-3">
              <Bone className="h-5 w-40" />
              {repeat(5).map((j) => (
                <div key={j} className="flex justify-between gap-4">
                  <Bone className="h-3.5 w-1/3" tone="soft" />
                  <Bone className="h-3.5 w-1/4" />
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 space-y-3 h-fit">
          <Bone className="h-5 w-32" />
          {repeat(4).map((j) => (
            <Bone key={j} className="h-10 w-full rounded-xl" tone="soft" />
          ))}
        </div>
      </div>
    </Busy>
  );
}

/** Admin form (trip create/edit, settings): step rail + form card. */
export function AdminFormSkeleton({ label = 'Loading form' }: { label?: string }) {
  return (
    <Busy label={label} className="mx-auto w-full max-w-[1100px] space-y-5">
      <div className="space-y-2">
        <Bone className="h-7 w-52" />
        <Bone className="h-4 w-72 max-w-full" tone="soft" />
      </div>
      <div className="flex gap-2 overflow-hidden">
        {repeat(5).map((i) => (
          <Bone key={i} className="h-9 w-28 rounded-lg flex-shrink-0" tone={i === 0 ? 'purple' : 'soft'} />
        ))}
      </div>
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {repeat(6).map((i) => (
            <div key={i} className="space-y-2">
              <Bone className="h-3.5 w-28" />
              <Bone className="h-10 w-full rounded-lg" tone="soft" />
            </div>
          ))}
        </div>
        <div className="space-y-2">
          <Bone className="h-3.5 w-28" />
          <Bone className="h-28 w-full rounded-lg" tone="soft" />
        </div>
        <div className="flex justify-end gap-2">
          <Bone className="h-10 w-24 rounded-lg" tone="soft" />
          <Bone className="h-10 w-32 rounded-lg" tone="purple" />
        </div>
      </div>
    </Busy>
  );
}

/** Admin dashboard: KPI row, inbox + departures, activity. */
export function AdminDashboardSkeleton() {
  return (
    <Busy label="Loading dashboard" className="mx-auto w-full max-w-[1400px] space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-2">
          <Bone className="h-7 w-44" />
          <Bone className="h-4 w-56" tone="soft" />
        </div>
        <Bone className="h-9 w-64 max-w-full rounded-lg" tone="soft" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {repeat(4).map((i) => (
          <div key={i} className="rounded-2xl border border-slate-200/80 bg-white p-4 space-y-3">
            <Bone className="h-3.5 w-24" tone="soft" />
            <Bone className="h-7 w-28" />
            <Bone className="h-8 w-full" tone="purple" />
          </div>
        ))}
      </div>
      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 rounded-2xl border border-slate-200/80 bg-white p-5 space-y-3">
          <Bone className="h-5 w-36" />
          {repeat(5).map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Bone className="h-9 w-9 rounded-lg" tone="purple" />
              <div className="flex-1 space-y-2">
                <Bone className="h-3.5 w-1/2" />
                <Bone className="h-3 w-1/3" tone="soft" />
              </div>
              <Bone className="h-8 w-20 rounded-lg" tone="soft" />
            </div>
          ))}
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 space-y-3">
          <Bone className="h-5 w-32" />
          {repeat(6).map((i) => (
            <div key={i} className="flex gap-3">
              <Bone className="h-2.5 w-2.5 rounded-full mt-1" tone="purple" />
              <div className="flex-1 space-y-1.5">
                <Bone className="h-3.5 w-4/5" />
                <Bone className="h-3 w-1/3" tone="soft" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </Busy>
  );
}
