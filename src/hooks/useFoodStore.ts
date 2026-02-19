import { create } from 'zustand';
import type { FoodItem, FoodTemplate, NotificationSettings, StorageLocation, Outcome } from '@/types';
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
  getNotificationSettings,
  updateNotificationSettings as repoUpdateNotificationSettings,
} from '@/lib/repository';
import { calculateStatus } from '@/lib/statusCalculator';
import { calculateDDay, calculateExpiryDate, getToday } from '@/lib/dateUtils';
import { DEFAULT_NOTIFICATION_SETTINGS } from '@/constants/config';
import { updateItemNotifications, cancelItemNotifications } from '@/lib/notificationScheduler';

interface FoodStore {
  // State
  items: FoodItem[];
  templates: FoodTemplate[];
  isLoading: boolean;
  selectedLocation: StorageLocation | 'ALL';
  notificationSettings: NotificationSettings;
  globalSearchQuery: string;

  // Actions
  loadItems: () => Promise<void>;
  loadTemplates: () => Promise<void>;
  loadNotificationSettings: () => Promise<void>;
  updateNotificationSettings: (updates: Partial<NotificationSettings>) => Promise<void>;
  addItem: (item: Omit<FoodItem, 'id' | 'created_at' | 'updated_at'>) => Promise<FoodItem>;
  addItemFromTemplate: (template: FoodTemplate, overrides?: Partial<FoodItem>) => Promise<FoodItem>;
  editItem: (id: string, updates: Partial<FoodItem>) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  consumeItem: (id: string, outcome: Outcome) => Promise<void>;
  searchItems: (query: string) => Promise<FoodItem[]>;
  setSelectedLocation: (location: StorageLocation | 'ALL') => void;
  setGlobalSearchQuery: (query: string) => void;
}

export const useFoodStore = create<FoodStore>((set, get) => ({
  items: [],
  templates: [],
  isLoading: false,
  selectedLocation: 'ALL',
  notificationSettings: DEFAULT_NOTIFICATION_SETTINGS,
  globalSearchQuery: '',

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
    switch (location) {
      case 'FRIDGE':
        freshnessDays = template.fridge_days_min;
        break;
      case 'FREEZER':
        freshnessDays = template.freezer_days_min;
        break;
      case 'PANTRY':
        freshnessDays = template.pantry_days_min;
        break;
      case 'KIMCHI_FRIDGE':
        freshnessDays = template.kimchi_fridge_days_min;
        break;
    }

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
    set((state) => ({
      items: state.items.filter((item) => item.id !== id),
    }));
  },

  consumeItem: async (id, outcome) => {
    const item = get().items.find((i) => i.id === id);
    if (!item) return;

    const today = getToday();
    const dDay = item.expires_at ? calculateDDay(item.expires_at) : 0;

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

    set((state) => ({
      items: state.items.filter((i) => i.id !== id),
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
  return items.map((item) => ({
    ...item,
    ...calculateStatus(item),
  }));
}

export function useDashboardStats() {
  const items = useFoodStore((s) => s.items);

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
}
