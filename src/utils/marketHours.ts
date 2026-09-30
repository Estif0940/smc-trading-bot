import { MarketSymbol } from '../types.js';

export interface MarketHoursStatus {
  symbol: MarketSymbol;
  isOpen: boolean;
  isWeekendClosed: boolean;
  status: 'OPEN' | 'WEEKEND_CLOSED';
  statusLabel: string;
  reason: string;
  reopensAt?: string;
  closesAt?: string;
  tradingHoursDescription: string;
  isCrypto247: boolean;
  secondsUntilOpen?: number;
}

/**
 * Institutional Market Hours Rule:
 * - BTCUSD operates 24/7 continuous crypto order flow without weekend shutdown.
 * - Traditional Assets (Forex: GBPUSD, USDJPY; Metals: XAUUSD; Indices: NAS100):
 *   Only trade Monday to Friday.
 *   - Close Friday at 21:00 UTC (17:00 EST / New York market close).
 *   - Closed Saturday all day.
 *   - Closed Sunday until 21:00 UTC (17:00 EST / Sydney interbank open).
 *   - Re-opens Sunday at 21:00 UTC.
 */
export function getMarketHoursStatus(symbol: MarketSymbol, date: Date = new Date()): MarketHoursStatus {
  // BTCUSD trades 24/7 without weekend shutdown
  if (symbol === 'BTCUSD') {
    return {
      symbol,
      isOpen: true,
      isWeekendClosed: false,
      status: 'OPEN',
      statusLabel: '24/7 LIVE',
      reason: 'Crypto assets trade 24/7 continuous order flow',
      tradingHoursDescription: '24/7 Continuous Trading',
      isCrypto247: true,
    };
  }

  const day = date.getUTCDay(); // 0 = Sunday, 1 = Monday, ..., 5 = Friday, 6 = Saturday
  const hour = date.getUTCHours();
  const minute = date.getUTCMinutes();
  const second = date.getUTCSeconds();
  const minuteOfDay = hour * 60 + minute;
  const secondOfDay = hour * 3600 + minute * 60 + second;

  // Saturday: Completely closed (All 24 hours)
  if (day === 6) {
    // Reopens Sunday 21:00 UTC. Seconds remaining: (Saturday remaining seconds: 86400 - secondOfDay) + Sunday 21 hours (21 * 3600)
    const secondsRemaining = (86400 - secondOfDay) + (21 * 3600);
    return {
      symbol,
      isOpen: false,
      isWeekendClosed: true,
      status: 'WEEKEND_CLOSED',
      statusLabel: 'WEEKEND CLOSED',
      reason: 'Traditional markets closed for the weekend (Mon-Fri only). Re-opens Sunday 21:00 UTC.',
      reopensAt: 'Sunday 21:00 UTC',
      tradingHoursDescription: 'Monday to Friday only (Except BTCUSD)',
      isCrypto247: false,
      secondsUntilOpen: secondsRemaining,
    };
  }

  // Sunday: Closed until 21:00 UTC (Sydney Session Open)
  if (day === 0) {
    if (minuteOfDay < 21 * 60) {
      const targetSecond = 21 * 3600;
      const secondsRemaining = Math.max(0, targetSecond - secondOfDay);
      return {
        symbol,
        isOpen: false,
        isWeekendClosed: true,
        status: 'WEEKEND_CLOSED',
        statusLabel: 'WEEKEND CLOSED',
        reason: 'Traditional markets closed for the weekend (Mon-Fri only). Re-opens Sunday 21:00 UTC.',
        reopensAt: 'Sunday 21:00 UTC',
        tradingHoursDescription: 'Monday to Friday only (Except BTCUSD)',
        isCrypto247: false,
        secondsUntilOpen: secondsRemaining,
      };
    }
    return {
      symbol,
      isOpen: true,
      isWeekendClosed: false,
      status: 'OPEN',
      statusLabel: 'MARKET OPEN',
      reason: 'Sydney session open (Interbank flow active)',
      closesAt: 'Friday 21:00 UTC',
      tradingHoursDescription: 'Monday to Friday (Open Sun 21:00 UTC - Fri 21:00 UTC)',
      isCrypto247: false,
    };
  }

  // Friday: Closes at 21:00 UTC (New York Session Close)
  if (day === 5) {
    if (minuteOfDay >= 21 * 60) {
      // Reopens Sunday 21:00 UTC. Seconds remaining:
      // Friday remaining: 86400 - secondOfDay
      // Saturday full day: 86400
      // Sunday 21 hours: 21 * 3600
      const secondsRemaining = (86400 - secondOfDay) + 86400 + (21 * 3600);
      return {
        symbol,
        isOpen: false,
        isWeekendClosed: true,
        status: 'WEEKEND_CLOSED',
        statusLabel: 'WEEKEND CLOSED',
        reason: 'Markets closed for the weekend (Mon-Fri only). Re-opens Sunday 21:00 UTC.',
        reopensAt: 'Sunday 21:00 UTC',
        tradingHoursDescription: 'Monday to Friday only (Except BTCUSD)',
        isCrypto247: false,
        secondsUntilOpen: secondsRemaining,
      };
    }
    return {
      symbol,
      isOpen: true,
      isWeekendClosed: false,
      status: 'OPEN',
      statusLabel: 'MARKET OPEN',
      reason: 'Friday trading session active (Closes 21:00 UTC)',
      closesAt: 'Friday 21:00 UTC',
      tradingHoursDescription: 'Monday to Friday (Closes Fri 21:00 UTC)',
      isCrypto247: false,
    };
  }

  // Monday through Thursday: Open
  return {
    symbol,
    isOpen: true,
    isWeekendClosed: false,
    status: 'OPEN',
    statusLabel: 'MARKET OPEN',
    reason: 'Standard Interbank trading session active',
    closesAt: 'Friday 21:00 UTC',
    tradingHoursDescription: 'Monday to Friday only (Except BTCUSD)',
    isCrypto247: false,
  };
}

export function isMarketOpen(symbol: MarketSymbol, date: Date = new Date()): boolean {
  return getMarketHoursStatus(symbol, date).isOpen;
}

export function isGlobalWeekend(date: Date = new Date()): boolean {
  const day = date.getUTCDay();
  const hour = date.getUTCHours();
  if (day === 6) return true; // Saturday
  if (day === 0 && hour < 21) return true; // Sunday before 21:00 UTC
  if (day === 5 && hour >= 21) return true; // Friday after 21:00 UTC
  return false;
}
