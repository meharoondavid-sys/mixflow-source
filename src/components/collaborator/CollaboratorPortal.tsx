import React, { useEffect, useState } from 'react';
import { Music, Upload, MessageSquare, Play, Download, Clock3, LogOut } from 'lucide-react';

type Props = { token: string };

async function call(path: string, body: any) {
  const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export const CollaboratorPortal: React.FC<Props> = ({ token }) => {
  const [session, setSession] = useState<any>(null);
  const [projectId, setProjectId] = useState('');
  const [files, setFiles] = useState<any[]>([]);
  const [versions, setVersions] = useState<any[]>([]);
  const [feedback, setFeedback] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [comment, setComment] = useState('');
  const [timestamp, setTimestamp] = useState('0');
  const [selectedVersion, setSelectedVersion] = useState<any>(null);

  const load = async (s: any, pid: string) => {
    const base = { sessionToken: s.session_token, projectId: pid };
    const [f, v, fb] = await Promise.all([
      call('/api/collaborators/project/files', base),
      call('/api/collaborators/project/versions', base),
      call('/api/collaborators/project/feedback', base),
    ]);
    setFiles(f.files || []);
    setVersions(v.versions || []);
    setFeedback(fb.feedback || []);
  };

  useEffect(() => {
    (async () => {
      try {
        setBusy(true);
        const accepted = await call('/api/collaborators/invites/accept', { inviteToken: token });
        setSession(accepted);
        const pid = accepted.collaborator.project_id;
        setProjectId(pid);
        await load(accepted, pid);
      } catch (e: any) {
        setError(e.message || 'This collaborator link is invalid or expired.');
      } finally { setBusy(false); }
    })();
  }, [token]);

  const play = async (versionId: string) => {
    try {
      const data = await call('/api/collaborators/project/playback', { sessionToken: session.session_token, projectId, versionId });
      const audio = new Audio(data.signedUrl);
      await audio.play();
    } catch (e: any) { setError(e.message); }
  };

  const sendFeedback = async () => {
    if (!comment.trim() || !selectedVersion) return;
    try {
      await call('/api/collaborators/project/feedback', {
        action: 'create',
        sessionToken: session.session_token,
        projectId,
        versionId: selectedVersion.id,
        timestampSeconds: Number(timestamp) || 0,
        comment,
      });
      setComment('');
      const data = await call('/api/collaborators/project/feedback', { sessionToken: session.session_token, projectId });
      setFeedback(data.feedback || []);
    } catch (e: any) { setError(e.message); }
  };

  const uploadVersion = async (file: File) => {
    if (session?.collaborator?.role !== 'contributor') return;
    try {
      setBusy(true);
      const url = await call('/api/collaborators/project/version-upload-url', {
        sessionToken: session.session_token, projectId, fileName: file.name, fileType: file.type || 'audio/wav', fileSize: file.size,
      });
      const upload = await fetch(url.signedUrl, { method: 'PUT', headers: { 'Content-Type': file.type || 'audio/wav' }, body: file });
      if (!upload.ok) throw new Error('Upload failed.');
      await call('/api/collaborators/project/version-confirm', {
        sessionToken: session.session_token, projectId, versionId: url.versionId, storagePath: url.storagePath,
        fileName: file.name, fileType: file.type || 'audio/wav', fileSize: file.size,
      });
      await load(session, projectId);
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };

  if (busy && !session) return <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center"><div className="text-sm text-zinc-400">Opening MixFlow project…</div></div>;

  if (error && !session) return <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-6"><div className="max-w-md w-full rounded-3xl border border-red-500/20 bg-zinc-900 p-6"><h1 className="text-lg font-bold">Collaborator link unavailable</h1><p className="mt-2 text-sm text-zinc-400">{error}</p></div></div>;

  return (
    <div className="min-h-screen bg-zinc-950 text-white pb-10">
      <header className="border-b border-zinc-800 bg-zinc-950/95 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-5 py-4 flex items-center justify-between">
          <div><div className="text-emerald-400 text-xs font-semibold tracking-wider">MIXFLOW</div><h1 className="font-bold text-lg">Collaborator Workspace</h1></div>
          <div className="text-right"><div className="text-sm">{session?.collaborator?.name || 'Collaborator'}</div><div className="text-xs text-zinc-500 capitalize">{session?.collaborator?.role}</div></div>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-5 py-6 space-y-5">
        {error && <div className="rounded-xl border border-red-500/20 bg-red-950/30 p-3 text-sm text-red-300">{error}</div>}
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="flex items-center gap-2 mb-4"><Music size={18} className="text-emerald-400"/><h2 className="font-semibold">Project Files</h2></div>
          <div className="space-y-2">{files.length ? files.map(f => <div key={f.id} className="flex items-center justify-between gap-3 border border-zinc-800 rounded-xl p-3"><div><div className="text-sm font-medium">{f.name}</div><div className="text-xs text-zinc-500">{f.file_type}</div></div><button onClick={async()=>{try{const d=await call('/api/collaborators/project/file-download',{sessionToken:session.session_token,projectId,fileId:f.id});window.open(d.signedUrl,'_blank');}catch(e:any){setError(e.message)}}} className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700"><Download size={16}/></button></div>) : <p className="text-sm text-zinc-500">No project files yet.</p>}</div>
        </section>
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="flex items-center gap-2 mb-4"><Play size={18} className="text-emerald-400"/><h2 className="font-semibold">Mix Versions</h2></div>
          <div className="space-y-2">{versions.length ? versions.map(v => <div key={v.id} className="border border-zinc-800 rounded-xl p-3 flex items-center justify-between gap-3"><div><div className="text-sm font-medium">V{v.version_number} — {v.name}</div><div className="text-xs text-zinc-500">{v.file_type}</div></div><div className="flex gap-2"><button onClick={()=>setSelectedVersion(v)} className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700"><MessageSquare size={16}/></button><button onClick={()=>play(v.id)} className="p-2 rounded-lg bg-emerald-500 text-black hover:bg-emerald-400"><Play size={16}/></button></div></div>) : <p className="text-sm text-zinc-500">No mix versions yet.</p>}</div>
        </section>
        {selectedVersion && <section className="rounded-2xl border border-emerald-500/20 bg-zinc-900 p-5">
          <h2 className="font-semibold">Feedback on V{selectedVersion.version_number}</h2>
          <div className="mt-3 space-y-2 max-h-64 overflow-auto">{feedback.filter(f=>f.version_id===selectedVersion.id).map(f=><div key={f.id} className="rounded-xl bg-zinc-800 p-3"><div className="text-xs text-emerald-400">{Math.floor(Number(f.timestamp_seconds)/60)}:{String(Math.floor(Number(f.timestamp_seconds)%60)).padStart(2,'0')}</div><div className="text-sm mt-1">{f.comment}</div></div>)}</div>
          <div className="mt-4 grid grid-cols-[90px_1fr] gap-2"><input value={timestamp} onChange={e=>setTimestamp(e.target.value)} type="number" min="0" className="rounded-xl bg-zinc-950 border border-zinc-700 px-3 py-2 text-sm"/><input value={comment} onChange={e=>setComment(e.target.value)} placeholder="Leave timestamped feedback…" className="rounded-xl bg-zinc-950 border border-zinc-700 px-3 py-2 text-sm"/></div>
          <button onClick={sendFeedback} className="mt-2 px-4 py-2 rounded-xl bg-emerald-500 text-black text-sm font-semibold">Send feedback</button>
        </section>}
        {session?.collaborator?.role === 'contributor' && <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="flex items-center gap-2 mb-4"><Upload size={18} className="text-emerald-400"/><h2 className="font-semibold">Upload New Mix</h2></div>
          <input type="file" accept="audio/*,.wav,.mp3,.aiff,.flac" onChange={e=>e.target.files?.[0] && uploadVersion(e.target.files[0])} className="block w-full text-sm text-zinc-400"/>
          <p className="text-xs text-zinc-500 mt-2">Upload a new working version. Final delivery remains controlled by the studio.</p>
        </section>}
      </main>
    </div>
  );
};
