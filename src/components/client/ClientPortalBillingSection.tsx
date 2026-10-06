import React from 'react';
import { 
  Receipt, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  RotateCcw, 
  CreditCard,
  Loader2,
  Check
} from 'lucide-react';
import { useProjectPayments } from '../../hooks/useProjectPayments';
import { PaymentStatus } from '../../types/payment';

interface ClientPortalBillingSectionProps {
  projectId: string;
  projectPrice: number;
  depositAmount: number;
}

export const ClientPortalBillingSection: React.FC<ClientPortalBillingSectionProps> = ({
  projectId,
  projectPrice,
  depositAmount,
}) => {
  const { payments, loading, summary } = useProjectPayments(
    projectId,
    projectPrice,
    depositAmount
  );

  const currencySymbol = '₹'; // Default studio currency symbol, or dynamically inferred from payments

  const formatAmount = (val: number, cur?: string) => {
    const sym = cur === 'USD' ? '$' : cur === 'EUR' ? '€' : cur === 'GBP' ? '£' : currencySymbol;
    return `${sym}${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getStatusBadge = (st: PaymentStatus) => {
    switch (st) {
      case 'paid':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <CheckCircle2 size={12} />
            <span>Paid</span>
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 border border-amber-500/30 text-amber-400">
            <Clock size={12} />
            <span>Processing</span>
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-500/10 border border-red-500/30 text-red-400">
            <AlertTriangle size={12} />
            <span>Failed</span>
          </span>
        );
      case 'refunded':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-500/10 border border-zinc-500/30 text-zinc-400">
            <RotateCcw size={12} />
            <span>Refunded</span>
          </span>
        );
    }
  };

  return (
    <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-3xl p-6 sm:p-7 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/60 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Receipt size={16} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white tracking-tight">Project Billing & Payments</h2>
            <p className="text-[11px] text-zinc-500">Transparent statement of account for this project</p>
          </div>
        </div>

        {summary.outstanding_balance === 0 && summary.total_paid > 0 ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 self-start sm:self-auto">
            <Check size={13} />
            <span>Paid in Full</span>
          </span>
        ) : summary.is_overpaid ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-500/10 border border-purple-500/30 text-purple-400 self-start sm:self-auto">
            <span>Credit Overpayment</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 border border-amber-500/30 text-amber-400 self-start sm:self-auto">
            <Clock size={13} />
            <span>Balance Due</span>
          </span>
        )}
      </div>

      {/* 3-Column Summary: Project Price -> Total Paid -> Remaining */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Project Price */}
        <div className="bg-zinc-950/50 border border-zinc-800/80 rounded-2xl p-4 space-y-1">
          <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider block">Agreed Project Price</span>
          <div className="text-2xl font-bold font-mono text-white tabular-nums">
            {formatAmount(summary.project_price)}
          </div>
          <span className="text-[10px] text-zinc-500">Total contracted scope</span>
        </div>

        {/* Total Paid */}
        <div className="bg-zinc-950/50 border border-zinc-800/80 rounded-2xl p-4 space-y-1">
          <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider block">Total Paid to Date</span>
          <div className="text-2xl font-bold font-mono text-emerald-400 tabular-nums">
            {formatAmount(summary.total_paid)}
          </div>
          <span className="text-[10px] text-zinc-500">Verified received payments</span>
        </div>

        {/* Remaining Balance */}
        <div className="bg-zinc-950/50 border border-zinc-800/80 rounded-2xl p-4 space-y-1">
          <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider block">Outstanding Balance</span>
          <div
            className={`text-2xl font-bold font-mono tabular-nums ${
              summary.is_overpaid
                ? 'text-purple-400'
                : summary.outstanding_balance === 0
                ? 'text-emerald-400'
                : 'text-amber-400'
            }`}
          >
            {summary.is_overpaid
              ? `-${formatAmount(summary.overpaid_amount)}`
              : formatAmount(summary.outstanding_balance)}
          </div>
          <span className="text-[10px] text-zinc-500">
            {summary.is_overpaid
              ? 'Credit on file'
              : summary.outstanding_balance === 0
              ? 'Settled in full'
              : 'Payable upon project milestones'}
          </span>
        </div>
      </div>

      {/* Payment History List */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Payment History</h3>

        {loading ? (
          <div className="py-8 text-center space-y-2">
            <Loader2 size={18} className="animate-spin text-emerald-400 mx-auto" />
            <p className="text-xs text-zinc-500">Loading payment history...</p>
          </div>
        ) : payments.length === 0 ? (
          <div className="py-8 text-center border border-dashed border-zinc-800 rounded-2xl space-y-1.5">
            <p className="text-xs text-zinc-400">No payment records found for this project yet.</p>
            <p className="text-[11px] text-zinc-600">Payments recorded by the studio will appear here automatically.</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/60 rounded-2xl overflow-hidden border border-zinc-800/60 bg-zinc-950/40">
            {payments.map((p) => {
              const formattedDate = p.paid_at
                ? new Date(p.paid_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })
                : new Date(p.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  });

              return (
                <div
                  key={p.id}
                  className="px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs hover:bg-zinc-900/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center shrink-0 text-emerald-400">
                      <CreditCard size={15} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold font-mono text-zinc-100 text-sm">
                          {formatAmount(p.amount, p.currency)}
                        </span>
                        {getStatusBadge(p.status)}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-zinc-500 font-mono">
                        <span>{p.payment_method || 'Standard'}</span>
                        {p.reference && (
                          <>
                            <span>•</span>
                            <span>Ref: {p.reference}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-right sm:shrink-0 text-[11px] text-zinc-400 font-mono">
                    <span>{formattedDate}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
