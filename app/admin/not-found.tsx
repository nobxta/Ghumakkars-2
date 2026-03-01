import Link from 'next/link';

/**
 * Shown when a non-admin hits /admin or any admin path. Generic 404 only —
 * no reference to admin or protected area.
 */
export default function AdminNotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
      <h1 className="text-6xl font-bold text-gray-300">404</h1>
      <p className="mt-2 text-lg text-gray-600">Page not found</p>
      <Link
        href="/"
        className="mt-6 px-6 py-3 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors"
      >
        Go to home
      </Link>
    </div>
  );
}
