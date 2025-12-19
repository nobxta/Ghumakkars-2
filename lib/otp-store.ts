import { createAdminClient } from './supabase/admin';

export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function storeOTP(email: string, otp: string, expiresInMinutes: number = 10, type: string = 'signup'): Promise<void> {
  const normalizedEmail = email.toLowerCase().trim();
  const normalizedOTP = otp.trim();
  const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);
  
  console.log(`[OTP Store] Storing OTP for email: ${normalizedEmail}, OTP: ${normalizedOTP}, Type: ${type}, Expires in: ${expiresInMinutes} minutes`);
  
  const adminClient = createAdminClient();
  
  // Delete any existing OTPs for this email and type first
  await adminClient
    .from('otp_codes')
    .delete()
    .eq('email', normalizedEmail)
    .eq('type', type);
  
  // Insert new OTP
  const { error } = await adminClient
    .from('otp_codes')
    .insert({
      email: normalizedEmail,
      otp: normalizedOTP,
      type: type,
      expires_at: expiresAt.toISOString(),
      used: false,
    });
  
  if (error) {
    console.error('[OTP Store] Error storing OTP:', error);
    throw new Error('Failed to store OTP');
  }
}

export async function verifyOTP(email: string, otp: string, type: string = 'signup'): Promise<boolean> {
  const normalizedEmail = email.toLowerCase().trim();
  const normalizedOTP = otp.trim();
  
  console.log(`[OTP Verify] Verifying OTP for email: ${normalizedEmail}, Type: ${type}, OTP: ${normalizedOTP}`);
  
  const adminClient = createAdminClient();
  
  try {
    // Find the most recent unused OTP for this email and type
    // Use .maybeSingle() instead of .single() to avoid errors when no record found
    const { data, error } = await adminClient
      .from('otp_codes')
      .select('*')
      .eq('email', normalizedEmail)
      .eq('type', type)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (error) {
      console.error(`[OTP Verify] Database error:`, error);
      return false;
    }
    
    if (!data) {
      console.log(`[OTP Verify] No valid OTP found for email: ${normalizedEmail}, Type: ${type}`);
      // Let's also check if there are any OTPs (expired or used) for debugging
      const { data: allOTPs } = await adminClient
        .from('otp_codes')
        .select('*')
        .eq('email', normalizedEmail)
        .eq('type', type)
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (allOTPs && allOTPs.length > 0) {
        console.log(`[OTP Verify] Found ${allOTPs.length} OTP record(s) for this email, but all are expired or used`);
        allOTPs.forEach((otpRecord: any, idx: number) => {
          console.log(`[OTP Verify] OTP ${idx + 1}: Used=${otpRecord.used}, Expires=${otpRecord.expires_at}, Current=${new Date().toISOString()}`);
        });
      } else {
        console.log(`[OTP Verify] No OTP records found at all for email: ${normalizedEmail}`);
      }
      return false;
    }
    
    console.log(`[OTP Verify] Found OTP record. Expected: ${data.otp}, Received: ${normalizedOTP}`);
    
    if (data.otp !== normalizedOTP) {
      console.log(`[OTP Verify] OTP mismatch for email: ${normalizedEmail}`);
      console.log(`[OTP Verify] Expected: ${data.otp}, Received: ${normalizedOTP}`);
      return false;
    }
    
    // Mark OTP as used
    const { error: updateError } = await adminClient
      .from('otp_codes')
      .update({ used: true })
      .eq('id', data.id);
    
    if (updateError) {
      console.error(`[OTP Verify] Error marking OTP as used:`, updateError);
      // Still return true since OTP was verified, just couldn't mark as used
    }
    
    console.log(`[OTP Verify] Successfully verified OTP for email: ${normalizedEmail}`);
    return true;
  } catch (err: any) {
    console.error(`[OTP Verify] Exception during verification:`, err);
    return false;
  }
}

export async function removeOTP(email: string, type: string = 'signup'): Promise<void> {
  const normalizedEmail = email.toLowerCase().trim();
  
  const adminClient = createAdminClient();
  await adminClient
    .from('otp_codes')
    .delete()
    .eq('email', normalizedEmail)
    .eq('type', type);
}

