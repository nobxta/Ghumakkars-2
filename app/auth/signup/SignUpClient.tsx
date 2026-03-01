'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Mail, Lock, ArrowLeft, User, Phone, MessageSquare, Eye, EyeOff, RotateCw, ChevronRight, ChevronLeft, CheckCircle, XCircle, Check, Gift } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

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

  // Step Progress Indicator Component
  const StepIndicator = ({ currentStep }: { currentStep: number }) => (
    <div className="mb-4 md:mb-6">
      <div className="flex items-center justify-center space-x-2 md:space-x-4">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center">
            <div className={`flex items-center justify-center w-10 h-10 md:w-12 md:h-12 rounded-full transition-all duration-300 ${
              s < currentStep 
                ? 'bg-green-500 text-white shadow-lg scale-110' 
                : s === currentStep 
                ? 'bg-purple-600 text-white shadow-lg scale-110 ring-4 ring-purple-200' 
                : 'bg-purple-100 text-gray-400'
            }`}>
              {s < currentStep ? (
                <Check className="h-5 w-5 md:h-6 md:w-6" />
              ) : (
                <span className="text-sm md:text-base font-semibold">{s}</span>
              )}
            </div>
            {s < 3 && (
              <div className={`w-8 md:w-16 h-1 mx-1 md:mx-2 rounded-full transition-all duration-300 ${
                s < currentStep ? 'bg-green-500' : 'bg-purple-200'
              }`}></div>
            )}
          </div>
        ))}
      </div>
      <p className="text-center mt-2 md:mt-4 text-xs md:text-sm text-gray-500 font-medium">
        Step {currentStep} of 3
      </p>
    </div>
  );

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-white to-purple-50/30">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-purple-600 border-t-transparent" />
      </div>
    );
  }

  // Step 3: OTP Verification
  if (step === 3) {
    return (
      <div className="min-h-[100dvh] min-h-screen pt-14 md:pt-16 pb-20 md:pb-8 bg-gradient-to-br from-purple-50 via-white to-purple-50/30 flex flex-col items-center justify-center px-3 sm:px-4 py-4 md:py-6 relative overflow-auto">
        {/* Decorative Background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 -right-20 w-96 h-96 bg-purple-200 rounded-full blur-3xl opacity-20 animate-pulse"></div>
          <div className="absolute bottom-1/4 -left-20 w-96 h-96 bg-purple-300 rounded-full blur-3xl opacity-20 animate-pulse" style={{ animationDelay: '1s' }}></div>
        </div>

        <div className="w-full max-w-md flex-1 flex flex-col min-h-0 relative z-10">
          <Link href="/" className="inline-flex items-center text-purple-600 hover:text-purple-700 mb-4 md:mb-6 text-sm font-medium transition-all duration-200 group shrink-0">
            <ArrowLeft className="h-4 w-4 mr-2 group-hover:-translate-x-1 transition-transform" />
            <span>Back to Home</span>
          </Link>
          
          <div className="bg-white/95 backdrop-blur-xl border-2 border-purple-100 rounded-2xl md:rounded-3xl p-5 sm:p-6 md:p-8 shadow-2xl relative overflow-hidden flex-1 flex flex-col min-h-0 overflow-y-auto">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-100 to-transparent rounded-bl-full opacity-50"></div>
            
            <div className="text-center mb-5 md:mb-6 relative shrink-0">
              <StepIndicator currentStep={3} />
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-light text-gray-900 mb-2 md:mb-3 tracking-tight">
                Email verification
              </h1>
              <p className="text-base text-gray-600 font-light">
                Enter the 6-digit code we sent to<br />
                <span className="font-semibold text-purple-600 break-all">{email}</span>
              </p>
            </div>

            {!otpInputReady ? (
              <div className="mb-6 rounded-2xl border-2 border-purple-100 bg-gradient-to-br from-purple-50/80 to-white p-8 text-center">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-purple-100 mb-4">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-purple-600 border-t-transparent" />
                </div>
                <p className="text-sm font-medium text-gray-700">Sending verification code</p>
                <p className="mt-1 text-xs text-gray-500">Please wait. We’re sending the code to your email.</p>
              </div>
            ) : null}

            {error ? (
              <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-start gap-3">
                <XCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                <p>{error}</p>
              </div>
            ) : null}

            {message ? (
              <div className="mb-6 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 flex items-start gap-3">
                <CheckCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                <p className="font-medium">{message}</p>
              </div>
            ) : null}

            {otpInputReady && (
              <form onSubmit={handleStep3} className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="rounded-xl border-2 border-purple-100 bg-white p-4 space-y-3">
                  <label htmlFor="otp" className="block text-sm font-semibold text-gray-700">
                    Verification code
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <MessageSquare className={`h-5 w-5 transition-colors ${otp ? 'text-purple-600' : 'text-purple-400 group-focus-within:text-purple-600'}`} />
                    </div>
                    <input
                      id="otp"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      required
                      maxLength={6}
                      className="w-full pl-12 pr-4 py-4 border-2 border-purple-200 focus:border-purple-500 focus:ring-4 focus:ring-purple-100 focus:outline-none rounded-xl text-center text-2xl tracking-[0.35em] font-semibold text-gray-900 placeholder-gray-300 transition-all duration-200"
                      placeholder="000000"
                      autoFocus
                    />
                  </div>
                  <p className="text-xs text-gray-500 flex items-center justify-center gap-1.5">
                    <Mail className="h-3.5 w-3.5" />
                    Check your inbox for the code
                  </p>
                </div>

                <div className="text-center">
                  {resendTimer > 0 ? (
                    <p className="text-sm text-gray-500">
                      Resend available in <span className="font-semibold text-purple-600">{resendTimer}s</span>
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResendOTP}
                      disabled={resendLoading}
                      className="text-sm text-purple-600 hover:text-purple-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                    >
                      {resendLoading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-purple-600 border-t-transparent" />
                          Sending…
                        </>
                      ) : (
                        <>
                          <RotateCw className="h-4 w-4" />
                          Resend code
                        </>
                      )}
                    </button>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading || otp.length !== 6}
                  className="w-full bg-gradient-to-r from-purple-600 to-purple-700 text-white py-4 text-base font-semibold rounded-xl hover:from-purple-700 hover:to-purple-800 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
                >
                  {loading ? (
                    <>
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Verifying…
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-5 w-5" />
                      Verify and continue
                    </>
                  )}
                </button>
              </form>
            )}

            <div className="mt-6 text-center shrink-0">
              <button
                onClick={() => setStep(2)}
                className="text-sm text-purple-600 hover:text-purple-700 font-medium transition-all duration-200 inline-flex items-center space-x-2 group"
              >
                <ChevronLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
                <span>Back to Password</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Step 2: Password Setup
  if (step === 2) {
    return (
      <div className="min-h-[100dvh] min-h-screen pt-14 md:pt-16 pb-20 md:pb-8 bg-gradient-to-br from-purple-50 via-white to-purple-50/30 flex flex-col items-center justify-center px-3 sm:px-4 py-4 md:py-6 relative overflow-auto">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 -right-20 w-96 h-96 bg-purple-200 rounded-full blur-3xl opacity-20 animate-pulse"></div>
          <div className="absolute bottom-1/4 -left-20 w-96 h-96 bg-purple-300 rounded-full blur-3xl opacity-20 animate-pulse" style={{ animationDelay: '1s' }}></div>
        </div>

        <div className="w-full max-w-md flex-1 flex flex-col min-h-0 relative z-10">
          <Link href="/" className="inline-flex items-center text-purple-600 hover:text-purple-700 mb-4 md:mb-6 text-sm font-medium transition-all duration-200 group shrink-0">
            <ArrowLeft className="h-4 w-4 mr-2 group-hover:-translate-x-1 transition-transform" />
            <span>Back to Home</span>
          </Link>
          
          <div className="bg-white/95 backdrop-blur-xl border-2 border-purple-100 rounded-2xl md:rounded-3xl p-5 sm:p-6 md:p-8 shadow-2xl relative overflow-hidden flex-1 flex flex-col min-h-0 overflow-y-auto">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-100 to-transparent rounded-bl-full opacity-50"></div>
            
          <div className="text-center mb-5 md:mb-6 relative shrink-0">
            <StepIndicator currentStep={2} />
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-light text-gray-900 mb-2 md:mb-3 tracking-tight">Create Password</h1>
            <p className="text-sm sm:text-base text-gray-600 font-light">Choose a secure password for your account</p>
          </div>

            {error && (
              <div className="mb-4 md:mb-6 p-3 md:p-4 bg-red-50 border-2 border-red-200 rounded-xl text-red-700 text-sm flex items-start space-x-3 animate-in slide-in-from-top-5 duration-300">
                <XCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                <p className="text-red-600">{error}</p>
              </div>
            )}

            <form onSubmit={handleStep2} className="space-y-4 sm:space-y-6 flex-1 flex flex-col min-h-0">
              <div className="space-y-2">
                <label htmlFor="password" className="block text-sm font-semibold text-gray-700">
                  New Password
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className={`h-5 w-5 transition-colors ${password ? 'text-purple-600' : 'text-purple-400 group-focus-within:text-purple-600'}`} />
                  </div>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full pl-12 pr-12 py-3.5 md:py-4 border-2 border-purple-200 focus:border-purple-500 focus:ring-4 focus:ring-purple-100 focus:outline-none rounded-xl text-base transition-all duration-200 text-gray-900 placeholder-gray-400"
                    placeholder="Create a strong password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-purple-400 hover:text-purple-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                <p className="text-xs text-gray-500 font-light flex items-center space-x-1">
                  <Check className={`h-3 w-3 ${password.length >= 6 ? 'text-green-500' : 'text-gray-300'}`} />
                  <span>Minimum 6 characters required</span>
                </p>
              </div>

              <div className="space-y-2">
                <label htmlFor="confirmPassword" className="block text-sm font-semibold text-gray-700">
                  Confirm Password
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className={`h-5 w-5 transition-colors ${confirmPassword ? 'text-purple-600' : 'text-purple-400 group-focus-within:text-purple-600'}`} />
                  </div>
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full pl-12 pr-12 py-3.5 md:py-4 border-2 border-purple-200 focus:border-purple-500 focus:ring-4 focus:ring-purple-100 focus:outline-none rounded-xl text-base transition-all duration-200 text-gray-900 placeholder-gray-400"
                    placeholder="Confirm your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-purple-400 hover:text-purple-600 transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                {confirmPassword && (
                  <p className={`text-xs font-medium flex items-center space-x-1 ${
                    password === confirmPassword ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {password === confirmPassword ? (
                      <>
                        <Check className="h-3 w-3" />
                        <span>Passwords match</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-3 w-3" />
                        <span>Passwords do not match</span>
                      </>
                    )}
                  </p>
                )}
              </div>

              <div className="mt-auto pt-4">
                <button
                  type="submit"
                  disabled={loading || password !== confirmPassword || password.length < 6}
                  className="w-full bg-gradient-to-r from-purple-600 via-purple-600 to-purple-700 text-white py-3.5 sm:py-4 text-base font-semibold rounded-xl hover:from-purple-700 hover:via-purple-700 hover:to-purple-800 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] disabled:transform-none"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                      <span>Creating Account...</span>
                    </>
                  ) : (
                    <>
                      <span>Continue</span>
                      <ChevronRight className="h-5 w-5" />
                    </>
                  )}
                </button>
              </div>
            </form>

            <div className="mt-6 text-center shrink-0">
              <button
                onClick={() => setStep(1)}
                className="text-sm text-purple-600 hover:text-purple-700 font-medium transition-all duration-200 inline-flex items-center space-x-2 group"
              >
                <ChevronLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
                <span>Back to Personal Info</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Step 1: Personal Information
  return (
    <div className="min-h-[100dvh] min-h-screen pt-14 md:pt-16 pb-20 md:pb-8 bg-gradient-to-br from-purple-50 via-white to-purple-50/30 flex flex-col items-center justify-center px-3 sm:px-4 py-4 md:py-6 relative overflow-auto">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -right-20 w-96 h-96 bg-purple-200 rounded-full blur-3xl opacity-20 animate-pulse"></div>
        <div className="absolute bottom-1/4 -left-20 w-96 h-96 bg-purple-300 rounded-full blur-3xl opacity-20 animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>

      <div className="w-full max-w-md flex-1 flex flex-col min-h-0 relative z-10">
        <Link href="/" className="inline-flex items-center text-purple-600 hover:text-purple-700 mb-4 md:mb-6 text-sm font-medium transition-all duration-200 group shrink-0">
          <ArrowLeft className="h-4 w-4 mr-2 group-hover:-translate-x-1 transition-transform" />
          <span>Back to Home</span>
        </Link>
        
        <div className="bg-white/95 backdrop-blur-xl border-2 border-purple-100 rounded-2xl md:rounded-3xl p-5 sm:p-6 md:p-8 shadow-2xl relative overflow-hidden flex-1 flex flex-col min-h-0">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-100 to-transparent rounded-bl-full opacity-50"></div>
          
          <div className="text-center mb-5 md:mb-6 relative shrink-0">
            <StepIndicator currentStep={1} />
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-light text-gray-900 mb-2 md:mb-3 tracking-tight">Join Ghumakkars</h1>
            <p className="text-sm sm:text-base text-gray-600 font-light">Start your journey of discovery and adventure</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border-2 border-red-200 rounded-xl text-red-700 text-sm flex items-start space-x-3 animate-in slide-in-from-top-5 duration-300">
              <XCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <p className="text-red-600">{error}</p>
            </div>
          )}

          <form onSubmit={handleStep1} className="space-y-4 sm:space-y-5 md:space-y-6 flex-1 flex flex-col min-h-0">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="firstName" className="block text-sm font-semibold text-gray-700">
                  First Name
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <User className={`h-5 w-5 transition-colors ${firstName ? 'text-purple-600' : 'text-purple-400 group-focus-within:text-purple-600'}`} />
                  </div>
                  <input
                    id="firstName"
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    className="w-full pl-12 pr-4 py-3.5 md:py-4 border-2 border-purple-200 focus:border-purple-500 focus:ring-4 focus:ring-purple-100 focus:outline-none rounded-xl text-base transition-all duration-200 text-gray-900 placeholder-gray-400"
                    placeholder="First name"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="lastName" className="block text-sm font-semibold text-gray-700">
                  Last Name
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <User className={`h-5 w-5 transition-colors ${lastName ? 'text-purple-600' : 'text-purple-400 group-focus-within:text-purple-600'}`} />
                  </div>
                  <input
                    id="lastName"
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                    className="w-full pl-12 pr-4 py-3.5 md:py-4 border-2 border-purple-200 focus:border-purple-500 focus:ring-4 focus:ring-purple-100 focus:outline-none rounded-xl text-base transition-all duration-200 text-gray-900 placeholder-gray-400"
                    placeholder="Last name"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="phone" className="block text-sm font-semibold text-gray-700">
                Mobile Number
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Phone className={`h-5 w-5 transition-colors ${phone ? 'text-purple-600' : 'text-purple-400 group-focus-within:text-purple-600'}`} />
                </div>
                <input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  required
                  maxLength={10}
                  className="w-full pl-12 pr-4 py-3.5 md:py-4 border-2 border-purple-200 focus:border-purple-500 focus:ring-4 focus:ring-purple-100 focus:outline-none rounded-xl text-base transition-all duration-200 text-gray-900 placeholder-gray-400"
                  placeholder="9876543210"
                />
              </div>
            </div>

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

            <div className="space-y-2">
              <label htmlFor="referralCode" className="block text-sm font-semibold text-gray-700">
                Referral Code <span className="text-xs font-normal text-gray-500">(Optional)</span>
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Gift className={`h-5 w-5 transition-colors ${referralCodeInput ? 'text-purple-600' : 'text-purple-400 group-focus-within:text-purple-600'}`} />
                </div>
                <input
                  id="referralCode"
                  type="text"
                  value={referralCodeInput}
                  onChange={(e) => setReferralCodeInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                  maxLength={20}
                  className="w-full pl-12 pr-4 py-3.5 md:py-4 border-2 border-purple-200 focus:border-purple-500 focus:ring-4 focus:ring-purple-100 focus:outline-none rounded-xl text-base transition-all duration-200 text-gray-900 placeholder-gray-400 uppercase"
                  placeholder="Enter referral code"
                />
              </div>
              {referralCode && (
                <p className="text-xs text-green-600 flex items-center space-x-1">
                  <CheckCircle className="h-3 w-3" />
                  <span>Referral code detected from link!</span>
                </p>
              )}
            </div>

            <div className="mt-auto pt-4">
              <button
                type="submit"
                className="w-full bg-gradient-to-r from-purple-600 via-purple-600 to-purple-700 text-white py-3.5 sm:py-4 text-base font-semibold rounded-xl hover:from-purple-700 hover:via-purple-700 hover:to-purple-800 transition-all duration-300 flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98]"
              >
                <span>Continue</span>
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </form>

          <div className="mt-6 text-center shrink-0">
            <p className="text-sm text-gray-600 mb-2">
              Already have an account?
            </p>
            <Link 
              href="/auth/signin" 
              className="inline-flex items-center space-x-2 text-purple-600 hover:text-purple-700 font-semibold transition-all duration-200 hover:underline underline-offset-2 group"
            >
              <span>Sign In</span>
              <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}



