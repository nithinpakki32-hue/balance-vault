import React, { useState, useEffect, useCallback } from 'react';
import { AccountRequest, AccountRequestStatus, AccountType } from '../types/index.js';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.js';
import {
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  RefreshCw,
  Search,
  Filter,
  Check,
  X,
  Plus,
  Send
} from 'lucide-react';

interface AccountRequestsPageProps {
  onRefreshParent?: () => void;
}

export const AccountRequestsPage: React.FC<AccountRequestsPageProps> = ({ onRefreshParent }) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [requests, setRequests] = useState<AccountRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'ALL' | AccountRequestStatus>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Admin remarks input per request
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [processingId, setProcessingId] = useState<string | null>(null);

  // New Request Form State (for members)
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [reqName, setReqName] = useState('');
  const [reqType, setReqType] = useState<AccountType>('CHECKING');
  const [reqBalance, setReqBalance] = useState('0');
  const [reqCurrency] = useState('USD');
  const [reqReason, setReqReason] = useState('');
  const [isSubmittingReq, setIsSubmittingReq] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.getAccountRequests();
      if (res.success) {
        setRequests(res.requests || []);
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
        setSuccess(`Account request approved successfully! Vault Account ${res.account?.accountNumber || ''} provisioned.`);
        await fetchRequests();
        if (onRefreshParent) onRefreshParent();
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
      const res = await api.rejectAccountRequest(reqId, { remarks: remarkText, reason: remarkText });
      if (res.success) {
        setSuccess('Account request has been rejected.');
        await fetchRequests();
        if (onRefreshParent) onRefreshParent();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to reject account request.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleSubmitNewRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const numBal = parseFloat(reqBalance);
    if (isNaN(numBal) || numBal < 0) {
      setFormError('Opening balance must be zero or positive.');
      return;
    }

    if (reqName.trim().length < 2) {
      setFormError('Account name must be at least 2 characters.');
      return;
    }

    if (reqReason.trim().length < 5) {
      setFormError('Please provide a legitimate purpose for opening this account (at least 5 characters).');
      return;
    }

    setIsSubmittingReq(true);
    try {
      const res = await api.requestAccount({
        accountName: reqName.trim(),
        accountType: reqType,
        requestedBalance: numBal,
        currency: reqCurrency,
        reason: reqReason.trim(),
      });

      if (res.success) {
        setSuccess('Your new account request was submitted! It is now PENDING administrator review.');
        setIsFormOpen(false);
        setReqName('');
        setReqBalance('0');
        setReqReason('');
        await fetchRequests();
        if (onRefreshParent) onRefreshParent();
      }
    } catch (err: any) {
      setFormError(err.message || 'Failed to submit account request.');
    } finally {
      setIsSubmittingReq(false);
    }
  };

  const filteredRequests = requests.filter((req) => {
    const matchesStatus = statusFilter === 'ALL' || req.status === statusFilter;
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !searchQuery ||
      req.accountName.toLowerCase().includes(q) ||
      req.accountType.toLowerCase().includes(q) ||
      (req.user?.fullName && req.user.fullName.toLowerCase().includes(q)) ||
      (req.user?.email && req.user.email.toLowerCase().includes(q)) ||
      (req.reason && req.reason.toLowerCase().includes(q));
    return matchesStatus && matchesSearch;
  });

  const pendingCount = requests.filter((r) => r.status === 'PENDING').length;
  const approvedCount = requests.filter((r) => r.status === 'APPROVED').length;
  const rejectedCount = requests.filter((r) => r.status === 'REJECTED').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-100">Vault Account Requests & Approvals</h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded uppercase font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
              Mandatory Governance
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {isAdmin
              ? 'Institutional review center: verify applicant KYC and authorize account creation'
              : 'Submit account opening applications for administrator review and track approval status'}
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchRequests}
            disabled={isLoading}
            className="p-2 rounded-lg border border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50"
            title="Refresh Requests"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>

          {/* Members can request accounts */}
          <button
            onClick={() => setIsFormOpen(!isFormOpen)}
            className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition-all shadow-sm shadow-cyan-500/20 flex items-center space-x-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{isFormOpen ? 'Close Request Form' : 'Request New Account'}</span>
          </button>
        </div>
      </div>

      {/* Embedded New Account Request Form (When Open) */}
      {isFormOpen && (
        <div className="p-6 rounded-2xl border border-cyan-500/30 bg-[#0f172a]/95 backdrop-blur-md shadow-2xl animate-in fade-in duration-150 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
                <FileText className="w-4 h-4 text-cyan-400" />
                <span>Submit Account Opening Request</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Submitting this form initiates an approval request with status PENDING. No funds or accounts are provisioned until approved by an administrator.
              </p>
            </div>
            <button
              onClick={() => setIsFormOpen(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {formError && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={handleSubmitNewRequest} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Account Label / Name</label>
              <input
                type="text"
                placeholder="e.g. Operations Treasury, Escrow Holding"
                value={reqName}
                onChange={(e) => setReqName(e.target.value)}
                required
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Account Type</label>
              <select
                value={reqType}
                onChange={(e) => setReqType(e.target.value as AccountType)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500"
              >
                <option value="CHECKING">CHECKING</option>
                <option value="SAVINGS">SAVINGS</option>
                <option value="INVESTMENT">INVESTMENT</option>
                <option value="ESCROW">ESCROW</option>
                <option value="TREASURY">TREASURY</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Requested Opening Balance (USD)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-sm">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={reqBalance}
                  onChange={(e) => setReqBalance(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-7 pr-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Note: Initial balance is verified by admin before real ledger allocation.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Business Justification / Reason</label>
              <input
                type="text"
                placeholder="Reason for opening account (e.g. Segregated operational funds)"
                value={reqReason}
                onChange={(e) => setReqReason(e.target.value)}
                required
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="md:col-span-2 flex justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="px-4 py-2 rounded-lg text-xs text-slate-400 hover:text-slate-200 border border-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmittingReq}
                className="px-5 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold flex items-center space-x-1.5 disabled:opacity-50"
              >
                {isSubmittingReq ? (
                  <>
                    <div className="h-3 w-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    <span>Submitting Request...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Submit Request (Pending Approval)</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border border-slate-800 bg-[#0f172a]/60 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400">Pending Review</span>
            <div className="mt-1 text-2xl font-bold font-mono text-amber-400">{pendingCount}</div>
            <span className="text-[11px] text-slate-500">Awaiting admin review</span>
          </div>
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-800 bg-[#0f172a]/60 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400">Approved Accounts</span>
            <div className="mt-1 text-2xl font-bold font-mono text-emerald-400">{approvedCount}</div>
            <span className="text-[11px] text-slate-500">Successfully provisioned</span>
          </div>
          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-800 bg-[#0f172a]/60 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400">Rejected Requests</span>
            <div className="mt-1 text-2xl font-bold font-mono text-rose-400">{rejectedCount}</div>
            <span className="text-[11px] text-slate-500">Closed with remarks</span>
          </div>
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400">
            <XCircle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#0f172a]/70 p-4 rounded-xl border border-slate-800">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search by account name, user, or reason..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700/80 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500 placeholder:text-slate-500"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-xs text-slate-400">Status:</span>
          {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                statusFilter === st
                  ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

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

      {/* Requests List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="p-12 text-center text-xs text-slate-500 border border-slate-800 rounded-xl bg-[#0f172a]/60">
            Querying account opening requests...
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500 border border-slate-800 rounded-xl bg-[#0f172a]/60">
            No account requests found for current filters.
          </div>
        ) : (
          filteredRequests.map((req) => {
            const isPending = req.status === 'PENDING';
            const isApproved = req.status === 'APPROVED';
            const isSelfRequest = user?.id === req.userId;

            return (
              <div
                key={req.id}
                className="p-5 rounded-xl border border-slate-800 bg-[#0f172a]/70 hover:border-slate-700 transition-all space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
                  <div className="flex items-center space-x-3">
                    <span
                      className={`px-2.5 py-1 rounded text-xs font-bold uppercase font-mono flex items-center space-x-1.5 ${
                        isPending
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                          : isApproved
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                      }`}
                    >
                      {isPending && <Clock className="w-3.5 h-3.5" />}
                      {isApproved && <CheckCircle2 className="w-3.5 h-3.5" />}
                      {!isPending && !isApproved && <XCircle className="w-3.5 h-3.5" />}
                      <span>{req.status}</span>
                    </span>

                    <h3 className="font-semibold text-slate-100 text-sm">{req.accountName}</h3>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                      {req.accountType}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-xs text-slate-400">Requested Balance:</span>
                    <span className="text-sm font-bold font-mono text-cyan-400 ml-2">
                      ${Number(req.requestedBalance).toLocaleString('en-US', { minimumFractionDigits: 2 })} {req.currency}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div>
                    <span className="text-slate-500 block text-[11px]">Applicant KYC Identity</span>
                    <p className="font-medium text-slate-200 mt-0.5">
                      {req.user?.fullName || req.userId}
                    </p>
                    <p className="text-slate-400 font-mono text-[11px]">{req.user?.email}</p>
                    <span className="text-[10px] text-slate-500 font-mono">UID: {req.userId}</span>
                  </div>

                  <div>
                    <span className="text-slate-500 block text-[11px]">Opening Purpose / Reason</span>
                    <p className="text-slate-300 mt-0.5 italic">
                      &quot;{req.reason || 'Standard operational container'}&quot;
                    </p>
                    <span className="text-[10px] text-slate-500 block mt-1">
                      Submitted: {new Date(req.createdAt).toLocaleString()}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-500 block text-[11px]">Governance Status</span>
                    {req.adminRemarks ? (
                      <p className="text-slate-300 mt-0.5">
                        <span className="text-slate-400">Remarks:</span> {req.adminRemarks}
                      </p>
                    ) : (
                      <p className="text-slate-500 mt-0.5">No administrator remarks logged.</p>
                    )}
                    {req.reviewedBy && (
                      <span className="text-[10px] text-slate-500 block mt-1">
                        Reviewed by {req.reviewedBy.fullName} on {req.reviewedAt ? new Date(req.reviewedAt).toLocaleDateString() : ''}
                      </span>
                    )}
                    {req.createdAccount && (
                      <span className="text-[11px] text-emerald-400 font-mono block mt-1">
                        Provisioned Account: {req.createdAccount.accountNumber}
                      </span>
                    )}
                  </div>
                </div>

                {/* Admin Actions Bar (Only if ADMIN and request is PENDING) */}
                {isAdmin && isPending && (
                  <div className="border-t border-slate-800/80 pt-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    <div className="flex-1">
                      <input
                        type="text"
                        placeholder="Add review remarks or approval notes..."
                        value={remarks[req.id] || ''}
                        onChange={(e) => setRemarks({ ...remarks, [req.id]: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
                      />
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                      {isSelfRequest ? (
                        <span className="text-[11px] text-rose-400 italic">Self-approval prohibited</span>
                      ) : (
                        <>
                          <button
                            onClick={() => handleReject(req.id)}
                            disabled={processingId === req.id}
                            className="px-3.5 py-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-semibold flex items-center space-x-1.5 transition-all disabled:opacity-50"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Reject</span>
                          </button>

                          <button
                            onClick={() => handleApprove(req.id, req.userId)}
                            disabled={processingId === req.id}
                            className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold flex items-center space-x-1.5 transition-all shadow-sm shadow-emerald-500/20 disabled:opacity-50"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Approve & Provision</span>
                          </button>
                        </>
                      )}
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
export default AccountRequestsPage;
