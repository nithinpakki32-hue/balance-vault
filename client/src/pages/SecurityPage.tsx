import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { AdminSecurityPage } from './AdminSecurityPage.js';
import { AdminAuditPage } from './AdminAuditPage.js';
import {
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  Lock,
  CheckCircle2,
  Eye,
  Activity
} from 'lucide-react';

interface SecurityPageProps {
  onNavigateProfile?: () => void;
}

export const SecurityPage: React.FC<SecurityPageProps> = ({ onNavigateProfile }) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const isAuditor = user?.role === 'AUDITOR';

  const [adminView, setAdminView] = useState<'soc' | 'audit'>('soc');

  // If Admin: show SOC Telemetry or Audit Logs
  if (isAdmin) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
          <button
            onClick={() => setAdminView('soc')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all ${
              adminView === 'soc'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>SOC Telemetry & Brute-Force Guard</span>
          </button>

          <button
            onClick={() => setAdminView('audit')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all ${
              adminView === 'audit'
                ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Institution Audit Logs</span>
          </button>
        </div>

        {adminView === 'soc' ? <AdminSecurityPage /> : <AdminAuditPage />}
      </div>
    );
  }

  // If Auditor: show Audit Logs
  if (isAuditor) {
    return <AdminAuditPage />;
  }

  // If Account Holder: User Security Center
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center space-x-2">
          <h1 className="text-2xl font-bold tracking-tight text-slate-100">Member Security & Session Clearance</h1>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded uppercase font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            Protected
          </span>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          Personal identity safeguards, credential health, and session verification
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 rounded-2xl border border-slate-800 bg-[#0f172a]/60 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 uppercase font-semibold">Security Health</span>
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400">100% SECURE</div>
          <p className="text-xs text-slate-400">
            Your login identity is verified with SHA-256 PBKDF2 salting and active rate limiting.
          </p>
        </div>

        <div className="p-6 rounded-2xl border border-slate-800 bg-[#0f172a]/60 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 uppercase font-semibold">Session Status</span>
            <Lock className="w-5 h-5 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-cyan-400">ACTIVE (JWT)</div>
          <p className="text-xs text-slate-400">
            Signed cryptographic Bearer token with automatic expiration and refresh safeguards.
          </p>
        </div>

        <div className="p-6 rounded-2xl border border-slate-800 bg-[#0f172a]/60 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 uppercase font-semibold">Access Isolation</span>
            <Eye className="w-5 h-5 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-100">STRICT RBAC</div>
          <p className="text-xs text-slate-400">
            Multi-tenant data isolation ensures only authorized ledger containers are accessible.
          </p>
        </div>
      </div>

      <div className="p-6 rounded-2xl border border-slate-800 bg-[#0f172a]/60 space-y-4">
        <h3 className="text-base font-bold text-slate-100 flex items-center space-x-2">
          <Activity className="w-4 h-4 text-cyan-400" />
          <span>Active Defenses & Platform Safeguards</span>
        </h3>

        <div className="divide-y divide-slate-800 text-xs">
          <div className="py-3 flex items-center justify-between">
            <div>
              <p className="font-semibold text-slate-200">Anti-Brute Force Protection</p>
              <span className="text-slate-500">Account locks after 5 consecutive failed login attempts.</span>
            </div>
            <span className="text-emerald-400 font-mono font-semibold flex items-center space-x-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Enforced</span>
            </span>
          </div>

          <div className="py-3 flex items-center justify-between">
            <div>
              <p className="font-semibold text-slate-200">Account Request Approval Workflow</p>
              <span className="text-slate-500">Account openings must be approved by an administrator before funds activate.</span>
            </div>
            <span className="text-emerald-400 font-mono font-semibold flex items-center space-x-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Active</span>
            </span>
          </div>

          <div className="py-3 flex items-center justify-between">
            <div>
              <p className="font-semibold text-slate-200">Double-Entry Ledger Balancing Invariant</p>
              <span className="text-slate-500">Financial mutations guarantee Σ Debits ≡ Σ Credits across transactions.</span>
            </div>
            <span className="text-emerald-400 font-mono font-semibold flex items-center space-x-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Invariant Zero-Variance</span>
            </span>
          </div>
        </div>

        {onNavigateProfile && (
          <div className="pt-2">
            <button
              onClick={onNavigateProfile}
              className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold flex items-center space-x-1.5"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Change Password & Update Credentials →</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
export default SecurityPage;
