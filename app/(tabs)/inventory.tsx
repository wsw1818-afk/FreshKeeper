import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Alert, ScrollView, Animated } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useRouter, Link } from 'expo-router';
import { useFoodStore, useFilteredItems } from '@/hooks/useFoodStore';
import type { FoodItem } from '@/types';
import { Outcome, DerivedStatus, FoodCategory, FOOD_CATEGORY_LABEL, OUTCOME_LABEL } from '@/types';
import { useColors } from '@/hooks/useColors';
import { calculateStatus, getStatusPriority } from '@/lib/statusCalculator';
import SwipeableFoodCard from '@/components/SwipeableFoodCard';
import LocationFilter from '@/components/LocationFilter';

type SortMode = 'expiry' | 'status' | 'name' | 'added';

const UNDO_TIMEOUT_MS = 3000;

export default function InventoryScreen() {
  const router = useRouter();
  const c = useColors();
  const searchQuery = useFoodStore((s) => s.globalSearchQuery);
  const [sortMode, setSortMode] = useState<SortMode>('expiry');
  const [selectedCategory, setSelectedCategory] = useState<FoodCategory | 'ALL'>('ALL');
  const items = useFilteredItems();
  const allItems = useFoodStore((s) => s.items);
  const selectedLocation = useFoodStore((s) => s.selectedLocation);
  const setSelectedLocation = useFoodStore((s) => s.setSelectedLocation);
  const consumeItem = useFoodStore((s) => s.consumeItem);

  // Undo 스낵바 상태
  const [undoInfo, setUndoInfo] = useState<{ item: FoodItem; outcome: Outcome } | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const snackbarAnim = useRef(new Animated.Value(0)).current;

  const showSnackbar = useCallback((item: FoodItem, outcome: Outcome) => {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setUndoInfo({ item, outcome });
    Animated.spring(snackbarAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 10 }).start();
    undoTimer.current = setTimeout(() => {
      Animated.timing(snackbarAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
        setUndoInfo(null);
      });
    }, UNDO_TIMEOUT_MS);
  }, [snackbarAnim]);

  const hideSnackbar = useCallback(() => {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    Animated.timing(snackbarAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
      setUndoInfo(null);
    });
  }, [snackbarAnim]);

  // 컴포넌트 언마운트 시 타이머 정리
  useEffect(() => {
    return () => {
      if (undoTimer.current) clearTimeout(undoTimer.current);
    };
  }, []);

  const locationCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of allItems) {
      counts[item.location] = (counts[item.location] ?? 0) + 1;
    }
    return counts;
  }, [allItems]);

  const availableCategories = useMemo(() => {
    const cats = new Set<FoodCategory>();
    for (const item of items) {
      cats.add(item.category);
    }
    return Array.from(cats).sort((a, b) =>
      FOOD_CATEGORY_LABEL[a].localeCompare(FOOD_CATEGORY_LABEL[b])
    );
  }, [items]);

  const filteredItems = useMemo(() => {
    let result = items;
    if (selectedCategory !== 'ALL') {
      result = result.filter((item) => item.category === selectedCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((item) => item.name.toLowerCase().includes(q));
    }

    return result.sort((a, b) => {
      switch (sortMode) {
        case 'expiry':
          if (!a.expires_at && !b.expires_at) return 0;
          if (!a.expires_at) return 1;
          if (!b.expires_at) return -1;
          return a.expires_at.localeCompare(b.expires_at);
        case 'status': {
          const sa = calculateStatus(a);
          const sb = calculateStatus(b);
          return getStatusPriority(sa.status) - getStatusPriority(sb.status);
        }
        case 'name':
          return a.name.localeCompare(b.name);
        case 'added':
          return b.added_at.localeCompare(a.added_at);
        default:
          return 0;
      }
    });
  }, [items, searchQuery, sortMode, selectedCategory]);

  const expiredItems = useMemo(() => {
    return items.filter((item) => {
      const { status } = calculateStatus(item);
      return status === DerivedStatus.EXPIRED;
    });
  }, [items]);

  const handleBulkDiscard = useCallback(() => {
    if (expiredItems.length === 0) return;
    Alert.alert(
      '일괄 폐기',
      `만료된 식재료 ${expiredItems.length}개를 모두 폐기할까요?\n\n${expiredItems.map((i) => `• ${i.name}`).join('\n')}`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: `${expiredItems.length}개 폐기`,
          style: 'destructive',
          onPress: async () => {
            for (const item of expiredItems) {
              await consumeItem(item.id, Outcome.DISCARD);
            }
            Alert.alert('완료', `${expiredItems.length}개 식재료가 폐기 처리되었습니다.`);
          },
        },
      ],
    );
  }, [expiredItems, consumeItem]);

  const handleItemPress = useCallback((item: FoodItem) => {
    router.push(`/item/${item.id}`);
  }, [router]);

  const handleConsume = useCallback((item: FoodItem, outcome: Outcome) => {
    const label = OUTCOME_LABEL[outcome];
    Alert.alert(
      label,
      `"${item.name}"을(를) ${label} 처리할까요?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: label,
          style: outcome === Outcome.DISCARD ? 'destructive' : 'default',
          onPress: async () => {
            await consumeItem(item.id, outcome);
            showSnackbar(item, outcome);
          },
        },
      ],
    );
  }, [consumeItem, showSnackbar]);

  const renderItem = useCallback(({ item }: { item: FoodItem }) => (
    <SwipeableFoodCard
      item={item}
      onPress={handleItemPress}
      onConsume={handleConsume}
    />
  ), [handleItemPress, handleConsume]);

  const keyExtractor = useCallback((item: FoodItem) => item.id, []);

  return (
    <GestureHandlerRootView style={[styles.container, { backgroundColor: c.background }]}>
      {/* 보관 위치 필터 */}
      <LocationFilter
        selected={selectedLocation}
        onSelect={setSelectedLocation}
        counts={locationCounts}
      />

      {/* 정렬 옵션 + 일괄 폐기 */}
      <View style={styles.sortRow}>
        {(['expiry', 'status', 'name', 'added'] as SortMode[]).map((mode) => (
          <Pressable
            key={mode}
            style={[
              styles.sortChip,
              { backgroundColor: c.surface, borderColor: c.border },
              sortMode === mode && { backgroundColor: c.primaryLight, borderColor: c.primaryLight },
            ]}
            onPress={() => setSortMode(mode)}
          >
            <Text style={[
              styles.sortText,
              { color: c.textSecondary },
              sortMode === mode && { color: '#fff', fontWeight: '600' },
            ]}>
              {mode === 'expiry' ? '만료순' : mode === 'status' ? '위험순' : mode === 'name' ? '이름순' : '입고순'}
            </Text>
          </Pressable>
        ))}
        {expiredItems.length > 0 && (
          <Pressable
            style={[styles.bulkDiscardChip, { backgroundColor: c.status.expired }]}
            onPress={handleBulkDiscard}
          >
            <Text style={styles.bulkDiscardText}>
              만료 {expiredItems.length}개 폐기
            </Text>
          </Pressable>
        )}
      </View>

      {/* 카테고리 필터 */}
      {availableCategories.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
          <Pressable
            style={[
              styles.catChip,
              { backgroundColor: c.surface, borderColor: c.border },
              selectedCategory === 'ALL' && { backgroundColor: c.accent, borderColor: c.accent },
            ]}
            onPress={() => setSelectedCategory('ALL')}
          >
            <Text style={[styles.catText, { color: c.textSecondary }, selectedCategory === 'ALL' && { color: '#fff', fontWeight: '600' }]}>전체</Text>
          </Pressable>
          {availableCategories.map((cat) => (
            <Pressable
              key={cat}
              style={[
                styles.catChip,
                { backgroundColor: c.surface, borderColor: c.border },
                selectedCategory === cat && { backgroundColor: c.accent, borderColor: c.accent },
              ]}
              onPress={() => setSelectedCategory(selectedCategory === cat ? 'ALL' : cat)}
            >
              <Text style={[styles.catText, { color: c.textSecondary }, selectedCategory === cat && { color: '#fff', fontWeight: '600' }]}>
                {FOOD_CATEGORY_LABEL[cat]}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {/* 목록 */}
      <FlatList
        data={filteredItems}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.list}
        removeClippedSubviews
        maxToRenderPerBatch={15}
        windowSize={7}
        initialNumToRender={10}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>{searchQuery ? '🔍' : '🧊'}</Text>
            <Text style={[styles.emptyTitle, { color: c.text }]}>
              {searchQuery ? '검색 결과가 없습니다' : '냉장고가 비어있어요'}
            </Text>
            <Text style={[styles.emptyDesc, { color: c.textSecondary }]}>
              {searchQuery
                ? '다른 키워드로 검색해보세요'
                : '식재료를 등록하면 만료일을 추적하고\n낭비를 줄일 수 있어요'}
            </Text>
            {!searchQuery && (
              <Link href="/(tabs)/add" asChild>
                <Pressable style={[styles.emptyCta, { backgroundColor: c.primary }]}>
                  <Text style={styles.emptyCtaText}>첫 식재료 등록하기</Text>
                </Pressable>
              </Link>
            )}
          </View>
        }
      />

      {/* Undo 스낵바 */}
      {undoInfo && (
        <Animated.View
          style={[
            styles.snackbar,
            {
              backgroundColor: '#323232',
              transform: [{ translateY: snackbarAnim.interpolate({ inputRange: [0, 1], outputRange: [80, 0] }) }],
              opacity: snackbarAnim,
            },
          ]}
        >
          <Text style={styles.snackbarText}>
            "{undoInfo.item.name}" {OUTCOME_LABEL[undoInfo.outcome]} 처리됨
          </Text>
          <Pressable onPress={hideSnackbar}>
            <Text style={styles.snackbarDismiss}>닫기</Text>
          </Pressable>
        </Animated.View>
      )}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  sortRow: { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 8, gap: 6 },
  sortChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1 },
  sortText: { fontSize: 12 },
  bulkDiscardChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  bulkDiscardText: { fontSize: 12, color: '#fff', fontWeight: '600' },
  categoryRow: { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 8, gap: 6 },
  catChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1 },
  catText: { fontSize: 12 },
  list: { paddingBottom: 16 },
  empty: { alignItems: 'center', paddingVertical: 48, gap: 10, paddingHorizontal: 32 },
  emptyIcon: { fontSize: 56 },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptyDesc: { fontSize: 14, textAlign: 'center', lineHeight: 22 },
  emptyCta: { marginTop: 8, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  emptyCtaText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  snackbar: {
    position: 'absolute', bottom: 16, left: 16, right: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderRadius: 8,
    elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4,
  },
  snackbarText: { color: '#fff', fontSize: 14, flex: 1 },
  snackbarDismiss: { color: '#82B1FF', fontSize: 14, fontWeight: '700', marginLeft: 12 },
});
