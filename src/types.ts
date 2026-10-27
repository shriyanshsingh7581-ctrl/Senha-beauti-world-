export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export type ServiceCategory = 'Bridal' | 'Skin' | 'Hair' | 'Massage' | 'Draping';

export type GalleryCategory = 'Bridal' | 'Hair' | 'Skin' | 'Draping';

export type AppointmentStatus = 'Pending' | 'Confirmed' | 'Completed' | 'Cancelled';

export type InquiryStatus = 'New' | 'Replied' | 'Archived';

export interface ServiceItem {
  id: string;
  title: string;
  category: ServiceCategory;
  subCategory: string;
  price: number;
  originalPrice: number;
  duration: string;
  description: string;
  inclusions: string[];
  imageUrl: string;
  isActive: boolean;
  isFeatured: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface GalleryItem {
  id: string;
  title: string;
  category: GalleryCategory;
  clientName: string;
  description: string;
  beforeLabel: string;
  afterLabel: string;
  imageUrl: string;
  instagramUrl: string;
  isPublished: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AppointmentItem {
  id: string;
  clientUid: string;
  clientName: string;
  clientPhone: string;
  serviceId: string;
  serviceTitle: string;
  servicePrice: number;
  appointmentDate: string;
  timeSlot: string;
  notes: string;
  status: AppointmentStatus;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface InquiryItem {
  id: string;
  clientUid: string;
  name: string;
  phone: string;
  message: string;
  status: InquiryStatus;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface SiteSettings {
  brandName: string;
  tagline: string;
  phone: string;
  whatsappNumber: string;
  instagramHandle: string;
  instagramUrl: string;
  openingHours: string;
  address: string;
  announcementText: string;
  cloudinaryCloudName: string;
  cloudinaryUploadPreset: string;
  updatedAt?: unknown;
}

export interface CustomerReview {
  id: string;
  clientName: string;
  roleOrEvent: string;
  serviceTaken: string;
  rating: number;
  dateLabel: string;
  quote: string;
  outcomeHighlight: string;
}
