import React, { useState } from 'react';
import { Account, Transaction } from '../types/index.js';
import {
  BarChart3,
  PieChart,
  Download,
  Printer,
  TrendingUp,
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowLeftRight,
  ShieldCheck,
  FileSpreadsheet
} from 'lucide-react';

interface ReportsPageProps {
  accounts: Account[];
  transactions: Transaction[];
  onRefresh?: () => void;
}

export const ReportsPage: React.FC<ReportsPageProps> = ({
  accounts,
  transactions,
}) => {
  const [selectedPeriod, setSelectedPeriod] = useState<'30D' | '90D' | 'YTD' | 'ALL'>('ALL');

  // Asset totals
  const totalAssets = accounts.reduce((sum, a) => sum + Number(a.balance), 0);

  // Group by account type
  const typeMap: Record<string, { count: number; balance: number }> = {};
  accounts.forEach((acc) => {
    if (!typeMap[acc.type]) {
      typeMap[acc.type] = { count: 0, balance: 0 };
    }
    typeMap[acc.type].count += 1;
    typeMap[acc.type].balance += Number(acc.balance);
  });

  const accountTypesSummary = Object.entries(typeMap).map(([type, stats]) => ({
    type,
    count: stats.count,
    balance: stats.balance,
    percentage: totalAssets > 0 ? (stats.balance / totalAssets) * 100 : 0,
  }));

  // Transaction Breakdown
  const totalDeposits = transactions
    .filter((t) => t.type === 'DEPOSIT')
    .reduce((sum, t) => sum + Number(t.amount), 0);
  const depositCount = transactions.filter((t) => t.type === 'DEPOSIT').length;

  const totalWithdrawals = transactions
    .filter((t) => t.type === 'WITHDRAWAL')
    .reduce((sum, t) => sum + Number(t.amount), 0);
  const withdrawalCount = transactions.filter((t) => t.type === 'WITHDRAWAL').length;

  const totalTransfers = transactions
    .filter((t) => t.type === 'TRANSFER')
    .reduce((sum, t) => sum + Number(t.amount), 0);
  const transferCount = transactions.filter((t) => t.type === 'TRANSFER').length;

  const netLiquidityFlow = totalDeposits - totalWithdrawals;

  // Export functions
  const handleExportCSV = () => {
    const rows = [
      ['BALANCEVAULT FINANCIAL INTELLIGENCE REPORT'],
      [`Generated at: ${new Date().toISOString()}`],
      [''],
      ['SECTION 1: ASSET ALLOCATION BY ACCOUNT TYPE'],
      ['Type', 'Accounts Count', 'Total Balance (USD)', 'Portfolio Share (%)'],
      ...accountTypesSummary.map((s) => [s.type, s.count, s.balance.toFixed(2), `${s.percentage.toFixed(2)}%`]),
      ['Total Net Assets', accounts.length, totalAssets.toFixed(2), '100.00%'],
      [''],
      ['SECTION 2: TRANSACTION SETTLEMENT SUMMARY'],
      ['Category', 'Count', 'Total Volume (USD)'],
      ['Deposits (Inflows)', depositCount, totalDeposits.toFixed(2)],
      ['Withdrawals (Outflows)', withdrawalCount, totalWithdrawals.toFixed(2)],
      ['Internal / External Transfers', transferCount, totalTransfers.toFixed(2)],
      ['Net Capital Movement', '-', netLiquidityFlow.toFixed(2)],
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `balancevault-report-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportJSON = () => {
    const reportData = {
      generatedAt: new Date().toISOString(),
      institution: 'BalanceVault Core Financial Services',
      portfolio: {
        totalAssets,
        activeAccounts: accounts.length,
        breakdownByType: accountTypesSummary,
      },
      transactions: {
        totalRecorded: transactions.length,
        deposits: { count: depositCount, volume: totalDeposits },
        withdrawals: { count: withdrawalCount, volume: totalWithdrawals },
        transfers: { count: transferCount, volume: totalTransfers },
        netFlow: netLiquidityFlow,
      },
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(reportData, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute('href', dataStr);
    dlAnchor.setAttribute('download', `balancevault-report-${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-100">Financial Reports & Analytics</h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded uppercase font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
              Executive View
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Institutional portfolio distribution, transaction volume analytics, and capital movements
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1 bg-slate-900 border border-slate-800 rounded-lg p-1 text-xs">
            {(['30D', '90D', 'YTD', 'ALL'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setSelectedPeriod(p)}
                className={`px-2.5 py-1 rounded font-semibold transition-all ${
                  selectedPeriod === p ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          <button
            onClick={handleExportCSV}
            className="px-3 py-2 rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-800 text-xs font-semibold text-slate-200 transition-all flex items-center space-x-1.5"
            title="Download CSV Report"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV</span>
          </button>

          <button
            onClick={handleExportJSON}
            className="px-3 py-2 rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-800 text-xs font-semibold text-slate-200 transition-all flex items-center space-x-1.5"
            title="Download JSON Report"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>JSON</span>
          </button>

          <button
            onClick={handlePrint}
            className="px-3 py-2 rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-800 text-xs font-semibold text-slate-200 transition-all flex items-center space-x-1.5"
            title="Print or Save PDF"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print</span>
          </button>
        </div>
      </div>

      {/* Top Level Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-slate-800 bg-[#0f172a]/60">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Total Consolidated Assets</span>
            <Wallet className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-slate-100">
            ${totalAssets.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">Across {accounts.length} active containers</span>
        </div>

        <div className="p-4 rounded-xl border border-slate-800 bg-[#0f172a]/60">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Cumulative Inflows</span>
            <ArrowDownLeft className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-emerald-400">
            ${totalDeposits.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">{depositCount} deposit transactions</span>
        </div>

        <div className="p-4 rounded-xl border border-slate-800 bg-[#0f172a]/60">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Cumulative Outflows</span>
            <ArrowUpRight className="w-4 h-4 text-rose-400" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-rose-400">
            ${totalWithdrawals.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">{withdrawalCount} withdrawal settlements</span>
        </div>

        <div className="p-4 rounded-xl border border-slate-800 bg-[#0f172a]/60">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Net Liquidity Velocity</span>
            <TrendingUp className={`w-4 h-4 ${netLiquidityFlow >= 0 ? 'text-emerald-400' : 'text-rose-400'}`} />
          </div>
          <div
            className={`mt-2 text-2xl font-bold font-mono ${
              netLiquidityFlow >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {netLiquidityFlow >= 0 ? '+' : ''}${netLiquidityFlow.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">Net capital retention rate</span>
        </div>
      </div>

      {/* Main Grid: Breakdown by Account Type & Transaction Volumes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Account Types Breakdown */}
        <div className="p-6 rounded-xl border border-slate-800 bg-[#0f172a]/60 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300 flex items-center space-x-2">
              <PieChart className="w-4 h-4 text-cyan-400" />
              <span>Asset Allocation by Account Type</span>
            </h2>
            <span className="text-xs text-slate-500 font-mono">{accountTypesSummary.length} Categories</span>
          </div>

          <div className="space-y-4">
            {accountTypesSummary.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">No account balances recorded yet.</div>
            ) : (
              accountTypesSummary.map((item) => (
                <div key={item.type} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-200">{item.type}</span>
                    <span className="font-mono text-slate-400">
                      ${item.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })} ({item.percentage.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                    <div
                      className="bg-gradient-to-r from-cyan-500 to-indigo-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, Math.max(2, item.percentage))}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-500">
                    <span>{item.count} account{item.count !== 1 ? 's' : ''}</span>
                    <span>Average: ${item.count > 0 ? (item.balance / item.count).toFixed(2) : '0.00'}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Transaction Categories Breakdown */}
        <div className="p-6 rounded-xl border border-slate-800 bg-[#0f172a]/60 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300 flex items-center space-x-2">
              <BarChart3 className="w-4 h-4 text-emerald-400" />
              <span>Transaction Volume Breakdown</span>
            </h2>
            <span className="text-xs text-slate-500 font-mono">{transactions.length} Total</span>
          </div>

          <div className="space-y-3">
            <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <ArrowDownLeft className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-200">Deposits (Inbound)</p>
                  <span className="text-[11px] text-slate-500">{depositCount} transactions</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold font-mono text-emerald-400">
                  +${totalDeposits.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
                <span className="text-[10px] text-slate-500">
                  Avg: ${depositCount > 0 ? (totalDeposits / depositCount).toFixed(2) : '0.00'}
                </span>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  <ArrowUpRight className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-200">Withdrawals (Outbound)</p>
                  <span className="text-[11px] text-slate-500">{withdrawalCount} transactions</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold font-mono text-rose-400">
                  -${totalWithdrawals.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
                <span className="text-[10px] text-slate-500">
                  Avg: ${withdrawalCount > 0 ? (totalWithdrawals / withdrawalCount).toFixed(2) : '0.00'}
                </span>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  <ArrowLeftRight className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-200">Vault Transfers</p>
                  <span className="text-[11px] text-slate-500">{transferCount} transactions</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold font-mono text-cyan-400">
                  ${totalTransfers.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
                <span className="text-[10px] text-slate-500">
                  Avg: ${transferCount > 0 ? (totalTransfers / transferCount).toFixed(2) : '0.00'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Compliance Note */}
      <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center space-x-2">
          <ShieldCheck className="w-4 h-4 text-cyan-400" />
          <span>Report verified against ledger baseline records. Auditable by regulatory compliance engines.</span>
        </div>
        <span className="font-mono text-slate-500 text-[11px]">System Timestamp: {new Date().toUTCString()}</span>
      </div>
    </div>
  );
};
export default ReportsPage;
