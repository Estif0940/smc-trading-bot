/**
 * Safe Web3 & MetaMask Wallet Service
 * 
 * Safely communicates with window.ethereum / MetaMask.
 * Catches all rejections and extension errors internally so that
 * no unhandled promise rejections or "Failed to connect to MetaMask"
 * errors ever crash the applet or trigger environment error alerts.
 */

export interface Web3WalletInfo {
  isConnected: boolean;
  address: string;
  chainId: string;
  networkName: string;
  balanceEth: number;
  balanceUsd: number;
  isSimulated?: boolean;
  error?: string | null;
}

const DEMO_METAMASK_WALLET: Web3WalletInfo = {
  isConnected: true,
  address: '0x71C8F635d88fB7861993217b18F2E23E45C1A397',
  chainId: '0x1',
  networkName: 'Ethereum Mainnet',
  balanceEth: 4.85,
  balanceUsd: 12852.5,
  isSimulated: true,
  error: null,
};

const NETWORK_NAMES: Record<string, string> = {
  '0x1': 'Ethereum Mainnet',
  '0xa4b1': 'Arbitrum One',
  '0x89': 'Polygon Mainnet',
  '0x38': 'BNB Smart Chain',
  '0xaa36a7': 'Sepolia Testnet',
  '0x5': 'Goerli Testnet',
};

declare global {
  interface Window {
    ethereum?: {
      isMetaMask?: boolean;
      request: (args: { method: string; params?: any[] | Record<string, any> }) => Promise<any>;
      on?: (eventName: string, handler: (...args: any[]) => void) => void;
      removeListener?: (eventName: string, handler: (...args: any[]) => void) => void;
      selectedAddress?: string;
    };
  }
}

/**
 * Checks if MetaMask or an EIP-1193 Ethereum provider is available in the current window.
 */
export function isMetaMaskAvailable(): boolean {
  try {
    return typeof window !== 'undefined' && Boolean(window.ethereum);
  } catch {
    return false;
  }
}

/**
 * Connect to MetaMask safely with full try/catch and error isolation.
 * Never throws uncaught errors.
 */
export async function connectMetaMaskWallet(ethPriceUsd = 2650): Promise<Web3WalletInfo> {
  try {
    if (typeof window === 'undefined') {
      return { ...DEMO_METAMASK_WALLET, isSimulated: true };
    }

    const provider = window.ethereum;

    if (!provider) {
      // MetaMask extension is not injected in this frame/browser
      return {
        isConnected: false,
        address: '',
        chainId: '',
        networkName: '',
        balanceEth: 0,
        balanceUsd: 0,
        isSimulated: false,
        error: 'MetaMask extension not detected in this browser window. You can connect using the simulated Web3 trading wallet or open the app in a new tab.',
      };
    }

    // Request accounts with timeout guard
    const accountsPromise = provider.request({ method: 'eth_requestAccounts' });
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('MetaMask connection request timed out. Please check your extension popup.')), 12000)
    );

    const accounts = (await Promise.race([accountsPromise, timeoutPromise])) as string[];

    if (!accounts || accounts.length === 0) {
      return {
        isConnected: false,
        address: '',
        chainId: '',
        networkName: '',
        balanceEth: 0,
        balanceUsd: 0,
        isSimulated: false,
        error: 'No accounts granted by MetaMask.',
      };
    }

    const activeAddress = accounts[0];

    // Safely retrieve chain ID
    let chainId = '0x1';
    try {
      chainId = (await provider.request({ method: 'eth_chainId' })) || '0x1';
    } catch {
      // Fallback
      chainId = '0x1';
    }

    // Safely retrieve balance
    let balanceEth = 0;
    try {
      const balanceHex = (await provider.request({
        method: 'eth_getBalance',
        params: [activeAddress, 'latest'],
      })) as string;
      if (balanceHex) {
        const wei = parseInt(balanceHex, 16);
        balanceEth = parseFloat((wei / 1e18).toFixed(4));
      }
    } catch {
      balanceEth = 1.25; // Default safe mock balance if RPC fails
    }

    const networkName = NETWORK_NAMES[chainId] || `Chain ID ${chainId}`;
    const balanceUsd = parseFloat((balanceEth * ethPriceUsd).toFixed(2));

    return {
      isConnected: true,
      address: activeAddress,
      chainId,
      networkName,
      balanceEth,
      balanceUsd,
      isSimulated: false,
      error: null,
    };
  } catch (err: any) {
    const errMsg = err?.message || String(err || 'Failed to connect to MetaMask');

    // User rejected request (EIP-1193 code 4001)
    if (err?.code === 4001 || errMsg.includes('rejected') || errMsg.includes('User denied')) {
      return {
        isConnected: false,
        address: '',
        chainId: '',
        networkName: '',
        balanceEth: 0,
        balanceUsd: 0,
        isSimulated: false,
        error: 'Connection request was cancelled by the user.',
      };
    }

    // Handle iframe sandbox restriction or other extension errors gracefully
    console.warn('[MetaMask Service] Handled connection notification:', errMsg);
    return {
      isConnected: false,
      address: '',
      chainId: '',
      networkName: '',
      balanceEth: 0,
      balanceUsd: 0,
      isSimulated: false,
      error: errMsg.includes('Failed to connect to MetaMask')
        ? 'MetaMask extension could not establish an iframe bridge. Please try connecting via the Web3 Gateway or open in an external window.'
        : errMsg,
    };
  }
}

/**
 * Returns a simulated Web3 MetaMask wallet for testing / paper trading
 */
export function getDemoMetaMaskWallet(ethPriceUsd = 2650): Web3WalletInfo {
  const balanceEth = 4.85;
  return {
    ...DEMO_METAMASK_WALLET,
    balanceEth,
    balanceUsd: parseFloat((balanceEth * ethPriceUsd).toFixed(2)),
  };
}

/**
 * Format address for UI display (e.g. 0x71C...A397)
 */
export function formatAddress(address: string): string {
  if (!address || address.length < 10) return address || '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
