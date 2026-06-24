'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, RotateCw, ChevronRight, ChevronLeft, CheckCircle, XCircle, Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import AuthShell from '@/components/auth/AuthShell';

const PURPLE_GRAD = 'linear-gradient(135deg,#7C3AED,#9333EA)';
const SU_INPUT = 'w-full h-12 px-4 text-sm rounded-[14px] bg-white border-[1.5px] border-[#E2E8F0] text-[#0F172A] placeholder-[#94a3b8] outline-none transition-all focus:border-[#7C3AED] focus:ring-[3px] focus:ring-[rgba(124,58,237,0.1)]';
const SU_INPUT_PW = SU_INPUT.replace('px-4', 'pl-4 pr-11');

export default function SignUpClient() {
  const searchParams = useSearchParams();
  const referralCode = searchParams.get('ref') || '';
  
  // Step 1 fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [referralCodeInput, setReferralCodeInput] = useState(referralCode);
  
  // Step 2 fields
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // Step 3 fields
  const [otp, setOtp] = useState('');
  
  // UI state
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [resendTimer, setResendTimer] = useState(0);
  const [resendLoading, setResendLoading] = useState(false);
  const router = useRouter();
  
  // Store password temporarily for verify + auto-login after OTP
  const [tempPassword, setTempPassword] = useState('');
  // Show OTP input only after "code sent" animation (so we don't show input before OTP is sent)
  const [otpInputReady, setOtpInputReady] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Redirect to profile if already logged in
  useEffect(() => {
    const checkUser = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        router.replace('/profile');
        return;
      }
      setCheckingAuth(false);
    };
    checkUser();
  }, [router]);

  // Countdown timer for resend OTP
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  // Step 3: reveal OTP input only after short "code sent" animation
  useEffect(() => {
    if (step !== 3) {
      setOtpInputReady(false);
      return;
    }
    const t = setTimeout(() => setOtpInputReady(true), 2500);
    return () => clearTimeout(t);
  }, [step]);

  // Handle Step 1: Personal Information
  const handleStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();
    const trimmedEmail = email.trim();
    const phoneDigits = phone.replace(/\D/g, '');

    if (!trimmedFirstName || trimmedFirstName.length < 2) {
      setError('First name must be at least 2 characters');
      return;
    }

    if (!trimmedLastName || trimmedLastName.length < 2) {
      setError('Last name must be at least 2 characters');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!trimmedEmail || !emailRegex.test(trimmedEmail)) {
      setError('Please enter a valid email address');
      return;
    }

    if (phoneDigits.length !== 10) {
      setError('Phone number must be exactly 10 digits');
      return;
    }

    setStep(2);
    setError('');
  };

  // Handle Step 2: Password Setup
  const handleStep2 = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    if (password.length > 128) {
      setError('Password must be less than 128 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const trimmedFirstName = firstName.trim();
      const trimmedLastName = lastName.trim();
      const trimmedEmail = email.trim().toLowerCase();
      const phoneDigits = phone.replace(/\D/g, '');

      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: trimmedFirstName,
          lastName: trimmedLastName,
          email: trimmedEmail,
          phone: phoneDigits,
          password,
          referralCode: referralCodeInput.trim().toUpperCase() || null,
        }),
      });

      const contentType = response.headers.get('content-type') || '';
      let data: { error?: string; success?: boolean; message?: string } = {};
      if (contentType.includes('application/json')) {
        try {
          data = await response.json();
        } catch {
          data = {};
        }
      }
      if (typeof data !== 'object' || data === null) {
        data = {};
      }

      const safeError = (msg: string | undefined): string => {
        if (!msg || typeof msg !== 'string') return 'Something went wrong. Please try again.';
        if (msg.length > 500 || msg.trim().startsWith('<!') || msg.includes('</')) {
          return 'Connection error. Please check your internet and try again.';
        }
        return msg;
      };

      if (!response.ok) {
        const err = safeError(data.error);
        const fallback = err === 'Something went wrong. Please try again.';
        if (response.status === 409) {
          setError(fallback ? 'This email is already registered. Please sign in instead.' : err);
        } else if (response.status === 400) {
          setError(fallback ? 'Please check your input and try again' : err);
        } else {
          setError(fallback ? 'Failed to create account. Please try again.' : err);
        }
        setStep(2);
        setLoading(false);
        return;
      }

      setTempPassword(password);
      setResendTimer(60);
      setStep(3);
      setMessage('');
      setLoading(false);
    } catch (error: any) {
      const msg = error?.message ?? '';
      if (msg.length > 500 || msg.trim().startsWith('<!') || msg.includes('</') || msg === 'Failed to fetch') {
        setError('Connection error. Please check your internet and try again.');
      } else {
        setError(msg || 'Something went wrong. Please try again.');
      }
      setStep(2);
      setLoading(false);
    }
  };

  // Handle Step 3: OTP Verification
  const handleStep3 = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const trimmedEmail = email.trim().toLowerCase();
      const response = await fetch('/api/auth/verify-signup-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail, otp: otp.trim(), password: tempPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 400) {
          setError(data.error || 'Invalid or expired OTP. Please check and try again.');
        } else if (response.status === 404) {
          setError(data.error || 'Verification expired. Please start signup again.');
        } else {
          setError(data.error || 'Failed to verify OTP. Please try again.');
        }
        setLoading(false);
        return;
      }

      setMessage('Email verified successfully! Signing you in...');
      
      try {
        const supabase = createClient();
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password: tempPassword,
        });

        if (signInError) {
          console.error('Auto sign-in error:', signInError);
          setMessage('Email verified successfully! Redirecting to sign in...');
          setTimeout(() => {
            router.push('/auth/signin');
            router.refresh();
          }, 2000);
          return;
        }

        setTempPassword('');
        setMessage('Welcome! Redirecting to your dashboard...');
        setTimeout(() => {
          router.push('/');
          router.refresh();
        }, 1500);
      } catch (signInErr: any) {
        console.error('Error during auto sign-in:', signInErr);
        setMessage('Email verified successfully! Redirecting to sign in...');
        setTimeout(() => {
          router.push('/auth/signin');
          router.refresh();
        }, 2000);
      }
    } catch (error: any) {
      setError(error.message || 'An error occurred');
      setLoading(false);
    }
  };

  // Resend OTP handler
  const handleResendOTP = async () => {
    setResendLoading(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/auth/resend-signup-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Failed to resend OTP');
      } else {
        setMessage('OTP has been resent! Please check your email.');
        setResendTimer(60);
      }
    } catch (err: any) {
      setError('Failed to resend OTP. Please try again.');
    } finally {
      setResendLoading(false);
    }
  };

  // Clean 3-step stepper (Details → Security → Verify)
  const Stepper = ({ current }: { current: number }) => {
    const labels = ['Details', 'Security', 'Verify'];
    return (
      <div className="flex items-center justify-center mb-6">
        {labels.map((label, i) => {
          const n = i + 1;
          const done = current > n;
          const active = current === n;
          return (
            <div key={n} className="flex items-center">
              <div className="flex flex-col items-center gap-1">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all"
                  style={{ background: done ? '#10B981' : active ? PURPLE_GRAD : '#E2E8F0', color: done || active ? '#fff' : '#94a3b8', boxShadow: active ? '0 4px 14px rgba(124,58,237,0.4)' : 'none' }}
                >
                  {done ? <Check className="w-4 h-4" strokeWidth={3} /> : n}
                </div>
                <span className="text-[10px] font-semibold" style={{ color: done ? '#10B981' : active ? '#7C3AED' : '#94a3b8' }}>{label}</span>
              </div>
              {i < 2 && <div className="h-0.5 w-10 sm:w-14 mx-2 mb-4 rounded-full" style={{ background: done ? '#10B981' : '#E2E8F0' }} />}
            </div>
          );
        })}
      </div>
    );
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAFC]">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-purple-600 border-t-transparent" />
      </div>
    );
  }

  // Step 3: Email verification (OTP)
  if (step === 3) {
    return (
      <AuthShell>
        <Stepper current={3} />
        <h1 className="text-2xl font-extrabold text-[#0F172A] tracking-tight text-center">Verify your email</h1>
        <p className="text-[#64748B] mt-1.5 text-center text-sm">
          Enter the 6-digit code we sent to<br />
          <span className="font-semibold text-[#7C3AED] break-all">{email}</span>
        </p>

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

        {!otpInputReady ? (
          <div className="mt-6 rounded-[14px] p-6 text-center" style={{ background: '#FAFAFC', border: '1px solid #E2E8F0' }}>
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-purple-100 mb-3">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-purple-600 border-t-transparent" />
            </div>
            <p className="text-sm font-medium text-[#0F172A]">Sending verification code…</p>
            <p className="mt-1 text-xs text-[#94a3b8]">We&apos;re emailing the code now.</p>
          </div>
        ) : (
          <form onSubmit={handleStep3} className="mt-6 space-y-4">
            <input
              type="text" inputMode="numeric" autoComplete="one-time-code" value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} required maxLength={6} autoFocus placeholder="000000"
              className="w-full h-12 px-4 text-center text-xl tracking-[0.4em] font-semibold rounded-[14px] bg-white border-[1.5px] border-[#E2E8F0] text-[#0F172A] placeholder-[#cbd5e1] outline-none transition-all focus:border-[#7C3AED] focus:ring-[3px] focus:ring-[rgba(124,58,237,0.1)]"
            />
            <div className="text-center text-sm">
              {resendTimer > 0 ? (
                <p className="text-[#94a3b8]">Resend in <span className="font-semibold text-[#7C3AED]">{resendTimer}s</span></p>
              ) : (
                <button type="button" onClick={handleResendOTP} disabled={resendLoading} className="text-[#7C3AED] font-semibold hover:underline disabled:opacity-50 inline-flex items-center gap-1.5">
                  {resendLoading ? (<><span className="animate-spin h-4 w-4 rounded-full border-2 border-[#7C3AED] border-t-transparent" />Sending…</>) : (<><RotateCw className="h-4 w-4" />Resend code</>)}
                </button>
              )}
            </div>
            <button type="submit" disabled={loading || otp.length !== 6} className="w-full h-12 rounded-[12px] text-white font-bold text-sm flex items-center justify-center gap-2 transition-all hover:opacity-95 disabled:opacity-50" style={{ background: PURPLE_GRAD, boxShadow: '0 8px 24px rgba(124,58,237,0.3)' }}>
              {loading ? (<><span className="animate-spin h-5 w-5 rounded-full border-2 border-white border-t-transparent" />Verifying…</>) : 'Verify & continue'}
            </button>
          </form>
        )}

        <button type="button" onClick={() => setStep(2)} className="mt-5 mx-auto flex items-center gap-1.5 text-sm font-medium text-[#64748B] hover:text-[#7C3AED] transition-colors">
          <ChevronLeft className="h-4 w-4" />Back
        </button>
      </AuthShell>
    );
  }

  // Step 2: Password
  if (step === 2) {
    const match = !!confirmPassword && password === confirmPassword;
    return (
      <AuthShell>
        <Stepper current={2} />
        <h1 className="text-2xl font-extrabold text-[#0F172A] tracking-tight">Create a password</h1>
        <p className="text-[#64748B] mt-1.5 text-sm">Choose a secure password for your account.</p>

        {error && (
          <div className="mt-5 flex items-start gap-2 p-3.5 rounded-xl text-sm" style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b' }}>
            <XCircle className="h-4 w-4 flex-shrink-0 mt-0.5" /><span className="break-words">{error}</span>
          </div>
        )}

        <form onSubmit={handleStep2} className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-[#0F172A] mb-1.5">New password</label>
            <div className="relative">
              <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} placeholder="••••••••" className={SU_INPUT_PW} />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#94a3b8] hover:text-[#7C3AED]">
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            <p className="text-xs mt-1.5 flex items-center gap-1.5" style={{ color: password.length >= 6 ? '#10B981' : '#94a3b8' }}>
              <Check className="h-3.5 w-3.5" />Minimum 6 characters
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#0F172A] mb-1.5">Confirm password</label>
            <div className="relative">
              <input type={showConfirmPassword ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={6} placeholder="••••••••" className={SU_INPUT_PW} />
              <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#94a3b8] hover:text-[#7C3AED]">
                {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            {confirmPassword && (
              <p className="text-xs mt-1.5 flex items-center gap-1.5" style={{ color: match ? '#10B981' : '#EF4444' }}>
                {match ? <><Check className="h-3.5 w-3.5" />Passwords match</> : <><XCircle className="h-3.5 w-3.5" />Passwords don&apos;t match</>}
              </p>
            )}
          </div>

          <button type="submit" disabled={loading || password !== confirmPassword || password.length < 6} className="w-full h-12 rounded-[12px] text-white font-bold text-sm flex items-center justify-center gap-2 transition-all hover:opacity-95 disabled:opacity-50" style={{ background: PURPLE_GRAD, boxShadow: '0 8px 24px rgba(124,58,237,0.3)' }}>
            {loading ? (<><span className="animate-spin h-5 w-5 rounded-full border-2 border-white border-t-transparent" />Creating account…</>) : (<>Continue <ChevronRight className="h-4 w-4" /></>)}
          </button>
        </form>

        <button type="button" onClick={() => setStep(1)} className="mt-5 mx-auto flex items-center gap-1.5 text-sm font-medium text-[#64748B] hover:text-[#7C3AED] transition-colors">
          <ChevronLeft className="h-4 w-4" />Back
        </button>
      </AuthShell>
    );
  }

  // Step 1: Personal details
  return (
    <AuthShell>
      <Stepper current={1} />
      <h1 className="text-2xl font-extrabold text-[#0F172A] tracking-tight">Create your account</h1>
      <p className="text-[#64748B] mt-1.5 text-sm">Start your journey with Ghumakkars.</p>

      {error && (
        <div className="mt-5 flex items-start gap-2 p-3.5 rounded-xl text-sm" style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b' }}>
          <XCircle className="h-4 w-4 flex-shrink-0 mt-0.5" /><span className="break-words">{error}</span>
        </div>
      )}

      <form onSubmit={handleStep1} className="mt-6 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-semibold text-[#0F172A] mb-1.5">First name</label>
            <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} required placeholder="Rahul" className={SU_INPUT} />
          </div>
          <div>
            <label className="block text-sm font-semibold text-[#0F172A] mb-1.5">Last name</label>
            <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} required placeholder="Sharma" className={SU_INPUT} />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-[#0F172A] mb-1.5">Mobile number</label>
          <input type="tel" inputMode="numeric" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} required maxLength={10} placeholder="9876543210" className={SU_INPUT} />
        </div>

        <div>
          <label className="block text-sm font-semibold text-[#0F172A] mb-1.5">Email address</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" className={SU_INPUT} />
        </div>

        <div>
          <label className="block text-sm font-semibold text-[#0F172A] mb-1.5">Referral code <span className="text-xs font-normal text-[#94a3b8]">(optional)</span></label>
          <input type="text" value={referralCodeInput} onChange={(e) => setReferralCodeInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} maxLength={20} placeholder="GHUMAKKARS" className={`${SU_INPUT} uppercase placeholder:normal-case`} />
          {referralCode && (
            <p className="text-xs text-[#10B981] mt-1.5 flex items-center gap-1.5"><CheckCircle className="h-3.5 w-3.5" />Referral code applied from link</p>
          )}
        </div>

        <button type="submit" className="w-full h-12 rounded-[12px] text-white font-bold text-sm flex items-center justify-center gap-2 transition-all hover:opacity-95" style={{ background: PURPLE_GRAD, boxShadow: '0 8px 24px rgba(124,58,237,0.3)' }}>
          Continue <ChevronRight className="h-4 w-4" />
        </button>
      </form>

      <p className="text-center text-sm text-[#64748B] mt-6">
        Already have an account? <Link href="/auth/signin" className="font-semibold text-[#7C3AED] hover:underline">Sign in</Link>
      </p>
    </AuthShell>
  );
}



