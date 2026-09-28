import React, { useEffect, useState } from 'react';
import {
  Clock,
  Flame,
  Globe2,
  Info,
  Layers,
  Maximize2,
  Minimize2,
  Sparkles,
  Target,
  Zap,
} from 'lucide-react';
import {
  formatSecondsToTime,
  getLiveSessionOverview,
  MarketSessionOverview,
  SessionStatus,
  TRADING_SESSIONS,
} from '../utils/sessionManager';

interface LiveSessionBarProps {
  onSessionSelect?: (sessionId: string) => void;
}

export const LiveSessionBar: React.FC<LiveSessionBarProps> = ({ onSessionSelect }) => {
  const [overview, setOverview] = useState<MarketSessionOverview>(() => getLiveSessionOverview());
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [showSmcGuide, setShowSmcGuide] = useState<boolean>(false);

  // High-precision live clock ticking every second
  useEffect(() => {
    const update = () => {
      setOverview(getLiveSessionOverview());
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  const activeCount = overview.activeSessions.length;

  return (
    <div className="w-full bg-[#0a0e17] border-b border-slate-800 text-slate-200 select-none transition-all">
      {/* 1. COMPACT TOP RIBBON: Real-time Live Session Clock & Status */}
      <div className="flex flex-wrap items-center justify-between px-4 py-2 gap-2 text-xs font-mono">
        {/* Left: What session is open RIGHT NOW */}
        {/* Left: What session is open RIGHT NOW */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                overview.isWeekendClosed ? 'bg-amber-400' : 'bg-emerald-400'
              }`} />
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                overview.isWeekendClosed ? 'bg-amber-500' : 'bg-emerald-500'
              }`} />
            </span>
            <div className="flex items-center gap-1.5 font-bold tracking-tight">
              <span className="text-slate-400">
                {overview.isWeekendClosed ? 'MARKET STATUS:' : 'ACTIVE SESSION:'}
              </span>
              <span className={`px-2 py-0.5 rounded font-black border ${
                overview.isWeekendClosed
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
                  : overview.isLondonNyOverlap
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm animate-pulse'
                  : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
              }`}>
                {overview.isWeekendClosed
                  ? '🔒 WEEKEND: Traditional Closed • BTCUSD 24/7 Active'
                  : overview.isLondonNyOverlap
                  ? '🔥 LONDON / NY OVERLAP'
                  : overview.primaryActiveName}
              </span>
            </div>
          </div>

          {/* Weekend Crypto 24/7 Badge */}
          {overview.isWeekendClosed && (
            <div className="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-[11px] text-emerald-300 font-bold">
              <Zap className="w-3 h-3 text-emerald-400" />
              <span>BTCUSD Active 24/7</span>
            </div>
          )}

          {/* Killzone indicator if currently active */}
          {!overview.isWeekendClosed && overview.activeKillzones.length > 0 && (
            <div className="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded bg-purple-500/15 border border-purple-500/30 text-[11px] text-purple-300 font-bold">
              <Zap className="w-3 h-3 text-purple-400" />
              <span>{overview.activeKillzones[0]}</span>
            </div>
          )}

          {/* Real-time sync badge */}
          <div className="hidden md:flex items-center gap-1 text-[11px] text-slate-400 px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
            <Sparkles className="w-3 h-3 text-blue-400" />
            <span>
              {overview.isWeekendClosed
                ? 'Mon-Fri Markets Closed • Re-opens Sun 21:00 UTC'
                : `Auto-Synced Live (${activeCount} Open)`}
            </span>
          </div>
        </div>

        {/* Right: Live UTC Clock & Time till change */}
        <div className="flex items-center gap-3">
          {/* Weekend Re-open Countdown */}
          {overview.isWeekendClosed && overview.weekendSecondsUntilOpen > 0 && (
            <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] font-bold">
              <Clock className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              <span>Markets Open: <strong>{formatSecondsToTime(overview.weekendSecondsUntilOpen)}</strong></span>
            </div>
          )}

          {/* Live UTC Clock */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#131b2c] border border-slate-800 text-slate-100 font-bold">
            <Clock className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
            <span className="text-sm tracking-widest text-blue-300">{overview.currentUtcTimeStr}</span>
            <span className="text-[10px] text-slate-500 hidden sm:inline">({overview.currentLocalTimeStr} Local)</span>
          </div>

          {/* London/NY Overlap Countdown */}
          {overview.isLondonNyOverlap && (
            <div className="hidden lg:flex items-center gap-1 text-[11px] text-amber-300 px-2 py-1 rounded bg-amber-500/10 border border-amber-500/20">
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              <span>Overlap closes: <strong>{formatSecondsToTime(overview.overlapCountdownSeconds)}</strong></span>
            </div>
          )}

          {/* SMC Session Strategy Guide Button */}
          <button
            onClick={() => setShowSmcGuide(!showSmcGuide)}
            className={`flex items-center gap-1 px-2 py-1 rounded border text-[11px] transition-colors ${
              showSmcGuide
                ? 'bg-blue-600/30 text-blue-300 border-blue-500/50'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
            title="Institutional Smart Money Concepts Session Liquidity Rules"
          >
            <Info className="w-3 h-3" />
            <span className="hidden sm:inline">SMC Session Rules</span>
          </button>

          {/* Expand / Collapse Full Session Board */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition-colors"
            title={isExpanded ? 'Collapse Session Tracker' : 'Expand 24h Session Timeline & Details'}
          >
            {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* 2. EXPANDED VIEW: 4 Live Session Cards + 24-Hour Timeline Track */}
      {isExpanded && (
        <div className="px-4 pb-3 pt-1 border-t border-slate-800/80 bg-[#0d121c] space-y-2.5">
          {/* A. 4 Interactive Global Session Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            {overview.allSessions.map((status: SessionStatus) => {
              const { session, isOpen, isKillzone, timeRemainingSeconds, nextEvent, progressPercent } = status;
              const isSelected = selectedSessionId === session.id;

              return (
                <div
                  key={session.id}
                  onClick={() => {
                    setSelectedSessionId(isSelected ? null : session.id);
                    if (onSessionSelect) onSessionSelect(session.id);
                  }}
                  className={`relative p-2.5 rounded-lg border transition-all cursor-pointer ${
                    isOpen
                      ? 'bg-[#121929] border-blue-500/40 shadow-sm hover:border-blue-400'
                      : 'bg-[#0f1422]/70 border-slate-800/80 hover:border-slate-700 opacity-80 hover:opacity-100'
                  } ${isSelected ? 'ring-1 ring-blue-400' : ''}`}
                >
                  {/* Top: Flag + Session Name + Status Badge */}
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-base leading-none">{session.flag}</span>
                      <span className="font-bold text-xs text-slate-100">{session.name.replace(' Session', '')}</span>
                    </div>

                    <div className="flex items-center gap-1">
                      {isKillzone && (
                        <span className="px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 text-[9px] font-mono border border-purple-500/40 font-bold animate-pulse">
                          KZ
                        </span>
                      )}
                      <span
                        className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-black border ${
                          isOpen
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${isOpen ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                        {isOpen ? 'OPEN' : 'CLOSED'}
                      </span>
                    </div>
                  </div>

                  {/* Middle: UTC Hours & Real-time Countdown */}
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-1.5">
                    <span className="text-slate-300">
                      {session.openUtcHour.toString().padStart(2, '0')}:00 - {session.closeUtcHour.toString().padStart(2, '0')}:00 UTC
                    </span>
                    <span className={isOpen ? 'text-amber-400 font-semibold' : 'text-slate-500'}>
                      {nextEvent === 'CLOSES_IN' ? 'Closes: ' : 'Opens: '}
                      <strong>{formatSecondsToTime(timeRemainingSeconds)}</strong>
                    </span>
                  </div>

                  {/* Progress bar for active sessions */}
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-1000 ${
                        isOpen
                          ? session.id === 'NEW_YORK'
                            ? 'bg-rose-500'
                            : session.id === 'LONDON'
                            ? 'bg-blue-500'
                            : session.id === 'TOKYO'
                            ? 'bg-purple-500'
                            : 'bg-emerald-500'
                          : 'bg-slate-700'
                      }`}
                      style={{ width: `${isOpen ? progressPercent : 0}%` }}
                    />
                  </div>

                  {/* Bottom: Volatility & Key Pairs */}
                  <div className="flex items-center justify-between text-[10px] font-mono mt-1.5 text-slate-400 pt-1 border-t border-slate-800/60">
                    <span className="flex items-center gap-1">
                      <span className="text-slate-500">Vol:</span>
                      <strong className={
                        session.volatility === 'EXTREME'
                          ? 'text-rose-400'
                          : session.volatility === 'HIGH'
                          ? 'text-amber-400'
                          : session.volatility === 'MEDIUM'
                          ? 'text-blue-400'
                          : 'text-slate-400'
                      }>
                        {session.volatility}
                      </strong>
                    </span>
                    <span className="text-slate-400 truncate max-w-[120px]" title={session.primaryPairs.join(', ')}>
                      {session.primaryPairs.slice(0, 2).join(' · ')}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* B. 24-HOUR INTERACTIVE VISUAL TIMELINE WITH CURRENT TIME NEEDLE */}
          <div className="bg-[#0a0e17] p-2.5 rounded-lg border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
              <div className="flex items-center gap-2">
                <Globe2 className="w-3.5 h-3.5 text-blue-400" />
                <span className="font-bold text-slate-300">24-Hour Global Market Cycle (UTC)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-amber-400 font-semibold">
                  NOW: {overview.currentUtcTimeStr} ({overview.dayProgressPercent.toFixed(1)}% of trading day)
                </span>
              </div>
            </div>

            {/* Timeline Track */}
            <div className="relative w-full h-8 bg-slate-900/90 rounded border border-slate-800 overflow-hidden">
              {/* Session Colored Horizontal Bands */}
              {/* Tokyo: 00:00 - 09:00 UTC (0% to 37.5%) */}
              <div
                className="absolute top-0 bottom-0 bg-purple-500/25 border-r border-purple-500/50 flex items-center justify-center text-[10px] font-mono font-bold text-purple-300"
                style={{ left: '0%', width: '37.5%' }}
                title="Tokyo / Asian Session (00:00 - 09:00 UTC)"
              >
                <span className="truncate px-1">🇯🇵 Tokyo (00-09)</span>
              </div>

              {/* London: 07:00 - 16:00 UTC (29.16% to 66.66%) */}
              <div
                className="absolute top-0 bottom-0 bg-blue-500/25 border-x border-blue-500/50 flex items-center justify-center text-[10px] font-mono font-bold text-blue-300"
                style={{ left: '29.16%', width: '37.5%' }}
                title="London Session (07:00 - 16:00 UTC)"
              >
                <span className="truncate px-1">🇬🇧 London (07-16)</span>
              </div>

              {/* London / NY Overlap Highlight: 12:00 - 16:00 UTC (50% to 66.66%) */}
              <div
                className="absolute top-0 bottom-0 bg-amber-500/35 border-x-2 border-amber-400 z-10 flex items-center justify-center text-[9.5px] font-mono font-black text-amber-200"
                style={{ left: '50%', width: '16.66%' }}
                title="🔥 LONDON / NY OVERLAP (12:00 - 16:00 UTC) - Highest Liquidity Window"
              >
                <span className="truncate px-1 font-black">🔥 OVERLAP</span>
              </div>

              {/* New York: 12:00 - 21:00 UTC (50% to 87.5%) */}
              <div
                className="absolute top-0 bottom-0 bg-rose-500/20 border-r border-rose-500/50 flex items-center justify-end text-[10px] font-mono font-bold text-rose-300 pr-2"
                style={{ left: '50%', width: '37.5%' }}
                title="New York Session (12:00 - 21:00 UTC)"
              >
                <span className="truncate px-1">🇺🇸 NY (12-21)</span>
              </div>

              {/* Sydney: 21:00 - 06:00 UTC (87.5% to 100% and 0% to 25%) */}
              <div
                className="absolute top-0 bottom-0 bg-emerald-500/20 border-l border-emerald-500/50 flex items-center justify-center text-[9.5px] font-mono font-bold text-emerald-300"
                style={{ left: '87.5%', width: '12.5%' }}
                title="Sydney Session (21:00 - 24:00 UTC)"
              >
                <span className="truncate px-1">🇦🇺 Sydney</span>
              </div>

              {/* REAL-TIME CURRENT TIME NEEDLE (Pulsing Red/Amber Vertical Line) */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-red-400 z-20 pointer-events-none shadow-[0_0_8px_#ef4444]"
                style={{ left: `${Math.min(99.8, Math.max(0.2, overview.dayProgressPercent))}%` }}
              >
                <div className="absolute -top-1 -translate-x-1/2 w-2 h-2 rounded-full bg-red-400 shadow-md animate-ping" />
                <div className="absolute -top-1 -translate-x-1/2 w-2 h-2 rounded-full bg-red-500 border border-white" />
              </div>
            </div>

            {/* Hour Markers (00 to 24 UTC) */}
            <div className="flex justify-between text-[9px] font-mono text-slate-500 px-0.5">
              <span>00:00</span>
              <span>03:00</span>
              <span>06:00</span>
              <span>09:00</span>
              <span>12:00</span>
              <span>15:00</span>
              <span>18:00</span>
              <span>21:00</span>
              <span>24:00</span>
            </div>
          </div>

          {/* C. SMC SESSION LIQUIDITY GUIDE (Expandable) */}
          {showSmcGuide && (
            <div className="bg-[#111827] border border-blue-500/30 rounded-lg p-3 text-xs font-mono space-y-2">
              <div className="flex items-center gap-1.5 font-bold text-blue-300">
                <Layers className="w-3.5 h-3.5 text-blue-400" />
                <span>Institutional Smart Money Session Liquidity Roadmap:</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-[11px] text-slate-300">
                <div className="bg-[#0b0f19] p-2 rounded border border-slate-800">
                  <div className="font-bold text-purple-400 mb-1">1. Asian Session (00:00 - 09:00 UTC)</div>
                  <p className="text-slate-400 leading-relaxed">
                    Builds the baseline <strong>Asian High & Low</strong>. Algorithms deliberately engineer liquidity pools on both sides of this range without committing to true direction.
                  </p>
                </div>
                <div className="bg-[#0b0f19] p-2 rounded border border-slate-800">
                  <div className="font-bold text-blue-400 mb-1">2. London Session (07:00 - 16:00 UTC)</div>
                  <p className="text-slate-400 leading-relaxed">
                    Initiates the <strong>Judas Swing</strong>: False breakout sweeping the Asian High/Low, grabbing retail stop losses, then aggressively reversing in the genuine institutional direction.
                  </p>
                </div>
                <div className="bg-[#0b0f19] p-2 rounded border border-slate-800">
                  <div className="font-bold text-rose-400 mb-1">3. New York Session (12:00 - 21:00 UTC)</div>
                  <p className="text-slate-400 leading-relaxed">
                    Injects macro interbank volume during the <strong>12:00-16:00 Overlap</strong>. Expands the London trend or engineers a multi-timeframe reversal after London high/low is swept.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
