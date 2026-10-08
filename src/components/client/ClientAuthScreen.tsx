import React, { useState } from 'react';
import { ArrowRight, Disc3, Lock, Mail, User, Loader2, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const ClientAuthScreen: React.FC = () => {
  const { signInClient, signUpClient, pendingConfirmationEmail, setPendingConfirmationEmail } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (mode === 'signup' && !fullName.trim()) {
      setError('Please enter your full name.');
      return;
    }
    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setBusy(true);
    try {
      const result = mode === 'signup'
        ? await signUpClient({ fullName, email, password })
        : await signInClient(email, password);

      if (result.error) {
        setError(result.error.message);
      } else {
        // Client entry should always land in the authenticated client portal.
        // Keep the client query flag so App preserves the client-only route after refresh.
        window.location.hash = '#/client';
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to sign in. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  if (pendingConfirmationEmail) {
    return (
      <Shell>
        <div className="text-center space-y-5">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-400/20 bg-amber-400/10 text-amber-300">
            <Mail size={22} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">Confirm your email</h1>
            <p className="mt-2 text-xs leading-relaxed text-zinc-400">
              Your MixFlow client account is ready. Confirm the email address below, then come back and sign in with your password.
            </p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 font-mono text-xs text-emerald-300 break-all">
            {pendingConfirmationEmail}
          </div>
          <button
            onClick={() => setPendingConfirmationEmail(null)}
            className="w-full rounded-xl bg-emerald-500 py-3 text-xs font-bold text-black hover:bg-emerald-400"
          >
            Back to Client Sign In
          </button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-300">
          <Disc3 size={23} />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white">MixFlow</h1>
        <p className="mt-1 text-xs text-zinc-500">Your music. One place.</p>
      </div>

      <div className="grid grid-cols-2 rounded-xl border border-zinc-800 bg-zinc-950 p-1 text-xs font-medium">
        <button onClick={() => { setMode('signin'); setError(null); }} className={`rounded-lg py-2 ${mode === 'signin' ? 'bg-zinc-800 text-white' : 'text-zinc-500'}`}>Sign In</button>
        <button onClick={() => { setMode('signup'); setError(null); }} className={`rounded-lg py-2 ${mode === 'signup' ? 'bg-zinc-800 text-white' : 'text-zinc-500'}`}>Create Account</button>
      </div>

      <form onSubmit={submit} className="space-y-4">
        {mode === 'signup' && (
          <Field icon={<User size={15} />} label="Full name">
            <input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your name" className={inputClass} />
          </Field>
        )}
        <Field icon={<Mail size={15} />} label="Email">
          <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" className={inputClass} />
        </Field>
        <Field icon={<Lock size={15} />} label="Password">
          <input type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 6 characters" className={inputClass} />
        </Field>

        {error && <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-xs text-red-300">{error}</div>}

        <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-xs font-bold text-black shadow-lg shadow-emerald-500/10 hover:bg-emerald-400 disabled:opacity-50">
          {busy ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={14} />}
          {busy ? 'Please wait…' : mode === 'signup' ? 'Create Client Account' : 'Sign In to My Music'}
        </button>
      </form>

      <p className="text-center text-[10px] leading-relaxed text-zinc-600">
        Your client account is separate from the studio engineer console.
      </p>
    </Shell>
  );
};

const inputClass = "w-full rounded-xl border border-zinc-800 bg-zinc-950 py-2.5 pl-9 pr-3 text-xs text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-emerald-500";

const Field: React.FC<{ icon: React.ReactNode; label: string; children: React.ReactNode }> = ({ icon, label, children }) => (
  <div>
    <label className="mb-1 block text-xs font-medium text-zinc-300">{label}</label>
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">{icon}</span>
      {children}
    </div>
  </div>
);

const Shell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-screen bg-[#09090b] px-4 py-10 text-zinc-100 font-sans">
    <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-md items-center">
      <div className="w-full space-y-6 rounded-[28px] border border-zinc-800 bg-zinc-900/80 p-6 shadow-2xl sm:p-8">
        {children}
        <div className="flex items-center justify-center gap-2 text-[10px] text-zinc-600">
          <ShieldCheck size={13} className="text-emerald-400" />
          Secure client account
        </div>
      </div>
    </div>
  </div>
);
