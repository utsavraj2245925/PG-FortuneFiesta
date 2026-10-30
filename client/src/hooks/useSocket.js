import { useEffect } from 'react';
import { io } from 'socket.io-client';

let socket = null;

export function getSocket() {
  if (!socket) {
    const serverUrl = import.meta.env.VITE_API_URL || 'https://pg-fortune-fiesta-server.onrender.com';
    socket = io(serverUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });
  }
  return socket;
}

export function useSocket(events) {
  const s = getSocket();
  useEffect(() => {
    if (!events) return;
    const entries = Object.entries(events);
    entries.forEach(([event, handler]) => s.on(event, handler));
    return () => entries.forEach(([event, handler]) => s.off(event, handler));
  }, []);
  return s;
}
