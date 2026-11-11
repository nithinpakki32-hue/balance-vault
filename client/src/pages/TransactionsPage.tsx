import React, { useState } from 'react';
import { Transaction } from '../types/index.js';
import { ArrowUpRight, ArrowDownLeft, Search, Filter, ShieldCheck } from 'lucide-react';

interface TransactionsPageProps {
  transactions: Transaction[];
  onRefresh: () => void;
  isLoading: boolean;
}

export const TransactionsPage: React.FC<TransactionsPageProps> = ({
  transactions,
  isLoading,
}) => {
  const [filterType, setFilterType] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const filteredTransactions = transactions.filter((txn) => {
    const matchesType = filterType === 'ALL' || txn.type === filterType;
    const matchesSearch =
      searchTerm === '' ||
      txn.referenceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (txn.description && txn.description.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesType && matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100">Ledger Transactions</h1>
          <p className="text-xs text-slate-400 mt-1">
            Immutable event history recording debits, credits, and atomic settlement transitions
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#0f172a]/70 p-4 rounded-xl border border-slate-800">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search by reference or memo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700/80 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500 placeholder:text-slate-500"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-xs text-slate-400">Filter:</span>
          {['ALL', 'TRANSFER', 'DEPOSIT'].map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
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
                  return (
                    <tr key={txn.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-bold text-cyan-400">
                        {txn.referenceNumber}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center space-x-1 font-sans font-semibold">
                          {isDeposit ? (
                            <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-400 mr-1" />
                          ) : (
                            <ArrowUpRight className="w-3.5 h-3.5 text-cyan-400 mr-1" />
                          )}
                          <span className={isDeposit ? 'text-emerald-400' : 'text-cyan-400'}>
                            {txn.type}
                          </span>
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-100">
                        ${Number(txn.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-slate-300 font-sans">
                        <div className="space-y-0.5 text-[11px]">
                          {txn.sourceAccount && (
                            <div className="text-slate-400">
                              From: <span className="font-mono text-slate-200">{txn.sourceAccount.accountNumber}</span>
                            </div>
                          )}
                          {txn.destinationAccount && (
                            <div className="text-slate-400">
                              To: <span className="font-mono text-slate-200">{txn.destinationAccount.accountNumber}</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <ShieldCheck className="w-3 h-3 mr-1" />
                          {txn.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-400 font-sans max-w-xs truncate">
                        {txn.description || '—'}
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
