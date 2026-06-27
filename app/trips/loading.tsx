// Streamed instantly while the trips list renders/revalidates on the server.
// Mirrors the real layout (header + filter row + 6 cards) so there is no
// layout shift when content arrives.
export default function Loading() {
  return (
    <div className="min-h-screen pt-16 pb-8 bg-gradient-to-b from-white via-purple-50/30 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Header */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="h-10 sm:h-12 w-64 bg-gray-200 rounded-lg mx-auto mb-4 animate-pulse" />
          <div className="h-4 w-80 max-w-full bg-gray-100 rounded mx-auto animate-pulse" />
        </div>

        {/* Filter row */}
        <div className="mb-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="flex-1 h-9 bg-gray-100 rounded-md animate-pulse" />
          <div className="sm:w-36 h-9 bg-gray-100 rounded-md animate-pulse" />
          <div className="sm:w-32 h-9 bg-gray-100 rounded-md animate-pulse" />
        </div>

        {/* Cards grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="h-48 sm:h-56 bg-gray-200 animate-pulse" />
              <div className="p-4 sm:p-5">
                <div className="h-6 w-3/4 bg-gray-200 rounded mb-3 animate-pulse" />
                <div className="h-4 w-1/3 bg-gray-100 rounded mb-3 animate-pulse" />
                <div className="h-4 w-full bg-gray-100 rounded mb-2 animate-pulse" />
                <div className="h-4 w-5/6 bg-gray-100 rounded mb-4 animate-pulse" />
                <div className="h-10 w-full bg-gray-100 rounded-lg mb-4 animate-pulse" />
                <div className="h-16 w-full bg-purple-50 rounded-lg mb-4 animate-pulse" />
                <div className="flex gap-2">
                  <div className="flex-1 h-10 bg-gray-100 rounded-lg animate-pulse" />
                  <div className="flex-1 h-10 bg-purple-100 rounded-lg animate-pulse" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
