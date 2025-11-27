import React from 'react';
import Skeleton from './Skeleton';

const NetworksTableSkeleton: React.FC = () => {
  const renderSkeletonRow = () => (
    <tr>
      <td><Skeleton style={{ height: '20px', width: '60%' }} /></td>
      <td><Skeleton style={{ height: '20px', width: '40%' }} /></td>
      <td><Skeleton style={{ height: '20px', width: '30%' }} /></td>
      <td><Skeleton style={{ height: '20px', width: '80%' }} /></td>
      <td><Skeleton style={{ height: '20px', width: '50%' }} /></td>
    </tr>
  );

  return (
    <div id="networks-section">
      <h2>🌐 Networks</h2>
      <table id="networks-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Purpose</th>
            <th>VLAN</th>
            <th>Subnet</th>
            <th>DHCP</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 3 }).map((_, index) => (
            <React.Fragment key={index}>{renderSkeletonRow()}</React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default NetworksTableSkeleton;
