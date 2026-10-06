import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { getSupabase } from '../lib/supabase';
import {
  ProjectPaymentRecord,
  CreatePaymentInput,
  ProjectBillingSummary,
  calculateBillingSummary,
} from '../types/payment';

interface UseProjectPaymentsResult {
  payments: ProjectPaymentRecord[];
  loading: boolean;
  error: string | null;
  summary: ProjectBillingSummary;
  canRecordPayment: boolean;
  fetchPayments: () => Promise<void>;
  createPayment: (input: Omit<CreatePaymentInput, 'project_id'>) => Promise<{ success: boolean; error?: string }>;
}

export function useProjectPayments(
  projectId?: string,
  projectPrice: number = 0,
  depositAmount: number = 0
): UseProjectPaymentsResult {
  const { session, role } = useAuth();
  const [payments, setPayments] = useState<ProjectPaymentRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Authorized roles for recording payments: owner, admin, finance
  const canRecordPayment = role === 'owner' || role === 'admin' || role === 'finance';

  const fetchPayments = useCallback(async () => {
    if (!projectId) {
      setPayments([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const token = session?.access_token;
    const authHeader = token ? `Bearer ${token}` : '';

    try {
      // 1. Primary: Use secure server endpoint with permission verification
      if (authHeader) {
        const res = await fetch(`/api/projects/${projectId}/payments`, {
          headers: {
            Authorization: authHeader,
          },
        });

        if (res.ok) {
          const json = await res.json();
          setPayments(json.payments || []);
          setLoading(false);
          return;
        }
      }

      // 2. Direct Supabase client query
      const supabase = getSupabase();
      const { data, error: dbErr } = await supabase
        .from('project_payments')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (!dbErr && data) {
        setPayments(data);
      } else {
        // Table not ready or empty
        setPayments([]);
      }
    } catch (err: any) {
      console.warn('[useProjectPayments] Failed to fetch payments:', err);
      // Fail gracefully so UI remains usable
      setError('Unable to load payment history.');
    } finally {
      setLoading(false);
    }
  }, [projectId, session?.access_token]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const createPayment = useCallback(
    async (
      input: Omit<CreatePaymentInput, 'project_id'>
    ): Promise<{ success: boolean; error?: string }> => {
      if (!projectId) {
        return { success: false, error: 'Project ID is missing.' };
      }

      const numAmount = Number(input.amount);
      if (isNaN(numAmount) || numAmount < 0) {
        return { success: false, error: 'Payment amount must be a positive number.' };
      }

      const token = session?.access_token;
      const authHeader = token ? `Bearer ${token}` : '';

      try {
        const payload: CreatePaymentInput = {
          project_id: projectId,
          amount: numAmount,
          currency: input.currency || 'INR',
          status: input.status || 'paid',
          payment_method: input.payment_method || null,
          reference: input.reference || null,
          paid_at: input.paid_at || (input.status === 'paid' ? new Date().toISOString() : null),
        };

        if (authHeader) {
          const res = await fetch(`/api/projects/${projectId}/payments`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: authHeader,
            },
            body: JSON.stringify(payload),
          });

          const data = await res.json();
          if (!res.ok) {
            return { success: false, error: data.error || 'Failed to record payment.' };
          }

          // Optimistically update & refetch
          await fetchPayments();
          return { success: true };
        }

        // Direct client fallback
        const supabase = getSupabase();
        const { error: insertErr } = await supabase
          .from('project_payments')
          .insert({
            project_id: projectId,
            amount: payload.amount,
            currency: payload.currency,
            status: payload.status,
            payment_method: payload.payment_method,
            reference: payload.reference,
            paid_at: payload.paid_at,
          });

        if (insertErr) {
          return { success: false, error: insertErr.message };
        }

        await fetchPayments();
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err?.message || 'Network error while recording payment.' };
      }
    },
    [projectId, session?.access_token, fetchPayments]
  );

  // Calculate live billing summary based on Step 13 rules
  const summary = useMemo(() => {
    return calculateBillingSummary(projectPrice, depositAmount, payments);
  }, [projectPrice, depositAmount, payments]);

  return {
    payments,
    loading,
    error,
    summary,
    canRecordPayment,
    fetchPayments,
    createPayment,
  };
}
