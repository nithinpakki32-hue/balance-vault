import React, { useEffect, useState } from 'react';
import { User, Role } from '../types/index.js';
import { api } from '../services/api.js';
import { Users, Search, RefreshCw, Shield, CheckCircle2, XCircle } from 'lucide-react';

export const AdminUsersPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const response = await api.getUsers(1, 50, search);
      if (response.success && response.users) {
        setUsers(response.users);
      }
    } catch (err: any) {
      console.error('Failed to fetch user directory:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [search]);

  const handleRoleChange = async (userId: string, newRole: Role) => {
    setUpdatingUserId(userId);
    try {
      await api.updateUser(userId, { role: newRole });
      await fetchUsers();
    } catch (err: any) {
      alert(err.message || 'Failed to update user role');
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleStatusToggle = async (userId: string, currentStatus: boolean) => {
    setUpdatingUserId(userId);
    try {
      await api.updateUser(userId, { isActive: !currentStatus });
      await fetchUsers();
    } catch (err: any) {
      alert(err.message || 'Failed to update user status');
    } finally {
      setUpdatingUserId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Users className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-100">
              User Directory & RBAC Assignment
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Manage institutional users, promote administrative roles, and enforce security policies
          </p>
        </div>

        <button
          onClick={fetchUsers}
          disabled={isLoading}
          className="p-2 rounded-lg border border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50 self-start sm:self-auto"
          title="Refresh Directory"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
        </button>
      </div>

      <div className="relative w-full sm:w-80">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-slate-900 border border-slate-700/80 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500 placeholder:text-slate-500"
        />
      </div>

      <div className="border border-slate-800 rounded-xl overflow-hidden bg-[#0f172a]/60">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/80 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Current Role</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Accounts</th>
                <th className="py-3 px-4">Created Date</th>
                <th className="py-3 px-4 text-right">Privilege Controls</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500 font-sans">
                    Loading users...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500 font-sans">
                    No users found matching search query.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-sans">
                      <p className="font-semibold text-slate-200">{u.fullName}</p>
                      <p className="text-[11px] text-slate-400 font-mono">{u.email}</p>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase ${
                          u.role === 'ADMIN'
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            : u.role === 'AUDITOR'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                        }`}
                      >
                        <Shield className="w-3 h-3 mr-1" />
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-sans">
                      <span
                        className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-semibold ${
                          u.isActive
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-rose-500/10 text-rose-400'
                        }`}
                      >
                        {u.isActive ? (
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                        ) : (
                          <XCircle className="w-3 h-3 mr-1" />
                        )}
                        {u.isActive ? 'Active' : 'Suspended'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-300">
                      {u._count?.accounts || 0} accounts
                    </td>
                    <td className="py-3 px-4 text-slate-400 text-[11px]">
                      {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="py-3 px-4 text-right space-x-2 font-sans">
                      <select
                        disabled={updatingUserId === u.id}
                        value={u.role}
                        onChange={(e) => handleRoleChange(u.id, e.target.value as Role)}
                        className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                      >
                        <option value="USER">USER</option>
                        <option value="OPERATOR">OPERATOR</option>
                        <option value="AUDITOR">AUDITOR</option>
                        <option value="ADMIN">ADMIN</option>
                      </select>

                      <button
                        disabled={updatingUserId === u.id}
                        onClick={() => handleStatusToggle(u.id, u.isActive)}
                        className={`px-2.5 py-1 rounded text-xs font-semibold border transition-all ${
                          u.isActive
                            ? 'border-rose-500/30 text-rose-400 hover:bg-rose-500/10'
                            : 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10'
                        }`}
                      >
                        {u.isActive ? 'Suspend' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
