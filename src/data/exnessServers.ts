export interface ExnessServerInfo {
  id: string;
  name: string;
  platform: 'MT5' | 'MT4';
  type: 'REAL' | 'TRIAL';
  category: string;
  datacenter: string;
  approxPingMs: number;
}

// Generate MT5 Real servers (Exness-MT5Real, Exness-MT5Real2 through Exness-MT5Real50 + Cent)
const generateMT5RealServers = (): ExnessServerInfo[] => {
  const servers: ExnessServerInfo[] = [
    {
      id: 'Exness-MT5Real',
      name: 'Exness-MT5Real (Standard Real 1)',
      platform: 'MT5',
      type: 'REAL',
      category: 'Exness MT5 Real',
      datacenter: 'London LD4 (Equinix)',
      approxPingMs: 24,
    },
  ];

  for (let i = 2; i <= 50; i++) {
    const id = `Exness-MT5Real${i}`;
    let dc = 'London LD4 (Equinix)';
    let ping = 24 + (i % 6);
    if (i >= 11 && i <= 20) {
      dc = 'Amsterdam AMS1';
      ping = 28 + (i % 5);
    } else if (i >= 21 && i <= 30) {
      dc = 'Singapore SG1';
      ping = 34 + (i % 8);
    } else if (i >= 31 && i <= 40) {
      dc = 'Frankfurt FR2';
      ping = 30 + (i % 5);
    } else if (i >= 41) {
      dc = 'Tokyo TY3';
      ping = 42 + (i % 6);
    }

    servers.push({
      id,
      name: `${id} (Real Server ${i})`,
      platform: 'MT5',
      type: 'REAL',
      category: 'Exness MT5 Real',
      datacenter: dc,
      approxPingMs: ping,
    });
  }

  // MT5 Real Cent accounts
  for (let i = 1; i <= 5; i++) {
    const id = i === 1 ? 'Exness-MT5RealCent' : `Exness-MT5RealCent${i}`;
    servers.push({
      id,
      name: `${id} (MT5 Cent Real ${i})`,
      platform: 'MT5',
      type: 'REAL',
      category: 'Exness MT5 Cent Real',
      datacenter: 'Amsterdam AMS1',
      approxPingMs: 31,
    });
  }

  return servers;
};

// Generate MT4 Real servers (Exness-Real1 through Exness-Real50 + Cent)
const generateMT4RealServers = (): ExnessServerInfo[] => {
  const servers: ExnessServerInfo[] = [];

  for (let i = 1; i <= 50; i++) {
    const id = `Exness-Real${i}`;
    let dc = 'London LD4 (Equinix)';
    let ping = 25 + (i % 5);
    if (i >= 11 && i <= 22) {
      dc = 'Amsterdam AMS1';
      ping = 29 + (i % 5);
    } else if (i >= 23 && i <= 32) {
      dc = 'Singapore SG1';
      ping = 36 + (i % 7);
    } else if (i >= 33 && i <= 42) {
      dc = 'Frankfurt FR2';
      ping = 31 + (i % 5);
    } else if (i >= 43) {
      dc = 'Tokyo TY3';
      ping = 43 + (i % 6);
    }

    servers.push({
      id,
      name: `${id} (MT4 Real Server ${i})`,
      platform: 'MT4',
      type: 'REAL',
      category: 'Exness MT4 Real',
      datacenter: dc,
      approxPingMs: ping,
    });
  }

  // MT4 Real Cent accounts
  for (let i = 1; i <= 10; i++) {
    const id = `Exness-RealCent${i}`;
    servers.push({
      id,
      name: `${id} (MT4 Cent Real ${i})`,
      platform: 'MT4',
      type: 'REAL',
      category: 'Exness MT4 Cent Real',
      datacenter: 'Amsterdam AMS1',
      approxPingMs: 30 + (i % 4),
    });
  }

  return servers;
};

// Generate MT5 Trial (Demo) servers (Exness-MT5Trial through Exness-MT5Trial25 + Cent)
const generateMT5TrialServers = (): ExnessServerInfo[] => {
  const servers: ExnessServerInfo[] = [
    {
      id: 'Exness-MT5Trial',
      name: 'Exness-MT5Trial (MT5 Demo 1)',
      platform: 'MT5',
      type: 'TRIAL',
      category: 'Exness MT5 Demo / Trial',
      datacenter: 'London LD4 (Equinix)',
      approxPingMs: 27,
    },
  ];

  for (let i = 2; i <= 25; i++) {
    const id = `Exness-MT5Trial${i}`;
    let dc = 'London LD4 (Equinix)';
    if (i >= 8 && i <= 15) dc = 'Amsterdam AMS1';
    else if (i >= 16 && i <= 20) dc = 'Singapore SG1';
    else if (i >= 21) dc = 'Frankfurt FR2';

    servers.push({
      id,
      name: `${id} (MT5 Demo Server ${i})`,
      platform: 'MT5',
      type: 'TRIAL',
      category: 'Exness MT5 Demo / Trial',
      datacenter: dc,
      approxPingMs: 28 + (i % 6),
    });
  }

  // MT5 Trial Cent
  for (let i = 1; i <= 5; i++) {
    const id = i === 1 ? 'Exness-MT5TrialCent' : `Exness-MT5TrialCent${i}`;
    servers.push({
      id,
      name: `${id} (MT5 Cent Demo ${i})`,
      platform: 'MT5',
      type: 'TRIAL',
      category: 'Exness MT5 Cent Trial',
      datacenter: 'Amsterdam AMS1',
      approxPingMs: 32,
    });
  }

  return servers;
};

// Generate MT4 Trial (Demo) servers (Exness-Trial through Exness-Trial25 + Cent)
const generateMT4TrialServers = (): ExnessServerInfo[] => {
  const servers: ExnessServerInfo[] = [
    {
      id: 'Exness-Trial',
      name: 'Exness-Trial (MT4 Demo 1)',
      platform: 'MT4',
      type: 'TRIAL',
      category: 'Exness MT4 Demo / Trial',
      datacenter: 'London LD4 (Equinix)',
      approxPingMs: 29,
    },
  ];

  for (let i = 2; i <= 25; i++) {
    const id = `Exness-Trial${i}`;
    let dc = 'London LD4 (Equinix)';
    if (i >= 8 && i <= 15) dc = 'Amsterdam AMS1';
    else if (i >= 16 && i <= 20) dc = 'Singapore SG1';
    else if (i >= 21) dc = 'Frankfurt FR2';

    servers.push({
      id,
      name: `${id} (MT4 Demo Server ${i})`,
      platform: 'MT4',
      type: 'TRIAL',
      category: 'Exness MT4 Demo / Trial',
      datacenter: dc,
      approxPingMs: 29 + (i % 6),
    });
  }

  // MT4 Trial Cent
  for (let i = 1; i <= 5; i++) {
    const id = i === 1 ? 'Exness-TrialCent' : `Exness-TrialCent${i}`;
    servers.push({
      id,
      name: `${id} (MT4 Cent Demo ${i})`,
      platform: 'MT4',
      type: 'TRIAL',
      category: 'Exness MT4 Cent Trial',
      datacenter: 'Amsterdam AMS1',
      approxPingMs: 33,
    });
  }

  return servers;
};

export const ALL_EXNESS_SERVERS: ExnessServerInfo[] = [
  ...generateMT5RealServers(),
  ...generateMT4RealServers(),
  ...generateMT5TrialServers(),
  ...generateMT4TrialServers(),
];

export const EXNESS_SERVER_CATEGORIES = [
  { label: 'Exness MT5 Real (Live)', key: 'MT5_REAL', filter: (s: ExnessServerInfo) => s.platform === 'MT5' && s.type === 'REAL' },
  { label: 'Exness MT4 Real (Live)', key: 'MT4_REAL', filter: (s: ExnessServerInfo) => s.platform === 'MT4' && s.type === 'REAL' },
  { label: 'Exness MT5 Trial (Demo)', key: 'MT5_TRIAL', filter: (s: ExnessServerInfo) => s.platform === 'MT5' && s.type === 'TRIAL' },
  { label: 'Exness MT4 Trial (Demo)', key: 'MT4_TRIAL', filter: (s: ExnessServerInfo) => s.platform === 'MT4' && s.type === 'TRIAL' },
];

export function getExnessServerDetails(serverId: string): ExnessServerInfo {
  const cleanId = (serverId || '').trim();
  if (!cleanId) {
    return {
      id: 'Exness-MT5Real',
      name: 'Exness-MT5Real (Standard Real 1)',
      platform: 'MT5',
      type: 'REAL',
      category: 'Exness MT5 Real',
      datacenter: 'London LD4 (Equinix)',
      approxPingMs: 24,
    };
  }

  const match = ALL_EXNESS_SERVERS.find(
    (s) => s.id.toLowerCase() === cleanId.toLowerCase()
  );

  if (match) return match;

  // Custom / Private Server Info if user typed an unlisted or newly provisioned one
  const lower = cleanId.toLowerCase();
  const isMT4 = (lower.includes('real') && !lower.includes('mt5')) || (lower.includes('trial') && !lower.includes('mt5'));
  const isTrial = lower.includes('trial') || lower.includes('demo');

  let dc = 'London LD4 (Equinix)';
  const numMatch = lower.match(/\d+/);
  if (numMatch) {
    const n = parseInt(numMatch[0], 10);
    if (n >= 11 && n <= 22) dc = 'Amsterdam AMS1';
    else if (n >= 23 && n <= 32) dc = 'Singapore SG1';
    else if (n >= 33 && n <= 42) dc = 'Frankfurt FR2';
    else if (n >= 43) dc = 'Tokyo TY3';
  }

  return {
    id: cleanId,
    name: cleanId,
    platform: isMT4 ? 'MT4' : 'MT5',
    type: isTrial ? 'TRIAL' : 'REAL',
    category: isTrial ? 'Exness Demo / Trial' : 'Exness Live Real',
    datacenter: dc,
    approxPingMs: 26,
  };
}
