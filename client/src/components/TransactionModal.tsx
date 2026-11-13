import React, { useState } from 'react';
import { Account } from '../types/index.js';
import { api } from '../services/api.js';
import { X, Send, ArrowDownToLine, ArrowUpFromLine, AlertCircle, CheckCircle2, ShieldCheck } from 'lucide-react';

interface TransactionModalProps {
  accounts: Account[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialTab?: 'transfer' | 'deposit' | 'withdraw';
}

export const TransactionModal: React.FC<TransactionModalProps> = ({
  accounts,
  isOpen,
  onClose,
  onSuccess,
  initialTab = 'transfer',
}) => {
  const [activeTab, setActiveTab] = useState<'transfer' | 'deposit' | 'withdraw'>(initialTab);
  const [sourceAccountId, setSourceAccountId] = useState<string>(accounts[0]?.id || '');
  const [targetAccountId, setTargetAccountId] = useState<string>(accounts[0]?.id || '');
  const [destAccountNumber, setDestAccountNumber] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const selectedSourceAccount = accounts.find((a) => a.id === sourceAccountId) || accounts[0];
  const selectedTargetAccount = accounts.find((a) => a.id === targetAccountId) || accounts[0];

  const generateIdempotencyKey = (prefix: string) => {
    return `BV-${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Please specify a positive transaction amount.');
      return;
    }

    if (activeTab === 'transfer' || activeTab === 'withdraw') {
      if (selectedSourceAccount && numAmount > Number(selectedSourceAccount.balance)) {
        setError(`Insufficient balance. Available: $${Number(selectedSourceAccount.balance).toFixed(2)}`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      if (activeTab === 'transfer') {
        if (!destAccountNumber.trim()) {
          setError('Please provide the destination account number.');
          setIsSubmitting(false);
          return;
        }

        const idempKey = generateIdempotencyKey('XFR');
        const res = await api.transfer(
          {
            sourceAccountId: selectedSourceAccount.id,
            destinationAccountNumber: destAccountNumber.trim(),
            amount: numAmount,
            description: description.trim() || undefined,
          },
          idempKey
        );

        if (res.success) {
          setSuccessMsg(`Transfer of $${numAmount.toFixed(2)} completed! Ref: ${res.transaction?.referenceNumber || idempKey}`);
          setTimeout(() => {
            onSuccess();
            onClose();
          }, 1300);
        }
      } else if (activeTab === 'deposit') {
        const idempKey = generateIdempotencyKey('DEP');
        const res = await api.deposit(
          {
            accountId: selectedTargetAccount.id,
            amount: numAmount,
            description: description.trim() || 'Direct ledger credit deposit',
          },
          idempKey
        );

        if (res.success) {
          setSuccessMsg(`Deposit of $${numAmount.toFixed(2)} credited! Ref: ${res.transaction?.referenceNumber || idempKey}`);
          setTimeout(() => {
            onSuccess();
            onClose();
          }, 1300);
        }
      } else if (activeTab === 'withdraw') {
        const idempKey = generateIdempotencyKey('WTH');
        const res = await api.withdraw(
          {
            accountId: selectedSourceAccount.id,
            amount: numAmount,
            description: description.trim() || 'Direct ledger debit withdrawal',
          },
          idempKey
        );

        if (res.success) {
          setSuccessMsg(`Withdrawal of $${numAmount.toFixed(2)} executed! Ref: ${res.transaction?.referenceNumber || idempKey}`);
          setTimeout(() => {
            onSuccess();
            onClose();
          }, 1300);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Transaction failed to commit.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-[#0f172a] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-slate-100 flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
              <span>Vault Financial Transaction</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Atomic double-entry ledger settlement with idempotency protection
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab selection */}
        <div className="grid grid-cols-3 border-b border-slate-800 bg-slate-900/50">
          <button
            type="button"
            onClick={() => { setActiveTab('transfer'); setError(null); setSuccessMsg(null); }}
            className={`py-3 text-xs font-semibold flex items-center justify-center space-x-2 border-b-2 transition-all ${
              activeTab === 'transfer'
                ? 'border-cyan-400 text-cyan-400 bg-cyan-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>Transfer</span>
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('deposit'); setError(null); setSuccessMsg(null); }}
            className={`py-3 text-xs font-semibold flex items-center justify-center space-x-2 border-b-2 transition-all ${
              activeTab === 'deposit'
                ? 'border-emerald-400 text-emerald-400 bg-emerald-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ArrowDownToLine className="w-3.5 h-3.5" />
            <span>Deposit</span>
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('withdraw'); setError(null); setSuccessMsg(null); }}
            className={`py-3 text-xs font-semibold flex items-center justify-center space-x-2 border-b-2 transition-all ${
              activeTab === 'withdraw'
                ? 'border-rose-400 text-rose-400 bg-rose-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ArrowUpFromLine className="w-3.5 h-3.5" />
            <span>Withdraw</span>
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

          {activeTab === 'transfer' && (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Source Vault Account</label>
                <select
                  value={sourceAccountId}
                  onChange={(e) => setSourceAccountId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500 font-mono"
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({acc.accountNumber}) — ${Number(acc.balance).toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Destination Account Number</label>
                <input
                  type="text"
                  placeholder="e.g. ACC-CHK-002 or BV-948194"
                  value={destAccountNumber}
                  onChange={(e) => setDestAccountNumber(e.target.value)}
                  required
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>
            </>
          )}

          {activeTab === 'deposit' && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Target Account (To Credit)</label>
              <select
                value={targetAccountId}
                onChange={(e) => setTargetAccountId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500 font-mono"
              >
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({acc.accountNumber}) — ${Number(acc.balance).toFixed(2)}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-500 mt-1">
                Funds funded via institutional external clearing container (acc-clearing-ext).
              </p>
            </div>
          )}

          {activeTab === 'withdraw' && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Source Account (To Debit)</label>
              <select
                value={sourceAccountId}
                onChange={(e) => setSourceAccountId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500 font-mono"
              >
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({acc.accountNumber}) — ${Number(acc.balance).toFixed(2)}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-500 mt-1">
                Disbursement dispatched externally via double-entry debit.
              </p>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Amount (USD)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-sm">$</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-7 pr-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Transaction Description / Memo</label>
            <input
              type="text"
              placeholder="e.g. Monthly vendor settlement, Treasury transfer"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="pt-2 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 border border-slate-800 hover:bg-slate-800/50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || accounts.length === 0}
              className={`px-5 py-2 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 shadow-sm disabled:opacity-50 ${
                activeTab === 'transfer'
                  ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-cyan-500/20'
                  : activeTab === 'deposit'
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20'
                  : 'bg-rose-500 hover:bg-rose-400 text-white shadow-rose-500/20'
              }`}
            >
              {isSubmitting ? (
                <>
                  <div className="h-3 w-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  <span>Committing...</span>
                </>
              ) : (
                <span>
                  {activeTab === 'transfer' ? 'Send Transfer' : activeTab === 'deposit' ? 'Credit Deposit' : 'Execute Withdrawal'}
                </span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
