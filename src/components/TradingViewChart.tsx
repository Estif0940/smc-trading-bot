import React, { useEffect, useRef, useState } from 'react';
import {
  ActivePosition,
  CandleData,
  MarketPriceData,
  MarketSymbol,
  SMCZone,
  Timeframe,
  TradeDirection,
  TradeSetup,
} from '../types';
import { Layers, ShieldAlert, Sparkles, Target, Zap, BarChart2, Monitor, Lock, XCircle, Clock } from 'lucide-react';
import { TradingViewDirectChart } from './TradingViewDirectChart';
import { NativeCandlestickChart } from './NativeCandlestickChart';
import { getLiveSessionOverview, MarketSessionOverview } from '../utils/sessionManager';
import { getMarketHoursStatus, isMarketOpen } from '../utils/marketHours';

interface TradingViewChartProps {
  symbol: MarketSymbol;
  timeframe: Timeframe;
  smcZones: SMCZone[];
  candles?: CandleData[];
  currentPriceData?: MarketPriceData;
  activePosition?: ActivePosition | null;
  activePositions?: ActivePosition[];
  currentSetup?: TradeSetup | null;
  onExecuteTrade?: (setupId: string) => void;
  onExecuteCustomTrade?: (params: {
    symbol: MarketSymbol;
    direction: TradeDirection;
    entryPrice: number;
    stopLoss: number;
    takeProfit1: number;
    takeProfit2?: number;
    takeProfit3?: number;
    riskRewardRatio: number;
  }) => void;
  onClosePosition?: () => void;
  onMoveBreakeven?: () => void;
  onSelectSymbol?: (symbol: MarketSymbol) => void;
  allAssetSetups?: Partial<Record<MarketSymbol, TradeSetup>>;
  onTimeframeChange?: (tf: Timeframe) => void;
}

const CHART_TIMEFRAMES: { id: Timeframe; label: string; full: string }[] = [
  { id: '1m', label: '1m', full: '1 Minute' },
  { id: '2m', label: '2m', full: '2 Minutes' },
  { id: '3m', label: '3m', full: '3 Minutes' },
  { id: '5m', label: '5m', full: '5 Minutes' },
  { id: '15m', label: '15m', full: '15 Minutes' },
  { id: '30m', label: '30m', full: '30 Minutes' },
  { id: '45m', label: '45m', full: '45 Minutes' },
  { id: '1h', label: '1h', full: '1 Hour' },
  { id: '2h', label: '2h', full: '2 Hours' },
  { id: '4h', label: '4h', full: '4 Hours' },
  { id: '1D', label: 'Daily', full: 'Daily' },
  { id: '1W', label: 'Weekly', full: 'Weekly' },
  { id: '1M', label: 'Monthly', full: 'Monthly' },
];

export const TradingViewChart: React.FC<TradingViewChartProps> = ({
  symbol,
  timeframe,
  smcZones,
  candles = [],
  currentPriceData,
  activePosition,
  activePositions = [],
  currentSetup,
  onClosePosition,
  onMoveBreakeven,
  onSelectSymbol,
  allAssetSetups,
  onTimeframeChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [chartMode, setChartMode] = useState<'TV_WIDGET' | 'TV_DIRECT' | 'NATIVE_CANDLES'>('TV_WIDGET');

  // Map timeframe to TradingView interval format
  const getTVInterval = (tf: Timeframe): string => {
    switch (tf) {
      case '1m':
        return '1';
      case '2m':
        return '2';
      case '3m':
        return '3';
      case '5m':
        return '5';
      case '15m':
        return '15';
      case '30m':
        return '30';
      case '45m':
        return '45';
      case '1h':
        return '60';
      case '2h':
        return '120';
      case '4h':
        return '240';
      case '1D':
        return 'D';
      case '1W':
        return 'W';
      case '1M':
        return 'M';
      default:
        return '15';
    }
  };

  // Map symbol to official live TradingView tickers from OANDA live stream
  const getTVSymbol = (sym: MarketSymbol): string => {
    switch (sym) {
      case 'NAS100':
        return 'OANDA:NAS100USD';
      case 'BTCUSD':
        return 'OANDA:BTCUSD';
      case 'XAUUSD':
        return 'OANDA:XAUUSD';
      case 'GBPUSD':
        return 'OANDA:GBPUSD';
      case 'USDJPY':
        return 'OANDA:USDJPY';
      default:
        return `OANDA:${sym}`;
    }
  };

  useEffect(() => {
    if (chartMode !== 'TV_WIDGET') return;

    let isDisposed = false;
    const containerId = `tv_chart_container_${Math.random().toString(36).substring(2, 9)}`;
    if (containerRef.current) {
      containerRef.current.innerHTML = `<div id="${containerId}" style="height: 100%; width: 100%; min-height: 480px;"></div>`;
    }

    const scriptId = 'tradingview-widget-script';
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;

    const initWidget = () => {
      if (isDisposed) return;
      if (!(window as any).TradingView) {
        setTimeout(initWidget, 100);
        return;
      }
      if (document.getElementById(containerId)) {
        new (window as any).TradingView.widget({
          autosize: true,
          symbol: getTVSymbol(symbol),
          interval: getTVInterval(timeframe),
          timezone: 'Etc/UTC',
          theme: 'dark',
          style: '1', // Candlestick
          locale: 'en',
          toolbar_bg: '#0f141f',
          enable_publishing: false,
          allow_symbol_change: false,
          container_id: containerId,
          hide_side_toolbar: false,
          studies: ['RSI@tv-basicstudies', 'MASimple@tv-basicstudies'],
          loading_screen: { backgroundColor: '#0b0e14', foregroundColor: '#3b82f6' },
          overrides: {
            'paneProperties.background': '#0b0e14',
            'paneProperties.vertGridProperties.color': '#172033',
            'paneProperties.horzGridProperties.color': '#172033',
            'symbolWatermarkProperties.transparency': 90,
            'scalesProperties.textColor': '#94a3b8',
            'mainSeriesProperties.candleStyle.upColor': '#10b981',
            'mainSeriesProperties.candleStyle.downColor': '#ef4444',
            'mainSeriesProperties.candleStyle.drawWick': true,
            'mainSeriesProperties.candleStyle.drawBorder': true,
            'mainSeriesProperties.candleStyle.borderColor': '#334155',
            'mainSeriesProperties.candleStyle.borderUpColor': '#10b981',
            'mainSeriesProperties.candleStyle.borderDownColor': '#ef4444',
            'mainSeriesProperties.candleStyle.wickUpColor': '#10b981',
            'mainSeriesProperties.candleStyle.wickDownColor': '#ef4444',
          },
        });
      }
    };

    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://s3.tradingview.com/tv.js';
      script.type = 'text/javascript';
      script.async = true;
      script.onload = initWidget;
      document.head.appendChild(script);
    } else {
      initWidget();
    }

    return () => {
      isDisposed = true;
    };
  }, [symbol, timeframe, chartMode]);

  // Extract key SMC highlights for chart HUD
  const orderBlocks = smcZones.filter((z) => z.type === 'BULLISH_OB' || z.type === 'BEARISH_OB');
  const fvgs = smcZones.filter((z) => z.type === 'BULLISH_FVG' || z.type === 'BEARISH_FVG');
  const structureBreaks = smcZones.filter((z) => z.type === 'BOS' || z.type === 'CHoCH');
  const liquidity = smcZones.filter((z) => z.type === 'LIQUIDITY_BSL' || z.type === 'LIQUIDITY_SSL' || z.type === 'EQUAL_HIGHS' || z.type === 'EQUAL_LOWS');

  // Check if there is an active trade on this symbol
  const currentSymbolPosition =
    activePositions?.find((p) => p.setup.symbol === symbol && p.setup.isLocked) ||
    (activePosition && activePosition.setup.symbol === symbol && activePosition.setup.isLocked ? activePosition : null);
  const hasActiveTrade = Boolean(currentSymbolPosition);
  const isForex = symbol === 'GBPUSD';
  const decimals = isForex ? 5 : symbol === 'BTCUSD' ? 2 : 2;
  const pipMultiplier = symbol === 'XAUUSD' ? 0.1 : isForex ? 0.0001 : 1.0;

  const [sessionOverview, setSessionOverview] = useState<MarketSessionOverview>(() => getLiveSessionOverview());
  useEffect(() => {
    const timer = setInterval(() => {
      setSessionOverview(getLiveSessionOverview());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex flex-col h-full bg-[#0b0e14] rounded-xl border border-slate-800 overflow-hidden shadow-2xl">
      {/* Chart Top Header & HUD */}
      <div className="flex flex-wrap items-center justify-between px-3 py-2 bg-[#0d121c] border-b border-slate-800 gap-2">
        <div className="flex items-center gap-2 overflow-x-auto py-0.5">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-xs font-mono text-blue-400">
            <Sparkles className="w-3.5 h-3.5" />
            <span className="font-semibold">AI SMC HUD:</span>
          </div>

          {/* Live Session Pill in Chart HUD */}
          <span
            className={`flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded border whitespace-nowrap ${
              sessionOverview.isLondonNyOverlap
                ? 'bg-amber-500/15 text-amber-300 border-amber-500/30 font-bold'
                : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
            }`}
            title={`Active Session: ${sessionOverview.primaryActiveName}`}
          >
            <Clock className="w-3 h-3 text-emerald-400" />
            <span>{sessionOverview.isLondonNyOverlap ? 'NY/LDN OVERLAP' : sessionOverview.primaryActiveName.split(' ')[0]}</span>
          </span>

          {orderBlocks.length > 0 && (
            <span className="flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 whitespace-nowrap">
              <Layers className="w-3 h-3 text-emerald-400" />
              {orderBlocks[0].label}
            </span>
          )}

          {fvgs.length > 0 && (
            <span className="flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 whitespace-nowrap">
              <Zap className="w-3 h-3 text-amber-400" />
              {fvgs[0].label}
            </span>
          )}

          {structureBreaks.length > 0 && (
            <span className="flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 whitespace-nowrap">
              <ShieldAlert className="w-3 h-3 text-rose-400" />
              {structureBreaks[0].label}
            </span>
          )}

          {liquidity.length > 0 && (
            <span
              className={`flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded border whitespace-nowrap ${
                liquidity[0].importance === 'HIGH'
                  ? 'bg-purple-950/60 text-purple-300 border-purple-500/40'
                  : 'bg-slate-800 text-slate-300 border-slate-700'
              }`}
            >
              <Target className="w-3 h-3" />
              {liquidity[0].label}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
          {/* Chart Engine Switcher: TradingView OANDA vs Interactive SMC vs Native Candlestick Pro */}
          <div className="flex items-center rounded-lg bg-[#0b0e14] p-0.5 border border-slate-800">
            <button
              id="chart-mode-tv-widget-btn"
              onClick={() => setChartMode('TV_WIDGET')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${
                chartMode === 'TV_WIDGET'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Official TradingView Chart extracted from OANDA live stream"
            >
              <Monitor className="w-3 h-3 text-blue-300" />
              <span>TradingView (OANDA)</span>
            </button>
            <button
              id="chart-mode-tv-direct-btn"
              onClick={() => setChartMode('TV_DIRECT')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${
                chartMode === 'TV_DIRECT'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Interactive TradingView Chart with direct Entry, SL, and TP lines"
            >
              <span>Interactive SMC</span>
            </button>
            <button
              id="chart-mode-pro-btn"
              onClick={() => setChartMode('NATIVE_CANDLES')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${
                chartMode === 'NATIVE_CANDLES'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Switch to Interactive SMC Candlestick Pro Chart"
            >
              <BarChart2 className="w-3 h-3" />
              <span>SMC Pro</span>
            </button>
          </div>

          <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20 font-semibold hidden sm:inline">
            {getTVSymbol(symbol)}
          </span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" title="Live OANDA Feed Connected" />

          {/* Quick jump to active position if on different symbol */}
          {activePositions && activePositions.length > 0 && onSelectSymbol && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {activePositions
                .filter((p) => p.setup.symbol !== symbol && p.setup.isLocked)
                .map((p) => (
                  <button
                    key={p.id}
                    onClick={() => onSelectSymbol(p.setup.symbol)}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-[10px] font-mono text-amber-300 animate-pulse transition-all ml-1 shadow-sm"
                    title={`Jump to active ${p.setup.symbol} locked trade (${p.setup.direction})`}
                  >
                    <Lock className="w-2.5 h-2.5 text-amber-400" />
                    <span>View {p.setup.symbol} ({p.unrealizedPnL >= 0 ? '+' : ''}${p.unrealizedPnL.toFixed(2)})</span>
                  </button>
                ))}
            </div>
          )}
          {(!activePositions || activePositions.length === 0) && activePosition && activePosition.setup.symbol !== symbol && onSelectSymbol && (
            <button
              onClick={() => onSelectSymbol(activePosition.setup.symbol)}
              className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-[10px] font-mono text-amber-300 animate-pulse transition-all ml-1"
              title={`Jump to active ${activePosition.setup.symbol} position`}
            >
              <Lock className="w-2.5 h-2.5 text-amber-400" />
              <span>View Active {activePosition.setup.symbol} ({activePosition.unrealizedPnL >= 0 ? '+' : ''}${activePosition.unrealizedPnL.toFixed(2)})</span>
            </button>
          )}
        </div>
      </div>

      {/* Real-time Multi-Timeframe Toolbar directly on the chart (1m, 2m, 3m, 5m, 15m, 30m, 45m, 1h, 2h, 4h, Daily, Weekly, Monthly) */}
      <div className="flex flex-wrap items-center justify-between px-3 py-1.5 bg-[#080c14] border-b border-slate-800/80 gap-2">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5 max-w-full">
          <span className="text-[10px] font-mono uppercase text-slate-400 font-bold flex items-center gap-1 mr-1 whitespace-nowrap">
            <Clock className="w-3 h-3 text-blue-400" />
            <span>TF:</span>
          </span>
          <div className="flex items-center gap-0.5 bg-[#121824] p-0.5 rounded-lg border border-slate-800 text-[11px] overflow-x-auto scrollbar-none">
            {CHART_TIMEFRAMES.map((tf) => (
              <button
                key={tf.id}
                id={`chart-tf-btn-${tf.id}`}
                onClick={() => onTimeframeChange && onTimeframeChange(tf.id)}
                title={`Switch chart to ${tf.full} (${tf.id})`}
                className={`px-1.5 py-0.5 rounded font-mono transition-colors whitespace-nowrap ${
                  timeframe === tf.id
                    ? 'bg-blue-600 text-white font-bold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-[10px] font-mono text-slate-400 whitespace-nowrap">
          <span className="text-slate-500">Setup Horizon:</span>
          <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20 font-bold">
            {timeframe === '1m' || timeframe === '2m' || timeframe === '3m' || timeframe === '5m'
              ? '⚡ SCALPING (1M-5M)'
              : timeframe === '15m' || timeframe === '30m' || timeframe === '45m'
              ? '🎯 INTRADAY SMC'
              : timeframe === '1h' || timeframe === '2h' || timeframe === '4h'
              ? '🌊 SWING SMC'
              : '🏛️ MACRO CYCLE'}
          </span>
          <span className="text-slate-600">|</span>
          <span className="text-slate-400">
            Candles: <strong className="text-slate-200">{candles.length}</strong>
          </span>
        </div>
      </div>

      {/* SLEEK POSITION STATUS BAR (Clean, compact dock header - NEVER covering chart canvas) */}
      {hasActiveTrade && currentSymbolPosition && (
        <div className="px-3 py-1.5 bg-[#0e1626] border-b border-blue-500/30 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-bold border border-blue-500/40">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>LIVE {currentSymbolPosition.setup.direction} ({currentSymbolPosition.setup.lotSize}L)</span>
            </div>

            <div className="flex items-center gap-2 text-slate-300">
              <span>E: <strong className="text-blue-400">{currentSymbolPosition.setup.entryPrice.toFixed(decimals)}</strong></span>
              <span className="text-slate-600">|</span>
              <span>SL: <strong className="text-rose-400">{currentSymbolPosition.setup.stopLoss.toFixed(decimals)}</strong> ({((Math.abs(currentSymbolPosition.setup.entryPrice - currentSymbolPosition.setup.stopLoss) / pipMultiplier)).toFixed(1)}p)</span>
              <span className="text-slate-600">|</span>
              <span>TP: <strong className="text-emerald-400">{currentSymbolPosition.setup.takeProfit1.toFixed(decimals)}</strong> (+{((Math.abs(currentSymbolPosition.setup.takeProfit1 - currentSymbolPosition.setup.entryPrice) / pipMultiplier)).toFixed(1)}p)</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 font-bold">
              <span className="text-slate-400">P&L:</span>
              <span className={`px-2 py-0.5 rounded ${currentSymbolPosition.unrealizedPnL >= 0 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'}`}>
                {currentSymbolPosition.unrealizedPnL >= 0 ? '+' : ''}${currentSymbolPosition.unrealizedPnL.toFixed(2)} ({currentSymbolPosition.unrealizedPnLPercent >= 0 ? '+' : ''}{currentSymbolPosition.unrealizedPnLPercent.toFixed(2)}%)
              </span>
            </div>

            {onMoveBreakeven && currentSymbolPosition.setup.stopLoss !== currentSymbolPosition.setup.entryPrice && (
              <button
                id="btn-breakeven-dock"
                onClick={onMoveBreakeven}
                className="flex items-center gap-1 px-2 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/50 text-[11px] font-semibold transition-colors"
                title="Lock in Breakeven (Move Stop Loss to Entry Price)"
              >
                <Lock className="w-3 h-3 text-amber-400" />
                <span>Lock BE</span>
              </button>
            )}

            {onClosePosition && (
              <button
                id="btn-close-position-dock"
                onClick={onClosePosition}
                className="flex items-center gap-1 px-2 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-semibold shadow transition-colors"
                title="Close Active Trade Immediately"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Close Trade</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Chart Mount Area */}
      <div className="relative w-full flex-1 min-h-[460px] overflow-hidden">
        {/* View Mode 1: TradingView Direct (Interactive Lightweight Charts with Native Price Lines) */}
        {chartMode === 'TV_DIRECT' && (
          <TradingViewDirectChart
            symbol={symbol}
            timeframe={timeframe}
            candles={candles}
            currentPriceData={currentPriceData}
            activePosition={currentSymbolPosition || activePosition}
            currentSetup={currentSetup}
            allAssetSetups={allAssetSetups}
            smcZones={smcZones}
          />
        )}

        {/* View Mode 2: Native SMC Candlestick Pro Canvas Chart */}
        {chartMode === 'NATIVE_CANDLES' && (
          <NativeCandlestickChart
            symbol={symbol}
            candles={candles}
            smcZones={smcZones}
            currentPriceData={currentPriceData}
            activePosition={currentSymbolPosition || activePosition}
            currentSetup={currentSetup}
            allAssetSetups={allAssetSetups}
          />
        )}

        {/* View Mode 3: TradingView External OANDA Widget Mount */}
        {chartMode === 'TV_WIDGET' && (
          <div ref={containerRef} className="w-full h-full min-h-[460px]" />
        )}
      </div>
    </div>
  );
};
