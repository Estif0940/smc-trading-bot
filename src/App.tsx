import React, { useEffect, useState, useRef } from 'react';
import {
  ActivePosition,
  CandleData,
  ExecutionMode,
  MarketPriceData,
  MarketSymbol,
  RiskSettings,
  SMCZone,
  Timeframe,
  TradeApprovalMode,
  TradeDirection,
  TradeSetup,
  TradingStats,
  WebhookLog,
  OandaStatus,
  BrokerHubState,
  ExnessConfig,
  AutoTraderState,
} from './types';
import { Header } from './components/Header';
import { TradingViewChart } from './components/TradingViewChart';
import { LockedTradePanel } from './components/LockedTradePanel';
import { AISetupCard } from './components/AISetupCard';
import { SMCMatrix } from './components/SMCMatrix';
import { TradeHistoryTable } from './components/TradeHistoryTable';
import { CumulativePnLChart } from './components/CumulativePnLChart';
import { RiskManagementModal } from './components/RiskManagementModal';
import { TradingViewWebhookModal } from './components/TradingViewWebhookModal';
import { AutoTradeModal } from './components/AutoTradeModal';
import { OandaBrokerModal } from './components/OandaBrokerModal';
import { BrokerHubModal } from './components/BrokerHubModal';
import { LiveSessionBar } from './components/LiveSessionBar';
import { AutoTraderBar } from './components/AutoTraderBar';
import { DesktopNotificationToast } from './components/DesktopNotificationToast';
import {
  NotificationEvent,
  playAudioAlert,
  sendDesktopNotification,
  requestNotificationPermission,
} from './utils/notificationService';
import {
  Award,
  Layers,
  Lock,
  Shield,
  Sliders,
  Terminal,
  Webhook,
} from 'lucide-react';
import { getMarketHoursStatus, isMarketOpen, isGlobalWeekend } from './utils/marketHours';

export default function App() {
  const [currentSymbol, setCurrentSymbol] = useState<MarketSymbol>(() => (isGlobalWeekend() ? 'BTCUSD' : 'XAUUSD'));
  const [currentTimeframe, setCurrentTimeframe] = useState<Timeframe>('15m');

  const [marketPrices, setMarketPrices] = useState<Record<MarketSymbol, MarketPriceData>>({
    BTCUSD: { symbol: 'BTCUSD', price: 89450.00, bid: 89445.00, ask: 89455.00, high24h: 91200.00, low24h: 88100.00, change24h: 1350.00, change24hPercent: 1.53, timestamp: Date.now(), source: 'OANDA / TradingView Live Stream' },
    XAUUSD: { symbol: 'XAUUSD', price: 3512.45, bid: 3512.20, ask: 3512.70, high24h: 3528.80, low24h: 3494.10, change24h: 18.35, change24hPercent: 0.52, timestamp: Date.now(), source: 'OANDA / Live Gold Spot' },
    GBPUSD: { symbol: 'GBPUSD', price: 1.2685, bid: 1.2684, ask: 1.2686, high24h: 1.2740, low24h: 1.2635, change24h: 0.0050, change24hPercent: 0.39, timestamp: Date.now(), source: 'Interbank Forex Live' },
    NAS100: { symbol: 'NAS100', price: 20340.50, bid: 20339.50, ask: 20341.50, high24h: 20490.00, low24h: 20210.00, change24h: 115.50, change24hPercent: 0.57, timestamp: Date.now(), source: 'NASDAQ 100 Live / OANDA' },
    USDJPY: { symbol: 'USDJPY', price: 153.85, bid: 153.84, ask: 153.86, high24h: 154.50, low24h: 153.20, change24h: 0.45, change24hPercent: 0.29, timestamp: Date.now(), source: 'Interbank Forex Live' },
  });

  const [candles, setCandles] = useState<CandleData[]>([]);
  const [smcZones, setSmcZones] = useState<SMCZone[]>([]);
  const [activePosition, setActivePosition] = useState<ActivePosition | null>(null);
  const [activePositions, setActivePositions] = useState<ActivePosition[]>([]);
  const [currentSetup, setCurrentSetup] = useState<TradeSetup | null>(null);
  const [allAssetSetups, setAllAssetSetups] = useState<Partial<Record<MarketSymbol, TradeSetup>>>({});

  const [executionMode, setExecutionMode] = useState<ExecutionMode>('PAPER');
  const [tradeApprovalMode, setTradeApprovalMode] = useState<TradeApprovalMode>('AUTO');

  const [riskSettings, setRiskSettings] = useState<RiskSettings>({
    accountBalance: 50000.0,
    maxRiskPerTradePercent: 1.0,
    maxDailyLossPercent: 3.0,
    dailyRealizedPnL: 0.0,
    leverage: 100,
    maxOpenTrades: 1,
  });

  const [stats, setStats] = useState<TradingStats>({
    totalTrades: 2,
    winningTrades: 2,
    losingTrades: 0,
    winRate: 100.0,
    totalProfitLoss: 2240.0,
    avgRiskReward: 2.55,
    profitFactor: 99.9,
  });

  const [tradeHistory, setTradeHistory] = useState<TradeSetup[]>([]);
  const [webhookLogs, setWebhookLogs] = useState<WebhookLog[]>([]);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [autoTraderState, setAutoTraderState] = useState<AutoTraderState | null>(null);
  const [isScanningNow, setIsScanningNow] = useState(false);
  const [notifications, setNotifications] = useState<NotificationEvent[]>([]);

  const prevLimitReachedRef = useRef(false);
  const prevTotalTradesRef = useRef(0);
  const prevHistoryLengthRef = useRef(0);

  const handleDismissNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const handleClearAllNotifications = () => {
    setNotifications([]);
  };

  // Modals
  const [riskModalOpen, setRiskModalOpen] = useState(false);
  const [webhookModalOpen, setWebhookModalOpen] = useState(false);
  const [autoTradeWarningOpen, setAutoTradeWarningOpen] = useState(false);
  const [oandaModalOpen, setOandaModalOpen] = useState(false);
  const [oandaStatus, setOandaStatus] = useState<OandaStatus | null>(null);
  const [brokerHubModalOpen, setBrokerHubModalOpen] = useState(false);
  const [brokerHubState, setBrokerHubState] = useState<BrokerHubState>({
    activeBroker: 'EXNESS',
    settings: {
      autoTradeRealBrokers: false,
      activeBroker: 'EXNESS',
      maxLotSize: 2.0,
      maxSlippagePips: 2.0,
      autoMoveBreakevenAtRR: 1.5,
    },
    exness: {
      accountNumber: '14829104',
      server: 'Exness-MT5Real',
      serverLocation: 'London LD4 Equinix',
      accountType: 'standard',
      symbolSuffix: 'm',
      tokenOrPassword: '',
      isConnected: true,
      lastPingMs: 24,
      balance: 10450.0,
      equity: 10450.0,
      freeMargin: 10450.0,
      leverage: 200,
    },
    oanda: {
      environment: 'practice',
      accountId: '101-001-283910-001',
      isConnected: true,
      balance: 50000.0,
    },
    ctrader: {
      brokerName: 'IC Markets (cTrader)',
      accountId: '5029104',
      isConnected: false,
      balance: 25000.0,
    },
    propFirm: {
      firmName: 'FTMO Evaluation Account',
      server: 'FTMO-Server2',
      accountType: 'FTMO $100k Challenge',
      balance: 100000.0,
      maxDailyLossPercent: 5.0,
      maxTotalLossPercent: 10.0,
      currentDailyDrawdown: 0.2,
      currentTotalDrawdown: 0.4,
      profitTargetPercent: 10.0,
      isConnected: true,
    },
    metaMask: {
      isConnected: false,
      address: '',
      chainId: '0x1',
      networkName: 'Ethereum Mainnet',
      balanceEth: 0,
      balanceUsd: 0,
      isSimulated: false,
      lastConnected: 0,
    },
    auditLogs: [],
  });

  // Bottom Tabs
  const [activeTab, setActiveTab] = useState<'matrix' | 'history' | 'webhook'>('matrix');

  const fetchOandaStatus = async () => {
    try {
      const res = await fetch('/api/oanda/status');
      if (res.ok) {
        const data = await res.json();
        setOandaStatus(data);
      }
    } catch (e) {
      console.warn('Failed to fetch OANDA status:', e);
    }
  };

  const fetchBrokerHubState = async () => {
    try {
      const res = await fetch('/api/broker/hub');
      if (res.ok) {
        const data = await res.json();
        setBrokerHubState(data);
      }
    } catch (e) {
      console.warn('Failed to fetch broker hub state:', e);
    }
  };

  const handleUpdateBrokerSettings = async (settings: any) => {
    try {
      const res = await fetch('/api/broker/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        const data = await res.json();
        setBrokerHubState((prev) => ({
          ...prev,
          settings: data.settings,
          activeBroker: data.settings.activeBroker,
        }));
      }
    } catch (e) {
      console.error('Failed to update broker settings:', e);
    }
  };

  const handleConnectExness = async (config: Partial<ExnessConfig>) => {
    try {
      const res = await fetch('/api/broker/exness/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      fetchBrokerHubState();
      return data;
    } catch (e) {
      console.error('Failed to connect Exness:', e);
      throw e;
    }
  };

  const handleUpdateOtherBroker = async (type: 'OANDA' | 'CTRADER' | 'PROP_FIRM' | 'METAMASK', config: any) => {
    try {
      const res = await fetch('/api/broker/other/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, config }),
      });
      const data = await res.json();
      fetchBrokerHubState();
      return data;
    } catch (e) {
      console.error('Failed to update other broker:', e);
      throw e;
    }
  };

  const handleConnectMetaMask = async (config: any) => {
    try {
      const res = await fetch('/api/broker/metamask/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      fetchBrokerHubState();
      return data;
    } catch (e) {
      console.warn('MetaMask server sync note:', e);
      return { success: false, error: 'Could not sync MetaMask state with server' };
    }
  };

  const handleDisconnectMetaMask = async () => {
    try {
      const res = await fetch('/api/broker/metamask/disconnect', { method: 'POST' });
      const data = await res.json();
      fetchBrokerHubState();
      return data;
    } catch (e) {
      console.warn('MetaMask disconnect note:', e);
      return { success: false };
    }
  };

  // Fetch initial data
  useEffect(() => {
    fetchSystemState();
    fetchOandaStatus();
    fetchBrokerHubState();
    fetchCandles(currentSymbol, currentTimeframe);

    // Request desktop notification permission
    requestNotificationPermission().catch(() => {});

    // Initial AI evaluation
    triggerAISMCScan(currentSymbol, currentTimeframe);
  }, []);

  // On Symbol or Timeframe change
  useEffect(() => {
    fetchCandles(currentSymbol, currentTimeframe);
  }, [currentSymbol, currentTimeframe]);

  // Connect to Server-Sent Events (SSE) for real-time live market updates
  useEffect(() => {
    const eventSource = new EventSource('/api/stream');

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.prices) {
          setMarketPrices(data.prices);
        }
        if (data.autotrader) {
          setAutoTraderState(data.autotrader);

          // 1. Setup Limit Alert Notification
          if (data.autotrader.limitReached && !prevLimitReachedRef.current) {
            playAudioAlert('SETUP_LIMIT');
            const notif: NotificationEvent = {
              id: `limit_${Date.now()}`,
              timestamp: Date.now(),
              type: 'SETUP_LIMIT',
              title: `Setup Limit Reached: ${data.autotrader.todaySetupsCount}/${data.autotrader.maxSetupsLimit} Trades Used 🛑`,
              message: `Autonomous trading has paused to eliminate overtrading and safeguard account capital. Click Reset in the bot bar to resume.`,
              symbol: data.autotrader.currentScanningSymbol,
              price: data.prices?.[data.autotrader.currentScanningSymbol]?.price || 0,
            };
            setNotifications((prev) => [notif, ...prev.slice(0, 4)]);
            sendDesktopNotification(notif);
          }
          prevLimitReachedRef.current = Boolean(data.autotrader.limitReached);

          // 2. Confirmed Setup Auto-Execution Notification
          if (data.autotrader.totalAutoTrades > prevTotalTradesRef.current && prevTotalTradesRef.current > 0) {
            playAudioAlert('CONFIRMED_SETUP');
            const setup = data.autotrader.lastExecutedSetup;
            if (setup) {
              const notif: NotificationEvent = {
                id: `exec_${Date.now()}`,
                timestamp: Date.now(),
                type: 'CONFIRMED_SETUP',
                title: `SMC Setup Confirmed & Executed: ${setup.symbol} ${setup.direction} ⚡`,
                message: `Entry: $${setup.entryPrice} | SL: $${setup.stopLoss} | TP1: $${setup.takeProfit1} [${setup.tp1Label || 'Liquidity Pool'}] (Trade ${data.autotrader.todaySetupsCount}/${data.autotrader.maxSetupsLimit})`,
                symbol: setup.symbol,
                price: setup.entryPrice,
              };
              setNotifications((prev) => [notif, ...prev.slice(0, 4)]);
              sendDesktopNotification(notif);
            }
          }
          prevTotalTradesRef.current = data.autotrader.totalAutoTrades;
          if (data.autotrader.allAssetSetups) {
            setAllAssetSetups((prev) => ({ ...prev, ...data.autotrader.allAssetSetups }));
          }
          if (data.autotrader.activePositions) {
            setActivePositions(data.autotrader.activePositions);
          }
        }

        if (data.state) {
          if (data.state.activePositions) {
            setActivePositions(data.state.activePositions);
          } else if (data.state.activePosition) {
            setActivePositions([data.state.activePosition]);
          } else {
            setActivePositions([]);
          }
          setActivePosition(data.state.activePosition);
          if (data.state.allAssetSetups) {
            setAllAssetSetups((prev) => ({ ...prev, ...data.state.allAssetSetups }));
          }
          if (data.state.currentSetup !== undefined) {
            setCurrentSetup(data.state.currentSetup);
          }
          if (data.state.executionMode) setExecutionMode(data.state.executionMode);
          if (data.state.tradeApprovalMode) setTradeApprovalMode(data.state.tradeApprovalMode);
          if (data.state.riskSettings) setRiskSettings(data.state.riskSettings);
          if (data.state.stats) setStats(data.state.stats);
          if (data.state.tradeHistory) {
            // Check if a new closed trade arrived
            if (data.state.tradeHistory.length > prevHistoryLengthRef.current && prevHistoryLengthRef.current > 0) {
              const closedTrade = data.state.tradeHistory[0];
              if (closedTrade) {
                const isTp = (closedTrade.profitAmount || 0) >= 0;
                playAudioAlert(isTp ? 'TP' : 'SL');
                const notif: NotificationEvent = {
                  id: `close_${Date.now()}`,
                  timestamp: Date.now(),
                  type: isTp ? 'TAKE_PROFIT' : 'STOP_LOSS',
                  title: isTp ? `Target Hit! TP Locked on ${closedTrade.symbol}` : `Stop Loss Triggered on ${closedTrade.symbol}`,
                  message: `${closedTrade.symbol} ${closedTrade.direction} closed at $${closedTrade.exitPrice}. PnL: ${(closedTrade.profitAmount || 0) >= 0 ? '+' : ''}$${(closedTrade.profitAmount || 0).toFixed(2)}`,
                  symbol: closedTrade.symbol,
                  price: closedTrade.exitPrice || 0,
                  pnlAmount: closedTrade.profitAmount,
                };
                setNotifications((prev) => [notif, ...prev.slice(0, 4)]);
              }
            }
            prevHistoryLengthRef.current = data.state.tradeHistory.length;
            setTradeHistory(data.state.tradeHistory);
          }
          if (data.state.webhookLogs) setWebhookLogs(data.state.webhookLogs);
          if (data.state.brokerHub) setBrokerHubState(data.state.brokerHub);
        }
      } catch (err) {
        console.warn('SSE parse error:', err);
      }
    };

    return () => {
      eventSource.close();
    };
  }, []);

  const fetchSystemState = async () => {
    try {
      const res = await fetch('/api/system/state');
      if (res.ok) {
        const state = await res.json();
        if (state.activePositions) {
          setActivePositions(state.activePositions);
        } else if (state.activePosition) {
          setActivePositions([state.activePosition]);
        } else {
          setActivePositions([]);
        }
        setActivePosition(state.activePosition);
        if (state.allAssetSetups) {
          setAllAssetSetups(state.allAssetSetups);
        }
        setCurrentSetup(state.currentSetup);
        setExecutionMode(state.executionMode);
        setTradeApprovalMode(state.tradeApprovalMode);
        setRiskSettings(state.riskSettings);
        setStats(state.stats);
        setTradeHistory(state.tradeHistory);
        setWebhookLogs(state.webhookLogs);
        if (state.brokerHub) setBrokerHubState(state.brokerHub);
      }
    } catch (e) {
      console.warn('Failed to fetch system state:', e);
    }
  };

  const fetchCandles = async (sym: MarketSymbol, tf: Timeframe) => {
    try {
      const res = await fetch(`/api/market/candles?symbol=${sym}&interval=${tf}`);
      if (res.ok) {
        const data = await res.json();
        setCandles(data.candles || []);
        setSmcZones(data.smcZones || []);
      }
    } catch (e) {
      console.warn('Failed to fetch candles:', e);
    }
  };

  const triggerAISMCScan = async (sym: MarketSymbol = currentSymbol, tf: Timeframe = currentTimeframe) => {
    if (isAnalyzing) return;
    setIsAnalyzing(true);
    try {
      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: sym, interval: tf }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.setup) {
          setCurrentSetup(data.setup);
          setAllAssetSetups((prev) => ({ ...prev, [sym]: data.setup }));
        }
      }
    } catch (e) {
      console.warn('AI Scan failed:', e);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Centralized asset selection handler ensuring chart, candles, scan, and locked panel update immediately
  const handleSelectAsset = (sym: MarketSymbol) => {
    setCurrentSymbol(sym);
    if (allAssetSetups[sym]) {
      setCurrentSetup(allAssetSetups[sym]!);
    }
    fetchCandles(sym, currentTimeframe);
    triggerAISMCScan(sym, currentTimeframe);
  };

  const prevActiveIdsRef = useRef<Set<string>>(new Set());

  // Auto-focus chart ONLY when a newly executed trade opens (without overriding manual asset selection)
  useEffect(() => {
    const currentIds = new Set(activePositions.map((p) => p.id));
    const newlyAdded = activePositions.find((p) => !prevActiveIdsRef.current.has(p.id));
    if (newlyAdded && newlyAdded.setup?.symbol) {
      handleSelectAsset(newlyAdded.setup.symbol);
    }
    prevActiveIdsRef.current = currentIds;
  }, [activePositions]);

  // Immediate Autonomous Scan & Entry trigger
  const handleTriggerAutoScanNow = async (sym: MarketSymbol = currentSymbol) => {
    if (isScanningNow) return;
    setIsScanningNow(true);
    try {
      const res = await fetch('/api/autotrader/scan-now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: sym }),
      });
      const data = await res.json();
      if (data.setup) {
        setCurrentSetup(data.setup);
        if (data.setup.symbol && data.setup.symbol !== currentSymbol) {
          setCurrentSymbol(data.setup.symbol);
        }
      }
    } catch (e) {
      console.error('Trigger auto-scan error:', e);
    } finally {
      setIsScanningNow(false);
    }
  };

  const handleExecuteTrade = async (setupId: string) => {
    setIsExecuting(true);
    try {
      const res = await fetch('/api/trade/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setupId }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (data.position) {
          setActivePositions((prev) => {
            const filtered = prev.filter((p) => p.id !== data.position.id);
            return [...filtered, data.position];
          });
          setActivePosition(data.position);
          if (data.position?.setup?.symbol) {
            handleSelectAsset(data.position.setup.symbol);
          }
        }
      } else {
        setNotifications((prev) => [
          {
            id: `notif_${Date.now()}`,
            timestamp: Date.now(),
            type: 'SETUP_LIMIT',
            title: 'Trade Execution Blocked',
            message: data.message || 'Execution error',
            symbol: currentSymbol,
            price: marketPrices[currentSymbol]?.price || 0,
          },
          ...prev.slice(0, 9),
        ]);
      }
    } catch (e) {
      console.error('Execute trade error:', e);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleExecuteCustomTrade = async (params: {
    symbol: MarketSymbol;
    direction: TradeDirection;
    entryPrice: number;
    stopLoss: number;
    takeProfit1: number;
    takeProfit2?: number;
    takeProfit3?: number;
    riskRewardRatio: number;
  }) => {
    if (!isMarketOpen(params.symbol)) {
      const status = getMarketHoursStatus(params.symbol);
      setNotifications((prev) => [
        {
          id: `notif_${Date.now()}`,
          timestamp: Date.now(),
          type: 'SETUP_LIMIT',
          title: `${params.symbol} Weekend Market Close`,
          message: `Traditional markets trade Mon-Fri only (${status.reopensAt || 'Re-opens Sunday 21:00 UTC'}). Only BTCUSD trades 24/7.`,
          symbol: params.symbol,
          price: params.entryPrice,
        },
        ...prev.slice(0, 9),
      ]);
      return;
    }

    setIsExecuting(true);
    try {
      const res = await fetch('/api/trade/execute-custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (data.position) {
          setActivePositions((prev) => {
            const filtered = prev.filter((p) => p.id !== data.position.id);
            return [...filtered, data.position];
          });
          setActivePosition(data.position);
          if (data.position?.setup) {
            setCurrentSetup(data.position.setup);
            handleSelectAsset(data.position.setup.symbol);
          }
        }
      } else {
        setNotifications((prev) => [
          {
            id: `notif_${Date.now()}`,
            timestamp: Date.now(),
            type: 'SETUP_LIMIT',
            title: 'Trade Execution Blocked',
            message: data.message || data.error || 'Execution error',
            symbol: params.symbol,
            price: params.entryPrice,
          },
          ...prev.slice(0, 9),
        ]);
      }
    } catch (e) {
      console.error('Execute custom trade error:', e);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleClosePosition = async (targetSymbol?: MarketSymbol) => {
    setIsClosing(true);
    try {
      const sym = targetSymbol || currentSymbol;
      const res = await fetch('/api/trade/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: sym }),
      });
      if (res.ok) {
        fetchSystemState();
      }
    } catch (e) {
      console.error('Close trade error:', e);
    } finally {
      setIsClosing(false);
    }
  };

  const handleMoveBreakeven = async (targetSymbol?: MarketSymbol) => {
    try {
      const sym = targetSymbol || currentSymbol;
      const res = await fetch('/api/trade/breakeven', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: sym }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.position) {
        setActivePositions((prev) =>
          prev.map((p) => (p.setup.symbol === data.position.setup.symbol ? data.position : p))
        );
        if (activePosition?.setup.symbol === data.position.setup.symbol) {
          setActivePosition(data.position);
        }
      }
    } catch (e) {
      console.error('Breakeven error:', e);
    }
  };

  const handleToggleExecutionMode = async (mode: ExecutionMode) => {
    try {
      const res = await fetch('/api/trade/mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      });
      if (res.ok) {
        setExecutionMode(mode);
      }
    } catch (e) {
      console.error('Mode toggle error:', e);
    }
  };

  const handleApprovalModeToggle = () => {
    if (tradeApprovalMode === 'MANUAL') {
      // Show warning modal before enabling Auto-Trading Mode
      setAutoTradeWarningOpen(true);
    } else {
      updateApprovalMode('MANUAL');
    }
  };

  const updateApprovalMode = async (mode: TradeApprovalMode) => {
    try {
      const res = await fetch('/api/trade/approval-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvalMode: mode }),
      });
      if (res.ok) {
        setTradeApprovalMode(mode);
      }
    } catch (e) {
      console.error('Approval mode error:', e);
    }
  };

  const handleSaveRiskSettings = async (newSettings: Partial<RiskSettings>) => {
    try {
      const res = await fetch('/api/risk/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings),
      });
      if (res.ok) {
        const data = await res.json();
        setRiskSettings(data.riskSettings);
      }
    } catch (e) {
      console.error('Risk save error:', e);
    }
  };

  const handleResetPaperAccount = async (balance: number) => {
    try {
      const res = await fetch('/api/paper/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ balance }),
      });
      if (res.ok) {
        const data = await res.json();
        setRiskSettings(data.riskSettings);
        setActivePosition(null);
        setCurrentSetup(null);
      }
    } catch (e) {
      console.error('Paper reset error:', e);
    }
  };

  // Active trade position for the currently selected asset (if an open trade exists for this asset)
  const currentSymbolPosition =
    activePositions.find((p) => p.setup.symbol === currentSymbol && p.setup.isLocked) ||
    (activePosition && activePosition.setup.symbol === currentSymbol && activePosition.setup.isLocked ? activePosition : null);

  const isPositionActiveForCurrentSymbol = Boolean(currentSymbolPosition);

  // Other active positions running simultaneously on other assets
  const otherActivePositions = activePositions.filter(
    (p) => p.setup.symbol !== currentSymbol && p.setup.isLocked
  );

  return (
    <div className="min-h-screen flex flex-col bg-[#0b0e14] text-slate-100 selection:bg-blue-600 selection:text-white">
      {/* Desktop & Audio Push Notifications Toast Container */}
      <DesktopNotificationToast
        notifications={notifications}
        onDismiss={handleDismissNotification}
        onClearAll={handleClearAllNotifications}
      />

      {/* Top Header Navigation */}
      <Header
        currentSymbol={currentSymbol}
        onSymbolChange={handleSelectAsset}
        currentTimeframe={currentTimeframe}
        onTimeframeChange={(tf) => {
          setCurrentTimeframe(tf);
          triggerAISMCScan(currentSymbol, tf);
        }}
        marketPrices={marketPrices}
        activePosition={activePosition}
        activePositions={activePositions}
        executionMode={executionMode}
        onToggleExecutionMode={handleToggleExecutionMode}
        tradeApprovalMode={tradeApprovalMode}
        onToggleApprovalMode={handleApprovalModeToggle}
        riskSettings={riskSettings}
        onOpenRiskModal={() => setRiskModalOpen(true)}
        onOpenWebhookModal={() => setWebhookModalOpen(true)}
        isAnalyzing={isAnalyzing}
        onTriggerAnalysis={() => triggerAISMCScan(currentSymbol, currentTimeframe)}
        oandaStatus={oandaStatus}
        onOpenOandaModal={() => setOandaModalOpen(true)}
        brokerState={brokerHubState}
        onOpenBrokerHubModal={() => setBrokerHubModalOpen(true)}
      />

      {/* Real-time Institutional Trading Session Bar & 24h Timeline */}
      <LiveSessionBar />

      {/* Autonomous Auto-Trading Bot Control & Real-time Scan Status */}
      <div className="max-w-[1720px] mx-auto w-full px-3 lg:px-4 pt-1">
        <AutoTraderBar
          autoTraderState={autoTraderState}
          activePosition={activePosition}
          activePositions={activePositions}
          currentSymbol={currentSymbol}
          onToggleAutoTrade={handleApprovalModeToggle}
          onTriggerScanNow={handleTriggerAutoScanNow}
          onSelectSymbol={handleSelectAsset}
          isScanningNow={isScanningNow}
        />
      </div>

      {/* Main Trading Floor Grid */}
      <main className="flex-1 p-3 lg:p-4 grid grid-cols-1 lg:grid-cols-12 gap-3.5 max-w-[1720px] mx-auto w-full">
        {/* Left Column: Live TradingView Chart */}
        <div className="lg:col-span-8 flex flex-col min-h-[500px]">
          <TradingViewChart
            symbol={currentSymbol}
            timeframe={currentTimeframe}
            smcZones={smcZones}
            candles={candles}
            currentPriceData={marketPrices[currentSymbol]}
            activePosition={currentSymbolPosition || activePosition}
            activePositions={activePositions}
            currentSetup={currentSetup}
            allAssetSetups={allAssetSetups}
            onExecuteTrade={handleExecuteTrade}
            onExecuteCustomTrade={handleExecuteCustomTrade}
            onClosePosition={() => handleClosePosition(currentSymbol)}
            onMoveBreakeven={() => handleMoveBreakeven(currentSymbol)}
            onSelectSymbol={handleSelectAsset}
            onTimeframeChange={(tf) => {
              setCurrentTimeframe(tf);
              triggerAISMCScan(currentSymbol, tf);
            }}
          />
        </div>

        {/* Right Column: Execution Engine & Locked Position Monitor */}
        <div className="lg:col-span-4 flex flex-col space-y-3.5">
          {/* CRITICAL: When the clicked asset has an open trade, show that asset's LOCKED ACTIVE POSITION MONITOR */}
          {isPositionActiveForCurrentSymbol && currentSymbolPosition ? (
            <LockedTradePanel
              activePosition={currentSymbolPosition}
              activePositions={activePositions}
              onSelectPosition={(pos) => handleSelectAsset(pos.setup.symbol)}
              onClosePosition={() => handleClosePosition(currentSymbol)}
              onClosePositionSymbol={(sym) => handleClosePosition(sym)}
              isClosing={isClosing}
              onMoveBreakeven={() => handleMoveBreakeven(currentSymbol)}
              onMoveBreakevenSymbol={(sym) => handleMoveBreakeven(sym)}
              liveMarketPrice={marketPrices[currentSymbol]}
            />
          ) : (
            <div className="space-y-3.5">
              {/* If other asset(s) have active trades running, show a sleek quick-switch notification banner */}
              {otherActivePositions.length > 0 && (
                <div className="bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-transparent border border-amber-500/30 rounded-xl p-3 flex items-center justify-between gap-3 shadow-lg">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-1.5 rounded-lg bg-amber-500 text-slate-950 font-black shrink-0">
                      <Lock className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-amber-200 flex items-center gap-2 flex-wrap">
                        <span>{otherActivePositions.length} Trade{otherActivePositions.length > 1 ? 's' : ''} Locked 🔒:</span>
                        {otherActivePositions.map((pos) => (
                          <button
                            key={pos.id}
                            onClick={() => handleSelectAsset(pos.setup.symbol)}
                            className="px-2.5 py-0.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 text-xs font-mono font-bold transition-all flex items-center gap-1.5 shadow-sm"
                            title={`Click to switch locked setup panel to ${pos.setup.symbol}`}
                          >
                            <span>{pos.setup.symbol}</span>
                            <span className={pos.setup.direction === 'LONG' ? 'text-emerald-400 text-[10px]' : 'text-rose-400 text-[10px]'}>
                              {pos.setup.direction}
                            </span>
                            <span className={pos.unrealizedPnL >= 0 ? 'text-emerald-400 text-[11px]' : 'text-rose-400 text-[11px]'}>
                              {pos.unrealizedPnL >= 0 ? '+' : ''}${pos.unrealizedPnL.toFixed(2)}
                            </span>
                          </button>
                        ))}
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">Click any asset with an open trade to view its locked setup panel</p>
                    </div>
                  </div>
                </div>
              )}

              <AISetupCard
                setup={currentSetup}
                allAssetSetups={allAssetSetups}
                currentSymbol={currentSymbol}
                isBestCandidate={autoTraderState?.bestCandidateSymbol === currentSymbol}
                isAnalyzing={isAnalyzing}
                onTriggerAnalysis={() => triggerAISMCScan(currentSymbol, currentTimeframe)}
                onExecuteTrade={handleExecuteTrade}
                isExecuting={isExecuting}
                tradeApprovalMode={tradeApprovalMode}
                activePositions={activePositions}
                onSelectSymbol={handleSelectAsset}
              />
            </div>
          )}

          {/* Quick Account Equity Status Widget */}
          <div className="bg-[#0f141f] border border-slate-800/80 rounded-xl p-3.5 space-y-2 text-xs">
            <div className="flex items-center justify-between text-slate-400 font-mono text-[11px]">
              <span className="flex items-center gap-1.5 font-semibold text-slate-300">
                <Shield className="w-3.5 h-3.5 text-blue-400" />
                <span>Risk Allocation Status:</span>
              </span>
              <span className="text-emerald-400 font-bold">{executionMode} MODE</span>
            </div>

            <div className="grid grid-cols-3 gap-2 font-mono">
              <div className="bg-[#151b28] p-2 rounded border border-slate-800">
                <span className="text-[10px] text-slate-500 block">Account Balance</span>
                <span className="text-white font-bold text-xs">${riskSettings.accountBalance.toLocaleString()}</span>
              </div>
              <div className="bg-[#151b28] p-2 rounded border border-slate-800">
                <span className="text-[10px] text-slate-500 block">Max Risk / Trade</span>
                <span className="text-amber-400 font-bold text-xs">
                  {riskSettings.maxRiskPerTradePercent}% (${((riskSettings.accountBalance * riskSettings.maxRiskPerTradePercent) / 100).toFixed(0)})
                </span>
              </div>
              <div className="bg-[#151b28] p-2 rounded border border-slate-800">
                <span className="text-[10px] text-slate-500 block">Daily Drawdown</span>
                <span
                  className={`font-bold text-xs ${
                    riskSettings.dailyRealizedPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {riskSettings.dailyRealizedPnL >= 0 ? '+' : ''}${riskSettings.dailyRealizedPnL.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Section: Analytical Tabs (SMC Matrix / Trade History / Webhook) */}
        <div className="lg:col-span-12 space-y-3 pt-1">
          {/* Tab Navigation */}
          <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
            <button
              id="tab-smc-matrix"
              onClick={() => setActiveTab('matrix')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'matrix'
                  ? 'bg-blue-600 text-white shadow'
                  : 'bg-[#151b28] text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Smart Money Concepts Matrix ({smcZones.length})</span>
            </button>

            <button
              id="tab-trade-history"
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'history'
                  ? 'bg-blue-600 text-white shadow'
                  : 'bg-[#151b28] text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              <span>Execution Log & Analytics ({tradeHistory.length})</span>
            </button>

            <button
              id="tab-webhook-bridge"
              onClick={() => setActiveTab('webhook')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'webhook'
                  ? 'bg-blue-600 text-white shadow'
                  : 'bg-[#151b28] text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              <Webhook className="w-3.5 h-3.5" />
              <span>TradingView Webhook Integration</span>
            </button>
          </div>

          {/* Active Tab Views */}
          {activeTab === 'matrix' && <SMCMatrix zones={smcZones} symbol={currentSymbol} />}
          {activeTab === 'history' && (
            <div className="space-y-4">
              <CumulativePnLChart history={tradeHistory} stats={stats} />
              <TradeHistoryTable history={tradeHistory} stats={stats} />
            </div>
          )}
          {activeTab === 'webhook' && (
            <div className="bg-[#0f141f] border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Webhook className="w-4 h-4 text-purple-400" />
                    <span>TradingView Alert Webhook Configuration</span>
                  </h4>
                  <p className="text-xs text-slate-400">
                    Connect Pine Script automated strategies to send real-time alerts to the backend
                  </p>
                </div>
                <button
                  onClick={() => setWebhookModalOpen(true)}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-xs font-semibold text-white transition-colors"
                >
                  View Pine Script & Setup
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="bg-[#151b28] p-3 rounded-lg border border-slate-800 space-y-1">
                  <span className="text-slate-400 text-[10px] uppercase font-mono">Endpoint URL</span>
                  <div className="font-mono text-white select-all bg-slate-900 p-2 rounded border border-slate-800 truncate">
                    {window.location.origin}/api/webhook/tradingview
                  </div>
                </div>
                <div className="bg-[#151b28] p-3 rounded-lg border border-slate-800 space-y-1">
                  <span className="text-slate-400 text-[10px] uppercase font-mono">Authentication Token</span>
                  <div className="font-mono text-amber-400 select-all bg-slate-900 p-2 rounded border border-slate-800">
                    smc_alpha_tv_secret_token
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Modals */}
      <RiskManagementModal
        isOpen={riskModalOpen}
        onClose={() => setRiskModalOpen(false)}
        riskSettings={riskSettings}
        onSaveRiskSettings={handleSaveRiskSettings}
        onResetPaperAccount={handleResetPaperAccount}
      />

      <TradingViewWebhookModal
        isOpen={webhookModalOpen}
        onClose={() => setWebhookModalOpen(false)}
        webhookLogs={webhookLogs}
      />

      <AutoTradeModal
        isOpen={autoTradeWarningOpen}
        onClose={() => setAutoTradeWarningOpen(false)}
        onConfirmEnable={() => updateApprovalMode('AUTO')}
      />

      <OandaBrokerModal
        isOpen={oandaModalOpen}
        onClose={() => setOandaModalOpen(false)}
        oandaStatus={oandaStatus}
        marketPrices={marketPrices}
      />

      <BrokerHubModal
        isOpen={brokerHubModalOpen}
        onClose={() => setBrokerHubModalOpen(false)}
        brokerState={brokerHubState}
        onUpdateSettings={handleUpdateBrokerSettings}
        onConnectExness={handleConnectExness}
        onUpdateOtherBroker={handleUpdateOtherBroker}
        marketPrices={marketPrices}
      />
    </div>
  );
}
