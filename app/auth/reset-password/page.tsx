'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Lock, ArrowLeft, CheckCircle, Eye, EyeOff, XCircle, Sparkles } from 'lucide-react';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [validating, setValidating] = useState(true);
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        setError('Invalid reset link');
        setValidating(false);
        return;
      }

      try {
        const response = await fetch('/api/auth/verify-reset-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });

        const data = await response.json();

        if (!response.ok) {
          setError(data.error || 'Invalid or expired reset link');
        }
      } catch (error: any) {
        setError('Failed to verify reset link');
      } finally {
        setValidating(false);
      }
    };

    verifyToken();
  }, [token]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!token) {
      setError('Invalid reset link');
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reset password');
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/auth/signin');
      }, 3000);
    } catch (error: any) {
      setError(error.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (validating) {
    return (
      <div className="min-h-screen pt-16 md:pt-20 pb-16 md:pb-0 bg-gradient-to-br from-purple-50 via-white to-purple-50/30 flex items-center justify-center px-4 py-8 md:py-12 relative overflow-hidden">
        <div className="max-w-md w-full bg-white/95 backdrop-blur-xl border-2 border-purple-200 rounded-3xl p-8 md:p-10 shadow-2xl text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-100 to-transparent rounded-bl-full opacity-50"></div>
          <div className="relative">
            <div className="animate-spin rounded-full h-12 w-12 border-3 border-purple-600 border-t-transparent mx-auto mb-4"></div>
            <p className="text-base text-gray-600 font-light">Verifying reset link...</p>
          </div>
        </div>
      </div>
    );
  }

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
            
            <h2 className="text-3xl md:text-4xl font-light text-gray-900 mb-4 tracking-tight">Password Reset Successful</h2>
            <p className="text-base text-gray-600 mb-8 font-light leading-relaxed">
              Your password has been updated successfully. You can now sign in with your new password.
            </p>
            <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4 mb-8">
              <p className="text-sm text-gray-700 font-light">
                Redirecting to sign in page in a few seconds...
              </p>
            </div>
            <Link
              href="/auth/signin"
              className="inline-flex items-center space-x-2 bg-gradient-to-r from-purple-600 via-purple-600 to-purple-700 text-white px-6 py-3 rounded-xl font-semibold hover:from-purple-700 hover:via-purple-700 hover:to-purple-800 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98]"
            >
              <span>Go to Sign In</span>
              <ArrowLeft className="h-5 w-5 rotate-180" />
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
              <Lock className="h-7 w-7 text-white" />
            </div>
            <h1 className="text-3xl md:text-4xl font-light text-gray-900 mb-3 tracking-tight">Reset Password</h1>
            <p className="text-base text-gray-600 font-light leading-relaxed">
              Create a new secure password for your account
            </p>
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

          <form onSubmit={handleResetPassword} className="space-y-6">
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
                  placeholder="Enter new password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-purple-400 hover:text-purple-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              <p className="text-xs text-gray-500 font-light">Minimum 6 characters required</p>
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
                  placeholder="Confirm new password"
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
                      <CheckCircle className="h-3 w-3" />
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
                  <span>Resetting Password...</span>
                </>
              ) : (
                <>
                  <Lock className="h-5 w-5" />
                  <span>Reset Password</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
