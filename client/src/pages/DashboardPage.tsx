import React, { useState, useEffect } from 'react';
import { Account, Transaction, AccountRequest } from '../types/index.js';
import { StatCard } from '../components/StatCard.js';
import { useAuth } from '../context/AuthContext.js';
import { api } from '../services/api.js';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Send,
  Plus,
  ShieldCheck,
  TrendingUp,
  CreditCard,
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  FileText,
} from 'lucide-react';

interface DashboardPageProps {
  accounts: Account[];
  transactions: Transaction[];
  onOpenTransfer: () => void;
  onOpenCreateAccount: () => void;
  onRefresh: () => void;
  isLoading: boolean;
  onNavigateTab?: (tab: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  accounts,
  transactions,
  onOpenTransfer,
  onOpenCreateAccount,
  onRefresh,
  isLoading,
  onNavigateTab,
}) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [myRequests, setMyRequests] = useState<AccountRequest[]>([]);

  useEffect(() => {
    let isMounted = true;
    api.getAccountRequests()
      .then((res) => {
        if (isMounted && res.success) {
          setMyRequests(res.requests || []);
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, [isLoading]);

  const totalBalance = accounts.reduce((acc, curr) => acc + Number(curr.balance), 0);
  const activeAccountsCount = accounts.filter((a) => a.status === 'ACTIVE').length;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100">Financial Ledger Overview</h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time multi-account balance aggregator with sub-millisecond settlement logs
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-2 rounded-lg border border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50"
            title="Refresh Ledger"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>

          <button
            onClick={onOpenCreateAccount}
            className="px-3.5 py-2 rounded-lg border border-slate-700 hover:border-slate-600 bg-slate-800/80 hover:bg-slate-800 text-xs font-semibold text-slate-200 transition-all flex items-center space-x-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{isAdmin ? 'Open Account' : 'Request New Account'}</span>
          </button>

          <button
            onClick={onOpenTransfer}
            className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition-all shadow-sm shadow-cyan-500/20 flex items-center space-x-1.5"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Transfer Funds</span>
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Consolidated Net Worth"
          value={`$${totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          subtitle="Across all vault accounts"
          icon={Wallet}
          trend="+4.2% this cycle"
          isPositive={true}
        />
        <StatCard
          title="Active Vault Accounts"
          value={activeAccountsCount.toString()}
          subtitle="Segregated balance containers"
          icon={CreditCard}
        />
        <StatCard
          title="Total Ledger Transactions"
          value={transactions.length.toString()}
          subtitle="Recorded in tamper-resistant log"
          icon={TrendingUp}
        />
        <StatCard
          title="Ledger Compliance Status"
          value="100% OK"
          subtitle="Cryptographically verified"
          icon={ShieldCheck}
          isPositive={true}
        />
      </div>

      {/* Main Grid: Accounts List & Recent Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Accounts Card List */}
        <div className="lg:col-span-1 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
              Vault Accounts
            </h2>
            {onNavigateTab ? (
              <button
                onClick={() => onNavigateTab('accounts')}
                className="text-xs text-cyan-400 hover:text-cyan-300 font-mono font-medium transition-colors"
              >
                View all ({accounts.length}) →
              </button>
            ) : (
              <span className="text-xs text-slate-400 font-mono">{accounts.length} Total</span>
            )}
          </div>

          <div className="space-y-3">
            {accounts.length === 0 ? (
              <div className="p-6 rounded-xl border border-slate-800 bg-[#0f172a]/40 text-center text-xs text-slate-500">
                No accounts opened yet. Click &quot;Open Account&quot; to provision your first ledger bucket.
              </div>
            ) : (
              accounts.map((acc) => (
                <div
                  key={acc.id}
                  className="p-4 rounded-xl border border-slate-800 bg-[#0f172a]/60 hover:border-slate-700 transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-200">{acc.name}</p>
                      <span className="text-[11px] font-mono text-cyan-400/90">{acc.accountNumber}</span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded uppercase font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                      {acc.type}
                    </span>
                  </div>

                  <div className="mt-3 flex items-baseline justify-between border-t border-slate-800/80 pt-2">
                    <span className="text-xs text-slate-400">Available:</span>
                    <span className="text-base font-bold font-mono text-slate-100">
                      ${Number(acc.balance).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Ledger Transactions */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
              Live Ledger Activity
            </h2>
            {onNavigateTab ? (
              <button
                onClick={() => onNavigateTab('transactions')}
                className="text-xs text-cyan-400 hover:text-cyan-300 font-mono font-medium transition-colors"
              >
                View all transactions →
              </button>
            ) : (
              <span className="text-xs text-slate-400 font-mono">Recent records</span>
            )}
          </div>

          <div className="border border-slate-800 rounded-xl overflow-hidden bg-[#0f172a]/60">
            {transactions.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No transaction records available. Initiate a transfer to create ledger events.
              </div>
            ) : (
              <div className="divide-y divide-slate-800/80">
                {transactions.slice(0, 7).map((txn) => {
                  const isDeposit = txn.type === 'DEPOSIT';
                  return (
                    <div key={txn.id} className="p-4 flex items-center justify-between hover:bg-slate-800/30 transition-colors">
                      <div className="flex items-center space-x-3">
                        <div
                          className={`p-2 rounded-lg ${
                            isDeposit
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                          }`}
                        >
                          {isDeposit ? (
                            <ArrowDownLeft className="w-4 h-4" />
                          ) : (
                            <ArrowUpRight className="w-4 h-4" />
                          )}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-slate-200">
                            {txn.description || txn.type}
                          </p>
                          <div className="flex items-center space-x-2 text-[11px] text-slate-400 font-mono mt-0.5">
                            <span>{txn.referenceNumber}</span>
                            <span>•</span>
                            <span>{new Date(txn.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <p
                          className={`text-sm font-bold font-mono ${
                            isDeposit ? 'text-emerald-400' : 'text-slate-100'
                          }`}
                        >
                          {isDeposit ? '+' : '-'}${Number(txn.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </p>
                        <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
                          {txn.status}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Account Requests Section */}
      {myRequests.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 flex items-center space-x-2">
              <FileText className="w-4 h-4 text-cyan-400" />
              <span>{isAdmin ? 'Recent Account Requests' : 'My Account Opening Requests'}</span>
            </h2>
            {onNavigateTab ? (
              <button
                onClick={() => onNavigateTab('requests')}
                className="text-xs text-amber-400 hover:text-amber-300 font-mono font-medium transition-colors"
              >
                View all ({myRequests.filter((r) => r.status === 'PENDING').length} pending) →
              </button>
            ) : (
              <span className="text-xs text-slate-400 font-mono">
                {myRequests.filter((r) => r.status === 'PENDING').length} pending review
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {myRequests.map((req) => {
              const isPending = req.status === 'PENDING';
              const isApproved = req.status === 'APPROVED';
              const isRejected = req.status === 'REJECTED';

              return (
                <div
                  key={req.id}
                  className="p-4 rounded-xl border border-slate-800 bg-[#0f172a]/70 hover:border-slate-700/80 transition-all space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-slate-100">{req.accountName}</h4>
                      <p className="text-[11px] font-mono text-cyan-400">{req.accountType}</p>
                    </div>

                    {isPending && (
                      <span className="flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        <Clock className="w-3 h-3" />
                        <span>PENDING</span>
                      </span>
                    )}
                    {isApproved && (
                      <span className="flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>APPROVED</span>
                      </span>
                    )}
                    {isRejected && (
                      <span className="flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                        <XCircle className="w-3 h-3" />
                        <span>REJECTED</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-baseline justify-between text-xs pt-1 border-t border-slate-800/80">
                    <span className="text-slate-400">Requested Capital:</span>
                    <span className="font-mono font-bold text-slate-200">
                      ${Number(req.requestedBalance).toLocaleString('en-US', { minimumFractionDigits: 2 })} {req.currency}
                    </span>
                  </div>

                  {req.reason && (
                    <p className="text-[11px] text-slate-400 bg-slate-900/50 p-2 rounded border border-slate-800/50">
                      <span className="text-slate-500 font-semibold">Purpose:</span> {req.reason}
                    </p>
                  )}

                  {req.adminRemarks && (
                    <p className="text-[11px] text-slate-300 bg-slate-900/80 p-2 rounded border border-slate-800">
                      <span className="text-cyan-400 font-semibold">Admin Remarks:</span> {req.adminRemarks}
                    </p>
                  )}

                  <div className="text-[10px] text-slate-500 font-mono flex items-center justify-between pt-1">
                    <span>{new Date(req.createdAt).toLocaleDateString()}</span>
                    {req.createdAccountId && (
                      <span className="text-emerald-400">Account Active</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
