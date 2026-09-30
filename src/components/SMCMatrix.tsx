import React from 'react';
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  Layers,
  Shield,
  Sparkles,
  Target,
  Zap,
} from 'lucide-react';
import { MarketSymbol, SMCZone } from '../types';

interface SMCMatrixProps {
  zones: SMCZone[];
  symbol: MarketSymbol;
}

export const SMCMatrix: React.FC<SMCMatrixProps> = ({ zones, symbol }) => {
  const isForex = symbol === 'GBPUSD';
  const formatPrice = (p: number) => (isForex ? p.toFixed(4) : symbol === 'XAUUSD' ? p.toFixed(2) : p.toFixed(2));

  return (
    <div className="bg-[#0f141f] border border-[#1e293b] rounded-xl p-4 shadow-xl">
      <div className="flex items-center justify-between mb-3 border-b border-[#1e293b] pb-2">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-200">
              Smart Money Concepts (SMC) Detector Matrix
            </h3>
            <p className="text-[11px] text-slate-400">
              Detected institutional footprints, liquidity pools, and order blocks on {symbol}
            </p>
          </div>
        </div>

        <span className="text-[11px] font-mono text-slate-400">
          {zones.length} Active SMC Zones
        </span>
      </div>

      {zones.length === 0 ? (
        <div className="py-6 text-center text-xs text-slate-500 font-mono">
          No active zones detected in current bar window. Scanning for structural shifts...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {zones.map((zone) => {
            const isBullish = zone.label.toLowerCase().includes('bullish') || zone.type === 'BULLISH_OB' || zone.type === 'BULLISH_FVG';
            const isBearish = zone.label.toLowerCase().includes('bearish') || zone.type === 'BEARISH_OB' || zone.type === 'BEARISH_FVG';

            return (
              <div
                key={zone.id}
                className="bg-[#151b28] border border-slate-800 rounded-lg p-3 space-y-2 hover:border-slate-700 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {zone.type === 'BOS' || zone.type === 'CHoCH' ? (
                      <Zap className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    ) : zone.type.includes('OB') ? (
                      <Shield className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    ) : zone.type.includes('FVG') ? (
                      <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    ) : (
                      <Target className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                    )}
                    <span className="text-xs font-bold text-slate-200">{zone.label}</span>
                  </div>

                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-semibold ${
                      zone.isMitigated
                        ? 'bg-slate-800 text-slate-400 border border-slate-700'
                        : isBullish
                        ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                        : isBearish
                        ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                        : 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
                    }`}
                  >
                    {zone.isMitigated ? 'Mitigated' : 'Unmitigated (Fresh)'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] font-mono bg-slate-900/60 px-2 py-1 rounded border border-slate-800/80">
                  <span className="text-slate-400">Price Zone:</span>
                  <span className="font-semibold text-white">
                    {formatPrice(zone.lowPrice)} &ndash; {formatPrice(zone.highPrice)}
                  </span>
                </div>

                <p className="text-[11px] text-slate-400 leading-relaxed">
                  <strong className="text-slate-300 font-medium">Why it matters: </strong>
                  {zone.importance}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
