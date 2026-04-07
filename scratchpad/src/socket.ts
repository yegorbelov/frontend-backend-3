import { io } from 'socket.io-client';
import { getServerBase } from './serverBase';

const url = getServerBase() || undefined;

export const socket = io(url, {
  transports: ['websocket', 'polling'],
});
