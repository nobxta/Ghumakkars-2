'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Loader2, ShieldAlert } from 'lucide-react';

/**
 * One-time "log in as user" landing page (admin tool).
 *
 * The admin's "View as user" action mints a short-lived token_hash and links here.
 * Opening this performs a REAL login on the shared cookie session, so the entire app
 * works exactly as the user sees it. Because the browser cookie can only hold one login
 * per site, this replaces whatever session this browser had — which is why the admin
 * opens it in a separate browser / incognito window to keep their admin session alive.
 */
function ImpersonateInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState('');

  useEffect(() => {
    const token_hash = params.get('token_hash');
    if (!token_hash) {
      setError('Missing login token. Generate a fresh link from the admin panel.');
      return;
    }
    const supabase = createClient();
    (async () => {
      const { error: otpErr } = await supabase.auth.verifyOtp({ type: 'magiclink', token_hash });
      if (otpErr) {
        setError(otpErr.message || 'This login link is invalid or has expired. Generate a fresh one.');
        return;
      }
      // Real session established — drop into the user's account.
      router.replace('/profile');
    })();
  }, [params, router]);

  if (error) {
    return (
      <div className="min-h-[100svh] flex items-center justify-center px-5 bg-[#FAFAFC]">
        <div className="max-w-md w-full rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
          <ShieldAlert className="h-8 w-8 text-red-600 mx-auto mb-3" />
          <h1 className="text-lg font-bold text-red-900">Couldn&apos;t sign in</h1>
          <p className="text-sm text-red-700 mt-1.5 break-words">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100svh] flex flex-col items-center justify-center gap-3 text-slate-500 bg-[#FAFAFC]">
      <Loader2 className="h-7 w-7 animate-spin text-purple-600" />
      <p className="text-sm">Signing you in…</p>
    </div>
  );
}

export default function ImpersonatePage() {
  return (
    <Suspense fallback={null}>
      <ImpersonateInner />
    </Suspense>
  );
}
