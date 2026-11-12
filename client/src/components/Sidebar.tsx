import React from 'react';
import { useAuth } from '../context/AuthContext.js';
import {
  LayoutDashboard,
  Wallet,
  ArrowLeftRight,
  ShieldAlert,
  ShieldCheck,
  Users,
  Cpu,
  FileText
} from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onSelectTab }) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const isAuditorOrAdmin = user?.role === 'ADMIN' || user?.role === 'AUDITOR';

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'accounts', label: 'Accounts', icon: Wallet },
    { id: 'transactions', label: 'Transactions', icon: ArrowLeftRight },
  ];

  return (
    <aside className="w-64 border-r border-slate-800 bg-[#090d16]/95 flex flex-col justify-between p-4 h-[calc(100vh-4rem)]">
      <div className="space-y-6">
        <div>
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-3 mb-2">
            Main Ledger
          </p>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 shadow-sm shadow-cyan-500/10'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {isAuditorOrAdmin && (
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-3 mb-2">
              Governance & RBAC
            </p>
            <nav className="space-y-1">
              {isAdmin && (
                <button
                  onClick={() => onSelectTab('admin-security')}
                  className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    currentTab === 'admin-security'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shadow-sm shadow-emerald-500/10'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span className="font-semibold text-emerald-300">Security Center (SOC)</span>
                </button>
              )}

              {isAdmin && (
                <button
                  onClick={() => onSelectTab('admin-users')}
                  className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    currentTab === 'admin-users'
                      ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  <span>User Directory</span>
                </button>
              )}

              {isAuditorOrAdmin && (
                <button
                  onClick={() => onSelectTab('admin-account-requests')}
                  className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    currentTab === 'admin-account-requests'
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
                  }`}
                >
                  <FileText className="w-4 h-4 text-amber-400" />
                  <span>Account Requests</span>
                </button>
              )}

              {isAuditorOrAdmin && (
                <button
                  onClick={() => onSelectTab('admin-audit')}
                  className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    currentTab === 'admin-audit'
                      ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
                  }`}
                >
                  <ShieldAlert className="w-4 h-4" />
                  <span>Audit Logs</span>
                </button>
              )}
            </nav>
          </div>
        )}
      </div>

      {/* System Status Pill */}
      <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/50">
        <div className="flex items-center space-x-2 text-xs text-emerald-400">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="font-medium">Cybersecurity Shield Active</span>
        </div>
        <div className="mt-2 text-[11px] text-slate-500 flex items-center space-x-1.5">
          <Cpu className="w-3.5 h-3.5" />
          <span>CSP • HSTS • Brute-Force Guard</span>
        </div>
      </div>
    </aside>
  );
};
