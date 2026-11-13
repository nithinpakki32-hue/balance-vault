import React, { useState } from 'react';
import { AccountType } from '../types/index.js';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.js';
import { X, Plus, AlertCircle, FileText, CheckCircle2 } from 'lucide-react';

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
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('CHECKING');
  const [balance, setBalance] = useState('0');
  const [currency, setCurrency] = useState('USD');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const numBal = parseFloat(balance);
    if (isNaN(numBal) || numBal < 0) {
      setError('Opening balance cannot be negative.');
      return;
    }

    if (name.trim().length < 2) {
      setError('Account name must be at least 2 characters.');
      return;
    }

    const requestReason = reason.trim() || 'Standard operational vault account';

    setIsSubmitting(true);
    try {
      if (isAdmin) {
        // Administrator direct account opening
        const response = await api.createAccount({
          name: name.trim(),
          type,
          initialBalance: numBal,
          currency,
        });

        if (response.success) {
          onSuccess();
          onClose();
        }
      } else {
        // Account Holder approval workflow
        const response = await api.requestAccount({
          accountName: name.trim(),
          accountType: type,
          requestedBalance: numBal,
          currency,
          reason: requestReason,
        });

        if (response.success) {
          setSuccessMsg('Your account request has been submitted successfully. Waiting for Admin approval.');
          setTimeout(() => {
            onSuccess();
            onClose();
          }, 1400);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to submit account request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md bg-[#0f172a] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-slate-100">
              Open New Vault Account
            </h3>
            <p className="text-xs text-slate-400">
              {isAdmin
                ? 'Direct administrative account provisioning with double-entry ledger'
                : 'Account opening proposal will be submitted to Administrator for mandatory review and approval'}
            </p>
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Account Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as AccountType)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500"
              >
                <option value="CHECKING">CHECKING</option>
                <option value="SAVINGS">SAVINGS</option>
                <option value="INVESTMENT">INVESTMENT</option>
                <option value="ESCROW">ESCROW</option>
                {isAdmin && <option value="TREASURY">TREASURY</option>}
                {isAdmin && <option value="SETTLEMENT_CLEARING">CLEARING</option>}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500"
              >
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              {isAdmin ? 'Initial Opening Balance' : 'Requested Opening Balance'}
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              {isAdmin
                ? 'Opening balance will be credited and verified against settlement clearing.'
                : 'Funds will be verified and funded only upon administrator approval.'}
            </p>
          </div>

          {!isAdmin && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Reason for Opening Account <span className="text-rose-400">*</span>
              </label>
              <textarea
                rows={3}
                placeholder="State the business purpose (e.g. Segregated escrow for contract deposits)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500 resize-none"
              />
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting || !!successMsg}
              className="w-full py-2.5 px-4 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-sm transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              {isAdmin ? <Plus className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
              <span>
                {isSubmitting
                  ? (isAdmin ? 'Provisioning...' : 'Submitting Request...')
                  : 'Open Account'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
