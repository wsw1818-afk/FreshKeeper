import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { FoodItem, NotificationSettings } from '@/types';
import { DerivedStatus, DERIVED_STATUS_LABEL } from '@/types';
import { calculateDDay, parseDate } from '@/lib/dateUtils';
import { calculateStatus } from '@/lib/statusCalculator';
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  NOTIFICATION_WINDOW_DAYS,
  MAX_SCHEDULED_NOTIFICATIONS,
} from '@/constants/config';
import {
  getNotificationTime,
  isInQuietHours,
  buildNotificationContent,
  type ScheduledAlert,
} from '@/lib/notificationHelpers';
export type { ScheduledAlert } from '@/lib/notificationHelpers';
export { getNotificationTime, isInQuietHours, buildNotificationContent } from '@/lib/notificationHelpers';

// === 초기 설정 ===

export async function setupNotifications(): Promise<boolean> {
  // 알림 핸들러 설정
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  // 권한 요청
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return false;
  }

  // Android 채널 설정
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('urgent', {
      name: '긴급 알림',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
    });

    await Notifications.setNotificationChannelAsync('summary', {
      name: '요약 알림',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: 'default',
    });
  }

  return true;
}

// === 알림 스케줄링 ===

/**
 * 전체 아이템 목록을 기반으로 알림을 재스케줄링합니다.
 * 슬라이딩 윈도우 방식: 앞으로 NOTIFICATION_WINDOW_DAYS 일 이내의 알림만 스케줄링.
 */
export async function rescheduleAllNotifications(
  items: FoodItem[],
  settings: NotificationSettings = DEFAULT_NOTIFICATION_SETTINGS,
): Promise<number> {
  // 기존 알림 모두 취소
  await Notifications.cancelAllScheduledNotificationsAsync();

  if (!settings.summary_enabled && !settings.urgent_enabled) {
    return 0;
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const windowEnd = new Date(today);
  windowEnd.setDate(windowEnd.getDate() + NOTIFICATION_WINDOW_DAYS);

  // 활성 아이템에서 알림 목록 생성
  const alerts: ScheduledAlert[] = [];

  for (const item of items) {
    if (!item.alert_enabled || !item.expires_at || item.consumed_at) continue;

    const expiryDate = parseDate(item.expires_at);
    if (!expiryDate) continue;

    const offsets = item.alert_offsets?.length ? item.alert_offsets : settings.default_alert_offsets;

    for (const offset of offsets) {
      const triggerDate = new Date(expiryDate);
      triggerDate.setDate(triggerDate.getDate() + offset);

      // 윈도우 내인지 확인
      if (triggerDate < today || triggerDate > windowEnd) continue;

      alerts.push({
        itemId: item.id,
        itemName: item.name,
        dDayOffset: offset,
        triggerDate,
        isUrgent: offset >= 0, // 당일 또는 만료 후 = 긴급
      });
    }
  }

  // 우선순위 정렬: 긴급 먼저, 날짜 가까운 순
  alerts.sort((a, b) => {
    if (a.isUrgent !== b.isUrgent) return a.isUrgent ? -1 : 1;
    return a.triggerDate.getTime() - b.triggerDate.getTime();
  });

  // 최대 개수 제한
  const toSchedule = alerts.slice(0, MAX_SCHEDULED_NOTIFICATIONS);

  let scheduledCount = 0;

  for (const alert of toSchedule) {
    const triggerTime = getNotificationTime(alert.triggerDate, alert.isUrgent, settings);
    if (!triggerTime || triggerTime <= now) continue;

    // 방해 금지 시간 체크
    if (settings.quiet_hours_enabled && isInQuietHours(triggerTime, settings)) {
      continue;
    }

    const { title, body } = buildNotificationContent(alert);

    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: { itemId: alert.itemId, type: alert.isUrgent ? 'urgent' : 'reminder' },
          sound: 'default',
          ...(Platform.OS === 'android' ? {
            channelId: alert.isUrgent ? 'urgent' : 'summary',
          } : {}),
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: triggerTime,
        },
      });
      scheduledCount++;
    } catch (e) {
      console.warn('알림 스케줄 실패:', alert.itemName, e);
    }
  }

  // 매일 요약 알림 스케줄 (별도)
  if (settings.summary_enabled) {
    await scheduleDailySummary(items, settings);
  }

  return scheduledCount;
}

/**
 * 단일 아이템에 대한 알림을 업데이트합니다.
 * 최적화: 기존 알림의 트리거 시간과 비교하여 변경된 알림만 업데이트합니다.
 */
export async function updateItemNotifications(
  item: FoodItem,
  settings: NotificationSettings = DEFAULT_NOTIFICATION_SETTINGS,
): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();

  // 해당 아이템의 기존 알림 ID와 트리거 시간 수집
  const existingNotifs = scheduled.filter((n) => n.content.data?.itemId === item.id);
  const existingTriggers = new Map<string, string>(); // identifier → trigger ISO
  for (const n of existingNotifs) {
    const trigger = n.trigger as { type: string; date?: number };
    if (trigger.date) {
      existingTriggers.set(n.identifier, new Date(trigger.date).toISOString());
    }
  }

  // 알림이 비활성/소비/만료일 없음이면 기존 알림만 취소
  if (!item.alert_enabled || !item.expires_at || item.consumed_at) {
    for (const id of existingTriggers.keys()) {
      await Notifications.cancelScheduledNotificationAsync(id);
    }
    return;
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const windowEnd = new Date(today);
  windowEnd.setDate(windowEnd.getDate() + NOTIFICATION_WINDOW_DAYS);
  const expiryDate = parseDate(item.expires_at);
  if (!expiryDate) return;

  const offsets = item.alert_offsets?.length ? item.alert_offsets : settings.default_alert_offsets;

  // 새로 필요한 알림 시간 목록 계산
  const neededTriggers = new Set<string>();

  for (const offset of offsets) {
    const triggerDate = new Date(expiryDate);
    triggerDate.setDate(triggerDate.getDate() + offset);

    if (triggerDate < today || triggerDate > windowEnd) continue;

    const isUrgent = offset >= 0;
    const triggerTime = getNotificationTime(triggerDate, isUrgent, settings);
    if (!triggerTime || triggerTime <= now) continue;

    if (settings.quiet_hours_enabled && isInQuietHours(triggerTime, settings)) {
      continue;
    }

    const triggerISO = triggerTime.toISOString();
    neededTriggers.add(triggerISO);

    // 이미 같은 시간에 알림이 있으면 스킵
    const alreadyExists = Array.from(existingTriggers.values()).includes(triggerISO);
    if (alreadyExists) continue;

    const { title, body } = buildNotificationContent({
      itemId: item.id,
      itemName: item.name,
      dDayOffset: offset,
      triggerDate,
      isUrgent,
    });

    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: { itemId: item.id, type: isUrgent ? 'urgent' : 'reminder' },
          sound: 'default',
          ...(Platform.OS === 'android' ? {
            channelId: isUrgent ? 'urgent' : 'summary',
          } : {}),
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: triggerTime,
        },
      });
    } catch (e) {
      console.warn('알림 스케줄 실패:', item.name, e);
    }
  }

  // 더 이상 필요 없는 기존 알림 취소
  for (const [id, isoTime] of existingTriggers) {
    if (!neededTriggers.has(isoTime)) {
      await Notifications.cancelScheduledNotificationAsync(id);
    }
  }
}

/**
 * 아이템 소비/삭제 시 해당 아이템의 알림을 취소합니다.
 */
export async function cancelItemNotifications(itemId: string): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const notif of scheduled) {
    if (notif.content.data?.itemId === itemId) {
      await Notifications.cancelScheduledNotificationAsync(notif.identifier);
    }
  }
}

// === 매일 요약 알림 ===

async function scheduleDailySummary(
  items: FoodItem[],
  settings: NotificationSettings,
): Promise<void> {
  const activeItems = items.filter((i) => !i.consumed_at);
  if (activeItems.length === 0) return;

  let expiredCount = 0;
  let dangerCount = 0;
  let warnCount = 0;

  for (const item of activeItems) {
    const { status } = calculateStatus(item);
    if (status === DerivedStatus.EXPIRED) expiredCount++;
    else if (status === DerivedStatus.DANGER) dangerCount++;
    else if (status === DerivedStatus.WARN) warnCount++;
  }

  const urgentTotal = expiredCount + dangerCount + warnCount;
  if (urgentTotal === 0) return;

  const [hours, minutes] = settings.summary_time.split(':').map(Number);
  // 명시적 로컬 TZ 기준: 내일 날짜 컴포넌트로 재구성
  const now = new Date();
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const summaryTime = new Date(
    tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(),
    hours, minutes, 0, 0,
  );

  const parts: string[] = [];
  if (expiredCount > 0) parts.push(`만료 ${expiredCount}개`);
  if (dangerCount > 0) parts.push(`오늘만료 ${dangerCount}개`);
  if (warnCount > 0) parts.push(`임박 ${warnCount}개`);

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `🍽️ 오늘의 냉장고 현황`,
        body: `주의 필요: ${parts.join(', ')} (총 ${activeItems.length}개 보관 중)`,
        data: { type: 'summary' },
        sound: 'default',
        ...(Platform.OS === 'android' ? { channelId: 'summary' } : {}),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: summaryTime,
      },
    });
  } catch (e) {
    console.warn('요약 알림 스케줄 실패:', e);
  }
}

// === 디버그 유틸 ===

export async function getScheduledNotificationCount(): Promise<number> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  return scheduled.length;
}

export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
