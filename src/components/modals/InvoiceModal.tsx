import React, { useRef } from 'react';
import { X, Printer, Download, Disc3, CheckCircle2, Clock } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const InvoiceModal: React.FC = () => {
  const { 
    isInvoiceModalOpen, 
    setIsInvoiceModalOpen, 
    activeInvoiceProject, 
    engineer 
  } = useApp();

  const printRef = useRef<HTMLDivElement>(null);

  if (!isInvoiceModalOpen || !activeInvoiceProject) return null;

  const project = activeInvoiceProject;
  const isPaid = project.paidAmount >= project.totalAmount;
  const balanceDue = project.totalAmount - project.paidAmount;
  const currencySymbol = engineer.currency === 'INR' ? '₹' : '$';

  const handlePrint = () => {
    window.print();
  };

  const lineItems = [
    {
      description: `Full Multi-Track Stereo Mix (${project.title})`,
      detail: 'Analog summing, compression, EQ, vocal alignment & effects processing',
      amount: Math.round(project.totalAmount * 0.65)
    },
    {
      description: 'Lead & Backing Vocal Tuning / Pitch Editing',
      detail: 'Melodyne transparent manual pitch correction & sibilance control',
      amount: Math.round(project.totalAmount * 0.15)
    },
    {
      description: 'Mastering for Commercial Streaming & Club Systems',
      detail: 'Stereo master limiting, EQ matching, target LUFS normalization & metadata tag injection',
      amount: Math.round(project.totalAmount * 0.20)
    }
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl space-y-6 my-6 animate-in fade-in zoom-in-95 duration-150">
        {/* Top Control Bar */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-zinc-400">Official Studio Invoice</span>
            <span aria-hidden="true" className="text-zinc-600">·</span>
            <span className="font-mono text-xs text-emerald-400">{project.invoiceNumber}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-xs font-medium transition-colors"
            >
              <Printer size={13} />
              <span>Print / PDF</span>
            </button>
            <button
              onClick={() => setIsInvoiceModalOpen(false)}
              className="p-1.5 text-zinc-400 hover:text-white rounded-lg transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Printable Invoice Sheet */}
        <div ref={printRef} className="bg-zinc-950 p-6 sm:p-8 rounded-2xl border border-zinc-800 space-y-6 text-xs text-zinc-300">
          {/* Header & Studio Info */}
          <div className="flex flex-col sm:flex-row justify-between gap-4 border-b border-zinc-800 pb-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Disc3 size={24} className="text-emerald-400" />
                <span className="text-lg font-bold text-white tracking-tight">{engineer.studioName}</span>
              </div>
              <p className="text-zinc-400 leading-tight">{engineer.name} · Senior Audio Engineer</p>
              <p className="text-zinc-500">{engineer.email}</p>
              <p className="text-zinc-500">{engineer.phone}</p>
            </div>

            <div className="sm:text-right">
              <span className="text-2xl font-bold font-mono text-white block mb-1">INVOICE</span>
              <p className="font-mono text-zinc-400">{project.invoiceNumber}</p>
              <p className="text-zinc-400 mt-2">
                Date Issued: <span className="font-mono text-zinc-200">{project.invoiceDate}</span>
              </p>
              <p className="text-zinc-400">
                Payment Due: <span className="font-mono text-zinc-200">{project.dueDate}</span>
              </p>
            </div>
          </div>

          {/* Client Bill-To */}
          <div className="flex flex-col sm:flex-row justify-between gap-4 py-2">
            <div>
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">Billed To</span>
              <p className="font-bold text-white text-sm">{project.clientName}</p>
              <p className="text-zinc-400">Artist / Client: {project.artist}</p>
              <p className="text-zinc-500">{project.clientEmail}</p>
            </div>

            <div className="sm:text-right">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">Payment Status</span>
              {isPaid ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold rounded-lg text-xs">
                  <CheckCircle2 size={13} />
                  <span>PAID IN FULL</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 font-bold rounded-lg text-xs">
                  <Clock size={13} />
                  <span>BALANCE DUE ({currencySymbol}{balanceDue})</span>
                </div>
              )}
            </div>
          </div>

          {/* Line Items Table */}
          <div className="border border-zinc-800 rounded-xl overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-zinc-900 border-b border-zinc-800 text-zinc-400 font-mono text-[11px]">
                <tr>
                  <th className="py-2.5 px-4 font-medium">Service Description</th>
                  <th className="py-2.5 px-4 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/80">
                {lineItems.map((item, i) => (
                  <tr key={i}>
                    <td className="py-3 px-4">
                      <span className="font-semibold text-zinc-200 block">{item.description}</span>
                      <span className="text-[11px] text-zinc-500">{item.detail}</span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-medium text-zinc-200 tabular-nums">
                      {currencySymbol}{item.amount.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Total Breakdown */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pt-2">
            <div className="text-zinc-500 text-[11px] max-w-xs space-y-1">
              <p className="font-medium text-zinc-400">Payment Terms</p>
              <p>Settlement required prior to unwatermarked 24-bit master file release. Powered by MixFlow.</p>
            </div>

            <div className="w-full sm:w-64 space-y-2 border-t sm:border-t-0 pt-2 sm:pt-0">
              <div className="flex justify-between text-zinc-400">
                <span>Subtotal</span>
                <span className="font-mono text-zinc-200">{currencySymbol}{project.totalAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Amount Paid</span>
                <span className="font-mono text-emerald-400">-{currencySymbol}{project.paidAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between border-t border-zinc-800 pt-2 font-bold text-white text-sm">
                <span>Balance Due</span>
                <span className="font-mono text-emerald-400">{currencySymbol}{balanceDue.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
