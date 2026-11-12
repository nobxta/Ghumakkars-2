import { AdminFormSkeleton } from '@/components/ui/Skeleton';

// Shown instantly on navigation while this route's code/data loads.
export default function Loading() {
  return <AdminFormSkeleton label="Loading trip form" />;
}
