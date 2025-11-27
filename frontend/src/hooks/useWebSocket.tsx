import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

interface ScanCompletedData {
  timestamp: string;
  total_clients: number;
  total_containers: number;
  can_refresh: boolean;
}

interface ScanFailedData {
  error: string;
}

interface WebSocketHookOptions {
  onScanStarted?: () => void;
  onScanCompleted?: (data: ScanCompletedData) => void;
  onScanFailed?: (data: ScanFailedData) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export const useWebSocket = (options: WebSocketHookOptions = {}) => {
  const socketRef = useRef<Socket | null>(null);
  const {
    onScanStarted,
    onScanCompleted,
    onScanFailed,
    onConnect,
    onDisconnect,
  } = options;

  const connect = useCallback(() => {
    if (socketRef.current?.connected) {
      return;
    }

    // Connect to the same origin (works in dev with proxy and production)
    const socket = io({
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      console.log('WebSocket connected');
      onConnect?.();
    });

    socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
      onDisconnect?.();
    });

    socket.on('scan_started', () => {
      console.log('Scan started event received');
      onScanStarted?.();
    });

    socket.on('scan_completed', (data: ScanCompletedData) => {
      console.log('Scan completed event received:', data);
      onScanCompleted?.(data);
    });

    socket.on('scan_failed', (data: ScanFailedData) => {
      console.log('Scan failed event received:', data);
      onScanFailed?.(data);
    });

    socketRef.current = socket;
  }, [onScanStarted, onScanCompleted, onScanFailed, onConnect, onDisconnect]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  }, []);

  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    socket: socketRef.current,
    isConnected: socketRef.current?.connected ?? false,
    connect,
    disconnect,
  };
};
