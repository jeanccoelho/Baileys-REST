import { WASocket } from '@whiskeysockets/baileys';

export interface InstanceData {
  instanceId: string;
  userId: string;
  socket: WASocket;
  status: 'connecting' | 'connected' | 'disconnected' | 'qr_pending' | 'code_pending';
  qr?: string;
  pairingCode?: string;
  profilePicture?: string;
  number?: string;
  reconnectionAttempts: number;
  reconnectTimeout?: NodeJS.Timeout;
  shouldBeConnected: boolean;
  createdAt: Date;
  lastActivity?: Date;
  pairingMethod: 'qr' | 'code';
  phoneNumber?: string;
}