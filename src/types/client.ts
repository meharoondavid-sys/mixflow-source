export interface ClientRecord {
  id: string;
  organization_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  project_count?: number;
}

export interface ClientProjectItem {
  id: string;
  name: string;
  project_type: 'single' | 'ep' | 'album' | string;
  status: string;
  project_price: number;
  deposit_amount: number;
  deadline: string | null;
  created_at: string;
}

export interface ClientInsertInput {
  full_name: string;
  email?: string | null;
  phone?: string | null;
  company_name?: string | null;
  notes?: string | null;
}

export interface ClientUpdateInput {
  full_name?: string;
  email?: string | null;
  phone?: string | null;
  company_name?: string | null;
  notes?: string | null;
}

export interface ClientDiagnosticError {
  operation: 'clients.select' | 'clients.insert' | 'clients.update' | 'clients.delete';
  message: string;
  code: string | number;
  details?: string | null;
  hint?: string | null;
}
