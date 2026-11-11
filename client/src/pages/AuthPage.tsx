import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { ShieldCheck, Lock, Mail, User, ArrowRight, AlertCircle, Sparkles } from 'lucide-react';

export const AuthPage: React.FC = () => {
  const { login, register } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [initialDeposit, setInitialDeposit] = useState('1000');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await register(fullName, email, password, parseFloat(initialDeposit) || 0);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const fillQuickAdmin = () => {
    setEmail('admin@balancevault.com');
    setPassword('Admin@123');
    setIsLogin(true);
  };

  const fillQuickUser = () => {
    setEmail('user@balancevault.com');
    setPassword('User@123');
    setIsLogin(true);
  };

  return (
    <div className="min-h-screen bg-[#090d16] flex flex-col justify-center items-center p-6 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 mb-4 shadow-lg shadow-cyan-500/10">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-cyan-400 via-teal-300 to-indigo-300 bg-clip-text text-transparent">
            BalanceVault
          </h1>
          <p className="text-sm text-slate-400 mt-1 font-medium">
            Secure Ledger & Balance Management Platform
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-[#0f172a]/80 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl p-8">
          {/* Tabs */}
          <div className="flex border-b border-slate-800 mb-6">
            <button
              type="button"
              onClick={() => {
                setIsLogin(true);
                setError(null);
              }}
              className={`flex-1 pb-3 text-sm font-semibold transition-all border-b-2 ${
                isLogin
                  ? 'border-cyan-400 text-cyan-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setIsLogin(false);
                setError(null);
              }}
              className={`flex-1 pb-3 text-sm font-semibold transition-all border-b-2 ${
                !isLogin
                  ? 'border-cyan-400 text-cyan-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Open Vault Account
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Full Legal Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    required
                    placeholder="Jane Doe"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700/80 rounded-xl pl-9 pr-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Work or Personal Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="email"
                  required
                  placeholder="name@domain.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-xl pl-9 pr-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Master Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-xl pl-9 pr-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
                />
              </div>
            </div>

            {!isLogin && (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Initial Deposit (USD)
                </label>
                <input
                  type="number"
                  min="0"
                  step="10"
                  value={initialDeposit}
                  onChange={(e) => setInitialDeposit(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2.5 text-sm text-slate-100 font-mono placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-400 hover:from-cyan-400 hover:to-teal-300 text-slate-950 font-bold text-sm transition-all flex items-center justify-center space-x-2 shadow-lg shadow-cyan-500/20 disabled:opacity-50"
            >
              <span>{isLoading ? 'Verifying...' : isLogin ? 'Authenticate Session' : 'Create Vault & Checking'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Seed demo quick-fill helper buttons */}
          <div className="mt-6 pt-5 border-t border-slate-800 text-center">
            <p className="text-[11px] text-slate-400 font-medium mb-2.5 flex items-center justify-center space-x-1">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>Demo Quick Fill (from seed):</span>
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={fillQuickAdmin}
                className="flex-1 py-1.5 px-2 rounded-lg border border-slate-700 bg-slate-900/60 hover:bg-slate-800 text-[11px] font-mono text-cyan-300 transition-colors"
              >
                Admin (admin@balancevault.com)
              </button>
              <button
                type="button"
                onClick={fillQuickUser}
                className="flex-1 py-1.5 px-2 rounded-lg border border-slate-700 bg-slate-900/60 hover:bg-slate-800 text-[11px] font-mono text-slate-300 transition-colors"
              >
                Member (user@balancevault.com)
              </button>
            </div>
          </div>
        </div>

        {/* Security watermark footer */}
        <p className="text-center text-xs text-slate-400 mt-6 font-mono">
          End-to-End Cryptographic Auditability & ACID Ledger Guarantees
        </p>
      </div>
    </div>
  );
};
