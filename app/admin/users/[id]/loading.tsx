import { AdminDetailSkeleton } from '@/components/ui/Skeleton';

// Shown instantly on navigation while this route's code/data loads.
export default function Loading() {
  return <AdminDetailSkeleton label="Loading user" />;
}
