import React, { useState } from 'react';
import { 
  Disc3, 
  Lock, 
  Mail, 
  User, 
  Building, 
  ArrowRight, 
  AlertCircle, 
  CheckCircle2, 
  KeyRound,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const AuthScreen: React.FC = () => {
  const { 
    signIn, 
    signUp, 
    resetPassword,
    updatePassword, 
    pendingConfirmationEmail, 
    setPendingConfirmationEmail
  } = useAuth();

  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot' | 'reset'>(() => {
    if (typeof window === 'undefined') return 'signin';
    const params = new URLSearchParams(window.location.search);
    if (window.location.hash.includes('type=recovery') || params.get('reset') === '1') return 'reset';
    return params.get('signup') === '1' ? 'signup' : 'signin';
  });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [studioName, setStudioName] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSuccessNotice(null);

    if (mode === 'forgot') {
      if (!email.trim()) { setFormError('Please enter your email address.'); return; }
      setIsSubmitting(true);
      const res = await resetPassword(email.trim());
      setIsSubmitting(false);
      if (res.error) setFormError(res.error.message);
      else setSuccessNotice('If an account exists for this email, a password reset link has been sent. Check your inbox and spam folder.');
      return;
    }

    if (mode === 'reset') {
      if (password.length < 6) { setFormError('Password must be at least 6 characters.'); return; }
      setIsSubmitting(true);
      const res = await updatePassword(password);
      setIsSubmitting(false);
      if (res.error) setFormError(res.error.message);
      else { setSuccessNotice('Password updated successfully. Signing you in…'); window.location.hash = ''; setMode('signin'); setPassword(''); }
      return;
    }

    if (mode === 'signup') {
      if (!fullName.trim()) {
        setFormError('Please enter your full name.');
        return;
      }
      if (!studioName.trim()) {
        setFormError('Please enter your studio or company name.');
        return;
      }
      if (password.length < 6) {
        setFormError('Password must be at least 6 characters.');
        return;
      }

      setIsSubmitting(true);
      const res = await signUp({
        fullName: fullName.trim(),
        email: email.trim(),
        password,
        studioName: studioName.trim(),
      });
      setIsSubmitting(false);

      if (res.error) {
        setFormError(res.error.message);
      } else if (res.requiresConfirmation) {
        setPendingConfirmationEmail(email.trim());
      }
    } else {
      if (!email.trim() || !password) {
        setFormError('Please enter your email and password.');
        return;
      }

      setIsSubmitting(true);
      const res = await signIn(email.trim(), password);
      setIsSubmitting(false);

      if (res.error) {
        setFormError(res.error.message);
      }
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col justify-center items-center p-4 sm:p-6 text-zinc-100 font-sans selection:bg-emerald-500 selection:text-black">
      {/* Background subtle acoustic grid */}
      <div 
        className="fixed inset-0 opacity-[0.02] pointer-events-none" 
        style={{ backgroundImage: 'radial-gradient(#10b981 1px, transparent 1px)', backgroundSize: '24px 24px' }} 
      />

      <div className="w-full max-w-md relative z-10 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 mb-2 shadow-lg shadow-emerald-500/10">
            <Disc3 size={24} className="animate-spin-slow" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            MixFlow
          </h1>
          <p className="text-xs text-zinc-400">
            Professional Audio Engineering & Client Management Platform
          </p>
        </div>

        {/* Main Authentication Card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          {pendingConfirmationEmail ? (
            /* Dedicated Confirmation Required State */
            <div className="space-y-5 text-center py-2">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-lg shadow-amber-500/10">
                <Mail size={22} />
              </div>

              <div className="space-y-2">
                <h3 className="text-base font-bold text-white tracking-tight">Email Confirmation Required</h3>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  Your MixFlow account has been created. We sent a verification link to:
                </p>
                <div className="p-2.5 bg-zinc-950 rounded-xl border border-zinc-800 font-mono text-xs text-emerald-400 break-all">
                  {pendingConfirmationEmail}
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed pt-1">
                  Please click the link in your email to confirm your account. Once confirmed, sign in with your credentials to automatically finalize your studio organization and launch your console.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setPendingConfirmationEmail(null);
                  setMode('signin');
                  setFormError(null);
                }}
                className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs rounded-xl transition-all shadow-lg shadow-emerald-500/20 cursor-pointer"
              >
                I've Confirmed My Email — Sign In
              </button>
            </div>
          ) : (
            <>
              {(mode === 'forgot' || mode === 'reset') && (
                <div className="mb-4 rounded-2xl border border-zinc-800 bg-zinc-950/70 p-5 space-y-4">
                  <div className="text-center space-y-2">
                    <div className="mx-auto w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                      <KeyRound size={20} />
                    </div>
                    <h3 className="text-base font-bold text-white">{mode === 'forgot' ? 'Reset your password' : 'Choose a new password'}</h3>
                    <p className="text-xs text-zinc-400 leading-relaxed">{mode === 'forgot' ? 'Enter your MixFlow email and we will send you a secure password reset link.' : 'Enter a new password for your MixFlow account.'}</p>
                  </div>
                  {mode === 'forgot' ? (
                    <div>
                      <label className="block text-zinc-300 font-medium mb-1">Email Address</label>
                      <div className="relative">
                        <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                        <input type="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="engineer@studio.com" className="w-full pl-9 pr-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500" />
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-zinc-300 font-medium mb-1">New Password</label>
                      <div className="relative">
                        <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                        <input type="password" autoFocus minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" className="w-full pl-9 pr-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500" />
                      </div>
                    </div>
                  )}
                  {formError && <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-xs text-red-400">{formError}</div>}
                  {successNotice && <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 text-xs text-emerald-400">{successNotice}</div>}
                  <button type="button" disabled={isSubmitting} onClick={async () => {
                    setFormError(null); setSuccessNotice(null);
                    if (mode === 'forgot') {
                      if (!email.trim()) { setFormError('Please enter your email address.'); return; }
                      setIsSubmitting(true);
                      try {
                        const res = await resetPassword(email.trim());
                        if (res.error) setFormError(res.error.message); else setSuccessNotice('Password reset email sent. Check your inbox and spam folder.');
                      } catch { setFormError('We could not send the reset email. Please try again.'); }
                      finally { setIsSubmitting(false); }
                    } else {
                      if (password.length < 6) { setFormError('Password must be at least 6 characters.'); return; }
                      setIsSubmitting(true);
                      try {
                        const res = await updatePassword(password);
                        if (res.error) setFormError(res.error.message);
                        else { setSuccessNotice('Password updated successfully.'); window.location.hash = ''; setMode('signin'); setPassword(''); }
                      } catch { setFormError('We could not update your password. Please try again.'); }
                      finally { setIsSubmitting(false); }
                    }
                  }} className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs rounded-xl transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 disabled:opacity-50">
                    {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={14} />}
                    <span>{mode === 'forgot' ? 'Send Reset Link' : 'Update Password'}</span>
                  </button>
                  <button type="button" onClick={() => { setMode('signin'); setFormError(null); setSuccessNotice(null); }} className="w-full text-xs text-zinc-400 hover:text-white py-2">← Back to Sign In</button>
                </div>
              )}

              {/* Mode Switcher Tabs */}
              <div className={`grid grid-cols-2 p-1 bg-zinc-950 border border-zinc-800 rounded-xl text-xs font-medium ${mode === 'forgot' || mode === 'reset' ? 'hidden' : ''}`}>
                <button
                  type="button"
                  onClick={() => {
                    setMode('signin');
                    setFormError(null);
                  }}
                  className={`py-2 rounded-lg transition-all ${
                    mode === 'signin'
                      ? 'bg-zinc-800 text-white font-semibold shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('signup');
                    setFormError(null);
                  }}
                  className={`py-2 rounded-lg transition-all ${
                    mode === 'signup'
                      ? 'bg-zinc-800 text-white font-semibold shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Create Account
                </button>
              </div>

              {/* Error Banner with Actionable Diagnostics */}
              {formError && (
                <div className="bg-zinc-950 border border-zinc-700 rounded-xl p-3.5 space-y-2 text-xs text-zinc-300 animate-in fade-in duration-150">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle size={16} className="shrink-0 mt-0.5 text-red-400" />
                    <div className="leading-relaxed font-medium">{formError}</div>
                  </div>

                  {mode === 'signin' && (
                    <div className="mt-3 pt-3 border-t border-red-500/20 space-y-2">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px]">
                        <span className="text-zinc-300">Don't have a MixFlow account yet?</span>
                        <button
                          type="button"
                          onClick={() => {
                            setMode('signup');
                            setFormError(null);
                                                      }}
                          className="text-emerald-400 hover:text-emerald-300 font-bold underline underline-offset-2 cursor-pointer text-left sm:text-right"
                        >
                          Sign up as new studio →
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Success / Confirmation Banner */}
              {successNotice && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-emerald-400 animate-in fade-in duration-150">
                  <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-emerald-400" />
                  <div className="leading-relaxed">{successNotice}</div>
                </div>
              )}

          {/* Form */}
          <form onSubmit={handleSubmit} className={`space-y-4 text-xs ${mode === 'forgot' || mode === 'reset' ? 'hidden' : ''}`}>
            {mode === 'signup' && (
              <>
                <div>
                  <label className="block text-zinc-300 font-medium mb-1">
                    Your Full Name *
                  </label>
                  <div className="relative">
                    <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Alex Rivers"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-zinc-300 font-medium mb-1">
                    Studio or Company Name *
                  </label>
                  <div className="relative">
                    <Building size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Sonic Horizon Studios"
                      value={studioName}
                      onChange={(e) => setStudioName(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-zinc-300 font-medium mb-1">
                Email Address *
              </label>
              <div className="relative">
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="email"
                  required
                  placeholder="engineer@studio.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-zinc-300 font-medium mb-1">
                Password *
              </label>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="password"
                  required
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500"
                />
              </div>
              {mode === 'signup' && (
                <p className="text-[11px] text-zinc-500 mt-1">Must be at least 6 characters</p>
              )}
              {mode === 'signin' && (
                <button type="button" onClick={() => { setMode('forgot'); setFormError(null); setSuccessNotice(null); }} className="mt-1 text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold underline underline-offset-2">Forgot password?</button>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs rounded-xl transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>{mode === 'signup' ? 'Creating Account & Studio...' : 'Authenticating...'}</span>
                </>
              ) : (
                <>
                  <span>{mode === 'signup' ? 'Create Studio Account' : 'Sign In to MixFlow'}</span>
                  <ArrowRight size={14} />
                </>
              )}
            </button>

          </form>

          </>
          )}
        </div>

        {/* Security / System Footer */}
        <div className="flex items-center justify-center gap-2 text-[11px] text-zinc-400">
          <ShieldCheck size={14} className="text-emerald-400" />
          <span>Secure authentication · Your studio data is protected</span>
        </div>
      </div>
    </div>
  );
};
