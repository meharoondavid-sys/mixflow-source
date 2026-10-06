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
  Headphones,
  Bug
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getSupabaseUrl } from '../../lib/supabase';
import { AuthDiagnosticError } from '../../types/auth';

export const AuthScreen: React.FC = () => {
  const { 
    signIn, 
    signUp, 
    isConfigured, 
    setAnonKeyManually, 
    pendingConfirmationEmail, 
    setPendingConfirmationEmail,
    signInAsDemo
  } = useAuth();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [studioName, setStudioName] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [formDiagnostic, setFormDiagnostic] = useState<AuthDiagnosticError | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [anonKeyInput, setAnonKeyInput] = useState('');
  const [showKeyConfig, setShowKeyConfig] = useState(!isConfigured);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormDiagnostic(null);
    setSuccessNotice(null);

    if (!isConfigured) {
      setFormError('Please configure your Supabase Anon Key to connect to project amgowwvresmsysofwqsp.');
      setShowKeyConfig(true);
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
        setFormDiagnostic(res.diagnostic || null);
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
        setFormDiagnostic(res.diagnostic || null);
      }
    }
  };

  const handleSaveAnonKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (!anonKeyInput.trim()) return;
    setAnonKeyManually(anonKeyInput.trim());
    setShowKeyConfig(false);
    setFormError(null);
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

        {/* Supabase Connection Setup Box (if anon key missing) */}
        {showKeyConfig && (
          <div className="bg-zinc-900 border border-amber-500/40 rounded-2xl p-5 space-y-3 shadow-xl">
            <div className="flex items-center gap-2 text-amber-400 text-xs font-semibold">
              <KeyRound size={15} />
              <span>Connect Supabase Project (amgowwvresmsysofwqsp)</span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Target Supabase instance: <code className="text-zinc-300 font-mono">https://amgowwvresmsysofwqsp.supabase.co</code> (Tokyo).
              Enter your project <strong>anon key</strong> to enable live authentication and real database transactions:
            </p>
            <form onSubmit={handleSaveAnonKey} className="space-y-2">
              <input
                type="text"
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                value={anonKeyInput}
                onChange={(e) => setAnonKeyInput(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500 font-mono"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs rounded-xl transition-colors"
                >
                  Save Supabase Key
                </button>
                {isConfigured && (
                  <button
                    type="button"
                    onClick={() => setShowKeyConfig(false)}
                    className="px-3 py-2 bg-zinc-800 text-zinc-300 text-xs rounded-xl"
                  >
                    Close
                  </button>
                )}
              </div>
            </form>
          </div>
        )}

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
                  Your Supabase user and profile were created! We sent a verification link to:
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
              {/* Mode Switcher Tabs */}
              <div className="grid grid-cols-2 p-1 bg-zinc-950 border border-zinc-800 rounded-xl text-xs font-medium">
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
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3.5 space-y-2 text-xs text-red-400 animate-in fade-in duration-150">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle size={16} className="shrink-0 mt-0.5 text-red-400" />
                    <div className="leading-relaxed font-medium">{formError}</div>
                  </div>

                  {formDiagnostic && (
                    <div className="mt-2 pt-2 border-t border-red-500/20 text-[11px] font-mono text-zinc-300 space-y-1 bg-black/40 rounded-lg p-2.5">
                      <div className="text-red-300 font-semibold flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Bug size={12} className="text-red-400" />
                          <span>Operation: {formDiagnostic.operation}</span>
                        </span>
                        {formDiagnostic.code && (
                          <span className="px-1.5 py-0.5 rounded bg-red-950 text-red-200 border border-red-800 text-[10px]">
                            Code: {formDiagnostic.code}
                          </span>
                        )}
                      </div>
                      <div className="text-zinc-400 break-all">Message: {formDiagnostic.message}</div>
                      {formDiagnostic.hint && (
                        <div className="text-amber-300/90 font-sans text-[11px] pt-0.5">💡 Hint: {formDiagnostic.hint}</div>
                      )}
                      {formDiagnostic.details && (
                        <div className="text-zinc-500 text-[10px]">Details: {formDiagnostic.details}</div>
                      )}
                    </div>
                  )}

                  {mode === 'signin' && (
                    <div className="mt-3 pt-3 border-t border-red-500/20 space-y-2">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px]">
                        <span className="text-zinc-300">No account created in this Supabase database yet?</span>
                        <button
                          type="button"
                          onClick={() => {
                            setMode('signup');
                            setFormError(null);
                            setFormDiagnostic(null);
                          }}
                          className="text-emerald-400 hover:text-emerald-300 font-bold underline underline-offset-2 cursor-pointer text-left sm:text-right"
                        >
                          Sign up as new studio →
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => signInAsDemo(email, fullName, 'owner')}
                        className="w-full py-2 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 hover:text-emerald-200 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Headphones size={13} />
                        <span>⚡ Launch Studio Console Immediately (Demo Engineer)</span>
                      </button>
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
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
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

            {/* Instant Demo Login Button */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => signInAsDemo(email || 'alex@sonichorizon.audio', fullName || 'Alex Rivera', 'owner')}
                className="w-full py-2.5 bg-zinc-950 hover:bg-zinc-800 border border-zinc-700/80 text-zinc-300 hover:text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
              >
                <Headphones size={14} className="text-emerald-400" />
                <span>⚡ Instant Studio Demo (Sign In as Lead Engineer)</span>
              </button>
            </div>
          </form>

          {/* Quick Demo Credentials Assistant */}
          <div className="pt-2 border-t border-zinc-800 flex items-center justify-between text-[11px] text-zinc-400">
            <span>Supabase Auth Session Persistence</span>
            <button
              type="button"
              onClick={() => setShowKeyConfig(!showKeyConfig)}
              className="text-zinc-400 hover:text-emerald-400 flex items-center gap-1 transition-colors"
            >
              <KeyRound size={12} />
              <span>{isConfigured ? 'Key Configured ✓' : 'Config Key'}</span>
            </button>
          </div>
          </>
          )}
        </div>

        {/* Security / System Footer */}
        <div className="flex items-center justify-center gap-2 text-[11px] text-zinc-400">
          <ShieldCheck size={14} className="text-emerald-400" />
          <span>RLS & Database Triggers Protected · Supabase APAC (Tokyo)</span>
        </div>
      </div>
    </div>
  );
};
