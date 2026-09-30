import React, { useState } from 'react';
import {
  Check,
  CheckCircle2,
  Code,
  Copy,
  ExternalLink,
  Lock,
  Terminal,
  Webhook,
  X,
} from 'lucide-react';
import { WebhookLog } from '../types';

interface TradingViewWebhookModalProps {
  isOpen: boolean;
  onClose: () => void;
  webhookLogs: WebhookLog[];
}

export const TradingViewWebhookModal: React.FC<TradingViewWebhookModalProps> = ({
  isOpen,
  onClose,
  webhookLogs,
}) => {
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedPayload, setCopiedPayload] = useState(false);
  const [copiedPine, setCopiedPine] = useState(false);

  if (!isOpen) return null;

  const webhookUrl = `${window.location.origin}/api/webhook/tradingview`;
  const secretToken = 'smc_alpha_tv_secret_token';

  const alertJsonPayload = JSON.stringify(
    {
      secret: secretToken,
      symbol: '{{ticker}}',
      direction: '{{strategy.order.action}}',
      entry: '{{strategy.order.price}}',
      stopLoss: '{{plot_0}}',
      takeProfit: '{{plot_1}}',
      size: '{{strategy.order.contracts}}',
    },
    null,
    2
  );

  const pineScriptSnippet = `//@version=5
strategy("SMC Alpha Institutional Webhook Strategy", overlay=true, initial_capital=50000, default_qty_type=strategy.percent_of_equity, default_qty_value=1)

// Smart Money Concepts inputs
swingLength = input.int(5, "Swing Pivot Lookback")
rrRatio = input.float(2.5, "Risk-to-Reward Ratio")

// Pivots
highPivot = ta.pivothigh(high, swingLength, swingLength)
lowPivot = ta.pivotlow(low, swingLength, swingLength)

// Conditions
bullishBOS = ta.crossover(close, ta.valuewhen(highPivot, high[swingLength], 0))
bearishBOS = ta.crossunder(close, ta.valuewhen(lowPivot, low[swingLength], 0))

// Execution logic
if (bullishBOS and strategy.position_size == 0)
    sl = ta.valuewhen(lowPivot, low[swingLength], 0)
    tp = close + (close - sl) * rrRatio
    strategy.entry("SMC_LONG", strategy.long)
    strategy.exit("TP/SL", "SMC_LONG", stop=sl, limit=tp, alert_message='{"secret":"${secretToken}","symbol":"' + syminfo.ticker + '","direction":"LONG","entry":' + str.tostring(close) + ',"stopLoss":' + str.tostring(sl) + ',"takeProfit":' + str.tostring(tp) + '}')

if (bearishBOS and strategy.position_size == 0)
    sl = ta.valuewhen(highPivot, high[swingLength], 0)
    tp = close - (sl - close) * rrRatio
    strategy.entry("SMC_SHORT", strategy.short)
    strategy.exit("TP/SL", "SMC_SHORT", stop=sl, limit=tp, alert_message='{"secret":"${secretToken}","symbol":"' + syminfo.ticker + '","direction":"SHORT","entry":' + str.tostring(close) + ',"stopLoss":' + str.tostring(sl) + ',"takeProfit":' + str.tostring(tp) + '}')
`;

  const copyToClipboard = (text: string, setFn: (v: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setFn(true);
    setTimeout(() => setFn(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0f141f] border border-slate-700 rounded-xl max-w-2xl w-full p-5 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded bg-purple-600/20 text-purple-400 border border-purple-500/30">
              <Webhook className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">TradingView Alert & Webhook Bridge</h3>
              <p className="text-[11px] text-slate-400">
                Directly route TradingView Pine Script alerts to backend execution
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white font-bold text-base">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 text-xs">
          {/* Webhook Endpoint URL */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              TradingView Alert Webhook URL
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={webhookUrl ?? ''}
                className="w-full bg-[#151b28] border border-slate-700 rounded px-3 py-2 text-white font-mono text-xs focus:outline-none"
              />
              <button
                onClick={() => copyToClipboard(webhookUrl, setCopiedUrl)}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap"
              >
                {copiedUrl ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedUrl ? 'Copied' : 'Copy URL'}</span>
              </button>
            </div>
          </div>

          {/* Webhook Secret */}
          <div className="bg-[#151b28] p-3 rounded-lg border border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-slate-400 block text-[10px]">Secret Authentication Token</span>
              <span className="font-mono text-amber-300 font-bold">{secretToken}</span>
            </div>
            <span className="text-[10px] text-slate-500 font-mono">
              Validated on backend before trade routing
            </span>
          </div>

          {/* Alert Message JSON format */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-slate-300 font-semibold">
                TradingView Alert Message Body (JSON)
              </label>
              <button
                onClick={() => copyToClipboard(alertJsonPayload, setCopiedPayload)}
                className="text-blue-400 hover:text-blue-300 flex items-center gap-1 text-[11px]"
              >
                {copiedPayload ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                <span>{copiedPayload ? 'Copied' : 'Copy Payload'}</span>
              </button>
            </div>
            <pre className="bg-[#151b28] p-3 rounded border border-slate-800 text-emerald-400 font-mono text-[11px] overflow-x-auto">
              {alertJsonPayload}
            </pre>
          </div>

          {/* Pine Script Snippet */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-slate-300 font-semibold flex items-center gap-1.5">
                <Code className="w-3.5 h-3.5 text-blue-400" />
                <span>Pine Script v5 Strategy Template</span>
              </label>
              <button
                onClick={() => copyToClipboard(pineScriptSnippet, setCopiedPine)}
                className="text-blue-400 hover:text-blue-300 flex items-center gap-1 text-[11px]"
              >
                {copiedPine ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                <span>{copiedPine ? 'Copied' : 'Copy Pine Script'}</span>
              </button>
            </div>
            <pre className="bg-[#151b28] p-3 rounded border border-slate-800 text-slate-300 font-mono text-[10px] max-h-36 overflow-y-auto leading-relaxed">
              {pineScriptSnippet}
            </pre>
          </div>

          {/* Live Webhook Execution Logs */}
          <div className="space-y-1.5 pt-2 border-t border-slate-800">
            <h4 className="font-semibold text-slate-300 flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-slate-400" />
              <span>Recent Webhook Signal Logs</span>
            </h4>
            <div className="bg-[#151b28] rounded border border-slate-800 max-h-28 overflow-y-auto divide-y divide-slate-800/60 font-mono text-[10px]">
              {webhookLogs.length === 0 ? (
                <div className="p-3 text-center text-slate-500 font-sans">
                  No webhook alerts received yet. Ready to listen on {webhookUrl}.
                </div>
              ) : (
                webhookLogs.map((log) => (
                  <div key={log.id} className="p-2 flex items-center justify-between">
                    <span className="text-slate-400">{new Date(log.timestamp).toLocaleTimeString()}</span>
                    <span className="font-bold text-white">{log.symbol} {log.action}</span>
                    <span
                      className={`px-1.5 py-0.2 rounded font-semibold ${
                        log.status === 'SUCCESS' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                      }`}
                    >
                      {log.status}
                    </span>
                    <span className="text-slate-400 truncate max-w-xs">{log.message}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2 rounded bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
};
