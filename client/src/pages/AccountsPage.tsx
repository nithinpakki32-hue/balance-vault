import React, { useState } from 'react';
import { Account } from '../types/index.js';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.js';
import { Wallet, Plus, Copy, Check, ArrowDownLeft, Shield } from 'lucide-react';

interface AccountsPageProps {
  accounts: Account[];
  onOpenCreateAccount: () => void;
  onRefresh: () => void;
}

export const AccountsPage: React.FC<AccountsPageProps> = ({
  accounts,
  onOpenCreateAccount,
  onRefresh,
}) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [depositModalAccount, setDepositModalAccount] = useState<Account | null>(null);
  const [depositAmount, setDepositAmount] = useState('500');
  const [isDepositing, setIsDepositing] = useState(false);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!depositModalAccount) return;
    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount <= 0) return;

    setIsDepositing(true);
    try {
      await api.deposit({
        accountId: depositModalAccount.id,
        amount,
        description: 'Account balance top-up',
      });
      setDepositModalAccount(null);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Deposit failed');
    } finally {
      setIsDepositing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100">Vault Accounts</h1>
          <p className="text-xs text-slate-400 mt-1">
            Manage your segregated liquidity accounts, review account numbers, and deposit reserves
          </p>
        </div>

        <button
          onClick={onOpenCreateAccount}
          className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition-all shadow-sm shadow-cyan-500/20 flex items-center space-x-1.5 self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{isAdmin ? 'New Account' : 'Request Account'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {accounts.map((acc) => (
          <div
            key={acc.id}
            className="p-6 rounded-2xl border border-slate-800 bg-[#0f172a]/70 hover:border-slate-700/80 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  <Wallet className="w-5 h-5" />
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded uppercase font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                    {acc.type}
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded uppercase font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    {acc.status}
                  </span>
                </div>
              </div>

              <h3 className="text-base font-bold text-slate-100">{acc.name}</h3>

              <div className="mt-2 flex items-center space-x-2 text-xs text-slate-400 font-mono bg-slate-900/80 px-2.5 py-1.5 rounded-lg border border-slate-800">
                <span className="text-cyan-400">{acc.accountNumber}</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(acc.accountNumber, acc.id)}
                  className="text-slate-400 hover:text-slate-200"
                  title="Copy Account Number"
                >
                  {copiedId === acc.id ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>

              <div className="mt-6">
                <span className="text-xs text-slate-400 uppercase tracking-wider block font-medium">
                  Current Balance
                </span>
                <span className="text-2xl font-bold font-mono text-slate-100 mt-1 block">
                  ${Number(acc.balance).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between">
              <span className="text-[11px] text-slate-500 font-mono flex items-center space-x-1">
                <Shield className="w-3 h-3 text-cyan-400/80" />
                <span>FDIC Equivalent Vaulted</span>
              </span>

              <button
                onClick={() => setDepositModalAccount(acc)}
                className="px-3 py-1.5 rounded-lg border border-slate-700 hover:border-slate-600 bg-slate-800/80 hover:bg-slate-800 text-xs font-semibold text-slate-200 transition-all flex items-center space-x-1"
              >
                <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-400" />
                <span>Top-up</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Top-up Modal */}
      {depositModalAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-[#0f172a] border border-slate-800 rounded-2xl shadow-2xl p-6">
            <h3 className="text-base font-bold text-slate-100 mb-1">
              Top-up {depositModalAccount.name}
            </h3>
            <p className="text-xs text-slate-400 mb-4 font-mono">
              Account: {depositModalAccount.accountNumber}
            </p>

            <form onSubmit={handleDeposit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Amount to Add (USD)</label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  required
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDepositModalAccount(null)}
                  className="flex-1 py-2 rounded-lg border border-slate-700 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isDepositing}
                  className="flex-1 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs"
                >
                  {isDepositing ? 'Processing...' : 'Confirm Top-up'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
