/**
 * 알림 시스템 로직 테스트
 * 알림 시간 결정, 방해 금지 시간, 알림 콘텐츠 생성 등 순수 로직 검증
 */
import {
  getNotificationTime,
  isInQuietHours,
  buildNotificationContent,
} from '@/lib/notificationHelpers';
import type { ScheduledAlert } from '@/lib/notificationHelpers';
import type { NotificationSettings } from '@/types';
import { DEFAULT_NOTIFICATION_SETTINGS, MAX_SCHEDULED_NOTIFICATIONS, NOTIFICATION_WINDOW_DAYS } from '@/constants/config';

const defaultSettings: NotificationSettings = {
  summary_enabled: true,
  summary_time: '09:00',
  urgent_enabled: true,
  quiet_hours_enabled: true,
  quiet_hours_start: '22:00',
  quiet_hours_end: '08:00',
  expired_repeat_days: 3,
  default_alert_offsets: [-3, -1, 0, 1],
};

// ========== getNotificationTime ==========
describe('getNotificationTime()', () => {
  it('긴급 알림은 오전 8시로 설정된다', () => {
    const date = new Date('2026-02-20');
    const result = getNotificationTime(date, true, defaultSettings);
    expect(result).not.toBeNull();
    expect(result!.getHours()).toBe(8);
    expect(result!.getMinutes()).toBe(0);
  });

  it('일반 알림은 요약 시간(09:00)으로 설정된다', () => {
    const date = new Date('2026-02-20');
    const result = getNotificationTime(date, false, defaultSettings);
    expect(result).not.toBeNull();
    expect(result!.getHours()).toBe(9);
    expect(result!.getMinutes()).toBe(0);
  });

  it('잘못된 summary_time 형식이면 null을 반환한다', () => {
    const settings = { ...defaultSettings, summary_time: 'invalid' };
    const date = new Date('2026-02-20');
    const result = getNotificationTime(date, false, settings);
    expect(result).toBeNull();
  });

  it('빈 summary_time이면 null을 반환한다', () => {
    const settings = { ...defaultSettings, summary_time: '' };
    const date = new Date('2026-02-20');
    const result = getNotificationTime(date, false, settings);
    expect(result).toBeNull();
  });

  it('커스텀 요약 시간 설정이 반영된다', () => {
    const settings = { ...defaultSettings, summary_time: '18:30' };
    const date = new Date('2026-02-20');
    const result = getNotificationTime(date, false, settings);
    expect(result!.getHours()).toBe(18);
    expect(result!.getMinutes()).toBe(30);
  });

  it('날짜는 유지하면서 시간만 변경된다', () => {
    const date = new Date('2026-03-15');
    const result = getNotificationTime(date, true, defaultSettings);
    expect(result!.getFullYear()).toBe(2026);
    expect(result!.getMonth()).toBe(2); // March = 2 (0-indexed)
    expect(result!.getDate()).toBe(15);
  });
});

// ========== isInQuietHours ==========
describe('isInQuietHours()', () => {
  it('자정 전 방해 금지 시간 (22:00~08:00): 23시는 방해 금지', () => {
    const date = new Date('2026-02-18T23:00:00');
    expect(isInQuietHours(date, defaultSettings)).toBe(true);
  });

  it('자정 후 방해 금지 시간: 06시는 방해 금지', () => {
    const date = new Date('2026-02-18T06:00:00');
    expect(isInQuietHours(date, defaultSettings)).toBe(true);
  });

  it('방해 금지 시간 외: 09시는 허용', () => {
    const date = new Date('2026-02-18T09:00:00');
    expect(isInQuietHours(date, defaultSettings)).toBe(false);
  });

  it('방해 금지 시간 외: 21시는 허용', () => {
    const date = new Date('2026-02-18T21:00:00');
    expect(isInQuietHours(date, defaultSettings)).toBe(false);
  });

  it('경계값: 22:00 정각은 방해 금지 시작', () => {
    const date = new Date('2026-02-18T22:00:00');
    expect(isInQuietHours(date, defaultSettings)).toBe(true);
  });

  it('경계값: 08:00 정각은 방해 금지 끝 (허용)', () => {
    const date = new Date('2026-02-18T08:00:00');
    expect(isInQuietHours(date, defaultSettings)).toBe(false);
  });

  it('자정 넘기지 않는 방해 금지 시간 (09:00~17:00)', () => {
    const settings = { ...defaultSettings, quiet_hours_start: '09:00', quiet_hours_end: '17:00' };
    expect(isInQuietHours(new Date('2026-02-18T10:00:00'), settings)).toBe(true);
    expect(isInQuietHours(new Date('2026-02-18T08:00:00'), settings)).toBe(false);
    expect(isInQuietHours(new Date('2026-02-18T18:00:00'), settings)).toBe(false);
  });

  it('방해 금지 비활성화 시에도 함수 자체는 시간만 판단', () => {
    // isInQuietHours는 시간 범위만 판단, 활성화 여부는 호출측에서 체크
    const settings = { ...defaultSettings, quiet_hours_enabled: false };
    const date = new Date('2026-02-18T23:00:00');
    // 함수는 여전히 true를 반환 (호출측에서 enabled 체크)
    expect(isInQuietHours(date, settings)).toBe(true);
  });
});

// ========== buildNotificationContent ==========
describe('buildNotificationContent()', () => {
  it('D-3 알림: "소비기한 3일 전" 문구', () => {
    const alert: ScheduledAlert = {
      itemId: '1', itemName: '우유', dDayOffset: -3,
      triggerDate: new Date('2026-02-22'), isUrgent: false,
    };
    const { title, body } = buildNotificationContent(alert);
    expect(title).toContain('우유');
    expect(title).toContain('3일 전');
    expect(body).toContain('3일 남았습니다');
  });

  it('D-1 알림: "소비기한 1일 전" 문구', () => {
    const alert: ScheduledAlert = {
      itemId: '1', itemName: '두부', dDayOffset: -1,
      triggerDate: new Date('2026-02-24'), isUrgent: false,
    };
    const { title, body } = buildNotificationContent(alert);
    expect(title).toContain('두부');
    expect(title).toContain('1일 전');
  });

  it('D-Day 알림: "오늘 만료!" 문구', () => {
    const alert: ScheduledAlert = {
      itemId: '1', itemName: '삼겹살', dDayOffset: 0,
      triggerDate: new Date('2026-02-25'), isUrgent: true,
    };
    const { title, body } = buildNotificationContent(alert);
    expect(title).toContain('삼겹살');
    expect(title).toContain('오늘 만료');
    expect(body).toContain('오늘');
  });

  it('D+1 알림: "1일 경과" 문구', () => {
    const alert: ScheduledAlert = {
      itemId: '1', itemName: '계란', dDayOffset: 1,
      triggerDate: new Date('2026-02-26'), isUrgent: true,
    };
    const { title, body } = buildNotificationContent(alert);
    expect(title).toContain('계란');
    expect(title).toContain('1일 경과');
    expect(body).toContain('폐기를 고려');
  });

  it('D+3 알림: "3일 경과" 문구', () => {
    const alert: ScheduledAlert = {
      itemId: '1', itemName: '요거트', dDayOffset: 3,
      triggerDate: new Date('2026-02-28'), isUrgent: true,
    };
    const { title, body } = buildNotificationContent(alert);
    expect(title).toContain('3일 경과');
  });
});

// ========== 설정 상수 검증 ==========
describe('설정 상수 검증', () => {
  it('DEFAULT_NOTIFICATION_SETTINGS 기본값이 올바르다', () => {
    expect(DEFAULT_NOTIFICATION_SETTINGS.summary_enabled).toBe(true);
    expect(DEFAULT_NOTIFICATION_SETTINGS.summary_time).toBe('09:00');
    expect(DEFAULT_NOTIFICATION_SETTINGS.urgent_enabled).toBe(true);
    expect(DEFAULT_NOTIFICATION_SETTINGS.quiet_hours_enabled).toBe(true);
    expect(DEFAULT_NOTIFICATION_SETTINGS.quiet_hours_start).toBe('22:00');
    expect(DEFAULT_NOTIFICATION_SETTINGS.quiet_hours_end).toBe('08:00');
  });

  it('MAX_SCHEDULED_NOTIFICATIONS는 60개로 제한', () => {
    expect(MAX_SCHEDULED_NOTIFICATIONS).toBe(60);
  });

  it('NOTIFICATION_WINDOW_DAYS는 7일', () => {
    expect(NOTIFICATION_WINDOW_DAYS).toBe(7);
  });

  it('기본 알림 오프셋에 D-Day(0)가 포함됨', () => {
    expect(DEFAULT_NOTIFICATION_SETTINGS.default_alert_offsets).toContain(0);
  });

  it('기본 알림 오프셋에 사전 알림(음수)이 포함됨', () => {
    const negatives = DEFAULT_NOTIFICATION_SETTINGS.default_alert_offsets.filter((n) => n < 0);
    expect(negatives.length).toBeGreaterThan(0);
  });
});
