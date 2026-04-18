import { useMemo } from 'react';
import { InteractionManager } from 'react-native';
import { create } from 'zustand';
import type { FoodItem, FoodTemplate, NotificationSettings, StorageLocation, StorageLocationItem, Outcome } from '@/types';
import {
  getActiveFoodItems,
  insertFoodItem,
  updateFoodItem,
  deleteFoodItem,
  searchFoodItems,
  getAllTemplates,
  seedTemplates,
  incrementTemplateUsage,
  addConsumptionHistory,
  batchConsumeFoodItems,
  getNotificationSettings,
  updateNotificationSettings as repoUpdateNotificationSettings,
  getStorageLocations,
  insertStorageLocation,
} from '@/lib/repository';
import { calculateStatus } from '@/lib/statusCalculator';
import { calculateDDay, calculateExpiryDate, getToday } from '@/lib/dateUtils';
import { DEFAULT_NOTIFICATION_SETTINGS } from '@/constants/config';
import { updateItemNotifications, cancelItemNotifications } from '@/lib/notificationScheduler';
import logger from '@/lib/logger';

interface FoodStore {
  // State
  items: FoodItem[];
  templates: FoodTemplate[];
  storageLocations: StorageLocationItem[];
  isLoading: boolean;
  selectedLocation: StorageLocation | 'ALL';
  notificationSettings: NotificationSettings;
  globalSearchQuery: string;

  // Actions
  loadItems: () => Promise<void>;
  loadTemplates: () => Promise<void>;
  loadStorageLocations: () => Promise<void>;
  loadNotificationSettings: () => Promise<void>;
  updateNotificationSettings: (updates: Partial<NotificationSettings>) => Promise<void>;
  addItem: (item: Omit<FoodItem, 'id' | 'created_at' | 'updated_at'>) => Promise<FoodItem>;
  addItemFromTemplate: (template: FoodTemplate, overrides?: Partial<FoodItem>) => Promise<FoodItem>;
  editItem: (id: string, updates: Partial<FoodItem>) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  consumeItem: (id: string, outcome: Outcome) => Promise<void>;
  batchConsumeItems: (ids: string[], outcome: Outcome) => Promise<void>;
  searchItems: (query: string) => Promise<FoodItem[]>;
  setSelectedLocation: (location: StorageLocation | 'ALL') => void;
  setGlobalSearchQuery: (query: string) => void;
  addStorageLocation: (location: Omit<StorageLocationItem, 'id' | 'created_at' | 'updated_at'>) => Promise<StorageLocationItem>;
}

export const useFoodStore = create<FoodStore>((set, get) => ({
  items: [],
  templates: [],
  storageLocations: [],
  isLoading: false,
  selectedLocation: 'ALL',
  notificationSettings: DEFAULT_NOTIFICATION_SETTINGS,
  globalSearchQuery: '',

  loadStorageLocations: async () => {
    const locations = await getStorageLocations();
    set({ storageLocations: locations });
  },

  loadNotificationSettings: async () => {
    const settings = await getNotificationSettings();
    set({ notificationSettings: settings });
  },

  updateNotificationSettings: async (updates) => {
    await repoUpdateNotificationSettings(updates);
    set((state) => ({
      notificationSettings: { ...state.notificationSettings, ...updates },
    }));
  },

  loadItems: async () => {
    set({ isLoading: true });
    try {
      const items = await getActiveFoodItems();
      logger.info(`Loaded ${items.length} active food items`);
      set({ items });
    } finally {
      set({ isLoading: false });
    }
  },

  loadTemplates: async () => {
    await seedTemplates();
    const templates = await getAllTemplates();
    set({ templates });
  },

  addItem: async (itemData) => {
    const newItem = await insertFoodItem(itemData);
    logger.info(`Added new item: ${newItem.name} (${newItem.location})`);
    set((state) => ({ items: [...state.items, newItem] }));
    // 알림 스케줄링
    await updateItemNotifications(newItem, get().notificationSettings);
    return newItem;
  },

  addItemFromTemplate: async (template, overrides = {}) => {
    const today = getToday();
    const location = overrides.location ?? template.default_location;

    // 보관 위치에 맞는 기본 보관일 결정
    let freshnessDays: number | null = null;

    logger.debug('Template location', { location, template: template.name });
    logger.debug('Template freshness data', {
      fridge: template.fridge_days_min,
      freezer: template.freezer_days_min,
      pantry: template.pantry_days_min,
      kimchi_fridge: template.kimchi_fridge_days_min,
    });

    // 문자열 비교로 변경 (enum이 문자열 기반)
    if (location === 'FRIDGE') {
      freshnessDays = template.fridge_days_min;
    } else if (location === 'FREEZER') {
      freshnessDays = template.freezer_days_min;
    } else if (location === 'PANTRY') {
      freshnessDays = template.pantry_days_min;
    } else if (location === 'KIMCHI_FRIDGE') {
      freshnessDays = template.kimchi_fridge_days_min;
    }

    logger.info('Selected freshness days:', freshnessDays, 'for', location);

    const expiresAt = freshnessDays ? calculateExpiryDate(today, freshnessDays) : null;

    const itemData: Omit<FoodItem, 'id' | 'created_at' | 'updated_at'> = {
      name: template.name,
      category: template.category,
      location,
      image_uri: null,
      quantity: 1,
      unit: '개',
      added_at: today,
      date_type: 'RECOMMENDED' as FoodItem['date_type'],
      expires_at: expiresAt,
      opened_at: null,
      thawed_at: null,
      location_changed_at: null,
      freshness_days: freshnessDays,
      freshness_days_after_open: template.after_open_days,
      is_subdivided: false,
      subdivide_count: null,
      consumed_at: null,
      outcome: null,
      alert_offsets: template.default_alert_offsets,
      alert_enabled: true,
      memo: null,
      template_id: template.id,
      is_favorite: false,
      ...overrides,
    };

    const newItem = await insertFoodItem(itemData);
    await incrementTemplateUsage(template.id);
    set((state) => ({ items: [...state.items, newItem] }));
    // 알림 스케줄링
    await updateItemNotifications(newItem, get().notificationSettings);
    return newItem;
  },

  editItem: async (id, updates) => {
    await updateFoodItem(id, updates);
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id ? { ...item, ...updates } : item
      ),
    }));
    // 편집 후 알림 재스케줄
    const updatedItem = get().items.find((i) => i.id === id);
    if (updatedItem) {
      await updateItemNotifications(updatedItem, get().notificationSettings);
    }
  },

  removeItem: async (id) => {
    await cancelItemNotifications(id);
    await deleteFoodItem(id);
    // ScreenStackFragment(react-native-screens) 충돌 방지:
    // 네비게이션 애니메이션 진행 중 Zustand 리렌더가 겹치면 Android에서
    // Fragment 상태 예외가 발생할 수 있어 상호작용이 끝난 뒤 갱신한다.
    InteractionManager.runAfterInteractions(() => {
      set((state) => ({
        items: state.items.filter((item) => item.id !== id),
      }));
    });
  },

  consumeItem: async (id, outcome) => {
    const item = get().items.find((i) => i.id === id);
    if (!item) return;

    const today = getToday();
    const dDay = item.expires_at ? calculateDDay(item.expires_at) : 0;

    logger.info(`Consumed item: ${item.name} - Outcome: ${outcome}, D-Day: ${dDay}`);

    await cancelItemNotifications(id);
    await updateFoodItem(id, { consumed_at: today, outcome });
    await addConsumptionHistory({
      food_item_id: id,
      food_name: item.name,
      category: item.category,
      outcome,
      d_day_at_outcome: dDay,
      consumed_at: today,
    });

    // ScreenStackFragment 충돌 방지 (removeItem과 동일 이유)
    InteractionManager.runAfterInteractions(() => {
      set((state) => ({
        items: state.items.filter((i) => i.id !== id),
      }));
    });
  },

  batchConsumeItems: async (ids, outcome) => {
    const state = get();
    const targets = state.items.filter((i) => ids.includes(i.id));
    if (targets.length === 0) return;

    const today = getToday();
    const entries = targets.map((item) => ({
      item,
      outcome,
      dDay: item.expires_at ? calculateDDay(item.expires_at) : 0,
      consumedAt: today,
    }));

    logger.info(`Batch consume: ${targets.length} items, outcome=${outcome}`);

    // 알림 취소 (병렬 실행은 독립 작업이라 안전)
    await Promise.all(targets.map((item) => cancelItemNotifications(item.id)));

    // 단일 트랜잭션으로 DB 원자적 업데이트
    await batchConsumeFoodItems(entries);

    // 스토어 일괄 업데이트 (리렌더 1회)
    const removedIds = new Set(ids);
    set((s) => ({
      items: s.items.filter((i) => !removedIds.has(i.id)),
    }));
  },

  searchItems: async (query) => {
    return searchFoodItems(query);
  },

  setSelectedLocation: (location) => {
    set({ selectedLocation: location });
  },

  setGlobalSearchQuery: (query) => {
    set({ globalSearchQuery: query });
  },

  addStorageLocation: async (location) => {
    const newLocation = await insertStorageLocation(location);
    set((state) => ({
      storageLocations: [...state.storageLocations, newLocation],
    }));
    return newLocation;
  },
}));

// === Derived selectors ===

export function useFilteredItems() {
  const items = useFoodStore((s) => s.items);
  const location = useFoodStore((s) => s.selectedLocation);

  if (location === 'ALL') return items;
  return items.filter((item) => item.location === location);
}

export function useItemsWithStatus() {
  const items = useFilteredItems();
  return useMemo(
    () => items.map((item) => ({ ...item, ...calculateStatus(item) })),
    [items],
  );
}

export function useDashboardStats() {
  const items = useFoodStore((s) => s.items);

  return useMemo(() => {
    let expiredCount = 0;
    let dangerCount = 0;
    let warnCount = 0;
    let safeCount = 0;

    for (const item of items) {
      const { status } = calculateStatus(item);
      switch (status) {
        case 'EXPIRED': expiredCount++; break;
        case 'DANGER': dangerCount++; break;
        case 'WARN': warnCount++; break;
        case 'SAFE': safeCount++; break;
      }
    }

    return {
      total: items.length,
      expired: expiredCount,
      danger: dangerCount,
      warn: warnCount,
      safe: safeCount,
    };
  }, [items]);
}
