/**
 * dateUtils.ts 단위 테스트
 * 날짜 계산, 파싱, D-Day, 개봉/해동 후 소비기한 재계산 로직 검증
 */
import {
  getToday,
  parseDate,
  formatDate,
  isValidDateString,
  calculateDDay,
  calculateExpiryDate,
  recalculateAfterOpen,
  recalculateAfterThaw,
  formatDDay,
  formatDisplayDate,
  getNowISO,
} from '@/lib/dateUtils';

// 날짜 고정을 위한 헬퍼
const FIXED_TODAY = '2026-02-18';

// jest.useFakeTimers로 오늘 날짜를 고정
beforeAll(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-02-18T09:00:00.000Z'));
});

afterAll(() => {
  jest.useRealTimers();
});

describe('getToday()', () => {
  it('오늘 날짜를 YYYY-MM-DD 형식으로 반환', () => {
    const today = getToday();
    expect(today).toBe(FIXED_TODAY);
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('parseDate()', () => {
  it('유효한 YYYY-MM-DD 문자열을 Date로 파싱', () => {
    const d = parseDate('2026-03-01');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(2); // 0-indexed
    expect(d.getDate()).toBe(1);
  });
});

describe('formatDate()', () => {
  it('Date를 YYYY-MM-DD 문자열로 변환', () => {
    const d = new Date(2026, 0, 15); // 2026-01-15
    expect(formatDate(d)).toBe('2026-01-15');
  });
});

describe('isValidDateString()', () => {
  it('유효한 날짜 문자열 검증', () => {
    expect(isValidDateString('2026-02-18')).toBe(true);
    expect(isValidDateString('2026-12-31')).toBe(true);
    expect(isValidDateString('2026-01-01')).toBe(true);
  });

  it('잘못된 형식 거부', () => {
    expect(isValidDateString('2026/02/18')).toBe(false);
    expect(isValidDateString('18-02-2026')).toBe(false);
    expect(isValidDateString('abc')).toBe(false);
    expect(isValidDateString('')).toBe(false);
    expect(isValidDateString('2026-13-01')).toBe(false); // 13월 없음
    expect(isValidDateString('2026-02-30')).toBe(false); // 2월 30일 없음
  });
});

describe('calculateDDay()', () => {
  it('미래 날짜는 양수 D-Day 반환', () => {
    expect(calculateDDay('2026-02-21')).toBe(3);
    expect(calculateDDay('2026-02-25')).toBe(7);
    expect(calculateDDay('2026-03-18')).toBe(28);
  });

  it('오늘 날짜는 D-Day 0', () => {
    expect(calculateDDay('2026-02-18')).toBe(0);
  });

  it('과거 날짜는 음수 D-Day 반환', () => {
    expect(calculateDDay('2026-02-17')).toBe(-1);
    expect(calculateDDay('2026-02-15')).toBe(-3);
  });
});

describe('calculateExpiryDate()', () => {
  it('입고일 + 보관일로 만료일 계산', () => {
    expect(calculateExpiryDate('2026-02-18', 3)).toBe('2026-02-21');
    expect(calculateExpiryDate('2026-02-18', 7)).toBe('2026-02-25');
    expect(calculateExpiryDate('2026-02-18', 0)).toBe('2026-02-18');
    expect(calculateExpiryDate('2026-02-18', 30)).toBe('2026-03-20');
  });

  it('월 경계를 정확히 처리', () => {
    expect(calculateExpiryDate('2026-01-30', 3)).toBe('2026-02-02');
    expect(calculateExpiryDate('2026-12-30', 5)).toBe('2027-01-04');
  });
});

describe('recalculateAfterOpen() - BUG-001 핵심 테스트', () => {
  it('개봉 후 기존 만료일과 개봉+보관일 중 빠른 날짜 반환', () => {
    // 기존 만료일(2026-03-01) vs 개봉+3일(2026-02-21) → 빠른 것: 2026-02-21
    expect(recalculateAfterOpen('2026-03-01', '2026-02-18', 3)).toBe('2026-02-21');
  });

  it('개봉+보관일이 기존 만료일보다 늦으면 기존 만료일 유지', () => {
    // 기존 만료일(2026-02-20) vs 개봉+7일(2026-02-25) → 기존: 2026-02-20
    expect(recalculateAfterOpen('2026-02-20', '2026-02-18', 7)).toBe('2026-02-20');
  });

  it('기존 만료일이 null이면 개봉+보관일 반환', () => {
    expect(recalculateAfterOpen(null, '2026-02-18', 5)).toBe('2026-02-23');
  });

  it('개봉일과 보관일이 동일하면 개봉일 당일 반환', () => {
    expect(recalculateAfterOpen('2026-03-01', '2026-02-18', 0)).toBe('2026-02-18');
  });
});

describe('recalculateAfterThaw() - BUG-001 핵심 테스트', () => {
  it('해동일 + 보관일로 새 만료일 반환', () => {
    expect(recalculateAfterThaw('2026-02-18', 2)).toBe('2026-02-20');
    expect(recalculateAfterThaw('2026-02-18', 1)).toBe('2026-02-19');
  });

  it('보관일 0이면 해동 당일 반환', () => {
    expect(recalculateAfterThaw('2026-02-18', 0)).toBe('2026-02-18');
  });
});

describe('formatDDay()', () => {
  it('양수 D-Day는 "D-N" 형식', () => {
    expect(formatDDay(3)).toBe('D-3');
    expect(formatDDay(1)).toBe('D-1');
  });

  it('0은 "D-Day"', () => {
    expect(formatDDay(0)).toBe('D-Day');
  });

  it('음수 D-Day는 "D+N" 형식', () => {
    expect(formatDDay(-1)).toBe('D+1');
    expect(formatDDay(-5)).toBe('D+5');
  });
});

describe('formatDisplayDate()', () => {
  it('날짜를 "M월 d일" 형식으로 표시', () => {
    expect(formatDisplayDate('2026-02-18')).toBe('2월 18일');
    expect(formatDisplayDate('2026-12-25')).toBe('12월 25일');
    expect(formatDisplayDate('2026-01-01')).toBe('1월 1일');
  });
});

describe('getNowISO()', () => {
  it('ISO 8601 형식 반환', () => {
    const iso = getNowISO();
    expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
  });
});
