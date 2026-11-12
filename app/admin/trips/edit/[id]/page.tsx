'use client';

import { useParams } from 'next/navigation';
import TripForm from '@/components/admin/trip-form/TripForm';

export default function EditTripPage() {
  const params = useParams<{ id: string }>();
  return <TripForm key={params.id} mode="edit" tripId={params.id} />;
}
