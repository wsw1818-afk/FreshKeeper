import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { getDatabase } from './database';
import { getToday, getNowISO } from './dateUtils';

interface BackupData {
  version: 1;
  created_at: string;
  food_items: Record<string, unknown>[];
  consumption_history: Record<string, unknown>[];
  notification_settings: Record<string, unknown> | null;
}

// 백업 import 검증 상수
const MAX_NAME_LENGTH = 200;
const MAX_MEMO_LENGTH = 2000;
const MAX_IMAGE_URI_LENGTH = 4096;
const MAX_ITEMS = 10_000;
const VALID_OUTCOMES = new Set(['EAT', 'DISCARD', 'SHARE']);
const VALID_DATE_TYPES = new Set(['RECOMMENDED', 'USE_BY', 'SELL_BY', 'BEST_BEFORE']);
const VALID_LOCATIONS = new Set(['FRIDGE', 'FREEZER', 'PANTRY', 'KIMCHI_FRIDGE']);

/** file://, content:// 이외 스킴 차단 (path traversal 방어) */
function isSafeImageUri(uri: unknown): boolean {
  if (uri === null || uri === undefined) return true;
  if (typeof uri !== 'string') return false;
  if (uri.length > MAX_IMAGE_URI_LENGTH) return false;
  // 앱 내부에서 생성한 URI만 허용
  return uri.startsWith('file://') || uri.startsWith('content://') || uri === '';
}

/** 백업 JSON의 food_items 배열 항목을 검증 */
function validateFoodItemRow(item: Record<string, unknown>, index: number): void {
  const ctx = `food_items[${index}]`;
  if (typeof item.id !== 'string' || item.id.length === 0 || item.id.length > 128) {
    throw new Error(`${ctx}: id가 올바르지 않습니다.`);
  }
  if (typeof item.name !== 'string' || item.name.length === 0 || item.name.length > MAX_NAME_LENGTH) {
    throw new Error(`${ctx}: 이름 형식이 올바르지 않습니다.`);
  }
  if (typeof item.category !== 'string' || item.category.length > 50) {
    throw new Error(`${ctx}: 카테고리 형식이 올바르지 않습니다.`);
  }
  if (typeof item.location !== 'string' || !VALID_LOCATIONS.has(item.location)) {
    throw new Error(`${ctx}: 보관 위치가 허용되지 않는 값입니다.`);
  }
  if (!isSafeImageUri(item.image_uri)) {
    throw new Error(`${ctx}: 이미지 경로가 허용되지 않는 형식입니다.`);
  }
  if (item.date_type !== null && item.date_type !== undefined && (typeof item.date_type !== 'string' || !VALID_DATE_TYPES.has(item.date_type))) {
    throw new Error(`${ctx}: 기한 유형이 허용되지 않는 값입니다.`);
  }
  if (item.outcome !== null && item.outcome !== undefined && (typeof item.outcome !== 'string' || !VALID_OUTCOMES.has(item.outcome))) {
    throw new Error(`${ctx}: 소비 결과가 허용되지 않는 값입니다.`);
  }
  if (item.quantity !== null && item.quantity !== undefined && (typeof item.quantity !== 'number' || !Number.isFinite(item.quantity) || item.quantity < 0)) {
    throw new Error(`${ctx}: 수량이 올바르지 않습니다.`);
  }
  if (item.memo !== null && item.memo !== undefined && (typeof item.memo !== 'string' || item.memo.length > MAX_MEMO_LENGTH)) {
    throw new Error(`${ctx}: 메모 길이가 허용 범위를 벗어났습니다.`);
  }
  // alert_offsets 는 JSON 문자열로 저장됨
  if (item.alert_offsets !== null && item.alert_offsets !== undefined && typeof item.alert_offsets !== 'string') {
    throw new Error(`${ctx}: 알림 오프셋 형식이 올바르지 않습니다.`);
  }
}

function validateHistoryRow(h: Record<string, unknown>, index: number): void {
  const ctx = `consumption_history[${index}]`;
  if (typeof h.id !== 'string' || typeof h.food_item_id !== 'string' || typeof h.food_name !== 'string') {
    throw new Error(`${ctx}: 이력 레코드 형식이 올바르지 않습니다.`);
  }
  if (typeof h.outcome !== 'string' || !VALID_OUTCOMES.has(h.outcome)) {
    throw new Error(`${ctx}: outcome 값이 허용되지 않습니다.`);
  }
  if (typeof h.d_day_at_outcome !== 'number' || !Number.isFinite(h.d_day_at_outcome)) {
    throw new Error(`${ctx}: d_day_at_outcome 형식이 올바르지 않습니다.`);
  }
}

/**
 * DB 전체를 JSON 파일로 내보냅니다.
 * 파일은 공유 시트를 통해 전달됩니다.
 *
 * ⚠️ 보안 정책(회귀 방지): 절대로 `app_settings` 테이블을 export에 포함하지 말 것.
 * AI OCR API 키가 저장되어 있어 백업 파일로 유출 시 제3자의 API 요금 도용 위험.
 * "전체 백업" 기능을 추가할 때도 반드시 app_settings는 제외.
 */
export async function exportBackup(): Promise<void> {
  const db = await getDatabase();

  const foodItems = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM food_items ORDER BY created_at`,
  );

  const history = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM consumption_history ORDER BY created_at`,
  );

  const settings = await db.getFirstAsync<Record<string, unknown>>(
    `SELECT * FROM notification_settings WHERE id = 1`,
  );

  const backup: BackupData = {
    version: 1,
    created_at: getNowISO(),
    food_items: foodItems,
    consumption_history: history,
    notification_settings: settings ?? null,
  };

  const json = JSON.stringify(backup, null, 2);
  const today = getToday().replace(/-/g, '');
  const fileName = `freshkeeper_backup_${today}.json`;

  const file = new File(Paths.cache, fileName);
  file.create({ overwrite: true });
  file.write(json);

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/json',
      dialogTitle: '냉장고 지킴이 백업 파일',
    });
  } else {
    throw new Error('이 기기에서는 파일 공유를 사용할 수 없습니다.');
  }
}

/**
 * JSON 백업 파일에서 데이터를 복원합니다.
 * 기존 데이터를 모두 삭제하고 백업 데이터로 교체합니다.
 */
export async function importBackup(): Promise<{ items: number; history: number }> {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'application/json',
    copyToCacheDirectory: true,
  });

  if (result.canceled || !result.assets?.[0]) {
    throw new Error('파일 선택이 취소되었습니다.');
  }

  const fileUri = result.assets[0].uri;
  const file = new File(fileUri);
  const content = await file.text();

  if (!content) {
    throw new Error('빈 파일입니다.');
  }

  let backup: BackupData;
  try {
    backup = JSON.parse(content);
  } catch {
    throw new Error('올바른 JSON 파일이 아닙니다.');
  }

  if (backup.version !== 1 || !Array.isArray(backup.food_items)) {
    throw new Error('냉장고 지킴이 백업 파일이 아닙니다.');
  }

  if (backup.food_items.length > MAX_ITEMS) {
    throw new Error(`식재료가 너무 많습니다 (최대 ${MAX_ITEMS}개).`);
  }

  // 전 필드 검증 (공격면: 악성 JSON → 내부 URI 주입, enum 변조, 메모리 고갈)
  backup.food_items.forEach((item, idx) => validateFoodItemRow(item, idx));

  if (backup.consumption_history !== null && backup.consumption_history !== undefined) {
    if (!Array.isArray(backup.consumption_history)) {
      throw new Error('백업 파일의 소비 이력 형식이 올바르지 않습니다.');
    }
    if (backup.consumption_history.length > MAX_ITEMS) {
      throw new Error('소비 이력이 너무 많습니다.');
    }
    backup.consumption_history.forEach((h, idx) => validateHistoryRow(h, idx));
  }

  const db = await getDatabase();

  // 트랜잭션으로 안전하게 복원
  await db.execAsync('BEGIN TRANSACTION');

  try {
    // 기존 데이터 삭제
    await db.execAsync('DELETE FROM consumption_history');
    await db.execAsync('DELETE FROM food_items');

    // 식재료 복원
    for (const item of backup.food_items) {
      await db.runAsync(
        `INSERT OR REPLACE INTO food_items (
          id, name, category, location, image_uri, quantity, unit,
          added_at, date_type, expires_at, opened_at, thawed_at, location_changed_at,
          freshness_days, freshness_days_after_open, is_subdivided, subdivide_count,
          consumed_at, outcome, alert_offsets, alert_enabled, memo, template_id,
          is_favorite, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        item.id as string, item.name as string, item.category as string,
        item.location as string, item.image_uri as string | null,
        item.quantity as number, item.unit as string,
        item.added_at as string, item.date_type as string,
        item.expires_at as string | null, item.opened_at as string | null,
        item.thawed_at as string | null, item.location_changed_at as string | null,
        item.freshness_days as number | null, item.freshness_days_after_open as number | null,
        item.is_subdivided as number, item.subdivide_count as number | null,
        item.consumed_at as string | null, item.outcome as string | null,
        item.alert_offsets as string, item.alert_enabled as number,
        item.memo as string | null, item.template_id as string | null,
        item.is_favorite as number, item.created_at as string, item.updated_at as string,
      );
    }

    // 소비 이력 복원
    for (const h of backup.consumption_history) {
      await db.runAsync(
        `INSERT OR REPLACE INTO consumption_history (
          id, food_item_id, food_name, category, outcome, d_day_at_outcome, consumed_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        h.id as string, h.food_item_id as string, h.food_name as string,
        h.category as string, h.outcome as string,
        h.d_day_at_outcome as number, h.consumed_at as string, h.created_at as string,
      );
    }

    // 알림 설정 복원
    if (backup.notification_settings) {
      const ns = backup.notification_settings;
      await db.runAsync(
        `UPDATE notification_settings SET
          summary_enabled = ?, summary_time = ?, urgent_enabled = ?,
          quiet_hours_enabled = ?, quiet_hours_start = ?, quiet_hours_end = ?,
          expired_repeat_days = ?, default_alert_offsets = ?
        WHERE id = 1`,
        ns.summary_enabled as number, ns.summary_time as string,
        ns.urgent_enabled as number, ns.quiet_hours_enabled as number,
        ns.quiet_hours_start as string, ns.quiet_hours_end as string,
        ns.expired_repeat_days as number, ns.default_alert_offsets as string,
      );
    }

    await db.execAsync('COMMIT');
  } catch (e) {
    await db.execAsync('ROLLBACK');
    throw e;
  }

  return {
    items: backup.food_items.length,
    history: backup.consumption_history.length,
  };
}
