import React, { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { ClientAudioReviewView } from './ClientAudioReviewView';

export const PublicReviewView: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

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

    return () => { cancelled = true; };
  }, [projectId, songId, token]);

  const openClientAccount = () => {
    window.location.href = '/?client=1';
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
          <>
            <ClientAudioReviewView
              projectId={data.project.id}
              songs={[data.song]}
              initialSongId={data.song.id}
              publicReviewToken={token}
            />

            <section className="max-w-2xl mx-auto mt-6 rounded-3xl border border-zinc-800 bg-zinc-900 p-6 sm:p-8 shadow-2xl">
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 shrink-0 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <CheckCircle2 size={22} />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-white">Want to keep your projects in one place?</h2>
                  <p className="text-sm text-zinc-400 mt-1 leading-relaxed">
                    Create your free MixFlow client account. After signing in, your engineer can give you a unique Project Code to add this and future projects to My Music.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={openClientAccount}
                className="mt-6 w-full sm:w-auto px-5 py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm rounded-xl inline-flex items-center justify-center gap-2 transition"
              >
                Create Client Account
                <ArrowRight size={15} />
              </button>
              <p className="mt-3 text-[11px] text-zinc-500">
                Email + password. No Magic Link required.
              </p>
            </section>
          </>
        )}
      </main>
    </div>
  );
};
