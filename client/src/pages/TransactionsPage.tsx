import React, { useState } from 'react';
import { Transaction } from '../types/index.js';
import {
  ArrowUpRight,
  ArrowDownLeft,
  ArrowLeftRight,
  Search,
  Filter,
  Send,
  Calendar,
  DollarSign
} from 'lucide-react';

interface TransactionsPageProps {
  transactions: Transaction[];
  onRefresh: () => void;
  isLoading: boolean;
  onOpenTransactionModal?: () => void;
}

export const TransactionsPage: React.FC<TransactionsPageProps> = ({
  transactions,
  isLoading,
  onOpenTransactionModal,
}) => {
  const [filterType, setFilterType] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<string>('ALL');
  const [minAmount, setMinAmount] = useState<string>('');
  const [maxAmount, setMaxAmount] = useState<string>('');

  const filteredTransactions = transactions.filter((txn) => {
    // Type filter
    const matchesType = filterType === 'ALL' || txn.type === filterType;

    // Search filter
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      !searchTerm ||
      txn.referenceNumber.toLowerCase().includes(q) ||
      (txn.description && txn.description.toLowerCase().includes(q)) ||
      (txn.sourceAccount?.accountNumber && txn.sourceAccount.accountNumber.toLowerCase().includes(q)) ||
      (txn.destinationAccount?.accountNumber && txn.destinationAccount.accountNumber.toLowerCase().includes(q));

    // Amount range
    const numAmt = Number(txn.amount);
    const matchesMin = !minAmount || numAmt >= parseFloat(minAmount);
    const matchesMax = !maxAmount || numAmt <= parseFloat(maxAmount);

    // Date range
    let matchesDate = true;
    if (dateFilter !== 'ALL') {
      const txnDate = new Date(txn.createdAt).getTime();
      const now = Date.now();
      if (dateFilter === 'TODAY') {
        matchesDate = now - txnDate <= 24 * 60 * 60 * 1000;
      } else if (dateFilter === '7D') {
        matchesDate = now - txnDate <= 7 * 24 * 60 * 60 * 1000;
      } else if (dateFilter === '30D') {
        matchesDate = now - txnDate <= 30 * 24 * 60 * 60 * 1000;
      }
    }

    return matchesType && matchesSearch && matchesMin && matchesMax && matchesDate;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-100">Ledger Transactions</h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded uppercase font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              Double-Entry Settlement
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Immutable transaction record verified with atomic ledger debits and credits
          </p>
        </div>

        {onOpenTransactionModal && (
          <button
            onClick={onOpenTransactionModal}
            className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition-all shadow-sm shadow-cyan-500/20 flex items-center space-x-1.5 self-start sm:self-auto"
          >
            <Send className="w-3.5 h-3.5" />
            <span>New Transaction</span>
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="space-y-3 bg-[#0f172a]/70 p-4 rounded-xl border border-slate-800">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-96">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search reference, account, or memo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700/80 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500 placeholder:text-slate-500 font-mono"
            />
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            <Filter className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="text-xs text-slate-400 shrink-0">Type:</span>
            {['ALL', 'TRANSFER', 'DEPOSIT', 'WITHDRAWAL'].map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  filterType === type
                    ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Secondary Filters: Date Range & Amount */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t border-slate-800/80 text-xs">
          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400">Date:</span>
            {[
              { id: 'ALL', label: 'All Time' },
              { id: 'TODAY', label: '24 Hours' },
              { id: '7D', label: '7 Days' },
              { id: '30D', label: '30 Days' },
            ].map((d) => (
              <button
                key={d.id}
                onClick={() => setDateFilter(d.id)}
                className={`px-2.5 py-1 rounded text-[11px] font-medium transition-all ${
                  dateFilter === d.id ? 'bg-slate-800 text-cyan-400 border border-slate-700' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <DollarSign className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400">Amount:</span>
            <input
              type="number"
              placeholder="Min $"
              value={minAmount}
              onChange={(e) => setMinAmount(e.target.value)}
              className="w-20 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-200 font-mono text-[11px] focus:outline-none focus:border-cyan-500"
            />
            <span className="text-slate-600">-</span>
            <input
              type="number"
              placeholder="Max $"
              value={maxAmount}
              onChange={(e) => setMaxAmount(e.target.value)}
              className="w-20 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-200 font-mono text-[11px] focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="border border-slate-800 rounded-xl overflow-hidden bg-[#0f172a]/60">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/80 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Reference</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Accounts Involved</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500 font-sans">
                    Loading ledger transactions...
                  </td>
                </tr>
              ) : filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500 font-sans">
                    No transactions match your current search or filter.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((txn) => {
                  const isDeposit = txn.type === 'DEPOSIT';
                  const isWithdrawal = txn.type === 'WITHDRAWAL';
                  const isTransfer = txn.type === 'TRANSFER';

                  return (
                    <tr key={txn.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4 text-cyan-400 font-semibold">{txn.referenceNumber}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold inline-flex items-center space-x-1 ${
                            isDeposit
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : isWithdrawal
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                          }`}
                        >
                          {isDeposit && <ArrowDownLeft className="w-3 h-3 mr-0.5" />}
                          {isWithdrawal && <ArrowUpRight className="w-3 h-3 mr-0.5" />}
                          {isTransfer && <ArrowLeftRight className="w-3 h-3 mr-0.5" />}
                          <span>{txn.type}</span>
                        </span>
                      </td>
                      <td
                        className={`py-3 px-4 font-bold ${
                          isDeposit ? 'text-emerald-400' : isWithdrawal ? 'text-rose-400' : 'text-slate-100'
                        }`}
                      >
                        {isDeposit ? '+' : isWithdrawal ? '-' : ''}$
                        {Number(txn.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-slate-300">
                        {isTransfer ? (
                          <div className="flex items-center space-x-1 text-[11px]">
                            <span className="text-slate-400">{txn.sourceAccount?.accountNumber || 'SRC'}</span>
                            <span className="text-cyan-500">→</span>
                            <span className="text-slate-200">{txn.destinationAccount?.accountNumber || 'DEST'}</span>
                          </div>
                        ) : isDeposit ? (
                          <div className="text-[11px] text-slate-400">
                            Clearing Ext → <span className="text-slate-200">{txn.destinationAccount?.accountNumber || 'Account'}</span>
                          </div>
                        ) : (
                          <div className="text-[11px] text-slate-400">
                            <span className="text-slate-200">{txn.sourceAccount?.accountNumber || 'Account'}</span> → External
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          {txn.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-400 text-xs font-sans truncate max-w-xs">
                        {txn.description || 'Ledger event'}
                      </td>
                      <td className="py-3 px-4 text-slate-500 text-[11px]">
                        {new Date(txn.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
export default TransactionsPage;
