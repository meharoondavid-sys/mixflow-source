import React, { useState } from 'react';
import {
  Bell,
  ChevronRight,
  Clock3,
  Download,
  FileAudio,
  FolderOpen,
  LogOut,
  Music2,
  Play,
  Search,
  Sparkles,
  User,
  X,
} from 'lucide-react';

const demoProjects = [
  { id: '1', name: 'Shukriya Kaise Karun', type: 'Single', status: 'In Review', tracks: 1, files: 4, updated: 'Updated today', tone: 'from-violet-500/25 via-fuchsia-500/10 to-zinc-900' },
  { id: '2', name: 'Sunday Worship EP', type: 'EP', status: 'In Production', tracks: 5, files: 12, updated: 'Updated yesterday', tone: 'from-blue-500/25 via-cyan-500/10 to-zinc-900' },
  { id: '3', name: 'Live Sessions Vol. 1', type: 'Album', status: 'Completed', tracks: 8, files: 24, updated: 'Completed Sep 28', tone: 'from-emerald-500/25 via-teal-500/10 to-zinc-900' },
];

const Status = ({ children }: { children: string }) => (
  <span className={
    children === 'In Review'
      ? 'inline-flex items-center gap-1.5 rounded-full border border-amber-400/20 bg-amber-400/10 px-2.5 py-1 text-[11px] font-semibold text-amber-300'
      : children === 'Completed'
        ? 'inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300'
        : 'inline-flex items-center gap-1.5 rounded-full border border-blue-400/20 bg-blue-400/10 px-2.5 py-1 text-[11px] font-semibold text-blue-300'
  }>
    <span className="h-1.5 w-1.5 rounded-full bg-current" />
    {children}
  </span>
);

export const ClientPortalPreview: React.FC = () => {
  const [selectedProject, setSelectedProject] = useState<typeof demoProjects[number] | null>(null);
  const [query, setQuery] = useState('');

  const projects = demoProjects.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()));

  if (selectedProject) {
    return (
      <div className="min-h-screen bg-[#09090b] text-zinc-100 font-sans">
        <PreviewHeader onHome={() => setSelectedProject(null)} />
        <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
          <button onClick={() => setSelectedProject(null)} className="mb-6 inline-flex items-center gap-2 text-xs font-semibold text-zinc-500 hover:text-white">
            ← Back to My Music
          </button>

          <section className="overflow-hidden rounded-[28px] border border-zinc-800/80 bg-zinc-900/60 shadow-2xl">
            <div className={`bg-gradient-to-br ${selectedProject.tone} p-7 sm:p-9`}>
              <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className="mb-3 flex items-center gap-2">
                    <span className="rounded-md border border-white/10 bg-black/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-300">{selectedProject.type}</span>
                    <Status>{selectedProject.status}</Status>
                  </div>
                  <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">{selectedProject.name}</h1>
                  <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-400">Your production workspace for mixes, revisions, approvals and final delivery.</p>
                </div>
                <button className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-zinc-950 shadow-lg hover:bg-zinc-100">
                  <Play size={14} fill="currentColor" /> Open Review
                </button>
              </div>
            </div>

            <div className="grid gap-4 p-5 sm:grid-cols-3 sm:p-7">
              <InfoCard label="Tracks" value={String(selectedProject.tracks)} icon={<Music2 size={16} />} />
              <InfoCard label="Files" value={String(selectedProject.files)} icon={<FileAudio size={16} />} />
              <InfoCard label="Last activity" value={selectedProject.updated} icon={<Clock3 size={16} />} />
            </div>
          </section>

          <div className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
            <section className="rounded-[24px] border border-zinc-800 bg-zinc-900/45 p-5 sm:p-6">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-white">Your music</h2>
                  <p className="mt-1 text-xs text-zinc-500">Latest versions available for this project.</p>
                </div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">3 versions</span>
              </div>
              <div className="space-y-2">
                {['Mix 03 — Client Review', 'Mix 02 — Revision', 'Mix 01 — First Mix'].map((v, i) => (
                  <div key={v} className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-950/60 p-3.5">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-900 text-emerald-400"><Play size={14} fill="currentColor" /></div>
                      <div className="min-w-0"><p className="truncate text-xs font-semibold text-zinc-200">{v}</p><p className="mt-0.5 text-[10px] text-zinc-600">{i === 0 ? 'Available now' : 'Previous version'}</p></div>
                    </div>
                    <button className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-800 hover:text-white"><Download size={14} /></button>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[24px] border border-zinc-800 bg-zinc-900/45 p-5 sm:p-6">
              <h2 className="text-sm font-bold text-white">Project timeline</h2>
              <div className="mt-5 space-y-5">
                {[
                  ['Today', 'Latest mix uploaded', 'Your engineer shared a new version for review.'],
                  ['Yesterday', 'Revision requested', 'Your feedback was received.'],
                  ['Sep 28', 'Project started', 'Your project was added to MixFlow.'],
                ].map(([date, title, copy]) => (
                  <div key={title} className="relative pl-6">
                    <span className="absolute left-0 top-1.5 h-2 w-2 rounded-full bg-emerald-400" />
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">{date}</p>
                    <p className="mt-1 text-xs font-semibold text-zinc-200">{title}</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">{copy}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 font-sans">
      <PreviewHeader onHome={() => setSelectedProject(null)} />
      <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
        <section className="relative overflow-hidden rounded-[30px] border border-zinc-800 bg-gradient-to-br from-zinc-900 via-zinc-900/80 to-zinc-950 p-7 sm:p-10">
          <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
              <Sparkles size={12} /> Your music, one place
            </div>
            <h1 className="mt-5 max-w-2xl text-3xl font-bold tracking-tight text-white sm:text-4xl">Welcome back, Sarah.</h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-400">Keep track of your productions, review new mixes, send files and download finished music — without the studio jargon.</p>
          </div>
        </section>

        <section className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric label="Active projects" value="2" />
          <Metric label="Needs review" value="1" accent />
          <Metric label="Completed" value="1" />
          <Metric label="Total tracks" value="14" />
        </section>

        <section className="mt-8">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div><h2 className="text-lg font-bold text-white">My Music</h2><p className="mt-1 text-xs text-zinc-500">Your projects, mixes, masters and delivered files.</p></div>
            <div className="relative w-full sm:w-64">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search your music..." className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-9 py-2.5 text-xs text-white outline-none placeholder:text-zinc-600 focus:border-emerald-500/50" />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <button key={project.id} onClick={() => setSelectedProject(project)} className="group overflow-hidden rounded-[24px] border border-zinc-800 bg-zinc-900/60 text-left transition hover:-translate-y-0.5 hover:border-zinc-700 hover:bg-zinc-900">
                <div className={`relative h-36 bg-gradient-to-br ${project.tone}`}>
                  <div className="absolute inset-0 flex items-center justify-center"><div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-black/20 text-white/80 backdrop-blur"><Music2 size={28} /></div></div>
                  <div className="absolute left-4 top-4"><Status>{project.status}</Status></div>
                </div>
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-bold text-white group-hover:text-emerald-300">{project.name}</h3><p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">{project.type}</p></div><ChevronRight size={16} className="mt-1 text-zinc-600 transition group-hover:translate-x-0.5 group-hover:text-zinc-300" /></div>
                  <div className="mt-5 flex items-center gap-4 border-t border-zinc-800/70 pt-4 text-[10px] text-zinc-500"><span>{project.tracks} {project.tracks === 1 ? 'track' : 'tracks'}</span><span>{project.files} files</span><span>{project.updated}</span></div>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="mt-8 grid gap-4 lg:grid-cols-2">
          <div className="rounded-[24px] border border-amber-400/15 bg-amber-400/[0.035] p-5">
            <div className="flex items-start gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-400/10 text-amber-300"><Play size={15} /></div><div><p className="text-xs font-bold text-white">1 project needs your attention</p><p className="mt-1 text-[11px] leading-relaxed text-zinc-500">Shukriya Kaise Karun has a new mix ready for your review.</p><button onClick={() => setSelectedProject(demoProjects[0])} className="mt-3 text-[11px] font-bold text-amber-300 hover:text-amber-200">Review mix →</button></div></div>
          </div>
          <div className="rounded-[24px] border border-zinc-800 bg-zinc-900/45 p-5">
            <div className="flex items-start gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-800 text-zinc-300"><FolderOpen size={15} /></div><div><p className="text-xs font-bold text-white">Everything stays here</p><p className="mt-1 text-[11px] leading-relaxed text-zinc-500">Projects from different engineers can live in the same My Music library.</p></div></div>
          </div>
        </section>
      </main>
    </div>
  );
};

const PreviewHeader = ({ onHome }: { onHome: () => void }) => (
  <header className="sticky top-0 z-40 border-b border-zinc-900 bg-[#09090b]/90 backdrop-blur-xl">
    <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
      <button onClick={onHome} className="flex items-center gap-2.5 text-left">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-300"><Music2 size={18} /></div>
        <div><div className="text-sm font-bold tracking-tight text-white">MixFlow</div><div className="text-[9px] font-semibold uppercase tracking-wider text-zinc-600">My Music</div></div>
      </button>
      <div className="flex items-center gap-2">
        <button className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white"><Bell size={15} /><span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-emerald-400" /></button>
        <div className="hidden items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/70 px-2.5 py-1.5 sm:flex"><div className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-800 text-zinc-400"><User size={14} /></div><div><p className="text-[11px] font-semibold text-zinc-200">Sarah David</p><p className="text-[9px] text-zinc-600">Client account</p></div></div>
        <button className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-500 hover:text-white" title="Sign out"><LogOut size={14} /></button>
      </div>
    </div>
  </header>
);

const Metric = ({ label, value, accent }: { label: string; value: string; accent?: boolean }) => (
  <div className={`rounded-2xl border p-4 ${accent ? 'border-amber-400/15 bg-amber-400/[0.035]' : 'border-zinc-800 bg-zinc-900/45'}`}>
    <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">{label}</p>
    <p className={`mt-2 text-2xl font-bold ${accent ? 'text-amber-300' : 'text-white'}`}>{value}</p>
  </div>
);

const InfoCard = ({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) => (
  <div className="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-4"><div className="flex items-center gap-2 text-zinc-600">{icon}<span className="text-[10px] font-semibold uppercase tracking-wider">{label}</span></div><p className="mt-2 text-sm font-semibold text-zinc-200">{value}</p></div>
);
