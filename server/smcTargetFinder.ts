import { CandleData, MarketSymbol, SMCZone, SMCTakeProfitTarget } from '../src/types';

interface PotentialTarget {
  price: number;
  targetType: 'LIQUIDITY_POOL' | 'UNMITIGATED_OB' | 'UNMITIGATED_FVG' | 'SESSION_LIQUIDITY';
  label: string;
  description: string;
  distance: number;
  riskReward: number;
  qualityScore: number;
}

/**
 * Institutional SMC Take Profit Target Finder
 *
 * Scans price action for:
 * 1. Buy-Side Liquidity (BSL) and Sell-Side Liquidity (SSL) pools:
 *    - Equal Highs (EQH) / Equal Lows (EQL) with clustered retail stops
 *    - Prominent Swing Highs / Swing Lows
 *    - Session Highs / Lows (Asian, London, NY, Previous Day)
 * 2. Unmitigated Zones:
 *    - Unmitigated Fair Value Gaps (FVG) - Consequent Encroachment (50%) and boundaries
 *    - Unmitigated Order Blocks (OB) - Proximal edge and Mean Threshold (50%)
 */
export function findSMCLiquidityAndUnmitigatedTargets(
  symbol: MarketSymbol,
  direction: 'LONG' | 'SHORT',
  entryPrice: number,
  stopLoss: number,
  candles: CandleData[],
  zones: SMCZone[] = []
): {
  tp1: SMCTakeProfitTarget;
  tp2: SMCTakeProfitTarget;
  tp3: SMCTakeProfitTarget;
  takeProfitThesis: string;
} {
  const isForex = symbol === 'GBPUSD';
  const isJPY = symbol === 'USDJPY';
  const decimals = isForex ? 4 : isJPY ? 3 : 2;
  const risk = Math.abs(entryPrice - stopLoss) || (entryPrice * 0.005);
  const len = candles.length;

  const candidates: PotentialTarget[] = [];

  // Helper to register candidate target
  const addCandidate = (
    rawPrice: number,
    targetType: PotentialTarget['targetType'],
    label: string,
    description: string,
    qualityScore: number
  ) => {
    const price = parseFloat(rawPrice.toFixed(decimals));
    const dist = Math.abs(price - entryPrice);
    const rr = parseFloat((dist / risk).toFixed(2));

    // Only accept realistic SMC intraday/swing targets between 1.2R and 6.0R
    if (rr < 1.2 || rr > 6.0) return;

    if (direction === 'LONG' && price > entryPrice) {
      candidates.push({
        price,
        targetType,
        label,
        description,
        distance: dist,
        riskReward: rr,
        qualityScore,
      });
    } else if (direction === 'SHORT' && price < entryPrice) {
      candidates.push({
        price,
        targetType,
        label,
        description,
        distance: dist,
        riskReward: rr,
        qualityScore,
      });
    }
  };

  // ==========================================
  // 1. DETECT UNMITIGATED FAIR VALUE GAPS (FVG)
  // ==========================================
  for (let i = 2; i < len; i++) {
    const c1 = candles[i - 2];
    const c2 = candles[i - 1];
    const c3 = candles[i];

    if (direction === 'LONG') {
      // Bearish FVG overhead: c1.low > c3.high
      if (c1.low > c3.high && c2.close < c2.open) {
        const gapHigh = c1.low;
        const gapLow = c3.high;
        const gapMid = (gapHigh + gapLow) / 2;

        // Verify if it is UNMITIGATED (subsequent candles have not traded through)
        let isMitigated = false;
        for (let j = i + 1; j < len; j++) {
          if (candles[j].high >= gapLow) {
            isMitigated = true;
            break;
          }
        }

        if (!isMitigated && gapLow > entryPrice) {
          addCandidate(
            gapMid,
            'UNMITIGATED_FVG',
            `🎯 Unmitigated Bearish FVG Imbalance (CE 50%)`,
            `Consequent Encroachment (50% midpoint) of unmitigated liquidity void between ${gapLow.toFixed(decimals)} and ${gapHigh.toFixed(decimals)}.`,
            95
          );
          addCandidate(
            gapHigh,
            'UNMITIGATED_FVG',
            `🎯 Unmitigated Bearish FVG Full Fill`,
            `Distal mitigation of unfilled Bearish Fair Value Gap at ${gapHigh.toFixed(decimals)}.`,
            90
          );
        }
      }
    } else {
      // Bearish trade: Bullish FVG below entry: c3.low > c1.high
      if (c3.low > c1.high && c2.close > c2.open) {
        const gapHigh = c3.low;
        const gapLow = c1.high;
        const gapMid = (gapHigh + gapLow) / 2;

        // Verify if UNMITIGATED
        let isMitigated = false;
        for (let j = i + 1; j < len; j++) {
          if (candles[j].low <= gapHigh) {
            isMitigated = true;
            break;
          }
        }

        if (!isMitigated && gapHigh < entryPrice) {
          addCandidate(
            gapMid,
            'UNMITIGATED_FVG',
            `🎯 Unmitigated Bullish FVG Imbalance (CE 50%)`,
            `Consequent Encroachment (50% midpoint) of unmitigated discount liquidity gap between ${gapLow.toFixed(decimals)} and ${gapHigh.toFixed(decimals)}.`,
            95
          );
          addCandidate(
            gapLow,
            'UNMITIGATED_FVG',
            `🎯 Unmitigated Bullish FVG Full Fill`,
            `Distal mitigation of unfilled Bullish Fair Value Gap discount void at ${gapLow.toFixed(decimals)}.`,
            90
          );
        }
      }
    }
  }

  // ==========================================
  // 2. DETECT UNMITIGATED ORDER BLOCKS (OB)
  // ==========================================
  for (let i = 2; i < len - 2; i++) {
    const curr = candles[i];
    const next1 = candles[i + 1];

    if (direction === 'LONG') {
      // Bearish Order Block overhead (-OB)
      if (curr.close > curr.open && next1.close < next1.open && (curr.open - next1.close) > (curr.close - curr.open)) {
        const obLow = curr.low;
        const obHigh = curr.high;
        const obMid = (obLow + obHigh) / 2;

        // Check unmitigated status
        let isMitigated = false;
        for (let j = i + 2; j < len; j++) {
          if (candles[j].high >= obLow) {
            isMitigated = true;
            break;
          }
        }

        if (!isMitigated && obLow > entryPrice) {
          addCandidate(
            obLow,
            'UNMITIGATED_OB',
            `🎯 Unmitigated Bearish Order Block (-OB Supply)`,
            `Proximal boundary of unmitigated institutional order block supply zone where smart money distributed contracts.`,
            98
          );
          addCandidate(
            obMid,
            'UNMITIGATED_OB',
            `🎯 Unmitigated Bearish OB Mean Threshold (50%)`,
            `Equilibrium mean threshold of institutional distribution block at ${obMid.toFixed(decimals)}.`,
            92
          );
        }
      }
    } else {
      // Bullish Order Block below entry (+OB)
      if (curr.close < curr.open && next1.close > next1.open && (next1.close - curr.open) > (curr.open - curr.close)) {
        const obHigh = curr.high;
        const obLow = curr.low;
        const obMid = (obLow + obHigh) / 2;

        // Check unmitigated status
        let isMitigated = false;
        for (let j = i + 2; j < len; j++) {
          if (candles[j].low <= obHigh) {
            isMitigated = true;
            break;
          }
        }

        if (!isMitigated && obHigh < entryPrice) {
          addCandidate(
            obHigh,
            'UNMITIGATED_OB',
            `🎯 Unmitigated Bullish Order Block (+OB Demand)`,
            `Proximal boundary of unmitigated institutional accumulation order block demand zone.`,
            98
          );
          addCandidate(
            obMid,
            'UNMITIGATED_OB',
            `🎯 Unmitigated Bullish OB Mean Threshold (50%)`,
            `Equilibrium mean threshold of institutional accumulation block at ${obMid.toFixed(decimals)}.`,
            92
          );
        }
      }
    }
  }

  // ==========================================
  // 3. DETECT LIQUIDITY POOLS (EQH, EQL, BSL, SSL)
  // ==========================================
  const swingHighs: { price: number; index: number }[] = [];
  const swingLows: { price: number; index: number }[] = [];

  for (let i = 2; i < len - 2; i++) {
    const c = candles[i];
    if (
      c.high > candles[i - 1].high &&
      c.high > candles[i - 2].high &&
      c.high > candles[i + 1].high &&
      c.high > candles[i + 2].high
    ) {
      swingHighs.push({ price: c.high, index: i });
    }
    if (
      c.low < candles[i - 1].low &&
      c.low < candles[i - 2].low &&
      c.low < candles[i + 1].low &&
      c.low < candles[i + 2].low
    ) {
      swingLows.push({ price: c.low, index: i });
    }
  }

  // Equal Highs (EQH - Buy-Side Liquidity Pool)
  for (let i = 0; i < swingHighs.length; i++) {
    for (let j = i + 1; j < swingHighs.length; j++) {
      const h1 = swingHighs[i].price;
      const h2 = swingHighs[j].price;
      if (Math.abs(h1 - h2) / h1 < 0.0018) {
        const poolPrice = Math.max(h1, h2) * (1 + (isForex ? 0.0003 : 0.0006));
        if (poolPrice > entryPrice) {
          addCandidate(
            poolPrice,
            'LIQUIDITY_POOL',
            `🎯 Equal Highs (EQH) Buy-Side Liquidity Pool`,
            `Major retail double-top stop-loss cluster resting above equal highs at ${Math.max(h1, h2).toFixed(decimals)}.`,
            97
          );
        }
      }
    }
  }

  // Equal Lows (EQL - Sell-Side Liquidity Pool)
  for (let i = 0; i < swingLows.length; i++) {
    for (let j = i + 1; j < swingLows.length; j++) {
      const l1 = swingLows[i].price;
      const l2 = swingLows[j].price;
      if (Math.abs(l1 - l2) / l1 < 0.0018) {
        const poolPrice = Math.min(l1, l2) * (1 - (isForex ? 0.0003 : 0.0006));
        if (poolPrice < entryPrice) {
          addCandidate(
            poolPrice,
            'LIQUIDITY_POOL',
            `🎯 Equal Lows (EQL) Sell-Side Liquidity Pool`,
            `Major retail double-bottom stop-loss cluster resting below equal lows at ${Math.min(l1, l2).toFixed(decimals)}.`,
            97
          );
        }
      }
    }
  }

  // Swing Highs BSL & Swing Lows SSL
  if (direction === 'LONG') {
    for (const sh of swingHighs) {
      if (sh.price > entryPrice) {
        // Stop orders sit right above the swing high
        const bslTarget = sh.price * (1 + (isForex ? 0.0002 : 0.0005));
        addCandidate(
          bslTarget,
          'LIQUIDITY_POOL',
          `🎯 Buy-Side Liquidity (BSL) Swing High`,
          `Institutional draw on liquidity targeting resting buy stops above swing high at ${sh.price.toFixed(decimals)}.`,
          88
        );
      }
    }

    // Session High / Range High
    const maxHigh = Math.max(...candles.map((c) => c.high));
    if (maxHigh > entryPrice) {
      const sessionBSL = maxHigh * (1 + (isForex ? 0.0003 : 0.0008));
      addCandidate(
        sessionBSL,
        'SESSION_LIQUIDITY',
        `🎯 Session / Range High Liquidity Pool`,
        `External range buy-side liquidity resting above highest session wick at ${maxHigh.toFixed(decimals)}.`,
        94
      );
    }
  } else {
    for (const sl of swingLows) {
      if (sl.price < entryPrice) {
        // Stop orders sit right below the swing low
        const sslTarget = sl.price * (1 - (isForex ? 0.0002 : 0.0005));
        addCandidate(
          sslTarget,
          'LIQUIDITY_POOL',
          `🎯 Sell-Side Liquidity (SSL) Swing Low`,
          `Institutional draw on liquidity targeting resting sell stops below swing low at ${sl.price.toFixed(decimals)}.`,
          88
        );
      }
    }

    // Session Low / Range Low
    const minLow = Math.min(...candles.map((c) => c.low));
    if (minLow < entryPrice) {
      const sessionSSL = minLow * (1 - (isForex ? 0.0003 : 0.0008));
      addCandidate(
        sessionSSL,
        'SESSION_LIQUIDITY',
        `🎯 Session / Range Low Liquidity Pool`,
        `External range sell-side liquidity resting below lowest session wick at ${minLow.toFixed(decimals)}.`,
        94
      );
    }
  }

  // Incorporate detected SMC zones passed from marketData if unmitigated
  for (const z of zones) {
    if (direction === 'LONG') {
      if (z.type === 'BEARISH_OB' && z.lowPrice > entryPrice) {
        addCandidate(
          z.lowPrice,
          'UNMITIGATED_OB',
          `🎯 Unmitigated 15m Bearish Order Block (-OB)`,
          z.importance || 'Unmitigated supply zone.',
          96
        );
      } else if (z.type === 'BEARISH_FVG' && z.highPrice > entryPrice) {
        const mid = (z.lowPrice + z.highPrice) / 2;
        addCandidate(
          mid,
          'UNMITIGATED_FVG',
          `🎯 Unmitigated 15m Bearish Fair Value Gap`,
          z.importance || 'Unmitigated liquidity imbalance.',
          93
        );
      } else if ((z.type === 'LIQUIDITY_BSL' || z.type === 'EQUAL_HIGHS') && z.highPrice > entryPrice) {
        addCandidate(
          z.highPrice * 1.0005,
          'LIQUIDITY_POOL',
          `🎯 Major Buy-Side Liquidity (BSL) Pool`,
          z.importance || 'Clustered buy stops.',
          95
        );
      }
    } else {
      if (z.type === 'BULLISH_OB' && z.highPrice < entryPrice) {
        addCandidate(
          z.highPrice,
          'UNMITIGATED_OB',
          `🎯 Unmitigated 15m Bullish Order Block (+OB)`,
          z.importance || 'Unmitigated demand zone.',
          96
        );
      } else if (z.type === 'BULLISH_FVG' && z.lowPrice < entryPrice) {
        const mid = (z.lowPrice + z.highPrice) / 2;
        addCandidate(
          mid,
          'UNMITIGATED_FVG',
          `🎯 Unmitigated 15m Bullish Fair Value Gap`,
          z.importance || 'Unmitigated liquidity imbalance.',
          93
        );
      } else if ((z.type === 'LIQUIDITY_SSL' || z.type === 'EQUAL_LOWS') && z.lowPrice < entryPrice) {
        addCandidate(
          z.lowPrice * 0.9995,
          'LIQUIDITY_POOL',
          `🎯 Major Sell-Side Liquidity (SSL) Pool`,
          z.importance || 'Clustered sell stops.',
          95
        );
      }
    }
  }

  // ==========================================
  // 4. RANKING & TIER ASSIGNMENT (TP1, TP2, TP3)
  // ==========================================
  // Enforce institutional Risk-to-Reward minimum boundaries:
  // TP1: at least 1.5R (optimal ~1.8R - 2.5R)
  // TP2: at least 2.6R (optimal ~2.8R - 3.8R)
  // TP3: at least 3.9R (optimal ~4.0R - 6.0R)

  const sortedCandidates = candidates
    .filter((c) => c.riskReward >= 1.4) // Filter out sub-optimal noise
    .sort((a, b) => (direction === 'LONG' ? a.price - b.price : b.price - a.price));

  // Deduplicate candidates that are extremely close to each other (within 0.15% price delta)
  const uniqueTargets: PotentialTarget[] = [];
  for (const c of sortedCandidates) {
    const isTooClose = uniqueTargets.some((u) => Math.abs(u.price - c.price) / c.price < 0.0015);
    if (!isTooClose) {
      uniqueTargets.push(c);
    }
  }

  // Helper for generating institutional mathematical expansion if price range is narrow
  const createFibExpansionTarget = (
    multiplier: number,
    label: string,
    targetType: PotentialTarget['targetType'],
    desc: string
  ): PotentialTarget => {
    const targetPrice =
      direction === 'LONG'
        ? parseFloat((entryPrice + risk * multiplier).toFixed(decimals))
        : parseFloat((entryPrice - risk * multiplier).toFixed(decimals));
    const dist = Math.abs(targetPrice - entryPrice);
    return {
      price: targetPrice,
      targetType,
      label,
      description: desc,
      distance: dist,
      riskReward: multiplier,
      qualityScore: 85,
    };
  };

  // Find optimal candidate for TP1 (1.8R to 2.5R)
  let tp1Candidate = uniqueTargets.find((c) => c.riskReward >= 1.8 && c.riskReward <= 2.5);
  if (!tp1Candidate) {
    tp1Candidate = uniqueTargets.find((c) => c.riskReward >= 1.5 && c.riskReward <= 2.8) ||
      createFibExpansionTarget(
        2.0,
        direction === 'LONG'
          ? '🎯 Unmitigated Fair Value Gap / Internal Liquidity (2.0R)'
          : '🎯 Unmitigated Fair Value Gap / Internal Liquidity (2.0R)',
        'UNMITIGATED_FVG',
        'Institutional internal range liquidity void & FVG rebalance target.'
      );
  }

  // Find optimal candidate for TP2 (greater than TP1, preferably 2.6R to 3.8R)
  let tp2Candidate = uniqueTargets.find(
    (c) =>
      c.riskReward > (tp1Candidate?.riskReward || 2.0) + 0.5 &&
      c.riskReward >= 2.6 &&
      c.riskReward <= 3.8
  );
  if (!tp2Candidate) {
    const tp1RR = tp1Candidate?.riskReward || 2.0;
    const fallbackRR = parseFloat((Math.max(tp1RR + 1.0, 3.0)).toFixed(1));
    tp2Candidate = uniqueTargets.find((c) => c.riskReward > tp1RR + 0.4 && c.riskReward <= 4.0) ||
      createFibExpansionTarget(
        fallbackRR,
        direction === 'LONG'
          ? '🎯 Unmitigated Order Block / External BSL Pool'
          : '🎯 Unmitigated Order Block / External SSL Pool',
        'UNMITIGATED_OB',
        'Major external structural liquidity sweep into unmitigated institutional order block.'
      );
  }

  // Find optimal candidate for TP3 (greater than TP2, preferably 3.9R to 5.2R)
  let tp3Candidate = uniqueTargets.find(
    (c) =>
      c.riskReward > (tp2Candidate?.riskReward || 3.0) + 0.6 &&
      c.riskReward >= 3.8 &&
      c.riskReward <= 5.5
  );
  if (!tp3Candidate) {
    const tp2RR = tp2Candidate?.riskReward || 3.0;
    const fallbackRR = parseFloat((Math.max(tp2RR + 1.2, 4.2)).toFixed(1));
    tp3Candidate = createFibExpansionTarget(
      fallbackRR,
      direction === 'LONG'
        ? '🎯 Macro High-Timeframe Range Liquidity Sweep'
        : '🎯 Macro High-Timeframe Range Liquidity Sweep',
      'SESSION_LIQUIDITY',
      'Macro liquidity draw capturing terminal range stop-losses before structural rebalancing.'
    );
  }

  const tp1: SMCTakeProfitTarget = {
    targetType: tp1Candidate.targetType,
    label: tp1Candidate.label,
    price: tp1Candidate.price,
    description: tp1Candidate.description,
    riskReward: tp1Candidate.riskReward,
  };

  const tp2: SMCTakeProfitTarget = {
    targetType: tp2Candidate.targetType,
    label: tp2Candidate.label,
    price: tp2Candidate.price,
    description: tp2Candidate.description,
    riskReward: tp2Candidate.riskReward,
  };

  const tp3: SMCTakeProfitTarget = {
    targetType: tp3Candidate.targetType,
    label: tp3Candidate.label,
    price: tp3Candidate.price,
    description: tp3Candidate.description,
    riskReward: tp3Candidate.riskReward,
  };

  const takeProfitThesis =
    direction === 'LONG'
      ? `Institutional Take-Profit Alignment: TP1 is locked at ${tp1.price} (${tp1.label}, ${tp1.riskReward}:1 R:R) targeting internal unmitigated liquidity. TP2 expands to ${tp2.price} (${tp2.label}, ${tp2.riskReward}:1 R:R) capturing major Buy-Side Liquidity resting above equal highs. TP3 runner targets ${tp3.price} (${tp3.riskReward}:1 R:R) at macro unmitigated supply.`
      : `Institutional Take-Profit Alignment: TP1 is locked at ${tp1.price} (${tp1.label}, ${tp1.riskReward}:1 R:R) targeting internal unmitigated discount imbalances. TP2 expands to ${tp2.price} (${tp2.label}, ${tp2.riskReward}:1 R:R) capturing external Sell-Side Liquidity resting below equal lows. TP3 runner targets ${tp3.price} (${tp3.riskReward}:1 R:R) at macro unmitigated demand.`;

  return { tp1, tp2, tp3, takeProfitThesis };
}
