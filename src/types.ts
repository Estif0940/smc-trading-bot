export type MarketSymbol =
  | 'XAUUSD'
  | 'BTCUSD'
  | 'ETHUSD'
  | 'EURUSD'
  | 'GBPUSD'
  | 'NAS100'
  | 'USDJPY'
  | 'AUDUSD'
  | 'USDCAD'
  | 'USDCHF'
  | 'NZDUSD';

export type Timeframe =
  | '1m'
  | '2m'
  | '3m'
  | '5m'
  | '15m'
  | '30m'
  | '45m'
  | '1h'
  | '2h'
  | '4h'
  | '1D'
  | '1W'
  | '1M';

export type ExecutionMode = 'PAPER' | 'LIVE';

export type TradeApprovalMode = 'MANUAL' | 'AUTO';

export type TradeDirection = 'LONG' | 'SHORT';

export type TradeStatus =
  | 'ANALYZING'
  | 'NO_SETUP'
  | 'WAITING_CONFIRMATION'
  | 'PENDING_APPROVAL'
  | 'ACTIVE'
  | 'LOCKED'
  | 'TAKE_PROFIT_HIT'
  | 'STOP_LOSS_HIT'
  | 'MANUALLY_CLOSED';

export interface SMCZone {
  id: string;
  type: 'BOS' | 'CHoCH' | 'BULLISH_OB' | 'BEARISH_OB' | 'BULLISH_FVG' | 'BEARISH_FVG' | 'LIQUIDITY_BSL' | 'LIQUIDITY_SSL' | 'EQUAL_HIGHS' | 'EQUAL_LOWS' | 'SUPPORT' | 'RESISTANCE';
  label: string;
  highPrice: number;
  lowPrice: number;
  timeframe: string;
  isMitigated: boolean;
  importance: string;
  timestamp: number;
}

export interface MultiTimeframeAnalysis {
  higherTimeframe: {
    timeframe: string;
    trend: 'BULLISH' | 'BEARISH' | 'RANGING';
    majorStructure: string;
    majorLiquidity: string;
    keyOrderBlock: string;
  };
  entryTimeframe: {
    timeframe: string;
    confirmation: 'CONFIRMED' | 'WAITING' | 'INVALIDATED';
    chochDetected: boolean;
    bosDetected: boolean;
    liquiditySwept: boolean;
    priceActionConfirmation: string;
  };
}

export interface SMCTakeProfitTarget {
  targetType: 'LIQUIDITY_POOL' | 'UNMITIGATED_OB' | 'UNMITIGATED_FVG' | 'SESSION_LIQUIDITY';
  label: string;
  price: number;
  description: string;
  riskReward: number;
}

export interface SMCBreakdown {
  higherTimeframeTrend: string;
  liquiditySweep: string;
  structureBreak: string;
  orderBlockReaction: string;
  fvgConfirmation: string;
  priceActionTrigger: string;
  takeProfitThesis?: string;
  tpTargets?: {
    tp1: SMCTakeProfitTarget;
    tp2: SMCTakeProfitTarget;
    tp3: SMCTakeProfitTarget;
  };
}

export interface TradeSetup {
  id: string;
  symbol: MarketSymbol;
  direction: TradeDirection;
  entryPrice: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  takeProfit3: number;
  tp1Label?: string;
  tp2Label?: string;
  tp3Label?: string;
  tp1TargetType?: 'LIQUIDITY_POOL' | 'UNMITIGATED_OB' | 'UNMITIGATED_FVG' | 'SESSION_LIQUIDITY';
  tp2TargetType?: 'LIQUIDITY_POOL' | 'UNMITIGATED_OB' | 'UNMITIGATED_FVG' | 'SESSION_LIQUIDITY';
  tp3TargetType?: 'LIQUIDITY_POOL' | 'UNMITIGATED_OB' | 'UNMITIGATED_FVG' | 'SESSION_LIQUIDITY';
  riskRewardRatio: number;
  confidenceScore: number;
  status: TradeStatus;
  isLocked: boolean; // CRITICAL: Once executed, trade is locked
  aiExplanation: string;
  smcBreakdown: SMCBreakdown;
  multiTimeframe: MultiTimeframeAnalysis;
  lotSize: number;
  riskAmount: number;
  mode: ExecutionMode;
  createdAt: number;
  executedAt?: number;
  closedAt?: number;
  exitPrice?: number;
  profitAmount?: number;
  profitPercent?: number;
  outcome?: 'WIN' | 'LOSS';
  closeReason?: 'TAKE_PROFIT' | 'STOP_LOSS' | 'MANUAL';
  brokerTicket?: string;
  brokerName?: string;
}

export interface ActivePosition {
  id: string;
  setup: TradeSetup;
  currentPrice: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  distToSL: number;
  distToSLPercent: number;
  distToTP1: number;
  distToTP1Percent: number;
  tradeDurationSeconds: number;
  status: 'ACTIVE' | 'LOCKED' | 'TAKE_PROFIT_HIT' | 'STOP_LOSS_HIT';
  brokerTicket?: string;
  brokerName?: string;
  brokerExecutionStatus?: string;
  brokerFillPrice?: number;
}

export interface RiskSettings {
  accountBalance: number;
  maxRiskPerTradePercent: number; // e.g. 1.0%
  maxDailyLossPercent: number; // e.g. 3.0%
  dailyRealizedPnL: number;
  leverage: number;
  maxOpenTrades: number; // Always 1 to respect the Locked Active Trade mandate
}

export interface MarketPriceData {
  symbol: MarketSymbol;
  price: number;
  bid: number;
  ask: number;
  high24h: number;
  low24h: number;
  change24h: number;
  change24hPercent: number;
  timestamp: number;
  source: string;
  isMarketOpen?: boolean;
  marketStatus?: 'OPEN' | 'WEEKEND_CLOSED';
  marketStatusLabel?: string;
  weekendReason?: string;
  reopensAt?: string;
}

export interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TradingStats {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalProfitLoss: number;
  avgRiskReward: number;
  profitFactor: number;
}

export interface WebhookLog {
  id: string;
  timestamp: number;
  symbol: string;
  action: string;
  status: 'SUCCESS' | 'REJECTED' | 'INVALID_TOKEN' | 'RISK_BREACH';
  message: string;
  payload: any;
}

export type TradeHistoryItem = TradeSetup;

export interface OandaStatus {
  hasApiKey: boolean;
  environment: 'practice' | 'live';
  accountId: string | null;
  activeMode: 'DIRECT_V20_REST' | 'OANDA_TV_MIRROR';
  description: string;
  supportedSymbols: string[];
  baseUrl: string;
  tradingViewPrefix: string;
}

export type BrokerType = 'EXNESS' | 'OANDA' | 'CTRADER' | 'PROP_FIRM' | 'METATRADER' | 'METAMASK';

export interface MetaMaskWalletConfig {
  isConnected: boolean;
  address: string;
  chainId: string;
  networkName: string;
  balanceEth: number;
  balanceUsd: number;
  isSimulated: boolean;
  lastConnected: number;
}

export interface ExnessConfig {
  accountNumber: string;
  server: string;
  accountType: 'standard' | 'pro' | 'raw_spread' | 'zero';
  symbolSuffix: string; // e.g. 'm', 'z', ''
  tokenOrPassword: string;
  isConnected: boolean;
  isVerified?: boolean;
  verificationStatus?: 'VERIFIED' | 'FAILED' | 'PENDING' | 'DISCONNECTED';
  verificationMethod?: 'EA_BRIDGE' | 'METAAPI_REST' | 'DIRECT_EXNESS_GATEWAY' | 'UNVERIFIED';
  verificationError?: string;
  eaConnected?: boolean;
  lastHeartbeat?: number;
  lastPingMs: number;
  balance: number;
  equity: number;
  freeMargin: number;
  leverage: number;
  currency: string;
  serverLocation: string;
  companyName?: string;
  openOrdersCount?: number;
  terminalVersion?: string;
}

export interface OandaBrokerConfig {
  apiKey: string;
  accountId: string;
  environment: 'live' | 'practice';
  isConnected: boolean;
  balance: number;
  equity: number;
  freeMargin: number;
  leverage: number;
  currency: string;
}

export interface CTraderConfig {
  clientId: string;
  clientSecret: string;
  accessToken: string;
  accountId: string;
  brokerName: string;
  isConnected: boolean;
  balance: number;
  equity: number;
  leverage: number;
  currency: string;
}

export interface PropFirmConfig {
  firmName: string; // e.g. 'FTMO', 'FundedNext', 'MyForexFunds'
  accountNumber: string;
  server: string;
  maxDailyLossPercent: number;
  maxTotalLossPercent: number;
  profitTargetPercent: number;
  currentDailyDrawdown: number;
  currentTotalDrawdown: number;
  isConnected: boolean;
  balance: number;
  equity: number;
  leverage: number;
  currency: string;
}

export interface BrokerExecutionSettings {
  autoTradeRealBrokers: boolean; // Master switch for live broker auto-trading
  activeBroker: BrokerType | 'NONE';
  maxLotSize: number;
  maxSlippagePips: number;
  autoMoveBreakevenAtRR: number; // 0 = disabled, e.g. 1.5
  requireConfirmationBeforeRealTrade: boolean;
  copyToPaperAccount: boolean;
}

export interface BrokerAuditLog {
  id: string;
  timestamp: number;
  broker: string;
  action: 'ORDER_DISPATCH' | 'ORDER_FILLED' | 'BREAKEVEN_MODIFIED' | 'ORDER_CLOSED' | 'CONNECTION_TEST' | 'ERROR';
  symbol: string;
  ticketId?: string;
  details: string;
  latencyMs?: number;
  status: 'SUCCESS' | 'FAILED' | 'PENDING';
}

export interface BrokerHubState {
  activeBroker: BrokerType | 'NONE';
  settings: BrokerExecutionSettings;
  exness: ExnessConfig;
  oanda: OandaBrokerConfig;
  ctrader: CTraderConfig;
  propFirm: PropFirmConfig;
  metaMask?: MetaMaskWalletConfig;
  auditLogs: BrokerAuditLog[];
}

export interface AutoTraderLogEntry {
  id: string;
  timestamp: number;
  action: 'SCAN' | 'ENTRY_FOUND' | 'AUTO_EXECUTE' | 'TP_HIT' | 'SL_HIT' | 'COOLDOWN' | 'STATUS_CHANGE' | 'LIMIT_REACHED' | 'WAITING_CONFIRMATION';
  symbol: MarketSymbol;
  message: string;
}

export interface WaitingConfirmationDetails {
  symbol: MarketSymbol;
  missingCriteria: string[];
  hasLiquiditySweep: boolean;
  hasStructureShift: boolean;
  hasOBMitigation: boolean;
  hasValidRR: boolean;
  statusText: string;
  lastChecked: number;
}

export interface AssetAnalysisSummary {
  symbol: MarketSymbol;
  direction: TradeDirection;
  entryPrice: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  takeProfit3: number;
  tp1Label?: string;
  riskRewardRatio: number;
  confidenceScore: number;
  isConfirmed: boolean;
  statusText: string;
  setup: TradeSetup;
  lastAnalyzed: number;
  isBestCandidate?: boolean;
}

export interface AutoTraderState {
  enabled: boolean;
  status: 'IDLE' | 'SCANNING' | 'WAITING_CONFIRMATION' | 'ENTRY_FOUND' | 'LOCKED_WAITING_TP_SL' | 'COOLDOWN' | 'SETUP_LIMIT_REACHED';
  currentScanningSymbol: MarketSymbol;
  watchlist: MarketSymbol[];
  scanIndex: number;
  lastScanTime: number;
  nextScanInSeconds: number;
  scanIntervalSeconds: number;
  statusMessage: string;
  totalAutoTrades: number;
  cooldownUntil: number;
  lastExecutedSetup: TradeSetup | null;
  recentLogs: AutoTraderLogEntry[];
  // Strict SMC & Setup Limit Controls
  maxSetupsLimit: number;
  todaySetupsCount: number;
  limitReached: boolean;
  minConfidenceThreshold: number;
  minRiskReward: number;
  waitingDetails?: WaitingConfirmationDetails | null;
  activeAssetCooldowns?: Partial<Record<MarketSymbol, number>>;
  lastLimitNotificationTime?: number;
  // Multi-Asset Analysis & Best Setup tracking across all assets
  allAssetSetups?: Partial<Record<MarketSymbol, TradeSetup>>;
  allAssetAnalyses?: Partial<Record<MarketSymbol, AssetAnalysisSummary>>;
  bestCandidateSymbol?: MarketSymbol | null;
  bestCandidateScore?: number;
  activePositions?: ActivePosition[];
  activePositionsCount?: number;
}



