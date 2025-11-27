import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fetchScanData, triggerScan, fetchApiStatus } from '../api';

// Mock fetch globally
global.fetch = vi.fn();

describe('API Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchScanData', () => {
    it('should fetch scan data successfully', async () => {
      const mockData = {
        network: { clients: [], networks: [], access_points: [] },
        containers: [],
        timestamp: new Date().toISOString(),
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      });

      const result = await fetchScanData();
      expect(result).toEqual(mockData);
      expect(global.fetch).toHaveBeenCalledWith('/api/data');
    });

    it('should throw error on failed fetch', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(fetchScanData()).rejects.toThrow('Failed to fetch scan data');
    });
  });

  describe('triggerScan', () => {
    it('should trigger scan successfully', async () => {
      const mockData = { network: {}, containers: [] };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      });

      const result = await triggerScan();
      expect(result).toEqual(mockData);
      expect(global.fetch).toHaveBeenCalledWith('/api/scan', { method: 'POST' });
    });

    it('should handle rate limit error', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({ error: 'Rate limited', cooldown_remaining: 100 }),
      });

      await expect(triggerScan()).rejects.toThrow();
    });
  });

  describe('fetchApiStatus', () => {
    it('should fetch API status', async () => {
      const mockStatus = {
        is_scanning: false,
        can_scan: true,
        scan_cooldown: 300,
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockStatus,
      });

      const result = await fetchApiStatus();
      expect(result).toEqual(mockStatus);
    });
  });
});
