import { createAdminClient } from './supabase/admin';

const PENDING_EXPIRY_MINUTES = 15;

export interface PendingSignupData {
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  referral_code: string | null;
}

export async function storePendingSignup(data: PendingSignupData): Promise<void> {
  const admin = createAdminClient();
  const expiresAt = new Date(Date.now() + PENDING_EXPIRY_MINUTES * 60 * 1000);
  const { error } = await admin
    .from('pending_signups')
    .upsert(
      {
        email: data.email.toLowerCase().trim(),
        first_name: data.first_name,
        last_name: data.last_name,
        phone: data.phone,
        referral_code: data.referral_code || null,
        expires_at: expiresAt.toISOString(),
      },
      { onConflict: 'email' }
    );
  if (error) throw new Error('Failed to store pending signup');
}

export async function getPendingSignup(email: string): Promise<PendingSignupData | null> {
  const admin = createAdminClient();
  const normalized = email.toLowerCase().trim();
  const { data, error } = await admin
    .from('pending_signups')
    .select('email, first_name, last_name, phone, referral_code')
    .eq('email', normalized)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();
  if (error || !data) return null;
  return {
    email: data.email,
    first_name: data.first_name,
    last_name: data.last_name,
    phone: data.phone,
    referral_code: data.referral_code,
  };
}

export async function deletePendingSignup(email: string): Promise<void> {
  const admin = createAdminClient();
  await admin.from('pending_signups').delete().eq('email', email.toLowerCase().trim());
}
