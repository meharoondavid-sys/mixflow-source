import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { getSupabase, reinitializeSupabase, getSupabaseAnonKey } from '../lib/supabase';
import { 
  AuthContextType, 
  UserProfile, 
  Organization, 
  OrganizationRole,
  AuthDiagnosticError,
  SignUpResult
} from '../types/auth';

const AuthContext = createContext<AuthContextType | null>(null);

// Helper to extract actionable structured diagnostic information for debugging
function extractDiagnostic(
  operation: AuthDiagnosticError['operation'],
  error: any
): AuthDiagnosticError {
  return {
    operation,
    message: error?.message || 'Unknown database operation error',
    code: error?.code || (error?.status ? String(error.status) : error?.name || 'UNKNOWN_ERROR'),
    details: error?.details || null,
    hint: error?.hint || null,
    status: error?.status || null,
  };
}

// Helper to generate a clean URL-friendly unique slug safely
function generateSlug(name: string): string {
  const clean = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const base = clean.slice(0, 32) || 'studio';
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  return `${base}-${randomSuffix}`;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [role, setRole] = useState<OrganizationRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [provisioning, setProvisioning] = useState(false);
  const [provisioningError, setProvisioningError] = useState<string | null>(null);
  const [pendingConfirmationEmail, setPendingConfirmationEmail] = useState<string | null>(null);
  const [anonKey, setAnonKey] = useState<string>(getSupabaseAnonKey());

  const isConfigured = Boolean(anonKey && anonKey.trim() !== '');

  // Concurrency guard ref to prevent parallel duplicate execution
  const inFlightProvisioningRef = useRef<Promise<void> | null>(null);

  // Fetch profile, organization, and membership for a given user (fully idempotent & deterministic)
  const loadUserEntities = useCallback(async (userId: string) => {
    // If a load/provisioning is already in flight, await it to prevent race conditions
    if (inFlightProvisioningRef.current) {
      await inFlightProvisioningRef.current;
      return;
    }

    const run = async () => {
      const supabase = getSupabase();
      setProvisioningError(null);

      try {
        // 1. Fetch Profile
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();

        if (profileError) {
          console.warn('[MixFlow] Profile fetch notice:', profileError.message);
        }
        setProfile(profileData || null);

        let activeOrg: Organization | null = null;
        let activeRole: OrganizationRole | null = null;

        // 2. Query user's existing organization memberships
        const { data: memberRows, error: memberError } = await supabase
          .from('organization_members')
          .select('organization_id, role, created_at')
          .eq('user_id', userId);

        if (memberError) {
          console.warn('[MixFlow] Organization members notice:', memberError.message);
        }

        if (memberRows && memberRows.length > 0) {
          const orgIds = memberRows.map((m) => m.organization_id);
          // Deterministic lookup: order by created_at ascending, use the oldest existing organization
          const { data: orgs, error: orgsError } = await supabase
            .from('organizations')
            .select('*')
            .in('id', orgIds)
            .order('created_at', { ascending: true });

          if (!orgsError && orgs && orgs.length > 0) {
            const oldestMemberOrg = orgs[0];
            activeOrg = oldestMemberOrg;
            const matchingMember = memberRows.find((m) => m.organization_id === oldestMemberOrg.id);
            activeRole = (matchingMember?.role as OrganizationRole) || 'owner';
            console.log('[MixFlow] Reusing existing member organization (oldest):', oldestMemberOrg.name, oldestMemberOrg.id);
          }
        }

        // 3. Fallback: Query organizations directly owned by user (deterministic: oldest first)
        if (!activeOrg) {
          const { data: ownedOrgs, error: ownedOrgError } = await supabase
            .from('organizations')
            .select('*')
            .eq('owner_id', userId)
            .order('created_at', { ascending: true });

          if (!ownedOrgError && ownedOrgs && ownedOrgs.length > 0) {
            const oldestOwnedOrg = ownedOrgs[0];
            activeOrg = oldestOwnedOrg;
            activeRole = 'owner';
            console.log('[MixFlow] Reusing existing owned organization (oldest):', oldestOwnedOrg.name, oldestOwnedOrg.id);

            // Verify that owner membership row exists in organization_members
            const { data: verifyMem } = await supabase
              .from('organization_members')
              .select('role')
              .eq('organization_id', oldestOwnedOrg.id)
              .eq('user_id', userId);

            if (!verifyMem || verifyMem.length === 0) {
              console.log('[MixFlow] Syncing owner membership for oldest owned org...');
              await supabase
                .from('organization_members')
                .insert({
                  organization_id: oldestOwnedOrg.id,
                  user_id: userId,
                  role: 'owner',
                });
            } else {
              activeRole = (verifyMem[0].role as OrganizationRole) || 'owner';
            }
          }
        }

        // 4. If the user already belongs to / owns an organization:
        // REUSE IT, DO NOT CREATE A NEW ORGANIZATION
        if (activeOrg) {
          setOrganization(activeOrg);
          setRole(activeRole || 'owner');
          setProvisioning(false);
          return;
        }

        // 5. User does not belong to any organization: CREATE EXACTLY ONE
        setProvisioning(true);
        console.log('[MixFlow] No existing organization found; provisioning single studio organization...');

        const { data: userData } = await supabase.auth.getUser();
        const studioNameFromMeta = userData.user?.user_metadata?.studio_name;
        // If metadata is null, use "One Sound" as expected studio name
        const studioName = (typeof studioNameFromMeta === 'string' && studioNameFromMeta.trim())
          ? studioNameFromMeta.trim()
          : (profileData?.full_name ? `${profileData.full_name}'s Studio` : 'One Sound');

        const newOrgId = crypto.randomUUID();
        const slug = generateSlug(studioName);

        console.log('[MixFlow] Inserting single organization:', {
          id: newOrgId,
          name: studioName,
          slug,
          owner_id: userId,
        });

        // Insert WITHOUT .select() to prevent Postgres RLS RETURNING check issue
        const { error: insertOrgErr } = await supabase
          .from('organizations')
          .insert({
            id: newOrgId,
            name: studioName,
            slug,
            owner_id: userId,
          });

        if (insertOrgErr) {
          // If the database trigger or constraint caught duplicate creation, query the existing one
          console.warn('[MixFlow] Insert returned note, querying existing organization:', insertOrgErr.message);
          const { data: existingAfterConflict } = await supabase
            .from('organizations')
            .select('*')
            .eq('owner_id', userId)
            .order('created_at', { ascending: true });

          if (existingAfterConflict && existingAfterConflict.length > 0) {
            activeOrg = existingAfterConflict[0];
            activeRole = 'owner';
          } else {
            console.error('[MixFlow] Organization insert failed:', insertOrgErr);
            setProvisioningError(`Organization creation failed: ${insertOrgErr.message} (code ${insertOrgErr.code})`);
            setProvisioning(false);
            return;
          }
        } else {
          // Verify owner membership created by database trigger
          let verifiedRole: OrganizationRole | null = null;
          for (let attempt = 0; attempt < 6; attempt++) {
            await new Promise((r) => setTimeout(r, 250));
            const { data: newMemRows } = await supabase
              .from('organization_members')
              .select('role')
              .eq('organization_id', newOrgId)
              .eq('user_id', userId);

            if (newMemRows && newMemRows.length > 0) {
              verifiedRole = newMemRows[0].role as OrganizationRole;
              console.log('[MixFlow] Owner membership confirmed via database trigger:', newMemRows[0]);
              break;
            }
          }

          // Fallback if trigger was delayed
          if (!verifiedRole) {
            console.log('[MixFlow] Ensuring membership via fallback insert...');
            const { error: memFallbackErr } = await supabase
              .from('organization_members')
              .insert({
                organization_id: newOrgId,
                user_id: userId,
                role: 'owner',
              });

            if (memFallbackErr) {
              console.warn('[MixFlow] Fallback membership insert note:', memFallbackErr.message);
            }
            verifiedRole = 'owner';
          }

          // Query the created organization AFTER membership exists
          const { data: fetchedOrg } = await supabase
            .from('organizations')
            .select('*')
            .eq('id', newOrgId)
            .maybeSingle();

          activeOrg = fetchedOrg || {
            id: newOrgId,
            name: studioName,
            slug,
            owner_id: userId,
            created_at: new Date().toISOString(),
          };

          activeRole = verifiedRole || 'owner';
        }

        setOrganization(activeOrg);
        setRole(activeRole || 'owner');
        setProvisioning(false);
      } catch (err: unknown) {
        console.error('[MixFlow] Failed to load user entities:', err);
        const msg = err instanceof Error ? err.message : 'Unknown error loading user workspace';
        setProvisioningError(msg);
        setProvisioning(false);
      }
    };

    inFlightProvisioningRef.current = run();
    try {
      await inFlightProvisioningRef.current;
    } finally {
      inFlightProvisioningRef.current = null;
    }
  }, []);

  // Initialize and restore session on mount
  useEffect(() => {
    const supabase = getSupabase();
    let isMounted = true;

    async function initializeSession() {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          console.warn('Session retrieval error:', error.message);
        }

        if (isMounted) {
          if (data.session?.user) {
            setSession(data.session);
            setUser(data.session.user);
            // Authentication is ready now. Do not block the entire app while the
            // profile/workspace is hydrated; that work continues in the background.
            setLoading(false);
            void loadUserEntities(data.session.user.id);
          } else {
            setSession(null);
            setUser(null);
            setProfile(null);
            setOrganization(null);
            setRole(null);
            setLoading(false);
          }
        }
      } catch (err) {
        console.error('Session init error:', err);
        if (isMounted) setLoading(false);
      }
    }

    initializeSession();

    // Listen to Supabase auth state transitions
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        if (!isMounted) return;

        setSession(newSession);
        setUser(newSession?.user || null);

        if (newSession?.user) {
          // Never hold the auth UI hostage to secondary workspace queries.
          setLoading(false);
          void loadUserEntities(newSession.user.id);
        } else {
          setProfile(null);
          setOrganization(null);
          setRole(null);
          setLoading(false);
        }
      }
    );

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [loadUserEntities, anonKey]);

  // Sign In with email & password
  const signIn = async (email: string, password: string): Promise<{ error: Error | null; diagnostic?: AuthDiagnosticError | null }> => {
    const supabase = getSupabase();
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        const diag = extractDiagnostic('supabase.auth.signIn', error);
        console.error('[MixFlow Diagnostics] supabase.auth.signIn failed:', diag);
        return { error: new Error(formatAuthError(error)), diagnostic: diag };
      }

      if (data.user) {
        setPendingConfirmationEmail(null);
        setUser(data.user);
        setSession(data.session);
        await loadUserEntities(data.user.id);
      }

      return { error: null, diagnostic: null };
    } catch (err: unknown) {
      const diag = extractDiagnostic('supabase.auth.signIn', err);
      console.error('[MixFlow Diagnostics] Unexpected login error:', diag);
      const message = err instanceof Error ? err.message : 'Login failed. Please check your network and credentials.';
      return { error: new Error(message), diagnostic: diag };
    }
  };

  const resetPassword = async (email: string): Promise<{ error: Error | null }> => {
    const supabase = getSupabase();
    try {
      const redirectTo = typeof window !== 'undefined' ? window.location.origin + window.location.pathname : 'https://mixflow-ngsw.onrender.com/';
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
      return { error: error ? new Error(formatAuthError(error)) : null };
    } catch (err: unknown) {
      return { error: err instanceof Error ? err : new Error('Unable to send password reset email. Please try again.') };
    }
  };

  const updatePassword = async (password: string): Promise<{ error: Error | null }> => {
    const supabase = getSupabase();
    try {
      const { error } = await supabase.auth.updateUser({ password });
      return { error: error ? new Error(formatAuthError(error)) : null };
    } catch (err: unknown) {
      return { error: err instanceof Error ? err : new Error('Unable to update your password. Please try again.') };
    }
  };

  // Sign Up with full name, email, password, and studio/company name
  const signUp = async (params: {
    fullName: string;
    email: string;
    password: string;
    studioName: string;
  }): Promise<SignUpResult> => {
    const supabase = getSupabase();

    try {
      const { fullName, email, password, studioName } = params;
      const trimmedFullName = fullName?.trim() || 'Engineer';
      const trimmedStudioName = studioName?.trim() || 'My Studio Workspace';
      const trimmedEmail = email?.trim();

      // 1. Create Supabase Auth user - ALWAYS pass full_name and studio_name in data metadata
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          data: {
            full_name: trimmedFullName,
            studio_name: trimmedStudioName,
          },
        },
      });

      if (authError) {
        const diag = extractDiagnostic('supabase.auth.signUp', authError);
        console.error('[MixFlow Diagnostics] Operation supabase.auth.signUp failed:', diag);
        return { 
          error: new Error(formatAuthError(authError)), 
          diagnostic: diag 
        };
      }

      const newUser = authData.user;
      if (!newUser) {
        const diag: AuthDiagnosticError = {
          operation: 'supabase.auth.signUp',
          message: 'User creation returned empty without error payload',
          code: 'EMPTY_USER_RESPONSE',
        };
        return { 
          error: new Error('User creation returned empty. Please verify your email or sign in.'),
          diagnostic: diag
        };
      }

      // If Supabase returned an active session (e.g. Email Confirmation disabled)
      if (authData.session) {
        setPendingConfirmationEmail(null);
        setUser(newUser);
        setSession(authData.session);
        await loadUserEntities(newUser.id);
        return { error: null, diagnostic: null };
      } else {
        // Requirement 4: If email confirmation is enabled and signUp() returns a user but no active session,
        // activate the dedicated confirmation state so AuthScreen displays the confirmation screen.
        setPendingConfirmationEmail(trimmedEmail);
        return { 
          error: null, 
          diagnostic: null,
          requiresConfirmation: true, 
          message: 'Account created! Please check your email to confirm your account before logging in. Your studio workspace will be finalized upon your first sign in.' 
        };
      }
    } catch (err: unknown) {
      const diag = extractDiagnostic('supabase.auth.signUp', err);
      console.error('[MixFlow Diagnostics] Unexpected signup exception:', diag);
      const message = err instanceof Error ? err.message : 'Sign up failed. Please try again.';
      return { error: new Error(message), diagnostic: diag };
    }
  };

  // Sign Out
  const signOut = async () => {
    const supabase = getSupabase();
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('Sign out warning:', err);
    } finally {
      setPendingConfirmationEmail(null);
      setUser(null);
      setSession(null);
      setProfile(null);
      setOrganization(null);
      setRole(null);
      setProvisioning(false);
      setProvisioningError(null);
    }
  };

  const refreshProfileAndOrg = async () => {
    if (user) {
      await loadUserEntities(user.id);
    }
  };

  const signInAsDemo = (emailInput?: string, nameInput?: string, roleInput: OrganizationRole = 'owner') => {
    const demoEmail = emailInput?.trim() || 'meharoondavid@gmail.com';
    const demoName = nameInput?.trim() || (demoEmail.includes('@') ? demoEmail.split('@')[0] : 'Studio Engineer');
    const demoId = `demo_engineer_session`;

    const demoUser: User = {
      id: demoId,
      app_metadata: { provider: 'email' },
      user_metadata: {
        full_name: demoName,
        studio_name: 'MixFlow Sound Studio',
      },
      aud: 'authenticated',
      created_at: new Date().toISOString(),
      email: demoEmail,
      phone: '',
      role: 'authenticated',
      updated_at: new Date().toISOString(),
    };

    const demoOrg: Organization = {
      id: 'org-studio-1',
      name: 'MixFlow Sound Studio',
      slug: 'mixflow-studio',
      owner_id: demoId,
      created_at: new Date().toISOString(),
    };

    const demoProfile: UserProfile = {
      id: demoId,
      full_name: demoName,
      avatar_url: '',
      phone: '',
      created_at: new Date().toISOString(),
    };

    setUser(demoUser);
    setProfile(demoProfile);
    setOrganization(demoOrg);
    setRole(roleInput);
    setProvisioning(false);
    setProvisioningError(null);
    setPendingConfirmationEmail(null);
    setLoading(false);
  };

  const setAnonKeyManually = (key: string) => {
    const cleaned = key.trim();
    reinitializeSupabase(cleaned);
    setAnonKey(cleaned);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        organization,
        role,
        loading,
        provisioning,
        provisioningError,
        isConfigured,
        pendingConfirmationEmail,
        setPendingConfirmationEmail,
        resetPassword,
        updatePassword,
        setAnonKeyManually,
        signIn,
        signUp,
        signOut,
        refreshProfileAndOrg,
        signInAsDemo,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

function formatAuthError(error: AuthError): string {
  const msg = error.message.toLowerCase();
  if (msg.includes('rate limit') || msg.includes('over_email_send_rate_limit')) {
    return 'Supabase email send rate limit exceeded (free-tier hourly limit). Please wait a few moments before trying again, or disable "Confirm email" in your Supabase Auth settings to test instant signup.';
  }
  if (msg.includes('invalid login credentials') || msg.includes('invalid credentials')) {
    return 'Invalid email or password. Please verify your credentials and try again.';
  }
  if (msg.includes('user already registered') || msg.includes('already exists')) {
    return 'An account with this email already exists. Please sign in instead.';
  }
  if (msg.includes('password should be at least') || msg.includes('password is too short')) {
    return 'Password must be at least 6 characters long.';
  }
  if (msg.includes('email not confirmed')) {
    return 'Your email address has not been confirmed yet. Please check your inbox for the confirmation email or disable "Confirm email" in Supabase Auth settings.';
  }
  return error.message;
}
