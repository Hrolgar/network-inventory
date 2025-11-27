import React, { useState, useEffect } from 'react';
import { fetchSettings, saveSettings as apiSaveSettings } from '../api';

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsChange: (settings: AppSettings) => void;
  currentSettings: AppSettings;
}

export interface AppSettings {
  autoRefreshEnabled: boolean;
  statusPollInterval: number; // in milliseconds
  defaultChartTimeRange: number; // in hours
  theme: 'light' | 'dark';
}

export const DEFAULT_SETTINGS: AppSettings = {
  autoRefreshEnabled: false,
  statusPollInterval: 5000, // 5 seconds - reasonable default
  defaultChartTimeRange: 24, // 24 hours
  theme: 'light',
};

export const loadSettings = async (): Promise<AppSettings> => {
  try {
    // Try to fetch from API first
    const apiSettings = await fetchSettings();

    // Convert API settings (snake_case strings) to AppSettings format (camelCase)
    const settings: AppSettings = {
      autoRefreshEnabled: apiSettings.auto_refresh_enabled === 'true',
      statusPollInterval: parseInt(apiSettings.status_poll_interval || '5000'),
      defaultChartTimeRange: parseInt(apiSettings.default_chart_time_range || '24'),
      theme: (apiSettings.theme as 'light' | 'dark') || 'light',
    };

    // Cache to localStorage
    localStorage.setItem('appSettings', JSON.stringify(settings));
    return settings;
  } catch (e) {
    console.warn('Failed to load settings from API, using localStorage:', e);

    // Fallback to localStorage
    const saved = localStorage.getItem('appSettings');
    if (saved) {
      try {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
      } catch (parseError) {
        console.error('Failed to parse localStorage settings:', parseError);
      }
    }
  }

  return DEFAULT_SETTINGS;
};

export const saveSettings = async (settings: AppSettings): Promise<void> => {
  // Save to localStorage immediately
  localStorage.setItem('appSettings', JSON.stringify(settings));

  try {
    // Convert to API format (snake_case strings for database consistency)
    const apiSettings = {
      auto_refresh_enabled: String(settings.autoRefreshEnabled),
      status_poll_interval: String(settings.statusPollInterval),
      default_chart_time_range: String(settings.defaultChartTimeRange),
      theme: settings.theme,
    };

    // Save to API
    await apiSaveSettings(apiSettings);
  } catch (e) {
    console.error('Failed to save settings to API:', e);
    throw e; // Re-throw to let caller handle the error
  }
};

const Settings: React.FC<SettingsProps> = ({ isOpen, onClose, onSettingsChange, currentSettings }) => {
  const [settings, setSettings] = useState<AppSettings>(currentSettings);

  useEffect(() => {
    setSettings(currentSettings);
  }, [currentSettings]);

  const handleSave = async () => {
    try {
      await saveSettings(settings);
      onSettingsChange(settings);
      onClose();
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert('Failed to save settings. Please try again.');
    }
  };

  const handleReset = () => {
    setSettings(DEFAULT_SETTINGS);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Modal Overlay */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(4px)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        onClick={onClose}
      >
        {/* Modal Content */}
        <div
          style={{
            backgroundColor: 'var(--theme) === "dark" ? "#1a1a1a" : "#ffffff"',
            background: document.documentElement.getAttribute('data-theme') === 'dark'
              ? '#1a1a1a'
              : '#ffffff',
            borderRadius: '12px',
            padding: '30px',
            maxWidth: '600px',
            width: '90%',
            maxHeight: '80vh',
            overflowY: 'auto',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)',
            border: document.documentElement.getAttribute('data-theme') === 'dark'
              ? '1px solid #333'
              : '1px solid #ddd',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <h2 style={{ marginTop: 0, marginBottom: '24px', color: 'var(--text-primary)' }}>⚙️ Settings</h2>

          {/* Auto-refresh Settings */}
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ color: 'var(--text-primary)', fontSize: '1.1em', marginBottom: '12px' }}>🔄 Auto-Refresh</h3>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-primary)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={settings.autoRefreshEnabled}
                onChange={(e) => setSettings({ ...settings, autoRefreshEnabled: e.target.checked })}
                style={{ width: '18px', height: '18px' }}
              />
              <span>Enable automatic scanning</span>
            </label>
            <p style={{ marginTop: '8px', fontSize: '0.9em', color: 'var(--text-secondary)', marginLeft: '28px' }}>
              Automatically trigger scans based on the cooldown period (configured on backend)
            </p>
          </div>

          {/* Status Polling Interval */}
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ color: 'var(--text-primary)', fontSize: '1.1em', marginBottom: '12px' }}>⏱️ Status Update Frequency</h3>
            <select
              value={settings.statusPollInterval}
              onChange={(e) => setSettings({ ...settings, statusPollInterval: parseInt(e.target.value) })}
              style={{
                padding: '8px 12px',
                borderRadius: '6px',
                border: document.documentElement.getAttribute('data-theme') === 'dark'
                  ? '1px solid #444'
                  : '1px solid #ccc',
                backgroundColor: document.documentElement.getAttribute('data-theme') === 'dark'
                  ? '#2a2a2a'
                  : '#ffffff',
                color: 'var(--text-primary)',
                width: '100%',
                fontSize: '1em',
              }}
            >
              <option value={1000}>Very Fast (1s) - More network requests</option>
              <option value={2000}>Fast (2s)</option>
              <option value={5000}>Normal (5s) - Recommended</option>
              <option value={10000}>Slow (10s) - Less network requests</option>
            </select>
            <p style={{ marginTop: '8px', fontSize: '0.9em', color: 'var(--text-secondary)' }}>
              How often to check scan status and update cooldown timer
            </p>
          </div>

          {/* Chart Time Range */}
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ color: 'var(--text-primary)', fontSize: '1.1em', marginBottom: '12px' }}>📊 Default Chart Time Range</h3>
            <select
              value={settings.defaultChartTimeRange}
              onChange={(e) => setSettings({ ...settings, defaultChartTimeRange: parseInt(e.target.value) })}
              style={{
                padding: '8px 12px',
                borderRadius: '6px',
                border: document.documentElement.getAttribute('data-theme') === 'dark'
                  ? '1px solid #444'
                  : '1px solid #ccc',
                backgroundColor: document.documentElement.getAttribute('data-theme') === 'dark'
                  ? '#2a2a2a'
                  : '#ffffff',
                color: 'var(--text-primary)',
                width: '100%',
                fontSize: '1em',
              }}
            >
              <option value={6}>6 Hours</option>
              <option value={12}>12 Hours</option>
              <option value={24}>24 Hours (Recommended)</option>
              <option value={168}>7 Days</option>
              <option value={720}>30 Days</option>
            </select>
            <p style={{ marginTop: '8px', fontSize: '0.9em', color: 'var(--text-secondary)' }}>
              Default time range for historical trend charts
            </p>
          </div>

          {/* Theme */}
          <div style={{ marginBottom: '32px' }}>
            <h3 style={{ color: 'var(--text-primary)', fontSize: '1.1em', marginBottom: '12px' }}>🎨 Theme</h3>
            <div style={{ display: 'flex', gap: '12px' }}>
              <label style={{ flex: 1, cursor: 'pointer' }}>
                <div
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    border: settings.theme === 'light' ? '2px solid #3b82f6' : '1px solid #444',
                    backgroundColor: settings.theme === 'light'
                      ? 'rgba(59, 130, 246, 0.1)'
                      : (document.documentElement.getAttribute('data-theme') === 'dark' ? '#2a2a2a' : '#f5f5f5'),
                    textAlign: 'center',
                    transition: 'all 0.2s',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="radio"
                    name="theme"
                    value="light"
                    checked={settings.theme === 'light'}
                    onChange={(e) => setSettings({ ...settings, theme: e.target.value as 'light' | 'dark' })}
                    style={{ display: 'none' }}
                  />
                  <div style={{ fontSize: '2em', marginBottom: '4px' }}>☀️</div>
                  <div style={{ color: 'var(--text-primary)', fontWeight: settings.theme === 'light' ? 'bold' : 'normal' }}>
                    Light
                  </div>
                </div>
              </label>
              <label style={{ flex: 1, cursor: 'pointer' }}>
                <div
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    border: settings.theme === 'dark' ? '2px solid #3b82f6' : '1px solid #444',
                    backgroundColor: settings.theme === 'dark'
                      ? 'rgba(59, 130, 246, 0.1)'
                      : (document.documentElement.getAttribute('data-theme') === 'dark' ? '#2a2a2a' : '#f5f5f5'),
                    textAlign: 'center',
                    transition: 'all 0.2s',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="radio"
                    name="theme"
                    value="dark"
                    checked={settings.theme === 'dark'}
                    onChange={(e) => setSettings({ ...settings, theme: e.target.value as 'light' | 'dark' })}
                    style={{ display: 'none' }}
                  />
                  <div style={{ fontSize: '2em', marginBottom: '4px' }}>🌙</div>
                  <div style={{ color: 'var(--text-primary)', fontWeight: settings.theme === 'dark' ? 'bold' : 'normal' }}>
                    Dark
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button
              onClick={handleReset}
              className="btn btn-secondary"
              style={{ padding: '10px 20px' }}
            >
              Reset to Defaults
            </button>
            <button
              onClick={onClose}
              className="btn btn-secondary"
              style={{ padding: '10px 20px' }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="btn btn-primary"
              style={{ padding: '10px 20px' }}
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default Settings;
