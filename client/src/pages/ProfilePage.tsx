import React, { useState } from 'react';
import { Account } from '../types/index.js';
import { useAuth } from '../context/AuthContext.js';
import { api } from '../services/api.js';
import {
  User,
  Shield,
  KeyRound,
  Lock,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  LogOut,
  Fingerprint
} from 'lucide-react';

interface ProfilePageProps {
  accounts: Account[];
  onOpenCreateAccount?: () => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({ accounts }) => {
  const { user, logout } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg(null);

    if (newPassword.length < 8) {
      setPasswordMsg({ type: 'error', text: 'New password must be at least 8 characters long.' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'New password and confirmation do not match.' });
      return;
    }

    setIsChangingPassword(true);
    try {
      const res = await api.changePassword({
        currentPassword: currentPassword.trim() || undefined,
        newPassword: newPassword.trim(),
      });

      if (res.success) {
        setPasswordMsg({ type: 'success', text: 'Password successfully updated! Your session credentials are secure.' });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setPasswordMsg({ type: 'error', text: res.message || 'Failed to update password.' });
      }
    } catch (err: any) {
      setPasswordMsg({ type: 'error', text: err.message || 'Password update failed.' });
    } finally {
      setIsChangingPassword(false);
    }
  };

  if (!user) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center space-x-2">
          <h1 className="text-2xl font-bold tracking-tight text-slate-100">User Profile & Security</h1>
          <span
            className={`text-[10px] font-mono px-2 py-0.5 rounded uppercase font-semibold ${
              user.role === 'ADMIN'
                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                : user.role === 'AUDITOR'
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
            }`}
          >
            {user.role}
          </span>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          Identity governance, authentication credentials, and security clearance settings
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* User Identity Overview */}
        <div className="lg:col-span-1 space-y-6">
          <div className="p-6 rounded-2xl border border-slate-800 bg-[#0f172a]/60 space-y-5">
            <div className="flex items-center space-x-4">
              <div className="h-16 w-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                <User className="w-8 h-8" />
              </div>
              <div>
                <h3 className="font-bold text-slate-100 text-lg leading-tight">{user.fullName}</h3>
                <p className="text-xs text-slate-400 mt-0.5">{user.email}</p>
                <div className="mt-2 flex items-center space-x-1.5 text-[11px] text-cyan-400 font-mono">
                  <Fingerprint className="w-3.5 h-3.5" />
                  <span>{user.id}</span>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-800/80 pt-4 space-y-3 text-xs">
              <div className="flex items-center justify-between text-slate-400">
                <span>Account Role</span>
                <span className="font-semibold text-slate-200">{user.role}</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Account Status</span>
                <span className="inline-flex items-center space-x-1 text-emerald-400 font-semibold">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Active & Verified</span>
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>MFA Status</span>
                <span className="font-mono text-slate-300">
                  {user.mfaEnabled ? 'Hardware / TOTP Active' : 'TOTP Supported'}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Session Clearance</span>
                <span className="font-mono text-cyan-400">JWT Signed (Bearer)</span>
              </div>
            </div>

            <button
              onClick={logout}
              className="w-full mt-4 py-2.5 px-4 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-semibold flex items-center justify-center space-x-2 transition-all"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out of Session</span>
            </button>
          </div>

          {/* Linked Vault Containers */}
          <div className="p-6 rounded-2xl border border-slate-800 bg-[#0f172a]/60 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-300 flex items-center space-x-2">
                <CreditCard className="w-4 h-4 text-cyan-400" />
                <span>Linked Vault Accounts</span>
              </h3>
              <span className="text-xs font-mono text-slate-500">{accounts.length} Total</span>
            </div>

            <div className="space-y-2">
              {accounts.length === 0 ? (
                <p className="text-xs text-slate-500 py-3 text-center">No linked accounts currently provisioned.</p>
              ) : (
                accounts.map((acc) => (
                  <div key={acc.id} className="p-3 rounded-lg bg-slate-900/50 border border-slate-800 text-xs flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-slate-200">{acc.name}</p>
                      <span className="font-mono text-[10px] text-cyan-400">{acc.accountNumber}</span>
                    </div>
                    <span className="font-mono font-bold text-slate-100">
                      ${Number(acc.balance).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Security & Password Management */}
        <div className="lg:col-span-2 space-y-6">
          {/* Password Management */}
          <div className="p-6 rounded-2xl border border-slate-800 bg-[#0f172a]/60 space-y-5">
            <div>
              <h3 className="text-base font-semibold text-slate-100 flex items-center space-x-2">
                <KeyRound className="w-4 h-4 text-cyan-400" />
                <span>Authentication & Password Management</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Update your account password with cryptographic SHA-256 / PBKDF2 salting.
              </p>
            </div>

            {passwordMsg && (
              <div
                className={`p-3 rounded-lg text-xs flex items-center space-x-2 border ${
                  passwordMsg.type === 'success'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                }`}
              >
                {passwordMsg.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                )}
                <span>{passwordMsg.text}</span>
              </div>
            )}

            <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Current Password</label>
                <div className="relative">
                  <input
                    type="password"
                    placeholder="Enter current password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">New Secure Password</label>
                <div className="relative">
                  <input
                    type="password"
                    placeholder="Minimum 8 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Confirm New Password</label>
                <div className="relative">
                  <input
                    type="password"
                    placeholder="Re-enter new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isChangingPassword}
                className="px-5 py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition-all shadow-sm shadow-cyan-500/20 flex items-center space-x-2 disabled:opacity-50"
              >
                {isChangingPassword ? (
                  <>
                    <div className="h-3 w-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    <span>Updating Password...</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-3.5 h-3.5" />
                    <span>Update Password</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Session Security Diagnostics */}
          <div className="p-6 rounded-2xl border border-slate-800 bg-[#0f172a]/60 space-y-4">
            <h3 className="text-base font-semibold text-slate-100 flex items-center space-x-2">
              <Shield className="w-4 h-4 text-emerald-400" />
              <span>Session Security Diagnostics</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
                <span className="text-slate-500 block text-[11px]">Brute-Force Shield</span>
                <span className="font-semibold text-emerald-400 flex items-center space-x-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>5-Attempt Lockout Activated</span>
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
                <span className="text-slate-500 block text-[11px]">Data Encryption</span>
                <span className="font-semibold text-emerald-400 flex items-center space-x-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>AES-256 Ledger At Rest</span>
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
                <span className="text-slate-500 block text-[11px]">Transport Security</span>
                <span className="font-semibold text-emerald-400 flex items-center space-x-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>TLS 1.3 / HSTS Strict</span>
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
                <span className="text-slate-500 block text-[11px]">Audit Logging</span>
                <span className="font-semibold text-emerald-400 flex items-center space-x-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Continuous Integrity Trail</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default ProfilePage;
