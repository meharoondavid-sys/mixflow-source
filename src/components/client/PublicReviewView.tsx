import React, { useEffect, useState } from 'react';
import { Mail, ArrowRight, CheckCircle2 } from 'lucide-react';
import { getSupabase } from '../../lib/supabase';
import { AlertCircle, Loader2 } from 'lucide-react';
import { ClientAudioReviewView } from './ClientAudioReviewView';

export const PublicReviewView: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAccountOffer, setShowAccountOffer] = useState(false);
  const [accountEmail, setAccountEmail] = useState('');
  const [accountLoading, setAccountLoading] = useState(false);
  const [accountSent, setAccountSent] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);

  const hash = window.location.hash;
  const match = hash.match(/^#\/?review\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_-]+)\?token=([^&]+)/);
  const projectId = match?.[1] || null;
  const songId = match?.[2] || null;
  const token = match?.[3] ? decodeURIComponent(match[3]) : null;

  useEffect(() => {
    if (!projectId || !songId || !token) {
      setError('This review link is incomplete or invalid.');
      return;
    }

    let cancelled = false;
    setError(null);
    setData(null);

    fetch(`/api/public-review/${projectId}/${songId}?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(payload.error || 'This review link is invalid or unavailable.');
        return payload;
      })
      .then((payload) => {
        if (!cancelled) setData(payload);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Unable to load this review.');
      });

    return () => {
      cancelled = true;
    };
  }, [projectId, songId, token]);

  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = accountEmail.trim().toLowerCase();
    if (!email) {
      setAccountError('Please enter your email address.');
      return;
    }

    setAccountLoading(true);
    setAccountError(null);

    try {
      localStorage.setItem('mixflow_client_claim', JSON.stringify({
        projectId,
        songId,
        token,
        createdAt: Date.now(),
      }));

      const { error: otpError } = await getSupabase().auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: window.location.origin,
          data: {
            account_type: 'client',
          },
        },
      });

      if (otpError) {
        localStorage.removeItem('mixflow_client_claim');
        throw otpError;
      }

      setAccountSent(true);
    } catch (err: any) {
      setAccountError(err?.message || 'We could not send the secure sign-in link. Please try again.');
    } finally {
      setAccountLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-emerald-500 selection:text-black">
      <header className="border-b border-zinc-800/80 bg-zinc-950/95">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div>
            <div className="text-sm font-bold tracking-tight text-white">MixFlow</div>
            <div className="text-[10px] text-zinc-500 mt-0.5">Client Mix Review</div>
          </div>
          <div className="text-[10px] text-zinc-500">Secure review link</div>
        </div>
      </header>

      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-8">
        {!projectId || !songId || !token ? (
          <div className="max-w-xl mx-auto py-20 text-center">
            <AlertCircle className="mx-auto text-red-400 mb-3" size={28} />
            <h1 className="text-lg font-bold text-white">Review link unavailable</h1>
            <p className="text-sm text-zinc-400 mt-2">{error}</p>
          </div>
        ) : !data && !error ? (
          <div className="max-w-xl mx-auto py-20 text-center text-zinc-400">
            <Loader2 className="mx-auto mb-3 animate-spin text-emerald-400" size={28} />
            <p className="text-sm">Loading your mix review…</p>
          </div>
        ) : error ? (
          <div className="max-w-xl mx-auto bg-zinc-900 border border-red-900/50 rounded-3xl p-8 text-center">
            <AlertCircle className="mx-auto text-red-400 mb-3" size={28} />
            <h1 className="text-lg font-bold text-white">Review link unavailable</h1>
            <p className="text-sm text-zinc-400 mt-2">{error}</p>
          </div>
        ) : (
          <ClientAudioReviewView
            projectId={data.project.id}
            songs={[data.song]}
            initialSongId={data.song.id}
            publicReviewToken={token}
            onProjectApproved={() => setShowAccountOffer(true)}
          />
          {showAccountOffer && (
            <section className="max-w-2xl mx-auto mt-6 bg-zinc-900 border border-emerald-500/25 rounded-3xl p-6 sm:p-8 shadow-2xl">
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 shrink-0 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <CheckCircle2 size={22} />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-white">Your project is approved.</h2>
                  <p className="text-sm text-zinc-400 mt-1 leading-relaxed">
                    Save it to your MixFlow Library so you can find this project again — and keep future projects from any engineer in one place.
                  </p>
                </div>
              </div>

              {accountSent ? (
                <div className="mt-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5">
                  <p className="text-sm font-semibold text-emerald-300">Check your email.</p>
                  <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                    We sent you a secure MixFlow sign-in link. Open it and we'll save this project to your library automatically.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSaveProject} className="mt-6 space-y-3">
                  <label className="block text-xs font-semibold text-zinc-300">Email address</label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="relative flex-1">
                      <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                      <input
                        type="email"
                        required
                        value={accountEmail}
                        onChange={(e) => setAccountEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="w-full pl-9 pr-3 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={accountLoading}
                      className="px-5 py-3 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-bold text-sm rounded-xl flex items-center justify-center gap-2 transition"
                    >
                      <span>{accountLoading ? 'Sending…' : 'Save My Project'}</span>
                      {!accountLoading && <ArrowRight size={15} />}
                    </button>
                  </div>
                  {accountError && <p className="text-xs text-red-400">{accountError}</p>}
                  <p className="text-[11px] text-zinc-500">
                    No password to remember. We'll send a secure sign-in link to your email.
                  </p>
                </form>
              )}
            </section>
          )}
        )}
      </main>
    </div>
  );
};
