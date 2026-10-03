import { User, Session } from '@supabase/supabase-js';

export type OrganizationRole = 
  | 'owner' 
  | 'admin' 
  | 'engineer' 
  | 'producer' 
  | 'assistant' 
  | 'finance';

export interface UserProfile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  created_at: string;
  updated_at?: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  created_at: string;
  updated_at?: string;
}

export interface OrganizationMember {
  organization_id: string;
  user_id: string;
  role: OrganizationRole;
  created_at?: string;
}

export interface AuthDiagnosticError {
  operation: 'supabase.auth.signUp' | 'organizations.insert' | 'organization_members.select' | 'organization_members.insert' | 'supabase.auth.signIn';
  message: string;
  code: string | number;
  details?: string | null;
  hint?: string | null;
  status?: number | null;
}

export interface SignUpResult {
  error: Error | null;
  diagnostic?: AuthDiagnosticError | null;
  requiresConfirmation?: boolean;
  message?: string;
}

export interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  organization: Organization | null;
  role: OrganizationRole | null;
  loading: boolean;
  provisioning: boolean;
  provisioningError: string | null;
  isConfigured: boolean;
  pendingConfirmationEmail: string | null;
  setPendingConfirmationEmail: (email: string | null) => void;
  setAnonKeyManually: (key: string) => void;
  signIn: (email: string, password: string) => Promise<{ error: Error | null; diagnostic?: AuthDiagnosticError | null }>;
  signUp: (params: {
    fullName: string;
    email: string;
    password: string;
    studioName: string;
  }) => Promise<SignUpResult>;
  signOut: () => Promise<void>;
  refreshProfileAndOrg: () => Promise<void>;
}
