import { createClient } from '@/lib/supabase/server';
import { notFound, redirect } from 'next/navigation';
import AdminPanelLayout from '@/components/admin/AdminPanelLayout';
import './admin-styles.css';

/**
 * Server layout: only admins get the admin UI. Unauthenticated users
 * are redirected to home. Authenticated non-admins get 404. No admin
 * content or copy is ever sent to unauthorized users.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'admin') {
    notFound();
  }

  return <AdminPanelLayout>{children}</AdminPanelLayout>;
}
