/**
 * Step 15: Notifications Foundation Types
 */

export type NotificationType =
  | 'feedback_added'
  | 'feedback_resolved'
  | 'revision_requested'
  | 'version_uploaded'
  | 'version_approved'
  | 'payment_recorded'
  | 'payment_status_changed'
  | 'delivery_released'
  | 'delivery_downloaded'
  | 'project_created'
  | 'project_status_changed'
  | 'project_assigned'
  | 'collaborator_invited';

export interface ProjectNotificationRecord {
  id: string;
  organization_id: string;
  project_id: string | null;
  recipient_user_id: string;
  actor_user_id: string | null;
  type: NotificationType;
  title: string;
  message: string;
  link_url: string | null;
  read_at: string | null;
  created_at: string;
}

export interface CreateNotificationInput {
  organization_id: string;
  project_id?: string | null;
  recipient_user_id: string;
  actor_user_id?: string | null;
  type: NotificationType;
  title: string;
  message: string;
  link_url?: string | null;
}

export interface NotificationListResponse {
  notifications: ProjectNotificationRecord[];
  unreadCount: number;
}
