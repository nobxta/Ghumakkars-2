'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Mail, Lock, UserPlus, ArrowLeft, User, Phone, MessageSquare, Eye, EyeOff, RotateCw, ChevronRight, ChevronLeft, Sparkles, CheckCircle, XCircle, Check, Gift } from 'lucide-react';
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
  
  // Store password temporarily for auto-login after OTP verification
  const [tempPassword, setTempPassword] = useState('');

  // Countdown timer for resend OTP
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

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

    setStep(3);
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

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 409) {
          setError(data.error || 'An account with this email or phone number already exists');
        } else if (response.status === 400) {
          setError(data.error || 'Please check your input and try again');
        } else {
          setError(data.error || 'Failed to create account. Please try again.');
        }
        setStep(2);
        setLoading(false);
        return;
      }

      setTempPassword(password);
      setResendTimer(60);
      setMessage('Account created successfully! Please check your email for the OTP verification code.');
      setLoading(false);
    } catch (error: any) {
      setError(error.message || 'An unexpected error occurred. Please try again.');
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
        body: JSON.stringify({ email: trimmedEmail, otp: otp.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 400) {
          setError(data.error || 'Invalid or expired OTP. Please check and try again.');
        } else if (response.status === 404) {
          setError(data.error || 'Account not found. Please try signing up again.');
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
    <div className="mb-8">
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
      <p className="text-center mt-4 text-sm text-gray-500 font-medium">
        Step {currentStep} of 3
      </p>
    </div>
  );

  // Step 3: OTP Verification
  if (step === 3) {
    return (
      <div className="min-h-screen pt-16 md:pt-20 pb-16 md:pb-0 bg-gradient-to-br from-purple-50 via-white to-purple-50/30 flex items-center justify-center px-4 py-8 md:py-12 relative overflow-hidden">
        {/* Decorative Background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 -right-20 w-96 h-96 bg-purple-200 rounded-full blur-3xl opacity-20 animate-pulse"></div>
          <div className="absolute bottom-1/4 -left-20 w-96 h-96 bg-purple-300 rounded-full blur-3xl opacity-20 animate-pulse" style={{ animationDelay: '1s' }}></div>
        </div>

        <div className="max-w-md w-full relative z-10">
          <Link href="/" className="inline-flex items-center text-purple-600 hover:text-purple-700 mb-6 md:mb-8 text-sm font-medium transition-all duration-200 group">
            <ArrowLeft className="h-4 w-4 mr-2 group-hover:-translate-x-1 transition-transform" />
            <span>Back to Home</span>
          </Link>
          
          <div className="bg-white/95 backdrop-blur-xl border-2 border-purple-100 rounded-3xl p-8 md:p-10 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-100 to-transparent rounded-bl-full opacity-50"></div>
            
            <div className="text-center mb-8 relative">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl mb-4 shadow-lg">
                <MessageSquare className="h-7 w-7 text-white" />
              </div>
              <StepIndicator currentStep={3} />
              <h1 className="text-3xl md:text-4xl font-light text-gray-900 mb-3 tracking-tight">Verify Your Email</h1>
              <p className="text-base text-gray-600 font-light">
                We sent a verification code to<br />
                <span className="font-semibold text-purple-600">{email}</span>
              </p>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border-2 border-red-200 rounded-xl text-red-700 text-sm flex items-start space-x-3 animate-in slide-in-from-top-5 duration-300">
                <XCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium mb-1">Verification Failed</p>
                  <p className="text-red-600">{error}</p>
                </div>
              </div>
            )}

            {message && (
              <div className="mb-6 p-4 bg-green-50 border-2 border-green-200 rounded-xl text-green-700 text-sm flex items-start space-x-3 animate-in slide-in-from-top-5 duration-300">
                <CheckCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium">{message}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleStep3} className="space-y-6">
              <div className="space-y-2">
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
                    maxLength={6}
                    className="w-full pl-12 pr-4 py-4 border-2 border-purple-200 focus:border-purple-500 focus:ring-4 focus:ring-purple-100 focus:outline-none rounded-xl text-center text-3xl tracking-[0.3em] font-semibold text-gray-900 placeholder-gray-300 transition-all duration-200"
                    placeholder="000000"
                    autoFocus
                  />
                </div>
                <p className="text-sm text-gray-500 font-light flex items-center justify-center space-x-2">
                  <Mail className="h-4 w-4" />
                  <span>Check your email for the 6-digit code</span>
                </p>
                <div className="text-center pt-2">
                  {resendTimer > 0 ? (
                    <p className="text-sm text-gray-500">
                      Resend code in <span className="font-semibold text-purple-600">{resendTimer}s</span>
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResendOTP}
                      disabled={resendLoading}
                      className="text-sm text-purple-600 hover:text-purple-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center space-x-2 group"
                    >
                      {resendLoading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-purple-600 border-t-transparent"></div>
                          <span>Sending...</span>
                        </>
                      ) : (
                        <>
                          <RotateCw className="h-4 w-4 group-hover:rotate-180 transition-transform duration-500" />
                          <span>Resend Code</span>
                        </>
                      )}
                    </button>
                  )}
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
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-5 w-5" />
                    <span>Verify & Continue</span>
                  </>
                )}
              </button>
            </form>

            <div className="mt-8 text-center">
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
      <div className="min-h-screen pt-16 md:pt-20 pb-16 md:pb-0 bg-gradient-to-br from-purple-50 via-white to-purple-50/30 flex items-center justify-center px-4 py-8 md:py-12 relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 -right-20 w-96 h-96 bg-purple-200 rounded-full blur-3xl opacity-20 animate-pulse"></div>
          <div className="absolute bottom-1/4 -left-20 w-96 h-96 bg-purple-300 rounded-full blur-3xl opacity-20 animate-pulse" style={{ animationDelay: '1s' }}></div>
        </div>

        <div className="max-w-md w-full relative z-10">
          <Link href="/" className="inline-flex items-center text-purple-600 hover:text-purple-700 mb-6 md:mb-8 text-sm font-medium transition-all duration-200 group">
            <ArrowLeft className="h-4 w-4 mr-2 group-hover:-translate-x-1 transition-transform" />
            <span>Back to Home</span>
          </Link>
          
          <div className="bg-white/95 backdrop-blur-xl border-2 border-purple-100 rounded-3xl p-8 md:p-10 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-100 to-transparent rounded-bl-full opacity-50"></div>
            
          <div className="text-center mb-8 relative">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl mb-4 shadow-lg">
              <Lock className="h-7 w-7 text-white" />
            </div>
            <StepIndicator currentStep={2} />
            <h1 className="text-3xl md:text-4xl font-light text-gray-900 mb-3 tracking-tight">Create Password</h1>
            <p className="text-base text-gray-600 font-light">Choose a secure password for your account</p>
          </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border-2 border-red-200 rounded-xl text-red-700 text-sm flex items-start space-x-3 animate-in slide-in-from-top-5 duration-300">
                <XCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium mb-1">Error</p>
                  <p className="text-red-600">{error}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleStep2} className="space-y-6">
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

              <button
                type="submit"
                disabled={loading || password !== confirmPassword || password.length < 6}
                className="w-full bg-gradient-to-r from-purple-600 via-purple-600 to-purple-700 text-white py-4 text-base font-semibold rounded-xl hover:from-purple-700 hover:via-purple-700 hover:to-purple-800 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] disabled:transform-none"
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
            </form>

            <div className="mt-8 text-center">
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
    <div className="min-h-screen pt-16 md:pt-20 pb-16 md:pb-0 bg-gradient-to-br from-purple-50 via-white to-purple-50/30 flex items-center justify-center px-4 py-8 md:py-12 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -right-20 w-96 h-96 bg-purple-200 rounded-full blur-3xl opacity-20 animate-pulse"></div>
        <div className="absolute bottom-1/4 -left-20 w-96 h-96 bg-purple-300 rounded-full blur-3xl opacity-20 animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>

      <div className="max-w-md w-full relative z-10">
        <Link href="/" className="inline-flex items-center text-purple-600 hover:text-purple-700 mb-6 md:mb-8 text-sm font-medium transition-all duration-200 group">
          <ArrowLeft className="h-4 w-4 mr-2 group-hover:-translate-x-1 transition-transform" />
          <span>Back to Home</span>
        </Link>
        
        <div className="bg-white/95 backdrop-blur-xl border-2 border-purple-100 rounded-3xl p-8 md:p-10 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-100 to-transparent rounded-bl-full opacity-50"></div>
          
          <div className="text-center mb-8 relative">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl mb-4 shadow-lg">
              <Sparkles className="h-7 w-7 text-white" />
            </div>
            <StepIndicator currentStep={1} />
            <h1 className="text-3xl md:text-4xl font-light text-gray-900 mb-3 tracking-tight">Join Ghumakkars</h1>
            <p className="text-base text-gray-600 font-light">Start your journey of discovery and adventure</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border-2 border-red-200 rounded-xl text-red-700 text-sm flex items-start space-x-3 animate-in slide-in-from-top-5 duration-300">
              <XCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium mb-1">Error</p>
                <p className="text-red-600">{error}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleStep1} className="space-y-5 md:space-y-6">
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

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-purple-600 via-purple-600 to-purple-700 text-white py-4 text-base font-semibold rounded-xl hover:from-purple-700 hover:via-purple-700 hover:to-purple-800 transition-all duration-300 flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98]"
            >
              <span>Continue</span>
              <ChevronRight className="h-5 w-5" />
            </button>
          </form>

          <div className="mt-8 text-center">
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

