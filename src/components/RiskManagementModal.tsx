import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  Percent,
  RefreshCw,
  Scale,
  Shield,
  Sliders,
  X,
} from 'lucide-react';
import { RiskSettings } from '../types';

interface RiskManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  riskSettings: RiskSettings;
  onSaveRiskSettings: (newSettings: Partial<RiskSettings>) => void;
  onResetPaperAccount: (balance: number) => void;
}

export const RiskManagementModal: React.FC<RiskManagementModalProps> = ({
  isOpen,
  onClose,
  riskSettings,
  onSaveRiskSettings,
  onResetPaperAccount,
}) => {
  const [balance, setBalance] = useState<number>(riskSettings?.accountBalance ?? 50000);
  const [maxRiskPercent, setMaxRiskPercent] = useState<number>(riskSettings?.maxRiskPerTradePercent ?? 1.0);
  const [maxDailyLoss, setMaxDailyLoss] = useState<number>(riskSettings?.maxDailyLossPercent ?? 3.0);
  const [leverage, setLeverage] = useState<number>(riskSettings?.leverage ?? 100);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (riskSettings) {
      if (riskSettings.accountBalance !== undefined) setBalance(riskSettings.accountBalance ?? 50000);
      if (riskSettings.maxRiskPerTradePercent !== undefined) setMaxRiskPercent(riskSettings.maxRiskPerTradePercent ?? 1.0);
      if (riskSettings.maxDailyLossPercent !== undefined) setMaxDailyLoss(riskSettings.maxDailyLossPercent ?? 3.0);
      if (riskSettings.leverage !== undefined) setLeverage(riskSettings.leverage ?? 100);
    }
  }, [riskSettings]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSaveRiskSettings({
      accountBalance: balance,
      maxRiskPerTradePercent: maxRiskPercent,
      maxDailyLossPercent: maxDailyLoss,
      leverage,
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  const handleReset = (resetBal: number) => {
    onResetPaperAccount(resetBal);
    setBalance(resetBal);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  const riskPerTradeDollars = (balance * maxRiskPercent) / 100;
  const maxDailyLossDollars = (balance * maxDailyLoss) / 100;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0f141f] border border-slate-700 rounded-xl max-w-lg w-full p-5 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">Institutional Risk Management Engine</h3>
              <p className="text-[11px] text-slate-400">Position sizing and risk-to-drawdown controls</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white font-bold text-base">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 text-xs">
          {/* Account Balance */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              Trading Capital / Balance ($)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={balance ?? 0}
                onChange={(e) => setBalance(parseFloat(e.target.value) || 0)}
                className="w-full bg-[#151b28] border border-slate-700 rounded px-3 py-2 text-white font-mono focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={() => handleReset(50000)}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-semibold whitespace-nowrap"
                title="Reset to $50k paper balance"
              >
                Reset $50k
              </button>
            </div>
          </div>

          {/* Max Risk Per Trade */}
          <div>
            <div className="flex justify-between text-slate-300 mb-1">
              <span className="font-semibold">Maximum Risk Per Trade (%)</span>
              <span className="font-mono font-bold text-amber-400">
                {maxRiskPercent}% = ${riskPerTradeDollars.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min="0.25"
              max="3.0"
              step="0.25"
              value={maxRiskPercent ?? 1.0}
              onChange={(e) => setMaxRiskPercent(parseFloat(e.target.value))}
              className="w-full accent-blue-500"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>0.25% (Conservative)</span>
              <span>1.0% (Institutional Standard)</span>
              <span>3.0% (Aggressive)</span>
            </div>
          </div>

          {/* Max Daily Loss */}
          <div>
            <div className="flex justify-between text-slate-300 mb-1">
              <span className="font-semibold">Max Daily Drawdown Loss Limit (%)</span>
              <span className="font-mono font-bold text-rose-400">
                -{maxDailyLoss}% = -${maxDailyLossDollars.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min="1.0"
              max="6.0"
              step="0.5"
              value={maxDailyLoss ?? 3.0}
              onChange={(e) => setMaxDailyLoss(parseFloat(e.target.value))}
              className="w-full accent-rose-500"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              The execution engine halts all further trades for the day if realized daily drawdown reaches this limit.
            </p>
          </div>

          {/* Mandatory Rule Notice */}
          <div className="bg-[#151b28] p-3 rounded-lg border border-slate-800 space-y-1.5 text-[11px] text-slate-400">
            <div className="font-bold text-amber-300 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Strict Rule Enforcement:</span>
            </div>
            <ul className="list-disc list-inside space-y-0.5">
              <li>Max open trades locked at 1 to enforce single active position monitoring.</li>
              <li>Lot sizing dynamically calculates: (Risk $ / Stop Loss Distance).</li>
              <li>Pre-trade checks reject any execution exceeding account risk parameters.</li>
            </ul>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-800">
          {savedSuccess ? (
            <span className="text-emerald-400 text-xs font-semibold flex items-center gap-1 font-mono">
              <CheckCircle2 className="w-4 h-4" /> Settings Updated!
            </span>
          ) : (
            <span />
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow"
            >
              Save Risk Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
