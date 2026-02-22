// === Enums ===

export enum StorageLocation {
  FRIDGE = 'FRIDGE',
  FREEZER = 'FREEZER',
  PANTRY = 'PANTRY',
  KIMCHI_FRIDGE = 'KIMCHI_FRIDGE',
}

export enum FoodCategory {
  DAIRY = 'DAIRY',
  MEAT = 'MEAT',
  POULTRY = 'POULTRY',
  SEAFOOD = 'SEAFOOD',
  VEGETABLE = 'VEGETABLE',
  FRUIT = 'FRUIT',
  COOKED = 'COOKED',
  SIDE_DISH = 'SIDE_DISH',
  FERMENTED = 'FERMENTED',
  FROZEN_FOOD = 'FROZEN_FOOD',
  BEVERAGE = 'BEVERAGE',
  SAUCE = 'SAUCE',
  GRAIN = 'GRAIN',
  BREAD = 'BREAD',
  PROCESSED = 'PROCESSED',
  OTHERS = 'OTHERS',
}

export enum DateType {
  USE_BY = 'USE_BY',
  SELL_BY = 'SELL_BY',
  BEST_BEFORE = 'BEST_BEFORE',
  RECOMMENDED = 'RECOMMENDED',
}

export enum Outcome {
  EAT = 'EAT',
  DISCARD = 'DISCARD',
  SHARE = 'SHARE',
}

export enum DerivedStatus {
  SAFE = 'SAFE',
  WARN = 'WARN',
  DANGER = 'DANGER',
  EXPIRED = 'EXPIRED',
  LONG_TERM = 'LONG_TERM',
  CHECK_NEEDED = 'CHECK_NEEDED',
}

// === Interfaces ===

export interface FoodItem {
  id: string;
  name: string;
  category: FoodCategory;
  location: StorageLocation | string; // 시스템 냉장고(StorageLocation) + 사용자 정의 냉장고(string ID)
  image_uri: string | null;

  quantity: number;
  unit: string;

  added_at: string; // YYYY-MM-DD
  date_type: DateType;
  expires_at: string | null;
  opened_at: string | null;
  thawed_at: string | null;
  location_changed_at: string | null;

  freshness_days: number | null;
  freshness_days_after_open: number | null;

  is_subdivided: boolean;
  subdivide_count: number | null;

  consumed_at: string | null;
  outcome: Outcome | null;

  alert_offsets: number[];
  alert_enabled: boolean;

  memo: string | null;
  template_id: string | null;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
}

export interface FoodTemplate {
  id: string;
  name: string;
  name_en: string;
  icon: string;
  category: FoodCategory;

  default_location: StorageLocation;
  alternative_location: StorageLocation | null;

  fridge_days_min: number | null;
  fridge_days_max: number | null;
  freezer_days_min: number | null;
  freezer_days_max: number | null;
  pantry_days_min: number | null;
  pantry_days_max: number | null;
  kimchi_fridge_days_min: number | null;
  kimchi_fridge_days_max: number | null;

  after_open_days: number | null;
  after_thaw_days: number | null;

  basis: 'SAFETY' | 'QUALITY' | 'BOTH';
  source_name: string;
  source_url: string;
  note: string | null;

  default_alert_offsets: number[];
  inspection_interval_days: number | null;

  sort_order: number;
  is_popular: boolean;
}

export interface NotificationSettings {
  summary_enabled: boolean;
  summary_time: string; // HH:mm
  urgent_enabled: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string; // HH:mm
  quiet_hours_end: string;   // HH:mm
  expired_repeat_days: number;
  default_alert_offsets: number[];
}

export interface ConsumptionHistory {
  id: string;
  food_item_id: string;
  food_name: string;
  category: FoodCategory;
  outcome: Outcome;
  d_day_at_outcome: number;
  consumed_at: string;
  created_at: string;
}

export interface StorageLocationItem {
  id: string;
  name: string;
  icon: string;
  color: string;
  sort_order: number;
  is_default: boolean;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

// === Display helpers ===

export const STORAGE_LOCATION_LABEL: Record<string, string> = {
  [StorageLocation.FRIDGE]: '냉장고',
  [StorageLocation.FREEZER]: '냉동고',
  [StorageLocation.PANTRY]: '실온',
  [StorageLocation.KIMCHI_FRIDGE]: '김치냉장고',
};

export const STORAGE_LOCATION_ICON: Record<string, string> = {
  [StorageLocation.FRIDGE]: '❄️',
  [StorageLocation.FREEZER]: '🧊',
  [StorageLocation.PANTRY]: '🏠',
  [StorageLocation.KIMCHI_FRIDGE]: '🥬',
};

export const FOOD_CATEGORY_LABEL: Record<FoodCategory, string> = {
  [FoodCategory.DAIRY]: '유제품/알류',
  [FoodCategory.MEAT]: '정육류',
  [FoodCategory.POULTRY]: '가금류',
  [FoodCategory.SEAFOOD]: '해산물',
  [FoodCategory.VEGETABLE]: '채소',
  [FoodCategory.FRUIT]: '과일',
  [FoodCategory.COOKED]: '조리식품',
  [FoodCategory.SIDE_DISH]: '밑반찬',
  [FoodCategory.FERMENTED]: '발효식품',
  [FoodCategory.FROZEN_FOOD]: '냉동식품',
  [FoodCategory.BEVERAGE]: '음료',
  [FoodCategory.SAUCE]: '소스/양념',
  [FoodCategory.GRAIN]: '곡류/견과류',
  [FoodCategory.BREAD]: '빵/베이커리',
  [FoodCategory.PROCESSED]: '가공식품',
  [FoodCategory.OTHERS]: '기타',
};

export const FOOD_CATEGORY_EMOJI: Record<FoodCategory, string> = {
  [FoodCategory.DAIRY]: '🥛',
  [FoodCategory.MEAT]: '🥩',
  [FoodCategory.POULTRY]: '🍗',
  [FoodCategory.SEAFOOD]: '🦐',
  [FoodCategory.VEGETABLE]: '🥬',
  [FoodCategory.FRUIT]: '🍎',
  [FoodCategory.COOKED]: '🍱',
  [FoodCategory.SIDE_DISH]: '🥗',
  [FoodCategory.FERMENTED]: '🫙',
  [FoodCategory.FROZEN_FOOD]: '🧊',
  [FoodCategory.BEVERAGE]: '🥤',
  [FoodCategory.SAUCE]: '🧴',
  [FoodCategory.GRAIN]: '🌾',
  [FoodCategory.BREAD]: '🍞',
  [FoodCategory.PROCESSED]: '🥫',
  [FoodCategory.OTHERS]: '🍽️',
};

export const DATE_TYPE_LABEL: Record<DateType, string> = {
  [DateType.USE_BY]: '소비기한',
  [DateType.SELL_BY]: '유통기한',
  [DateType.BEST_BEFORE]: '품질유지기한',
  [DateType.RECOMMENDED]: '권장 소비기한',
};

export const OUTCOME_LABEL: Record<Outcome, string> = {
  [Outcome.EAT]: '먹음',
  [Outcome.DISCARD]: '폐기',
  [Outcome.SHARE]: '나눔',
};

export const DERIVED_STATUS_LABEL: Record<DerivedStatus, string> = {
  [DerivedStatus.SAFE]: '안전',
  [DerivedStatus.WARN]: '임박',
  [DerivedStatus.DANGER]: '오늘 만료',
  [DerivedStatus.EXPIRED]: '만료',
  [DerivedStatus.LONG_TERM]: '장기보관',
  [DerivedStatus.CHECK_NEEDED]: '확인 필요',
};
