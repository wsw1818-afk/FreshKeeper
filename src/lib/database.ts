import * as SQLite from 'expo-sqlite';
import { DB_NAME } from '@/constants/config';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const database = await SQLite.openDatabaseAsync(DB_NAME);
      await initializeDatabase(database);
      return database;
    })();
  }
  return dbPromise;
}

async function initializeDatabase(database: SQLite.SQLiteDatabase): Promise<void> {
  await database.execAsync(`PRAGMA journal_mode = WAL;`);
  await database.execAsync(`PRAGMA foreign_keys = ON;`);

  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS food_items (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      location TEXT NOT NULL,
      image_uri TEXT,

      quantity REAL NOT NULL DEFAULT 1,
      unit TEXT NOT NULL DEFAULT '개',

      added_at TEXT NOT NULL,
      date_type TEXT NOT NULL DEFAULT 'RECOMMENDED',
      expires_at TEXT,
      opened_at TEXT,
      thawed_at TEXT,
      location_changed_at TEXT,

      freshness_days INTEGER,
      freshness_days_after_open INTEGER,

      is_subdivided INTEGER NOT NULL DEFAULT 0,
      subdivide_count INTEGER,

      consumed_at TEXT,
      outcome TEXT,

      alert_offsets TEXT NOT NULL DEFAULT '[-3,-1,0,1]',
      alert_enabled INTEGER NOT NULL DEFAULT 1,

      memo TEXT,
      template_id TEXT,
      is_favorite INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS food_templates (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      name_en TEXT NOT NULL,
      icon TEXT NOT NULL,
      category TEXT NOT NULL,

      default_location TEXT NOT NULL,
      alternative_location TEXT,

      fridge_days_min INTEGER,
      fridge_days_max INTEGER,
      freezer_days_min INTEGER,
      freezer_days_max INTEGER,
      pantry_days_min INTEGER,
      pantry_days_max INTEGER,
      kimchi_fridge_days_min INTEGER,
      kimchi_fridge_days_max INTEGER,

      after_open_days INTEGER,
      after_thaw_days INTEGER,

      basis TEXT NOT NULL DEFAULT 'SAFETY',
      source_name TEXT NOT NULL,
      source_url TEXT NOT NULL,
      note TEXT,

      default_alert_offsets TEXT NOT NULL DEFAULT '[-3,-1,0,1]',
      inspection_interval_days INTEGER,

      sort_order INTEGER NOT NULL DEFAULT 0,
      is_popular INTEGER NOT NULL DEFAULT 0,

      usage_count INTEGER NOT NULL DEFAULT 0,
      last_used_at TEXT
    );
  `);

  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS notification_settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      summary_enabled INTEGER NOT NULL DEFAULT 1,
      summary_time TEXT NOT NULL DEFAULT '09:00',
      urgent_enabled INTEGER NOT NULL DEFAULT 1,
      quiet_hours_enabled INTEGER NOT NULL DEFAULT 1,
      quiet_hours_start TEXT NOT NULL DEFAULT '22:00',
      quiet_hours_end TEXT NOT NULL DEFAULT '08:00',
      expired_repeat_days INTEGER NOT NULL DEFAULT 3,
      default_alert_offsets TEXT NOT NULL DEFAULT '[-3,-1,0,1]'
    );
  `);

  // 사용자 정의 보관 장소 테이블
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS storage_locations (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      icon TEXT NOT NULL DEFAULT '📦',
      color TEXT NOT NULL DEFAULT '#2196F3',
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_default INTEGER NOT NULL DEFAULT 0,
      is_system INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS consumption_history (
      id TEXT PRIMARY KEY NOT NULL,
      food_item_id TEXT NOT NULL,
      food_name TEXT NOT NULL,
      category TEXT NOT NULL,
      outcome TEXT NOT NULL,
      d_day_at_outcome INTEGER NOT NULL,
      consumed_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  // 인덱스 생성
  await database.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_food_items_location ON food_items(location);
    CREATE INDEX IF NOT EXISTS idx_food_items_expires_at ON food_items(expires_at);
    CREATE INDEX IF NOT EXISTS idx_food_items_consumed_at ON food_items(consumed_at);
    CREATE INDEX IF NOT EXISTS idx_food_items_category ON food_items(category);
    CREATE INDEX IF NOT EXISTS idx_consumption_history_consumed_at ON consumption_history(consumed_at);
  `);

  // 기본 알림 설정 삽입 (이미 있으면 무시)
  await database.runAsync(
    `INSERT OR IGNORE INTO notification_settings (id) VALUES (1);`
  );

  // 기본 보관 장소 삽입 (시스템 기본값)
  const now = new Date().toISOString();
  const defaultLocations = [
    { id: 'FRIDGE', name: '냉장고', icon: '🧊', color: '#2196F3', sort_order: 1 },
    { id: 'FREEZER', name: '냉동고', icon: '❄️', color: '#03A9F4', sort_order: 2 },
    { id: 'PANTRY', name: '실온', icon: '🏠', color: '#FF9800', sort_order: 3 },
    { id: 'KIMCHI_FRIDGE', name: '김치냉', icon: '🫙', color: '#E91E63', sort_order: 4 },
  ];

  for (const loc of defaultLocations) {
    await database.runAsync(
      `INSERT OR IGNORE INTO storage_locations (id, name, icon, color, sort_order, is_default, is_system, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, 1, ?, ?);`,
      loc.id, loc.name, loc.icon, loc.color, loc.sort_order, now, now
    );
  }
}

export async function closeDatabase(): Promise<void> {
  if (dbPromise) {
    const db = await dbPromise;
    await db.closeAsync();
    dbPromise = null;
  }
}
