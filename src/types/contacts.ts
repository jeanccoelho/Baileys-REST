export interface Contact {
  id: string;
  user_id: string;
  phone_number: string;
  name?: string | null;
  whatsapp_exists?: boolean | null;
  whatsapp_jid?: string | null;
  whatsapp_status?: string | null;
  whatsapp_picture?: string | null;
  whatsapp_business?: boolean;
  whatsapp_verified_name?: string | null;
  whatsapp_business_hours?: string | null;
  whatsapp_website?: string | null;
  whatsapp_email?: string | null;
  whatsapp_address?: string | null;
  whatsapp_category?: string | null;
  metadata?: any;
  last_whatsapp_check?: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface ContactFilters {
  search?: string;
  phoneNumber?: string;
  hasWhatsApp?: boolean | null;
  hasPicture?: boolean | null;
  notValidated?: boolean | null;
  createdAtStart?: string;
  createdAtEnd?: string;
  sortBy?: 'createdAt' | 'updatedAt' | 'phoneNumber' | 'name' | 'lastWhatsappCheck';
  sortOrder?: 'asc' | 'desc';
}

export interface PaginationMetadata {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
  totalWhatsappExists?: number;
  totalWhatsappNotExists?: number;
  totalNotValidated?: number;
  totalBusiness?: number;
  totalVerified?: number;
}

export interface PaginatedApiResponse<T = any> {
  success: boolean;
  data?: T;
  pagination?: PaginationMetadata;
  message?: string;
  error?: string;
}

export interface CreateContactRequest {
  phone_number: string;
  name?: string;
}

export interface UpdateContactRequest {
  name?: string;
  whatsapp_business_hours?: string;
  whatsapp_website?: string;
  whatsapp_email?: string;
  whatsapp_address?: string;
  whatsapp_category?: string;
  whatsapp_status?: string;
  whatsapp_picture?: string;
  whatsapp_business?: boolean;
  whatsapp_verified_name?: string;
  metadata?: any;
}

export interface ValidateContactRequest {
  contact_id: string;
  connection_id: string;
}

export interface ImportContactsRequest {
  contacts: string[];
}

export interface ContactResponse extends PaginatedApiResponse<Contact | Contact[] | ImportResult | any> {
  success: boolean;
  data?: Contact | Contact[] | ImportResult | any;
  pagination?: PaginationMetadata;
  message?: string;
  error?: string;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
  contacts?: Contact[];
}