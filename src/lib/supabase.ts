import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Default project URL and publishable anon key from project configuration
const DEFAULT_SUPABASE_URL = 'https://amgowwvresmsysofwqsp.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_8uYzlSxXc0IBIm4a4_DTkA_h1TJcZGV';

// Get env values
export const getSupabaseUrl = (): string => {
  return (
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) ||
    (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) ||
    DEFAULT_SUPABASE_URL
  );
};

export const getSupabaseAnonKey = (): string => {
  const envKey =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) ||
    (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_ANON_KEY);
  if (envKey && envKey.trim() !== '' && envKey !== 'YOUR_SUPABASE_ANON_KEY') {
    return envKey.trim();
  }
  // Check session storage in case entered in UI
  const sessionKey = typeof window !== 'undefined' ? window.sessionStorage.getItem('mixflow_anon_key') : null;
  if (sessionKey && sessionKey.trim() !== '') {
    return sessionKey.trim();
  }
  return DEFAULT_SUPABASE_ANON_KEY;
};

let supabaseInstance: SupabaseClient | null = null;

export const getSupabase = (): SupabaseClient => {
  const url = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();

  if (!supabaseInstance) {
    supabaseInstance = createClient(url, anonKey || 'placeholder-anon-key', {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
  return supabaseInstance;
};

export const reinitializeSupabase = (newAnonKey: string): SupabaseClient => {
  if (typeof window !== 'undefined') {
    window.sessionStorage.setItem('mixflow_anon_key', newAnonKey);
  }
  const url = getSupabaseUrl();
  supabaseInstance = createClient(url, newAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return supabaseInstance;
};

export const supabase = getSupabase();
