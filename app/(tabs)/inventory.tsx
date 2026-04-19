import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Alert, Animated } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useRouter, Link } from 'expo-router';
import { useFoodStore, useItemsWithStatus } from '@/hooks/useFoodStore';
import type { FoodItem } from '@/types';
import { Outcome, DerivedStatus, FoodCategory, FOOD_CATEGORY_LABEL, OUTCOME_LABEL, STORAGE_LOCATION_ICON, STORAGE_LOCATION_LABEL } from '@/types';
import { useColors } from '@/hooks/useColors';
import { getStatusPriority } from '@/lib/statusCalculator';
import SwipeableFoodCard from '@/components/SwipeableFoodCard';
import LocationFilter from '@/components/LocationFilter';

type SortMode = 'expiry' | 'status' | 'name' | 'added';
type ViewMode = 'compact' | 'card';

const UNDO_TIMEOUT_MS = 3000;

export default function InventoryScreen() {
  const router = useRouter();
  const c = useColors();
  const searchQuery = useFoodStore((s) => s.globalSearchQuery);
  const [sortMode, setSortMode] = useState<SortMode>('expiry');
  // [Council Round 3 합의 P0-1] 기본을 'card'로: compact 모드는 swipe-to-consume 미지원
  // 사용자가 명시적으로 '☰ 보기 방식' 토글로 compact를 선택하도록 함
  const [viewMode, setViewMode] = useState<ViewMode>('card');
  const [selectedCategory, setSelectedCategory] = useState<FoodCategory | 'ALL'>('ALL');
  const items = useItemsWithStatus();
  const allItems = useFoodStore((s) => s.items);
  const selectedLocation = useFoodStore((s) => s.selectedLocation);
  const setSelectedLocation = useFoodStore((s) => s.setSelectedLocation);
  const consumeItem = useFoodStore((s) => s.consumeItem);
  const batchConsumeItems = useFoodStore((s) => s.batchConsumeItems);

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
    // [Council Round 3 합의 P0-3] 소비 완료 아이템 명시 제외 (DB 필터에 의존하지 않음)
    for (const item of allItems) {
      if (item.consumed_at) continue;
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
        case 'status':
          return getStatusPriority(a.status) - getStatusPriority(b.status);
        case 'name':
          return a.name.localeCompare(b.name);
        case 'added':
          return b.added_at.localeCompare(a.added_at);
        default:
          return 0;
      }
    });
  }, [items, searchQuery, sortMode, selectedCategory]);

  const expiredItems = useMemo(
    () => items.filter((item) => item.status === DerivedStatus.EXPIRED),
    [items],
  );

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
            try {
              await batchConsumeItems(
                expiredItems.map((item) => item.id),
                Outcome.DISCARD,
              );
              Alert.alert('완료', `${expiredItems.length}개 식재료가 폐기 처리되었습니다.`);
            } catch {
              Alert.alert('오류', '일괄 폐기 중 문제가 발생했습니다. 다시 시도해주세요.');
            }
          },
        },
      ],
    );
  }, [expiredItems, batchConsumeItems]);

  const handleItemPress = useCallback((item: FoodItem) => {
    router.push(`/item/${item.id}`);
  }, [router]);

  const handleConsume = useCallback(async (item: FoodItem, outcome: Outcome) => {
    await consumeItem(item.id, outcome);
    showSnackbar(item, outcome);
  }, [consumeItem, showSnackbar]);

  // [C2 밀도 높은 리스트] 컴팩트 행 렌더러 (한 화면 12+ 아이템)
  const renderCompactRow = useCallback(({ item, index }: { item: FoodItem & { status: DerivedStatus; dDay: number | null }; index: number }) => {
    const statusColor =
      item.status === DerivedStatus.EXPIRED ? c.status.expired :
      item.status === DerivedStatus.DANGER ? c.status.danger :
      item.status === DerivedStatus.WARN ? c.status.warn :
      c.status.safe;
    const rowBg = index % 2 === 0 ? c.surface : c.background;
    const dDayLabel = item.expires_at && item.dDay != null
      ? (item.dDay >= 0 ? `D-${item.dDay}` : `D+${Math.abs(item.dDay)}`)
      : '—';
    return (
      <Pressable
        style={[styles.compactRow, { backgroundColor: rowBg, borderBottomColor: c.divider }]}
        onPress={() => handleItemPress(item)}
      >
        <View style={[styles.compactStatusBar, { backgroundColor: statusColor }]} />
        <Text style={styles.compactLocIcon}>{STORAGE_LOCATION_ICON[item.location] ?? '📦'}</Text>
        <View style={styles.compactNameCol}>
          <Text style={[styles.compactName, { color: c.text }]} numberOfLines={1}>{item.name}</Text>
          <Text style={[styles.compactMeta, { color: c.textSecondary }]} numberOfLines={1}>
            {FOOD_CATEGORY_LABEL[item.category]} · {item.quantity}{item.unit}
          </Text>
        </View>
        <View style={styles.compactDDayCol}>
          <Text style={[styles.compactDDay, { color: statusColor }]} numberOfLines={1}>
            {dDayLabel}
          </Text>
          <Text style={[styles.compactExpiresAt, { color: c.textLight }]} numberOfLines={1}>
            {item.expires_at ?? '미설정'}
          </Text>
        </View>
      </Pressable>
    );
  }, [c, handleItemPress]);

  const renderCardItem = useCallback(({ item }: { item: FoodItem }) => (
    <SwipeableFoodCard
      item={item}
      onPress={handleItemPress}
      onConsume={handleConsume}
    />
  ), [handleItemPress, handleConsume]);

  const renderItem = viewMode === 'compact' ? renderCompactRow : renderCardItem;

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
            <Text
              style={[
                styles.sortText,
                { color: c.textSecondary },
                sortMode === mode && { color: '#fff', fontWeight: '600' },
              ]}
              allowFontScaling={false}
            >
              {mode === 'expiry' ? '만료순' : mode === 'status' ? '위험순' : mode === 'name' ? '이름순' : '입고순'}
            </Text>
          </Pressable>
        ))}
        {expiredItems.length > 0 && (
          <Pressable
            style={[styles.bulkDiscardChip, { backgroundColor: c.status.expired }]}
            onPress={handleBulkDiscard}
          >
            <Text style={styles.bulkDiscardText} allowFontScaling={false}>
              만료 {expiredItems.length}개 폐기
            </Text>
          </Pressable>
        )}
        {/* [C2] 뷰 모드 토글 */}
        <Pressable
          style={[styles.viewToggle, { backgroundColor: c.surface, borderColor: c.border }]}
          onPress={() => setViewMode(viewMode === 'compact' ? 'card' : 'compact')}
        >
          <Text style={[styles.viewToggleText, { color: c.textSecondary }]}>
            {viewMode === 'compact' ? '☰ 한 줄' : '◫ 카드'}
          </Text>
        </Pressable>
      </View>

      {/* 카테고리 필터 */}
      {availableCategories.length > 1 && (
        <View style={styles.categoryRow}>
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
        </View>
      )}

      {/* 목록 */}
      <FlatList
        data={filteredItems}
        renderItem={renderItem as any}
        keyExtractor={keyExtractor}
        contentContainerStyle={viewMode === 'compact' ? styles.listCompact : styles.list}
        removeClippedSubviews
        maxToRenderPerBatch={viewMode === 'compact' ? 25 : 15}
        windowSize={viewMode === 'compact' ? 10 : 7}
        initialNumToRender={viewMode === 'compact' ? 18 : 10}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>{searchQuery ? '🔍' : '🧊'}</Text>
            <Text style={[styles.emptyTitle, { color: c.text }]}>
              {searchQuery ? '검색 결과가 없습니다' : '이 위치에 보관 중인 식재료가 없어요'}
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
  sortRow: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  sortChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, borderWidth: 1, overflow: 'visible' as const },
  sortText: { fontSize: 13 },
  bulkDiscardChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12 },
  bulkDiscardText: { fontSize: 13, color: '#fff', fontWeight: '600' },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, paddingBottom: 8, gap: 8 },
  catChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, borderWidth: 1, overflow: 'visible' as const },
  catText: { fontSize: 13 },
  list: { paddingBottom: 16 },
  listCompact: { paddingBottom: 16 },
  // [C2 밀도 높은 리스트] 스타일
  viewToggle: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  viewToggleText: { fontSize: 12, fontWeight: '700' },
  compactRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, paddingRight: 12,
    borderBottomWidth: 1,
    minHeight: 52,
  },
  compactStatusBar: { width: 4, height: 36, borderRadius: 2, marginRight: 10, marginLeft: 12 },
  compactLocIcon: { fontSize: 18, marginRight: 10 },
  compactNameCol: { flex: 1, minWidth: 0, marginRight: 8 },
  compactName: { fontSize: 14, fontWeight: '600' },
  compactMeta: { fontSize: 11, marginTop: 2 },
  compactDDayCol: { alignItems: 'flex-end', minWidth: 76 },
  compactDDay: { fontSize: 14, fontWeight: '800', letterSpacing: -0.3, fontVariant: ['tabular-nums'] },
  compactExpiresAt: { fontSize: 10, marginTop: 2 },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 8, paddingHorizontal: 32 },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: 16, fontWeight: '700' },
  emptyDesc: { fontSize: 13, textAlign: 'center' },
  emptyCta: { marginTop: 8, paddingHorizontal: 22, paddingVertical: 11, borderRadius: 10 },
  emptyCtaText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  snackbar: {
    position: 'absolute', bottom: 12, left: 12, right: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8,
    elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4,
  },
  snackbarText: { color: '#fff', fontSize: 13, flex: 1 },
  snackbarDismiss: { color: '#82B1FF', fontSize: 13, fontWeight: '700', marginLeft: 10 },
});
