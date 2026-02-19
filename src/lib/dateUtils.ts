import { format, differenceInCalendarDays, addDays, parseISO, isValid } from 'date-fns';

/**
 * 오늘 날짜를 YYYY-MM-DD 형식으로 반환
 */
export function getToday(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

/**
 * YYYY-MM-DD 문자열을 Date 객체로 파싱 (자정 기준)
 */
export function parseDate(dateStr: string): Date {
  return parseISO(dateStr);
}

/**
 * Date 객체를 YYYY-MM-DD 문자열로 포맷
 */
export function formatDate(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

/**
 * YYYY-MM-DD 형식 유효성 검사
 */
export function isValidDateString(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const date = parseISO(dateStr);
  return isValid(date);
}

/**
 * D-Day 계산: expires_at - today
 * 양수: 남은 일수, 0: 오늘 만료, 음수: 초과 일수
 */
export function calculateDDay(expiresAt: string): number {
  const today = parseISO(getToday());
  const expiry = parseISO(expiresAt);
  return differenceInCalendarDays(expiry, today);
}

/**
 * 입고일 + 보관일로 만료일 계산
 */
export function calculateExpiryDate(addedAt: string, days: number): string {
  const date = parseISO(addedAt);
  return formatDate(addDays(date, days));
}

/**
 * 개봉 후 재계산: 기존 expires_at과 opened_at + after_open_days 중 빠른 날짜 적용
 */
export function recalculateAfterOpen(
  currentExpiresAt: string | null,
  openedAt: string,
  afterOpenDays: number,
): string {
  const newExpiry = calculateExpiryDate(openedAt, afterOpenDays);
  if (!currentExpiresAt) return newExpiry;
  // 더 빠른 날짜 적용
  return newExpiry < currentExpiresAt ? newExpiry : currentExpiresAt;
}

/**
 * 해동 후 재계산
 */
export function recalculateAfterThaw(
  thawedAt: string,
  afterThawDays: number,
): string {
  return calculateExpiryDate(thawedAt, afterThawDays);
}

/**
 * D-Day를 표시 문자열로 변환
 */
export function formatDDay(dDay: number): string {
  if (dDay > 0) return `D-${dDay}`;
  if (dDay === 0) return 'D-Day';
  return `D+${Math.abs(dDay)}`;
}

/**
 * 날짜를 사용자 친화적 형식으로 표시
 */
export function formatDisplayDate(dateStr: string): string {
  const date = parseISO(dateStr);
  return format(date, 'M월 d일');
}

/**
 * ISO 8601 타임스탬프 생성
 */
export function getNowISO(): string {
  return new Date().toISOString();
}
