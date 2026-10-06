import React, { useState } from 'react';
import {
  CreditCard,
  Plus,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RotateCcw,
  Receipt,
  Check,
  X,
  Loader2,
  DollarSign,
  FileCheck2,
  Info
} from 'lucide-react';
import { useProjectPayments } from '../../hooks/useProjectPayments';
import { PaymentStatus, ProjectPaymentRecord } from '../../types/payment';

interface ProjectPaymentsSectionProps {
  projectId: string;
  projectPrice: number;
  depositAmount: number;
  clientName?: string;
}

export const ProjectPaymentsSection: React.FC<ProjectPaymentsSectionProps> = ({
  projectId,
  projectPrice,
  depositAmount,
  clientName,
}) => {
  const {
    payments,
    loading,
    error,
    summary,
    canRecordPayment,
    createPayment,
  } = useProjectPayments(projectId, projectPrice, depositAmount);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form State
  const [amount, setAmount] = useState<string>('');
  const [currency, setCurrency] = useState<string>('INR');
  const [status, setStatus] = useState<PaymentStatus>('paid');
  const [paymentMethod, setPaymentMethod] = useState<string>('Bank Transfer');
  const [reference, setReference] = useState<string>('');
  const [paidAt, setPaidAt] = useState<string>(() => new Date().toISOString().split('T')[0]);

  // Format currency
  const formatCurrency = (val: number, cur: string = 'INR'): string => {
    const symbols: Record<string, string> = {
      INR: '₹',
      USD: '$',
      EUR: '€',
      GBP: '£',
    };
    const sym = symbols[cur] || `${cur} `;
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
            <span>Pending</span>
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

  const getOverallStatusLabel = () => {
    switch (summary.payment_status) {
      case 'paid_in_full':
        return {
          label: 'Paid in Full',
          bg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
        };
      case 'overpaid':
        return {
          label: `Overpaid (${formatCurrency(summary.overpaid_amount, currency)})`,
          bg: 'bg-purple-500/10 border-purple-500/30 text-purple-400',
        };
      case 'partially_paid':
        return {
          label: 'Partially Paid',
          bg: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
        };
      case 'unpaid':
      default:
        return {
          label: 'Awaiting Payment',
          bg: 'bg-zinc-800 border-zinc-700 text-zinc-300',
        };
    }
  };

  const handleOpenModal = () => {
    setAmount(summary.outstanding_balance > 0 ? String(summary.outstanding_balance) : '');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const num = Number(amount);
    if (isNaN(num) || num < 0) {
      setFormError('Please enter a valid non-negative payment amount.');
      return;
    }

    setSubmitting(true);
    const res = await createPayment({
      amount: num,
      currency,
      status,
      payment_method: paymentMethod || null,
      reference: reference.trim() || null,
      paid_at: paidAt ? new Date(paidAt).toISOString() : null,
    });

    setSubmitting(false);

    if (res.success) {
      setIsModalOpen(false);
      setSuccessMessage('Payment record successfully created and ledger updated.');
      setTimeout(() => setSuccessMessage(null), 5000);
      setAmount('');
      setReference('');
    } else {
      setFormError(res.error || 'Failed to record payment. Please try again.');
    }
  };

  const overallStatus = getOverallStatusLabel();

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Receipt size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h3 className="text-base font-bold text-white tracking-tight">Payments & Billing</h3>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${overallStatus.bg}`}>
                {overallStatus.label}
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Authoritative financial ledger and balance tracking for this project.
            </p>
          </div>
        </div>

        {canRecordPayment && (
          <button
            onClick={handleOpenModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-bold rounded-xl transition cursor-pointer shadow-lg shadow-emerald-500/10 shrink-0"
          >
            <Plus size={15} />
            <span>Record Payment</span>
          </button>
        )}
      </div>

      {/* Success Notification */}
      {successMessage && (
        <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center justify-between text-xs text-emerald-400 animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-400/80 hover:text-emerald-300">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Summary Financial Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Agreed Project Price */}
        <div className="bg-zinc-950/60 border border-zinc-800 rounded-2xl p-4 space-y-1">
          <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider block">Project Price</span>
          <div className="text-xl font-bold font-mono text-white tabular-nums">
            {formatCurrency(summary.project_price, currency)}
          </div>
          <span className="text-[10px] text-zinc-500">Agreed scope</span>
        </div>

        {/* Deposit Retainer */}
        <div className="bg-zinc-950/60 border border-zinc-800 rounded-2xl p-4 space-y-1">
          <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider block">Agreed Deposit</span>
          <div className="text-xl font-bold font-mono text-zinc-300 tabular-nums">
            {formatCurrency(summary.deposit_amount, currency)}
          </div>
          <span className="text-[10px] text-zinc-500">Initial retainer</span>
        </div>

        {/* Total Successfully Paid */}
        <div className="bg-zinc-950/60 border border-zinc-800 rounded-2xl p-4 space-y-1">
          <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider block">Total Received</span>
          <div className="text-xl font-bold font-mono text-emerald-400 tabular-nums">
            {formatCurrency(summary.total_paid, currency)}
          </div>
          <span className="text-[10px] text-zinc-500">
            {payments.filter((p) => p.status === 'paid').length} paid record(s)
          </span>
        </div>

        {/* Outstanding Balance */}
        <div className="bg-zinc-950/60 border border-zinc-800 rounded-2xl p-4 space-y-1">
          <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider block">Outstanding Balance</span>
          <div
            className={`text-xl font-bold font-mono tabular-nums ${
              summary.is_overpaid
                ? 'text-purple-400'
                : summary.outstanding_balance === 0
                ? 'text-emerald-400'
                : 'text-amber-400'
            }`}
          >
            {summary.is_overpaid
              ? `-${formatCurrency(summary.overpaid_amount, currency)}`
              : formatCurrency(summary.outstanding_balance, currency)}
          </div>
          <span className="text-[10px] text-zinc-500">
            {summary.is_overpaid
              ? 'Credit overpayment'
              : summary.outstanding_balance === 0
              ? 'Settled in full'
              : 'Balance due'}
          </span>
        </div>
      </div>

      {/* Note about deposit & paid separation */}
      <div className="flex items-start gap-2.5 text-[11px] text-zinc-400 bg-zinc-950/40 border border-zinc-800/60 rounded-xl p-3">
        <Info size={14} className="text-zinc-400 shrink-0 mt-0.5" />
        <span>
          Note: Total received reflects real recorded payments with status &ldquo;paid&rdquo;. Deposit amount is the agreed
          contractual retainer and is tracked separately until recorded as a verified payment.
        </span>
      </div>

      {/* Payment History Ledger */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-300">Payment History & Ledger</h4>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 font-semibold">
              {payments.length}
            </span>
          </div>
          <span className="text-[11px] text-zinc-500">Immutable financial audit records</span>
        </div>

        {loading ? (
          <div className="py-10 text-center space-y-2">
            <Loader2 size={20} className="animate-spin text-emerald-400 mx-auto" />
            <p className="text-xs text-zinc-400">Loading payment ledger...</p>
          </div>
        ) : payments.length === 0 ? (
          <div className="py-10 text-center border border-dashed border-zinc-800 rounded-2xl space-y-3">
            <div className="w-10 h-10 rounded-2xl bg-zinc-800/60 flex items-center justify-center text-zinc-500 mx-auto">
              <CreditCard size={18} />
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-300">No payment records yet</p>
              <p className="text-[11px] text-zinc-500 max-w-sm mx-auto mt-0.5">
                Payments recorded by authorized studio members (Owner, Admin, Finance) will appear here.
              </p>
            </div>
            {canRecordPayment && (
              <button
                onClick={handleOpenModal}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold rounded-xl transition cursor-pointer"
              >
                <Plus size={13} />
                <span>Record First Payment</span>
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/60 rounded-2xl overflow-hidden border border-zinc-800/60 bg-zinc-950/40">
            {payments.map((p, idx) => {
              const isNewest = idx === 0;
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
                  className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs hover:bg-zinc-900/30 transition-colors ${
                    isNewest ? 'bg-zinc-900/10' : ''
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0">
                      <Receipt size={16} className={p.status === 'paid' ? 'text-emerald-400' : 'text-zinc-400'} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold font-mono text-white tabular-nums">
                          {formatCurrency(p.amount, p.currency)}
                        </span>
                        {getStatusBadge(p.status)}
                        {isNewest && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                            NEWEST
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-500 font-mono mt-0.5">
                        <span>Method: {p.payment_method || 'Standard'}</span>
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
                    <div>Paid: {formattedDate}</div>
                    <div className="text-[10px] text-zinc-500">
                      Logged {new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Record Payment Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <CreditCard size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Record Project Payment</h3>
                  <p className="text-[11px] text-zinc-400">Append an authoritative financial transaction</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-zinc-500 hover:text-zinc-300 transition-colors p-1"
              >
                <X size={18} />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Amount & Currency */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Amount <span className="text-emerald-400">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    placeholder="e.g. 500.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">Currency</label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                  >
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                  </select>
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Payment Status <span className="text-emerald-400">*</span>
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as PaymentStatus)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                >
                  <option value="paid">Paid (Confirmed received)</option>
                  <option value="pending">Pending (Awaiting clearance)</option>
                  <option value="failed">Failed (Declined / cancelled)</option>
                  <option value="refunded">Refunded</option>
                </select>
                <p className="text-[10px] text-zinc-500 mt-1">
                  Only &ldquo;Paid&rdquo; records count toward the total received amount.
                </p>
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="Bank Transfer">Bank Transfer / NEFT / IMPS</option>
                  <option value="UPI">UPI / Instant Transfer</option>
                  <option value="Credit / Debit Card">Credit / Debit Card</option>
                  <option value="Cash">Cash in Studio</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* Reference / Transaction ID */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Reference / Transaction ID <span className="text-zinc-500 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. UTR-982341 or Bank Ref"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              {/* Paid At Date */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Payment Date</label>
                <input
                  type="date"
                  value={paidAt}
                  onChange={(e) => setPaidAt(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={submitting}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 text-xs font-bold rounded-xl transition cursor-pointer shadow-lg shadow-emerald-500/10"
                >
                  {submitting ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>Recording...</span>
                    </>
                  ) : (
                    <>
                      <Check size={14} />
                      <span>Confirm & Record</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
