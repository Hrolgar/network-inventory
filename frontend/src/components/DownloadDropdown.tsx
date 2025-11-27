import React, { useState, useEffect, useRef } from 'react';
import { ScanData } from '../api';

interface DownloadDropdownProps {
  scanData: ScanData | null;
}

const DownloadDropdown: React.FC<DownloadDropdownProps> = ({ scanData }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  if (!scanData) {
    return null;
  }

  const downloadData = (filename: string, data: string, mimeType: string) => {
    const blob = new Blob([data], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setIsOpen(false); // Close dropdown after download
  };

  const downloadJson = () => {
    downloadData('network-inventory.json', JSON.stringify(scanData, null, 2), 'application/json');
  };

  const escapeCsvCell = (cell: any) => {
    if (cell === undefined || cell === null) return '';
    const str = String(cell);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const downloadCsv = () => {
    const headers = [
      'Type', 'Name', 'IP Address', 'MAC Address', 'Status', 
      'Model/Image', 'Network', 'Ports', 'Signal (dBm)', 'Vendor', 'Endpoint'
    ];
    const rows: (string | number | undefined)[][] = [];
    scanData.network.clients?.forEach(client => {
      rows.push([
        client.is_wired ? 'UniFi Device (Wired)' : 'UniFi Device (Wireless)',
        client.hostname || client.name, client.ip,
        client.mac, client.is_wired ? 'Connected' : `Connected (${client.rssi} dBm)`,
        'N/A', client.network || client.essid, 'N/A', client.rssi, 'N/A', 'N/A'
      ]);
    });
    scanData.containers?.forEach(container => {
      rows.push([
        'Docker Container', (container.Names?.[0] || 'Unknown').replace('/', ''),
        'N/A', 'N/A', container.Status, container.Image, 'N/A',
        container.Ports?.map(p => `${p.PublicPort}->${p.PrivatePort}/${p.Type}`).join('; ') || 'None',
        'N/A', 'N/A', container.endpoint_name,
      ]);
    });
    const csvContent = [
      headers.map(escapeCsvCell).join(','),
      ...rows.map(row => row.map(escapeCsvCell).join(','))
    ].join('\r\n');
    downloadData('network-inventory.csv', csvContent, 'text/csv;charset=utf-8;');
  };

  const jsonToXml = (json: any): string => {
    let xml = '';
    const toXml = (obj: any, tagName: string): string => {
      let innerXml = '';
      if (Array.isArray(obj)) {
        return obj.map(item => toXml(item, tagName.slice(0, -1))).join('');
      } else if (typeof obj === 'object' && obj !== null) {
        for (const key in obj) {
          if (obj.hasOwnProperty(key)) {
            const childTagName = /^\\d+$/.test(key) ? 'item' : key;
            innerXml += toXml(obj[key], childTagName);
          }
        }
        return `<${tagName}>${innerXml}</${tagName}>`;
      } else {
        const value = obj === null ? '' : String(obj).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
        return `<${tagName}>${value}</${tagName}>`;
      }
    };
    for (const key in json) {
      if (json.hasOwnProperty(key)) {
        xml += toXml(json[key], key);
      }
    }
    return `<?xml version="1.0" encoding="UTF-8"?>\n<NetworkInventory>${xml}</NetworkInventory>`;
  };
  
  const downloadXml = () => {
    const xmlData = jsonToXml(scanData);
    downloadData('network-inventory.xml', xmlData, 'application/xml');
  };

  return (
    <div className="dropdown-container" ref={dropdownRef}>
      <button className="btn btn-secondary" onClick={() => setIsOpen(!isOpen)}>
        Download ▾
      </button>
      {isOpen && (
        <div className="dropdown-menu">
          <a href="#" onClick={downloadJson}>JSON</a>
          <a href="#" onClick={downloadCsv}>CSV</a>
          <a href="#" onClick={downloadXml}>XML</a>
        </div>
      )}
    </div>
  );
};

export default DownloadDropdown;
