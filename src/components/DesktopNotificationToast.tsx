import React, { useEffect } from 'react';
import { AlertTriangle, Bell, CheckCircle2, ShieldAlert, Target, X } from 'lucide-react';
import { NotificationEvent } from '../utils/notificationService';

interface DesktopNotificationToastProps {
  notifications: NotificationEvent[];
  onDismiss: (id: string) => void;
  onClearAll: () => void;
}

export const DesktopNotificationToast: React.FC<DesktopNotificationToastProps> = ({
  notifications,
  onDismiss,
  onClearAll,
}) => {
  useEffect(() => {
    if (notifications.length === 0) return;

    // Automatically auto-dismiss the oldest notification after 8 seconds
    const timer = setTimeout(() => {
      if (notifications.length > 0) {
        onDismiss(notifications[0].id);
      }
    }, 8000);

    return () => clearTimeout(timer);
  }, [notifications, onDismiss]);

  if (notifications.length === 0) return null;

  return (
    <div
      id="desktop-push-notifications-container"
      className="fixed top-4 right-4 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none"
    >
      {notifications.slice(0, 3).map((item) => {
        const isTP = item.type === 'TAKE_PROFIT' || item.type === 'RUNNER_TP';
        const isSL = item.type === 'STOP_LOSS';
        const isWarning = item.type === 'APPROACHING_SL';
        const isLimit = item.type === 'SETUP_LIMIT';
        const isConfirmed = item.type === 'CONFIRMED_SETUP';

        return (
          <div
            key={item.id}
            id={`desktop-notification-${item.id}`}
            className={`pointer-events-auto rounded-xl p-3.5 border shadow-2xl backdrop-blur-md transition-all duration-300 transform translate-y-0 ${
              isLimit
                ? 'bg-[#1e1014]/95 border-rose-500/60 text-rose-200 shadow-rose-950/60 ring-1 ring-rose-500/30'
                : isConfirmed
                ? 'bg-[#0f1b2b]/95 border-indigo-500/60 text-indigo-200 shadow-indigo-950/60 ring-1 ring-indigo-500/30'
                : isTP
                ? 'bg-[#0f1b15]/95 border-emerald-500/40 text-emerald-300 shadow-emerald-950/40'
                : isSL
                ? 'bg-[#1b0f12]/95 border-rose-500/40 text-rose-300 shadow-rose-950/40'
                : isWarning
                ? 'bg-[#1b170f]/95 border-amber-500/40 text-amber-300 shadow-amber-950/40'
                : 'bg-[#0f141f]/95 border-blue-500/40 text-blue-300 shadow-blue-950/40'
            }`}
          >
            <div className="flex items-start justify-between gap-2.5">
              <div className="flex items-start gap-2.5">
                <div
                  className={`p-2 rounded-lg mt-0.5 shrink-0 ${
                    isLimit
                      ? 'bg-rose-500/25 text-rose-400 border border-rose-500/40 animate-pulse'
                      : isConfirmed
                      ? 'bg-indigo-500/25 text-indigo-400 border border-indigo-500/40'
                      : isTP
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : isSL
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      : isWarning
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  }`}
                >
                  {isLimit ? (
                    <ShieldAlert className="w-4 h-4 text-rose-400" />
                  ) : isConfirmed ? (
                    <Target className="w-4 h-4 text-indigo-400" />
                  ) : isTP ? (
                    <Target className="w-4 h-4" />
                  ) : isSL ? (
                    <ShieldAlert className="w-4 h-4" />
                  ) : isWarning ? (
                    <AlertTriangle className="w-4 h-4" />
                  ) : (
                    <Bell className="w-4 h-4" />
                  )}
                </div>

                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.2 rounded font-bold ${
                        isLimit
                          ? 'bg-rose-500/30 text-rose-300'
                          : isConfirmed
                          ? 'bg-indigo-500/30 text-indigo-300'
                          : 'bg-white/10'
                      }`}
                    >
                      {isLimit ? 'SETUP LIMIT REACHED 🛑' : isConfirmed ? 'CONFIRMED SETUP ⚡' : 'DESKTOP PUSH ALERT'}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {new Date(item.timestamp).toLocaleTimeString()}
                    </span>
                  </div>

                  <h4 className="text-xs font-bold text-slate-100 tracking-tight">
                    {item.title}
                  </h4>

                  <p className="text-[11px] text-slate-300 leading-snug">
                    {item.message}
                  </p>

                  {(item.pnlAmount !== undefined || item.price > 0) && (
                    <div className="pt-1 flex items-center gap-2 text-[10px] font-mono">
                      <span className="text-slate-400">Trigger Price: {item.price}</span>
                      {item.pnlAmount !== undefined && (
                        <span
                          className={`font-bold ${
                            item.pnlAmount >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          PnL: {item.pnlAmount >= 0 ? '+' : ''}${item.pnlAmount.toFixed(2)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <button
                id={`btn-dismiss-notification-${item.id}`}
                onClick={() => onDismiss(item.id)}
                className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-white/10 transition-colors shrink-0"
                title="Dismiss Alert"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        );
      })}

      {notifications.length > 1 && (
        <div className="flex justify-end pointer-events-auto">
          <button
            id="btn-clear-all-push-notifications"
            onClick={onClearAll}
            className="text-[10px] font-mono text-slate-400 hover:text-slate-200 bg-[#0f141f]/80 px-2 py-0.5 rounded border border-slate-700/60"
          >
            Clear all ({notifications.length})
          </button>
        </div>
      )}
    </div>
  );
};
