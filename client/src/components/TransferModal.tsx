import React, { useState } from 'react';
import { Account } from '../types/index.js';
import { api } from '../services/api.js';
import { X, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';

interface TransferModalProps {
  accounts: Account[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const TransferModal: React.FC<TransferModalProps> = ({
  accounts,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [sourceAccountId, setSourceAccountId] = useState<string>(accounts[0]?.id || '');
  const [destAccountNumber, setDestAccountNumber] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const selectedSourceAccount = accounts.find((a) => a.id === sourceAccountId) || accounts[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Please specify a positive transfer amount.');
      return;
    }

    if (selectedSourceAccount && numAmount > Number(selectedSourceAccount.balance)) {
      setError(`Insufficient balance. Maximum transferrable: $${Number(selectedSourceAccount.balance).toFixed(2)}`);
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await api.transfer({
        sourceAccountId: selectedSourceAccount.id,
        destinationAccountNumber: destAccountNumber.trim(),
        amount: numAmount,
        description: description.trim() || undefined,
      });

      if (response.success) {
        setSuccessMsg(`Transfer of $${numAmount.toFixed(2)} executed successfully! Ref: ${response.transaction.referenceNumber}`);
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1200);
      }
    } catch (err: any) {
      setError(err.message || 'Transfer failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md bg-[#0f172a] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-slate-100">Send Funds</h3>
            <p className="text-xs text-slate-400">Atomic ledger transfer</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Source Account</label>
            <select
              value={sourceAccountId}
              onChange={(e) => setSourceAccountId(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500"
            >
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} ({acc.accountNumber}) - ${Number(acc.balance).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Destination Account Number</label>
            <input
              type="text"
              placeholder="e.g. BV-TREASURY-001 or BV-SAV-883012"
              value={destAccountNumber}
              onChange={(e) => setDestAccountNumber(e.target.value)}
              required
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Amount (USD)</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Description / Memo (Optional)</label>
            <input
              type="text"
              placeholder="e.g. Escrow payout, Vendor payment"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-sm transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              <span>{isSubmitting ? 'Verifying & Executing...' : 'Confirm Transfer'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
