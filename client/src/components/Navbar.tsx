import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext.js';
import {
  ShieldCheck,
  LogOut,
  User as UserIcon,
  Bell,
  Menu,
  X,
  CheckCircle2,
  AlertTriangle,
  Info
} from 'lucide-react';
import { NotificationItem } from '../types/index.js';

interface NavbarProps {
  onOpenOnboarding: () => void;
  onSelectTab: (tab: string) => void;
  onToggleMobileMenu: () => void;
  isMobileMenuOpen: boolean;
  pendingRequestsCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenOnboarding,
  onSelectTab,
  onToggleMobileMenu,
  isMobileMenuOpen,
  pendingRequestsCount = 0,
}) => {
  const { user, logout } = useAuth();
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const [notifications, setNotifications] = useState<NotificationItem[]>([
    {
      id: 'notif-1',
      title: 'Double-Entry Invariant OK',
      message: 'All ledger entries have been verified: Σ Debits ≡ Σ Credits.',
      type: 'success',
      timestamp: 'Just now',
      read: false,
      actionTab: 'ledger',
    },
    {
      id: 'notif-2',
      title: 'Security Shield Active',
      message: 'HSTS, brute-force guard and TLS 1.3 protections are running.',
      type: 'info',
      timestamp: '5m ago',
      read: false,
      actionTab: 'security',
    },
  ]);

  // If there are pending requests, add high-priority notification for admin
  useEffect(() => {
    if (user?.role === 'ADMIN' && pendingRequestsCount > 0) {
      setNotifications((prev) => {
        if (prev.some((n) => n.id === 'notif-pending-reqs')) return prev;
        return [
          {
            id: 'notif-pending-reqs',
            title: 'Account Opening Requests',
            message: `${pendingRequestsCount} new account requests require administrator review.`,
            type: 'warning',
            timestamp: 'Action required',
            read: false,
            actionTab: 'requests',
          },
          ...prev,
        ];
      });
    }
  }, [user, pendingRequestsCount]);

  // Click outside listener for notification popup
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setIsNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleNotificationClick = (item: NotificationItem) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === item.id ? { ...n, read: true } : n))
    );
    if (item.actionTab) {
      onSelectTab(item.actionTab);
    }
    setIsNotifOpen(false);
  };

  return (
    <header className="h-16 border-b border-slate-800 bg-[#0f172a]/90 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between sticky top-0 z-40">
      <div className="flex items-center space-x-3">
        {/* Mobile menu button */}
        <button
          onClick={onToggleMobileMenu}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 lg:hidden"
          title="Toggle Navigation Menu"
        >
          {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        {/* Logo */}
        <button
          onClick={() => onSelectTab('dashboard')}
          className="flex items-center space-x-3 text-left focus:outline-none"
        >
          <div className="h-9 w-9 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="hidden xs:block">
            <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-cyan-400 via-teal-300 to-indigo-300 bg-clip-text text-transparent">
              BalanceVault
            </span>
            <span className="text-[10px] text-cyan-400 ml-2 px-1.5 py-0.5 rounded border border-cyan-500/30 bg-cyan-950/40 font-mono">
              SPA CORE
            </span>
          </div>
        </button>
      </div>

      {/* Right Controls */}
      <div className="flex items-center space-x-3 sm:space-x-4">
        <button
          onClick={onOpenOnboarding}
          className="hidden sm:inline-block text-xs text-slate-400 hover:text-cyan-400 transition-colors px-2.5 py-1 rounded border border-slate-800 hover:border-cyan-500/30 bg-slate-900/60"
          title="Open Onboarding Guide"
        >
          Quick Tour
        </button>

        {/* Notifications Popover */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setIsNotifOpen(!isNotifOpen)}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors relative"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            )}
          </button>

          {isNotifOpen && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl border border-slate-800 bg-[#0f172a] shadow-2xl p-4 z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold text-slate-200">System Notifications</span>
                  {unreadCount > 0 && (
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-400 font-semibold">
                      {unreadCount} new
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-[11px] text-slate-400 hover:text-cyan-400 transition-colors"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              <div className="divide-y divide-slate-800/80 max-h-72 overflow-y-auto mt-2">
                {notifications.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleNotificationClick(item)}
                    className={`p-2.5 rounded-lg cursor-pointer transition-colors flex items-start space-x-2.5 ${
                      item.read ? 'hover:bg-slate-800/40 opacity-75' : 'bg-slate-900/60 hover:bg-slate-800/80'
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">
                      {item.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                      {item.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-400" />}
                      {item.type === 'info' && <Info className="w-4 h-4 text-cyan-400" />}
                      {item.type === 'alert' && <AlertTriangle className="w-4 h-4 text-rose-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-slate-200 truncate">{item.title}</p>
                        <span className="text-[10px] text-slate-500">{item.timestamp}</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">{item.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* User Profile Pill */}
        {user && (
          <div className="flex items-center space-x-3 pl-2 sm:pl-3 border-l border-slate-800">
            <button
              onClick={() => onSelectTab('profile')}
              className="text-right hidden sm:block focus:outline-none hover:opacity-80 transition-opacity"
              title="Go to User Profile"
            >
              <p className="text-sm font-medium text-slate-200 leading-tight">{user.fullName}</p>
              <div className="flex items-center justify-end space-x-1 mt-0.5">
                <span
                  className={`text-[9px] font-mono uppercase px-1.5 py-0.2 rounded font-semibold ${
                    user.role === 'ADMIN'
                      ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      : user.role === 'AUDITOR'
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                  }`}
                >
                  {user.role}
                </span>
              </div>
            </button>

            <button
              onClick={() => onSelectTab('profile')}
              className="h-9 w-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 hover:border-cyan-500 transition-colors focus:outline-none"
              title="User Profile"
            >
              <UserIcon className="w-4 h-4" />
            </button>

            <button
              onClick={logout}
              title="Sign Out"
              className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors border border-transparent hover:border-rose-500/20"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
export default Navbar;
