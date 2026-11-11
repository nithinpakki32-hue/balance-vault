import React, { useState } from 'react';
import { AccountType } from '../types/index.js';
import { api } from '../services/api.js';
import { X, Plus, AlertCircle } from 'lucide-react';

interface CreateAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CreateAccountModal: React.FC<CreateAccountModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('CHECKING');
  const [initialBalance, setInitialBalance] = useState('0');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const initBal = parseFloat(initialBalance);
    if (isNaN(initBal) || initBal < 0) {
      setError('Initial balance cannot be negative.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await api.createAccount({
        name: name.trim(),
        type,
        initialBalance: initBal,
      });

      if (response.success) {
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md bg-[#0f172a] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-slate-100">Open New Vault Account</h3>
            <p className="text-xs text-slate-400">Instantly provision an account with dedicated ledger tracking</p>
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

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Account Label / Name</label>
            <input
              type="text"
              placeholder="e.g. Operations Checking, Vault Reserve"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Account Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as AccountType)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500"
            >
              <option value="CHECKING">CHECKING - High-velocity daily transactions</option>
              <option value="SAVINGS">SAVINGS - High-yield reserve vault</option>
              <option value="INVESTMENT">INVESTMENT - Portfolio asset holding</option>
              <option value="ESCROW">ESCROW - Conditional settlement holds</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Initial Opening Balance (USD)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={initialBalance}
              onChange={(e) => setInitialBalance(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-sm transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              <span>{isSubmitting ? 'Provisioning...' : 'Open Account'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
