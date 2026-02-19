import { v4 as uuidv4 } from 'uuid';
import type { SQLiteBindValue } from 'expo-sqlite';
import { getDatabase } from './database';
import { getNowISO, getToday } from './dateUtils';
import type { FoodItem, FoodTemplate, NotificationSettings, ConsumptionHistory } from '@/types';
import { FOOD_TEMPLATES } from '@/data/templates';

// === JSON helpers ===

function parseJsonArray(json: string | null): number[] {
  if (!json) return [];
  try {
    return JSON.parse(json);
  } catch {
    return [];
  }
}

function toBoolean(val: number | null): boolean {
  return val === 1;
}

function fromBoolean(val: boolean): number {
  return val ? 1 : 0;
}

// === Row → Interface mappers ===

function rowToFoodItem(row: Record<string, unknown>): FoodItem {
  return {
    id: row.id as string,
    name: row.name as string,
    category: row.category as FoodItem['category'],
    location: row.location as FoodItem['location'],
    image_uri: row.image_uri as string | null,
    quantity: row.quantity as number,
    unit: row.unit as string,
    added_at: row.added_at as string,
    date_type: row.date_type as FoodItem['date_type'],
    expires_at: row.expires_at as string | null,
    opened_at: row.opened_at as string | null,
    thawed_at: row.thawed_at as string | null,
    location_changed_at: row.location_changed_at as string | null,
    freshness_days: row.freshness_days as number | null,
    freshness_days_after_open: row.freshness_days_after_open as number | null,
    is_subdivided: toBoolean(row.is_subdivided as number),
    subdivide_count: row.subdivide_count as number | null,
    consumed_at: row.consumed_at as string | null,
    outcome: row.outcome as FoodItem['outcome'],
    alert_offsets: parseJsonArray(row.alert_offsets as string),
    alert_enabled: toBoolean(row.alert_enabled as number),
    memo: row.memo as string | null,
    template_id: row.template_id as string | null,
    is_favorite: toBoolean(row.is_favorite as number),
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

// === FoodItem CRUD ===

export async function insertFoodItem(item: Omit<FoodItem, 'id' | 'created_at' | 'updated_at'>): Promise<FoodItem> {
  const db = await getDatabase();
  const id = uuidv4();
  const now = getNowISO();

  await db.runAsync(
    `INSERT INTO food_items (
      id, name, category, location, image_uri,
      quantity, unit,
      added_at, date_type, expires_at, opened_at, thawed_at, location_changed_at,
      freshness_days, freshness_days_after_open,
      is_subdivided, subdivide_count,
      consumed_at, outcome,
      alert_offsets, alert_enabled,
      memo, template_id, is_favorite,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    item.name,
    item.category,
    item.location,
    item.image_uri,
    item.quantity,
    item.unit,
    item.added_at,
    item.date_type,
    item.expires_at,
    item.opened_at,
    item.thawed_at,
    item.location_changed_at,
    item.freshness_days,
    item.freshness_days_after_open,
    fromBoolean(item.is_subdivided),
    item.subdivide_count,
    item.consumed_at,
    item.outcome,
    JSON.stringify(item.alert_offsets),
    fromBoolean(item.alert_enabled),
    item.memo,
    item.template_id,
    fromBoolean(item.is_favorite),
    now,
    now,
  );

  return { ...item, id, created_at: now, updated_at: now };
}

export async function updateFoodItem(id: string, updates: Partial<FoodItem>): Promise<void> {
  const db = await getDatabase();
  const now = getNowISO();

  const fields: string[] = [];
  const values: SQLiteBindValue[] = [];

  const boolFields = new Set(['is_subdivided', 'alert_enabled', 'is_favorite']);
  const jsonFields = new Set(['alert_offsets']);
  const allowedFields = new Set([
    'name', 'category', 'location', 'image_uri',
    'quantity', 'unit', 'added_at', 'date_type',
    'expires_at', 'opened_at', 'thawed_at', 'location_changed_at',
    'freshness_days', 'freshness_days_after_open',
    'is_subdivided', 'subdivide_count', 'consumed_at', 'outcome',
    'alert_offsets', 'alert_enabled', 'memo', 'template_id', 'is_favorite',
  ]);

  for (const key of Object.keys(updates)) {
    if (!allowedFields.has(key)) continue;
    const rawVal = (updates as Record<string, unknown>)[key];
    let val: SQLiteBindValue;
    if (boolFields.has(key)) {
      val = fromBoolean(rawVal as boolean);
    } else if (jsonFields.has(key)) {
      val = JSON.stringify(rawVal);
    } else {
      val = rawVal as SQLiteBindValue;
    }
    fields.push(`${key} = ?`);
    values.push(val);
  }

  if (fields.length === 0) return;

  fields.push('updated_at = ?');
  values.push(now);
  values.push(id);

  await db.runAsync(
    `UPDATE food_items SET ${fields.join(', ')} WHERE id = ?`,
    ...values,
  );
}

export async function deleteFoodItem(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`DELETE FROM food_items WHERE id = ?`, id);
}

export async function getFoodItemById(id: string): Promise<FoodItem | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<Record<string, unknown>>(
    `SELECT * FROM food_items WHERE id = ?`,
    id,
  );
  return row ? rowToFoodItem(row) : null;
}

export async function getActiveFoodItems(): Promise<FoodItem[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM food_items WHERE consumed_at IS NULL ORDER BY expires_at ASC`,
  );
  return rows.map(rowToFoodItem);
}

export async function getFoodItemsByLocation(location: string): Promise<FoodItem[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM food_items WHERE consumed_at IS NULL AND location = ? ORDER BY expires_at ASC`,
    location,
  );
  return rows.map(rowToFoodItem);
}

export async function searchFoodItems(query: string): Promise<FoodItem[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM food_items WHERE consumed_at IS NULL AND name LIKE ? ORDER BY expires_at ASC`,
    `%${query}%`,
  );
  return rows.map(rowToFoodItem);
}

// === FoodTemplate ===

export async function seedTemplates(): Promise<void> {
  const db = await getDatabase();

  const count = await db.getFirstAsync<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM food_templates`,
  );
  if (count && count.cnt > 0) return; // 이미 시딩 완료

  for (const t of FOOD_TEMPLATES) {
    await db.runAsync(
      `INSERT INTO food_templates (
        id, name, name_en, icon, category,
        default_location, alternative_location,
        fridge_days_min, fridge_days_max,
        freezer_days_min, freezer_days_max,
        pantry_days_min, pantry_days_max,
        kimchi_fridge_days_min, kimchi_fridge_days_max,
        after_open_days, after_thaw_days,
        basis, source_name, source_url, note,
        default_alert_offsets, inspection_interval_days,
        sort_order, is_popular
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      t.id, t.name, t.name_en, t.icon, t.category,
      t.default_location, t.alternative_location,
      t.fridge_days_min, t.fridge_days_max,
      t.freezer_days_min, t.freezer_days_max,
      t.pantry_days_min, t.pantry_days_max,
      t.kimchi_fridge_days_min, t.kimchi_fridge_days_max,
      t.after_open_days, t.after_thaw_days,
      t.basis, t.source_name, t.source_url, t.note,
      JSON.stringify(t.default_alert_offsets), t.inspection_interval_days,
      t.sort_order, fromBoolean(t.is_popular),
    );
  }
}

export async function getAllTemplates(): Promise<FoodTemplate[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM food_templates ORDER BY
      CASE WHEN usage_count > 0 THEN 0 ELSE 1 END,
      usage_count DESC,
      sort_order ASC`,
  );
  return rows.map(row => ({
    id: row.id as string,
    name: row.name as string,
    name_en: row.name_en as string,
    icon: row.icon as string,
    category: row.category as FoodTemplate['category'],
    default_location: row.default_location as FoodTemplate['default_location'],
    alternative_location: row.alternative_location as FoodTemplate['alternative_location'],
    fridge_days_min: row.fridge_days_min as number | null,
    fridge_days_max: row.fridge_days_max as number | null,
    freezer_days_min: row.freezer_days_min as number | null,
    freezer_days_max: row.freezer_days_max as number | null,
    pantry_days_min: row.pantry_days_min as number | null,
    pantry_days_max: row.pantry_days_max as number | null,
    kimchi_fridge_days_min: row.kimchi_fridge_days_min as number | null,
    kimchi_fridge_days_max: row.kimchi_fridge_days_max as number | null,
    after_open_days: row.after_open_days as number | null,
    after_thaw_days: row.after_thaw_days as number | null,
    basis: row.basis as FoodTemplate['basis'],
    source_name: row.source_name as string,
    source_url: row.source_url as string,
    note: row.note as string | null,
    default_alert_offsets: parseJsonArray(row.default_alert_offsets as string),
    inspection_interval_days: row.inspection_interval_days as number | null,
    sort_order: row.sort_order as number,
    is_popular: toBoolean(row.is_popular as number),
  }));
}

export async function incrementTemplateUsage(templateId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE food_templates SET usage_count = usage_count + 1, last_used_at = ? WHERE id = ?`,
    getNowISO(),
    templateId,
  );
}

// === NotificationSettings ===

export async function getNotificationSettings(): Promise<NotificationSettings> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<Record<string, unknown>>(
    `SELECT * FROM notification_settings WHERE id = 1`,
  );
  if (!row) {
    return {
      summary_enabled: true,
      summary_time: '09:00',
      urgent_enabled: true,
      quiet_hours_enabled: true,
      quiet_hours_start: '22:00',
      quiet_hours_end: '08:00',
      expired_repeat_days: 3,
      default_alert_offsets: [-3, -1, 0, 1],
    };
  }
  return {
    summary_enabled: toBoolean(row.summary_enabled as number),
    summary_time: row.summary_time as string,
    urgent_enabled: toBoolean(row.urgent_enabled as number),
    quiet_hours_enabled: toBoolean(row.quiet_hours_enabled as number),
    quiet_hours_start: row.quiet_hours_start as string,
    quiet_hours_end: row.quiet_hours_end as string,
    expired_repeat_days: row.expired_repeat_days as number,
    default_alert_offsets: parseJsonArray(row.default_alert_offsets as string),
  };
}

export async function updateNotificationSettings(settings: Partial<NotificationSettings>): Promise<void> {
  const db = await getDatabase();
  const fields: string[] = [];
  const values: SQLiteBindValue[] = [];

  if (settings.summary_enabled !== undefined) { fields.push('summary_enabled = ?'); values.push(fromBoolean(settings.summary_enabled)); }
  if (settings.summary_time !== undefined) { fields.push('summary_time = ?'); values.push(settings.summary_time); }
  if (settings.urgent_enabled !== undefined) { fields.push('urgent_enabled = ?'); values.push(fromBoolean(settings.urgent_enabled)); }
  if (settings.quiet_hours_enabled !== undefined) { fields.push('quiet_hours_enabled = ?'); values.push(fromBoolean(settings.quiet_hours_enabled)); }
  if (settings.quiet_hours_start !== undefined) { fields.push('quiet_hours_start = ?'); values.push(settings.quiet_hours_start); }
  if (settings.quiet_hours_end !== undefined) { fields.push('quiet_hours_end = ?'); values.push(settings.quiet_hours_end); }
  if (settings.expired_repeat_days !== undefined) { fields.push('expired_repeat_days = ?'); values.push(settings.expired_repeat_days); }
  if (settings.default_alert_offsets !== undefined) { fields.push('default_alert_offsets = ?'); values.push(JSON.stringify(settings.default_alert_offsets)); }

  if (fields.length === 0) return;

  await db.runAsync(
    `UPDATE notification_settings SET ${fields.join(', ')} WHERE id = 1`,
    ...values,
  );
}

// === ConsumptionHistory ===

export async function addConsumptionHistory(entry: Omit<ConsumptionHistory, 'id' | 'created_at'>): Promise<void> {
  const db = await getDatabase();
  const id = uuidv4();
  const now = getNowISO();

  await db.runAsync(
    `INSERT INTO consumption_history (id, food_item_id, food_name, category, outcome, d_day_at_outcome, consumed_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    id, entry.food_item_id, entry.food_name, entry.category,
    entry.outcome, entry.d_day_at_outcome, entry.consumed_at, now,
  );
}

export async function getConsumptionHistory(limit: number = 50): Promise<ConsumptionHistory[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM consumption_history ORDER BY consumed_at DESC LIMIT ?`,
    limit,
  );
  return rows.map(row => ({
    id: row.id as string,
    food_item_id: row.food_item_id as string,
    food_name: row.food_name as string,
    category: row.category as ConsumptionHistory['category'],
    outcome: row.outcome as ConsumptionHistory['outcome'],
    d_day_at_outcome: row.d_day_at_outcome as number,
    consumed_at: row.consumed_at as string,
    created_at: row.created_at as string,
  }));
}

// === Statistics helpers ===

export async function getItemCountByStatus(): Promise<{ location: string; count: number }[]> {
  const db = await getDatabase();
  return db.getAllAsync<{ location: string; count: number }>(
    `SELECT location, COUNT(*) as count FROM food_items WHERE consumed_at IS NULL GROUP BY location`,
  );
}

export async function getExpiringItemsCount(withinDays: number): Promise<number> {
  const db = await getDatabase();
  const today = getToday();
  const result = await db.getFirstAsync<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM food_items
     WHERE consumed_at IS NULL
       AND expires_at IS NOT NULL
       AND expires_at <= date(?, '+' || ? || ' days')
       AND expires_at >= ?`,
    today, withinDays, today,
  );
  return result?.cnt ?? 0;
}

// === 소비 이력 통계 ===

export interface OutcomeStats {
  eat: number;
  discard: number;
  share: number;
  total: number;
}

export interface CategoryOutcomeStats {
  category: string;
  eat: number;
  discard: number;
  share: number;
}

export interface MonthlyStats {
  month: string; // YYYY-MM
  eat: number;
  discard: number;
  share: number;
}

export async function getOutcomeStats(): Promise<OutcomeStats> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ outcome: string; cnt: number }>(
    `SELECT outcome, COUNT(*) as cnt FROM consumption_history GROUP BY outcome`,
  );
  const stats: OutcomeStats = { eat: 0, discard: 0, share: 0, total: 0 };
  for (const row of rows) {
    if (row.outcome === 'EAT') stats.eat = row.cnt;
    else if (row.outcome === 'DISCARD') stats.discard = row.cnt;
    else if (row.outcome === 'SHARE') stats.share = row.cnt;
    stats.total += row.cnt;
  }
  return stats;
}

export async function getCategoryOutcomeStats(): Promise<CategoryOutcomeStats[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ category: string; outcome: string; cnt: number }>(
    `SELECT category, outcome, COUNT(*) as cnt FROM consumption_history GROUP BY category, outcome ORDER BY category`,
  );
  const map = new Map<string, CategoryOutcomeStats>();
  for (const row of rows) {
    if (!map.has(row.category)) {
      map.set(row.category, { category: row.category, eat: 0, discard: 0, share: 0 });
    }
    const entry = map.get(row.category)!;
    if (row.outcome === 'EAT') entry.eat = row.cnt;
    else if (row.outcome === 'DISCARD') entry.discard = row.cnt;
    else if (row.outcome === 'SHARE') entry.share = row.cnt;
  }
  return Array.from(map.values());
}

export async function getMonthlyStats(months: number = 6): Promise<MonthlyStats[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ month: string; outcome: string; cnt: number }>(
    `SELECT substr(consumed_at, 1, 7) as month, outcome, COUNT(*) as cnt
     FROM consumption_history
     WHERE consumed_at >= date('now', '-' || ? || ' months')
     GROUP BY month, outcome
     ORDER BY month`,
    months,
  );
  const map = new Map<string, MonthlyStats>();
  for (const row of rows) {
    if (!map.has(row.month)) {
      map.set(row.month, { month: row.month, eat: 0, discard: 0, share: 0 });
    }
    const entry = map.get(row.month)!;
    if (row.outcome === 'EAT') entry.eat = row.cnt;
    else if (row.outcome === 'DISCARD') entry.discard = row.cnt;
    else if (row.outcome === 'SHARE') entry.share = row.cnt;
  }
  return Array.from(map.values());
}

export async function getAvgDDayAtOutcome(): Promise<{ outcome: string; avg_dday: number }[]> {
  const db = await getDatabase();
  return db.getAllAsync<{ outcome: string; avg_dday: number }>(
    `SELECT outcome, AVG(d_day_at_outcome) as avg_dday FROM consumption_history GROUP BY outcome`,
  );
}

// === 소비 패턴 분석 (DATA-001) ===

export interface TopFoodItem {
  food_name: string;
  count: number;
}

/** 자주 버리는 식재료 TOP N */
export async function getTopDiscardedItems(limit: number = 5): Promise<TopFoodItem[]> {
  const db = await getDatabase();
  return db.getAllAsync<TopFoodItem>(
    `SELECT food_name, COUNT(*) as count FROM consumption_history
     WHERE outcome = 'DISCARD'
     GROUP BY food_name ORDER BY count DESC LIMIT ?`,
    limit,
  );
}

/** 자주 소비하는 식재료 TOP N */
export async function getTopConsumedItems(limit: number = 5): Promise<TopFoodItem[]> {
  const db = await getDatabase();
  return db.getAllAsync<TopFoodItem>(
    `SELECT food_name, COUNT(*) as count FROM consumption_history
     WHERE outcome = 'EAT'
     GROUP BY food_name ORDER BY count DESC LIMIT ?`,
    limit,
  );
}

/** 카테고리별 폐기율 (높은 순) */
export async function getCategoryDiscardRate(): Promise<{ category: string; total: number; discard: number; rate: number }[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ category: string; outcome: string; cnt: number }>(
    `SELECT category, outcome, COUNT(*) as cnt FROM consumption_history GROUP BY category, outcome`,
  );

  const map = new Map<string, { total: number; discard: number }>();
  for (const row of rows) {
    if (!map.has(row.category)) map.set(row.category, { total: 0, discard: 0 });
    const entry = map.get(row.category)!;
    entry.total += row.cnt;
    if (row.outcome === 'DISCARD') entry.discard += row.cnt;
  }

  return Array.from(map.entries())
    .map(([category, v]) => ({
      category,
      total: v.total,
      discard: v.discard,
      rate: v.total > 0 ? Math.round((v.discard / v.total) * 100) : 0,
    }))
    .filter((v) => v.total >= 2)
    .sort((a, b) => b.rate - a.rate);
}
