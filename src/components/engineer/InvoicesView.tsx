import React, { useState } from 'react';
import { FileText, Search, Download, ExternalLink, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Project } from '../../types';

export const InvoicesView: React.FC = () => {
  const { projects, engineer, setActiveInvoiceProject, setIsInvoiceModalOpen } = useApp();
  const [filter, setFilter] = useState<'all' | 'paid' | 'pending'>('all');
  const [search, setSearch] = useState('');

  const currencySymbol = engineer.currency === 'INR' ? '₹' : '$';

  const invoices = projects.map(p => {
    const isPaid = p.paidAmount >= p.totalAmount;
    const balance = p.totalAmount - p.paidAmount;
    return {
      project: p,
      number: p.invoiceNumber,
      clientName: p.clientName,
      title: p.title,
      total: p.totalAmount,
      paid: p.paidAmount,
      balance,
      date: p.invoiceDate,
      dueDate: p.dueDate,
      status: isPaid ? 'paid' : (p.paidAmount > 0 ? 'partial' : 'pending')
    };
  });

  const filtered = invoices.filter(inv => {
    const matchesFilter = 
      filter === 'all' ? true :
      filter === 'paid' ? inv.status === 'paid' :
      inv.status !== 'paid';

    const matchesSearch = 
      inv.number.toLowerCase().includes(search.toLowerCase()) ||
      inv.clientName.toLowerCase().includes(search.toLowerCase()) ||
      inv.title.toLowerCase().includes(search.toLowerCase());

    return matchesFilter && matchesSearch;
  });

  const totalInvoiced = invoices.reduce((s, i) => s + i.total, 0);
  const totalCollected = invoices.reduce((s, i) => s + i.paid, 0);
  const totalPending = invoices.reduce((s, i) => s + i.balance, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Invoices & Billing</h1>
          <p className="text-xs text-zinc-400 mt-1">
            Track deposits, milestone balances, and formal studio invoices.
          </p>
        </div>
      </div>

      {/* Top Ledger Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
          <span className="text-xs text-zinc-400 block mb-1">Total Invoiced</span>
          <span className="font-mono text-2xl font-bold text-zinc-100 tabular-nums">
            {currencySymbol}{totalInvoiced.toLocaleString()}
          </span>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
          <span className="text-xs text-zinc-400 block mb-1">Total Settled</span>
          <span className="font-mono text-2xl font-bold text-emerald-400 tabular-nums">
            {currencySymbol}{totalCollected.toLocaleString()}
          </span>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
          <span className="text-xs text-zinc-400 block mb-1">Pending Receivables</span>
          <span className="font-mono text-2xl font-bold text-amber-400 tabular-nums">
            {currencySymbol}{totalPending.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-1 p-1 bg-zinc-900 border border-zinc-800 rounded-xl">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              filter === 'all' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            All Invoices
          </button>
          <button
            onClick={() => setFilter('pending')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              filter === 'pending' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Pending Due
          </button>
          <button
            onClick={() => setFilter('paid')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              filter === 'paid' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Paid in Full
          </button>
        </div>

        <div className="relative w-full max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder="Search invoice #, client, or song..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Invoices Ledger Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-950/70 border-b border-zinc-800 text-zinc-400 font-mono">
              <tr>
                <th className="py-3.5 px-5 font-medium">Invoice #</th>
                <th className="py-3.5 px-5 font-medium">Client / Project</th>
                <th className="py-3.5 px-5 font-medium">Issue Date</th>
                <th className="py-3.5 px-5 font-medium">Due Date</th>
                <th className="py-3.5 px-5 font-medium text-right">Total</th>
                <th className="py-3.5 px-5 font-medium text-right">Balance Due</th>
                <th className="py-3.5 px-5 font-medium">Status</th>
                <th className="py-3.5 px-5 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/80">
              {filtered.map((inv) => (
                <tr key={inv.number} className="hover:bg-zinc-850/50 transition-colors">
                  <td className="py-4 px-5 font-mono font-bold text-zinc-200">
                    {inv.number}
                  </td>

                  <td className="py-4 px-5">
                    <span className="font-bold text-zinc-100 block">{inv.title}</span>
                    <span className="text-[11px] text-zinc-500">{inv.clientName}</span>
                  </td>

                  <td className="py-4 px-5 font-mono text-zinc-400">
                    {inv.date}
                  </td>

                  <td className="py-4 px-5 font-mono text-zinc-400">
                    {inv.dueDate}
                  </td>

                  <td className="py-4 px-5 text-right font-mono font-bold text-zinc-200 tabular-nums">
                    {currencySymbol}{inv.total.toLocaleString()}
                  </td>

                  <td className="py-4 px-5 text-right font-mono font-bold tabular-nums">
                    {inv.balance > 0 ? (
                      <span className="text-amber-400">{currencySymbol}{inv.balance.toLocaleString()}</span>
                    ) : (
                      <span className="text-zinc-500">$0.00</span>
                    )}
                  </td>

                  <td className="py-4 px-5">
                    {inv.status === 'paid' ? (
                      <span className="text-emerald-400 font-semibold flex items-center gap-1">
                        <CheckCircle2 size={13} /> Paid
                      </span>
                    ) : inv.status === 'partial' ? (
                      <span className="text-amber-400 font-semibold flex items-center gap-1">
                        <Clock size={13} /> Partial Deposit
                      </span>
                    ) : (
                      <span className="text-zinc-400 font-semibold flex items-center gap-1">
                        <Clock size={13} /> Awaiting Payment
                      </span>
                    )}
                  </td>

                  <td className="py-4 px-5 text-right">
                    <button
                      onClick={() => {
                        setActiveInvoiceProject(inv.project);
                        setIsInvoiceModalOpen(true);
                      }}
                      className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-[11px] inline-flex items-center gap-1 font-medium transition-colors"
                    >
                      <FileText size={12} />
                      <span>View PDF</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
