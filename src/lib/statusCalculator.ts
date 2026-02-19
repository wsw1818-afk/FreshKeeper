import { DerivedStatus, type FoodItem, FoodCategory } from '@/types';
import { calculateDDay } from './dateUtils';
import { DDAY_THRESHOLDS } from '@/constants/config';

// 장기보관 카테고리 (김치/장류 등)
const LONG_TERM_CATEGORIES = new Set<FoodCategory>([
  FoodCategory.FERMENTED,
]);

interface StatusInfo {
  status: DerivedStatus;
  dDay: number | null;
}

/**
 * FoodItem의 파생 상태(DerivedStatus)와 D-Day를 계산
 */
export function calculateStatus(item: FoodItem): StatusInfo {
  // 이미 소비/폐기 처리된 아이템
  if (item.consumed_at && item.outcome) {
    return { status: DerivedStatus.EXPIRED, dDay: null };
  }

  // expires_at이 없으면 CHECK_NEEDED
  if (!item.expires_at) {
    // 장기보관 카테고리인 경우 LONG_TERM
    if (LONG_TERM_CATEGORIES.has(item.category)) {
      return { status: DerivedStatus.LONG_TERM, dDay: null };
    }
    return { status: DerivedStatus.CHECK_NEEDED, dDay: null };
  }

  const dDay = calculateDDay(item.expires_at);

  // 장기보관 카테고리 + D-Day가 충분히 남은 경우
  if (LONG_TERM_CATEGORIES.has(item.category) && dDay > 30) {
    return { status: DerivedStatus.LONG_TERM, dDay };
  }

  if (dDay < 0) {
    return { status: DerivedStatus.EXPIRED, dDay };
  }
  if (dDay === DDAY_THRESHOLDS.DANGER) {
    return { status: DerivedStatus.DANGER, dDay };
  }
  if (dDay >= DDAY_THRESHOLDS.WARN_MIN && dDay < DDAY_THRESHOLDS.SAFE_MIN) {
    return { status: DerivedStatus.WARN, dDay };
  }
  return { status: DerivedStatus.SAFE, dDay };
}

/**
 * 상태별 정렬 우선순위 (긴급한 것이 먼저)
 */
export function getStatusPriority(status: DerivedStatus): number {
  const priorities: Record<DerivedStatus, number> = {
    [DerivedStatus.DANGER]: 0,
    [DerivedStatus.EXPIRED]: 1,
    [DerivedStatus.WARN]: 2,
    [DerivedStatus.CHECK_NEEDED]: 3,
    [DerivedStatus.SAFE]: 4,
    [DerivedStatus.LONG_TERM]: 5,
  };
  return priorities[status];
}
