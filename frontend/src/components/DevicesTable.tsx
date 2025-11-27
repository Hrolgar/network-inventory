import React, { useState, useMemo } from 'react';
import { UniFiClient } from '../api';

type SortKeys = keyof UniFiClient | 'signal' | 'connection';
type SortDirection = 'asc' | 'desc';

interface DevicesTableProps {
  clients: UniFiClient[];
}

const DevicesTable: React.FC<DevicesTableProps> = ({ clients }) => {
  const [activeTab, setActiveTab] = useState<string>('');
  const [sortStates, setSortStates] = useState<{ [network: string]: { column: SortKeys; direction: SortDirection } }>({});

  // Group by network
  const byNetwork: { [key: string]: UniFiClient[] } = useMemo(() => {
    const groups: { [key: string]: UniFiClient[] } = {};
    clients.forEach(client => {
      const network = client.network || client.essid || 'Unknown Network';
      if (!groups[network]) groups[network] = [];
      groups[network].push(client);
    });
    return groups;
  }, [clients]);

  const networks = useMemo(() => Object.keys(byNetwork).sort(), [byNetwork]);

  // Set initial active tab if not set
  if (activeTab === '' && networks.length > 0) {
    setActiveTab(networks[0]);
  }

  const handleSort = (network: string, column: SortKeys) => {
    setSortStates(prev => {
      const currentSort = prev[network];
      let newDirection: SortDirection = 'asc';
      if (currentSort && currentSort.column === column) {
        newDirection = currentSort.direction === 'asc' ? 'desc' : 'asc';
      }
      return {
        ...prev,
        [network]: { column, direction: newDirection },
      };
    });
  };

  const sortedClients = (network: string) => {
    const currentSort = sortStates[network] || { column: 'hostname', direction: 'asc' };
    const column = currentSort.column;
    const direction = currentSort.direction;

    return [...byNetwork[network]].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      if (column === 'signal') {
        aValue = a.is_wired ? -Infinity : a.rssi || -Infinity;
        bValue = b.is_wired ? -Infinity : b.rssi || -Infinity;
      } else if (column === 'connection') {
        aValue = a.is_wired ? 0 : 1;
        bValue = b.is_wired ? 0 : 1;
      } else {
        aValue = a[column as keyof UniFiClient];
        bValue = b[column as keyof UniFiClient];
      }

      if (aValue === undefined || bValue === undefined) return 0;

      let comparison = 0;
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        comparison = aValue.localeCompare(bValue);
      } else if (typeof aValue === 'number' && typeof bValue === 'number') {
        comparison = aValue - bValue;
      } else {
        // Fallback for other types or inconsistencies
        const aStr = String(aValue);
        const bStr = String(bValue);
        comparison = aStr.localeCompare(bStr);
      }

      return direction === 'asc' ? comparison : -comparison;
    });
  };

  const getSortClass = (network: string, column: SortKeys) => {
    const currentSort = sortStates[network];
    if (currentSort && currentSort.column === column) {
      return currentSort.direction === 'asc' ? 'sort-asc' : 'sort-desc';
    }
    return '';
  };

  const getSignalClass = (rssi: number | undefined) => {
    if (rssi === undefined || rssi === 0) return '';
    if (rssi >= -50) return 'signal-excellent';
    if (rssi >= -60) return 'signal-good';
    if (rssi >= -70) return 'signal-fair';
    if (rssi >= -80) return 'signal-poor';
    return 'signal-bad';
  };

  const getSignalText = (rssi: number | undefined, is_wired: boolean | undefined) => {
    if (is_wired) return 'N/A (Wired)';
    if (rssi === undefined || rssi === 0) return 'N/A';
    return `📶 ${rssi} dBm`;
  };

  return (
    <div id="devices-section">
      <h2>💻 Connected Devices</h2>
      <div id="devices-tabs">
        <div className="tabs">
          {networks.map((network) => {
            const count = byNetwork[network].length;
            const isActive = network === activeTab;
            return (
              <button
                key={network}
                className={`tab-button${isActive ? ' active' : ''}`}
                onClick={() => setActiveTab(network)}
              >
                {network} <span className="tab-badge">{count}</span>
              </button>
            );
          })}
        </div>

        {networks.map((network) => {
          const isActive = network === activeTab;
          const clientsForNetwork = sortedClients(network);
          return (
            <div key={network} id={`devices-${network.replace(/[^a-zA-Z0-9]/g, '_')}`} className={`tab-content${isActive ? ' active' : ''}`}>
              <table className="devices-table" data-network={network}>
                <thead>
                  <tr>
                    <th className={`sortable ${getSortClass(network, 'hostname')}`} onClick={() => handleSort(network, 'hostname')}>Name/Hostname</th>
                    <th className={`sortable ${getSortClass(network, 'ip')}`} onClick={() => handleSort(network, 'ip')}>IP Address</th>
                    <th className={`sortable ${getSortClass(network, 'mac')}`} onClick={() => handleSort(network, 'mac')}>MAC Address</th>
                    <th className={`sortable ${getSortClass(network, 'signal')}`} onClick={() => handleSort(network, 'signal')}>Signal</th>
                    <th className={`sortable ${getSortClass(network, 'connection')}`} onClick={() => handleSort(network, 'connection')}>Connection</th>
                  </tr>
                </thead>
                <tbody>
                  {clientsForNetwork.map((client, index) => (
                    <tr key={index}>
                      <td><strong>{client.hostname || client.name || 'Unknown'}</strong></td>
                      <td>{client.ip || 'N/A'}</td>
                      <td><code>{client.mac || 'N/A'}</code></td>
                      <td className={getSignalClass(client.rssi)}>
                        {getSignalText(client.rssi, client.is_wired)}
                      </td>
                      <td>{client.is_wired ? '🔌 Wired' : '📡 Wireless'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DevicesTable;