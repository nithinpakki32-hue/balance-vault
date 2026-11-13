import React from 'react';
import { useAuth } from '../context/AuthContext.js';
import {
  LayoutDashboard,
  Wallet,
  ArrowLeftRight,
  ShieldAlert,
  Users,
  Cpu,
  FileText,
  BookOpen,
  BarChart3,
  User
} from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  pendingRequestsCount?: number;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  pendingRequestsCount = 0,
  isOpenMobile = false,
  onCloseMobile,
}) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const isAuditor = user?.role === 'AUDITOR';

  const handleTabClick = (tabId: string) => {
    onSelectTab(tabId);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  const mainNavItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'accounts', label: 'Accounts', icon: Wallet },
    { id: 'transactions', label: 'Transactions', icon: ArrowLeftRight },
    {
      id: 'requests',
      label: 'Account Requests',
      icon: FileText,
      badge: isAdmin && pendingRequestsCount > 0 ? pendingRequestsCount : undefined,
    },
    { id: 'ledger', label: 'Double-Entry Ledger', icon: BookOpen },
    { id: 'reports', label: 'Financial Reports', icon: BarChart3 },
    { id: 'security', label: isAdmin ? 'Security Center (SOC)' : isAuditor ? 'Audit Logs' : 'Security & Sessions', icon: ShieldAlert },
    { id: 'profile', label: 'User Profile', icon: User },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
        />
      )}

      <aside
        className={`fixed lg:static top-16 bottom-0 left-0 z-40 w-64 border-r border-slate-800 bg-[#090d16]/98 flex flex-col justify-between p-4 transition-transform duration-200 ease-in-out ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        } h-[calc(100vh-4rem)] overflow-y-auto`}
      >
        <div className="space-y-6">
          {/* Main Navigation */}
          <div>
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-3 mb-2 font-mono">
              Core Platform
            </p>
            <nav className="space-y-1">
              {mainNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleTabClick(item.id)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 shadow-sm shadow-cyan-500/10'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <Icon className="w-4 h-4 shrink-0" />
                      <span>{item.label}</span>
                    </div>
                    {item.badge !== undefined && (
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-slate-950 font-mono">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Administrative Directory (Admin Only) */}
          {isAdmin && (
            <div>
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-3 mb-2 font-mono">
                System Administration
              </p>
              <nav className="space-y-1">
                <button
                  onClick={() => handleTabClick('admin-users')}
                  className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    currentTab === 'admin-users'
                      ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  <span>User Directory (RBAC)</span>
                </button>
              </nav>
            </div>
          )}
        </div>

        {/* System Security Pill */}
        <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/60 mt-6">
          <div className="flex items-center space-x-2 text-xs text-emerald-400">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="font-semibold">Cybersecurity Active</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500 flex items-center space-x-1.5">
            <Cpu className="w-3.5 h-3.5 text-cyan-500/70" />
            <span>CSP • TLS 1.3 • AES-256</span>
          </div>
        </div>
      </aside>
    </>
  );
};
export default Sidebar;
