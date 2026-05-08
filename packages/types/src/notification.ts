export interface Notification {
  id: number;
  message: string;
  is_read: boolean;
  user_id: number;
  created_at: string;
}

export interface NotificationsResponse {
  notifications: Notification[];
  current_page: number;
  total_pages: number;
  total_count: number;
}

export interface NotificationSettingsResponse {
  enabled: boolean;
}
