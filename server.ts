import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import {
  detectSmartMoneyConcepts,
  getSymbolCandles,
  updateRealMarketPrices,
} from './server/marketData.js';
import { getOandaStatus } from './server/oandaClient.js';
import { runAIDecisionEngine } from './server/aiDecisionEngine.js';
import {
  closeActivePosition,
  executeCustomTrade,
  executeTrade,
  getSystemState,
  handleTradingViewWebhook,
  moveActivePositionToBreakeven,
  resetPaperAccount,
  setExecutionMode,
  setProposedSetup,
  setTradeApprovalMode,
  updateActivePositionPrice,
  updateRiskSettings,
} from './server/executionEngine.js';
import {
  disconnectExness,
  disconnectMetaMaskWallet,
  generateExnessMQL5Script,
  getBrokerHubState,
  getPendingActionsForAccount,
  getPendingSignalForAccount,
  recordOrderFilled,
  syncExnessFromEA,
  updateBrokerSettings,
  updateExnessConfig,
  updateMetaMaskWallet,
  updateOtherBrokerConfig,
} from './server/brokerManager.js';
import {
  getAutoTraderState,
  runAutoTraderCycle,
  setAutoTraderEnabled,
  triggerImmediateAutoScan,
  updateAutoTraderSettings,
  resetDailySetupLimit,
  updateSetupLimit,
} from './server/autoTrader.js';
import { MarketSymbol } from './src/types.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());

// Background interval to refresh live market prices, monitor locked active positions, and run Auto-Trader
setInterval(async () => {
  try {
    const prices = await updateRealMarketPrices();
    updateActivePositionPrice(prices);
    await runAutoTraderCycle();
  } catch (err) {
    console.error('Background price monitor & Auto-Trader error:', err);
  }
}, 2000);

// API Routes FIRST

// 1. Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// 1.1 OANDA Broker Configuration & Status
app.get('/api/oanda/status', (req, res) => {
  res.json(getOandaStatus());
});

// 1.2 Broker Hub State & Real Account Management
app.get('/api/broker/hub', (req, res) => {
  res.json(getBrokerHubState());
});

// 1.3 Update Broker Execution Settings (Auto-Trade Master Switch, Suffix, Max Lot)
app.post('/api/broker/settings', (req, res) => {
  const updated = updateBrokerSettings(req.body);
  res.json({ success: true, settings: updated });
});

// 1.4 Connect / Test Exness Account
app.post('/api/broker/exness/connect', async (req, res) => {
  try {
    const result = await updateExnessConfig(req.body);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message || 'Exness connection failed' });
  }
});

// 1.41 Disconnect Exness Account
app.post('/api/broker/exness/disconnect', (req, res) => {
  const result = disconnectExness();
  res.json(result);
});

// 1.42 EA Heartbeat & Live Balance Sync
app.post('/api/broker/ea-heartbeat', (req, res) => {
  const result = syncExnessFromEA(req.body);
  res.json(result);
});

// 1.5 Update Other Brokers (OANDA, cTrader, Prop Firms, MetaMask)
app.post('/api/broker/other/update', (req, res) => {
  const { type, config } = req.body;
  if (!type || !config) {
    return res.status(400).json({ error: 'type and config are required' });
  }
  const result = updateOtherBrokerConfig(type, config);
  res.json(result);
});

// 1.55 MetaMask Web3 Connect & Sync
app.post('/api/broker/metamask/connect', (req, res) => {
  const config = req.body || {};
  const result = updateMetaMaskWallet(config);
  res.json(result);
});

app.post('/api/broker/metamask/disconnect', (req, res) => {
  const result = disconnectMetaMaskWallet();
  res.json(result);
});

// 1.6 Download / Fetch Generated Exness MQL5 EA Script
app.get('/api/broker/mql5-script', (req, res) => {
  const protocol = req.protocol || 'http';
  const host = req.get('host') || `localhost:${PORT}`;
  const baseUrl = `${protocol}://${host}`;
  const script = generateExnessMQL5Script(baseUrl);
  res.json({ script, baseUrl });
});

// 1.7 Exness MetaTrader 5 (MT5) EA Signal Receptor & Heartbeat
app.get('/api/broker/ea-signal', (req, res) => {
  const account = req.query.account as string;
  const server = req.query.server as string | undefined;
  const balance = req.query.balance ? Number(req.query.balance) : undefined;
  const equity = req.query.equity ? Number(req.query.equity) : undefined;
  const leverage = req.query.leverage ? Number(req.query.leverage) : undefined;
  const currency = req.query.currency as string | undefined;
  const ping = req.query.ping ? Number(req.query.ping) : undefined;

  // If EA passes live metrics, sync them to broker manager
  if (account) {
    syncExnessFromEA({ account, server, balance, equity, leverage, currency, pingMs: ping });
  }

  // Check if there is a pending signal queued specifically for this Exness account
  const pendingSig = getPendingSignalForAccount(account);
  if (pendingSig) {
    return res.json({
      status: 'SIGNAL_ACTIVE',
      account,
      id: pendingSig.id,
      action: pendingSig.action,
      symbol: pendingSig.symbol,
      lotSize: pendingSig.lotSize,
      entryPrice: pendingSig.entryPrice,
      stopLoss: pendingSig.stopLoss,
      takeProfit: pendingSig.takeProfit1,
      timestamp: Date.now(),
    });
  }

  const state = getSystemState();
  const brokerState = getBrokerHubState();

  // If there's an active position with broker execution pending
  if (state.activePosition && brokerState.settings.autoTradeRealBrokers && brokerState.activeBroker === 'EXNESS') {
    return res.json({
      status: 'SIGNAL_ACTIVE',
      account,
      id: state.activePosition.id,
      action: state.activePosition.setup.direction === 'LONG' ? 'BUY' : 'SELL',
      symbol: state.activePosition.setup.symbol,
      lotSize: state.activePosition.setup.lotSize,
      entryPrice: state.activePosition.setup.entryPrice,
      stopLoss: state.activePosition.setup.stopLoss,
      takeProfit: state.activePosition.setup.takeProfit1,
      timestamp: Date.now(),
    });
  }

  res.json({
    status: 'IDLE',
    account,
    message: 'Exness EA Bridge Connected & Awaiting High-Confidence SMC Trigger',
    timestamp: Date.now(),
  });
});

// 1.8 MT5 Order Filled Callback from Exness EA
app.post('/api/broker/order-filled', (req, res) => {
  const { account, signalId, ticket, fillPrice, lotSize, symbol } = req.body;
  if (!account || !ticket) {
    return res.status(400).json({ error: 'account and ticket are required' });
  }

  const result = recordOrderFilled({
    account,
    signalId: signalId || '',
    ticket,
    fillPrice: Number(fillPrice || 0),
    lotSize: Number(lotSize || 0.1),
    symbol: symbol || '',
  });

  // Update active position with real Exness ticket
  const state = getSystemState();
  if (state.activePosition) {
    state.activePosition.brokerTicket = ticket;
    state.activePosition.brokerFillPrice = Number(fillPrice) || state.activePosition.currentPrice;
    state.activePosition.brokerExecutionStatus = 'FILLED';
  }
  for (const pos of state.activePositions || []) {
    if (pos.id === signalId || !pos.brokerTicket) {
      pos.brokerTicket = ticket;
      pos.brokerFillPrice = Number(fillPrice) || pos.currentPrice;
      pos.brokerExecutionStatus = 'FILLED';
    }
  }

  res.json(result);
});

// 1.9 MT5 Pending Actions (Breakeven, Close) for Exness EA
app.get('/api/broker/ea-pending-actions', (req, res) => {
  const account = req.query.account as string;
  const actions = getPendingActionsForAccount(account);
  if (actions.length > 0) {
    return res.json(actions[0]);
  }
  res.json({ status: 'NONE' });
});

// 2. Real-time Market Prices
app.get('/api/market/prices', async (req, res) => {
  try {
    const prices = await updateRealMarketPrices();
    res.json(prices);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch prices' });
  }
});

// 3. Historical Candlesticks + Smart Money Concepts Zones
app.get('/api/market/candles', async (req, res) => {
  try {
    const symbol = (req.query.symbol as MarketSymbol) || 'XAUUSD';
    const interval = (req.query.interval as string) || '15m';
    const candles = await getSymbolCandles(symbol, interval);
    const smcZones = detectSmartMoneyConcepts(symbol, candles, interval);

    res.json({
      symbol,
      interval,
      candles,
      smcZones,
      latestPrice: candles.length > 0 ? candles[candles.length - 1].close : 0,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch candles' });
  }
});

// 4. Complete System State (Active Position, Setup, Risk, Stats)
app.get('/api/system/state', (req, res) => {
  const state = getSystemState();
  res.json(state);
});

// 5. Trigger AI Decision Engine (Multi-timeframe & SMC Analysis)
app.post('/api/ai/analyze', async (req, res) => {
  try {
    const symbol = (req.body.symbol as MarketSymbol) || 'XAUUSD';
    const interval = (req.body.interval as string) || '15m';

    const prices = await updateRealMarketPrices();
    const currentPriceData = prices[symbol];
    const candles = await getSymbolCandles(symbol, interval);
    const zones = detectSmartMoneyConcepts(symbol, candles, interval);

    const systemState = getSystemState();
    const isSymbolLocked = Boolean(
      (systemState.activePositions || []).some((p) => p.setup.symbol === symbol && p.setup.isLocked) ||
      (systemState.activePosition?.setup.symbol === symbol && systemState.activePosition.setup.isLocked)
    );

    if (isSymbolLocked) {
      return res.json({
        setup: null,
        message: `Active trade on ${symbol} is currently LOCKED 🔒. Continuous monitoring in progress until Take Profit or Stop Loss is reached.`,
        isLocked: true,
      });
    }

    const setup = await runAIDecisionEngine(symbol, currentPriceData, candles, zones, isSymbolLocked, 68, false, interval);
    setProposedSetup(setup);

    res.json({
      setup,
      message: setup ? `Valid ${setup.direction} setup detected on ${symbol}` : 'No high-probability SMC setup found. Market currently ranging or awaiting liquidity sweep.',
      isLocked: false,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'AI Analysis failed' });
  }
});

// 6. Execute Trade (Lock the Setup 🔒)
app.post('/api/trade/execute', (req, res) => {
  const { setupId } = req.body;
  if (!setupId) {
    return res.status(400).json({ error: 'setupId is required' });
  }

  const result = executeTrade(setupId);
  if (!result.success) {
    return res.status(400).json(result);
  }

  res.json(result);
});

// 6.1 Execute Custom Long/Short Trade directly from Chart
app.post('/api/trade/execute-custom', (req, res) => {
  const { symbol, direction, entryPrice, stopLoss, takeProfit1, takeProfit2, takeProfit3, riskRewardRatio } = req.body;
  if (!symbol || !direction || entryPrice == null || stopLoss == null || takeProfit1 == null) {
    return res.status(400).json({ error: 'Missing required parameters: symbol, direction, entryPrice, stopLoss, takeProfit1' });
  }

  const result = executeCustomTrade({
    symbol,
    direction,
    entryPrice: Number(entryPrice),
    stopLoss: Number(stopLoss),
    takeProfit1: Number(takeProfit1),
    takeProfit2: takeProfit2 != null ? Number(takeProfit2) : undefined,
    takeProfit3: takeProfit3 != null ? Number(takeProfit3) : undefined,
    riskRewardRatio: riskRewardRatio != null ? Number(riskRewardRatio) : undefined,
  });

  if (!result.success) {
    return res.status(400).json(result);
  }

  res.json(result);
});

// 7. Manually Close Active Trade (Supports closing by symbol when multiple positions active)
app.post('/api/trade/close', (req, res) => {
  const symbol = req.body?.symbol as MarketSymbol | undefined;
  const closedTrade = closeActivePosition('MANUAL', undefined, symbol);
  if (!closedTrade) {
    return res.status(400).json({ error: 'No active position to close' });
  }

  res.json({ success: true, message: `Position on ${closedTrade.symbol} closed manually`, trade: closedTrade });
});

// 7.1 Move Active Position to Breakeven (0 Risk)
app.post('/api/trade/breakeven', (req, res) => {
  const symbol = req.body?.symbol as MarketSymbol | undefined;
  const result = moveActivePositionToBreakeven(symbol);
  if (!result.success) {
    return res.status(400).json(result);
  }

  res.json(result);
});

// 8. Toggle Execution Mode (PAPER vs LIVE)
app.post('/api/trade/mode', (req, res) => {
  const { mode } = req.body;
  if (mode === 'PAPER' || mode === 'LIVE') {
    setExecutionMode(mode);
    res.json({ success: true, mode });
  } else {
    res.status(400).json({ error: 'Invalid mode' });
  }
});

// 9. Toggle Trade Approval Mode (MANUAL vs AUTO)
app.post('/api/trade/approval-mode', (req, res) => {
  const { approvalMode } = req.body;
  if (approvalMode === 'MANUAL' || approvalMode === 'AUTO') {
    setTradeApprovalMode(approvalMode);
    setAutoTraderEnabled(approvalMode === 'AUTO');
    res.json({ success: true, approvalMode, autoTrader: getAutoTraderState() });
  } else {
    res.status(400).json({ error: 'Invalid approvalMode' });
  }
});

// 9.1 Auto-Trader Status and Control API
app.get('/api/autotrader/status', (req, res) => {
  res.json({ success: true, state: getAutoTraderState() });
});

app.post('/api/autotrader/toggle', (req, res) => {
  const enabled = Boolean(req.body.enabled);
  const state = setAutoTraderEnabled(enabled);
  res.json({ success: true, state });
});

app.post('/api/autotrader/scan-now', async (req, res) => {
  try {
    const symbol = req.body.symbol as MarketSymbol | undefined;
    const result = await triggerImmediateAutoScan(symbol);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Auto-scan failed' });
  }
});

app.post('/api/autotrader/settings', (req, res) => {
  const { scanIntervalSeconds, watchlist, maxSetupsLimit, minConfidenceThreshold, minRiskReward } = req.body;
  const state = updateAutoTraderSettings({ scanIntervalSeconds, watchlist, maxSetupsLimit, minConfidenceThreshold, minRiskReward });
  res.json({ success: true, state });
});

app.post('/api/autotrader/reset-limit', (req, res) => {
  const state = resetDailySetupLimit();
  res.json({ success: true, state });
});

app.post('/api/autotrader/set-limit', (req, res) => {
  const limit = Number(req.body.limit) || 3;
  const state = updateSetupLimit(limit);
  res.json({ success: true, state });
});

// 10. Update Risk Management Settings
app.post('/api/risk/settings', (req, res) => {
  const updated = updateRiskSettings(req.body);
  res.json({ success: true, riskSettings: updated });
});

// 11. Reset Paper Trading Account
app.post('/api/paper/reset', (req, res) => {
  const balance = req.body.balance || 50000;
  const updated = resetPaperAccount(balance);
  res.json({ success: true, message: 'Paper trading account reset', riskSettings: updated });
});

// 12. TradingView Alert Webhook Endpoint
app.post('/api/webhook/tradingview', (req, res) => {
  const secretHeader = req.headers['x-tradingview-secret'] as string | undefined;
  const result = handleTradingViewWebhook(req.body, secretHeader);
  if (!result.success) {
    return res.status(400).json(result);
  }
  res.json(result);
});

// 13. Server-Sent Events (SSE) Live Feed
app.get('/api/stream', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendEvent = async () => {
    try {
      const prices = await updateRealMarketPrices();
      updateActivePositionPrice(prices);
      const state = getSystemState();
      const autotrader = getAutoTraderState();

      res.write(`data: ${JSON.stringify({ prices, state, autotrader, timestamp: Date.now() })}\n\n`);
    } catch (e) {
      // client disconnected
    }
  };

  sendEvent();
  // Fast 250ms cadence (4 ticks/second) matching real-time TradingView & MT5 market feeds
  const intervalId = setInterval(sendEvent, 250);

  req.on('close', () => {
    clearInterval(intervalId);
  });
});

// Vite Middleware for development & static serving in production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SMC Alpha Trading Platform backend listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
