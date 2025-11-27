import React, { useState, useMemo } from 'react';
import { DockerContainer } from '../api';

type SortKeys = keyof DockerContainer | 'containerName' | 'statusText';
type SortDirection = 'asc' | 'desc';

interface ContainersTableProps {
  containers: DockerContainer[];
}

const ContainersTable: React.FC<ContainersTableProps> = ({ containers }) => {
  const [activeTab, setActiveTab] = useState<string>('');
  const [sortStates, setSortStates] = useState<{ [endpoint: string]: { column: SortKeys; direction: SortDirection } }>({});

  // Group by endpoint
  const byEndpoint: { [key: string]: DockerContainer[] } = useMemo(() => {
    const groups: { [key: string]: DockerContainer[] } = {};
    containers.forEach(container => {
      const endpoint = container.endpoint_name || 'Unknown';
      if (!groups[endpoint]) groups[endpoint] = [];
      groups[endpoint].push(container);
    });
    return groups;
  }, [containers]);

  const endpoints = useMemo(() => Object.keys(byEndpoint).sort(), [byEndpoint]);

  // Set initial active tab if not set
  if (activeTab === '' && endpoints.length > 0) {
    setActiveTab(endpoints[0]);
  }

  const handleSort = (endpoint: string, column: SortKeys) => {
    setSortStates(prev => {
      const currentSort = prev[endpoint];
      let newDirection: SortDirection = 'asc';
      if (currentSort && currentSort.column === column) {
        newDirection = currentSort.direction === 'asc' ? 'desc' : 'asc';
      }
      return {
        ...prev,
        [endpoint]: { column, direction: newDirection },
      };
    });
  };

  const sortedContainers = (endpoint: string) => {
    const currentSort = sortStates[endpoint] || { column: 'containerName', direction: 'asc' };
    const column = currentSort.column;
    const direction = currentSort.direction;

    return [...byEndpoint[endpoint]].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      if (column === 'containerName') {
        aValue = (a.Names?.[0] || '').replace('/', '');
        bValue = (b.Names?.[0] || '').replace('/', '');
      } else if (column === 'statusText') {
        aValue = a.Status || '';
        bValue = b.Status || '';
      } else {
        aValue = a[column as keyof DockerContainer];
        bValue = b[column as keyof DockerContainer];
      }

      if (aValue === undefined || bValue === undefined) return 0;

      let comparison = 0;
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        comparison = aValue.localeCompare(bValue);
      } else if (typeof aValue === 'number' && typeof bValue === 'number') {
        comparison = aValue - bValue;
      } else {
        const aStr = String(aValue);
        const bStr = String(bValue);
        comparison = aStr.localeCompare(bStr);
      }

      return direction === 'asc' ? comparison : -comparison;
    });
  };

  const getSortClass = (endpoint: string, column: SortKeys) => {
    const currentSort = sortStates[endpoint];
    if (currentSort && currentSort.column === column) {
      return currentSort.direction === 'asc' ? 'sort-asc' : 'sort-desc';
    }
    return '';
  };

  return (
    <div id="containers-section">
      <h2>🐳 Docker Containers</h2>
      <div id="containers-tabs">
        <div className="tabs">
          {endpoints.map((endpoint) => {
            const running = byEndpoint[endpoint].filter(c => c.State === 'running').length;
            const total = byEndpoint[endpoint].length;
            const isActive = endpoint === activeTab;
            return (
              <button
                key={endpoint}
                className={`tab-button${isActive ? ' active' : ''}`}
                onClick={() => setActiveTab(endpoint)}
              >
                {endpoint} <span className="tab-badge">{running}/{total}</span>
              </button>
            );
          })}
        </div>

        {endpoints.map((endpoint) => {
          const isActive = endpoint === activeTab;
          const containersForEndpoint = sortedContainers(endpoint);
          return (
            <div key={endpoint} id={`containers-${endpoint.replace(/[^a-zA-Z0-9]/g, '_')}`} className={`tab-content${isActive ? ' active' : ''}`}>
              <table className="containers-table" data-endpoint={endpoint}>
                <thead>
                  <tr>
                    <th className={`sortable ${getSortClass(endpoint, 'containerName')}`} onClick={() => handleSort(endpoint, 'containerName')}>Container Name</th>
                    <th className={`sortable ${getSortClass(endpoint, 'Image')}`} onClick={() => handleSort(endpoint, 'Image')}>Image</th>
                    <th className={`sortable ${getSortClass(endpoint, 'statusText')}`} onClick={() => handleSort(endpoint, 'statusText')}>Status</th>
                    <th>Ports</th> {/* Ports column is not sortable by default in original HTML */}
                  </tr>
                </thead>
                <tbody>
                  {containersForEndpoint.map((container, index) => {
                    const name = (container.Names?.[0] || 'Unknown').replace('/', '');
                    const image = container.Image || 'Unknown';
                    const state = container.State || 'unknown';
                    const status = container.Status || '';
                    const statusClass = state === 'running' ? 'status-running' : 'status-exited';
                    const statusIcon = state === 'running' ? '🟢' : '🔴';

                    const ports = container.Ports || [];
                    const portStr = ports
                      .filter(p => p.PublicPort)
                      .map(p => `${p.PublicPort}->${p.PrivatePort}/${p.Type || 'tcp'}`)
                      .join(', ') || 'None';

                    return (
                      <tr key={index}>
                        <td><strong>{name}</strong></td>
                        <td><code>{image}</code></td>
                        <td className={statusClass}>{statusIcon} {state.toUpperCase()}<br /><small>{status}</small></td>
                        <td><small>{portStr}</small></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ContainersTable;