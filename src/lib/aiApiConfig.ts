/**
 * AI API 설정 관리 서비스
 * OCR 전용 가성비 모델 추천
 * API 키는 app_settings 테이블에 저장
 */

import { getDatabase } from '@/lib/database';

export type AIProvider = 'gpt' | 'gemini' | 'glm' | 'kimi' | 'none';

export interface AIApiConfig {
  provider: AIProvider;
  apiKey: string;
}

/** 모델 상세 정보 */
export interface ModelInfo {
  name: string;
  provider: string;
  cost: string;
  ocrAccuracy: 'excellent' | 'good' | 'moderate';
  freeTier: string;
  signupUrl: string;
  pros: string[];
}

export const AI_MODEL_INFO: Record<AIProvider, ModelInfo> = {
  gpt: {
    name: 'GPT-4o mini',
    provider: 'OpenAI',
    cost: '약 200원/1천회 (한국 기준)',
    ocrAccuracy: 'excellent',
    freeTier: '$5 크레딧 (신규 가입시)',
    signupUrl: 'https://platform.openai.com/signup',
    pros: ['한국어 OCR 최고 성능', '유통기한 인식 정확도 높음', '전 세계적 안정성'],
  },
  gemini: {
    name: 'Gemini 1.5 Flash',
    provider: 'Google',
    cost: '약 100원/1천회 (한국 기준)',
    ocrAccuracy: 'excellent',
    freeTier: '하루 1,500회 무료',
    signupUrl: 'https://aistudio.google.com/app/apikey',
    pros: ['무료 티어 매우 넉넉함', '한국어 OCR 우수', 'Google 계정으로 바로 사용'],
  },
  glm: {
    name: 'GLM-4V-Flash',
    provider: 'ZhipuAI (지푸)',
    cost: '약 10원/1천회 (거의 무료)',
    ocrAccuracy: 'good',
    freeTier: '월 100만 토큰 무료',
    signupUrl: 'https://open.bigmodel.cn/usercenter/signup',
    pros: ['중국어 OCR 우수', '가성비 최고', '한국어 지원'],
  },
  kimi: {
    name: 'Kimi VL',
    provider: 'Moonshot AI',
    cost: '약 20원/1천회 (한국 기준)',
    ocrAccuracy: 'good',
    freeTier: '¥15 크레딧 (신규 가입시)',
    signupUrl: 'https://platform.moonshot.cn/',
    pros: ['장문 OCR 강점', '중한영 다국어 지원', '빠른 응답 속도'],
  },
  none: {
    name: '오프라인 모드',
    provider: 'Local',
    cost: '완전 무료',
    ocrAccuracy: 'moderate',
    freeTier: '무제한',
    signupUrl: '',
    pros: ['인터넷 연결 불필요', '늘 사용 가능', '텍스트 패턴 인식'],
  },
};

/** 하위 호환성을 위한 기존 상수 */
export const AI_PROVIDER_LABELS: Record<AIProvider, string> = {
  gpt: AI_MODEL_INFO.gpt.name + ' (OpenAI)',
  gemini: AI_MODEL_INFO.gemini.name + ' (Google)',
  glm: AI_MODEL_INFO.glm.name + ' (ZhipuAI)',
  kimi: AI_MODEL_INFO.kimi.name + ' (Moonshot)',
  none: '사용 안 함 (오프라인)',
};

export const AI_PROVIDER_COST: Record<AIProvider, string> = {
  gpt: AI_MODEL_INFO.gpt.cost,
  gemini: AI_MODEL_INFO.gemini.cost,
  glm: AI_MODEL_INFO.glm.cost,
  kimi: AI_MODEL_INFO.kimi.cost,
  none: '무료',
};

export const AI_PROVIDER_URL: Record<AIProvider, string> = {
  gpt: AI_MODEL_INFO.gpt.signupUrl,
  gemini: AI_MODEL_INFO.gemini.signupUrl,
  glm: AI_MODEL_INFO.glm.signupUrl,
  kimi: AI_MODEL_INFO.kimi.signupUrl,
  none: '',
};

/** OCR 성능 순위 (가성비 + 정확도 기준) */
export const OCR_RECOMMENDATION_RANK: AIProvider[] = [
  'gemini',  // 무료 티어 넉넉 + OCR 우수
  'gpt',     // OCR 최고 성능, 합리적 가격
  'kimi',    // 가성비 좋음
  'glm',     // 가장 저렴
  'none',
];

/** 추천 모델 표시용 */
export function getRecommendationLabel(provider: AIProvider): string {
  switch (provider) {
    case 'gemini':
      return '🥇 최고 추천 (무료 티어 넉넉)';
    case 'gpt':
      return '🥈 OCR 정확도 최고';
    case 'kimi':
      return '🥉 가성비 우수';
    case 'glm':
      return '💰 가장 저렴';
    default:
      return '';
  }
}

const SETTING_PROVIDER_KEY = 'ai_ocr_provider';
const SETTING_API_KEY_PREFIX = 'ai_ocr_key_';

/** app_settings 테이블 초기화 */
async function ensureTable(): Promise<void> {
  const db = await getDatabase();
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
  `);
}

/** 현재 선택된 프로바이더 조회 */
export async function getAIProvider(): Promise<AIProvider> {
  await ensureTable();
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM app_settings WHERE key = ?',
    [SETTING_PROVIDER_KEY],
  );
  const val = row?.value;
  if (val === 'gpt' || val === 'gemini' || val === 'glm' || val === 'kimi') return val;
  return 'none';
}

/** 프로바이더 저장 */
export async function saveAIProvider(provider: AIProvider): Promise<void> {
  await ensureTable();
  const db = await getDatabase();
  await db.runAsync(
    'INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)',
    [SETTING_PROVIDER_KEY, provider],
  );
}

/** 특정 프로바이더의 API 키 조회 */
export async function getAPIKey(provider: AIProvider): Promise<string> {
  if (provider === 'none') return '';
  await ensureTable();
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM app_settings WHERE key = ?',
    [SETTING_API_KEY_PREFIX + provider],
  );
  return row?.value ?? '';
}

/** API 키 저장 */
export async function saveAPIKey(provider: AIProvider, apiKey: string): Promise<void> {
  if (provider === 'none') return;
  await ensureTable();
  const db = await getDatabase();
  await db.runAsync(
    'INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)',
    [SETTING_API_KEY_PREFIX + provider, apiKey.trim()],
  );
}

/** 현재 설정된 프로바이더 + 키 한번에 조회 */
export async function getAIConfig(): Promise<AIApiConfig> {
  const provider = await getAIProvider();
  const apiKey = await getAPIKey(provider);
  return { provider, apiKey };
}

/** API 키 유효성 검사 (기본 형식만) */
export function validateAPIKeyFormat(provider: AIProvider, key: string): boolean {
  if (provider === 'none') return true;
  if (!key || key.length < 10) return false;

  switch (provider) {
    case 'gpt':
      // sk-로 시작하는 일반 키 또는 프로젝트 키
      return key.startsWith('sk-') || key.startsWith('sk-proj-');
    case 'gemini':
      // Google AI Studio 키는 일반적으로 AIzaSy로 시작
      return key.startsWith('AIza');
    case 'glm':
      // ZhipuAI 키
      return key.length >= 20;
    case 'kimi':
      // Moonshot 키
      return key.startsWith('sk-') || key.length >= 20;
    default:
      return true;
  }
}
