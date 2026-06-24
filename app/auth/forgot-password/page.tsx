'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CheckCircle, XCircle, ArrowLeft, ArrowRight } from 'lucide-react';
import AuthShell from '@/components/auth/AuthShell';

const PURPLE_GRAD = 'linear-gradient(135deg,#7C3AED,#9333EA)';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/auth/send-password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.suggestion === 'signup' ? 'no_account' : data.error || 'Failed to send reset email');
        return;
      }
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <AuthShell>
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
            <CheckCircle className="h-7 w-7 text-[#10B981]" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] tracking-tight">Check your email</h1>
          <p className="text-[#64748B] mt-2">
            We&apos;ve sent a password reset link to<br />
            <span className="font-semibold text-[#7C3AED] break-all">{email}</span>
          </p>
          <div className="mt-5 p-3.5 rounded-xl text-sm text-[#64748B]" style={{ background: '#FAFAFC', border: '1px solid #E2E8F0' }}>
            Click the link in the email to reset your password. The link expires in 1 hour.
          </div>
          <Link href="/auth/signin" className="mt-6 inline-flex items-center justify-center gap-2 w-full h-12 rounded-[12px] text-white font-bold text-sm transition-all hover:opacity-95" style={{ background: PURPLE_GRAD, boxShadow: '0 8px 24px rgba(124,58,237,0.3)' }}>
            Return to sign in <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <Link href="/auth/signin" className="inline-flex items-center gap-1.5 text-sm font-medium text-[#64748B] hover:text-[#7C3AED] transition-colors mb-6">
        <ArrowLeft className="h-4 w-4" />Back to sign in
      </Link>
      <h1 className="text-3xl font-extrabold text-[#0F172A] tracking-tight">Forgot password?</h1>
      <p className="text-[#64748B] mt-1.5">Enter your email and we&apos;ll send you a reset link.</p>

      {error && error !== 'no_account' && (
        <div className="mt-5 flex items-start gap-2 p-3.5 rounded-xl text-sm" style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b' }}>
          <XCircle className="h-4 w-4 flex-shrink-0 mt-0.5" /><span className="break-words">{error}</span>
        </div>
      )}
      {error === 'no_account' && (
        <div className="mt-5 p-3.5 rounded-xl text-sm" style={{ background: '#fffbeb', border: '1px solid #fde68a' }}>
          <p className="text-amber-800 mb-2.5">No account found with this email.</p>
          <Link href="/auth/signup" className="inline-flex items-center justify-center gap-2 w-full h-11 rounded-[12px] font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 transition-colors">
            Create account <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}

      <form onSubmit={handleForgotPassword} className="mt-6 space-y-4">
        <div>
          <label className="block text-sm font-semibold text-[#0F172A] mb-1.5">Email address</label>
          <input
            type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" autoComplete="email"
            className="w-full h-12 px-4 text-sm rounded-[14px] bg-white border-[1.5px] border-[#E2E8F0] text-[#0F172A] placeholder-[#94a3b8] outline-none transition-all focus:border-[#7C3AED] focus:ring-[3px] focus:ring-[rgba(124,58,237,0.1)]"
          />
        </div>
        <button type="submit" disabled={loading} className="w-full h-12 rounded-[12px] text-white font-bold text-sm flex items-center justify-center gap-2 transition-all hover:opacity-95 disabled:opacity-50" style={{ background: PURPLE_GRAD, boxShadow: '0 8px 24px rgba(124,58,237,0.3)' }}>
          {loading ? (<><span className="animate-spin h-5 w-5 rounded-full border-2 border-white border-t-transparent" />Sending…</>) : 'Send reset link'}
        </button>
      </form>

      <p className="text-center text-sm text-[#64748B] mt-6">
        Remember your password? <Link href="/auth/signin" className="font-semibold text-[#7C3AED] hover:underline">Sign in</Link>
      </p>
    </AuthShell>
  );
}
