import {
  ActivePosition,
  ExecutionMode,
  MarketPriceData,
  MarketSymbol,
  RiskSettings,
  TradeApprovalMode,
  TradeDirection,
  TradeHistoryItem,
  TradeSetup,
  TradingStats,
  WebhookLog,
} from '../src/types.js';
import {
  dispatchBrokerBreakeven,
  dispatchBrokerClose,
  dispatchBrokerOrder,
  getBrokerHubState,
} from './brokerManager.js';
import { isMarketOpen, getMarketHoursStatus } from '../src/utils/marketHours.js';

// In-Memory Database State (persists across requests during runtime)
let activePositions: ActivePosition[] = [];
let activePosition: ActivePosition | null = null;
let currentSetup: TradeSetup | null = null;
let executionMode: ExecutionMode = 'PAPER';
let tradeApprovalMode: TradeApprovalMode = 'AUTO';

let riskSettings: RiskSettings = {
  accountBalance: 50000.0, // Standard $50,000 Paper Trading Account
  maxRiskPerTradePercent: 1.0, // 1% risk per trade
  maxDailyLossPercent: 3.0, // 3% maximum daily loss limit
  dailyRealizedPnL: 0.0,
  leverage: 100,
  maxOpenTrades: 5, // Supports simultaneous execution across multiple assets when best setups occur
};

// Seed initial trade history showcasing realistic SMC trades
let tradeHistory: TradeSetup[] = [
  {
    id: 'tr_hist_001',
    symbol: 'XAUUSD',
    direction: 'LONG',
    entryPrice: 2884.20,
    stopLoss: 2876.50,
    takeProfit1: 2905.00,
    takeProfit2: 2918.00,
    takeProfit3: 2930.00,
    exitPrice: 2905.00,
    riskRewardRatio: 2.7,
    confidenceScore: 92,
    status: 'TAKE_PROFIT_HIT',
    isLocked: false,
    aiExplanation: 'Bullish liquidity sweep below previous London low tapped into 4H Order Block. Aggressive displacement followed by 15M FVG retest generated explosive 1:2.7 R:R expansion to target BSL.',
    smcBreakdown: {
      higherTimeframeTrend: '4H BULLISH with Higher Highs expansion',
      liquiditySweep: 'London session low swept by 12 pips',
      structureBreak: 'Bullish BOS confirmed on 15M',
      orderBlockReaction: 'Clean bounce off 4H +OB at 2882.00',
      fvgConfirmation: '15M imbalance filled perfectly before takeoff',
      priceActionTrigger: 'Bullish hammer with heavy buy volume',
    },
    multiTimeframe: {
      higherTimeframe: { timeframe: '4H', trend: 'BULLISH', majorStructure: 'Higher Highs', majorLiquidity: 'BSL 2910', keyOrderBlock: '4H +OB' },
      entryTimeframe: { timeframe: '15M', confirmation: 'CONFIRMED', chochDetected: true, bosDetected: true, liquiditySwept: true, priceActionConfirmation: 'Confirmed' },
    },
    lotSize: 0.5,
    riskAmount: 500.0,
    mode: 'PAPER',
    createdAt: Date.now() - 1000 * 60 * 180,
    executedAt: Date.now() - 1000 * 60 * 175,
    closedAt: Date.now() - 1000 * 60 * 45,
    profitAmount: 1040.0,
    profitPercent: 2.08,
    outcome: 'WIN',
    closeReason: 'TAKE_PROFIT',
  },
  {
    id: 'tr_hist_002',
    symbol: 'BTCUSD',
    direction: 'SHORT',
    entryPrice: 91400.00,
    stopLoss: 92150.00,
    takeProfit1: 89600.00,
    takeProfit2: 88500.00,
    takeProfit3: 87200.00,
    exitPrice: 89600.00,
    riskRewardRatio: 2.4,
    confidenceScore: 88,
    status: 'TAKE_PROFIT_HIT',
    isLocked: false,
    aiExplanation: 'Institutional distribution at psychological $91.5k resistance. Equal highs were engineered, then swept by an institutional wick before an aggressive bearish market structure break.',
    smcBreakdown: {
      higherTimeframeTrend: '1H BEARISH redistribution',
      liquiditySweep: 'Equal highs (EQH) stop hunt at 91,480',
      structureBreak: 'Bearish CHoCH on 5M timeframe',
      orderBlockReaction: 'Rejection from 1H -OB supply zone',
      fvgConfirmation: 'Rapid displacement left large sell FVG',
      priceActionTrigger: 'Bearish engulfing candle with long upper wick',
    },
    multiTimeframe: {
      higherTimeframe: { timeframe: '4H', trend: 'BEARISH', majorStructure: 'Lower Lows', majorLiquidity: 'SSL 88k', keyOrderBlock: '1H -OB' },
      entryTimeframe: { timeframe: '15M', confirmation: 'CONFIRMED', chochDetected: true, bosDetected: true, liquiditySwept: true, priceActionConfirmation: 'Confirmed' },
    },
    lotSize: 0.15,
    riskAmount: 500.0,
    mode: 'PAPER',
    createdAt: Date.now() - 1000 * 60 * 360,
    executedAt: Date.now() - 1000 * 60 * 350,
    closedAt: Date.now() - 1000 * 60 * 210,
    profitAmount: 1200.0,
    profitPercent: 2.4,
    outcome: 'WIN',
    closeReason: 'TAKE_PROFIT',
  },
];

let webhookLogs: WebhookLog[] = [];

/**
 * Get current system state
 */
export function getSystemState() {
  return {
    activePosition,
    activePositions,
    currentSetup,
    allAssetSetups: getAllAssetSetups(),
    executionMode,
    tradeApprovalMode,
    riskSettings,
    tradeHistory,
    stats: calculateTradingStats(),
    webhookLogs: webhookLogs.slice(-20),
    brokerHub: getBrokerHubState(),
  };
}

export function getActivePositions(): ActivePosition[] {
  return [...activePositions];
}

export function getActivePositionForSymbol(symbol: MarketSymbol): ActivePosition | null {
  return activePositions.find((p) => p.setup.symbol === symbol) || null;
}

let assetSetups: Partial<Record<MarketSymbol, TradeSetup>> = {};

/**
 * Get setup for a specific symbol
 */
export function getAssetSetup(symbol: MarketSymbol): TradeSetup | null {
  return assetSetups[symbol] || null;
}

/**
 * Get all stored asset setups
 */
export function getAllAssetSetups(): Partial<Record<MarketSymbol, TradeSetup>> {
  return { ...assetSetups };
}

export function setProposedSetup(setup: TradeSetup | null) {
  if (setup) {
    assetSetups[setup.symbol] = setup;
  }
  // Only protect active locked trades on the SAME symbol from being overwritten
  if (setup && activePositions.some((p) => p.setup.symbol === setup.symbol && p.setup.isLocked)) {
    return;
  }
  currentSetup = setup;
}

/**
 * Execute Trade (Lock the Trade 🔒)
 */
export function executeTrade(setupId: string, setupParam?: TradeSetup): { success: boolean; message: string; position?: ActivePosition } {
  let setupToExecute: TradeSetup | null = setupParam || (currentSetup && currentSetup.id === setupId ? currentSetup : null);
  if (!setupToExecute) {
    for (const s of Object.values(assetSetups)) {
      if (s && s.id === setupId) {
        setupToExecute = s;
        break;
      }
    }
  }

  if (!setupToExecute) {
    return { success: false, message: 'No valid trade setup found to execute.' };
  }

  // Institutional Market Hours Rule: Traditional assets only trade Monday to Friday (Except BTCUSD/Crypto)
  if (!isMarketOpen(setupToExecute.symbol)) {
    const status = getMarketHoursStatus(setupToExecute.symbol);
    return {
      success: false,
      message: `Market is CLOSED for the weekend on ${setupToExecute.symbol}. Traditional markets (Forex, Metals, Indices) only trade Monday to Friday (${status.reopensAt || 'Re-opens Sunday 21:00 UTC'}). Only BTCUSD trades 24/7.`,
    };
  }

  // Check if position already active/locked for THIS symbol
  const existingForSymbol = activePositions.find((p) => p.setup.symbol === setupToExecute!.symbol);
  if (existingForSymbol) {
    return { success: false, message: `Position already active and LOCKED 🔒 on ${setupToExecute.symbol}. Must wait for TP or SL hit.` };
  }

  const maxAllowedTrades = riskSettings.maxOpenTrades || 5;
  if (activePositions.length >= maxAllowedTrades) {
    return { success: false, message: `Maximum open positions limit reached (${activePositions.length}/${maxAllowedTrades}).` };
  }

  // Risk management check
  const riskAmount = (riskSettings.accountBalance * riskSettings.maxRiskPerTradePercent) / 100;
  const slDistance = Math.abs(setupToExecute.entryPrice - setupToExecute.stopLoss);

  // Check maximum daily loss limit
  const maxAllowedDailyLoss = (riskSettings.accountBalance * riskSettings.maxDailyLossPercent) / 100;
  if (riskSettings.dailyRealizedPnL <= -maxAllowedDailyLoss) {
    return {
      success: false,
      message: `Risk Management Limit Exceeded: Daily drawdown limit of -${riskSettings.maxDailyLossPercent}% ($${maxAllowedDailyLoss.toFixed(2)}) reached. Trading halted today.`,
    };
  }

  // Calculate position sizing (lot size)
  let lotMultiplier = 1;
  if (setupToExecute.symbol === 'XAUUSD') {
    lotMultiplier = 100; // 1 standard lot gold = 100 oz
  } else if (
    setupToExecute.symbol === 'EURUSD' ||
    setupToExecute.symbol === 'GBPUSD' ||
    setupToExecute.symbol === 'AUDUSD' ||
    setupToExecute.symbol === 'USDCAD' ||
    setupToExecute.symbol === 'USDCHF' ||
    setupToExecute.symbol === 'NZDUSD'
  ) {
    lotMultiplier = 100000; // 1 standard lot forex = 100k units
  } else if (setupToExecute.symbol === 'USDJPY') {
    lotMultiplier = 1000; // 1 standard lot USDJPY pip unit scaling
  } else if (setupToExecute.symbol === 'NAS100') {
    lotMultiplier = 20; // 1 standard lot NASDAQ 100 = 20 contracts
  } else {
    lotMultiplier = 1; // 1 BTC / ETH
  }

  let calculatedLot = riskAmount / (slDistance * lotMultiplier);
  calculatedLot = Math.max(0.01, parseFloat(calculatedLot.toFixed(2)));

  // LOCK SETUP 🔒
  setupToExecute.status = 'ACTIVE';
  setupToExecute.isLocked = true;
  setupToExecute.executedAt = Date.now();
  setupToExecute.lotSize = calculatedLot;
  setupToExecute.riskAmount = riskAmount;
  setupToExecute.mode = executionMode;

  const newPos: ActivePosition = {
    id: `pos_${setupToExecute.id}_${Date.now()}`,
    setup: setupToExecute,
    currentPrice: setupToExecute.entryPrice,
    unrealizedPnL: 0.0,
    unrealizedPnLPercent: 0.0,
    distToSL: slDistance,
    distToSLPercent: parseFloat(((slDistance / setupToExecute.entryPrice) * 100).toFixed(2)),
    distToTP1: Math.abs(setupToExecute.takeProfit1 - setupToExecute.entryPrice),
    distToTP1Percent: parseFloat(((Math.abs(setupToExecute.takeProfit1 - setupToExecute.entryPrice) / setupToExecute.entryPrice) * 100).toFixed(2)),
    tradeDurationSeconds: 0,
    status: 'ACTIVE',
  };

  activePositions.push(newPos);
  activePosition = newPos;

  // Dispatch to Real Broker (Exness / OANDA / cTrader / Prop Firm) if enabled
  const brokerState = getBrokerHubState();
  if (brokerState.settings.autoTradeRealBrokers && brokerState.activeBroker !== 'NONE') {
    dispatchBrokerOrder(setupToExecute)
      .then((bRes) => {
        if (bRes.success) {
          newPos.brokerTicket = bRes.ticketId;
          newPos.brokerName = bRes.brokerName;
          newPos.brokerExecutionStatus = 'FILLED';
          newPos.brokerFillPrice = bRes.fillPrice;
        }
      })
      .catch((err) => console.warn('Broker auto-execution dispatch warning:', err));
  }

  return { success: true, message: `Trade EXECUTED & LOCKED 🔒 on ${setupToExecute.symbol} ${setupToExecute.direction}`, position: newPos };
}

/**
 * Execute Custom Trade directly from Chart Long/Short position tool
 */
export function executeCustomTrade(params: {
  symbol: MarketSymbol;
  direction: TradeDirection;
  entryPrice: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2?: number;
  takeProfit3?: number;
  riskRewardRatio?: number;
}): { success: boolean; message: string; position?: ActivePosition } {
  const { symbol, direction, entryPrice, stopLoss, takeProfit1 } = params;

  // Institutional Market Hours Rule: Traditional assets only trade Monday to Friday (Except BTCUSD/Crypto)
  if (!isMarketOpen(symbol)) {
    const status = getMarketHoursStatus(symbol);
    return {
      success: false,
      message: `Market is CLOSED for the weekend on ${symbol}. Traditional markets (Forex, Metals, Indices) only trade Monday to Friday (${status.reopensAt || 'Re-opens Sunday 21:00 UTC'}). Only BTCUSD trades 24/7.`,
    };
  }

  // Check if position already active/locked for this symbol
  const existingPos = activePositions.find((p) => p.setup.symbol === symbol);
  if (existingPos) {
    return { success: false, message: `Position already active and LOCKED 🔒 on ${symbol}. Must wait for TP or SL hit.` };
  }

  const maxAllowedTrades = riskSettings.maxOpenTrades || 5;
  if (activePositions.length >= maxAllowedTrades) {
    return { success: false, message: `Maximum open positions limit reached (${activePositions.length}/${maxAllowedTrades}).` };
  }

  const slDistance = Math.abs(entryPrice - stopLoss);
  if (slDistance <= 0) {
    return { success: false, message: 'Stop loss cannot equal entry price.' };
  }

  // Validate direction consistency
  if (direction === 'LONG' && stopLoss >= entryPrice) {
    return { success: false, message: 'For a LONG position, Stop Loss must be below Entry Price.' };
  }
  if (direction === 'SHORT' && stopLoss <= entryPrice) {
    return { success: false, message: 'For a SHORT position, Stop Loss must be above Entry Price.' };
  }
  if (direction === 'LONG' && takeProfit1 <= entryPrice) {
    return { success: false, message: 'For a LONG position, Take Profit must be above Entry Price.' };
  }
  if (direction === 'SHORT' && takeProfit1 >= entryPrice) {
    return { success: false, message: 'For a SHORT position, Take Profit must be below Entry Price.' };
  }

  const tpDistance = Math.abs(takeProfit1 - entryPrice);
  const rrRatio = params.riskRewardRatio || parseFloat((tpDistance / slDistance).toFixed(2));

  // Risk management check
  const riskAmount = (riskSettings.accountBalance * riskSettings.maxRiskPerTradePercent) / 100;
  const maxAllowedDailyLoss = (riskSettings.accountBalance * riskSettings.maxDailyLossPercent) / 100;
  if (riskSettings.dailyRealizedPnL <= -maxAllowedDailyLoss) {
    return {
      success: false,
      message: `Risk Management Limit Exceeded: Daily drawdown limit of -${riskSettings.maxDailyLossPercent}% ($${maxAllowedDailyLoss.toFixed(2)}) reached. Trading halted today.`,
    };
  }

  let lotMultiplier = 1;
  if (symbol === 'XAUUSD') {
    lotMultiplier = 100;
  } else if (
    symbol === 'EURUSD' ||
    symbol === 'GBPUSD' ||
    symbol === 'AUDUSD' ||
    symbol === 'USDCAD' ||
    symbol === 'USDCHF' ||
    symbol === 'NZDUSD'
  ) {
    lotMultiplier = 100000;
  } else if (symbol === 'USDJPY') {
    lotMultiplier = 1000;
  } else if (symbol === 'NAS100') {
    lotMultiplier = 20;
  } else {
    lotMultiplier = 1;
  }

  let calculatedLot = riskAmount / (slDistance * lotMultiplier);
  calculatedLot = Math.max(0.01, parseFloat(calculatedLot.toFixed(2)));

  const isForex =
    symbol === 'EURUSD' ||
    symbol === 'GBPUSD' ||
    symbol === 'AUDUSD' ||
    symbol === 'USDCAD' ||
    symbol === 'USDCHF' ||
    symbol === 'NZDUSD';
  const isJPY = symbol === 'USDJPY';
  const decimals = isForex ? 4 : isJPY ? 3 : 2;

  const newSetup: TradeSetup = {
    id: `setup_${Date.now()}_custom`,
    symbol,
    direction,
    entryPrice: parseFloat(entryPrice.toFixed(decimals)),
    stopLoss: parseFloat(stopLoss.toFixed(decimals)),
    takeProfit1: parseFloat(takeProfit1.toFixed(decimals)),
    takeProfit2: params.takeProfit2 ? parseFloat(params.takeProfit2.toFixed(decimals)) : parseFloat((entryPrice + (direction === 'LONG' ? 1 : -1) * slDistance * 2.5).toFixed(decimals)),
    takeProfit3: params.takeProfit3 ? parseFloat(params.takeProfit3.toFixed(decimals)) : parseFloat((entryPrice + (direction === 'LONG' ? 1 : -1) * slDistance * 3.5).toFixed(decimals)),
    tp1Label: direction === 'LONG' ? '🎯 Buy-Side Liquidity (BSL) Pool Target' : '🎯 Sell-Side Liquidity (SSL) Pool Target',
    tp2Label: direction === 'LONG' ? '🎯 Unmitigated Bearish Order Block Supply' : '🎯 Unmitigated Bullish Order Block Demand',
    tp3Label: '🎯 Macro High-Timeframe Range Liquidity Pool',
    tp1TargetType: 'LIQUIDITY_POOL',
    tp2TargetType: 'UNMITIGATED_OB',
    tp3TargetType: 'SESSION_LIQUIDITY',
    riskRewardRatio: rrRatio,
    confidenceScore: 90,
    status: 'ACTIVE',
    isLocked: true,
    aiExplanation: `Trader executed ${direction} position on ${symbol} with ${rrRatio}:1 Risk/Reward ratio targeting institutional liquidity at ${takeProfit1.toFixed(decimals)}. Entry: ${entryPrice.toFixed(decimals)}, SL: ${stopLoss.toFixed(decimals)}, TP1: ${takeProfit1.toFixed(decimals)}.`,
    smcBreakdown: {
      higherTimeframeTrend: direction === 'LONG' ? 'Bullish Structure Alignment' : 'Bearish Structure Alignment',
      liquiditySweep: 'Executed via Institutional SMC Liquidity Target Tool',
      structureBreak: `${direction} Break of Structure targeted`,
      orderBlockReaction: 'SMC Key Level Reaction confirmed',
      fvgConfirmation: 'Value Area / Imbalance alignment',
      priceActionTrigger: `Chart Position Tool: E ${entryPrice.toFixed(decimals)}`,
      takeProfitThesis: direction === 'LONG'
        ? `Targeting Buy-Side Liquidity (BSL) resting above swing highs at ${takeProfit1.toFixed(decimals)} and unmitigated supply overhead.`
        : `Targeting Sell-Side Liquidity (SSL) resting below swing lows at ${takeProfit1.toFixed(decimals)} and unmitigated demand below.`,
    },
    multiTimeframe: {
      higherTimeframe: { timeframe: '4H', trend: direction === 'LONG' ? 'BULLISH' : 'BEARISH', majorStructure: 'Higher Structure', majorLiquidity: 'Target Liquidity', keyOrderBlock: 'Active Zone' },
      entryTimeframe: { timeframe: '15M', confirmation: 'CONFIRMED', chochDetected: true, bosDetected: true, liquiditySwept: true, priceActionConfirmation: 'Confirmed' },
    },
    lotSize: calculatedLot,
    riskAmount,
    mode: executionMode,
    createdAt: Date.now(),
    executedAt: Date.now(),
  };

  currentSetup = newSetup;
  const newPosition: ActivePosition = {
    id: `pos_${newSetup.id}`,
    setup: newSetup,
    currentPrice: newSetup.entryPrice,
    unrealizedPnL: 0.0,
    unrealizedPnLPercent: 0.0,
    distToSL: slDistance,
    distToSLPercent: parseFloat(((slDistance / newSetup.entryPrice) * 100).toFixed(2)),
    distToTP1: tpDistance,
    distToTP1Percent: parseFloat(((tpDistance / newSetup.entryPrice) * 100).toFixed(2)),
    tradeDurationSeconds: 0,
    status: 'ACTIVE',
  };

  activePositions.push(newPosition);
  activePosition = newPosition;

  // Dispatch to Real Broker (Exness / OANDA / cTrader / Prop Firm) if enabled
  const brokerState = getBrokerHubState();
  if (brokerState.settings.autoTradeRealBrokers && brokerState.activeBroker !== 'NONE') {
    dispatchBrokerOrder(newSetup)
      .then((bRes) => {
        if (bRes.success) {
          newPosition.brokerTicket = bRes.ticketId;
          newPosition.brokerName = bRes.brokerName;
          newPosition.brokerExecutionStatus = 'FILLED';
          newPosition.brokerFillPrice = bRes.fillPrice;
        }
      })
      .catch((err) => console.warn('Broker custom execution dispatch warning:', err));
  }

  return { success: true, message: `Trade EXECUTED & LOCKED 🔒 on ${newSetup.symbol} ${newSetup.direction}`, position: newPosition };
}

/**
 * Monitor active positions with real live market price
 * Updates P/L across all active positions, checks TP/SL hits
 */
export function updateActivePositionPrice(symbolPrices: Record<MarketSymbol, MarketPriceData>): ActivePosition | null {
  if (activePositions.length === 0) {
    activePosition = null;
    return null;
  }

  const positionsToClose: { pos: ActivePosition; reason: 'TAKE_PROFIT' | 'STOP_LOSS'; price: number }[] = [];

  for (const pos of activePositions) {
    const symbol = pos.setup.symbol;
    const priceData = symbolPrices[symbol];
    if (!priceData) continue;

    const livePrice = priceData.price;
    pos.currentPrice = livePrice;
    pos.tradeDurationSeconds = Math.floor((Date.now() - (pos.setup.executedAt || Date.now())) / 1000);

    const entry = pos.setup.entryPrice;
    const sl = pos.setup.stopLoss;
    const tp1 = pos.setup.takeProfit1;
    const dir = pos.setup.direction;

    let lotMultiplier = 1;
    if (symbol === 'XAUUSD') lotMultiplier = 100;
    else if (symbol === 'EURUSD' || symbol === 'GBPUSD') lotMultiplier = 100000;

    // Real-time P&L calculation
    let pnlPoints = 0;
    if (dir === 'LONG') {
      pnlPoints = livePrice - entry;
    } else {
      pnlPoints = entry - livePrice;
    }

    const pnlDollars = pnlPoints * pos.setup.lotSize * lotMultiplier;
    const pnlPercent = (pnlDollars / riskSettings.accountBalance) * 100;

    pos.unrealizedPnL = parseFloat(pnlDollars.toFixed(2));
    pos.unrealizedPnLPercent = parseFloat(pnlPercent.toFixed(2));

    // Distances to SL and TP
    if (dir === 'LONG') {
      pos.distToSL = parseFloat((livePrice - sl).toFixed(4));
      pos.distToTP1 = parseFloat((tp1 - livePrice).toFixed(4));
    } else {
      pos.distToSL = parseFloat((sl - livePrice).toFixed(4));
      pos.distToTP1 = parseFloat((livePrice - tp1).toFixed(4));
    }

    // Check Take Profit or Stop Loss hit
    if (dir === 'LONG') {
      if (livePrice >= tp1) positionsToClose.push({ pos, reason: 'TAKE_PROFIT', price: livePrice });
      else if (livePrice <= sl) positionsToClose.push({ pos, reason: 'STOP_LOSS', price: livePrice });
    } else {
      if (livePrice <= tp1) positionsToClose.push({ pos, reason: 'TAKE_PROFIT', price: livePrice });
      else if (livePrice >= sl) positionsToClose.push({ pos, reason: 'STOP_LOSS', price: livePrice });
    }
  }

  // Close triggered positions
  for (const item of positionsToClose) {
    closeActivePosition(item.reason, item.price, item.pos.setup.symbol);
  }

  activePosition = activePositions[0] || null;
  return activePosition;
}

/**
 * Close active position by symbol (or first position) and record trade history
 */
export function closeActivePosition(
  reason: 'TAKE_PROFIT' | 'STOP_LOSS' | 'MANUAL',
  exitPrice?: number,
  targetSymbol?: MarketSymbol
): TradeSetup | null {
  if (activePositions.length === 0) return null;

  const posToClose = targetSymbol
    ? activePositions.find((p) => p.setup.symbol === targetSymbol) || activePositions[0]
    : activePositions[0];

  if (!posToClose) return null;

  const trade = posToClose.setup;
  const actualExitPrice = exitPrice !== undefined ? exitPrice : posToClose.currentPrice;
  trade.exitPrice = actualExitPrice;
  trade.closedAt = Date.now();
  trade.closeReason = reason;

  const dir = trade.direction;
  let lotMultiplier = 1;
  if (trade.symbol === 'XAUUSD') lotMultiplier = 100;
  else if (trade.symbol === 'EURUSD' || trade.symbol === 'GBPUSD') lotMultiplier = 100000;

  let pnlPoints = 0;
  if (dir === 'LONG') {
    pnlPoints = actualExitPrice - trade.entryPrice;
  } else {
    pnlPoints = trade.entryPrice - actualExitPrice;
  }

  const finalPnL = parseFloat((pnlPoints * trade.lotSize * lotMultiplier).toFixed(2));
  trade.profitAmount = finalPnL;
  trade.profitPercent = parseFloat(((finalPnL / riskSettings.accountBalance) * 100).toFixed(2));
  trade.outcome = finalPnL >= 0 ? 'WIN' : 'LOSS';

  if (reason === 'TAKE_PROFIT') {
    trade.status = 'TAKE_PROFIT_HIT';
  } else if (reason === 'STOP_LOSS') {
    trade.status = 'STOP_LOSS_HIT';
  } else {
    trade.status = 'MANUALLY_CLOSED';
  }

  trade.isLocked = false;

  // Dispatch close to real broker if active
  const brokerState = getBrokerHubState();
  if (brokerState.settings.autoTradeRealBrokers && brokerState.activeBroker !== 'NONE') {
    dispatchBrokerClose(posToClose).catch((err) => console.warn('Broker close dispatch warning:', err));
  }

  // Update account balance and daily realized PnL
  riskSettings.accountBalance = parseFloat((riskSettings.accountBalance + finalPnL).toFixed(2));
  riskSettings.dailyRealizedPnL = parseFloat((riskSettings.dailyRealizedPnL + finalPnL).toFixed(2));

  // Add to trade history
  tradeHistory.unshift({ ...trade });

  // Remove from active positions
  activePositions = activePositions.filter((p) => p.id !== posToClose.id);
  activePosition = activePositions[0] || null;

  if (currentSetup && currentSetup.symbol === trade.symbol) {
    currentSetup = null;
  }

  // Notify registered listeners (e.g. Auto-Trader for autonomous cooldown and next scan)
  tradeClosedListeners.forEach((listener) => {
    try {
      listener(trade, reason);
    } catch (err) {
      console.warn('Trade closed listener callback error:', err);
    }
  });

  return trade;
}

/**
 * Adjust Active Position Stop Loss to Breakeven (0 Risk) by symbol or first position
 */
export function moveActivePositionToBreakeven(targetSymbol?: MarketSymbol): { success: boolean; position?: ActivePosition; message: string } {
  if (activePositions.length === 0) {
    return { success: false, message: 'No active position to adjust to breakeven' };
  }

  const pos = targetSymbol
    ? activePositions.find((p) => p.setup.symbol === targetSymbol) || activePositions[0]
    : activePositions[0];

  if (!pos) {
    return { success: false, message: 'No matching active position found' };
  }

  pos.setup.stopLoss = pos.setup.entryPrice;

  // Dispatch Stop Loss update to Real Broker (Exness / OANDA / cTrader / Prop Firm)
  const brokerState = getBrokerHubState();
  if (brokerState.settings.autoTradeRealBrokers && brokerState.activeBroker !== 'NONE') {
    dispatchBrokerBreakeven(pos).catch((err) => console.warn('Broker breakeven dispatch warning:', err));
  }

  // Recalculate distance to Stop Loss
  const livePrice = pos.currentPrice;
  if (pos.setup.direction === 'LONG') {
    pos.distToSL = parseFloat((livePrice - pos.setup.stopLoss).toFixed(4));
  } else {
    pos.distToSL = parseFloat((pos.setup.stopLoss - livePrice).toFixed(4));
  }

  return {
    success: true,
    position: pos,
    message: `Stop Loss on ${pos.setup.symbol} moved to Breakeven @ ${pos.setup.entryPrice} (Zero Risk Locked)`,
  };
}

/**
 * Calculate professional trading performance statistics
 */
export function calculateTradingStats(): TradingStats {
  const totalTrades = tradeHistory.length;
  if (totalTrades === 0) {
    return {
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      totalProfitLoss: 0,
      avgRiskReward: 0,
      profitFactor: 0,
    };
  }

  const wins = tradeHistory.filter((t) => t.outcome === 'WIN');
  const losses = tradeHistory.filter((t) => t.outcome === 'LOSS');
  const winRate = parseFloat(((wins.length / totalTrades) * 100).toFixed(1));

  const totalPnL = tradeHistory.reduce((acc, t) => acc + (t.profitAmount || 0), 0);
  const totalWinAmount = wins.reduce((acc, t) => acc + (t.profitAmount || 0), 0);
  const totalLossAmount = Math.abs(losses.reduce((acc, t) => acc + (t.profitAmount || 0), 0));

  const profitFactor = totalLossAmount > 0 ? parseFloat((totalWinAmount / totalLossAmount).toFixed(2)) : totalWinAmount > 0 ? 99.9 : 1.0;
  const avgRR = parseFloat((tradeHistory.reduce((acc, t) => acc + t.riskRewardRatio, 0) / totalTrades).toFixed(2));

  return {
    totalTrades,
    winningTrades: wins.length,
    losingTrades: losses.length,
    winRate,
    totalProfitLoss: parseFloat(totalPnL.toFixed(2)),
    avgRiskReward: avgRR,
    profitFactor,
  };
}

/**
 * Set execution mode (PAPER vs LIVE)
 */
export function setExecutionMode(mode: ExecutionMode) {
  executionMode = mode;
}

// Trade closed notification listeners
export type TradeClosedListener = (trade: TradeSetup, reason: 'TAKE_PROFIT' | 'STOP_LOSS' | 'MANUAL') => void;
const tradeClosedListeners: TradeClosedListener[] = [];

export function registerTradeClosedListener(listener: TradeClosedListener) {
  tradeClosedListeners.push(listener);
}

/**
 * Set approval mode (MANUAL vs AUTO)
 */
export function setTradeApprovalMode(mode: TradeApprovalMode) {
  tradeApprovalMode = mode;
}

export function getTradeApprovalMode(): TradeApprovalMode {
  return tradeApprovalMode;
}

/**
 * Update risk settings
 */
export function updateRiskSettings(newSettings: Partial<RiskSettings>) {
  riskSettings = { ...riskSettings, ...newSettings };
  return riskSettings;
}

/**
 * Reset Paper Trading Account balance
 */
export function resetPaperAccount(initialBalance: number = 50000.0) {
  riskSettings.accountBalance = initialBalance;
  riskSettings.dailyRealizedPnL = 0.0;
  activePosition = null;
  currentSetup = null;
  return riskSettings;
}

/**
 * Handle TradingView Alert Webhook
 */
export function handleTradingViewWebhook(payload: any, secretHeader: string | undefined): { success: boolean; message: string } {
  const expectedSecret = process.env.TRADINGVIEW_WEBHOOK_SECRET || 'smc_alpha_tv_secret_token';

  const logEntry: WebhookLog = {
    id: `hook_${Date.now()}`,
    timestamp: Date.now(),
    symbol: payload?.symbol || 'UNKNOWN',
    action: payload?.direction || payload?.action || 'ALERT',
    status: 'SUCCESS',
    message: '',
    payload,
  };

  // 1. Secret authentication token validation
  const providedSecret = payload?.secret || secretHeader;
  if (providedSecret !== expectedSecret) {
    logEntry.status = 'INVALID_TOKEN';
    logEntry.message = 'Unauthorized: Invalid TradingView webhook secret token.';
    webhookLogs.unshift(logEntry);
    return { success: false, message: logEntry.message };
  }

  // 2. Validate payload fields
  const symbol = (payload.symbol || '').toUpperCase() as MarketSymbol;
  const direction = (payload.direction || payload.action || '').toUpperCase() as 'LONG' | 'SHORT';
  const entryPrice = parseFloat(payload.entry || payload.price);
  const stopLoss = parseFloat(payload.stopLoss || payload.sl);
  const takeProfit = parseFloat(payload.takeProfit || payload.tp);

  if (!symbol || !direction || isNaN(entryPrice) || isNaN(stopLoss) || isNaN(takeProfit)) {
    logEntry.status = 'REJECTED';
    logEntry.message = 'Missing or invalid fields (symbol, direction, entry, stopLoss, takeProfit required).';
    webhookLogs.unshift(logEntry);
    return { success: false, message: logEntry.message };
  }

  // 3. Active locked trade check (Rule 7)
  const isSymbolLocked = activePositions.some((p) => p.setup.symbol === symbol && p.setup.isLocked);
  if (isSymbolLocked) {
    logEntry.status = 'REJECTED';
    logEntry.message = `Active position on ${symbol} is currently LOCKED 🔒. Webhook signal discarded to prevent contradictory churn.`;
    webhookLogs.unshift(logEntry);
    return { success: false, message: logEntry.message };
  }

  // 4. Create and execute the setup
  const risk = Math.abs(entryPrice - stopLoss);
  const reward = Math.abs(takeProfit - entryPrice);
  const rr = parseFloat((reward / (risk || 1)).toFixed(2));

  const webhookSetup: TradeSetup = {
    id: `tv_hook_${Date.now()}`,
    symbol,
    direction,
    entryPrice,
    stopLoss,
    takeProfit1: takeProfit,
    takeProfit2: parseFloat((direction === 'LONG' ? entryPrice + risk * 3 : entryPrice - risk * 3).toFixed(4)),
    takeProfit3: parseFloat((direction === 'LONG' ? entryPrice + risk * 4.5 : entryPrice - risk * 4.5).toFixed(4)),
    riskRewardRatio: rr,
    confidenceScore: 90,
    status: 'PENDING_APPROVAL',
    isLocked: false,
    aiExplanation: `Signal received via verified TradingView Webhook alert from institutional strategy script. Symbol: ${symbol}, Direction: ${direction}, Risk-to-Reward: 1:${rr}.`,
    smcBreakdown: {
      higherTimeframeTrend: 'TradingView Pine Script Structure Confirmation',
      liquiditySweep: 'Pine Script automated liquidity run trigger',
      structureBreak: 'TradingView BOS alert fired',
      orderBlockReaction: 'TradingView OB indicator trigger',
      fvgConfirmation: 'Verified FVG confluence',
      priceActionTrigger: 'Pine Script bar execution confirmed',
    },
    multiTimeframe: {
      higherTimeframe: { timeframe: '4H', trend: direction === 'LONG' ? 'BULLISH' : 'BEARISH', majorStructure: 'Pine Strategy Trend', majorLiquidity: 'Pine Target', keyOrderBlock: 'Alert Trigger OB' },
      entryTimeframe: { timeframe: '15M', confirmation: 'CONFIRMED', chochDetected: true, bosDetected: true, liquiditySwept: true, priceActionConfirmation: 'Alert Verified' },
    },
    lotSize: 0.1,
    riskAmount: (riskSettings.accountBalance * riskSettings.maxRiskPerTradePercent) / 100,
    mode: executionMode,
    createdAt: Date.now(),
  };

  currentSetup = webhookSetup;

  if (tradeApprovalMode === 'AUTO') {
    executeTrade(webhookSetup.id);
    logEntry.message = `Successfully received and auto-executed TradingView alert for ${symbol} ${direction}.`;
  } else {
    logEntry.message = `Successfully received TradingView alert for ${symbol} ${direction}. Awaiting manual approval.`;
  }

  webhookLogs.unshift(logEntry);
  return { success: true, message: logEntry.message };
}
