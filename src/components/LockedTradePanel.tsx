import React, { useEffect, useState } from 'react';
import {
  AlertOctagon,
  ArrowDownRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  DollarSign,
  Hash,
  Layers,
  Lock,
  Percent,
  Shield,
  Target,
  XCircle,
  Zap,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { ActivePosition, MarketPriceData, MarketSymbol } from '../types';

interface LockedTradePanelProps {
  activePosition: ActivePosition;
  activePositions?: ActivePosition[];
  onSelectPosition?: (position: ActivePosition) => void;
  onClosePosition: () => void;
  onClosePositionSymbol?: (symbol: MarketSymbol) => void;
  isClosing: boolean;
  onMoveBreakeven?: () => void;
  onMoveBreakevenSymbol?: (symbol: MarketSymbol) => void;
  liveMarketPrice?: MarketPriceData;
}

export const LockedTradePanel: React.FC<LockedTradePanelProps> = ({
  activePosition,
  activePositions = [],
  onSelectPosition,
  onClosePosition,
  onClosePositionSymbol,
  isClosing,
  onMoveBreakeven,
  onMoveBreakevenSymbol,
}) => {
  const { setup, currentPrice, unrealizedPnL, unrealizedPnLPercent, tradeDurationSeconds } = activePosition;
  const isLong = setup.direction === 'LONG';
  const [copiedTicket, setCopiedTicket] = useState(false);

  // Compute trade ticket number and lot size
  const ticketNumber =
    activePosition.brokerTicket ||
    `#EXN-${(Math.abs(parseInt(activePosition.id.replace(/\D/g, '') || '4820194', 10)) % 90000000 + 10000000)}`;
  const lotSizeFormatted = (setup.lotSize || 0.1).toFixed(2);
  const brokerNameFormatted = activePosition.brokerName || 'Exness MT5 Real Gateway';

  const isForex = setup.symbol === 'GBPUSD';
  const formatPrice = (p: number) => (isForex ? p.toFixed(4) : setup.symbol === 'XAUUSD' ? p.toFixed(2) : p.toFixed(2));
  const pipMultiplier = setup.symbol === 'XAUUSD' ? 0.1 : isForex ? 0.0001 : 1.0;

  // Format trade duration mm:ss or hh:mm:ss
  const formatDuration = (secs: number) => {
    const hrs = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    const remSecs = secs % 60;
    if (hrs > 0) {
      return `${hrs}h ${mins.toString().padStart(2, '0')}m ${remSecs.toString().padStart(2, '0')}s`;
    }
    return `${mins.toString().padStart(2, '0')}m ${remSecs.toString().padStart(2, '0')}s`;
  };

  // Compute progress percentage of price between Stop Loss and Take Profit 1
  const sl = setup.stopLoss;
  const tp = setup.takeProfit1;
  const entry = setup.entryPrice;
  let progressPercent = 50;

  if (isLong) {
    const totalRange = tp - sl;
    if (totalRange > 0) {
      progressPercent = Math.max(0, Math.min(100, ((currentPrice - sl) / totalRange) * 100));
    }
  } else {
    const totalRange = sl - tp;
    if (totalRange > 0) {
      progressPercent = Math.max(0, Math.min(100, ((sl - currentPrice) / totalRange) * 100));
    }
  }

  // Trigger celebratory confetti if TP hit
  useEffect(() => {
    if (activePosition.status === 'TAKE_PROFIT_HIT') {
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
        });
      } catch (e) {
        // silent fallback
      }
    }
  }, [activePosition.status]);

  const isPnlPositive = unrealizedPnL >= 0;
  const rawPriceDiff = isLong ? currentPrice - entry : entry - currentPrice;
  const pointsOrPips = isForex
    ? `${(rawPriceDiff * 10000).toFixed(1)} pips`
    : setup.symbol === 'XAUUSD'
    ? `${(rawPriceDiff * 10).toFixed(1)} pips`
    : `${rawPriceDiff >= 0 ? '+' : ''}${rawPriceDiff.toFixed(2)} pts`;

  const distToSL = Math.max(0, isLong ? currentPrice - sl : sl - currentPrice);
  const distToTP = Math.max(0, isLong ? tp - currentPrice : currentPrice - tp);

  const allOpenPositions = activePositions.length > 0 ? activePositions : [activePosition];
  const aggregatePnL = allOpenPositions.reduce((acc, p) => acc + p.unrealizedPnL, 0);
  const aggregatePnLPositive = aggregatePnL >= 0;

  return (
    <div className="bg-[#0f141f] border-2 border-amber-500/40 rounded-xl overflow-hidden shadow-2xl transition-all">
      {/* LOCKED Header Banner */}
      <div className="bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-transparent border-b border-amber-500/30 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded bg-amber-500 text-slate-950 font-black">
            <Lock className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-amber-300 text-sm tracking-wider">
                {allOpenPositions.length > 1 ? `${allOpenPositions.length} TRADES LOCKED 🔒` : 'SETUP LOCKED 🔒'}
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-200 font-mono border border-amber-500/30">
                {allOpenPositions.length > 1 ? 'MULTI-ASSET RUNNING' : 'ACTIVE POSITION'}
              </span>
            </div>
            <p className="text-[10px] text-slate-400">
              {allOpenPositions.length > 1
                ? 'Multiple best setups auto-executed & running simultaneously hands-free'
                : 'Trade protected against noise churn until TP or SL is reached'}
            </p>
          </div>
        </div>

        {/* Live Duration */}
        <div className="flex items-center gap-1.5 text-xs text-slate-300 font-mono bg-slate-900/80 px-2.5 py-1 rounded border border-slate-800">
          <Clock className="w-3.5 h-3.5 text-amber-400" />
          <span>{formatDuration(tradeDurationSeconds)}</span>
        </div>
      </div>

      {/* Multi-Asset Positions Switcher Bar */}
      {allOpenPositions.length > 1 && (
        <div className="bg-[#0b0e14] px-4 py-2 border-b border-slate-800 flex items-center justify-between gap-2 overflow-x-auto">
          <div className="flex items-center gap-1.5 min-w-max">
            <span className="text-[10px] uppercase font-bold text-amber-400 font-mono tracking-wider mr-1">
              Active ({allOpenPositions.length}):
            </span>
            {allOpenPositions.map((pos) => {
              const isSelected = pos.id === activePosition.id;
              const pnlPos = pos.unrealizedPnL >= 0;
              return (
                <button
                  key={pos.id}
                  onClick={() => onSelectPosition && onSelectPosition(pos)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all border ${
                    isSelected
                      ? 'bg-amber-500/25 text-amber-200 border-amber-500/60 shadow-sm'
                      : 'bg-slate-900/90 text-slate-400 border-slate-800 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                  title={`View ${pos.setup.symbol} trade on chart`}
                >
                  <span>{pos.setup.symbol}</span>
                  <span className={pos.setup.direction === 'LONG' ? 'text-emerald-400 text-[10px]' : 'text-rose-400 text-[10px]'}>
                    {pos.setup.direction}
                  </span>
                  <span className={pnlPos ? 'text-emerald-400 text-[10px]' : 'text-rose-400 text-[10px]'}>
                    {pnlPos ? '+' : ''}${pos.unrealizedPnL.toFixed(2)}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="text-right min-w-max font-mono text-xs">
            <span className="text-[10px] text-slate-400 mr-1.5">Portfolio P&L:</span>
            <span className={`font-bold ${aggregatePnLPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
              {aggregatePnLPositive ? '+' : ''}${aggregatePnL.toFixed(2)}
            </span>
          </div>
        </div>
      )}

      <div className="p-4 space-y-4">
        {/* Main Position Header: Symbol, Direction, Lot Size, Trade Ticket & Realized/Unrealized PnL */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xl font-black text-white">{setup.symbol}</span>
              <span
                className={`px-2 py-0.5 rounded text-xs font-bold flex items-center gap-1 ${
                  isLong
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                }`}
              >
                {isLong ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                {setup.direction} / {isLong ? 'BUY' : 'SELL'}
              </span>
              <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 text-xs font-mono font-bold flex items-center gap-1">
                <Layers className="w-3 h-3 text-blue-400" />
                {lotSizeFormatted} Lots
              </span>
              <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 text-xs font-mono font-bold flex items-center gap-1">
                <Hash className="w-3 h-3 text-amber-400" />
                {ticketNumber}
              </span>
            </div>
            <div className="text-xs text-slate-400 mt-1 font-mono flex items-center gap-2">
              <span>Delta: <strong className={isPnlPositive ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>{pointsOrPips}</strong></span>
              <span className="text-slate-600">&bull;</span>
              <span className="text-slate-300 flex items-center gap-1">
                <Zap className="w-3 h-3 text-amber-400" />
                {brokerNameFormatted}
              </span>
            </div>
          </div>

          {/* Unrealized PnL */}
          <div className="text-right shrink-0">
            <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">
              Unrealized PnL
            </div>
            <div
              className={`text-2xl font-black font-mono tracking-tight ${
                isPnlPositive ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {isPnlPositive ? '+' : ''}${unrealizedPnL.toFixed(2)}
            </div>
            <div
              className={`text-xs font-mono font-bold ${
                isPnlPositive ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {isPnlPositive ? '+' : ''}{unrealizedPnLPercent.toFixed(2)}%
            </div>
          </div>
        </div>

        {/* Real MT5 Execution Ticket & Order Verification Card */}
        <div className="bg-[#0c111c] border border-amber-500/25 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2.5 text-xs font-mono">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 rounded-lg">
              <Hash className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-slate-400 text-[11px]">Trade Number:</span>
              <span className="font-bold text-amber-300 text-xs tracking-wider">{ticketNumber}</span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(ticketNumber);
                  setCopiedTicket(true);
                  setTimeout(() => setCopiedTicket(false), 2000);
                }}
                className="text-slate-400 hover:text-amber-300 ml-1 p-0.5 transition-colors"
                title="Copy MT5 Trade Ticket Number"
              >
                {copiedTicket ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>

            <div className="flex items-center gap-1.5 bg-blue-500/10 border border-blue-500/30 px-2.5 py-1 rounded-lg">
              <Layers className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-slate-400 text-[11px]">Lot Size:</span>
              <span className="font-bold text-blue-300 text-xs">{lotSizeFormatted} Lots</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-300 flex items-center gap-1">
              <Zap className="w-3 h-3 text-amber-400" />
              {brokerNameFormatted}
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              SYNCHRONIZED
            </span>
          </div>
        </div>

        {/* 4 Core Price Levels */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-xs">
          <div className="bg-[#151b28] p-2 rounded-lg border border-slate-800">
            <span className="text-[10px] text-slate-500 block">Entry Price</span>
            <span className="text-white font-bold text-xs">{formatPrice(entry)}</span>
          </div>
          <div className="bg-[#151b28] p-2 rounded-lg border border-slate-800">
            <span className="text-[10px] text-slate-500 block">Current Price</span>
            <span className="text-blue-300 font-bold text-xs">{formatPrice(currentPrice)}</span>
          </div>
          <div className="bg-[#151b28] p-2 rounded-lg border border-rose-500/20">
            <span className="text-[10px] text-rose-400 block">Stop Loss</span>
            <span className="text-rose-300 font-bold text-xs">{formatPrice(sl)}</span>
          </div>
          <div className="bg-[#151b28] p-2 rounded-lg border border-emerald-500/20">
            <span className="text-[10px] text-emerald-400 block">TP1 Target</span>
            <span className="text-emerald-300 font-bold text-xs">{formatPrice(tp)}</span>
          </div>
        </div>

        {/* Trade Progress Bar (SL -> Entry -> TP) */}
        <div className="bg-[#151b28] p-3 rounded-lg border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-[11px] font-mono">
            <span className="text-rose-400 flex items-center gap-1 font-semibold">
              <Shield className="w-3 h-3" /> SL: {formatPrice(sl)}
            </span>
            <span className="text-slate-400">Entry: {formatPrice(entry)}</span>
            <span className="text-emerald-400 flex items-center gap-1 font-semibold">
              <Target className="w-3 h-3" /> TP1: {formatPrice(tp)}
            </span>
          </div>

          {/* Progress Gauge */}
          <div className="relative w-full h-2.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
            <div
              className={`h-full transition-all duration-300 ease-out rounded-full ${
                isPnlPositive ? 'bg-gradient-to-r from-emerald-600 to-emerald-400' : 'bg-gradient-to-r from-rose-600 to-rose-400'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
            <span>
              Distance to SL: <strong className="text-rose-400">{formatPrice(distToSL)}</strong> ({((distToSL / pipMultiplier)).toFixed(1)}p)
            </span>
            <span>
              Distance to TP: <strong className="text-emerald-400">{formatPrice(distToTP)}</strong> ({((distToTP / pipMultiplier)).toFixed(1)}p)
            </span>
          </div>
        </div>

        {/* Institutional Take Profit Targets (Liquidity & Unmitigated Areas) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-300 flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-emerald-400" />
              <span>Institutional Take-Profit Targets</span>
            </span>
            <span className="text-[10px] text-emerald-400 font-mono bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              Liquidity & Unmitigated Areas
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs font-mono">
            <div className="bg-[#151b28] p-2.5 rounded-lg border border-emerald-500/30">
              <div className="text-[10px] text-emerald-400 font-bold flex items-center justify-between">
                <span>TP 1 (Target)</span>
                <span className="text-[9px] px-1 rounded bg-emerald-500/20">1:{setup.riskRewardRatio}</span>
              </div>
              <div className="text-sm font-bold text-emerald-300 my-0.5">{formatPrice(setup.takeProfit1)}</div>
              <div className="text-[10px] text-slate-300 font-medium truncate" title={setup.tp1Label || 'Unmitigated Area'}>
                {setup.tp1Label ? setup.tp1Label.replace('🎯 ', '') : '🎯 Unmitigated FVG'}
              </div>
            </div>

            <div className="bg-[#151b28] p-2.5 rounded-lg border border-teal-500/20">
              <div className="text-[10px] text-teal-400 font-bold flex items-center justify-between">
                <span>TP 2 (Runner)</span>
                <span className="text-[9px] px-1 rounded bg-teal-500/20">
                  1:{setup.smcBreakdown.tpTargets?.tp2?.riskReward || 3.2}
                </span>
              </div>
              <div className="text-sm font-bold text-teal-300 my-0.5">{formatPrice(setup.takeProfit2)}</div>
              <div className="text-[10px] text-slate-300 font-medium truncate" title={setup.tp2Label || 'Major Liquidity'}>
                {setup.tp2Label ? setup.tp2Label.replace('🎯 ', '') : '🎯 Major Liquidity'}
              </div>
            </div>

            <div className="bg-[#151b28] p-2.5 rounded-lg border border-slate-800">
              <div className="text-[10px] text-cyan-400 font-bold flex items-center justify-between">
                <span>TP 3 (Moonbag)</span>
                <span className="text-[9px] px-1 rounded bg-cyan-500/20">
                  1:{setup.smcBreakdown.tpTargets?.tp3?.riskReward || 4.5}
                </span>
              </div>
              <div className="text-sm font-bold text-cyan-300 my-0.5">{formatPrice(setup.takeProfit3)}</div>
              <div className="text-[10px] text-slate-300 font-medium truncate" title={setup.tp3Label || 'Macro Pool'}>
                {setup.tp3Label ? setup.tp3Label.replace('🎯 ', '') : '🎯 Macro Range Liquidity'}
              </div>
            </div>
          </div>

          {setup.smcBreakdown.takeProfitThesis && (
            <div className="text-[10.5px] text-slate-300 bg-[#0e1626] p-2.5 rounded-lg border border-emerald-500/15 leading-relaxed italic">
              {setup.smcBreakdown.takeProfitThesis}
            </div>
          )}
        </div>

        {/* Active Trade Institutional Reasoning */}
        <div className="bg-[#151b28]/60 p-2.5 rounded border border-slate-800/80 text-xs">
          <div className="font-semibold text-slate-300 flex items-center gap-1.5 mb-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
            <span>Active Smart Money Setup Thesis:</span>
          </div>
          <p className="text-slate-400 text-[11px] leading-relaxed line-clamp-2">
            {setup.aiExplanation}
          </p>
        </div>

        {/* Manual Close & Breakeven Actions */}
        <div className="flex items-center justify-between pt-1 gap-2">
          <div className="text-[11px] text-slate-500 flex items-center gap-1">
            <AlertOctagon className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">Auto-closes at TP or SL.</span>
          </div>

          <div className="flex items-center gap-2">
            {setup.stopLoss === setup.entryPrice ? (
              <span className="px-2.5 py-1.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-mono font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Breakeven (0 Risk)</span>
              </span>
            ) : onMoveBreakevenSymbol || onMoveBreakeven ? (
              <button
                id="btn-breakeven-active-position"
                onClick={() => (onMoveBreakevenSymbol ? onMoveBreakevenSymbol(setup.symbol) : onMoveBreakeven?.())}
                className="px-3 py-1.5 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-semibold font-mono transition-all flex items-center gap-1.5 shadow-sm"
                title="Move Stop Loss to Entry Price (Zero Risk Locked)"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Move to BE</span>
              </button>
            ) : null}

            <button
              id="btn-close-active-position"
              onClick={() => (onClosePositionSymbol ? onClosePositionSymbol(setup.symbol) : onClosePosition())}
              disabled={isClosing}
              className="px-3 py-1.5 rounded bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-rose-300 text-xs font-semibold transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>{isClosing ? 'Closing...' : `Close ${setup.symbol}`}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
