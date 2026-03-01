/**
 * Reset token store backed by Supabase (shared across server instances).
 * Replaces in-memory store so verify-reset-token and send-password-reset see the same data.
 */
import { createAdminClient } from './supabase/admin';

export async function storeResetToken(
  token: string,
  email: string,
  expiresInMinutes: number = 60
): Promise<void> {
  const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);
  const adminClient = createAdminClient();
  const { error } = await adminClient
    .from('password_reset_tokens')
    .upsert(
      {
        token,
        email: email.toLowerCase(),
        expires_at: expiresAt.toISOString(),
      },
      { onConflict: 'token' }
    );
  if (error) {
    console.error('[reset-token-store] storeResetToken error:', error);
    throw new Error('Failed to store reset token');
  }
}

export async function getResetTokenEmail(token: string): Promise<string | null> {
  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from('password_reset_tokens')
    .select('email, expires_at')
    .eq('token', token)
    .maybeSingle();

  if (error) {
    console.error('[reset-token-store] getResetTokenEmail error:', error);
    return null;
  }
  if (!data) return null;

  const expiresAt = new Date(data.expires_at);
  if (expiresAt.getTime() < Date.now()) {
    await adminClient.from('password_reset_tokens').delete().eq('token', token);
    return null;
  }
  return data.email;
}

export async function removeResetToken(token: string): Promise<void> {
  const adminClient = createAdminClient();
  await adminClient.from('password_reset_tokens').delete().eq('token', token);
}
