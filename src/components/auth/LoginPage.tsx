import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { isClientRole } from '../../types';
import { twoFactorService } from '../../lib/twoFactorService';
import { 
  Eye, EyeOff, Lock, Mail, ShieldCheck, AlertCircle, Loader2, KeyRound, ArrowLeft 
} from 'lucide-react';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, complete2FASignIn, cancel2FASignIn, user, profile } = useAuth();

  // Step 1 Credentials state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Step 2 Two-Factor state
  const [step, setStep] = useState<'credentials' | 'two_factor'>('credentials');
  const [twoFactorData, setTwoFactorData] = useState<{
    factorId: string;
    userId: string;
    userEmail: string;
  } | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const [isVerifying2FA, setIsVerifying2FA] = useState(false);

  // If already authenticated with verified profile, redirect to mutually exclusive role area
  React.useEffect(() => {
    if (user && profile && profile.status === 'active') {
      if (isClientRole(profile.role)) {
        navigate('/client', { replace: true });
      } else {
        const from = (location.state as any)?.from?.pathname;
        const target = from && from !== '/client' && from !== '/login' ? from : '/';
        navigate(target, { replace: true });
      }
    }
  }, [user, profile, navigate, location]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const result = await signIn(email, password);
      if (result.error) {
        setErrorMessage(result.error);
        setIsSubmitting(false);
      } else if (result.requires2FA && result.factorId && result.userId) {
        // Switch to Step 2 2FA Prompt
        setTwoFactorData({
          factorId: result.factorId,
          userId: result.userId,
          userEmail: result.userEmail || email
        });
        setStep('two_factor');
        setTwoFactorCode('');
        setUseRecoveryCode(false);
        setErrorMessage(null);
        setIsSubmitting(false);
      } else {
        setIsSubmitting(false);
      }
    } catch {
      setErrorMessage("We couldn't sign you in. Check your email and password and try again.");
      setIsSubmitting(false);
    }
  };

  const handleTwoFactorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isVerifying2FA || !twoFactorData) return;

    const cleanCode = twoFactorCode.trim();
    if (!cleanCode) {
      setErrorMessage(
        useRecoveryCode
          ? 'Please enter a recovery code.'
          : 'Please enter the 6-digit code from your authenticator app.'
      );
      return;
    }

    setErrorMessage(null);
    setIsVerifying2FA(true);

    try {
      if (useRecoveryCode) {
        const res = await twoFactorService.verifyLoginRecoveryCode({
          userId: twoFactorData.userId,
          code: cleanCode
        });

        if (!res.success) {
          setErrorMessage(res.error || 'Invalid or already used recovery code.');
          setIsVerifying2FA(false);
          return;
        }

        const completeRes = await complete2FASignIn(true);
        if (completeRes.error) {
          setErrorMessage(completeRes.error);
          setIsVerifying2FA(false);
          return;
        }
      } else {
        const res = await twoFactorService.verifyLoginTOTP({
          userId: twoFactorData.userId,
          factorId: twoFactorData.factorId,
          code: cleanCode
        });

        if (!res.success) {
          setErrorMessage(
            res.error || 'Invalid verification code. Please check your authenticator app and try again.'
          );
          setIsVerifying2FA(false);
          return;
        }

        const completeRes = await complete2FASignIn(false);
        if (completeRes.error) {
          setErrorMessage(completeRes.error);
          setIsVerifying2FA(false);
          return;
        }
      }
    } catch {
      setErrorMessage('Verification failed. Please check your code and try again.');
      setIsVerifying2FA(false);
    }
  };

  const handleBackToLogin = async () => {
    await cancel2FASignIn();
    setStep('credentials');
    setTwoFactorData(null);
    setTwoFactorCode('');
    setUseRecoveryCode(false);
    setErrorMessage(null);
  };

  return (
    <div className="min-h-screen w-screen bg-slate-50 flex flex-col justify-center items-center p-4 sm:p-6 lg:p-8 font-sans selection:bg-brand-500 selection:text-white">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center p-2 rounded-2xl bg-white border border-slate-200 shadow-sm">
            <img
              src="/logo.png"
              alt="Faseeh Lall & Co."
              className="h-10 w-auto object-contain"
            />
          </div>
          <div className="space-y-1">
            <div className="text-xs font-bold uppercase tracking-widest text-brand-600">
              FLC Ops Hub
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {step === 'two_factor' ? 'Two-Factor Verification' : 'Welcome back'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 max-w-sm mx-auto leading-relaxed">
              {step === 'two_factor'
                ? useRecoveryCode
                  ? 'Enter one of your single-use recovery codes to gain access to your account.'
                  : 'Enter the 6-digit verification code from your authenticator app.'
                : 'Sign in to manage your clients, tasks, reporting and delivery operations.'}
            </p>
          </div>
        </div>

        {/* Auth Card */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-card space-y-5">
          {/* Security Badge */}
          <div className="flex items-center gap-2 p-3 rounded-2xl bg-slate-50 border border-slate-200/80 text-[11px] font-medium text-slate-600">
            <ShieldCheck className="w-4 h-4 text-brand-600 flex-shrink-0" />
            <span>
              {step === 'two_factor'
                ? 'Two-factor protection enabled for this account.'
                : 'Secure access for authorized FLC team members and clients.'}
            </span>
          </div>

          {/* Accessible Inline Error Message */}
          {errorMessage && (
            <div
              role="alert"
              className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium animate-shake"
            >
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 leading-snug">{errorMessage}</div>
            </div>
          )}

          {step === 'credentials' ? (
            /* Sign-In Form (Email + Password) */
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {/* Work Email */}
              <div className="space-y-1.5">
                <label
                  htmlFor="work-email"
                  className="block text-xs font-bold uppercase tracking-wider text-slate-700"
                >
                  Work Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    id="work-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@faseehlall.com"
                    disabled={isSubmitting}
                    className="w-full pl-10 pr-4 py-3 text-sm bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white transition-all disabled:opacity-60"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="password"
                    className="block text-xs font-bold uppercase tracking-wider text-slate-700"
                  >
                    Password
                  </label>
                  <Link
                    to="/forgot-password"
                    className="text-xs font-semibold text-brand-600 hover:text-brand-700 hover:underline focus:outline-none focus:ring-2 focus:ring-brand-500 rounded"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    disabled={isSubmitting}
                    className="w-full pl-10 pr-11 py-3 text-sm bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white transition-all disabled:opacity-60"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isSubmitting}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 focus:outline-none focus:ring-2 focus:ring-brand-500 rounded"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-brand-500 hover:bg-brand-600 active:bg-brand-700 text-white font-bold text-sm shadow-md shadow-brand-500/25 hover:shadow-brand-500/35 transition-all focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <span>Sign in to Ops Hub</span>
                )}
              </button>
            </form>
          ) : (
            /* Step 2: 2FA Verification Form */
            <form onSubmit={handleTwoFactorSubmit} className="space-y-4" noValidate>
              <div className="space-y-1.5">
                <label
                  htmlFor="two-factor-code"
                  className="block text-xs font-bold uppercase tracking-wider text-slate-700"
                >
                  {useRecoveryCode ? 'Single-Use Recovery Code' : '6-Digit Verification Code'}
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    id="two-factor-code"
                    type="text"
                    required
                    autoFocus
                    maxLength={useRecoveryCode ? 16 : 6}
                    inputMode={useRecoveryCode ? 'text' : 'numeric'}
                    pattern={useRecoveryCode ? undefined : '[0-9]*'}
                    autoComplete="one-time-code"
                    value={twoFactorCode}
                    onChange={(e) => {
                      const val = useRecoveryCode
                        ? e.target.value.toUpperCase()
                        : e.target.value.replace(/\D/g, '').slice(0, 6);
                      setTwoFactorCode(val);
                    }}
                    placeholder={useRecoveryCode ? 'ABCD-1234' : '000000'}
                    disabled={isVerifying2FA}
                    className="w-full pl-10 pr-4 py-3 text-center tracking-widest text-lg font-mono font-bold bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white transition-all disabled:opacity-60"
                  />
                </div>
                <p className="text-[11px] text-slate-500">
                  {useRecoveryCode
                    ? 'Recovery codes are 8 alphanumeric characters and can only be used once.'
                    : 'Open Google Authenticator or your authenticator app to view your 6-digit code.'}
                </p>
              </div>

              {/* Verify Button */}
              <button
                type="submit"
                disabled={isVerifying2FA || !twoFactorCode.trim()}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-brand-500 hover:bg-brand-600 active:bg-brand-700 text-white font-bold text-sm shadow-md shadow-brand-500/25 hover:shadow-brand-500/35 transition-all focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isVerifying2FA ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying code...</span>
                  </>
                ) : (
                  <span>Verify & Sign In</span>
                )}
              </button>

              {/* Mode switch & Back button */}
              <div className="pt-2 flex flex-col items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setUseRecoveryCode(!useRecoveryCode);
                    setTwoFactorCode('');
                    setErrorMessage(null);
                  }}
                  disabled={isVerifying2FA}
                  className="text-xs font-semibold text-brand-600 hover:text-brand-700 hover:underline focus:outline-none"
                >
                  {useRecoveryCode
                    ? '← Use 6-digit authenticator code instead'
                    : 'Lost access to your app? Use a recovery code'}
                </button>

                <button
                  type="button"
                  onClick={handleBackToLogin}
                  disabled={isVerifying2FA}
                  className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors focus:outline-none"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to login</span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer Note */}
        <div className="text-center">
          <p className="text-xs text-slate-500">
            Don’t have access? Contact your FLC administrator.
          </p>
        </div>
      </div>
    </div>
  );
};
