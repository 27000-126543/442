import { io, Socket } from 'socket.io-client';
import { useAppStore } from './store';
import type { Caravan, Spy, EconomicIndicator } from './types';

let socket: Socket | null = null;

export function initSocket() {
  const token = localStorage.getItem('token');
  if (!token) return;

  socket = io({
    auth: { token },
    transports: ['websocket', 'polling'],
  });

  socket.on('connect', () => {
    console.log('WebSocket 已连接');
  });

  socket.on('disconnect', () => {
    console.log('WebSocket 已断开');
  });

  socket.on('caravan:update', (data: Caravan) => {
    console.log('商队更新:', data);
  });

  socket.on('spy:update', (data: Spy) => {
    console.log('间谍更新:', data);
  });

  socket.on('economy:update', (data: EconomicIndicator) => {
    useAppStore.getState().setEconomy(data);
  });

  socket.on('events:unread', (data: { count: number }) => {
    useAppStore.getState().setUnreadCount(data.count);
  });

  socket.on('tick', (data: { timestamp: number }) => {
    // heartbeat
  });

  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
