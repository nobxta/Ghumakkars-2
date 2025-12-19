'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Mail, ArrowLeft, CheckCircle, ArrowRight, XCircle, Sparkles } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  const supabase = createClient();

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
        if (data.suggestion === 'signup') {
          setError(`${data.error}. ${data.message}`);
          setTimeout(() => {
            router.push('/auth/signup');
          }, 3000);
        } else {
          throw new Error(data.error || 'Failed to send reset email');
        }
        return;
      }

      setSuccess(true);
    } catch (error: any) {
      setError(error.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen pt-16 md:pt-20 pb-16 md:pb-0 bg-gradient-to-br from-purple-50 via-white to-purple-50/30 flex items-center justify-center px-4 py-8 md:py-12 relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 -left-20 w-96 h-96 bg-green-200 rounded-full blur-3xl opacity-20 animate-pulse"></div>
          <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-green-300 rounded-full blur-3xl opacity-20 animate-pulse" style={{ animationDelay: '1s' }}></div>
        </div>

        <div className="max-w-md w-full relative z-10">
          <div className="bg-white/95 backdrop-blur-xl border-2 border-green-200 rounded-3xl p-8 md:p-10 shadow-2xl text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-green-100 to-transparent rounded-bl-full opacity-50"></div>
            
            <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center mx-auto mb-6 shadow-lg animate-in zoom-in duration-500">
              <CheckCircle className="h-8 w-8 text-white" />
            </div>
            
            <h2 className="text-3xl md:text-4xl font-light text-gray-900 mb-4 tracking-tight">Check Your Email</h2>
            <p className="text-base text-gray-600 mb-6 font-light leading-relaxed">
              We&apos;ve sent a password reset link to<br />
              <span className="font-semibold text-purple-600 break-all">{email}</span>
            </p>
            <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4 mb-8">
              <p className="text-sm text-gray-700 font-light">
                Click the link in the email to reset your password. The link will expire in <span className="font-semibold text-green-700">1 hour</span>.
              </p>
            </div>
            <Link
              href="/auth/signin"
              className="inline-flex items-center space-x-2 bg-gradient-to-r from-purple-600 via-purple-600 to-purple-700 text-white px-6 py-3 rounded-xl font-semibold hover:from-purple-700 hover:via-purple-700 hover:to-purple-800 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98]"
            >
              <span>Return to Sign In</span>
              <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-16 md:pt-20 pb-16 md:pb-0 bg-gradient-to-br from-purple-50 via-white to-purple-50/30 flex items-center justify-center px-4 py-8 md:py-12 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -right-20 w-96 h-96 bg-purple-200 rounded-full blur-3xl opacity-20 animate-pulse"></div>
        <div className="absolute bottom-1/4 -left-20 w-96 h-96 bg-purple-300 rounded-full blur-3xl opacity-20 animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>

      <div className="max-w-md w-full relative z-10">
        <Link href="/auth/signin" className="inline-flex items-center text-purple-600 hover:text-purple-700 mb-6 md:mb-8 text-sm font-medium transition-all duration-200 group">
          <ArrowLeft className="h-4 w-4 mr-2 group-hover:-translate-x-1 transition-transform" />
          <span>Back to Sign In</span>
        </Link>
        
        <div className="bg-white/95 backdrop-blur-xl border-2 border-purple-100 rounded-3xl p-8 md:p-10 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-100 to-transparent rounded-bl-full opacity-50"></div>
          
          <div className="text-center mb-8 relative">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl mb-4 shadow-lg">
              <Mail className="h-7 w-7 text-white" />
            </div>
            <h1 className="text-3xl md:text-4xl font-light text-gray-900 mb-3 tracking-tight">Forgot Password?</h1>
            <p className="text-base text-gray-600 font-light leading-relaxed">
              No worries! Enter your email and we&apos;ll send you a reset link
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border-2 border-red-200 rounded-xl text-red-700 text-sm flex items-start space-x-3 animate-in slide-in-from-top-5 duration-300">
              <XCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium mb-1">Error</p>
                <p className="text-red-600">{error}</p>
                {error.includes('No account found') && (
                  <Link href="/auth/signup" className="mt-2 inline-flex items-center text-red-700 hover:text-red-800 font-semibold underline underline-offset-2 transition-colors">
                    Create Account →
                  </Link>
                )}
              </div>
            </div>
          )}

          <form onSubmit={handleForgotPassword} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="email" className="block text-sm font-semibold text-gray-700">
                Email Address
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className={`h-5 w-5 transition-colors ${email ? 'text-purple-600' : 'text-purple-400 group-focus-within:text-purple-600'}`} />
                </div>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full pl-12 pr-4 py-3.5 md:py-4 border-2 border-purple-200 focus:border-purple-500 focus:ring-4 focus:ring-purple-100 focus:outline-none rounded-xl text-base transition-all duration-200 text-gray-900 placeholder-gray-400"
                  placeholder="your.email@example.com"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-purple-600 via-purple-600 to-purple-700 text-white py-4 text-base font-semibold rounded-xl hover:from-purple-700 hover:via-purple-700 hover:to-purple-800 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] disabled:transform-none"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                  <span>Sending Reset Link...</span>
                </>
              ) : (
                <>
                  <Mail className="h-5 w-5" />
                  <span>Send Reset Link</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-sm text-gray-600 mb-2">
              Remember your password?
            </p>
            <Link 
              href="/auth/signin" 
              className="inline-flex items-center space-x-2 text-purple-600 hover:text-purple-700 font-semibold transition-all duration-200 hover:underline underline-offset-2 group"
            >
              <span>Sign In</span>
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
