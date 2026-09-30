import React, { useEffect, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Bot,
  CheckCircle2,
  Clock,
  Compass,
  FileText,
  Globe2,
  Lock,
  Play,
  RefreshCw,
  Scale,
  Shield,
  Sparkles,
  Target,
  Zap,
} from 'lucide-react';
import { ActivePosition, MarketSymbol, MultiTimeframeAnalysis, TradeApprovalMode, TradeSetup } from '../types';
import { getLiveSessionOverview, MarketSessionOverview } from '../utils/sessionManager';
import { getMarketHoursStatus, isMarketOpen } from '../utils/marketHours';

interface AISetupCardProps {
  setup: TradeSetup | null;
  multiTimeframe?: MultiTimeframeAnalysis;
  isAnalyzing: boolean;
  onTriggerAnalysis: () => void;
  onExecuteTrade: (setupId: string) => void;
  isExecuting: boolean;
  tradeApprovalMode: TradeApprovalMode;
  allAssetSetups?: Partial<Record<MarketSymbol, TradeSetup>>;
  currentSymbol?: MarketSymbol;
  isBestCandidate?: boolean;
  activePositions?: ActivePosition[];
  onSelectSymbol?: (symbol: MarketSymbol) => void;
}

export const AISetupCard: React.FC<AISetupCardProps> = ({
  setup,
  multiTimeframe,
  isAnalyzing,
  onTriggerAnalysis,
  onExecuteTrade,
  isExecuting,
  tradeApprovalMode,
  allAssetSetups,
  currentSymbol,
  isBestCandidate = false,
  activePositions = [],
  onSelectSymbol,
}) => {
  // Use current symbol's setup if setup is null or mismatched
  const effectiveSetup = (setup && (!currentSymbol || setup.symbol === currentSymbol))
    ? setup
    : (currentSymbol && allAssetSetups?.[currentSymbol])
    ? allAssetSetups[currentSymbol]!
    : setup;

  const mtf = effectiveSetup?.multiTimeframe || multiTimeframe;
  const isLong = effectiveSetup?.direction === 'LONG';
  const isForex = effectiveSetup?.symbol === 'GBPUSD';
  const isJPY = effectiveSetup?.symbol === 'USDJPY';
  const formatPrice = (p: number) =>
    isForex
      ? p.toFixed(4)
      : isJPY
      ? p.toFixed(3)
      : p.toFixed(2);

  const activeSym = effectiveSetup?.symbol || currentSymbol || 'BTCUSD';
  const currentHours = getMarketHoursStatus(activeSym);

  const [sessionOverview, setSessionOverview] = useState<MarketSessionOverview>(() => getLiveSessionOverview());
  useEffect(() => {
    const timer = setInterval(() => {
      setSessionOverview(getLiveSessionOverview());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="bg-[#0f141f] border border-[#1e293b] rounded-xl overflow-hidden shadow-xl flex flex-col">
      {/* Header */}
      <div className="bg-[#151b28] px-4 py-2.5 border-b border-[#1e293b] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded bg-blue-600/20 text-blue-400 border border-blue-500/30">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-200 text-sm">AI Trading Decision Engine</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 font-mono border border-blue-500/20">
                SMC Model
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Active Session Tag */}
          <div
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono border ${
              sessionOverview.isLondonNyOverlap
                ? 'bg-amber-500/15 text-amber-300 border-amber-500/30 font-bold'
                : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
            }`}
            title={`Live Market Session: ${sessionOverview.primaryActiveName}`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>{sessionOverview.isLondonNyOverlap ? 'NY/LDN OVERLAP' : sessionOverview.primaryActiveName.split(' ')[0]}</span>
          </div>

          <button
            id="btn-refresh-setup-scan"
            onClick={onTriggerAnalysis}
            disabled={isAnalyzing}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin' : ''}`} />
            <span>{isAnalyzing ? 'Analyzing...' : 'Scan Now'}</span>
          </button>
        </div>
      </div>

      {/* Quick Jump Banner to Active Trades if running on other symbols */}
      {(() => {
        const otherActive = activePositions.filter(
          (p) => p.setup.symbol !== activeSym && p.setup.isLocked
        );
        if (otherActive.length === 0) return null;
        return (
          <div className="mx-4 mt-3 p-2 rounded-lg bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-transparent border border-amber-500/40 flex items-center justify-between text-xs gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <div className="min-w-0">
                <span className="text-amber-300 font-bold block text-[11px]">
                  {otherActive.length} Active Trade{otherActive.length > 1 ? 's' : ''} Locked 🔒
                </span>
                <span className="text-[10px] text-slate-300 truncate block">
                  {otherActive.map((p) => `${p.setup.symbol} ${p.setup.direction} (${p.unrealizedPnL >= 0 ? '+' : ''}$${p.unrealizedPnL.toFixed(2)})`).join(', ')}
                </span>
              </div>
            </div>
            {onSelectSymbol && (
              <button
                onClick={() => onSelectSymbol(otherActive[0].setup.symbol)}
                className="px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold font-mono text-[10px] shrink-0 transition-all shadow-sm flex items-center gap-1"
                title={`Switch locked setup panel to ${otherActive[0].setup.symbol}`}
              >
                <span>View {otherActive[0].setup.symbol}</span>
                <Lock className="w-2.5 h-2.5" />
              </button>
            )}
          </div>
        );
      })()}

      <div className="p-4 space-y-4 flex-1 flex flex-col justify-between">
        {/* Multi-Timeframe Status Bar */}
        {mtf && (
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-[#151b28] p-2.5 rounded-lg border border-slate-800">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] uppercase font-mono text-slate-400">
                  HTF ({mtf.higherTimeframe.timeframe}) Trend
                </span>
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                    mtf.higherTimeframe.trend === 'BULLISH'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : mtf.higherTimeframe.trend === 'BEARISH'
                      ? 'bg-rose-500/20 text-rose-400'
                      : 'bg-amber-500/20 text-amber-400'
                  }`}
                >
                  {mtf.higherTimeframe.trend}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 font-medium leading-tight">
                {mtf.higherTimeframe.majorStructure}
              </p>
            </div>

            <div className="bg-[#151b28] p-2.5 rounded-lg border border-slate-800">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] uppercase font-mono text-slate-400">
                  LTF ({mtf.entryTimeframe.timeframe}) Entry Trigger
                </span>
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                    mtf.entryTimeframe.confirmation === 'CONFIRMED'
                      ? 'bg-blue-500/20 text-blue-400'
                      : 'bg-slate-700 text-slate-300'
                  }`}
                >
                  {mtf.entryTimeframe.confirmation}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 font-medium leading-tight">
                {mtf.entryTimeframe.priceActionConfirmation}
              </p>
            </div>
          </div>
        )}

        {/* Setup Content */}
        {effectiveSetup ? (
          <div className="space-y-3.5">
            {/* Signal Badge & R:R */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-[#151b28] border border-slate-800">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wide">
                    Institutional SMC Setup
                  </div>
                  {effectiveSetup.status === 'PENDING_APPROVAL' ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse">
                      ⚡ BEST SETUP CONFIRMED
                    </span>
                  ) : effectiveSetup.status === 'WAITING_CONFIRMATION' ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                      ⏳ AWAITING 4-PILLAR CONFLUENCE
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40">
                      🔒 POSITION LOCKED
                    </span>
                  )}
                  {isBestCandidate && (
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                      ★ #1 RANKED ASSET
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span
                    className={`text-lg font-black tracking-tight flex items-center gap-1 ${
                      isLong ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {isLong ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
                    SIGNAL: {isLong ? 'LONG / BUY' : 'SHORT / SELL'}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded font-mono font-bold bg-slate-800 text-slate-200 border border-slate-700">
                    {effectiveSetup.symbol}
                  </span>
                </div>
              </div>

              <div className="text-right">
                <div className="text-[10px] font-mono text-slate-400 uppercase">Risk-to-Reward</div>
                <div className="text-base font-bold text-amber-400 font-mono">1:{effectiveSetup.riskRewardRatio}</div>
                <div className="text-[10px] text-emerald-400 font-semibold">{effectiveSetup.confidenceScore}% Confidence</div>
              </div>
            </div>

            {/* Exact Price Matrix - Guaranteed Entry, SL, and TP */}
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="bg-[#151b28] p-2.5 rounded-lg border border-blue-500/30">
                <div className="text-[10px] text-blue-400 font-mono font-bold">Entry Price</div>
                <div className="text-sm font-bold text-white font-mono">{formatPrice(effectiveSetup.entryPrice)}</div>
                <div className="text-[9px] text-slate-400 truncate">SMC Institutional Trigger</div>
              </div>
              <div className="bg-[#151b28] p-2.5 rounded-lg border border-rose-500/30">
                <div className="text-[10px] text-rose-400 font-mono font-bold">Stop Loss (SL)</div>
                <div className="text-sm font-bold text-rose-400 font-mono">{formatPrice(effectiveSetup.stopLoss)}</div>
                <div className="text-[9px] text-rose-300/80 truncate">Structural Invalidation</div>
              </div>
              <div className="bg-[#151b28] p-2.5 rounded-lg border border-emerald-500/30">
                <div className="text-[10px] text-emerald-400 font-mono font-bold">Take Profit (TP1)</div>
                <div className="text-sm font-bold text-emerald-400 font-mono">{formatPrice(effectiveSetup.takeProfit1)}</div>
                <div className="text-[9px] text-emerald-400/90 truncate font-medium">
                  {effectiveSetup.tp1Label ? effectiveSetup.tp1Label.replace('🎯 ', '') : 'Liquidity Pool Target'}
                </div>
              </div>
            </div>

            {/* Institutional Liquidity & Unmitigated TP Target Matrix */}
            <div className="bg-[#131b2c] p-3 rounded-lg border border-emerald-500/20 space-y-2 text-xs">
              <div className="text-[11px] font-semibold text-emerald-300 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Institutional SMC Take-Profit Targets</span>
                </div>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono uppercase">
                  Liquidity &amp; Unmitigated Areas
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                {/* TP1 */}
                <div className="bg-[#162035] p-2 rounded border border-emerald-500/30">
                  <div className="flex items-center justify-between text-[10px] text-emerald-400 font-mono font-bold mb-1">
                    <span>TP 1: {formatPrice(effectiveSetup.takeProfit1)}</span>
                    <span className="text-[9px] px-1 rounded bg-emerald-500/20">1:{effectiveSetup.riskRewardRatio} R:R</span>
                  </div>
                  <div className="text-[10px] text-slate-200 font-medium leading-tight">
                    {effectiveSetup.tp1Label || '🎯 Unmitigated FVG / Internal Liquidity'}
                  </div>
                </div>

                {/* TP2 */}
                <div className="bg-[#162035] p-2 rounded border border-slate-700/60">
                  <div className="flex items-center justify-between text-[10px] text-teal-300 font-mono font-bold mb-1">
                    <span>TP 2: {formatPrice(effectiveSetup.takeProfit2)}</span>
                    <span className="text-[9px] px-1 rounded bg-teal-500/20 text-teal-300">
                      1:{effectiveSetup.smcBreakdown.tpTargets?.tp2?.riskReward || 3.2} R:R
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-300 font-medium leading-tight">
                    {effectiveSetup.tp2Label || '🎯 Unmitigated Order Block / External Liquidity'}
                  </div>
                </div>

                {/* TP3 */}
                <div className="bg-[#162035] p-2 rounded border border-slate-700/60">
                  <div className="flex items-center justify-between text-[10px] text-cyan-300 font-mono font-bold mb-1">
                    <span>TP 3: {formatPrice(effectiveSetup.takeProfit3)}</span>
                    <span className="text-[9px] px-1 rounded bg-cyan-500/20 text-cyan-300">
                      1:{effectiveSetup.smcBreakdown.tpTargets?.tp3?.riskReward || 4.5} R:R
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-300 font-medium leading-tight">
                    {effectiveSetup.tp3Label || '🎯 Macro Range Liquidity Pool'}
                  </div>
                </div>
              </div>

              {effectiveSetup.smcBreakdown.takeProfitThesis && (
                <div className="text-[10.5px] text-slate-300 leading-relaxed bg-[#0e1626] p-2 rounded border border-slate-800/80 italic">
                  {effectiveSetup.smcBreakdown.takeProfitThesis}
                </div>
              )}
            </div>

            {/* Institutional SMC Checklist */}
            <div className="bg-[#151b28]/60 p-3 rounded-lg border border-slate-800 space-y-1.5 text-xs">
              <div className="text-[11px] font-semibold text-slate-300 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-blue-400" />
                <span>Smart Money Confirmation Checklist:</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] text-slate-400">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="truncate">{effectiveSetup.smcBreakdown.liquiditySweep}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="truncate">{effectiveSetup.smcBreakdown.structureBreak}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="truncate">{effectiveSetup.smcBreakdown.orderBlockReaction}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="truncate">{effectiveSetup.smcBreakdown.fvgConfirmation}</span>
                </div>
              </div>
            </div>

            {/* AI Narrative */}
            <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-800/80 text-xs">
              <div className="text-[10px] uppercase font-mono text-blue-400 font-semibold mb-1 flex items-center gap-1">
                <FileText className="w-3 h-3" />
                <span>Institutional Thesis Narrative</span>
              </div>
              <p className="text-slate-300 text-[11px] leading-relaxed italic">
                "{effectiveSetup.aiExplanation}"
              </p>
            </div>

            {/* Weekend Closed Notice */}
            {!currentHours.isOpen && (
              <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <Shield className="w-4 h-4 text-rose-400 shrink-0" />
                <div className="leading-tight">
                  <span className="font-bold">WEEKEND MARKET CLOSE:</span> Traditional markets (Forex, Metals, Indices) trade Monday to Friday only.
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    {currentHours.reopensAt || 'Re-opens Sunday 21:00 UTC'}. BTCUSD crypto trading is active 24/7.
                  </span>
                </div>
              </div>
            )}

            {/* Action Execution Button */}
            <div className="pt-1">
              {tradeApprovalMode === 'MANUAL' ? (
                <button
                  id="btn-confirm-execute-trade"
                  onClick={() => onExecuteTrade(effectiveSetup.id)}
                  disabled={isExecuting || !currentHours.isOpen}
                  className={`w-full py-2.5 px-4 rounded-lg font-bold text-xs tracking-wider uppercase transition-all shadow-lg flex items-center justify-center gap-2 ${
                    !currentHours.isOpen
                      ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                      : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white disabled:opacity-50'
                  }`}
                >
                  <Lock className="w-4 h-4" />
                  <span>
                    {!currentHours.isOpen
                      ? `MARKET CLOSED (${activeSym} Mon-Fri Only)`
                      : isExecuting
                      ? 'Locking Position...'
                      : 'Confirm & Execute Trade (Lock 🔒)'}
                  </span>
                </button>
              ) : (
                <div className={`p-2.5 rounded-lg border text-xs flex items-center justify-between font-mono ${
                  effectiveSetup.status === 'PENDING_APPROVAL'
                    ? 'bg-purple-500/15 border-purple-500/40 text-purple-200'
                    : 'bg-[#151b28] border-slate-800 text-slate-300'
                }`}>
                  <span className="flex items-center gap-1.5">
                    <Zap className={`w-4 h-4 ${effectiveSetup.status === 'PENDING_APPROVAL' ? 'text-purple-400 animate-pulse' : 'text-amber-400'}`} />
                    <span>
                      {effectiveSetup.status === 'PENDING_APPROVAL'
                        ? 'BEST Setup Confirmed Across Assets &bull; Routing to auto-execution...'
                        : 'Auto-Trader Active &bull; Patiently scanning all 5 assets (Refusing sub-par entries)'}
                    </span>
                  </span>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* No Setup / Watching Mode */
          <div className="p-6 text-center space-y-3 bg-[#151b28]/40 rounded-lg border border-dashed border-slate-800">
            <div className="w-12 h-12 mx-auto rounded-full bg-slate-800/60 flex items-center justify-center text-slate-400">
              <Compass className="w-6 h-6 animate-spin-slow" />
            </div>
            <div>
              <div className="font-bold text-slate-200 text-sm">MARKET WATCHING &bull; NO SETUP</div>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 leading-relaxed">
                The AI does not randomly generate BUY/SELL signals. The market is currently consolidating or awaiting clean liquidity sweep and Order Block retest.
              </p>
            </div>

            <div className="pt-2">
              <button
                id="btn-trigger-ai-scan"
                onClick={onTriggerAnalysis}
                disabled={isAnalyzing}
                className="px-4 py-2 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 text-xs font-semibold transition-all inline-flex items-center gap-1.5 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin' : ''}`} />
                <span>{isAnalyzing ? 'Evaluating Price Action...' : 'Run Institutional SMC Scan'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
