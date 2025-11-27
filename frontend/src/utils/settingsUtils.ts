import { fetchSettings, saveSettings as apiSaveSettings } from '../api';

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
