export interface Contact {
  id: string;
  userId: string;
  phoneNumber: string;
  name?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateContactRequest {
  phoneNumber: string;
  name?: string;
}

export interface UpdateContactRequest {
  name?: string;
}

export interface ImportContactsRequest {
  contacts: string[];
}

export interface ContactResponse {
  success: boolean;
  data?: Contact | Contact[];
  message?: string;
  error?: string;
}