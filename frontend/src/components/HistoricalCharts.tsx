import React, { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { fetchMetricHistory, MetricDataPoint } from '../api';

interface HistoricalChartsProps {
  timeRange?: number; // Hours to display
}

const HistoricalCharts: React.FC<HistoricalChartsProps> = ({ timeRange = 24 }) => {
  const [clientData, setClientData] = useState<MetricDataPoint[]>([]);
  const [containerData, setContainerData] = useState<MetricDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRange, setSelectedRange] = useState<number>(timeRange);

  useEffect(() => {
    loadHistoricalData();
  }, [selectedRange]);

  const loadHistoricalData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [clients, containers] = await Promise.all([
        fetchMetricHistory('client_count', selectedRange),
        fetchMetricHistory('container_count', selectedRange),
      ]);
      setClientData(clients);
      setContainerData(containers);
    } catch (err: any) {
      setError(err.message);
      console.error('Failed to load historical data:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatChartData = (data: MetricDataPoint[]) => {
    return data.map((point) => ({
      timestamp: new Date(point.timestamp).toLocaleTimeString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      value: point.value,
    }));
  };

  const timeRangeOptions = [
    { label: '6 Hours', value: 6 },
    { label: '12 Hours', value: 12 },
    { label: '24 Hours', value: 24 },
    { label: '7 Days', value: 168 },
    { label: '30 Days', value: 720 },
  ];

  if (error) {
    return (
      <div className="historical-charts">
        <h2>📊 Historical Trends</h2>
        <div className="error-message" style={{ padding: '20px', textAlign: 'center', color: 'var(--danger)' }}>
          <p>⚠️ {error}</p>
          <p style={{ fontSize: '0.9em', color: 'var(--text-secondary)' }}>
            Historical data tracking may be disabled or no data available yet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="historical-charts">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>📊 Historical Trends</h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          {timeRangeOptions.map((option) => (
            <button
              key={option.value}
              className={`btn ${selectedRange === option.value ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setSelectedRange(option.value)}
              style={{ padding: '5px 10px', fontSize: '0.8em' }}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '50px' }}>
          <span className="spinner"></span> Loading historical data...
        </div>
      ) : (
        <>
          {/* Network Clients Chart */}
          <div className="chart-container" style={{ marginBottom: '30px' }}>
            <h3 style={{ marginBottom: '15px', color: 'var(--text-primary)' }}>
              Network Clients Over Time
            </h3>
            {clientData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={formatChartData(clientData)}>
                  <defs>
                    <linearGradient id="colorClients" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--accent-color)" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="var(--accent-color)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                  <XAxis
                    dataKey="timestamp"
                    stroke="var(--text-secondary)"
                    tick={{ fontSize: 10 }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis stroke="var(--text-secondary)" tick={{ fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--card-bg)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      padding: '3px 6px',
                    }}
                    labelStyle={{ color: 'var(--text-primary)', fontSize: '11px' }}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="var(--accent-color)"
                    fillOpacity={1}
                    fill="url(#colorClients)"
                    name="Connected Clients"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '40px' }}>
                No client data available for this time range
              </p>
            )}
          </div>

          {/* Docker Containers Chart */}
          <div className="chart-container">
            <h3 style={{ marginBottom: '15px', color: 'var(--text-primary)' }}>
              Docker Containers Over Time
            </h3>
            {containerData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={formatChartData(containerData)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                  <XAxis
                    dataKey="timestamp"
                    stroke="var(--text-secondary)"
                    tick={{ fontSize: 10 }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis stroke="var(--text-secondary)" tick={{ fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--card-bg)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      padding: '3px 6px',
                    }}
                    labelStyle={{ color: 'var(--text-primary)', fontSize: '11px' }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="var(--accent-color)"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                    name="Total Containers"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '40px' }}>
                No container data available for this time range
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default HistoricalCharts;
