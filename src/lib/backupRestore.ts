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

/**
 * DB 전체를 JSON 파일로 내보냅니다.
 * 파일은 공유 시트를 통해 전달됩니다.
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

  if (!backup.version || !backup.food_items) {
    throw new Error('냉장고 지킴이 백업 파일이 아닙니다.');
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
