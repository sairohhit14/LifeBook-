export type RelationshipType = 
  | 'Parent' 
  | 'Spouse' 
  | 'Child' 
  | 'Sibling' 
  | 'Grandchild' 
  | 'Grandparent' 
  | 'Friend' 
  | 'Other';

export type PermissionType = 'viewer' | 'contributor' | 'editor' | 'admin';

export type DeliveryOptionType = 
  | 'Specific Date' 
  | 'Birthday' 
  | 'Anniversary' 
  | 'Graduation' 
  | 'Wedding' 
  | 'Custom Event';

export type MilestoneCategoryType =
  | 'Childhood'
  | 'School'
  | 'College'
  | 'Career'
  | 'Marriage'
  | 'Travel'
  | 'Achievement'
  | 'Family'
  | 'Other';

export type DocumentCategoryType =
  | 'Will'
  | 'Insurance'
  | 'Property'
  | 'Medical Records'
  | 'Identity Documents'
  | 'Certificates'
  | 'Financial Documents'
  | 'Other';

export type UserRole = 
  | 'Free User' 
  | 'Premium User' 
  | 'Family Admin' 
  | 'Family Member' 
  | 'Business Admin' 
  | 'Business Member' 
  | 'Super Admin';

export type PlanTier = 
  | 'Free' 
  | 'Individual Monthly' 
  | 'Individual 6-Month' 
  | 'Individual Yearly' 
  | 'Family Plan' 
  | 'Business & Organization Plan';

export interface User {
  id: string;
  name: string;
  email: string;
  dob: string;
  phone?: string;
  legacyCompletion: number;
  profilePhoto?: string;
  createdAt: string;
  legacyKey?: string; // Generated legacy key for family access
  ownerName?: string; // If guest, the name of the legacy archive owner
  role?: UserRole;
  planTier?: PlanTier;
  storageUsedGB?: number;
  storageLimitGB?: number;
  autoRenew?: boolean;
  subscriptionEndDate?: string;
  familyId?: string;
  orgId?: string;
}

export interface MediaFile {
  id: string;
  type: 'image' | 'video' | 'audio';
  url: string; // Base64 or relative server upload URL
  name: string;
}

export interface Memory {
  id: string;
  userId: string;
  title: string;
  description: string;
  date: string;
  location: string;
  tags: string[];
  media: MediaFile[];
  createdAt: string;
}

export interface Milestone {
  id: string;
  userId: string;
  title: string;
  description: string;
  date: string;
  category: MilestoneCategoryType;
  location: string;
  media?: MediaFile[];
  createdAt: string;
}

export interface LegacyMessage {
  id: string;
  userId: string;
  title: string;
  recipientName: string;
  recipientEmail: string;
  deliveryOption: DeliveryOptionType;
  deliveryDate?: string;
  deliveryTime?: string;
  type: 'text' | 'voice' | 'video';
  content: string; // Message content or voice/video metadata
  mediaUrl?: string; // base64 or path to file
  mediaName?: string;
  status: 'scheduled' | 'delivered' | 'failed';
  error?: string;
  previewUrl?: string;
  createdAt: string;
}

export interface FamilyMember {
  id: string;
  userId: string;
  name: string;
  relationship: RelationshipType;
  email: string;
  phone?: string;
  dob?: string;
  permission?: PermissionType;
  role?: string;
  profilePhoto?: string;
  createdAt: string;
  joinedAt?: string;
  status?: 'active' | 'pending';
}

export interface DocumentFile {
  id: string;
  userId: string;
  name: string;
  category: DocumentCategoryType;
  size: string; // e.g. "1.2 MB"
  uploadDate: string;
  fileUrl: string; // base64 or path
  mimeType: string;
  isEncrypted: boolean;
  title?: string;
  notes?: string;
  fileName?: string;
  fileSize?: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  date: string;
  read: boolean;
}

export interface ChatMessage {
  id: string;
  role?: 'user' | 'model';
  sender?: 'user' | 'companion' | 'model';
  text: string;
  date?: string;
  timestamp?: string;
}

export interface AIStoryChapter {
  title: string;
  content: string;
}

export interface AIStory {
  id: string;
  userId: string;
  title: string;
  biographyLength: 'short' | 'medium' | 'biography';
  chapters: AIStoryChapter[];
  generatedAt: string;
}

export interface DashboardStats {
  legacyCompletion: number;
  totalMemories: number;
  photosCount: number;
  videosCount: number;
  voicesCount: number;
  documentsCount: number;
  familyMembersCount: number;
  storiesGeneratedCount: number;
  storageUsedGB?: number;
  storageLimitGB?: number;
  planTier?: PlanTier;
  role?: UserRole;
}

// ==================== SUBSCRIPTION & MONETIZATION TYPES ====================

export interface Subscription {
  id: string;
  userId: string;
  planTier: PlanTier;
  billingCycle: 'monthly' | '6-month' | 'yearly';
  amount: number;
  currency: string;
  status: 'active' | 'cancelled' | 'expired' | 'pending';
  storageAllocatedGB: number;
  startDate: string;
  nextBillingDate: string;
  autoRenew: boolean;
  paymentMethod: string;
}

export interface FamilyGroup {
  id: string;
  familyAdminId: string;
  familyName: string;
  totalStorageGB: number;
  usedStorageGB: number;
  createdAt: string;
  members: FamilyMember[];
  albums: FamilyAlbum[];
  activities: FamilyActivity[];
  invitations: FamilyInvite[];
}

export interface FamilyAlbum {
  id: string;
  familyId: string;
  title: string;
  description: string;
  coverImage?: string;
  photosCount: number;
  createdByName: string;
  createdAt: string;
}

export interface FamilyActivity {
  id: string;
  familyId: string;
  userName: string;
  userRole: string;
  action: string;
  timestamp: string;
}

export interface FamilyInvite {
  id: string;
  familyId: string;
  email: string;
  role: PermissionType;
  status: 'pending' | 'accepted' | 'declined';
  sentAt: string;
}

export interface Organization {
  id: string;
  name: string;
  orgType: 'School' | 'College' | 'Company' | 'NGO' | 'Community' | 'Startup' | 'Corporate Team' | 'Association';
  logoUrl?: string;
  adminUserId: string;
  totalStorageGB: number;
  usedStorageGB: number;
  memberCount: number;
  createdAt: string;
  brandingColor?: string;
  departments: OrganizationDepartment[];
  events: OrganizationEvent[];
  documentsCount: number;
  memoriesCount: number;
}

export interface OrganizationDepartment {
  id: string;
  orgId: string;
  name: string;
  headName: string;
  memberCount: number;
}

export interface OrganizationEvent {
  id: string;
  orgId: string;
  title: string;
  date: string;
  location: string;
  description: string;
  attendeesCount: number;
  category: string;
}

export interface Advertisement {
  id: string;
  title: string;
  sponsorName: string;
  imageUrl: string;
  targetUrl: string;
  placement: 'sidebar' | 'feed' | 'banner' | 'bottom' | 'sponsored_card';
  startDate: string;
  endDate: string;
  active: boolean;
  clicks: number;
  views: number;
  dailyEarnings: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  userId: string;
  userName: string;
  planName: string;
  amount: number;
  taxAmount: number;
  totalAmount: number;
  currency: string;
  date: string;
  status: 'paid' | 'pending' | 'failed';
  paymentMethod: string;
  pdfUrl?: string;
}

export interface Payment {
  id: string;
  invoiceId: string;
  userId: string;
  amount: number;
  method: 'UPI' | 'Credit Card' | 'Debit Card' | 'Net Banking' | 'Wallet';
  transactionId: string;
  timestamp: string;
  status: 'success' | 'failed' | 'pending';
}


/* ================= AUTOBIOGRAPHY ================= */

export interface AutobiographySourceRef {
  kind: "memory" | "milestone" | "photo";
  id: string;
}

export type AutobiographyChapterStatus = "pending" | "generating" | "ready" | "failed";

export interface AutobiographyChapter {
  id: string;
  title: string;
  subtitle?: string;
  order: number;
  period?: string; // human label, e.g. "1998 – 2006"
  sections: string[]; // narrative paragraphs, user-editable and authoritative
  memoryIds: string[];
  photoIds: string[];
  status: AutobiographyChapterStatus;
  userEdited?: boolean;
  error?: string; // set when status === "failed"
  updatedAt: string;
}

export interface Autobiography {
  id: string;
  userId: string;
  title: string;
  subtitle?: string;
  coverPhotoId?: string; // media id of the cover photo (or profile photo)
  status: "empty" | "generating" | "ready_for_review" | "published" | "failed";
  narrativeStyle: string; // warm | reflective | simple | literary | conversational | formal
  perspective: "first" | "third" | "legacy";
  chapters: AutobiographyChapter[];
  sourceHash: string; // fingerprint of source material at last generation
  progress: { total: number; done: number }; // real, bounded progress
  conflicts?: { kind: string; subject: string; detail: string; memoryIds: string[] }[]; // detected source conflicts for review
  lastError?: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}

// Autobiography generation settings
export interface AutobiographySettings {
  narrativeStyle: string;
  perspective: "first" | "third" | "legacy";
  title?: string;
  subtitle?: string;
  coverPhotoId?: string;
}
