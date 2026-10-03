import { ProjectStatus } from './types/project';

export * from './types/auth';
export * from './types/client';
export * from './types/project';

export interface EngineerProfile {
  id: string;
  name: string;
  studioName: string;
  email: string;
  role: string;
  avatarUrl?: string;
  hourlyRate: number;
  currency: 'USD' | 'INR' | 'EUR' | 'GBP';
  razorpayKeyId: string;
  stripeConnected: boolean;
  phone: string;
  bio: string;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  projectCount: number;
  totalBilled: number;
  createdAt: string;
}

export interface MixVersion {
  id: string;
  projectId: string;
  versionNumber: number;
  versionName: string;
  notes: string;
  audioUrl?: string;
  durationSeconds: number;
  sampleRate: string;
  bitDepth: string;
  lufs: number;
  createdAt: string;
  waveformPeaks: number[];
}

export interface Comment {
  id: string;
  versionId: string;
  author: string;
  authorRole: 'client' | 'engineer';
  text: string;
  timestampSeconds: number;
  resolved: boolean;
  createdAt: string;
  replyText?: string;
}

export interface DeliveryFile {
  id: string;
  name: string;
  format: string;
  size: string;
  type: 'master' | 'instrumental' | 'acapella' | 'tv-mix' | 'stems';
  downloadUrl: string;
}

export interface ActivityItem {
  id: string;
  timestamp: string;
  actor: string;
  type: 'created' | 'version_uploaded' | 'comment_added' | 'resolved' | 'approved' | 'payment_received' | 'files_downloaded';
  description: string;
}

export interface Project {
  id: string;
  title: string;
  artist: string;
  genre: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  status: ProjectStatus;
  brief: string;
  referenceTracks: string[];
  totalAmount: number;
  paidAmount: number;
  shareToken: string;
  activeVersionId: string;
  isApproved: boolean;
  approvedAt?: string;
  versions: MixVersion[];
  comments: Comment[];
  activities: ActivityItem[];
  deliveries: DeliveryFile[];
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  projectId: string;
  projectTitle: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
  type: 'comment' | 'approval' | 'payment' | 'delivery';
}
