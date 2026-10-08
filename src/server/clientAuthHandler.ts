import { createClient } from '@supabase/supabase-js';

export interface ClientAuthHandlerContext {
  body?: {
    fullName?: string;
    email?: string;
    password?: string;
  };
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
}

export async function handleClientSignup(
  ctx: ClientAuthHandlerContext
): Promise<{ status: number; body: any }> {
  const fullName = String(ctx.body?.fullName || '').trim();
  const email = String(ctx.body?.email || '').trim().toLowerCase();
  const password = String(ctx.body?.password || '');

  if (!fullName) {
    return { status: 400, body: { error: 'Full name is required.' } };
  }
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    return { status: 400, body: { error: 'Enter a valid email address.' } };
  }
  if (password.length < 6) {
    return { status: 400, body: { error: 'Password must be at least 6 characters.' } };
  }
  if (!ctx.supabaseUrl || !ctx.supabaseServiceRoleKey) {
    console.error('[MixFlow Client Auth] Missing Supabase server credentials.');
    return { status: 500, body: { error: 'Client account service is not configured.' } };
  }

  const adminClient = createClient(ctx.supabaseUrl, ctx.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      account_type: 'client',
    },
  });

  if (error || !data.user) {
    console.error('[MixFlow Client Auth] Client signup failed:', error?.message || 'No user returned.');
    const message = error?.message || '';
    if (/already registered|already exists/i.test(message)) {
      return { status: 409, body: { error: 'An account with this email already exists. Please sign in instead.' } };
    }
    return { status: 400, body: { error: message || 'Unable to create your client account.' } };
  }

  return {
    status: 201,
    body: {
      success: true,
      user: {
        id: data.user.id,
        email: data.user.email,
        full_name: fullName,
      },
    },
  };
}
