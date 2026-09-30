import React, { useEffect, useRef, useState } from 'react';
import { ActivePosition, CandleData, MarketPriceData, MarketSymbol, SMCZone, TradeSetup } from '../types';
import { Layers, Sparkles, Target, Zap, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface NativeCandlestickChartProps {
  symbol: MarketSymbol;
  candles: CandleData[];
  smcZones: SMCZone[];
  currentPriceData?: MarketPriceData;
  activePosition?: ActivePosition | null;
  currentSetup?: TradeSetup | null;
  allAssetSetups?: Partial<Record<MarketSymbol, TradeSetup>>;
}

export const NativeCandlestickChart: React.FC<NativeCandlestickChartProps> = ({
  symbol,
  candles,
  smcZones,
  currentPriceData,
  activePosition,
  currentSetup,
  allAssetSetups,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [hoveredCandle, setHoveredCandle] = useState<CandleData | null>(null);
  const [crosshair, setCrosshair] = useState<{ x: number; y: number; price: number } | null>(null);
  const [visibleCount, setVisibleCount] = useState<number>(60);
  const [offsetRight, setOffsetRight] = useState<number>(0);

  const isForex = symbol === 'GBPUSD';
  const decimals = isForex ? 4 : 2;

  // Filter SMC zones
  const chochZones = smcZones.filter((z) => z.type === 'CHoCH');
  const bosZones = smcZones.filter((z) => z.type === 'BOS');
  const orderBlocks = smcZones.filter((z) => z.type === 'BULLISH_OB' || z.type === 'BEARISH_OB');
  const fvgs = smcZones.filter((z) => z.type === 'BULLISH_FVG' || z.type === 'BEARISH_FVG');

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animFrameId: number | null = null;

    const updateCanvasSize = () => {
      if (!canvas || !container) return;
      const rect = container.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      ctx.setTransform(1, 0, 0, 1, 0, 0); // reset transform before scaling
      ctx.scale(dpr, dpr);
      renderChart(rect.width, rect.height, ctx);
    };

    const handleResize = () => {
      if (animFrameId !== null) {
        cancelAnimationFrame(animFrameId);
      }
      animFrameId = requestAnimationFrame(() => {
        updateCanvasSize();
      });
    };

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    resizeObserver.observe(container);

    updateCanvasSize();

    return () => {
      if (animFrameId !== null) {
        cancelAnimationFrame(animFrameId);
      }
      resizeObserver.disconnect();
    };
  }, [candles, smcZones, currentPriceData, activePosition, currentSetup, allAssetSetups, visibleCount, offsetRight, crosshair]);

  const renderChart = (width: number, height: number, ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, width, height);

    if (!candles || candles.length === 0) {
      ctx.fillStyle = '#64748b';
      ctx.font = '13px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Loading market candlesticks & SMC structure...', width / 2, height / 2);
      return;
    }

    const paddingRight = 75; // for price axis
    const paddingBottom = 26; // for time axis
    const paddingTop = 20;
    const chartWidth = width - paddingRight;
    const chartHeight = height - paddingBottom - paddingTop;
    const volumeHeight = chartHeight * 0.18;
    const priceChartHeight = chartHeight - volumeHeight;

    // Slice visible candles
    const totalCandles = candles.length;
    const count = Math.min(visibleCount, totalCandles);
    const startIndex = Math.max(0, totalCandles - count - offsetRight);
    const endIndex = Math.min(totalCandles, startIndex + count);
    const visibleCandles = candles.slice(startIndex, endIndex);

    if (visibleCandles.length === 0) return;

    // Find min and max price
    let minPrice = Infinity;
    let maxPrice = -Infinity;
    let maxVolume = 0;

    visibleCandles.forEach((c) => {
      if (c.low < minPrice) minPrice = c.low;
      if (c.high > maxPrice) maxPrice = c.high;
      if (c.volume > maxVolume) maxVolume = c.volume;
    });

    // Also consider SMC zone boundaries to prevent clipping
    smcZones.forEach((z) => {
      if (z.highPrice > maxPrice && z.highPrice < maxPrice * 1.05) maxPrice = z.highPrice;
      if (z.lowPrice < minPrice && z.lowPrice > minPrice * 0.95) minPrice = z.lowPrice;
    });

    if (currentPriceData?.price) {
      if (currentPriceData.price < minPrice) minPrice = currentPriceData.price;
      if (currentPriceData.price > maxPrice) maxPrice = currentPriceData.price;
    }

    // Auto-fit open position (Entry, Stop Loss, Take Profit) directly on chart scale
    const pos = (activePosition && activePosition.setup.symbol === symbol)
      ? activePosition.setup
      : (currentSetup && currentSetup.symbol === symbol)
      ? currentSetup
      : (allAssetSetups && allAssetSetups[symbol])
      ? allAssetSetups[symbol]!
      : null;

    if (pos) {
      if (pos.stopLoss > 0 && pos.stopLoss < minPrice) minPrice = pos.stopLoss;
      if (pos.stopLoss > 0 && pos.stopLoss > maxPrice) maxPrice = pos.stopLoss;
      if (pos.takeProfit1 > 0 && pos.takeProfit1 < minPrice) minPrice = pos.takeProfit1;
      if (pos.takeProfit1 > 0 && pos.takeProfit1 > maxPrice) maxPrice = pos.takeProfit1;
      if (pos.entryPrice > 0 && pos.entryPrice < minPrice) minPrice = pos.entryPrice;
      if (pos.entryPrice > 0 && pos.entryPrice > maxPrice) maxPrice = pos.entryPrice;
    }

    const priceSpan = maxPrice - minPrice || 1;
    minPrice -= priceSpan * 0.05;
    maxPrice += priceSpan * 0.05;
    const adjustedSpan = maxPrice - minPrice;

    const getY = (price: number) => {
      return paddingTop + (1 - (price - minPrice) / adjustedSpan) * priceChartHeight;
    };

    const candleWidth = Math.max(2, chartWidth / visibleCandles.length);
    const candleBodyWidth = Math.max(1, candleWidth * 0.72);

    // 1. Draw Grid Lines (Horizontal & Vertical)
    ctx.strokeStyle = '#141d2e';
    ctx.lineWidth = 1;

    const gridSteps = 6;
    for (let i = 0; i <= gridSteps; i++) {
      const p = minPrice + (adjustedSpan / gridSteps) * i;
      const y = getY(p);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(chartWidth, y);
      ctx.stroke();

      // Price label on right axis
      ctx.fillStyle = '#64748b';
      ctx.font = '10px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(p.toFixed(decimals), chartWidth + 6, y + 3);
    }

    // 2. Draw SMC Order Blocks & Fair Value Gaps (Shaded background regions)
    orderBlocks.forEach((ob) => {
      const topY = getY(ob.highPrice);
      const bottomY = getY(ob.lowPrice);
      const h = Math.max(2, Math.abs(bottomY - topY));
      const isBull = ob.type === 'BULLISH_OB';

      ctx.fillStyle = isBull ? 'rgba(16, 185, 129, 0.10)' : 'rgba(239, 68, 68, 0.10)';
      ctx.strokeStyle = isBull ? 'rgba(16, 185, 129, 0.40)' : 'rgba(239, 68, 68, 0.40)';
      ctx.lineWidth = 1;
      ctx.fillRect(0, Math.min(topY, bottomY), chartWidth, h);
      ctx.strokeRect(0, Math.min(topY, bottomY), chartWidth, h);

      // Label
      ctx.fillStyle = isBull ? '#34d399' : '#f87171';
      ctx.font = '9px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(ob.label, 8, Math.min(topY, bottomY) + 11);
    });

    fvgs.forEach((fvg) => {
      const topY = getY(fvg.highPrice);
      const bottomY = getY(fvg.lowPrice);
      const h = Math.max(2, Math.abs(bottomY - topY));
      const isBull = fvg.type === 'BULLISH_FVG';

      ctx.fillStyle = isBull ? 'rgba(56, 189, 248, 0.08)' : 'rgba(168, 85, 247, 0.08)';
      ctx.strokeStyle = isBull ? 'rgba(56, 189, 248, 0.35)' : 'rgba(168, 85, 247, 0.35)';
      ctx.setLineDash([3, 3]);
      ctx.fillRect(chartWidth * 0.2, Math.min(topY, bottomY), chartWidth * 0.8, h);
      ctx.strokeRect(chartWidth * 0.2, Math.min(topY, bottomY), chartWidth * 0.8, h);
      ctx.setLineDash([]);
    });

    // 3. Draw Volume Histogram
    const volumeBaseY = paddingTop + priceChartHeight + volumeHeight;
    visibleCandles.forEach((candle, idx) => {
      const x = idx * candleWidth + candleWidth / 2;
      const isGreen = candle.close >= candle.open;
      const vHeight = maxVolume > 0 ? (candle.volume / maxVolume) * volumeHeight * 0.85 : 0;
      const vy = volumeBaseY - vHeight;

      ctx.fillStyle = isGreen ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)';
      ctx.fillRect(x - candleBodyWidth / 2, vy, candleBodyWidth, vHeight);
    });

    // 4. Draw Candlesticks (Wicks and Bodies)
    visibleCandles.forEach((candle, idx) => {
      const isLast = idx === visibleCandles.length - 1;
      const currentLive = (isLast && currentPriceData?.price) ? currentPriceData.price : candle.close;
      const effectiveHigh = (isLast && currentPriceData?.price) ? Math.max(candle.high, currentPriceData.price) : candle.high;
      const effectiveLow = (isLast && currentPriceData?.price) ? Math.min(candle.low, currentPriceData.price) : candle.low;

      const x = idx * candleWidth + candleWidth / 2;
      const isGreen = currentLive >= candle.open;
      const color = isGreen ? '#10b981' : '#ef4444';

      const openY = getY(candle.open);
      const closeY = getY(currentLive);
      const highY = getY(effectiveHigh);
      const lowY = getY(effectiveLow);

      // Draw Upper and Lower Wicks
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, highY);
      ctx.lineTo(x, lowY);
      ctx.stroke();

      // Draw Body
      const bodyTop = Math.min(openY, closeY);
      const bodyHeight = Math.max(1.5, Math.abs(closeY - openY));

      ctx.fillStyle = color;
      ctx.fillRect(x - candleBodyWidth / 2, bodyTop, candleBodyWidth, bodyHeight);
    });

    // 5. Draw CHoCH (Change of Character) & BOS (Break of Structure) Lines
    chochZones.forEach((choch) => {
      const y = getY(choch.highPrice);
      const isBull = choch.label.toLowerCase().includes('bullish');

      ctx.strokeStyle = isBull ? '#38bdf8' : '#f59e0b';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(chartWidth, y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Badge on chart
      ctx.fillStyle = isBull ? '#0369a1' : '#b45309';
      ctx.fillRect(chartWidth - 210, y - 10, 200, 18);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9.5px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(
        `CHoCH (${isBull ? 'Bullish' : 'Bearish'} Shift): ${choch.highPrice.toFixed(decimals)}`,
        chartWidth - 110,
        y + 3
      );
    });

    bosZones.forEach((bos) => {
      const y = getY(bos.highPrice);
      ctx.strokeStyle = '#818cf8';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 4]);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(chartWidth, y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Label
      ctx.fillStyle = '#4338ca';
      ctx.fillRect(10, y - 8, 140, 16);
      ctx.fillStyle = '#e0e7ff';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`BOS (Structure Break)`, 14, y + 4);
    });

    // 6. Draw Live Price Line
    const livePrice = currentPriceData?.price || visibleCandles[visibleCandles.length - 1].close;
    if (livePrice > 0) {
      const liveY = getY(livePrice);
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(0, liveY);
      ctx.lineTo(chartWidth, liveY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Right Axis Price Tag
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(chartWidth, liveY - 9, paddingRight, 18);
      ctx.fillStyle = '#0b0e14';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(livePrice.toFixed(decimals), chartWidth + 5, liveY + 4);
    }

    // 7. DIRECT IN-CHART ENTRY, STOP LOSS & TAKE PROFIT DRAWINGS (ON CANVAS)
    if (pos && pos.entryPrice > 0) {
      const isLive = Boolean(activePosition && activePosition.setup.symbol === symbol);
      const isLong = pos.direction === 'LONG';
      const entryY = getY(pos.entryPrice);
      const slY = pos.stopLoss > 0 ? getY(pos.stopLoss) : 0;
      const tp1Y = pos.takeProfit1 > 0 ? getY(pos.takeProfit1) : 0;

      // Draw subtle Profit / Risk shaded background zones between Entry, SL and TP
      if (slY > 0 && tp1Y > 0) {
        // Profit zone
        const profitTop = Math.min(entryY, tp1Y);
        const profitHeight = Math.abs(entryY - tp1Y);
        ctx.fillStyle = 'rgba(16, 185, 129, 0.08)';
        ctx.fillRect(chartWidth * 0.15, profitTop, chartWidth * 0.85, profitHeight);

        // Stop zone
        const stopTop = Math.min(entryY, slY);
        const stopHeight = Math.abs(entryY - slY);
        ctx.fillStyle = 'rgba(239, 68, 68, 0.08)';
        ctx.fillRect(chartWidth * 0.15, stopTop, chartWidth * 0.85, stopHeight);
      }

      // Draw Take Profit 1 Line (Emerald)
      if (pos.takeProfit1 > 0) {
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(0, tp1Y);
        ctx.lineTo(chartWidth, tp1Y);
        ctx.stroke();

        // Right Axis Badge
        ctx.fillStyle = '#10b981';
        ctx.fillRect(chartWidth, tp1Y - 10, paddingRight, 20);
        ctx.fillStyle = '#022c22';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`TP1: ${pos.takeProfit1.toFixed(decimals)}`, chartWidth + 4, tp1Y + 4);

        // Chart line tag
        ctx.fillStyle = '#064e3b';
        ctx.fillRect(10, tp1Y - 9, 210, 18);
        ctx.fillStyle = '#a7f3d0';
        ctx.font = 'bold 9px monospace';
        const tpLabel = pos.tp1Label ? pos.tp1Label.replace('🎯 ', '') : 'Liquidity Target';
        ctx.fillText(`TP1 [${tpLabel.slice(0, 16)}...] (+${((Math.abs(pos.takeProfit1 - pos.entryPrice) / (symbol === 'XAUUSD' ? 0.1 : 0.0001))).toFixed(1)}p)`, 15, tp1Y + 3);
      }

      // Draw Take Profit 2 Line (Dashed Teal)
      if (pos.takeProfit2 && pos.takeProfit2 > 0) {
        const tp2Y = getY(pos.takeProfit2);
        ctx.strokeStyle = '#2dd4bf';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(0, tp2Y);
        ctx.lineTo(chartWidth, tp2Y);
        ctx.stroke();
        ctx.setLineDash([]);

        // Right Axis Badge
        ctx.fillStyle = '#0f766e';
        ctx.fillRect(chartWidth, tp2Y - 9, paddingRight, 18);
        ctx.fillStyle = '#ccfbf1';
        ctx.font = 'bold 9.5px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`TP2: ${pos.takeProfit2.toFixed(decimals)}`, chartWidth + 4, tp2Y + 4);
      }

      // Draw Entry Price Line (Blue)
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(0, entryY);
      ctx.lineTo(chartWidth, entryY);
      ctx.stroke();

      // Right Axis Badge
      ctx.fillStyle = '#3b82f6';
      ctx.fillRect(chartWidth, entryY - 10, paddingRight, 20);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`E: ${pos.entryPrice.toFixed(decimals)}`, chartWidth + 4, entryY + 4);

      // Chart line tag
      ctx.fillStyle = '#1e3a8a';
      ctx.fillRect(10, entryY - 9, 150, 18);
      ctx.fillStyle = '#bfdbfe';
      ctx.font = 'bold 9.5px monospace';
      ctx.fillText(`${isLive ? 'LIVE' : 'SETUP'} ENTRY (${pos.direction}) ${pos.lotSize}L`, 15, entryY + 3);

      // Draw Stop Loss Line (Rose / Red)
      if (pos.stopLoss > 0) {
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(0, slY);
        ctx.lineTo(chartWidth, slY);
        ctx.stroke();

        // Right Axis Badge
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(chartWidth, slY - 10, paddingRight, 20);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`SL: ${pos.stopLoss.toFixed(decimals)}`, chartWidth + 4, slY + 4);

        // Chart line tag
        ctx.fillStyle = '#7f1d1d';
        ctx.fillRect(10, slY - 9, 140, 18);
        ctx.fillStyle = '#fecdd3';
        ctx.font = 'bold 9.5px monospace';
        ctx.fillText(`SL (-${((Math.abs(pos.entryPrice - pos.stopLoss) / (symbol === 'XAUUSD' ? 0.1 : 0.0001))).toFixed(1)}p)`, 15, slY + 3);
      }
    }

    // 8. Draw Crosshair if active
    if (crosshair && crosshair.x < chartWidth && crosshair.y < chartHeight + paddingTop) {
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);

      // Vertical line
      ctx.beginPath();
      ctx.moveTo(crosshair.x, paddingTop);
      ctx.lineTo(crosshair.x, height - paddingBottom);
      ctx.stroke();

      // Horizontal line
      ctx.beginPath();
      ctx.moveTo(0, crosshair.y);
      ctx.lineTo(chartWidth, crosshair.y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Hover Price Tag
      ctx.fillStyle = '#334155';
      ctx.fillRect(chartWidth, crosshair.y - 9, paddingRight, 18);
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(crosshair.price.toFixed(decimals), chartWidth + 5, crosshair.y + 4);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    if (!container || !candles || candles.length === 0) return;

    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const paddingRight = 75;
    const paddingTop = 20;
    const paddingBottom = 26;
    const chartWidth = rect.width - paddingRight;
    const chartHeight = rect.height - paddingBottom - paddingTop;
    const priceChartHeight = chartHeight * 0.82;

    const totalCandles = candles.length;
    const count = Math.min(visibleCount, totalCandles);
    const startIndex = Math.max(0, totalCandles - count - offsetRight);
    const endIndex = Math.min(totalCandles, startIndex + count);
    const visibleCandles = candles.slice(startIndex, endIndex);

    if (x >= 0 && x <= chartWidth && visibleCandles.length > 0) {
      const candleWidth = chartWidth / visibleCandles.length;
      const idx = Math.floor(x / candleWidth);
      if (idx >= 0 && idx < visibleCandles.length) {
        setHoveredCandle(visibleCandles[idx]);
      }

      // Calculate price at mouse y
      let minPrice = Infinity;
      let maxPrice = -Infinity;
      visibleCandles.forEach((c) => {
        if (c.low < minPrice) minPrice = c.low;
        if (c.high > maxPrice) maxPrice = c.high;
      });
      const span = maxPrice - minPrice || 1;
      const adjMin = minPrice - span * 0.05;
      const adjMax = maxPrice + span * 0.05;
      const price = adjMax - ((y - paddingTop) / priceChartHeight) * (adjMax - adjMin);

      setCrosshair({ x, y, price });
    }
  };

  const handleMouseLeave = () => {
    setHoveredCandle(null);
    setCrosshair(null);
  };

  const activeCandle = hoveredCandle || (candles && candles.length > 0 ? candles[candles.length - 1] : null);
  const candleChange = activeCandle ? activeCandle.close - activeCandle.open : 0;
  const candleChangePct = activeCandle && activeCandle.open > 0 ? (candleChange / activeCandle.open) * 100 : 0;

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative w-full h-full min-h-[460px] bg-[#0b0e14] select-none"
    >
      {/* HUD Info Header: OHLC, Volume & Change */}
      <div className="absolute top-2 left-3 z-10 flex flex-wrap items-center gap-3 text-[11px] font-mono pointer-events-none">
        <div className="px-2 py-0.5 rounded bg-[#131b2e]/90 border border-slate-700/80 text-slate-300 shadow flex items-center gap-2">
          <span className="font-bold text-white">{symbol}</span>
          <span>O: <strong className="text-slate-100">{activeCandle?.open.toFixed(decimals) || '-'}</strong></span>
          <span>H: <strong className="text-slate-100">{activeCandle?.high.toFixed(decimals) || '-'}</strong></span>
          <span>L: <strong className="text-slate-100">{activeCandle?.low.toFixed(decimals) || '-'}</strong></span>
          <span>C: <strong className="text-slate-100">{activeCandle?.close.toFixed(decimals) || '-'}</strong></span>
          <span className={candleChange >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
            {candleChange >= 0 ? '+' : ''}{candleChange.toFixed(decimals)} ({candleChangePct >= 0 ? '+' : ''}{candleChangePct.toFixed(2)}%)
          </span>
        </div>

        {/* Change of Character (CHoCH / "Char") Quick Flag */}
        {chochZones.length > 0 && (
          <div className="px-2 py-0.5 rounded bg-sky-950/80 border border-sky-500/40 text-sky-300 font-bold shadow flex items-center gap-1">
            <Zap className="w-3 h-3 text-sky-400" />
            <span>CHoCH (Char): {chochZones[0].highPrice.toFixed(decimals)}</span>
          </div>
        )}
      </div>

      {/* Chart Canvas */}
      <canvas ref={canvasRef} className="w-full h-full" />

      {/* Zoom / View controls at bottom right */}
      <div className="absolute bottom-2 right-20 z-10 flex items-center gap-1 bg-[#151d2c]/85 p-1 rounded-lg border border-slate-800 backdrop-blur shadow">
        <button
          onClick={() => setVisibleCount((prev) => Math.max(20, prev - 10))}
          className="p-1 rounded hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => setVisibleCount((prev) => Math.min(100, prev + 10))}
          className="p-1 rounded hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => {
            setVisibleCount(60);
            setOffsetRight(0);
          }}
          className="p-1 rounded hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
          title="Reset Zoom"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
