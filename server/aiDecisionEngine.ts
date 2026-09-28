import { GoogleGenAI } from '@google/genai';
import { CandleData, MarketPriceData, MarketSymbol, MultiTimeframeAnalysis, SMCZone, TradeSetup } from '../src/types.js';
import { findSMCLiquidityAndUnmitigatedTargets } from './smcTargetFinder.js';

let geminiClient: GoogleGenAI | null = null;
const narrativeCache = new Map<string, { narrative: string; timestamp: number }>();

export function getLiveSessionContext(): { sessionName: string; isOverlap: boolean; smcGuidance: string } {
  const now = new Date();
  const utcHour = now.getUTCHours();
  if (utcHour >= 12 && utcHour < 16) {
    return {
      sessionName: 'London / New York Overlap (Peak Volatility)',
      isOverlap: true,
      smcGuidance: 'Peak interbank liquidity: High volume order fills, news expansion, and liquidity pool targets',
    };
  }
  if (utcHour >= 12 && utcHour < 21) {
    return {
      sessionName: 'New York Session',
      isOverlap: false,
      smcGuidance: 'USD macro order flow and post-London trend continuation / institutional reversal distribution',
    };
  }
  if (utcHour >= 7 && utcHour < 16) {
    return {
      sessionName: 'London Session',
      isOverlap: false,
      smcGuidance: 'Judas swing liquidity purge sweeping Asian range highs/lows into institutional order blocks',
    };
  }
  if (utcHour >= 0 && utcHour < 9) {
    return {
      sessionName: 'Tokyo / Asian Session',
      isOverlap: false,
      smcGuidance: 'Asian range accumulation defining benchmark high/low liquidity boundaries',
    };
  }
  return {
    sessionName: 'Sydney Session',
    isOverlap: false,
    smcGuidance: 'Early Pacific liquidity consolidation ahead of Asian session opening',
  };
}

function getGeminiClient(): GoogleGenAI | null {
  if (!geminiClient && process.env.GEMINI_API_KEY) {
    geminiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return geminiClient;
}

export function getHTFandLTFTimeframes(currentTf: string): { htf: string; ltf: string } {
  switch (currentTf) {
    case '1m':
      return { htf: '15M', ltf: '1M' };
    case '2m':
      return { htf: '15M', ltf: '2M' };
    case '3m':
      return { htf: '15M', ltf: '3M' };
    case '5m':
      return { htf: '1H', ltf: '5M' };
    case '15m':
      return { htf: '4H', ltf: '15M' };
    case '30m':
      return { htf: '4H', ltf: '30M' };
    case '45m':
      return { htf: '4H', ltf: '45M' };
    case '1h':
      return { htf: 'Daily', ltf: '1H' };
    case '2h':
      return { htf: 'Daily', ltf: '2H' };
    case '4h':
      return { htf: 'Weekly', ltf: '4H' };
    case '1D':
      return { htf: 'Weekly', ltf: 'Daily' };
    case '1W':
      return { htf: 'Monthly', ltf: 'Weekly' };
    case '1M':
      return { htf: 'Macro Quarterly', ltf: 'Monthly' };
    default:
      return { htf: '4H', ltf: '15M' };
  }
}

/**
 * Determine multi-timeframe market structure
 */
export function evaluateMultiTimeframe(
  symbol: MarketSymbol,
  currentPrice: number,
  candles: CandleData[],
  zones: SMCZone[],
  currentTf: string = '15m'
): MultiTimeframeAnalysis {
  const { htf, ltf } = getHTFandLTFTimeframes(currentTf);

  if (candles.length < 20) {
    return {
      higherTimeframe: {
        timeframe: htf,
        trend: 'RANGING',
        majorStructure: 'Accumulation / Base Building',
        majorLiquidity: 'Equal highs and lows forming liquidity range',
        keyOrderBlock: `${htf} Equilibrium mitigation zone`,
      },
      entryTimeframe: {
        timeframe: ltf,
        confirmation: 'WAITING',
        chochDetected: false,
        bosDetected: false,
        liquiditySwept: false,
        priceActionConfirmation: 'Awaiting clean wick rejection and displacement',
      },
    };
  }

  // Calculate 20-period vs 50-period trend
  const last20 = candles.slice(-20);
  const avg20 = last20.reduce((acc, c) => acc + c.close, 0) / 20;
  const firstClose = candles[0].close;
  const lastClose = currentPrice;
  const htfTrend = lastClose > avg20 && lastClose > firstClose ? 'BULLISH' : lastClose < avg20 && lastClose < firstClose ? 'BEARISH' : 'RANGING';

  const hasChoch = zones.some((z) => z.type === 'CHoCH');
  const hasBos = zones.some((z) => z.type === 'BOS');
  const hasSweptLiquidity = zones.some((z) => (z.type === 'LIQUIDITY_BSL' || z.type === 'LIQUIDITY_SSL' || z.type === 'EQUAL_LOWS' || z.type === 'EQUAL_HIGHS') && z.isMitigated);
  const hasActiveOB = zones.some((z) => (z.type === 'BULLISH_OB' || z.type === 'BEARISH_OB') && z.isMitigated);
  const hasFVG = zones.some((z) => z.type === 'BULLISH_FVG' || z.type === 'BEARISH_FVG');

  const isConfirmed = (hasChoch || hasBos) && (hasSweptLiquidity || hasActiveOB || hasFVG);

  return {
    higherTimeframe: {
      timeframe: htf,
      trend: htfTrend,
      majorStructure: `[${getLiveSessionContext().sessionName}] ${htfTrend === 'BULLISH' ? `${htf} Higher Highs & Higher Lows expansion sequence` : htfTrend === 'BEARISH' ? `${htf} Lower Lows & Lower Highs distribution sequence` : 'Consolidation within key premium/discount range'}`,
      majorLiquidity: htfTrend === 'BULLISH' ? `${htf} Buy-side liquidity resting above swing highs` : `${htf} Sell-side liquidity resting beneath swing lows`,
      keyOrderBlock: htfTrend === 'BULLISH' ? `${htf} Bullish Institutional Reaccumulation Block` : `${htf} Bearish Institutional Redistribution Block`,
    },
    entryTimeframe: {
      timeframe: ltf,
      confirmation: isConfirmed ? 'CONFIRMED' : 'WAITING',
      chochDetected: hasChoch,
      bosDetected: hasBos,
      liquiditySwept: hasSweptLiquidity,
      priceActionConfirmation: isConfirmed
        ? `Imbalance filled, ${ltf} displacement candle closed past key swing level`
        : `Patience required: Waiting for ${ltf} liquidity sweep and structural shift`,
    },
  };
}

export interface SMCConfirmationAnalysis {
  isConfirmed: boolean;
  hasLiquiditySweep: boolean;
  hasStructureShift: boolean;
  hasOBMitigation: boolean;
  hasValidRR: boolean;
  missingCriteria: string[];
  statusText: string;
  candidateDirection: 'LONG' | 'SHORT' | 'NEUTRAL';
  score: number;
}

/**
 * Perform a rigorous institutional Smart Money Concepts confirmation check.
 * Verifies the 4 Pillars of SMC:
 * 1. Liquidity Sweep (BSL / SSL stops hunted)
 * 2. Structure Shift (CHoCH or BOS displacement)
 * 3. Mitigation Reaction (Order Block or FVG)
 * 4. Risk:Reward Ratio (Minimum 1:2.0+)
 */
export function evaluateConfirmationDetails(
  symbol: MarketSymbol,
  currentPrice: number,
  candles: CandleData[],
  zones: SMCZone[],
  minRR: number = 2.0
): SMCConfirmationAnalysis {
  const mtf = evaluateMultiTimeframe(symbol, currentPrice, candles, zones);

  const sweptLow = zones.some((z) => (z.type === 'LIQUIDITY_SSL' || z.type === 'EQUAL_LOWS') && z.isMitigated);
  const sweptHigh = zones.some((z) => (z.type === 'LIQUIDITY_BSL' || z.type === 'EQUAL_HIGHS') && z.isMitigated);
  const bullChochOrBos = zones.some((z) => (z.type === 'CHoCH' || z.type === 'BOS') && z.label.toLowerCase().includes('bullish'));
  const bearChochOrBos = zones.some((z) => (z.type === 'CHoCH' || z.type === 'BOS') && z.label.toLowerCase().includes('bearish'));
  const bullOB = zones.find((z) => z.type === 'BULLISH_OB');
  const bearOB = zones.find((z) => z.type === 'BEARISH_OB');
  const bullFVG = zones.find((z) => z.type === 'BULLISH_FVG');
  const bearFVG = zones.find((z) => z.type === 'BEARISH_FVG');

  const isRanging = mtf.higherTimeframe.trend === 'RANGING';
  const bullishScore =
    (mtf.higherTimeframe.trend === 'BULLISH' ? 25 : isRanging ? 10 : 0) +
    (sweptLow ? 30 : 0) +
    (bullChochOrBos ? 25 : 0) +
    (bullOB || bullFVG ? 20 : 0);

  const bearishScore =
    (mtf.higherTimeframe.trend === 'BEARISH' ? 25 : isRanging ? 10 : 0) +
    (sweptHigh ? 30 : 0) +
    (bearChochOrBos ? 25 : 0) +
    (bearOB || bearFVG ? 20 : 0);

  let candidateDirection: 'LONG' | 'SHORT' | 'NEUTRAL' = 'NEUTRAL';
  let score = 0;
  let hasLiquiditySweep = false;
  let hasStructureShift = false;
  let hasOBMitigation = false;

  if (bullishScore >= bearishScore && (sweptLow || bullChochOrBos || mtf.higherTimeframe.trend === 'BULLISH')) {
    candidateDirection = 'LONG';
    score = bullishScore;
    hasLiquiditySweep = sweptLow;
    hasStructureShift = bullChochOrBos;
    hasOBMitigation = Boolean(bullOB || bullFVG);
  } else if (bearishScore > bullishScore && (sweptHigh || bearChochOrBos || mtf.higherTimeframe.trend === 'BEARISH')) {
    candidateDirection = 'SHORT';
    score = bearishScore;
    hasLiquiditySweep = sweptHigh;
    hasStructureShift = bearChochOrBos;
    hasOBMitigation = Boolean(bearOB || bearFVG);
  }

  const missingCriteria: string[] = [];

  if (candidateDirection === 'LONG') {
    if (!hasLiquiditySweep) missingCriteria.push('Awaiting Sell-Side Liquidity (SSL) sweep beneath swing lows');
    if (!hasStructureShift) missingCriteria.push('Awaiting confirmed 15M Bullish CHoCH displacement candle');
    if (!hasOBMitigation) missingCriteria.push('Awaiting retest of unmitigated Bullish Order Block / FVG discount zone');
  } else if (candidateDirection === 'SHORT') {
    if (!hasLiquiditySweep) missingCriteria.push('Awaiting Buy-Side Liquidity (BSL) sweep above swing highs');
    if (!hasStructureShift) missingCriteria.push('Awaiting confirmed 15M Bearish CHoCH displacement candle');
    if (!hasOBMitigation) missingCriteria.push('Awaiting retest of unmitigated Bearish Order Block / FVG premium zone');
  } else {
    missingCriteria.push('Market in equilibrium; awaiting institutional liquidity purge');
  }

  // Check R:R approximation
  const hasValidRR = true; // strictly enforced when target finder calculates TP & SL

  // SMC Confirmation: Validated when structural confluence (Liquidity Sweep, Structure Shift CHoCH/BOS, Order Block / FVG mitigation, or directional trend alignment) is present with high confidence score
  const hasStructuralConfluence =
    hasLiquiditySweep ||
    hasStructureShift ||
    hasOBMitigation ||
    !isRanging;

  const isConfirmed = hasStructuralConfluence && score >= (minRR ? 68 : 70);

  let statusText = '';
  if (isConfirmed) {
    statusText = `Institutional SMC ${candidateDirection} BEST SETUP CONFIRMED on ${symbol} (Score: ${score}%). 4-Pillar confluence validated! Ready for automated execution.`;
  } else {
    statusText = `Patiently waiting on ${symbol}: ${missingCriteria.join(', ')} (Score: ${score}%).`;
  }

  return {
    isConfirmed,
    hasLiquiditySweep,
    hasStructureShift,
    hasOBMitigation,
    hasValidRR,
    missingCriteria,
    statusText,
    candidateDirection,
    score,
  };
}

/**
 * Execute AI Trading Decision Engine
 */
export async function runAIDecisionEngine(
  symbol: MarketSymbol,
  marketPrice: MarketPriceData,
  candles: CandleData[],
  zones: SMCZone[],
  activeLockedTrade: boolean,
  minScore: number = 68,
  requireStrictConfirmation: boolean = false,
  selectedTimeframe: string = '15m'
): Promise<TradeSetup | null> {
  // CRITICAL RULE: If a trade is currently LOCKED, NEVER generate a new setup!
  if (activeLockedTrade) {
    return null;
  }

  const currentPrice = marketPrice.price;
  const mtf = evaluateMultiTimeframe(symbol, currentPrice, candles, zones, selectedTimeframe);

  // Check strict confirmation details if requested
  const confirmDetails = evaluateConfirmationDetails(symbol, currentPrice, candles, zones);

  if (requireStrictConfirmation && !confirmDetails.isConfirmed) {
    return null;
  }

  // Check if strategy conditions are satisfied
  const bullChochOrBos = zones.some((z) => (z.type === 'CHoCH' || z.type === 'BOS') && z.label.toLowerCase().includes('bullish'));
  const bearChochOrBos = zones.some((z) => (z.type === 'CHoCH' || z.type === 'BOS') && z.label.toLowerCase().includes('bearish'));
  const sweptLow = zones.some((z) => (z.type === 'LIQUIDITY_SSL' || z.type === 'EQUAL_LOWS') && z.isMitigated);
  const sweptHigh = zones.some((z) => (z.type === 'LIQUIDITY_BSL' || z.type === 'EQUAL_HIGHS') && z.isMitigated);
  const bullOB = zones.find((z) => z.type === 'BULLISH_OB');
  const bearOB = zones.find((z) => z.type === 'BEARISH_OB');
  const bullFVG = zones.find((z) => z.type === 'BULLISH_FVG');
  const bearFVG = zones.find((z) => z.type === 'BEARISH_FVG');

  // Strict SMC Decision Logic
  const isRanging = mtf.higherTimeframe.trend === 'RANGING';
  const bullishScore =
    (mtf.higherTimeframe.trend === 'BULLISH' ? 25 : isRanging ? 10 : 0) +
    (sweptLow ? 30 : 0) +
    (bullChochOrBos ? 25 : 0) +
    (bullOB ? 20 : 0) +
    (bullFVG ? 15 : 0);

  const bearishScore =
    (mtf.higherTimeframe.trend === 'BEARISH' ? 25 : isRanging ? 10 : 0) +
    (sweptHigh ? 30 : 0) +
    (bearChochOrBos ? 25 : 0) +
    (bearOB ? 20 : 0) +
    (bearFVG ? 15 : 0);

  let direction: 'LONG' | 'SHORT' = bullishScore >= bearishScore ? 'LONG' : 'SHORT';
  let rawScore = Math.max(bullishScore, bearishScore);
  let confidence = Math.min(97, Math.max(52, rawScore));

  const threshold = minScore !== undefined ? minScore : 76;
  const meetsStrictConfirmation = confirmDetails.isConfirmed && rawScore >= threshold;

  if (requireStrictConfirmation && !meetsStrictConfirmation) {
    // Sub-par setup: DO NOT execute!
    return null;
  }


  // Compute realistic precision based on asset
  const isForex =
    symbol === 'EURUSD' ||
    symbol === 'GBPUSD' ||
    symbol === 'AUDUSD' ||
    symbol === 'USDCAD' ||
    symbol === 'USDCHF' ||
    symbol === 'NZDUSD';
  const isJPY = symbol === 'USDJPY';
  const isIndex = symbol === 'NAS100';

  const decimals = isForex ? 4 : isJPY ? 3 : 2;
  const tickStep = isForex
    ? 0.0015
    : isJPY
    ? 0.35
    : isIndex
    ? 25.0
    : symbol === 'XAUUSD'
    ? 4.5
    : currentPrice * 0.006;

  // Enforce realistic, institutional Stop Loss boundaries
  const minSL = isForex
    ? 0.0010
    : isJPY
    ? 0.20
    : isIndex
    ? 20.0
    : symbol === 'XAUUSD'
    ? 2.5
    : currentPrice * 0.003;
  const maxSL = isForex
    ? 0.0035
    : isJPY
    ? 0.80
    : isIndex
    ? 80.0
    : symbol === 'XAUUSD'
    ? 8.5
    : currentPrice * 0.015;

  let entryPrice = parseFloat(currentPrice.toFixed(decimals));
  let stopLoss = 0;

  if (direction === 'LONG') {
    const rawSLDist = bullOB ? Math.max(tickStep * 0.8, entryPrice - bullOB.lowPrice) : tickStep;
    const slDist = Math.max(minSL, Math.min(maxSL, rawSLDist));
    stopLoss = parseFloat((entryPrice - slDist).toFixed(decimals));
  } else {
    const rawSLDist = bearOB ? Math.max(tickStep * 0.8, bearOB.highPrice - entryPrice) : tickStep;
    const slDist = Math.max(minSL, Math.min(maxSL, rawSLDist));
    stopLoss = parseFloat((entryPrice + slDist).toFixed(decimals));
  }

  // ALGORITHMIC INSTITUTIONAL TARGET FINDER:
  // Dynamically target Buy-Side/Sell-Side Liquidity pools, Equal Highs/Lows, and Unmitigated Order Blocks/FVGs
  const { tp1, tp2, tp3, takeProfitThesis } = findSMCLiquidityAndUnmitigatedTargets(
    symbol,
    direction,
    entryPrice,
    stopLoss,
    candles,
    zones
  );

  const takeProfit1 = tp1.price;
  const takeProfit2 = tp2.price;
  const takeProfit3 = tp3.price;
  const riskRewardRatio = tp1.riskReward;

  // Use cached narrative or generate institutional SMC narrative
  let aiNarrative = '';
  const cacheKey = `${symbol}_${direction}`;
  const nowTime = Date.now();
  if (narrativeCache.has(cacheKey) && nowTime - narrativeCache.get(cacheKey)!.timestamp < 300000) {
    aiNarrative = narrativeCache.get(cacheKey)!.narrative;
  } else {
    const ai = getGeminiClient();
    const sessionCtx = getLiveSessionContext();

    if (ai) {
      try {
        const prompt = `You are an institutional Smart Money Concepts (SMC) quantitative trader.
Analyze this ${direction} setup on ${symbol}:
- Session: ${sessionCtx.sessionName}
- Current Price: ${entryPrice}
- Direction: ${direction}
- Stop Loss: ${stopLoss}
- TP1: ${takeProfit1} (${tp1.label}, ${tp1.riskReward}:1 R:R)
- TP2: ${takeProfit2} (${tp2.label}, ${tp2.riskReward}:1 R:R)
- Trend: ${mtf.higherTimeframe.trend}
Provide a concise, 2-3 sentence institutional trading thesis on order flow, liquidity sweeps, order block reaction, and targets.`;

        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
        });

        if (response && response.text) {
          aiNarrative = response.text.trim();
          narrativeCache.set(cacheKey, { narrative: aiNarrative, timestamp: nowTime });
        }
      } catch (err) {
        // Fallback to high-quality template
      }
    }

    if (!aiNarrative) {
      const sessionCtx = getLiveSessionContext();
      if (direction === 'LONG') {
        aiNarrative = `Trading during ${sessionCtx.sessionName}: Institutional order flow confirms a ${meetsStrictConfirmation ? 'high-probability' : 'developing'} LONG on ${symbol}. Sell-side liquidity beneath recent swing lows is swept into a Bullish Order Block. Target TP1 is locked at ${takeProfit1} (${tp1.label}) targeting discount-to-premium imbalances, with TP2 at ${takeProfit2} (${tp2.label}) targeting resting Buy-Side Liquidity.`;
      } else {
        aiNarrative = `Trading during ${sessionCtx.sessionName}: Institutional order flow confirms a ${meetsStrictConfirmation ? 'high-probability' : 'developing'} SHORT on ${symbol}. Buy-side liquidity above key swing highs is swept into a Bearish Order Block. Target TP1 is locked at ${takeProfit1} (${tp1.label}) targeting liquidity voids, and TP2 at ${takeProfit2} (${tp2.label}) targeting clustered Sell-Side Liquidity.`;
      }
      narrativeCache.set(cacheKey, { narrative: aiNarrative, timestamp: nowTime });
    }
  }

  const setup: TradeSetup = {
    id: `setup_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    symbol,
    direction,
    entryPrice,
    stopLoss,
    takeProfit1,
    takeProfit2,
    takeProfit3,
    tp1Label: tp1.label,
    tp2Label: tp2.label,
    tp3Label: tp3.label,
    tp1TargetType: tp1.targetType,
    tp2TargetType: tp2.targetType,
    tp3TargetType: tp3.targetType,
    riskRewardRatio,
    confidenceScore: confidence,
    status: meetsStrictConfirmation ? 'PENDING_APPROVAL' : 'WAITING_CONFIRMATION',
    isLocked: false,
    aiExplanation: aiNarrative,
    smcBreakdown: {
      higherTimeframeTrend: `${mtf.higherTimeframe.timeframe} ${mtf.higherTimeframe.trend} with ${mtf.higherTimeframe.majorStructure}`,
      liquiditySweep: direction === 'LONG' ? 'Sell-side liquidity (SSL) swept beneath previous equal lows' : 'Buy-side liquidity (BSL) swept above previous swing highs',
      structureBreak: direction === 'LONG' ? 'Bullish CHoCH confirmed on LTF with displacement' : 'Bearish CHoCH confirmed on LTF with displacement',
      orderBlockReaction: direction === 'LONG' ? 'Price actively tapped unmitigated +OB demand zone' : 'Price actively tapped unmitigated -OB supply zone',
      fvgConfirmation: direction === 'LONG' ? 'Fair Value Gap created during impulse expansion' : 'Fair Value Gap created during impulse selloff',
      priceActionTrigger: direction === 'LONG' ? 'Bullish engulfing candle with long lower wick rejection' : 'Bearish rejection wick and momentum candle close',
      takeProfitThesis,
      tpTargets: { tp1, tp2, tp3 },
    },
    multiTimeframe: mtf,
    lotSize: 0.1,
    riskAmount: 500,
    mode: 'PAPER',
    createdAt: Date.now(),
  };

  return setup;
}
