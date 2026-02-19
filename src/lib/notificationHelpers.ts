/**
 * 알림 순수 헬퍼 함수
 * expo-notifications 의존성 없는 순수 로직 (테스트 용이)
 */
import type { NotificationSettings } from '@/types';

export interface ScheduledAlert {
  itemId: string;
  itemName: string;
  dDayOffset: number;
  triggerDate: Date;
  isUrgent: boolean;
}

export function getNotificationTime(
  date: Date,
  isUrgent: boolean,
  settings: NotificationSettings,
): Date | null {
  // 명시적으로 로컬 타임존 기준 날짜 컴포넌트 추출 후 재구성
  // → TZ 변경/해외 사용자도 디바이스 로컬 시간 기준 알림
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();

  if (isUrgent) {
    return new Date(year, month, day, 8, 0, 0, 0);
  }
  const [h, m] = settings.summary_time.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  return new Date(year, month, day, h, m, 0, 0);
}

export function isInQuietHours(date: Date, settings: NotificationSettings): boolean {
  const [startH, startM] = settings.quiet_hours_start.split(':').map(Number);
  const [endH, endM] = settings.quiet_hours_end.split(':').map(Number);

  const h = date.getHours();
  const m = date.getMinutes();
  const timeMin = h * 60 + m;
  const startMin = startH * 60 + startM;
  const endMin = endH * 60 + endM;

  if (startMin > endMin) {
    return timeMin >= startMin || timeMin < endMin;
  }
  return timeMin >= startMin && timeMin < endMin;
}

export function buildNotificationContent(alert: ScheduledAlert): { title: string; body: string } {
  const { itemName, dDayOffset } = alert;

  if (dDayOffset < 0) {
    const daysLeft = Math.abs(dDayOffset);
    return {
      title: `⏰ ${itemName} 소비기한 ${daysLeft}일 전`,
      body: `${itemName}의 소비기한이 ${daysLeft}일 남았습니다. 빨리 드세요!`,
    };
  } else if (dDayOffset === 0) {
    return {
      title: `🚨 ${itemName} 오늘 만료!`,
      body: `${itemName}의 소비기한이 오늘입니다! 지금 확인해주세요.`,
    };
  } else {
    return {
      title: `⚠️ ${itemName} 소비기한 ${dDayOffset}일 경과`,
      body: `${itemName}이(가) 소비기한을 ${dDayOffset}일 지났습니다. 폐기를 고려해주세요.`,
    };
  }
}
