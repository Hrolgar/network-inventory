export interface NetworkDevice {
  hostname: string;
  ip: string;
  mac: string;
  vendor?: string;
}

export interface UniFiClient {
  hostname: string;
  ip: string;
  mac: string;
  network?: string;
  essid?: string;
  rssi?: number;
  is_wired?: boolean;
}

export interface UniFiNetwork {
  name: string;
  purpose: string;
  vlan?: number;
  ip_subnet: string;
  dhcpd_enabled: boolean;
}

export interface UniFiAccessPoint {
  name: string;
  model: string;
  ip: string;
  mac: string;
  num_sta: number;
  uptime: number;
}

export interface DockerContainer {
  Id: string;
  Names: string[];
  Image: string;
  State: string;
  Status: string;
  Ports: { PublicPort: number; PrivatePort: number; Type: string }[];
  portainer_instance: string;
  endpoint_name: string;
  endpoint_id: number;
}

export interface ScanData {
  network: {
    clients: UniFiClient[];
    networks: UniFiNetwork[];
    access_points: UniFiAccessPoint[];
    scan_results: NetworkDevice[];
  };
  containers: DockerContainer[];
  timestamp: string;
  next_scan_available: string;
  is_cached?: boolean;
  can_refresh?: boolean;
  age_seconds?: number;
}

export interface ApiStatus {
  is_scanning: boolean;
  can_scan: boolean;
  last_scan: string | null;
  scan_cooldown: number;
  cooldown_remaining?: number;
}

export interface HistoryScanSummary {
  id: number;
  timestamp: string;
  scan_type: string;
  summary: {
    total_clients: number;
    total_networks: number;
    total_access_points: number;
    total_containers: number;
  };
  created_at: string;
}

export interface MetricDataPoint {
  timestamp: string;
  value: number;
  metadata?: Record<string, any>;
}

const API_BASE_URL = '/api';

export const fetchScanData = async (): Promise<ScanData> => {
  const response = await fetch(`${API_BASE_URL}/data`);
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to fetch scan data');
  }
  return response.json();
};

export const triggerScan = async (): Promise<ScanData> => {
  const response = await fetch(`${API_BASE_URL}/scan`, {
    method: 'POST',
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to trigger scan');
  }
  return response.json();
};

export const fetchApiStatus = async (): Promise<ApiStatus> => {
  const response = await fetch(`${API_BASE_URL}/status`);
  if (!response.ok) {
    throw new Error('Failed to fetch API status');
  }
  return response.json();
};

export const fetchHistoryScans = async (limit: number = 10): Promise<HistoryScanSummary[]> => {
  const response = await fetch(`${API_BASE_URL}/history?limit=${limit}`);
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to fetch scan history');
  }
  const data = await response.json();
  return data.scans || [];
};

export const fetchMetricHistory = async (
  metricName: string,
  hours: number = 24
): Promise<MetricDataPoint[]> => {
  const response = await fetch(`${API_BASE_URL}/metrics/${metricName}?hours=${hours}`);
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to fetch metric history');
  }
  const data = await response.json();
  return data.data || [];
};
