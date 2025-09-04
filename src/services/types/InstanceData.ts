import { WASocket } from '@whiskeysockets/baileys';
import { BaileysInMemoryStore } from '@whiskeysockets/baileys';

export interface InstanceData {
  instanceId: string;
  socket: WASocket;
  store: BaileysInMemoryStore;
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