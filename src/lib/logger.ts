/**
 * 로그 유틸리티 - Expo 터미널에 명확하게 표시
 *
 * LOG_LEVEL 설정:
 * - 'none': 로그 출력 안함 (에러만)
 * - 'error': 에러만
 * - 'warn': 경고 + 에러
 * - 'info': 정보 + 경고 + 에러
 * - 'debug': 모든 로그
 */

const isDev = __DEV__;

// 로그 레벨 설정 (여기서 변경)
const LOG_LEVEL: 'none' | 'error' | 'warn' | 'info' | 'debug' = 'error';

const shouldLog = (level: 'debug' | 'info' | 'warn' | 'error'): boolean => {
  if (!isDev) return level === 'error';

  const levels = { none: 0, error: 1, warn: 2, info: 3, debug: 4 };
  const currentLevel = levels[LOG_LEVEL];
  const messageLevel = levels[level];

  return messageLevel <= currentLevel;
};

export const logger = {
  log: (...args: any[]) => {
    if (shouldLog('info')) {
      console.log('[LOG]', ...args);
    }
  },

  info: (...args: any[]) => {
    if (shouldLog('info')) {
      console.log('[INFO]', ...args);
    }
  },

  warn: (...args: any[]) => {
    if (shouldLog('warn')) {
      console.warn('[WARN]', ...args);
    }
  },

  error: (...args: any[]) => {
    if (shouldLog('error')) {
      console.error('[ERROR]', ...args);
    }
  },

  debug: (label: string, data: any) => {
    if (shouldLog('debug')) {
      console.log(`[DEBUG] ${label}:`, JSON.stringify(data, null, 2));
    }
  },

  group: (label: string, ...args: any[]) => {
    if (shouldLog('debug')) {
      console.group(`[GROUP] ${label}`);
      args.forEach((arg, i) => console.log(`  ${i + 1}.`, arg));
      console.groupEnd();
    }
  },
};

export default logger;
