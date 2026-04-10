/**
 * OCR Service — 유통기한·식재료명 이미지 인식
 * 지원 프로바이더: GPT-4o mini, Gemini 1.5 Flash, GLM-4V-Flash, Kimi Vision, Mock(오프라인)
 */

import { readAsStringAsync, EncodingType } from 'expo-file-system/legacy';
import type { AIProvider } from '@/lib/aiApiConfig';
import logger from '@/lib/logger';

export interface OCRResult {
  foodName: string | null;
  expiryDate: string | null;
  confidence: number;
  rawText?: string;
}

// ─── 날짜 패턴 ────────────────────────────────────────────────────────────────

const DATE_PATTERNS = [
  /(\d{4})[.\-\/](\d{1,2})[.\-\/](\d{1,2})/g,
  /(\d{2})[.\-\/](\d{1,2})[.\-\/](\d{1,2})/g,
  /(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/g,
  /(\d{2})년\s*(\d{1,2})월\s*(\d{1,2})일/g,
  /(?:유통기한|소비기한|까지|EXP|EXP\.?|EXPIRY|BEST BEFORE)[\s:：]*(\d{4})[.\-\/](\d{1,2})[.\-\/](\d{1,2})/gi,
  /(?:유통기한|소비기한|까지|EXP|EXP\.?|EXPIRY|BEST BEFORE)[\s:：]*(\d{2})[.\-\/](\d{1,2})[.\-\/](\d{1,2})/gi,
];

const FOOD_KEYWORDS: Record<string, string[]> = {
  DAIRY: ['우유', '요거트', '치즈', '버터', '크림', '마가린', '연유', '분유'],
  MEAT: ['소고기', '돼지고기', '양고기', '쇠고기', '한우', '소시지', '햄', '베이컨', '스테이크'],
  POULTRY: ['닭고기', '닭', '오리고기', '오리', '훈제오리', '치킨'],
  SEAFOOD: ['생선', '연어', '참치', '고등어', '갈치', '새우', '게', '문어', '오징어', '조개'],
  VEGETABLE: ['배추', '양파', '마늘', '당근', '무', '오이', '가지', '피망', '브로콜리', '시금치'],
  FRUIT: ['사과', '바나나', '오렌지', '딸기', '포도', '수박', '참외', '복숭아', '배'],
  SAUCE: ['간장', '된장', '고추장', '케찹', '마요네즈', '소스', '드레싱', '식초'],
  BEVERAGE: ['쥬스', '주스', '콜라', '사이다', '물', '커피', '차', '음료'],
  PROCESSED: ['라면', '과자', '빵', '시리얼', '통조림', '햄버거', '피자'],
  OTHERS: [],
};

// ─── 텍스트 파싱 유틸 ─────────────────────────────────────────────────────────

export function extractExpiryDate(text: string): string | null {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  for (const pattern of DATE_PATTERNS) {
    const matches = [...cleaned.matchAll(pattern)];
    for (const match of matches) {
      let year = match[1];
      const month = parseInt(match[2], 10);
      const day = parseInt(match[3], 10);
      if (month < 1 || month > 12 || day < 1 || day > 31) continue;
      if (year.length === 2) {
        const y = parseInt(year, 10);
        year = y >= 50 ? `19${year}` : `20${year}`;
      }
      return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    }
  }
  return null;
}

export function extractFoodName(text: string): { name: string | null; category: string | null } {
  const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
  let candidateName: string | null = null;
  for (const line of lines) {
    if (/^\d{2,4}[.\-\/년]/.test(line)) continue;
    if (line.length < 2 || line.length > 30) continue;
    if (/^[0-9\s]+$/.test(line)) continue;
    if (/^(유통기한|소비기한|원재료|제조원|유통기|내용량|중량|가격|할인)/.test(line)) continue;
    if (!candidateName) { candidateName = line; break; }
  }
  let category: string | null = null;
  if (candidateName) {
    for (const [cat, keywords] of Object.entries(FOOD_KEYWORDS)) {
      for (const kw of keywords) {
        if (candidateName.includes(kw)) { category = cat; break; }
      }
      if (category) break;
    }
  }
  return { name: candidateName, category };
}

// ─── 이미지 → base64 ──────────────────────────────────────────────────────────

async function toBase64(imageUri: string): Promise<string> {
  return readAsStringAsync(imageUri, { encoding: EncodingType.Base64 });
}

// ─── OCR 프롬프트 ─────────────────────────────────────────────────────────────

const OCR_PROMPT = `이 이미지에서 다음 정보를 추출해주세요:
1. 식품명 (product name in Korean)
2. 유통기한 또는 소비기한 (expiry date)

다음 JSON 형식으로만 응답해주세요:
{"foodName": "식품명", "expiryDate": "YYYY-MM-DD", "rawText": "이미지 전체 텍스트"}

날짜를 찾을 수 없으면 null, 식품명을 찾을 수 없으면 null로 표기하세요.`;

// ─── 타임아웃 fetch 헬퍼 ──────────────────────────────────────────────────────

const API_TIMEOUT_MS = 15_000;

async function fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('API 요청 시간 초과 (15초). 네트워크 연결을 확인해주세요.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

// ─── GPT-4o mini ──────────────────────────────────────────────────────────────

async function callGPT(imageUri: string, apiKey: string): Promise<OCRResult> {
  const base64 = await toBase64(imageUri);
  const response = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 256,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: OCR_PROMPT },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}`, detail: 'low' } },
          ],
        },
      ],
    }),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`GPT API 오류 (${response.status}): ${err.slice(0, 200)}`);
  }
  const data = await response.json();
  return parseAIResponse(data.choices?.[0]?.message?.content ?? '');
}

// ─── Gemini 1.5 Flash ─────────────────────────────────────────────────────────

async function callGemini(imageUri: string, apiKey: string): Promise<OCRResult> {
  const base64 = await toBase64(imageUri);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: OCR_PROMPT },
            { inline_data: { mime_type: 'image/jpeg', data: base64 } },
          ],
        },
      ],
      generationConfig: { maxOutputTokens: 256 },
    }),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API 오류 (${response.status}): ${err.slice(0, 200)}`);
  }
  const data = await response.json();
  const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  return parseAIResponse(text);
}

// ─── GLM-4V-Flash (ZhipuAI) ───────────────────────────────────────────────────

async function callGLM(imageUri: string, apiKey: string): Promise<OCRResult> {
  const base64 = await toBase64(imageUri);
  const response = await fetchWithTimeout('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'glm-4v-flash',
      max_tokens: 256,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: OCR_PROMPT },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } },
          ],
        },
      ],
    }),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`GLM API 오류 (${response.status}): ${err.slice(0, 200)}`);
  }
  const data = await response.json();
  return parseAIResponse(data.choices?.[0]?.message?.content ?? '');
}

// ─── Kimi Vision (Moonshot) ───────────────────────────────────────────────────

async function callKimi(imageUri: string, apiKey: string): Promise<OCRResult> {
  const base64 = await toBase64(imageUri);
  const response = await fetchWithTimeout('https://api.moonshot.cn/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'moonshot-v1-8k-vision-preview',
      max_tokens: 256,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: OCR_PROMPT },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } },
          ],
        },
      ],
    }),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Kimi API 오류 (${response.status}): ${err.slice(0, 200)}`);
  }
  const data = await response.json();
  return parseAIResponse(data.choices?.[0]?.message?.content ?? '');
}

// ─── AI 응답 파싱 ──────────────────────────────────────────────────────────────

function parseAIResponse(content: string): OCRResult {
  try {
    // JSON 블록 추출 (```json ... ``` 또는 { ... } 형식)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const rawText: string = parsed.rawText ?? content;
      // 날짜는 AI 응답 우선, 실패하면 rawText에서 재파싱
      const expiryDate: string | null =
        parsed.expiryDate && /^\d{4}-\d{2}-\d{2}$/.test(parsed.expiryDate)
          ? parsed.expiryDate
          : extractExpiryDate(rawText);
      const foodName: string | null = parsed.foodName || extractFoodName(rawText).name;
      return {
        foodName,
        expiryDate,
        confidence: (foodName ? 0.5 : 0) + (expiryDate ? 0.5 : 0),
        rawText,
      };
    }
  } catch {
    // JSON 파싱 실패 → 텍스트에서 직접 추출
  }
  const expiryDate = extractExpiryDate(content);
  const { name: foodName } = extractFoodName(content);
  return {
    foodName,
    expiryDate,
    confidence: (foodName ? 0.4 : 0) + (expiryDate ? 0.4 : 0),
    rawText: content,
  };
}

// ─── Mock OCR (오프라인 테스트용) ─────────────────────────────────────────────

export function processTextWithMockOCR(text: string): OCRResult {
  const expiryDate = extractExpiryDate(text);
  const { name } = extractFoodName(text);
  return {
    foodName: name,
    expiryDate,
    confidence: (expiryDate ? 0.5 : 0) + (name ? 0.5 : 0),
  };
}

// ─── 메인 진입점 ──────────────────────────────────────────────────────────────

/**
 * 이미지 OCR 처리
 * @param imageUri  로컬 이미지 URI
 * @param provider  AI 프로바이더 (기본 'none' = Mock)
 * @param apiKey    해당 프로바이더 API 키
 */
export async function processImageWithOCR(
  imageUri: string,
  provider: AIProvider = 'none',
  apiKey = '',
): Promise<OCRResult> {
  if (!imageUri) return { foodName: null, expiryDate: null, confidence: 0 };

  try {
    switch (provider) {
      case 'gpt':
        return await callGPT(imageUri, apiKey);
      case 'gemini':
        return await callGemini(imageUri, apiKey);
      case 'glm':
        return await callGLM(imageUri, apiKey);
      case 'kimi':
        return await callKimi(imageUri, apiKey);
      default:
        // Mock: 실제 이미지를 분석하지 않고 빈 결과 반환
        return { foodName: null, expiryDate: null, confidence: 0 };
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error('OCR 오류:', msg);
    throw error; // 호출부에서 사용자에게 에러 표시
  }
}
