import React, { useState } from 'react';
import { 
  X, 
  CreditCard, 
  CheckCircle2, 
  ShieldCheck, 
  Lock, 
  Zap, 
  Loader2, 
  Smartphone,
  Building,
  Check
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const PaymentModal: React.FC = () => {
  const { 
    isPaymentModalOpen, 
    setIsPaymentModalOpen, 
    clientActiveProject, 
    activeProject, 
    currentView,
    processPayment,
    engineer 
  } = useApp();

  const project = currentView === 'client' ? clientActiveProject : activeProject;
  const [provider, setProvider] = useState<'razorpay' | 'stripe'>('razorpay');
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'upi' | 'netbanking'>('upi');
  const [upiId, setUpiId] = useState('artist@okaxis');
  const [cardNumber, setCardNumber] = useState('4242 •••• •••• 4242');
  const [cardExpiry, setCardExpiry] = useState('08/28');
  const [cardCvc, setCardCvc] = useState('884');
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [txnId, setTxnId] = useState('');

  if (!isPaymentModalOpen || !project) return null;

  const balanceDue = project.totalAmount - project.paidAmount;
  const currencySymbol = engineer.currency === 'INR' ? '₹' : '$';

  const handlePay = (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);

    const generatedTxn = `${provider === 'razorpay' ? 'pay_rzp' : 'ch_stripe'}_${Math.random().toString(36).substring(2, 10)}`;
    setTxnId(generatedTxn);

    setTimeout(() => {
      setIsProcessing(false);
      setPaymentSuccess(true);
      processPayment(project.id, balanceDue, provider, generatedTxn);

      setTimeout(() => {
        setPaymentSuccess(false);
        setIsPaymentModalOpen(false);
      }, 2000);
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <CreditCard size={18} />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white">Settle Balance Invoice</h3>
              <p className="text-xs text-zinc-400 font-mono">
                {project.invoiceNumber} · {project.title}
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsPaymentModalOpen(false)}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {paymentSuccess ? (
          <div className="py-8 text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto animate-bounce">
              <Check size={28} />
            </div>
            <h4 className="text-lg font-bold text-white">Payment Confirmed!</h4>
            <p className="text-xs text-zinc-400">
              Transaction ID: <span className="font-mono text-emerald-400">{txnId}</span>
            </p>
            <p className="text-xs text-zinc-300">
              Final masters and delivery stems are now unlocked.
            </p>
          </div>
        ) : (
          <form onSubmit={handlePay} className="space-y-4 text-xs">
            {/* Amount Summary */}
            <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800 flex justify-between items-center">
              <div>
                <span className="text-[11px] text-zinc-400 block uppercase">Outstanding Balance</span>
                <span className="text-xs text-zinc-300">{project.clientName}</span>
              </div>
              <span className="text-2xl font-mono font-bold text-emerald-400 tabular-nums">
                {currencySymbol}{balanceDue.toLocaleString()}
              </span>
            </div>

            {/* Provider Abstraction Selector */}
            <div className="space-y-1.5">
              <label className="block text-zinc-400 font-medium">Payment Gateway Provider</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setProvider('razorpay')}
                  className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                    provider === 'razorpay'
                      ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400 shadow-sm'
                      : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                >
                  <Zap size={14} />
                  <span>Razorpay (UPI / Netbanking)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setProvider('stripe')}
                  className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                    provider === 'stripe'
                      ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400 shadow-sm'
                      : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                >
                  <CreditCard size={14} />
                  <span>Stripe (Global Card)</span>
                </button>
              </div>
            </div>

            {/* Razorpay Sub-methods */}
            {provider === 'razorpay' && (
              <div className="space-y-3 pt-1">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('upi')}
                    className={`flex-1 py-1.5 rounded-lg border text-[11px] font-medium flex items-center justify-center gap-1.5 transition-colors ${
                      paymentMethod === 'upi' ? 'bg-zinc-800 border-zinc-600 text-white' : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                    }`}
                  >
                    <Smartphone size={13} /> UPI QR / VPA
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('netbanking')}
                    className={`flex-1 py-1.5 rounded-lg border text-[11px] font-medium flex items-center justify-center gap-1.5 transition-colors ${
                      paymentMethod === 'netbanking' ? 'bg-zinc-800 border-zinc-600 text-white' : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                    }`}
                  >
                    <Building size={13} /> Netbanking
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('card')}
                    className={`flex-1 py-1.5 rounded-lg border text-[11px] font-medium flex items-center justify-center gap-1.5 transition-colors ${
                      paymentMethod === 'card' ? 'bg-zinc-800 border-zinc-600 text-white' : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                    }`}
                  >
                    <CreditCard size={13} /> Card
                  </button>
                </div>

                {paymentMethod === 'upi' ? (
                  <div>
                    <label className="block text-zinc-400 mb-1">Enter UPI ID / Virtual Payment Address</label>
                    <input
                      type="text"
                      value={upiId}
                      onChange={(e) => setUpiId(e.target.value)}
                      placeholder="username@okhdfcbank"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-200 focus:outline-none focus:border-emerald-500 font-mono"
                    />
                  </div>
                ) : paymentMethod === 'netbanking' ? (
                  <div>
                    <label className="block text-zinc-400 mb-1">Select Bank</label>
                    <select className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-200 focus:outline-none focus:border-emerald-500">
                      <option>HDFC Bank - Retail</option>
                      <option>ICICI Bank</option>
                      <option>State Bank of India</option>
                      <option>Axis Bank</option>
                    </select>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-200 focus:outline-none focus:border-emerald-500 font-mono"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Stripe Card details */}
            {provider === 'stripe' && (
              <div className="space-y-3 pt-1">
                <div>
                  <label className="block text-zinc-400 mb-1">Card Number</label>
                  <input
                    type="text"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-200 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-zinc-400 mb-1">Expires</label>
                    <input
                      type="text"
                      value={cardExpiry}
                      onChange={(e) => setCardExpiry(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-200 focus:outline-none focus:border-emerald-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-400 mb-1">CVC</label>
                    <input
                      type="text"
                      value={cardCvc}
                      onChange={(e) => setCardCvc(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-200 focus:outline-none focus:border-emerald-500 font-mono"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Security notice */}
            <div className="flex items-center gap-2 text-[11px] text-zinc-400 bg-zinc-950/60 p-2.5 rounded-xl border border-zinc-800/80">
              <ShieldCheck size={14} className="text-emerald-400 shrink-0" />
              <span>256-bit encrypted checkout via {provider === 'razorpay' ? 'Razorpay India' : 'Stripe Inc'}. No client account required.</span>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsPaymentModalOpen(false)}
                className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isProcessing}
                className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Authorizing...</span>
                  </>
                ) : (
                  <>
                    <Lock size={14} />
                    <span>Pay {currencySymbol}{balanceDue}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
