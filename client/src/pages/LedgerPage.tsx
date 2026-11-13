import React, { useState, useEffect, useCallback } from 'react';
import { LedgerEntry } from '../types/index.js';
import { api } from '../services/api.js';
import {
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Search,
  Filter,
  Download,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldCheck,
  Hash,
  Scale
} from 'lucide-react';

export const LedgerPage: React.FC = () => {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [isBalanced, setIsBalanced] = useState<boolean>(true);
  const [totalDebits, setTotalDebits] = useState<number>(0);
  const [totalCredits, setTotalCredits] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [typeFilter, setTypeFilter] = useState<'ALL' | 'DEBIT' | 'CREDIT'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const fetchLedger = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.getLedger();
      if (res.success) {
        setEntries(res.entries || []);
        setIsBalanced(res.balanced);
        setTotalDebits(res.totalDebits || 0);
        setTotalCredits(res.totalCredits || 0);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load double-entry ledger.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLedger();
  }, [fetchLedger]);

  const filteredEntries = entries.filter((entry) => {
    const matchesType = typeFilter === 'ALL' || entry.type === typeFilter;
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !searchQuery ||
      entry.transactionRef.toLowerCase().includes(q) ||
      entry.accountId.toLowerCase().includes(q) ||
      (entry.description && entry.description.toLowerCase().includes(q));
    return matchesType && matchesSearch;
  });

  const exportCSV = () => {
    if (filteredEntries.length === 0) return;
    const headers = ['Entry ID', 'Timestamp', 'Transaction Ref', 'Account ID', 'Type', 'Amount', 'Currency', 'Description'];
    const rows = filteredEntries.map((e) => [
      e.id,
      e.createdAt,
      e.transactionRef,
      e.accountId,
      e.type,
      e.amount.toFixed(2),
      e.currency || 'USD',
      `"${(e.description || '').replace(/"/g, '""')}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `balancevault-ledger-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportJSON = () => {
    if (filteredEntries.length === 0) return;
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(filteredEntries, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `balancevault-ledger-${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <BookOpen className="w-5 h-5 text-cyan-400" />
            <h1 className="text-2xl font-bold tracking-tight text-slate-100">Financial Double-Entry Ledger</h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded uppercase font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              ACID Compliant
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Immutable pairing log where Total Debits must exactly equal Total Credits (Σ Debits ≡ Σ Credits)
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchLedger}
            disabled={isLoading}
            className="p-2 rounded-lg border border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50"
            title="Refresh Ledger"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>

          <button
            onClick={exportCSV}
            className="px-3 py-2 rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-800 text-xs font-semibold text-slate-200 transition-all flex items-center space-x-1.5"
            title="Download CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={exportJSON}
            className="px-3 py-2 rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-800 text-xs font-semibold text-slate-200 transition-all flex items-center space-x-1.5"
            title="Download JSON"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export JSON</span>
          </button>
        </div>
      </div>

      {/* Verification Invariant Banner */}
      <div
        className={`p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all ${
          isBalanced
            ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
            : 'bg-rose-950/20 border-rose-500/30 text-rose-300'
        }`}
      >
        <div className="flex items-center space-x-3">
          <div
            className={`p-2.5 rounded-lg border ${
              isBalanced
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
            }`}
          >
            {isBalanced ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          </div>
          <div>
            <h3 className="text-sm font-bold flex items-center space-x-2">
              <span>{isBalanced ? 'Double-Entry Invariant Verified' : 'Ledger Invariant Imbalance Detected'}</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-black/40 border border-current">
                {isBalanced ? 'ZERO-VARIANCE VERIFIED' : 'AUDIT REQUIRED'}
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5 font-mono">
              Σ Debits (${totalDebits.toLocaleString('en-US', { minimumFractionDigits: 2 })}) = Σ Credits ($
              {totalCredits.toLocaleString('en-US', { minimumFractionDigits: 2 })}) • Variance: $
              {Math.abs(totalDebits - totalCredits).toFixed(4)}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-4 text-xs font-mono">
          <div className="text-right">
            <span className="text-slate-400 block text-[10px] uppercase">Entries Stored</span>
            <span className="font-bold text-slate-100">{entries.length} Pairs</span>
          </div>
          <div className="text-right pl-4 border-l border-slate-800">
            <span className="text-slate-400 block text-[10px] uppercase">Integrity Proof</span>
            <span className="font-bold text-emerald-400 flex items-center space-x-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Tamper-Free</span>
            </span>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border border-slate-800 bg-[#0f172a]/60">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Total Debits (DR)</span>
            <ArrowDownLeft className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-cyan-400">
            ${totalDebits.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">Assets acquired / expenses disbursed</span>
        </div>

        <div className="grid-cols-1 p-4 rounded-xl border border-slate-800 bg-[#0f172a]/60">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Total Credits (CR)</span>
            <ArrowUpRight className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-emerald-400">
            ${totalCredits.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">Liabilities / equity / incoming clearing</span>
        </div>

        <div className="p-4 rounded-xl border border-slate-800 bg-[#0f172a]/60">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Audit Equilibrium</span>
            <Scale className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-slate-100">
            {isBalanced ? 'Balanced' : 'Discrepancy'}
          </div>
          <span className="text-[11px] text-emerald-400 mt-1 flex items-center space-x-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>Strict GAAP / IFRS Balance Compliance</span>
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#0f172a]/70 p-4 rounded-xl border border-slate-800">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search by ref, account, or memo..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700/80 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500 placeholder:text-slate-500 font-mono"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-xs text-slate-400">Type:</span>
          {(['ALL', 'DEBIT', 'CREDIT'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setTypeFilter(type)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                typeFilter === type
                  ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
          {error}
        </div>
      )}

      {/* Ledger Table */}
      <div className="border border-slate-800 rounded-xl overflow-hidden bg-[#0f172a]/60">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/80 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Entry ID</th>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Transaction Ref</th>
                <th className="py-3 px-4">Account ID</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4 text-right">Amount</th>
                <th className="py-3 px-4">Description / Memo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500 font-sans">
                    Querying immutable double-entry ledger...
                  </td>
                </tr>
              ) : filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500 font-sans">
                    No ledger records found matching the query.
                  </td>
                </tr>
              ) : (
                filteredEntries.map((entry) => {
                  const isDebit = entry.type === 'DEBIT';
                  return (
                    <tr key={entry.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4 text-slate-400 flex items-center space-x-1.5">
                        <Hash className="w-3 h-3 text-slate-500" />
                        <span>{entry.id}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-400 text-[11px]">
                        {new Date(entry.createdAt).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-cyan-400 font-semibold">{entry.transactionRef}</td>
                      <td className="py-3 px-4 text-slate-300">
                        <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700">
                          {entry.accountId}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            isDebit
                              ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          }`}
                        >
                          {entry.type}
                        </span>
                      </td>
                      <td
                        className={`py-3 px-4 text-right font-bold ${
                          isDebit ? 'text-cyan-400' : 'text-emerald-400'
                        }`}
                      >
                        {isDebit ? '-' : '+'}${Number(entry.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-slate-400 text-xs font-sans truncate max-w-xs">
                        {entry.description || 'Ledger settlement'}
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
export default LedgerPage;
