/**
 * Desktop Push Notification & Audio Alert Service for Locked Trade Positions
 */

export interface PushNotificationConfig {
  enabled: boolean;
  notifyTakeProfit: boolean;
  notifyStopLoss: boolean;
  notifyTPRunners: boolean;
  notifyApproachingSL: boolean;
  notifyBreakeven: boolean;
  soundEnabled: boolean;
  inAppBanner: boolean;
}

export interface NotificationEvent {
  id: string;
  timestamp: number;
  type: 'TAKE_PROFIT' | 'STOP_LOSS' | 'RUNNER_TP' | 'APPROACHING_SL' | 'BREAKEVEN' | 'SETUP_LIMIT' | 'CONFIRMED_SETUP' | 'TEST';
  title: string;
  message: string;
  symbol: string;
  price: number;
  pnlAmount?: number;
  pnlPercent?: number;
  extraDetails?: string;
}

const STORAGE_KEY = 'smc_push_notification_config';

export const DEFAULT_NOTIFICATION_CONFIG: PushNotificationConfig = {
  enabled: true,
  notifyTakeProfit: true,
  notifyStopLoss: true,
  notifyTPRunners: true,
  notifyApproachingSL: true,
  notifyBreakeven: true,
  soundEnabled: true,
  inAppBanner: true,
};

/**
 * Load push notification configuration from localStorage
 */
export function getStoredNotificationConfig(): PushNotificationConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return { ...DEFAULT_NOTIFICATION_CONFIG, ...JSON.parse(raw) };
    }
  } catch {
    // fallback to defaults if storage read fails
  }
  return DEFAULT_NOTIFICATION_CONFIG;
}

/**
 * Save push notification configuration to localStorage
 */
export function saveStoredNotificationConfig(config: PushNotificationConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    // silent fallback
  }
}

/**
 * Check if the browser natively supports the Web Notifications API
 */
export function isDesktopNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/**
 * Get current browser desktop notification permission status
 */
export function getDesktopNotificationPermission(): NotificationPermission {
  if (!isDesktopNotificationSupported()) return 'denied';
  return Notification.permission;
}

/**
 * Request desktop push notification permission from the user
 */
export async function requestDesktopNotificationPermission(): Promise<NotificationPermission> {
  if (!isDesktopNotificationSupported()) return 'denied';
  try {
    const result = await Notification.requestPermission();
    return result;
  } catch {
    return Notification.permission;
  }
}

export const requestNotificationPermission = requestDesktopNotificationPermission;

/**
 * Synthesize audio chime alert using browser Web Audio API
 * Avoids any external audio file dependencies and works with zero latency
 */
export function playAudioAlert(type: 'TP' | 'SL' | 'WARNING' | 'TEST' | 'BREAKEVEN' | 'SETUP_LIMIT' | 'CONFIRMED_SETUP'): void {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();

    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const now = ctx.currentTime;

    if (type === 'TP' || type === 'TEST') {
      // Ascending triumphant chime: C5 -> E5 -> G5 -> C6
      const frequencies = [523.25, 659.25, 783.99, 1046.5];
      frequencies.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);

        gain.gain.setValueAtTime(0, now + idx * 0.08);
        gain.gain.linearRampToValueAtTime(0.18, now + idx * 0.08 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.35);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.4);
      });
    } else if (type === 'CONFIRMED_SETUP') {
      // High-grade institutional confirmation chime: G4 -> C5 -> E5
      const freqs = [392.00, 523.25, 659.25];
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.09);

        gain.gain.setValueAtTime(0, now + idx * 0.09);
        gain.gain.linearRampToValueAtTime(0.2, now + idx * 0.09 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.09 + 0.3);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + idx * 0.09);
        osc.stop(now + idx * 0.09 + 0.35);
      });
    } else if (type === 'SETUP_LIMIT') {
      // Setup limit reached: 3 distinct authoritative pings (A4 -> E4 -> C4)
      const freqs = [440, 329.63, 261.63];
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.15);

        gain.gain.setValueAtTime(0, now + idx * 0.15);
        gain.gain.linearRampToValueAtTime(0.25, now + idx * 0.15 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.15 + 0.28);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + idx * 0.15);
        osc.stop(now + idx * 0.15 + 0.32);
      });
    } else if (type === 'SL') {
      // Descending cautionary tone: 480Hz -> 360Hz -> 240Hz
      const freqs = [480, 360, 240];
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.12);

        gain.gain.setValueAtTime(0, now + idx * 0.12);
        gain.gain.linearRampToValueAtTime(0.22, now + idx * 0.12 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.3);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + idx * 0.12);
        osc.stop(now + idx * 0.12 + 0.35);
      });
    } else if (type === 'BREAKEVEN') {
      // Clean dual chime (Lock sound): 440Hz -> 880Hz
      [440, 880].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.1);

        gain.gain.setValueAtTime(0, now + idx * 0.1);
        gain.gain.linearRampToValueAtTime(0.15, now + idx * 0.1 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.25);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + idx * 0.1);
        osc.stop(now + idx * 0.1 + 0.3);
      });
    } else {
      // Approach Warning: Double alert pulse
      [440, 440].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.14);

        gain.gain.setValueAtTime(0, now + idx * 0.14);
        gain.gain.linearRampToValueAtTime(0.15, now + idx * 0.14 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.14 + 0.18);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + idx * 0.14);
        osc.stop(now + idx * 0.14 + 0.22);
      });
    }
  } catch {
    // AudioContext failure fallback
  }
}

/**
 * Dispatch system desktop notification
 */
export function sendDesktopNotification(event: NotificationEvent): boolean {
  if (!isDesktopNotificationSupported()) return false;

  try {
    if (Notification.permission === 'granted') {
      const notif = new Notification(event.title, {
        body: event.message,
        tag: `smc_trade_${event.type}_${Date.now()}`,
        icon: '/favicon.ico',
      });

      notif.onclick = () => {
        window.focus();
        notif.close();
      };

      return true;
    }
  } catch {
    // In restricted iframe environments, native Notification constructor might throw
    return false;
  }

  return false;
}
