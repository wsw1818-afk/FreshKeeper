import type { NotificationSettings } from '@/types';

export const DB_NAME = 'freshkeeper.db';
export const DB_VERSION = 1;

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  summary_enabled: true,
  summary_time: '09:00',
  urgent_enabled: true,
  quiet_hours_enabled: true,
  quiet_hours_start: '22:00',
  quiet_hours_end: '08:00',
  expired_repeat_days: 3,
  default_alert_offsets: [-3, -1, 0, 1],
};

export const DEFAULT_UNIT = '개';
export const DEFAULT_QUANTITY = 1;

// D-Day 기준 상태 분류
export const DDAY_THRESHOLDS = {
  SAFE_MIN: 4,    // D-Day > 3 → SAFE
  WARN_MIN: 1,    // D-Day 1~3 → WARN
  DANGER: 0,      // D-Day = 0 → DANGER
  // D-Day < 0 → EXPIRED
};

// 알림 슬라이딩 윈도우
export const NOTIFICATION_WINDOW_DAYS = 7;
export const MAX_SCHEDULED_NOTIFICATIONS = 60;

// 페이지네이션
export const ITEMS_PER_PAGE = 50;
