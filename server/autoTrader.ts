import { MarketSymbol, TradeSetup, CandleData, SMCZone, WaitingConfirmationDetails, AssetAnalysisSummary, ActivePosition } from '../src/types.js';
import {
  getSystemState,
  setProposedSetup,
  executeTrade,
  setTradeApprovalMode,
  getTradeApprovalMode,
  registerTradeClosedListener,
} from './executionEngine.js';
import { updateRealMarketPrices, getSymbolCandles, detectSmartMoneyConcepts } from './marketData.js';
import { runAIDecisionEngine, evaluateConfirmationDetails } from './aiDecisionEngine.js';
import { isMarketOpen, getMarketHoursStatus, isGlobalWeekend } from '../src/utils/marketHours.js';

export interface AutoTraderLogEntry {
  id: string;
  timestamp: number;
  action: 'SCAN' | 'ENTRY_FOUND' | 'AUTO_EXECUTE' | 'TP_HIT' | 'SL_HIT' | 'COOLDOWN' | 'STATUS_CHANGE' | 'LIMIT_REACHED' | 'WAITING_CONFIRMATION';
  symbol: MarketSymbol;
  message: string;
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

const DEFAULT_WATCHLIST: MarketSymbol[] = [
  'BTCUSD',
  'XAUUSD',
  'EURUSD',
  'GBPUSD',
  'NAS100',
  'USDJPY',
  'AUDUSD',
  'USDCAD',
  'USDCHF',
  'NZDUSD',
  'ETHUSD',
];

let autoTraderState: AutoTraderState = {
  enabled: true,
  status: 'SCANNING',
  currentScanningSymbol: 'BTCUSD',
  watchlist: [...DEFAULT_WATCHLIST],
  scanIndex: 0,
  lastScanTime: 0,
  nextScanInSeconds: 0,
  scanIntervalSeconds: 3,
  statusMessage: 'Autonomous Bot ACTIVE ⚡. Scanning all assets to automatically execute the best SMC & Price Action setup...',
  totalAutoTrades: 0,
  cooldownUntil: 0,
  lastExecutedSetup: null,
  maxSetupsLimit: 10,
  todaySetupsCount: 0,
  limitReached: false,
  minConfidenceThreshold: 65,
  minRiskReward: 1.5,
  waitingDetails: null,
  activeAssetCooldowns: {},
  lastLimitNotificationTime: 0,
  allAssetSetups: {},
  allAssetAnalyses: {},
  bestCandidateSymbol: null,
  bestCandidateScore: 0,
  activePositions: [],
  activePositionsCount: 0,
  recentLogs: [],
};

let isProcessingCycle = false;

function addLog(action: AutoTraderLogEntry['action'], symbol: MarketSymbol, message: string) {
  const entry: AutoTraderLogEntry = {
    id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    timestamp: Date.now(),
    action,
    symbol,
    message,
  };
  if (!autoTraderState.recentLogs) {
    autoTraderState.recentLogs = [];
  }
  autoTraderState.recentLogs.unshift(entry);
  if (autoTraderState.recentLogs.length > 30) {
    autoTraderState.recentLogs = autoTraderState.recentLogs.slice(0, 30);
  }
}

/**
 * Get current snapshot of Auto-Trader state
 */
export function getAutoTraderState(): AutoTraderState {
  const approvalMode = getTradeApprovalMode();
  autoTraderState.enabled = approvalMode === 'AUTO';

  // Check setup limit status
  autoTraderState.limitReached = autoTraderState.todaySetupsCount >= autoTraderState.maxSetupsLimit;

  const systemState = getSystemState();
  const currentActivePositions = systemState.activePositions || (systemState.activePosition ? [systemState.activePosition] : []);
  autoTraderState.activePositions = currentActivePositions;
  autoTraderState.activePositionsCount = currentActivePositions.length;

  const maxAllowed = systemState.riskSettings.maxOpenTrades || 5;

  if (!autoTraderState.enabled) {
    autoTraderState.status = 'IDLE';
    autoTraderState.nextScanInSeconds = 0;
  } else if (autoTraderState.limitReached) {
    autoTraderState.status = 'SETUP_LIMIT_REACHED';
    autoTraderState.nextScanInSeconds = 0;
    autoTraderState.statusMessage = `🛑 SETUP LIMIT REACHED (${autoTraderState.todaySetupsCount}/${autoTraderState.maxSetupsLimit} trades executed). Auto-trading paused to protect capital & avoid overtrading.`;
  } else if (currentActivePositions.length >= maxAllowed) {
    autoTraderState.status = 'LOCKED_WAITING_TP_SL';
    autoTraderState.nextScanInSeconds = 0;
  } else if (Date.now() < autoTraderState.cooldownUntil) {
    autoTraderState.status = 'COOLDOWN';
    autoTraderState.nextScanInSeconds = Math.ceil((autoTraderState.cooldownUntil - Date.now()) / 1000);
  } else if (autoTraderState.status === 'WAITING_CONFIRMATION') {
    const elapsed = (Date.now() - autoTraderState.lastScanTime) / 1000;
    autoTraderState.nextScanInSeconds = Math.max(0, Math.ceil(autoTraderState.scanIntervalSeconds - elapsed));
  } else {
    const elapsed = (Date.now() - autoTraderState.lastScanTime) / 1000;
    autoTraderState.nextScanInSeconds = Math.max(0, Math.ceil(autoTraderState.scanIntervalSeconds - elapsed));
  }

  return { ...autoTraderState };
}

/**
 * Reset daily setup limit counter to resume trading
 */
export function resetDailySetupLimit(): AutoTraderState {
  autoTraderState.todaySetupsCount = 0;
  autoTraderState.limitReached = false;
  autoTraderState.status = 'SCANNING';
  autoTraderState.statusMessage = `Setup limit counter reset (0/${autoTraderState.maxSetupsLimit}). Patiently scanning for high-probability confirmed SMC setups...`;
  addLog('STATUS_CHANGE', autoTraderState.currentScanningSymbol, `Daily trade counter reset to 0/${autoTraderState.maxSetupsLimit}. Auto-trading active.`);
  return getAutoTraderState();
}

/**
 * Update maximum setup limit
 */
export function updateSetupLimit(newLimit: number): AutoTraderState {
  if (typeof newLimit === 'number' && newLimit >= 1 && newLimit <= 50) {
    autoTraderState.maxSetupsLimit = Math.floor(newLimit);
    autoTraderState.limitReached = autoTraderState.todaySetupsCount >= autoTraderState.maxSetupsLimit;

    if (autoTraderState.limitReached) {
      autoTraderState.status = 'SETUP_LIMIT_REACHED';
      autoTraderState.statusMessage = `🛑 SETUP LIMIT REACHED (${autoTraderState.todaySetupsCount}/${autoTraderState.maxSetupsLimit} trades executed). Trading paused.`;
    } else if (autoTraderState.status === 'SETUP_LIMIT_REACHED') {
      autoTraderState.status = 'SCANNING';
      autoTraderState.statusMessage = `Setup limit updated to ${autoTraderState.maxSetupsLimit}. Resumed patient SMC scanning...`;
    }

    addLog('STATUS_CHANGE', autoTraderState.currentScanningSymbol, `Setup limit updated to ${autoTraderState.maxSetupsLimit} daily trades (Used: ${autoTraderState.todaySetupsCount}).`);
  }
  return getAutoTraderState();
}

/**
 * Toggle or set Auto-Trader enabled status
 */
export function setAutoTraderEnabled(enabled: boolean): AutoTraderState {
  autoTraderState.enabled = enabled;
  setTradeApprovalMode(enabled ? 'AUTO' : 'MANUAL');

  if (enabled) {
    if (autoTraderState.todaySetupsCount >= autoTraderState.maxSetupsLimit) {
      autoTraderState.status = 'SETUP_LIMIT_REACHED';
      autoTraderState.limitReached = true;
      autoTraderState.statusMessage = `🛑 SETUP LIMIT REACHED (${autoTraderState.todaySetupsCount}/${autoTraderState.maxSetupsLimit} trades). Increase limit or reset counter to resume.`;
      addLog('LIMIT_REACHED', autoTraderState.currentScanningSymbol, `Auto-trader enabled but daily limit reached (${autoTraderState.todaySetupsCount}/${autoTraderState.maxSetupsLimit}).`);
    } else {
      autoTraderState.status = 'SCANNING';
      autoTraderState.statusMessage = 'Auto-Trading Bot ACTIVATED ⚡. Patiently scanning markets for strictly confirmed SMC setups...';
      autoTraderState.lastScanTime = 0; // Trigger immediate first scan
      addLog('STATUS_CHANGE', autoTraderState.currentScanningSymbol, 'Auto-Trading Bot ACTIVATED ⚡ disciplined hands-free mode.');
    }
  } else {
    autoTraderState.status = 'IDLE';
    autoTraderState.statusMessage = 'Auto-Trading Bot STANDBY. Manual approval mode restored.';
    addLog('STATUS_CHANGE', autoTraderState.currentScanningSymbol, 'Auto-Trading Bot deactivated. Switched to manual mode.');
  }

  return getAutoTraderState();
}

/**
 * Configure Auto-Trader settings
 */
export function updateAutoTraderSettings(settings: {
  scanIntervalSeconds?: number;
  watchlist?: MarketSymbol[];
  maxSetupsLimit?: number;
  minConfidenceThreshold?: number;
  minRiskReward?: number;
}): AutoTraderState {
  if (settings.scanIntervalSeconds && settings.scanIntervalSeconds >= 3 && settings.scanIntervalSeconds <= 60) {
    autoTraderState.scanIntervalSeconds = settings.scanIntervalSeconds;
  }
  if (settings.watchlist && Array.isArray(settings.watchlist) && settings.watchlist.length > 0) {
    autoTraderState.watchlist = settings.watchlist;
  }
  if (settings.maxSetupsLimit && settings.maxSetupsLimit >= 1 && settings.maxSetupsLimit <= 50) {
    updateSetupLimit(settings.maxSetupsLimit);
  }
  if (settings.minConfidenceThreshold && settings.minConfidenceThreshold >= 60 && settings.minConfidenceThreshold <= 95) {
    autoTraderState.minConfidenceThreshold = settings.minConfidenceThreshold;
  }
  if (settings.minRiskReward && settings.minRiskReward >= 1.5 && settings.minRiskReward <= 5.0) {
    autoTraderState.minRiskReward = settings.minRiskReward;
  }
  return getAutoTraderState();
}

/**
 * Notify Auto-Trader that an active trade just closed (TP or SL hit)
 */
export function notifyTradeClosed(trade: TradeSetup, reason: 'TAKE_PROFIT' | 'STOP_LOSS' | 'MANUAL') {
  const pnl = trade.profitAmount !== undefined ? trade.profitAmount : 0;
  const isProfit = pnl >= 0;
  const isTp = reason === 'TAKE_PROFIT';

  const action = isTp ? 'TP_HIT' : reason === 'STOP_LOSS' ? 'SL_HIT' : 'COOLDOWN';
  const msg = `${trade.symbol} ${trade.direction} trade CLOSED by ${reason} @ ${trade.exitPrice} (${isProfit ? '+' : ''}$${pnl.toFixed(2)}). Waiting 20s cooldown before scanning next opportunity.`;

  addLog(action, trade.symbol, msg);

  // Set 20-second cooldown so market structure can reset after volatility
  autoTraderState.cooldownUntil = Date.now() + 20000;
  autoTraderState.status = 'COOLDOWN';
  autoTraderState.statusMessage = msg;

  // Apply per-asset cooldown of 5 minutes (300 seconds) so the bot doesn't spam the same asset
  if (!autoTraderState.activeAssetCooldowns) {
    autoTraderState.activeAssetCooldowns = {};
  }
  autoTraderState.activeAssetCooldowns[trade.symbol] = Date.now() + 300000;
}

/**
 * Main Auto-Trader Execution Cycle (called on background ticks)
 */
export async function runAutoTraderCycle(): Promise<void> {
  const approvalMode = getTradeApprovalMode();
  if (approvalMode !== 'AUTO') {
    return;
  }

  if (isProcessingCycle) {
    return;
  }

  isProcessingCycle = true;
  try {
    // 1. Check Setup Limit: DO NOT TRADE if today's limit has been reached!
    if (autoTraderState.todaySetupsCount >= autoTraderState.maxSetupsLimit) {
      autoTraderState.limitReached = true;
      autoTraderState.status = 'SETUP_LIMIT_REACHED';
      autoTraderState.statusMessage = `🛑 SETUP LIMIT REACHED: ${autoTraderState.todaySetupsCount}/${autoTraderState.maxSetupsLimit} trades executed today. Auto-trading safely halted to prevent overtrading.`;

      // Log limit reached once per interval
      const now = Date.now();
      if (!autoTraderState.lastLimitNotificationTime || now - autoTraderState.lastLimitNotificationTime > 60000) {
        autoTraderState.lastLimitNotificationTime = now;
        addLog('LIMIT_REACHED', autoTraderState.currentScanningSymbol, `Daily trade cap of ${autoTraderState.maxSetupsLimit} trades reached. Auto-execution paused.`);
      }
      return;
    }

    // 2. Check active positions limit across all assets
    const systemState = getSystemState();
    const activePositions = systemState.activePositions || (systemState.activePosition ? [systemState.activePosition] : []);
    const maxAllowed = systemState.riskSettings.maxOpenTrades || 5;

    // If all allowed slots are occupied by locked trades, pause new entries and monitor existing trades
    if (activePositions.length >= maxAllowed) {
      autoTraderState.status = 'LOCKED_WAITING_TP_SL';
      autoTraderState.activePositions = activePositions;
      autoTraderState.activePositionsCount = activePositions.length;
      autoTraderState.statusMessage = `${activePositions.length} Trades ACTIVE & LOCKED 🔒 [${activePositions.map((p) => `${p.setup.symbol} ${p.setup.direction} (${p.unrealizedPnL >= 0 ? '+' : ''}$${p.unrealizedPnL})`).join(' | ')}]. Monitoring Take Profit & Stop Loss targets.`;
      return;
    }

    // 3. Check Cooldown after previous trade closure (only if no positions are active)
    if (Date.now() < autoTraderState.cooldownUntil && activePositions.length === 0) {
      const remainingSec = Math.ceil((autoTraderState.cooldownUntil - Date.now()) / 1000);
      autoTraderState.status = 'COOLDOWN';
      autoTraderState.statusMessage = `Previous trade closed. Disciplined cooldown: ${remainingSec}s before initiating next SMC market scan...`;
      return;
    }

    // 4. Check if scan interval has elapsed
    const now = Date.now();
    const elapsed = (now - autoTraderState.lastScanTime) / 1000;
    if (elapsed < autoTraderState.scanIntervalSeconds && autoTraderState.lastScanTime !== 0) {
      return;
    }

    // 5. Rigorous Multi-Asset Comparative Scan Cycle
    const prices = await updateRealMarketPrices();

    // Clean expired asset cooldowns
    if (autoTraderState.activeAssetCooldowns) {
      for (const [sym, until] of Object.entries(autoTraderState.activeAssetCooldowns)) {
        if (now > (until || 0)) {
          delete autoTraderState.activeAssetCooldowns[sym as MarketSymbol];
        }
      }
    }

    const allSetups: Partial<Record<MarketSymbol, TradeSetup>> = {};
    const allAnalyses: Partial<Record<MarketSymbol, AssetAnalysisSummary>> = {};
    const confirmedCandidates: { setup: TradeSetup; symbol: MarketSymbol; score: number; rr: number }[] = [];
    const allScoredCandidates: { setup: TradeSetup; symbol: MarketSymbol; score: number; rr: number; isConfirmed: boolean; diag: any }[] = [];

    const activeSymbols = new Set(activePositions.map((p) => p.setup.symbol));

    // Analyze ALL watchlist symbols - guarantees Entry, SL, and TP targets are calculated for every asset
    for (let i = 0; i < autoTraderState.watchlist.length; i++) {
      const testSymbol = autoTraderState.watchlist[i];
      const priceData = prices[testSymbol];
      if (!priceData) continue;

      const candles = await getSymbolCandles(testSymbol, '15m');
      const zones = detectSmartMoneyConcepts(testSymbol, candles, '15m');

      // Evaluate 4 Pillars of SMC confirmation
      const confirmDetails = evaluateConfirmationDetails(testSymbol, priceData.price, candles, zones, autoTraderState.minRiskReward);

      // ALWAYS calculate complete setup with exact Entry, SL, and TP targets for this asset
      const candidateSetup = await runAIDecisionEngine(
        testSymbol,
        priceData,
        candles,
        zones,
        false,
        autoTraderState.minConfidenceThreshold || 70,
        false
      );

      if (candidateSetup) {
        allSetups[testSymbol] = candidateSetup;
        setProposedSetup(candidateSetup);

        const marketHours = getMarketHoursStatus(testSymbol);
        const isClosedWeekend = !marketHours.isOpen;
        const isAssetOnCooldown = Boolean(
          autoTraderState.activeAssetCooldowns?.[testSymbol] && now < (autoTraderState.activeAssetCooldowns[testSymbol] || 0)
        );
        const isAlreadyActive = activeSymbols.has(testSymbol);

        let statusText = confirmDetails.statusText;
        if (isClosedWeekend) {
          statusText = `WEEKEND CLOSED (${marketHours.reopensAt || 'Mon-Fri only'})`;
        } else if (isAlreadyActive) {
          statusText = `ACTIVE TRADE 🔒 (${candidateSetup.direction})`;
        }

        allAnalyses[testSymbol] = {
          symbol: testSymbol,
          direction: candidateSetup.direction,
          entryPrice: candidateSetup.entryPrice,
          stopLoss: candidateSetup.stopLoss,
          takeProfit1: candidateSetup.takeProfit1,
          takeProfit2: candidateSetup.takeProfit2,
          takeProfit3: candidateSetup.takeProfit3,
          tp1Label: candidateSetup.tp1Label,
          riskRewardRatio: candidateSetup.riskRewardRatio,
          confidenceScore: candidateSetup.confidenceScore,
          isConfirmed: confirmDetails.isConfirmed && !isClosedWeekend,
          statusText,
          setup: candidateSetup,
          lastAnalyzed: now,
        };

        allScoredCandidates.push({
          setup: candidateSetup,
          symbol: testSymbol,
          score: candidateSetup.confidenceScore,
          rr: candidateSetup.riskRewardRatio,
          isConfirmed: confirmDetails.isConfirmed && !isAssetOnCooldown && !isAlreadyActive && !isClosedWeekend,
          diag: confirmDetails,
        });

        // Automatic execution qualification based on SMC + Price Action strategies
        const minConf = autoTraderState.minConfidenceThreshold || 65;
        const minRR = autoTraderState.minRiskReward || 1.5;
        const qualifiesForExecution =
          !isClosedWeekend &&
          candidateSetup.confidenceScore >= minConf &&
          candidateSetup.riskRewardRatio >= minRR &&
          !isAlreadyActive &&
          !isAssetOnCooldown;

        if (qualifiesForExecution) {
          confirmedCandidates.push({
            setup: candidateSetup,
            symbol: testSymbol,
            score: candidateSetup.confidenceScore,
            rr: candidateSetup.riskRewardRatio,
          });
        }
      }
    }

    autoTraderState.allAssetSetups = allSetups;
    autoTraderState.allAssetAnalyses = allAnalyses;

    // Rank all assets: Prioritize currently OPEN assets first (e.g. BTCUSD on weekends), then Score & Risk:Reward
    allScoredCandidates.sort((a, b) => {
      const openA = isMarketOpen(a.symbol) ? 1 : 0;
      const openB = isMarketOpen(b.symbol) ? 1 : 0;
      if (openA !== openB) return openB - openA;
      if (b.score !== a.score) return b.score - a.score;
      return b.rr - a.rr;
    });

    const topCandidate = allScoredCandidates[0];
    if (topCandidate) {
      autoTraderState.bestCandidateSymbol = topCandidate.symbol;
      autoTraderState.bestCandidateScore = topCandidate.score;
      if (allAnalyses[topCandidate.symbol]) {
        allAnalyses[topCandidate.symbol]!.isBestCandidate = true;
      }
      autoTraderState.currentScanningSymbol = topCandidate.symbol;
      autoTraderState.waitingDetails = {
        symbol: topCandidate.symbol,
        missingCriteria: topCandidate.diag?.missingCriteria || [],
        hasLiquiditySweep: topCandidate.diag?.hasLiquiditySweep || false,
        hasStructureShift: topCandidate.diag?.hasStructureShift || false,
        hasOBMitigation: topCandidate.diag?.hasOBMitigation || false,
        hasValidRR: true,
        statusText: topCandidate.diag?.statusText || '',
        lastChecked: now,
      };
    }

    autoTraderState.lastScanTime = now;

    // If no candidate met the strict threshold but the #1 Best Setup exists on an open market:
    // AUTOMATICALLY EXECUTE the best SMC & Price Action candidate hands-free!
    if (confirmedCandidates.length === 0 && topCandidate && isMarketOpen(topCandidate.symbol)) {
      const isAlreadyActive = activeSymbols.has(topCandidate.symbol);
      const isAssetOnCooldown = Boolean(
        autoTraderState.activeAssetCooldowns?.[topCandidate.symbol] && now < (autoTraderState.activeAssetCooldowns[topCandidate.symbol] || 0)
      );
      if (!isAlreadyActive && !isAssetOnCooldown && topCandidate.score >= 60 && topCandidate.rr >= 1.4) {
        confirmedCandidates.push({
          setup: topCandidate.setup,
          symbol: topCandidate.symbol,
          score: topCandidate.score,
          rr: topCandidate.rr,
        });
      }
    }

    // 6. AUTO-TRADING EXECUTION: Execute ANY and ALL qualified best setups across multiple assets!
    const executedThisCycle: { symbol: MarketSymbol; setup: TradeSetup }[] = [];

    if (confirmedCandidates.length > 0) {
      // Sort candidates by score descending, then RR descending
      confirmedCandidates.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return b.rr - a.rr;
      });

      for (const candidate of confirmedCandidates) {
        if (autoTraderState.todaySetupsCount >= autoTraderState.maxSetupsLimit) {
          autoTraderState.limitReached = true;
          break;
        }

        const currentActive = getSystemState().activePositions || [];
        if (currentActive.length >= maxAllowed) {
          break;
        }

        if (currentActive.some((p) => p.setup.symbol === candidate.symbol)) {
          continue; // already in active trade on this asset
        }

        // AUTO-EXECUTE BEST SETUP BY ITSELF! Setting Entry, SL, and TP targets!
        setProposedSetup(candidate.setup);
        const execResult = executeTrade(candidate.setup.id, candidate.setup);

        if (execResult.success) {
          autoTraderState.totalAutoTrades++;
          autoTraderState.todaySetupsCount++;
          autoTraderState.lastExecutedSetup = candidate.setup;

          // Put asset on 5-minute cooldown to prevent immediate repeat entries
          if (!autoTraderState.activeAssetCooldowns) {
            autoTraderState.activeAssetCooldowns = {};
          }
          autoTraderState.activeAssetCooldowns[candidate.symbol] = Date.now() + 300000;

          addLog(
            'AUTO_EXECUTE',
            candidate.symbol,
            `Auto-Executed Best Setup ⚡ [${candidate.symbol} ${candidate.setup.direction}]: Entry @ ${candidate.setup.entryPrice} | SL: ${candidate.setup.stopLoss} | TP: ${candidate.setup.takeProfit1} (Score: ${candidate.setup.confidenceScore}%, R:R 1:${candidate.setup.riskRewardRatio})`
          );

          executedThisCycle.push({ symbol: candidate.symbol, setup: candidate.setup });

          if (autoTraderState.todaySetupsCount >= autoTraderState.maxSetupsLimit) {
            autoTraderState.limitReached = true;
          }
        }
      }
    }

    const latestActive = getSystemState().activePositions || [];
    autoTraderState.activePositions = latestActive;
    autoTraderState.activePositionsCount = latestActive.length;

    if (executedThisCycle.length > 0) {
      autoTraderState.status = 'ENTRY_FOUND';
      const execSummary = executedThisCycle
        .map((e) => `${e.symbol} ${e.setup.direction} (E: ${e.setup.entryPrice}, SL: ${e.setup.stopLoss}, TP: ${e.setup.takeProfit1})`)
        .join(' & ');
      autoTraderState.statusMessage = `⚡ ${executedThisCycle.length} Best Setup(s) AUTO-EXECUTED & LOCKED 🔒 on [${execSummary}]! Positions running hands-free with exact Entry, SL, and TP targets.`;
    } else if (latestActive.length > 0) {
      autoTraderState.status = 'LOCKED_WAITING_TP_SL';
      autoTraderState.statusMessage = `${latestActive.length} Trade(s) ACTIVE & LOCKED 🔒 [${latestActive.map((p) => `${p.setup.symbol} ${p.setup.direction} (${p.unrealizedPnL >= 0 ? '+' : ''}$${p.unrealizedPnL})`).join(' | ')}]. Scanning remaining assets for best setups...`;
    } else {
      // NO ASSET PASSED STRICT CONFLUENCE YET: BOT WAITS DISCIPLINED (NO OVERTRADING!)
      autoTraderState.status = 'WAITING_CONFIRMATION';
      const topSym = topCandidate?.symbol || 'Watchlist';
      const topScore = topCandidate?.score || 0;
      const topDir = topCandidate?.setup?.direction || 'NEUTRAL';
      const topE = topCandidate?.setup?.entryPrice;
      const topSL = topCandidate?.setup?.stopLoss;
      const topTP = topCandidate?.setup?.takeProfit1;

      autoTraderState.statusMessage = `Analyzed all 5 assets. Best candidate: ${topSym} ${topDir} (${topScore}% Score, Entry: ${topE}, SL: ${topSL}, TP1: ${topTP}). Awaiting entry confirmation to auto-trade.`;

      // Keep currentSetup set to the top candidate setup so the UI always has Entry, SL, and TP targets visible!
      if (topCandidate?.setup) {
        setProposedSetup(topCandidate.setup);
      }
    }
  } catch (err: any) {
    console.error('AutoTrader cycle error:', err);
  } finally {
    isProcessingCycle = false;
  }
}

/**
 * Force an immediate scan across all assets & auto-execute any confirmed best setups
 */
export async function triggerImmediateAutoScan(forcedSymbol?: MarketSymbol): Promise<{
  success: boolean;
  message: string;
  setup?: TradeSetup | null;
  executedSetups?: TradeSetup[];
}> {
  // Check setup limit
  if (autoTraderState.todaySetupsCount >= autoTraderState.maxSetupsLimit) {
    autoTraderState.limitReached = true;
    autoTraderState.status = 'SETUP_LIMIT_REACHED';
    return {
      success: false,
      message: `Setup limit reached (${autoTraderState.todaySetupsCount}/${autoTraderState.maxSetupsLimit} trades used today). Reset limit or increase setup limit to execute further trades.`,
    };
  }

  const systemState = getSystemState();
  const currentActive = systemState.activePositions || (systemState.activePosition ? [systemState.activePosition] : []);
  const maxAllowed = systemState.riskSettings.maxOpenTrades || 5;

  if (currentActive.length >= maxAllowed) {
    return {
      success: false,
      message: `Maximum open trades (${currentActive.length}/${maxAllowed}) currently LOCKED 🔒. Must wait for Take Profit or Stop Loss before opening further trades.`,
    };
  }

  // Ensure Auto-Trading is active
  setAutoTraderEnabled(true);

  if (forcedSymbol && !isMarketOpen(forcedSymbol)) {
    const status = getMarketHoursStatus(forcedSymbol);
    return {
      success: false,
      message: `${forcedSymbol} is CLOSED for the weekend (${status.reopensAt || 'Re-opens Sunday 21:00 UTC'}). Traditional markets only trade Monday to Friday. Only BTCUSD (crypto) trades 24/7.`,
    };
  }

  const prices = await updateRealMarketPrices();
  const candidateSymbols: MarketSymbol[] = forcedSymbol
    ? [forcedSymbol, ...autoTraderState.watchlist.filter((s) => s !== forcedSymbol)]
    : autoTraderState.watchlist;

  const confirmedCandidates: { setup: TradeSetup; symbol: MarketSymbol; score: number; rr: number }[] = [];
  const allScored: { setup: TradeSetup; symbol: MarketSymbol; score: number; rr: number; isConfirmed: boolean }[] = [];
  const activeSymbols = new Set(currentActive.map((p) => p.setup.symbol));

  for (const sym of candidateSymbols) {
    autoTraderState.currentScanningSymbol = sym;
    const priceData = prices[sym];
    if (!priceData) continue;

    const candles = await getSymbolCandles(sym, '15m');
    const zones = detectSmartMoneyConcepts(sym, candles, '15m');

    // Strict SMC Confirmation evaluation
    const confirmDetails = evaluateConfirmationDetails(sym, priceData.price, candles, zones, autoTraderState.minRiskReward);

    // Compute complete setup with Entry, SL, and TP targets
    const setup = await runAIDecisionEngine(sym, priceData, candles, zones, false, autoTraderState.minConfidenceThreshold || 70, false);

    if (setup) {
      setProposedSetup(setup);
      if (!autoTraderState.allAssetSetups) autoTraderState.allAssetSetups = {};
      autoTraderState.allAssetSetups[sym] = setup;

      const isAlreadyActive = activeSymbols.has(sym);
      const isAssetOnCooldown = Boolean(
        autoTraderState.activeAssetCooldowns?.[sym] && Date.now() < (autoTraderState.activeAssetCooldowns[sym] || 0)
      );

      const marketHours = getMarketHoursStatus(sym);
      const isClosedWeekend = !marketHours.isOpen;

      allScored.push({
        setup,
        symbol: sym,
        score: setup.confidenceScore,
        rr: setup.riskRewardRatio,
        isConfirmed: confirmDetails.isConfirmed && !isClosedWeekend,
      });

      const minConf = autoTraderState.minConfidenceThreshold || 65;
      const minRR = autoTraderState.minRiskReward || 1.5;
      const qualifies =
        !isClosedWeekend &&
        setup.confidenceScore >= minConf &&
        setup.riskRewardRatio >= minRR &&
        !isAlreadyActive &&
        !isAssetOnCooldown;

      if (qualifies) {
        confirmedCandidates.push({
          setup,
          symbol: sym,
          score: setup.confidenceScore,
          rr: setup.riskRewardRatio,
        });
      }
    }
  }

  allScored.sort((a, b) => {
    const openA = isMarketOpen(a.symbol) ? 1 : 0;
    const openB = isMarketOpen(b.symbol) ? 1 : 0;
    if (openA !== openB) return openB - openA;
    if (b.score !== a.score) return b.score - a.score;
    return b.rr - a.rr;
  });

  const top = allScored[0];
  if (top) {
    autoTraderState.bestCandidateSymbol = top.symbol;
    autoTraderState.bestCandidateScore = top.score;
  }

  // If no candidate was flagged but top candidate exists on an open market:
  // AUTOMATICALLY EXECUTE the best SMC + Price Action setup!
  if (confirmedCandidates.length === 0 && top && isMarketOpen(top.symbol)) {
    const isAlreadyActive = activeSymbols.has(top.symbol);
    const isAssetOnCooldown = Boolean(
      autoTraderState.activeAssetCooldowns?.[top.symbol] && Date.now() < (autoTraderState.activeAssetCooldowns[top.symbol] || 0)
    );
    if (!isAlreadyActive && !isAssetOnCooldown && top.score >= 60 && top.rr >= 1.4) {
      confirmedCandidates.push({
        setup: top.setup,
        symbol: top.symbol,
        score: top.score,
        rr: top.rr,
      });
    }
  }

  // Execute ANY and ALL confirmed best setups across multiple assets!
  const executedSetups: TradeSetup[] = [];

  if (confirmedCandidates.length > 0) {
    confirmedCandidates.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.rr - a.rr;
    });

    for (const candidate of confirmedCandidates) {
      if (autoTraderState.todaySetupsCount >= autoTraderState.maxSetupsLimit) {
        autoTraderState.limitReached = true;
        break;
      }

      const activeNow = getSystemState().activePositions || [];
      if (activeNow.length >= maxAllowed) {
        break;
      }

      if (activeNow.some((p) => p.setup.symbol === candidate.symbol)) {
        continue;
      }

      setProposedSetup(candidate.setup);
      const execResult = executeTrade(candidate.setup.id, candidate.setup);

      if (execResult.success) {
        autoTraderState.totalAutoTrades++;
        autoTraderState.todaySetupsCount++;
        autoTraderState.lastExecutedSetup = candidate.setup;

        // Apply per-asset cooldown of 5 minutes so it doesn't immediately repeat
        if (!autoTraderState.activeAssetCooldowns) {
          autoTraderState.activeAssetCooldowns = {};
        }
        autoTraderState.activeAssetCooldowns[candidate.symbol] = Date.now() + 300000;

        addLog(
          'AUTO_EXECUTE',
          candidate.symbol,
          `Auto-Executed Best Setup ⚡ [${candidate.symbol} ${candidate.setup.direction}]: Entry @ ${candidate.setup.entryPrice} | SL: ${candidate.setup.stopLoss} | TP: ${candidate.setup.takeProfit1} (Score: ${candidate.setup.confidenceScore}%)`
        );

        executedSetups.push(candidate.setup);

        if (autoTraderState.todaySetupsCount >= autoTraderState.maxSetupsLimit) {
          autoTraderState.limitReached = true;
        }
      }
    }

    if (executedSetups.length > 0) {
      autoTraderState.status = 'ENTRY_FOUND';
      const summary = executedSetups
        .map((s) => `${s.symbol} ${s.direction} (E: ${s.entryPrice}, SL: ${s.stopLoss}, TP: ${s.takeProfit1})`)
        .join(' & ');
      autoTraderState.statusMessage = `⚡ ${executedSetups.length} Trade(s) AUTO-EXECUTED & LOCKED on [${summary}]! Running hands-free.`;

      return {
        success: true,
        message: `${executedSetups.length} Best Setup(s) automatically executed across assets with exact Entry, SL, and TP targets!`,
        setup: executedSetups[0],
        executedSetups,
      };
    }
  }

  autoTraderState.status = 'WAITING_CONFIRMATION';
  if (top) {
    setProposedSetup(top.setup);
  }
  const topText = top
    ? `${top.symbol} ${top.setup.direction} (Score: ${top.score}%, Entry: ${top.setup.entryPrice}, SL: ${top.setup.stopLoss}, TP: ${top.setup.takeProfit1})`
    : 'Watchlist';
  autoTraderState.statusMessage = `Analyzed all assets. Best candidate: ${topText}. Patiently waiting for entry confirmation. No trade entered.`;

  return {
    success: false,
    message: `All assets thoroughly analyzed. Best candidate: ${topText}. Awaiting high-probability confirmation before entering.`,
    setup: top?.setup,
  };
}

// Automatically register trade closure notifications
registerTradeClosedListener(notifyTradeClosed);

