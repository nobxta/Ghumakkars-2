'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Mail, Lock, LogIn, ArrowLeft, Smartphone, MessageSquare, Sparkles, CheckCircle, XCircle, ChevronRight } from 'lucide-react';

export default function SignInPage() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [loginMethod, setLoginMethod] = useState<'password' | 'otp'>('password');
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const router = useRouter();
  const supabase = createClient();

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      if (loginMethod === 'password') {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });

        if (error) {
          if (error.message.includes('Invalid login credentials') || error.message.includes('invalid') || error.message.includes('Invalid')) {
            throw new Error('Invalid email or password. Please check your credentials and try again.');
          } else if (error.message.includes('Email not confirmed')) {
            throw new Error('Please verify your email address before signing in.');
          } else {
            throw new Error(error.message || 'Failed to sign in. Please try again.');
          }
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

          if (data.magicLink) {
            const url = new URL(data.magicLink);
            const token = url.searchParams.get('token');
            const type = url.searchParams.get('type');

            if (token && type) {
              const { error: verifyError } = await supabase.auth.verifyOtp({
                email,
                token,
                type: 'magiclink' as any,
              });

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
      setError(error.message || 'An error occurred');
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

  return (
    <div className="min-h-screen pt-16 md:pt-20 pb-16 md:pb-0 bg-gradient-to-br from-purple-50 via-white to-purple-50/30 flex items-center justify-center px-4 py-8 md:py-12 relative overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-20 w-96 h-96 bg-purple-200 rounded-full blur-3xl opacity-20 animate-pulse"></div>
        <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-purple-300 rounded-full blur-3xl opacity-20 animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-100 rounded-full blur-3xl opacity-10"></div>
      </div>

      <div className="max-w-md w-full relative z-10">
        <Link href="/" className="inline-flex items-center text-purple-600 hover:text-purple-700 mb-6 md:mb-8 text-sm font-medium transition-all duration-200 group">
          <ArrowLeft className="h-4 w-4 mr-2 group-hover:-translate-x-1 transition-transform" />
          <span>Back to Home</span>
        </Link>
        
        <div className="bg-white/95 backdrop-blur-xl border-2 border-purple-100 rounded-3xl p-8 md:p-10 shadow-2xl relative overflow-hidden">
          {/* Decorative corner accent */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-100 to-transparent rounded-bl-full opacity-50"></div>
          
          {/* Header Section */}
          <div className="text-center mb-8 relative">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl mb-4 shadow-lg">
              <Sparkles className="h-7 w-7 text-white" />
            </div>
            <h1 className="text-3xl md:text-4xl font-light text-gray-900 mb-3 tracking-tight">
              Welcome Back
            </h1>
            <p className="text-base text-gray-600 font-light leading-relaxed">
              Sign in to continue your adventure with Ghumakkars
            </p>
          </div>

          {/* Error Message */}
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

          {/* Success Message */}
          {message && (
            <div className="mb-6 p-4 bg-green-50 border-2 border-green-200 rounded-xl text-green-700 text-sm flex items-start space-x-3 animate-in slide-in-from-top-5 duration-300">
              <CheckCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium">{message}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSignIn} className="space-y-6">
            {/* Email Field */}
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
                  disabled={otpSent && loginMethod === 'otp'}
                  className="w-full pl-12 pr-4 py-3.5 md:py-4 border-2 border-purple-200 focus:border-purple-500 focus:ring-4 focus:ring-purple-100 focus:outline-none rounded-xl text-base transition-all duration-200 disabled:bg-purple-50 disabled:cursor-not-allowed text-gray-900 placeholder-gray-400"
                  placeholder="your.email@example.com"
                />
              </div>
            </div>

            {/* Password Login */}
            {loginMethod === 'password' && (
              <div className="space-y-2 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <label htmlFor="password" className="block text-sm font-semibold text-gray-700">
                  Password
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className={`h-5 w-5 transition-colors ${password ? 'text-purple-600' : 'text-purple-400 group-focus-within:text-purple-600'}`} />
                  </div>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full pl-12 pr-4 py-3.5 md:py-4 border-2 border-purple-200 focus:border-purple-500 focus:ring-4 focus:ring-purple-100 focus:outline-none rounded-xl text-base transition-all duration-200 text-gray-900 placeholder-gray-400"
                    placeholder="Enter your password"
                  />
                </div>
                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={handleSwitchToOTP}
                    className="text-sm text-purple-600 hover:text-purple-700 font-medium transition-all duration-200 flex items-center space-x-2 hover:underline underline-offset-2 group"
                  >
                    <Smartphone className="h-4 w-4 group-hover:scale-110 transition-transform" />
                    <span>Login with OTP</span>
                  </button>
                  <Link 
                    href="/auth/forgot-password" 
                    className="text-sm text-purple-600 hover:text-purple-700 font-medium transition-all duration-200 hover:underline underline-offset-2"
                  >
                    Forgot Password?
                  </Link>
                </div>
              </div>
            )}

            {/* OTP Login */}
            {loginMethod === 'otp' && (
              <div className="space-y-2 animate-in fade-in slide-in-from-bottom-4 duration-300">
                {!otpSent && (
                  <p className="text-sm text-gray-600 font-light mb-4">
                    We&apos;ll send a verification code to your email
                  </p>
                )}
                {otpSent && (
                  <>
                    <label htmlFor="otp" className="block text-sm font-semibold text-gray-700">
                      Enter Verification Code
                    </label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <MessageSquare className={`h-5 w-5 transition-colors ${otp ? 'text-purple-600' : 'text-purple-400 group-focus-within:text-purple-600'}`} />
                      </div>
                      <input
                        id="otp"
                        type="text"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        required
                        className="w-full pl-12 pr-4 py-3.5 md:py-4 border-2 border-purple-200 focus:border-purple-500 focus:ring-4 focus:ring-purple-100 focus:outline-none rounded-xl text-base transition-all duration-200 text-center text-2xl tracking-[0.5em] font-semibold text-gray-900 placeholder-gray-300"
                        placeholder="000000"
                        maxLength={6}
                        autoFocus
                      />
                    </div>
                    <p className="text-sm text-gray-500 font-light flex items-center space-x-2">
                      <Mail className="h-4 w-4" />
                      <span>Check your email for the 6-digit code</span>
                    </p>
                  </>
                )}
                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={handleSwitchToPassword}
                    className="text-sm text-purple-600 hover:text-purple-700 font-medium transition-all duration-200 flex items-center space-x-2 hover:underline underline-offset-2 group"
                  >
                    <Lock className="h-4 w-4 group-hover:scale-110 transition-transform" />
                    <span>Login with Password</span>
                  </button>
                  <Link 
                    href="/auth/forgot-password" 
                    className="text-sm text-purple-600 hover:text-purple-700 font-medium transition-all duration-200 hover:underline underline-offset-2"
                  >
                    Forgot Password?
                  </Link>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || (loginMethod === 'otp' && !otpSent && !email)}
              className="w-full bg-gradient-to-r from-purple-600 via-purple-600 to-purple-700 text-white py-4 md:py-4.5 text-base font-semibold rounded-xl hover:from-purple-700 hover:via-purple-700 hover:to-purple-800 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] disabled:transform-none"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  {loginMethod === 'otp' && !otpSent ? (
                    <>
                      <Mail className="h-5 w-5" />
                      <span>Send Verification Code</span>
                    </>
                  ) : (
                    <>
                      <LogIn className="h-5 w-5" />
                      <span>{loginMethod === 'otp' ? 'Verify & Sign In' : 'Sign In'}</span>
                    </>
                  )}
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="my-8 flex items-center">
            <div className="flex-1 border-t border-purple-200"></div>
            <span className="px-4 text-sm text-gray-500 font-medium">or</span>
            <div className="flex-1 border-t border-purple-200"></div>
          </div>

          {/* Sign Up Link */}
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-2">
              Don&apos;t have an account?
            </p>
            <Link 
              href="/auth/signup" 
              className="inline-flex items-center space-x-2 text-purple-600 hover:text-purple-700 font-semibold transition-all duration-200 hover:underline underline-offset-2 group"
            >
              <span>Create New Account</span>
              <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
