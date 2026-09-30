import React, { useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Award,
  CheckCircle2,
  Clock,
  DollarSign,
  FileText,
  HelpCircle,
  Percent,
  TrendingUp,
  XCircle,
} from 'lucide-react';
import { TradeSetup, TradingStats } from '../types';

interface TradeHistoryTableProps {
  history: TradeSetup[];
  stats: TradingStats;
}

export const TradeHistoryTable: React.FC<TradeHistoryTableProps> = ({ history, stats }) => {
  const [selectedTrade, setSelectedTrade] = useState<TradeSetup | null>(null);

  const formatDate = (ts?: number) => {
    if (!ts) return '-';
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className="bg-[#0f141f] border border-[#1e293b] rounded-xl p-4 shadow-xl space-y-4">
      {/* Header & Stats Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1e293b] pb-3">
        <div>
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-400" />
            <span>Institutional Trade Execution Log & Performance</span>
          </h3>
          <p className="text-[11px] text-slate-400">
            Verified Smart Money Concept setups with automated TP/SL execution history
          </p>
        </div>

        {/* Quick KPI Chips */}
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
          <div className="bg-[#151b28] px-2.5 py-1 rounded border border-slate-800">
            <span className="text-slate-400 text-[10px] block">Win Rate</span>
            <span className="font-bold text-emerald-400">{stats.winRate}%</span>
          </div>
          <div className="bg-[#151b28] px-2.5 py-1 rounded border border-slate-800">
            <span className="text-slate-400 text-[10px] block">Total Trades</span>
            <span className="font-bold text-white">{stats.totalTrades}</span>
          </div>
          <div className="bg-[#151b28] px-2.5 py-1 rounded border border-slate-800">
            <span className="text-slate-400 text-[10px] block">Avg R:R</span>
            <span className="font-bold text-amber-400">1:{stats.avgRiskReward}</span>
          </div>
          <div className="bg-[#151b28] px-2.5 py-1 rounded border border-slate-800">
            <span className="text-slate-400 text-[10px] block">Total Realized P&L</span>
            <span
              className={`font-bold ${
                stats.totalProfitLoss >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {stats.totalProfitLoss >= 0 ? '+' : ''}${stats.totalProfitLoss.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-800 text-[10px] font-mono uppercase text-slate-400 bg-[#151b28]/60">
              <th className="py-2 px-3">Trade ID</th>
              <th className="py-2 px-3">Symbol</th>
              <th className="py-2 px-3">Direction</th>
              <th className="py-2 px-3">Entry</th>
              <th className="py-2 px-3">Exit</th>
              <th className="py-2 px-3">SL</th>
              <th className="py-2 px-3">TP1</th>
              <th className="py-2 px-3">Time</th>
              <th className="py-2 px-3">P/L ($)</th>
              <th className="py-2 px-3">Outcome</th>
              <th className="py-2 px-3">AI SMC Reason</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {history.length === 0 ? (
              <tr>
                <td colSpan={11} className="py-6 text-center text-slate-500 font-sans">
                  No completed trades in current session. Execute a setup to record history.
                </td>
              </tr>
            ) : (
              history.map((trade) => {
                const isLong = trade.direction === 'LONG';
                const isWin = trade.outcome === 'WIN';
                const isForex = trade.symbol === 'GBPUSD';
                const formatP = (p?: number) => (p === undefined ? '-' : isForex ? p.toFixed(4) : trade.symbol === 'XAUUSD' ? p.toFixed(2) : p.toFixed(2));

                return (
                  <tr key={trade.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-2 px-3 text-[11px] text-slate-400 font-mono">{trade.id.substring(0, 10)}</td>
                    <td className="py-2 px-3 font-bold text-white">{trade.symbol}</td>
                    <td className="py-2 px-3">
                      <span
                        className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          isLong
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-rose-500/20 text-rose-400'
                        }`}
                      >
                        {isLong ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        {trade.direction}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-300">{formatP(trade.entryPrice)}</td>
                    <td className="py-2 px-3 text-white font-semibold">{formatP(trade.exitPrice)}</td>
                    <td className="py-2 px-3 text-rose-400">{formatP(trade.stopLoss)}</td>
                    <td className="py-2 px-3 text-emerald-400">{formatP(trade.takeProfit1)}</td>
                    <td className="py-2 px-3 text-slate-400 text-[10px]">
                      {formatDate(trade.executedAt)} &rarr; {formatDate(trade.closedAt)}
                    </td>
                    <td
                      className={`py-2 px-3 font-bold ${
                        (trade.profitAmount || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {(trade.profitAmount || 0) >= 0 ? '+' : ''}
                      ${Math.abs(trade.profitAmount || 0).toFixed(2)}
                    </td>
                    <td className="py-2 px-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                          isWin
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        }`}
                      >
                        {isWin ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        {trade.outcome}
                      </span>
                    </td>
                    <td className="py-2 px-3 font-sans">
                      <button
                        onClick={() => setSelectedTrade(trade)}
                        className="text-blue-400 hover:text-blue-300 underline text-[11px] flex items-center gap-1 cursor-pointer"
                      >
                        <FileText className="w-3 h-3" />
                        <span>View Thesis</span>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Thesis Detail Modal */}
      {selectedTrade && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f141f] border border-slate-700 rounded-xl max-w-lg w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h4 className="font-bold text-sm text-white flex items-center gap-2">
                <span>AI Trade Thesis &bull; {selectedTrade.symbol} {selectedTrade.direction}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded ${
                    selectedTrade.outcome === 'WIN' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                  }`}
                >
                  {selectedTrade.outcome}
                </span>
              </h4>
              <button
                onClick={() => setSelectedTrade(null)}
                className="text-slate-400 hover:text-white font-bold text-sm"
              >
                &times;
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="bg-slate-900 p-3 rounded-lg text-slate-300 leading-relaxed italic border border-slate-800">
                "{selectedTrade.aiExplanation}"
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 font-mono">
                <div className="bg-[#151b28] p-2 rounded border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Close Reason</span>
                  <span className="text-amber-400 font-bold">{selectedTrade.closeReason || 'TAKE_PROFIT'}</span>
                </div>
                <div className="bg-[#151b28] p-2 rounded border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Realized P/L</span>
                  <span className={(selectedTrade.profitAmount || 0) >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                    ${(selectedTrade.profitAmount || 0).toFixed(2)} ({selectedTrade.profitPercent}%)
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setSelectedTrade(null)}
              className="w-full py-2 rounded bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
