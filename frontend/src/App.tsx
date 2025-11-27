import React, { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { Toaster, toast } from 'sonner';
import { fetchScanData, triggerScan, fetchApiStatus, ScanData, ApiStatus } from './api';
import { useWebSocket } from './hooks/useWebSocket';
import Alerts from './components/Alerts';
import NetworksTable from './components/NetworksTable';
import AccessPointsTable from './components/AccessPointsTable';
import DevicesTable from './components/DevicesTable';
import ContainersTable from './components/ContainersTable';
import DownloadDropdown from './components/DownloadDropdown';
import HistoricalCharts from './components/HistoricalCharts';
import ErrorBoundary from './components/ErrorBoundary';

// --- Theme Context ---
type Theme = 'light' | 'dark';
interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>(() => {
    const savedTheme = localStorage.getItem('theme');
    return (savedTheme === 'light' || savedTheme === 'dark') ? savedTheme : 'light';
  });

  const toggleTheme = useCallback(() => {
    setTheme(prevTheme => {
      const newTheme = prevTheme === 'dark' ? 'light' : 'dark';
      localStorage.setItem('theme', newTheme);
      return newTheme;
    });
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

// --- App Component ---
const App: React.FC = () => {
  const [scanData, setScanData] = useState<ScanData | null>(null);
  const [apiStatus, setApiStatus] = useState<ApiStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>(''); // New state for search query
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const autoRefreshIntervalRef = React.useRef<number | null>(null);
  const { theme, toggleTheme } = useTheme();

  const loadAllData = useCallback(async (isTriggeredScan: boolean = false, skipToast: boolean = false) => {
    setLoading(true);
    try {
      let data: ScanData;
      if (isTriggeredScan) {
        if (!skipToast) toast.info('Starting new scan...');
        data = await triggerScan();
        if (!skipToast) toast.success('Scan complete!');
      } else {
        data = await fetchScanData();
      }
      setScanData(data);
      const status = await fetchApiStatus();
      setApiStatus(status);
    } catch (err: any) {
      if (!skipToast) toast.error(err.message);
      setScanData(null); // Clear data if there's an error
    } finally {
      setLoading(false);
    }
  }, []);

  // WebSocket integration for real-time updates
  useWebSocket({
    onScanStarted: () => {
      console.log('WebSocket: Scan started');
      setIsScanning(true);
      toast.info('🔄 Scan started...', { duration: 2000 });
    },
    onScanCompleted: (data) => {
      console.log('WebSocket: Scan completed', data);
      setIsScanning(false);
      toast.success(`✅ Scan complete! Found ${data.total_clients} clients and ${data.total_containers} containers`, {
        duration: 4000,
      });
      // Auto-refresh data when scan completes
      loadAllData(false, true);
    },
    onScanFailed: (data) => {
      console.log('WebSocket: Scan failed', data);
      setIsScanning(false);
      toast.error(`❌ Scan failed: ${data.error}`, { duration: 5000 });
    },
    onConnect: () => {
      console.log('WebSocket: Connected');
    },
    onDisconnect: () => {
      console.log('WebSocket: Disconnected');
    },
  });

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Poll status every second to update cooldown timer
  useEffect(() => {
    const statusInterval = setInterval(async () => {
      try {
        const status = await fetchApiStatus();
        setApiStatus(status);
      } catch (err) {
        console.error('Failed to fetch status:', err);
      }
    }, 1000); // Update every second

    return () => clearInterval(statusInterval);
  }, []);

  useEffect(() => {
    if (autoRefreshIntervalRef.current) {
      clearInterval(autoRefreshIntervalRef.current);
    }

    if (autoRefreshEnabled && apiStatus && apiStatus.scan_cooldown) {
      const interval = (apiStatus.scan_cooldown + 5) * 1000; // Cooldown + 5 seconds buffer
      autoRefreshIntervalRef.current = window.setInterval(() => {
        // Only refresh if not currently scanning and ready to scan
        if (!apiStatus.is_scanning && apiStatus.can_scan) {
          loadAllData(true); // Trigger a scan
        } else {
          // console.log("Auto-refresh skipped: scan in progress or cooldown active.");
        }
      }, interval);
    }

    return () => {
      if (autoRefreshIntervalRef.current) {
        clearInterval(autoRefreshIntervalRef.current);
      }
    };
  }, [autoRefreshEnabled, apiStatus, loadAllData]);

  const handleRefreshClick = async () => {
    await loadAllData(true); // Trigger a scan
  };

  const updateThemeIcon = (currentTheme: Theme) => {
    return currentTheme === 'dark' ? '☀️' : '🌙';
  };

  // Memoized filtered data
  const filteredScanData = React.useMemo(() => {
    if (!scanData) return null;
    if (!searchQuery) return scanData;

    const query = searchQuery.toLowerCase();

    // Filter Network Devices (clients)
    const filteredClients = scanData.network.clients?.filter(client =>
      (client.hostname?.toLowerCase().includes(query) ||
       client.ip?.toLowerCase().includes(query) ||
       client.mac?.toLowerCase().includes(query) ||
       client.network?.toLowerCase().includes(query) ||
       client.essid?.toLowerCase().includes(query))
    ) || [];

    // Filter Networks
    const filteredNetworks = scanData.network.networks?.filter(network =>
      (network.name?.toLowerCase().includes(query) ||
       network.purpose?.toLowerCase().includes(query) ||
       network.ip_subnet?.toLowerCase().includes(query))
    ) || [];

    // Filter Access Points
    const filteredAccessPoints = scanData.network.access_points?.filter(ap =>
      (ap.name?.toLowerCase().includes(query) ||
       ap.model?.toLowerCase().includes(query) ||
       ap.ip?.toLowerCase().includes(query) ||
       ap.mac?.toLowerCase().includes(query))
    ) || [];

    // Filter Containers
    const filteredContainers = scanData.containers?.filter(container =>
      (container.Names?.some(name => name.toLowerCase().includes(query)) ||
       container.Image?.toLowerCase().includes(query) ||
       container.Status?.toLowerCase().includes(query) ||
       container.endpoint_name?.toLowerCase().includes(query))
    ) || [];

    return {
      ...scanData,
      network: {
        ...scanData.network,
        clients: filteredClients,
        networks: filteredNetworks,
        access_points: filteredAccessPoints,
      },
      containers: filteredContainers,
    };
  }, [scanData, searchQuery]);

  return (
    <div className="container">
      <Toaster richColors position="top-right" />
      <div className="header">
        <div>
          <h1>📊 Network & Container Inventory</h1>
          <p style={{ margin: '5px 0', color: 'var(--text-secondary)' }}>
            <span id="last-update">
              {scanData?.timestamp ? `Last updated: ${new Date(scanData.timestamp).toLocaleString()}` : 'Loading...'}
            </span>
          </p>
        </div>
        <div className="header-controls">
          <button
            id="refresh-btn"
            className="btn btn-primary"
            onClick={handleRefreshClick}
            disabled={loading || isScanning || apiStatus?.is_scanning || !apiStatus?.can_scan}
            title={!apiStatus?.can_scan && apiStatus?.cooldown_remaining ? `Cooldown: ${apiStatus.cooldown_remaining}s remaining` : 'Trigger a new scan'}
          >
            {(loading && (isScanning || apiStatus?.is_scanning)) ? <span className="spinner"></span> : '🔄'} Refresh
          </button>
          <DownloadDropdown scanData={scanData} />
          <button id="theme-toggle" className="theme-toggle" onClick={toggleTheme} title="Toggle dark mode">
            {updateThemeIcon(theme)}
          </button>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
            <input type="checkbox" id="auto-refresh-toggle" checked={autoRefreshEnabled} onChange={(e) => setAutoRefreshEnabled(e.target.checked)} />
            Auto-refresh
          </label>
          <span className={`status-indicator ${(isScanning || apiStatus?.is_scanning) ? 'status-scanning' : (apiStatus?.can_scan ? 'status-ready' : 'status-cooldown')}`}>
            {(isScanning || apiStatus?.is_scanning) ? '🔄 Scanning...' : (apiStatus?.can_scan ? '✅ Ready' : `⏱️ Cooldown: ${apiStatus?.cooldown_remaining || 0}s`)}
          </span>
        </div>
      </div>

      {/* Search */}
      <div className="search-container">
        <input
          type="text"
          id="global-search"
          className="search-box"
          placeholder="🔍 Search devices, IPs, MACs, containers..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>
      {searchQuery && filteredScanData && (
        <div className="filter-status">
          Showing {
            (filteredScanData.network?.clients?.length || 0) +
            (filteredScanData.network?.networks?.length || 0) +
            (filteredScanData.network?.access_points?.length || 0) +
            (filteredScanData.containers?.length || 0)
          } of {
            (scanData?.network?.clients?.length || 0) +
            (scanData?.network?.networks?.length || 0) +
            (scanData?.network?.access_points?.length || 0) +
            (scanData?.containers?.length || 0)
          } items matching "{searchQuery}"
        </div>
      )}

      {loading && !scanData && (
        <div style={{ textAlign: 'center', padding: '50px' }}>
          <span className="spinner"></span> Loading data...
        </div>
      )}

            {filteredScanData && (

              <>

                <Alerts scanData={filteredScanData} />

      

                {/* Summary */}

                <h2>📈 Summary</h2>

                <div id="summary-section">

                  <div className="summary-box">

                    <div className="summary-number">{filteredScanData.network?.clients?.length || 0}</div>

                    <div className="summary-label">Network Devices</div>

                  </div>

                  <div className="summary-box">

                    <div className="summary-number">{filteredScanData.network?.networks?.length || 0}</div>

                    <div className="summary-label">Networks</div>

                  </div>

                  <div className="summary-box">

                    <div className="summary-number">{filteredScanData.network?.access_points?.length || 0}</div>

                    <div className="summary-label">Access Points</div>

                  </div>

                  <div className="summary-box">

                    <div className="summary-number">

                                            {filteredScanData.containers?.filter(c => c.State === 'running').length || 0}/{filteredScanData.containers?.length || 0}

                    </div>

                    <div className="summary-label">Running Containers</div>

                  </div>

                </div>

                {/* Historical Charts */}
                <ErrorBoundary
                  fallback={
                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      <p>📊 Historical charts unavailable</p>
                    </div>
                  }
                >
                  <HistoricalCharts timeRange={24} />
                </ErrorBoundary>

                <NetworksTable networks={filteredScanData.network.networks} loading={loading && !scanData} />
                <AccessPointsTable accessPoints={filteredScanData.network.access_points} loading={loading && !scanData} />
                <DevicesTable clients={filteredScanData.network.clients} loading={loading && !scanData} />
                <ContainersTable containers={filteredScanData.containers} loading={loading && !scanData} />
              </>
            )}
    </div>
  );
};

// Wrap App with ThemeProvider
const WrappedApp: React.FC = () => (
  <ThemeProvider>
    <App />
  </ThemeProvider>
);

export default WrappedApp;