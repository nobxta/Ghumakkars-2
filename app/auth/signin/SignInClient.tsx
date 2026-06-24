'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Lock, Smartphone, CheckCircle, XCircle, Eye, EyeOff } from 'lucide-react';
import AuthShell from '@/components/auth/AuthShell';

const PURPLE_GRAD = 'linear-gradient(135deg,#7C3AED,#9333EA)';

export default function SignInClient() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [loginMethod, setLoginMethod] = useState<'password' | 'otp'>('password');
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  // Redirect to profile (or admin) if already logged in
  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();
        if (profile?.role === 'admin') {
          router.replace('/admin');
        } else {
          router.replace('/profile');
        }
        return;
      }
      setCheckingAuth(false);
    };
    checkUser();
  }, [router]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      if (loginMethod === 'password') {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });

        if (signInError) {
          if (process.env.NODE_ENV === 'development') {
            console.error('[SignIn] Supabase auth error:', signInError.message, signInError);
          }
          const msg = signInError.message || '';
          // Email confirmation required (Supabase may phrase this differently)
          if (/email not confirmed|confirm your email|verify your email|user not confirmed|account not confirmed/i.test(msg)) {
            throw new Error('Please verify your email first. Check your inbox for the verification link or OTP from when you signed up. You can also try "Login with OTP" below.');
          }
          // Invalid credentials - show helpful message and suggest alternatives
          if (/invalid login credentials|invalid credentials|invalid email or password/i.test(msg)) {
            throw new Error('INVALID_CREDENTIALS'); // Special marker for UI message
          }
          throw new Error(msg || 'Invalid email or password.');
        }

        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (currentUser) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', currentUser.id)
            .single();

          const redirectTo = searchParams.get('redirect') || '/';
          
          if (profile?.role === 'admin') {
            router.push('/admin');
          } else {
            router.push(redirectTo);
          }
        } else {
          const redirectTo = searchParams.get('redirect') || '/';
          router.push(redirectTo);
        }
        router.refresh();
      } else {
        if (!otpSent) {
          const response = await fetch('/api/auth/send-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
          });

          const data = await response.json();

          if (!response.ok) {
            if (data.suggestion === 'signup') {
              setError(`${data.error}. ${data.message}`);
              setTimeout(() => {
                router.push('/auth/signup');
              }, 3000);
            } else {
              throw new Error(data.error || 'Failed to send OTP');
            }
            return;
          }

          setOtpSent(true);
          setMessage('OTP sent to your email! Please check your inbox.');
        } else {
          const response = await fetch('/api/auth/verify-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, otp }),
          });

          const data = await response.json();

          if (!response.ok) {
            if (data.error?.includes('Invalid') || data.error?.includes('expired') || data.error?.includes('Invalid')) {
              throw new Error('Invalid or expired OTP. Please check the code and try again, or request a new OTP.');
            } else {
              throw new Error(data.error || 'OTP verification failed. Please try again.');
            }
          }

          if (data.magicLink || data.token_hash) {
            const tokenHash = data.token_hash ?? (data.magicLink ? (() => { try { const u = new URL(data.magicLink); return u.searchParams.get('token_hash') ?? u.searchParams.get('token'); } catch { return null; } })() : null);

            // #region agent log
            // #endregion

            if (tokenHash) {
              const { error: verifyError } = await supabase.auth.verifyOtp({
                ...(data.token_hash ? { token_hash: data.token_hash, type: 'magiclink' as const } : { email: email.trim().toLowerCase(), token: tokenHash, type: 'magiclink' as any }),
              });

              // #region agent log
              // #endregion

              if (verifyError) throw verifyError;

              const { data: { user: currentUser } } = await supabase.auth.getUser();
              if (currentUser) {
                const { data: profile } = await supabase
                  .from('profiles')
                  .select('role')
                  .eq('id', currentUser.id)
                  .single();

                const redirectTo = searchParams.get('redirect') || '/';
                
                if (profile?.role === 'admin') {
                  router.push('/admin');
                } else {
                  router.push(redirectTo);
                }
              } else {
                router.push('/');
              }
              router.refresh();
            } else {
              throw new Error('Invalid magic link');
            }
          } else {
            throw new Error('Failed to create session');
          }
        }
      }
    } catch (error: any) {
      const msg = error?.message ?? '';
      if (msg === 'Failed to fetch' || msg.includes('fetch') || msg.includes('network') || error?.name === 'TypeError') {
        setError('Connection error. Please check your internet and try again.');
      } else if (msg === 'INVALID_CREDENTIALS') {
        setError('Invalid email or password. Try "Login with OTP" (no password needed) or "Forgot Password" to reset.');
      } else {
        setError(msg || 'Invalid email or password.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchToOTP = () => {
    setLoginMethod('otp');
    setPassword('');
    setOtp('');
    setOtpSent(false);
    setError('');
    setMessage('');
  };

  const handleSwitchToPassword = () => {
    setLoginMethod('password');
    setOtp('');
    setOtpSent(false);
    setError('');
    setMessage('');
  };

  if (checkingAuth) {
    return (
      <div className="min-h-[100svh] flex items-center justify-center bg-[#FAFAFC]">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-purple-600 border-t-transparent" />
      </div>
    );
  }

  const isOtp = loginMethod === 'otp';

  return (
    <AuthShell>
      <h1 className="text-3xl font-extrabold text-[#0F172A] tracking-tight">Welcome back</h1>
      <p className="text-[#64748B] mt-1.5">Sign in to continue your next adventure.</p>

      {error && (
        <div className="mt-5 flex items-start gap-2 p-3.5 rounded-xl text-sm" style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b' }}>
          <XCircle className="h-4 w-4 flex-shrink-0 mt-0.5" /><span className="break-words">{error}</span>
        </div>
      )}
      {message && (
        <div className="mt-5 flex items-start gap-2 p-3.5 rounded-xl text-sm" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#065f46' }}>
          <CheckCircle className="h-4 w-4 flex-shrink-0 mt-0.5" /><span>{message}</span>
        </div>
      )}

      <form onSubmit={handleSignIn} className="mt-6 space-y-4">
        {/* Email */}
        <div>
          <label className="block text-sm font-semibold text-[#0F172A] mb-1.5">Email address</label>
          <input
            type="email" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={otpSent && isOtp}
            placeholder="you@example.com" autoComplete="email"
            className="w-full h-12 px-4 text-sm rounded-[14px] bg-white border-[1.5px] border-[#E2E8F0] text-[#0F172A] placeholder-[#94a3b8] outline-none transition-all focus:border-[#7C3AED] focus:ring-[3px] focus:ring-[rgba(124,58,237,0.1)] disabled:bg-gray-50"
          />
        </div>

        {/* Password method */}
        {!isOtp && (
          <div>
            <label className="block text-sm font-semibold text-[#0F172A] mb-1.5">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password"
                placeholder="••••••••"
                className="w-full h-12 pl-4 pr-11 text-sm rounded-[14px] bg-white border-[1.5px] border-[#E2E8F0] text-[#0F172A] placeholder-[#94a3b8] outline-none transition-all focus:border-[#7C3AED] focus:ring-[3px] focus:ring-[rgba(124,58,237,0.1)]"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#94a3b8] hover:text-[#7C3AED]">
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            <div className="flex items-center justify-between mt-2.5">
              <label className="flex items-center gap-2 text-sm text-[#64748B] cursor-pointer select-none">
                <input type="checkbox" className="rounded border-gray-300 text-purple-600 focus:ring-purple-500" /> Remember me
              </label>
              <Link href="/auth/forgot-password" className="text-sm font-semibold text-[#7C3AED] hover:underline">Forgot password?</Link>
            </div>
          </div>
        )}

        {/* OTP method */}
        {isOtp && (
          <div>
            {!otpSent ? (
              <p className="text-sm text-[#64748B]">We&apos;ll email you a 6-digit verification code.</p>
            ) : (
              <>
                <label className="block text-sm font-semibold text-[#0F172A] mb-1.5">Verification code</label>
                <input
                  type="text" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} required maxLength={6} autoFocus inputMode="numeric"
                  placeholder="000000"
                  className="w-full h-12 px-4 text-center text-xl tracking-[0.4em] font-semibold rounded-[14px] bg-white border-[1.5px] border-[#E2E8F0] text-[#0F172A] placeholder-[#cbd5e1] outline-none transition-all focus:border-[#7C3AED] focus:ring-[3px] focus:ring-[rgba(124,58,237,0.1)]"
                />
                <p className="text-xs text-[#94a3b8] mt-1.5">Check your email for the 6-digit code.</p>
              </>
            )}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit" disabled={loading || (isOtp && !otpSent && !email)}
          className="w-full h-12 rounded-[12px] text-white font-bold text-sm flex items-center justify-center gap-2 transition-all hover:opacity-95 disabled:opacity-50"
          style={{ background: PURPLE_GRAD, boxShadow: '0 8px 24px rgba(124,58,237,0.3)' }}
        >
          {loading ? (
            <><span className="animate-spin h-5 w-5 rounded-full border-2 border-white border-t-transparent" />Processing…</>
          ) : isOtp ? (otpSent ? 'Verify & Sign in' : 'Send verification code') : 'Sign In'}
        </button>

        {/* Method toggle */}
        <button
          type="button" onClick={isOtp ? handleSwitchToPassword : handleSwitchToOTP}
          className="w-full h-12 rounded-[12px] text-sm font-semibold text-[#0F172A] bg-white border-[1.5px] border-[#E2E8F0] hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
        >
          {isOtp ? <><Lock className="h-4 w-4" />Sign in with Password</> : <><Smartphone className="h-4 w-4" />Sign in with OTP</>}
        </button>
      </form>

      <p className="text-center text-sm text-[#64748B] mt-6">
        Don&apos;t have an account?{' '}
        <Link href="/auth/signup" className="font-semibold text-[#7C3AED] hover:underline">Create account →</Link>
      </p>
    </AuthShell>
  );
}



