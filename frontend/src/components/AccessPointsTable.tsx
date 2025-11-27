import React, { useState } from 'react';
import { UniFiAccessPoint } from '../api';

type SortKeys = keyof UniFiAccessPoint;
type SortDirection = 'asc' | 'desc';

interface AccessPointsTableProps {
  accessPoints: UniFiAccessPoint[];
}

const AccessPointsTable: React.FC<AccessPointsTableProps> = ({ accessPoints }) => {
  const [sortColumn, setSortColumn] = useState<SortKeys>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const handleSort = (column: SortKeys) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const sortedAccessPoints = [...accessPoints].sort((a, b) => {
    const aValue = a[sortColumn];
    const bValue = b[sortColumn];

    if (aValue === undefined || bValue === undefined) return 0;

    let comparison = 0;
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      comparison = aValue.localeCompare(bValue);
    } else if (typeof aValue === 'number' && typeof bValue === 'number') {
      comparison = aValue - bValue;
    }

    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const getSortClass = (column: SortKeys) => {
    if (sortColumn === column) {
      return sortDirection === 'asc' ? 'sort-asc' : 'sort-desc';
    }
    return '';
  };

  return (
    <div id="aps-section">
      <h2>📡 Access Points</h2>
      <table id="aps-table">
        <thead>
          <tr>
            <th className={`sortable ${getSortClass('name')}`} onClick={() => handleSort('name')}>Name</th>
            <th className={`sortable ${getSortClass('model')}`} onClick={() => handleSort('model')}>Model</th>
            <th className={`sortable ${getSortClass('ip')}`} onClick={() => handleSort('ip')}>IP Address</th>
            <th className={`sortable ${getSortClass('mac')}`} onClick={() => handleSort('mac')}>MAC Address</th>
            <th className={`sortable ${getSortClass('num_sta')}`} onClick={() => handleSort('num_sta')}>Clients</th>
            <th className={`sortable ${getSortClass('uptime')}`} onClick={() => handleSort('uptime')}>Uptime</th>
          </tr>
        </thead>
        <tbody>
          {sortedAccessPoints.map((ap, index) => {
            const uptime = ap.uptime || 0;
            const uptimeStr = uptime ? `${Math.floor(uptime / 86400)}d ${Math.floor((uptime % 86400) / 3600)}h` : 'N/A';
            return (
              <tr key={index}>
                <td><strong>{ap.name || 'Unknown'}</strong></td>
                <td>{ap.model || 'Unknown'}</td>
                <td>{ap.ip || 'N/A'}</td>
                <td><code>{ap.mac || 'N/A'}</code></td>
                <td>{ap.num_sta || 0}</td>
                <td>{uptimeStr}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default AccessPointsTable;