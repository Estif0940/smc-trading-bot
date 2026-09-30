import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  Lock,
  Play,
  RefreshCw,
  Sliders,
  TrendingDown,
  TrendingUp,
  Webhook,
  Zap,
} from 'lucide-react';
import {
  ActivePosition,
  BrokerHubState,
  ExecutionMode,
  MarketPriceData,
  MarketSymbol,
  OandaStatus,
  RiskSettings,
  Timeframe,
  TradeApprovalMode,
} from '../types';
import { getLiveSessionOverview, MarketSessionOverview } from '../utils/sessionManager';
import { getMarketHoursStatus, isMarketOpen } from '../utils/marketHours';

interface HeaderProps {
  currentSymbol: MarketSymbol;
  onSymbolChange: (symbol: MarketSymbol) => void;
  currentTimeframe: Timeframe;
  onTimeframeChange: (tf: Timeframe) => void;
  marketPrices: Record<MarketSymbol, MarketPriceData>;
  activePosition: ActivePosition | null;
  activePositions?: ActivePosition[];
  executionMode: ExecutionMode;
  onToggleExecutionMode: (mode: ExecutionMode) => void;
  tradeApprovalMode: TradeApprovalMode;
  onToggleApprovalMode: () => void;
  riskSettings: RiskSettings;
  onOpenRiskModal: () => void;
  onOpenWebhookModal: () => void;
  isAnalyzing: boolean;
  onTriggerAnalysis: () => void;
  oandaStatus: OandaStatus | null;
  onOpenOandaModal: () => void;
  brokerState?: BrokerHubState | null;
  onOpenBrokerHubModal: () => void;
}

const SYMBOLS: { id: MarketSymbol; name: string; type: string; isCrypto247?: boolean }[] = [
  { id: 'BTCUSD', name: 'Bitcoin / USD', type: 'Crypto', isCrypto247: true },
  { id: 'XAUUSD', name: 'Gold / USD', type: 'Commodity' },
  { id: 'GBPUSD', name: 'British Pound / USD', type: 'Forex' },
  { id: 'NAS100', name: 'Nasdaq 100 / USD', type: 'Index' },
  { id: 'USDJPY', name: 'USD / Japanese Yen', type: 'Forex' },
];

const TIMEFRAMES: { id: Timeframe; label: string; title: string }[] = [
  { id: '1m', label: '1m', title: '1 Minute Scalping Timeframe' },
  { id: '2m', label: '2m', title: '2 Minutes Timeframe' },
  { id: '3m', label: '3m', title: '3 Minutes Timeframe' },
  { id: '5m', label: '5m', title: '5 Minutes Timeframe' },
  { id: '15m', label: '15m', title: '15 Minutes Intraday Timeframe' },
  { id: '30m', label: '30m', title: '30 Minutes Timeframe' },
  { id: '45m', label: '45m', title: '45 Minutes Timeframe' },
  { id: '1h', label: '1h', title: '1 Hour Swing Timeframe' },
  { id: '2h', label: '2h', title: '2 Hours Timeframe' },
  { id: '4h', label: '4h', title: '4 Hours Macro Timeframe' },
  { id: '1D', label: 'Daily', title: 'Daily (1D) Macro Structure' },
  { id: '1W', label: 'Weekly', title: 'Weekly (1W) Trend Structure' },
  { id: '1M', label: 'Monthly', title: 'Monthly (1M) Major Market Cycle' },
];

export const Header: React.FC<HeaderProps> = ({
  currentSymbol,
  onSymbolChange,
  currentTimeframe,
  onTimeframeChange,
  marketPrices,
  activePosition,
  activePositions = [],
  executionMode,
  onToggleExecutionMode,
  tradeApprovalMode,
  onToggleApprovalMode,
  riskSettings,
  onOpenRiskModal,
  onOpenWebhookModal,
  isAnalyzing,
  onTriggerAnalysis,
  oandaStatus,
  onOpenOandaModal,
  brokerState,
  onOpenBrokerHubModal,
}) => {
  const currentPriceData = marketPrices[currentSymbol];
  const price = currentPriceData?.price ?? 0;
  const changePercent = currentPriceData?.change24hPercent ?? 0;
  const isUp = changePercent >= 0;

  const isLocked = Boolean(activePosition && activePosition.setup.isLocked);

  // High-Speed MT5 Tick Tracking & Visual Flash
  const prevPriceRef = useRef<number>(price);
  const [tickDirection, setTickDirection] = useState<'UP' | 'DOWN' | 'NONE'>('NONE');
  const [tickFlash, setTickFlash] = useState<boolean>(false);

  useEffect(() => {
    if (prevPriceRef.current !== price) {
      const dir = price > prevPriceRef.current ? 'UP' : 'DOWN';
      setTickDirection(dir);
      setTickFlash(true);
      const timer = setTimeout(() => {
        setTickFlash(false);
      }, 200);
      prevPriceRef.current = price;
      return () => clearTimeout(timer);
    }
  }, [price]);

  // Real-time live trading session tracker
  const [sessionOverview, setSessionOverview] = useState<MarketSessionOverview>(() => getLiveSessionOverview());
  useEffect(() => {
    const timer = setInterval(() => {
      setSessionOverview(getLiveSessionOverview());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="bg-[#0f141f] border-b border-[#1e293b] px-4 py-2.5 select-none">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Left: Brand + Symbol selector */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center font-black text-white text-sm shadow-md">
              SMC
            </div>
            <div>
              <div className="flex items-center gap-1.5 font-bold text-sm text-slate-100 tracking-wide">
                <span>ALPHA TRADER</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 font-mono border border-blue-500/30">
                  AI v3.8
                </span>
              </div>
              <p className="text-[10px] text-slate-400 leading-none">
                Smart Money Concepts &bull; Live Execution
              </p>
            </div>
          </div>

          <div className="h-6 w-px bg-slate-800 mx-1 hidden sm:block" />

          {/* Symbol Selector Chips */}
          <div className="flex items-center gap-1 bg-[#151b28] p-1 rounded-lg border border-slate-800 overflow-x-auto max-w-full">
            {SYMBOLS.map((s) => {
              const symPrice = marketPrices[s.id]?.price;
              const isSelected = s.id === currentSymbol;
              const symMarketHours = getMarketHoursStatus(s.id);
              const isClosed = !symMarketHours.isOpen;
              const posForSymbol =
                activePositions?.find((p) => p.setup.symbol === s.id && p.setup.isLocked) ||
                (activePosition?.setup.symbol === s.id && activePosition.setup.isLocked ? activePosition : null);

              return (
                <button
                  key={s.id}
                  id={`btn-symbol-${s.id}`}
                  onClick={() => onSymbolChange(s.id)}
                  title={`${s.name} • ${symMarketHours.tradingHoursDescription}${isClosed ? ' (Currently Weekend Closed)' : ''}${
                    posForSymbol
                      ? ` • [ACTIVE TRADE: ${posForSymbol.setup.direction} PnL: ${posForSymbol.unrealizedPnL >= 0 ? '+' : ''}$${posForSymbol.unrealizedPnL.toFixed(2)} - Click to view locked setup]`
                      : ''
                  }`}
                  className={`px-2 py-1 text-xs font-semibold rounded transition-all flex items-center gap-1.5 whitespace-nowrap ${
                    isSelected
                      ? posForSymbol
                        ? 'bg-amber-600 text-white shadow-sm ring-1 ring-amber-400 font-bold'
                        : 'bg-blue-600 text-white shadow-sm'
                      : posForSymbol
                      ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 hover:bg-amber-500/25 font-bold shadow-sm'
                      : isClosed
                      ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 opacity-75'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <span>{s.id}</span>
                  {posForSymbol && (
                    <span className="text-[9px] px-1 py-0.2 rounded bg-amber-950/80 text-amber-300 font-mono font-bold border border-amber-500/60 flex items-center gap-0.5 animate-pulse">
                      <Lock className="w-2.5 h-2.5 text-amber-400" />
                      <span>{posForSymbol.unrealizedPnL >= 0 ? '+' : ''}${posForSymbol.unrealizedPnL.toFixed(1)}</span>
                    </span>
                  )}
                  {s.isCrypto247 && !posForSymbol && (
                    <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-mono border border-emerald-500/30">
                      24/7
                    </span>
                  )}
                  {isClosed && !posForSymbol && (
                    <span className="text-[9px] px-1 py-0.2 rounded bg-rose-500/20 text-rose-300 font-mono border border-rose-500/30">
                      M-F
                    </span>
                  )}
                  {symPrice !== undefined && (
                    <span
                      className={`text-[10px] font-mono opacity-80 ${
                        isSelected ? 'text-white font-medium' : posForSymbol ? 'text-amber-200 font-medium' : 'text-slate-500'
                      }`}
                    >
                      {s.id === 'GBPUSD'
                        ? symPrice.toFixed(4)
                        : s.id === 'USDJPY'
                        ? symPrice.toFixed(2)
                        : s.id === 'XAUUSD' || s.id === 'NAS100'
                        ? symPrice.toFixed(1)
                        : symPrice.toFixed(0)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Timeframe selector */}
          <div className="hidden lg:flex items-center gap-0.5 bg-[#151b28] p-1 rounded-lg border border-slate-800 text-[11px] max-w-[440px] overflow-x-auto scrollbar-none">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf.id}
                id={`btn-tf-${tf.id}`}
                onClick={() => onTimeframeChange(tf.id)}
                title={tf.title}
                className={`px-1.5 py-0.5 rounded font-mono transition-colors whitespace-nowrap ${
                  currentTimeframe === tf.id
                    ? 'bg-blue-600 text-white font-bold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>

        {/* Center: Real Live Price display + Market Open/Closed Status */}
        <div className="flex items-center gap-3 bg-[#151b28] px-3.5 py-1.5 rounded-lg border border-slate-800/80">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            {getMarketHoursStatus(currentSymbol).isOpen ? (
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-rose-500" />
            )}
            <span className="font-semibold">{currentSymbol}</span>
            <span
              className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold border ${
                getMarketHoursStatus(currentSymbol).isOpen
                  ? currentSymbol === 'BTCUSD'
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                    : 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                  : 'bg-rose-500/15 text-rose-300 border-rose-500/30 animate-pulse'
              }`}
            >
              {getMarketHoursStatus(currentSymbol).statusLabel}
            </span>
          </div>
          <div className="flex items-baseline gap-2 font-mono">
            <span
              id="header-live-price"
              className={`text-base font-bold tracking-tight transition-colors duration-150 flex items-center gap-1 ${
                tickFlash
                  ? tickDirection === 'UP'
                    ? 'text-emerald-300 drop-shadow-[0_0_8px_rgba(16,185,129,0.7)]'
                    : 'text-rose-300 drop-shadow-[0_0_8px_rgba(244,63,94,0.7)]'
                  : 'text-white'
              }`}
            >
              <span>
                {currentSymbol === 'GBPUSD'
                  ? price.toFixed(4)
                  : currentSymbol === 'USDJPY'
                  ? price.toFixed(3)
                  : currentSymbol === 'XAUUSD' || currentSymbol === 'NAS100'
                  ? price.toFixed(2)
                  : price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              {getMarketHoursStatus(currentSymbol).isOpen && (
                <>
                  {tickDirection === 'UP' && <span className="text-[10px] text-emerald-400 font-bold">▲</span>}
                  {tickDirection === 'DOWN' && <span className="text-[10px] text-rose-400 font-bold">▼</span>}
                </>
              )}
            </span>
            <span
              className={`text-xs flex items-center font-semibold ${
                isUp ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {isUp ? <TrendingUp className="w-3 h-3 mr-0.5" /> : <TrendingDown className="w-3 h-3 mr-0.5" />}
              {isUp ? '+' : ''}
              {changePercent.toFixed(2)}%
            </span>
          </div>
        </div>

        {/* Real-time Session Pill in Header */}
        <div
          id="header-session-pill"
          className="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#151b28] border border-slate-800 text-xs font-mono shadow-sm"
          title={`Active Market Session: ${sessionOverview.primaryActiveName}. Current UTC: ${sessionOverview.currentUtcTimeStr}`}
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="text-slate-400 font-medium">SESSION:</span>
          <span
            className={`font-black tracking-tight ${
              sessionOverview.isLondonNyOverlap
                ? 'text-amber-300'
                : 'text-emerald-300'
            }`}
          >
            {sessionOverview.isLondonNyOverlap
              ? 'LONDON/NY OVERLAP 🔥'
              : sessionOverview.primaryActiveName.split(' ')[0] + ' ' + (sessionOverview.primaryActiveName.split(' ')[1] || '')}
          </span>
          <span className="text-[10px] text-blue-300 bg-blue-500/15 px-1.5 py-0.5 rounded font-bold border border-blue-500/25">
            {sessionOverview.currentUtcTimeStr.replace(' UTC', '')}
          </span>
        </div>

        {/* Real Broker Gateway (Exness MT5, MetaMask, OANDA, cTrader, Prop Firms) */}
        {(() => {
          const isExnessConnected = Boolean(brokerState?.exness?.isConnected);
          const isMetaMaskConnected = Boolean(brokerState?.metaMask?.isConnected);
          const isAnyConnected = isExnessConnected || isMetaMaskConnected || Boolean(brokerState?.oanda?.isConnected);
          const isCurrentActiveConnected =
            (brokerState?.activeBroker === 'EXNESS' && isExnessConnected) ||
            (brokerState?.activeBroker === 'METAMASK' && isMetaMaskConnected) ||
            (brokerState?.activeBroker === 'OANDA' && Boolean(brokerState?.oanda?.isConnected));

          return (
            <button
              id="btn-broker-hub"
              onClick={onOpenBrokerHubModal}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all shadow-sm ${
                isCurrentActiveConnected
                  ? brokerState?.settings?.autoTradeRealBrokers
                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 hover:bg-amber-500/25'
                    : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25'
                  : 'bg-[#151b28] border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white'
              }`}
              title="Open Broker Gateway: Exness MT5, MetaMask Web3, OANDA, cTrader"
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isCurrentActiveConnected
                    ? 'bg-emerald-400 animate-pulse'
                    : isAnyConnected
                    ? 'bg-amber-400'
                    : 'bg-slate-500'
                }`}
              />
              <span className="font-bold text-slate-100 flex items-center gap-1">
                {brokerState?.activeBroker === 'METAMASK' && isMetaMaskConnected
                  ? '🦊 MetaMask'
                  : brokerState?.activeBroker === 'EXNESS' && isExnessConnected
                  ? '⚡ Exness MT5'
                  : brokerState?.activeBroker === 'OANDA'
                  ? '⚡ OANDA v20'
                  : brokerState?.activeBroker === 'CTRADER'
                  ? '⚡ cTrader'
                  : isMetaMaskConnected
                  ? '🦊 MetaMask'
                  : '⚡ Broker Hub'}
              </span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded font-mono border ${
                  isCurrentActiveConnected
                    ? brokerState?.settings?.autoTradeRealBrokers
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    : 'bg-slate-800 text-slate-400 border-slate-700/80'
                }`}
              >
                {brokerState?.activeBroker === 'METAMASK' && isMetaMaskConnected
                  ? `${brokerState.metaMask?.balanceEth.toFixed(2)} ETH`
                  : isExnessConnected
                  ? (brokerState?.settings?.autoTradeRealBrokers ? 'Auto-Trade ⚡' : 'Connected')
                  : isMetaMaskConnected
                  ? 'Web3 Ready'
                  : 'Configure'}
              </span>
            </button>
          );
        })()}

        {/* OANDA Broker Status Badge */}
        <button
          id="btn-oanda-status"
          onClick={onOpenOandaModal}
          className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
            oandaStatus?.hasApiKey
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20'
              : 'bg-[#151b28] border-slate-800 text-slate-300 hover:border-blue-500/40 hover:text-white'
          }`}
          title="Click to view OANDA Broker Connection & Live Spread Details"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-bold text-slate-100">OANDA</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
            {oandaStatus?.hasApiKey ? `v20 (${oandaStatus.environment})` : 'TradingView Feed'}
          </span>
        </button>

        {/* Right: Mode Toggles & Execution Status */}
        <div className="flex items-center gap-2">
          {/* Locked Trade State Pill */}
          {isLocked ? (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs font-bold shadow-sm animate-pulse">
              <Lock className="w-3.5 h-3.5" />
              <span>SETUP LOCKED 🔒</span>
            </div>
          ) : (
            <button
              id="btn-scan-ai"
              onClick={onTriggerAnalysis}
              disabled={isAnalyzing}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 text-xs font-semibold transition-all disabled:opacity-50"
              title="Run Institutional SMC Market Scan"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin' : ''}`} />
              <span>{isAnalyzing ? 'Scanning SMC...' : 'AI SMC Scan'}</span>
            </button>
          )}

          {/* Execution Mode (Paper vs Live) */}
          <div className="flex items-center bg-[#151b28] p-0.5 rounded-lg border border-slate-800 text-xs">
            <button
              id="btn-mode-paper"
              onClick={() => onToggleExecutionMode('PAPER')}
              className={`px-2 py-1 rounded font-semibold transition-colors ${
                executionMode === 'PAPER'
                  ? 'bg-emerald-600/90 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Paper
            </button>
            <button
              id="btn-mode-live"
              onClick={() => onToggleExecutionMode('LIVE')}
              className={`px-2 py-1 rounded font-semibold transition-colors ${
                executionMode === 'LIVE'
                  ? 'bg-rose-600/90 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Live
            </button>
          </div>

          {/* Trade Approval Mode (Manual vs Auto) */}
          <button
            id="btn-toggle-approval"
            onClick={onToggleApprovalMode}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold border transition-all ${
              tradeApprovalMode === 'AUTO'
                ? 'bg-purple-600/20 border-purple-500/50 text-purple-300 hover:bg-purple-600/30'
                : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800'
            }`}
          >
            {tradeApprovalMode === 'AUTO' ? (
              <>
                <Zap className="w-3.5 h-3.5 text-purple-400" />
                <span>Auto-Trading</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" />
                <span>Manual Approval</span>
              </>
            )}
          </button>

          {/* Risk Management Button */}
          <button
            id="btn-risk-settings"
            onClick={onOpenRiskModal}
            className="p-1.5 rounded bg-[#151b28] hover:bg-slate-800 border border-slate-800 text-slate-300 transition-colors"
            title="Risk Management & Sizing Settings"
          >
            <Sliders className="w-4 h-4" />
          </button>

          {/* Webhook Button */}
          <button
            id="btn-webhook-settings"
            onClick={onOpenWebhookModal}
            className="p-1.5 rounded bg-[#151b28] hover:bg-slate-800 border border-slate-800 text-slate-300 transition-colors"
            title="TradingView Webhook & Pine Script"
          >
            <Webhook className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
