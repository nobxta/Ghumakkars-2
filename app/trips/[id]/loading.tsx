// Shown while the trip detail page renders/revalidates on the server.
// Mirrors the hero + two-column body so there is no layout shift.
export default function Loading() {
  return (
    <div className="min-h-screen pt-16 md:pt-20 bg-gradient-to-b from-purple-50/30 via-white to-purple-50/30">
      {/* Hero */}
      <div className="relative h-96 md:h-[500px] lg:h-[600px] bg-gray-200 animate-pulse" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main column */}
          <div className="lg:col-span-2 space-y-6">
            <div className="h-8 w-2/3 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 w-full bg-gray-100 rounded animate-pulse" />
            <div className="h-4 w-5/6 bg-gray-100 rounded animate-pulse" />
            <div className="h-48 w-full bg-gray-100 rounded-2xl animate-pulse" />
            <div className="h-64 w-full bg-gray-100 rounded-2xl animate-pulse" />
          </div>
          {/* Sidebar (booking card) */}
          <div className="lg:col-span-1">
            <div className="h-80 w-full bg-white border border-purple-100 rounded-2xl shadow-sm animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}
