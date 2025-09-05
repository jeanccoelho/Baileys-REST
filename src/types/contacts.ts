export interface Contact {
  id: string;
  user_id: string;
  phone_number: string;
  name?: string;
  whatsapp_exists?: boolean;
  whatsapp_jid?: string;
  whatsapp_status?: string;
  whatsapp_picture?: string;
  whatsapp_business?: boolean;
  whatsapp_verified_name?: string;
  whatsapp_business_hours?: string;
  whatsapp_website?: string;
  whatsapp_email?: string;
  whatsapp_address?: string;
  whatsapp_category?: string;
  last_whatsapp_check?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface CreateContactRequest {
  phone_number: string;
  name?: string;
}

export interface UpdateContactRequest {
  name?: string;
}

export interface ValidateContactRequest {
  contact_id: string;
  connection_id: string;
}

export interface ImportContactsRequest {
  contacts: string[];
}

export interface ContactResponse {
  success: boolean;
  data?: Contact | Contact[] | any;
  message?: string;
  error?: string;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
  contacts?: Contact[];
}