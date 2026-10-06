export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';

export interface ProjectPaymentRecord {
  id: string;
  organization_id: string;
  project_id: string;
  client_id: string | null;
  amount: number;
  currency: string;
  status: PaymentStatus;
  payment_method: string | null;
  reference: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreatePaymentInput {
  project_id: string;
  amount: number;
  currency?: string;
  status?: PaymentStatus;
  payment_method?: string | null;
  reference?: string | null;
  paid_at?: string | null;
}

export type ProjectPaymentOverallStatus = 'unpaid' | 'partially_paid' | 'paid_in_full' | 'overpaid';

export interface ProjectBillingSummary {
  project_price: number;
  deposit_amount: number;
  total_paid: number;
  outstanding_balance: number;
  is_overpaid: boolean;
  overpaid_amount: number;
  payment_status: ProjectPaymentOverallStatus;
}

/**
 * Calculates project financial totals based on Step 13 rules:
 * - Only payments with status === 'paid' count toward total_paid.
 * - Outstanding balance = Math.max(0, project_price - total_paid).
 * - If total_paid > project_price, overpayment is calculated and surfaced explicitly.
 * - deposit_amount is displayed as the agreed initial retainer, but is NOT counted as paid unless an actual payment record exists.
 */
export function calculateBillingSummary(
  projectPrice: number,
  depositAmount: number,
  payments: ProjectPaymentRecord[] = []
): ProjectBillingSummary {
  const price = Math.max(0, Number(projectPrice) || 0);
  const deposit = Math.max(0, Number(depositAmount) || 0);

  const totalPaid = payments.reduce((sum, p) => {
    if (p.status === 'paid') {
      const amt = Number(p.amount) || 0;
      return sum + (amt > 0 ? amt : 0);
    }
    return sum;
  }, 0);

  const rawRemaining = price - totalPaid;
  const outstandingBalance = Math.max(0, rawRemaining);
  const isOverpaid = totalPaid > price;
  const overpaidAmount = isOverpaid ? totalPaid - price : 0;

  let paymentStatus: ProjectPaymentOverallStatus = 'unpaid';
  if (totalPaid === 0) {
    paymentStatus = 'unpaid';
  } else if (isOverpaid) {
    paymentStatus = 'overpaid';
  } else if (outstandingBalance === 0) {
    paymentStatus = 'paid_in_full';
  } else {
    paymentStatus = 'partially_paid';
  }

  return {
    project_price: price,
    deposit_amount: deposit,
    total_paid: totalPaid,
    outstanding_balance: outstandingBalance,
    is_overpaid: isOverpaid,
    overpaid_amount: overpaidAmount,
    payment_status: paymentStatus,
  };
}
