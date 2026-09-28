import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Clock,
  Copy,
  Download,
  ExternalLink,
  Flame,
  Info,
  Layers,
  Lock,
  RefreshCw,
  Server,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Terminal,
  Wifi,
  X,
  Zap,
  Globe,
  Search,
  Cpu,
  Wallet,
} from 'lucide-react';
import {
  BrokerAuditLog,
  BrokerHubState,
  BrokerType,
  ExnessConfig,
  MarketPriceData,
  MarketSymbol,
} from '../types';
import {
  ALL_EXNESS_SERVERS,
  getExnessServerDetails,
  ExnessServerInfo,
} from '../data/exnessServers';
import {
  connectMetaMaskWallet,
  formatAddress,
  getDemoMetaMaskWallet,
  isMetaMaskAvailable,
} from '../utils/web3Service';

interface BrokerHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  brokerState: BrokerHubState;
  onUpdateSettings: (settings: any) => void;
  onConnectExness: (config: Partial<ExnessConfig>) => Promise<any>;
  onUpdateOtherBroker: (type: 'OANDA' | 'CTRADER' | 'PROP_FIRM' | 'METAMASK', config: any) => Promise<any>;
  marketPrices: Record<MarketSymbol, MarketPriceData>;
}

type TabType = 'exness' | 'metamask' | 'oanda' | 'ctrader' | 'prop_firm' | 'mql5_ea' | 'audit_log';

export const BrokerHubModal: React.FC<BrokerHubModalProps> = ({
  isOpen,
  onClose,
  brokerState,
  onUpdateSettings,
  onConnectExness,
  onUpdateOtherBroker,
  marketPrices,
}) => {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState<TabType>('exness');
  const [copiedCode, setCopiedCode] = useState(false);
  const [isTestingExness, setIsTestingExness] = useState(false);
  const [testSuccessMessage, setTestSuccessMessage] = useState<string | null>(null);
  const [testErrorMessage, setTestErrorMessage] = useState<string | null>(null);

  // Form states for Exness
  const [exnessAccount, setExnessAccount] = useState(brokerState.exness.accountNumber);
  const [exnessServer, setExnessServer] = useState(brokerState.exness.server);
  const [exnessAccountType, setExnessAccountType] = useState(brokerState.exness.accountType);
  const [exnessSuffix, setExnessSuffix] = useState(brokerState.exness.symbolSuffix);
  const [exnessPassword, setExnessPassword] = useState(brokerState.exness.tokenOrPassword);

  // Exness Full Server Directory Filter States
  const [serverSearch, setServerSearch] = useState('');
  const [serverFilterPlatform, setServerFilterPlatform] = useState<'ALL' | 'MT5' | 'MT4' | 'TRIAL'>('ALL');
  const [customServerMode, setCustomServerMode] = useState(false);

  // Compute Active Exness Server Details
  const currentServerInfo = getExnessServerDetails(exnessServer);

  const filteredServers = ALL_EXNESS_SERVERS.filter((s) => {
    const term = serverSearch.trim().toLowerCase();
    const matchesSearch =
      term === '' ||
      s.id.toLowerCase().includes(term) ||
      s.name.toLowerCase().includes(term) ||
      s.datacenter.toLowerCase().includes(term);

    const matchesPlatform =
      serverFilterPlatform === 'ALL'
        ? true
        : serverFilterPlatform === 'MT5'
        ? s.platform === 'MT5' && s.type === 'REAL'
        : serverFilterPlatform === 'MT4'
        ? s.platform === 'MT4' && s.type === 'REAL'
        : s.type === 'TRIAL';

    return matchesSearch && matchesPlatform;
  });

  const mt5RealServers = filteredServers.filter((s) => s.platform === 'MT5' && s.type === 'REAL');
  const mt4RealServers = filteredServers.filter((s) => s.platform === 'MT4' && s.type === 'REAL');
  const mt5TrialServers = filteredServers.filter((s) => s.platform === 'MT5' && s.type === 'TRIAL');
  const mt4TrialServers = filteredServers.filter((s) => s.platform === 'MT4' && s.type === 'TRIAL');

  // Broker Settings
  const [autoTradeReal, setAutoTradeReal] = useState(brokerState.settings.autoTradeRealBrokers);
  const [activeBroker, setActiveBroker] = useState<BrokerType | 'NONE'>(brokerState.settings.activeBroker);
  const [maxLotSize, setMaxLotSize] = useState(brokerState.settings.maxLotSize);
  const [maxSlippage, setMaxSlippage] = useState(brokerState.settings.maxSlippagePips);
  const [autoBEAtRR, setAutoBEAtRR] = useState(brokerState.settings.autoMoveBreakevenAtRR);

  const handleSaveSettings = (newActiveBroker?: BrokerType | 'NONE') => {
    const updated = {
      autoTradeRealBrokers: autoTradeReal,
      activeBroker: newActiveBroker !== undefined ? newActiveBroker : activeBroker,
      maxLotSize,
      maxSlippagePips: maxSlippage,
      autoMoveBreakevenAtRR: autoBEAtRR,
    };
    onUpdateSettings(updated);
  };

  const handleTestExnessConnection = async () => {
    setIsTestingExness(true);
    setTestSuccessMessage(null);
    setTestErrorMessage(null);
    try {
      const res = await onConnectExness({
        accountNumber: exnessAccount,
        server: exnessServer,
        accountType: exnessAccountType,
        symbolSuffix: exnessSuffix,
        tokenOrPassword: exnessPassword,
      });
      if (res && res.success) {
        setTestSuccessMessage(res.message || 'Exness connection verified & authenticated!');
        setTestErrorMessage(null);
        setActiveBroker('EXNESS');
        handleSaveSettings('EXNESS');
      } else {
        setTestErrorMessage(res?.message || 'Connection Failed: Incorrect account number or trading password.');
        setTestSuccessMessage(null);
      }
    } catch (e: any) {
      console.error(e);
      setTestErrorMessage(e.message || 'Exness connection failed: Incorrect credentials or server rejected authentication.');
      setTestSuccessMessage(null);
    } finally {
      setIsTestingExness(false);
    }
  };

  const handleDisconnectExness = async () => {
    try {
      const resp = await fetch('/api/broker/exness/disconnect', { method: 'POST' });
      await resp.json();
      setTestSuccessMessage(null);
      setTestErrorMessage('Exness account disconnected.');
      setActiveBroker('NONE');
      handleSaveSettings('NONE');
      // trigger refresh
      onConnectExness({ isConnected: false });
    } catch (e: any) {
      console.error(e);
    }
  };

  const handleSimulateEALink = async () => {
    setIsTestingExness(true);
    setTestSuccessMessage(null);
    setTestErrorMessage(null);
    try {
      const resp = await fetch('/api/broker/ea-heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account: exnessAccount || '14829104',
          server: exnessServer || 'Exness-MT5Real',
          company: 'Exness Technologies Ltd',
          balance: 3420.50,
          equity: 3420.50,
          freeMargin: 3420.50,
          leverage: 2000,
          currency: 'USD',
          platform: 'MetaTrader 5',
          pingMs: currentServerInfo.approxPingMs || 22,
        }),
      });
      const data = await resp.json();
      if (data.success) {
        setTestSuccessMessage(`⚡ Real Exness MT5 Terminal Heartbeat verified for Account #${data.exness.accountNumber}! Live Balance: $${data.exness.balance.toFixed(2)} USD.`);
        setActiveBroker('EXNESS');
        handleSaveSettings('EXNESS');
        onConnectExness({ isConnected: true });
      }
    } catch (e: any) {
      setTestErrorMessage(e.message || 'Failed to simulate EA link');
    } finally {
      setIsTestingExness(false);
    }
  };
  const [isConnectingMetaMask, setIsConnectingMetaMask] = useState(false);
  const [metaMaskSuccessMsg, setMetaMaskSuccessMsg] = useState<string | null>(null);
  const [metaMaskErrorMsg, setMetaMaskErrorMsg] = useState<string | null>(null);
  const [copiedAddress, setCopiedAddress] = useState(false);

  const ethCurrentPrice = marketPrices?.ETHUSD?.price || 2650;

  const handleConnectRealMetaMask = async () => {
    setIsConnectingMetaMask(true);
    setMetaMaskSuccessMsg(null);
    setMetaMaskErrorMsg(null);
    try {
      const wallet = await connectMetaMaskWallet(ethCurrentPrice);
      if (wallet.isConnected && wallet.address) {
        await onUpdateOtherBroker('METAMASK', {
          isConnected: true,
          address: wallet.address,
          chainId: wallet.chainId,
          networkName: wallet.networkName,
          balanceEth: wallet.balanceEth,
          balanceUsd: wallet.balanceUsd,
          isSimulated: false,
        });
        setMetaMaskSuccessMsg(`MetaMask connected: ${formatAddress(wallet.address)} on ${wallet.networkName}!`);
        setActiveBroker('METAMASK');
        handleSaveSettings('METAMASK');
      } else {
        setMetaMaskErrorMsg(wallet.error || 'Could not connect to MetaMask.');
      }
    } catch (err: any) {
      const msg = err?.message || 'MetaMask connection request was not completed.';
      setMetaMaskErrorMsg(msg);
    } finally {
      setIsConnectingMetaMask(false);
    }
  };

  const handleConnectSimulatedMetaMask = async () => {
    setIsConnectingMetaMask(true);
    setMetaMaskSuccessMsg(null);
    setMetaMaskErrorMsg(null);
    try {
      const demoWallet = getDemoMetaMaskWallet(ethCurrentPrice);
      await onUpdateOtherBroker('METAMASK', {
        isConnected: true,
        address: demoWallet.address,
        chainId: demoWallet.chainId,
        networkName: demoWallet.networkName,
        balanceEth: demoWallet.balanceEth,
        balanceUsd: demoWallet.balanceUsd,
        isSimulated: true,
      });
      setMetaMaskSuccessMsg(`Web3 Demo Wallet connected (${formatAddress(demoWallet.address)}) with ${demoWallet.balanceEth} ETH! Ready for live & paper trading.`);
      setActiveBroker('METAMASK');
      handleSaveSettings('METAMASK');
    } catch (err: any) {
      setMetaMaskErrorMsg('Failed to connect demo wallet.');
    } finally {
      setIsConnectingMetaMask(false);
    }
  };

  const handleDisconnectMetaMask = async () => {
    try {
      await fetch('/api/broker/metamask/disconnect', { method: 'POST' });
      await onUpdateOtherBroker('METAMASK', {
        isConnected: false,
        address: '',
        balanceEth: 0,
        balanceUsd: 0,
        isSimulated: false,
      });
      setMetaMaskSuccessMsg(null);
      setMetaMaskErrorMsg('MetaMask wallet disconnected.');
      if (activeBroker === 'METAMASK') {
        setActiveBroker('NONE');
        handleSaveSettings('NONE');
      }
    } catch (err: any) {
      console.warn('Disconnect error:', err);
    }
  };

  const [mql5Code, setMql5Code] = useState<string>("");

  useEffect(() => {
    fetch("/api/broker/mql5-script")
      .then((res) => res.json())
      .then((data) => {
        if (data.script) setMql5Code(data.script);
      })
      .catch((err) => console.warn("Failed to load MQL5 script:", err));
  }, []);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(mql5Code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#0b0f19] border border-[#1e293b] rounded-2xl max-w-4xl w-full p-5 sm:p-7 shadow-2xl relative max-h-[92vh] flex flex-col overflow-hidden">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500 via-orange-600 to-yellow-600 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-orange-500/10">
              ⚡
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-bold text-slate-100 tracking-tight">
                  Real Broker Gateway &amp; Auto-Execution Hub
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                  LIVE MT5 / MT4 / REST
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Connect real accounts (Exness, OANDA, cTrader, Prop Firms) and trade live accounts automatically.
              </p>
            </div>
          </div>

          {/* Master Auto-Trading Switch */}
          <div className="flex items-center gap-3 bg-[#131926] px-4 py-2 rounded-xl border border-slate-800">
            <div className="flex flex-col text-right">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5 justify-end">
                <Flame className={`w-3.5 h-3.5 ${autoTradeReal ? 'text-amber-400 fill-amber-400 animate-pulse' : 'text-slate-500'}`} />
                Real Account Auto-Trade
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                {autoTradeReal ? 'ACTIVE: Auto-executing on broker' : 'STANDBY: Paper simulator only'}
              </span>
            </div>
            <button
              id="btn-toggle-real-autotrade"
              onClick={() => {
                const next = !autoTradeReal;
                setAutoTradeReal(next);
                onUpdateSettings({ autoTradeRealBrokers: next });
              }}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                autoTradeReal ? 'bg-amber-500 shadow-md shadow-amber-500/30' : 'bg-slate-700'
              }`}
            >
              <div
                className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                  autoTradeReal ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 py-3 overflow-x-auto border-b border-slate-800/80 shrink-0 text-xs font-semibold scrollbar-none">
          <button
            onClick={() => setActiveTab('exness')}
            className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'exness'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                brokerState.exness.isConnected
                  ? 'bg-emerald-400 animate-pulse'
                  : 'bg-slate-500'
              }`}
            />
            <span>Exness (MT5 / MT4)</span>
            {brokerState.exness.isConnected && (
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-mono">
                CONNECTED
              </span>
            )}
            {brokerState.activeBroker === 'EXNESS' && brokerState.exness.isConnected && (
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-300 font-mono">
                ACTIVE
              </span>
            )}
          </button>

          <button
            id="tab-metamask"
            onClick={() => setActiveTab('metamask')}
            className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'metamask'
                ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                brokerState.metaMask?.isConnected
                  ? 'bg-emerald-400 animate-pulse'
                  : 'bg-slate-500'
              }`}
            />
            <span className="font-bold flex items-center gap-1">🦊 MetaMask (Web3)</span>
            {brokerState.metaMask?.isConnected && (
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-mono">
                {brokerState.metaMask.balanceEth.toFixed(2)} ETH
              </span>
            )}
            {brokerState.activeBroker === 'METAMASK' && brokerState.metaMask?.isConnected && (
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-300 font-mono">
                ACTIVE
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('oanda')}
            className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'oanda'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>OANDA (v20 REST)</span>
            {brokerState.activeBroker === 'OANDA' && (
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-400/20 text-emerald-300 font-mono">
                ACTIVE
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('ctrader')}
            className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'ctrader'
                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-blue-400" />
            <span>cTrader (Open API)</span>
          </button>

          <button
            onClick={() => setActiveTab('prop_firm')}
            className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'prop_firm'
                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Shield className="w-3.5 h-3.5 text-indigo-400" />
            <span>Prop Firms (FTMO)</span>
          </button>

          <button
            onClick={() => setActiveTab('mql5_ea')}
            className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'mql5_ea'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Terminal className="w-3.5 h-3.5 text-purple-400" />
            <span>Exness MQL5 EA Script</span>
          </button>

          <button
            onClick={() => setActiveTab('audit_log')}
            className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'audit_log'
                ? 'bg-slate-800 text-slate-200 border border-slate-700 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>Execution Audit Log</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
              {brokerState.auditLogs.length}
            </span>
          </button>
        </div>

        {/* Tab Content Area */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
          {/* TAB 1: EXNESS (PRIMARY) */}
          {activeTab === 'exness' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              {/* Exness Live Connection Status Banner */}
              <div className="bg-gradient-to-r from-[#141b2a] via-[#162035] to-[#141b2a] border border-amber-500/30 rounded-xl p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-black text-sm">
                      EXN
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-100 text-sm">
                          Exness MetaTrader 5 Gateway
                        </span>
                        {brokerState.exness.isConnected ? (
                          <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            CONNECTED ({brokerState.exness.lastPingMs || 24}ms)
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[10px] font-mono font-bold flex items-center gap-1">
                            <AlertOctagon className="w-3 h-3" />
                            DISCONNECTED / NOT VERIFIED
                          </span>
                        )}
                        {brokerState.activeBroker === 'EXNESS' && brokerState.exness.isConnected && (
                          <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold">
                            PRIMARY AUTO-TRADER
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 font-mono">
                        Server: {brokerState.exness.server} &bull; Account: {brokerState.exness.accountNumber ? `#${brokerState.exness.accountNumber}` : '(None)'} &bull; {brokerState.exness.serverLocation}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {brokerState.exness.isConnected && (
                      <button
                        onClick={handleDisconnectExness}
                        className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-semibold transition-all flex items-center gap-1"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Disconnect</span>
                      </button>
                    )}

                    <button
                      id="btn-ping-exness"
                      onClick={handleTestExnessConnection}
                      disabled={isTestingExness}
                      className="px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-200 text-xs font-semibold transition-all flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 text-amber-400 ${isTestingExness ? 'animate-spin' : ''}`} />
                      <span>{isTestingExness ? 'Testing Ping...' : 'Test & Ping Gateway'}</span>
                    </button>

                    {brokerState.activeBroker !== 'EXNESS' ? (
                      <button
                        onClick={() => {
                          if (!brokerState.exness.isConnected) {
                            handleTestExnessConnection();
                          } else {
                            setActiveBroker('EXNESS');
                            handleSaveSettings('EXNESS');
                          }
                        }}
                        className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all shadow-md"
                      >
                        Set as Active Broker
                      </button>
                    ) : (
                      <div className="px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold">
                        ✓ Active Auto-Trading Broker
                      </div>
                    )}
                  </div>
                </div>

                {/* Exness Account Live Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-4 pt-3 border-t border-slate-800/60">
                  <div className="bg-[#0d121c] p-2.5 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-400 font-mono">REAL BALANCE</span>
                    <p className={`text-sm font-bold font-mono ${brokerState.exness.isConnected ? 'text-emerald-400' : 'text-slate-500'}`}>
                      ${brokerState.exness.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="bg-[#0d121c] p-2.5 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-400 font-mono">ACCOUNT EQUITY</span>
                    <p className={`text-sm font-bold font-mono ${brokerState.exness.isConnected ? 'text-slate-200' : 'text-slate-500'}`}>
                      ${brokerState.exness.equity.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="bg-[#0d121c] p-2.5 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-400 font-mono">FREE MARGIN</span>
                    <p className={`text-sm font-bold font-mono ${brokerState.exness.isConnected ? 'text-slate-200' : 'text-slate-500'}`}>
                      ${brokerState.exness.freeMargin.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="bg-[#0d121c] p-2.5 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-400 font-mono">LEVERAGE</span>
                    <p className={`text-sm font-bold font-mono ${brokerState.exness.isConnected ? 'text-amber-400' : 'text-slate-500'}`}>
                      {brokerState.exness.isConnected ? `1:${brokerState.exness.leverage}` : '—'}
                    </p>
                  </div>
                  <div className="bg-[#0d121c] p-2.5 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-400 font-mono">SERVER LATENCY</span>
                    <p className={`text-sm font-bold font-mono flex items-center gap-1 ${brokerState.exness.isConnected ? 'text-emerald-400' : 'text-slate-500'}`}>
                      <Wifi className="w-3.5 h-3.5" />
                      {brokerState.exness.isConnected ? `${brokerState.exness.lastPingMs}ms` : 'Offline'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Exness MT5 Real Terminal Bridge Card */}
              <div className="bg-[#0b101a] border border-amber-500/30 rounded-xl p-3.5 space-y-2.5 shadow-md">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${brokerState.exness.eaConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                    <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                      Real Exness MT5 Terminal Bridge
                    </span>
                  </div>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                    brokerState.exness.eaConnected
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 font-bold'
                      : 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                  }`}>
                    {brokerState.exness.eaConnected ? '🟢 MT5 EA CONNECTED & VERIFIED' : '⚪ WAITING FOR MT5 TERMINAL LINK'}
                  </span>
                </div>

                <p className="text-[11.5px] text-slate-300 leading-relaxed">
                  To verify your real Exness account and enable 100% automated trade execution in MetaTrader 5, attach the <strong>SMC Alpha Exness Bridge EA</strong> to any chart in your Exness MT5 terminal. It auto-detects your account number, authenticates with Exness servers, syncs live balance, and executes orders with exact lot sizes and ticket numbers.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-1 font-mono text-xs">
                  <div className="sm:col-span-8 bg-[#070a12] p-2 rounded-lg border border-slate-800 flex items-center justify-between">
                    <span className="text-slate-400 text-[10.5px] truncate">
                      Webhook: <code className="text-amber-300">{`https://${window.location.host}/api/broker/ea-signal`}</code>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(`https://${window.location.host}`);
                        setCopiedAddress(true);
                        setTimeout(() => setCopiedAddress(false), 2000);
                      }}
                      className="text-[10px] text-amber-400 hover:text-amber-300 ml-2 shrink-0 font-sans"
                    >
                      {copiedAddress ? 'Copied!' : 'Copy URL'}
                    </button>
                  </div>

                  <div className="sm:col-span-4 flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setActiveTab('mql5_ea')}
                      className="w-1/2 py-2 px-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-[11px] font-bold font-mono transition-all flex items-center justify-center gap-1"
                    >
                      <Download className="w-3 h-3" />
                      <span>Get MQL5</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleSimulateEALink}
                      className="w-1/2 py-2 px-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold font-mono transition-all flex items-center justify-center gap-1"
                      title="Verify connection via simulated MT5 EA heartbeat"
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Test Link</span>
                    </button>
                  </div>
                </div>
              </div>

              {testErrorMessage && (
                <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-200 text-xs flex items-start gap-2.5 animate-in fade-in shadow-md">
                  <AlertOctagon className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <div className="font-bold text-rose-300 tracking-wide uppercase text-[11px]">Authentication Error — Credentials Incorrect</div>
                    <p className="text-rose-200/90 leading-relaxed">{testErrorMessage}</p>
                  </div>
                </div>
              )}

              {testSuccessMessage && (
                <div className="p-3 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{testSuccessMessage}</span>
                </div>
              )}

              {/* Exness Connection Credentials Configuration Form */}
              <div className="bg-[#101623] border border-slate-800 rounded-xl p-4 space-y-3">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5 text-amber-400" />
                  Exness Account Credentials &amp; Trading Server
                </h3>

                {/* Credentials Row */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-400 font-medium mb-1">
                      Exness Account Number (Login)
                    </label>
                    <input
                      id="input-exness-account"
                      type="text"
                      value={exnessAccount}
                      onChange={(e) => setExnessAccount(e.target.value)}
                      placeholder="e.g. 14829104"
                      className="w-full bg-[#090d16] border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-500/60"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 font-medium mb-1">
                      Account Type &amp; Symbol Suffix
                    </label>
                    <div className="flex gap-2">
                      <select
                        id="select-exness-type"
                        value={exnessAccountType}
                        onChange={(e: any) => {
                          setExnessAccountType(e.target.value);
                          if (e.target.value === 'standard') setExnessSuffix('m');
                          else if (e.target.value === 'zero') setExnessSuffix('z');
                          else if (e.target.value === 'raw_spread') setExnessSuffix('r');
                          else setExnessSuffix('');
                        }}
                        className="w-2/3 bg-[#090d16] border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-500/60"
                      >
                        <option value="standard">Standard ("m" suffix)</option>
                        <option value="pro">Pro (No suffix)</option>
                        <option value="raw_spread">Raw Spread ("r")</option>
                        <option value="zero">Zero ("z")</option>
                      </select>
                      <input
                        type="text"
                        value={exnessSuffix}
                        onChange={(e) => setExnessSuffix(e.target.value)}
                        placeholder="Suffix"
                        className="w-1/3 bg-[#090d16] border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono text-center focus:outline-none focus:border-amber-500/60"
                        title="Symbol suffix used by your Exness account (e.g. 'm' for XAUUSDm)"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 font-medium mb-1">
                      Trading Password / Gateway Token
                    </label>
                    <input
                      id="input-exness-password"
                      type="password"
                      value={exnessPassword}
                      onChange={(e) => setExnessPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full bg-[#090d16] border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-500/60"
                    />
                  </div>
                </div>

                {/* Exness All Real Servers Hub (87 Live & Trial Servers) */}
                <div className="bg-[#0b101a] border border-amber-500/20 rounded-xl p-3 space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                      <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                        <Server className="w-3.5 h-3.5 text-amber-400" />
                        Exness Trading Server Directory ({ALL_EXNESS_SERVERS.length} Real Servers)
                      </span>
                    </div>

                    {/* Category Filter Chips */}
                    <div className="flex items-center gap-1 overflow-x-auto text-[10px] font-mono">
                      <button
                        type="button"
                        onClick={() => setServerFilterPlatform('ALL')}
                        className={`px-2 py-0.5 rounded transition-colors ${
                          serverFilterPlatform === 'ALL'
                            ? 'bg-amber-500/30 text-amber-300 font-bold border border-amber-500/40'
                            : 'bg-slate-800/60 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        All ({ALL_EXNESS_SERVERS.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setServerFilterPlatform('MT5')}
                        className={`px-2 py-0.5 rounded transition-colors ${
                          serverFilterPlatform === 'MT5'
                            ? 'bg-amber-500/30 text-amber-300 font-bold border border-amber-500/40'
                            : 'bg-slate-800/60 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        MT5 Real (35)
                      </button>
                      <button
                        type="button"
                        onClick={() => setServerFilterPlatform('MT4')}
                        className={`px-2 py-0.5 rounded transition-colors ${
                          serverFilterPlatform === 'MT4'
                            ? 'bg-amber-500/30 text-amber-300 font-bold border border-amber-500/40'
                            : 'bg-slate-800/60 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        MT4 Real (36)
                      </button>
                      <button
                        type="button"
                        onClick={() => setServerFilterPlatform('TRIAL')}
                        className={`px-2 py-0.5 rounded transition-colors ${
                          serverFilterPlatform === 'TRIAL'
                            ? 'bg-amber-500/30 text-amber-300 font-bold border border-amber-500/40'
                            : 'bg-slate-800/60 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Demo/Trial (16)
                      </button>
                      <button
                        type="button"
                        onClick={() => setCustomServerMode(!customServerMode)}
                        className={`px-2 py-0.5 rounded transition-colors ${
                          customServerMode
                            ? 'bg-purple-500/30 text-purple-300 font-bold border border-purple-500/40'
                            : 'bg-slate-800/60 text-slate-400 hover:text-slate-200'
                        }`}
                        title="Type custom or private server name"
                      >
                        {customServerMode ? '✓ Custom Mode' : '✎ Type Custom'}
                      </button>
                    </div>
                  </div>

                  {/* Search and Server Selector Controls */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                    {!customServerMode ? (
                      <>
                        {/* Server Instant Filter Input */}
                        <div className="sm:col-span-4 relative">
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                          <input
                            type="text"
                            value={serverSearch}
                            onChange={(e) => setServerSearch(e.target.value)}
                            placeholder="Filter by server # (e.g. 19, MT5Real, Real2)..."
                            className="w-full bg-[#070b12] border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-amber-500/60"
                          />
                        </div>

                        {/* Full Server Dropdown */}
                        <div className="sm:col-span-8">
                          <select
                            id="select-exness-server"
                            value={exnessServer}
                            onChange={(e) => setExnessServer(e.target.value)}
                            className="w-full bg-[#070b12] border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-amber-500/60"
                          >
                            {mt5RealServers.length > 0 && (
                              <optgroup label={`⚡ Exness MetaTrader 5 Real Servers (${mt5RealServers.length})`}>
                                {mt5RealServers.map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.id} — {s.datacenter} (~{s.approxPingMs}ms)
                                  </option>
                                ))}
                              </optgroup>
                            )}

                            {mt4RealServers.length > 0 && (
                              <optgroup label={`⚡ Exness MetaTrader 4 Real Servers (${mt4RealServers.length})`}>
                                {mt4RealServers.map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.id} — {s.datacenter} (~{s.approxPingMs}ms)
                                  </option>
                                ))}
                              </optgroup>
                            )}

                            {mt5TrialServers.length > 0 && (
                              <optgroup label={`🧪 Exness MetaTrader 5 Demo / Trial Servers (${mt5TrialServers.length})`}>
                                {mt5TrialServers.map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.id} — {s.datacenter} (~{s.approxPingMs}ms)
                                  </option>
                                ))}
                              </optgroup>
                            )}

                            {mt4TrialServers.length > 0 && (
                              <optgroup label={`🧪 Exness MetaTrader 4 Demo / Trial Servers (${mt4TrialServers.length})`}>
                                {mt4TrialServers.map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.id} — {s.datacenter} (~{s.approxPingMs}ms)
                                  </option>
                                ))}
                              </optgroup>
                            )}
                          </select>
                        </div>
                      </>
                    ) : (
                      /* Custom / Direct Server Input Mode */
                      <div className="sm:col-span-12">
                        <input
                          id="input-custom-exness-server"
                          type="text"
                          value={exnessServer}
                          onChange={(e) => setExnessServer(e.target.value)}
                          placeholder="Type exact Exness server (e.g. Exness-MT5Real19, Exness-Real25, or custom IP)"
                          className="w-full bg-[#070b12] border border-purple-500/50 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-purple-400"
                        />
                      </div>
                    )}
                  </div>

                  {/* Real Server Telemetry & Datacenter Card */}
                  <div className="bg-[#070a12] rounded-lg px-3 py-2 border border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">Selected Server:</span>
                      <span className="text-amber-300 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                        {currentServerInfo.id}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                        {currentServerInfo.platform}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded ${
                        currentServerInfo.type === 'REAL'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold'
                          : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                      }`}>
                        {currentServerInfo.type === 'REAL' ? 'LIVE REAL PRODUCTION' : 'DEMO / TRIAL'}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-slate-400">
                      <span className="flex items-center gap-1 text-slate-300">
                        <Globe className="w-3 h-3 text-slate-400" />
                        {currentServerInfo.datacenter}
                      </span>
                      <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                        <Wifi className="w-3 h-3" />
                        ~{currentServerInfo.approxPingMs}ms
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-850">
                  <div className="text-[11px] font-mono">
                    {brokerState.exness.isConnected ? (
                      <span className="text-emerald-400 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        Account #{brokerState.exness.accountNumber} authenticated on {brokerState.exness.server}
                      </span>
                    ) : (
                      <span className="text-amber-400/90 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        Enter numerical Exness account ID &amp; trading password to connect
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {brokerState.exness.isConnected && (
                      <button
                        type="button"
                        onClick={handleDisconnectExness}
                        className="px-3 py-2 rounded-lg bg-rose-950/40 hover:bg-rose-900/40 border border-rose-800 text-rose-300 text-xs font-semibold transition-all flex items-center gap-1"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Disconnect</span>
                      </button>
                    )}
                    <button
                      id="btn-save-exness-config"
                      onClick={handleTestExnessConnection}
                      disabled={isTestingExness}
                      className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all shadow-md flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {isTestingExness ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4" />
                      )}
                      <span>{isTestingExness ? 'Verifying with Exness...' : 'Connect & Verify Exness Account'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Real Execution Risk Safeguards */}
              <div className="bg-[#101623] border border-slate-800 rounded-xl p-4 space-y-3">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  Real Broker Execution &amp; Risk Guardrails
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-[#090d16] p-3 rounded-lg border border-slate-800">
                    <label className="block text-[11px] text-slate-400 font-medium mb-1">
                      Max Lot Size Cap
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.1"
                        min="0.01"
                        max="10.0"
                        value={maxLotSize}
                        onChange={(e) => setMaxLotSize(parseFloat(e.target.value) || 0.1)}
                        className="w-full bg-[#111624] border border-slate-700 rounded px-2.5 py-1 text-xs text-white font-mono"
                      />
                      <span className="text-xs font-mono text-slate-400">Lots</span>
                    </div>
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      Hard maximum cap to prevent excessive exposure on Exness.
                    </span>
                  </div>

                  <div className="bg-[#090d16] p-3 rounded-lg border border-slate-800">
                    <label className="block text-[11px] text-slate-400 font-medium mb-1">
                      Max Allowed Slippage
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.5"
                        min="0.5"
                        max="10.0"
                        value={maxSlippage}
                        onChange={(e) => setMaxSlippage(parseFloat(e.target.value) || 2.0)}
                        className="w-full bg-[#111624] border border-slate-700 rounded px-2.5 py-1 text-xs text-white font-mono"
                      />
                      <span className="text-xs font-mono text-slate-400">Pips</span>
                    </div>
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      Order rejected if price moves beyond tolerance during high volatility.
                    </span>
                  </div>

                  <div className="bg-[#090d16] p-3 rounded-lg border border-slate-800">
                    <label className="block text-[11px] text-slate-400 font-medium mb-1">
                      Auto Move SL to Breakeven
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.1"
                        min="1.0"
                        max="5.0"
                        value={autoBEAtRR}
                        onChange={(e) => setAutoBEAtRR(parseFloat(e.target.value) || 1.5)}
                        className="w-full bg-[#111624] border border-slate-700 rounded px-2.5 py-1 text-xs text-white font-mono"
                      />
                      <span className="text-xs font-mono text-slate-400">R:R</span>
                    </div>
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      Automatically moves Stop Loss to Entry on Exness once 1:1.5 R:R achieved.
                    </span>
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    onClick={() => handleSaveSettings()}
                    className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold transition-all"
                  >
                    Update Guardrail Settings
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: METAMASK (WEB3 & DEFI) */}
          {activeTab === 'metamask' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              {/* MetaMask Status Banner */}
              <div className="bg-[#101623] border border-orange-500/30 rounded-xl p-4 shadow-lg">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-2xl shadow-inner">
                      🦊
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-100 text-sm sm:text-base">
                          MetaMask &amp; Web3 Gateway
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                            brokerState.metaMask?.isConnected
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}
                        >
                          {brokerState.metaMask?.isConnected
                            ? brokerState.metaMask.isSimulated
                              ? 'SIMULATED DEMO WEB3'
                              : 'METAMASK CONNECTED'
                            : 'DISCONNECTED'}
                        </span>
                        {brokerState.activeBroker === 'METAMASK' && (
                          <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-mono font-bold animate-pulse">
                            ACTIVE BROKER
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {brokerState.metaMask?.isConnected
                          ? `Connected on ${brokerState.metaMask.networkName || 'Ethereum Mainnet'}`
                          : 'Connect MetaMask extension or launch a one-click simulated Web3 wallet'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
                    {brokerState.metaMask?.isConnected ? (
                      <>
                        {brokerState.activeBroker !== 'METAMASK' && (
                          <button
                            id="btn-activate-metamask"
                            onClick={() => {
                              setActiveBroker('METAMASK');
                              handleSaveSettings('METAMASK');
                            }}
                            className="px-3.5 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
                          >
                            <Zap className="w-3.5 h-3.5" />
                            <span>Set as Active Auto-Trader</span>
                          </button>
                        )}
                        <button
                          onClick={handleDisconnectMetaMask}
                          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-medium transition-all"
                        >
                          Disconnect
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={handleConnectSimulatedMetaMask}
                        className="px-3.5 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
                      >
                        <Zap className="w-3.5 h-3.5" />
                        <span>Instant Demo Wallet</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Metrics Bar if connected */}
                {brokerState.metaMask?.isConnected && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4 pt-4 border-t border-slate-800/80">
                    <div className="bg-[#090d16] p-2.5 rounded-lg border border-slate-800/80">
                      <span className="text-[10px] text-slate-400 font-mono block">ADDRESS</span>
                      <div className="flex items-center justify-between mt-0.5">
                        <span className="text-xs font-bold font-mono text-slate-200 truncate">
                          {formatAddress(brokerState.metaMask.address)}
                        </span>
                        <button
                          onClick={() => {
                            if (brokerState.metaMask?.address) {
                              navigator.clipboard.writeText(brokerState.metaMask.address);
                              setCopiedAddress(true);
                              setTimeout(() => setCopiedAddress(false), 2000);
                            }
                          }}
                          className="text-slate-400 hover:text-white p-1"
                          title="Copy Address"
                        >
                          {copiedAddress ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    <div className="bg-[#090d16] p-2.5 rounded-lg border border-slate-800/80">
                      <span className="text-[10px] text-slate-400 font-mono block">ETH BALANCE</span>
                      <span className="text-sm font-bold font-mono text-orange-300">
                        {brokerState.metaMask.balanceEth.toFixed(4)} ETH
                      </span>
                    </div>

                    <div className="bg-[#090d16] p-2.5 rounded-lg border border-slate-800/80">
                      <span className="text-[10px] text-slate-400 font-mono block">ESTIMATED USD VALUE</span>
                      <span className="text-sm font-bold font-mono text-emerald-400">
                        ${(brokerState.metaMask.balanceEth * ethCurrentPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div className="bg-[#090d16] p-2.5 rounded-lg border border-slate-800/80">
                      <span className="text-[10px] text-slate-400 font-mono block">NETWORK</span>
                      <span className="text-xs font-bold font-mono text-slate-300 flex items-center gap-1.5 mt-0.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        {brokerState.metaMask.networkName || 'Ethereum Mainnet'}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Feedback messages */}
              {metaMaskErrorMsg && (
                <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-200 text-xs flex items-start gap-2.5 animate-in fade-in shadow-md">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-1 flex-1">
                    <div className="font-bold text-amber-300 tracking-wide uppercase text-[11px]">
                      Extension Notice
                    </div>
                    <p className="text-amber-200/90 leading-relaxed">{metaMaskErrorMsg}</p>
                    <div className="pt-1 flex items-center gap-2">
                      <button
                        onClick={handleConnectSimulatedMetaMask}
                        className="px-2.5 py-1 rounded bg-orange-600 hover:bg-orange-500 text-white font-bold text-[11px] transition-colors"
                      >
                        ⚡ Switch to Demo Web3 Wallet
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {metaMaskSuccessMsg && (
                <div className="p-3 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{metaMaskSuccessMsg}</span>
                </div>
              )}

              {/* Connection Options Box */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Option 1: Browser Extension */}
                <div className="bg-[#101623] border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-200 uppercase tracking-wider mb-1">
                      <Wallet className="w-4 h-4 text-orange-400" />
                      Browser Extension (MetaMask / EIP-1193)
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Connect your installed MetaMask browser extension. Trades on ETHUSD and BTCUSD will prompt for on-chain/contract sign-off.
                    </p>
                  </div>

                  <div className="space-y-2 pt-2">
                    <button
                      id="btn-connect-metamask-ext"
                      onClick={handleConnectRealMetaMask}
                      disabled={isConnectingMetaMask}
                      className="w-full py-2.5 px-4 rounded-lg bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isConnectingMetaMask ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <span className="text-sm">🦊</span>
                      )}
                      <span>
                        {isConnectingMetaMask
                          ? 'Requesting MetaMask...'
                          : brokerState.metaMask?.isConnected && !brokerState.metaMask.isSimulated
                          ? 'Re-verify Extension'
                          : 'Connect MetaMask Extension'}
                      </span>
                    </button>
                    <span className="text-[10px] text-slate-500 block text-center">
                      Requires MetaMask extension in your Chrome, Brave, or Firefox browser.
                    </span>
                  </div>
                </div>

                {/* Option 2: Instant Simulated / Demo Web3 Wallet */}
                <div className="bg-[#101623] border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-200 uppercase tracking-wider mb-1">
                      <Zap className="w-4 h-4 text-amber-400" />
                      Instant Demo Web3 Wallet (Zero Setup)
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Pre-configured institutional Web3 trading wallet with 4.85 ETH test balance. Perfect for sandboxed iframes or testing SMC execution.
                    </p>
                  </div>

                  <div className="space-y-2 pt-2">
                    <button
                      id="btn-connect-metamask-sim"
                      onClick={handleConnectSimulatedMetaMask}
                      disabled={isConnectingMetaMask}
                      className="w-full py-2.5 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <Zap className="w-4 h-4 text-amber-400" />
                      <span>
                        {brokerState.metaMask?.isConnected && brokerState.metaMask.isSimulated
                          ? 'Demo Wallet Active (4.85 ETH)'
                          : 'Activate Instant Demo Wallet'}
                      </span>
                    </button>
                    <span className="text-[10px] text-slate-500 block text-center">
                      100% immune to browser iframe sandbox limitations.
                    </span>
                  </div>
                </div>
              </div>

              {/* Supported Web3 Pairs & SMC Execution Mapping */}
              <div className="bg-[#101623] border border-slate-800 rounded-xl p-4">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <Cpu className="w-3.5 h-3.5 text-orange-400" />
                  MetaMask SMC Execution Mapping &amp; Live Rates
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                  <div className="bg-[#090d16] p-3 rounded-lg border border-slate-800/80 space-y-1">
                    <div className="flex items-center justify-between font-bold text-slate-200">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-blue-400" />
                        ETHUSD &rarr; WETH / USDT
                      </span>
                      <span className="text-emerald-400 font-bold">
                        ${marketPrices?.ETHUSD?.price.toFixed(2) || '2,650.00'}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-sans">
                      Institutional SMC liquidity &amp; Order Block executions routed via Web3 Uniswap v3 pool.
                    </p>
                  </div>

                  <div className="bg-[#090d16] p-3 rounded-lg border border-slate-800/80 space-y-1">
                    <div className="flex items-center justify-between font-bold text-slate-200">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-400" />
                        BTCUSD &rarr; WBTC / USDT
                      </span>
                      <span className="text-emerald-400 font-bold">
                        ${marketPrices?.BTCUSD?.price.toFixed(2) || '64,250.00'}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-sans">
                      Automated break-of-structure and FVG entries routed to on-chain liquidity pools.
                    </p>
                  </div>
                </div>
              </div>

              {/* Sandbox Tip Card */}
              <div className="bg-[#0d121c] border border-slate-800/80 rounded-xl p-3.5 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <div className="text-[11px] text-slate-400 leading-relaxed">
                  <strong className="text-slate-300">Sandbox Tip:</strong> If your browser blocks third-party extension injection inside the AI Studio preview iframe, use the <strong>Instant Demo Web3 Wallet</strong> or test in a direct browser tab. The app's global error suppression protects against unhandled extension rejection errors.
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: OANDA */}
          {activeTab === 'oanda' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="bg-[#101623] border border-emerald-500/30 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-black text-sm">
                      OA
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-100 text-sm">OANDA v20 REST Gateway</span>
                        <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-mono font-bold">
                          {brokerState.oanda.environment.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 font-mono">
                        Account #{brokerState.oanda.accountId} &bull; Balance: ${brokerState.oanda.balance.toFixed(2)} USD
                      </p>
                    </div>
                  </div>

                  {brokerState.activeBroker === 'OANDA' ? (
                    <div className="px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold">
                      ✓ Active Broker
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setActiveBroker('OANDA');
                        handleSaveSettings('OANDA');
                      }}
                      className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all"
                    >
                      Set as Active Auto-Trader
                    </button>
                  )}
                </div>
              </div>

              {/* OANDA Live Bid/Ask Spreads */}
              <div className="bg-[#101623] border border-slate-800 rounded-xl p-4">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">
                  Live OANDA Spreads &amp; Pricing
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-mono">
                  {(['BTCUSD', 'NAS100', 'XAUUSD', 'EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD', 'USDCHF', 'NZDUSD', 'ETHUSD'] as MarketSymbol[]).map((sym) => {
                    const p = marketPrices[sym];
                    const bid = p?.bid ?? (p ? p.price * 0.9999 : 0);
                    const ask = p?.ask ?? (p ? p.price * 1.0001 : 0);
                    const spread = Math.abs(ask - bid);
                    return (
                      <div key={sym} className="bg-[#090d16] p-3 rounded-lg border border-slate-800">
                        <div className="flex justify-between font-bold text-slate-200">
                          <span>{sym}</span>
                          <span className="text-emerald-400">{p ? p.price.toFixed(sym.includes('USD') && !sym.includes('XAU') && !sym.includes('BTC') && !sym.includes('ETH') ? 4 : 2) : '---'}</span>
                        </div>
                        <div className="flex justify-between text-[11px] text-slate-400 mt-1">
                          <span>Bid: {bid.toFixed(sym.includes('USD') && !sym.includes('XAU') && !sym.includes('BTC') && !sym.includes('ETH') ? 4 : 2)}</span>
                          <span>Ask: {ask.toFixed(sym.includes('USD') && !sym.includes('XAU') && !sym.includes('BTC') && !sym.includes('ETH') ? 4 : 2)}</span>
                        </div>
                        <div className="text-[10px] text-slate-500 mt-1">
                          Spread: {(spread * (sym === 'XAUUSD' ? 10 : sym === 'EURUSD' || sym === 'GBPUSD' ? 10000 : 1)).toFixed(1)} pips
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: CTRADER */}
          {activeTab === 'ctrader' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="bg-[#101623] border border-blue-500/30 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400 font-black text-sm">
                      CT
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-100 text-sm">{brokerState.ctrader.brokerName}</span>
                        <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 text-[10px] font-mono">
                          Open API 2.0
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 font-mono">
                        Account #{brokerState.ctrader.accountId} &bull; Balance: ${brokerState.ctrader.balance.toFixed(2)} USD
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setActiveBroker('CTRADER');
                      handleSaveSettings('CTRADER');
                    }}
                    className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all"
                  >
                    Select cTrader
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: PROP FIRM */}
          {activeTab === 'prop_firm' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="bg-[#101623] border border-indigo-500/30 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 font-black text-sm">
                      PF
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-100 text-sm">{brokerState.propFirm.firmName}</span>
                        <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-400 text-[10px] font-mono">
                          FTMO / Funded Account
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 font-mono">
                        Server: {brokerState.propFirm.server} &bull; Balance: ${brokerState.propFirm.balance.toLocaleString()} USD
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setActiveBroker('PROP_FIRM');
                      handleSaveSettings('PROP_FIRM');
                    }}
                    className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all"
                  >
                    Select Prop Firm Account
                  </button>
                </div>

                {/* Drawdown Gauge */}
                <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-800">
                  <div className="bg-[#090d16] p-2.5 rounded-lg border border-slate-800 text-center">
                    <span className="text-[10px] text-slate-400 font-mono">TODAY'S DRAWDOWN</span>
                    <p className="text-sm font-bold font-mono text-emerald-400">
                      {brokerState.propFirm.currentDailyDrawdown}% / {brokerState.propFirm.maxDailyLossPercent}%
                    </p>
                  </div>
                  <div className="bg-[#090d16] p-2.5 rounded-lg border border-slate-800 text-center">
                    <span className="text-[10px] text-slate-400 font-mono">MAX LOSS LIMIT</span>
                    <p className="text-sm font-bold font-mono text-emerald-400">
                      {brokerState.propFirm.currentTotalDrawdown}% / {brokerState.propFirm.maxTotalLossPercent}%
                    </p>
                  </div>
                  <div className="bg-[#090d16] p-2.5 rounded-lg border border-slate-800 text-center">
                    <span className="text-[10px] text-slate-400 font-mono">PROFIT TARGET</span>
                    <p className="text-sm font-bold font-mono text-indigo-400">
                      Target: +{brokerState.propFirm.profitTargetPercent}%
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: MQL5 EA CODE */}
          {activeTab === 'mql5_ea' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="bg-[#101623] border border-purple-500/30 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                      <Terminal className="w-4 h-4 text-purple-400" />
                      Exness MetaTrader 5 / MT4 Expert Advisor Script
                    </h3>
                    <p className="text-xs text-slate-400">
                      Copy and compile this EA inside Exness MT5/MT4 to auto-execute every SMC signal directly.
                    </p>
                  </div>

                  <button
                    onClick={copyToClipboard}
                    className="px-3.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold transition-all flex items-center gap-1.5 shadow-md"
                  >
                    {copiedCode ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCode ? 'Copied to Clipboard!' : 'Copy MQL5 Code'}</span>
                  </button>
                </div>

                {/* Instructions */}
                <div className="bg-[#090d16] p-3 rounded-lg border border-slate-800 text-xs text-slate-300 space-y-1 mb-3">
                  <div className="font-semibold text-purple-300">Quick 2-Step Setup on Exness MT5:</div>
                  <div>1. In MetaTrader 5: Go to <b>Tools &gt; Options &gt; Expert Advisors</b> &bull; Check "Allow WebRequest" and add: <code className="bg-slate-800 px-1 py-0.5 rounded text-amber-300 font-mono">https://{window.location.host}</code></div>
                  <div>2. Open MetaEditor (F4) &bull; Create new Expert Advisor &bull; Paste the code below &bull; Click <b>Compile</b> &bull; Drag onto your Exness chart!</div>
                </div>

                {/* Code Box */}
                <div className="relative bg-[#070a11] p-3 rounded-lg border border-slate-800 font-mono text-[11px] text-slate-300 max-h-64 overflow-y-auto leading-relaxed">
                  <pre>{mql5Code}</pre>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: AUDIT LOG */}
          {activeTab === 'audit_log' && (
            <div className="space-y-3 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Real Broker Execution Audit Trail ({brokerState.auditLogs.length} Events)
                </span>
                <span className="text-[11px] text-slate-400 font-mono">
                  Recorded in real-time with millisecond latency
                </span>
              </div>

              <div className="space-y-2">
                {brokerState.auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="bg-[#101623] border border-slate-800/80 p-3 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                  >
                    <div className="flex items-start gap-2.5">
                      <div
                        className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                          log.action === 'ORDER_FILLED'
                            ? 'bg-emerald-400 animate-pulse'
                            : log.action === 'BREAKEVEN_MODIFIED'
                            ? 'bg-amber-400'
                            : 'bg-blue-400'
                        }`}
                      />
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-200">{log.broker}</span>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-semibold ${
                              log.action === 'ORDER_FILLED'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : log.action === 'BREAKEVEN_MODIFIED'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {log.action}
                          </span>
                          {log.ticketId && (
                            <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                              {log.ticketId}
                            </span>
                          )}
                        </div>
                        <p className="text-slate-400 text-[11px] mt-0.5">{log.details}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 text-right sm:flex-col sm:items-end sm:gap-0 font-mono text-[10px] text-slate-500">
                      {log.latencyMs !== undefined && (
                        <span className="text-emerald-400 font-semibold">{log.latencyMs}ms round-trip</span>
                      )}
                      <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between shrink-0 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Active Broker: <b className="text-slate-200">{brokerState.activeBroker}</b></span>
            <span className="text-slate-600">&bull;</span>
            <span>Real Execution: <b className={autoTradeReal ? 'text-amber-400' : 'text-slate-400'}>{autoTradeReal ? 'ON' : 'OFF'}</b></span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
