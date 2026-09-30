import React, { useEffect, useRef } from 'react';
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  LineStyle,
  ColorType,
  IChartApi,
  ISeriesApi,
  IPriceLine,
  UTCTimestamp,
} from 'lightweight-charts';
import { ActivePosition, CandleData, MarketPriceData, MarketSymbol, SMCZone, TradeSetup } from '../types';

interface TradingViewDirectChartProps {
  symbol: MarketSymbol;
  timeframe: string;
  candles: CandleData[];
  currentPriceData?: MarketPriceData;
  activePosition?: ActivePosition | null;
  currentSetup?: TradeSetup | null;
  allAssetSetups?: Partial<Record<MarketSymbol, TradeSetup>>;
  smcZones?: SMCZone[];
}

export const TradingViewDirectChart: React.FC<TradingViewDirectChartProps> = ({
  symbol,
  candles,
  currentPriceData,
  activePosition,
  currentSetup,
  allAssetSetups,
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const priceLinesRef = useRef<IPriceLine[]>([]);

  const isForex = symbol === 'GBPUSD';
  const isJPY = symbol === 'USDJPY';
  const decimals = isForex ? 5 : isJPY ? 3 : 2;
  const minMove = isForex ? 0.00001 : isJPY ? 0.001 : 0.01;

  // Initialize TradingView Lightweight Chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const container = chartContainerRef.current;
    const chart = createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight || 500,
      layout: {
        background: { type: ColorType.Solid, color: '#0b0e14' },
        textColor: '#94a3b8',
        fontFamily: 'monospace, sans-serif',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: '#141d2e' },
        horzLines: { color: '#141d2e' },
      },
      crosshair: {
        vertLine: {
          color: '#475569',
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: '#1e293b',
        },
        horzLine: {
          color: '#475569',
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: '#1e293b',
        },
      },
      rightPriceScale: {
        borderColor: '#1e293b',
        textColor: '#94a3b8',
        autoScale: true,
        scaleMargins: {
          top: 0.15,
          bottom: 0.15,
        },
      },
      timeScale: {
        borderColor: '#1e293b',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
      priceFormat: {
        type: 'price',
        precision: decimals,
        minMove: minMove,
      },
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: '', // overlay
      color: 'rgba(59, 130, 246, 0.25)',
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.85,
        bottom: 0,
      },
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    // Handle container resize safely with requestAnimationFrame
    let animationFrameId: number | null = null;
    const handleResize = () => {
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }
      animationFrameId = requestAnimationFrame(() => {
        if (chartContainerRef.current && chartRef.current) {
          const newWidth = chartContainerRef.current.clientWidth;
          const newHeight = chartContainerRef.current.clientHeight;
          if (newWidth > 0 && newHeight > 0) {
            chartRef.current.applyOptions({
              width: newWidth,
              height: newHeight,
            });
          }
        }
      });
    };

    const resizeObserver = new ResizeObserver(() => handleResize());
    resizeObserver.observe(container);

    return () => {
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      priceLinesRef.current = [];
    };
  }, [symbol]);

  // Load / Update Candle & Volume Data
  useEffect(() => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current || !candles || candles.length === 0) return;

    // Ensure sorted and unique timestamps for Lightweight Charts
    const sorted = [...candles].sort((a, b) => a.time - b.time);
    const uniqueMap = new Map<number, CandleData>();
    sorted.forEach((c) => uniqueMap.set(c.time, c));
    const cleanCandles = Array.from(uniqueMap.values());

    const formattedCandles = cleanCandles.map((c) => ({
      time: (c.time > 1e11 ? Math.floor(c.time / 1000) : c.time) as UTCTimestamp,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    const formattedVolume = cleanCandles.map((c) => ({
      time: (c.time > 1e11 ? Math.floor(c.time / 1000) : c.time) as UTCTimestamp,
      value: c.volume || 0,
      color: c.close >= c.open ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)',
    }));

    candleSeriesRef.current.setData(formattedCandles);
    volumeSeriesRef.current.setData(formattedVolume);

    // Initial fit if chart is first populated
    chartRef.current?.timeScale().fitContent();
  }, [candles]);

  // Real-time live price tick update
  useEffect(() => {
    if (!candleSeriesRef.current || !currentPriceData || !candles || candles.length === 0) return;

    const last = candles[candles.length - 1];
    if (!last) return;

    const price = currentPriceData.price;
    const time = (last.time > 1e11 ? Math.floor(last.time / 1000) : last.time) as UTCTimestamp;

    candleSeriesRef.current.update({
      time,
      open: last.open,
      high: Math.max(last.high, price),
      low: Math.min(last.low, price),
      close: price,
    });
  }, [currentPriceData]);

  // DIRECT IN-CHART ENTRY, STOP LOSS & TAKE PROFIT PRICE LINES
  useEffect(() => {
    const series = candleSeriesRef.current;
    if (!series) return;

    // 1. Remove previously placed price lines
    priceLinesRef.current.forEach((line) => {
      try {
        series.removePriceLine(line);
      } catch {
        // Safe removal
      }
    });
    priceLinesRef.current = [];

    // 2. Identify the active position or active AI setup for the current symbol
    const activePos = activePosition && activePosition.setup.symbol === symbol ? activePosition.setup : null;
    const setup = !activePos && currentSetup && currentSetup.symbol === symbol
      ? currentSetup
      : (!activePos && allAssetSetups?.[symbol] ? allAssetSetups[symbol] : null);
    const pos = activePos || setup;

    if (!pos || pos.entryPrice <= 0) return;

    const isLive = Boolean(activePos);
    const dir = pos.direction;
    const lot = pos.lotSize || 1.0;

    // Pip Calculation
    const pipMultiplier = symbol === 'XAUUSD' ? 0.1 : isForex ? 0.0001 : 1.0;
    const slDistPips = Math.abs(pos.entryPrice - pos.stopLoss) / pipMultiplier;
    const tp1DistPips = Math.abs(pos.takeProfit1 - pos.entryPrice) / pipMultiplier;

    // Dollar Estimations
    let pointValue = 1;
    if (symbol === 'XAUUSD') pointValue = 100;
    else if (isForex) pointValue = 100000;
    else if (symbol === 'BTCUSD') pointValue = 1;
    else pointValue = 10;

    const estRisk = Math.abs(pos.entryPrice - pos.stopLoss) * pointValue * lot;
    const estProfit = Math.abs(pos.takeProfit1 - pos.entryPrice) * pointValue * lot;

    // A. DIRECT ENTRY PRICE LINE (Blue)
    const entryLine = series.createPriceLine({
      price: pos.entryPrice,
      color: '#3b82f6',
      lineWidth: 2,
      lineStyle: LineStyle.Solid,
      axisLabelVisible: true,
      axisLabelColor: '#2563eb',
      axisLabelTextColor: '#ffffff',
      title: `${isLive ? 'LIVE' : 'SETUP'} ENTRY (${dir}) ${lot}L`,
    });
    priceLinesRef.current.push(entryLine);

    // B. DIRECT STOP LOSS PRICE LINE (Rose / Red)
    if (pos.stopLoss > 0) {
      const slLine = series.createPriceLine({
        price: pos.stopLoss,
        color: '#ef4444',
        lineWidth: 2,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: true,
        axisLabelColor: '#dc2626',
        axisLabelTextColor: '#ffffff',
        title: `SL (-${slDistPips.toFixed(isForex ? 1 : 0)}p | -$${estRisk.toFixed(2)})`,
      });
      priceLinesRef.current.push(slLine);
    }

    // C. DIRECT TAKE PROFIT 1 PRICE LINE (Emerald / Green)
    if (pos.takeProfit1 > 0) {
      const tp1Desc = pos.tp1Label ? pos.tp1Label.replace('🎯 ', '') : 'Liquidity/Unmitigated Target';
      const tp1Line = series.createPriceLine({
        price: pos.takeProfit1,
        color: '#10b981',
        lineWidth: 2,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: true,
        axisLabelColor: '#059669',
        axisLabelTextColor: '#ffffff',
        title: `TP1 [${tp1Desc}] (+${tp1DistPips.toFixed(isForex ? 1 : 0)}p | +$${estProfit.toFixed(2)})`,
      });
      priceLinesRef.current.push(tp1Line);
    }

    // D. DIRECT TAKE PROFIT 2 (if set)
    if (pos.takeProfit2 && pos.takeProfit2 > 0) {
      const tp2Pips = Math.abs(pos.takeProfit2 - pos.entryPrice) / pipMultiplier;
      const tp2Desc = pos.tp2Label ? pos.tp2Label.replace('🎯 ', '') : 'Major Liquidity / Unmitigated OB';
      const tp2Line = series.createPriceLine({
        price: pos.takeProfit2,
        color: '#34d399',
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        axisLabelColor: '#047857',
        axisLabelTextColor: '#ffffff',
        title: `TP2 [${tp2Desc}] (+${tp2Pips.toFixed(isForex ? 1 : 0)}p)`,
      });
      priceLinesRef.current.push(tp2Line);
    }

    // E. DIRECT TAKE PROFIT 3 (if set)
    if (pos.takeProfit3 && pos.takeProfit3 > 0) {
      const tp3Pips = Math.abs(pos.takeProfit3 - pos.entryPrice) / pipMultiplier;
      const tp3Desc = pos.tp3Label ? pos.tp3Label.replace('🎯 ', '') : 'Macro Range Liquidity';
      const tp3Line = series.createPriceLine({
        price: pos.takeProfit3,
        color: '#6ee7b7',
        lineWidth: 1,
        lineStyle: LineStyle.Dotted,
        axisLabelVisible: true,
        axisLabelColor: '#065f46',
        axisLabelTextColor: '#ffffff',
        title: `TP3 [${tp3Desc}] (+${tp3Pips.toFixed(isForex ? 1 : 0)}p)`,
      });
      priceLinesRef.current.push(tp3Line);
    }
  }, [activePosition, currentSetup, allAssetSetups, symbol, isForex]);

  return (
    <div className="relative w-full h-full min-h-[460px] bg-[#0b0e14] overflow-hidden select-none">
      {/* OANDA TradingView Data Provider Badge */}
      <div className="absolute top-2 left-3 z-10 flex items-center gap-1.5 pointer-events-none select-none">
        <span className="text-[10px] font-mono font-bold text-slate-400 bg-[#0f1523]/90 px-2 py-0.5 rounded border border-slate-800 shadow-sm">
          OANDA:{symbol}
        </span>
        <span className="text-[9px] font-mono text-emerald-400/90 bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-800/30 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          OANDA Feed
        </span>
      </div>

      <div ref={chartContainerRef} className="w-full h-full min-h-[460px]" />
    </div>
  );
};
