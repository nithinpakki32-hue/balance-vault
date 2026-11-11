import React from 'react';
import { useAuth } from '../context/AuthContext.js';
import { ShieldCheck, LogOut, User as UserIcon, Bell } from 'lucide-react';

interface NavbarProps {
  onOpenOnboarding: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenOnboarding }) => {
  const { user, logout } = useAuth();

  return (
    <header className="h-16 border-b border-slate-800 bg-[#0f172a]/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-40">
      <div className="flex items-center space-x-3">
        <div className="h-9 w-9 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div>
          <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-cyan-400 via-teal-300 to-indigo-300 bg-clip-text text-transparent">
            BalanceVault
          </span>
          <span className="text-[10px] text-slate-400 ml-2 px-1.5 py-0.5 rounded border border-slate-700 bg-slate-900/60 font-mono">
            LEDGER v1.0
          </span>
        </div>
      </div>

      <div className="flex items-center space-x-4">
        <button
          onClick={onOpenOnboarding}
          className="text-xs text-slate-400 hover:text-cyan-400 transition-colors px-2 py-1 rounded border border-slate-800 hover:border-cyan-500/30"
          title="Open Onboarding Guide"
        >
          Quick Tour
        </button>

        <div className="flex items-center space-x-2 text-slate-400">
          <Bell className="w-4 h-4 hover:text-slate-200 cursor-pointer" />
        </div>

        {user && (
          <div className="flex items-center space-x-3 pl-3 border-l border-slate-800">
            <div className="text-right">
              <p className="text-sm font-medium text-slate-200">{user.fullName}</p>
              <div className="flex items-center justify-end space-x-1">
                <span className={`text-[10px] font-mono uppercase px-1.5 py-0.2 rounded font-semibold ${
                  user.role === 'ADMIN'
                    ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    : user.role === 'AUDITOR'
                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                }`}>
                  {user.role}
                </span>
              </div>
            </div>

            <div className="h-9 w-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
              <UserIcon className="w-4 h-4" />
            </div>

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
