import React, { useState, useEffect, useCallback } from 'react';
import { AccountRequest, AccountRequestStatus } from '../types/index.js';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.js';
import {
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  AlertCircle,
  RefreshCw,
  Search,
  Check,
  X,
  ShieldAlert,
} from 'lucide-react';

export const AdminAccountRequestsPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const isAuditor = user?.role === 'AUDITOR';

  const [requests, setRequests] = useState<AccountRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'ALL' | AccountRequestStatus>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Remarks state per request
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.getAccountRequests();
      if (res.success) {
        setRequests(res.requests);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load account requests.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleApprove = async (reqId: string, applicantUserId: string) => {
    if (!isAdmin) return;
    if (user?.id === applicantUserId) {
      setError('Self-approval prohibited: Administrators cannot approve their own account requests.');
      return;
    }

    setProcessingId(reqId);
    setError(null);
    setSuccess(null);

    try {
      const remarkText = remarks[reqId] || '';
      const res = await api.approveAccountRequest(reqId, { remarks: remarkText });
      if (res.success) {
        setSuccess(`Account request approved successfully! Account ${res.account?.accountNumber || ''} created.`);
        await fetchRequests();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to approve account request.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (reqId: string) => {
    if (!isAdmin) return;

    setProcessingId(reqId);
    setError(null);
    setSuccess(null);

    try {
      const remarkText = remarks[reqId] || 'Rejected by administrator';
      const res = await api.rejectAccountRequest(reqId, { remarks: remarkText });
      if (res.success) {
        setSuccess('Account request has been rejected.');
        await fetchRequests();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to reject account request.');
    } finally {
      setProcessingId(null);
    }
  };

  const filteredRequests = requests.filter((r) => {
    if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.accountName.toLowerCase().includes(q) ||
      r.accountType.toLowerCase().includes(q) ||
      r.userId.toLowerCase().includes(q) ||
      (r.user?.fullName && r.user.fullName.toLowerCase().includes(q)) ||
      (r.user?.email && r.user.email.toLowerCase().includes(q))
    );
  });

  const pendingCount = requests.filter((r) => r.status === 'PENDING').length;
  const approvedCount = requests.filter((r) => r.status === 'APPROVED').length;
  const rejectedCount = requests.filter((r) => r.status === 'REJECTED').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center space-x-2">
            <FileText className="w-6 h-6 text-amber-400" />
            <span>Account Opening Requests</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Review and adjudicate vault account applications with double-entry capital allocation
          </p>
        </div>

        <button
          onClick={fetchRequests}
          disabled={isLoading}
          className="p-2 rounded-lg border border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50 flex items-center space-x-2 self-start sm:self-auto text-xs"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {isAuditor && (
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center space-x-2.5">
          <ShieldAlert className="w-4 h-4 shrink-0 text-amber-400" />
          <span>
            <strong>Auditor Mode (Read-Only):</strong> You can inspect applicant requests and audit approval trails, but cannot approve or reject requests.
          </span>
        </div>
      )}

      {error && (
        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Summary KPI Badges */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <button
          onClick={() => setStatusFilter('ALL')}
          className={`p-4 rounded-xl border text-left transition-all ${
            statusFilter === 'ALL'
              ? 'bg-slate-800/80 border-cyan-500/50 shadow-sm shadow-cyan-500/10'
              : 'bg-slate-900/50 border-slate-800/80 hover:bg-slate-900'
          }`}
        >
          <p className="text-xs text-slate-400 font-medium">All Applications</p>
          <p className="text-xl font-bold text-slate-100 mt-1">{requests.length}</p>
        </button>

        <button
          onClick={() => setStatusFilter('PENDING')}
          className={`p-4 rounded-xl border text-left transition-all ${
            statusFilter === 'PENDING'
              ? 'bg-amber-500/10 border-amber-500/50 shadow-sm shadow-amber-500/10'
              : 'bg-slate-900/50 border-slate-800/80 hover:bg-slate-900'
          }`}
        >
          <p className="text-xs text-amber-400 font-medium flex items-center space-x-1.5">
            <Clock className="w-3.5 h-3.5" />
            <span>Pending Review</span>
          </p>
          <p className="text-xl font-bold text-amber-300 mt-1">{pendingCount}</p>
        </button>

        <button
          onClick={() => setStatusFilter('APPROVED')}
          className={`p-4 rounded-xl border text-left transition-all ${
            statusFilter === 'APPROVED'
              ? 'bg-emerald-500/10 border-emerald-500/50 shadow-sm shadow-emerald-500/10'
              : 'bg-slate-900/50 border-slate-800/80 hover:bg-slate-900'
          }`}
        >
          <p className="text-xs text-emerald-400 font-medium flex items-center space-x-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Approved</span>
          </p>
          <p className="text-xl font-bold text-emerald-300 mt-1">{approvedCount}</p>
        </button>

        <button
          onClick={() => setStatusFilter('REJECTED')}
          className={`p-4 rounded-xl border text-left transition-all ${
            statusFilter === 'REJECTED'
              ? 'bg-rose-500/10 border-rose-500/50 shadow-sm shadow-rose-500/10'
              : 'bg-slate-900/50 border-slate-800/80 hover:bg-slate-900'
          }`}
        >
          <p className="text-xs text-rose-400 font-medium flex items-center space-x-1.5">
            <XCircle className="w-3.5 h-3.5" />
            <span>Rejected</span>
          </p>
          <p className="text-xl font-bold text-rose-300 mt-1">{rejectedCount}</p>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search by applicant name, email, account label, or User ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-900/70 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>
      </div>

      {/* Requests List */}
      <div className="space-y-4">
        {filteredRequests.length === 0 ? (
          <div className="p-12 text-center border border-slate-800/80 rounded-2xl bg-slate-900/30">
            <FileText className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-300">No account requests found</p>
            <p className="text-xs text-slate-500 mt-1">
              {statusFilter !== 'ALL'
                ? `There are no requests matching filter "${statusFilter}".`
                : 'Account opening requests submitted by users will appear here for review.'}
            </p>
          </div>
        ) : (
          filteredRequests.map((req) => {
            const isPending = req.status === 'PENDING';
            const isApproved = req.status === 'APPROVED';
            const isRejected = req.status === 'REJECTED';
            const isSelfRequest = user?.id === req.userId;

            return (
              <div
                key={req.id}
                className="p-5 rounded-2xl border border-slate-800 bg-[#0c1220] hover:border-slate-700/80 transition-all space-y-4"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left: Applicant info & Request details */}
                  <div className="space-y-2">
                    <div className="flex items-center space-x-3">
                      <span className="text-base font-bold text-slate-100">{req.accountName}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-slate-800 text-cyan-400 border border-slate-700">
                        {req.accountType}
                      </span>
                      {isPending && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          PENDING REVIEW
                        </span>
                      )}
                      {isApproved && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          APPROVED
                        </span>
                      )}
                      {isRejected && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          REJECTED
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                      <span className="flex items-center space-x-1.5">
                        <User className="w-3.5 h-3.5 text-slate-500" />
                        <span className="text-slate-300 font-medium">
                          {req.user?.fullName || 'Applicant'} ({req.user?.email || 'N/A'})
                        </span>
                      </span>
                      <span>•</span>
                      <span className="font-mono text-[11px] text-slate-500">User ID: {req.userId}</span>
                      <span>•</span>
                      <span className="flex items-center space-x-1 text-slate-500 text-[11px]">
                        <Clock className="w-3 h-3" />
                        <span>Submitted {new Date(req.createdAt).toLocaleString()}</span>
                      </span>
                    </div>

                    {req.reason && (
                      <p className="text-xs text-slate-300 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/80">
                        <strong className="text-slate-400">Applicant Reason:</strong> {req.reason}
                      </p>
                    )}
                  </div>

                  {/* Right: Requested Balance */}
                  <div className="text-left lg:text-right shrink-0">
                    <p className="text-xs text-slate-400">Requested Capital</p>
                    <p className="text-xl font-bold font-mono text-emerald-400">
                      ${Number(req.requestedBalance).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      <span className="text-xs text-slate-400 ml-1 font-sans">{req.currency}</span>
                    </p>
                  </div>
                </div>

                {/* Review status or Admin action controls */}
                {isPending ? (
                  <div className="pt-3 border-t border-slate-800/80 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                    <div className="flex-1">
                      <input
                        type="text"
                        placeholder="Admin remarks or approval justification (optional)..."
                        value={remarks[req.id] || ''}
                        onChange={(e) => setRemarks({ ...remarks, [req.id]: e.target.value })}
                        disabled={!isAdmin || isSelfRequest}
                        className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 disabled:opacity-50"
                      />
                    </div>

                    {isSelfRequest ? (
                      <div className="text-xs text-amber-400/90 font-medium px-3 py-1 bg-amber-500/10 rounded-lg border border-amber-500/20">
                        Self-approval prohibited (must be approved by another admin)
                      </div>
                    ) : isAdmin ? (
                      <div className="flex items-center space-x-2 shrink-0">
                        <button
                          onClick={() => handleReject(req.id)}
                          disabled={processingId === req.id}
                          className="px-3.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 text-xs font-semibold transition-all flex items-center space-x-1.5 disabled:opacity-50"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Reject</span>
                        </button>

                        <button
                          onClick={() => handleApprove(req.id, req.userId)}
                          disabled={processingId === req.id}
                          className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-all flex items-center space-x-1.5 shadow-sm shadow-emerald-500/20 disabled:opacity-50"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>{processingId === req.id ? 'Processing...' : 'Approve & Open'}</span>
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="pt-3 border-t border-slate-800/80 text-xs text-slate-400 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-semibold text-slate-300">Admin Remarks:</span>{' '}
                      <span className="italic">{req.adminRemarks || 'None recorded'}</span>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Reviewed by: {req.reviewedBy?.fullName || req.reviewedById || 'Administrator'} •{' '}
                      {req.reviewedAt ? new Date(req.reviewedAt).toLocaleString() : ''}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
