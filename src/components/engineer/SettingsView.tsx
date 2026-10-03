import React, { useState, useEffect } from 'react';
import { 
  CreditCard, 
  Sliders, 
  Save, 
  Check, 
  ShieldCheck, 
  HelpCircle,
  Building,
  DollarSign,
  Headphones,
  Download,
  FolderArchive,
  User,
  LogOut,
  KeyRound,
  Users
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { downloadProjectSourceZip } from '../../utils/exportSourceZip';
import { TeamMembersView } from './TeamMembersView';

export const SettingsView: React.FC = () => {
  const { engineer, updateEngineerProfile, user, organization, role, signOut } = useApp();

  const [activeSettingsTab, setActiveSettingsTab] = useState<'profile' | 'team'>(() => {
    return window.location.hash.includes('team') ? 'team' : 'profile';
  });

  useEffect(() => {
    const handleHash = () => {
      if (window.location.hash.includes('team')) {
        setActiveSettingsTab('team');
      } else if (window.location.hash.includes('settings')) {
        setActiveSettingsTab('profile');
      }
    };
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  const [name, setName] = useState(engineer.name);
  const [studioName, setStudioName] = useState(engineer.studioName);
  const [email, setEmail] = useState(engineer.email);
  const [phone, setPhone] = useState(engineer.phone);
  const [bio, setBio] = useState(engineer.bio);
  const [hourlyRate, setHourlyRate] = useState(engineer.hourlyRate);
  const [currency, setCurrency] = useState(engineer.currency);
  const [razorpayKeyId, setRazorpayKeyId] = useState(engineer.razorpayKeyId);
  const [stripeConnected, setStripeConnected] = useState(engineer.stripeConnected);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Sync state if engineer changes from Supabase load
  useEffect(() => {
    setName(engineer.name);
    setStudioName(engineer.studioName);
    setEmail(engineer.email);
    setPhone(engineer.phone);
    setBio(engineer.bio);
  }, [engineer.name, engineer.studioName, engineer.email, engineer.phone, engineer.bio]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateEngineerProfile({
      name,
      studioName,
      email,
      phone,
      bio,
      hourlyRate,
      currency,
      razorpayKeyId,
      stripeConnected
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const roleDisplay = role ? (role.charAt(0).toUpperCase() + role.slice(1)) : 'Owner';

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="border-b border-zinc-800 pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Studio Settings</h1>
          <p className="text-xs text-zinc-400 mt-1">
            Manage your organization membership, studio profile, and payment settings.
          </p>
        </div>

        <button
          type="button"
          onClick={signOut}
          className="self-start sm:self-auto flex items-center gap-1.5 px-3.5 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl text-xs font-semibold transition-colors"
        >
          <LogOut size={14} />
          <span>Sign Out of Supabase</span>
        </button>
      </div>

      {/* Settings Sub-Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-800 pb-2">
        <button
          type="button"
          onClick={() => {
            setActiveSettingsTab('profile');
            window.location.hash = '#/settings';
          }}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
            activeSettingsTab === 'profile'
              ? 'bg-zinc-800 text-white shadow-sm'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
          }`}
        >
          <Building size={14} className={activeSettingsTab === 'profile' ? 'text-emerald-400' : 'text-zinc-500'} />
          <span>Studio Profile & Billing</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveSettingsTab('team');
            window.location.hash = '#/settings/team';
          }}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
            activeSettingsTab === 'team'
              ? 'bg-zinc-800 text-white shadow-sm'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
          }`}
        >
          <Users size={14} className={activeSettingsTab === 'team' ? 'text-emerald-400' : 'text-zinc-500'} />
          <span>Team Members</span>
        </button>
      </div>

      {activeSettingsTab === 'team' ? (
        <TeamMembersView />
      ) : (
        <>
          {/* Supabase Account & Organization Context Card */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <ShieldCheck size={16} className="text-emerald-400" />
            <span>Supabase Authenticated Identity & Organization</span>
          </div>
          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
            ACTIVE SESSION
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="bg-zinc-950 p-3.5 rounded-xl border border-zinc-800 space-y-1">
            <span className="text-zinc-500 text-[10px] uppercase font-mono block">Organization / Workspace</span>
            <span className="font-bold text-white text-sm block truncate">{organization?.name || 'Studio'}</span>
            <span className="text-[10px] font-mono text-zinc-400 block truncate">Slug: {organization?.slug || 'n/a'}</span>
          </div>

          <div className="bg-zinc-950 p-3.5 rounded-xl border border-zinc-800 space-y-1">
            <span className="text-zinc-500 text-[10px] uppercase font-mono block">Membership Role</span>
            <span className="font-bold text-emerald-400 text-sm block">{roleDisplay}</span>
            <span className="text-[10px] text-zinc-400 block">Root organization member</span>
          </div>

          <div className="bg-zinc-950 p-3.5 rounded-xl border border-zinc-800 space-y-1">
            <span className="text-zinc-500 text-[10px] uppercase font-mono block">Auth Account ID</span>
            <span className="font-mono text-zinc-300 text-xs block truncate">{user?.id || 'n/a'}</span>
            <span className="text-[10px] text-zinc-400 block truncate">{user?.email}</span>
          </div>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6 text-xs">
        {/* Studio Identity Card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
          <h3 className="font-bold text-sm text-zinc-100 flex items-center gap-2">
            <Building size={16} className="text-emerald-400" />
            <span>Engineer Profile & Studio Identity</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-zinc-300 mb-1">Your Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-200 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-zinc-300 mb-1">Studio / Brand Name</label>
              <input
                type="text"
                value={studioName}
                onChange={(e) => setStudioName(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-200 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-zinc-300 mb-1">Studio Contact Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-200 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-zinc-300 mb-1">Phone / WhatsApp for Clients</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-200 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-zinc-300 mb-1">Studio Bio & Credits</label>
            <textarea
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-200 focus:outline-none focus:border-emerald-500 leading-relaxed"
            />
          </div>
        </div>

        {/* Payments & Razorpay / Stripe Gateway Abstraction */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-zinc-100 flex items-center gap-2">
              <CreditCard size={16} className="text-emerald-400" />
              <span>Payment Gateway Integration</span>
            </h3>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              SECURE PROVIDER ABSTRACTION
            </span>
          </div>

          <p className="text-zinc-400 leading-relaxed">
            MixFlow natively supports <strong>Razorpay</strong> (for UPI, Netbanking & Cards in INR/USD) as well as <strong>Stripe Connect</strong>. Clients settle balance invoices directly from their review link without an account.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-zinc-300 mb-1">Primary Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as any)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-200 focus:outline-none focus:border-emerald-500"
              >
                <option value="USD">USD ($) - United States Dollar</option>
                <option value="INR">INR (₹) - Indian Rupee (Razorpay Optimized)</option>
                <option value="EUR">EUR (€) - Euro</option>
                <option value="GBP">GBP (£) - British Pound</option>
              </select>
            </div>

            <div>
              <label className="block text-zinc-300 mb-1">Standard Hourly Rate</label>
              <input
                type="number"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(Number(e.target.value))}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-200 focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-zinc-300 mb-1">Razorpay API Key ID (Live / Test)</label>
              <input
                type="text"
                placeholder="rzp_live_..."
                value={razorpayKeyId}
                onChange={(e) => setRazorpayKeyId(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-200 focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>
          </div>

          {/* Stripe Toggle */}
          <div className="pt-3 border-t border-zinc-800 flex items-center justify-between">
            <div>
              <span className="font-semibold text-zinc-200 block">Stripe Connect Fallback</span>
              <span className="text-zinc-500">Allow international credit cards through Stripe checkout</span>
            </div>
            <button
              type="button"
              onClick={() => setStripeConnected(!stripeConnected)}
              className={`w-11 h-6 rounded-full transition-colors relative ${
                stripeConnected ? 'bg-emerald-500' : 'bg-zinc-800'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-black transition-transform absolute top-1 ${
                  stripeConnected ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Audio Delivery Standards */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
          <h3 className="font-bold text-sm text-zinc-100 flex items-center gap-2">
            <Headphones size={16} className="text-emerald-400" />
            <span>Master File Delivery Presets</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-zinc-300">
            <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800">
              <span className="text-[10px] text-zinc-400 block font-mono">STREAMING MASTER</span>
              <span className="font-bold text-white text-sm">24-bit / 48kHz</span>
              <p className="text-[10px] text-zinc-400 mt-1">-14.0 LUFS integrated</p>
            </div>

            <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800">
              <span className="text-[10px] text-zinc-400 block font-mono">CLUB / DJ MASTER</span>
              <span className="font-bold text-white text-sm">24-bit / 48kHz</span>
              <p className="text-[10px] text-zinc-400 mt-1">-8.0 to -9.5 LUFS</p>
            </div>

            <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800">
              <span className="text-[10px] text-zinc-400 block font-mono">VINYL / ARCHIVE</span>
              <span className="font-bold text-white text-sm">24-bit / 96kHz</span>
              <p className="text-[10px] text-zinc-400 mt-1">Uncompressed true peak</p>
            </div>
          </div>
        </div>

        {/* Project Source Code Export */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-zinc-100 flex items-center gap-2">
              <FolderArchive size={16} className="text-emerald-400" />
              <span>Full Codebase Export</span>
            </h3>
            <span className="text-[10px] font-mono text-zinc-400 bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800">
              STANDALONE ZIP BUNDLE
            </span>
          </div>

          <p className="text-zinc-400 leading-relaxed">
            Download the complete MixFlow source code (all components, styles, TypeScript types, audio engine, and configuration files) packaged as a clean, ready-to-run project.
          </p>

          <div className="pt-2">
            <button
              type="button"
              onClick={downloadProjectSourceZip}
              className="flex items-center gap-2 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-bold rounded-xl text-xs transition-colors border border-zinc-700 shadow-sm"
            >
              <Download size={15} className="text-emerald-400" />
              <span>Download Complete Codebase (.ZIP)</span>
            </button>
          </div>
        </div>

        {/* Save Bar */}
        <div className="flex items-center justify-between pt-2">
          {savedSuccess && (
            <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
              <Check size={16} /> Studio preferences saved!
            </span>
          )}
          {!savedSuccess && <div />}

          <button
            type="submit"
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl text-xs transition-colors shadow-lg shadow-emerald-500/10"
          >
            <Save size={15} />
            <span>Save Settings</span>
          </button>
        </div>
      </form>
      </>
      )}
    </div>
  );
};
