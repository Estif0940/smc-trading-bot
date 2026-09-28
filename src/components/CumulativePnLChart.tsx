import React, { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  DollarSign,
  Filter,
  Layers,
  LineChart as LineChartIcon,
  Percent,
  Sparkles,
  TrendingDown,
  TrendingUp,
  XCircle,
} from 'lucide-react';
import { TradeSetup, TradingStats } from '../types';

interface CumulativePnLChartProps {
  history: TradeSetup[];
  stats: TradingStats;
}

interface ChartDataPoint {
  index: number;
  label: string;
  symbol: string;
  direction: string;
  tradePnL: number;
  cumulativePnL: number;
  outcome: string;
  time: string;
  closeReason?: string;
  tradeId?: string;
}

export const CumulativePnLChart: React.FC<CumulativePnLChartProps> = ({ history, stats }) => {
  const [chartType, setChartType] = useState<'line' | 'area'>('line');
  const [viewMetric, setViewMetric] = useState<'cumulative' | 'individual'>('cumulative');
  const [selectedSymbol, setSelectedSymbol] = useState<string>('ALL');

  // Available symbols from trade history
  const availableSymbols = useMemo(() => {
    const symbols = new Set<string>();
    history.forEach((t) => {
      if (t.symbol) symbols.add(t.symbol);
    });
    return Array.from(symbols);
  }, [history]);

  // Filter history based on selected symbol
  const filteredHistory = useMemo(() => {
    if (selectedSymbol === 'ALL') return history;
    return history.filter((t) => t.symbol === selectedSymbol);
  }, [history, selectedSymbol]);

  // Compute chronologically sorted cumulative PnL series
  const {
    chartData,
    latestCumulative,
    peakProfit,
    maxDrawdown,
    bestTrade,
    worstTrade,
    winCount,
    lossCount,
    winRateFiltered,
    profitFactor,
  } = useMemo(() => {
    if (!filteredHistory || filteredHistory.length === 0) {
      return {
        chartData: [
          {
            index: 0,
            label: 'Start ($0)',
            symbol: 'START',
            direction: '-',
            tradePnL: 0,
            cumulativePnL: 0,
            outcome: 'START',
            time: 'Baseline',
          },
        ],
        latestCumulative: 0,
        peakProfit: 0,
        maxDrawdown: 0,
        bestTrade: 0,
        worstTrade: 0,
        winCount: 0,
        lossCount: 0,
        winRateFiltered: 0,
        profitFactor: 0,
      };
    }

    // Sort chronologically (oldest closed trade first)
    const sorted = [...filteredHistory].sort(
      (a, b) => (a.closedAt || a.executedAt || 0) - (b.closedAt || b.executedAt || 0)
    );

    let runningTotal = 0;
    let peak = 0;
    let maxDd = 0;
    let grossProfit = 0;
    let grossLoss = 0;
    let wins = 0;
    let losses = 0;

    const points: ChartDataPoint[] = [
      {
        index: 0,
        label: 'Start ($0)',
        symbol: 'START',
        direction: '-',
        tradePnL: 0,
        cumulativePnL: 0,
        outcome: 'START',
        time: 'Baseline',
      },
    ];

    sorted.forEach((trade, idx) => {
      const pnl = trade.profitAmount !== undefined ? trade.profitAmount : 0;
      runningTotal = parseFloat((runningTotal + pnl).toFixed(2));

      if (pnl > 0) {
        grossProfit += pnl;
        wins++;
      } else if (pnl < 0) {
        grossLoss += Math.abs(pnl);
        losses++;
      }

      if (runningTotal > peak) {
        peak = runningTotal;
      }
      const dd = peak - runningTotal;
      if (dd > maxDd) {
        maxDd = dd;
      }

      points.push({
        index: idx + 1,
        label: `T#${idx + 1}`,
        symbol: trade.symbol,
        direction: trade.direction,
        tradePnL: pnl,
        cumulativePnL: runningTotal,
        outcome: trade.outcome || (pnl >= 0 ? 'WIN' : 'LOSS'),
        time: trade.closedAt
          ? new Date(trade.closedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : `Trade ${idx + 1}`,
        closeReason: trade.closeReason,
        tradeId: trade.id,
      });
    });

    const pnlList = sorted.map((t) => t.profitAmount || 0);
    const best = pnlList.length > 0 ? Math.max(...pnlList) : 0;
    const worst = pnlList.length > 0 ? Math.min(...pnlList) : 0;
    const wr = sorted.length > 0 ? parseFloat(((wins / sorted.length) * 100).toFixed(1)) : 0;
    const pf = grossLoss > 0 ? parseFloat((grossProfit / grossLoss).toFixed(2)) : grossProfit > 0 ? 99.9 : 0;

    return {
      chartData: points,
      latestCumulative: runningTotal,
      peakProfit: peak,
      maxDrawdown: parseFloat(maxDd.toFixed(2)),
      bestTrade: best,
      worstTrade: worst,
      winCount: wins,
      lossCount: losses,
      winRateFiltered: wr,
      profitFactor: pf,
    };
  }, [filteredHistory]);

  const isOverallPositive = latestCumulative >= 0;
  const strokeColor = isOverallPositive ? '#10b981' : '#f43f5e';

  return (
    <div
      id="cumulative-pnl-section"
      className="bg-[#0f141f] border border-[#1e293b] rounded-xl p-4 shadow-xl space-y-4"
    >
      {/* Section Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#1e293b]">
        <div className="flex items-center gap-2.5">
          <div
            className={`p-2 rounded-lg ${
              isOverallPositive
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
            }`}
          >
            {isOverallPositive ? (
              <TrendingUp className="w-4 h-4" />
            ) : (
              <TrendingDown className="w-4 h-4" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <span>Cumulative Profit / Loss Performance</span>
                <span className="text-[10px] text-blue-400 font-mono font-semibold px-1.5 py-0.2 rounded bg-blue-500/15 border border-blue-500/30">
                  RECHARTS
                </span>
              </h3>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold uppercase ${
                  isOverallPositive
                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                    : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                }`}
              >
                {isOverallPositive ? 'Profitable Equity' : 'Drawdown Phase'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono">
              Real-time balance equity curve calculated from {filteredHistory.length} closed trade{filteredHistory.length === 1 ? '' : 's'}
            </p>
          </div>
        </div>

        {/* View Controls & Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Symbol Filter */}
          {availableSymbols.length > 1 && (
            <div className="flex items-center gap-1 bg-[#151b28] px-2 py-1 rounded-lg border border-slate-800 text-xs font-mono">
              <Filter className="w-3 h-3 text-slate-400" />
              <select
                id="select-symbol-filter-pnl"
                value={selectedSymbol}
                onChange={(e) => setSelectedSymbol(e.target.value)}
                className="bg-transparent text-slate-200 border-none outline-none text-xs font-mono cursor-pointer"
              >
                <option value="ALL" className="bg-[#151b28]">All Markets ({history.length})</option>
                {availableSymbols.map((sym) => (
                  <option key={sym} value={sym} className="bg-[#151b28]">
                    {sym} ({history.filter((t) => t.symbol === sym).length})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Metric Toggle: Cumulative vs Per-Trade */}
          <div className="flex items-center rounded-lg bg-[#151b28] p-0.5 border border-slate-800 text-[11px] font-mono">
            <button
              id="btn-toggle-cumulative-metric"
              onClick={() => setViewMetric('cumulative')}
              className={`px-2.5 py-1 rounded transition-colors ${
                viewMetric === 'cumulative'
                  ? 'bg-blue-600 text-white font-semibold shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Cumulative P&L
            </button>
            <button
              id="btn-toggle-individual-metric"
              onClick={() => setViewMetric('individual')}
              className={`px-2.5 py-1 rounded transition-colors ${
                viewMetric === 'individual'
                  ? 'bg-blue-600 text-white font-semibold shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Per-Trade Return
            </button>
          </div>

          {/* Chart Style Toggle: Line vs Area */}
          <div className="flex items-center rounded-lg bg-[#151b28] p-0.5 border border-slate-800 text-[11px] font-mono">
            <button
              id="btn-toggle-line-chart"
              onClick={() => setChartType('line')}
              className={`px-2 py-1 rounded transition-colors flex items-center gap-1 ${
                chartType === 'line'
                  ? 'bg-slate-700 text-white font-semibold shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Clean Line Chart"
            >
              <LineChartIcon className="w-3 h-3" />
              <span>Line</span>
            </button>
            <button
              id="btn-toggle-area-chart"
              onClick={() => setChartType('area')}
              className={`px-2 py-1 rounded transition-colors flex items-center gap-1 ${
                chartType === 'area'
                  ? 'bg-slate-700 text-white font-semibold shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Shaded Area Gradient"
            >
              <Layers className="w-3 h-3" />
              <span>Area</span>
            </button>
          </div>
        </div>
      </div>

      {/* Analytics KPI Dashboard Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs font-mono">
        <div className="bg-[#151b28] p-2.5 rounded-lg border border-slate-800">
          <span className="text-slate-400 text-[10px] block">Net Realized P&L</span>
          <span
            className={`text-sm sm:text-base font-bold block mt-0.5 ${
              latestCumulative >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {latestCumulative >= 0 ? '+' : ''}${latestCumulative.toFixed(2)}
          </span>
        </div>

        <div className="bg-[#151b28] p-2.5 rounded-lg border border-slate-800">
          <span className="text-slate-400 text-[10px] block">Peak High Watermark</span>
          <span className="text-sm sm:text-base font-bold text-emerald-300 block mt-0.5">
            +${peakProfit.toFixed(2)}
          </span>
        </div>

        <div className="bg-[#151b28] p-2.5 rounded-lg border border-slate-800">
          <span className="text-slate-400 text-[10px] block">Max Drawdown</span>
          <span className="text-sm sm:text-base font-bold text-rose-400 block mt-0.5">
            -${maxDrawdown.toFixed(2)}
          </span>
        </div>

        <div className="bg-[#151b28] p-2.5 rounded-lg border border-slate-800">
          <span className="text-slate-400 text-[10px] block">Profit Factor</span>
          <span className="text-sm sm:text-base font-bold text-amber-400 block mt-0.5">
            {profitFactor > 0 ? profitFactor.toFixed(2) : '-'}
          </span>
        </div>

        <div className="bg-[#151b28] p-2.5 rounded-lg border border-slate-800">
          <span className="text-slate-400 text-[10px] block">Win Ratio</span>
          <span className="text-sm sm:text-base font-bold text-white block mt-0.5">
            {winRateFiltered}% <span className="text-[10px] text-slate-400 font-normal">({winCount}W / {lossCount}L)</span>
          </span>
        </div>

        <div className="bg-[#151b28] p-2.5 rounded-lg border border-slate-800">
          <span className="text-slate-400 text-[10px] block">Best / Worst</span>
          <div className="flex items-center gap-1.5 text-xs font-bold mt-0.5">
            <span className="text-emerald-400">+{bestTrade > 0 ? `$${bestTrade.toFixed(0)}` : '$0'}</span>
            <span className="text-slate-600">/</span>
            <span className="text-rose-400">{worstTrade < 0 ? `-$${Math.abs(worstTrade).toFixed(0)}` : '$0'}</span>
          </div>
        </div>
      </div>

      {/* Recharts Chart Container */}
      <div className="w-full h-72 bg-[#0b0f17] p-3 rounded-xl border border-slate-800/80">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === 'line' ? (
            <LineChart
              data={chartData}
              margin={{ top: 12, right: 20, left: -5, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.6} />

              <XAxis
                dataKey="label"
                stroke="#64748b"
                fontSize={10}
                tickLine={false}
                tickMargin={6}
                fontFamily="monospace"
              />

              <YAxis
                stroke="#64748b"
                fontSize={10}
                tickLine={false}
                tickFormatter={(val) => `$${val}`}
                domain={['auto', 'auto']}
                fontFamily="monospace"
              />

              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload as ChartDataPoint;
                    const isPositive = data.cumulativePnL >= 0;
                    const isTradePos = data.tradePnL >= 0;

                    return (
                      <div className="bg-[#0f141f]/95 border border-slate-700 p-3 rounded-xl shadow-2xl backdrop-blur-md text-xs font-mono space-y-1.5 min-w-48">
                        <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
                          <span className="font-bold text-white flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-blue-400" />
                            <span>{data.label}</span>
                          </span>
                          {data.outcome !== 'START' && (
                            <span
                              className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                data.outcome === 'WIN'
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              }`}
                            >
                              {data.outcome}
                            </span>
                          )}
                        </div>

                        {data.symbol !== 'START' && (
                          <div className="text-[11px] text-slate-300 flex justify-between">
                            <span className="text-slate-400">Position:</span>
                            <span className="font-semibold text-white">
                              {data.symbol} {data.direction}
                            </span>
                          </div>
                        )}

                        {data.index > 0 && (
                          <div className="text-[11px] flex justify-between">
                            <span className="text-slate-400">Trade P&L:</span>
                            <span className={`font-bold ${isTradePos ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {isTradePos ? '+' : ''}${data.tradePnL.toFixed(2)}
                            </span>
                          </div>
                        )}

                        <div className="text-[11px] flex justify-between pt-1 border-t border-slate-800/80">
                          <span className="text-slate-400 font-medium">Cumulative P&L:</span>
                          <span className={`font-black ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {isPositive ? '+' : ''}${data.cumulativePnL.toFixed(2)}
                          </span>
                        </div>

                        {data.closeReason && (
                          <div className="text-[10px] text-slate-400 pt-0.5">
                            Trigger: <span className="text-amber-300">{data.closeReason}</span>
                          </div>
                        )}

                        <div className="text-[9px] text-slate-500 pt-0.5 flex justify-between">
                          <span>Closed: {data.time}</span>
                          {data.tradeId && <span>{data.tradeId.substring(0, 8)}</span>}
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />

              <ReferenceLine y={0} stroke="#64748b" strokeDasharray="4 4" strokeWidth={1.5} />

              <Line
                type="monotone"
                dataKey={viewMetric === 'cumulative' ? 'cumulativePnL' : 'tradePnL'}
                stroke={viewMetric === 'individual' ? '#3b82f6' : strokeColor}
                strokeWidth={3}
                dot={{
                  r: 4,
                  fill: '#0b0f17',
                  stroke: viewMetric === 'individual' ? '#3b82f6' : strokeColor,
                  strokeWidth: 2,
                }}
                activeDot={{
                  r: 7,
                  fill: viewMetric === 'individual' ? '#60a5fa' : isOverallPositive ? '#34d399' : '#fb7185',
                  stroke: '#ffffff',
                  strokeWidth: 2,
                }}
              />
            </LineChart>
          ) : (
            <AreaChart
              data={chartData}
              margin={{ top: 12, right: 20, left: -5, bottom: 5 }}
            >
              <defs>
                <linearGradient id="pnlGreenGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.45} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="pnlRedGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.45} />
                  <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="pnlBlueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.45} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.6} />

              <XAxis
                dataKey="label"
                stroke="#64748b"
                fontSize={10}
                tickLine={false}
                tickMargin={6}
                fontFamily="monospace"
              />

              <YAxis
                stroke="#64748b"
                fontSize={10}
                tickLine={false}
                tickFormatter={(val) => `$${val}`}
                domain={['auto', 'auto']}
                fontFamily="monospace"
              />

              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload as ChartDataPoint;
                    const isPositive = data.cumulativePnL >= 0;
                    const isTradePos = data.tradePnL >= 0;

                    return (
                      <div className="bg-[#0f141f]/95 border border-slate-700 p-3 rounded-xl shadow-2xl backdrop-blur-md text-xs font-mono space-y-1.5 min-w-48">
                        <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
                          <span className="font-bold text-white flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-blue-400" />
                            <span>{data.label}</span>
                          </span>
                          {data.outcome !== 'START' && (
                            <span
                              className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                data.outcome === 'WIN'
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              }`}
                            >
                              {data.outcome}
                            </span>
                          )}
                        </div>

                        {data.symbol !== 'START' && (
                          <div className="text-[11px] text-slate-300 flex justify-between">
                            <span className="text-slate-400">Position:</span>
                            <span className="font-semibold text-white">
                              {data.symbol} {data.direction}
                            </span>
                          </div>
                        )}

                        {data.index > 0 && (
                          <div className="text-[11px] flex justify-between">
                            <span className="text-slate-400">Trade P&L:</span>
                            <span className={`font-bold ${isTradePos ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {isTradePos ? '+' : ''}${data.tradePnL.toFixed(2)}
                            </span>
                          </div>
                        )}

                        <div className="text-[11px] flex justify-between pt-1 border-t border-slate-800/80">
                          <span className="text-slate-400 font-medium">Cumulative P&L:</span>
                          <span className={`font-black ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {isPositive ? '+' : ''}${data.cumulativePnL.toFixed(2)}
                          </span>
                        </div>

                        {data.closeReason && (
                          <div className="text-[10px] text-slate-400 pt-0.5">
                            Trigger: <span className="text-amber-300">{data.closeReason}</span>
                          </div>
                        )}

                        <div className="text-[9px] text-slate-500 pt-0.5 flex justify-between">
                          <span>Closed: {data.time}</span>
                          {data.tradeId && <span>{data.tradeId.substring(0, 8)}</span>}
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />

              <ReferenceLine y={0} stroke="#64748b" strokeDasharray="4 4" strokeWidth={1.5} />

              <Area
                type="monotone"
                dataKey={viewMetric === 'cumulative' ? 'cumulativePnL' : 'tradePnL'}
                stroke={viewMetric === 'individual' ? '#3b82f6' : strokeColor}
                strokeWidth={2.5}
                fillOpacity={1}
                fill={
                  viewMetric === 'individual'
                    ? 'url(#pnlBlueGradient)'
                    : isOverallPositive
                    ? 'url(#pnlGreenGradient)'
                    : 'url(#pnlRedGradient)'
                }
                dot={{
                  r: 3.5,
                  fill: '#0b0f17',
                  stroke: viewMetric === 'individual' ? '#3b82f6' : strokeColor,
                  strokeWidth: 2,
                }}
                activeDot={{
                  r: 6.5,
                  fill: viewMetric === 'individual' ? '#60a5fa' : isOverallPositive ? '#34d399' : '#fb7185',
                  stroke: '#ffffff',
                  strokeWidth: 2,
                }}
              />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Empty State Helper Notice if no trades yet */}
      {filteredHistory.length === 0 && (
        <div className="p-3 rounded-lg bg-[#151b28] border border-slate-800 text-center text-xs text-slate-400">
          <span>
            💡 No completed trades recorded yet for this view. Once trades hit Take-Profit or Stop-Loss, the cumulative equity curve dynamically plots performance in real time.
          </span>
        </div>
      )}
    </div>
  );
};
