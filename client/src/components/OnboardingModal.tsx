import React, { useState } from 'react';
import { ShieldCheck, Database, Lock, ArrowRight, Check, X } from 'lucide-react';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ isOpen, onClose }) => {
  const [step, setStep] = useState(0);

  if (!isOpen) return null;

  const steps = [
    {
      title: 'Welcome to BalanceVault',
      subtitle: 'Secure Enterprise Ledger Platform',
      icon: ShieldCheck,
      content: (
        <div className="space-y-3 text-sm text-slate-300">
          <p>
            BalanceVault is engineered for high-integrity financial operations, providing transactional guarantees,
            real-time audit logging, and role-based permissions.
          </p>
          <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg space-y-1.5 text-xs text-slate-400">
            <div className="flex items-center space-x-2 text-cyan-400">
              <span className="font-semibold">Key Capabilities:</span>
            </div>
            <div>• Atomic fund transfers using PostgreSQL transactions</div>
            <div>• Distributed Redis rate-limiting on sensitive auth and ledger routes</div>
            <div>• Non-repudiation audit trails for compliance and security</div>
          </div>
        </div>
      ),
    },
    {
      title: 'Multi-Account Architecture',
      subtitle: 'Separated balances with instant settlements',
      icon: Database,
      content: (
        <div className="space-y-3 text-sm text-slate-300">
          <p>
            Each user can hold multiple accounts designated for distinct financial functions:
          </p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 rounded bg-slate-900 border border-slate-800">
              <span className="font-semibold text-cyan-400 block mb-1">Checking</span>
              Operating balance for day-to-day transfers.
            </div>
            <div className="p-2.5 rounded bg-slate-900 border border-slate-800">
              <span className="font-semibold text-emerald-400 block mb-1">Savings</span>
              Yield-earning reserve vault.
            </div>
            <div className="p-2.5 rounded bg-slate-900 border border-slate-800">
              <span className="font-semibold text-indigo-400 block mb-1">Investment</span>
              Portfolio capital allocation.
            </div>
            <div className="p-2.5 rounded bg-slate-900 border border-slate-800">
              <span className="font-semibold text-amber-400 block mb-1">Treasury</span>
              System settlement & liquidity pool.
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'Governance & RBAC Roles',
      subtitle: 'Principle of least privilege',
      icon: Lock,
      content: (
        <div className="space-y-3 text-sm text-slate-300">
          <p>
            BalanceVault features granular RBAC (Role-Based Access Control) to prevent unauthorized execution:
          </p>
          <ul className="space-y-2 text-xs text-slate-300">
            <li className="flex items-start space-x-2">
              <span className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 font-mono font-semibold">ADMIN</span>
              <span>Full control over users, privileges, ledger liquidity, and audit trails.</span>
            </li>
            <li className="flex items-start space-x-2">
              <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono font-semibold">AUDITOR</span>
              <span>Read-only compliance access to system-wide audit records and transactions.</span>
            </li>
            <li className="flex items-start space-x-2">
              <span className="px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-mono font-semibold">USER</span>
              <span>Autonomous management of personal accounts and verified transfers.</span>
            </li>
          </ul>
        </div>
      ),
    },
  ];

  const current = steps[step];
  const Icon = current.icon;
  const isLast = step === steps.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-[#0f172a] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="p-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                <Icon className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-100">{current.title}</h3>
                <p className="text-xs text-slate-400">{current.subtitle}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="py-6">
            {current.content}
          </div>

          {/* Stepper Dots & Buttons */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
            <div className="flex space-x-1.5">
              {steps.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${
                    i === step ? 'w-6 bg-cyan-400' : 'w-1.5 bg-slate-700'
                  }`}
                />
              ))}
            </div>

            <div className="flex space-x-2">
              {step > 0 && (
                <button
                  type="button"
                  onClick={() => setStep(step - 1)}
                  className="px-3 py-1.5 rounded-lg border border-slate-700 text-xs font-medium text-slate-300 hover:bg-slate-800"
                >
                  Back
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  if (isLast) {
                    onClose();
                  } else {
                    setStep(step + 1);
                  }
                }}
                className="px-4 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs transition-all flex items-center space-x-1.5"
              >
                <span>{isLast ? 'Get Started' : 'Continue'}</span>
                {isLast ? <Check className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
