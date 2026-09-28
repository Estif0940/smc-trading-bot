import React, { useState } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Compass,
  Cpu,
  Flame,
  Layers,
  Lock,
  Play,
  Radio,
  RefreshCw,
  RotateCcw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Target,
  Zap,
} from 'lucide-react';
import { AutoTraderState, MarketSymbol, ActivePosition } from '../types';
import { getMarketHoursStatus, isMarketOpen } from '../utils/marketHours';

interface AutoTraderBarProps {
  autoTraderState: AutoTraderState | null;
  activePosition: ActivePosition | null;
  activePositions?: ActivePosition[];
  currentSymbol: MarketSymbol;
  onToggleAutoTrade: () => void;
  onTriggerScanNow: (symbol?: MarketSymbol) => void;
  onSelectSymbol: (symbol: MarketSymbol) => void;
  isScanningNow: boolean;
}

export const AutoTraderBar: React.FC<AutoTraderBarProps> = ({
  autoTraderState,
  activePosition,
  activePositions = [],
  currentSymbol,
  onToggleAutoTrade,
  onTriggerScanNow,
  onSelectSymbol,
  isScanningNow,
}) => {
  const [showLogs, setShowLogs] = useState(false);
  const [showLimitSettings, setShowLimitSettings] = useState(false);
  const [isResettingLimit, setIsResettingLimit] = useState(false);
  const [showCrossAssetGrid, setShowCrossAssetGrid] = useState(true);

  const isEnabled = autoTraderState?.enabled ?? false;
  const status = autoTraderState?.status ?? 'IDLE';
  const scanningSymbol = autoTraderState?.currentScanningSymbol || currentSymbol;
  const nextIn = autoTraderState?.nextScanInSeconds ?? 0;
  const totalTrades = autoTraderState?.totalAutoTrades ?? 0;
  const todayTrades = autoTraderState?.todaySetupsCount ?? 0;
  const maxLimit = autoTraderState?.maxSetupsLimit ?? 3;
  const limitReached = Boolean(autoTraderState?.limitReached);
  const waitingDetails = autoTraderState?.waitingDetails;

  const handleResetLimit = async () => {
    setIsResettingLimit(true);
    try {
      await fetch('/api/autotrader/reset-limit', { method: 'POST' });
    } catch (e) {
      console.error('Failed to reset limit:', e);
    } finally {
      setIsResettingLimit(false);
    }
  };

  const handleUpdateLimit = async (newLimit: number) => {
    try {
      await fetch('/api/autotrader/set-limit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: newLimit }),
      });
      setShowLimitSettings(false);
    } catch (e) {
      console.error('Failed to update limit:', e);
    }
  };

  // Determine status color and badge
  const getStatusBadge = () => {
    if (!isEnabled) {
      return {
        label: 'BOT STANDBY',
        color: 'bg-slate-800 text-slate-400 border-slate-700',
        dot: 'bg-slate-500',
        icon: Bot,
      };
    }
    if (limitReached || status === 'SETUP_LIMIT_REACHED') {
      return {
        label: `SETUP LIMIT REACHED (${todayTrades}/${maxLimit}) 🛑`,
        color: 'bg-rose-500/20 text-rose-300 border-rose-500/50 shadow-rose-950/40 ring-1 ring-rose-500/30 animate-pulse',
        dot: 'bg-rose-500',
        icon: ShieldAlert,
      };
    }
    if (activePosition && activePosition.setup.isLocked) {
      return {
        label: 'TRADE LOCKED 🔒',
        color: 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse',
        dot: 'bg-amber-400',
        icon: Lock,
      };
    }
    if (status === 'COOLDOWN') {
      return {
        label: `DISCIPLINED COOLDOWN (${nextIn}s)`,
        color: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
        dot: 'bg-blue-400',
        icon: Clock,
      };
    }
    if (status === 'ENTRY_FOUND') {
      return {
        label: 'EXECUTING CONFIRMED ENTRY ⚡',
        color: 'bg-purple-500/20 text-purple-300 border-purple-500/40 animate-pulse',
        dot: 'bg-purple-400',
        icon: Zap,
      };
    }
    if (status === 'WAITING_CONFIRMATION') {
      return {
        label: `PATIENT WAITING (${nextIn}s)`,
        color: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
        dot: 'bg-amber-400 animate-pulse',
        icon: Clock,
      };
    }
    return {
      label: `SCANNING FOR CONFIRMATION (${nextIn}s)`,
      color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
      dot: 'bg-emerald-400 animate-ping',
      icon: Search,
    };
  };

  const badge = getStatusBadge();
  const BadgeIcon = badge.icon;

  return (
    <div
      id="auto-trader-bar"
      className={`rounded-xl border transition-all duration-300 ${
        limitReached
          ? 'bg-gradient-to-r from-[#1d0d12] via-[#241117] to-[#1d0d12] border-rose-500/50 shadow-lg shadow-rose-950/30'
          : isEnabled
          ? activePosition
            ? 'bg-gradient-to-r from-[#121722] via-[#1a1c29] to-[#121722] border-amber-500/40 shadow-lg shadow-amber-950/20'
            : 'bg-gradient-to-r from-[#0d1424] via-[#11192e] to-[#0d1424] border-purple-500/40 shadow-lg shadow-purple-950/20'
          : 'bg-[#0f141f] border-slate-800/80 shadow-md'
      }`}
    >
      <div className="p-3 sm:p-3.5 space-y-2.5">
        {/* Top Line: Mode Toggle, Status Badge, Setup Limit Tracker & Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            {/* Master Bot Toggle Button */}
            <button
              id="btn-toggle-autotrader-master"
              onClick={onToggleAutoTrade}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-md ${
                isEnabled
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-purple-900/50 hover:from-purple-500 hover:to-indigo-500 ring-2 ring-purple-400/40'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
              }`}
            >
              <Zap className={`w-4 h-4 ${isEnabled ? 'text-amber-300 fill-amber-300 animate-pulse' : 'text-slate-400'}`} />
              <span>{isEnabled ? 'AUTONOMOUS BOT: ACTIVE ⚡' : 'AUTONOMOUS BOT: OFF'}</span>
            </button>

            {/* Dynamic Status Pill */}
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-bold border ${badge.color}`}
            >
              <span className={`w-2 h-2 rounded-full ${badge.dot}`} />
              <BadgeIcon className="w-3.5 h-3.5" />
              <span>{badge.label}</span>
            </div>

            {/* Setup Limit Tracker Pill & Selector */}
            <div className="relative">
              <button
                id="btn-setup-limit-dropdown"
                onClick={() => setShowLimitSettings(!showLimitSettings)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-mono border transition-all ${
                  limitReached
                    ? 'bg-rose-500/25 border-rose-500/50 text-rose-300 font-bold'
                    : 'bg-[#151b28] border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white'
                }`}
                title="Click to adjust daily setup limit cap"
              >
                <Shield className="w-3.5 h-3.5 text-blue-400" />
                <span>
                  Setup Limit: <b className={limitReached ? 'text-rose-300 font-bold' : 'text-white'}>{todayTrades}/{maxLimit}</b>
                </span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {/* Setup Limit Quick Selector Menu */}
              {showLimitSettings && (
                <div className="absolute top-full left-0 mt-1 z-30 bg-[#0f141f] border border-slate-800 rounded-xl p-2.5 shadow-2xl space-y-2 min-w-[210px] animate-in fade-in duration-150">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Daily Setup Limit Cap:
                  </div>
                  <div className="grid grid-cols-5 gap-1 font-mono text-xs">
                    {[1, 2, 3, 5, 10].map((num) => (
                      <button
                        key={num}
                        onClick={() => handleUpdateLimit(num)}
                        className={`py-1 rounded text-center font-bold transition-all border ${
                          maxLimit === num
                            ? 'bg-blue-600 text-white border-blue-400'
                            : 'bg-[#151b28] text-slate-300 border-slate-800 hover:bg-slate-800'
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                  <div className="pt-1 border-t border-slate-800 flex justify-between items-center text-[10px]">
                    <span className="text-slate-400">Trades today: {todayTrades}</span>
                    <button
                      onClick={handleResetLimit}
                      disabled={isResettingLimit}
                      className="text-amber-400 hover:text-amber-300 underline font-bold"
                    >
                      Reset to 0
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Reset Limit Button if limit is reached */}
            {limitReached && (
              <button
                id="btn-reset-limit-action"
                onClick={handleResetLimit}
                disabled={isResettingLimit}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-md transition-all animate-pulse"
                title="Reset trade counter to 0 and resume autonomous scanning"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${isResettingLimit ? 'animate-spin' : ''}`} />
                <span>Reset Limit (Resume)</span>
              </button>
            )}
          </div>

          {/* Quick Actions (Scan Now & Logs) */}
          <div className="flex items-center gap-2">
            {/* Scan & Auto-Enter Now Button */}
            <button
              id="btn-scan-auto-enter-now"
              onClick={() => onTriggerScanNow(currentSymbol)}
              disabled={isScanningNow || Boolean(activePosition && activePosition.setup.isLocked) || limitReached}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow"
              title={limitReached ? 'Setup limit reached. Reset limit to execute more trades.' : 'Immediately trigger AI SMC scan with strict confirmation'}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isScanningNow ? 'animate-spin text-blue-400' : ''}`} />
              <span>{isScanningNow ? 'Verifying Confirmation...' : 'Scan Confirmed Setup'}</span>
            </button>

            {/* Toggle Cross-Asset Matrix View */}
            <button
              id="btn-toggle-asset-matrix"
              onClick={() => setShowCrossAssetGrid(!showCrossAssetGrid)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-mono flex items-center gap-1.5 transition-colors border ${
                showCrossAssetGrid
                  ? 'bg-blue-600/20 text-blue-300 border-blue-500/40'
                  : 'bg-[#151b28] text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
              title="Show cross-asset analysis matrix across all 5 assets"
            >
              <Layers className="w-3.5 h-3.5 text-blue-400" />
              <span className="hidden sm:inline">All Assets ({autoTraderState?.watchlist?.length || 11})</span>
              {showCrossAssetGrid ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>

            {/* Toggle Logs View */}
            <button
              id="btn-toggle-autotrader-logs"
              onClick={() => setShowLogs(!showLogs)}
              className="px-2 py-1.5 rounded-lg text-xs font-mono text-slate-400 hover:text-slate-200 bg-[#151b28] border border-slate-800 hover:border-slate-700 flex items-center gap-1"
              title="Show bot activity audit log"
            >
              <Activity className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Log</span>
              {showLogs ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>
        </div>

        {/* Dynamic Workflow Status Narrative */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-[#0b0f17]/90 border border-slate-800/80 font-mono text-xs">
          <div className="flex items-center gap-2 text-slate-300 flex-1 min-w-[280px]">
            {limitReached ? (
              <div className="flex items-center gap-2 text-rose-300">
                <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400 animate-pulse" />
                <span className="text-[11px] leading-snug">
                  <strong>SETUP LIMIT REACHED ({todayTrades}/{maxLimit} TRADES EXECUTED):</strong>{' '}
                  Trading automatically paused to prevent overtrading and preserve capital.{' '}
                  <button onClick={handleResetLimit} className="text-amber-300 underline font-bold ml-1 hover:text-amber-200">
                    Click here to reset counter
                  </button>{' '}
                  or adjust limit to continue.
                </span>
              </div>
            ) : activePosition && activePosition.setup.isLocked ? (
              <div className="flex items-center gap-2 text-amber-300">
                <Lock className="w-4 h-4 shrink-0 text-amber-400" />
                <span className="text-[11px] leading-snug">
                  <strong>TRADE IN PROGRESS:</strong> {activePosition.setup.symbol} {activePosition.setup.direction} @{' '}
                  ${activePosition.setup.entryPrice.toFixed(2)} &bull; SL: ${activePosition.setup.stopLoss.toFixed(2)} &bull; TP:{' '}
                  ${activePosition.setup.takeProfit1.toFixed(2)} &bull;{' '}
                  <span className={activePosition.unrealizedPnL >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                    PnL: {activePosition.unrealizedPnL >= 0 ? '+' : ''}${activePosition.unrealizedPnL.toFixed(2)} ({activePosition.unrealizedPnLPercent >= 0 ? '+' : ''}{activePosition.unrealizedPnLPercent}%)
                  </span>
                  . <span className="text-slate-400">Waiting until Take Profit or Stop Loss hits.</span>
                </span>
              </div>
            ) : isEnabled ? (
              <div className="flex items-start gap-2">
                <Clock className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                <div className="text-[11px] text-slate-300">
                  <span>{autoTraderState?.statusMessage || 'Auto-scanning for confirmed SMC setups...'}</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-slate-400">
                <Bot className="w-4 h-4 shrink-0 text-slate-500" />
                <span className="text-[11px]">
                  Autonomous Scan & Trade loop is standby. Turn on <strong>AUTONOMOUS BOT</strong> to scan for strictly confirmed SMC entries, execute trades with SL/TP, and enforce capital preservation limits.
                </span>
              </div>
            )}
          </div>

          {/* Watchlist Scanner Chips with Cooldown & Active Trade Indicators */}
          <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
            <span className="text-[10px] text-slate-400 uppercase hidden md:inline">Scanner Watchlist:</span>
            {(['XAUUSD', 'BTCUSD', 'EURUSD', 'GBPUSD', 'ETHUSD'] as MarketSymbol[]).map((sym) => {
              const isCurrentScan = isEnabled && scanningSymbol === sym;
              const isSelected = currentSymbol === sym;
              const cooldownUntil = autoTraderState?.activeAssetCooldowns?.[sym] || 0;
              const isAssetOnCooldown = Date.now() < cooldownUntil;
              const cooldownSec = isAssetOnCooldown ? Math.ceil((cooldownUntil - Date.now()) / 1000) : 0;
              const posForSym =
                activePositions?.find((p) => p.setup.symbol === sym && p.setup.isLocked) ||
                autoTraderState?.activePositions?.find((p) => p.setup.symbol === sym && p.setup.isLocked) ||
                (activePosition?.setup.symbol === sym && activePosition.setup.isLocked ? activePosition : null);

              return (
                <button
                  key={sym}
                  onClick={() => onSelectSymbol(sym)}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono transition-all border flex items-center gap-1 ${
                    posForSym
                      ? isSelected
                        ? 'bg-amber-500/30 text-amber-200 border-amber-400 ring-1 ring-amber-400/50 shadow-sm'
                        : 'bg-amber-950/40 text-amber-300 border-amber-500/50 hover:bg-amber-900/40 shadow-sm'
                      : isCurrentScan
                      ? 'bg-purple-600/30 text-purple-200 border-purple-400 ring-1 ring-purple-400/50 animate-pulse'
                      : isAssetOnCooldown
                      ? 'bg-blue-950/40 text-blue-300 border-blue-800/80'
                      : isSelected
                      ? 'bg-blue-600/20 text-blue-300 border-blue-500/40'
                      : 'bg-[#151b28] text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                  title={
                    posForSym
                      ? `Active trade locked on ${sym} (${posForSym.setup.direction} PnL: ${posForSym.unrealizedPnL >= 0 ? '+' : ''}$${posForSym.unrealizedPnL.toFixed(2)}) • Click to switch setup locked panel to ${sym}`
                      : isAssetOnCooldown
                      ? `${sym} on ${cooldownSec}s asset cooldown to prevent overtrading`
                      : `View ${sym}`
                  }
                >
                  <span>{sym === 'XAUUSD' ? 'GOLD' : sym.replace('USD', '')}</span>
                  {posForSym && (
                    <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/25 text-amber-300 font-bold flex items-center gap-0.5">
                      <Lock className="w-2.5 h-2.5 text-amber-400" />
                      <span>{posForSym.unrealizedPnL >= 0 ? '+' : ''}${posForSym.unrealizedPnL.toFixed(1)}</span>
                    </span>
                  )}
                  {isAssetOnCooldown && !posForSym && <span className="text-[9px] text-blue-400 font-normal">({cooldownSec}s)</span>}
                  {isCurrentScan && !isAssetOnCooldown && !posForSym && <span>⚡</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* 4-Pillar SMC Confirmation Checklist (Shown when waiting on an asset) */}
        {isEnabled && !limitReached && (!activePosition || !activePosition.setup.isLocked) && waitingDetails && (
          <div className="p-2 rounded-lg bg-[#0b0f17]/70 border border-slate-800/70 text-[10px] font-mono flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
              <span className="font-bold text-slate-300 uppercase">Institutional Quality Confirmation on {waitingDetails.symbol}:</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`px-2 py-0.5 rounded border flex items-center gap-1 ${
                  waitingDetails.hasLiquiditySweep
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                    : 'bg-slate-900 text-slate-500 border-slate-800'
                }`}
              >
                {waitingDetails.hasLiquiditySweep ? '✓' : '○'} Liquidity Swept (BSL/SSL)
              </span>

              <span
                className={`px-2 py-0.5 rounded border flex items-center gap-1 ${
                  waitingDetails.hasStructureShift
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                    : 'bg-slate-900 text-slate-500 border-slate-800'
                }`}
              >
                {waitingDetails.hasStructureShift ? '✓' : '○'} CHoCH / BOS Shift
              </span>

              <span
                className={`px-2 py-0.5 rounded border flex items-center gap-1 ${
                  waitingDetails.hasOBMitigation
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                    : 'bg-slate-900 text-slate-500 border-slate-800'
                }`}
              >
                {waitingDetails.hasOBMitigation ? '✓' : '○'} OB / FVG Reaction
              </span>

              <span className="px-2 py-0.5 rounded border bg-blue-500/15 text-blue-300 border-blue-500/30 flex items-center gap-1">
                ✓ Min RR 1:2.0+ (Score ≥ 82%)
              </span>
            </div>
          </div>
        )}

        {/* Cross-Asset Analysis & Best Setup Selection Matrix */}
        {showCrossAssetGrid && (
          <div className="p-2.5 rounded-lg bg-[#0b0f17]/90 border border-slate-800/80 space-y-2 text-xs font-mono">
            <div className="flex flex-wrap items-center justify-between gap-1 pb-1 border-b border-slate-800/80 text-[10px]">
              <div className="flex items-center gap-1.5 text-slate-300">
                <Target className="w-3.5 h-3.5 text-blue-400" />
                <span className="font-bold uppercase tracking-wider text-slate-200">
                  Cross-Asset Best Setup Comparison Matrix
                </span>
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 font-semibold border border-blue-500/30">
                  Selective Auto-Execution
                </span>
              </div>
              <span className="text-slate-400 text-[10px]">
                Auto-executes ONLY when #1 setup meets strict 4-pillar SMC confluence (Score &ge; 82%, R:R &ge; 2.0:1)
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">
              {(autoTraderState?.watchlist || ([
                'BTCUSD',
                'NAS100',
                'XAUUSD',
                'EURUSD',
                'GBPUSD',
                'USDJPY',
                'AUDUSD',
                'USDCAD',
                'USDCHF',
                'NZDUSD',
                'ETHUSD',
              ] as MarketSymbol[])).map((sym) => {
                const analysis = autoTraderState?.allAssetAnalyses?.[sym];
                const setup = autoTraderState?.allAssetSetups?.[sym] || analysis?.setup;
                const isBest = autoTraderState?.bestCandidateSymbol === sym;
                const isSelected = currentSymbol === sym;
                const marketHours = getMarketHoursStatus(sym);
                const isClosed = !marketHours.isOpen;

                const isForex =
                  sym === 'EURUSD' ||
                  sym === 'GBPUSD' ||
                  sym === 'AUDUSD' ||
                  sym === 'USDCAD' ||
                  sym === 'USDCHF' ||
                  sym === 'NZDUSD';
                const isJPY = sym === 'USDJPY';
                const decimals = isForex ? 4 : isJPY ? 3 : 2;

                const score = analysis?.confidenceScore || setup?.confidenceScore || 0;
                const direction = analysis?.direction || setup?.direction || 'LONG';
                const entry = setup?.entryPrice || 0;
                const sl = setup?.stopLoss || 0;
                const tp1 = setup?.takeProfit1 || 0;
                const rr = setup?.riskRewardRatio || 0;
                const isConfirmed = Boolean(analysis?.isConfirmed && !isClosed && score >= 75);
                const posForSym =
                  activePositions?.find((p) => p.setup.symbol === sym && p.setup.isLocked) ||
                  autoTraderState?.activePositions?.find((p) => p.setup.symbol === sym && p.setup.isLocked) ||
                  (activePosition?.setup.symbol === sym && activePosition.setup.isLocked ? activePosition : null);

                return (
                  <div
                    key={sym}
                    onClick={() => onSelectSymbol(sym)}
                    className={`p-2 rounded-lg border transition-all cursor-pointer flex flex-col justify-between ${
                      posForSym
                        ? isSelected
                          ? 'bg-[#1a1c28] border-amber-500/80 ring-1 ring-amber-400 shadow-lg'
                          : 'bg-[#151724] border-amber-500/40 hover:border-amber-400/80 shadow-md'
                        : isBest
                        ? 'bg-[#151c2e] border-blue-500/60 ring-1 ring-blue-500/40 shadow-md'
                        : isSelected
                        ? 'bg-[#121824] border-slate-700'
                        : isClosed
                        ? 'bg-[#0a0e16]/80 border-slate-900 opacity-80 hover:opacity-100'
                        : 'bg-[#0e131d] border-slate-800/80 hover:border-slate-700'
                    }`}
                    title={
                      posForSym
                        ? `Active trade locked on ${sym} (${posForSym.setup.direction} PnL: ${posForSym.unrealizedPnL >= 0 ? '+' : ''}$${posForSym.unrealizedPnL.toFixed(2)}) • Click to view locked trade panel`
                        : `View ${sym} SMC Setup`
                    }
                  >
                    <div>
                      {/* Top line: Symbol, Direction, Best / Locked badge */}
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-white text-[11px]">{sym}</span>
                          <span
                            className={`px-1 py-0.2 rounded text-[9px] font-bold ${
                              direction === 'LONG' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                            }`}
                          >
                            {direction}
                          </span>
                        </div>
                        {posForSym ? (
                          <span className="text-[8px] font-black px-1.5 py-0.2 rounded bg-amber-500/25 text-amber-300 border border-amber-500/50 flex items-center gap-1 animate-pulse">
                            <Lock className="w-2.5 h-2.5 text-amber-400" />
                            <span>LOCKED {posForSym.unrealizedPnL >= 0 ? '+' : ''}${posForSym.unrealizedPnL.toFixed(1)}</span>
                          </span>
                        ) : isBest ? (
                          <span className="text-[8px] font-extrabold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse">
                            ★ #1 BEST
                          </span>
                        ) : isClosed ? (
                          <span className="text-[8px] font-semibold px-1 py-0.2 rounded bg-rose-500/15 text-rose-300 border border-rose-500/30">
                            CLOSED
                          </span>
                        ) : sym === 'BTCUSD' || sym === 'ETHUSD' ? (
                          <span className="text-[8px] font-semibold px-1 py-0.2 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                            24/7
                          </span>
                        ) : null}
                      </div>

                      {/* Entry, SL, TP levels */}
                      <div className="space-y-0.5 text-[10px] my-1 bg-slate-900/60 p-1.5 rounded border border-slate-800">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">Entry:</span>
                          <strong className="text-blue-300 font-mono">{entry > 0 ? entry.toFixed(decimals) : '--'}</strong>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-rose-400">SL:</span>
                          <strong className="text-rose-300 font-mono">{sl > 0 ? sl.toFixed(decimals) : '--'}</strong>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-emerald-400">TP1:</span>
                          <strong className="text-emerald-300 font-mono">{tp1 > 0 ? tp1.toFixed(decimals) : '--'}</strong>
                        </div>
                      </div>
                    </div>

                    {/* Bottom: Score, R:R and status */}
                    <div className="pt-1 border-t border-slate-800/60 flex items-center justify-between text-[10px]">
                      <span className="text-amber-400 font-bold">1:{rr > 0 ? rr : '2.0'}</span>
                      <span
                        className={`px-1.5 py-0.2 rounded font-bold text-[9px] ${
                          isConfirmed
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : score >= 75
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {isConfirmed ? 'CONFIRMED' : `${score}% WAITING`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Expandable Activity Log */}
        {showLogs && (
          <div className="p-2.5 rounded-lg bg-[#0b0f17] border border-slate-800/80 space-y-1.5 text-xs font-mono max-h-44 overflow-y-auto">
            <div className="flex items-center justify-between pb-1 border-b border-slate-800 text-[10px] text-slate-400 uppercase">
              <span className="flex items-center gap-1">
                <Cpu className="w-3 h-3 text-purple-400" />
                <span>Autonomous Bot Activity &amp; Discipline Audit Log</span>
              </span>
              <span>{autoTraderState?.recentLogs?.length || 0} Events Recorded</span>
            </div>

            {(!autoTraderState?.recentLogs || autoTraderState.recentLogs.length === 0) ? (
              <div className="text-slate-500 text-[11px] text-center py-2">
                No events recorded yet. Turn on Auto-Trading to initiate automated scan cycles.
              </div>
            ) : (
              autoTraderState.recentLogs.map((log) => (
                <div key={log.id} className="flex items-start gap-2 text-[11px] text-slate-300 py-0.5">
                  <span className="text-slate-500 text-[10px] shrink-0">
                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                  <span
                    className={`px-1 py-0.2 rounded text-[9px] font-bold uppercase shrink-0 ${
                      log.action === 'AUTO_EXECUTE'
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                        : log.action === 'TP_HIT'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : log.action === 'SL_HIT'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        : log.action === 'LIMIT_REACHED'
                        ? 'bg-rose-600/30 text-rose-200 border border-rose-500/50'
                        : log.action === 'WAITING_CONFIRMATION'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : log.action === 'ENTRY_FOUND'
                        ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {log.action}
                  </span>
                  <span className="text-slate-200">{log.message}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};
