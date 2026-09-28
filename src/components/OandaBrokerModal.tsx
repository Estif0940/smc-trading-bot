import React from 'react';
import {
  Activity,
  CheckCircle2,
  ExternalLink,
  Info,
  Layers,
  Server,
  ShieldCheck,
  X,
  Zap,
} from 'lucide-react';
import { MarketPriceData, MarketSymbol, OandaStatus } from '../types';

interface OandaBrokerModalProps {
  isOpen: boolean;
  onClose: () => void;
  oandaStatus: OandaStatus | null;
  marketPrices: Record<MarketSymbol, MarketPriceData>;
}

export const OandaBrokerModal: React.FC<OandaBrokerModalProps> = ({
  isOpen,
  onClose,
  oandaStatus,
  marketPrices,
}) => {
  if (!isOpen) return null;

  const hasKey = oandaStatus?.hasApiKey ?? false;
  const env = oandaStatus?.environment || 'practice';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#0f141f] border border-[#1e293b] rounded-xl max-w-xl w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-600 to-teal-800 flex items-center justify-center text-white font-black text-lg shadow-md">
            OA
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-100">OANDA Broker Integration</h2>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${
                  hasKey
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                }`}
              >
                {hasKey ? `v20 REST API (${env})` : 'TradingView OANDA Active'}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Institutional FX &amp; CFD Broker Data Feed &amp; Execution Gateway
            </p>
          </div>
        </div>

        {/* Status Card */}
        <div
          className={`p-4 rounded-lg border mb-5 ${
            hasKey
              ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'
              : 'bg-blue-950/20 border-blue-500/30 text-blue-200'
          }`}
        >
          <div className="flex items-start gap-3">
            {hasKey ? (
              <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
            )}
            <div className="text-xs space-y-1">
              <div className="font-semibold text-white">
                {hasKey
                  ? 'Authenticated OANDA v20 REST Connection'
                  : 'OANDA Broker Zero-Config Mode (No API Key Required)'}
              </div>
              <p className="text-slate-300 leading-relaxed">
                {hasKey
                  ? `Connected to OANDA v20 ${env.toUpperCase()} environment. Candlesticks and live spreads are fetched directly from OANDA's institutional servers.`
                  : 'The platform is currently rendering official OANDA feeds in the TradingView chart (OANDA:XAUUSD, OANDA:EURUSD, etc.) and synchronizing with real-time live market pricing. If you do not have an OANDA API key or Account ID, the system operates seamlessly with zero setup.'}
              </p>
            </div>
          </div>
        </div>

        {/* Integration Details Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5 text-xs">
          <div className="p-3 bg-[#151b28] border border-slate-800 rounded-lg">
            <div className="text-slate-400 mb-1 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-blue-400" />
              <span>TradingView Feed</span>
            </div>
            <div className="font-mono font-semibold text-slate-200">
              OANDA Broker Feeds
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Tickers: OANDA:XAUUSD, OANDA:EURUSD, OANDA:GBPUSD, OANDA:BTCUSD
            </p>
          </div>

          <div className="p-3 bg-[#151b28] border border-slate-800 rounded-lg">
            <div className="text-slate-400 mb-1 flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-emerald-400" />
              <span>v20 REST Gateway</span>
            </div>
            <div className="font-mono font-semibold text-slate-200">
              {hasKey ? `${env.toUpperCase()} (${oandaStatus?.baseUrl || 'Practice'})` : 'Public Real-time Fallback'}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              {oandaStatus?.accountId ? `Account: ${oandaStatus.accountId}` : 'Zero-Key Live Mirror Active'}
            </p>
          </div>
        </div>

        {/* Real-time Instruments & Spreads */}
        <div className="mb-5">
          <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-blue-400" />
            <span>Supported OANDA Instruments &amp; Live Bid/Ask</span>
          </h3>

          <div className="border border-slate-800 rounded-lg overflow-hidden text-xs">
            <table className="w-full text-left font-mono">
              <thead className="bg-[#151b28] text-slate-400 border-b border-slate-800 text-[11px]">
                <tr>
                  <th className="py-2 px-3">Symbol</th>
                  <th className="py-2 px-3">OANDA Ticker</th>
                  <th className="py-2 px-3">Live Bid</th>
                  <th className="py-2 px-3">Live Ask</th>
                  <th className="py-2 px-3">Spread</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-[#0b0e14]">
                {(['XAUUSD', 'EURUSD', 'GBPUSD', 'BTCUSD', 'ETHUSD'] as MarketSymbol[]).map(
                  (sym) => {
                    const data = marketPrices[sym];
                    const tvTicker = `OANDA:${sym}`;
                    const bid = data?.bid ?? 0;
                    const ask = data?.ask ?? 0;
                    const spread = Math.abs(ask - bid);
                    const isFx = sym === 'EURUSD' || sym === 'GBPUSD';

                    return (
                      <tr key={sym} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-2 px-3 font-bold text-slate-200">{sym}</td>
                        <td className="py-2 px-3 text-blue-400">{tvTicker}</td>
                        <td className="py-2 px-3 text-slate-300">
                          {isFx ? bid.toFixed(4) : sym === 'XAUUSD' ? bid.toFixed(2) : bid.toFixed(0)}
                        </td>
                        <td className="py-2 px-3 text-slate-300">
                          {isFx ? ask.toFixed(4) : sym === 'XAUUSD' ? ask.toFixed(2) : ask.toFixed(0)}
                        </td>
                        <td className="py-2 px-3 text-emerald-400 font-semibold">
                          {isFx
                            ? `${(spread * 10000).toFixed(1)} pips`
                            : sym === 'XAUUSD'
                            ? `$${spread.toFixed(2)}`
                            : `$${spread.toFixed(0)}`}
                        </td>
                      </tr>
                    );
                  }
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* How to add API Key if desired */}
        <div className="p-3 bg-[#151b28] border border-slate-800/80 rounded-lg text-xs space-y-1.5">
          <div className="font-semibold text-slate-200 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Adding Your Personal OANDA Credentials (Optional)</span>
          </div>
          <p className="text-slate-400 text-[11px] leading-relaxed">
            If you already have or obtain an OANDA account, you can configure your personal credentials in the platform environment secrets:
          </p>
          <div className="font-mono text-[10px] bg-[#0b0e14] p-2 rounded border border-slate-800 text-slate-300">
            <div>OANDA_API_KEY="your_personal_v20_access_token"</div>
            <div>OANDA_ACCOUNT_ID="101-001-XXXXXXX-001" (optional)</div>
            <div>OANDA_ENV="practice" (or "live")</div>
          </div>
          <p className="text-slate-500 text-[10px]">
            If you do not have an API key, no action is needed — the platform runs automatically in full real-time mode with TradingView OANDA feeds.
          </p>
        </div>

        {/* Modal Footer */}
        <div className="mt-5 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors shadow-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
