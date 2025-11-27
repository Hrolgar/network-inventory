import React from 'react';
import { ScanData, DockerContainer, UniFiClient } from '../api';

interface AlertsProps {
  scanData: ScanData;
}

const Alerts: React.FC<AlertsProps> = ({ scanData }) => {
  const alerts: { icon: string; message: string }[] = [];

  // Check for stopped containers
  if (scanData.containers) {
    const stopped = scanData.containers.filter((c: DockerContainer) => c.State !== 'running');
    if (stopped.length > 0) {
      alerts.push({
        icon: '🔴',
        message: `${stopped.length} container(s) stopped: ${stopped.slice(0, 3).map((c: DockerContainer) => (c.Names?.[0] || 'Unknown').substring(1)).join(', ')}${stopped.length > 3 ? '...' : ''}`
      });
    }
  }

  // Check for poor signal devices
  if (scanData.network?.clients) {
    const poorSignal = scanData.network.clients.filter((c: UniFiClient) => c.rssi && c.rssi < -70 && c.rssi !== 0);
    if (poorSignal.length > 0) {
      alerts.push({
        icon: '📶',
        message: `${poorSignal.length} device(s) with poor signal (<-70 dBm)`
      });
    }
  }

  if (alerts.length === 0) {
    return null;
  }

  return (
    <div className="alerts-section">
      <h3 style={{ marginTop: 0 }}>⚠️ Alerts</h3>
      {alerts.map((alert, index) => (
        <div key={index} className="alert-item">
          <span className="alert-icon">{alert.icon}</span>{alert.message}
        </div>
      ))}
    </div>
  );
};

export default Alerts;
