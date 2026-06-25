'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient as createIsolatedClient } from '@supabase/supabase-js';
import { User, Mail, Phone, Wallet, Calendar, ShieldAlert, Loader2, ExternalLink } from 'lucide-react';

/**
 * "View as user" — an isolated impersonation session.
 *
 * The whole app authenticates through cookies (shared across every tab), so signing in
 * as a user the normal way logs the admin out. Here we build a STANDALONE supabase-js
 * client whose session lives only in this tab's sessionStorage under a private storageKey.
 * It never reads or writes the auth cookie, so the admin's session in other tabs is
 * completely untouched. We exchange a one-time token_hash (minted server-side, admin-only)
 * for the user's real session, then read their account exactly as RLS exposes it to them.
 */
export default function ImpersonatePage() {
  const params = useParams<{ id: string }>();
  const id = params?.id as string;

  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [who, setWho] = useState<{ email: string; name: string } | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [bookings, setBookings] = useState<any[]>([]);

  // A private client: per-tab sessionStorage, custom storageKey -> fully isolated from the
  // cookie-based admin session.
  const supabase = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    return createIsolatedClient(url, anon, {
      auth: {
        storageKey: `sb-impersonate-${id}`,
        storage: typeof window !== 'undefined' ? window.sessionStorage : undefined,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // 1) Get a one-time token from the admin-only endpoint (authorized via admin cookie).
        const res = await fetch(`/api/admin/users/${id}/impersonate`, { method: 'POST' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Could not start the session.');

        // 2) Exchange it for the user's session inside the isolated client only.
        const { error: otpErr } = await supabase.auth.verifyOtp({
          type: 'magiclink',
          token_hash: data.token_hash,
        });
        if (otpErr) throw new Error(otpErr.message);

        // 3) Read the account AS the user (RLS-scoped).
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Session did not establish.');

        const [{ data: prof }, { data: bks }] = await Promise.all([
          supabase.from('profiles').select('*').eq('id', user.id).single(),
          supabase.from('bookings').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        ]);

        if (cancelled) return;
        setWho({ email: data.email, name: data.name });
        setProfile(prof);
        setBookings(bks || []);
        setStatus('ready');
      } catch (e: any) {
        if (cancelled) return;
        setErrorMsg(e.message || 'Something went wrong.');
        setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
      // Tear the impersonated session down when leaving so nothing lingers in this tab.
      supabase.auth.signOut().catch(() => {});
    };
  }, [id, supabase]);

  const inr = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

  if (status === 'loading') {
    return (
      <div className="min-h-[100svh] flex flex-col items-center justify-center gap-3 text-slate-500">
        <Loader2 className="h-7 w-7 animate-spin text-purple-600" />
        <p className="text-sm">Opening the user&apos;s account…</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-[100svh] flex items-center justify-center px-5">
        <div className="max-w-md w-full rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
          <ShieldAlert className="h-8 w-8 text-red-600 mx-auto mb-3" />
          <h1 className="text-lg font-bold text-red-900">Couldn&apos;t open the account</h1>
          <p className="text-sm text-red-700 mt-1.5 break-words">{errorMsg}</p>
          <button onClick={() => window.close()} className="mt-4 h-10 px-4 rounded-lg bg-red-600 text-white text-sm font-semibold">
            Close tab
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100svh] bg-[#FAFAFC]">
      {/* Impersonation banner */}
      <div className="sticky top-0 z-20 bg-amber-500 text-amber-950">
        <div className="max-w-4xl mx-auto px-4 py-2.5 flex items-center gap-2.5 text-sm font-semibold">
          <ShieldAlert className="h-4 w-4 flex-shrink-0" />
          <span className="flex-1 min-w-0 truncate">
            Viewing <span className="font-extrabold">{who?.name}</span> ({who?.email}) — read-only. Your admin session is not affected.
          </span>
          <button onClick={() => window.close()} className="flex-shrink-0 underline hover:no-underline">Close</button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Identity */}
        <div className="bg-white rounded-2xl border border-[#E8E8EF] shadow-sm p-6 flex items-center gap-5">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="w-16 h-16 rounded-full object-cover" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-purple-600 flex items-center justify-center">
              <User className="h-8 w-8 text-white" />
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-slate-900 truncate">{profile?.full_name || who?.name}</h1>
            <div className="mt-1 space-y-0.5 text-sm text-slate-500">
              {(profile?.email || who?.email) && (
                <div className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />{profile?.email || who?.email}</div>
              )}
              {profile?.phone && (
                <div className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{profile.phone}</div>
              )}
            </div>
          </div>
          <div className="ml-auto text-right">
            <div className="flex items-center justify-end gap-1.5 text-slate-400 text-xs"><Wallet className="h-3.5 w-3.5" />Wallet</div>
            <div className="text-lg font-bold text-slate-900">{inr(profile?.wallet_balance || 0)}</div>
          </div>
        </div>

        {/* Bookings */}
        <div className="bg-white rounded-2xl border border-[#E8E8EF] shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-[#E8E8EF] flex items-center gap-2">
            <Calendar className="h-4 w-4 text-purple-600" />
            <h2 className="font-bold text-slate-900">Bookings</h2>
            <span className="text-xs font-semibold text-slate-400">({bookings.length})</span>
          </div>
          {bookings.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-slate-400">No bookings yet.</div>
          ) : (
            <ul className="divide-y divide-[#F1F1F6]">
              {bookings.map((b) => (
                <li key={b.id} className="px-6 py-4 flex items-center gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900 truncate">{b.trip_title || b.trip_id || 'Trip'}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {b.created_at ? new Date(b.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                      {b.status ? ` · ${b.status}` : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-slate-900">{inr(b.total_amount || b.amount || 0)}</div>
                    {b.id && (
                      <a href={`/bookings/${b.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-purple-600 hover:underline mt-0.5">
                        Open <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="text-center text-xs text-slate-400">
          This is an isolated, read-only view. Closing the tab ends the session — it lives only here, not in your admin browser.
        </p>
      </div>
    </div>
  );
}
