import React, { useState } from 'react';
import { UniFiNetwork } from '../api';

type SortKeys = keyof UniFiNetwork | 'vlan' | 'dhcpd_enabled'; // Union with specific keys for sorting
type SortDirection = 'asc' | 'desc';

interface NetworksTableProps {
  networks: UniFiNetwork[];
}

const NetworksTable: React.FC<NetworksTableProps> = ({ networks }) => {
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

  const sortedNetworks = [...networks].sort((a, b) => {
    const aValue = a[sortColumn];
    const bValue = b[sortColumn];

    if (aValue === undefined || bValue === undefined) return 0;

    let comparison = 0;
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      comparison = aValue.localeCompare(bValue);
    } else if (typeof aValue === 'number' && typeof bValue === 'number') {
      comparison = aValue - bValue;
    } else if (typeof aValue === 'boolean' && typeof bValue === 'boolean') {
        comparison = aValue === bValue ? 0 : aValue ? 1 : -1;
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
    <div id="networks-section">
      <h2>🌐 Networks</h2>
      <table id="networks-table">
        <thead>
          <tr>
            <th className={`sortable ${getSortClass('name')}`} onClick={() => handleSort('name')}>Name</th>
            <th className={`sortable ${getSortClass('purpose')}`} onClick={() => handleSort('purpose')}>Purpose</th>
            <th className={`sortable ${getSortClass('vlan')}`} onClick={() => handleSort('vlan')}>VLAN</th>
            <th className={`sortable ${getSortClass('ip_subnet')}`} onClick={() => handleSort('ip_subnet')}>Subnet</th>
            <th className={`sortable ${getSortClass('dhcpd_enabled')}`} onClick={() => handleSort('dhcpd_enabled')}>DHCP</th>
          </tr>
        </thead>
        <tbody>
          {sortedNetworks.map((net, index) => (
            <tr key={index}>
              <td><strong>{net.name || 'Unknown'}</strong></td>
              <td>{net.purpose || 'N/A'}</td>
              <td>{net.vlan || 'N/A'}</td>
              <td>{net.ip_subnet || 'N/A'}</td>
              <td>{net.dhcpd_enabled ? '✅ Enabled' : '❌ Disabled'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default NetworksTable;