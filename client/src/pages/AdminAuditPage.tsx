import React, { useEffect, useState, useCallback } from 'react';
import { AuditLog } from '../types/index.js';
import { api } from '../services/api.js';
import { AuditLogsTable } from '../components/AuditLogsTable.js';
import { ShieldAlert, RefreshCw } from 'lucide-react';

export const AdminAuditPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');

  const fetchLogs = useCallback(async (searchQuery?: string) => {
    setIsLoading(true);
    try {
      const response = await api.getAuditLogs(1, 50, searchQuery);
      if (response.success && response.logs) {
        setLogs(response.logs);
      }
    } catch (err: any) {
      console.error('Failed to fetch audit records:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs(search);
  }, [fetchLogs, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-100">
              System Audit Logs & Governance
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Immutable chronological security ledger capturing all logins, transfers, role modifications, and privilege assertions
          </p>
        </div>

        <button
          onClick={() => fetchLogs(search)}
          disabled={isLoading}
          className="p-2 rounded-lg border border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50 self-start sm:self-auto"
          title="Refresh Logs"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
        </button>
      </div>

      <AuditLogsTable
        logs={logs}
        isLoading={isLoading}
        onSearch={(query) => setSearch(query)}
      />
    </div>
  );
};
