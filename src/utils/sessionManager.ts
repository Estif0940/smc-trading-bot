export interface TradingSession {
  id: 'SYDNEY' | 'TOKYO' | 'LONDON' | 'NEW_YORK';
  name: string;
  city: string;
  flag: string;
  openUtcHour: number; // 0-23
  openUtcMinute: number;
  closeUtcHour: number;
  closeUtcMinute: number;
  spansMidnight: boolean;
  volatility: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
  primaryPairs: string[];
  killzoneName?: string;
  killzoneStartHour?: number;
  killzoneEndHour?: number;
  smcFocus: string;
}

export const TRADING_SESSIONS: TradingSession[] = [
  {
    id: 'SYDNEY',
    name: 'Sydney Session',
    city: 'Sydney (AEST)',
    flag: '🇦🇺',
    openUtcHour: 21,
    openUtcMinute: 0,
    closeUtcHour: 6,
    closeUtcMinute: 0,
    spansMidnight: true,
    volatility: 'LOW',
    primaryPairs: ['AUDUSD', 'NZDUSD', 'AUDJPY'],
    smcFocus: 'Initial liquidity building, wide spreads, consolidation before Tokyo open.',
  },
  {
    id: 'TOKYO',
    name: 'Tokyo / Asian Session',
    city: 'Tokyo (JST)',
    flag: '🇯🇵',
    openUtcHour: 0,
    openUtcMinute: 0,
    closeUtcHour: 9,
    closeUtcMinute: 0,
    spansMidnight: false,
    volatility: 'MEDIUM',
    primaryPairs: ['USDJPY', 'EURJPY', 'GBPUSD', 'XAUUSD'],
    killzoneName: 'Asian Killzone (00:00 - 04:00 UTC)',
    killzoneStartHour: 0,
    killzoneEndHour: 4,
    smcFocus: 'Asian Range Formation: Establishes high & low liquidity benchmarks swept during London Open.',
  },
  {
    id: 'LONDON',
    name: 'London Session',
    city: 'London (BST/GMT)',
    flag: '🇬🇧',
    openUtcHour: 7,
    openUtcMinute: 0,
    closeUtcHour: 16,
    closeUtcMinute: 0,
    spansMidnight: false,
    volatility: 'HIGH',
    primaryPairs: ['EURUSD', 'GBPUSD', 'XAUUSD', 'EURGBP'],
    killzoneName: 'London Open Killzone (07:00 - 10:00 UTC)',
    killzoneStartHour: 7,
    killzoneEndHour: 10,
    smcFocus: 'Judas Swing & Institutional Accumulation: Sweeps Asian session liquidity to engineer true trend.',
  },
  {
    id: 'NEW_YORK',
    name: 'New York Session',
    city: 'New York (EDT/EST)',
    flag: '🇺🇸',
    openUtcHour: 12,
    openUtcMinute: 0,
    closeUtcHour: 21,
    closeUtcMinute: 0,
    spansMidnight: false,
    volatility: 'EXTREME',
    primaryPairs: ['XAUUSD', 'EURUSD', 'GBPUSD', 'BTCUSD', 'ETHUSD'],
    killzoneName: 'NY Open Killzone (12:00 - 15:00 UTC)',
    killzoneStartHour: 12,
    killzoneEndHour: 15,
    smcFocus: 'Major USD Macro Flow: Highest volume expansion, news volatility releases, institutional distribution.',
  },
];

export interface SessionStatus {
  session: TradingSession;
  isOpen: boolean;
  isKillzone: boolean;
  progressPercent: number; // 0-100% of current session elapsed
  timeRemainingSeconds: number; // time to close if open, time to open if closed
  nextEvent: 'CLOSES_IN' | 'OPENS_IN';
}

import { isGlobalWeekend } from './marketHours.js';

export interface MarketSessionOverview {
  currentUtcTimeStr: string;
  currentLocalTimeStr: string;
  utcDate: Date;
  activeSessions: SessionStatus[];
  allSessions: SessionStatus[];
  isLondonNyOverlap: boolean;
  overlapCountdownSeconds: number;
  primaryActiveName: string;
  primaryActiveColor: string;
  activeKillzones: string[];
  dayProgressPercent: number; // 0-100% of the 24h UTC day
  currentMinuteOfDay: number;
  isWeekendClosed: boolean;
  weekendSecondsUntilOpen: number;
}

/**
 * Check if a session is currently open given UTC hour & minute
 */
export function isSessionActive(session: TradingSession, utcHour: number, utcMinute: number): boolean {
  const currentTotal = utcHour * 60 + utcMinute;
  const openTotal = session.openUtcHour * 60 + session.openUtcMinute;
  const closeTotal = session.closeUtcHour * 60 + session.closeUtcMinute;

  if (!session.spansMidnight) {
    return currentTotal >= openTotal && currentTotal < closeTotal;
  } else {
    // Spans midnight, e.g. 21:00 to 06:00
    return currentTotal >= openTotal || currentTotal < closeTotal;
  }
}

/**
 * Check if a killzone is currently active
 */
export function isKillzoneActive(session: TradingSession, utcHour: number): boolean {
  if (session.killzoneStartHour === undefined || session.killzoneEndHour === undefined) return false;
  return utcHour >= session.killzoneStartHour && utcHour < session.killzoneEndHour;
}

/**
 * Calculate seconds remaining until next open or close event
 */
export function calculateTimeRemaining(
  session: TradingSession,
  now: Date
): { nextEvent: 'CLOSES_IN' | 'OPENS_IN'; seconds: number; progressPercent: number } {
  const utcHour = now.getUTCHours();
  const utcMinute = now.getUTCMinutes();
  const utcSecond = now.getUTCSeconds();
  const currentSecondsOfDay = utcHour * 3600 + utcMinute * 60 + utcSecond;

  const openSeconds = (session.openUtcHour * 60 + session.openUtcMinute) * 60;
  const closeSeconds = (session.closeUtcHour * 60 + session.closeUtcMinute) * 60;
  const totalDaySeconds = 86400;

  const isOpen = isSessionActive(session, utcHour, utcMinute);

  if (isOpen) {
    let diff = 0;
    let duration = 0;
    if (!session.spansMidnight) {
      diff = closeSeconds - currentSecondsOfDay;
      duration = closeSeconds - openSeconds;
    } else {
      if (currentSecondsOfDay >= openSeconds) {
        diff = totalDaySeconds - currentSecondsOfDay + closeSeconds;
      } else {
        diff = closeSeconds - currentSecondsOfDay;
      }
      duration = totalDaySeconds - openSeconds + closeSeconds;
    }
    const elapsed = Math.max(0, duration - diff);
    const progress = duration > 0 ? Math.min(100, Math.max(0, (elapsed / duration) * 100)) : 0;
    return { nextEvent: 'CLOSES_IN', seconds: Math.max(0, diff), progressPercent: progress };
  } else {
    let diff = 0;
    if (currentSecondsOfDay < openSeconds) {
      diff = openSeconds - currentSecondsOfDay;
    } else {
      diff = totalDaySeconds - currentSecondsOfDay + openSeconds;
    }
    return { nextEvent: 'OPENS_IN', seconds: Math.max(0, diff), progressPercent: 0 };
  }
}

/**
 * Get comprehensive, real-time trading session status
 */
export function getLiveSessionOverview(now: Date = new Date()): MarketSessionOverview {
  const utcHour = now.getUTCHours();
  const utcMinute = now.getUTCMinutes();
  const utcSecond = now.getUTCSeconds();
  const currentMinuteOfDay = utcHour * 60 + utcMinute;
  const currentSecondsOfDay = utcHour * 3600 + utcMinute * 60 + utcSecond;
  const dayProgressPercent = (currentSecondsOfDay / 86400) * 100;

  const isWeekend = isGlobalWeekend(now);
  const day = now.getUTCDay();
  let weekendSecondsUntilOpen = 0;

  if (isWeekend) {
    if (day === 6) {
      // Saturday
      weekendSecondsUntilOpen = (86400 - currentSecondsOfDay) + (21 * 3600);
    } else if (day === 0) {
      // Sunday before 21:00 UTC
      weekendSecondsUntilOpen = Math.max(0, (21 * 3600) - currentSecondsOfDay);
    } else if (day === 5) {
      // Friday after 21:00 UTC
      weekendSecondsUntilOpen = (86400 - currentSecondsOfDay) + 86400 + (21 * 3600);
    }
  }

  const allSessions: SessionStatus[] = TRADING_SESSIONS.map((session) => {
    const rawOpen = isSessionActive(session, utcHour, utcMinute);
    const isOpen = !isWeekend && rawOpen;
    const isKillzone = !isWeekend && isKillzoneActive(session, utcHour);
    const { nextEvent, seconds, progressPercent } = calculateTimeRemaining(session, now);

    return {
      session,
      isOpen,
      isKillzone,
      progressPercent,
      timeRemainingSeconds: seconds,
      nextEvent,
    };
  });

  const activeSessions = allSessions.filter((s) => s.isOpen);

  // London / New York Overlap is 12:00 to 16:00 UTC (weekdays only)
  const isLondonNyOverlap = !isWeekend && utcHour >= 12 && utcHour < 16;
  const overlapEndSeconds = 16 * 3600;
  const overlapCountdownSeconds = isLondonNyOverlap ? Math.max(0, overlapEndSeconds - currentSecondsOfDay) : 0;

  // Active Killzones list
  const activeKillzones: string[] = [];
  if (!isWeekend) {
    allSessions.forEach((s) => {
      if (s.isKillzone && s.session.killzoneName) {
        activeKillzones.push(s.session.killzoneName);
      }
    });
  }

  // Determine Primary Active Name & Branding Color
  let primaryActiveName = 'Market Pre-Session';
  let primaryActiveColor = 'text-slate-400';

  if (isWeekend) {
    primaryActiveName = 'WEEKEND: Traditional Markets Closed • BTCUSD 24/7 Active';
    primaryActiveColor = 'text-amber-400';
  } else if (isLondonNyOverlap) {
    primaryActiveName = 'LONDON / NY OVERLAP (Peak Volatility)';
    primaryActiveColor = 'text-amber-400';
  } else if (activeSessions.length > 0) {
    primaryActiveName = activeSessions.map((s) => s.session.name).join(' & ');
    if (activeSessions.some((s) => s.session.id === 'NEW_YORK')) {
      primaryActiveColor = 'text-rose-400';
    } else if (activeSessions.some((s) => s.session.id === 'LONDON')) {
      primaryActiveColor = 'text-blue-400';
    } else if (activeSessions.some((s) => s.session.id === 'TOKYO')) {
      primaryActiveColor = 'text-purple-400';
    } else {
      primaryActiveColor = 'text-emerald-400';
    }
  }

  // Format UTC & Local Time Strings
  const pad = (n: number) => n.toString().padStart(2, '0');
  const currentUtcTimeStr = `${pad(utcHour)}:${pad(utcMinute)}:${pad(utcSecond)} UTC`;
  const currentLocalTimeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return {
    currentUtcTimeStr,
    currentLocalTimeStr,
    utcDate: now,
    activeSessions,
    allSessions,
    isLondonNyOverlap,
    overlapCountdownSeconds,
    primaryActiveName,
    primaryActiveColor,
    activeKillzones,
    dayProgressPercent,
    currentMinuteOfDay,
    isWeekendClosed: isWeekend,
    weekendSecondsUntilOpen,
  };
}

/**
 * Format seconds into Hh Mm Ss format
 */
export function formatSecondsToTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}h ${m}m ${s}s`;
  }
  return `${m}m ${s}s`;
}
