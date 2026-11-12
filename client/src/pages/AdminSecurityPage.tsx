import React, { useEffect, useState, useCallback } from 'react';
import { SecurityStats } from '../types/index.js';
import { api } from '../services/api.js';
import {
  ShieldAlert,
  ShieldCheck,
  Lock,
  UserX,
  AlertTriangle,
  Zap,
  RefreshCw,
  Clock,
  CheckCircle2,
} from 'lucide-react';

export const AdminSecurityPage: React.FC = () => {
  const [stats, setStats] = useState<SecurityStats | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchStats = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await api.getSecurityStats();
      if (response.success && response.stats) {
        setStats(response.stats);
      }
    } catch (err: any) {
      console.error('Failed to fetch security SOC stats:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-100">
              Security Operations Center (SOC)
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time cybersecurity posture, brute-force mitigation, account lockouts, and rate-limiting telemetry
          </p>
        </div>

        <button
          onClick={fetchStats}
          disabled={isLoading}
          className="p-2 rounded-lg border border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50 self-start sm:self-auto"
          title="Refresh Telemetry"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
        </button>
      </div>

      {/* Security Health Alert Banner */}
      <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-950/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <span className="flex h-3 w-3 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </span>
          <div>
            <p className="text-xs font-semibold text-emerald-300">
              Defense System Status: {stats?.complianceStatus || 'OWASP TOP 10 ENFORCED'}
            </p>
            <p className="text-[11px] text-slate-400">
              Active Controls: Strict CSP, HSTS, Rate Limiting, PBKDF2/Bcrypt Password Hashes, and Brute-Force Shield.
            </p>
          </div>
        </div>
        <div className="text-[11px] font-mono text-slate-400 flex items-center space-x-1.5 self-end sm:self-auto">
          <Clock className="w-3.5 h-3.5 text-slate-500" />
          <span>Last Audit: {stats ? new Date(stats.lastSecurityAuditDate).toLocaleString() : 'Recent'}</span>
        </div>
      </div>

      {/* 4 Security Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl border border-slate-800 bg-[#0f172a]/70">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">
              Failed Logins
            </span>
            <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <UserX className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-bold font-mono text-slate-100">
              {stats?.totalFailedLogins ?? 0}
            </h3>
            <p className="mt-1 text-xs text-slate-500">Intercepted by auth guard</p>
          </div>
        </div>

        <div className="p-5 rounded-xl border border-slate-800 bg-[#0f172a]/70">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">
              Locked Accounts
            </span>
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Lock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-bold font-mono text-slate-100">
              {stats?.lockedAccounts ?? 0}
            </h3>
            <p className="mt-1 text-xs text-slate-500">Automatic 15-min lockout</p>
          </div>
        </div>

        <div className="p-5 rounded-xl border border-slate-800 bg-[#0f172a]/70">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">
              Unauthorized Access
            </span>
            <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-bold font-mono text-slate-100">
              {stats?.unauthorizedAttempts ?? 0}
            </h3>
            <p className="mt-1 text-xs text-slate-500">HTTP 403 Forbidden blocks</p>
          </div>
        </div>

        <div className="p-5 rounded-xl border border-slate-800 bg-[#0f172a]/70">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">
              Rate-Limit Violations
            </span>
            <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-bold font-mono text-slate-100">
              {stats?.rateLimitViolations ?? 0}
            </h3>
            <p className="mt-1 text-xs text-slate-500">HTTP 429 Throttle triggers</p>
          </div>
        </div>
      </div>

      {/* Security Alerts List */}
      {stats?.securityAlerts && stats.securityAlerts.length > 0 && (
        <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-950/20 space-y-2">
          <div className="flex items-center space-x-2 text-xs font-bold text-amber-400">
            <AlertTriangle className="w-4 h-4" />
            <span>Active Security Notices:</span>
          </div>
          <div className="space-y-1">
            {stats.securityAlerts.map((alert, i) => (
              <p key={i} className="text-xs text-slate-300">
                • <span className="font-semibold text-amber-300">[{alert.level}]</span> {alert.message}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Recent Security Telemetry Feed */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Security Telemetry Events & Threat Feed
          </h2>
          <span className="text-xs text-slate-400 font-mono">Real-time Ingestion</span>
        </div>

        <div className="border border-slate-800 rounded-xl overflow-hidden bg-[#0f172a]/60">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/80 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Event Type</th>
                  <th className="py-3 px-4">Severity</th>
                  <th className="py-3 px-4">Threat Details</th>
                  <th className="py-3 px-4">Source IP</th>
                  <th className="py-3 px-4">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500 font-sans">
                      Loading security telemetry...
                    </td>
                  </tr>
                ) : !stats?.recentSecurityEvents || stats.recentSecurityEvents.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500 font-sans">
                      <div className="flex flex-col items-center justify-center space-y-1">
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                        <span>No suspicious security events detected. Systems nominal.</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  stats.recentSecurityEvents.map((event) => (
                    <tr key={event.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-200">
                        {event.eventType}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                            event.severity === 'CRITICAL' || event.severity === 'HIGH'
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              : event.severity === 'MEDIUM'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          }`}
                        >
                          {event.severity}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-300 font-sans">
                        {event.details}
                      </td>
                      <td className="py-3 px-4 text-slate-400 text-[11px]">
                        {event.ipAddress || '127.0.0.1'}
                      </td>
                      <td className="py-3 px-4 text-slate-500 text-[11px]">
                        {new Date(event.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
