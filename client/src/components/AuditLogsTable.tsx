import React, { useState } from 'react';
import { AuditLog } from '../types/index.js';
import { ShieldCheck, AlertCircle, Clock, Search, ChevronDown, ChevronRight } from 'lucide-react';

interface AuditLogsTableProps {
  logs: AuditLog[];
  isLoading: boolean;
  onSearch: (query: string) => void;
}

export const AuditLogsTable: React.FC<AuditLogsTableProps> = ({ logs, isLoading, onSearch }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(searchTerm);
  };

  const toggleExpand = (id: string) => {
    setExpandedLogId(expandedLogId === id ? null : id);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by action, resource, email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500 placeholder:text-slate-500"
          />
        </form>
        <span className="text-xs text-slate-400">
          Showing {logs.length} logged events
        </span>
      </div>

      <div className="border border-slate-800 rounded-xl overflow-hidden bg-[#0f172a]/50">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/80 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4 w-8"></th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Resource</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">IP Address</th>
                <th className="py-3 px-4">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500 font-sans">
                    Loading audit records...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500 font-sans">
                    No audit logs found matching criteria.
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const isExpanded = expandedLogId === log.id;
                  return (
                    <React.Fragment key={log.id}>
                      <tr
                        onClick={() => toggleExpand(log.id)}
                        className="hover:bg-slate-800/40 cursor-pointer transition-colors"
                      >
                        <td className="py-3 px-4 text-slate-500">
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-cyan-400" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-200">
                          {log.action}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase ${
                              log.status === 'SUCCESS'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            }`}
                          >
                            {log.status === 'SUCCESS' ? (
                              <ShieldCheck className="w-3 h-3 mr-1" />
                            ) : (
                              <AlertCircle className="w-3 h-3 mr-1" />
                            )}
                            {log.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-300 font-sans">
                          {log.resource}
                        </td>
                        <td className="py-3 px-4 text-slate-300 font-sans">
                          {log.user?.email || 'SYSTEM / ANONYMOUS'}
                        </td>
                        <td className="py-3 px-4 text-slate-400 text-[11px]">
                          {log.ipAddress || '127.0.0.1'}
                        </td>
                        <td className="py-3 px-4 text-slate-400 text-[11px]">
                          <div className="flex items-center space-x-1">
                            <Clock className="w-3 h-3 text-slate-500" />
                            <span>{new Date(log.createdAt).toLocaleString()}</span>
                          </div>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr className="bg-slate-900/60 font-mono">
                          <td colSpan={7} className="p-4 pl-12 text-xs">
                            <div className="p-3 rounded-lg bg-black/40 border border-slate-800 text-slate-300 space-y-1">
                              <p className="text-[11px] text-cyan-400 font-sans font-semibold">
                                Metadata Payload:
                              </p>
                              <pre className="text-[11px] overflow-x-auto text-slate-400">
                                {JSON.stringify(log.metadata || {}, null, 2)}
                              </pre>
                              {log.userAgent && (
                                <p className="text-[10px] text-slate-500 font-sans pt-1">
                                  User-Agent: {log.userAgent}
                                </p>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
