export interface WhatsAppConnection {
  id: string;
  qr?: string;
  status: 'connecting' | 'connected' | 'disconnected' | 'qr_pending';
  phoneNumber?: string;
  createdAt: Date;
  lastActivity?: Date;
}

export interface SendMessageRequest {
  connectionId: string;
  to: string;
  message: string;
}

export interface SendFileRequest {
  connectionId: string;
  to: string;
  caption?: string;
}

export interface ValidateNumberRequest {
  connectionId: string;
  number: string;
}

export interface ConnectionRequest {
  phoneNumber?: string;
  pairingMethod?: 'qr' | 'code';
}

export interface ValidateConnectionRequest {
  connectionId: string;
  code: string;
}

export interface Contact {
  id: string;
  name?: string;
  notify?: string;
  verifiedName?: string;
  imgUrl?: string;
  status?: string;
}

export interface Group {
  id: string;
  subject: string;
  owner?: string;
  creation?: number;
  desc?: string;
  descOwner?: string;
  descId?: string;
  participants?: any[];
  size?: number;
}

export interface ValidatedNumber {
  exists: boolean;
  jid?: string;
  status?: string;
  picture?: string;
  name?: string;
  business?: boolean;
  lastSeen?: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}