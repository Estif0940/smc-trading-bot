import React from 'react';
import { AlertTriangle, Check, ShieldAlert, X, Zap } from 'lucide-react';

interface AutoTradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmEnable: () => void;
}

export const AutoTradeModal: React.FC<AutoTradeModalProps> = ({
  isOpen,
  onClose,
  onConfirmEnable,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0f141f] border-2 border-purple-500/50 rounded-xl max-w-md w-full p-5 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded bg-purple-600 text-white shadow">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">Enable Auto-Trading Mode</h3>
              <p className="text-[10px] text-purple-400 font-mono">Automated Execution Mandate</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white font-bold text-base">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Warning Banner */}
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg p-3 space-y-2 text-xs text-rose-300">
          <div className="flex items-center gap-1.5 font-bold text-rose-400">
            <AlertTriangle className="w-4 h-4" />
            <span>CRITICAL RISK WARNING</span>
          </div>
          <p className="text-[11px] leading-relaxed text-rose-200/90">
            Auto-trading will automatically trigger trade executions immediately when the AI Decision Engine identifies a valid Smart Money Concept setup or receives a verified webhook signal.
          </p>
          <ul className="list-disc list-inside space-y-1 text-[11px] text-rose-200/80">
            <li>No manual confirmation prompt will be requested.</li>
            <li>Executed trades will become instantly <strong>LOCKED 🔒</strong>.</li>
            <li>Risk management rules (1% max risk, daily drawdown limit) remain strictly active.</li>
          </ul>
        </div>

        <div className="bg-[#151b28] p-3 rounded-lg border border-slate-800 text-xs text-slate-300 space-y-1.5">
          <div className="font-semibold text-white flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5 text-blue-400" />
            <span>Execution Safeguards Enforced:</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Trades continue to obey the single locked active position rule. The system will NOT flip between BUY and SELL during market noise.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
          >
            Keep Manual Approval
          </button>
          <button
            id="btn-confirm-auto-trade-enable"
            onClick={() => {
              onConfirmEnable();
              onClose();
            }}
            className="px-4 py-1.5 rounded bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow flex items-center gap-1.5"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>I Understand, Enable Auto-Trading</span>
          </button>
        </div>
      </div>
    </div>
  );
};
